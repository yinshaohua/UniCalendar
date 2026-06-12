import type { RequestUrlResponse } from 'obsidian';
import { CalendarEvent, CalendarSource, GoogleSyncDiagnostic, formatGoogleTokenFingerprint } from '../models/types';
import { GoogleAuthHelper, GoogleTokenError } from './GoogleAuthHelper';
import { getGoogleProxySettings, requestGoogleUrl, type GoogleProxySettings } from './GoogleProxyRequest';

const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const CALENDAR_EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';
const GOOGLE_EVENTS_REQUEST_TIMEOUT_MS = 15000;
const GOOGLE_DISCOVERY_REQUEST_TIMEOUT_MS = 15000;
const GOOGLE_SOURCE_SYNC_TIMEOUT_MS = 60000;

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEntry[];
}

interface GoogleCalendarApiEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  iCalUID?: string;
  location?: string;
  description?: string;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarApiEvent[];
  nextPageToken?: string;
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

export interface GoogleSyncAdapterOptions {
  eventsRequestTimeoutMs?: number;
  discoveryRequestTimeoutMs?: number;
  sourceSyncTimeoutMs?: number;
}

export class GoogleSyncAdapter {
  private authHelper: GoogleAuthHelper;
  private readonly eventsRequestTimeoutMs: number;
  private readonly discoveryRequestTimeoutMs: number;
  private readonly sourceSyncTimeoutMs: number;

  constructor(authHelper: GoogleAuthHelper, options: GoogleSyncAdapterOptions = {}) {
    this.authHelper = authHelper;
    this.eventsRequestTimeoutMs = options.eventsRequestTimeoutMs ?? GOOGLE_EVENTS_REQUEST_TIMEOUT_MS;
    this.discoveryRequestTimeoutMs = options.discoveryRequestTimeoutMs ?? GOOGLE_DISCOVERY_REQUEST_TIMEOUT_MS;
    this.sourceSyncTimeoutMs = options.sourceSyncTimeoutMs ?? GOOGLE_SOURCE_SYNC_TIMEOUT_MS;
  }

  async discoverCalendars(accessToken: string, proxySettings?: GoogleProxySettings): Promise<GoogleCalendarEntry[]> {
    let response: RequestUrlResponse;
    try {
      response = await this.withTimeout(
        requestGoogleUrl(
          {
            url: CALENDAR_LIST_URL,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: this.discoveryRequestTimeoutMs,
          },
          proxySettings,
        ),
        this.discoveryRequestTimeoutMs,
        'discovery',
      );
    } catch (cause) {
      if (this.isTimeoutError(cause)) {
        throw new Error(
          `获取 Google 日历列表超时（>${this.discoveryRequestTimeoutMs}ms），请检查网络后重试。`,
        );
      }
      throw cause;
    }

    const payload = this.parseCalendarListResponse(response.json);
    const items = payload.items ?? [];
    return items.map((item) => ({
      id: item.id,
      summary: item.summary,
      primary: !!item.primary,
      backgroundColor: item.backgroundColor,
    }));
  }

  async sync(
    source: CalendarSource,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    if (!source.google) {
      throw new Error('日历源缺少Google配置');
    }

    // Prefer selectedCalendars array, fallback to legacy calendarId
    const calendarIds: string[] = [];
    if (source.google.selectedCalendars && source.google.selectedCalendars.length > 0) {
      for (const cal of source.google.selectedCalendars) {
        calendarIds.push(cal.id);
      }
    } else if (source.google.calendarId) {
      calendarIds.push(source.google.calendarId);
    } else {
      throw new Error('未选择要同步的Google日历');
    }

    try {
      return await this.withTimeout(
        this.runSync(source, calendarIds, rangeStart, rangeEnd),
        this.sourceSyncTimeoutMs,
        'source-sync',
      );
    } catch (error) {
      const wrapped = this.isTimeoutError(error)
        ? new Error(`Google 同步超时（>${this.sourceSyncTimeoutMs}ms），请检查网络后重试。`)
        : error;
      this.persistGoogleDiagnostic(source, wrapped);
      throw wrapped;
    }
  }

  private async runSync(
    source: CalendarSource,
    calendarIds: string[],
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const accessToken = await this.authHelper.ensureValidToken(source.google);
    console.debug(
      `[UniCalendar] Google token ready: source=${source.name}, calendars=${calendarIds.length}, range=${rangeStart.toISOString()}..${rangeEnd.toISOString()}`,
    );
    const allEvents: CalendarEvent[] = [];
    for (const calId of calendarIds) {
      const calendarStartedAt = performance.now();
      console.debug(`[UniCalendar] Google calendar sync started: source=${source.name}, calendarId=${calId}`);
      const events = await this.fetchEvents(
        calId,
        accessToken,
        source.id,
        source.name,
        rangeStart,
        rangeEnd,
        getGoogleProxySettings(source.google),
      );
      allEvents.push(...events);
      console.debug(
        `[UniCalendar] Google calendar sync finished: source=${source.name}, calendarId=${calId}, events=${events.length}, durationMs=${Math.round(performance.now() - calendarStartedAt)}`,
      );
    }
    delete source.google!.lastSyncError;
    return allEvents;
  }

  private async fetchEvents(
    calendarId: string,
    accessToken: string,
    sourceId: string,
    sourceName: string,
    rangeStart: Date,
    rangeEnd: Date,
    proxySettings?: GoogleProxySettings,
  ): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;
    let page = 1;

    do {
      const pageStartedAt = performance.now();
      console.debug(`[UniCalendar] Google events page requested: source=${sourceName}, calendarId=${calendarId}, page=${page}, hasPageToken=${pageToken ? 'yes' : 'no'}`);
      const params = new URLSearchParams({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: 'true',
        maxResults: '2500',
        orderBy: 'startTime',
      });
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const url = `${CALENDAR_EVENTS_BASE}/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
      const response = await this.requestEventsPage(url, accessToken, sourceName, calendarId, page, proxySettings);
      const json = this.parseEventsResponse(response.json);
      const items = json.items ?? [];
      for (const item of items) {
        allEvents.push(this.toCalendarEvent(item, sourceId));
      }

      pageToken = json.nextPageToken;
      console.debug(
        `[UniCalendar] Google events page finished: source=${sourceName}, calendarId=${calendarId}, page=${page}, items=${items.length}, nextPageToken=${pageToken ? 'yes' : 'no'}, durationMs=${Math.round(performance.now() - pageStartedAt)}`,
      );
      page++;
    } while (pageToken);

    return allEvents;
  }

  private async requestEventsPage(
    url: string,
    accessToken: string,
    sourceName: string,
    calendarId: string,
    page: number,
    proxySettings?: GoogleProxySettings,
  ): Promise<RequestUrlResponse> {
    let response: RequestUrlResponse;
    try {
      response = await this.withTimeout(
        requestGoogleUrl(
          {
            url,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: this.eventsRequestTimeoutMs,
          },
          proxySettings,
        ),
        this.eventsRequestTimeoutMs,
      );
    } catch (cause) {
      throw this.wrapGoogleApiError('获取 Google 日历事件失败，请检查网络后重试。', sourceName, calendarId, cause, page);
    }

    if (typeof response.status === 'number' && response.status >= 400) {
      const responseJson: unknown = response.json;
      throw this.wrapGoogleApiError('获取 Google 日历事件失败，请稍后重试。', sourceName, calendarId, {
        status: response.status,
        json: responseJson,
      }, page);
    }

    return response;
  }

  private parseCalendarListResponse(json: unknown): GoogleCalendarListResponse {
    if (!json || typeof json !== 'object') {
      return {};
    }

    const record = json as Record<string, unknown>;
    const rawItems = record['items'];
    if (!Array.isArray(rawItems)) {
      return {};
    }

    const items = rawItems.flatMap((item): GoogleCalendarEntry[] => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const recordItem = item as Record<string, unknown>;
      const id = recordItem['id'];
      const summary = recordItem['summary'];
      const primary = recordItem['primary'];
      const backgroundColor = recordItem['backgroundColor'];
      if (typeof id !== 'string' || typeof summary !== 'string') {
        return [];
      }

      return [{
        id,
        summary,
        primary: primary === true,
        backgroundColor: typeof backgroundColor === 'string' ? backgroundColor : undefined,
      }];
    });

    return { items };
  }

  private parseEventsResponse(json: unknown): GoogleCalendarEventsResponse {
    if (!json || typeof json !== 'object') {
      return {};
    }

    const record = json as Record<string, unknown>;
    const rawItems = record['items'];
    const rawNextPageToken = record['nextPageToken'];
    const items = Array.isArray(rawItems)
      ? rawItems.flatMap((item): GoogleCalendarApiEvent[] => this.parseGoogleCalendarEvent(item))
      : undefined;

    return {
      items,
      nextPageToken: typeof rawNextPageToken === 'string' ? rawNextPageToken : undefined,
    };
  }

  private parseGoogleCalendarEvent(value: unknown): GoogleCalendarApiEvent[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;
    const id = record['id'];
    const start = this.parseEventBoundary(record['start']);
    const end = this.parseEventBoundary(record['end']);
    if (typeof id !== 'string' || !start || !end) {
      return [];
    }

    const summary = record['summary'];
    const iCalUID = record['iCalUID'];
    const location = record['location'];
    const description = record['description'];

    return [{
      id,
      summary: typeof summary === 'string' ? summary : undefined,
      start,
      end,
      iCalUID: typeof iCalUID === 'string' ? iCalUID : undefined,
      location: typeof location === 'string' ? location : undefined,
      description: typeof description === 'string' ? description : undefined,
    }];
  }

  private parseEventBoundary(value: unknown): { dateTime?: string; date?: string } | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const dateTime = record['dateTime'];
    const date = record['date'];
    if (typeof dateTime !== 'string' && typeof date !== 'string') {
      return null;
    }

    return {
      dateTime: typeof dateTime === 'string' ? dateTime : undefined,
      date: typeof date === 'string' ? date : undefined,
    };
  }

  private persistGoogleDiagnostic(source: CalendarSource, error: unknown): void {
    if (!source.google) {
      return;
    }

    if (error instanceof GoogleTokenError) {
      source.google.lastSyncError = {
        message: error.userMessage,
        kind: error.kind,
        operation: error.operation,
        timestamp: Date.now(),
        status: error.status,
        apiError: error.apiError,
        apiErrorDescription: error.apiErrorDescription,
        tokenFingerprint: source.google.lastRefreshTokenFingerprintUsed ?? formatGoogleTokenFingerprint(source.google.refreshToken),
        tokenSavedAt: source.google.refreshTokenSavedAt,
        tokenLastRefreshedAt: source.google.lastRefreshAttemptAt,
      };
      return;
    }

    const status = this.extractStatus(error);
    source.google.lastSyncError = {
      message: error instanceof Error ? error.message : String(error),
      kind: this.mapCalendarApiKind(status),
      operation: 'calendar-api',
      timestamp: Date.now(),
      status,
      apiError: this.extractApiError(error),
      apiErrorDescription: this.extractApiErrorDescription(error),
    };
  }

  private wrapGoogleApiError(userMessage: string, sourceName: string, calendarId: string, cause: unknown, page?: number): Error {
    if (cause instanceof GoogleTokenError) {
      return cause;
    }

    const status = this.extractStatus(cause);
    const apiError = this.extractApiError(cause);
    const apiErrorDescription = this.extractApiErrorDescription(cause);
    const logContext = {
      sourceName,
      calendarId,
      page,
      timeoutMs: this.eventsRequestTimeoutMs,
      status,
      apiError,
      apiErrorDescription,
      cause,
    };

    console.error('[UniCalendar] Google Calendar API request failed', logContext);

    if (this.isTimeoutError(cause)) {
      return new Error(`获取 Google 日历事件超时（>${this.eventsRequestTimeoutMs}ms），请检查网络后重试。`);
    }

    if (status === 401 || status === 403) {
      return new Error('Google 日历访问被拒绝，请重新授权后再试。');
    }

    if (status === 429) {
      return new Error('Google 日历接口请求过于频繁，请稍后重试。');
    }

    if (status !== undefined && status >= 500) {
      return new Error('Google 日历服务暂时异常，请稍后重试。');
    }

    return new Error(userMessage);
  }

  private mapCalendarApiKind(status: number | undefined): GoogleSyncDiagnostic['kind'] {
    if (status === 429) {
      return 'rate_limited';
    }
    if (status !== undefined && status >= 500) {
      return 'server';
    }
    if (status === 401 || status === 403) {
      return 'invalid_grant';
    }
    if (status !== undefined) {
      return 'unknown';
    }
    return 'network';
  }

  private extractStatus(cause: unknown): number | undefined {
    if (!cause || typeof cause !== 'object') {
      return undefined;
    }
    const value: unknown = Reflect.get(cause, 'status');
    return typeof value === 'number' ? value : undefined;
  }

  private extractApiError(cause: unknown): string | undefined {
    const json = this.extractJson(cause);
    return typeof json.error === 'string' ? json.error : undefined;
  }

  private extractApiErrorDescription(cause: unknown): string | undefined {
    const json = this.extractJson(cause);
    return typeof json.error_description === 'string' ? json.error_description : undefined;
  }

  private extractJson(cause: unknown): Record<string, unknown> {
    if (!cause || typeof cause !== 'object') {
      return {};
    }
    const value: unknown = Reflect.get(cause, 'json');
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string = 'events'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = globalThis.setTimeout(() => {
        reject(new Error(`Google ${label} request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          globalThis.clearTimeout(timeoutId);
          resolve(value);
        },
        (error: unknown) => {
          globalThis.clearTimeout(timeoutId);
          // Preserve the original cause (could be a non-Error POJO from
          // requestUrl) so downstream mappers can still extract status/json.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- propagate diagnostic-rich cause unchanged
          reject(error);
        },
      );
    });
  }

  private isTimeoutError(cause: unknown): boolean {
    return cause instanceof Error && /timed out/i.test(cause.message);
  }

  private toCalendarEvent(
    googleEvent: {
      id: string;
      summary?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      iCalUID?: string;
      location?: string;
      description?: string;
    },
    sourceId: string,
  ): CalendarEvent {
    const isAllDay = !!googleEvent.start.date;

    let start: string;
    let end: string;

    if (isAllDay) {
      start = googleEvent.start.date!;
      // Google API uses exclusive end date for all-day events; subtract 1 day
      const endDate = new Date(googleEvent.end.date! + 'T00:00:00');
      endDate.setDate(endDate.getDate() - 1);
      end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    } else {
      start = new Date(googleEvent.start.dateTime!).toISOString();
      end = new Date(googleEvent.end.dateTime!).toISOString();
    }

    return {
      id: `${sourceId}::${googleEvent.id}`,
      sourceId,
      title: googleEvent.summary || '',
      start,
      end,
      allDay: isAllDay,
      location: googleEvent.location || undefined,
      description: googleEvent.description || undefined,
      uid: googleEvent.iCalUID || googleEvent.id,
    };
  }
}

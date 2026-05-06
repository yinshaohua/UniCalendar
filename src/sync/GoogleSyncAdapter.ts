import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource, GoogleSyncDiagnostic, formatGoogleTokenFingerprint } from '../models/types';
import { GoogleAuthHelper, GoogleTokenError } from './GoogleAuthHelper';

const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const CALENDAR_EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

export class GoogleSyncAdapter {
  private authHelper: GoogleAuthHelper;

  constructor(authHelper: GoogleAuthHelper) {
    this.authHelper = authHelper;
  }

  async discoverCalendars(accessToken: string): Promise<GoogleCalendarEntry[]> {
    const response = await requestUrl({
      url: CALENDAR_LIST_URL,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const items = response.json.items || [];
    return items.map((item: { id: string; summary: string; primary?: boolean; backgroundColor?: string }) => ({
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
      const accessToken = await this.authHelper.ensureValidToken(source.google);
      const allEvents: CalendarEvent[] = [];
      for (const calId of calendarIds) {
        const events = await this.fetchEvents(calId, accessToken, source.id, source.name, rangeStart, rangeEnd);
        allEvents.push(...events);
      }
      delete source.google.lastSyncError;
      return allEvents;
    } catch (error) {
      this.persistGoogleDiagnostic(source, error);
      throw error;
    }
  }

  private async fetchEvents(
    calendarId: string,
    accessToken: string,
    sourceId: string,
    sourceName: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
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
      let response;
      try {
        response = await requestUrl({
          url,
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
      } catch (cause) {
        throw this.wrapGoogleApiError('获取 Google 日历事件失败，请检查网络后重试。', sourceName, calendarId, cause);
      }

      if (typeof response.status === 'number' && response.status >= 400) {
        throw this.wrapGoogleApiError('获取 Google 日历事件失败，请稍后重试。', sourceName, calendarId, {
          status: response.status,
          json: response.json,
        });
      }

      const json = response.json;
      const items = json.items || [];
      for (const item of items) {
        allEvents.push(this.toCalendarEvent(item, sourceId));
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return allEvents;
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

  private wrapGoogleApiError(userMessage: string, sourceName: string, calendarId: string, cause: unknown): Error {
    if (cause instanceof GoogleTokenError) {
      return cause;
    }

    const status = this.extractStatus(cause);
    const apiError = this.extractApiError(cause);
    const apiErrorDescription = this.extractApiErrorDescription(cause);
    const logContext = {
      sourceName,
      calendarId,
      status,
      apiError,
      apiErrorDescription,
      cause,
    };

    console.error('[UniCalendar] Google Calendar API request failed', logContext);

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
    const value = Reflect.get(cause, 'status');
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
    const value = Reflect.get(cause, 'json');
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
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

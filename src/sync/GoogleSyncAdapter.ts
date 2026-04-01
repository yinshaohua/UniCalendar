import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource } from '../models/types';
import { GoogleAuthHelper } from './GoogleAuthHelper';

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
    if (!source.google.calendarId) {
      throw new Error('未选择要同步的Google日历');
    }

    const accessToken = await this.authHelper.ensureValidToken(source.google);
    return this.fetchEvents(
      source.google.calendarId,
      accessToken,
      source.id,
      rangeStart,
      rangeEnd,
    );
  }

  private async fetchEvents(
    calendarId: string,
    accessToken: string,
    sourceId: string,
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
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const json = response.json;
      const items = json.items || [];
      for (const item of items) {
        allEvents.push(this.toCalendarEvent(item, sourceId));
      }

      pageToken = json.nextPageToken;
    } while (pageToken);

    return allEvents;
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
      end = googleEvent.end.date!;
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

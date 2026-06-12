import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';
import { GoogleSyncAdapter, GoogleCalendarEntry } from '../../src/sync/GoogleSyncAdapter';
import { GoogleAuthHelper } from '../../src/sync/GoogleAuthHelper';
import { CalendarSource } from '../../src/models/types';

vi.mock('obsidian');

function makeResponse(json: unknown, status = 200, text = '') {
  return {
    json,
    text,
    status,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
  };
}

function makeGoogleSource(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'gsrc-1',
    name: 'My Google',
    type: 'google',
    color: '#FF6961',
    enabled: true,
    google: {
      clientId: 'cid',
      clientSecret: 'cs',
      accessToken: 'valid-token',
      refreshToken: 'rt',
      tokenExpiry: Date.now() + 60 * 60 * 1000,
      calendarId: 'primary',
      calendarName: 'Primary',
    },
    ...overrides,
  };
}

describe('GoogleSyncAdapter', () => {
  let adapter: GoogleSyncAdapter;
  let authHelper: GoogleAuthHelper;
  let ensureValidTokenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    authHelper = new GoogleAuthHelper();
    // Mock ensureValidToken to just return the existing token
    ensureValidTokenSpy = vi.spyOn(authHelper, 'ensureValidToken').mockResolvedValue('valid-token');
    adapter = new GoogleSyncAdapter(authHelper);
    vi.mocked(requestUrl).mockReset();
    vi.mocked(requestUrl).mockResolvedValue(makeResponse({}, 200));
  });

  describe('discoverCalendars', () => {
    it('calls GET calendarList with Bearer token and returns entries', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          items: [
            { id: 'primary', summary: 'Main', primary: true, backgroundColor: '#0088aa' },
            { id: 'work@group.v.calendar.google.com', summary: 'Work', primary: false },
          ],
        }, 200));

      const calendars: GoogleCalendarEntry[] = await adapter.discoverCalendars('my-token');

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        id: 'primary',
        summary: 'Main',
        primary: true,
        backgroundColor: '#0088aa',
      });
      expect(calendars[1]!.id).toBe('work@group.v.calendar.google.com');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string; headers: Record<string, string> };
      expect(call.url).toBe('https://www.googleapis.com/calendar/v3/users/me/calendarList');
      expect(call.headers['Authorization']).toBe('Bearer my-token');
    });

    it('routes calendar discovery through system proxy mode while preserving headers', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ items: [] }, 200));

      await adapter.discoverCalendars('my-token', { mode: 'system' });

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string; headers: Record<string, string>; method: string };
      expect(call.url).toBe('https://www.googleapis.com/calendar/v3/users/me/calendarList');
      expect(call.method).toBe('GET');
      expect(call.headers['Authorization']).toBe('Bearer my-token');
    });
  });

  describe('sync', () => {
    it('calls ensureValidToken then fetchEvents and returns CalendarEvent[]', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          items: [
            {
              id: 'evt1',
              summary: 'Meeting',
              start: { dateTime: '2026-04-01T10:00:00+08:00' },
              end: { dateTime: '2026-04-01T11:00:00+08:00' },
              iCalUID: 'ical-uid-1',
              location: 'Room A',
            },
          ],
        }, 200));

      const source = makeGoogleSource();
      const events = await adapter.sync(
        source,
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z'),
      );

      expect(ensureValidTokenSpy).toHaveBeenCalledWith(source.google);
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('Meeting');
      expect(events[0]!.uid).toBe('ical-uid-1');
      expect(events[0]!.sourceId).toBe('gsrc-1');
      expect(events[0]!.location).toBe('Room A');

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string; headers: Record<string, string> };
      expect(call.url).toContain('https://www.googleapis.com/calendar/v3/calendars/primary/events?');
      expect(call.headers['Authorization']).toBe('Bearer valid-token');
    });

    it('routes events requests through system proxy mode while preserving headers', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ items: [] }, 200));

      await adapter.sync(
        makeGoogleSource({
          google: {
            clientId: 'cid',
            clientSecret: 'cs',
            accessToken: 'valid-token',
            refreshToken: 'refresh-token',
            tokenExpiry: Date.now() + 60 * 60 * 1000,
            calendarId: 'primary',
            proxyMode: 'system',
          },
        }),
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z'),
      );

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string; headers: Record<string, string>; method: string };
      expect(call.url).toContain('https://www.googleapis.com/calendar/v3/calendars/primary/events?');
      expect(call.url).toContain('singleEvents=true');
      expect(call.method).toBe('GET');
      expect(call.headers['Authorization']).toBe('Bearer valid-token');
    });

    it('wraps Google events API 401 as reauth guidance', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ error: { message: 'Invalid Credentials' } }, 401));

      await expect(
        adapter.sync(makeGoogleSource(), new Date(), new Date()),
      ).rejects.toThrow(/重新授权/);
    });

    it('wraps Google events API network failures as retryable guidance', async () => {
      vi.mocked(requestUrl).mockRejectedValueOnce(new Error('socket hang up'));

      await expect(
        adapter.sync(makeGoogleSource(), new Date(), new Date()),
      ).rejects.toThrow(/检查网络/);
    });

    it('throws with Chinese error when source.google is undefined', async () => {
      const source = makeGoogleSource();
      source.google = undefined;

      await expect(
        adapter.sync(source, new Date(), new Date()),
      ).rejects.toThrow(/日历源缺少Google配置/);
    });

    it('throws with Chinese error containing "未选择" when calendarId is undefined', async () => {
      const source = makeGoogleSource();
      source.google!.calendarId = undefined;

      await expect(
        adapter.sync(source, new Date(), new Date()),
      ).rejects.toThrow(/未选择/);
    });

    it('rejects with timeout-shaped error when source sync exceeds the configured timeout', async () => {
      const fastTimeoutAdapter = new GoogleSyncAdapter(authHelper, { sourceSyncTimeoutMs: 20 });
      // Never resolves -> should hit the 20ms source-sync ceiling.
      vi.mocked(requestUrl).mockImplementation((() => new Promise(() => undefined)) as unknown as typeof requestUrl);

      await expect(
        fastTimeoutAdapter.sync(makeGoogleSource(), new Date('2026-04-01'), new Date('2026-04-30')),
      ).rejects.toThrow(/Google 同步超时/);
    });

    it('rejects with timeout-shaped error when single events page request stalls', async () => {
      const fastTimeoutAdapter = new GoogleSyncAdapter(authHelper, { eventsRequestTimeoutMs: 20 });
      vi.mocked(requestUrl).mockImplementation((() => new Promise(() => undefined)) as unknown as typeof requestUrl);

      await expect(
        fastTimeoutAdapter.sync(makeGoogleSource(), new Date('2026-04-01'), new Date('2026-04-30')),
      ).rejects.toThrow(/获取 Google 日历事件超时/);
    });
  });

  describe('discoverCalendars timeout', () => {
    it('rejects with localized timeout error when calendarList request stalls', async () => {
      const fastTimeoutAdapter = new GoogleSyncAdapter(authHelper, { discoveryRequestTimeoutMs: 20 });
      vi.mocked(requestUrl).mockImplementation((() => new Promise(() => undefined)) as unknown as typeof requestUrl);

      await expect(fastTimeoutAdapter.discoverCalendars('any-token')).rejects.toThrow(/获取 Google 日历列表超时/);
    });
  });

  describe('toCalendarEvent mapping', () => {
    it('maps Google timed event to CalendarEvent with UTC ISO start/end', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          items: [
            {
              id: 'timed-1',
              summary: 'Timed Event',
              start: { dateTime: '2026-04-01T14:00:00+08:00' },
              end: { dateTime: '2026-04-01T15:00:00+08:00' },
              iCalUID: 'timed-uid-1',
            },
          ],
        }, 200));

      const events = await adapter.sync(
        makeGoogleSource(),
        new Date('2026-04-01'),
        new Date('2026-04-30'),
      );

      expect(events[0]!.allDay).toBe(false);
      // Should be normalized to UTC ISO
      expect(events[0]!.start).toBe(new Date('2026-04-01T14:00:00+08:00').toISOString());
      expect(events[0]!.end).toBe(new Date('2026-04-01T15:00:00+08:00').toISOString());
      expect(events[0]!.uid).toBe('timed-uid-1');
    });

    it('maps Google all-day event to CalendarEvent with date string start/end', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          items: [
            {
              id: 'allday-1',
              summary: 'All Day',
              start: { date: '2026-04-05' },
              end: { date: '2026-04-06' },
              iCalUID: 'allday-uid-1',
            },
          ],
        }, 200));

      const events = await adapter.sync(
        makeGoogleSource(),
        new Date('2026-04-01'),
        new Date('2026-04-30'),
      );

      // All-day events: adapter normalizes exclusive end date to inclusive
      expect(events[0]!.allDay).toBe(true);
      expect(events[0]!.start).toBe('2026-04-05');
      expect(events[0]!.end).toBe('2026-04-05');
    });

    it('uses googleEvent.id as uid fallback when iCalUID is absent', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({
          items: [
            {
              id: 'fallback-id',
              summary: 'No UID',
              start: { dateTime: '2026-04-01T10:00:00Z' },
              end: { dateTime: '2026-04-01T11:00:00Z' },
            },
          ],
        }, 200));

      const events = await adapter.sync(
        makeGoogleSource(),
        new Date('2026-04-01'),
        new Date('2026-04-30'),
      );

      expect(events[0]!.uid).toBe('fallback-id');
    });
  });

  describe('fetchEvents pagination', () => {
    it('handles pagination by following nextPageToken', async () => {
      vi.mocked(requestUrl)
        .mockResolvedValueOnce(makeResponse({
            items: [
              { id: 'e1', summary: 'Event 1', start: { dateTime: '2026-04-01T10:00:00Z' }, end: { dateTime: '2026-04-01T11:00:00Z' }, iCalUID: 'uid1' },
            ],
            nextPageToken: 'page2token',
          }, 200))
        .mockResolvedValueOnce(makeResponse({
            items: [
              { id: 'e2', summary: 'Event 2', start: { dateTime: '2026-04-02T10:00:00Z' }, end: { dateTime: '2026-04-02T11:00:00Z' }, iCalUID: 'uid2' },
            ],
          }, 200));

      const events = await adapter.sync(
        makeGoogleSource(),
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T23:59:59Z'),
      );

      expect(events).toHaveLength(2);
      expect(events[0]!.title).toBe('Event 1');
      expect(events[1]!.title).toBe('Event 2');
      expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(2);
    });

    it('passes singleEvents=true, orderBy=startTime, timeMin, timeMax, maxResults=2500', async () => {
      vi.mocked(requestUrl).mockResolvedValueOnce(makeResponse({ items: [] }, 200));

      const rangeStart = new Date('2026-04-01T00:00:00Z');
      const rangeEnd = new Date('2026-04-30T23:59:59Z');

      await adapter.sync(makeGoogleSource(), rangeStart, rangeEnd);

      const call = vi.mocked(requestUrl).mock.calls[0]![0] as { url: string };
      const url = new URL(call.url);
      expect(url.searchParams.get('singleEvents')).toBe('true');
      expect(url.searchParams.get('orderBy')).toBe('startTime');
      expect(url.searchParams.get('timeMin')).toBe(rangeStart.toISOString());
      expect(url.searchParams.get('timeMax')).toBe(rangeEnd.toISOString());
      expect(url.searchParams.get('maxResults')).toBe('2500');
    });
  });
});

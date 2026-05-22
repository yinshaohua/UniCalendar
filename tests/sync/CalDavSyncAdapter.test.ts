import { describe, it, expect, vi, afterEach, beforeAll, type MockInstance } from 'vitest';
import { requestUrl } from 'obsidian';
import { CalDavSyncAdapter } from '../../src/sync/CalDavSyncAdapter';
import { IcsSyncAdapter } from '../../src/sync/IcsSyncAdapter';
import type { CalendarSource, CalDavCache } from '../../src/models/types';

vi.mock('obsidian', async () => {
  const actual = await vi.importActual<typeof import('../mocks/obsidian')>('../mocks/obsidian');
  return {
    ...actual,
    requestUrl: vi.fn(),
  };
});

const mockedRequestUrl = vi.mocked(requestUrl);

beforeAll(() => {
  class FakeDOMParser {
    parseFromString(xmlText: string) {
      const matches = [...xmlText.matchAll(/<([\w:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)];
      const elements = matches.map(match => ({
        localName: match[1]?.split(':').pop() ?? '',
        textContent: match[2] ?? '',
      }));

      return {
        getElementsByTagName: (_tag: string) => elements,
        getElementsByTagNameNS: (ns: string, tag: string) => {
          if (ns === 'DAV:' && tag === 'response') {
            return [...xmlText.matchAll(/<([\w:-]*response)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map(match => ({
              getElementsByTagNameNS: (innerNs: string, innerTag: string) => {
                if (innerNs === 'DAV:' && innerTag === 'propstat') {
                  return [...(match[2] ?? '').matchAll(/<([\w:-]*propstat)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map(propstatMatch => ({
                    getElementsByTagName: () => [],
                    getElementsByTagNameNS: () => [],
                    __xml: propstatMatch[2] ?? '',
                  }));
                }
                return [];
              },
              getElementsByTagName: () => [],
              __xml: match[2] ?? '',
            }));
          }
          return [];
        },
      };
    }
  }

  vi.stubGlobal('DOMParser', FakeDOMParser);
});

function makeCalDavSource(overrides: Partial<CalendarSource> = {}): CalendarSource {
  return {
    id: 'feishu-source',
    name: '飞书日历',
    type: 'caldav',
    color: '#74C0FC',
    enabled: true,
    caldav: {
      serverUrl: 'https://caldav.feishu.cn',
      username: 'user@example.com',
      password: 'secret',
      selectedCalendars: [{ path: '/calendar/primary/', displayName: 'Primary' }],
    },
    ...overrides,
  };
}

describe('CalDavSyncAdapter', () => {
  let consoleWarnSpy: MockInstance;

  afterEach(() => {
    vi.useRealTimers();
    mockedRequestUrl.mockReset();
    consoleWarnSpy?.mockRestore();
  });

  it('discovers calendars from standard CalDAV discovery responses without relying on DOM children APIs', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <multistatus xmlns="DAV:">
            <response>
              <propstat>
                <prop>
                  <current-user-principal>
                    <href>/principals/users/demo/</href>
                  </current-user-principal>
                </prop>
                <status>HTTP/1.1 200 OK</status>
              </propstat>
            </response>
          </multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
            <response>
              <propstat>
                <prop>
                  <C:calendar-home-set>
                    <href>/dav/demo/</href>
                  </C:calendar-home-set>
                </prop>
                <status>HTTP/1.1 200 OK</status>
              </propstat>
            </response>
          </multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
            <response>
              <href>/dav/demo/</href>
              <propstat>
                <prop>
                  <resourcetype>
                    <collection />
                    <C:calendar />
                  </resourcetype>
                  <displayname>主日历</displayname>
                </prop>
                <status>HTTP/1.1 200 OK</status>
              </propstat>
            </response>
            <response>
              <href>/dav/demo/holidays/</href>
              <propstat>
                <prop>
                  <resourcetype>
                    <collection />
                    <C:calendar />
                  </resourcetype>
                  <displayname>节假日</displayname>
                </prop>
                <status>HTTP/1.1 200 OK</status>
              </propstat>
            </response>
          </multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    const calendars = await adapter.discoverCalendars(
      'https://dav.example.com',
      'demo',
      'secret',
    );

    expect(calendars).toEqual([
      { href: '/dav/demo/', displayName: '主日历' },
      { href: '/dav/demo/holidays/', displayName: '节假日' },
    ]);
  });

  it('tries derived calendar paths when /dav/{username}/ returns 401', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());

    mockedRequestUrl
      .mockRejectedValueOnce({ status: 405, message: 'Request failed, status 405' })
      .mockRejectedValueOnce({ status: 405, message: 'Request failed, status 405' })
      .mockRejectedValueOnce({ status: 401, message: 'Request failed, status 401' })
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
            <response>
              <href>/dav/u_ebmz2076/calendar/primary/</href>
              <propstat>
                <prop>
                  <resourcetype>
                    <collection />
                    <C:calendar />
                  </resourcetype>
                  <displayname>Primary</displayname>
                </prop>
                <status>HTTP/1.1 200 OK</status>
              </propstat>
            </response>
          </multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    const calendars = await adapter.discoverCalendars(
      'https://calendar.dingtalk.com',
      'u_ebmz2076',
      'secret',
    );

    expect(calendars).toEqual([
      { href: '/dav/u_ebmz2076/calendar/primary/', displayName: 'Primary' },
    ]);
    expect(mockedRequestUrl.mock.calls[3]?.[0]).toMatchObject({
      url: 'https://calendar.dingtalk.com/dav/u_ebmz2076/calendar/',
      method: 'PROPFIND',
    });
  });

  it('throws a diagnostic error when REPORT response contains no calendar-data payload', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl.mockResolvedValue({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/calendar/primary/</d:href>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    await expect(
      adapter.sync(source, new Date('2026-04-01T00:00:00Z'), new Date('2026-04-30T00:00:00Z')),
    ).rejects.toThrow(/未包含可解析的calendar-data/);
  });

  it('throws a diagnostic error when all returned calendar-data payloads fail to parse', async () => {
    const icsAdapter = new IcsSyncAdapter();
    const adapter = new CalDavSyncAdapter(icsAdapter);
    const source = makeCalDavSource();

    mockedRequestUrl.mockResolvedValue({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:propstat>
              <d:prop>
                <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:bad-1\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
              </d:prop>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      adapter.sync(source, new Date('2026-04-01T00:00:00Z'), new Date('2026-04-30T00:00:00Z')),
    ).rejects.toThrow(/全部解析失败/);
  });

  it('ignores empty or non-ICS calendar-data fragments while parsing REPORT payloads', () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());

    const payloads = adapter.parseEventReportXml(
      `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:propstat>
              <d:prop>
                <c:calendar-data/>
                <c:calendar-data>not valid ics</c:calendar-data>
                <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR</c:calendar-data>
              </d:prop>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
    );

    expect(payloads).toEqual(['BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR']);
  });

  it('extracts event resource hrefs and etags from REPORT responses without inline calendar-data', () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());

    const resources = adapter.parseEventResourceDescriptors(
      `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>/calendar/primary/</d:href>
          </d:response>
          <d:response>
            <d:href>/calendar/primary/event-1.ics</d:href>
            <d:propstat>
              <d:prop><d:getetag>123</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data/></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      '/calendar/primary/',
      'https://caldav.feishu.cn',
    );

    expect(resources).toEqual([{ href: 'https://caldav.feishu.cn/calendar/primary/event-1.ics', etag: '123' }]);
  });

  it('fetches ICS bodies via calendar-multiget when REPORT returns hrefs without inline calendar-data', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>123</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:propstat>
                <d:prop>
                  <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Fetched Event\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
                </d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Fetched Event');
    expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
    const secondCall = mockedRequestUrl.mock.calls[1]?.[0];
    expect(secondCall).toMatchObject({
      method: 'REPORT',
      url: 'https://caldav.feishu.cn/calendar/primary/',
    });
    const secondCallBody = typeof secondCall === 'string'
      ? ''
      : (typeof secondCall?.body === 'string' ? secondCall.body : '');
    expect(secondCallBody).toContain('calendar-multiget');
    expect(secondCallBody).toContain('/calendar/primary/event-1.ics');
  });

  it('keeps valid ICS payloads from calendar-multiget even when the response also contains invalid fragments', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>123</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:propstat>
                <d:prop>
                  <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Fetched Event A\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
                  <c:calendar-data>not valid ics</c:calendar-data>
                </d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Fetched Event A');
    expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      '[UniCalendar] Failed to parse CalDAV event payload:',
      expect.anything(),
    );
  });

  it('reuses cached ICS bodies when href etag is unchanged', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const cache = {
      bySource: {
        'feishu-source': {
          '/calendar/primary/': {
            cachedEvents: [],
            lastSuccessfulSyncAt: 123,
            resourcesByHref: {
              'https://caldav.feishu.cn/calendar/primary/event-1.ics': {
                href: 'https://caldav.feishu.cn/calendar/primary/event-1.ics',
                etag: '123',
                icsText: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Cached Event\r\nEND:VEVENT\r\nEND:VCALENDAR',
                cachedAt: 123,
              },
            },
          },
        },
      },
    };

    mockedRequestUrl.mockResolvedValueOnce({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>/calendar/primary/event-1.ics</d:href>
            <d:propstat>
              <d:prop><d:getetag>123</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data/></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange: vi.fn() },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Cached Event');
    expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('falls back to cached calendar events when href-only fallback yields no bodies and cache already has matching resource', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource({
      caldav: {
        serverUrl: 'https://caldav.feishu.cn',
        username: 'user@example.com',
        password: 'secret',
        selectedCalendars: [{ path: '/calendar/primary/', displayName: 'Primary' }],
      },
    });
    const cache = {
      bySource: {
        'feishu-source': {
          '/calendar/primary/': {
            cachedEvents: [{
              id: 'feishu-source::cached-1',
              sourceId: 'feishu-source',
              uid: 'cached-1',
              title: 'Cached Calendar Event',
              start: '2026-04-08T10:00:00.000Z',
              end: '2026-04-08T11:00:00.000Z',
              allDay: false,
            }],
            lastSuccessfulSyncAt: Date.now() - 1000,
            resourcesByHref: {
              'https://caldav.feishu.cn/calendar/primary/event-1.ics': {
                href: 'https://caldav.feishu.cn/calendar/primary/event-1.ics',
                etag: '123',
                icsText: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:cached-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Cached Calendar Event\r\nEND:VEVENT\r\nEND:VCALENDAR',
                cachedAt: 123,
              },
            },
          },
        },
      },
    };

    mockedRequestUrl.mockResolvedValueOnce({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>/calendar/primary/event-1.ics</d:href>
            <d:propstat>
              <d:prop><d:getetag>123</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data/></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange: vi.fn() },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Cached Calendar Event');
  });

  it('skips href-only calendar when fallback times out and there is no cache', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl.mockResolvedValueOnce({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>/calendar/primary/event-1.ics</d:href>
            <d:propstat>
              <d:prop><d:getetag>123</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data/></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache: { bySource: {} }, onCacheChange: vi.fn() },
    );

    expect(events).toEqual([]);
  });

  it('skips href-only calendar when event fallback is forbidden and there is no cache', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>123</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockRejectedValueOnce({ status: 403, message: 'Forbidden' });

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toEqual([]);
  });

  it('uses stale calendar cache when forbidden GET and late calendar-multiget produce no bodies', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const cache = {
      bySource: {
        'feishu-source': {
          '/calendar/primary/': {
            cachedEvents: [
              {
                id: 'cached-event',
                uid: 'cached-event',
                title: 'Cached Calendar Event',
                start: '2026-04-08T10:00:00.000Z',
                end: '2026-04-08T11:00:00.000Z',
                sourceId: 'feishu-source',
                calendarName: 'Primary',
                color: '#74C0FC',
                allDay: false,
              },
            ],
            lastSuccessfulSyncAt: Date.now() - 1000,
            resourcesByHref: {},
            resourceFingerprint: 'https://caldav.feishu.cn/calendar/primary/event-1.ics\u0000old-etag',
          },
        },
      },
    };

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>changed-etag</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockImplementationOnce((async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          text: `<?xml version="1.0" encoding="UTF-8"?>
            <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
              <d:response>
                <d:href>/calendar/primary/event-1.ics</d:href>
                <d:propstat>
                  <d:prop><d:getetag>changed-etag</d:getetag></d:prop>
                  <d:status>HTTP/1.1 200 OK</d:status>
                </d:propstat>
                <d:propstat>
                  <d:prop><c:calendar-data/></d:prop>
                  <d:status>HTTP/1.1 404 Not Found</d:status>
                </d:propstat>
              </d:response>
            </d:multistatus>`,
          status: 207,
          json: {},
          headers: {},
          arrayBuffer: new ArrayBuffer(0),
        } as Awaited<ReturnType<typeof requestUrl>>;
      }) as unknown as typeof requestUrl)
      .mockRejectedValueOnce({ status: 403, message: 'Request failed, status 403' });

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange: vi.fn() },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Cached Calendar Event');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('usingCachedEvents=1'));
  });

  it('returns parsed events when calendar-data payload is valid ICS', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl.mockResolvedValue({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:propstat>
              <d:prop>
                <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Feishu Event\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
              </d:prop>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.sourceId).toBe('feishu-source');
    expect(events[0]?.title).toBe('Feishu Event');
  });

  it('switches non-Feishu CalDAV to GET fallback when calendar-multiget is slower than its short budget', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource({
      caldav: {
        serverUrl: 'https://dav.example.com',
        username: 'user@example.com',
        password: 'secret',
        selectedCalendars: [{ path: '/calendar/primary/', displayName: 'Primary' }],
      },
    });

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>123</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockImplementationOnce((async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return {
          text: `<?xml version="1.0" encoding="UTF-8"?><d:multistatus xmlns:d="DAV:" />`,
          status: 207,
          json: {},
          headers: {},
          arrayBuffer: new ArrayBuffer(0),
        } as Awaited<ReturnType<typeof requestUrl>>;
      }) as unknown as typeof requestUrl)
      .mockResolvedValueOnce({
        text: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:GET Event\r\nEND:VEVENT\r\nEND:VCALENDAR',
        status: 200,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('GET Event');
    expect(mockedRequestUrl).toHaveBeenCalledTimes(3);
    expect(mockedRequestUrl.mock.calls[2]?.[0]).toMatchObject({
      method: 'GET',
      url: 'https://dav.example.com/calendar/primary/event-1.ics',
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('calendar-multiget fallback timed out'));
  });

  it('waits for Feishu long calendar-multiget directly without probing GET fallback', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>/calendar/primary/event-1.ics</d:href>
              <d:propstat>
                <d:prop><d:getetag>123</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data/></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockImplementationOnce((async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          text: `<?xml version="1.0" encoding="UTF-8"?>
            <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
              <d:response>
                <d:propstat>
                  <d:prop>
                    <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Late Multiget Event\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
                  </d:prop>
                  <d:status>HTTP/1.1 200 OK</d:status>
                </d:propstat>
              </d:response>
            </d:multistatus>`,
          status: 207,
          json: {},
          headers: {},
          arrayBuffer: new ArrayBuffer(0),
        } as Awaited<ReturnType<typeof requestUrl>>;
      }) as unknown as typeof requestUrl);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Late Multiget Event');
    expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('switchingToGet=true'));
  }, 15000);

  it('waits long enough for large Feishu calendar-multiget responses', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const href = '/calendar/primary/event.ics';

    vi.useFakeTimers();
    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>${href}</d:href>
              <d:propstat>
                <d:prop><d:getetag>slow-etag</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data /></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          text: `<?xml version="1.0" encoding="UTF-8"?>
            <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
              <d:response>
                <d:href>${href}</d:href>
                <d:propstat>
                  <d:prop>
                    <d:getetag>slow-etag</d:getetag>
                    <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:slow-event\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Slow Feishu Event\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
                  </d:prop>
                  <d:status>HTTP/1.1 200 OK</d:status>
                </d:propstat>
              </d:response>
            </d:multistatus>`,
          status: 207,
          json: {},
          headers: {},
          arrayBuffer: new ArrayBuffer(0),
        } as Awaited<ReturnType<typeof requestUrl>>), 70000);
      }) as ReturnType<typeof requestUrl>);

    const syncPromise = adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    await vi.advanceTimersByTimeAsync(70000);
    const events = await syncPromise;

    expect(events.map(event => event.title)).toEqual(['Slow Feishu Event']);
    expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('fetches ICS bodies in parallel via GET fallback for non-Feishu CalDAV when calendar-multiget yields no payloads', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource({
      caldav: {
        serverUrl: 'https://dav.example.com',
        username: 'user@example.com',
        password: 'secret',
        selectedCalendars: [{ path: '/calendar/primary/', displayName: 'Primary' }],
      },
    });

    const reportXml = `<?xml version="1.0" encoding="UTF-8"?>
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/calendar/primary/event-1.ics</d:href>
          <d:propstat>
            <d:prop><d:getetag>e1</d:getetag></d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
          <d:propstat>
            <d:prop><c:calendar-data/></d:prop>
            <d:status>HTTP/1.1 404 Not Found</d:status>
          </d:propstat>
        </d:response>
        <d:response>
          <d:href>/calendar/primary/event-2.ics</d:href>
          <d:propstat>
            <d:prop><d:getetag>e2</d:getetag></d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
          <d:propstat>
            <d:prop><c:calendar-data/></d:prop>
            <d:status>HTTP/1.1 404 Not Found</d:status>
          </d:propstat>
        </d:response>
        <d:response>
          <d:href>/calendar/primary/event-3.ics</d:href>
          <d:propstat>
            <d:prop><d:getetag>e3</d:getetag></d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
          <d:propstat>
            <d:prop><c:calendar-data/></d:prop>
            <d:status>HTTP/1.1 404 Not Found</d:status>
          </d:propstat>
        </d:response>
      </d:multistatus>`;

    const multigetResponseXml = `<?xml version="1.0" encoding="UTF-8"?>
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:propstat>
            <d:prop><c:calendar-data></c:calendar-data></d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
      </d:multistatus>`;

    let inFlight = 0;
    let observedMaxInFlight = 0;
    const startedHrefs: string[] = [];

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: reportXml,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: multigetResponseXml,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    mockedRequestUrl.mockImplementation(((options: string | { url: string; method?: string }) => {
      const url = typeof options === 'string' ? options : options.url;
      const method = typeof options === 'string' ? 'GET' : (options.method ?? 'GET');
      if (method === 'GET' && url.endsWith('.ics')) {
        startedHrefs.push(url);
        inFlight++;
        observedMaxInFlight = Math.max(observedMaxInFlight, inFlight);
        return (async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          inFlight--;
          const uid = url.match(/event-(\d)\.ics$/)?.[1] ?? 'x';
          return {
            text: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-${uid}\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Event ${uid}\r\nEND:VEVENT\r\nEND:VCALENDAR`,
            status: 200,
            json: {},
            headers: {},
            arrayBuffer: new ArrayBuffer(0),
          } as Awaited<ReturnType<typeof requestUrl>>;
        })();
      }
      throw new Error(`Unexpected requestUrl after GET fallback: ${method} ${url}`);
    }) as unknown as typeof requestUrl);

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
    );

    expect(events.map(e => e.title).sort()).toEqual(['Event 1', 'Event 2', 'Event 3']);
    expect(startedHrefs).toHaveLength(3);
    expect(observedMaxInFlight).toBeGreaterThan(1);
  });

  it('uses Feishu full-window fingerprint cache and avoids downloading unchanged href-only results', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const cachedEvent = {
      id: 'cached-1',
      sourceId: source.id,
      uid: 'cached-1',
      title: 'Cached Event',
      start: '2026-04-08T10:00:00.000Z',
      end: '2026-04-08T11:00:00.000Z',
      allDay: false,
    };
    const href = '/calendar/primary/event.ics';
    const etag = 'same-etag';
    const cache: CalDavCache = {
      bySource: {
        [source.id]: {
          '/calendar/primary/': {
            cachedEvents: [cachedEvent],
            lastSuccessfulSyncAt: Date.now(),
            resourcesByHref: {},
            resourceFingerprint: `https://caldav.feishu.cn${href}\u0000${etag}`,
          },
        },
      },
    };
    const onCacheChange = vi.fn((nextCache: CalDavCache) => {
      cache.bySource = nextCache.bySource;
    });

    mockedRequestUrl.mockResolvedValueOnce({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>${href}</d:href>
            <d:propstat>
              <d:prop><d:getetag>${etag}</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data /></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange },
    );

    expect(events).toEqual([cachedEvent]);
    expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
    expect(onCacheChange).not.toHaveBeenCalled();
  });

  it('bootstraps Feishu legacy cached events without downloading huge href bodies', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const cachedEvent = {
      id: 'cached-legacy-1',
      sourceId: source.id,
      uid: 'cached-legacy-1',
      title: 'Legacy Cached Event',
      start: '2026-04-08T10:00:00.000Z',
      end: '2026-04-08T11:00:00.000Z',
      allDay: false,
    };
    const href = '/calendar/primary/event.ics';
    const etag = 'bootstrap-etag';
    const cache: CalDavCache = {
      bySource: {
        [source.id]: {
          '/calendar/primary/': {
            cachedEvents: [cachedEvent],
            lastSuccessfulSyncAt: Date.now(),
            resourcesByHref: {},
          },
        },
      },
    };
    const onCacheChange = vi.fn((nextCache: CalDavCache) => {
      cache.bySource = nextCache.bySource;
    });

    mockedRequestUrl.mockResolvedValueOnce({
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:response>
            <d:href>${href}</d:href>
            <d:propstat>
              <d:prop><d:getetag>${etag}</d:getetag></d:prop>
              <d:status>HTTP/1.1 200 OK</d:status>
            </d:propstat>
            <d:propstat>
              <d:prop><c:calendar-data /></d:prop>
              <d:status>HTTP/1.1 404 Not Found</d:status>
            </d:propstat>
          </d:response>
        </d:multistatus>`,
      status: 207,
      json: {},
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
    } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange },
    );

    expect(events).toEqual([cachedEvent]);
    expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
    expect(onCacheChange).toHaveBeenCalledOnce();
    expect(cache.bySource[source.id]?.['/calendar/primary/']?.resourceFingerprint).toBe(`https://caldav.feishu.cn${href}\u0000${etag}`);
  });

  it('stores Feishu full-window fingerprint cache without persisting raw ICS bodies', async () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());
    const source = makeCalDavSource();
    const href = '/calendar/primary/event.ics';
    const etag = 'new-etag';
    const cache: CalDavCache = { bySource: {} };
    const onCacheChange = vi.fn((nextCache: CalDavCache) => {
      cache.bySource = nextCache.bySource;
    });

    mockedRequestUrl
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>${href}</d:href>
              <d:propstat>
                <d:prop><d:getetag>${etag}</d:getetag></d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
              <d:propstat>
                <d:prop><c:calendar-data /></d:prop>
                <d:status>HTTP/1.1 404 Not Found</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>)
      .mockResolvedValueOnce({
        text: `<?xml version="1.0" encoding="UTF-8"?>
          <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
            <d:response>
              <d:href>${href}</d:href>
              <d:propstat>
                <d:prop>
                  <d:getetag>${etag}</d:getetag>
                  <c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:event-1\r\nDTSTART:20260408T100000Z\r\nDTEND:20260408T110000Z\r\nSUMMARY:Fetched Event\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
                </d:prop>
                <d:status>HTTP/1.1 200 OK</d:status>
              </d:propstat>
            </d:response>
          </d:multistatus>`,
        status: 207,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
      } as Awaited<ReturnType<typeof requestUrl>>);

    const events = await adapter.sync(
      source,
      new Date('2026-04-01T00:00:00Z'),
      new Date('2026-04-30T00:00:00Z'),
      { cache, onCacheChange },
    );

    expect(events.map(event => event.title)).toEqual(['Fetched Event']);
    expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
    const calendarCache = cache.bySource[source.id]?.['/calendar/primary/'];
    expect(calendarCache?.resourceFingerprint).toBe(`https://caldav.feishu.cn${href}\u0000${etag}`);
    expect(calendarCache?.resourcesByHref).toEqual({});
  });
});

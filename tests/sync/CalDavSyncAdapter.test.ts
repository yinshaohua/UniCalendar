import { describe, it, expect, vi, afterEach, beforeAll, type MockInstance } from 'vitest';
import { requestUrl } from 'obsidian';
import { CalDavSyncAdapter } from '../../src/sync/CalDavSyncAdapter';
import { IcsSyncAdapter } from '../../src/sync/IcsSyncAdapter';
import type { CalendarSource } from '../../src/models/types';

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
                <c:calendar-data>not valid ics</c:calendar-data>
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

  it('extracts event resource hrefs from REPORT responses without inline calendar-data', () => {
    const adapter = new CalDavSyncAdapter(new IcsSyncAdapter());

    const hrefs = adapter.parseEventResourceHrefs(
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

    expect(hrefs).toEqual(['https://caldav.feishu.cn/calendar/primary/event-1.ics']);
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
    const secondCallBody = typeof secondCall === 'string' ? '' : String(secondCall?.body ?? '');
    expect(secondCallBody).toContain('calendar-multiget');
    expect(secondCallBody).toContain('/calendar/primary/event-1.ics');
  });

  it('surfaces a diagnostic error when event href fallback is discovered but GET is forbidden', async () => {
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

    await expect(
      adapter.sync(
        source,
        new Date('2026-04-01T00:00:00Z'),
        new Date('2026-04-30T00:00:00Z'),
      ),
    ).rejects.toThrow(/拉取ICS详情失败/);
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
});

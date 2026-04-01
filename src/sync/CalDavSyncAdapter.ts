import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource } from '../models/types';
import { IcsSyncAdapter } from './IcsSyncAdapter';

export interface DiscoveredCalendar {
  href: string;
  displayName: string;
}

export class CalDavSyncAdapter {
  private icsAdapter: IcsSyncAdapter;

  constructor(icsAdapter: IcsSyncAdapter) {
    this.icsAdapter = icsAdapter;
  }

  async discoverCalendars(
    serverUrl: string,
    username: string,
    password: string,
  ): Promise<DiscoveredCalendar[]> {
    const authHeader = this.createBasicAuthHeader(username, password);
    const baseUrl = serverUrl.replace(/\/+$/, '');

    // Strategy 1: Standard 3-step discovery
    try {
      return await this.standardDiscovery(baseUrl, username, authHeader);
    } catch (err) {
      console.log('[UniCalendar] Standard CalDAV discovery failed:', err instanceof Error ? err.message : err);
    }

    // Strategy 2: Try common CalDAV paths directly with PROPFIND Depth:1
    const commonPaths = [
      `/dav/${username}/`,
      `/calendars/${username}/`,
      `/caldav/${username}/`,
      `/${username}/`,
      `/dav/`,
      `/calendars/`,
    ];

    for (const path of commonPaths) {
      try {
        const url = baseUrl + path;
        console.log(`[UniCalendar] Trying CalDAV path: ${url}`);
        const calendars = await this.listCalendars(url, authHeader, baseUrl);
        if (calendars.length > 0) {
          console.log(`[UniCalendar] Found ${calendars.length} calendars at ${url}`);
          return calendars;
        }
      } catch {
        // Try next path
      }
    }

    // Strategy 3: Try PROPFIND on server root with Depth:1 to find any calendar collections
    try {
      console.log('[UniCalendar] Trying PROPFIND on server root with Depth:1');
      const calendars = await this.listCalendars(baseUrl + '/', authHeader, baseUrl);
      if (calendars.length > 0) return calendars;
    } catch {
      // Fall through
    }

    throw new Error('日历发现失败: 服务器不支持自动发现。请尝试手动输入日历路径。');
  }

  private async standardDiscovery(
    baseUrl: string,
    username: string,
    authHeader: string,
  ): Promise<DiscoveredCalendar[]> {
    // Step 1: Get principal URL
    let principalHref: string;
    try {
      principalHref = await this.getPrincipalUrl(baseUrl + '/.well-known/caldav/', authHeader);
    } catch {
      // Fallback: try root
      principalHref = await this.getPrincipalUrl(baseUrl + '/', authHeader);
    }
    const principalUrl = new URL(principalHref, baseUrl).href;

    // Step 2: Get calendar-home-set
    const homeSetHref = await this.getCalendarHomeSet(principalUrl, authHeader);
    const homeSetUrl = new URL(homeSetHref, baseUrl).href;

    // Step 3: List calendars
    return await this.listCalendars(homeSetUrl, authHeader, baseUrl);
  }

  async sync(
    source: CalendarSource,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const caldav = source.caldav;
    if (!caldav) {
      throw new Error('日历源缺少CalDAV配置');
    }
    if (!caldav.calendarPath) {
      throw new Error('日历源缺少CalDAV日历路径, 请先发现日历');
    }

    const baseUrl = caldav.serverUrl.replace(/\/+$/, '');
    const calendarUrl = new URL(caldav.calendarPath, baseUrl).href;
    const authHeader = this.createBasicAuthHeader(caldav.username, caldav.password);

    const startUtc = this.dateToCalDavUTC(rangeStart);
    const endUtc = this.dateToCalDavUTC(rangeEnd);

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startUtc}" end="${endUtc}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    let responseText: string;
    try {
      const response = await requestUrl({
        url: calendarUrl,
        method: 'REPORT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/xml; charset="utf-8"',
          'Depth': '1',
        },
        body,
      });
      responseText = response.text;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        throw new Error('CalDAV认证失败: 请检查用户名和密码');
      }
      throw new Error('CalDAV同步失败: ' + (err instanceof Error ? err.message : String(err)));
    }

    const icsTexts = this.parseEventReportXml(responseText);
    const allEvents: CalendarEvent[] = [];
    for (const icsText of icsTexts) {
      try {
        const events = this.icsAdapter.parseIcsText(icsText, source.id, rangeStart, rangeEnd);
        allEvents.push(...events);
      } catch (err) {
        console.warn('[UniCalendar] Failed to parse CalDAV event:', err);
      }
    }
    return allEvents;
  }

  private async getPrincipalUrl(url: string, authHeader: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>`;

    console.log(`[UniCalendar] PROPFIND principal: ${url}`);
    const response = await requestUrl({
      url,
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset="utf-8"',
        'Depth': '0',
      },
      body,
    });
    console.log(`[UniCalendar] PROPFIND principal response (${response.status}):`, response.text.substring(0, 500));

    const doc = new DOMParser().parseFromString(response.text, 'text/xml');
    const href = this.findElementByLocalName(doc, 'current-user-principal')
      ?.querySelector('href')?.textContent
      ?? this.findNestedHref(doc, 'current-user-principal');

    if (!href) {
      throw new Error('无法获取CalDAV主体URL (current-user-principal)');
    }
    return href;
  }

  private async getCalendarHomeSet(principalUrl: string, authHeader: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`;

    const response = await requestUrl({
      url: principalUrl,
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset="utf-8"',
        'Depth': '0',
      },
      body,
    });

    const doc = new DOMParser().parseFromString(response.text, 'text/xml');
    const href = this.findElementByLocalName(doc, 'calendar-home-set')
      ?.querySelector('href')?.textContent
      ?? this.findNestedHref(doc, 'calendar-home-set');

    if (!href) {
      throw new Error('无法获取CalDAV日历主目录 (calendar-home-set)');
    }
    return href;
  }

  private async listCalendars(
    homeSetUrl: string,
    authHeader: string,
    baseUrl: string,
  ): Promise<DiscoveredCalendar[]> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
  </D:prop>
</D:propfind>`;

    console.log(`[UniCalendar] PROPFIND list calendars: ${homeSetUrl}`);
    const response = await requestUrl({
      url: homeSetUrl,
      method: 'PROPFIND',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml; charset="utf-8"',
        'Depth': '1',
      },
      body,
    });
    console.log(`[UniCalendar] PROPFIND list response (${response.status}):`, response.text.substring(0, 500));

    return this.parseCalendarListXml(response.text, baseUrl);
  }

  parseCalendarListXml(xmlText: string, baseUrl: string): DiscoveredCalendar[] {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const calendars: DiscoveredCalendar[] = [];
    const responses = doc.getElementsByTagNameNS('DAV:', 'response');

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i]!;
      const hrefEl = resp.getElementsByTagNameNS('DAV:', 'href')[0];
      const href = hrefEl?.textContent;
      if (!href) continue;

      // Check if resourcetype contains calendar
      const resourcetype = this.findElementByLocalName(resp, 'resourcetype');
      if (!resourcetype) continue;
      const children = resourcetype.children;
      let isCalendar = false;
      for (let j = 0; j < children.length; j++) {
        if (children[j]!.localName === 'calendar') {
          isCalendar = true;
          break;
        }
      }
      if (!isCalendar) continue;

      const displayNameEl = this.findElementByLocalName(resp, 'displayname');
      const displayName = displayNameEl?.textContent || href;

      calendars.push({
        href: new URL(href, baseUrl).pathname,
        displayName,
      });
    }
    return calendars;
  }

  parseEventReportXml(xmlText: string): string[] {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const icsTexts: string[] = [];
    const allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]!;
      if (el.localName === 'calendar-data' && el.textContent) {
        icsTexts.push(el.textContent.trim());
      }
    }
    return icsTexts;
  }

  dateToCalDavUTC(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  createBasicAuthHeader(username: string, password: string): string {
    return 'Basic ' + btoa(username + ':' + password);
  }

  private findElementByLocalName(parent: Document | Element, localName: string): Element | null {
    const allElements = parent.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i]!.localName === localName) {
        return allElements[i]!;
      }
    }
    return null;
  }

  private findNestedHref(doc: Document | Element, parentLocalName: string): string | null {
    const parent = this.findElementByLocalName(doc, parentLocalName);
    if (!parent) return null;
    const hrefEl = this.findElementByLocalName(parent, 'href');
    return hrefEl?.textContent ?? null;
  }
}

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
    const attempts: string[] = [];

    // Strategy 1: Standard 3-step discovery
    try {
      return await this.standardDiscovery(baseUrl, username, authHeader);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push(`standardDiscovery => ${message}`);
      console.debug('[UniCalendar] Standard CalDAV discovery failed:', message);
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
      const url = baseUrl + path;
      try {
        console.debug(`[UniCalendar] Trying CalDAV path: ${url}`);
        const calendars = await this.listCalendars(url, authHeader, baseUrl);
        if (calendars.length > 0) {
          console.debug(`[UniCalendar] Found ${calendars.length} calendars at ${url}`);
          return calendars;
        }
        attempts.push(`${url} => 0 calendars`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push(`${url} => ${message}`);

        const status = this.extractStatusCode(err);
        if (status === 401 && (path === `/dav/${username}/` || path === `/dav/`)) {
          const derivedCalendars = await this.tryDerivedCalendarPaths(baseUrl, path, username, authHeader, attempts);
          if (derivedCalendars.length > 0) {
            return derivedCalendars;
          }
        }
      }
    }

    // Strategy 3: Try PROPFIND on server root with Depth:1 to find any calendar collections
    try {
      const rootUrl = baseUrl + '/';
      console.debug('[UniCalendar] Trying PROPFIND on server root with Depth:1');
      const calendars = await this.listCalendars(rootUrl, authHeader, baseUrl);
      if (calendars.length > 0) return calendars;
      attempts.push(`${rootUrl} => 0 calendars`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push(`${baseUrl}/ => ${message}`);
    }

    const detail = attempts.length > 0 ? ` 诊断: ${attempts.join(' | ')}` : '';
    throw new Error(`日历发现失败: 服务器不支持自动发现。请尝试手动输入日历路径。${detail}`);
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

  private async tryDerivedCalendarPaths(
    baseUrl: string,
    basePath: string,
    username: string,
    authHeader: string,
    attempts: string[],
  ): Promise<DiscoveredCalendar[]> {
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const candidatePaths = [
      `${normalizedBasePath}calendar/`,
      `${normalizedBasePath}calendars/`,
      `${normalizedBasePath}${username}/calendar/`,
      `${normalizedBasePath}${username}/calendars/`,
      `${normalizedBasePath}users/${username}/calendar/`,
      `${normalizedBasePath}users/${username}/calendars/`,
      `${normalizedBasePath}personal/`,
      `${normalizedBasePath}default/`,
    ];

    for (const path of candidatePaths) {
      const url = baseUrl + path;
      try {
        console.debug(`[UniCalendar] Trying derived CalDAV path: ${url}`);
        const calendars = await this.listCalendars(url, authHeader, baseUrl);
        if (calendars.length > 0) {
          console.debug(`[UniCalendar] Found ${calendars.length} calendars at ${url}`);
          return calendars;
        }
        attempts.push(`${url} => 0 calendars`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        attempts.push(`${url} => ${message}`);
      }
    }

    return [];
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

    // Prefer selectedCalendars array, fallback to legacy calendarPath
    const calendarPaths: string[] = [];
    if (caldav.selectedCalendars && caldav.selectedCalendars.length > 0) {
      for (const cal of caldav.selectedCalendars) {
        calendarPaths.push(cal.path);
      }
    } else if (caldav.calendarPath) {
      calendarPaths.push(caldav.calendarPath);
    } else {
      throw new Error('日历源缺少CalDAV日历路径, 请先发现日历');
    }

    const baseUrl = caldav.serverUrl.replace(/\/+$/, '');
    const authHeader = this.createBasicAuthHeader(caldav.username, caldav.password);

    const allEvents: CalendarEvent[] = [];
    for (const calPath of calendarPaths) {
      const events = await this.fetchCalendarEvents(calPath, baseUrl, authHeader, source.id, rangeStart, rangeEnd);
      allEvents.push(...events);
    }
    return allEvents;
  }

  private async fetchCalendarEvents(
    calendarPath: string,
    baseUrl: string,
    authHeader: string,
    sourceId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const calendarUrl = new URL(calendarPath, baseUrl).href;
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

    let icsTexts = this.parseEventReportXml(responseText);
    console.debug(`[UniCalendar] CalDAV REPORT returned ${icsTexts.length} calendar-data payload(s) from ${calendarPath}`);

    if (icsTexts.length === 0) {
      const eventHrefs = this.parseEventResourceHrefs(responseText, calendarPath, baseUrl);
      if (eventHrefs.length > 0) {
        console.debug(`[UniCalendar] CalDAV REPORT returned ${eventHrefs.length} event href(s) without calendar-data from ${calendarPath}; fetching event bodies via calendar-multiget`);
        const fetchedResources = await this.fetchEventResources(eventHrefs, calendarUrl, authHeader);
        icsTexts = fetchedResources.bodies;

        if (icsTexts.length === 0 && fetchedResources.failures.length > 0) {
          const firstFailure = fetchedResources.failures[0]!;
          throw this.createCalDavDiagnosticError(
            calendarPath,
            `CalDAV报告返回了${eventHrefs.length}个事件资源链接，但拉取ICS详情失败。首个失败: ${firstFailure.url} (${firstFailure.status ?? 'unknown'})`,
            responseText,
          );
        }
      }
    }

    if (icsTexts.length === 0) {
      throw this.createCalDavDiagnosticError(
        calendarPath,
        'CalDAV返回成功但未包含可解析的calendar-data，可能与该服务的响应格式不兼容。',
        responseText,
      );
    }

    const events: CalendarEvent[] = [];
    let parseFailures = 0;
    let firstParseError: unknown;

    for (const icsText of icsTexts) {
      try {
        const parsed = this.icsAdapter.parseIcsText(icsText, sourceId, rangeStart, rangeEnd);
        events.push(...parsed);
      } catch (err) {
        parseFailures++;
        firstParseError ??= err;
        console.warn('[UniCalendar] Failed to parse CalDAV event payload:', err);
      }
    }

    if (events.length === 0 && parseFailures > 0) {
      const detail = firstParseError instanceof Error ? firstParseError.message : String(firstParseError);
      throw this.createCalDavDiagnosticError(
        calendarPath,
        `CalDAV返回了${icsTexts.length}个calendar-data片段，但全部解析失败: ${detail}`,
        responseText,
      );
    }

    return events;
  }

  private async getPrincipalUrl(url: string, authHeader: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>`;

    console.debug(`[UniCalendar] PROPFIND principal: ${url}`);
    let responseText = '';
    try {
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
      responseText = response.text;
      console.debug(`[UniCalendar] PROPFIND principal response (${response.status}):`, response.text.substring(0, 500));
    } catch (err) {
      throw this.createDiscoveryError(`PROPFIND principal 失败: ${url}`, err);
    }

    const doc = new DOMParser().parseFromString(responseText, 'text/xml');
    const href = this.findElementByLocalName(doc, 'current-user-principal')
      ?.querySelector('href')?.textContent
      ?? this.findNestedHref(doc, 'current-user-principal');

    if (!href) {
      throw new Error(`无法获取CalDAV主体URL (current-user-principal); 响应预览: ${this.previewText(responseText)}`);
    }
    return href;
  }

  private async getCalendarHomeSet(principalUrl: string, authHeader: string): Promise<string> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`;

    let responseText = '';
    try {
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
      responseText = response.text;
    } catch (err) {
      throw this.createDiscoveryError(`PROPFIND calendar-home-set 失败: ${principalUrl}`, err);
    }

    const doc = new DOMParser().parseFromString(responseText, 'text/xml');
    const href = this.findElementByLocalName(doc, 'calendar-home-set')
      ?.querySelector('href')?.textContent
      ?? this.findNestedHref(doc, 'calendar-home-set');

    if (!href) {
      throw new Error(`无法获取CalDAV日历主目录 (calendar-home-set); 响应预览: ${this.previewText(responseText)}`);
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

    console.debug(`[UniCalendar] PROPFIND list calendars: ${homeSetUrl}`);
    let responseText = '';
    let status: number | undefined;
    try {
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
      status = response.status;
      responseText = response.text;
      console.debug(`[UniCalendar] PROPFIND list response (${response.status}):`, response.text.substring(0, 500));
    } catch (err) {
      throw this.createDiscoveryError(`PROPFIND list calendars 失败: ${homeSetUrl}`, err);
    }

    const calendars = this.parseCalendarListXml(responseText, baseUrl);
    if (calendars.length === 0) {
      throw new Error(`PROPFIND list calendars 未发现任何 calendar 集合: ${homeSetUrl} (status: ${status ?? 'unknown'}); 响应预览: ${this.previewText(responseText)}`);
    }

    return calendars;
  }

  parseCalendarListXml(xmlText: string, baseUrl: string): DiscoveredCalendar[] {
    const calendars: DiscoveredCalendar[] = [];
    const seen = new Set<string>();
    const responseBlocks = xmlText.matchAll(/<([\w:-]*response)\b[^>]*>([\s\S]*?)<\/\1>/gi);

    for (const match of responseBlocks) {
      const responseXml = match[2] ?? '';
      const href = this.decodeXmlEntities(
        responseXml.match(/<([\w:-]*href)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
      ).trim();
      if (!href) {
        continue;
      }

      const resourcetypeXml = responseXml.match(/<([\w:-]*resourcetype)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '';
      const isCalendar = /<(?:[\w-]+:)?calendar\b[^>]*\/?>(?:<\/(?:[\w-]+:)?calendar>)?/i.test(resourcetypeXml);
      if (!isCalendar) {
        continue;
      }

      const displayName = this.decodeXmlEntities(
        responseXml.match(/<([\w:-]*displayname)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
      ).trim() || href;

      const normalizedHref = new URL(href, baseUrl).pathname;
      if (seen.has(normalizedHref)) {
        continue;
      }
      seen.add(normalizedHref);

      calendars.push({
        href: normalizedHref,
        displayName,
      });
    }

    return calendars;
  }

  parseEventReportXml(xmlText: string): string[] {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const icsTexts = new Set<string>();
    const allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i]!;
      if (el.localName === 'calendar-data' && el.textContent) {
        const trimmed = el.textContent.trim();
        if (trimmed) {
          icsTexts.add(trimmed);
        }
      }
    }

    for (const match of xmlText.matchAll(/<([\w:-]*calendar-data)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const raw = this.decodeXmlEntities(match[2] ?? '').trim();
      if (raw) {
        icsTexts.add(raw);
      }
    }

    return [...icsTexts];
  }

  parseEventResourceHrefs(xmlText: string, calendarPath: string, baseUrl: string): string[] {
    const hrefs = new Set<string>();
    const responseBlocks = xmlText.matchAll(/<([\w:-]*response)\b[^>]*>([\s\S]*?)<\/\1>/gi);
    const calendarPathname = new URL(calendarPath, baseUrl).pathname;

    for (const match of responseBlocks) {
      const responseXml = match[2] ?? '';
      const hrefMatch = responseXml.match(/<([\w:-]*href)\b[^>]*>([\s\S]*?)<\/\1>/i);
      const href = this.decodeXmlEntities(hrefMatch?.[2] ?? '').trim();
      if (!href || href === calendarPath || href === calendarPathname) {
        continue;
      }

      const propstatBlocks = responseXml.matchAll(/<([\w:-]*propstat)\b[^>]*>([\s\S]*?)<\/\1>/gi);
      let hasMissingCalendarData = false;
      for (const propstatMatch of propstatBlocks) {
        const propstatXml = propstatMatch[2] ?? '';
        const hasCalendarDataProp = /<([\w:-]*calendar-data)\b[^>]*\/?>(?:[\s\S]*?<\/\1>)?/i.test(propstatXml);
        const status = propstatXml.match(/<([\w:-]*status)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '';
        if (hasCalendarDataProp && /404/i.test(status)) {
          hasMissingCalendarData = true;
          break;
        }
      }

      if (hasMissingCalendarData || href.endsWith('.ics')) {
        hrefs.add(new URL(href, baseUrl).href);
      }
    }

    return [...hrefs];
  }

  private async fetchEventResources(
    eventUrls: string[],
    calendarUrl: string,
    authHeader: string,
  ): Promise<{ bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> }> {
    const multigetAttempt = await this.fetchEventResourcesViaMultiget(eventUrls, calendarUrl, authHeader);
    if (multigetAttempt.bodies.length > 0) {
      return multigetAttempt;
    }

    const fallbackAttempt = await this.fetchEventResourcesViaGet(eventUrls, authHeader);
    return {
      bodies: fallbackAttempt.bodies,
      failures: [...multigetAttempt.failures, ...fallbackAttempt.failures],
    };
  }

  private async fetchEventResourcesViaMultiget(
    eventUrls: string[],
    calendarUrl: string,
    authHeader: string,
  ): Promise<{ bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> }> {
    if (eventUrls.length === 0) {
      return { bodies: [], failures: [] };
    }

    const hrefsXml = eventUrls
      .map(url => new URL(url).pathname)
      .map(pathname => `<D:href>${this.escapeXml(pathname)}</D:href>`)
      .join('');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-multiget xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  ${hrefsXml}
</C:calendar-multiget>`;

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

      const bodies = this.parseEventReportXml(response.text);
      if (bodies.length > 0) {
        return { bodies, failures: [] };
      }

      return {
        bodies: [],
        failures: [{ url: calendarUrl, status: response.status, message: 'calendar-multiget returned no calendar-data' }],
      };
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[UniCalendar] Failed to fetch CalDAV event resources via calendar-multiget:', calendarUrl, err);
      return {
        bodies: [],
        failures: [{ url: calendarUrl, status, message }],
      };
    }
  }

  private async fetchEventResourcesViaGet(
    eventUrls: string[],
    authHeader: string,
  ): Promise<{ bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> }> {
    const bodies: string[] = [];
    const failures: Array<{ url: string; status?: number; message: string }> = [];

    for (const url of eventUrls) {
      try {
        const response = await requestUrl({
          url,
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });
        const trimmed = response.text.trim();
        if (trimmed) {
          bodies.push(trimmed);
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ url, status, message });
        console.warn('[UniCalendar] Failed to fetch CalDAV event resource via GET:', url, err);
      }
    }

    return { bodies, failures };
  }

  private createCalDavDiagnosticError(
    calendarPath: string,
    message: string,
    responseText: string,
  ): Error {
    const preview = responseText.replace(/\s+/g, ' ').trim();
    const snippet = preview.slice(0, 1200);
    return new Error(`${message} 日历路径: ${calendarPath}. 响应预览: ${preview || '[empty]'} 响应摘要: ${snippet || '[empty]'}`);
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private previewText(text: string): string {
    const preview = text.replace(/\s+/g, ' ').trim();
    return preview.slice(0, 300) || '[empty]';
  }

  private createDiscoveryError(prefix: string, err: unknown): Error {
    const status = (err as { status?: number })?.status;
    const responseText = typeof (err as { text?: unknown })?.text === 'string'
      ? String((err as { text?: string }).text)
      : typeof (err as { response?: unknown })?.response === 'string'
        ? String((err as { response?: string }).response)
        : '';
    const message = err instanceof Error ? err.message : String(err);
    const statusText = status ? ` (status: ${status})` : '';
    const previewText = responseText ? `; 响应预览: ${this.previewText(responseText)}` : '';
    return new Error(`${prefix}${statusText}: ${message}${previewText}`);
  }

  private extractStatusCode(err: unknown): number | undefined {
    const directStatus = (err as { status?: unknown })?.status;
    if (typeof directStatus === 'number') {
      return directStatus;
    }

    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/status[:：]?\s*(\d{3})/i);
    return match ? Number(match[1]) : undefined;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

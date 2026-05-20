import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource, CalDavCache, CalDavCalendarCacheEntry } from '../models/types';
import { IcsSyncAdapter } from './IcsSyncAdapter';

export interface DiscoveredCalendar {
  href: string;
  displayName: string;
}

export interface CalDavSyncOptions {
  fallbackFetchEnabled?: boolean;
  fallbackTimeoutMs?: number;
  cache?: CalDavCache;
  onCacheChange?: (cache: CalDavCache) => void;
}

export class CalDavSyncAdapter {
  private static readonly DEFAULT_FALLBACK_TIMEOUT_MS = 10000;
  private static readonly MULTIGET_FALLBACK_TIMEOUT_MS = 2000;
  private static readonly FORBIDDEN_GET_LATE_MULTIGET_TIMEOUT_MS = 60000;
  private static readonly FALLBACK_GET_CONCURRENCY = 6;
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
    options?: CalDavSyncOptions,
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

    const syncStartedAt = performance.now();
    const baseUrl = caldav.serverUrl.replace(/\/+$/, '');
    const authHeader = this.createBasicAuthHeader(caldav.username, caldav.password);

    const allEvents: CalendarEvent[] = [];
    for (const calPath of calendarPaths) {
      const calendarStartedAt = performance.now();
      const events = await this.fetchCalendarEvents(
        calPath,
        baseUrl,
        authHeader,
        source.id,
        rangeStart,
        rangeEnd,
        options,
      );
      allEvents.push(...events);
      console.debug(
        `[UniCalendar] CalDAV calendar synced: source=${source.name}, path=${calPath}, events=${events.length}, durationMs=${Math.round(performance.now() - calendarStartedAt)}`,
      );
    }

    console.debug(
      `[UniCalendar] CalDAV source synced: source=${source.name}, calendars=${calendarPaths.length}, events=${allEvents.length}, durationMs=${Math.round(performance.now() - syncStartedAt)}`,
    );

    return allEvents;
  }

  private async fetchCalendarEvents(
    calendarPath: string,
    baseUrl: string,
    authHeader: string,
    sourceId: string,
    rangeStart: Date,
    rangeEnd: Date,
    options?: CalDavSyncOptions,
  ): Promise<CalendarEvent[]> {
    const calendarUrl = new URL(calendarPath, baseUrl).href;
    const startUtc = this.dateToCalDavUTC(rangeStart);
    const endUtc = this.dateToCalDavUTC(rangeEnd);
    const calendarCacheEntry = this.getCalendarCacheEntry(options?.cache, sourceId, calendarPath);

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

    const reportStartedAt = performance.now();
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

    console.debug(
      `[UniCalendar] CalDAV REPORT finished: path=${calendarPath}, bytes=${responseText.length}, durationMs=${Math.round(performance.now() - reportStartedAt)}`,
    );

    let icsTexts = this.parseEventReportXml(responseText);
    console.debug(`[UniCalendar] CalDAV REPORT returned ${icsTexts.length} calendar-data payload(s) from ${calendarPath}`);

    if (icsTexts.length === 0) {
      const eventResources = this.parseEventResourceDescriptors(responseText, calendarPath, baseUrl);
      if (eventResources.length > 0) {
        if (options?.fallbackFetchEnabled) {
          console.debug(`[UniCalendar] CalDAV REPORT returned ${eventResources.length} event href(s) without calendar-data from ${calendarPath}; fetching event bodies via calendar-multiget`);
          const fetchStartedAt = performance.now();
          const fallbackTimeoutMs = this.normalizeFallbackTimeoutMs(options?.fallbackTimeoutMs);
          const cachedBodies = this.getCachedBodies(eventResources, calendarCacheEntry);
          const pendingResources = eventResources.filter((resource) => !cachedBodies.has(resource.href));
          let fetchedResources = { bodies: [] as string[], failures: [] as Array<{ url: string; status?: number; message: string }> };
          let usedCachedCalendarResult = false;

          try {
            fetchedResources = await this.fetchEventResources(
              pendingResources,
              calendarUrl,
              authHeader,
              fallbackTimeoutMs,
            );
          } catch (err) {
            if (this.isTimeoutError(err)) {
              if (calendarCacheEntry) {
                const cacheAgeMs = Date.now() - calendarCacheEntry.lastSuccessfulSyncAt;
                console.warn(
                  `[UniCalendar] CalDAV href-only fallback timed out: path=${calendarPath}, hrefs=${pendingResources.length}, timeoutMs=${fallbackTimeoutMs}, usingCachedEvents=${calendarCacheEntry.cachedEvents.length}, cacheAgeMs=${cacheAgeMs}`,
                );
                usedCachedCalendarResult = true;
              } else {
                console.warn(
                  `[UniCalendar] CalDAV href-only fallback timed out without cache: path=${calendarPath}, hrefs=${pendingResources.length}, timeoutMs=${fallbackTimeoutMs}, skippingCalendar=true`,
                );
                return [];
              }
            } else {
              throw err;
            }
          }

          if (usedCachedCalendarResult && calendarCacheEntry) {
            return calendarCacheEntry.cachedEvents;
          }

          const cacheHits = cachedBodies.size;
          icsTexts = [...cachedBodies.values(), ...fetchedResources.bodies];
          console.debug(
            `[UniCalendar] CalDAV fallback fetch finished: path=${calendarPath}, hrefs=${eventResources.length}, payloads=${icsTexts.length}, cacheHits=${cacheHits}, fetched=${fetchedResources.bodies.length}, failures=${fetchedResources.failures.length}, durationMs=${Math.round(performance.now() - fetchStartedAt)}`,
          );

          if (fetchedResources.bodies.length > 0) {
            this.updateCalendarCacheResources(options, sourceId, calendarPath, eventResources, fetchedResources.bodies);
          }

          if (icsTexts.length === 0 && fetchedResources.failures.length > 0) {
            if (calendarCacheEntry) {
              const cacheAgeMs = Date.now() - calendarCacheEntry.lastSuccessfulSyncAt;
              console.warn(
                `[UniCalendar] CalDAV href-only fallback failed: path=${calendarPath}, hrefs=${eventResources.length}, failures=${fetchedResources.failures.length}, usingCachedEvents=${calendarCacheEntry.cachedEvents.length}, cacheAgeMs=${cacheAgeMs}`,
              );
              return calendarCacheEntry.cachedEvents;
            }
            console.warn(
              `[UniCalendar] CalDAV href-only fallback failed without cache: path=${calendarPath}, hrefs=${eventResources.length}, failures=${fetchedResources.failures.length}, skippingCalendar=true`,
            );
            return [];
          }
        } else {
          console.warn(
            `[UniCalendar] CalDAV REPORT returned href-only results and fallback fetch is disabled: path=${calendarPath}, hrefs=${eventResources.length}`,
          );
        }
      }
    }

    if (icsTexts.length === 0) {
      throw this.createCalDavDiagnosticError(
        calendarPath,
        options?.fallbackFetchEnabled
          ? 'CalDAV返回成功但未包含可解析的calendar-data，可能与该服务的响应格式不兼容。'
          : 'CalDAV返回成功，但该服务只返回事件链接且已禁用慢速补抓；为避免长时间卡顿，本次跳过该日历事件详情拉取。',
        responseText,
      );
    }

    const parseStartedAt = performance.now();
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
      }
    }

    console.debug(
      `[UniCalendar] CalDAV payload parse finished: path=${calendarPath}, payloads=${icsTexts.length}, events=${events.length}, parseFailures=${parseFailures}, durationMs=${Math.round(performance.now() - parseStartedAt)}`,
    );

    if (events.length > 0 && parseFailures > 0) {
      const detail = firstParseError instanceof Error ? firstParseError.message : String(firstParseError);
      console.debug(
        `[UniCalendar] Ignored unparsable CalDAV payload(s): path=${calendarPath}, parseFailures=${parseFailures}, firstError=${detail}`,
      );
    }

    if (events.length === 0 && parseFailures > 0) {
      const detail = firstParseError instanceof Error ? firstParseError.message : String(firstParseError);
      throw this.createCalDavDiagnosticError(
        calendarPath,
        `CalDAV返回了${icsTexts.length}个calendar-data片段，但全部解析失败: ${detail}`,
        responseText,
      );
    }

    this.storeCalendarResultCache(options, sourceId, calendarPath, events);
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
        if (this.looksLikeIcsCalendar(trimmed)) {
          icsTexts.add(trimmed);
        }
      }
    }

    for (const match of xmlText.matchAll(/<([\w:-]*calendar-data)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const raw = this.decodeXmlEntities(match[2] ?? '').trim();
      if (this.looksLikeIcsCalendar(raw)) {
        icsTexts.add(raw);
      }
    }

    return [...icsTexts];
  }

  private looksLikeIcsCalendar(text: string): boolean {
    return /^BEGIN:VCALENDAR\b/i.test(text.trim());
  }

  parseEventResourceDescriptors(
    xmlText: string,
    calendarPath: string,
    baseUrl: string,
  ): Array<{ href: string; etag?: string }> {
    const resources = new Map<string, { href: string; etag?: string }>();
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
      let etag: string | undefined;
      for (const propstatMatch of propstatBlocks) {
        const propstatXml = propstatMatch[2] ?? '';
        const hasCalendarDataProp = /<([\w:-]*calendar-data)\b[^>]*\/?>(?:[\s\S]*?<\/\1>)?/i.test(propstatXml);
        const status = propstatXml.match(/<([\w:-]*status)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '';
        if (!etag) {
          etag = this.decodeXmlEntities(
            propstatXml.match(/<([\w:-]*getetag)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
          ).trim() || undefined;
        }
        if (hasCalendarDataProp && /404/i.test(status)) {
          hasMissingCalendarData = true;
        }
      }

      if (hasMissingCalendarData || href.endsWith('.ics')) {
        const absoluteHref = new URL(href, baseUrl).href;
        resources.set(absoluteHref, { href: absoluteHref, etag });
      }
    }

    return [...resources.values()];
  }

  private async fetchEventResources(
    resources: Array<{ href: string; etag?: string }>,
    calendarUrl: string,
    authHeader: string,
    totalTimeoutMs = CalDavSyncAdapter.DEFAULT_FALLBACK_TIMEOUT_MS,
  ): Promise<{ bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> }> {
    const eventUrls = resources.map(resource => resource.href);
    if (eventUrls.length === 0) {
      return { bodies: [], failures: [] };
    }

    const startedAt = performance.now();
    const multigetTimeoutMs = Math.min(
      CalDavSyncAdapter.MULTIGET_FALLBACK_TIMEOUT_MS,
      Math.max(1000, Math.floor(totalTimeoutMs / 2)),
    );
    const multigetPromise = this.fetchEventResourcesViaMultiget(eventUrls, calendarUrl, authHeader);
    let multigetTimedOut = false;
    let multigetAttempt: { bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> };
    try {
      multigetAttempt = await this.withTimeout(
        multigetPromise,
        multigetTimeoutMs,
      );
    } catch (err) {
      if (!this.isTimeoutError(err)) {
        throw err;
      }
      multigetTimedOut = true;
      console.warn(
        `[UniCalendar] CalDAV calendar-multiget fallback timed out: hrefs=${eventUrls.length}, timeoutMs=${multigetTimeoutMs}, switchingToGet=true`,
      );
      multigetAttempt = {
        bodies: [],
        failures: [{ url: calendarUrl, message: `calendar-multiget timed out after ${multigetTimeoutMs}ms` }],
      };
    }

    if (multigetAttempt.bodies.length > 0) {
      return multigetAttempt;
    }

    const remainingTimeoutMs = Math.max(1000, totalTimeoutMs - Math.round(performance.now() - startedAt));
    let fallbackAttempt: { bodies: string[]; failures: Array<{ url: string; status?: number; message: string }> };
    try {
      fallbackAttempt = await this.withTimeout(
        this.fetchEventResourcesViaGet(eventUrls, authHeader),
        remainingTimeoutMs,
      );
    } catch (err) {
      if (!this.isTimeoutError(err)) {
        throw err;
      }
      console.warn(
        `[UniCalendar] CalDAV GET fallback timed out: hrefs=${eventUrls.length}, timeoutMs=${remainingTimeoutMs}`,
      );
      fallbackAttempt = {
        bodies: [],
        failures: [{ url: calendarUrl, message: `GET fallback timed out after ${remainingTimeoutMs}ms` }],
      };
    }

    if (fallbackAttempt.bodies.length === 0 && multigetTimedOut && this.allFailuresHaveStatus(fallbackAttempt.failures, 403)) {
      const retryTimeoutMs = Math.max(
        1000,
        Math.min(
          CalDavSyncAdapter.FORBIDDEN_GET_LATE_MULTIGET_TIMEOUT_MS,
          CalDavSyncAdapter.FORBIDDEN_GET_LATE_MULTIGET_TIMEOUT_MS - Math.round(performance.now() - startedAt),
        ),
      );
      console.warn(
        `[UniCalendar] CalDAV GET fallback returned 403 for all hrefs after calendar-multiget timeout: hrefs=${eventUrls.length}, waitingForMultiget=true, timeoutMs=${retryTimeoutMs}`,
      );
      try {
        const lateMultigetAttempt = await this.withTimeout(multigetPromise, retryTimeoutMs);
        return {
          bodies: lateMultigetAttempt.bodies,
          failures: [...multigetAttempt.failures, ...fallbackAttempt.failures, ...lateMultigetAttempt.failures],
        };
      } catch (err) {
        if (!this.isTimeoutError(err)) {
          throw err;
        }
        console.warn(
          `[UniCalendar] CalDAV late calendar-multiget fallback timed out: hrefs=${eventUrls.length}, timeoutMs=${retryTimeoutMs}`,
        );
        return {
          bodies: [],
          failures: [
            ...multigetAttempt.failures,
            ...fallbackAttempt.failures,
            { url: calendarUrl, message: `late calendar-multiget timed out after ${retryTimeoutMs}ms` },
          ],
        };
      }
    }

    return {
      bodies: fallbackAttempt.bodies,
      failures: [...multigetAttempt.failures, ...fallbackAttempt.failures],
    };
  }

  private allFailuresHaveStatus(
    failures: Array<{ status?: number }>,
    status: number,
  ): boolean {
    return failures.length > 0 && failures.every(failure => failure.status === status);
  }

  private normalizeFallbackTimeoutMs(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return CalDavSyncAdapter.DEFAULT_FALLBACK_TIMEOUT_MS;
    }

    return Math.max(1000, Math.min(60000, Math.round(value)));
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        globalThis.setTimeout(() => reject(new Error(`CALDAV_FALLBACK_TIMEOUT:${timeoutMs}`)), timeoutMs);
      }),
    ]);
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith('CALDAV_FALLBACK_TIMEOUT:');
  }

  private getCalendarCacheEntry(
    cache: CalDavCache | undefined,
    sourceId: string,
    calendarPath: string,
  ): CalDavCalendarCacheEntry | undefined {
    return cache?.bySource[sourceId]?.[calendarPath];
  }

  private getCachedBodies(
    resources: Array<{ href: string; etag?: string }>,
    calendarCacheEntry: CalDavCalendarCacheEntry | undefined,
  ): Map<string, string> {
    const cachedBodies = new Map<string, string>();
    if (!calendarCacheEntry) {
      return cachedBodies;
    }

    for (const resource of resources) {
      const cached = calendarCacheEntry.resourcesByHref[resource.href];
      if (!cached) {
        continue;
      }
      if (resource.etag && cached.etag && resource.etag !== cached.etag) {
        continue;
      }
      cachedBodies.set(resource.href, cached.icsText);
    }

    return cachedBodies;
  }

  private updateCalendarCacheResources(
    options: CalDavSyncOptions | undefined,
    sourceId: string,
    calendarPath: string,
    resources: Array<{ href: string; etag?: string }>,
    fetchedBodies: string[],
  ): void {
    if (fetchedBodies.length === 0 || !options?.cache || !options.onCacheChange) {
      return;
    }

    const nextCache = this.cloneCache(options.cache);
    const entry = this.ensureCalendarCacheEntry(nextCache, sourceId, calendarPath);
    const now = Date.now();
    for (let i = 0; i < fetchedBodies.length; i++) {
      const body = fetchedBodies[i];
      if (!body) {
        continue;
      }
      const resource = resources[i] ?? resources.find(candidate => candidate.etag === undefined && !(candidate.href in entry.resourcesByHref));
      if (!resource) {
        continue;
      }
      entry.resourcesByHref[resource.href] = {
        href: resource.href,
        etag: resource.etag,
        icsText: body,
        cachedAt: now,
      };
    }
    options.onCacheChange(nextCache);
  }

  private storeCalendarResultCache(
    options: CalDavSyncOptions | undefined,
    sourceId: string,
    calendarPath: string,
    events: CalendarEvent[],
  ): void {
    if (!options?.cache || !options.onCacheChange) {
      return;
    }

    const nextCache = this.cloneCache(options.cache);
    const entry = this.ensureCalendarCacheEntry(nextCache, sourceId, calendarPath);
    entry.cachedEvents = events;
    entry.lastSuccessfulSyncAt = Date.now();
    options.onCacheChange(nextCache);
  }

  private cloneCache(cache: CalDavCache): CalDavCache {
    return {
      bySource: Object.fromEntries(
        Object.entries(cache.bySource).map(([sourceId, calendars]) => [
          sourceId,
          Object.fromEntries(
            Object.entries(calendars).map(([calendarPath, entry]) => [
              calendarPath,
              {
                cachedEvents: [...entry.cachedEvents],
                lastSuccessfulSyncAt: entry.lastSuccessfulSyncAt,
                resourcesByHref: { ...entry.resourcesByHref },
              },
            ]),
          ),
        ]),
      ),
    };
  }

  private ensureCalendarCacheEntry(
    cache: CalDavCache,
    sourceId: string,
    calendarPath: string,
  ): CalDavCalendarCacheEntry {
    const sourceCache = cache.bySource[sourceId] ?? (cache.bySource[sourceId] = {});
    return sourceCache[calendarPath] ?? (sourceCache[calendarPath] = {
      cachedEvents: [],
      lastSuccessfulSyncAt: 0,
      resourcesByHref: {},
    });
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

      const bodies = this.parseEventReportXml(response.text)
        .map(body => body.trim())
        .filter(body => /BEGIN:VCALENDAR/i.test(body));
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
    if (eventUrls.length === 0) {
      return { bodies: [], failures: [] };
    }

    const concurrency = Math.max(1, Math.min(eventUrls.length, CalDavSyncAdapter.FALLBACK_GET_CONCURRENCY));
    const startedAt = performance.now();

    type FetchOutcome =
      | { kind: 'body'; body: string }
      | { kind: 'failure'; failure: { url: string; status?: number; message: string } }
      | { kind: 'empty' };
    const outcomes: Array<FetchOutcome | undefined> = Array.from({ length: eventUrls.length });

    const fetchOne = async (index: number): Promise<void> => {
      const url = eventUrls[index]!;
      try {
        const response = await requestUrl({
          url,
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });
        const trimmed = response.text.trim();
        outcomes[index] = trimmed
          ? { kind: 'body', body: trimmed }
          : { kind: 'empty' };
      } catch (err) {
        const status = (err as { status?: number }).status;
        const message = err instanceof Error ? err.message : String(err);
        outcomes[index] = { kind: 'failure', failure: { url, status, message } };
        console.warn('[UniCalendar] Failed to fetch CalDAV event resource via GET:', url, err);
      }
    };

    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const next = cursor++;
        if (next >= eventUrls.length) {
          return;
        }
        await fetchOne(next);
      }
    });
    await Promise.all(workers);

    const bodies: string[] = [];
    const failures: Array<{ url: string; status?: number; message: string }> = [];
    for (const outcome of outcomes) {
      if (!outcome) {
        continue;
      }
      if (outcome.kind === 'body') {
        bodies.push(outcome.body);
      } else if (outcome.kind === 'failure') {
        failures.push(outcome.failure);
      }
    }

    console.debug(
      `[UniCalendar] CalDAV fallback GET concurrency batch finished: hrefs=${eventUrls.length}, concurrency=${concurrency}, bodies=${bodies.length}, failures=${failures.length}, durationMs=${Math.round(performance.now() - startedAt)}`,
    );

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

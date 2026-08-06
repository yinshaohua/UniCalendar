import { CalendarEvent, CalendarSource, EventCache, DEFAULT_CACHE, SOURCE_COLORS, EventTitleFilterRule } from '../models/types';
import { deduplicateEvents } from './EventDeduplicator';
import { filterEventsByTitleRules } from './EventTitleFilter';

function computeCacheWindow(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 3);
  const end = new Date(now);
  end.setMonth(end.getMonth() + 3);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export class EventStore {
  private events: CalendarEvent[] = [];
  private lastSyncTime: number | null = null;
  private cacheWindowStart: string;
  private cacheWindowEnd: string;
  private sourceOrder: string[] = [];
  private titleFilters: EventTitleFilterRule[] = [];

  constructor() {
    const window = computeCacheWindow();
    this.cacheWindowStart = window.start;
    this.cacheWindowEnd = window.end;
  }

  load(cache: EventCache): void {
    this.events = [...cache.events];
    this.lastSyncTime = cache.lastSyncTime;
    this.cacheWindowStart = cache.cacheWindowStart;
    this.cacheWindowEnd = cache.cacheWindowEnd;
  }

  setSourceOrder(order: string[]): void {
    this.sourceOrder = order;
  }

  setTitleFilters(filters: EventTitleFilterRule[]): void {
    this.titleFilters = [...filters];
  }

  save(): EventCache {
    return {
      events: [...this.events],
      lastSyncTime: this.lastSyncTime,
      cacheWindowStart: this.cacheWindowStart,
      cacheWindowEnd: this.cacheWindowEnd,
    };
  }

  getEvents(): CalendarEvent[] {
    return filterEventsByTitleRules(
      deduplicateEvents([...this.events], this.sourceOrder),
      this.titleFilters,
    );
  }

  /**
   * 把事件的 ISO 时间(UTC, 如 "2026-08-02T23:00:00.000Z")转成本地日期字符串
   * (如 "2026-08-03")。直接 slice(0,10) 会取到 UTC 日期, 导致跨时区日程错位一天。
   * allDay 事件本身就是日期字符串, 直接 slice 即可。
   */
  private eventDateLocal(iso: string, allDay?: boolean): string {
    if (allDay) {
      return iso.slice(0, 10);
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return iso.slice(0, 10);
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getEventsForDate(dateStr: string): CalendarEvent[] {
    const filtered = this.events.filter(event => {
      const eventStart = this.eventDateLocal(event.start, event.allDay);
      const eventEnd = this.eventDateLocal(event.end, event.allDay);
      return eventStart <= dateStr && eventEnd >= dateStr;
    });
    return filterEventsByTitleRules(
      deduplicateEvents(filtered, this.sourceOrder),
      this.titleFilters,
    );
  }

  getEventsForDateRange(startDate: string, endDate: string): CalendarEvent[] {
    const filtered = this.events.filter(event => {
      const eventStart = this.eventDateLocal(event.start, event.allDay);
      const eventEnd = this.eventDateLocal(event.end, event.allDay);
      // Event overlaps range if it starts before range ends AND ends after range starts
      return eventStart <= endDate && eventEnd >= startDate;
    });
    return filterEventsByTitleRules(
      deduplicateEvents(filtered, this.sourceOrder),
      this.titleFilters,
    );
  }

  static getSourceColor(sourceId: string, sources: CalendarSource[]): string {
    const source = sources.find(s => s.id === sourceId);
    return source?.color ?? SOURCE_COLORS[0]!;
  }

  replaceEvents(sourceId: string, newEvents: CalendarEvent[]): void {
    this.events = this.events.filter(e => e.sourceId !== sourceId);
    this.events.push(...newEvents);
    const window = computeCacheWindow();
    this.cacheWindowStart = window.start;
    this.cacheWindowEnd = window.end;
  }

  removeOrphanedEvents(validSourceIds: Set<string>): void {
    this.events = this.events.filter(e => validSourceIds.has(e.sourceId));
  }

  clear(): void {
    this.events = [];
    this.lastSyncTime = DEFAULT_CACHE.lastSyncTime;
    this.cacheWindowStart = DEFAULT_CACHE.cacheWindowStart;
    this.cacheWindowEnd = DEFAULT_CACHE.cacheWindowEnd;
  }
}

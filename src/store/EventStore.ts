import { CalendarEvent, CalendarSource, EventCache, DEFAULT_CACHE, SOURCE_COLORS } from '../models/types';

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

  save(): EventCache {
    return {
      events: [...this.events],
      lastSyncTime: this.lastSyncTime,
      cacheWindowStart: this.cacheWindowStart,
      cacheWindowEnd: this.cacheWindowEnd,
    };
  }

  getEvents(): CalendarEvent[] {
    return [...this.events];
  }

  getEventsForDate(dateStr: string): CalendarEvent[] {
    return this.events.filter(event => {
      const eventStart = event.start.slice(0, 10);
      const eventEnd = event.end.slice(0, 10);
      return eventStart <= dateStr && eventEnd >= dateStr;
    });
  }

  getEventsForDateRange(startDate: string, endDate: string): CalendarEvent[] {
    return this.events.filter(event => {
      const eventStart = event.start.slice(0, 10);
      const eventEnd = event.end.slice(0, 10);
      // Event overlaps range if it starts before range ends AND ends after range starts
      return eventStart <= endDate && eventEnd >= startDate;
    });
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

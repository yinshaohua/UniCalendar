import { describe, it, expect } from 'vitest';
import { EventStore } from '../../src/store/EventStore';
import { CalendarEvent, EventCache } from '../../src/models/types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'src1::evt1',
    sourceId: 'src1',
    title: 'Test Event',
    start: '2026-03-15T09:00:00Z',
    end: '2026-03-15T10:00:00Z',
    allDay: false,
    ...overrides,
  };
}

describe('EventStore', () => {
  it('loads and saves event cache', () => {
    const store = new EventStore();
    const cache: EventCache = {
      events: [makeEvent()],
      lastSyncTime: 1000,
      cacheWindowStart: '2026-01-01',
      cacheWindowEnd: '2026-06-01',
    };

    store.load(cache);
    const saved = store.save();

    expect(saved.events).toHaveLength(1);
    expect(saved.events[0]!.id).toBe('src1::evt1');
    expect(saved.lastSyncTime).toBe(1000);
    expect(saved.cacheWindowStart).toBe('2026-01-01');
    expect(saved.cacheWindowEnd).toBe('2026-06-01');
  });

  it('replaceEvents replaces only matching sourceId', () => {
    const store = new EventStore();
    const evA = makeEvent({ id: 'srcA::1', sourceId: 'srcA', title: 'A' });
    const evB = makeEvent({ id: 'srcB::1', sourceId: 'srcB', title: 'B' });

    store.load({
      events: [evA, evB],
      lastSyncTime: null,
      cacheWindowStart: '',
      cacheWindowEnd: '',
    });

    const newA = makeEvent({ id: 'srcA::2', sourceId: 'srcA', title: 'A2' });
    store.replaceEvents('srcA', [newA]);

    const events = store.getEvents();
    expect(events).toHaveLength(2);
    expect(events.find(e => e.sourceId === 'srcB')!.title).toBe('B');
    expect(events.find(e => e.sourceId === 'srcA')!.title).toBe('A2');
  });

  it('getEventsForDate filters correctly', () => {
    const store = new EventStore();
    store.load({
      events: [
        makeEvent({ id: 'e1', start: '2026-03-10T09:00:00Z', end: '2026-03-10T17:00:00Z' }),
        makeEvent({ id: 'e2', start: '2026-03-15T09:00:00Z', end: '2026-03-15T17:00:00Z' }),
        makeEvent({ id: 'e3', start: '2026-03-14T09:00:00Z', end: '2026-03-16T17:00:00Z' }),
      ],
      lastSyncTime: null,
      cacheWindowStart: '',
      cacheWindowEnd: '',
    });

    const result = store.getEventsForDate('2026-03-15');
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id).sort()).toEqual(['e2', 'e3']);
  });

  it('clear resets to empty state', () => {
    const store = new EventStore();
    store.load({
      events: [makeEvent()],
      lastSyncTime: 1000,
      cacheWindowStart: '2026-01-01',
      cacheWindowEnd: '2026-06-01',
    });

    store.clear();

    expect(store.getEvents()).toHaveLength(0);
    const saved = store.save();
    expect(saved.lastSyncTime).toBeNull();
    expect(saved.cacheWindowStart).toBe('');
    expect(saved.cacheWindowEnd).toBe('');
  });
});

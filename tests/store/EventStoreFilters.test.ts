import { describe, expect, it } from 'vitest';
import { EventStore } from '../../src/store/EventStore';
import { CalendarEvent } from '../../src/models/types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'src1::evt1',
    sourceId: 'src1',
    title: 'Test Event',
    start: '2026-05-20T12:00:00.000Z',
    end: '2026-05-20T13:00:00.000Z',
    allDay: false,
    ...overrides,
  };
}

describe('EventStore title filters', () => {
  it('applies title filters after deduplication for getEvents', () => {
    const store = new EventStore();
    store.setSourceOrder(['src1']);
    store.setTitleFilters([
      { id: 'rule-1', pattern: 'WaytoAGI', mode: 'contains', enabled: true },
    ]);
    store.replaceEvents('src1', [
      makeEvent({ id: 'a', title: 'WaytoAGI晚8点共学' }),
      makeEvent({ id: 'b', title: '团队复盘' }),
    ]);

    expect(store.getEvents().map(event => event.title)).toEqual(['团队复盘']);
  });

  it('applies title filters to date range queries', () => {
    const store = new EventStore();
    store.setSourceOrder(['src1']);
    store.setTitleFilters([
      { id: 'rule-1', pattern: '项目周会', mode: 'equals', enabled: true },
    ]);
    store.replaceEvents('src1', [
      makeEvent({ id: 'a', title: '项目周会', start: '2026-05-20T12:00:00.000Z', end: '2026-05-20T13:00:00.000Z' }),
      makeEvent({ id: 'b', title: '项目复盘', start: '2026-05-20T14:00:00.000Z', end: '2026-05-20T15:00:00.000Z' }),
    ]);

    expect(store.getEventsForDate('2026-05-20').map(event => event.title)).toEqual(['项目复盘']);
    expect(store.getEventsForDateRange('2026-05-20', '2026-05-20').map(event => event.title)).toEqual(['项目复盘']);
  });
});

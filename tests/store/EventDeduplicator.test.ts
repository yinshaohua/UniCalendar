import { describe, it, expect } from 'vitest';
import { deduplicateEvents } from '../../src/store/EventDeduplicator';
import { CalendarEvent } from '../../src/models/types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'src1::evt1',
    sourceId: 'src1',
    title: 'Test Event',
    start: '2026-04-01T10:00:00.000Z',
    end: '2026-04-01T11:00:00.000Z',
    allDay: false,
    ...overrides,
  };
}

describe('deduplicateEvents', () => {
  it('deduplicates events with same uid from different sources (first-added source wins)', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::uid1', sourceId: 's1', uid: 'shared-uid', title: 'Meeting' }),
      makeEvent({ id: 's2::uid1', sourceId: 's2', uid: 'shared-uid', title: 'Meeting' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('s1');
  });

  it('deduplicates events with same start + normalized title from different sources', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', title: 'Team Standup', start: '2026-04-01T09:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', title: 'team standup', start: '2026-04-01T09:00:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('s1');
  });

  it('never deduplicates events from the same source even if uid matches', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::uid1::occ1', sourceId: 's1', uid: 'same-uid', title: 'Recurring A' }),
      makeEvent({ id: 's1::uid1::occ2', sourceId: 's1', uid: 'same-uid', title: 'Recurring B' }),
    ];
    const result = deduplicateEvents(events, ['s1']);
    expect(result).toHaveLength(2);
  });

  it('uses time+title fallback for events with no uid', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', title: 'Lunch', start: '2026-04-01T12:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', title: 'lunch', start: '2026-04-01T12:00:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('s1');
  });

  it('keeps events with different uid AND different time+title', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', uid: 'uid-1', title: 'Meeting A', start: '2026-04-01T09:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', uid: 'uid-2', title: 'Meeting B', start: '2026-04-01T10:00:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(2);
  });

  it('respects sourceOrder -- source at index 0 wins over index 1', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's2::uid1', sourceId: 's2', uid: 'shared', title: 'Event' }),
      makeEvent({ id: 's1::uid1', sourceId: 's1', uid: 'shared', title: 'Event' }),
    ];
    // s1 is first in sourceOrder so it should win even though s2 appears first in array
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceId).toBe('s1');
  });

  it('returns empty array for empty input', () => {
    const result = deduplicateEvents([], ['s1']);
    expect(result).toHaveLength(0);
  });

  it('returns single event unchanged', () => {
    const event = makeEvent({ id: 's1::a', sourceId: 's1', uid: 'uid-1' });
    const result = deduplicateEvents([event], ['s1']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(event);
  });

  it('normalizes title whitespace and case for matching', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', title: '  Meeting  ', start: '2026-04-01T09:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', title: 'meeting', start: '2026-04-01T09:00:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
  });

  it('requires exact start time match for time+title dedup (ISO 8601)', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', title: 'Meeting', start: '2026-04-01T09:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', title: 'Meeting', start: '2026-04-01T09:30:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(2);
  });

  it('deduplicates by uid even when titles differ', () => {
    const events: CalendarEvent[] = [
      makeEvent({ id: 's1::a', sourceId: 's1', uid: 'shared-uid', title: 'Original Title', start: '2026-04-01T09:00:00Z' }),
      makeEvent({ id: 's2::b', sourceId: 's2', uid: 'shared-uid', title: 'Updated Title', start: '2026-04-01T09:00:00Z' }),
    ];
    const result = deduplicateEvents(events, ['s1', 's2']);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Original Title');
  });
});

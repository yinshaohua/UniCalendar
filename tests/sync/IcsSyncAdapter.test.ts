import { describe, it, expect } from 'vitest';
import { IcsSyncAdapter } from '../../src/sync/IcsSyncAdapter';

const SOURCE_ID = 'test-source';
const RANGE_START = new Date('2026-03-01T00:00:00Z');
const RANGE_END = new Date('2026-05-01T00:00:00Z');

const SIMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  'UID:test-1',
  'DTSTART:20260401T100000Z',
  'DTEND:20260401T113000Z',
  'SUMMARY:Team standup',
  'LOCATION:Room 3A',
  'DESCRIPTION:Daily sync',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const ALLDAY_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  'UID:allday-1',
  'DTSTART;VALUE=DATE:20260401',
  'DTEND;VALUE=DATE:20260402',
  'SUMMARY:Holiday',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const RECURRING_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  'UID:recurring-1',
  'DTSTART:20260401T090000Z',
  'DTEND:20260401T100000Z',
  'SUMMARY:Weekly meeting',
  'RRULE:FREQ=WEEKLY;COUNT=4',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const TIMEZONE_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:tz-1',
  'DTSTART;TZID=America/New_York:20260401T100000',
  'DTEND;TZID=America/New_York:20260401T113000',
  'SUMMARY:NY Meeting',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('IcsSyncAdapter', () => {
  const adapter = new IcsSyncAdapter();

  it('parses a simple single-event ICS into CalendarEvent', () => {
    const events = adapter.parseIcsText(SIMPLE_ICS, SOURCE_ID, RANGE_START, RANGE_END);

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.id).toBe('test-source::test-1');
    expect(event.sourceId).toBe(SOURCE_ID);
    expect(event.title).toBe('Team standup');
    expect(event.allDay).toBe(false);
    expect(event.location).toBe('Room 3A');
    expect(event.description).toBe('Daily sync');
    // ISO 8601 datetime strings
    expect(event.start).toContain('2026-04-01');
    expect(event.end).toContain('2026-04-01');
  });

  it('parses an all-day event with VALUE=DATE', () => {
    const events = adapter.parseIcsText(ALLDAY_ICS, SOURCE_ID, RANGE_START, RANGE_END);

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.id).toBe('test-source::allday-1');
    expect(event.allDay).toBe(true);
    expect(event.title).toBe('Holiday');
    // All-day events should have date-only start/end
    expect(event.start).toContain('2026-04-01');
    expect(event.end).toContain('2026-04-02');
  });

  it('expands RRULE within date range and returns correct number of instances', () => {
    // Range covers 2026-03-01 to 2026-05-01 (about 4.3 weeks from April 1)
    // RRULE: weekly, 4 occurrences starting April 1: Apr 1, Apr 8, Apr 15, Apr 22
    // All 4 should fit within the range
    const events = adapter.parseIcsText(RECURRING_ICS, SOURCE_ID, RANGE_START, RANGE_END);

    expect(events.length).toBe(4);
    // Each instance should have a unique recurrenceId
    const recurrenceIds = events.map(e => e.recurrenceId);
    const uniqueIds = new Set(recurrenceIds);
    expect(uniqueIds.size).toBe(4);
    // All should have the same base source info
    events.forEach(e => {
      expect(e.sourceId).toBe(SOURCE_ID);
      expect(e.title).toBe('Weekly meeting');
    });
  });

  it('converts VTIMEZONE event times via toJSDate', () => {
    const events = adapter.parseIcsText(TIMEZONE_ICS, SOURCE_ID, RANGE_START, RANGE_END);

    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event.title).toBe('NY Meeting');
    // The event should have an ISO string -- ical.js converts to JS Date
    expect(event.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws error with Chinese message for invalid ICS text', () => {
    expect(() => {
      adapter.parseIcsText('not valid ics data', SOURCE_ID, RANGE_START, RANGE_END);
    }).toThrow(/解析失败/);
  });

  it('excludes events outside the specified date range', () => {
    // Range that does not cover April 2026
    const earlyStart = new Date('2025-01-01T00:00:00Z');
    const earlyEnd = new Date('2025-02-01T00:00:00Z');

    const events = adapter.parseIcsText(SIMPLE_ICS, SOURCE_ID, earlyStart, earlyEnd);

    expect(events).toHaveLength(0);
  });
});

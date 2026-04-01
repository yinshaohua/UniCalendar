import ICAL from 'ical.js';
import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource } from '../models/types';

export class IcsSyncAdapter {

  parseIcsText(
    icsText: string,
    sourceId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): CalendarEvent[] {
    let jCalData: unknown[];
    try {
      jCalData = ICAL.parse(icsText);
    } catch {
      throw new Error(
        '日历数据解析失败: 输入内容不是有效的ICS格式.',
      );
    }

    const comp = new ICAL.Component(jCalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const events: CalendarEvent[] = [];

    const icalRangeStart = ICAL.Time.fromJSDate(rangeStart, true);
    const icalRangeEnd = ICAL.Time.fromJSDate(rangeEnd, true);

    for (const vevent of vevents) {
      const icalEvent = new ICAL.Event(vevent);

      if (icalEvent.isRecurring()) {
        const expanded = this.expandRecurring(
          icalEvent, sourceId, icalRangeStart, icalRangeEnd,
        );
        events.push(...expanded);
      } else {
        // Non-recurring: check if within range
        if (icalEvent.startDate.compare(icalRangeEnd) > 0) {
          continue;
        }
        if (icalEvent.endDate.compare(icalRangeStart) < 0) {
          continue;
        }
        events.push(this.toCalendarEvent(icalEvent, sourceId));
      }
    }

    return events;
  }

  async sync(
    source: CalendarSource,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const feedUrl = source.ics?.feedUrl;
    if (!feedUrl) {
      throw new Error('日历源缺少ICS订阅URL.');
    }

    let responseText: string;
    try {
      const response = await requestUrl({ url: feedUrl });
      responseText = response.text;
    } catch {
      throw new Error(
        '无法连接到日历源: ' + feedUrl + '. 请检查网络连接和URL是否正确.',
      );
    }

    return this.parseIcsText(responseText, source.id, rangeStart, rangeEnd);
  }

  private expandRecurring(
    icalEvent: ICAL.Event,
    sourceId: string,
    rangeStart: ICAL.Time,
    rangeEnd: ICAL.Time,
  ): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const iterator = icalEvent.iterator(icalEvent.startDate);
    const duration = icalEvent.duration;

    // Safety limit to prevent infinite loops
    const maxIterations = 1000;
    let count = 0;

    let next = iterator.next();
    while (next && !iterator.complete && count < maxIterations) {
      count++;

      // Skip occurrences before range
      if (next.compare(rangeEnd) > 0) {
        break;
      }

      const occurrenceEnd = next.clone();
      occurrenceEnd.addDuration(duration);

      if (occurrenceEnd.compare(rangeStart) >= 0) {
        events.push(
          this.toCalendarEvent(icalEvent, sourceId, next),
        );
      }

      next = iterator.next();
    }

    return events;
  }

  private toCalendarEvent(
    icalEvent: ICAL.Event,
    sourceId: string,
    occurrence?: ICAL.Time,
  ): CalendarEvent {
    const isAllDay = icalEvent.startDate.isDate;

    let start: string;
    let end: string;

    if (occurrence) {
      const occEnd = occurrence.clone();
      occEnd.addDuration(icalEvent.duration);

      if (isAllDay) {
        start = this.icalDateToISO(occurrence.toICALString());
        end = this.icalDateToISO(occEnd.toICALString());
      } else {
        start = occurrence.toJSDate().toISOString();
        end = occEnd.toJSDate().toISOString();
      }
    } else {
      if (isAllDay) {
        start = this.icalDateToISO(icalEvent.startDate.toICALString());
        end = this.icalDateToISO(icalEvent.endDate.toICALString());
      } else {
        start = icalEvent.startDate.toJSDate().toISOString();
        end = icalEvent.endDate.toJSDate().toISOString();
      }
    }

    const uid = icalEvent.uid;
    const id = occurrence
      ? `${sourceId}::${uid}::${occurrence.toICALString()}`
      : `${sourceId}::${uid}`;

    return {
      id,
      sourceId,
      title: icalEvent.summary || '',
      start,
      end,
      allDay: isAllDay,
      location: icalEvent.location || undefined,
      description: icalEvent.description || undefined,
      recurrenceId: occurrence ? occurrence.toICALString() : undefined,
    };
  }

  // Convert ICAL date string (e.g. "20260401") to ISO date (e.g. "2026-04-01")
  private icalDateToISO(icalStr: string): string {
    const dateOnly = icalStr.replace(/[^0-9]/g, '').slice(0, 8);
    return `${dateOnly.slice(0, 4)}-${dateOnly.slice(4, 6)}-${dateOnly.slice(6, 8)}`;
  }
}

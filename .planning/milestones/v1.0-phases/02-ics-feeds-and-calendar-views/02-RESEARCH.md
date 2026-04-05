# Phase 2: ICS Feeds and Calendar Views — Research

**Researched:** 2026-04-01
**Phase:** 02-ics-feeds-and-calendar-views

## Domain Analysis

### ICS/iCalendar Parsing

**Library choice: ical.js** (Decision D-08 from CONTEXT.md)
- npm package: `ical.js` (https://github.com/kewisch/ical.js)
- Provides: VEVENT parsing, RRULE expansion, VTIMEZONE handling
- Install: `npm install ical.js`
- TypeScript: Has `@types/ical.js` available or ships own types
- Bundle impact: ~50KB minified — acceptable for Obsidian plugin
- Key classes: `ICAL.Component`, `ICAL.Event`, `ICAL.RecurExpansion`, `ICAL.TimezoneService`

**ICS parsing flow:**
1. Fetch ICS text via `requestUrl({ url: feedUrl })` (Obsidian API — works on mobile)
2. Parse with `ICAL.parse(icsText)` → jCal data
3. Create `new ICAL.Component(jCalData)` → component tree
4. Extract VEVENTs: `component.getAllSubcomponents('vevent')`
5. For each VEVENT: `new ICAL.Event(vevent)` → event object with start/end/summary/location/description
6. For recurring events: Use `event.iterator(startDate)` to expand instances within visible range

### RRULE Expansion Strategy (Decision D-09)

On-demand expansion — only expand recurring events for the visible time range plus a buffer:
- Month view: expand current month ± 1 month (for prev/next month cells)
- Week view: expand current week only
- Day view: expand current day only
- Buffer: 1 extra period on each side for smooth navigation

**ical.js RRULE expansion pattern:**
```typescript
const start = ICAL.Time.fromJSDate(rangeStart);
const end = ICAL.Time.fromJSDate(rangeEnd);
const iter = event.iterator(start);
let next;
while ((next = iter.next()) && next.compare(end) <= 0) {
  // Create CalendarEvent instance for this occurrence
}
```

### Timezone Handling (Decision D-10)

- ical.js handles VTIMEZONE natively
- Convert all times to local timezone after parsing
- Use `ICAL.Time.toJSDate()` which converts to local Date
- Store as ISO 8601 local time strings in CalendarEvent.start/end

## Codebase Analysis

### Existing Architecture

**Files to extend:**
| File | Current State | Phase 2 Changes |
|------|--------------|-----------------|
| `src/views/CalendarView.ts` | Empty grids (month/week/day), navigation, view switching | Add event rendering in all three grids |
| `src/sync/SyncManager.ts` | Stub (simulates sync) | Wire up ICS adapter for real fetching |
| `src/store/EventStore.ts` | Working cache layer | Add `getEventsForDateRange()` method |
| `src/models/types.ts` | All types defined | Add `monthOverflowMode` to settings |
| `src/settings/SettingsTab.ts` | Source CRUD, general settings | Add overflow mode setting |
| `src/main.ts` | Plugin lifecycle, sync trigger | Wire ICS adapter, pass events to view |

**New files to create:**
| File | Purpose |
|------|---------|
| `src/sync/IcsSyncAdapter.ts` | ICS fetch + ical.js parsing + RRULE expansion |
| `src/views/EventDetailModal.ts` | Obsidian Modal for event details |

### CalendarView Grid Structure (Current)

**Month grid:** CSS Grid 7-column layout. Each cell is a `div.uni-calendar-day` with just a day number. Need to add event bar container inside each cell.

**Week grid:** CSS Grid `50px repeat(7, 1fr)`. Currently uses flat cells per hour×day. Need to restructure to column-based layout with `position: relative` wrappers for absolute event positioning.

**Day grid:** CSS Grid `50px 1fr`. Currently uses flat hour cells. Need same restructuring as week view for single column.

### Key Integration Points

1. **SyncManager → IcsSyncAdapter:** SyncManager.syncAll() needs to detect `source.type === 'ics'` and call IcsSyncAdapter
2. **IcsSyncAdapter → EventStore:** Parsed events go to `eventStore.replaceEvents(sourceId, events)`
3. **CalendarView → EventStore:** View queries `eventStore.getEventsForDate(dateStr)` or new range query
4. **CalendarView → EventDetailModal:** Click handler opens modal with CalendarEvent data
5. **Main.ts:** After sync, trigger view re-render

### Overlap Detection Algorithm

For week/day views with absolute positioning:
1. Sort events by start time, then by duration (longer first)
2. Track active columns (occupied time slots)
3. Assign each event to first available column
4. After all assigned: `width = 100% / maxColumns`, `left = colIndex * width`
5. Cap at 4 visual columns max

### Current Time Indicator

Red line at current time in week/day views:
- Position: `(currentHour - firstHour) * hourHeight + (currentMinute / 60) * hourHeight`
- Style: `border-top: 2px solid var(--text-error)` with 6px red circle at left edge
- Only show in today's column
- Update every minute with `setInterval`

## Week View Hour Range Logic

Default range: 7:00-22:00 (Decision from UI-SPEC).
Dynamic extension: If events exist outside this range, extend to include them.

```typescript
function getHourRange(events: CalendarEvent[]): { start: number; end: number } {
  let start = 7, end = 22;
  for (const e of events) {
    const eStart = new Date(e.start).getHours();
    const eEnd = new Date(e.end).getHours() + (new Date(e.end).getMinutes() > 0 ? 1 : 0);
    if (eStart < start) start = eStart;
    if (eEnd > end) end = eEnd;
  }
  return { start, end };
}
```

## Keyboard Navigation (VIEW-06)

Attach keydown listener to CalendarView content container with `tabindex="0"`.
Only active when container has focus.

Keys: ArrowLeft/Right for prev/next navigation, `t` for today, `1`/`2`/`3` for view switching.

## Error Handling

### ICS Fetch Errors
- Network error → SyncState error: "无法连接到日历源: {url}. 请检查网络连接和URL是否正确."
- Parse error → SyncState error: "日历数据解析失败: {url}. 该链接可能不是有效的ICS订阅源."
- Per-source errors: Don't fail entire sync. Log error per source, continue with others.

## Plan Decomposition Recommendation

### Wave 1 (Foundation — no UI dependencies between these):
1. **Plan 02-01:** ICS Sync Adapter — ical.js integration, ICS parsing, RRULE expansion, wire into SyncManager
2. **Plan 02-02:** EventStore enhancements + Settings additions (overflow mode, date range query)

### Wave 2 (UI — depends on Wave 1 data layer):
3. **Plan 02-03:** Month view event rendering (EventBars, overflow handling, day click → day view)
4. **Plan 02-04:** Week/Day view event rendering (grid restructure, absolute positioning, overlap detection, current time indicator)

### Wave 3 (Polish — depends on Wave 2):
5. **Plan 02-05:** Event detail modal, keyboard navigation, sync error messages

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| ical.js bundle size | Tree-shake; only import needed modules |
| RRULE expansion performance | On-demand expansion with narrow time ranges |
| Week/day grid restructure complexity | Test absolute positioning math with edge cases |
| Mobile touch targets | Follow UI-SPEC min-height 20px + padding rules |
| CSS inline vs external | Continue CALENDAR_CSS pattern from Phase 1 |

## Code Examples

### ICS Sync Adapter (Core Pattern)
```typescript
import ICAL from 'ical.js';
import { requestUrl } from 'obsidian';
import { CalendarEvent, CalendarSource } from '../models/types';

export class IcsSyncAdapter {
  async sync(source: CalendarSource, rangeStart: Date, rangeEnd: Date): Promise<CalendarEvent[]> {
    if (!source.ics?.feedUrl) throw new Error('No feed URL');

    const response = await requestUrl({ url: source.ics.feedUrl });
    const jCalData = ICAL.parse(response.text);
    const comp = new ICAL.Component(jCalData);
    const events: CalendarEvent[] = [];

    for (const vevent of comp.getAllSubcomponents('vevent')) {
      const event = new ICAL.Event(vevent);

      if (event.isRecurring()) {
        // Expand recurring instances within range
        const iter = event.iterator(ICAL.Time.fromJSDate(rangeStart));
        let next;
        while ((next = iter.next())) {
          if (next.compare(ICAL.Time.fromJSDate(rangeEnd)) > 0) break;
          events.push(this.toCalendarEvent(event, source.id, next));
        }
      } else {
        const start = event.startDate.toJSDate();
        if (start >= rangeStart && start <= rangeEnd) {
          events.push(this.toCalendarEvent(event, source.id));
        }
      }
    }
    return events;
  }
}
```

### EventBlock Positioning (Core Pattern)
```typescript
function positionEvent(event: CalendarEvent, hourHeight: number, firstHour: number): { top: number; height: number } {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const duration = endMinutes - startMinutes;

  const top = ((startMinutes / 60) - firstHour) * hourHeight;
  const height = Math.max(20, (duration / 60) * hourHeight);
  return { top, height };
}
```

---

*Research completed: 2026-04-01*
*Method: Direct codebase analysis + domain knowledge (API issues prevented web research)*

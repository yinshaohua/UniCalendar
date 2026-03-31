# Phase 2: ICS Feeds and Calendar Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 02-ics-feeds-and-calendar-views
**Areas discussed:** Month view event rendering, Week/day view event blocks, Event detail modal, ICS parsing & RRULE

---

## Month View Event Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Color bar snippets | Each event as a small bar with source-color left border, showing time+title. Apple Calendar style. | |
| Dots + hover details | Only colored dots in cells, hover to see list. Cleaner but less info density. | |
| Text list | One line per event (time+title), no color blocks. High density but visually plain. | |

**User's choice:** Color bar snippets (recommended option)
**Notes:** None

### Overflow Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show 3 + "+N more" | Show first 3 events, overflow shows "+2 more", click to expand or jump to day view. Google Calendar style. | |
| Show all, auto-expand | All events shown, cell height auto-adapts. Weeks with many events get taller. | |
| Claude decides | Let Claude decide based on implementation complexity and UI effect | |

**User's choice:** Custom — make it a config setting. Default mode: show all (auto-expand). Alternative mode: show 3 + "+N more".
**Notes:** User wants both options available as a user setting, defaulting to show-all mode.

---

## Week/Day View Event Blocks

### Positioning

| Option | Description | Selected |
|--------|-------------|----------|
| Precise time positioning | Event blocks positioned by actual start/end times, height proportional to duration. Standard Apple/Google Calendar approach. | ✓ |
| Snap to hour | Events snap to nearest hour grid cell. Simpler but less accurate. | |
| Claude decides | Let Claude decide positioning precision | |

**User's choice:** Precise time positioning (recommended option)
**Notes:** None

### Overlap Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side columns | Overlapping events split into equal-width columns. 2 overlap = 50% each. Apple Calendar style. | ✓ |
| Stacked offset | Overlapping events slightly offset and stacked, click to expand. More compact but may obscure content. | |
| Claude decides | Let Claude decide based on implementation complexity | |

**User's choice:** Side-by-side columns (recommended option)
**Notes:** None

### Event Block Content

| Option | Description | Selected |
|--------|-------------|----------|
| Title + time range | Show event title and "10:00-11:30" style time range. Clean and clear. | ✓ |
| Title + time + location | Show title, time, location (if available). More info but short events may overflow. | |
| Claude decides | Auto-adjust based on event block height — show more info if space allows | |

**User's choice:** Title + time range
**Notes:** None

---

## Event Detail Modal

### Display Form

| Option | Description | Selected |
|--------|-------------|----------|
| Obsidian Modal | Native Obsidian Modal component, centered popup. Consistent style, framework-supported, works on desktop and mobile. | ✓ |
| Floating card (Popover) | Small card popping up next to event block. Lighter, doesn't block calendar, but mobile experience may be poor. | |
| Side panel | Open detail panel on the right side. Doesn't block calendar but compresses calendar width. | |

**User's choice:** Obsidian Modal (recommended option)
**Notes:** None

### Detail Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Title + time + location + description | Show title, start/end time, location (if available), description (if available), source calendar name with color indicator | ✓ |
| Minimal mode | Only title and time, other fields collapsed | |
| Claude decides | Auto-decide based on available ICS fields | |

**User's choice:** Title + time + location + description
**Notes:** None

---

## ICS Parsing & RRULE

### Parsing Library

| Option | Description | Selected |
|--------|-------------|----------|
| ical.js | Mature ICS/iCalendar parsing library. RRULE expansion, VTIMEZONE support. Active community, ~80KB gzipped. | ✓ |
| Custom lightweight parser | Custom VEVENT parser + rrule.js for recurrence. Smaller bundle but many edge cases to handle. | |
| Claude decides | Let Claude weigh bundle size, compatibility, mobile support | |

**User's choice:** ical.js (recommended option)
**Notes:** None

### RRULE Expansion Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand by visible range | Only expand recurring instances within currently visible time range. E.g., month view expands current month +/- days. Compute on demand, good performance. | ✓ |
| Full cache window expansion | Expand all instances within cache window at sync time. Fast queries but larger storage. | |
| Claude decides | Let Claude decide based on performance and complexity | |

**User's choice:** On-demand by visible range (recommended option)
**Notes:** None

### Timezone Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to local time | All event times converted to local timezone after ICS parsing. ical.js handles VTIMEZONE natively. Store as local time. | ✓ |
| UTC storage + display conversion | Store all times in UTC internally, convert to local only at render time. More standard but more complex. | |
| Claude decides | Let Claude decide based on ical.js capabilities and implementation complexity | |

**User's choice:** Convert to local time (recommended option)
**Notes:** None

---

## Claude's Discretion

- Event block visual style details (border radius, padding, font size, shadow)
- Keyboard navigation implementation details (VIEW-06)
- ICS fetch mechanism (use Obsidian requestUrl)
- Error handling for malformed ICS feeds
- Performance optimization for large event sets
- Exact time range for RRULE on-demand expansion buffer
- Week view hour range adjustments

## Deferred Ideas

None — discussion stayed within phase scope.

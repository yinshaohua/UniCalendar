# Phase 2: ICS Feeds and Calendar Views - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can subscribe to ICS feed URLs and see events rendered in fully functional month, week, and day calendar views. This phase delivers ICS parsing, event rendering across all three view modes, event detail display, RRULE expansion, timezone handling, and keyboard navigation. No CalDAV or Google Calendar integration — those are Phase 3 and 4.

</domain>

<decisions>
## Implementation Decisions

### Month View Event Rendering
- **D-01:** Events displayed as colored bar snippets with source-color left border, showing time + title. Apple Calendar style.
- **D-02:** Overflow handling is a user-configurable setting with two modes:
  - **Mode 1 (default):** Show all events, cell height auto-expands
  - **Mode 2:** Show first 3 events + "+N more" indicator (click to expand or jump to day view)

### Week/Day View Event Blocks
- **D-03:** Events positioned precisely on the time axis based on actual start/end times, height proportional to duration
- **D-04:** Overlapping events use side-by-side column layout (equal width split). E.g., 2 overlapping events each get 50% width. Apple Calendar style.
- **D-05:** Event blocks display title + time range (e.g., "10:00-11:30")

### Event Detail Modal
- **D-06:** Use Obsidian native Modal component for event details. Works on both desktop and mobile.
- **D-07:** Detail fields shown: title, start/end time, location (if available), description (if available), source calendar name with color indicator

### ICS Parsing & RRULE
- **D-08:** Use ical.js library for ICS parsing. Provides RRULE expansion, VTIMEZONE support, and comprehensive iCalendar spec coverage.
- **D-09:** RRULE expansion is on-demand — only expand recurring event instances within the currently visible time range. Do not pre-expand and store all instances.
- **D-10:** All event times converted to local timezone after ICS parsing. ical.js handles VTIMEZONE natively. Store as local time, not UTC.

### Claude's Discretion
- Event block visual style details (border radius, padding, font size, shadow)
- Keyboard navigation implementation details (VIEW-06)
- ICS fetch mechanism (use Obsidian requestUrl)
- Error handling for malformed ICS feeds
- Performance optimization for large event sets
- Exact time range for RRULE on-demand expansion (how much buffer beyond visible range)
- Week view hour range (currently 8-22, may need adjustment for events outside this range)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 2 covers SYNC-03, VIEW-01 through VIEW-06, EVNT-01 through EVNT-04
- `.planning/PROJECT.md` — Project vision, constraints (bundle size, offline, mobile compatibility)
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependencies

### Phase 1 Context
- `.planning/phases/01-foundation-and-infrastructure/01-CONTEXT.md` — Foundation decisions (event store, sync manager, settings UI, cache strategy)

### Existing Implementation
- `src/views/CalendarView.ts` — Existing calendar view with month/week/day grids (empty, no events yet), toolbar, navigation, view switching
- `src/models/types.ts` — CalendarEvent, CalendarSource, EventCache, SyncState type definitions
- `src/store/EventStore.ts` — Event storage and cache layer
- `src/sync/SyncManager.ts` — Sync orchestration framework
- `src/styles/calendar-view.css` — Existing calendar CSS (may need refactoring since CalendarView.ts has inline CSS)
- `src/settings/SettingsTab.ts` — Settings UI

No external specs or ADRs — requirements fully captured in decisions above and project files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CalendarView` class: Full month/week/day grid rendering already built, with navigation, view switching, today button, sync status display. Needs extension to render events on the grids.
- `EventStore`: Event storage layer ready for querying events by date range
- `SyncManager`: Sync orchestration ready — needs ICS adapter implementation
- `CalendarEvent` type: Already defined with id, sourceId, title, start, end, allDay, location, description, recurrenceId fields
- `SOURCE_COLORS` array: 10 preset colors for source color-coding
- Obsidian `Modal` base class: For event detail popups

### Established Patterns
- TypeScript strict mode, esbuild bundling
- Obsidian CSS variables used throughout (--text-normal, --background-primary, --interactive-accent, etc.)
- DOM manipulation via Obsidian's createDiv/createEl helpers
- Chinese locale already used (day names, month names, UI strings like "今天", "同步中...")
- View mode state tracked as `'month' | 'week' | 'day'`
- Inline CSS in CalendarView.ts (CALENDAR_CSS const) alongside external calendar-view.css

### Integration Points
- `CalendarView.renderMonthGrid()` — extend to place event bars in day cells
- `CalendarView.renderWeekGrid()` — extend to position event blocks on hourly grid
- `CalendarView.renderDayGrid()` — extend to position event blocks on hourly grid
- `SyncManager` — add ICS sync adapter that fetches and parses ICS feeds
- `EventStore` — query events by date range for rendering
- Settings — add month view overflow mode toggle

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-ics-feeds-and-calendar-views*
*Context gathered: 2026-04-01*

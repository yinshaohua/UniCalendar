# Requirements: UniCalendar

**Defined:** 2026-03-31
**Core Value:** Users can see all their calendar events from multiple sources in one clean, reliable view inside Obsidian — especially sources like DingTalk calendar that existing plugins fail to support.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Calendar Views

- [x] **VIEW-01**: User can see a month view with event dots/snippets on each day
- [ ] **VIEW-02**: User can see a week view with hourly grid and event blocks
- [ ] **VIEW-03**: User can see a day view with detailed hourly timeline
- [ ] **VIEW-04**: User can switch between month, week, and day views
- [ ] **VIEW-05**: User can navigate to today's date with one click
- [ ] **VIEW-06**: User can navigate between dates using keyboard arrows

### Data Sources

- [ ] **SYNC-01**: User can sync events from Google Calendar (read-only via OAuth2)
- [ ] **SYNC-02**: User can sync events from CalDAV servers (read-only, must work with DingTalk)
- [ ] **SYNC-03**: User can import events from ICS feed URLs
- [ ] **SYNC-04**: User sees events from all sources merged into one unified view

### Event Display

- [ ] **EVNT-01**: User sees events color-coded by their calendar source
- [ ] **EVNT-02**: User can click an event to see full details (title, time, location, description)
- [ ] **EVNT-03**: User sees recurring events correctly expanded from RRULE
- [ ] **EVNT-04**: User sees events displayed in their local timezone regardless of source timezone
- [x] **EVNT-05**: User sees a sync status indicator showing last sync time and sync-in-progress

### Infrastructure

- [x] **INFR-01**: User can view previously synced events when offline
- [x] **INFR-02**: User can add, edit, and remove calendar sources in settings
- [ ] **INFR-03**: User sees an Apple Calendar-inspired UI with clean design, rounded corners, and soft colors
- [x] **INFR-04**: Plugin works on both Obsidian desktop and mobile

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### View Enhancements

- **VEXT-01**: All-day event bar at top of day/week view
- **VEXT-02**: Multi-day events render as continuous bars spanning across day columns
- **VEXT-03**: Smooth animated transitions between views and date navigation
- **VEXT-04**: Mini calendar sidebar widget for quick date navigation

### Event Features

- **EFET-01**: User can show/hide individual calendar sources (per-source toggle)
- **EFET-02**: User can search events by text across all sources
- **EFET-03**: Smart sync scheduling with configurable intervals and exponential backoff

### Integration

- **INTG-01**: Daily note integration (insert today's events into daily notes)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Two-way sync (create/edit events) | Massively increases complexity: conflict resolution, write permissions, provider-specific write APIs |
| Task/to-do management | Calendar events and tasks are different domains; Obsidian Tasks plugin exists |
| Real-time push notifications | Requires persistent connections and background services |
| Separate mobile UI | Responsive CSS adapts to mobile; single codebase approach |
| Markdown event storage | Pollutes vault with auto-generated content; events are ephemeral cache |
| iCalendar export | Users can export from source calendars directly |
| Calendar sharing | Social features belong in dedicated calendar platforms |
| Agenda/list view | Month/week/day views cover the need; day view serves "what's today" use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIEW-01 | Phase 2 | Complete |
| VIEW-02 | Phase 2 | Pending |
| VIEW-03 | Phase 2 | Pending |
| VIEW-04 | Phase 2 | Pending |
| VIEW-05 | Phase 2 | Pending |
| VIEW-06 | Phase 2 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 3 | Complete |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 4 | Pending |
| EVNT-01 | Phase 2 | Pending |
| EVNT-02 | Phase 2 | Pending |
| EVNT-03 | Phase 2 | Pending |
| EVNT-04 | Phase 2 | Pending |
| EVNT-05 | Phase 1 | Complete |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 5 | Pending |
| INFR-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*

# Roadmap: UniCalendar

## Overview

UniCalendar delivers a unified calendar view inside Obsidian by building outward from a solid data foundation. The approach proves the complete pipeline with the simplest source (ICS feeds) first, builds all calendar views against real event data, then adds the harder protocol integrations (CalDAV for DingTalk, Google Calendar with OAuth2) one at a time. Each source integration phase delivers independently verifiable value. The final phase applies Apple Calendar-inspired visual polish once all data sources are flowing.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Infrastructure** - Plugin skeleton, event store, settings UI, offline cache, and mobile validation
- [ ] **Phase 2: ICS Feeds and Calendar Views** - Complete calendar rendering with month/week/day views driven by real ICS data
- [ ] **Phase 3: CalDAV Integration** - CalDAV protocol support with DingTalk as the primary acceptance target
- [ ] **Phase 4: Google Calendar and Multi-Source Unification** - OAuth2 Google sync and unified multi-source event merging
- [ ] **Phase 5: Apple Calendar UI Polish** - Visual refinement to Apple Calendar-inspired design with clean aesthetics

## Phase Details

### Phase 1: Foundation and Infrastructure
**Goal**: Users can open the plugin, manage calendar source configurations, and the technical foundation supports offline caching and cross-platform operation
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-04, EVNT-05
**Success Criteria** (what must be TRUE):
  1. User can open the plugin and see an empty calendar view placeholder in Obsidian
  2. User can open settings and add/edit/remove calendar source configurations (Google, CalDAV, ICS fields available)
  3. Plugin loads and renders on both Obsidian desktop and mobile without errors
  4. User sees a sync status indicator showing "no sources configured" or last sync time
  5. Previously synced event data persists across Obsidian restarts (offline cache operational)
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Types, EventStore, SyncManager, and test infrastructure
- [ ] 01-02-PLAN.md -- Plugin entry point, CalendarView with empty state grid and sync status
- [ ] 01-03-PLAN.md -- Card-based settings UI for calendar source management

### Phase 2: ICS Feeds and Calendar Views
**Goal**: Users can subscribe to ICS feed URLs and see events rendered in fully functional month, week, and day calendar views
**Depends on**: Phase 1
**Requirements**: SYNC-03, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, EVNT-01, EVNT-02, EVNT-03, EVNT-04
**Success Criteria** (what must be TRUE):
  1. User can add an ICS feed URL and see its events appear in the calendar after sync
  2. User can view events in month view (event dots/snippets), week view (hourly grid with blocks), and day view (detailed timeline)
  3. User can switch between month/week/day views and navigate between dates using controls and keyboard arrows
  4. User can click any event to see its full details (title, time, location, description)
  5. Events from different ICS sources appear in distinct colors, recurring events expand correctly, and all times display in the user's local timezone
**Plans:** 5 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md -- ICS sync adapter: ical.js parsing, RRULE expansion, timezone handling, SyncManager wiring
- [x] 02-02-PLAN.md -- EventStore date range query and month overflow mode setting
- [x] 02-03-PLAN.md -- Month view event bar rendering with overflow handling
- [x] 02-04-PLAN.md -- Week/day view event block rendering with overlap detection and current time indicator
- [x] 02-05-PLAN.md -- Event detail modal, keyboard navigation, sync-to-render wiring, visual checkpoint

### Phase 3: CalDAV Integration
**Goal**: Users can connect CalDAV calendar servers -- especially DingTalk -- and see those events alongside ICS feed events
**Depends on**: Phase 2
**Requirements**: SYNC-02
**Success Criteria** (what must be TRUE):
  1. User can add a CalDAV server URL with credentials and the plugin discovers available calendars
  2. User sees DingTalk calendar events synced and displayed correctly in the calendar views
  3. CalDAV events from other providers (Nextcloud, iCloud, Fastmail) sync without errors
  4. CalDAV sync errors surface clearly in the sync status indicator with actionable messages
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md -- CalDavSyncAdapter: PROPFIND discovery, REPORT event fetch, XML parsing, SyncManager wiring
- [x] 03-02-PLAN.md -- Settings UI calendar discovery: discover button, calendar selection, DingTalk verification
- [x] 03-03-PLAN.md -- CalDAV settings UI refinement: remove descriptions, picker modal, persist selected calendar name, 5-row month grid

### Phase 4: Google Calendar and Multi-Source Unification
**Goal**: Users can connect Google Calendar via OAuth2 and see events from all three source types merged into one unified view
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-04
**Success Criteria** (what must be TRUE):
  1. User can authenticate with Google and see their Google Calendar events in the calendar views
  2. User sees events from ICS, CalDAV, and Google Calendar merged into a single unified timeline without duplicates
  3. Google OAuth2 token refreshes automatically without requiring re-authentication
  4. Adding or removing any source type updates the unified view correctly
**Plans:** 1/3 plans executed

Plans:
- [x] 04-01-PLAN.md -- GoogleAuthHelper (OAuth2 PKCE), GoogleSyncAdapter (API client), type extensions, tests
- [x] 04-02-PLAN.md -- EventDeduplicator (UID + time+title fallback), ICS uid backfill, tests
- [x] 04-03-PLAN.md -- SyncManager/EventStore/Settings/main.ts wiring, OAuth flow UI, human verification

### Phase 5: Apple Calendar UI Polish
**Goal**: The calendar achieves Apple Calendar-inspired visual quality with clean design, rounded corners, soft colors, and polished interactions
**Depends on**: Phase 4
**Requirements**: INFR-03
**Success Criteria** (what must be TRUE):
  1. Calendar UI uses rounded corners, soft color palette, and clean typography consistent with Apple Calendar aesthetics
  2. Event blocks, day cells, and navigation elements have consistent spacing and visual weight
  3. The calendar looks polished on both desktop and mobile screen sizes
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- CalendarView CSS polish: rounded corners, shadows, softened grids, transitions
- [x] 05-02-PLAN.md -- EventDetailModal polish and SettingsTab color palette picker
- [ ] 05-03-PLAN.md -- Legacy CSS cleanup and visual verification checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Infrastructure | 0/3 | Planning complete | - |
| 2. ICS Feeds and Calendar Views | 0/5 | Planning complete | - |
| 3. CalDAV Integration | 0/? | Not started | - |
| 4. Google Calendar and Multi-Source Unification | 1/3 | In Progress|  |
| 5. Apple Calendar UI Polish | 2/3 | In Progress | - |

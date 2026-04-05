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
- [ ] **Phase 6: Chinese Lunar Calendar Support** - 支持中国农历、节气、当前年份中国大陆放假日期

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
- [x] 05-03-PLAN.md -- Legacy CSS cleanup and visual verification checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Infrastructure | 0/3 | Planning complete | - |
| 2. ICS Feeds and Calendar Views | 0/5 | Planning complete | - |
| 3. CalDAV Integration | 0/? | Not started | - |
| 4. Google Calendar and Multi-Source Unification | 1/3 | In Progress|  |
| 5. Apple Calendar UI Polish | 2/3 | In Progress | - |
| 6. Chinese Lunar Calendar Support | 0/3 | Planning complete | - |

### Phase 6: Chinese Lunar Calendar Support
**Goal**: Users see Chinese lunar dates, solar terms (节气), and current-year mainland China public holidays displayed in the calendar views
**Depends on**: Phase 5
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12
**Success Criteria** (what must be TRUE):
  1. Each calendar day cell displays the corresponding Chinese lunar date (农历日期)
  2. Solar terms (二十四节气) are marked on the correct dates with visual indicators
  3. Current-year mainland China statutory holidays and adjusted workdays are clearly indicated
  4. Lunar/holiday information renders correctly on both desktop and mobile
**Plans:** 3 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md -- LunarService + HolidayService with TDD (chinese-days library integration)
- [x] 06-02-PLAN.md -- Settings toggles for lunar calendar and holiday display
- [x] 06-03-PLAN.md -- CalendarView integration: lunar dates, holiday badges, today restyle, visual checkpoint

### Phase 7: 确认并调整农历节气的来源和展示
**Goal:** Users see only 9 canonical traditional festivals (not 50+ obscure folk festivals), with correct dynamic 除夕 detection and leap month display
**Requirements**: P7-01, P7-02, P7-03, P7-04, P7-05, P7-06, P7-07
**Depends on:** Phase 6
**Success Criteria** (what must be TRUE):
  1. Only 9 canonical festivals display as festival type (春节, 元宵, 端午, 七夕, 中元, 中秋, 重阳, 腊八, 除夕)
  2. Obscure folk festivals (犬日, 猪日, 药王诞辰, etc.) are completely removed from display
  3. 除夕 is detected dynamically regardless of 12th-month length (29 or 30 days)
  4. Solar terms continue to display correctly
  5. Leap months show "闰" prefix in toolbar title
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md -- LunarService TDD: canonical festival map, 除夕 detection, leap month display

### Phase 8: 法定假日的动态获取

**Goal:** HolidayService dynamically fetches mainland China public holiday data from NateScarlet/holiday-cn, with 24h-throttled updates piggybacking on calendar sync, offline cache persistence, and chinese-days static fallback
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):
  1. Holiday data is fetched from NateScarlet/holiday-cn via jsdelivr CDN (with raw.githubusercontent.com fallback)
  2. Fetched data covers current year + next year, cached in plugin data storage
  3. Update checks piggyback on calendar sync with 24-hour throttle
  4. Dynamic data takes priority over chinese-days static data; fallback is seamless
  5. Fetch failures show Notice and continue with cache/static data
  6. getHolidayInfo() remains synchronous -- CalendarView unchanged
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md -- HolidayFetcher TDD + HolidayService refactor (dynamic priority + static fallback)
- [x] 08-02-PLAN.md -- Plugin lifecycle integration: cache persistence, triggerSync wiring, error handling

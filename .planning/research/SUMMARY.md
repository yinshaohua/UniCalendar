# Project Research Summary

**Project:** UniCalendar (Obsidian Calendar Sync Plugin)
**Domain:** Obsidian plugin — multi-source calendar aggregation and display
**Researched:** 2026-03-31
**Confidence:** MEDIUM

## Executive Summary

UniCalendar is a read-only calendar aggregation plugin for Obsidian that pulls events from Google Calendar, CalDAV servers (specifically DingTalk), and ICS feeds into a unified, Apple Calendar-inspired view. The motivating pain point is a concrete one: the existing Full Calendar plugin has broken CalDAV support that fails with DingTalk. The recommended approach is a layered, adapter-based architecture built entirely on Obsidian's native APIs — no UI framework, no heavy external HTTP libraries, and a strict read-only scope that avoids the complexity of two-way sync. The project is technically feasible with a focused dependency footprint (ical.js + date-fns + a custom CalDAV client), and the custom DOM-based calendar UI, while substantial, is well-understood work.

The primary risks cluster around two areas: CalDAV compatibility and Google OAuth2 lifecycle. DingTalk's CalDAV implementation deviates from the RFC spec, which is literally why this plugin is being built — so DingTalk must be the first CalDAV acceptance test, not a stretch goal. OAuth2 token management across Obsidian desktop and mobile introduces several sharp edges (device-local vs vault-synced storage, mobile redirect flow, proactive token refresh) that must be designed correctly from the start. Both risks have clear prevention strategies but require deliberate architecture decisions before writing protocol-level code.

The recommended build order flows from data model inward to protocol adapters outward: define a unified CalendarEvent type and Event Store first, prove the pipeline with ICS (the simplest source), build out calendar views against real ICS data, then tackle CalDAV and Google Calendar as integration phases. This ordering keeps the rendering pipeline testable at every stage and defers the hardest auth/protocol work until the core architecture is proven.

## Key Findings

### Recommended Stack

The stack is deliberately minimal. Obsidian's `requestUrl()` API handles all HTTP on both desktop and mobile, making every other HTTP client library (fetch, axios, node-fetch) off-limits. For CalDAV protocol work, a custom ~300-line client built on `requestUrl` + the browser's native `DOMParser` is preferred over the `tsdav` library, which carries a critical integration risk: it uses `cross-fetch` internally and may not bundle cleanly for Obsidian mobile. ICS parsing must use `ical.js` (pure JS, no Node dependencies, handles RRULE correctly) — the alternative `node-ical` is a hard no due to Node-only dependencies. The Google Calendar integration should use direct REST calls via `requestUrl` rather than the `googleapis` npm package (which is 80MB+ and absurd for a plugin). Calendar UI is custom DOM rendering using Obsidian's `ItemView` — no off-the-shelf calendar widget library works well with Obsidian's view lifecycle. Total estimated bundle: ~100–150KB, well within the 500KB community plugin limit.

**Core technologies:**
- `Obsidian requestUrl`: all HTTP requests — the only API that works on both desktop and mobile without CORS failures
- `ical.js ^2.x`: ICS/iCalendar parsing — handles RRULE, VTIMEZONE, VEVENT; pure JS; used by Mozilla Thunderbird
- `date-fns ^3.x` + `date-fns-tz ^3.x`: date arithmetic and timezone conversion — tree-shakeable ESM, ~15KB bundled
- Custom CalDAV client (~300 lines): RFC 4791 PROPFIND/REPORT using requestUrl + DOMParser — avoids tsdav bundling risk
- Custom Google Calendar REST client (~200 lines): wraps requestUrl with OAuth2 auth headers
- Custom DOM calendar views: ItemView-based month/week/day rendering — no FullCalendar or tui-calendar

**Critical version concern:** All version numbers are from training data (cutoff ~May 2025). Verify with `npm view <pkg> version` before installing.

### Expected Features

The feature set has a clear hierarchy. The table stakes are large (all three sync sources plus all three view modes plus offline cache) but the scope is held in check by a firm read-only principle that eliminates the most complex category of work — event creation, editing, and conflict resolution.

**Must have (table stakes):**
- Month / Week / Day views — every calendar plugin provides these
- CalDAV sync with DingTalk compatibility — the primary reason this plugin exists
- Google Calendar OAuth2 sync — broadest user appeal
- ICS feed import — simplest source type; read-only subscriptions
- Multi-source event merging with deduplication
- Color-coded events per source
- Event detail popup
- Offline event cache (Obsidian saveData/loadData)
- Settings UI for source management
- Recurring event expansion (RRULE via ical.js)
- Timezone normalization (all events to UTC; display in local time)

**Should have (competitive differentiators):**
- Apple Calendar-inspired UI (the primary visual differentiator vs Full Calendar and LifeOS)
- DingTalk-specific CalDAV handling (provider profiles, lenient XML parsing)
- Per-source visibility toggle (show/hide without removing source)
- Full-page ItemView mode (not sidebar-squeezed)
- Mini calendar sidebar widget
- Smart sync with ctag/syncToken-based incremental updates and exponential backoff
- Multi-day event spanning bars
- Smooth animated view transitions
- All-day event bar at top of day/week view

**Defer (v2+):**
- Two-way sync (event creation/editing) — enormous complexity, out of scope
- Daily note integration — scope creep; Periodic Notes plugin handles this
- Task/to-do management — different domain
- Agenda/list view — day view covers the use case
- iCalendar export — no unique value

### Architecture Approach

The architecture is a clean layered system: Plugin Entry (thin lifecycle orchestrator) → {View Manager, Sync Engine, Event Store, Source Registry, Settings Manager} → {Calendar Views, Source Adapters, Auth Handlers} → {External APIs, DOM, Obsidian Data API}. The key design principle is the Source Adapter interface — every protocol (Google, CalDAV, ICS) implements a single `CalendarSource` interface with `fetchEvents(start, end)`, `testConnection()`, and `dispose()`. Adding a new source never touches existing code. The Event Store is the single source of truth: all synced events live here, it persists to disk via `saveData()`, and it notifies the View Manager via Obsidian's `Events` mixin when data changes. Views are stateful objects that re-render from the store on notification — no polling, no framework.

**Major components:**
1. **Plugin Entry** (`main.ts`) — lifecycle wiring only; registers views, commands, settings tab; initializes and connects all subsystems
2. **Event Store** — in-memory event cache; persists to disk; emits change events via Obsidian `Events` class; single source of truth for all views
3. **Source Registry** — CRUD on source configurations; materializes SourceConfig objects into live adapter instances
4. **Sync Engine** — orchestrates parallel fetching from all sources on a timer; merges results into Event Store; per-source retry and error tracking
5. **Source Adapters** — one per protocol (ICSSource, CalDAVSource, GoogleCalendarSource); each implements the CalendarSource interface; isolated protocol complexity
6. **Auth Handlers** — OAuth2 flow for Google (with mobile obsidian:// redirect); Basic auth for CalDAV; token refresh and secure storage
7. **View Manager** — manages the Obsidian ItemView leaf; subscribes to Event Store; delegates rendering to Calendar Views
8. **Calendar Views** — Month/Week/Day renderers; pure UI; CSS Grid layout; receive events, render DOM
9. **Settings Manager** — Obsidian PluginSettingTab; source configuration forms; display preferences

### Critical Pitfalls

1. **CalDAV discovery is not standardized** — DingTalk, iCloud, Nextcloud, and Fastmail all use different discovery paths. Build a multi-strategy pipeline (try .well-known/caldav, fall back to direct URL, then common path patterns). Allow users to paste the full CalDAV URL directly. Build provider profiles for known deviations.

2. **DingTalk CalDAV has known non-standard behavior** — non-standard XML namespaces, unusual auth, potential VTIMEZONE quirks. This is the core use case: test against DingTalk FIRST, not last. Build a lenient XML parser that tolerates unexpected namespaces and missing optional properties. Log raw HTTP requests/responses during development.

3. **OAuth2 token lifecycle in Obsidian** — tokens must be stored in `localStorage` (device-local), not `plugin.saveData()` (vault-synced), to prevent credential leakage to other devices. Implement proactive token refresh 5 minutes before expiry. Handle every OAuth error state explicitly (`invalid_grant` = re-auth, `rate_limited` = backoff). Mobile OAuth needs `obsidian://` URI scheme callback, not localhost redirect.

4. **CORS and requestUrl on Obsidian mobile** — CalDAV servers do not send CORS headers. Only `requestUrl()` from the Obsidian API bypasses this restriction. Never use `fetch()`, `XMLHttpRequest`, or any HTTP library. Validate that `requestUrl` supports PROPFIND and REPORT methods on mobile with a real CalDAV server in Phase 1 — if this doesn't work, the entire CalDAV plan is blocked.

5. **Timezone handling in iCalendar data** — events at wrong times destroy user trust immediately. Normalize ALL event times to UTC immediately upon parsing. Handle all-day events (DATE format, no timezone) as a distinct type. Test with Asia/Shanghai events from DingTalk. Delegate all RRULE expansion to `ical.js` — never implement custom recurrence math.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Infrastructure Validation
**Rationale:** Before writing any protocol or UI code, validate the most critical constraint: does `requestUrl` support PROPFIND/REPORT on Obsidian mobile? If not, the CalDAV architecture must change. Simultaneously establish the data model and skeleton that everything else depends on.
**Delivers:** Plugin loads successfully, shows empty calendar view, passes mobile `requestUrl` spike test, has settings page, defines the unified CalendarEvent type and EventStore with persistence.
**Addresses:** Table stakes — settings UI, plugin scaffold, offline cache foundation
**Avoids:** Pitfall #4 (CORS/mobile) by validating early; Pitfall #8 (lifecycle leaks) by using Obsidian registration APIs from day one

### Phase 2: ICS Feed Import and Basic Calendar Views
**Rationale:** ICS is the simplest source (fetch a URL, parse text, no auth). It proves the complete data pipeline — adapter → EventStore → CalendarView — before tackling auth-heavy sources. Build all three calendar views against real ICS data so the rendering is validated.
**Delivers:** Working month/week/day views with real events from ICS feeds. Users can see holiday calendars, sports schedules, university timetables.
**Uses:** ical.js for ICS parsing, date-fns + date-fns-tz for timezone normalization, custom DOM rendering with CSS Grid
**Implements:** ICSSource adapter, SyncEngine, CalendarView (Month/Week/Day), NavigationBar, EventBlock components
**Avoids:** Pitfall #5 (timezone) by normalizing to UTC in the ICS adapter from the start; Pitfall #13 (CJK encoding) by checking Content-Type charset

### Phase 3: CalDAV Integration (DingTalk First)
**Rationale:** This is the core reason the plugin exists. The architecture is proven by Phase 2 — now add the hardest source. Build a custom CalDAV client using `requestUrl` + `DOMParser`. Target DingTalk as the acceptance test, not a stretch goal.
**Delivers:** DingTalk calendar events appearing alongside ICS events. CalDAV compatibility with Nextcloud, Radicale, iCloud, Fastmail as secondary targets.
**Uses:** Custom CalDAV client (PROPFIND + calendar-query REPORT); lenient XML response parsing; per-provider profiles for discovery quirks
**Implements:** CalDAVSource adapter, BasicAuthHandler, caldav-xml.ts utilities, provider profile system
**Avoids:** Pitfall #1 (discovery non-standardization) via multi-strategy pipeline; Pitfall #2 (DingTalk quirks) via DingTalk-first testing and lenient parsing; Pitfall #9 (bundle size) via native DOMParser instead of bundled XML library

### Phase 4: Google Calendar Integration
**Rationale:** Broadest appeal after CalDAV. OAuth2 is the most complex auth flow — tackle it after the architecture is proven and CalDAV is shipping.
**Delivers:** Google Calendar events in the unified view. Complete multi-source aggregation (ICS + CalDAV + Google = full feature set).
**Uses:** Direct Google Calendar REST API v3 via requestUrl; custom OAuth2 client; localStorage for token storage
**Implements:** GoogleCalendarSource adapter, GoogleAuthHandler (OAuth2 + token refresh + mobile redirect), event deduplication by UID
**Avoids:** Pitfall #3 (OAuth lifecycle) via proactive refresh and localStorage; Pitfall #7 (deduplication) via UID-based merge logic; Pitfall #6 (rate limiting) via syncToken incremental sync

### Phase 5: Polish and Production Readiness
**Rationale:** With all three sources working, focus on the user experience quality that is UniCalendar's primary differentiator: the Apple Calendar-inspired aesthetics and smooth interactions.
**Delivers:** Production-quality UI with Apple Calendar aesthetics, smooth view transitions, per-source toggles, smart sync scheduling, mini sidebar widget, event search.
**Addresses:** All differentiator features; color palette system; loading/sync status indicators; error handling UI; performance for high event counts
**Avoids:** Pitfall #12 (color conflicts) via pre-assigned 8-10 color palette with CSS custom properties; Pitfall #14 (rendering performance) via debounced updates and event density limits in month view

### Phase Ordering Rationale

- **Data model before protocol:** CalendarEvent type and EventStore come first because every adapter, view, and sync operation depends on them. Getting this wrong means rewriting everything.
- **ICS before CalDAV:** Proves the adapter-to-store-to-view pipeline without auth complexity. Real event data to iterate rendering against from day 2.
- **CalDAV before Google:** CalDAV is the motivating use case and has more protocol complexity than Google (custom XML vs standard REST). Better to tackle protocol complexity while the codebase is still small.
- **OAuth last among sources:** Google OAuth2 is the most complex auth flow. Delay it until the architecture is proven stable.
- **Polish last:** UI refinement has no blockers and is easiest to scope-adjust if earlier phases run long.
- **Mobile validation in Phase 1:** The `requestUrl` + PROPFIND spike must happen before committing to the CalDAV architecture. If mobile has limitations, the plan changes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (CalDAV):** DingTalk-specific endpoint documentation, authentication method (Basic vs OAuth2 vs app token), and actual PROPFIND/REPORT response format need validation against a real DingTalk account before code is written.
- **Phase 4 (Google):** OAuth2 mobile flow via `obsidian://` URI scheme needs verification — the redirect handling pattern needs confirmation against current Obsidian API behavior.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Obsidian plugin lifecycle, ItemView, EventStore, and saveData/loadData are well-documented API patterns with established precedent.
- **Phase 2 (ICS):** ical.js is mature and well-documented. ICS feed import is a solved problem.
- **Phase 5 (Polish):** CSS Grid calendar layout, color systems, and CSS custom properties are standard web techniques.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (requestUrl, ical.js, custom CalDAV client, custom UI) are HIGH confidence. tsdav was rejected due to mobile bundling risk (validated reasoning). date-fns versions need npm verification. |
| Features | MEDIUM | Table stakes and anti-features are clear. Competitor analysis (Full Calendar, LifeOS) based on training data through early 2025 — current plugin state should be verified. |
| Architecture | MEDIUM-HIGH | Adapter pattern, ItemView, EventStore + Events mixin, requestUrl are all HIGH confidence (documented Obsidian API patterns). CalDAV custom implementation feasibility is MEDIUM (doable but DingTalk quirks unknown until tested). |
| Pitfalls | MEDIUM-HIGH | Most pitfalls (#1, #3, #4, #5, #6, #7, #8, #9) are HIGH confidence — well-documented in CalDAV client development and Obsidian plugin development. Pitfall #2 (DingTalk specifics) is MEDIUM — known to be problematic but exact failure modes unverified. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **DingTalk CalDAV specifics:** The exact authentication method (Basic Auth vs OAuth2 vs DingTalk app token) and the specific XML deviations are unknown until tested against a real DingTalk endpoint. This must be validated in a Phase 3 spike before writing the full CalDAV adapter. If DingTalk's CalDAV is too broken, the fallback is DingTalk's native Open Platform REST API.
- **tsdav mobile bundling:** If tsdav is reconsidered later, its bundling behavior with Obsidian's esbuild config (CJS output, Node builtins externalized) must be tested before committing to it. The research recommends a custom implementation to avoid this risk entirely.
- **OAuth2 mobile redirect:** The `obsidian://` protocol handler for OAuth2 callback on mobile is documented in concept but needs a proof-of-concept spike. The alternative (manual auth code paste) is a viable fallback for v1.
- **Competitor current state:** Full Calendar and LifeOS plugin states are based on training data through early 2025. Their current versions and feature sets should be checked on the Obsidian plugin marketplace before launch to ensure differentiation claims are current.

## Sources

### Primary (HIGH confidence)
- Obsidian Plugin API (developer.obsidian.md) — ItemView, requestUrl, Events class, plugin lifecycle, saveData/loadData
- esbuild.config.mjs in this repository — confirmed CJS output format, ES2018 target, Node builtins externalized
- Google Calendar API v3 REST documentation — stable, versioned API
- RFC 4791 (CalDAV), RFC 5545 (iCalendar), RFC 6764 (CalDAV discovery) — protocol specifications

### Secondary (MEDIUM confidence)
- tsdav npm/GitHub — TypeScript CalDAV client; mobile bundling risk is inferred from esbuild constraints, not tested
- ical.js / Mozilla Lightning project — pure-JS iCalendar parser; training data, version needs verification
- obsidian-full-calendar plugin — established architectural patterns for calendar + external sync in Obsidian
- Training data knowledge of Obsidian plugin ecosystem (Full Calendar, LifeOS) through early 2025

### Tertiary (LOW confidence / needs validation)
- DingTalk CalDAV specifics — known to be non-standard (per PROJECT.md and Full Calendar issue reports), specific failure modes unverified; needs real-world testing
- Obsidian mobile OAuth2 redirect flow — feasible via obsidian:// protocol handler, but needs proof-of-concept validation

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*

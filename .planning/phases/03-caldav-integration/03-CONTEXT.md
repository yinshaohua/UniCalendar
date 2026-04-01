# Phase 3: CalDAV Integration - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can connect CalDAV calendar servers — especially DingTalk — and see those events alongside ICS feed events. This phase delivers CalDAV protocol implementation (PROPFIND, REPORT), calendar auto-discovery, Basic Auth, and wiring into the existing SyncManager/EventStore/CalendarView pipeline. Google Calendar OAuth2 is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### CalDAV Protocol Implementation
- **D-01:** Self-implement CalDAV protocol using Obsidian `requestUrl` + hand-crafted XML. No external CalDAV library. ICS response parsing reuses existing ical.js. Zero new dependencies.
- **D-02:** DingTalk CalDAV server: `https://calendar.dingtalk.com`, Basic Auth with app-specific username/password. Standard CalDAV protocol. Researcher should verify PROPFIND/REPORT response format against this endpoint.

### Calendar Discovery Flow
- **D-03:** Auto-discover + user selection. After connecting, PROPFIND discovers all available calendars. User picks which to sync. Each discovered calendar becomes an independent source with its own color.
- Settings UI needs a "discover calendars" step after entering server URL + credentials, showing a list with checkboxes.

### Credential Storage
- **D-04:** Plain text storage in Obsidian data.json. Standard Obsidian plugin practice. No encryption layer.

### Claude's Discretion
- CalDAV XML request/response format details
- PROPFIND depth and property selection
- Error handling for CalDAV-specific errors (401, 403, 404, 207 multi-status)
- Calendar discovery UI layout within the existing AddSourceModal
- How to handle CalDAV servers that don't support calendar auto-discovery
- Sync range strategy (reuse Phase 2's ±3 month range)
- Rate limiting or request throttling for CalDAV servers

</decisions>

<specifics>
## Specific Ideas

- DingTalk CalDAV credentials (for testing): server `https://calendar.dingtalk.com`, user `u_j05r8tal`, password `v07f3i4y`
- The existing CalDAV source settings UI (server URL, username, password, calendar path) already exists from Phase 1 — needs extension for calendar discovery flow
- Should feel seamless: user enters credentials → discovers calendars → picks ones to sync → events appear in existing views

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing sync infrastructure
- `src/sync/SyncManager.ts` — Sync orchestration pattern, how ICS adapter is wired
- `src/sync/IcsSyncAdapter.ts` — Reference pattern for building CalDAV adapter
- `src/store/EventStore.ts` — `replaceEvents()` and `removeOrphanedEvents()` APIs

### Types and settings
- `src/models/types.ts` — `CalendarSource.caldav` field definition, `CalendarEvent` interface
- `src/settings/SettingsTab.ts` — Existing CalDAV form fields in AddSourceModal/EditSourceModal

### Phase 2 context (reusable patterns)
- `.planning/phases/02-ics-feeds-and-calendar-views/02-CONTEXT.md` — ICS parsing decisions that carry forward

### CalDAV protocol
- No external specs in repo — researcher should reference RFC 4791 (CalDAV) and RFC 6764 (DNS-based service discovery)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IcsSyncAdapter` — Pattern for sync adapters: `sync(source, rangeStart, rangeEnd) → CalendarEvent[]`
- `ical.js` — Already bundled, can parse VEVENT responses from CalDAV REPORT queries
- `EventStore.replaceEvents(sourceId, events)` — Ready to receive CalDAV events
- `EventStore.removeOrphanedEvents(validSourceIds)` — Cleans up deleted sources
- `requestUrl` from Obsidian — HTTP client that works on both desktop and mobile

### Established Patterns
- SyncManager dispatches by `source.type` — add `case 'caldav'` alongside existing `case 'ics'`
- CalendarSource already has `caldav` variant with serverUrl, username, password, calendarPath
- Settings UI already has CalDAV form fields — needs calendar discovery extension

### Integration Points
- `SyncManager.syncAll()` → new CalDavSyncAdapter
- `SettingsTab.AddSourceModal` → extend with calendar discovery step
- `CalendarSource.caldav` type → may need `discoveredCalendars` field for multi-calendar

</code_context>

<deferred>
## Deferred Ideas

- CalDAV write support (create/edit/delete events) — out of project scope (read-only)
- Calendar sharing/delegation — not in scope
- CalDAV sync-token for incremental sync — potential future optimization

</deferred>

---

*Phase: 03-caldav-integration*
*Context gathered: 2026-04-01*

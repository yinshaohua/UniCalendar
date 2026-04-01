# Phase 4: Google Calendar and Multi-Source Unification - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can connect Google Calendar via OAuth2 and see events from all three source types (ICS, CalDAV, Google) merged into one unified view with intelligent deduplication. This phase delivers Google OAuth2 authentication flow, Google Calendar REST API integration, token management, multi-source event merging, and smart deduplication. Apple Calendar UI polish is Phase 5.

</domain>

<decisions>
## Implementation Decisions

### OAuth2 Authentication Flow
- **D-01:** Browser-based authorization with manual code paste. Open system browser to Google OAuth consent page, user authorizes, copies authorization code back into Obsidian input field. Works on both desktop and mobile.
- **D-02:** Client ID/Secret provided by user (create their own OAuth app in Google Cloud Console), with the architecture supporting built-in credentials in the future. Settings UI should have fields for Client ID and Client Secret alongside the authorization flow.

### Token Management
- **D-03:** Access token, refresh token, and expiry timestamp stored in data.json alongside other settings. Consistent with Phase 3's plain text credential storage approach.
- **D-04:** Token auto-refresh before expiry on each sync cycle. When refresh token is invalid/expired, show error in sync status indicator prompting user to re-authorize (same error pattern as Phase 1/3).

### Google Calendar API Integration
- **D-05:** Direct REST API calls using Obsidian `requestUrl`. No googleapis library. Consistent with Phase 3's self-implementation approach for CalDAV. Zero new dependencies.
- **D-06:** Google Calendar API endpoints: `calendarList.list` for discovery, `events.list` for fetching events with `timeMin`/`timeMax` parameters matching the existing ±3 month sync range.
- **D-07:** Calendar discovery follows the same pattern as CalDAV (Phase 3): after OAuth authorization, auto-discover all calendars, user picks which to sync. Each selected calendar becomes an independent source with its own color.

### Multi-Source Event Deduplication
- **D-08:** Smart deduplication using UID-first matching with time+title fallback. CalendarEvent model needs a `uid` field (the raw iCalendar UID or Google event ID). Deduplication runs at render time, not at storage time — each source stores its own events independently.
- **D-09:** Deduplication priority: first source added wins (keeps the event from the earliest-added source). Duplicates from later sources are hidden but not deleted from cache.
- **D-10:** UID matching: exact string match on the iCalendar UID / Google event ID. Fallback: exact match on `start` time + normalized `title` (trimmed, case-insensitive).

### Claude's Discretion
- OAuth2 PKCE implementation details
- Google API error handling and rate limiting
- Token refresh timing strategy (proactive vs on-demand)
- CalendarEvent `uid` field storage and extraction from each source type
- Deduplication performance optimization for large event sets
- Google Calendar API pagination handling
- Settings UI layout for Google auth flow (button placement, status display)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing sync infrastructure
- `src/sync/SyncManager.ts` — Sync orchestration, add `case 'google'` branch alongside ICS and CalDAV
- `src/sync/IcsSyncAdapter.ts` — Reference pattern for sync adapter interface
- `src/sync/CalDavSyncAdapter.ts` — Reference pattern for auth + API calls + event parsing
- `src/store/EventStore.ts` — `replaceEvents()` and `removeOrphanedEvents()` APIs

### Types and settings
- `src/models/types.ts` — `CalendarSource.google` already defined with `clientId`/`clientSecret`, needs token fields; `CalendarEvent` needs `uid` field for dedup
- `src/settings/SettingsTab.ts` — Existing source management UI, Google form fields need OAuth flow extension

### Prior phase context
- `.planning/phases/03-caldav-integration/03-CONTEXT.md` — CalDAV discovery pattern to replicate for Google
- `.planning/phases/02-ics-feeds-and-calendar-views/02-CONTEXT.md` — ICS parsing and ical.js usage

### Google Calendar API
- No external specs in repo — researcher should reference Google Calendar API v3 REST documentation for `calendarList.list` and `events.list` endpoints, OAuth2 for installed/desktop applications flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncManager` — Ready for Google adapter, just add `case 'google'` in `syncAll()`
- `IcsSyncAdapter` / `CalDavSyncAdapter` — Pattern for building GoogleSyncAdapter: `sync(source, rangeStart, rangeEnd) → CalendarEvent[]`
- `requestUrl` from Obsidian — HTTP client for Google API calls (same as CalDAV)
- `ical.js` — Already bundled, can parse Google Calendar ICS export if needed as fallback
- `EventStore.replaceEvents(sourceId, events)` — Ready to receive Google events
- Settings UI `AddSourceModal` / `EditSourceModal` — Extend for Google OAuth flow

### Established Patterns
- SyncManager dispatches by `source.type` — add `case 'google'`
- `CalendarSource.google` type already exists with `clientId`/`clientSecret` fields
- CalDAV calendar discovery modal pattern (Phase 3) — reuse for Google calendar selection
- Chinese locale for all UI strings

### Integration Points
- `SyncManager.syncAll()` → new `GoogleSyncAdapter`
- `CalendarSource.google` type → extend with `accessToken`, `refreshToken`, `tokenExpiry` fields
- `CalendarEvent` type → add optional `uid` field for deduplication
- `EventStore` or `CalendarView` → deduplication logic at render time
- Settings UI → Google OAuth authorization button and status

</code_context>

<specifics>
## Specific Ideas

- OAuth flow should feel similar to CalDAV discovery: user enters credentials → authorizes → discovers calendars → picks ones to sync → events appear
- Deduplication should be invisible to the user — no UI for managing duplicates, just smart matching behind the scenes
- The `uid` field should be extracted from iCalendar UID for ICS/CalDAV sources and from Google event ID for Google sources

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-google-calendar-and-multi-source-unification*
*Context gathered: 2026-04-02*

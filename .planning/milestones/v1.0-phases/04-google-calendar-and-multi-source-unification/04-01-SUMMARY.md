---
phase: 04-google-calendar-and-multi-source-unification
plan: 01
subsystem: sync
tags: [oauth2, pkce, google-calendar, api-client, typescript]

requires:
  - phase: 03-caldav-integration
    provides: "IcsSyncAdapter pattern, CalendarEvent/CalendarSource types, obsidian mock"
provides:
  - "GoogleAuthHelper: OAuth2 PKCE flow, token exchange, token refresh, auto-refresh"
  - "GoogleSyncAdapter: Google Calendar API client with discovery and event fetching"
  - "Extended CalendarEvent with uid field for cross-source dedup"
  - "Extended CalendarSource.google with token, calendar selection, and redirect fields"
affects: [04-02-settings-ui, 04-03-oauth-callback, 04-04-sync-integration]

tech-stack:
  added: [Web Crypto API (PKCE), Google Calendar API v3]
  patterns: [OAuth2 PKCE flow, token auto-refresh with buffer, paginated API fetching]

key-files:
  created:
    - src/sync/GoogleAuthHelper.ts
    - src/sync/GoogleSyncAdapter.ts
    - tests/sync/GoogleAuthHelper.test.ts
    - tests/sync/GoogleSyncAdapter.test.ts
  modified:
    - src/models/types.ts
    - tests/mocks/obsidian.ts

key-decisions:
  - "Use Web Crypto API (crypto.subtle + crypto.getRandomValues) for PKCE instead of Node crypto for mobile compatibility"
  - "Token refresh preserves existing refreshToken (Google does not always return new one)"
  - "5-minute buffer for token expiry to prevent mid-request failures"
  - "iCalUID preferred over event.id for uid field to enable cross-source dedup"

patterns-established:
  - "OAuth2 PKCE: generateCodeVerifier -> generateCodeChallenge -> buildAuthUrl -> exchangeCode -> refreshAccessToken"
  - "Google API pagination: do/while loop with nextPageToken"
  - "Token auto-refresh: ensureValidToken checks expiry buffer, refreshes in-place on source object"
  - "vi.fn()-based obsidian mock: requestUrl as vi.fn() for per-test override"

requirements-completed: [SYNC-01]

duration: 4min
completed: 2026-04-02
---

# Phase 04 Plan 01: Google OAuth2 Auth Helper and Sync Adapter Summary

**OAuth2 PKCE authentication helper and Google Calendar API sync adapter with 17 passing tests covering auth URL construction, token lifecycle, calendar discovery, event fetching with pagination, and all-day/timed event mapping.**

## What Was Built

### GoogleAuthHelper (src/sync/GoogleAuthHelper.ts)
- `generateCodeVerifier()` -- 32-byte random base64url string (43+ chars)
- `generateCodeChallenge()` -- SHA-256 hash via Web Crypto API
- `buildAuthUrl()` -- Full Google OAuth2 URL with PKCE S256 challenge
- `exchangeCode()` -- POST to token endpoint with authorization_code grant
- `refreshAccessToken()` -- POST with refresh_token grant, Chinese error on failure
- `ensureValidToken()` -- Auto-refresh with 5-minute buffer, in-place update

### GoogleSyncAdapter (src/sync/GoogleSyncAdapter.ts)
- `discoverCalendars()` -- GET calendarList API, returns GoogleCalendarEntry[]
- `sync()` -- Validates config, ensures token, fetches events
- `fetchEvents()` -- Paginated GET with singleEvents=true, orderBy=startTime, maxResults=2500
- `toCalendarEvent()` -- Maps Google events to CalendarEvent with UTC normalization and uid extraction

### Type Extensions (src/models/types.ts)
- `CalendarEvent.uid` -- iCalendar UID or Google event ID for cross-source dedup
- `CalendarSource.google` -- Extended with accessToken, refreshToken, tokenExpiry, calendarId, calendarName, redirectUri

### Mock Updates (tests/mocks/obsidian.ts)
- `requestUrl` changed from plain function to `vi.fn()` for per-test mocking
- Added `Platform` mock object

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| GoogleAuthHelper.test.ts | 8 | All pass |
| GoogleSyncAdapter.test.ts | 9 | All pass |
| All existing tests | 26 | No regressions |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 72d1bfa | feat(04-01): add GoogleAuthHelper with OAuth2 PKCE and extend types |
| 2 | a056ef0 | feat(04-01): add GoogleSyncAdapter with calendar discovery and event fetching |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all methods are fully implemented with real logic.

## Self-Check: PASSED

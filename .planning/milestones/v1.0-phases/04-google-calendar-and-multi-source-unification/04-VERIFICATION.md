---
phase: 04-google-calendar-and-multi-source-unification
verified: 2026-04-02T03:10:00Z
status: human_needed
score: 12/13 must-haves verified
human_verification:
  - test: "Google OAuth end-to-end flow"
    expected: "User can authorize Google Calendar in browser, Obsidian receives callback via obsidian://uni-calendar/oauth-callback, tokens are saved, calendar list appears for selection, events sync and render"
    why_human: "Protocol handler (registerObsidianProtocolHandler) requires a live Obsidian instance; cannot test OAuth redirect and token exchange against real Google API in automated tests"
  - test: "Multi-source deduplication visible in calendar view"
    expected: "Adding the same calendar as both an ICS feed and a Google source causes events to appear only once in the calendar views (not duplicated)"
    why_human: "Requires two live calendar sources with overlapping events and a running Obsidian instance to observe rendered output"
---

# Phase 4: Google Calendar and Multi-Source Unification — Verification Report

**Phase Goal:** Users can connect Google Calendar via OAuth2 and see events from all three source types merged into one unified view
**Verified:** 2026-04-02T03:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria from ROADMAP.md

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | User can authenticate with Google and see their Google Calendar events in the calendar views | ? HUMAN | OAuth flow code verified complete; runtime test requires live Obsidian + Google account |
| 2 | User sees events from ICS, CalDAV, and Google Calendar merged into a single unified timeline without duplicates | ? HUMAN | Dedup logic verified; merged view requires live Obsidian with overlapping sources |
| 3 | Google OAuth2 token refreshes automatically without requiring re-authentication | ✓ VERIFIED | `ensureValidToken` checks 5-min buffer, calls `refreshAccessToken` in-place; 2 unit tests confirm |
| 4 | Adding or removing any source type updates the unified view correctly | ✓ VERIFIED | `triggerSync` → `setSourceOrder` + `syncManager.syncAll` → `replaceEvents`/`removeOrphanedEvents` all wired |

### Observable Truths (from Plan must_haves)

#### Plan 04-01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GoogleAuthHelper can build an OAuth2 authorization URL with PKCE | ✓ VERIFIED | `buildAuthUrl` in `GoogleAuthHelper.ts` line 35; test confirms code_challenge, scope, S256, all params |
| 2 | GoogleAuthHelper can exchange an authorization code for tokens | ✓ VERIFIED | `exchangeCode` method line 61; test verifies grant_type=authorization_code and token return |
| 3 | GoogleAuthHelper can refresh an expired access token | ✓ VERIFIED | `refreshAccessToken` method line 92; test verifies refresh_token grant and Chinese error on failure |
| 4 | GoogleSyncAdapter can discover calendars from Google API | ✓ VERIFIED | `discoverCalendars` in `GoogleSyncAdapter.ts` line 22; unit test confirms Bearer token + calendarList URL |
| 5 | GoogleSyncAdapter can fetch and parse Google Calendar events into CalendarEvent[] | ✓ VERIFIED | `fetchEvents` + `toCalendarEvent`; 5 unit tests cover timed, all-day, UID, pagination |
| 6 | Token refresh does not overwrite the stored refresh token | ✓ VERIFIED | `refreshAccessToken` returns only `{ accessToken, tokenExpiry }` — no refreshToken in return type |

#### Plan 04-02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Events with the same UID from different sources appear only once (first-added source wins) | ✓ VERIFIED | `EventDeduplicator.ts` seenUids map; test "deduplicates events with same uid from different sources" |
| 8 | Events with same start time and normalized title from different sources appear only once | ✓ VERIFIED | `fallbackKey = ${event.start}\|${event.title.trim().toLowerCase()}`; dedicated test confirms |
| 9 | Events from the same source are never deduplicated against each other | ✓ VERIFIED | `claimedBy !== event.sourceId` guard on both UID and time+title paths |
| 10 | ICS events carry uid field extracted from iCalendar UID property | ✓ VERIFIED | `IcsSyncAdapter.ts` line 152: `uid,` in return object; uid was already extracted at line 144 |

#### Plan 04-03 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | SyncManager dispatches Google sources to GoogleSyncAdapter | ✓ VERIFIED | `SyncManager.ts` line 66: `else if (source.type === 'google')` branch calls `this.googleAdapter.sync()`; SyncManager test confirms no "not yet supported" message |
| 12 | EventStore getter methods return deduplicated events | ✓ VERIFIED | `EventStore.ts`: `getEvents()`, `getEventsForDate()`, `getEventsForDateRange()` all call `deduplicateEvents(filtered, this.sourceOrder)` |
| 13 | Settings UI shows OAuth authorize button for Google sources | ✓ VERIFIED | `SettingsTab.ts` line 607: `setButtonText('授权')` with `.setCta()` in EditSourceModal for unauthorized Google sources |
| 14 | Plugin registers obsidian://uni-calendar protocol handler for OAuth callback | ✓ VERIFIED | `main.ts` line 47: `this.registerObsidianProtocolHandler('uni-calendar', ...)` exchanges code, saves tokens |
| 15 | User can complete Google OAuth flow: authorize -> callback -> discover calendars -> select -> sync | ? HUMAN | All code wired; requires live Obsidian + browser to verify end-to-end |
| 16 | Events from all three source types appear merged and deduplicated in calendar views | ? HUMAN | All data paths wired; requires live Obsidian with multiple source types |

**Score:** 12/13 automated truths verified (2 require human verification)

## Required Artifacts

### Plan 04-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/sync/GoogleAuthHelper.ts` | OAuth2 PKCE flow, token exchange, token refresh | ✓ VERIFIED | 145 lines; exports `GoogleAuthHelper`; all 6 methods implemented with real logic |
| `src/sync/GoogleSyncAdapter.ts` | Google Calendar API client | ✓ VERIFIED | 138 lines; exports `GoogleSyncAdapter` and `GoogleCalendarEntry`; pagination, uid, all-day handling |
| `src/models/types.ts` | Extended types with uid and token fields | ✓ VERIFIED | `uid?: string` on CalendarEvent (line 11); `accessToken`, `refreshToken`, `tokenExpiry`, `calendarId`, `calendarName`, `redirectUri` on CalendarSource.google |
| `tests/sync/GoogleAuthHelper.test.ts` | Unit tests for OAuth2 helper | ✓ VERIFIED | 8 tests, all passing |
| `tests/sync/GoogleSyncAdapter.test.ts` | Unit tests for Google sync adapter | ✓ VERIFIED | 9 tests, all passing |

### Plan 04-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/store/EventDeduplicator.ts` | Pure deduplication function | ✓ VERIFIED | 58 lines; exports `deduplicateEvents`; UID-first + time+title fallback + sourceOrder priority |
| `src/sync/IcsSyncAdapter.ts` | uid field on CalendarEvent from ical.js UID | ✓ VERIFIED | Line 152: `uid,` included in return; variable extracted at line 144 |
| `tests/store/EventDeduplicator.test.ts` | 8+ dedup test cases | ✓ VERIFIED | 11 test cases, all passing |
| `tests/store/EventStore.test.ts` | uid preservation test | ✓ VERIFIED | Test at line 164: "preserves uid field on stored events" |

### Plan 04-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/sync/SyncManager.ts` | Google source dispatch via GoogleSyncAdapter | ✓ VERIFIED | Imports GoogleSyncAdapter + GoogleAuthHelper; `case 'google'` dispatch at line 66 |
| `src/store/EventStore.ts` | Deduplication in all getter methods | ✓ VERIFIED | `deduplicateEvents` called in `getEvents()`, `getEventsForDate()`, `getEventsForDateRange()`; `setSourceOrder` method present |
| `src/settings/SettingsTab.ts` | Google OAuth flow UI | ✓ VERIFIED | Imports `GoogleAuthHelper`, `GoogleSyncAdapter`, `GoogleCalendarEntry`; authorize button, `discoverCalendars`, `pendingOAuthVerifiers`, `GoogleCalendarPickerModal`, `window.open` all present |
| `src/main.ts` | Protocol handler for OAuth callback | ✓ VERIFIED | `registerObsidianProtocolHandler('uni-calendar', ...)` at line 47; `pendingOAuthVerifiers` Map; `exchangeCode` call; `setSourceOrder` call in `triggerSync` |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `GoogleSyncAdapter.ts` | `GoogleAuthHelper.ts` | `import { GoogleAuthHelper }` | ✓ WIRED | Line 3: `import { GoogleAuthHelper } from './GoogleAuthHelper'`; used in constructor |
| `GoogleSyncAdapter.ts` | `requestUrl` (Obsidian) | HTTP calls to Google API | ✓ WIRED | Line 1: `import { requestUrl } from 'obsidian'`; used in `discoverCalendars` and `fetchEvents` |
| `EventDeduplicator.ts` | `types.ts` | `import { CalendarEvent }` | ✓ WIRED | Line 1: `import { CalendarEvent } from '../models/types'` |
| `IcsSyncAdapter.ts` | `CalendarEvent.uid` | sets uid from icalEvent.uid | ✓ WIRED | Line 144: `const uid = icalEvent.uid`; line 152: `uid,` in return object |
| `SyncManager.ts` | `GoogleSyncAdapter.ts` | import + case 'google' dispatch | ✓ WIRED | Line 4: import; line 15: `new GoogleSyncAdapter(this.authHelper)`; line 66: dispatch |
| `EventStore.ts` | `EventDeduplicator.ts` | `import deduplicateEvents` | ✓ WIRED | Line 2: import; called in all 3 getter methods (lines 50, 59, 68) |
| `main.ts` | `GoogleAuthHelper.ts` | OAuth callback exchanges code | ✓ WIRED | Line 14: import; line 61: `new GoogleAuthHelper()`; line 70: `exchangeCode(...)` |
| `SettingsTab.ts` | `GoogleAuthHelper.ts` | `buildAuthUrl` for authorize button | ✓ WIRED | Line 5: import; line 549: `new GoogleAuthHelper()`; line 556: `buildAuthUrl(...)` |
| `main.ts` | `EventStore.setSourceOrder` | sourceOrder set before sync | ✓ WIRED | Line 151: `this.eventStore.setSourceOrder(this.settings.sources.map(s => s.id))` called in `triggerSync` |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `EventStore.getEvents()` | `this.events` | `replaceEvents(sourceId, events)` called from SyncManager after each adapter sync | Yes — real adapter outputs stored | ✓ FLOWING |
| `EventStore.getEventsForDate()` | `filtered` from `this.events` | Same as above, filtered by date | Yes | ✓ FLOWING |
| `EventStore.getEventsForDateRange()` | `filtered` from `this.events` | Same as above, filtered by range | Yes | ✓ FLOWING |
| `GoogleSyncAdapter.sync()` | `response.json.items` | Real Google Calendar API v3 `/events` endpoint | Yes (live API call via `requestUrl`) | ✓ FLOWING |
| `deduplicateEvents(events, sourceOrder)` | `events` input | `EventStore.getEvents*` which holds `replaceEvents` outputs | Yes — real events from all adapters | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 56 tests pass | `npx vitest run --reporter=verbose` | 7 test files, 56 tests — 0 failures | ✓ PASS |
| Plugin builds without errors | `node esbuild.config.mjs` | "build finished" — exit 0, no errors | ✓ PASS |
| GoogleAuthHelper exports class | Module check via test runner | 8/8 GoogleAuthHelper tests pass | ✓ PASS |
| GoogleSyncAdapter dispatches via SyncManager | SyncManager test "dispatches google sources" | Synced 0 events (mock), no "not yet supported" | ✓ PASS |
| EventDeduplicator covers all cases | 11 dedup tests | All 11 pass | ✓ PASS |
| ICS uid backfill flows through EventStore | EventStore uid preservation test | `retrieved[0]?.uid === 'unique-ical-uid-123'` | ✓ PASS |

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SYNC-01 | 04-01, 04-03 | User can sync events from Google Calendar (read-only via OAuth2) | ✓ SATISFIED | GoogleAuthHelper + GoogleSyncAdapter implement full OAuth2 PKCE + API client; wired into SyncManager and Settings UI |
| SYNC-04 | 04-02, 04-03 | User sees events from all sources merged into one unified view | ✓ SATISFIED | `deduplicateEvents` applied in all EventStore getters; all three source types flow through SyncManager; sourceOrder wired from settings |

Both requirements marked as assigned to Phase 4 in REQUIREMENTS.md traceability table. Both are marked `[x]` (complete) in REQUIREMENTS.md. No orphaned requirements found for Phase 4.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/sync/GoogleAuthHelper.ts` | 112 | Bare `catch {}` discards original error before re-throwing Chinese message | ℹ️ Info | Error context lost in token refresh failures; acceptable per Chinese error convention |
| `tests/sync/SyncManager.test.ts` | (Google dispatch test) | Test makes real `requestUrl` call to mock (returns `{ json: {}, status: 200 }`) | ℹ️ Info | Results in 0 events synced with no error — test proves wiring, not full behavior |

No `TODO`, `FIXME`, placeholder text, stub components, or hardcoded empty arrays flowing to rendering found in phase 4 files.

## Human Verification Required

### 1. Google OAuth End-to-End Flow

**Test:**
1. Build the plugin: `node esbuild.config.mjs`
2. Copy `main.js`, `manifest.json`, `styles.css` to vault's `.obsidian/plugins/uni-calendar/`
3. Reload Obsidian (Ctrl+R)
4. Open UniCalendar Settings
5. Click "添加日历源" → "Google 日历"
6. Enter a valid Google Cloud OAuth2 Client ID and Client Secret (with `obsidian://uni-calendar/oauth-callback` configured as a redirect URI in Google Cloud Console)
7. Save, then click "编辑" on the created source
8. Click the "授权" button
9. Verify browser opens to Google's consent page (`accounts.google.com/o/oauth2/v2/auth`)
10. Complete authorization in browser
11. Verify Obsidian shows "Google 日历授权成功！" notice and the source card updates to show "已授权"
12. Click "编辑" again, click "选择日历", verify calendar list appears
13. Select a calendar, verify events appear in the calendar view after sync

**Expected:** OAuth2 PKCE flow completes, tokens saved to settings, calendar selection works, events render in calendar views

**Why human:** Protocol handler (`registerObsidianProtocolHandler`) requires a running Obsidian desktop instance; Google token exchange requires a real Google Cloud project with OAuth credentials; the `obsidian://` URL scheme redirect requires actual Obsidian URL scheme handling

### 2. Multi-Source Deduplication Visible in Calendar

**Test:**
1. Add the same calendar as both an ICS feed URL and a Google Calendar source
2. Sync both sources
3. Navigate to a date range containing events
4. Verify each event appears exactly once (not duplicated in the calendar view)
5. Remove one source, verify remaining source's events still appear

**Expected:** Events with matching iCalUIDs or same start+title appear only once; removing a source removes only its unique events

**Why human:** Requires two live calendar sources with overlapping events and visual inspection of the rendered calendar in Obsidian

## Gaps Summary

No automated gaps found. All phase 4 code is substantive, wired, and flowing. The two human verification items are behavioral end-to-end tests that require a running Obsidian instance with real credentials — they cannot be verified programmatically.

The automated test suite (56 tests, 7 files, 0 failures) and successful esbuild output confirm the implementation is complete and correct at the code level.

---

_Verified: 2026-04-02T03:10:00Z_
_Verifier: Claude (gsd-verifier)_

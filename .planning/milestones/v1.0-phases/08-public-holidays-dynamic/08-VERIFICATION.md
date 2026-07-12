---
phase: 08-public-holidays-dynamic
verified: 2026-04-05T22:16:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 8: 法定假日的动态获取 — Verification Report

**Phase Goal:** Implement dynamic public holiday data from NateScarlet/holiday-cn with cache and static fallback
**Verified:** 2026-04-05T22:16:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Roadmap success criteria merged with plan frontmatter must-haves. No deduplication conflicts found (plan truths add specificity, no subtraction).

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Holiday data is fetched from NateScarlet/holiday-cn via jsdelivr CDN (with raw.githubusercontent.com fallback) | VERIFIED | `HolidayFetcher.ts` line 11: `HOLIDAY_CN_BASE_URL = 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master'`; line 12: `HOLIDAY_CN_FALLBACK_URL = 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master'`; CDN-first try/catch fallback in `fetchYear()` lines 23-27 |
| 2 | Fetched data covers current year + next year, cached in plugin data storage | VERIFIED | `main.ts` line 200: `this.holidayFetcher.fetchYears([currentYear, currentYear + 1])`; `types.ts` lines 61-69: `HolidayCache` interface in `UniCalendarData`; `main.ts` lines 89, 96: loaded and saved via `loadPluginData`/`savePluginData` |
| 3 | Update checks piggyback on calendar sync with 24-hour throttle | VERIFIED | `main.ts` line 126: `this.checkAndUpdateHolidays().catch(...)` called in `triggerSync()` after existing sync logic; lines 188-194: `TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000` throttle check; fire-and-forget pattern never blocks calendar sync |
| 4 | Dynamic data takes priority over chinese-days static data; fallback is seamless | VERIFIED | `HolidayService.ts` lines 43-54: `getHolidayInfo()` checks `this.dynamicData.get(dateStr)` first, only calls `getStaticHolidayInfo()` on miss; 6 new tests in `HolidayService.test.ts` lines 82-139 confirm priority and fallback |
| 5 | Fetch failures show Notice and continue with cache/static data | VERIFIED | `main.ts` line 218: `new Notice('节假日数据更新失败，将使用缓存数据')` in catch block; finally block (line 220) resets `isHolidayFetching`; no re-throw means calendar remains operational |
| 6 | getHolidayInfo() remains synchronous — CalendarView unchanged | VERIFIED | `HolidayService.ts` line 43: `getHolidayInfo(dateStr: string): HolidayInfo` — synchronous, no async/await; `CalendarView.ts` line 612: `holidayService = new HolidayService()` (visibility changed to public but interface calls at lines 979, 1102, 1198 unchanged) |
| 7 | HolidayFetcher can fetch and parse holiday-cn JSON for a given year | VERIFIED | `HolidayFetcher.ts` lines 20-38: `fetchYear()` parses JSON, validates structure, returns `Map<string, {name, isOffDay}>`; 4 `fetchYear` tests in `HolidayFetcher.test.ts` all pass |
| 8 | HolidayFetcher handles 404 gracefully without throwing | VERIFIED | `HolidayFetcher.ts` lines 47-58: `fetchYears()` wraps `fetchYear()` in try/catch, logs warning, silently skips failed years; test at line 100-107 confirms empty Map returned when both years 404 |
| 9 | Holiday data is cached in plugin data storage and survives Obsidian restart | VERIFIED | `types.ts` lines 55-69: `HolidayCacheEntry`, `HolidayCache` interfaces; `UniCalendarData` includes `holidayCache: HolidayCache`; `DEFAULT_HOLIDAY_CACHE` constant at line 110; `main.ts` Object.assign pattern in `loadPluginData` (line 89) provides safe defaults on restart |
| 10 | Concurrent fetch prevention via isHolidayFetching flag | VERIFIED | `main.ts` line 26: `private isHolidayFetching = false`; line 185: `if (this.isHolidayFetching) return;` guard; line 196: flag set; line 220 (finally): flag reset |
| 11 | HolidayService receives dynamic data on startup from cache and after fetch | VERIFIED | `main.ts` lines 52-53: `onLayoutReady` calls `loadHolidayDataIntoViews()` before `triggerSync()`; lines 174-181: `loadHolidayDataIntoViews()` iterates all CalendarView leaves and calls `holidayService.loadDynamicData(map)`; lines 211-212: same called after successful fetch |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lunar/HolidayFetcher.ts` | HTTP fetcher for holiday-cn JSON data | VERIFIED | 62 lines; exports `HolidayFetcher` class and `HolidayCnDay` interface; wired via import in `main.ts` line 13 and `index.ts` line 5 |
| `src/lunar/HolidayService.ts` | Refactored service with dynamic data priority + static fallback | VERIFIED | 87 lines; `private dynamicData: Map`; `loadDynamicData()` method; `dynamicData.get(dateStr)` in `getHolidayInfo()`; `private getStaticHolidayInfo()` fallback |
| `src/lunar/index.ts` | Re-exports HolidayFetcher and HolidayCnDay | VERIFIED | Lines 5-6: `export { HolidayFetcher }` and `export type { HolidayCnDay }` present |
| `src/models/types.ts` | HolidayCache interface and DEFAULT_HOLIDAY_CACHE | VERIFIED | Lines 55-69: `HolidayCacheEntry`, `HolidayCache` interfaces; line 66-70: `UniCalendarData.holidayCache`; lines 110-113: `DEFAULT_HOLIDAY_CACHE` |
| `src/main.ts` | Holiday fetch integration in plugin lifecycle | VERIFIED | Lines 24-26: fields; line 89: load; line 96: save; lines 126-128: triggerSync wiring; lines 164-221: helper methods |
| `src/views/CalendarView.ts` | holidayService accessible to plugin for dynamic data injection | VERIFIED | Line 612: `holidayService = new HolidayService()` — `private` keyword removed; used at lines 979, 1102, 1198 |
| `tests/lunar/HolidayFetcher.test.ts` | Unit tests for fetcher with mocked requestUrl | VERIFIED | 8 tests across 3 describe blocks; mocks `obsidian` module via vitest mock setup |
| `tests/lunar/HolidayService.test.ts` | Extended tests for dynamic-first + fallback logic | VERIFIED | 16 total tests: 10 original + 6 new in `'dynamic data priority (D-06)'` describe block |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lunar/HolidayFetcher.ts` | `requestUrl` from obsidian | `import { requestUrl } from 'obsidian'` | WIRED | Line 1 import; `requestUrl({url: ...})` called at lines 23, 26 |
| `src/lunar/HolidayService.ts` | HolidayFetcher output | `dynamicData.get(` | WIRED | Line 45: `this.dynamicData.get(dateStr)` in `getHolidayInfo()`; populated via `loadDynamicData()` line 26-28 |
| `src/main.ts` | `src/lunar/HolidayFetcher.ts` | `holidayFetcher.fetchYears` in `checkAndUpdateHolidays` | WIRED | Line 13: import; line 25: `private holidayFetcher: HolidayFetcher`; line 200: `this.holidayFetcher.fetchYears([currentYear, currentYear + 1])` |
| `src/main.ts` | `HolidayService.loadDynamicData` | Feed fetched/cached data into HolidayService | WIRED | Line 178: `(leaf.view as CalendarView).holidayService.loadDynamicData(map)` in `loadHolidayDataIntoViews()`; called at startup (line 53) and after fetch (line 212) |
| `src/main.ts` | `src/models/types.ts` | `UniCalendarData.holidayCache` | WIRED | Lines 7-11: imports `DEFAULT_HOLIDAY_CACHE`, `HolidayCache`, `HolidayCacheEntry`; line 89: load; line 96: save |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CalendarView.ts` holiday display | `this.holidayService.getHolidayInfo(dateStr)` | `HolidayService.dynamicData` Map (populated via `loadDynamicData`) | Yes — Map populated from `HolidayFetcher.fetchYears()` which parses real JSON from `requestUrl`, or from `holidayCache.years` loaded from persistent storage | FLOWING |
| `HolidayService.ts` static fallback | `getDayDetail(dateStr)` from `chinese-days` | `chinese-days` library static data | Yes — library call returns real Chinese holiday data for 2004-2026 range | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `fetchYear` parses JSON and returns correct Map | `npx vitest run tests/lunar/HolidayFetcher.test.ts` | 8/8 passed | PASS |
| `HolidayService` dynamic priority + fallback | `npx vitest run tests/lunar/HolidayService.test.ts` | 16/16 passed (10 original + 6 new) | PASS |
| Full lunar test suite | `npx vitest run tests/lunar/` | 39/39 passed | PASS |
| No regressions in full suite | `npx vitest run` | 95/97 passed (2 pre-existing failures in sync adapter tests, unrelated to this phase) | PASS |
| Commits in git log | git log check | All 4 commits verified: 2d807fd, 037b153, b2e3946, 62f43e9 | PASS |

Pre-existing failures (out of scope, existed before this phase):
- `tests/sync/GoogleSyncAdapter.test.ts` — all-day event mapping
- `tests/sync/IcsSyncAdapter.test.ts` — VALUE=DATE parsing

---

### Requirements Coverage

The D-01 through D-07 IDs in plan frontmatter are phase-local design decisions defined in `08-CONTEXT.md`, not global REQUIREMENTS.md requirements. REQUIREMENTS.md does not contain D-01 through D-07 entries. The traceability table in REQUIREMENTS.md does not map any row to Phase 8. This is expected — phase 8 is an internal data-source upgrade with no new user-visible requirements in the v1 requirements list.

| Req ID | Source Plan | Description (from 08-CONTEXT.md) | Status | Evidence |
|--------|------------|----------------------------------|--------|---------|
| D-01 | 08-01 | Use NateScarlet/holiday-cn as data source via raw URL JSON | SATISFIED | `HolidayFetcher.ts` fetches from `holiday-cn@master/{year}.json` |
| D-02 | 08-01 | URL hardcoded in code, user never configures data source | SATISFIED | `HOLIDAY_CN_BASE_URL` and `HOLIDAY_CN_FALLBACK_URL` are constants; no settings field exposed |
| D-03 | 08-02 | Update check piggybacked on SyncManager sync, with 24h independent interval | SATISFIED | `triggerSync()` fire-and-forget call; `TWENTY_FOUR_HOURS` throttle check |
| D-04 | 08-02 | Cached in Obsidian plugin data via saveData/loadData | SATISFIED | `HolidayCache` field in `UniCalendarData`; persisted via `savePluginData()`/`loadPluginData()` |
| D-05 | 08-01 | Fetch current year + next year | SATISFIED | `fetchYears([currentYear, currentYear + 1])` in `checkAndUpdateHolidays()` |
| D-06 | 08-01 | Dynamic data priority, fall back to chinese-days on miss | SATISFIED | `getHolidayInfo()` checks `dynamicData.get()` first, calls `getStaticHolidayInfo()` on miss |
| D-07 | 08-02 | On fetch failure: Notice to user, continue with cache/static | SATISFIED | `new Notice('节假日数据更新失败，将使用缓存数据')` in catch; no re-throw |

---

### Anti-Patterns Found

No anti-patterns detected in any modified files (`src/lunar/HolidayFetcher.ts`, `src/lunar/HolidayService.ts`, `src/lunar/index.ts`, `src/models/types.ts`, `src/main.ts`, `src/views/CalendarView.ts`). No TODO/FIXME/PLACEHOLDER comments, no stub return values, no hollow props.

---

### Human Verification Required

None. All verifiable behaviors were confirmed programmatically via file inspection and test runs.

---

### Gaps Summary

No gaps. All 11 must-have truths are verified, all artifacts exist and are substantive (Level 1-2), all are wired and data flows through them (Level 3-4), all 4 git commits are present in the repository, and all phase-specific requirement IDs (D-01 through D-07) are satisfied by the implementation.

---

_Verified: 2026-04-05T22:16:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 08-public-holidays-dynamic
plan: 01
subsystem: lunar
tags: [holiday-fetcher, dynamic-holidays, holiday-cn, tdd]
dependency_graph:
  requires: []
  provides: [HolidayFetcher, HolidayService-dynamic-data]
  affects: [CalendarView (Plan 02 wiring)]
tech_stack:
  added: [holiday-cn-json-api]
  patterns: [cdn-with-fallback, dynamic-first-static-fallback]
key_files:
  created:
    - src/lunar/HolidayFetcher.ts
    - tests/lunar/HolidayFetcher.test.ts
  modified:
    - src/lunar/HolidayService.ts
    - src/lunar/index.ts
    - tests/lunar/HolidayService.test.ts
decisions:
  - Used jsdelivr CDN as primary URL with raw.githubusercontent.com fallback for China mainland accessibility
  - loadDynamicData() replaces entire Map (not merge) for simplicity and predictable state
  - getHolidayInfo() remains synchronous -- dynamic data is pre-loaded, no async needed at query time
metrics:
  duration: 190s
  completed: 2026-04-05T13:59:10Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 08 Plan 01: HolidayFetcher and HolidayService Dynamic Data Summary

HolidayFetcher class fetches/parses NateScarlet/holiday-cn JSON via jsdelivr CDN with GitHub raw fallback; HolidayService refactored to check dynamic data first then fall back to chinese-days static data (D-06).

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | HolidayFetcher -- fetch, parse, error handling | 2d807fd | src/lunar/HolidayFetcher.ts, tests/lunar/HolidayFetcher.test.ts |
| 2 | HolidayService refactor -- dynamic data priority with static fallback | 037b153 | src/lunar/HolidayService.ts, src/lunar/index.ts, tests/lunar/HolidayService.test.ts |

## Implementation Details

### Task 1: HolidayFetcher

Created `src/lunar/HolidayFetcher.ts` with:
- `HolidayCnDay` interface matching holiday-cn JSON structure
- `HOLIDAY_CN_BASE_URL` (jsdelivr CDN) and `HOLIDAY_CN_FALLBACK_URL` (raw.githubusercontent.com)
- `fetchYear(year)` -- fetches single year JSON, validates `days` array, returns `Map<string, {name, isOffDay}>`
- `fetchYears(years[])` -- fetches multiple years, merges into single Map, silently skips failed years
- CDN-first with fallback pattern for China mainland accessibility

8 tests covering: parsing, isOffDay mapping, 404 handling, structure validation, multi-year merge, partial failures, empty result, URL verification.

### Task 2: HolidayService Refactor

Refactored `src/lunar/HolidayService.ts`:
- Added `private dynamicData: Map` field
- Added `loadDynamicData(data)` method that replaces entire dynamic dataset
- `getHolidayInfo(dateStr)` now checks dynamic data first, falls back to `getStaticHolidayInfo()` (extracted private method)
- Dynamic data maps `isOffDay: true` to `type: 'rest'` and `isOffDay: false` to `type: 'work'`
- Interface remains synchronous -- no CalendarView changes needed
- All 10 existing HolidayService tests pass unchanged

Updated `src/lunar/index.ts` to export `HolidayFetcher` and `HolidayCnDay`.

6 new tests covering: dynamic rest/work types, name field, static fallback, null for regular days, data replacement.

## Verification Results

- `npx vitest run tests/lunar/HolidayFetcher.test.ts` -- 8/8 passed
- `npx vitest run tests/lunar/HolidayService.test.ts` -- 16/16 passed (10 existing + 6 new)
- `npx vitest run tests/lunar/` -- 39/39 passed (all lunar tests)
- Full suite: 95/97 passed (2 pre-existing failures in sync tests, unrelated)

## Deviations from Plan

None -- plan executed exactly as written.

## Pre-existing Test Failures (Out of Scope)

2 pre-existing test failures in unrelated sync adapter tests:
- `tests/sync/GoogleSyncAdapter.test.ts` -- all-day event mapping
- `tests/sync/IcsSyncAdapter.test.ts` -- all-day event VALUE=DATE parsing

These failures exist on the base commit and are unrelated to holiday changes.

## Threat Mitigations Applied

| Threat ID | Mitigation | Implementation |
|-----------|-----------|----------------|
| T-08-01 (Tampering) | Validate response structure | `if (!data.days \|\| !Array.isArray(data.days)) throw` in fetchYear() |
| T-08-04 (Spoofing) | HTTPS hardcoded URLs | Both `HOLIDAY_CN_BASE_URL` and `HOLIDAY_CN_FALLBACK_URL` use https:// |

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (2d807fd, 037b153) found in git log.

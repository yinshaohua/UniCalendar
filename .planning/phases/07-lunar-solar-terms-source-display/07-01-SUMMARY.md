---
phase: 07-lunar-solar-terms-source-display
plan: 01
subsystem: lunar-calendar-display
tags: [lunar, solar-terms, festivals, chinese-calendar, tdd]
dependency_graph:
  requires: [chinese-days]
  provides: [canonical-festival-map, solarTerm-priority, dynamic-chuxi-detection, leap-month-display]
  affects: [src/lunar/LunarService.ts, tests/lunar/LunarService.test.ts]
tech_stack:
  added: []
  patterns: [CANONICAL_FESTIVALS-map, solarTerm-first-priority, dynamic-chuxi-detection]
key_files:
  created: []
  modified:
    - src/lunar/LunarService.ts
    - tests/lunar/LunarService.test.ts
key_decisions:
  - "Display priority changed to solarTerm > festival > lunarDay (was festival > solarTerm > lunarDay)"
  - "Replaced getLunarFestivals() with hardcoded CANONICAL_FESTIVALS map containing exactly 9 festivals"
  - "除夕 detected dynamically by checking if next day is 正月初一 (handles 29 or 30 day 12th month)"
metrics:
  duration: 6min
  completed: 2026-04-05
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 7 Plan 01: Canonical Festival Filtering and SolarTerm Priority Summary

Replaced getLunarFestivals() (50+ obscure folk festivals) with hardcoded CANONICAL_FESTIVALS map of 9 traditional festivals, changed display priority to solarTerm > festival > lunarDay, added dynamic 除夕 detection and leap month display.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write tests for solarTerm-first priority and canonical festivals (RED) | ce69f43 | tests/lunar/LunarService.test.ts |
| 2 | Implement solarTerm-first priority, canonical festival map, 除夕 detection, leap month (GREEN) | 42fdaea | src/lunar/LunarService.ts, tests/lunar/LunarService.test.ts |

## Changes Made

### Task 1: TDD RED Phase -- Test Suite Rewrite
- Rewrote tests/lunar/LunarService.test.ts with 20 test cases covering:
  - Display priority: solarTerm > festival > lunarDay (4 tests)
  - All 9 canonical festivals: 春节, 元宵, 端午, 七夕, 中元, 中秋, 重阳, 腊八, 除夕 (9 tests)
  - Negative tests for obscure festivals NOT shown (3 tests)
  - Edge cases: month indexing, field population (2 tests)
  - Leap month display: 闰 prefix handling (2 tests)
- 10 tests failed RED as expected (current impl had wrong priority and used getLunarFestivals)

### Task 2: TDD GREEN Phase -- Implementation
- Removed `getLunarFestivals` import from chinese-days
- Added `CANONICAL_FESTIVALS` constant with 9 festival entries keyed by "lunarMon-lunarDay"
- Rewrote `getLunarDayInfo()` with new priority: solarTerm checked FIRST, then canonical festivals, then 除夕 dynamic detection, then lunar day
- 除夕 detected by checking if next Gregorian day's lunar date is 正月初一 (handles variable 29/30 day months)
- Updated `getLunarMonthForTitle()` to check `isLeap` and prepend "闰" prefix
- Fixed 3 test date inaccuracies discovered during GREEN phase (中元 date, 腊八 date, obscure festival test date overlapping with 雨水 solar term)
- All 20 tests pass, build succeeds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect test dates from plan**
- **Found during:** Task 2 GREEN phase
- **Issue:** Plan specified dates that don't match actual lunar calendar: 中元 as 2026-07-25 (actually 2026-08-27), 腊八 as 2027-01-17 (actually 2027-01-15), and 犬日 test on 2026-02-18 which is actually 雨水 solar term day
- **Fix:** Updated test dates to verified correct values; changed obscure festival negative test to use 2026-02-19 (正月初三, no solar term)
- **Files modified:** tests/lunar/LunarService.test.ts
- **Commit:** 42fdaea

## Decisions Made

1. **solarTerm > festival > lunarDay priority** -- Solar terms always take highest display priority, ensuring 清明 displays as solarTerm even if a festival could match nearby dates
2. **9 canonical festivals only** -- 春节, 元宵, 端午, 七夕, 中元, 中秋, 重阳, 腊八, 除夕 are the complete set; all other getLunarFestivals entries eliminated
3. **Dynamic 除夕 detection** -- Cannot hardcode 12-29 or 12-30; check if next day is 正月初一 instead

## Verification Results

- `npx vitest run tests/lunar/LunarService.test.ts` -- 20/20 tests pass
- `npx vitest run` -- 87/89 pass (2 pre-existing failures in IcsSyncAdapter and GoogleSyncAdapter, unrelated to this change)
- `node esbuild.config.mjs` -- build succeeds
- `getLunarFestivals` import fully removed from LunarService.ts
- `CANONICAL_FESTIVALS` declared and used in LunarService.ts
- getSolarTerms check appears before CANONICAL_FESTIVALS lookup (priority correct)

## Pre-existing Test Failures (Out of Scope)

2 tests in sync adapters fail on HEAD before this change:
- `tests/sync/IcsSyncAdapter.test.ts` -- all-day event end date assertion
- `tests/sync/GoogleSyncAdapter.test.ts` -- all-day event end date assertion

These are unrelated to lunar calendar changes and pre-date this phase.

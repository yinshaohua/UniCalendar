---
phase: 06-chinese-lunar-calendar
plan: 01
subsystem: lunar
tags: [chinese-days, lunar-calendar, solar-terms, holidays, tdd]

# Dependency graph
requires: []
provides:
  - LunarService: lunar date computation with D-02 display priority (festival > solar term > lunar day)
  - HolidayService: holiday type detection (rest/work) using chinese-days static data
  - Barrel index at src/lunar/index.ts for clean imports
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: [chinese-days]
  patterns: [holiday-group detection via name matching, composite name parsing for Chinese display]

key-files:
  created:
    - src/lunar/LunarService.ts
    - src/lunar/HolidayService.ts
    - src/lunar/index.ts
    - tests/lunar/LunarService.test.ts
    - tests/lunar/HolidayService.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Detect holiday-group days by getDayDetail().name not being a day-of-week string, rather than using isHoliday() which includes regular weekends"
  - "Extract Chinese holiday name from composite string (e.g. 'Spring Festival,春节,4' -> '春节') for display"
  - "Use Xiaohan (小寒) instead of Qingming (清明) for solar term test because 清明 coincides with 寒食节 festival"

patterns-established:
  - "LunarService: stateless wrapper with JS 0-based month offset handling via formatDate()"
  - "HolidayService: try-catch graceful fallback for dates outside chinese-days coverage"
  - "Holiday detection: DAY_OF_WEEK_NAMES set to distinguish regular days from holiday-group days"

requirements-completed: [D-02, D-10, D-11]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 6 Plan 01: LunarService and HolidayService with TDD Summary

**chinese-days library installed with LunarService (D-02 display priority) and HolidayService (static holiday detection) fully tested via TDD -- 23 tests passing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T17:45:41Z
- **Completed:** 2026-04-04T17:50:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed chinese-days library for lunar/solar/festival/holiday computation
- LunarService implements D-02 display priority: festival > solar term > lunar day, with canonical 2026 festival verification
- HolidayService detects statutory holidays (rest) and adjusted workdays (bu-ban/work) using static data only per D-11 scope
- 23 unit tests covering priority logic, 5 canonical festivals, edge cases, 2026 data validation (A1), and graceful fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Install chinese-days and create LunarService with tests** - `7b404c4` (test)
2. **Task 2: Create HolidayService with tests** - `abad6a9` (test)

## Files Created/Modified
- `src/lunar/LunarService.ts` - Lunar date computation wrapper with D-02 display priority
- `src/lunar/HolidayService.ts` - Holiday type detection (rest/work) using chinese-days static data
- `src/lunar/index.ts` - Barrel re-exports for LunarService, HolidayService, and their types
- `tests/lunar/LunarService.test.ts` - 12 tests: priority, festivals, edge cases, month title
- `tests/lunar/HolidayService.test.ts` - 11 tests: rest, work, null, 2026 data, graceful fallback
- `package.json` - Added chinese-days dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Detected holiday-group days by checking if getDayDetail().name is NOT a day-of-week string (Monday/Tuesday/etc.), because isHoliday() includes regular weekends and is not suitable for statutory holiday detection
- Extracted Chinese name from composite string format ("Spring Festival,春节,4") by splitting on comma and taking index 1
- Used 小寒 (2026-01-05) instead of 清明 (2026-04-05) for solar term test because 清明 coincides with 寒食节 festival in chinese-days, which takes priority per D-02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed holiday detection logic to use name-based classification**
- **Found during:** Task 2 (HolidayService implementation)
- **Issue:** Plan's approach using isHoliday() + isInLieu() does not correctly classify days. isHoliday() returns true for regular weekends; isInLieu() marks compensatory rest days (not bu-ban workdays).
- **Fix:** Detect holiday-group days by checking if getDayDetail().name is NOT a day-of-week string. Holiday-group + work=false -> rest; holiday-group + work=true -> work (bu-ban).
- **Files modified:** src/lunar/HolidayService.ts
- **Verification:** All 11 HolidayService tests pass including bu-ban detection for 2026-02-14 and 2026-10-10
- **Committed in:** abad6a9

**2. [Rule 1 - Bug] Fixed Qingming solar term test date**
- **Found during:** Task 1 (LunarService tests)
- **Issue:** 2026-04-05 (清明) also has 寒食节 festival in chinese-days, so festival takes priority over solar term per D-02 -- test for solar term detection was failing.
- **Fix:** Changed solar term test to use 2026-01-05 (小寒) which has no festival on the same day.
- **Files modified:** tests/lunar/LunarService.test.ts
- **Verification:** All 12 LunarService tests pass
- **Committed in:** 7b404c4

**3. [Rule 1 - Bug] Fixed 2026 festival dates in test assertions**
- **Found during:** Task 1 (LunarService tests)
- **Issue:** Plan listed incorrect Gregorian dates for 2026 festivals (中秋 as 10-08, 重阳 as 10-25). Verified correct dates: 中秋 is 2026-09-25, 重阳 is 2026-10-18.
- **Fix:** Used verified dates from chinese-days API in tests.
- **Files modified:** tests/lunar/LunarService.test.ts
- **Verification:** All festival tests pass with correct dates
- **Committed in:** 7b404c4

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes were necessary for correctness. The core architecture and API design from the plan were followed exactly. Only test data and holiday detection logic needed adjustment based on actual chinese-days API behavior.

## Issues Encountered
- Pre-existing test failures in IcsSyncAdapter.test.ts and GoogleSyncAdapter.test.ts (all-day event date format) -- not related to this plan, not fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LunarService and HolidayService ready for CalendarView integration in Plan 06-02
- Barrel index provides clean imports: `import { LunarService, HolidayService } from '../lunar'`
- chinese-days bundles successfully via esbuild (build passes)
- Holiday detection pattern (name-based classification) documented for future reference

## Self-Check: PASSED

- All 6 created files exist on disk
- Both task commits found in git log (7b404c4, abad6a9)
- LunarService exports class and interface, contains month+1 offset
- HolidayService exports class and type, contains try-catch, NO requestUrl, NO Notice
- Barrel index re-exports both services
- 23 tests pass, build succeeds

---
*Phase: 06-chinese-lunar-calendar*
*Completed: 2026-04-05*

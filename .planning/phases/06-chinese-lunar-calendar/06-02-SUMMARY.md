---
phase: 06-chinese-lunar-calendar
plan: 02
subsystem: settings
tags: [lunar-calendar, settings, toggles, obsidian-plugin]

# Dependency graph
requires:
  - phase: 05-apple-calendar-ui-polish
    provides: Calendar view with settings tab and view refresh pattern
provides:
  - showLunarCalendar and showHolidays boolean settings with defaults
  - Settings UI toggles with Chinese labels for lunar/holiday control
  - Public refreshCalendarViews() method callable from SettingsTab
affects: [06-chinese-lunar-calendar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings toggle with view refresh: onChange saves settings then calls refreshCalendarViews()"

key-files:
  created: []
  modified:
    - src/models/types.ts
    - src/settings/SettingsTab.ts
    - src/main.ts
    - tests/settings/types.test.ts

key-decisions:
  - "Made refreshCalendarViews() public instead of adding a separate method, reusing existing implementation"
  - "Used h2 heading for settings section consistency with existing General Settings and Calendar Sources sections"

patterns-established:
  - "Settings toggle with immediate view refresh via refreshCalendarViews()"

requirements-completed: [D-12]

# Metrics
duration: 2min
completed: 2026-04-05
---

# Phase 6 Plan 02: Lunar/Holiday Settings Toggles Summary

**showLunarCalendar and showHolidays toggle settings added to UniCalendarSettings with Chinese UI labels and immediate CalendarView refresh on change**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T17:45:52Z
- **Completed:** 2026-04-04T17:48:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Extended UniCalendarSettings interface with showLunarCalendar and showHolidays boolean fields (both default true)
- Added settings UI section with two toggle rows using Chinese labels matching UI-SPEC copywriting contract
- Made refreshCalendarViews() public so toggle changes trigger immediate calendar view refresh
- Added unit tests verifying both defaults are true

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lunar/holiday settings to types, Settings UI, and view refresh** - `3f3470d` (feat)

## Files Created/Modified
- `src/models/types.ts` - Added showLunarCalendar and showHolidays to UniCalendarSettings interface and DEFAULT_SETTINGS
- `src/settings/SettingsTab.ts` - Added refreshCalendarViews to plugin interface, added lunar/holiday toggle section with Chinese labels
- `src/main.ts` - Changed refreshCalendarViews() from private to public
- `tests/settings/types.test.ts` - Added tests for showLunarCalendar and showHolidays defaults

## Decisions Made
- Made existing refreshCalendarViews() public rather than creating a new method -- the existing implementation already iterates workspace leaves and calls rerender(), which is exactly what the toggles need
- Used h2 heading ("农历与节假日") for the new settings section to match existing section heading pattern (h2 for "通用设置" and "日历源")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made refreshCalendarViews() public**
- **Found during:** Task 1
- **Issue:** Plan called for adding refreshCalendarViews() to the plugin class, but it already existed as a private method
- **Fix:** Changed from `private refreshCalendarViews()` to `refreshCalendarViews()` (public) and added it to the UniCalendarPlugin interface in SettingsTab.ts
- **Files modified:** src/main.ts, src/settings/SettingsTab.ts
- **Verification:** Build passes, toggles can call the method
- **Committed in:** 3f3470d

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor adjustment to reuse existing method. No scope creep.

## Issues Encountered
- Pre-existing test failures in IcsSyncAdapter.test.ts and GoogleSyncAdapter.test.ts (date-related assertions) -- unrelated to this plan's changes, not addressed per scope boundary rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings infrastructure ready for Plan 03 (CalendarView integration) to read showLunarCalendar and showHolidays
- refreshCalendarViews() is public and callable from any context that needs to trigger view updates

---
*Phase: 06-chinese-lunar-calendar*
*Completed: 2026-04-05*

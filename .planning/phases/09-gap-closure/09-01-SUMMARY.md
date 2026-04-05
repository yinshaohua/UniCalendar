---
phase: 09-gap-closure
plan: 01
subsystem: calendar-view, lunar-service, sync-tests
tags: [bugfix, defaultView, leap-month, all-day-events, test-fix]

requires:
  - phase: 05-multi-view-settings-commands
    provides: "defaultView setting in plugin settings"
  - phase: 07-lunar-solar-terms-source-display
    provides: "LunarService with getLunarMonthForTitle method"
provides:
  - "CalendarView reads defaultView setting on open instead of hardcoding 'month'"
  - "getLunarMonthForTitle prepends '闰' for leap months"
  - "All-day event end date tests fixed to expect inclusive dates"
  - "Full test suite: 97 tests, 0 failures"
affects: [calendar-view, lunar-display, sync-tests]
---

## What Was Built

Fixed three code-level gaps identified in the v1.0 milestone audit:

1. **defaultView setting wiring** — CalendarView.onOpen now reads `this.plugin.settings.defaultView` so the user's preferred view (month/week/day) is respected on open
2. **Leap month "闰" prefix** — `getLunarMonthForTitle()` checks `lunar.isLeap` and prepends "闰" when displaying lunar month in toolbar title
3. **All-day event end date tests** — Fixed test expectations to match the adapter's exclusive→inclusive date normalization (ICS: 04-02→04-01, Google: 04-06→04-05)

## Key Files

### key-files.created
(none)

### key-files.modified
- `src/views/CalendarView.ts` — Added `this.currentViewMode = this.plugin.settings.defaultView` in onOpen()
- `src/lunar/LunarService.ts` — Updated getLunarMonthForTitle to check isLeap and prepend "闰"
- `tests/sync/IcsSyncAdapter.test.ts` — Fixed all-day event end date expectation to '2026-04-01'
- `tests/sync/GoogleSyncAdapter.test.ts` — Fixed all-day event end date expectation to '2026-04-05'

## Test Results

- **Command:** `npx vitest run`
- **Result:** 97 tests passed, 0 failures
- **LunarService tests:** 10/10 passed (including leap month coverage)

## Deviations

None. All changes matched the plan exactly.

## Commits

1. `485d83e` — feat(09-01): wire defaultView setting and fix leap month display
2. `c1a9aed` — fix(09-01): correct all-day event end date test expectations

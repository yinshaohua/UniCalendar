---
plan: 03-02
phase: 03-caldav-integration
status: complete
started: 2026-04-01
completed: 2026-04-01
---

## Summary

Added CalDAV calendar discovery UI to AddSourceModal and EditSourceModal.

## Tasks Completed

### Task 1: Calendar discovery UI
- "发现日历" button in CalDAV source add/edit modals
- Calls CalDavSyncAdapter.discoverCalendars() with entered credentials
- Shows selectable list with highlight on selection
- Selected calendar auto-fills calendarPath
- Loading state ("发现中...") and error handling
- Manual path input preserved as fallback

## Key Files

### Modified
- `src/settings/SettingsTab.ts` — Discovery button, calendar list, renderCalendarSelection

## Self-Check: PASSED
- [x] Import CalDavSyncAdapter in SettingsTab
- [x] Discovery button in AddSourceModal
- [x] Discovery button in EditSourceModal
- [x] Calendar selection list with visual highlight
- [x] Chinese UI text
- [x] Build passes

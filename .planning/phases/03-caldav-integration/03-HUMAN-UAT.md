---
status: partial
phase: 03-caldav-integration
source: [03-VERIFICATION.md]
started: "2026-04-02T01:15:00Z"
updated: "2026-04-02T01:15:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. DingTalk CalDAV sync
expected: Add DingTalk CalDAV server, discovery finds calendars, sync fetches events, events display correctly in month/week/day views
result: [pending]

### 2. Cross-provider CalDAV (Nextcloud/iCloud/Fastmail)
expected: Connect to at least one non-DingTalk CalDAV provider, verify discovery and sync work
result: [pending]

### 3. CalDAV error UX
expected: Enter wrong credentials, verify error message is clear and actionable (e.g. "CalDAV认证失败: 请检查用户名和密码")
result: [pending]

### 4. CalendarPickerModal UX
expected: Discovery results appear in a dedicated picker modal, click selects calendar, selected name displays below discovery button
result: [pending]

### 5. Selected calendar persistence
expected: Close and reopen EditSourceModal, verify selected calendar display name persists and shows correctly
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

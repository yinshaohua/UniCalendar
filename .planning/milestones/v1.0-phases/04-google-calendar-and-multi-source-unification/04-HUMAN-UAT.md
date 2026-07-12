---
status: partial
phase: 04-google-calendar-and-multi-source-unification
source: [04-VERIFICATION.md]
started: 2026-04-02T19:10:00Z
updated: 2026-04-02T19:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Google OAuth End-to-End Flow
expected: Build and install the plugin, enter real Google Cloud OAuth2 credentials (Client ID + Secret), click "授权", complete authorization in browser, verify Obsidian receives the `obsidian://uni-calendar/oauth-callback` redirect and shows "Google 日历授权成功！", then select a calendar and confirm events sync into the unified view.
result: [pending]

### 2. Multi-Source Deduplication Visible in Calendar
expected: Add the same calendar as both ICS and Google sources, verify events appear only once in the rendered calendar view (not duplicated). The first-added source's version should be kept.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

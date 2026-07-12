---
phase: "23"
plan: "01"
---

# T01: Extended the Google source model with an optional proxy URL while preserving legacy saved-source compatibility.

**Extended the Google source model with an optional proxy URL while preserving legacy saved-source compatibility.**

## What Happened

Added an optional `proxyUrl` field to the nested Google source configuration. Added type-level tests proving legacy Google sources can omit the field and new Google sources can persist a proxy address. No runtime network or settings UI behavior was changed in this task.

## Verification

Ran `npm test -- --run tests/settings/types.test.ts tests/sync/GoogleSyncAdapter.test.ts tests/sync/GoogleAuthHelper.test.ts`; the focused settings, Google sync adapter, and Google auth helper tests passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --run tests/settings/types.test.ts tests/sync/GoogleSyncAdapter.test.ts tests/sync/GoogleAuthHelper.test.ts` | 0 | ✅ pass | 11200ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/models/types.ts`
- `tests/settings/types.test.ts`

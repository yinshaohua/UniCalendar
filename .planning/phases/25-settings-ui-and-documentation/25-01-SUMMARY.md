---
phase: "25"
plan: "01"
---

# T01: Added the Google proxy URL settings field and persistence helper coverage.

**Added the Google proxy URL settings field and persistence helper coverage.**

## What Happened

Updated the Google source edit modal to include an optional `Google 代理地址` field with direct-mode copy and a placeholder proxy endpoint. Saving now writes the trimmed value to `source.google.proxyUrl` or normalizes blank input to `undefined` for direct mode through `buildSavedGoogleConfig`. Added tests for proxy URL persistence, blank normalization, and preservation of existing Google token fields.

## Verification

Ran `npm test -- --run tests/settings/SettingsTab.test.ts tests/settings/types.test.ts`; settings UI helper and model tests passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --run tests/settings/SettingsTab.test.ts tests/settings/types.test.ts` | 0 | ✅ pass | 9300ms |

## Deviations

Used a pure save helper test instead of driving the full Obsidian modal UI because the repository's Obsidian test mock is intentionally minimal.

## Known Issues

None.

## Files Created/Modified

- `src/settings/SettingsTab.ts`
- `tests/settings/SettingsTab.test.ts`

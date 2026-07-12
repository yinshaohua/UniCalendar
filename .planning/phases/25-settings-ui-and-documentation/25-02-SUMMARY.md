---
phase: "25"
plan: "02"
---

# T02: Documented the optional Google proxy setting and forwarding endpoint contract.

**Documented the optional Google proxy setting and forwarding endpoint contract.**

## What Happened

Updated `README.md` so Google source setup includes the optional Google proxy address. The documentation explains direct mode when blank, the forwarding proxy contract using an encoded `target` query parameter, preserved request attributes, and the credential-handling caveat that diagnostics redact proxy credentials but settings still store the entered value.

## Verification

Ran `npm test -- --run tests/sync/GoogleProxyRequest.test.ts tests/settings/types.test.ts`; proxy helper and settings model tests passed after the documentation update.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --run tests/sync/GoogleProxyRequest.test.ts tests/settings/types.test.ts` | 0 | ✅ pass | 14100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `README.md`

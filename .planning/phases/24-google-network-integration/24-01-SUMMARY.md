---
phase: "24"
plan: "01"
---

# T01: Routed Google OAuth token requests through the proxy helper while preserving direct token behavior.

**Routed Google OAuth token requests through the proxy helper while preserving direct token behavior.**

## What Happened

Updated `GoogleAuthHelper` so token exchange and refresh requests are built through `buildGoogleRequestOptions`. Existing callers remain compatible because proxy URL is an optional final parameter; `ensureValidToken` now passes `google.proxyUrl` from the source configuration when refreshing an expiring token. Added tests proving direct token endpoint behavior remains unchanged, configured proxy endpoints receive the OAuth token target URL, and source proxy configuration is used during refresh.

## Verification

Ran `npm test -- --run tests/sync/GoogleAuthHelper.test.ts tests/sync/GoogleProxyRequest.test.ts`; Google auth and proxy helper tests passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --run tests/sync/GoogleAuthHelper.test.ts tests/sync/GoogleProxyRequest.test.ts` | 0 | ✅ pass | 12600ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/sync/GoogleAuthHelper.ts`
- `tests/sync/GoogleAuthHelper.test.ts`

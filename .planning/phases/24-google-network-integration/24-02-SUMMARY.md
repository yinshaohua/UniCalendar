---
phase: "24"
plan: "02"
---

# T02: Routed Google Calendar discovery and events API requests through the proxy helper.

**Routed Google Calendar discovery and events API requests through the proxy helper.**

## What Happened

Updated `GoogleSyncAdapter` so calendar discovery and event page requests are constructed through `buildGoogleRequestOptions`. `discoverCalendars` now accepts an optional proxy URL while preserving existing direct-mode behavior; runtime sync passes `source.google.proxyUrl` into event requests. Added tests proving direct calendar API URLs remain unchanged, proxied discovery and events requests use the forwarding endpoint, and authorization headers/methods are preserved.

## Verification

Ran `npm test -- --run tests/sync/GoogleSyncAdapter.test.ts tests/sync/GoogleProxyRequest.test.ts`; Google sync adapter and proxy helper tests passed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test -- --run tests/sync/GoogleSyncAdapter.test.ts tests/sync/GoogleProxyRequest.test.ts` | 0 | ✅ pass | 12400ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/sync/GoogleSyncAdapter.ts`
- `tests/sync/GoogleSyncAdapter.test.ts`

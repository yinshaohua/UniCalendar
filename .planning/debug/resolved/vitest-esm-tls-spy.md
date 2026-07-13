---
status: resolved
trigger: "GitHub CI fails because GoogleProxyRequest.test.ts cannot spy on tls.connect in ESM"
created: 2026-07-13
updated: 2026-07-13
---

# Symptoms

- Expected behavior: `npm test` passes locally and in GitHub Actions.
- Actual behavior: one Google proxy CONNECT tunnel test fails before exercising production code.
- Error: `TypeError: Cannot spy on export "connect". Module namespace is not configurable in ESM.`
- Timeline: observed after pushing the current code to GitHub.
- Reproduction: run the `requestGoogleUrl` custom CONNECT tunnel test under the CI ESM environment.

# Current Focus

- hypothesis: Confirmed: direct `vi.spyOn` cannot redefine non-configurable Node ESM exports.
- test: Full CI-equivalent verification completed.
- expecting: All checks pass without changing proxy behavior.
- next_action: none
- reasoning_checkpoint:
- tdd_checkpoint:

# Evidence

- timestamp: 2026-07-13
  observation: The focused test reproduces the same failure locally on Node 24.14.1 with Vitest 4.1.2.
- timestamp: 2026-07-13
  observation: Node reports `configurable: false` for the ESM exports `http.request`, `https.request`, and `tls.connect`.
- timestamp: 2026-07-13
  observation: The exception occurs while setting up `vi.spyOn`, before `requestGoogleUrl` executes.
- timestamp: 2026-07-13
  observation: The focused Google proxy test file passes all 13 tests with `vi.mock(..., { spy: true })` and `vi.mocked(...)`.
- timestamp: 2026-07-13
  observation: The same 13 tests pass under both CI runtime versions, Node 22 and Node 24.
- timestamp: 2026-07-13
  observation: Full lint initially found 17 errors from the desktop Node proxy module and its Node-environment test; scoped Node ESLint configuration resolves them without weakening other source rules.

# Eliminated

- hypothesis: The CONNECT tunnel production implementation causes the test failure.
  reason: The exception occurs during spy setup before production code runs.

# Resolution

- root_cause: The test used `vi.spyOn` on non-configurable named exports from Node ESM module namespaces.
- fix: Use Vitest spy modules and `vi.mocked` for the Node networking exports; scope Node lint globals and builtin imports to Node-only files and type response chunks explicitly.
- verification: Node 22 and 24 focused tests pass; full suite passes 192/192; build and lint pass.
- files_changed: tests/sync/GoogleProxyRequest.test.ts, eslint.config.mts, src/sync/GoogleProxyRequest.ts

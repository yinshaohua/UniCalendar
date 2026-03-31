---
phase: 1
slug: foundation-and-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npm run lint` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run build` (TypeScript compiles, esbuild succeeds)
- **After every plan wave:** `npx vitest run && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification in Obsidian
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | ALL | infra | `npx vitest run` | No — Wave 0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFR-01 | unit | `npx vitest run tests/store/EventStore.test.ts -t "persistence"` | No — Wave 0 | ⬜ pending |
| 01-03-01 | 03 | 1 | INFR-02 | unit | `npx vitest run tests/settings/types.test.ts -t "sources"` | No — Wave 0 | ⬜ pending |
| 01-04-01 | 04 | 2 | EVNT-05 | unit | `npx vitest run tests/sync/SyncManager.test.ts -t "status"` | No — Wave 0 | ⬜ pending |
| 01-05-01 | 05 | 2 | INFR-04 | lint/static | `npm run lint && npm run build` | Yes (lint exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install vitest: `npm install -D vitest`
- [ ] Create `vitest.config.ts` with Obsidian API mocking strategy
- [ ] `tests/store/EventStore.test.ts` — stubs for INFR-01 (event cache persistence)
- [ ] `tests/settings/types.test.ts` — stubs for INFR-02 (source CRUD data layer)
- [ ] `tests/sync/SyncManager.test.ts` — stubs for EVNT-05 (sync status state machine)
- [ ] Mock module for Obsidian's `Plugin`, `ItemView`, `saveData`/`loadData` APIs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calendar view opens as leaf tab | INFR-04 | Requires Obsidian runtime | Open plugin via Ribbon icon; verify leaf view appears |
| Settings UI renders card list | INFR-02 | Obsidian Setting API UI | Open settings; verify source cards display |
| Plugin loads on mobile | INFR-04 | Requires mobile device | Install on iOS/Android Obsidian; open plugin |
| Sync status indicator displays | EVNT-05 | Requires view rendering | Open calendar view; verify "no sources configured" shows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

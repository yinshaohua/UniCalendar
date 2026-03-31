---
phase: 1
slug: foundation-and-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 01-01-T1 | 01 | 1 | INFR-01, INFR-02 | types | `npx tsc --noEmit --skipLibCheck src/models/types.ts` | No — created by task | ⬜ pending |
| 01-01-T2 | 01 | 1 | INFR-01, INFR-02, EVNT-05 | unit | `npm test` | No — created by task | ⬜ pending |
| 01-03-T1 | 03 | 2 | INFR-02 | build | `npx tsc --noEmit --skipLibCheck` | No — created by task | ⬜ pending |
| 01-03-T2 | 03 | 2 | INFR-02 | manual | `npm run build` + human verify | N/A | ⬜ pending |
| 01-02-T1 | 02 | 3 | INFR-04, EVNT-05 | build | `npx tsc --noEmit --skipLibCheck` | No — created by task | ⬜ pending |
| 01-02-T2 | 02 | 3 | INFR-04, EVNT-05 | build | `npm run build` | No — created by task | ⬜ pending |

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

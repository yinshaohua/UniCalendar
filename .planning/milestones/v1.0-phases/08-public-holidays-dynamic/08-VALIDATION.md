---
phase: 8
slug: public-holidays-dynamic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lunar/HolidayService.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lunar/HolidayService.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | D-01,D-02 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | D-03,D-04 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | ✅ | ⬜ pending |
| 8-01-03 | 01 | 1 | D-05 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | ✅ | ⬜ pending |
| 8-01-04 | 01 | 1 | D-06 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | ✅ | ⬜ pending |
| 8-01-05 | 01 | 1 | D-07 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Network fetch from GitHub raw URL | D-01 | Requires real network access | Manually verify in Obsidian with network enabled |
| Obsidian Notice on fetch failure | D-07 | Requires Obsidian runtime | Disconnect network, trigger sync, verify Notice appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

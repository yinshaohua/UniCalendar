---
phase: 7
slug: lunar-solar-terms-source-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lunar/LunarService.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lunar/LunarService.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | Festival filtering | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | 除夕 detection | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | Leap month display | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | Solar terms accuracy | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test file for LunarService canonical festival mapping
- [ ] Test file for 除夕 special case detection
- [ ] Negative tests confirming obscure festivals NOT displayed

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual display of festivals in calendar cells | UI rendering | Requires Obsidian runtime | Open calendar, navigate to festival dates, verify correct text and styling |
| Leap month toolbar title | UI rendering | Requires Obsidian runtime | Navigate to a month with leap month, verify "闰" prefix in toolbar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

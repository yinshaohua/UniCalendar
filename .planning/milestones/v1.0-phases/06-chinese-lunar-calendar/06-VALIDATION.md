---
phase: 6
slug: chinese-lunar-calendar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | D-10 | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | D-02 | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts -t "priority"` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | A3 | — | N/A | unit | `npx vitest run tests/lunar/LunarService.test.ts -t "festival"` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | D-06 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "rest"` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | D-07 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "work"` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 1 | A1 | — | N/A | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "2026"` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | D-12 | — | N/A | unit | `npx vitest run tests/settings/types.test.ts -t "lunar"` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 2 | D-01 | — | N/A | manual-only | Visual inspection in Obsidian | — | ⬜ pending |
| 6-04-02 | 04 | 2 | D-03 | — | N/A | manual-only | Visual inspection | — | ⬜ pending |
| 6-04-03 | 04 | 2 | D-05 | — | N/A | manual-only | Visual inspection (CSS class) | — | ⬜ pending |
| 6-04-04 | 04 | 2 | D-09 | — | N/A | manual-only | Visual inspection | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lunar/LunarService.test.ts` — stubs for D-02, A3 (festival name mapping, display priority)
- [ ] `tests/lunar/HolidayService.test.ts` — stubs for D-06, D-07, A1 (holiday type detection, 2026 data)
- [ ] Framework install: `npm install chinese-days` — new dependency

*Existing vitest infrastructure covers test runner needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lunar text inline right of day number | D-01 | DOM layout/visual positioning | Open month view, verify lunar text appears right of Gregorian number |
| Toolbar title shows lunar month | D-03 | DOM layout | Open month view, verify toolbar shows lunar month name |
| Solar term colored differently | D-05 | CSS visual styling | Navigate to a solar term date, verify colored text |
| Today cell no background | D-09 | CSS visual styling | Open today, verify no background tint, only number circle |
| Holiday badges on all views | D-08 | Cross-view DOM rendering | Check month/week/day views for holiday badges |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

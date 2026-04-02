---
phase: 5
slug: apple-calendar-ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFR-03 | build | `npm run build` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | INFR-03 | build | `npm run build` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | INFR-03 | build | `npm run build` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | INFR-03 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed for a CSS-only visual polish phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apple Calendar-inspired visual quality | INFR-03 | Visual quality is inherently subjective — CSS property values cannot be meaningfully validated in headless tests | 1. Build plugin (`npm run build`) 2. Load in Obsidian desktop 3. Verify rounded corners on event bars (6px) and blocks (8px) 4. Verify subtle shadows on events, toolbar, modal 5. Verify softened grid lines 6. Verify color palette picker in settings 7. Verify hover transitions (shadow lift effect) 8. Test in both light and dark themes 9. Load on Obsidian mobile and verify visual consistency |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

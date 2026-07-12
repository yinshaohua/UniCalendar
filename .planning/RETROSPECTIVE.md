# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-04-05
**Phases:** 9 | **Plans:** 25 | **Tasks:** 39

### What Was Built
- Unified calendar view with ICS, CalDAV, and Google Calendar sync into single Obsidian plugin
- Full month/week/day calendar views with event detail modal and keyboard navigation
- Chinese lunar calendar overlay with solar terms, canonical festivals, and dynamic statutory holidays
- Apple Calendar-inspired UI with soft colors, rounded corners, and color palette picker
- Cross-source event deduplication (UID-first + time+title fallback)
- Dynamic holiday data from NateScarlet/holiday-cn with 24h-throttled CDN fetch and static fallback

### What Worked
- **ICS-first approach**: Building the simplest adapter first validated the entire EventStore → CalendarView pipeline before tackling auth-heavy protocols
- **TDD for data services**: LunarService and HolidayService were built test-first, catching edge cases (除夕 detection, leap months) early
- **Phase 9 gap closure**: Running a milestone audit before completion caught 12 stale traceability entries and a missing defaultView wiring — fixed cheaply
- **Custom CalDAV client**: ~300 LOC instead of tsdav library avoided mobile bundling risk
- **Rapid iteration**: 9 phases in 6 days with consistent commit-per-task discipline

### What Was Inefficient
- **REQUIREMENTS.md traceability drift**: 12 checkboxes went stale because traceability wasn't updated during phase transitions — needed a dedicated gap closure phase to fix
- **Nyquist compliance low**: Only 1/8 phases fully Nyquist-compliant; validation gaps accumulated because validation wasn't part of the standard execution flow
- **Human verification deferred**: SYNC-02 (DingTalk) and INFR-03 (visual check) remain partial because no human testing was integrated into the workflow
- **Phase 7 initially had no VERIFICATION.md**: Skipped verification on a smaller phase, caught only during audit

### Patterns Established
- Milestone audit (`/gsd-audit-milestone`) before completion catches drift that accumulates across phases
- Gap closure phases are an effective pattern for addressing audit findings without blocking milestone completion
- chinese-days + dynamic CDN fetch is a reliable pattern for Chinese calendar data
- Card-based settings UI with Chinese labels works well for Obsidian plugins targeting Chinese users

### Key Lessons
1. **Update traceability tables during phase transitions, not just at milestone end** — 12 stale entries is cheap to fix but undermines confidence in requirements tracking
2. **Run milestone audit early** — catching gaps at Phase 8 instead of Phase 9 would have saved a dedicated phase
3. **Human testing should be scheduled explicitly** — "human test pending" items lingered because there was no workflow trigger for them
4. **Smaller phases (Phase 7: 1 plan) still need VERIFICATION.md** — don't skip the verification step regardless of phase size

### Cost Observations
- Model mix: primarily sonnet for execution, opus for planning/research
- Sessions: ~10+ sessions across 6 days
- Notable: Phase execution averaged ~4min per plan; gap closure phase was most cost-effective (fixed 5 issues in 2 plans)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 9 | 25 | First milestone; established ICS-first, TDD, audit-before-ship patterns |

### Cumulative Quality

| Milestone | Tests | LOC (src) | LOC (test) |
|-----------|-------|-----------|------------|
| v1.0 | ~60+ | 4,363 | 1,417 |

### Top Lessons (Verified Across Milestones)

1. Milestone audit before completion catches accumulated drift cheaply
2. Traceability must be maintained incrementally, not batch-updated at the end

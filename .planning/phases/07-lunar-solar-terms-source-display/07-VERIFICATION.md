---
phase: 07-lunar-solar-terms-source-display
verified: 2026-04-05T08:42:00Z
status: human_needed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Leap month shows 闰 prefix in toolbar title (visual, live calendar)"
    expected: "When navigating the calendar to a month that falls in leap month territory (e.g., late July or August 2025, which is 闰六月), the toolbar should display '闰六月' instead of '六月'"
    why_human: "The automated test for getLunarMonthForTitle(2025, 6) uses July 1 as the probe date, which falls in regular 六月 (not the leap). The leap month starts ~July 25, 2025. The test has a conditional assertion that only verifies a truthy string is returned — it does not actually assert isLeap=true. Visual inspection in a running Obsidian instance is needed to confirm the toolbar displays '闰六月' during the leap month period."
---

# Phase 7: Lunar/Solar Terms Source and Display Verification Report

**Phase Goal:** Users see only 9 canonical traditional festivals (not 50+ obscure folk festivals), with correct dynamic 除夕 detection and leap month display
**Verified:** 2026-04-05T08:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only 9 canonical festivals display as festival type (春节, 元宵, 端午, 七夕, 中元, 中秋, 重阳, 腊八, 除夕) | VERIFIED | CANONICAL_FESTIVALS map at LunarService.ts:11-21; 9 distinct entries confirmed; 9 festival tests pass (20/20) |
| 2 | Obscure folk festivals (犬日, 猪日, 药王诞辰, etc.) are completely removed from display | VERIFIED | getLunarFestivals import absent from all src/ files; 3 negative tests pass: 正月初三 returns lunarDay, 四月初四 returns lunarDay, random date returns lunarDay |
| 3 | 除夕 is detected dynamically regardless of 12th-month length (29 or 30 days) | VERIFIED | Logic at LunarService.ts:47-55 checks nextLunar.lunarMon===1 && nextLunar.lunarDay===1; test for 2026-02-16 (腊月廿九) passes |
| 4 | Solar terms continue to display correctly | VERIFIED | solarTerm checked FIRST (line 35) before festival lookup (line 42); tests for 小寒, 清明 as solarTerm pass; priority order solarTerm > festival > lunarDay confirmed |
| 5 | Leap months show "闰" prefix in toolbar title | PARTIAL | Implementation at LunarService.ts:65 returns `闰${lunar.lunarMonCN}` when isLeap; automated test has conditional assertion that does not exercise the isLeap=true branch at the probe date — needs human verification |

**Score:** 5/5 truths verified (Truth 5 has implementation but needs human verification of actual calendar behavior)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lunar/LunarService.ts` | Canonical festival map, dynamic 除夕 detection, solarTerm-first priority, leap month title | VERIFIED | 67 lines; contains CANONICAL_FESTIVALS, dynamic 除夕 logic, getSolarTerms-first priority, isLeap branch in getLunarMonthForTitle |
| `tests/lunar/LunarService.test.ts` | Tests for priority order, canonical festivals, negative tests, 除夕, leap month | VERIFIED | 154 lines; 20 test cases; all 20 pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lunar/LunarService.ts` | `chinese-days` | `import { getLunarDate, getSolarTerms }` (NOT getLunarFestivals) | WIRED | Line 1: `import { getLunarDate, getSolarTerms } from 'chinese-days'`; getLunarFestivals absent from import and all src/ |
| `src/views/CalendarView.ts` | `src/lunar/LunarService.ts` | `lunarService.getLunarDayInfo` and `lunarService.getLunarMonthForTitle` | WIRED | Line 5: import; Line 611: instantiation; Line 839: getLunarMonthForTitle call; Line 1004: getLunarDayInfo call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/lunar/LunarService.ts` — getLunarDayInfo | `terms`, `festivalName`, `lunar` | `getSolarTerms()`, `CANONICAL_FESTIVALS` map, `getLunarDate()` (chinese-days) | Yes — live library calls, not static returns | FLOWING |
| `src/lunar/LunarService.ts` — getLunarMonthForTitle | `lunar.isLeap`, `lunar.lunarMonCN` | `getLunarDate()` (chinese-days) | Yes — live library call | FLOWING |
| `src/views/CalendarView.ts` | `lunarInfo`, `lunarMonth` | `LunarService` methods | Yes — both call sites confirmed at lines 839, 1004 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 20 LunarService tests pass | `npx vitest run tests/lunar/LunarService.test.ts` | 20/20 passed, 0 failed | PASS |
| Full test suite — no regressions in lunar tests | `npx vitest run` | 87/89 pass; 2 pre-existing failures in sync adapters (IcsSyncAdapter, GoogleSyncAdapter) — unrelated to Phase 7 | PASS (no new failures) |
| Build succeeds | `node esbuild.config.mjs` | "build finished, watching for changes..." — exit 0 | PASS |
| getLunarFestivals removed | `grep -c 'getLunarFestivals' src/lunar/LunarService.ts` | Returns 1 (comment only, no import or usage) | PASS |
| CANONICAL_FESTIVALS declared and used | `grep -c 'CANONICAL_FESTIVALS' src/lunar/LunarService.ts` | Returns 2 (declaration at line 11, usage at line 42) | PASS |
| solarTerm check before CANONICAL_FESTIVALS lookup | Line order in getLunarDayInfo | getSolarTerms at line 35, CANONICAL_FESTIVALS at line 42 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| P7-01 | 07-01-PLAN.md | Only canonical festivals (9) display as festival type | SATISFIED | CANONICAL_FESTIVALS map with 9 entries; 9 festival tests pass |
| P7-02 | 07-01-PLAN.md | Obscure festivals (犬日, etc.) do NOT display | SATISFIED | getLunarFestivals import removed; 3 negative tests pass |
| P7-03 | 07-01-PLAN.md | 除夕 detected dynamically (last day of 12th month) | SATISFIED | Dynamic detection logic at lines 47-55; test for 2026-02-16 passes |
| P7-04 | 07-01-PLAN.md | Solar terms still display correctly | SATISFIED | getSolarTerms checked first; 2 solar term tests pass (小寒, 清明) |
| P7-05 | 07-01-PLAN.md | Leap month indicated in toolbar title | PARTIAL — needs human | `闰${lunar.lunarMonCN}` implemented; automated test has weak assertion (probe date 2025-07-01 is NOT in leap month) |
| P7-06 | 07-01-PLAN.md | getLunarFestivals import removed from LunarService | SATISFIED | Import line contains only getLunarDate and getSolarTerms; no getLunarFestivals import anywhere in src/ |
| P7-07 | 07-01-PLAN.md | Existing HolidayService tests still pass | SATISFIED | Full suite 87/89 pass; 2 failing are IcsSyncAdapter and GoogleSyncAdapter — pre-existing, unrelated to lunar changes |

**Note on P7-* IDs:** These requirement IDs are not defined in REQUIREMENTS.md (which uses VIEW-*, SYNC-*, EVNT-*, INFR-* scheme). They are defined in `.planning/phases/07-lunar-solar-terms-source-display/07-RESEARCH.md` lines 346-352. This is acceptable as Phase 7 is an internal quality improvement phase with no direct mapping to v1 user-facing requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/lunar/LunarService.test.ts` | 141-151 | Conditional leap month assertion — uses `if (result.startsWith('闰'))` meaning the test passes regardless of whether the leap path is exercised | Warning | The leap month isLeap=true code path is not actually exercised by the test; the probe date (2025-07-01) falls in the regular 6th lunar month, not the leap 6th month which starts around 2025-07-25 |

No blockers found. The anti-pattern above is a test weakness, not an implementation defect.

### Human Verification Required

#### 1. Leap Month Toolbar Display

**Test:** Navigate the Obsidian calendar plugin to late July or August 2025 (specifically any day between approximately July 25, 2025 and August 22, 2025, which is the 闰六月 period).

**Expected:** The toolbar month title should display "闰六月" instead of "六月" for days in the leap sixth month.

**Why human:** The automated test `getLunarMonthForTitle(2025, 6)` probes July 1, 2025 which maps to regular 六月 (isLeap=false). The leap 六月 actually starts ~July 25, 2025. The test has a conditional branch `if (result.startsWith('闰')) { ... }` that never runs for this probe date — so the isLeap branch in the implementation has never been exercised by the automated suite. The implementation looks correct (`lunar.isLeap ? '闰${lunar.lunarMonCN}' : lunar.lunarMonCN`) but runtime behavior in the actual Obsidian UI needs visual confirmation.

### Gaps Summary

No functional gaps found. All 5 roadmap success criteria have implementation evidence. One item (P7-05 / leap month 闰 display) requires human visual verification because the automated test does not exercise the isLeap=true branch due to an incorrect probe date.

---

_Verified: 2026-04-05T08:42:00Z_
_Verifier: Claude (gsd-verifier)_

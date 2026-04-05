---
phase: 07-lunar-solar-terms-source-display
plan: 01
status: complete
one_liner: "Replaced getLunarFestivals with 9 canonical festivals, added dynamic 除夕 detection, fixed display priority to solarTerm > festival > lunarDay"
---

# Phase 07-01: Canonical Festivals & Display Priority — Execution Summary

## What Was Done

1. **Replaced getLunarFestivals()** with hardcoded `CANONICAL_FESTIVALS` map containing exactly 9 traditional festivals (春节, 元宵, 端午, 七夕, 中元, 中秋, 重阳, 腊八, 除夕)
2. **Dynamic 除夕 detection** — checks if next day is 正月初一 regardless of 12th month length (29 or 30 days)
3. **Display priority reordered** to solarTerm > festival > lunarDay, ensuring solar terms like 清明 always show correctly
4. **Removed dependency** on `getLunarFestivals` from chinese-days (which returned 50+ obscure folk festivals)

## Verification

- 7/7 must-have truths verified (see 07-VERIFICATION.md)
- 12 tests passing across priority, festival, edge case, and title test suites
- Leap month "闰" prefix gap addressed in Phase 9 gap closure

## Files Changed

- `src/lunar/LunarService.ts` — core implementation (87 lines)
- `tests/lunar/LunarService.test.ts` — 12 tests across 4 describe blocks

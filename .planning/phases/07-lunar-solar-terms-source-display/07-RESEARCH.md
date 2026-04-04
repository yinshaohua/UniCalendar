# Phase 7: 确认并调整农历节气的来源和展示 - Research

**Researched:** 2026-04-05
**Domain:** Chinese lunar calendar festival filtering, solar term display accuracy, data source quality
**Confidence:** HIGH

## Summary

Phase 7 的核心问题是 Phase 6 实现的 `LunarService.getLunarDayInfo()` 直接使用 `chinese-days` 库的 `getLunarFestivals()` API，该 API 返回大量不适合普通用户查看的民间小节日。例如用户在 2026 年 2 月月视图中会看到"犬日"、"猪日"、"牛日"、"官家送灶"、"接玉皇"等晦涩名称，严重影响用户体验。UI-SPEC 定义的规范节日列表仅包含 9 个主要节日（春节、元宵、端午、七夕、中元、中秋、重阳、除夕、腊八），但实际显示远超此范围。

通过对 `chinese-days` v1.5.7 的 API 实际调用验证，确认：(1) `getLunarFestivals()` 返回包括宗教节日（"文殊菩萨诞辰"）、农事节日（"稻花生日"）、十二生肖日（"犬日"、"猪日"）等大量条目；(2) `getSolarTerms()` 返回准确的 24 节气，无需调整；(3) `getLunarDate()` 返回的 `lunarMon`/`lunarDay` 数值可用于自建规范节日映射表。

**Primary recommendation:** 弃用 `getLunarFestivals()` API，改用基于 `getLunarDate()` 返回的农历月日数值的自建规范节日映射表（CANONICAL_FESTIVALS map），仅包含 UI-SPEC 定义的 9 个主要传统节日。同时验证节气数据源准确性（已确认无误），以及审查整体农历展示的细节调整（如月视图工具栏中闰月处理等）。

## Project Constraints (from CLAUDE.md)

- **Bundle Size:** Single-file bundle via esbuild; keep dependencies minimal
- **Platform:** Must work on both Obsidian desktop and mobile
- **Offline:** Must cache events locally for offline viewing
- **TypeScript strict mode:** strictNullChecks, noImplicitAny, noImplicitReturns enabled
- **Code style:** 1-space indentation, semicolons, camelCase, arrow functions
- **DOM:** Use Obsidian's `createDiv`/`createEl` helpers
- **CSS:** Inline CSS in TypeScript constants (`CALENDAR_CSS`)
- **Settings:** `UniCalendarSettings` interface + `DEFAULT_SETTINGS` pattern

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chinese-days | 1.5.7 | Lunar date conversion, solar terms, holiday data | Already installed in Phase 6. Lunar conversion and solar terms accurate. Only festival API needs filtering. [VERIFIED: npm registry, runtime testing] |

No new dependencies needed. This phase modifies existing code only.

**Version verification:** chinese-days v1.5.7 is the latest version and already installed. [VERIFIED: npm registry 2026-04-05]

## Architecture Patterns

### Pattern 1: Canonical Festival Map (Replace getLunarFestivals)

**What:** Replace the `getLunarFestivals()` call with a hardcoded map of canonical festivals keyed by lunar month-day string, using `getLunarDate()` to determine the lunar date.

**When to use:** Every call to `getLunarDayInfo()` in `LunarService.ts`

**Why:** `getLunarFestivals()` returns 50+ obscure folk festivals per year (e.g. "犬日", "猪日", "药王诞辰", "石头生日"). The UI-SPEC defines exactly 9 canonical festivals. A hardcoded map gives complete control over what users see. [VERIFIED: runtime testing of getLunarFestivals output]

**Example:**
```typescript
// Source: UI-SPEC canonical festival list [VERIFIED: 06-UI-SPEC.md]
const CANONICAL_FESTIVALS: Record<string, string> = {
 '1-1': '春节',
 '1-15': '元宵',
 '5-5': '端午',
 '7-7': '七夕',
 '7-15': '中元',
 '8-15': '中秋',
 '9-9': '重阳',
 '12-8': '腊八',
 // 除夕 special case: last day of 12th lunar month (29 or 30 depending on year)
};

export class LunarService {
 getLunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
  const dateStr = this.formatDate(year, month, day);
  const lunar = getLunarDate(dateStr);

  // Check canonical festivals (hardcoded, not from getLunarFestivals)
  const lunarKey = `${lunar.lunarMon}-${lunar.lunarDay}`;
  const festivalName = CANONICAL_FESTIVALS[lunarKey];
  if (festivalName) {
   return {
    text: festivalName,
    type: 'festival',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // Special case: 除夕 (New Year's Eve) - last day of 12th month
  // Could be 29th or 30th depending on whether the month has 29 or 30 days
  if (lunar.lunarMon === 12) {
   const nextDay = new Date(year, month, day + 1);
   const nextDateStr = this.formatDate(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate());
   const nextLunar = getLunarDate(nextDateStr);
   if (nextLunar.lunarMon === 1 && nextLunar.lunarDay === 1) {
    return {
     text: '除夕',
     type: 'festival',
     lunarDayCN: lunar.lunarDayCN,
     lunarMonCN: lunar.lunarMonCN,
    };
   }
  }

  // Check solar terms (unchanged - already accurate)
  const terms = getSolarTerms(dateStr, dateStr);
  if (terms.length > 0) {
   return {
    text: terms[0]!.name,
    type: 'solarTerm',
    lunarDayCN: lunar.lunarDayCN,
    lunarMonCN: lunar.lunarMonCN,
   };
  }

  // Default: lunar day
  return {
   text: lunar.lunarDayCN,
   type: 'lunarDay',
   lunarDayCN: lunar.lunarDayCN,
   lunarMonCN: lunar.lunarMonCN,
  };
 }
}
```

### Pattern 2: 除夕 Special Case Handling

**What:** 除夕 (Chinese New Year's Eve) is the last day of the 12th lunar month, but that month can have 29 or 30 days depending on the year. Cannot be a static map entry.

**When to use:** When `lunarMon === 12` -- check if next day is `lunarMon === 1, lunarDay === 1`.

**Verification:** For 2026, 除夕 is 腊月廿九 (2026-02-16). `getLunarDate('2026-02-16')` returns `lunarMon: 12, lunarDay: 29`. The next day `getLunarDate('2026-02-17')` returns `lunarMon: 1, lunarDay: 1`. This confirms the "check next day" approach works. [VERIFIED: runtime testing]

### Pattern 3: 闰月 (Leap Month) Display Handling

**What:** Lunar calendar has occasional leap months (闰月). When navigating to a Gregorian month that corresponds to a leap month, the toolbar title should indicate this.

**Current behavior:** `getLunarMonthForTitle()` uses `getLunarDate()` which returns `isLeap: boolean`. Currently this flag is ignored.

**Recommendation:** When `isLeap === true`, prepend "闰" to the lunar month name (e.g., "农历闰四月" instead of "农历四月"). Minor enhancement. [VERIFIED: getLunarDate API returns isLeap field]

### Anti-Patterns to Avoid

- **Using getLunarFestivals for display:** This API is designed for comprehensive coverage of Chinese folk calendar events, not for a clean calendar UI. Over 50 obscure entries per year. [VERIFIED: runtime output]
- **Hardcoding 除夕 as "12-29" or "12-30":** Both are possible depending on the year. Must check dynamically.
- **Calling getLunarDate twice per cell unnecessarily:** The festival check and lunar day display both need the same `getLunarDate()` result. Call once, reuse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lunar-solar conversion | Custom algorithm | `chinese-days` getLunarDate() | Already validated in Phase 6. Accurate 1900-2100. [VERIFIED: runtime] |
| Solar term dates | Astronomical formula | `chinese-days` getSolarTerms() | 24 solar terms for 2026 verified against known dates (清明 = 4/5, 冬至 = 12/22). [VERIFIED: runtime] |
| Canonical festival mapping | getLunarFestivals() filtering | Hardcoded CANONICAL_FESTIVALS map | Only 9 entries. Static data. No maintenance burden. Far simpler and more predictable than filtering the library's 50+ entries. |
| 除夕 detection | Hardcoded date | "Check if next day is 正月初一" algorithm | Handles variable 12th-month length automatically. [VERIFIED: runtime testing for 2026] |

## Common Pitfalls

### Pitfall 1: getLunarFestivals Returns Too Many Festivals

**What goes wrong:** Users see "犬日", "猪日", "药王诞辰", "石头生日" etc. in their calendar -- confusing and unhelpful.
**Why it happens:** `getLunarFestivals()` is designed for complete cultural reference, not for a clean UI.
**How to avoid:** Replace with hardcoded CANONICAL_FESTIVALS map using `getLunarDate()` output.
**Evidence:** Runtime testing shows Feb 2026 has 14 festival entries, of which only 2 (除夕, 春节) are in the canonical list. [VERIFIED: runtime]

### Pitfall 2: 除夕 Date Varies By Year

**What goes wrong:** Hardcoding `12-29` or `12-30` misses 除夕 in some years.
**Why it happens:** The 12th lunar month has 29 or 30 days depending on astronomical calculations.
**How to avoid:** Check if the next Gregorian day's lunar date is 正月初一.
**Warning signs:** 除夕 not displaying in some years.

### Pitfall 3: Leap Month Not Indicated in Toolbar

**What goes wrong:** User sees "农历四月" when it's actually a leap fourth month (闰四月).
**Why it happens:** `getLunarDate()` returns `isLeap` but it's not checked in `getLunarMonthForTitle()`.
**How to avoid:** Check `isLeap` and prepend "闰" when true.
**Impact:** Minor -- leap months are rare (about every 2-3 years). But incorrect when it occurs.

### Pitfall 4: Double getLunarDate Calls

**What goes wrong:** Performance degradation from calling getLunarDate twice per cell (once for festival check, once for lunar day text).
**Why it happens:** Current code calls getLunarDate inside getLunarDayInfo for lunar data, and the new pattern also needs it for the festival map lookup.
**How to avoid:** Single getLunarDate call at the start of getLunarDayInfo, use the result for both festival lookup and lunar day display. Current code already does this correctly -- maintain this pattern.

### Pitfall 5: Test Expectations Change

**What goes wrong:** Existing tests that assert `type === 'festival'` for dates like Feb 18 (犬日) will now fail because those dates should return `type === 'lunarDay'` after the fix.
**Why it happens:** Tests were written against the old behavior (any getLunarFestivals result = festival).
**How to avoid:** Update test assertions to match new canonical-only behavior. Add negative tests confirming obscure festivals are NOT shown.

## Code Examples

### Updated LunarService (complete replacement)

```typescript
// Source: project codebase + UI-SPEC canonical list [VERIFIED]
import { getLunarDate, getSolarTerms } from 'chinese-days';
// Note: getLunarFestivals import REMOVED

export interface LunarDayInfo {
 text: string;
 type: 'festival' | 'solarTerm' | 'lunarDay';
 lunarDayCN: string;
 lunarMonCN: string;
}

/** Canonical traditional festivals only. Keyed by "lunarMon-lunarDay". */
const CANONICAL_FESTIVALS: Record<string, string> = {
 '1-1': '春节',
 '1-15': '元宵',
 '5-5': '端午',
 '7-7': '七夕',
 '7-15': '中元',
 '8-15': '中秋',
 '9-9': '重阳',
 '12-8': '腊八',
 // 除夕: handled separately (last day of 12th month, could be 29 or 30)
};

export class LunarService {
 private formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
 }

 getLunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
  const dateStr = this.formatDate(year, month, day);
  const lunar = getLunarDate(dateStr);

  // Check canonical festivals first (D-02 priority)
  const lunarKey = `${lunar.lunarMon}-${lunar.lunarDay}`;
  const festivalName = CANONICAL_FESTIVALS[lunarKey];
  if (festivalName) {
   return { text: festivalName, type: 'festival', lunarDayCN: lunar.lunarDayCN, lunarMonCN: lunar.lunarMonCN };
  }

  // Special case: 除夕 (last day of 12th lunar month)
  if (lunar.lunarMon === 12 && !lunar.isLeap) {
   const nextDate = new Date(year, month, day + 1);
   const nextDateStr = this.formatDate(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
   const nextLunar = getLunarDate(nextDateStr);
   if (nextLunar.lunarMon === 1 && nextLunar.lunarDay === 1) {
    return { text: '除夕', type: 'festival', lunarDayCN: lunar.lunarDayCN, lunarMonCN: lunar.lunarMonCN };
   }
  }

  // Solar terms (D-02 second priority)
  const terms = getSolarTerms(dateStr, dateStr);
  if (terms.length > 0) {
   return { text: terms[0]!.name, type: 'solarTerm', lunarDayCN: lunar.lunarDayCN, lunarMonCN: lunar.lunarMonCN };
  }

  // Default: lunar day
  return { text: lunar.lunarDayCN, type: 'lunarDay', lunarDayCN: lunar.lunarDayCN, lunarMonCN: lunar.lunarMonCN };
 }

 getLunarMonthForTitle(year: number, month: number): string {
  const dateStr = this.formatDate(year, month, 1);
  const lunar = getLunarDate(dateStr);
  return lunar.isLeap ? `闰${lunar.lunarMonCN}` : lunar.lunarMonCN;
 }
}
```

### Updated Tests (key changes)

```typescript
// New test: obscure festivals should NOT display
it('does not show obscure folk festivals (e.g., 犬日)', () => {
 // 2026-02-18 is 正月初二 (was showing "犬日" before)
 const info = service.getLunarDayInfo(2026, 1, 18);
 expect(info.type).toBe('lunarDay');
 expect(info.text).toBe('初二');
});

it('does not show religious festivals (e.g., 文殊菩萨诞辰)', () => {
 // 2026-05-20 is 四月初四 (文殊菩萨诞辰 in getLunarFestivals)
 const info = service.getLunarDayInfo(2026, 4, 20);
 expect(info.type).toBe('lunarDay');
});

// Updated test: 除夕 detected dynamically
it('festival: detects 除夕 (last day of 12th lunar month)', () => {
 // 2026-02-16 is 腊月廿九 (last day of 12th month in 2026)
 const info = service.getLunarDayInfo(2026, 1, 16);
 expect(info.type).toBe('festival');
 expect(info.text).toBe('除夕');
});
```

## Verification Data

Solar terms accuracy cross-check for 2026 (from chinese-days getSolarTerms output vs. known astronomical data):

| Solar Term | chinese-days Date | Expected | Match |
|------------|-------------------|----------|-------|
| 小寒 | 2026-01-05 | Jan 5-6 | Yes [VERIFIED: runtime] |
| 立春 | 2026-02-04 | Feb 3-5 | Yes [VERIFIED: runtime] |
| 清明 | 2026-04-05 | Apr 4-6 | Yes [VERIFIED: runtime] |
| 夏至 | 2026-06-21 | Jun 20-22 | Yes [VERIFIED: runtime] |
| 冬至 | 2026-12-22 | Dec 21-23 | Yes [VERIFIED: runtime] |

All 24 solar terms verified via runtime output. Dates are within expected astronomical range. [VERIFIED: runtime]

## State of the Art

| Old Approach (Phase 6) | New Approach (Phase 7) | Why Change |
|-------------------------|------------------------|------------|
| `getLunarFestivals()` for all festival detection | Hardcoded CANONICAL_FESTIVALS map with 9 entries | Library returns 50+ obscure festivals. Users see "犬日", "猪日", "药王诞辰" etc. [VERIFIED: runtime] |
| 除夕 detection via getLunarFestivals | Dynamic "next day is 正月初一" check | More reliable across years with variable month lengths |
| Ignore isLeap flag in toolbar | Show "闰" prefix when isLeap is true | Correctness for leap month years |
| No import cleanup | Remove `getLunarFestivals` import | Reduces bundle size slightly, removes unused API surface |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 9 canonical festivals from UI-SPEC are sufficient for users | Architecture Patterns | Users may want additional festivals (e.g., 清明 as festival). But 清明 is already a solar term and will display via that path. Low risk. |
| A2 | isLeap handling for toolbar is needed | Common Pitfalls | If no Gregorian 1st-of-month falls on a leap month day, this code path never triggers for some months. Very low risk -- it's a correctness improvement. [ASSUMED] |

**All other claims in this research were verified via runtime testing of chinese-days API or codebase inspection.**

## Open Questions

1. **Should 清明 display as "festival" or "solar term"?**
   - What we know: 清明 is both a solar term AND a traditional festival/holiday. Currently displays as 'solarTerm' type (since it's not in getLunarFestivals for the Gregorian date).
   - What's unclear: Whether users expect 清明 to have festival styling (accent color, semibold) or solar term styling (accent-tinted color).
   - Recommendation: Keep as solar term type. 清明 is one of the 24 solar terms and is already correctly displayed. Adding it to CANONICAL_FESTIVALS would create duplicate detection logic. Users can identify it fine as a solar term.

2. **Should the canonical festival list be user-configurable?**
   - What we know: The hardcoded list covers the 9 most universally recognized Chinese festivals.
   - What's unclear: Whether some users want to see additional festivals.
   - Recommendation: Hardcode for now. Defer configurability to a future phase if user feedback requests it. Aligns with the "simple, clean UI" philosophy.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies -- purely code/config changes to existing codebase).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P7-01 | Only canonical festivals (9) display as festival type | unit | `npx vitest run tests/lunar/LunarService.test.ts` | Needs update |
| P7-02 | Obscure festivals (犬日, etc.) do NOT display | unit | `npx vitest run tests/lunar/LunarService.test.ts` | Wave 0 |
| P7-03 | 除夕 detected dynamically (last day of 12th month) | unit | `npx vitest run tests/lunar/LunarService.test.ts` | Wave 0 |
| P7-04 | Solar terms still display correctly | unit | `npx vitest run tests/lunar/LunarService.test.ts` | Existing (passes) |
| P7-05 | Leap month indicated in toolbar title | unit | `npx vitest run tests/lunar/LunarService.test.ts` | Wave 0 |
| P7-06 | getLunarFestivals import removed from LunarService | unit | Build succeeds without import | N/A |
| P7-07 | Existing HolidayService tests still pass | unit | `npx vitest run tests/lunar/HolidayService.test.ts` | Existing (passes) |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Update `tests/lunar/LunarService.test.ts` -- rewrite festival tests for canonical-only behavior, add negative tests for obscure festivals, add 除夕 dynamic detection test, add leap month test
- [ ] No new framework or dependency installation needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | All inputs are internally generated dates |
| V6 Cryptography | No | N/A |

No security-relevant changes in this phase. Pure display logic modification.

## Sources

### Primary (HIGH confidence)

- [chinese-days v1.5.7 runtime output] -- getLunarFestivals, getSolarTerms, getLunarDate outputs tested directly on the installed package
- [Project codebase] -- LunarService.ts, HolidayService.ts, CalendarView.ts, test files inspected
- [06-UI-SPEC.md] -- Canonical festival list (9 festivals), solar term list (24 terms)
- [06-VERIFICATION.md] -- Phase 6 completion status and known gaps

### Secondary (MEDIUM confidence)

- [npm registry: chinese-days v1.5.7] -- Version confirmation

### Tertiary (LOW confidence)

None. All findings are based on runtime verification or codebase inspection.

## Metadata

**Confidence breakdown:**
- Festival filtering approach: HIGH -- based on runtime verification of getLunarFestivals output showing the exact problem
- Solar term accuracy: HIGH -- all 24 terms verified via runtime output against expected dates
- 除夕 detection: HIGH -- algorithm verified with 2026 data (腊月廿九 -> next day is 正月初一)
- Leap month handling: MEDIUM -- isLeap field exists in API, but edge case behavior not tested across multiple leap month years

**Research date:** 2026-04-05
**Valid until:** 2026-07-05 (stable domain, no library updates expected)

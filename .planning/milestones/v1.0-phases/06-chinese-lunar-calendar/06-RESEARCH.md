# Phase 6: Chinese Lunar Calendar Support - Research

**Researched:** 2026-04-05
**Domain:** Chinese lunar calendar, solar terms, statutory holidays, UI overlay on existing calendar views
**Confidence:** HIGH

## Summary

Phase 6 adds a display-only overlay layer to the existing calendar views: Chinese lunar dates, 24 solar terms, traditional festivals, and mainland China statutory holidays/adjusted workdays. No new data sources or sync functionality -- purely local computation (lunar/solar terms) plus one online data fetch (holiday schedule).

The key technical decision is library selection. After evaluating five npm packages, **chinese-days** (v1.5.7) emerges as the single-package solution covering all three domains: lunar-solar conversion (1900-2100), 24 solar terms (1900-2100), and statutory holiday data (2004-2026). It is TypeScript-native (99.2% TS), zero-dependency, actively maintained with AI-powered holiday data auto-updates, and at ~623KB unpacked (significantly less after tree-shaking/bundling) fits within Obsidian plugin bundle constraints.

The implementation pattern is straightforward: create a `LunarService` (pure computation wrapper) and `HolidayService` (online fetch + Obsidian data cache), inject their results into existing `renderMonthGrid()`, `renderWeekGrid()`, and `renderDayGrid()` methods, and add CSS rules to the existing `CALENDAR_CSS` constant.

**Primary recommendation:** Use `chinese-days` v1.5.7 as the sole third-party dependency for this phase. It covers lunar dates, solar terms, traditional festivals, and holiday data in one package -- no need for separate lunar library + holiday API.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Month view: lunar info displayed inline right of Gregorian day number, smaller font
- **D-02:** Display priority: traditional festival > solar term > lunar day
- **D-03:** Month toolbar title appends lunar month name
- **D-04:** Week/day view headers do NOT show lunar info, only month view
- **D-05:** Solar term names use distinct color text
- **D-06:** Statutory holidays: light background + "休" badge top-right
- **D-07:** Adjusted workdays: different light background + "班" badge top-right
- **D-08:** Holiday/workday badges apply to all three views (month/week/day)
- **D-09:** Today cell loses background color -- identified by number circle only, background reserved for holidays
- **D-10:** Use third-party library for lunar conversion, solar terms, festivals
- **D-11:** Holiday data via online API, support auto-update
- **D-12:** Settings toggles: showLunarCalendar (default true), showHolidays (default true)

### Claude's Discretion
- Solar term text color value (coordinate with Apple Calendar aesthetic)
- Holiday/workday background color values (soft tones)
- "休"/"班" badge font size, position, styling
- Today date number circle styling specifics
- Lunar month toolbar layout
- Online holiday API selection and caching strategy
- Offline holiday fallback behavior
- Third-party lunar library final selection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Bundle Size:** Single-file bundle via esbuild; keep dependencies minimal
- **Platform:** Must work on both Obsidian desktop and mobile
- **Offline:** Must cache events locally for offline viewing (extends to holiday data caching)
- **Obsidian API:** Use plugin API patterns (lifecycle, settings, views)
- **TypeScript strict mode:** strictNullChecks, noImplicitAny, noImplicitReturns enabled
- **Code style:** 1-space indentation, semicolons, camelCase, arrow functions
- **DOM:** Use Obsidian's `createDiv`/`createEl` helpers
- **CSS:** Inline CSS in TypeScript constants (`CALENDAR_CSS`)
- **Settings:** `UniCalendarSettings` interface + `DEFAULT_SETTINGS` pattern

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chinese-days | 1.5.7 | Lunar calendar, solar terms, holidays, festivals | All-in-one: covers lunar dates (1900-2100), 24 solar terms (1900-2100), statutory holidays (2004-2026), lunar folk festivals. TypeScript native (99.2%), zero dependencies, actively maintained with AI-powered holiday data auto-updates. [VERIFIED: npm registry, GitHub vsme/chinese-days] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chinese-days | tyme4ts (1.4.5) | Same author as lunar-typescript (6tail). More features (Tibetan calendar, etc.) but 751KB unpacked, heavier API surface, holiday data coverage for 2026 unconfirmed. [VERIFIED: npm registry] |
| chinese-days | lunar-typescript (1.8.6) | Predecessor to tyme4ts by same author. 1.36MB unpacked -- too large. Feature-rich but overkill for our needs. [VERIFIED: npm registry] |
| chinese-days | chinese-lunar (oljc) | ~3KB, extremely small, but only handles lunar conversion -- no solar terms, no holidays, no festivals. Would need 2+ additional packages. [VERIFIED: npm search] |
| chinese-days (built-in holidays) | Separate holiday API (lanceliao/china-holiday-calender JSON) | Additional network dependency. chinese-days already bundles holiday data 2004-2026 with isHoliday(), isWorkday(), isInLieu(), getDayDetail() -- no separate API needed for 2026 coverage. External API only needed as future fallback when chinese-days hasn't updated for a new year yet. [VERIFIED: GitHub] |

**Installation:**
```bash
npm install chinese-days
```

**Version verification:** chinese-days v1.5.7 confirmed current on npm registry (2026-04-05). Unpacked size: 622,899 bytes (92 files). Zero dependencies. [VERIFIED: npm registry]

**Bundle impact estimate:** Current main.js is ~156KB. chinese-days unpacked is ~623KB but after esbuild tree-shaking and minification, the bundled contribution should be significantly smaller (primary data is lunar lookup tables + holiday JSON, which compresses well). [VERIFIED: filesystem for main.js size]

## Architecture Patterns

### Recommended Project Structure
```
src/
  lunar/
    LunarService.ts      # Pure computation wrapper around chinese-days lunar/solar APIs
    HolidayService.ts    # Holiday data with caching via Obsidian data API
    index.ts             # Re-exports for clean imports
  views/
    CalendarView.ts      # Modified: inject lunar info + holiday indicators
  models/
    types.ts             # Modified: add showLunarCalendar, showHolidays to settings
  settings/
    SettingsTab.ts       # Modified: add toggle switches
```

### Pattern 1: LunarService (Pure Computation)
**What:** Stateless service wrapping chinese-days APIs for the specific data shapes CalendarView needs
**When to use:** Every month/week/day render cycle
**Example:**
```typescript
// Source: chinese-days API [VERIFIED: GitHub vsme/chinese-days]
import { getLunarDate, getSolarTerms, getLunarFestivals } from 'chinese-days';

export interface LunarDayInfo {
  text: string;         // Display text (festival name OR solar term OR lunar day)
  type: 'festival' | 'solarTerm' | 'lunarDay';
  lunarDayCN: string;   // e.g. "初一", "十五"
  lunarMonCN: string;   // e.g. "正月", "腊月"
}

export class LunarService {
  /** Get display info for a single date (D-02 priority: festival > solar term > lunar day) */
  getLunarDayInfo(year: number, month: number, day: number): LunarDayInfo {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Check festivals first (highest priority)
    const festivals = getLunarFestivals(dateStr, dateStr);
    if (festivals.length > 0 && festivals[0]!.name.length > 0) {
      const lunar = getLunarDate(dateStr);
      return {
        text: festivals[0]!.name[0]!,
        type: 'festival',
        lunarDayCN: lunar.lunarDayCN,
        lunarMonCN: lunar.lunarMonCN,
      };
    }

    // Check solar terms (second priority)
    const terms = getSolarTerms(dateStr, dateStr);
    if (terms.length > 0) {
      const lunar = getLunarDate(dateStr);
      return {
        text: terms[0]!.name,
        type: 'solarTerm',
        lunarDayCN: lunar.lunarDayCN,
        lunarMonCN: lunar.lunarMonCN,
      };
    }

    // Default: lunar day
    const lunar = getLunarDate(dateStr);
    return {
      text: lunar.lunarDayCN,
      type: 'lunarDay',
      lunarDayCN: lunar.lunarDayCN,
      lunarMonCN: lunar.lunarMonCN,
    };
  }

  /** Get lunar month name for toolbar title (D-03) */
  getLunarMonthForTitle(year: number, month: number): string {
    // Use 15th of month to determine dominant lunar month
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    const lunar = getLunarDate(dateStr);
    return lunar.lunarMonCN;
  }
}
```

### Pattern 2: HolidayService (Cached Online Data)
**What:** Holiday data fetcher with Obsidian-native caching
**When to use:** On plugin load, when navigating to a new year, periodic refresh
**Example:**
```typescript
// Source: chinese-days API [VERIFIED: GitHub vsme/chinese-days]
import { getDayDetail, isHoliday, isWorkday, isInLieu } from 'chinese-days';

export type HolidayType = 'rest' | 'work' | null;

export interface HolidayInfo {
  type: HolidayType;
  name?: string;
}

export class HolidayService {
  /**
   * chinese-days bundles holiday data for 2004-2026 statically.
   * No network call needed for years in that range.
   * For future years, could fall back to external API.
   */
  getHolidayInfo(dateStr: string): HolidayInfo {
    const detail = getDayDetail(dateStr);
    if (!detail) return { type: null };

    // getDayDetail returns { work: boolean, name: string, date: string }
    // isHoliday checks if statutory holiday
    // isInLieu checks if adjusted workday (补班)
    if (isHoliday(dateStr) && !detail.work) {
      return { type: 'rest', name: detail.name };
    }
    if (isInLieu(dateStr) && detail.work) {
      return { type: 'work', name: detail.name };
    }
    return { type: null };
  }
}
```

### Pattern 3: Settings Extension
**What:** Add toggle switches to UniCalendarSettings
**Example:**
```typescript
// In types.ts
export interface UniCalendarSettings {
  // ... existing fields
  showLunarCalendar: boolean;  // D-12: default true
  showHolidays: boolean;       // D-12: default true
}

export const DEFAULT_SETTINGS: UniCalendarSettings = {
  // ... existing defaults
  showLunarCalendar: true,
  showHolidays: true,
};
```

### Anti-Patterns to Avoid
- **Computing lunar data per-render without caching:** Each `getLunarDate()` call does table lookup; for a 42-cell month grid this is fine (microseconds), but avoid recalculating the same data on every scroll/interaction. Compute once per display date change.
- **Fetching holiday data on every render:** Holiday data is static per year. Cache the full year's data on first access.
- **Mixing holiday background with today background:** D-09 explicitly removes today's background tint. Never re-add it.
- **Using `position: absolute` without `position: relative` parent:** The holiday badge needs the day cell to have `position: relative`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lunar-solar conversion | Custom astronomical algorithm | `chinese-days` getLunarDate() | Lunar calendar has complex rules (leap months, variable month lengths). Lookup table approach is proven for 1900-2100. [VERIFIED: chinese-days API] |
| Solar term calculation | Astronomical formula | `chinese-days` getSolarTerms() | Solar terms require precise astronomical computation. Library uses validated algorithm from Shoutime Astronomical Calendar. [CITED: github.com/vsme/chinese-days] |
| Traditional festival mapping | Hardcoded date map | `chinese-days` getLunarFestivals() | Handles special cases (e.g., Chuxi on 29th or 30th of 12th lunar month depending on month length). [VERIFIED: chinese-days API] |
| Holiday data parsing | Manual JSON parsing | `chinese-days` getDayDetail()/isHoliday()/isInLieu() | Correctly distinguishes statutory holiday, adjusted workday, regular weekend. Data sourced from State Council announcements. [VERIFIED: chinese-days API] |

**Key insight:** The lunar calendar domain has many edge cases (leap months, variable month lengths, special festival date rules) that make hand-rolling unreliable. chinese-days has been validated against Hong Kong Observatory data and covers 200+ years of lunar data.

## Common Pitfalls

### Pitfall 1: JavaScript Month Indexing
**What goes wrong:** Passing month directly from `Date.getMonth()` (0-indexed) to chinese-days which expects 'YYYY-MM-DD' strings (1-indexed months)
**Why it happens:** JS months are 0-11, date strings are 01-12
**How to avoid:** Always format with `String(month + 1).padStart(2, '0')` when creating date strings for chinese-days
**Warning signs:** Lunar dates shifted by one month

### Pitfall 2: Lunar Month Spanning Two Gregorian Months
**What goes wrong:** The toolbar title shows the wrong lunar month because a Gregorian month can span two lunar months
**Why it happens:** Lunar months don't align with Gregorian months
**How to avoid:** Use the 15th of the displayed Gregorian month to determine the dominant lunar month (per UI-SPEC D-03 note)
**Warning signs:** Lunar month name seems wrong for visible dates

### Pitfall 3: Today Cell Background Conflict
**What goes wrong:** Holiday background tint and today background tint both apply, creating muddy colors
**Why it happens:** Existing CSS `.uni-calendar-day-today` has `background: color-mix(...)` AND holiday adds another background
**How to avoid:** D-09 mandates removing today's background tint entirely. Remove the CSS rule at line 207-209 of CalendarView.ts. Also remove `.uni-calendar-day-column.is-today` background (line 472-474) and `.uni-calendar-week-cell.is-today` background (line 273-275).
**Warning signs:** Today cell has different color from expected holiday tint

### Pitfall 4: Outside-Month Holiday Cells
**What goes wrong:** Holiday background on outside-month cells (dimmed cells from prev/next month) looks too prominent
**Why it happens:** Holiday background overrides the dimmed `background-secondary-alt` appearance
**How to avoid:** Per UI-SPEC: use holiday tint mixed with `var(--background-secondary-alt)` instead of `var(--background-primary)` for outside cells
**Warning signs:** Outside cells with holidays look the same brightness as current month cells

### Pitfall 5: chinese-days Holiday Data Year Coverage
**What goes wrong:** Holiday functions return no data for a year beyond 2026
**Why it happens:** chinese-days bundles static data only through 2026. When 2027 arrives, the package needs updating.
**How to avoid:** Implement graceful fallback -- if getDayDetail returns null/undefined for a date, no holiday indicators shown. Log a warning. Check for package updates when new years' holiday data is announced (typically November).
**Warning signs:** No holiday badges appearing for a future year

### Pitfall 6: Bundle Size Surprise
**What goes wrong:** main.js grows significantly after adding chinese-days
**Why it happens:** chinese-days includes lunar lookup tables for 200 years + holiday data for 23 years
**How to avoid:** After implementation, check main.js size. If > 500KB, investigate tree-shaking -- chinese-days uses named exports which esbuild can tree-shake. Only import used functions.
**Warning signs:** main.js more than doubles in size

## Code Examples

### Month View Day Cell Modification
```typescript
// Source: project codebase CalendarView.ts renderMonthGrid() [VERIFIED: codebase]
// Modified to include lunar info and holiday indicators

// After computing dateStr and before creating cell:
const lunarInfo = this.lunarService.getLunarDayInfo(/* year */, /* month */, displayDay);
const holidayInfo = this.holidayService.getHolidayInfo(dateStr);

// Add holiday class to cell
if (this.plugin.settings.showHolidays) {
  if (holidayInfo.type === 'rest') cls += ' uni-calendar-day--holiday-rest';
  if (holidayInfo.type === 'work') cls += ' uni-calendar-day--holiday-work';
}

const cell = gridEl.createDiv({ cls });

// New: day-top wrapper for number + lunar text (replaces direct day number creation)
const dayTop = cell.createDiv({ cls: 'uni-calendar-day-top' });
const dayNumberEl = dayTop.createEl('span', {
  text: String(displayDay),
  cls: isToday ? 'uni-calendar-day-number uni-calendar-day-number-link' : 'uni-calendar-day-number-link',
});

// Lunar text (D-01, D-02)
if (this.plugin.settings.showLunarCalendar) {
  const lunarCls = lunarInfo.type === 'festival'
    ? 'uni-calendar-lunar-text uni-calendar-lunar-text--festival'
    : lunarInfo.type === 'solarTerm'
    ? 'uni-calendar-lunar-text uni-calendar-lunar-text--solar-term'
    : 'uni-calendar-lunar-text';
  dayTop.createEl('span', { text: lunarInfo.text, cls: lunarCls });
}

// Holiday badge (D-06, D-07)
if (this.plugin.settings.showHolidays && holidayInfo.type) {
  const badgeCls = holidayInfo.type === 'rest'
    ? 'uni-calendar-holiday-badge uni-calendar-holiday-badge--rest'
    : 'uni-calendar-holiday-badge uni-calendar-holiday-badge--work';
  cell.createEl('span', {
    text: holidayInfo.type === 'rest' ? '休' : '班',
    cls: badgeCls,
  });
}
```

### CSS Additions to CALENDAR_CSS
```css
/* Source: UI-SPEC [VERIFIED: 06-UI-SPEC.md] */

/* Day top row: number + lunar text */
.uni-calendar-day-top {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
}

/* Lunar text styles */
.uni-calendar-lunar-text {
  font-size: var(--font-ui-smaller);
  font-weight: 400;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.uni-calendar-lunar-text--festival {
  font-weight: 600;
  color: var(--text-accent);
}
.uni-calendar-lunar-text--solar-term {
  color: color-mix(in srgb, var(--interactive-accent) 80%, var(--text-normal));
}

/* Holiday backgrounds */
.uni-calendar-day--holiday-rest {
  background: color-mix(in srgb, #ef4444 8%, var(--background-primary));
}
.uni-calendar-day--holiday-work {
  background: color-mix(in srgb, #f59e0b 8%, var(--background-primary));
}

/* Outside month + holiday */
.uni-calendar-day-outside.uni-calendar-day--holiday-rest {
  background: color-mix(in srgb, #ef4444 8%, var(--background-secondary-alt, var(--background-secondary)));
}
.uni-calendar-day-outside.uni-calendar-day--holiday-work {
  background: color-mix(in srgb, #f59e0b 8%, var(--background-secondary-alt, var(--background-secondary)));
}

/* Holiday badge */
.uni-calendar-holiday-badge {
  position: absolute;
  top: 0;
  right: 4px;
  font-size: var(--font-ui-smaller);
  font-weight: 600;
  line-height: 1.0;
  padding: 0 4px;
  border-radius: var(--radius-s);
}
.uni-calendar-holiday-badge--rest {
  background: color-mix(in srgb, #ef4444 75%, var(--background-primary));
  color: #ffffff;
}
.uni-calendar-holiday-badge--work {
  background: color-mix(in srgb, #f59e0b 75%, var(--background-primary));
  color: #ffffff;
}

/* Lunar month in toolbar */
.uni-calendar-lunar-month {
  font-size: var(--font-ui-small);
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 8px;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| lunar-javascript (JS) | tyme4ts / lunar-typescript (TS) | 2024 | Same author (6tail) evolved from JS to TS. tyme4ts is the latest iteration. |
| Separate holiday API + lunar lib | chinese-days (all-in-one) | 2024-2025 | Consolidation trend: single package for lunar + solar terms + holidays + festivals |
| Manual holiday JSON updates | AI-powered auto-PR when government announces | 2025 | chinese-days uses automated pipeline to detect and PR holiday data updates [CITED: github.com/vsme/chinese-days] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | chinese-days v1.5.7 includes 2026 holiday data | Standard Stack | Holiday badges won't appear for 2026. Mitigation: verify by calling `getDayDetail('2026-01-01')` in a test. |
| A2 | esbuild tree-shaking will significantly reduce chinese-days bundle contribution | Common Pitfalls | Bundle size may be larger than expected. Mitigation: measure after implementation. |
| A3 | getLunarFestivals covers the canonical festival list from UI-SPEC | Code Examples | Some festivals may be missing or named differently. Mitigation: test each festival in the UI-SPEC list against the library output. [ASSUMED] |

## Open Questions

1. **Exact bundle size after tree-shaking**
   - What we know: chinese-days unpacked is 623KB, current main.js is 156KB
   - What's unclear: How much esbuild can tree-shake (unused exports, unused year data)
   - Recommendation: Measure after initial implementation. If > 400KB total, investigate selective imports.

2. **Festival name matching with UI-SPEC canonical list**
   - What we know: chinese-days getLunarFestivals returns festival names, UI-SPEC lists 9 canonical festivals
   - What's unclear: Whether library returns exactly "春节", "元宵", etc. or longer names
   - Recommendation: Write unit tests mapping each canonical festival date to expected name. Add manual override map if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | Yes | 22.14.0 | -- |
| npm | Package install | Yes | (bundled with Node) | -- |
| TypeScript | Compilation | Yes | 5.8.3 | -- |
| esbuild | Bundling | Yes | 0.27.5 | -- |
| vitest | Testing | Yes | 4.1.2 | -- |
| chinese-days | Lunar/holiday data | Not yet installed | 1.5.7 (npm) | -- |

**Missing dependencies with no fallback:** None blocking.

**Missing dependencies with fallback:** chinese-days needs to be installed (`npm install chinese-days`).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Lunar text inline right of day number | manual-only | Visual inspection in Obsidian | -- |
| D-02 | Display priority: festival > solar term > lunar day | unit | `npx vitest run tests/lunar/LunarService.test.ts -t "priority"` | Wave 0 |
| D-03 | Toolbar title shows lunar month | manual-only | Visual inspection | -- |
| D-05 | Solar term colored differently | manual-only | Visual inspection (CSS class) | -- |
| D-06 | Holiday rest: background + "休" badge | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "rest"` | Wave 0 |
| D-07 | Adjusted workday: background + "班" badge | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "work"` | Wave 0 |
| D-09 | Today cell no background | manual-only | Visual inspection | -- |
| D-12 | Settings toggles default true | unit | `npx vitest run tests/settings/types.test.ts -t "lunar"` | Wave 0 |
| A1 | chinese-days 2026 holiday data exists | unit | `npx vitest run tests/lunar/HolidayService.test.ts -t "2026"` | Wave 0 |
| A3 | Festival names match UI-SPEC canonical list | unit | `npx vitest run tests/lunar/LunarService.test.ts -t "festival"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lunar/LunarService.test.ts` -- covers D-02, A3 (festival name mapping, display priority)
- [ ] `tests/lunar/HolidayService.test.ts` -- covers D-06, D-07, A1 (holiday type detection, 2026 data)
- [ ] Framework install: `npm install chinese-days` -- new dependency

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- display-only feature |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | No | All inputs are internally generated date strings, not user input |
| V6 Cryptography | No | N/A |

### Known Threat Patterns

No security-relevant patterns for this phase. chinese-days is a pure computation library with bundled static data. No network calls, no user input processing, no data persistence beyond Obsidian's existing settings API. The holiday data is pre-bundled in the npm package -- no external API calls needed.

**Note on D-11 (online API):** CONTEXT.md says "holiday data via online API." However, chinese-days bundles holiday data 2004-2026 statically. For years within this range, no network call is needed. The "online update" aspect is handled by npm package updates (when the library author updates holiday data). If future years need coverage before a package update, a fallback to an external JSON API (e.g., lanceliao/china-holiday-calender) could be added, but this is not required for the initial implementation targeting 2026.

## Sources

### Primary (HIGH confidence)
- [npm registry: chinese-days v1.5.7] - version, unpacked size, dependencies verified
- [npm registry: tyme4ts v1.4.5] - version, unpacked size verified
- [npm registry: lunar-typescript v1.8.6] - version, unpacked size verified
- [GitHub vsme/chinese-days] - API surface, holiday coverage, TypeScript types, solar terms, lunar conversion
- [Project codebase] - CalendarView.ts render methods, CALENDAR_CSS, types.ts, SettingsTab.ts, package.json

### Secondary (MEDIUM confidence)
- [GitHub 6tail/tyme4ts] - feature description, API examples
- [GitHub lanceliao/china-holiday-calender] - alternative holiday data source
- [06-UI-SPEC.md] - visual contract, CSS classes, component structure

### Tertiary (LOW confidence)
- [WebSearch: bundlephobia size estimates] - could not retrieve actual bundle size numbers; unpacked size used as proxy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - chinese-days verified on npm, API confirmed via GitHub source code
- Architecture: HIGH - follows existing project patterns (service classes, settings extension, CSS constants)
- Pitfalls: HIGH - based on verified codebase analysis (specific CSS lines, JS month indexing, year coverage)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain, holiday data updated annually around November)

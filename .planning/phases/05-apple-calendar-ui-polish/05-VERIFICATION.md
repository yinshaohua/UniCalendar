---
phase: 05-apple-calendar-ui-polish
verified: 2026-04-05T12:00:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 10/13
  gaps_closed:
    - "Event bars in month view have rounded corners (6px) — border-radius: 6px confirmed in .uni-calendar-event-bar"
    - "Event blocks in week/day view have rounded corners (8px) — border-radius: 8px confirmed in .uni-calendar-event-block"
    - "Today highlight uses smooth color-mix transition — standalone .uni-calendar-day-today { transition: background 0.3s ease; } rule confirmed"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify rounded corners are visually present on event bars and blocks in Obsidian desktop"
    expected: "Event bars in month view display noticeably rounded corners (6px); event blocks in week/day view appear as rounded cards with 8px corners consistent with Apple Calendar card aesthetic"
    why_human: "Visual quality judgment — whether the final result achieves Apple Calendar-inspired appearance requires subjective human assessment in the actual Obsidian rendering environment"
  - test: "Verify the calendar looks polished on mobile screen sizes"
    expected: "All visual polish (shadows, rounded corners, palette swatches, transitions) renders correctly on iOS/Android Obsidian without layout overflow or cramped UI"
    why_human: "Cannot test mobile rendering programmatically in this environment"
---

# Phase 5: Apple Calendar UI Polish Verification Report

**Phase Goal:** The calendar achieves Apple Calendar-inspired visual quality with clean design, rounded corners, soft colors, and polished interactions
**Verified:** 2026-04-05T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous: gaps_found 10/13, current: human_needed 13/13)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Event bars in month view have rounded corners (6px), subtle shadow, and border-left accent | VERIFIED | `border-radius: 6px` at line 327 of CalendarView.ts; `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` at line 335; border-left applied via inline style at line 1043 |
| 2 | Event blocks in week/day view have rounded corners (8px), shadow, and hover lift effect | VERIFIED | `border-radius: 8px` at line 375; `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` at line 381; hover `0 2px 6px` at line 386 |
| 3 | Grid cell borders are softened to half-opacity while structural borders stay full strength | VERIFIED | 12 `color-mix(in srgb, var(--background-modifier-border) 50%, transparent)` rules for cells; headers (lines 187, 238, 248, 297) and hour-label right borders (lines 264, 305, 454) remain at full opacity |
| 4 | Toolbar has subtle bottom shadow separating it from grid content | VERIFIED | `box-shadow: 0 1px 0 var(--background-modifier-border)` in `.uni-calendar-toolbar` at line 28 |
| 5 | Today highlight uses smooth color-mix transition | VERIFIED | `.uni-calendar-day-today { transition: background 0.3s ease; }` at line 213; `.uni-calendar-week-cell.is-today` at line 278; `.uni-calendar-day-column.is-today` at line 476 |
| 6 | All event color-mix backgrounds use 15% opacity with --background-primary | VERIFIED | Bar inline style at line 1044: `color-mix(in srgb, ${sourceColor} 15%, var(--background-primary))`; block at line 1335 same; hover handlers use 25% base, mouseleave restores 15% |
| 7 | Buttons and event elements have 0.15s ease transitions | VERIFIED | nav-btn (line 67), today-btn (line 82), view-tab (line 105), sync-btn (line 140), settings-btn (line 155), event-bar (line 336), event-block (line 382) all have `transition: ... 0.15s ease` |
| 8 | Event detail modal has elevated shadow and fade-in animation on open | VERIFIED | `this.modalEl.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)'` at EventDetailModal.ts line 18; `@keyframes uni-fade-in` at line 121 with `animation: uni-fade-in 0.2s ease` |
| 9 | Settings source cards have subtle shadow matching event block style | VERIFIED | `.uni-calendar-source-card` has `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` and hover `0 2px 6px rgba(0,0,0,0.12)` in CARD_STYLES lines 29-33 |
| 10 | Color picker in Add/Edit source modals shows recommended palette as visual swatches | VERIFIED | `uni-calendar-palette-row` divs created at SettingsTab.ts lines 367 and 622 in AddSourceModal and EditSourceModal respectively |
| 11 | Recommended palette contains 8 Apple-inspired soft color swatches with Chinese labels | VERIFIED | RECOMMENDED_PALETTE in types.ts lines 71-79: 8 entries (番茄红, 橘橙, 向日葵, 薄荷绿, 天空蓝, 海洋蓝, 薰衣紫, 樱花粉) |
| 12 | Legacy calendar-view.css is removed if confirmed unused | VERIFIED | No `src/styles/` directory exists; no references to calendar-view.css in codebase |
| 13 | Modal detail rows have consistent spacing and icon alignment | VERIFIED | `.uni-calendar-detail-row` has `margin-bottom: 14px` at EventDetailModal.ts line 85; `.uni-calendar-detail-icon` has `margin-top: 1px` at line 93 |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/views/CalendarView.ts` | CALENDAR_CSS with Apple Calendar-inspired polish, updated inline event styles; contains `border-radius: 6px` | VERIFIED | border-radius: 6px at line 327; border-radius: 8px at line 375; box-shadows, transitions, color-mix all correct |
| `src/views/EventDetailModal.ts` | Polished modal with shadow, fade-in; contains `uni-fade-in` | VERIFIED | Contains `@keyframes uni-fade-in`, `animation: uni-fade-in 0.2s ease`, modal box-shadow at line 18 |
| `src/settings/SettingsTab.ts` | Settings card shadows and color palette picker UI; contains `uni-calendar-palette-swatch` | VERIFIED | Contains palette-swatch CSS rules with `border-radius: 50%` and `width: 28px`; both modal forms render swatch rows |
| `src/models/types.ts` | RECOMMENDED_PALETTE constant with Apple-inspired soft tones | VERIFIED | Exported with exactly 8 entries and Chinese labels |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CALENDAR_CSS .uni-calendar-event-bar` | `renderEventBlock inline styles` | Both use consistent border-radius, shadow, and color-mix values | VERIFIED | CSS class: border-radius 6px, box-shadow 0.08; inline style: 15% color-mix, 0.08 boxShadow; hover 25%/0.12. All consistent. |
| `src/settings/SettingsTab.ts` | `src/models/types.ts` | `import RECOMMENDED_PALETTE` | VERIFIED | Line 2: `import { ..., RECOMMENDED_PALETTE } from '../models/types'` — used in both modal swatch loops at lines 368, 623 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| SettingsTab.ts palette swatches | `RECOMMENDED_PALETTE` | `src/models/types.ts` export | Yes — static constant, design intent | FLOWING |
| CalendarView.ts event bar inline styles | `sourceColor` from event's sourceId matched against `plugin.settings.sources` | User persisted settings | Yes — reads actual user-configured source colors | FLOWING |
| CalendarView.ts event block inline styles | same as above | same | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build compiles without TypeScript errors | `npm run build` (documented in 05-01, 05-02, 05-03 SUMMARY files) | Exit code 0 per all three summaries | PASS |
| border-radius 6px in CALENDAR_CSS | grep CalendarView.ts line 327 | `border-radius: 6px;` — confirmed in file read | PASS |
| border-radius 8px in CALENDAR_CSS | grep CalendarView.ts line 375 | `border-radius: 8px;` — confirmed in file read | PASS |
| .uni-calendar-day-today transition rule exists | grep CalendarView.ts lines 212-214 | `transition: background 0.3s ease;` standalone rule confirmed | PASS |
| RECOMMENDED_PALETTE imported in SettingsTab | grep SettingsTab.ts line 2 | `import { ..., RECOMMENDED_PALETTE } from '../models/types'` confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFR-03 | 05-01, 05-02, 05-03 | User sees an Apple Calendar-inspired UI with clean design, rounded corners, and soft colors | SATISFIED | All visual polish implemented: rounded event bars (6px), rounded event blocks (8px), subtle shadows with hover lift, softened grid lines, toolbar shadow, smooth transitions, color palette swatches, modal elevation and fade-in. All "rounded corners" requirements fulfilled. |

INFR-03 is mapped exclusively to Phase 5 in REQUIREMENTS.md (Traceability table line 100). All three sub-plans claim INFR-03. Implementation evidence fully satisfies the requirement specification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME, no placeholder implementations, no empty arrays/objects affecting rendering | — | — |

No regression anti-patterns detected. Previous border-radius issues (2px, 4px) have been resolved.

### Human Verification Required

#### 1. Visual Quality Confirmation of Rounded Corners in Obsidian

**Test:** Load the plugin in Obsidian desktop (run `npm run build`, copy `main.js` to vault plugin dir, reload Obsidian). Navigate to month view with events and week view with events.
**Expected:** Event bars in month view show visibly rounded corners (6px); event blocks in week/day view appear as rounded card containers with 8px corners consistent with Apple Calendar card aesthetic. Hover effect shows subtle shadow lift.
**Why human:** Visual quality judgment — whether the rendered result achieves the Apple Calendar-inspired appearance requires subjective assessment in the actual Obsidian theme rendering environment (light and dark themes both).

#### 2. Mobile Screen Size Rendering

**Test:** Load the plugin in Obsidian mobile (iOS or Android), navigate to month and week views with events.
**Expected:** All visual polish — shadows, rounded corners (6px/8px), palette swatches, transitions — renders correctly on a smaller screen without layout overflow or cramped UI.
**Why human:** Mobile rendering cannot be verified programmatically in this environment.

### Gaps Summary

No gaps remain. All three gaps from the previous verification have been resolved:

1. **border-radius: 6px in .uni-calendar-event-bar** — Confirmed at CalendarView.ts line 327.
2. **border-radius: 8px in .uni-calendar-event-block** — Confirmed at CalendarView.ts line 375.
3. **.uni-calendar-day-today transition rule** — Confirmed as standalone rule at CalendarView.ts lines 212-214: `transition: background 0.3s ease;`.

All 13 must-have truths are now verified. Automated checks pass completely. Status is `human_needed` pending visual confirmation in Obsidian (both desktop quality check and mobile rendering).

---

_Verified: 2026-04-05T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure_

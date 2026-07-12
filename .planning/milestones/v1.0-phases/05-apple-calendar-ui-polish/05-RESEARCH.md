# Phase 5: Apple Calendar UI Polish - Research

**Researched:** 2026-04-02
**Domain:** CSS visual polish, Obsidian plugin styling, Apple Calendar-inspired UI design
**Confidence:** HIGH

## Summary

This phase is purely visual — no functional changes, no new dependencies, no external tools. All work targets three existing files containing inline CSS constants (`CALENDAR_CSS` in CalendarView.ts, inline styles in EventDetailModal.ts, `CARD_STYLES` in SettingsTab.ts) plus programmatic inline styles set via JavaScript on event blocks and bars. The codebase already uses Obsidian CSS variables extensively and employs `color-mix()` for event backgrounds, so the technical foundation is solid.

The primary work involves: (1) updating CSS property values in the `CALENDAR_CSS` constant for softened grid lines, increased border-radius, shadow additions, and transition declarations; (2) adjusting programmatic inline styles in `renderEventBlock()` and month view rendering to change `color-mix()` percentages and add box-shadows; (3) polishing EventDetailModal inline styles for elevation and spacing; (4) enhancing SettingsTab with shadows and a color palette picker UI; (5) optionally removing the legacy `src/styles/calendar-view.css` file which is unused.

**Primary recommendation:** Treat this as a systematic CSS property update across three files, organized by surface area (CalendarView grid/toolbar/events, EventDetailModal, SettingsTab). No new libraries needed. All CSS features used are fully supported in Obsidian's Electron 39+ (Chromium 139+).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Background, text, and structural colors continue using Obsidian CSS variables (`--background-primary`, `--text-normal`, etc.) for full theme compatibility across light/dark modes.
- **D-02:** Event source colors remain user-customizable with existing mechanism. Add a recommended color palette picker in settings (Apple Calendar-inspired soft tones like soft red, orange, yellow, green, sky blue, blue, purple, pink) for users to quickly select from. Current SOURCE_COLORS array stays as defaults.
- **D-03:** Event block background uses `color-mix(in srgb, {sourceColor} 15%, var(--background-primary))` for softer, more subtle fills than current 25%.
- **D-04:** Event blocks (week/day view): `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`, on hover `0 2px 6px rgba(0,0,0,0.12)`.
- **D-05:** Toolbar: subtle bottom shadow `box-shadow: 0 1px 0 var(--background-modifier-border)` for separation from grid.
- **D-06:** Event detail modal: `box-shadow: 0 8px 32px rgba(0,0,0,0.18)` for prominent elevation.
- **D-07:** Settings source cards: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` matching event blocks.
- **D-08:** Basic transitions only -- no view switching or navigation animations.
- **D-09:** Buttons: `transition: all 0.15s ease` on hover/active states.
- **D-10:** Event blocks/bars: `transition: box-shadow 0.15s ease, background 0.15s ease` on hover.
- **D-11:** Modal: fade-in on open via CSS opacity transition.
- **D-12:** Today highlight: smooth transition when navigating dates.
- **D-13:** Month view event bars: `border-radius: 6px`, `border-left: 3px solid {sourceColor}`, soft background fill, `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`.
- **D-14:** Week/Day view event blocks: `border-radius: 8px`, `border-left: 3px solid {sourceColor}`, soft background fill, shadow, rounded card appearance.
- **D-15:** Event blocks on hover: slight shadow increase for "lift" effect, no movement.
- **D-16:** Grid cell borders softened to `border: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent)` -- half-opacity of current.
- **D-17:** Day headers row and hour label column retain stronger borders (`var(--background-modifier-border)` at full opacity) as structural anchors.
- **D-18:** Overall effect: grid lines visible but recede behind event content, not competing visually.
- **D-19:** Full-surface polish covering three areas: CalendarView, EventDetailModal, SettingsTab.
- **D-20:** Mobile responsiveness -- all polish must look good on both desktop and mobile Obsidian. No mobile-specific breakpoints; rely on existing responsive patterns.

### Claude's Discretion
- Exact spacing/padding values within the established 4px grid system
- Typography refinements (letter-spacing, line-height adjustments)
- Specific border-radius values for toolbar, containers, and buttons (within the 6-8px range)
- Today cell highlight intensity and style refinement
- Sync status indicator visual polish
- Recommended color palette exact hex values (Apple-inspired soft tones)
- Color picker UI implementation details in settings
- Whether to remove/refactor the legacy `src/styles/calendar-view.css` file
- Hover state specifics for navigation arrows and toolbar buttons
- Settings modal form polish details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-03 | User sees an Apple Calendar-inspired UI with clean design, rounded corners, and soft colors | All 20 locked decisions (D-01 through D-20) directly implement this requirement. CSS property updates to CALENDAR_CSS, EventDetailModal styles, and CARD_STYLES achieve the visual quality target. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Platform:** Must work on both Obsidian desktop and mobile
- **Bundle Size:** Single-file bundle via esbuild; keep dependencies minimal -- no new CSS libraries
- **Obsidian API:** Must use Obsidian's plugin API patterns (lifecycle, settings, views)
- **Naming:** DOM element references suffixed with `El`, PascalCase for classes
- **Code Style:** 1-space indentation, semicolons, TypeScript strict mode
- **Chinese locale:** All UI strings in Chinese
- **GSD Workflow:** Use GSD commands for all repo changes

## Standard Stack

### Core

No new libraries are needed for this phase. All work is CSS property updates within existing TypeScript files.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | latest | Plugin framework, Modal/ItemView/Setting base classes | Already in use; provides CSS variable system |

### Supporting

No additional dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline CSS constants | External .css file | Inline constants are the established pattern in this codebase; external file would require style loader setup. Keep inline. |
| Raw CSS | CSS-in-JS library | Would add bundle size and complexity for no benefit in an Obsidian plugin context |

## Architecture Patterns

### File Modification Map

```
src/
  views/
    CalendarView.ts     # CALENDAR_CSS constant (lines 8-486) + renderEventBlock() inline styles (lines 1115-1127) + month bar styles (lines 880-882)
    EventDetailModal.ts # Inline style block (lines 80-116) + modal container styling
  settings/
    SettingsTab.ts      # CARD_STYLES constant (lines 18-62) + new color palette picker UI
  models/
    types.ts            # SOURCE_COLORS array (line 58-61) -- stays as-is, add RECOMMENDED_PALETTE constant
  styles/
    calendar-view.css   # Legacy/unused (119 lines) -- candidate for removal
```

### Pattern 1: CSS Constant Modification

**What:** All calendar styling lives in `CALENDAR_CSS` template literal constant at top of CalendarView.ts. Modifications are direct property value changes within this string.
**When to use:** Every grid, toolbar, and event display style change.
**Example:**
```typescript
// BEFORE (current)
.uni-calendar-event-bar {
  border-radius: 2px;
}

// AFTER (D-13)
.uni-calendar-event-bar {
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s ease, background 0.15s ease;
}
```

### Pattern 2: Programmatic Inline Style Updates

**What:** Event-specific colors are set via JavaScript `element.style.*` in render methods. These need percentage and shadow adjustments.
**When to use:** renderEventBlock() and month view event bar rendering.
**Example:**
```typescript
// BEFORE (current - line 882)
bar.style.background = `color-mix(in srgb, ${sourceColor} 25%, var(--background-secondary))`;

// AFTER (D-03)
bar.style.background = `color-mix(in srgb, ${sourceColor} 15%, var(--background-primary))`;
```

### Pattern 3: Color Palette Picker in Settings

**What:** Add a recommended color palette UI in the AddSourceModal/EditSourceModal so users can pick from Apple-inspired soft tones via visual swatches instead of hex codes only.
**When to use:** Settings source color selection.
**Example:**
```typescript
const RECOMMENDED_PALETTE = [
  { name: 'Soft Red',    hex: '#FF6B6B' },
  { name: 'Orange',      hex: '#FFA06B' },
  { name: 'Yellow',      hex: '#FFD93D' },
  { name: 'Green',       hex: '#6BCB77' },
  { name: 'Sky Blue',    hex: '#74C0FC' },
  { name: 'Blue',        hex: '#4D96FF' },
  { name: 'Purple',      hex: '#9B59B6' },
  { name: 'Pink',        hex: '#FF6B9D' },
];
// Render as circular swatches in a flex row
```

### Pattern 4: Modal Fade-In Animation (D-11)

**What:** CSS opacity transition on modal open. Obsidian's Modal class adds a `.modal-container` wrapper. Target the plugin's own modal class.
**When to use:** EventDetailModal opening.
**Example:**
```css
.uni-calendar-event-detail {
  animation: uni-fade-in 0.2s ease;
}
@keyframes uni-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Anti-Patterns to Avoid
- **Hard-coded color values for structural elements:** Always use Obsidian CSS variables (`--background-primary`, `--text-normal`, etc.) for anything that isn't event source color. D-01 explicitly requires this.
- **Adding mobile-specific breakpoints:** D-20 says rely on existing responsive patterns. Obsidian mobile already handles viewport sizing.
- **Complex animations/transitions:** D-08 limits to basic transitions only. No page transitions, no spring physics, no JS-driven animations.
- **Modifying DOM structure for styling purposes:** This is a CSS-only polish phase. Don't restructure HTML/DOM unless strictly necessary for a visual effect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color palette UI | Custom color wheel/picker component | Simple swatch grid (circles in flexbox) | Users select from 8-10 recommended colors; a full picker is overkill and adds complexity |
| Dark mode shadows | Separate shadow values for dark/light themes | Use `rgba(0,0,0,X)` with low opacity values | Low-opacity black shadows work acceptably in both light and dark themes; Obsidian themes handle the rest |
| Modal animation | JS animation library | CSS `@keyframes` or `transition` | Pure CSS is simpler, lighter, and sufficient for fade-in effects |

**Key insight:** This phase is entirely about adjusting CSS property values. The architecture, DOM structure, and JavaScript logic remain unchanged. The "don't hand-roll" principle here means: don't add any libraries or build any animation frameworks. CSS properties do everything needed.

## Common Pitfalls

### Pitfall 1: Shadows in Dark Mode Looking Harsh

**What goes wrong:** `rgba(0,0,0,0.08)` shadows look great on light backgrounds but become invisible on dark backgrounds, while higher opacity values look harsh.
**Why it happens:** Shadow contrast depends on background luminance.
**How to avoid:** The locked decision values (0.08 base, 0.12 hover) are intentionally subtle. They work acceptably in both modes. Do NOT increase opacity "to make shadows visible in dark mode" -- the subtle effect is intentional. In dark mode, the event card's slightly different background (from color-mix) provides the visual separation instead.
**Warning signs:** Shadow values above `rgba(0,0,0,0.15)` for non-modal elements.

### Pitfall 2: color-mix() with var(--background-secondary) vs var(--background-primary)

**What goes wrong:** Current code mixes event colors with `--background-secondary` (line 882). D-03 specifies mixing with `--background-primary`. Using the wrong base creates inconsistent tints between month bars and week/day blocks.
**Why it happens:** Month view bars currently use `--background-secondary` as the mix base, while week/day blocks use `--background-primary`. The decision unifies on `--background-primary`.
**How to avoid:** Update ALL event color-mix calls to use `--background-primary` as the base, with 15% source color opacity per D-03.
**Warning signs:** Event bars appearing darker/lighter than event blocks for the same source.

### Pitfall 3: Transition on Programmatic Style Changes

**What goes wrong:** CSS `transition` declarations in the stylesheet don't apply to properties set via JavaScript `element.style.*` if the property is set before the element is in the DOM.
**Why it happens:** The transition needs both the initial and final states. If `background` is set programmatically when creating the element, there's no "from" state to transition from.
**How to avoid:** The D-10 transition (`transition: box-shadow 0.15s ease, background 0.15s ease`) applies to hover state changes which DO have a from/to state (mouseenter/mouseleave handlers in renderEventBlock). The initial render doesn't need to transition. This is already correct behavior.
**Warning signs:** Trying to add transitions to initial render -- that's not needed.

### Pitfall 4: Forgetting Both Inline Style Locations

**What goes wrong:** Only updating CALENDAR_CSS but forgetting the programmatic `element.style.*` assignments, or vice versa.
**Why it happens:** Styles are split between CSS constants and JavaScript render methods.
**How to avoid:** The modification map above identifies ALL locations. Specifically:
  - `CALENDAR_CSS` constant (lines 8-486) -- static CSS rules
  - `renderEventBlock()` (lines 1115-1127) -- week/day event block inline styles
  - Month view bar rendering (lines 880-882) -- month event bar inline styles
  - `mouseenter/mouseleave` handlers (lines 1122-1127) -- hover color changes
**Warning signs:** Visual inconsistency between static and dynamic elements.

### Pitfall 5: Modal Shadow Conflicting with Obsidian's Modal Styles

**What goes wrong:** Adding `box-shadow` to the event detail modal content area but Obsidian's `.modal-container` already has its own shadow/backdrop.
**Why it happens:** Obsidian's Modal base class provides `.modal-container` (backdrop) and `.modal` (the card). The plugin targets `.uni-calendar-event-detail` which is inside `.modal .modal-content`.
**How to avoid:** Apply D-06's shadow (`box-shadow: 0 8px 32px rgba(0,0,0,0.18)`) to the `.modal` element when it contains `.uni-calendar-event-detail`, using the pattern `.modal:has(.uni-calendar-event-detail)`. Alternatively, inject the style targeting the parent `.modal` from within onOpen(). Test that it doesn't double-shadow with Obsidian's default modal styling.
**Warning signs:** Double shadows creating an overly dark effect around the modal.

### Pitfall 6: Grid Border Softening Breaking Visual Structure

**What goes wrong:** Making ALL borders half-opacity causes the grid to lose structural definition, making it hard to read.
**Why it happens:** D-16 softens cell borders but D-17 keeps header/label borders at full strength. If you accidentally soften everything, the grid looks washed out.
**How to avoid:** Only soften borders on `.uni-calendar-day`, `.uni-calendar-week-cell`, `.uni-calendar-hour-slot`, `.uni-calendar-day-hour-slot` elements. Keep full-opacity borders on day headers, hour label cells, and the outer grid border.
**Warning signs:** Headers blending into the grid body visually.

## Code Examples

### Complete Event Bar CSS Update (D-13)

```css
/* Source: CONTEXT.md D-13 */
.uni-calendar-event-bar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--background-secondary);
  border-radius: 6px;  /* was 2px */
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-ui-smaller);
  color: var(--text-normal);
  min-height: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);  /* new */
  transition: box-shadow 0.15s ease, background 0.15s ease;  /* new */
}
.uni-calendar-event-bar:hover {
  background: var(--background-modifier-hover);
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);  /* new hover lift */
}
```

### Complete Event Block CSS Update (D-14, D-04)

```css
/* Source: CONTEXT.md D-14, D-04 */
.uni-calendar-event-block {
  position: absolute;
  left: 0;
  right: 0;
  min-height: 20px;
  border-radius: 8px;  /* was 4px */
  padding: 4px 8px;
  cursor: pointer;
  overflow: hidden;
  z-index: 2;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);  /* new */
  transition: box-shadow 0.15s ease, background 0.15s ease;  /* new */
}
.uni-calendar-event-block:hover {
  z-index: 3;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);  /* new hover lift */
}
```

### Grid Border Softening (D-16, D-17)

```css
/* Source: CONTEXT.md D-16 -- softened cell borders */
.uni-calendar-day {
  border-right: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent);
}

/* Source: CONTEXT.md D-17 -- structural borders stay full strength */
.uni-calendar-day-header {
  border-bottom: 1px solid var(--background-modifier-border);
}
```

### Toolbar Shadow (D-05)

```css
/* Source: CONTEXT.md D-05 */
.uni-calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--size-4-3);
  flex-shrink: 0;
  box-shadow: 0 1px 0 var(--background-modifier-border);  /* new */
  padding-bottom: var(--size-4-3);  /* add padding so shadow has space */
}
```

### Programmatic Inline Style Update (D-03)

```typescript
// Source: CONTEXT.md D-03
// In month view bar rendering (currently line 882):
// BEFORE:
bar.style.background = `color-mix(in srgb, ${sourceColor} 25%, var(--background-secondary))`;
// AFTER:
bar.style.background = `color-mix(in srgb, ${sourceColor} 15%, var(--background-primary))`;

// In renderEventBlock() (currently line 1117):
// BEFORE:
block.style.background = `color-mix(in srgb, ${sourceColor} 30%, var(--background-primary))`;
// AFTER:
block.style.background = `color-mix(in srgb, ${sourceColor} 15%, var(--background-primary))`;

// Hover handlers (currently lines 1123, 1126):
// BEFORE:
block.style.background = `color-mix(in srgb, ${sourceColor} 40%, var(--background-primary))`;
// AFTER (slightly stronger on hover, but still softer):
block.style.background = `color-mix(in srgb, ${sourceColor} 25%, var(--background-primary))`;
```

### Recommended Apple-Inspired Color Palette

```typescript
// Source: Apple Calendar default calendar colors (approximated as soft tones)
export const RECOMMENDED_PALETTE: Array<{ name: string; hex: string }> = [
  { name: '番茄红', hex: '#FF6B6B' },
  { name: '橘橙',   hex: '#FFA06B' },
  { name: '向日葵', hex: '#FFD93D' },
  { name: '薄荷绿', hex: '#6BCB77' },
  { name: '天空蓝', hex: '#74C0FC' },
  { name: '海洋蓝', hex: '#4D96FF' },
  { name: '薰衣紫', hex: '#9B59B6' },
  { name: '樱花粉', hex: '#FF6B9D' },
];
```

### Color Palette Swatch UI Pattern

```typescript
// In AddSourceModal/EditSourceModal color selection area
const paletteRow = containerEl.createDiv({ cls: 'uni-calendar-palette-row' });
for (const { name, hex } of RECOMMENDED_PALETTE) {
  const swatch = paletteRow.createDiv({ cls: 'uni-calendar-palette-swatch' });
  swatch.style.background = hex;
  swatch.setAttribute('aria-label', name);
  swatch.addEventListener('click', () => {
    currentColor = hex;
    // Update color input and preview
  });
}
```

```css
.uni-calendar-palette-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.uni-calendar-palette-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.uni-calendar-palette-swatch:hover {
  transform: scale(1.15);
  border-color: var(--text-muted);
}
.uni-calendar-palette-swatch.is-selected {
  border-color: var(--interactive-accent);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `border-radius: 2px` on event bars | `border-radius: 6-8px` for Apple feel | This phase | Softer, more modern appearance |
| Flat event blocks (no shadow) | Subtle `box-shadow` with hover lift | This phase | Depth and interactive feedback |
| Full-opacity grid borders | Half-opacity cell borders (D-16) | This phase | Content-first visual hierarchy |
| `color-mix` at 25-30% | `color-mix` at 15% (D-03) | This phase | Subtler, less saturated event fills |

**CSS compatibility note:** All CSS features used in this phase are fully supported in Obsidian's runtime:
- `color-mix()`: Chrome 111+ (Obsidian uses Chromium 139 via Electron 39)
- `box-shadow`, `border-radius`, `transition`: Universal support
- `@keyframes` animation: Universal support
- `:has()` selector: Chrome 105+ (available if needed for modal targeting)

## Open Questions

1. **Legacy calendar-view.css removal**
   - What we know: `src/styles/calendar-view.css` (119 lines) appears unused -- all active styles are in the `CALENDAR_CSS` inline constant
   - What's unclear: Whether any external consumer references this file
   - Recommendation: Remove it during this phase (Claude's discretion per CONTEXT.md). Verify no imports reference it first.

2. **Modal shadow application method**
   - What we know: D-06 specifies `box-shadow: 0 8px 32px rgba(0,0,0,0.18)` for the event detail modal
   - What's unclear: Whether to target the Obsidian `.modal` wrapper or inject shadow on the `.uni-calendar-event-detail` content element
   - Recommendation: Inject a style rule targeting `.modal:has(.uni-calendar-event-detail)` from within the modal's style block. If `:has()` causes issues, fall back to setting `this.modalEl.style.boxShadow` in onOpen().

3. **Hover color-mix percentage on event bars in month view**
   - What we know: D-03 says 15% for base. D-15 says "slight shadow increase" on hover but doesn't specify month bar hover color-mix.
   - What's unclear: Exact hover percentage for month view event bars
   - Recommendation: Use 25% on hover (matching the old base value), giving a subtle but noticeable darkening effect.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (config at vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-03 | Apple Calendar-inspired UI visual quality | manual-only | N/A -- visual inspection required | N/A |

**Justification for manual-only:** INFR-03 is a visual quality requirement. CSS property values (border-radius, box-shadow, color-mix percentages) cannot be meaningfully validated by unit tests in a headless environment. The verification is "does it look polished?" which requires human visual inspection in Obsidian. The build must succeed (`npm run build`) confirming no TypeScript errors, but visual quality is inherently manual.

### Sampling Rate
- **Per task commit:** `npm run build` (confirms no TypeScript/build errors)
- **Per wave merge:** `npm run build && npx vitest run --reporter=verbose`
- **Phase gate:** Build succeeds + human visual inspection in Obsidian (desktop and mobile)

### Wave 0 Gaps
None -- no new test files needed for a CSS-only visual polish phase. Existing build verification is sufficient.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/views/CalendarView.ts` lines 8-486 (CALENDAR_CSS), lines 880-882, 1115-1127 (inline styles)
- Existing codebase: `src/views/EventDetailModal.ts` lines 80-116 (modal styles)
- Existing codebase: `src/settings/SettingsTab.ts` lines 18-62 (CARD_STYLES)
- Existing codebase: `src/models/types.ts` lines 58-61 (SOURCE_COLORS)
- Phase 5 CONTEXT.md: All 20 locked decisions (D-01 through D-20)
- Phase 2 UI-SPEC.md: Baseline spacing scale, typography, color roles

### Secondary (MEDIUM confidence)
- [Obsidian CSS Variables Reference (DeepWiki)](https://deepwiki.com/obsidianmd/obsidian-developer-docs/3.3-css-variables-reference) -- variable names and categories
- [Obsidian CSS Variables (Official Docs)](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables) -- official reference
- [CSS color-mix() (Can I Use)](https://caniuse.com/mdn-css_types_color_color-mix) -- Chrome 111+, fully supported
- [Obsidian Release Notes (Releasebot)](https://releasebot.io/updates/obsidian) -- Electron 39.x / Chromium 139 in current Obsidian

### Tertiary (LOW confidence)
- [Apple Calendar Aesthetic Color Palettes (Gridfiti)](https://gridfiti.com/apple-calendar-aesthetic/) -- Apple Calendar color inspiration (community source, not official Apple)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tools
- Architecture: HIGH -- file modification targets clearly identified from codebase reading
- Pitfalls: HIGH -- identified from direct code analysis of inline style patterns and CSS constant structure

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- CSS fundamentals don't change rapidly)

# Phase 5: Apple Calendar UI Polish - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The calendar achieves Apple Calendar-inspired visual quality with clean design, rounded corners, soft colors, and polished interactions. This phase delivers visual refinement across all UI surfaces: CalendarView (toolbar, month/week/day views, event bars, event blocks, navigation), EventDetailModal, and SettingsTab. No functional changes — purely visual polish and interaction refinement. All styling must remain Obsidian theme-compatible (light/dark modes).

</domain>

<decisions>
## Implementation Decisions

### Color Strategy
- **D-01:** Background, text, and structural colors continue using Obsidian CSS variables (`--background-primary`, `--text-normal`, etc.) for full theme compatibility across light/dark modes.
- **D-02:** Event source colors remain user-customizable with existing mechanism. Add a recommended color palette picker in settings (Apple Calendar-inspired soft tones like soft red, orange, yellow, green, sky blue, blue, purple, pink) for users to quickly select from. Current SOURCE_COLORS array stays as defaults.
- **D-03:** Event block background uses `color-mix(in srgb, {sourceColor} 15%, var(--background-primary))` for softer, more subtle fills than current 25%.

### Shadows and Depth
- **D-04:** Event blocks (week/day view): `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`, on hover `0 2px 6px rgba(0,0,0,0.12)`.
- **D-05:** Toolbar: subtle bottom shadow `box-shadow: 0 1px 0 var(--background-modifier-border)` for separation from grid.
- **D-06:** Event detail modal: `box-shadow: 0 8px 32px rgba(0,0,0,0.18)` for prominent elevation.
- **D-07:** Settings source cards: `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` matching event blocks.

### Animations and Transitions
- **D-08:** Basic transitions only — no view switching or navigation animations.
- **D-09:** Buttons: `transition: all 0.15s ease` on hover/active states.
- **D-10:** Event blocks/bars: `transition: box-shadow 0.15s ease, background 0.15s ease` on hover.
- **D-11:** Modal: fade-in on open via CSS opacity transition.
- **D-12:** Today highlight: smooth transition when navigating dates.

### Event Block Visual Style
- **D-13:** Month view event bars: `border-radius: 6px`, `border-left: 3px solid {sourceColor}`, soft background fill, `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`.
- **D-14:** Week/Day view event blocks: `border-radius: 8px`, `border-left: 3px solid {sourceColor}`, soft background fill, shadow, rounded card appearance.
- **D-15:** Event blocks on hover: slight shadow increase for "lift" effect, no movement.

### Grid Line Treatment
- **D-16:** Grid cell borders softened to `border: 1px solid color-mix(in srgb, var(--background-modifier-border) 50%, transparent)` — half-opacity of current.
- **D-17:** Day headers row and hour label column retain stronger borders (`var(--background-modifier-border)` at full opacity) as structural anchors.
- **D-18:** Overall effect: grid lines visible but recede behind event content, not competing visually.

### Polish Scope
- **D-19:** Full-surface polish covering three areas:
  1. **CalendarView** — toolbar, month/week/day grids, event bars, event blocks, navigation controls, view tabs, today button, sync status
  2. **EventDetailModal** — rounded card layout, unified icon style, spacing refinement
  3. **SettingsTab** — source cards beautification, recommended color palette picker, form element consistency
- **D-20:** Mobile responsiveness — all polish must look good on both desktop and mobile Obsidian. No mobile-specific breakpoints; rely on existing responsive patterns.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current styling (primary targets)
- `src/views/CalendarView.ts` lines 8-486 — `CALENDAR_CSS` inline constant, main stylesheet (~478 lines). This is the primary file to modify.
- `src/views/CalendarView.ts` lines 880-882, 1115-1127 — Inline JavaScript event styling (background colors set programmatically)
- `src/views/EventDetailModal.ts` lines 80-116 — Modal inline styles injected into contentEl
- `src/settings/SettingsTab.ts` lines 18-62 — `CARD_STYLES` constant for source card layout

### Existing design contract
- `.planning/phases/02-ics-feeds-and-calendar-views/02-UI-SPEC.md` — Phase 2 UI design contract with spacing scale, typography, color roles, component inventory. Use as baseline for refinement.

### Type and structural context
- `src/models/types.ts` — CalendarSource, CalendarEvent types (color field locations)
- `src/styles/calendar-view.css` — Legacy/unused external CSS (119 lines), may be removed or consolidated

### Prior phase context
- `.planning/phases/02-ics-feeds-and-calendar-views/02-CONTEXT.md` — Original UI decisions (event bar style, overlap handling, month overflow modes)
- `.planning/phases/04-google-calendar-and-multi-source-unification/04-CONTEXT.md` — Most recent phase, settings UI patterns

### Requirements
- `.planning/REQUIREMENTS.md` — INFR-03: "User sees an Apple Calendar-inspired UI with clean design, rounded corners, and soft colors"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CALENDAR_CSS` constant in CalendarView.ts — All calendar styles in one inline block, easy to modify comprehensively
- `CARD_STYLES` constant in SettingsTab.ts — Settings card styles, same pattern
- Obsidian CSS variables already used throughout — theme-compatible foundation is solid
- `SOURCE_COLORS` array in `types.ts` — Current 10 preset colors, can be supplemented with recommended palette
- `color-mix()` CSS function already used for event backgrounds — can adjust percentages

### Established Patterns
- Inline CSS in TypeScript constants (`CALENDAR_CSS`, `CARD_STYLES`) — inject via `<style>` elements
- Obsidian CSS variable usage for theme compatibility
- Chinese locale for all UI strings
- DOM manipulation via Obsidian createDiv/createEl helpers
- View mode state tracked as `'month' | 'week' | 'day'`
- Programmatic inline styles for event-specific colors (sourceColor)

### Integration Points
- `CalendarView.ts` CALENDAR_CSS — Primary CSS modifications
- `CalendarView.ts` render methods — Programmatic style adjustments for event colors
- `EventDetailModal.ts` style injection — Modal CSS modifications
- `SettingsTab.ts` CARD_STYLES and inline styles — Settings visual polish
- `SettingsTab.ts` AddSourceModal/EditSourceModal — Color picker UI addition

</code_context>

<specifics>
## Specific Ideas

- Apple Calendar's polish comes from three key elements: generous rounded corners, subtle shadows creating layered depth, and soft muted colors — replicate this trifecta
- Event blocks should feel like hovering cards, not flat colored rectangles
- Grid lines should recede behind content — you notice the events first, grid structure second
- The recommended color palette in settings should feel like picking crayons — visual swatches, not hex codes
- Overall feel target: "this looks like it belongs on a Mac" — clean, calm, professional

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-apple-calendar-ui-polish*
*Context gathered: 2026-04-02*

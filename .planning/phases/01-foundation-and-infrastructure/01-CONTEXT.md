# Phase 1: Foundation and Infrastructure - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin skeleton, event store, settings UI, offline cache, and mobile validation. Users can open the plugin, manage calendar source configurations, see an empty calendar view placeholder, and the technical foundation supports offline caching and cross-platform operation. No actual data fetching or calendar rendering — that's Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Settings UI Layout
- Card-based list for calendar sources — each card shows name, type, color marker, status; right side has edit/delete buttons
- Bottom "Add calendar source" button
- Adding a source: first select type (Google/CalDAV/ICS), then show type-specific form fields
- Color assignment: system auto-assigns from a preset color palette, user can override per source
- Include global settings in Phase 1: sync interval selector, default view preference (for Phase 2 readiness)

### Event Cache Strategy
- Use Obsidian `saveData`/`loadData` (stored in `.obsidian/plugins/uni-calendar/data.json`)
- Full replacement on sync — each successful sync replaces old cache entirely (no incremental diffing in Phase 1)
- Only cache events within a near-term time window (specific window size is Claude's discretion)
- Data structure design is Claude's discretion

### Calendar View (Empty State)
- Register as Obsidian leaf view (`ItemView`) — can be dragged, split, docked like other panels
- Two entry points: left Ribbon icon + Command Palette command
- Empty state shows a real calendar grid layout (no events) with centered guidance text and "Add calendar source" button linking to settings

### Sync Status Indicator
- Display inside the calendar view (header or footer area)
- Idle state: "Last synced: X minutes ago" or "No sources configured"
- Syncing state: spinner/animation with "Syncing..." text
- Error state: error icon + brief description in the status area, click to expand full error details
- No status bar item (mobile has no status bar)

### Plugin Identity
- Plugin ID: `uni-calendar`
- Display name: `UniCalendar`
- Ribbon icon: Lucide `calendar` icon
- Command prefix: `UniCalendar:` (e.g., "UniCalendar: Open calendar")

### Sync Trigger Mechanism
- Auto-sync on plugin load
- Periodic sync at user-configured interval (default: 15 minutes)
- Manual sync button available in the calendar view
- All sources sync in parallel when triggered

### Claude's Discretion
- Event data structure and schema design
- Cache time window size (how many months forward/backward)
- Exact spacing, typography, and styling of settings cards
- Loading skeleton or transition animations
- Error handling specifics (retry logic, timeout values)
- Global settings field details beyond sync interval and default view

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 1 covers INFR-01, INFR-02, INFR-04, EVNT-05
- `.planning/PROJECT.md` — Project vision, constraints, key decisions (read-only sync, Apple Calendar-inspired UI, CalDAV custom client)
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependencies

### Obsidian Plugin Development
- `manifest.json` — Plugin manifest with ID, version, minimum Obsidian version
- `src/main.ts` — Current plugin entry point (sample template, to be replaced)
- `src/settings.ts` — Current settings implementation (sample template, to be replaced)

No external specs or ADRs — requirements are fully captured in decisions above and project files.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Plugin` base class from Obsidian API — lifecycle hooks (`onload`, `onunload`), `saveData`/`loadData` for persistence
- `PluginSettingTab` — base class for settings UI, already scaffolded in `src/settings.ts`
- `Setting` component from Obsidian API — for building settings form fields
- `ItemView` from Obsidian API — base class for registering custom leaf views

### Established Patterns
- TypeScript strict mode enabled
- esbuild single-file bundling with external dependencies excluded
- `Object.assign` pattern for merging default settings with saved data
- Async `loadSettings`/`saveSettings` lifecycle pattern

### Integration Points
- `this.addRibbonIcon()` — for calendar Ribbon button (already demonstrated in template)
- `this.addCommand()` — for Command Palette registration (already demonstrated in template)
- `this.registerView()` — for registering ItemView type (not yet used, needed for calendar view)
- `this.addSettingTab()` — for settings registration (already in place)
- `this.registerInterval()` — for periodic sync scheduling (already demonstrated in template)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-and-infrastructure*
*Context gathered: 2026-03-31*

# Phase 1: Foundation and Infrastructure - Research

**Researched:** 2026-03-31
**Domain:** Obsidian Plugin Architecture (ItemView, Settings, Data Persistence, Cross-Platform)
**Confidence:** HIGH

## Summary

Phase 1 establishes the plugin skeleton for UniCalendar: an Obsidian plugin that registers a custom calendar leaf view (ItemView), provides a card-based settings UI for managing calendar source configurations, implements an event cache using Obsidian's persistence API, and displays sync status. The existing codebase is the official Obsidian sample plugin template with esbuild bundling already configured.

The Obsidian API provides all the primitives needed: `ItemView` for custom views, `Setting` class with `addText`/`addDropdown`/`addColorPicker`/`addButton` for rich settings UIs, `saveData`/`loadData` for JSON persistence, and `requestUrl` for future HTTP needs. The `registerView` + `activateView` pattern is well-documented. No external dependencies are needed for Phase 1 -- everything is built with Obsidian's native API and vanilla DOM manipulation.

**Primary recommendation:** Build Phase 1 entirely with Obsidian's built-in APIs (no React, no UI frameworks). Use `ItemView` for the calendar view, `PluginSettingTab` with `Setting` components for the settings UI, and `saveData`/`loadData` for both settings and event cache persistence.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Card-based list for calendar sources -- each card shows name, type, color marker, status; right side has edit/delete buttons
- Bottom "Add calendar source" button
- Adding a source: first select type (Google/CalDAV/ICS), then show type-specific form fields
- Color assignment: system auto-assigns from a preset color palette, user can override per source
- Include global settings in Phase 1: sync interval selector, default view preference (for Phase 2 readiness)
- Use Obsidian `saveData`/`loadData` (stored in `.obsidian/plugins/uni-calendar/data.json`)
- Full replacement on sync -- each successful sync replaces old cache entirely (no incremental diffing in Phase 1)
- Register as Obsidian leaf view (`ItemView`) -- can be dragged, split, docked like other panels
- Two entry points: left Ribbon icon + Command Palette command
- Empty state shows a real calendar grid layout (no events) with centered guidance text and "Add calendar source" button linking to settings
- Sync status display inside the calendar view (header or footer area)
- Idle state: "Last synced: X minutes ago" or "No sources configured"
- Syncing state: spinner/animation with "Syncing..." text
- Error state: error icon + brief description, click to expand full error details
- No status bar item (mobile has no status bar)
- Plugin ID: `uni-calendar`
- Display name: `UniCalendar`
- Ribbon icon: Lucide `calendar` icon
- Command prefix: `UniCalendar:` (e.g., "UniCalendar: Open calendar")
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | User can view previously synced events when offline | Event cache via `saveData`/`loadData` persists to `data.json`; loaded on startup before any network calls |
| INFR-02 | User can add, edit, and remove calendar sources in settings | `PluginSettingTab` + `Setting` class with `addText`, `addDropdown`, `addColorPicker`, `addButton` methods; dynamic list pattern with `display()` re-render |
| INFR-04 | Plugin works on both Obsidian desktop and mobile | No `addStatusBarItem` (mobile incompatible); use `requestUrl` not `fetch`; avoid Node.js `fs` APIs; use Obsidian CSS variables for theming; `isDesktopOnly: false` in manifest |
| EVNT-05 | User sees a sync status indicator showing last sync time and sync-in-progress | Sync status rendered inside `ItemView` header/footer; state management tracks idle/syncing/error states; `registerInterval` for periodic sync |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | latest (npm) | Plugin framework -- ItemView, Setting, PluginSettingTab, requestUrl, saveData/loadData | Only option for Obsidian plugins; provides all UI and persistence primitives |
| TypeScript | 5.8.3 | Type-safe development with strict mode | Already configured in project |
| esbuild | 0.25.5 | Single-file CJS bundling | Already configured; outputs `main.js` at project root |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tslib | 2.4.0 | TypeScript runtime helpers | Already a dependency; used via `importHelpers: true` in tsconfig |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla DOM (ItemView) | React/Preact/Svelte | Adds bundle size, complexity; Obsidian's native DOM API is sufficient for Phase 1's simple UI |
| `saveData`/`loadData` | `app.vault.adapter.write` | Adapter is better for very large data; `saveData` is simpler and sufficient for calendar event cache |
| CSS inline styles | CSS-in-JS library | Unnecessary dependency; use `<style>` in view or a `.css` file bundled by esbuild |

**Installation:**
```bash
# No new dependencies needed for Phase 1
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  main.ts              # Plugin entry point (UniCalendarPlugin class)
  views/
    CalendarView.ts     # ItemView subclass for calendar leaf
  settings/
    SettingsTab.ts      # PluginSettingTab subclass
    types.ts            # Settings interfaces and defaults
  models/
    types.ts            # CalendarSource, CalendarEvent, SyncStatus types
  store/
    EventStore.ts       # Event cache management (load/save/query)
  sync/
    SyncManager.ts      # Sync orchestration (trigger, interval, status)
  styles/
    calendar-view.css   # Calendar view styles
    settings.css        # Settings tab styles (if needed)
```

### Pattern 1: ItemView Registration and Activation
**What:** Register a custom view type with Obsidian and provide activation via ribbon icon and command.
**When to use:** Any time the plugin needs a custom panel/leaf in the workspace.
**Example:**
```typescript
// Source: Obsidian unofficial docs + obsidian.d.ts
import {ItemView, WorkspaceLeaf, Plugin} from 'obsidian';

export const VIEW_TYPE_CALENDAR = 'uni-calendar-view';

export class CalendarView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    // Set navigation to false -- this is a static panel, not a document viewer
    this.navigation = false;
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return 'UniCalendar';
  }

  getIcon(): string {
    return 'calendar';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1]; // contentEl
    container.empty();
    // Build calendar UI here
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}

// In plugin onload():
this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf));

this.addRibbonIcon('calendar', 'UniCalendar: Open calendar', () => {
  this.activateView();
});

this.addCommand({
  id: 'open-calendar',
  name: 'Open calendar',
  callback: () => this.activateView(),
});
```

**Critical note on `navigation`:** The `View.navigation` property (since 0.15.1) should be `false` for static views like calendars. The official docs comment says: "If your view is a static view that is not intended to be navigated away, set this to false. (For example: File explorer, calendar, etc.)"

### Pattern 2: View Activation (Leaf Management)
**What:** Open or reveal the calendar view leaf, ensuring only one instance exists.
**When to use:** When user clicks ribbon icon or runs command.
**Example:**
```typescript
// Source: marcusolsson.github.io/obsidian-plugin-docs/user-interface/views
async activateView(): Promise<void> {
  const {workspace} = this.app;

  let leaf: WorkspaceLeaf | null = null;
  const leaves = workspace.getLeavesOfType(VIEW_TYPE_CALENDAR);

  if (leaves.length > 0) {
    // View already open -- reveal it
    leaf = leaves[0];
  } else {
    // Open in right sidebar by default; user can drag it anywhere
    leaf = workspace.getRightLeaf(false);
    await leaf.setViewState({type: VIEW_TYPE_CALENDAR, active: true});
  }

  workspace.revealLeaf(leaf);
}
```

### Pattern 3: Dynamic Settings List (Card-Based Sources)
**What:** Build a settings tab with a dynamic list of calendar sources that can be added/removed.
**When to use:** For the card-based calendar source management UI.
**Example:**
```typescript
// Source: Obsidian Setting API (obsidian.d.ts)
display(): void {
  const {containerEl} = this;
  containerEl.empty();

  // Global settings section
  containerEl.createEl('h2', {text: 'General'});

  new Setting(containerEl)
    .setName('Sync interval')
    .setDesc('How often to sync calendar events (minutes)')
    .addDropdown(dropdown => dropdown
      .addOptions({'5': '5 min', '15': '15 min', '30': '30 min', '60': '1 hour'})
      .setValue(String(this.plugin.settings.syncInterval))
      .onChange(async (value) => {
        this.plugin.settings.syncInterval = Number(value);
        await this.plugin.saveSettings();
      }));

  // Calendar sources section
  containerEl.createEl('h2', {text: 'Calendar Sources'});

  for (const [index, source] of this.plugin.settings.sources.entries()) {
    const card = containerEl.createDiv({cls: 'uni-calendar-source-card'});

    // Color marker + name + type
    const info = card.createDiv({cls: 'uni-calendar-source-info'});
    info.createSpan({cls: 'uni-calendar-color-dot', attr: {style: `background:${source.color}`}});
    info.createSpan({text: `${source.name} (${source.type})`});

    // Edit and delete buttons
    new Setting(card)
      .addExtraButton(btn => btn.setIcon('pencil').setTooltip('Edit').onClick(() => {
        // Open edit modal
      }))
      .addExtraButton(btn => btn.setIcon('trash').setTooltip('Delete').onClick(async () => {
        this.plugin.settings.sources.splice(index, 1);
        await this.plugin.saveSettings();
        this.display(); // Re-render
      }));
  }

  // Add source button
  new Setting(containerEl)
    .addButton(btn => btn
      .setButtonText('Add calendar source')
      .setCta()
      .onClick(() => {
        // Open type-selection modal, then source config modal
      }));
}
```

### Pattern 4: Event Cache with saveData/loadData
**What:** Persist both settings and cached events in a single `data.json` file.
**When to use:** For offline viewing support and settings persistence.
**Example:**
```typescript
// Source: Obsidian Plugin API (saveData/loadData)
interface UniCalendarData {
  settings: UniCalendarSettings;
  eventCache: EventCache;
}

interface EventCache {
  events: CalendarEvent[];
  lastSyncTime: number | null;     // Unix timestamp
  cacheWindowStart: string;         // ISO date string
  cacheWindowEnd: string;           // ISO date string
}

// Load on startup
async loadPluginData(): Promise<void> {
  const data = await this.loadData() as Partial<UniCalendarData>;
  this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
  this.eventCache = Object.assign({}, DEFAULT_CACHE, data?.eventCache);
}

// Save settings + cache together
async savePluginData(): Promise<void> {
  await this.saveData({
    settings: this.settings,
    eventCache: this.eventCache,
  });
}
```

### Pattern 5: Sync Status State Machine
**What:** Track sync lifecycle states for UI rendering.
**When to use:** For the sync status indicator in the calendar view.
**Example:**
```typescript
type SyncState =
  | {status: 'idle'; lastSyncTime: number | null}
  | {status: 'syncing'; startedAt: number}
  | {status: 'error'; message: string; lastSyncTime: number | null};

// In SyncManager:
async syncAll(sources: CalendarSource[]): Promise<void> {
  this.setState({status: 'syncing', startedAt: Date.now()});

  try {
    // Phase 1: no actual fetching -- just demonstrate the flow
    // Phase 2+ will implement source adapters
    await Promise.all(sources.map(s => this.syncSource(s)));
    this.setState({status: 'idle', lastSyncTime: Date.now()});
  } catch (err) {
    this.setState({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
      lastSyncTime: this.state.status === 'idle' ? this.state.lastSyncTime : null,
    });
  }
}
```

### Anti-Patterns to Avoid
- **Storing View references in plugin class:** Obsidian may create/destroy views; always use `workspace.getLeavesOfType()` to find live instances.
- **Using `addStatusBarItem`:** Does not work on mobile. Use in-view status display instead.
- **Using Node.js `fs` module:** Not available on mobile. Use `saveData`/`loadData` or `app.vault.adapter`.
- **Using `fetch()` directly:** Blocked by CORS. Use `requestUrl` from the `obsidian` package.
- **Hardcoding colors/fonts:** Use Obsidian CSS variables (e.g., `--text-normal`, `--background-primary`) for theme compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin lifecycle | Custom init/destroy | Extend `Plugin` base class | Handles enable/disable, cleanup automatically |
| View registration | Custom DOM mounting | `registerView` + `ItemView` | Integrates with workspace tabs, drag-and-drop, persistence |
| Settings persistence | File I/O | `saveData`/`loadData` | Cross-platform, handles `.obsidian/plugins/` path automatically |
| Settings UI | Custom form elements | `Setting` class API | Consistent with Obsidian UX, handles theme compatibility |
| HTTP requests | `fetch()` or `axios` | `requestUrl` | CORS bypass, required by plugin guidelines, works on mobile |
| Icon system | SVG imports | Lucide icon names (`'calendar'`, `'pencil'`, `'trash'`) | Obsidian bundles Lucide; just reference by name |
| Interval management | `setInterval` directly | `this.registerInterval(window.setInterval(...))` | Auto-cleanup on plugin disable |

**Key insight:** Obsidian's API is comprehensive enough for all Phase 1 needs. Every UI component, persistence mechanism, and lifecycle concern has a built-in solution. Adding external dependencies increases bundle size and risks mobile incompatibility.

## Common Pitfalls

### Pitfall 1: View Not Persisting Across Restarts
**What goes wrong:** Calendar view disappears when Obsidian restarts.
**Why it happens:** View state isn't saved by `registerView` alone; Obsidian persists the workspace layout, but the view type must be re-registered on load.
**How to avoid:** Call `registerView` early in `onload()` before any workspace layout restoration happens. Use `app.workspace.onLayoutReady()` to delay view activation until the workspace is ready.
**Warning signs:** View appears on first open but not after restart; error about unknown view type in console.

### Pitfall 2: Mobile Incompatibility
**What goes wrong:** Plugin crashes or features missing on Obsidian mobile.
**Why it happens:** Using `addStatusBarItem()` (not available on mobile), Node.js `fs` module, or `fetch()` instead of `requestUrl`.
**How to avoid:** Set `isDesktopOnly: false` in manifest.json. Never use `addStatusBarItem`. Use `requestUrl` for HTTP. Test on mobile early.
**Warning signs:** Plugin works on desktop but not mobile; community plugin review rejection.

### Pitfall 3: Settings Not Persisting After Tab Switch
**What goes wrong:** Dropdown/text values reset when user navigates away and back to settings.
**Why it happens:** Not calling `.setValue()` with the saved value when `display()` is called.
**How to avoid:** Always set initial values from `this.plugin.settings` in `display()`.
**Warning signs:** Settings appear to save (onChange fires) but reset visually.

### Pitfall 4: saveData Race Conditions
**What goes wrong:** Concurrent `saveData` calls overwrite each other.
**Why it happens:** Multiple rapid settings changes or sync + settings save simultaneously.
**How to avoid:** Debounce saves or use a save queue. Since `saveData` writes the entire object, the last write wins. Keep a single source of truth in memory and save the complete state.
**Warning signs:** Settings intermittently revert to old values.

### Pitfall 5: Android requestUrl PROPFIND Limitation
**What goes wrong:** CalDAV PROPFIND requests fail on Android.
**Why it happens:** Android's HTTP stack historically rejected non-standard HTTP methods. Issue tracked at obsidianmd/obsidian-api#48.
**How to avoid:** This is a known issue with a reflection-based fix applied in newer Obsidian versions. For Phase 1, no actual HTTP requests are made. For Phase 3 (CalDAV), test PROPFIND on Android early and have a fallback strategy.
**Warning signs:** CalDAV sync works on desktop/iOS but fails on Android.

### Pitfall 6: Large data.json Degrading Performance
**What goes wrong:** Plugin load time increases as event cache grows.
**Why it happens:** `loadData` parses the entire JSON file on startup. Large event caches (thousands of events) slow this down, especially on mobile.
**How to avoid:** Limit cache window (recommend 3 months back, 3 months forward). Keep event objects lean (only needed fields). Consider splitting cache into a separate file via `app.vault.adapter` if data.json exceeds ~1MB.
**Warning signs:** Noticeable delay on plugin enable; mobile sluggishness.

## Code Examples

### Calendar Event Type (Recommended Schema)
```typescript
// Source: Custom design for UniCalendar
interface CalendarEvent {
  id: string;                    // Unique: `${sourceId}::${eventUid}`
  sourceId: string;              // Which calendar source this came from
  title: string;
  start: string;                 // ISO 8601 datetime
  end: string;                   // ISO 8601 datetime
  allDay: boolean;
  location?: string;
  description?: string;
  recurrenceId?: string;         // For expanded recurring event instances
}

interface CalendarSource {
  id: string;                    // UUID generated on creation
  name: string;
  type: 'google' | 'caldav' | 'ics';
  color: string;                 // Hex color, auto-assigned or user-chosen
  enabled: boolean;

  // Type-specific config
  google?: {
    calendarId: string;
    // OAuth tokens stored separately for security
  };
  caldav?: {
    serverUrl: string;
    username: string;
    password: string;            // Note: stored in data.json -- warn user
    calendarPath?: string;
  };
  ics?: {
    feedUrl: string;
  };
}
```

### Color Palette for Auto-Assignment
```typescript
// Source: Apple Calendar-inspired palette
const SOURCE_COLORS: string[] = [
  '#FF6961',  // Red
  '#77DD77',  // Green
  '#84B6F4',  // Blue
  '#FDFD96',  // Yellow
  '#FFB347',  // Orange
  '#CB99C9',  // Purple
  '#B39EB5',  // Mauve
  '#87CEEB',  // Sky blue
  '#FFD1DC',  // Pink
  '#C1E1C1',  // Mint
];

function getNextColor(existingSources: CalendarSource[]): string {
  const usedColors = new Set(existingSources.map(s => s.color));
  return SOURCE_COLORS.find(c => !usedColors.has(c)) ?? SOURCE_COLORS[0];
}
```

### CSS Styling Pattern (Theme-Aware)
```css
/* Source: Obsidian CSS variable conventions */
.uni-calendar-view {
  padding: var(--size-4-4);
  font-family: var(--font-interface);
  color: var(--text-normal);
  background: var(--background-primary);
}

.uni-calendar-source-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--size-4-3);
  margin-bottom: var(--size-4-2);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  background: var(--background-secondary);
}

.uni-calendar-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: var(--size-4-2);
  flex-shrink: 0;
}

.uni-calendar-sync-status {
  display: flex;
  align-items: center;
  gap: var(--size-4-2);
  padding: var(--size-4-2) var(--size-4-4);
  font-size: var(--font-ui-small);
  color: var(--text-muted);
  border-top: 1px solid var(--background-modifier-border);
}

/* Empty state */
.uni-calendar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-muted);
  text-align: center;
  gap: var(--size-4-4);
}
```

### registerInterval for Periodic Sync
```typescript
// Source: obsidian.d.ts Plugin.registerInterval
// In plugin onload(), after settings are loaded:
this.registerInterval(
  window.setInterval(
    () => this.syncManager.syncAll(this.settings.sources),
    this.settings.syncInterval * 60 * 1000
  )
);
```

**Note on interval updates:** `registerInterval` returns the interval ID but doesn't provide a way to update the interval. If the user changes sync interval in settings, the old interval must be cleared and a new one registered. Store the interval ID and use `window.clearInterval()` + `this.registerInterval()` when settings change.

### ItemView addAction for Manual Sync Button
```typescript
// Source: obsidian.d.ts ItemView.addAction (since 1.1.0)
// In CalendarView.onOpen():
this.addAction('refresh-cw', 'Sync now', async () => {
  await this.plugin.syncManager.syncAll(this.plugin.settings.sources);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `addStatusBarItem` for status | In-view status indicator | Always (mobile never supported status bar) | Must place sync status inside the ItemView |
| `fetch()` for HTTP | `requestUrl()` from obsidian API | Plugin guidelines enforcement | Required for CORS bypass and mobile compatibility |
| Direct `fs` file access | `saveData`/`loadData` or `app.vault.adapter` | Mobile launch | Cross-platform persistence |
| `View.navigation` default true | Set `navigation = false` for static views | 0.15.1 | Prevents unwanted navigation behavior in calendar panel |
| Manually manage view instances | Use `getLeavesOfType()` to find views | Best practice | Avoids stale references when Obsidian recreates views |

**Deprecated/outdated:**
- `request()` function: Still works but `requestUrl()` is the current recommended API.
- Storing references to view instances: Obsidian may call the factory multiple times; always query via workspace.

## Open Questions

1. **Credential Security for CalDAV**
   - What we know: CalDAV credentials (username/password) will be stored in `data.json` which is plaintext in the vault.
   - What's unclear: Whether Obsidian provides any encrypted storage mechanism.
   - Recommendation: For Phase 1, just design the settings interface. Store credentials in `data.json` with a warning to users. Phase 3 can investigate encryption options if needed.

2. **data.json Size Under Obsidian Sync**
   - What we know: Obsidian Sync syncs plugin data including `data.json`. There's no documented hard size limit, but performance degrades with large files.
   - What's unclear: The exact threshold where performance becomes problematic on mobile.
   - Recommendation: Keep cache window to 3 months forward + 3 months back. Monitor data.json size; if it exceeds ~500KB, consider splitting event cache to a separate file via `app.vault.adapter`.

3. **CSS Injection Strategy**
   - What we know: Plugins can inject CSS via string in `onload()` or bundle a CSS file. esbuild can bundle CSS.
   - What's unclear: Best practice for Phase 1's scope of styling (calendar grid, settings cards, sync status).
   - Recommendation: Use `containerEl.createEl('style', {text: cssString})` within the view for view-specific styles, or configure esbuild to output a `styles.css` that gets loaded. The simpler approach is inline styles in the view since Phase 1 CSS is limited.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured |
| Config file | None -- Wave 0 must set up |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | Event cache persists and loads correctly | unit | `npx vitest run tests/store/EventStore.test.ts -t "persistence"` | No -- Wave 0 |
| INFR-02 | Calendar sources can be added/edited/removed from settings data | unit | `npx vitest run tests/settings/types.test.ts -t "sources"` | No -- Wave 0 |
| INFR-04 | No desktop-only APIs used (no fs, no addStatusBarItem) | lint/static | `npm run lint && npm run build` | Yes (lint exists) |
| EVNT-05 | Sync status state transitions correctly (idle/syncing/error) | unit | `npx vitest run tests/sync/SyncManager.test.ts -t "status"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` (ensures TypeScript compiles and esbuild succeeds)
- **Per wave merge:** `npx vitest run && npm run lint`
- **Phase gate:** Full suite green + manual verification in Obsidian (open plugin, check settings, check view on desktop)

### Wave 0 Gaps
- [ ] Install vitest: `npm install -D vitest`
- [ ] Create `vitest.config.ts` with Obsidian API mocking strategy
- [ ] `tests/store/EventStore.test.ts` -- covers INFR-01
- [ ] `tests/settings/types.test.ts` -- covers INFR-02 (data layer only; UI tested manually)
- [ ] `tests/sync/SyncManager.test.ts` -- covers EVNT-05
- [ ] Mock for Obsidian's `Plugin`, `ItemView`, `saveData`/`loadData` APIs

**Note:** Obsidian plugin testing is challenging because the `obsidian` module is not a real npm package (it's provided by the runtime). Unit tests should focus on pure logic (event store, sync state machine, settings data manipulation) and mock the Obsidian API boundary. UI/view testing requires manual verification in Obsidian.

## Sources

### Primary (HIGH confidence)
- `obsidian.d.ts` (node_modules/obsidian) -- Complete TypeScript API definitions for ItemView, View, Setting, Plugin, requestUrl, all interfaces
- [Obsidian Unofficial Plugin Docs - Views](https://marcusolsson.github.io/obsidian-plugin-docs/user-interface/views) -- ItemView registration pattern, leaf management, code examples
- [Obsidian Official Docs - Views](https://docs.obsidian.md/Plugins/User+interface/Views) -- Official view documentation
- [Obsidian Official Docs - Settings](https://docs.obsidian.md/Plugins/User+interface/Settings) -- Settings tab patterns

### Secondary (MEDIUM confidence)
- [Obsidian Forum - requestUrl and CORS](https://forum.obsidian.md/t/make-http-requests-from-plugins/15461) -- requestUrl usage patterns, CORS bypass behavior
- [Obsidian Forum - requestUrl mobile performance](https://forum.obsidian.md/t/bug-mobile-requesturl-has-performance-issue/84177) -- Mobile limitations with large payloads
- [Giter VIP - requestUrl Android PROPFIND issue](https://giter.vip/obsidianmd/obsidian-api/issues/48) -- Android limitation with non-standard HTTP methods, reflection fix
- [Obsidian Forum - Plugin data persistence](https://forum.obsidian.md/t/how-could-plugin-persist-data/55959) -- saveData/loadData patterns, vault adapter alternatives

### Tertiary (LOW confidence)
- [DeepWiki - Obsidian API UI Components](https://deepwiki.com/obsidianmd/obsidian-api/5.3-common-interfaces-and-types) -- Setting class method inventory (verified against obsidian.d.ts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All APIs verified directly in obsidian.d.ts type definitions
- Architecture: HIGH -- Patterns from official/unofficial docs, verified against actual API types
- Pitfalls: MEDIUM -- Aggregated from forum posts and GitHub issues; Android PROPFIND issue confirmed but fix status unclear

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (Obsidian API is stable; patterns unlikely to change in 30 days)

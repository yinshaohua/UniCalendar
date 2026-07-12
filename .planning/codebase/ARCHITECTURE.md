# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Plugin Architecture (Obsidian Community Plugin)

**Key Characteristics:**
- Plugin-based extension system for Obsidian markdown editor
- TypeScript-first with strict type checking enabled
- Single-file bundled output (esbuild) with external dependencies excluded
- Lifecycle-driven initialization with cleanup/teardown via `onload()` and `onunload()`
- Settings persistence using Obsidian's built-in data API

## Layers

**Plugin Layer:**
- Purpose: Main plugin class that extends Obsidian's Plugin base class
- Location: `src/main.ts`
- Contains: Plugin lifecycle management, UI registration (ribbon icons, commands, status bar), event listeners
- Depends on: Obsidian API (`obsidian`), Settings module (`src/settings.ts`)
- Used by: Obsidian application runtime

**Settings Layer:**
- Purpose: Configuration management and settings UI
- Location: `src/settings.ts`
- Contains: Settings interface definition (`MyPluginSettings`), default values (`DEFAULT_SETTINGS`), settings tab UI (`SampleSettingTab`)
- Depends on: Obsidian API (`obsidian`), Plugin class (`src/main.ts`)
- Used by: Plugin layer for reading/writing user preferences

## Data Flow

**Plugin Initialization Flow:**

1. Obsidian loads `main.js` and instantiates `MyPlugin` class
2. `onload()` is called by Obsidian runtime
3. Settings are loaded via `this.loadSettings()` (merges saved data with defaults)
4. UI elements are registered:
   - Ribbon icon added via `this.addRibbonIcon()`
   - Status bar item added via `this.addStatusBarItem()`
   - Commands added via `this.addCommand()` (simple, editor-based, and complex with checks)
   - Settings tab registered via `this.addSettingTab()`
5. Global event listeners attached via `this.registerDomEvent()` and `this.registerInterval()`
6. Plugin remains active until disabled

**Settings Update Flow:**

1. User modifies setting in settings tab UI
2. `onChange` callback updates `this.plugin.settings`
3. `this.plugin.saveSettings()` persists to disk via `this.saveData()`
4. Setting value synchronized across UI and in-memory state

**Plugin Unload Flow:**

1. Obsidian calls `onunload()` when plugin is disabled
2. All registered listeners, events, and intervals automatically cleaned up (via `register*()` helpers)
3. Plugin instance destroyed

**State Management:**
- Instance state stored in `settings` property on plugin class
- Persisted settings stored via Obsidian's `saveData()` (file-based JSON storage)
- Modal state (if needed) managed within modal class lifecycle

## Key Abstractions

**Plugin Class (MyPlugin):**
- Purpose: Main application entry point and lifecycle manager
- Examples: `src/main.ts` (MyPlugin class)
- Pattern: Inheritance from Obsidian's Plugin base class; all lifecycle and registration methods called on this instance

**Modal Class (SampleModal):**
- Purpose: Temporary UI overlay for user interaction
- Examples: `src/main.ts` (SampleModal class)
- Pattern: Inheritance from Obsidian's Modal base class; `onOpen()` renders content, `onClose()` cleans up

**Settings Tab (SampleSettingTab):**
- Purpose: UI for persisting user configuration
- Examples: `src/settings.ts` (SampleSettingTab class)
- Pattern: Inheritance from Obsidian's PluginSettingTab; `display()` method builds UI elements

## Entry Points

**main.ts (Plugin Entry):**
- Location: `src/main.ts`
- Triggers: Obsidian application startup or plugin enable in settings
- Responsibilities:
  - Extends Plugin base class
  - Registers all UI elements (ribbon icons, commands, status bar, settings tab)
  - Attaches global event listeners
  - Manages settings lifecycle (load/save)

**Compiled Entry:**
- Location: `main.js` (root level, compiled from `src/main.ts`)
- Triggers: Obsidian loads the plugin from `.obsidian/plugins/<plugin-id>/main.js`
- Format: CommonJS bundle with all source files inlined; external dependencies excluded

## Error Handling

**Strategy:** Implicit handling via Obsidian framework; no explicit try-catch patterns observed

**Patterns:**
- Settings load wrapped in `Object.assign()` to provide defaults if data missing
- No error handling for command execution or event listeners (relies on Obsidian's error boundary)
- Modal operations (`onOpen`, `onClose`) use direct DOM manipulation with no validation

## Cross-Cutting Concerns

**Logging:** `console.log()` used in interval callback for debugging; no structured logging framework

**Validation:** Minimal validation observed; settings text input accepts any string value

**Authentication:** Not applicable; plugin operates entirely within Obsidian vault context

**Resource Cleanup:** Handled automatically via `register*()` helper functions (`registerEvent()`, `registerDomEvent()`, `registerInterval()`) which attach listeners that are cleaned up on `onunload()`

---

*Architecture analysis: 2026-03-31*

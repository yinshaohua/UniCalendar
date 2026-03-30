<!-- GSD:project-start source:PROJECT.md -->
## Project

**UniCalendar**

An Obsidian plugin that provides a unified, beautifully designed calendar view by syncing events from multiple calendar sources (Google Calendar, CalDAV/ICS) into a single interface. Read-only sync with Apple Calendar-inspired UI, designed to replace existing plugins that have poor CalDAV support and unfriendly interfaces.

**Core Value:** Users can see all their calendar events from multiple sources in one clean, reliable view inside Obsidian — especially sources like DingTalk calendar that existing plugins fail to support.

### Constraints

- **Platform**: Must work on both Obsidian desktop and mobile
- **Auth**: Google Calendar requires OAuth2; need to handle token storage securely within Obsidian vault
- **CalDAV Compatibility**: Must work with DingTalk's CalDAV implementation specifically
- **Obsidian API**: Must use Obsidian's plugin API patterns (lifecycle, settings, views)
- **Bundle Size**: Single-file bundle via esbuild; keep dependencies minimal
- **Offline**: Must cache events locally for offline viewing
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - Core plugin development
- JavaScript (ES6+) - Bundled output and build scripts
- Node.js - Build and development environment
## Runtime
- Obsidian Application Runtime (Desktop & Mobile)
- Minimum Obsidian version: 0.15.0
- npm (Node Package Manager)
- Lockfile: `package-lock.json` (present)
## Frameworks
- Obsidian API (latest) - Plugin framework for Obsidian note-taking application
- esbuild 0.25.5 - JavaScript bundler and minifier
- TypeScript 5.8.3 - Type-safe JavaScript compilation
- ESLint (via typescript-eslint 8.35.1 & @eslint/js 9.30.1) - Code linting
- eslint-plugin-obsidianmd 0.1.9 - Obsidian-specific linting rules
- jiti 2.6.1 - Runtime TypeScript/ESM support for config files
## Key Dependencies
- obsidian (latest) - Obsidian plugin framework
- tslib 2.4.0 - TypeScript runtime helper library
- globals 14.0.0 - ESLint globals configuration
- @types/node 16.11.6 - Node.js type definitions (development only)
## Configuration
- `esbuild.config.mjs` - ESBuild bundler config
- `tsconfig.json`
- `eslint.config.mts` (ESLint flat config format)
- `package.json`
- `manifest.json`
## Build Scripts
## Platform Requirements
- Node.js: ^18.18.0 || ^20.9.0 || >=21.1.0 (required by ESLint tooling)
- npm: Latest stable
- Git: For version management
- Obsidian (>=0.15.0)
- Desktop: Windows, macOS, Linux
- Mobile: iOS, Android (plugin is not desktop-only)
## External Dependencies
- @codemirror modules (@codemirror/state, @codemirror/view, @codemirror/autocomplete, @codemirror/language, etc.)
- @lezer/* modules (@lezer/common, @lezer/highlight, @lezer/lr)
- electron - Obsidian desktop runtime
- obsidian - Main plugin framework
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for class/module files: `main.ts`, `settings.ts`
- Lowercase with hyphens for configuration files: `eslint.config.mts`, `esbuild.config.mjs`
- Simple, descriptive names reflecting primary export or responsibility
- camelCase for function and method names
- Prefix async operations with clear intent: `loadSettings()`, `saveSettings()`, `onload()`, `onOpen()`
- Callback handlers use camelCase prefixed with event context: `editorCallback`, `checkCallback`, `onChange`
- camelCase for all local variables and properties
- Const by default, only using `let` when reassignment is necessary
- DOM element references suffixed with `El`: `contentEl`, `statusBarItemEl`, `containerEl`
- Destructuring used for clarity: `const {contentEl} = this;`, `const {containerEl} = this;`
- PascalCase for interface names: `MyPluginSettings`, `SampleSettingTab`
- Explicit type annotations in class properties
- Generic settings objects use named interfaces rather than inline types
- PascalCase class names: `MyPlugin`, `SampleModal`, `SampleSettingTab`
- Extend framework base classes (Plugin, Modal, PluginSettingTab)
- Use `export default` for main plugin class
## Code Style
- No dedicated formatter configured (Prettier not installed)
- Consistent 1-space indentation observed in source files
- Line lengths typically 80-100 characters
- Semicolons used consistently at end of statements
- Tool: TypeScript ESLint (typescript-eslint 8.35.1)
- Config: `eslint.config.mts` (flat config format)
- Plugins: eslint-plugin-obsidianmd for Obsidian-specific rules
- Key rules enforced by obsidianmd plugin:
## Import Organization
- None configured; relative paths used throughout
- baseUrl set to "src" in tsconfig.json for module resolution
- All imports use relative paths from file location
- Named imports preferred for clarity
- Default export used for plugin main class
- Destructuring used in imports: `import {App, Editor, MarkdownView, Modal, Notice, Plugin}`
## Error Handling
- No explicit try-catch blocks observed in current codebase
- Async operations use await with implicit error propagation
- Framework callbacks handle errors implicitly through Plugin lifecycle
- Settings operations assume success (Object.assign pattern)
- Rely on framework error handling for lifecycle hooks
- No explicit error messages or user notifications for system errors
- Notice() used for user-facing messages
## Logging
- Minimal logging observed
- `console.log` used once in interval registration: `console.log('setInterval')`
- No centralized logging service
- Typically log only for debugging, not production telemetry
## Comments
- Single-line comments explain non-obvious behavior
- Inline comments used sparingly for clarification
- Comments explain intent/reasoning, not what code does
- Not used in current codebase
- Could be beneficial for public plugin API methods
- `// Remember to rename these classes and interfaces!` - Template placeholder
- `// Called when the user clicks the icon.` - Explain callback intent
- `// This creates an icon in the left ribbon.` - Explain framework method purpose
## Function Design
- Methods typically 10-30 lines
- Plugin lifecycle hooks (`onload`, `onunload`, `loadSettings`, `saveSettings`) range from 1-60 lines
- Complex logic (command registration) broken into logical sections
- Minimal parameters per function (0-2 typical)
- Use `this` context for accessing plugin state and methods
- Framework callbacks provide context in parameters: `(evt: MouseEvent)`, `(editor: Editor, view: MarkdownView)`
- Async methods return Promises (loadSettings, saveSettings, loadData, saveData)
- Synchronous methods typically return void for setup/configuration methods
- Complex callback returns boolean for command availability checks
## Module Design
- Default export for main plugin class in `main.ts`
- Named exports for settings-related types and classes in `settings.ts`
- Interface exported alongside default implementation
- Not used; direct imports from module files
- Settings logic separated into dedicated `settings.ts` module
- Main plugin lifecycle in `main.ts`
- Related classes (SampleModal) defined in same file as usage context
## Async/Await Patterns
- `async` keyword used for any method that needs to wait for promises
- `await` used consistently when calling async operations
- Promises from framework methods: `this.loadData()`, `this.saveData()`, `this.loadSettings()`
## Type Annotations
- TypeScript strict mode enabled (strictNullChecks, noImplicitAny, noImplicitReturns, etc.)
- Full type annotations required for function parameters and returns
- No implicit `any` types
- Type assertions used when needed: `await this.loadData() as Partial<MyPluginSettings>`
- Should be used sparingly, only when TypeScript cannot infer correctly
## Callback Patterns
- Use arrow functions for lexical `this` binding: `(evt: MouseEvent) => { new Notice(...) }`
- Inline for simple operations, extracted to methods for complex logic
- Event handlers use appropriate parameter types from framework
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Plugin-based extension system for Obsidian markdown editor
- TypeScript-first with strict type checking enabled
- Single-file bundled output (esbuild) with external dependencies excluded
- Lifecycle-driven initialization with cleanup/teardown via `onload()` and `onunload()`
- Settings persistence using Obsidian's built-in data API
## Layers
- Purpose: Main plugin class that extends Obsidian's Plugin base class
- Location: `src/main.ts`
- Contains: Plugin lifecycle management, UI registration (ribbon icons, commands, status bar), event listeners
- Depends on: Obsidian API (`obsidian`), Settings module (`src/settings.ts`)
- Used by: Obsidian application runtime
- Purpose: Configuration management and settings UI
- Location: `src/settings.ts`
- Contains: Settings interface definition (`MyPluginSettings`), default values (`DEFAULT_SETTINGS`), settings tab UI (`SampleSettingTab`)
- Depends on: Obsidian API (`obsidian`), Plugin class (`src/main.ts`)
- Used by: Plugin layer for reading/writing user preferences
## Data Flow
- Instance state stored in `settings` property on plugin class
- Persisted settings stored via Obsidian's `saveData()` (file-based JSON storage)
- Modal state (if needed) managed within modal class lifecycle
## Key Abstractions
- Purpose: Main application entry point and lifecycle manager
- Examples: `src/main.ts` (MyPlugin class)
- Pattern: Inheritance from Obsidian's Plugin base class; all lifecycle and registration methods called on this instance
- Purpose: Temporary UI overlay for user interaction
- Examples: `src/main.ts` (SampleModal class)
- Pattern: Inheritance from Obsidian's Modal base class; `onOpen()` renders content, `onClose()` cleans up
- Purpose: UI for persisting user configuration
- Examples: `src/settings.ts` (SampleSettingTab class)
- Pattern: Inheritance from Obsidian's PluginSettingTab; `display()` method builds UI elements
## Entry Points
- Location: `src/main.ts`
- Triggers: Obsidian application startup or plugin enable in settings
- Responsibilities:
- Location: `main.js` (root level, compiled from `src/main.ts`)
- Triggers: Obsidian loads the plugin from `.obsidian/plugins/<plugin-id>/main.js`
- Format: CommonJS bundle with all source files inlined; external dependencies excluded
## Error Handling
- Settings load wrapped in `Object.assign()` to provide defaults if data missing
- No error handling for command execution or event listeners (relies on Obsidian's error boundary)
- Modal operations (`onOpen`, `onClose`) use direct DOM manipulation with no validation
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

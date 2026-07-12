# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

**Files:**
- PascalCase for class/module files: `main.ts`, `settings.ts`
- Lowercase with hyphens for configuration files: `eslint.config.mts`, `esbuild.config.mjs`
- Simple, descriptive names reflecting primary export or responsibility

**Functions:**
- camelCase for function and method names
- Prefix async operations with clear intent: `loadSettings()`, `saveSettings()`, `onload()`, `onOpen()`
- Callback handlers use camelCase prefixed with event context: `editorCallback`, `checkCallback`, `onChange`

**Variables:**
- camelCase for all local variables and properties
- Const by default, only using `let` when reassignment is necessary
- DOM element references suffixed with `El`: `contentEl`, `statusBarItemEl`, `containerEl`
- Destructuring used for clarity: `const {contentEl} = this;`, `const {containerEl} = this;`

**Types:**
- PascalCase for interface names: `MyPluginSettings`, `SampleSettingTab`
- Explicit type annotations in class properties
- Generic settings objects use named interfaces rather than inline types

**Classes:**
- PascalCase class names: `MyPlugin`, `SampleModal`, `SampleSettingTab`
- Extend framework base classes (Plugin, Modal, PluginSettingTab)
- Use `export default` for main plugin class

## Code Style

**Formatting:**
- No dedicated formatter configured (Prettier not installed)
- Consistent 1-space indentation observed in source files
- Line lengths typically 80-100 characters
- Semicolons used consistently at end of statements

**Linting:**
- Tool: TypeScript ESLint (typescript-eslint 8.35.1)
- Config: `eslint.config.mts` (flat config format)
- Plugins: eslint-plugin-obsidianmd for Obsidian-specific rules
- Key rules enforced by obsidianmd plugin:
  - No forbidden elements in plugin
  - No hardcoded config paths
  - No sample code in production
  - Proper command ID and name formatting

## Import Organization

**Order:**
1. Framework/external imports: `import {App, Plugin} from 'obsidian'`
2. Local relative imports: `import {DEFAULT_SETTINGS} from "./settings"`
3. All imports grouped together before code

**Path Aliases:**
- None configured; relative paths used throughout
- baseUrl set to "src" in tsconfig.json for module resolution
- All imports use relative paths from file location

**Import Style:**
- Named imports preferred for clarity
- Default export used for plugin main class
- Destructuring used in imports: `import {App, Editor, MarkdownView, Modal, Notice, Plugin}`

## Error Handling

**Patterns:**
- No explicit try-catch blocks observed in current codebase
- Async operations use await with implicit error propagation
- Framework callbacks handle errors implicitly through Plugin lifecycle
- Settings operations assume success (Object.assign pattern)

**Current approach:**
- Rely on framework error handling for lifecycle hooks
- No explicit error messages or user notifications for system errors
- Notice() used for user-facing messages

## Logging

**Framework:** console (implicitly used)

**Patterns:**
- Minimal logging observed
- `console.log` used once in interval registration: `console.log('setInterval')`
- No centralized logging service
- Typically log only for debugging, not production telemetry

## Comments

**When to Comment:**
- Single-line comments explain non-obvious behavior
- Inline comments used sparingly for clarification
- Comments explain intent/reasoning, not what code does

**JSDoc/TSDoc:**
- Not used in current codebase
- Could be beneficial for public plugin API methods

**Examples:**
- `// Remember to rename these classes and interfaces!` - Template placeholder
- `// Called when the user clicks the icon.` - Explain callback intent
- `// This creates an icon in the left ribbon.` - Explain framework method purpose

## Function Design

**Size:**
- Methods typically 10-30 lines
- Plugin lifecycle hooks (`onload`, `onunload`, `loadSettings`, `saveSettings`) range from 1-60 lines
- Complex logic (command registration) broken into logical sections

**Parameters:**
- Minimal parameters per function (0-2 typical)
- Use `this` context for accessing plugin state and methods
- Framework callbacks provide context in parameters: `(evt: MouseEvent)`, `(editor: Editor, view: MarkdownView)`

**Return Values:**
- Async methods return Promises (loadSettings, saveSettings, loadData, saveData)
- Synchronous methods typically return void for setup/configuration methods
- Complex callback returns boolean for command availability checks

## Module Design

**Exports:**
- Default export for main plugin class in `main.ts`
- Named exports for settings-related types and classes in `settings.ts`
- Interface exported alongside default implementation

**Barrel Files:**
- Not used; direct imports from module files

**Organization:**
- Settings logic separated into dedicated `settings.ts` module
- Main plugin lifecycle in `main.ts`
- Related classes (SampleModal) defined in same file as usage context

## Async/Await Patterns

**Usage:**
- `async` keyword used for any method that needs to wait for promises
- `await` used consistently when calling async operations
- Promises from framework methods: `this.loadData()`, `this.saveData()`, `this.loadSettings()`

**Example:**
```typescript
async onload() {
    await this.loadSettings();
    // ... rest of initialization
}

async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
}
```

## Type Annotations

**Strictness:**
- TypeScript strict mode enabled (strictNullChecks, noImplicitAny, noImplicitReturns, etc.)
- Full type annotations required for function parameters and returns
- No implicit `any` types

**Casting:**
- Type assertions used when needed: `await this.loadData() as Partial<MyPluginSettings>`
- Should be used sparingly, only when TypeScript cannot infer correctly

## Callback Patterns

**Framework Callbacks:**
- Use arrow functions for lexical `this` binding: `(evt: MouseEvent) => { new Notice(...) }`
- Inline for simple operations, extracted to methods for complex logic
- Event handlers use appropriate parameter types from framework

---

*Convention analysis: 2026-03-31*

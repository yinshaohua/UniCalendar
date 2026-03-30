# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- TypeScript 5.8.3 - Core plugin development
- JavaScript (ES6+) - Bundled output and build scripts

**Secondary:**
- Node.js - Build and development environment

## Runtime

**Environment:**
- Obsidian Application Runtime (Desktop & Mobile)
- Minimum Obsidian version: 0.15.0

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Obsidian API (latest) - Plugin framework for Obsidian note-taking application
  - Provides: App, Plugin, PluginSettingTab, Editor, MarkdownView, Modal, Notice APIs

**Build/Dev:**
- esbuild 0.25.5 - JavaScript bundler and minifier
- TypeScript 5.8.3 - Type-safe JavaScript compilation

**Development Tools:**
- ESLint (via typescript-eslint 8.35.1 & @eslint/js 9.30.1) - Code linting
- eslint-plugin-obsidianmd 0.1.9 - Obsidian-specific linting rules
- jiti 2.6.1 - Runtime TypeScript/ESM support for config files

## Key Dependencies

**Critical:**
- obsidian (latest) - Obsidian plugin framework
  - Purpose: Provides plugin APIs for UI components, settings, modals, commands
  - Dependency chain includes: @codemirror modules for text editing, @lezer for parsing

**Utilities:**
- tslib 2.4.0 - TypeScript runtime helper library
- globals 14.0.0 - ESLint globals configuration
- @types/node 16.11.6 - Node.js type definitions (development only)

## Configuration

**Build Configuration:**
- `esbuild.config.mjs` - ESBuild bundler config
  - Entry point: `src/main.ts`
  - Output: `main.js` (CommonJS format)
  - Target: ES2018
  - Tree shaking: enabled
  - Sourcemaps: enabled in dev, disabled in production
  - Minification: enabled in production

**TypeScript Configuration:**
- `tsconfig.json`
  - Base URL: `src`
  - Module: ESNext
  - Target: ES6
  - Strict mode enabled (noImplicitAny, strictNullChecks, strictBindCallApply, etc.)
  - Inline sourcemaps and sources
  - DOM, ES5, ES6, ES7 libraries included

**Linting Configuration:**
- `eslint.config.mts` (ESLint flat config format)
  - Plugins: typescript-eslint, eslint-plugin-obsidianmd
  - Parser: TypeScript-enabled
  - Global ignores: node_modules, dist, build artifacts, main.js

**Package Configuration:**
- `package.json`
  - Type: "module" (ESM format for config files)
  - Main entry: `main.js`
  - License: 0-BSD

**Plugin Manifest:**
- `manifest.json`
  - Plugin ID: sample-plugin
  - Version: 1.0.0
  - Min Obsidian: 0.15.0
  - Desktop & Mobile compatible

## Build Scripts

**Available Commands:**

```bash
npm run dev        # Watch mode - continuous rebuild
npm run build      # Production build with type checking
npm run lint       # ESLint code quality checks
npm version        # Version bump utility
```

## Platform Requirements

**Development:**
- Node.js: ^18.18.0 || ^20.9.0 || >=21.1.0 (required by ESLint tooling)
- npm: Latest stable
- Git: For version management

**Runtime:**
- Obsidian (>=0.15.0)
- Desktop: Windows, macOS, Linux
- Mobile: iOS, Android (plugin is not desktop-only)

## External Dependencies

**Peer Dependencies (Optional but Recommended):**
- @codemirror modules (@codemirror/state, @codemirror/view, @codemirror/autocomplete, @codemirror/language, etc.)
  - Purpose: Code editor integration (bundled externally by Obsidian)
- @lezer/* modules (@lezer/common, @lezer/highlight, @lezer/lr)
  - Purpose: Parser framework (bundled externally by Obsidian)
- electron - Obsidian desktop runtime
- obsidian - Main plugin framework

These are marked as external in esbuild config and provided by Obsidian at runtime.

---

*Stack analysis: 2026-03-31*

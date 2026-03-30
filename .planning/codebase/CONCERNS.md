# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

**Sample/Placeholder Code Not Cleaned Up:**
- Issue: Entire codebase contains sample/boilerplate code from Obsidian plugin template that has never been customized for actual use. Includes placeholder class names (`MyPlugin`, `SampleModal`, `SampleSettingTab`, `mySetting`), sample commands, and demo functionality.
- Files: `src/main.ts`, `src/settings.ts`, `manifest.json`
- Impact: Project appears incomplete or abandoned. Makes the plugin unusable and confuses users about the plugin's actual purpose. The plugin name is "sample-plugin" in manifest, suggesting it was never properly released.
- Fix approach: Replace all placeholder code with actual implementation. Rename classes, settings, and commands to reflect real functionality. Update manifest with proper plugin name, description, and version.

**Dead Code and Unused Functionality:**
- Issue: Multiple sample commands and features exist but have no real implementation (ribbon icon, status bar item, global click listener, interval logging).
- Files: `src/main.ts` (lines 13-69)
- Impact: Adds bloat, increases bundle size, and creates confusion about what the plugin actually does. Global event listeners and intervals run unnecessarily.
- Fix approach: Remove all non-functional sample code. Keep only implemented features. Add proper error handling and meaningful logging for any retained functionality.

**Broad TypeScript Errors Suppressed:**
- Issue: Code uses `as Partial<MyPluginSettings>` type assertion without proper validation in `loadSettings()` method (line 77).
- Files: `src/main.ts` (line 77)
- Impact: Settings could be partially loaded without type safety, causing runtime errors if data is corrupted or missing.
- Fix approach: Add proper type validation when loading settings. Use a validation function to ensure loaded data matches expected shape before type assertion.

## Known Bugs

**Uncontrolled Global Event Listener:**
- Symptoms: Every click on the document triggers a Notice popup with "Click" message, disrupting user workflow.
- Files: `src/main.ts` (line 64-66)
- Trigger: Click anywhere in Obsidian after plugin loads.
- Workaround: Disable the plugin to stop click spam.

**Excessive Console Logging:**
- Symptoms: Console fills with "setInterval" messages every 5 minutes regardless of user activity or plugin necessity.
- Files: `src/main.ts` (line 69)
- Trigger: Automatically runs on plugin load.
- Workaround: Check browser console to see if plugin loaded.

## Performance Bottlenecks

**Unnecessary Interval Polling:**
- Problem: Plugin registers a 5-minute interval that just logs to console with no actual purpose or effect on plugin behavior.
- Files: `src/main.ts` (line 69)
- Cause: Sample code left in production without evaluation of necessity.
- Improvement path: Remove the interval entirely or replace with actual monitoring logic if needed.

**Bundle Size Not Optimized:**
- Problem: esbuild produces minified but not heavily tree-shaken output. Sample code increases bundle unnecessarily.
- Files: `esbuild.config.mjs` (sourcemaps enabled in dev, treeShaking enabled but sample code defeats it)
- Cause: Unused functionality cannot be tree-shaken by bundler.
- Improvement path: Remove all unused sample code first, then verify tree-shaking effectiveness.

## Fragile Areas

**Settings System Lacks Validation:**
- Files: `src/main.ts` (loadSettings, line 76-78), `src/settings.ts`
- Why fragile: Uses `Object.assign` with partial type assertion, no schema validation. If settings JSON is corrupted or has missing fields, plugin may crash or silently fail.
- Safe modification: Add JSON schema validation before merging with defaults. Use a validation library or custom validator to ensure type safety.
- Test coverage: No unit tests present to verify settings loading/saving works with edge cases.

**No Error Boundaries:**
- Files: `src/main.ts` (entire onload method, lines 10-70)
- Why fragile: Plugin lifecycle is not wrapped in try-catch. Any error during onload could cause plugin to silently fail to load.
- Safe modification: Wrap `onload()` method in try-catch with proper error logging and recovery.
- Test coverage: No automated tests to verify plugin loads successfully in error scenarios.

**Global DOM Manipulation Without Cleanup:**
- Files: `src/main.ts` (lines 64-66)
- Why fragile: Global click listener is registered but has no conditional logic or event delegation strategy. Could conflict with other plugins or Obsidian's native handlers.
- Safe modification: Use event delegation, namespace event handlers, or wrap in plugin-specific container checks.
- Test coverage: No tests verify event handler cleanup on plugin disable.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Settings loading/saving, command callbacks, modal lifecycle, any plugin logic.
- Files: `src/main.ts`, `src/settings.ts`
- Risk: Regressions in core functionality go undetected. Breaking changes to Obsidian API would not be caught by automated testing.
- Priority: High

**No Integration Tests:**
- What's not tested: Plugin lifecycle within Obsidian context, interaction between commands and settings, edge cases with workspace state.
- Risk: Plugin may fail to load in certain Obsidian versions or configurations without detection.
- Priority: High

**No Test Configuration:**
- Files: No jest.config.js, vitest.config.js, or test scripts in package.json (beyond eslint).
- Impact: No testing infrastructure exists, blocking any test-driven development.
- Priority: High

## Security Considerations

**Unvalidated Settings Persistence:**
- Risk: Settings are saved to disk without schema validation. Malformed settings could crash plugin on reload.
- Files: `src/main.ts` (saveSettings, line 80-82), `src/settings.ts`
- Current mitigation: None. Uses Obsidian's native persistence which prevents file tampering but not schema violations.
- Recommendations: Add JSON schema validation before saving. Validate on load with graceful fallback to defaults if invalid.

**Overly Permissive TypeScript Configuration:**
- Risk: `allowJs` is enabled in tsconfig (line 8), which bypasses type checking for .js files.
- Files: `tsconfig.json` (line 8)
- Current mitigation: ESLint helps catch issues in TS files.
- Recommendations: Disable `allowJs` unless .js files need to be included. If needed, enable type checking on them explicitly.

**Unused but Dangerous Dependencies:**
- Risk: `obsidian` dependency pinned to "latest", which means breaking changes could silently break the plugin on install.
- Files: `package.json` (line 27)
- Current mitigation: `minAppVersion` in manifest (line 5) provides some protection.
- Recommendations: Pin obsidian to specific version range (e.g., "^0.15.0") matching minAppVersion. Test before updating.

## Scaling Limits

**Plugin Architecture Not Scalable:**
- Current capacity: Two simple .ts files, minimal functionality. Can barely serve as functional plugin.
- Limit: Will become unmanageable if features are added without refactoring directory structure.
- Scaling path: Follow AGENTS.md recommendations to implement command/ui/utils folder structure before adding new features.

**No Module System in Place:**
- Current capacity: All code is flat in src/. Can support maybe 5-10 feature commands before becoming unwieldy.
- Limit: Hard to maintain as complexity grows. Settings interface is monolithic.
- Scaling path: Create feature modules with separate command, ui, and settings per feature before reaching 1000+ lines.

## Missing Critical Features

**No Automated Release Pipeline:**
- Problem: Manual steps required for versioning, git tagging, artifact uploads per AGENTS.md section "Versioning & releases".
- Blocks: Ability to iterate quickly on releases.

**No Type Safety for Obsidian API:**
- Problem: Plugin uses untyped API calls in places (e.g., `evt` parameter in callback never used but typed as MouseEvent).
- Blocks: Potential runtime errors from incorrect API usage.

**No Plugin Specific Logging:**
- Problem: Relies only on console.log without namespace or structured logging.
- Blocks: Debugging user issues, monitoring plugin health.

## Dependencies at Risk

**Obsidian Pinned to "latest":**
- Risk: Breaking API changes from Obsidian could silently break plugin on npm install.
- Impact: Plugin fails to load without warning.
- Migration plan: Pin to specific version range (e.g., `"obsidian": "^0.15.0"`) and test before bumping. Use Obsidian's documented deprecation timeline.

**ESLint Plugin Obsidian-Specific:**
- Risk: `eslint-plugin-obsidianmd` (0.1.9) is maintained by community plugin ecosystem, could become unmaintained.
- Impact: Linting stops working, unable to catch Obsidian-specific bugs.
- Migration plan: Monitor plugin maintainability. Have fallback to generic ESLint rules if abandoned.

---

*Concerns audit: 2026-03-31*

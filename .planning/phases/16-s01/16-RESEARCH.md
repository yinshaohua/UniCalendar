# S01: 修复发布前元数据问题 — Research

**Date:** 2025-07-07

## Summary

S01 is a light metadata-alignment task. Three files need to be brought into sync at version `1.0.0`, and `package.json`'s `name` field must be changed from the sample-plugin default to `uni-calendar`. No code logic changes are required.

Current state of the three files:

| File | Field | Current Value | Target Value |
|------|-------|---------------|--------------|
| `manifest.json` | `version` | `0.1.0` | `1.0.0` |
| `package.json` | `name` | `obsidian-sample-plugin` | `uni-calendar` |
| `package.json` | `version` | `1.0.0` | `1.0.0` ✓ |
| `package.json` | `description` | sample plugin boilerplate | (leave as-is; S02 owns README) |
| `versions.json` | `"1.0.0"` | `"0.15.0"` | `"0.15.0"` ✓ |

`versions.json` already has the correct entry `{ "1.0.0": "0.15.0" }` and `manifest.json`'s `minAppVersion` is `0.15.0`, so no change is needed there.

The `README.md` is still the Obsidian sample-plugin boilerplate — that is S02's responsibility and is out of scope here.

The build pipeline (`esbuild.config.mjs`) reads `src/main.ts` and outputs `main.js` at the root. The `npm run build` script runs `tsc -noEmit -skipLibCheck` first, then esbuild. A pre-existing `main.js` already exists at the root (committed artifact — normal for Obsidian plugins).

119 tests exist in `tests/` and are run via `vitest run`.

## Recommendation

Make two targeted JSON edits:

1. `manifest.json` — change `"version": "0.1.0"` → `"version": "1.0.0"`.
2. `package.json` — change `"name": "obsidian-sample-plugin"` → `"name": "uni-calendar"`.

Then verify with `npm run build` (tsc + esbuild) and `npm test` (119 tests). No dependency changes, no new files, no structural changes.

Do **not** run `npm version` or `version-bump.mjs` — that script only adds a new entry to `versions.json` if the `minAppVersion` isn't already present, and `1.0.0 → 0.15.0` is already there. Running it would be a no-op at best and could corrupt `versions.json` at worst.

## Implementation Landscape

### Key Files

- `manifest.json` — plugin identity file; `version` field must be `1.0.0` to match `versions.json` and `package.json`.
- `package.json` — npm package descriptor; `name` must be `uni-calendar` (matches plugin `id` in `manifest.json`); `version` is already `1.0.0`.
- `versions.json` — maps plugin version → minimum Obsidian app version; already correct (`"1.0.0": "0.15.0"`), no change needed.
- `esbuild.config.mjs` — build config; entry point is `src/main.ts`, output is `main.js`. No changes needed.
- `version-bump.mjs` — helper script invoked by `npm run version`; reads `package.json` version and writes to `manifest.json` and `versions.json`. Not needed for this slice since we're editing directly.

### Build Order

1. Edit `manifest.json` version → `1.0.0`
2. Edit `package.json` name → `uni-calendar`
3. Run `npm run build` — confirms tsc passes and esbuild produces `main.js`
4. Run `npm test` — confirms all 119 tests still pass

Steps 1 and 2 are independent and can be done in either order. Steps 3 and 4 are verification only.

### Verification Approach

```bash

# Confirm version alignment

node -e "const m=require('./manifest.json'),p=require('./package.json'),v=require('./versions.json'); console.log('manifest.version:', m.version, '| package.name:', p.name, '| package.version:', p.version, '| versions keys:', Object.keys(v));"

# Build

npm run build

# Tests

npm test
```

Expected: `manifest.version: 1.0.0 | package.name: uni-calendar | package.version: 1.0.0 | versions keys: [ '1.0.0' ]`, build exits 0, 119 tests pass.

## Constraints

- `manifest.json` `id` is `uni-calendar` — `package.json` `name` should match this for consistency (Obsidian community guidelines expect the plugin folder name, `id`, and npm name to align).
- `obsidian` is listed as `"latest"` in `dependencies` — this is fine for local dev but worth noting; the community review process does not inspect `package.json` directly.
- `main.js` at the root is a committed build artifact (standard for Obsidian plugins). The build step will overwrite it.

## Common Pitfalls

- **Running `npm version 1.0.0`** — this would trigger `version-bump.mjs` via the `"version"` npm script, which checks `if (!Object.values(versions).includes(minAppVersion))` before writing. Since `0.15.0` is already a value in `versions.json`, it would skip the write — but it would still overwrite `manifest.json.version` redundantly. Avoid; edit directly.
- **Forgetting `manifest.json`** — `package.json` is already at `1.0.0` but `manifest.json` is still `0.1.0`. This is the primary gap. The Obsidian loader reads `manifest.json` for the displayed version; the community release validator also checks it.

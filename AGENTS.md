# Agent instructions

This repository is an Obsidian community plugin written in TypeScript and bundled with esbuild. Keep this file focused on rules agents must follow while editing the codebase; put product, setup, usage, and release documentation in `README.md`.

## Must know

- Source code lives under `src/`; keep `src/main.ts` focused on the Obsidian plugin lifecycle and delegate feature logic to modules.
- The plugin entry point is `main.ts`, bundled to root-level `main.js` for Obsidian.
- Release artifacts are `main.js`, `manifest.json`, and optional `styles.css`.
- Use npm scripts from `package.json`; do not introduce another package manager.
- The project is configured for external `node_modules` via `setenv.ps1`. Before running Node.js build, test, lint, or install commands in PowerShell, dot-source `setenv.ps1`; do not create or commit a local `node_modules/` directory.

## Commands

```powershell
. .\setenv.ps1
npm run deps:install
npm run dev
npm run build
npm test
npm run lint
```

Use the most specific verification first, then run broader checks when relevant. Build artifacts such as `main.js` are generated outputs and should not be committed unless a release task explicitly requires them.

## Code conventions

- Keep files small and focused; split files that grow beyond roughly 200-300 lines when there is a clear module boundary.
- Prefer `async`/`await`, typed interfaces, and explicit error handling.
- Register Obsidian events, DOM events, and intervals through `this.register*` helpers so unload is safe.
- Persist settings with awaited `loadData()` / `saveData()` calls and sensible defaults.
- User-facing commands must use stable command IDs.
- Avoid large dependencies, Node/Electron-only APIs, and desktop-only assumptions unless `manifest.json` is updated intentionally.

## Obsidian constraints

- `manifest.json` must keep a stable `id`, accurate `version`, `minAppVersion`, `description`, and `isDesktopOnly` value.
- If changing a release version, update both `manifest.json` and `versions.json` consistently.
- Keep mobile compatibility in mind because `isDesktopOnly` is currently `false`.

## Privacy and security

- Default to local/offline operation.
- Do not add network calls unless they are essential to a user-facing feature and documented.
- Do not add telemetry, ads, remote code execution, or auto-update behavior.
- Do not store or transmit vault contents unless essential and clearly consented to by the user.
- Never log secrets, credentials, tokens, vault contents, or personal data.

## UI copy

- Use sentence case for headings, buttons, and settings labels.
- Keep in-app text short and action-oriented.
- Use Obsidian-style navigation copy such as **Settings → Community plugins** in documentation.

## Project-specific sync notes

- Feishu CalDAV (`https://caldav.feishu.cn`) REPORT may return only event hrefs and no inline `calendar-data`; preserve fallback fetching through multiget/concurrent GET.
- Do not reduce `DEFAULT_FALLBACK_TIMEOUT_MS` below about `10000` ms without reproducing Feishu sync behavior.
- Empty Feishu `<calendar-data/>` responses can produce ICS warning noise; the decisive signal is whether fallback fetch completes and returns events.

# UniCalendar

A unified calendar view for [Obsidian](https://obsidian.md) that aggregates events from Google Calendar, CalDAV servers, and ICS feeds into a single month view — with Chinese lunar calendar, solar terms, and public holiday annotations.

![UniCalendar screenshot](docs/screenshot.png)

## Features

- **Unified month view** — see all your calendar sources in one place, color-coded by source
- **Google Calendar sync** — OAuth 2.0 PKCE flow, no server required; supports multiple calendars per account
- **CalDAV sync** — connect to Nextcloud, iCloud, Fastmail, or any CalDAV-compatible server
- **ICS feed sync** — subscribe to any public or private `.ics` URL
- **Chinese lunar calendar** — lunar dates, traditional festivals (春节, 端午, 中秋…), and 24 solar terms displayed in each cell
- **Public holiday overlay** — statutory holidays and adjusted workdays (补班) sourced from [holiday-cn](https://github.com/NateScarlet/holiday-cn)
- **Event deduplication** — events shared across sources are shown once, with configurable source priority. Additional same-source deduplication removes duplicate instances when a provider returns the same occurrence more than once; if duplicates share the same source, start time, and overlapping normalized titles (exact match or one title containing the other), UniCalendar keeps the richer copy (for example the one with location, description, or meeting link metadata)
- **Auto-sync** — configurable sync interval (default 30 minutes); manual sync available via command palette
- **Mobile compatible** — works on iOS and Android (`isDesktopOnly: false`)

## Installation

### From Obsidian community plugins (recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for **UniCalendar**
3. Select **Install**, then **Enable**

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/yinsh/UniCalendar/releases/latest)
2. Copy the three files to `<Vault>/.obsidian/plugins/uni-calendar/`
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → UniCalendar** to configure calendar sources.

### Add a Google Calendar source

1. Select **Add source → Google Calendar**
2. Enter your Google OAuth client ID and client secret (see [Google Cloud Console](https://console.cloud.google.com/))
3. Choose a **Google proxy mode** if your network needs help reaching Google OAuth and Calendar API endpoints
4. Select **Authorize** — a browser window opens for the OAuth flow
5. After authorization, select which calendars to include

#### Google proxy modes

UniCalendar supports three Google proxy modes:

- **System proxy** — uses Obsidian/Electron networking. This is the default and respects the proxy behavior provided by the app/runtime.
- **No proxy** — sends Google requests directly from the desktop plugin process. Use this when a system proxy interferes with Google requests.
- **Custom proxy** — connects through a local or LAN HTTP proxy with `host` and `port`, for example `127.0.0.1` and `7897`.

Custom proxy mode is for standard HTTP CONNECT proxies. UniCalendar opens a CONNECT tunnel to Google, upgrades it to TLS, and then sends the original Google OAuth token and Calendar API requests through that tunnel. It is not a forwarding endpoint and does not use a `target=` query parameter.

The legacy **Google proxy address** field is kept only for older saved data migration. New saves store `proxyMode`, `proxyHost`, and `proxyPort`, and clear the old `proxyUrl` value.

### Add a CalDAV source

1. Select **Add source → CalDAV**
2. Enter the server URL, username, and password
3. Select **Discover calendars** to list available calendars

For Feishu/Lark CalDAV performance notes and troubleshooting, see [Feishu CalDAV diagnostics](docs/feishu-caldav-diagnostics.md).

### Add an ICS feed

1. Select **Add source → ICS feed**
2. Paste the ICS URL
3. Optionally set a display name and color

### Other settings

| Setting | Default | Description |
|---|---|---|
| Sync interval | 15 min | How often to auto-sync all sources |
| Show lunar calendar | On | Display lunar dates and festivals in month cells |
| Show holidays | On | Overlay public holiday and workday annotations |
| Month overflow mode | Expand | How to handle cells with more events than fit |

### Event title filters

Use **Settings → UniCalendar → Event title filters** to hide noisy events across **all** calendar sources without deleting the underlying event data.

Each rule supports two modes:

- **Hide when title exactly matches** — useful for suppressing one recurring event name only
- **Hide when title contains the string** — useful for suppressing classes of events by keyword

Examples:

- Input `WaytoAGI晚8点共学` with **exact match** hides only events whose title is exactly `WaytoAGI晚8点共学`
- Input `WaytoAGI` with **contains** hides any event whose title contains `WaytoAGI`

Matching is case-insensitive and ignores leading/trailing or repeated whitespace.

## Usage

- Select the **calendar icon** in the ribbon to open the calendar view
- Use the **command palette** (`Ctrl/Cmd+P`) and search for **Open calendar**
- Navigate months with the `<` and `>` arrows in the view header
- Select any event to see its full details

## Privacy

UniCalendar operates entirely locally. Calendar credentials are stored in your vault's plugin data file (`<Vault>/.obsidian/plugins/uni-calendar/data.json`). No data is sent to any third-party service other than the calendar providers you explicitly configure. Holiday data is fetched from the [jsdelivr CDN](https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn) on first load and cached locally.

## Development

UniCalendar is an Obsidian community plugin. The TypeScript entry point is `main.ts`, bundled by esbuild into root-level `main.js`, which Obsidian loads together with `manifest.json` and optional `styles.css`.

### Project structure

```text
src/
  main.ts                 # Plugin lifecycle, command/view registration
  lunar/                  # Lunar calendar, solar terms, and holiday services
  models/                 # Shared domain types
  settings/               # Settings tab and configuration UI
  store/                  # Event storage, filtering, and deduplication
  sync/                   # Google, CalDAV, and ICS sync adapters
  views/                  # Calendar view and event detail modal
tests/                    # Vitest test suites and Obsidian mocks
```

Keep `src/main.ts` small and place feature logic in focused modules under `src/`.

### Environment

This project can keep `node_modules` outside the repository directory, which is useful for OneDrive-synced workspaces. To opt in, dot-source `setenv.ps1` before running npm commands in the current PowerShell session:

```powershell
. .\setenv.ps1
```

The script sets `EXTERNAL_NODE_MODULES` to `C:/local_data/<project-folder>/node_modules` and updates `NODE_PATH`/`PATH` for that shell session. With it loaded, npm scripts resolve tools from the external directory. Without it, scripts fall back to local `./node_modules`. Do not create a symlink or junction back to `node_modules`. See [External node_modules guide](EXTERNAL-NODE-MODULES-GUIDE.md) for details.

### Common commands

```powershell
# Optional but recommended for this workspace.
. .\setenv.ps1

# Install dependencies.
npm run deps:install

# Watch mode, auto-recompile on save.
npm run dev

# Production build.
npm run build

# Run tests.
npm test

# Lint.
npm run lint
```

### Manual testing

Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/uni-calendar/`, then reload Obsidian and enable the plugin in **Settings → Community plugins**.

### Manifest and releases

- Keep `manifest.json` fields accurate, including `id`, `name`, `version`, `minAppVersion`, `description`, and `isDesktopOnly`.
- Treat `manifest.json` `id` as stable after release.
- When bumping a release version, update both `manifest.json` and `versions.json`.
- GitHub release tags should exactly match the manifest version, without a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` as individual release assets.

### Plugin guidelines

- Default to local/offline operation and document any network access clearly.
- Do not add hidden telemetry, ads, remote-code execution, or custom auto-update behavior.
- Use stable command IDs for user-facing commands.
- Keep mobile compatibility in mind because `isDesktopOnly` is `false`.
- Register events, DOM listeners, and intervals through Obsidian cleanup helpers so unload is safe.

## License

[0-BSD](LICENSE)

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
3. Select **Authorize** — a browser window opens for the OAuth flow
4. After authorization, select which calendars to include

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

```powershell
# Optional: enable external dependencies for this shell session.
# This keeps node_modules out of OneDrive-synced project directories.
. .\setenv.ps1

# Install dependencies.
# With setenv.ps1 loaded, this installs to the external directory.
# Without setenv.ps1, the same command installs to local ./node_modules.
npm run deps:install

# Watch mode (auto-recompile on save)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

Use `npm run deps:install` in both modes. By default, it behaves like `npm install` and creates local `./node_modules`. To opt in to external dependencies, dot-source `setenv.ps1` in the current PowerShell session before running npm scripts:

```powershell
. .\setenv.ps1
```

The script sets `EXTERNAL_NODE_MODULES` to `C:/local_data/<project-folder>/node_modules` and updates `NODE_PATH`/`PATH` for the session. With that variable set, `npm run deps:install` installs dependencies into the external directory, and build/test/lint resolve tools from there. Without that variable, scripts fall back to the project directory's `node_modules`. Do not create a symlink or junction back to `node_modules`. See [External node_modules guide](EXTERNAL-NODE-MODULES-GUIDE.md) for the reusable setup details.

Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/uni-calendar/` and reload Obsidian to test locally.

## License

[0-BSD](LICENSE)

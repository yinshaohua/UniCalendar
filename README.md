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
- **Event deduplication** — events shared across sources are shown once, with configurable source priority
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

### Add an ICS feed

1. Select **Add source → ICS feed**
2. Paste the ICS URL
3. Optionally set a display name and color

### Other settings

| Setting | Default | Description |
|---|---|---|
| Sync interval | 30 min | How often to auto-sync all sources |
| Show lunar calendar | On | Display lunar dates and festivals in month cells |
| Show holidays | On | Overlay public holiday and workday annotations |
| Month overflow mode | Collapse | How to handle cells with more events than fit |

## Usage

- Select the **calendar icon** in the ribbon to open the calendar view
- Use the **command palette** (`Ctrl/Cmd+P`) and search for **Open calendar**
- Navigate months with the `<` and `>` arrows in the view header
- Select any event to see its full details

## Privacy

UniCalendar operates entirely locally. Calendar credentials are stored in your vault's plugin data file (`<Vault>/.obsidian/plugins/uni-calendar/data.json`). No data is sent to any third-party service other than the calendar providers you explicitly configure. Holiday data is fetched from the [jsdelivr CDN](https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn) on first load and cached locally.

## Development

```bash
# Install dependencies
npm install

# Watch mode (auto-recompile on save)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

Copy `main.js`, `manifest.json`, and `styles.css` to `<Vault>/.obsidian/plugins/uni-calendar/` and reload Obsidian to test locally.

## License

[0-BSD](LICENSE)

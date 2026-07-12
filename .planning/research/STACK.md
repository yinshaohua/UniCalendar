# Technology Stack

**Project:** UniCalendar (Obsidian Calendar Sync Plugin)
**Researched:** 2026-03-31
**Note:** WebSearch, WebFetch, and Bash were unavailable during research. All recommendations are based on training data (cutoff ~May 2025). Versions should be verified with `npm view <package> version` before installation.

## Recommended Stack

### CalDAV Client
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsdav | ^2.x | CalDAV/CardDAV client | Only maintained TypeScript-native CalDAV library. Built-in support for CalDAV REPORT, PROPFIND, calendar-query. Works with DingTalk, Nextcloud, Apple Calendar, Radicale. Uses `cross-fetch` internally so it works in both Node and browser-like environments (critical for Obsidian mobile). | MEDIUM |

**Why tsdav over alternatives:**
- `dav` (npm): Last meaningful update ~2018. Abandoned. Do not use.
- `caldav-client` / `webdav`: Not CalDAV-specific; would require manual RFC 4791 implementation.
- Raw `fetch` + XML: Too much work to implement CalDAV PROPFIND/REPORT/MKCALENDAR from scratch. tsdav handles the XML envelope construction and response parsing.

**Critical concern:** tsdav may pull in Node-specific dependencies. Must verify it bundles cleanly with esbuild for Obsidian mobile. If it doesn't, fallback strategy is to use Obsidian's `requestUrl` API to implement a minimal CalDAV client (PROPFIND + REPORT with raw XML templates). Flag for phase-specific validation.

### ICS Parsing
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ical.js | ^2.x | Parse iCalendar (RFC 5545) data | The standard ICS parser in the JavaScript ecosystem. Used by Mozilla Thunderbird (Lightning). Handles VEVENT, VTODO, VJOURNAL, recurring events (RRULE), timezones. Pure JavaScript, no Node dependencies -- bundles cleanly for Obsidian mobile. | MEDIUM |

**Why ical.js over alternatives:**
- `node-ical`: Wraps ical.js but adds Node-only dependencies (request, rrule). Does NOT work on Obsidian mobile. Do not use.
- `ical-generator`: For *creating* ICS, not parsing. Wrong direction.
- `ics`: Focused on generation, not parsing.
- Custom parser: ICS format looks simple but recurring events (RRULE) are extremely complex. RFC 5545 recurrence is a minefield. Use a battle-tested parser.

**TypeScript types:** ical.js ships with `@types/ical.js` or has built-in types in v2. Verify at install time.

### Google Calendar Integration
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Google Calendar REST API (direct) | v3 | Read Google Calendar events | Use direct HTTP calls via Obsidian's `requestUrl` instead of the `googleapis` npm package. | HIGH |

**Why NOT use `googleapis` npm package:**
- `googleapis` is ~80MB installed, pulls in `gaxios`, `google-auth-library`, and dozens of transitive dependencies. Catastrophic for bundle size in an Obsidian plugin.
- The Google Calendar API v3 is a simple REST API. Only 2-3 endpoints needed for read-only sync: `calendarList.list`, `events.list`, `events.get`.
- OAuth2 token management is straightforward: redirect URI flow for desktop, manual token paste for mobile.

**Implementation approach:**
1. Use Obsidian's built-in `requestUrl()` for HTTP calls (works on both desktop and mobile).
2. Implement a thin Google Calendar API client (~200 lines) that wraps `requestUrl` with proper auth headers.
3. Handle OAuth2 flow: open browser for consent, receive auth code, exchange for tokens, store refresh token in plugin settings.
4. Use `requestUrl` for token refresh.

### Calendar UI Rendering
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom rendering with Obsidian API | n/a | Month/week/day calendar views | No suitable off-the-shelf calendar UI library that works within Obsidian's rendering model. Build custom views using DOM APIs. | HIGH |

**Why NOT use existing calendar UI libraries:**
- `FullCalendar`: ~150KB minified. Uses its own DOM management that conflicts with Obsidian's view lifecycle. The obsidian-full-calendar plugin tried this and had significant issues. Too heavy.
- `tui-calendar` / `toast-ui/calendar`: Similar size/conflict issues. React/Vue bindings don't apply.
- `@schedule-x/calendar`: Newer, lighter, but still assumes control of its DOM container in ways that clash with Obsidian view recycling.

**Implementation approach:**
1. Use Obsidian's `ItemView` for the calendar leaf.
2. Build month/week/day views as plain TypeScript classes that render to a container `HTMLElement`.
3. Use CSS Grid for layout (month = 7-column grid, week = 7-column + time slots, day = single column + time slots).
4. Apple Calendar-inspired styling via CSS custom properties.
5. This is 500-800 lines of view code per mode -- substantial but straightforward. No framework dependency.

### Date/Time Utilities
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Temporal API (polyfill) or date-fns | Temporal: stage 3 / date-fns: ^3.x | Date arithmetic, timezone handling, formatting | Need robust timezone support for calendar events across timezones. | MEDIUM |

**Recommendation: date-fns v3 + date-fns-tz**
- `date-fns` v3 is tree-shakeable (ESM), so only used functions are bundled. Typically adds 5-15KB to bundle.
- `date-fns-tz` handles timezone conversions needed for calendar events.
- Temporal API polyfill (`@js-temporal/polyfill`) is ~40KB and the spec is still stage 3. Too heavy and too unstable for a plugin.

**Why NOT alternatives:**
- `luxon`: ~70KB, not tree-shakeable. Too large.
- `dayjs`: Smaller (~2KB base) but timezone plugin is buggy and less maintained than date-fns-tz.
- `moment` / `moment-timezone`: Deprecated. Do not use.

### Offline Caching
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Obsidian vault JSON file | n/a | Persist synced events for offline viewing | Use Obsidian's `plugin.loadData()`/`plugin.saveData()` for small datasets, or write a `.json` file to the vault's plugin config folder for larger event stores. | HIGH |

**Why this approach:**
- Obsidian plugins don't have access to IndexedDB on mobile (restricted WebView).
- `plugin.saveData()` writes to `<vault>/.obsidian/plugins/<plugin-id>/data.json`. This is the standard Obsidian pattern.
- For large event stores (1000+ events), use a separate file in the plugin folder to avoid bloating the settings file.
- No external dependency needed.

**Data structure:** Store events as a JSON array with a `lastSynced` timestamp per calendar source. On load, read from cache; on sync, merge and overwrite.

### HTTP Client
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Obsidian `requestUrl` | Built-in | All HTTP requests | Obsidian's built-in HTTP client that works on both desktop and mobile, bypasses CORS restrictions. This is the ONLY reliable way to make HTTP requests from an Obsidian plugin on mobile. | HIGH |

**Critical:** Do NOT use `fetch`, `XMLHttpRequest`, `axios`, `node-fetch`, or any other HTTP library. They will fail on Obsidian mobile due to CORS/CSP restrictions. `requestUrl` is provided by the Obsidian API specifically for this purpose.

**Implication for tsdav:** tsdav uses `cross-fetch` internally. You will likely need to either:
1. Monkey-patch tsdav's fetch to use `requestUrl`, or
2. Fork/wrap tsdav to accept a custom fetch implementation, or
3. Implement a minimal CalDAV client using `requestUrl` directly.

This is a **critical integration risk** that must be validated early.

## Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| date-fns | ^3.x | Date arithmetic and formatting | All date operations | MEDIUM |
| date-fns-tz | ^3.x | Timezone conversion | Displaying events in local time | MEDIUM |
| ical.js | ^2.x | ICS/iCalendar parsing | Parsing CalDAV responses and ICS feeds | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CalDAV | tsdav (or custom) | dav, raw fetch | dav abandoned; raw fetch = reimplementing RFC 4791 |
| ICS Parse | ical.js | node-ical | node-ical has Node-only deps, fails on mobile |
| Google API | Direct REST + requestUrl | googleapis npm | googleapis is 80MB+, absurd for a plugin |
| Calendar UI | Custom DOM | FullCalendar, tui-calendar | Too heavy, conflict with Obsidian view lifecycle |
| Dates | date-fns + date-fns-tz | luxon, dayjs, moment | luxon too large, dayjs tz buggy, moment deprecated |
| HTTP | requestUrl (Obsidian) | fetch, axios | CORS/CSP failures on Obsidian mobile |
| Caching | Vault JSON (saveData) | IndexedDB, SQLite | IndexedDB unavailable on mobile, SQLite not bundleable |

## Installation

```bash
# Core dependencies
npm install ical.js date-fns date-fns-tz

# CalDAV client (evaluate first -- may need custom implementation)
npm install tsdav

# TypeScript types (if not bundled)
npm install -D @types/ical.js
```

**Note on tsdav:** Install and test bundling with esbuild BEFORE committing to this dependency. If it pulls in Node builtins that are externalized in the esbuild config, it will fail at runtime on mobile. The fallback is a ~300 line custom CalDAV client using `requestUrl`.

## Critical Constraints (from esbuild.config.mjs)

1. **Format: CJS** -- output must be CommonJS (`format: "cjs"`).
2. **Target: ES2018** -- no optional chaining in output (esbuild handles this, but libraries must be compatible).
3. **Node builtins externalized** -- `builtinModules` are marked external. Any dependency using `fs`, `path`, `http`, `https`, `net`, etc. will FAIL at runtime on Obsidian mobile (desktop may work via Electron's Node integration).
4. **Tree shaking enabled** -- use ESM-compatible libraries where possible for smaller bundles.
5. **Single file output** -- everything bundles into `main.js`. Keep total bundle under ~500KB for reasonable plugin load time.

## Bundle Size Budget

| Component | Estimated Size (minified) | Notes |
|-----------|--------------------------|-------|
| ical.js | ~50KB | Core ICS parser |
| date-fns (tree-shaken) | ~10-15KB | Only used functions included |
| date-fns-tz | ~5-10KB | Timezone utilities |
| tsdav (if used) | ~30-50KB | Needs verification |
| Custom CalDAV client (if needed) | ~5KB | Fallback option |
| Google Calendar client | ~3KB | Thin wrapper over requestUrl |
| Calendar UI views | ~15-20KB | Custom implementation |
| **Total estimate** | ~100-150KB | Well within budget |

## Sources

- Obsidian Plugin API documentation (training data, MEDIUM confidence)
- tsdav GitHub repository and npm package (training data, MEDIUM confidence)
- ical.js / Mozilla Lightning project (training data, MEDIUM confidence)
- Google Calendar API v3 REST documentation (training data, HIGH confidence -- stable API)
- esbuild.config.mjs in this repository (verified, HIGH confidence)

**Important:** All version numbers are from training data (cutoff ~May 2025). Run `npm view <package> version` to verify current versions before adding to package.json.

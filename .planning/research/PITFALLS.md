# Domain Pitfalls

**Domain:** Obsidian calendar plugin with multi-source sync (Google Calendar, CalDAV/ICS, DingTalk)
**Researched:** 2026-03-31
**Overall confidence:** MEDIUM (web research tools unavailable; based on deep protocol knowledge and known ecosystem issues)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: CalDAV Discovery Is Not Standardized Across Servers

**What goes wrong:** Developers assume CalDAV endpoints follow a single discovery pattern (RFC 6764 well-known URIs). In reality, DingTalk, iCloud, Google, Nextcloud, and Fastmail all expose different discovery paths, different PROPFIND response formats, and different levels of RFC compliance. Code that works with Nextcloud silently fails with DingTalk.

**Why it happens:** The CalDAV spec (RFC 4791) defines operations but leaves discovery loosely specified. RFC 6764 (SRV/well-known) is optional and unevenly implemented. DingTalk in particular is known to deviate from standard CalDAV discovery — its `.well-known/caldav` redirect may be absent or point to non-standard paths.

**Consequences:** Plugin connects to one provider but fails on the primary target (DingTalk). Users see "connection failed" with no actionable information. You ship a plugin that works with Nextcloud but not the use case that motivated the project.

**Prevention:**
- Build CalDAV discovery as a multi-strategy pipeline: try `.well-known/caldav` first, fall back to direct URL input, then try common path patterns (`/dav/calendars/`, `/remote.php/dav/`, etc.)
- Implement per-provider profiles: a config object that overrides discovery behavior, auth headers, and XML namespace handling for known servers (DingTalk, iCloud, Nextcloud, Google)
- DingTalk specifically: allow the user to paste the full CalDAV URL directly, bypassing discovery entirely. This is the pragmatic path that actually works.
- Test against at minimum 3 real servers during development (DingTalk, one standard server like Nextcloud/Radicale, and iCloud or Google CalDAV)

**Detection:** CalDAV works in testing with one server but fails when you try another. Or it works with a local Radicale instance but not any production server.

**Phase relevance:** Must be addressed in the CalDAV integration phase. Design the abstraction layer before writing any CalDAV code.

---

### Pitfall 2: DingTalk CalDAV Non-Standard Behavior

**What goes wrong:** DingTalk's CalDAV implementation has known quirks that break standard CalDAV clients. This is the specific reason the existing Obsidian Full Calendar plugin fails with DingTalk. Common issues include: non-standard XML namespaces in responses, incomplete PROPFIND responses, unusual authentication requirements (possibly OAuth2 instead of Basic Auth), and VTIMEZONE handling that deviates from the iCalendar spec.

**Why it happens:** DingTalk (Alibaba) implements CalDAV as a secondary protocol adapter on top of their proprietary calendar API. The CalDAV layer is a thin shim, not a first-class implementation. Enterprise Chinese calendar providers frequently deviate from Western-centric RFC specs.

**Consequences:** The core use case for this plugin — DingTalk calendar sync — does not work. This is the exact failure that motivated building UniCalendar in the first place.

**Prevention:**
- Prioritize DingTalk as the FIRST CalDAV integration target, not the last. If DingTalk works, standard servers will be easier.
- Build a CalDAV response parser that is lenient/tolerant: accept XML with unexpected namespaces, handle missing optional properties gracefully, parse dates with multiple format fallbacks.
- Capture raw HTTP request/response logs during development so you can diagnose exactly where DingTalk deviates.
- Consider whether DingTalk exposes a REST API alongside CalDAV. If the CalDAV path proves too fragile, a DingTalk-specific adapter using their native API may be more reliable than fighting their CalDAV quirks.

**Detection:** Early — connect to DingTalk CalDAV in the first week of CalDAV development, not after you have built and tested against standard servers.

**Phase relevance:** CalDAV integration phase. DingTalk must be the acceptance test for this phase, not an afterthought.

---

### Pitfall 3: OAuth2 Token Lifecycle Mismanagement in Obsidian

**What goes wrong:** Google Calendar requires OAuth2. Developers implement the initial auth flow but mishandle token refresh, token storage, and the edge cases around expired/revoked tokens. The plugin works for an hour (access token lifetime), then silently stops syncing. Or tokens are stored insecurely and wiped on plugin update.

**Why it happens:** OAuth2 has many states: valid token, expired token needing refresh, revoked refresh token, rate-limited, consent screen changes. Each needs different handling. Obsidian's plugin environment adds complexity: no persistent server process, plugin can be unloaded/reloaded, settings may be stored in vault (synced across devices) or in local config.

**Consequences:** Users authenticate successfully, see events for a while, then the calendar goes blank with no clear error. Re-authentication is needed frequently. If tokens are in vault data, they sync to other devices where the OAuth redirect won't work, causing confusing errors on the second device.

**Prevention:**
- Implement token refresh BEFORE the access token expires (check expiry timestamp, refresh proactively with a buffer of 5 minutes)
- Store OAuth tokens in Obsidian's `localStorage` (device-local) NOT in `plugin.saveData()` (vault-synced). Tokens are device-specific credentials.
- Handle every OAuth error state explicitly: `invalid_grant` means re-auth needed, `rate_limited` means back off, network errors mean retry with exponential backoff
- Show clear sync status in the UI: "Last synced: 5 min ago" / "Auth expired — click to reconnect" / "Syncing..."
- For the OAuth redirect: Obsidian on desktop can use `app://obsidian` protocol handler or a local HTTP server on localhost. On mobile, the flow is different. Plan both paths from the start.

**Detection:** Plugin works during development but stops syncing after 1 hour. Or works on one device but not another in the same vault.

**Phase relevance:** Google Calendar integration phase. Token storage architecture decision needed before implementing the OAuth flow.

---

### Pitfall 4: CORS and Network Restrictions in Obsidian Mobile

**What goes wrong:** CalDAV requests (PROPFIND, REPORT) work on Obsidian desktop (Electron, Node.js HTTP) but fail on Obsidian mobile (Capacitor/WebView). Mobile enforces CORS restrictions that desktop does not. CalDAV servers almost never send CORS headers because CalDAV was designed for native clients, not browsers.

**Why it happens:** Obsidian desktop runs in Electron where `requestUrl` from the Obsidian API bypasses CORS. Obsidian mobile also provides `requestUrl` but its behavior may differ. Developers test on desktop only, then discover mobile is broken at release time.

**Consequences:** Plugin works perfectly on desktop, completely fails on mobile. This is a fundamental architectural issue, not a bug you can patch.

**Prevention:**
- Use Obsidian's `requestUrl()` API exclusively for ALL HTTP requests. Never use `fetch()` or `XMLHttpRequest` directly. `requestUrl` is the Obsidian-provided abstraction that handles CORS bypass on both platforms.
- Test on Obsidian mobile EARLY — within the first phase that involves network requests. Not at the end.
- `requestUrl` supports custom methods (PROPFIND, REPORT) and custom headers, which CalDAV requires. Verify this works on mobile with a real CalDAV server.
- If `requestUrl` has limitations on mobile (e.g., doesn't support WebDAV methods), you need to know this before building the CalDAV layer. This would be a project-blocking constraint.

**Detection:** Everything works on desktop. First mobile test fails with CORS or network errors.

**Phase relevance:** Must be validated in Phase 1 / infrastructure phase. A spike test of `requestUrl` with PROPFIND on mobile is a prerequisite before committing to CalDAV architecture.

---

### Pitfall 5: Timezone Handling in iCalendar Data

**What goes wrong:** Events appear at wrong times. A meeting at 2pm Beijing time shows as 2pm UTC or 2pm local time (wherever the user is). Recurring events shift by an hour during DST transitions. All-day events span two days instead of one.

**Why it happens:** iCalendar (RFC 5545) timezone handling is notoriously complex. Events can specify times as: UTC (with Z suffix), floating (no timezone, interpreted as local), or with a VTIMEZONE reference. DingTalk events will use Asia/Shanghai timezone. Google events use IANA timezone IDs. Some servers inline VTIMEZONE definitions, others reference them by ID. All-day events use DATE (not DATETIME) format and have no timezone. Recurring events with RRULE need timezone-aware recurrence expansion.

**Consequences:** Events at wrong times destroy trust in the calendar. Users will immediately abandon the plugin if meeting times are wrong. This is a data correctness issue, not a cosmetic one.

**Prevention:**
- Use a proven iCalendar parsing library (ical.js / ICAL.js is the standard). Do NOT write a custom iCalendar parser.
- Normalize all event times to UTC immediately upon parsing, then convert to local display time in the UI layer only.
- Handle all-day events as a separate type — they have DATE not DATETIME, no timezone, and render differently (full bar across the day).
- Test with events in at least 3 timezones: UTC, Asia/Shanghai (DingTalk), and the developer's local timezone.
- Test DST transitions explicitly: create events that span a DST boundary and verify they render correctly.
- For recurring events: expand recurrence in the iCalendar library (which handles VTIMEZONE correctly), not with custom date math.

**Detection:** Events from DingTalk (Asia/Shanghai) show at wrong times for users in other timezones. Or all events are off by exactly 8 hours (UTC vs CST confusion).

**Phase relevance:** iCalendar parsing phase. Must be correct from the start; retrofitting timezone handling is extremely painful.

## Moderate Pitfalls

### Pitfall 6: Sync Interval and Rate Limiting

**What goes wrong:** Plugin polls too aggressively and gets rate-limited by Google Calendar API (quota: ~1M queries/day shared across all users of the same OAuth client ID, but per-user limits are tighter). Or it polls too infrequently and users think their calendar is stale.

**Prevention:**
- Google Calendar: respect `syncToken` for incremental sync. After initial full sync, subsequent syncs only fetch changes. This dramatically reduces API calls.
- CalDAV: use `ctag` (calendar-collection tag) to check if anything changed before doing a full REPORT. Only fetch events if ctag has changed.
- Default poll interval: 5 minutes for background sync, with a manual "sync now" button.
- Implement exponential backoff on any 429 or 5xx response.
- Show "last synced" timestamp so users know the data freshness.

**Detection:** Google API quota errors in console. Or users reporting stale data.

**Phase relevance:** Sync engine design phase. Incremental sync architecture must be planned upfront.

---

### Pitfall 7: Event Deduplication Across Sources

**What goes wrong:** The same event appears multiple times because it exists in both Google Calendar and a CalDAV source (e.g., user has Google Calendar synced to their CalDAV server). Or recurring event instances are treated as separate events from the master.

**Prevention:**
- Use `UID` from iCalendar as the canonical event identifier. Same UID across sources = same event.
- When merging, prefer the source with the most recent `LAST-MODIFIED` or `SEQUENCE` value.
- Recurring events: store the master RRULE and expand instances for display. Do not store expanded instances as individual events in your cache.
- Let users mark sources as "overlapping" in settings, enabling dedup for those sources.

**Detection:** Duplicate events visible in the calendar view. Or recurring daily events showing 365 individual entries.

**Phase relevance:** Event merge/display phase. Dedup logic should be in the data layer, not the view layer.

---

### Pitfall 8: Obsidian Plugin Lifecycle and View Leaks

**What goes wrong:** Plugin registers interval timers, event listeners, or views but does not clean them up on `onunload()`. This causes memory leaks, duplicate sync timers running after plugin reload, or ghost views that persist after the plugin is disabled.

**Prevention:**
- Use `this.registerInterval()` instead of raw `setInterval()` — Obsidian auto-cleans registered intervals.
- Use `this.registerEvent()` for all event listeners.
- Use `this.addCommand()`, `this.registerView()` — all registration methods on the Plugin class handle cleanup.
- Never store references to DOM elements outside of view classes.
- In `onunload()`: abort any in-flight HTTP requests, clear caches if needed, remove any custom CSS injected into the document.

**Detection:** Plugin takes more memory after each reload. Or sync fires twice after disabling and re-enabling the plugin.

**Phase relevance:** Plugin scaffold / Phase 1. Set up proper lifecycle patterns from the beginning.

---

### Pitfall 9: Bundle Size Explosion from CalDAV/XML Dependencies

**What goes wrong:** CalDAV requires XML parsing (PROPFIND/REPORT use WebDAV XML). Pulling in a full XML DOM parser (like `xmldom` + `xpath`) adds significant bundle size. iCalendar parsing libraries can also be large. The final `main.js` exceeds what Obsidian community plugin reviewers consider acceptable.

**Prevention:**
- For XML parsing: use `DOMParser` which is available in both Electron and mobile WebViews. No need for a bundled XML parser library.
- For iCalendar: `ical.js` is ~50KB minified, which is acceptable. Avoid `node-ical` (designed for Node.js, pulls in heavy dependencies).
- Tree-shake aggressively with esbuild. Mark unused exports as side-effect-free.
- Set a budget: main.js should be under 500KB for good community plugin citizenship.
- Audit bundle size on every PR that adds a dependency. Use `esbuild --analyze` to find large modules.

**Detection:** Bundle size jumps significantly when adding CalDAV or iCalendar support. Community plugin review feedback about file size.

**Phase relevance:** CalDAV integration phase and iCalendar parsing phase. Choose libraries carefully.

---

### Pitfall 10: Secure Credential Storage

**What goes wrong:** CalDAV passwords and OAuth tokens are stored in plain text in `data.json` within the vault. This file syncs to cloud storage (iCloud, Dropbox, Obsidian Sync), exposing credentials. Or passwords are visible in Obsidian's settings UI without masking.

**Prevention:**
- OAuth tokens: store in `localStorage` (device-local), not in `plugin.saveData()`.
- CalDAV passwords: use `plugin.saveData()` but be aware it is stored in plain text in the vault. Warn users in the settings UI that credentials are stored locally. Consider: support app-specific passwords (which are revocable) and document this in setup instructions.
- In the settings UI: use `input type="password"` for credential fields.
- Never log credentials to console, even in debug mode.
- For Obsidian mobile: `localStorage` behavior may differ. Test credential persistence across app restarts on mobile.

**Detection:** Credentials visible in `data.json` in the vault folder. Or credentials disappearing after vault sync/app restart.

**Phase relevance:** Settings/auth phase. Architecture decision needed before implementing any authentication.

## Minor Pitfalls

### Pitfall 11: Recurring Event Edge Cases

**What goes wrong:** RRULE expansion fails for complex recurrence patterns: events with EXDATE (exception dates), RDATE (additional dates), recurrence overrides (RECURRENCE-ID), or rules like "last Friday of every month."

**Prevention:**
- Delegate ALL recurrence expansion to `ical.js`. Do not implement RRULE expansion manually.
- Test with real-world recurring events from DingTalk and Google Calendar, not just synthetic test data.
- Limit recurrence expansion to a reasonable window (e.g., +/- 6 months from current view) to avoid memory issues with infinite recurrence rules.

**Phase relevance:** iCalendar parsing phase.

---

### Pitfall 12: Calendar Color Assignment Conflicts

**What goes wrong:** Multiple calendar sources are assigned similar or identical colors, making them visually indistinguishable. Or the color scheme clashes with the user's Obsidian theme (dark mode vs light mode).

**Prevention:**
- Pre-assign a palette of 8-10 distinct colors that work in both light and dark themes.
- Let users override colors per source in settings.
- Use CSS custom properties so colors adapt to the active Obsidian theme.
- Test with at least 5 sources active simultaneously.

**Phase relevance:** UI phase.

---

### Pitfall 13: ICS Feed Encoding Issues

**What goes wrong:** ICS feeds from different sources use different character encodings. Event titles with CJK characters (common in DingTalk) appear garbled because the parser assumes UTF-8 but the feed uses GBK or GB2312.

**Prevention:**
- Check `Content-Type` header for charset declaration.
- Default to UTF-8 but handle common CJK encodings as fallback.
- Test with DingTalk ICS feeds containing Chinese characters specifically.

**Phase relevance:** ICS import phase.

---

### Pitfall 14: View Performance with Many Events

**What goes wrong:** Calendar view becomes sluggish when rendering hundreds of events in month view. DOM thrashing from re-rendering on every scroll or date change.

**Prevention:**
- Virtualize event rendering: only render events visible in the current viewport.
- Cache computed layout positions for events.
- Debounce view updates during rapid navigation (clicking through months quickly).
- Month view: limit visible events per day cell (e.g., "+3 more" overflow), expanding on click.

**Phase relevance:** UI/view phase.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Infrastructure / Scaffold | Lifecycle leaks (#8), mobile CORS validation (#4) | Use Obsidian registration APIs; spike test `requestUrl` with PROPFIND on mobile early |
| CalDAV Integration | Discovery non-standardization (#1), DingTalk quirks (#2), bundle size (#9) | Multi-strategy discovery pipeline; DingTalk-first testing; use native DOMParser |
| Google Calendar Integration | OAuth lifecycle (#3), token storage (#10), rate limiting (#6) | Proactive token refresh; device-local storage; incremental sync with syncToken |
| iCalendar Parsing | Timezone handling (#5), recurring events (#11), CJK encoding (#13) | Use ical.js; normalize to UTC; test with Asia/Shanghai events |
| Event Merge / Data Layer | Deduplication (#7), recurrence expansion memory | UID-based dedup; bounded recurrence expansion window |
| Calendar UI | Performance (#14), color conflicts (#12), theme compatibility | Virtualized rendering; adaptive color palette; CSS custom properties |
| Settings / Auth | Credential storage (#10), multi-device OAuth (#3) | Separate device-local vs vault-synced storage; clear re-auth UX |

## DingTalk-Specific Risk Register

DingTalk is the motivating use case and the highest-risk integration point. Dedicated risk tracking:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CalDAV discovery fails entirely | HIGH | CRITICAL | Allow direct URL input; bypass discovery |
| Non-standard XML responses break parser | HIGH | HIGH | Lenient XML parsing; capture raw responses for debugging |
| Authentication method is non-standard | MEDIUM | HIGH | Research DingTalk CalDAV auth docs; may need OAuth2 or app token instead of Basic Auth |
| VTIMEZONE handling is non-standard | MEDIUM | HIGH | Test with real DingTalk events early; apply timezone normalization layer |
| CalDAV endpoint is deprecated/removed by Alibaba | LOW | CRITICAL | Have fallback plan: DingTalk Open API as alternative data source |
| Rate limiting on DingTalk CalDAV endpoint | MEDIUM | MEDIUM | Implement ctag-based change detection; respect rate limit headers |

## Confidence Notes

- Pitfalls #1, #3, #4, #5, #8, #9: HIGH confidence. These are well-documented issues in CalDAV client development, OAuth2 integration, and Obsidian plugin development.
- Pitfall #2 (DingTalk specifics): MEDIUM confidence. Known that DingTalk CalDAV is problematic (this is stated in PROJECT.md and is the reason existing plugins fail), but specific failure modes are based on patterns seen in Chinese enterprise CalDAV implementations rather than verified DingTalk documentation. Needs validation with actual DingTalk CalDAV endpoint testing.
- Pitfalls #6, #7, #10-#14: HIGH confidence. Standard calendar application engineering pitfalls.

## Sources

- RFC 4791 (CalDAV) — CalDAV protocol specification
- RFC 6764 (CalDAV/CardDAV service discovery)
- RFC 5545 (iCalendar) — iCalendar data format
- sabre.io/dav — CalDAV client building guide (reference, not fetched)
- Obsidian Plugin API documentation — plugin lifecycle, requestUrl, settings storage
- obsidian-full-calendar GitHub issues — known CalDAV failures (referenced from PROJECT.md context, not fetched)
- Training data knowledge of CalDAV client implementations and common failure patterns

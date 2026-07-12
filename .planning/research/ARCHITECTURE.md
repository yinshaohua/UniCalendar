# Architecture Patterns

**Domain:** Obsidian calendar plugin with multi-source external sync
**Researched:** 2026-03-31
**Overall Confidence:** MEDIUM (based on Obsidian API knowledge and established plugin patterns; no web verification available this session)

## Recommended Architecture

The plugin follows a layered architecture with clear separation between sync infrastructure, data management, and UI rendering. Obsidian plugins with external API sync universally follow this pattern: the plugin class acts as a thin orchestrator, delegating to specialized subsystems for data fetching, caching, and view rendering.

```
+------------------------------------------------------------------+
|                        Plugin Entry (main.ts)                     |
|  Lifecycle orchestrator: wires everything, owns nothing complex   |
+--------+---------+----------+-----------+----------+--------------+
         |         |          |           |          |
         v         v          v           v          v
   +---------+ +--------+ +--------+ +--------+ +----------+
   | View    | | Sync   | | Event  | | Source | | Settings |
   | Manager | | Engine | | Store  | | Registry| | Manager |
   +---------+ +--------+ +--------+ +--------+ +----------+
       |           |          ^           |          |
       |           +----------+           |          |
       |           |                      |          |
       v           v                      v          v
   +---------+ +--------+          +----------+ +--------+
   | Calendar| | Source  |          | Auth     | | Obsidian|
   | Views   | | Adapters|         | Handlers | | Data API|
   | (UI)    | | (API)   |         |          | |         |
   +---------+ +--------+          +----------+ +--------+
       |           |                      |
       v           v                      v
   DOM/Canvas  External APIs         Token Storage
               (Google, CalDAV,      (Obsidian vault
                ICS feeds)            data.json)
```

### Component Boundaries

| Component | Responsibility | Communicates With | Build Phase |
|-----------|---------------|-------------------|-------------|
| **Plugin Entry** (`main.ts`) | Lifecycle orchestration. Registers views, commands, settings tab. Initializes and wires all subsystems. Owns nothing complex itself. | All components (initialization); Obsidian API (registration) | Phase 1 |
| **Event Store** | Unified in-memory cache of all calendar events. Single source of truth for the UI. Persisted to disk for offline use. | Sync Engine (receives events), View Manager (provides events), Settings (cache config) | Phase 1 |
| **Source Registry** | Manages configured calendar sources (Google accounts, CalDAV servers, ICS URLs). CRUD operations on source configs. | Settings Manager (persists configs), Sync Engine (provides source list), Auth Handlers (credentials) | Phase 1 |
| **Sync Engine** | Orchestrates fetching from all sources on a schedule. Calls source adapters, merges results into Event Store. Handles retry/error per source. | Source Registry (which sources), Source Adapters (fetch calls), Event Store (write results) | Phase 2-3 |
| **Source Adapters** | Protocol-specific fetch logic. One adapter per protocol: Google Calendar API, CalDAV (RFC 4791), ICS/iCal parser. Each implements a common interface. | External APIs (HTTP), Auth Handlers (tokens/credentials), Sync Engine (returns normalized events) | Phase 2-3 |
| **Auth Handlers** | OAuth2 flow for Google, Basic/Digest auth for CalDAV, none for ICS. Token refresh, secure storage. | Obsidian Data API (token persistence), Source Adapters (provide credentials), Settings UI (auth configuration) | Phase 2 |
| **View Manager** | Registers and manages the Obsidian `ItemView` leaf. Handles view lifecycle (open, close, resize). Delegates rendering to calendar view components. | Obsidian Workspace API (leaf management), Calendar Views (rendering), Event Store (data source) | Phase 1-2 |
| **Calendar Views** | Month/Week/Day rendering. Pure UI components. Receive events, render them. Handle navigation (prev/next month, view switching). | View Manager (lifecycle), Event Store (read events), DOM (rendering) | Phase 2-4 |
| **Settings Manager** | Settings tab UI. Source configuration forms. Sync interval, display preferences. | Obsidian PluginSettingTab API, Source Registry (CRUD), all components (configuration values) | Phase 1-2 |

### Data Flow

**Sync Flow (primary data pipeline):**

```
1. Timer fires (or manual refresh command)
         |
2. Sync Engine asks Source Registry: "what sources are configured?"
         |
3. For each source (in parallel where possible):
   a. Sync Engine calls appropriate Source Adapter
   b. Source Adapter asks Auth Handler for current credentials
   c. Source Adapter makes HTTP request to external API
   d. Source Adapter parses response into normalized CalendarEvent[]
   e. Source Adapter returns events to Sync Engine
         |
4. Sync Engine merges all events into Event Store
   (deduplicate by source+uid, update changed events)
         |
5. Event Store emits "events-updated" event
         |
6. View Manager receives event, triggers re-render
         |
7. Calendar Views re-render with fresh data
```

**Offline/Cache Flow:**

```
1. Event Store writes to Obsidian's saveData() on every sync
2. On plugin load, Event Store restores from loadData()
3. UI renders immediately from cache (no network needed)
4. Sync Engine fetches fresh data in background
5. When fresh data arrives, Event Store updates + UI re-renders
```

**Settings Change Flow:**

```
1. User modifies setting in Settings Tab
2. Settings Manager persists via saveData()
3. If source config changed:
   a. Source Registry updates
   b. Sync Engine re-syncs affected source
4. If display config changed:
   a. View Manager triggers re-render
```

**Auth Flow (Google OAuth2):**

```
1. User clicks "Connect Google Calendar" in settings
2. Auth Handler opens OAuth2 authorization URL in browser
3. User authorizes, redirect provides auth code
4. Auth Handler exchanges code for access+refresh tokens
5. Tokens stored via Obsidian's saveData() (encrypted at rest by OS)
6. On subsequent syncs, Auth Handler provides access token
7. On 401, Auth Handler uses refresh token to get new access token
```

## Patterns to Follow

### Pattern 1: Source Adapter Interface

All calendar sources implement a common interface. This is the key architectural boundary -- adding a new source means implementing one interface, not touching any other code.

**What:** Every external calendar protocol (Google, CalDAV, ICS) is wrapped in an adapter that implements `CalendarSource`.
**When:** Always. Every new source type gets its own adapter.

```typescript
interface CalendarEvent {
  id: string;           // unique within source
  sourceId: string;     // which source this came from
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;       // inherited from source config
  location?: string;
  description?: string;
}

interface CalendarSource {
  readonly type: 'google' | 'caldav' | 'ics';
  readonly id: string;

  /** Fetch events in the given date range */
  fetchEvents(start: Date, end: Date): Promise<CalendarEvent[]>;

  /** Test if the connection/credentials are valid */
  testConnection(): Promise<{ ok: boolean; error?: string }>;

  /** Clean up resources (timers, connections) */
  dispose(): void;
}
```

**Confidence:** HIGH -- this is the standard adapter pattern used by obsidian-full-calendar and every multi-source calendar app.

### Pattern 2: Obsidian ItemView for Full-Page Calendar

**What:** Use `ItemView` (not `MarkdownView` or `Modal`) for the calendar. This gives a full workspace leaf that can be opened in tabs, split panes, and popout windows. Register a unique view type string.
**When:** Always for full-page custom views in Obsidian.

```typescript
const CALENDAR_VIEW_TYPE = 'uni-calendar-view';

class CalendarView extends ItemView {
  private eventStore: EventStore;

  getViewType(): string { return CALENDAR_VIEW_TYPE; }
  getDisplayText(): string { return 'Calendar'; }
  getIcon(): string { return 'calendar'; }

  async onOpen(): Promise<void> {
    // Build calendar UI in this.contentEl
    // Subscribe to eventStore changes
  }

  async onClose(): Promise<void> {
    // Unsubscribe, clean up DOM
  }
}

// In plugin onload():
this.registerView(CALENDAR_VIEW_TYPE, (leaf) => new CalendarView(leaf, this.eventStore));
```

**Confidence:** HIGH -- this is the documented Obsidian API pattern for custom views.

### Pattern 3: EventEmitter for Decoupling Store and Views

**What:** The Event Store should emit events when data changes, rather than views polling for updates. Use Obsidian's built-in `Events` mixin or a simple custom event emitter.
**When:** Whenever the store's state changes (after sync, after cache load).

```typescript
import { Events } from 'obsidian';

class EventStore extends Events {
  private events: Map<string, CalendarEvent> = new Map();

  updateEvents(sourceId: string, newEvents: CalendarEvent[]): void {
    // Remove old events from this source
    // Add new events
    this.trigger('events-changed', { sourceId });
  }

  getEventsInRange(start: Date, end: Date): CalendarEvent[] {
    // Filter and return
  }
}

// In CalendarView:
this.eventStore.on('events-changed', () => this.renderCalendar());
```

**Confidence:** HIGH -- Obsidian's `Events` class is designed for exactly this.

### Pattern 4: requestUrl for HTTP in Obsidian

**What:** Use Obsidian's `requestUrl()` instead of `fetch()`. It works on both desktop and mobile, handles CORS issues (Obsidian desktop runs in Electron, mobile runs in a webview with different restrictions), and provides consistent behavior.
**When:** All HTTP requests to external APIs.

```typescript
import { requestUrl, RequestUrlParam } from 'obsidian';

async function fetchCalDAV(url: string, auth: string): Promise<string> {
  const response = await requestUrl({
    url,
    method: 'REPORT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/xml',
      'Depth': '1',
    },
    body: calendarQueryXml,
  });
  return response.text;
}
```

**Confidence:** HIGH -- `requestUrl` is the official Obsidian API for network requests and is critical for mobile compatibility.

### Pattern 5: Settings-Driven Source Configuration

**What:** Calendar sources are defined in plugin settings as an array of source configs. Each source config contains the type, connection details, and display preferences. The Source Registry materializes these configs into live Source Adapter instances.
**When:** Always.

```typescript
interface SourceConfig {
  id: string;           // generated UUID
  type: 'google' | 'caldav' | 'ics';
  name: string;         // user-friendly label
  color: string;        // hex color for events
  enabled: boolean;
  // Type-specific fields:
  googleAccountEmail?: string;
  caldavUrl?: string;
  caldavUsername?: string;
  // (credentials stored separately, not in visible settings)
  icsUrl?: string;
  syncIntervalMinutes?: number;
}

interface UniCalendarSettings {
  sources: SourceConfig[];
  defaultView: 'month' | 'week' | 'day';
  weekStartsOn: 0 | 1;  // Sunday or Monday
  syncIntervalMinutes: number;
  showWeekNumbers: boolean;
}
```

**Confidence:** HIGH -- standard pattern for multi-source plugins.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Plugin Class

**What:** Putting sync logic, UI rendering, and data management all in `main.ts`.
**Why bad:** Obsidian sample plugin encourages this pattern because it is a minimal example. At calendar-plugin scale, this becomes unmaintainable. Sync errors crash the UI, UI changes require touching sync code.
**Instead:** Plugin class is a thin wiring layer. Each concern gets its own class/module.

### Anti-Pattern 2: Direct DOM Manipulation Without State

**What:** Updating the calendar UI by directly mutating DOM nodes based on incoming data, without an intermediate state representation.
**Why bad:** Leads to visual bugs, stale UI, and impossible-to-debug rendering issues. Calendar views have complex state (current date, view mode, scroll position) that must survive re-renders.
**Instead:** Maintain a view state object. Render from state. When data changes, update state, then re-render. This does NOT require a framework -- a simple state object with a `render()` method suffices.

### Anti-Pattern 3: Storing OAuth Tokens in Plain Settings

**What:** Putting Google OAuth tokens directly in the plugin settings object that users can see.
**Why bad:** Settings are stored in `data.json` in the vault. If vault is synced (Obsidian Sync, git, Dropbox), tokens are exposed. Users may share settings snippets.
**Instead:** Store tokens in a separate key within `saveData()`, and do NOT expose them in the settings UI. Obsidian's `saveData()` stores to the plugin's `data.json` file -- there is no way to truly encrypt within Obsidian's API, but separating tokens from visible settings reduces accidental exposure. Consider obfuscation and clear documentation.

### Anti-Pattern 4: Synchronous Sync Blocking UI

**What:** Running sync operations in a way that blocks the Obsidian UI thread.
**Why bad:** CalDAV XML parsing and Google API responses can be slow. Blocking makes the entire Obsidian app freeze.
**Instead:** All sync operations are async. Use `requestUrl` (already async). Parse XML/ICS in small chunks or use `setTimeout` to yield to the event loop if parsing is heavy. Show a subtle loading indicator in the calendar view.

### Anti-Pattern 5: Using fetch() Instead of requestUrl()

**What:** Using the browser/Node `fetch()` API for HTTP requests.
**Why bad:** Does not work on Obsidian mobile. CORS restrictions on desktop differ from mobile. `requestUrl` normalizes all of this.
**Instead:** Always use `requestUrl` from the `obsidian` module.

## Recommended Directory Structure

```
src/
  main.ts                      # Plugin entry, lifecycle wiring
  types.ts                     # Shared types (CalendarEvent, SourceConfig, etc.)

  store/
    EventStore.ts              # In-memory event cache, persistence, queries

  sync/
    SyncEngine.ts              # Orchestrates sync across all sources
    SourceRegistry.ts          # Manages source configurations and adapter instances
    adapters/
      CalendarSource.ts        # Interface definition
      GoogleCalendarSource.ts  # Google Calendar API adapter
      CalDAVSource.ts          # CalDAV protocol adapter
      ICSSource.ts             # ICS feed parser adapter
    auth/
      GoogleAuthHandler.ts     # OAuth2 flow for Google
      BasicAuthHandler.ts      # Basic auth for CalDAV

  views/
    CalendarView.ts            # Obsidian ItemView wrapper
    MonthView.ts               # Month grid renderer
    WeekView.ts                # Week column renderer
    DayView.ts                 # Day timeline renderer
    components/
      EventBlock.ts            # Single event rendering
      DayCell.ts               # Day cell in month view
      TimeGrid.ts              # Hourly grid for week/day
      ViewSwitcher.ts          # Month/Week/Day toggle
      NavigationBar.ts         # Prev/Next + date display

  settings/
    SettingsTab.ts             # Main settings tab
    SourceConfigModal.ts       # Add/edit source modal

  utils/
    dates.ts                   # Date math helpers
    ical-parser.ts             # iCalendar format parsing
    caldav-xml.ts              # CalDAV XML request/response helpers
    colors.ts                  # Color palette and assignment
```

## Build Order (Dependency Chain)

This ordering matters because each layer depends on the one before it:

```
Phase 1: Foundation
  types.ts → EventStore → CalendarView (empty shell) → SettingsTab (basic)
  Result: Plugin loads, shows empty calendar view, has settings page

Phase 2: First Source (ICS -- simplest protocol)
  CalendarSource interface → ICSSource adapter → SyncEngine → SourceRegistry
  Wire into: SettingsTab (add ICS URL) → SyncEngine → EventStore → CalendarView
  Result: Can add an ICS feed and see events in the view

Phase 3: Calendar UI
  MonthView → WeekView → DayView → ViewSwitcher → NavigationBar
  Result: Full calendar navigation with real events

Phase 4: Google Calendar
  GoogleAuthHandler → GoogleCalendarSource adapter
  Wire into: SettingsTab (Google auth) → SourceRegistry
  Result: Google Calendar events appear alongside ICS events

Phase 5: CalDAV
  CalDAVSource adapter (XML REPORT queries, VTODO/VEVENT parsing)
  BasicAuthHandler
  Wire into: SettingsTab (CalDAV config) → SourceRegistry
  Result: DingTalk, Nextcloud, Apple Calendar all work

Phase 6: Polish
  Offline cache persistence → Loading states → Error handling UI → Color theming
  Result: Production-ready experience
```

**Phase ordering rationale:**
- EventStore and types come first because everything depends on the data model
- ICS is the simplest source (just fetch a URL, parse text) -- proves the adapter pattern before tackling auth-heavy sources
- Calendar UI can be built with ICS data to iterate on rendering
- Google requires OAuth2 which is the most complex auth flow -- do it after the architecture is proven
- CalDAV is protocol-complex (XML, WebDAV) but auth is simpler -- last source because DingTalk may have quirks requiring debugging time

## Scalability Considerations

| Concern | At 1-3 sources | At 5-10 sources | At 10+ sources |
|---------|----------------|-----------------|----------------|
| Sync time | Sequential OK | Parallel fetch needed | Stagger syncs to avoid burst |
| Memory (events) | All in memory | All in memory | Consider date-range windowing |
| Rendering | Full re-render OK | Virtual scrolling not needed | May need event density limits |
| Settings UI | Simple list | Collapsible sections | Search/filter needed |

For UniCalendar v1, 1-5 sources is the realistic target. The architecture supports parallel fetch but does not need advanced windowing.

## Mobile Considerations

| Concern | Approach |
|---------|----------|
| Network requests | `requestUrl` handles mobile webview restrictions |
| View rendering | `ItemView` works on mobile; use CSS flexbox for responsive layout |
| OAuth redirect | Mobile cannot handle localhost redirect; use Obsidian's `registerObsidianProtocolHandler` for `obsidian://` URI scheme callback |
| Touch interaction | CSS `touch-action` for swipe navigation; larger tap targets for events |
| Status bar | `addStatusBarItem()` does not work on mobile; use in-view status instead |
| Storage | `saveData()`/`loadData()` works identically on mobile |

## Key Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| View type | `ItemView` (not Modal or MarkdownPostProcessor) | Full workspace leaf, supports tabs, split panes, mobile |
| HTTP client | `requestUrl` from Obsidian API | Cross-platform (desktop + mobile), handles CORS |
| State management | Simple EventEmitter pattern (Obsidian `Events` class) | No framework dependency, minimal bundle size, sufficient for read-only data flow |
| UI rendering | Vanilla DOM manipulation with state objects | No React/Svelte -- keeps bundle small, avoids framework conflicts with Obsidian, and read-only calendar UI is not complex enough to justify a framework |
| ICS parsing | Custom lightweight parser or `ical.js` | `ical.js` is well-tested but large; evaluate bundle size impact. May need custom parser for DingTalk quirks |
| CalDAV protocol | Custom implementation using `requestUrl` | No good CalDAV library exists for browser/Obsidian context; CalDAV is just WebDAV + XML, manageable to implement the subset needed (REPORT query for events) |
| Date handling | Native `Date` + small helper module | Avoid `moment` (deprecated) or `date-fns` (large). Calendar math is limited scope. If complexity grows, add `date-fns` later (tree-shakeable) |

## Sources

- Obsidian Plugin API documentation (developer.obsidian.md) -- ItemView, Plugin lifecycle, requestUrl, Events class
- Obsidian sample plugin template (current codebase)
- obsidian-full-calendar plugin source (GitHub) -- established pattern for calendar + external sync in Obsidian
- RFC 4791 (CalDAV specification) -- REPORT method, calendar-query
- Google Calendar API v3 documentation -- events.list endpoint, OAuth2 flow
- iCalendar specification (RFC 5545) -- VEVENT format

**Confidence notes:**
- ItemView pattern, requestUrl, Events class: HIGH (core Obsidian API, well-documented)
- Source adapter pattern: HIGH (standard software pattern, proven in obsidian-full-calendar)
- CalDAV custom implementation: MEDIUM (feasible but DingTalk quirks are unknown until tested)
- OAuth2 on mobile: MEDIUM (obsidian:// protocol handler works but redirect flow needs careful testing)
- Bundle size without framework: MEDIUM (may need to reconsider if calendar UI grows very complex, but unlikely for v1 read-only)

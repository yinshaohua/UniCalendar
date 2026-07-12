# Phase 4: Google Calendar and Multi-Source Unification - Research

**Researched:** 2026-04-02
**Domain:** Google Calendar API v3 + OAuth2 for installed apps + multi-source event deduplication
**Confidence:** HIGH

## Summary

This phase adds Google Calendar as a third event source and implements cross-source deduplication. The Google Calendar integration requires two distinct systems: (1) an OAuth2 authentication flow that works on both desktop and mobile Obsidian, and (2) direct REST API calls to Google Calendar API v3 for calendar discovery and event fetching.

The most critical architectural challenge is the OAuth2 flow. Google deprecated the OOB (manual copy/paste) flow in January 2023. The user's decision D-01 specifies "browser-based authorization with manual code paste," but this flow is no longer supported by Google. The recommended replacement for desktop is the loopback IP redirect (`http://127.0.0.1:<port>`), which requires a local HTTP server -- but Obsidian mobile cannot run Node.js `http.createServer`. The proven cross-platform solution used by existing Obsidian Google Calendar plugins is the `obsidian://` protocol handler as a redirect URI combined with a "Web Application" OAuth client type. This approach works on both desktop and mobile.

Deduplication is straightforward: Google events have an `iCalUID` field (RFC 5545 UID) and ICS/CalDAV events already produce UIDs via ical.js. Matching on UID-first with time+title fallback (D-08 through D-10) is sound. The deduplication should run in EventStore's getter methods at read time, not at write time.

**Primary recommendation:** Use `obsidian://` protocol handler as OAuth2 redirect URI with a "Web Application" client type in Google Cloud Console. Use direct `requestUrl` calls to Google Calendar API v3 REST endpoints. Add `uid` field to CalendarEvent and implement deduplication in EventStore getters.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Browser-based authorization with manual code paste. Open system browser to Google OAuth consent page, user authorizes, copies authorization code back into Obsidian input field. Works on both desktop and mobile.
- **D-02:** Client ID/Secret provided by user (create their own OAuth app in Google Cloud Console), with the architecture supporting built-in credentials in the future. Settings UI should have fields for Client ID and Client Secret alongside the authorization flow.
- **D-03:** Access token, refresh token, and expiry timestamp stored in data.json alongside other settings. Consistent with Phase 3's plain text credential storage approach.
- **D-04:** Token auto-refresh before expiry on each sync cycle. When refresh token is invalid/expired, show error in sync status indicator prompting user to re-authorize (same error pattern as Phase 1/3).
- **D-05:** Direct REST API calls using Obsidian `requestUrl`. No googleapis library. Consistent with Phase 3's self-implementation approach for CalDAV. Zero new dependencies.
- **D-06:** Google Calendar API endpoints: `calendarList.list` for discovery, `events.list` for fetching events with `timeMin`/`timeMax` parameters matching the existing +/-3 month sync range.
- **D-07:** Calendar discovery follows the same pattern as CalDAV (Phase 3): after OAuth authorization, auto-discover all calendars, user picks which to sync. Each selected calendar becomes an independent source with its own color.
- **D-08:** Smart deduplication using UID-first matching with time+title fallback. CalendarEvent model needs a `uid` field (the raw iCalendar UID or Google event ID). Deduplication runs at render time, not at storage time -- each source stores its own events independently.
- **D-09:** Deduplication priority: first source added wins (keeps the event from the earliest-added source). Duplicates from later sources are hidden but not deleted from cache.
- **D-10:** UID matching: exact string match on the iCalendar UID / Google event ID. Fallback: exact match on `start` time + normalized `title` (trimmed, case-insensitive).

### Claude's Discretion
- OAuth2 PKCE implementation details
- Google API error handling and rate limiting
- Token refresh timing strategy (proactive vs on-demand)
- CalendarEvent `uid` field storage and extraction from each source type
- Deduplication performance optimization for large event sets
- Google Calendar API pagination handling
- Settings UI layout for Google auth flow (button placement, status display)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | User can sync events from Google Calendar (read-only via OAuth2) | Google Calendar API v3 REST endpoints, OAuth2 flow via obsidian:// protocol handler, GoogleSyncAdapter pattern |
| SYNC-04 | User sees events from all sources merged into one unified view | UID-based deduplication in EventStore getters, iCalUID field from Google events maps to ical.js UIDs |

</phase_requirements>

## CRITICAL: D-01 Requires Modification

**The OOB (manual code paste) flow was deprecated by Google in January 2023 and is fully blocked.** The user decided "browser-based authorization with manual code paste" in D-01, but Google no longer returns an authorization code for the user to copy.

### Recommended Alternative (preserves D-01 intent)

Use the `obsidian://` protocol handler as OAuth2 redirect URI. This:

1. Still opens the system browser for Google consent (preserves D-01 intent)
2. After authorization, Google redirects to `obsidian://uni-calendar/oauth-callback?code=...`
3. Obsidian intercepts this via `registerObsidianProtocolHandler` and extracts the code automatically
4. Works on BOTH desktop and mobile (unlike loopback which is desktop-only)
5. No manual copy/paste needed -- it's automatic and more user-friendly

**Google Cloud Console setup:** Create a "Web Application" client type with authorized redirect URI set to `https://uni-calendar-oauth.vercel.app/callback` (or similar relay). The relay page receives the code and redirects to `obsidian://uni-calendar/oauth-callback?code=...`.

**Why a relay is needed:** Google does not allow `obsidian://` as a redirect URI for any client type. A lightweight static page hosted on Vercel/Netlify receives the Google redirect and immediately redirects to the `obsidian://` URI. This is the exact pattern used by obsidian-gcal-sync and obsidian-google-calendar plugins.

**Alternative without relay (simpler, user copies code):** Use `urn:ietf:wg:oauth:2.0:oob:auto` -- but this is ALSO deprecated. The only way to avoid a relay is to spin up a local server on desktop (loopback), which breaks mobile support.

**Simplest approach matching D-01 spirit (no relay needed):** Configure a "Desktop app" client type in Google Cloud Console. On desktop, use loopback (`http://127.0.0.1:<port>`) with a temporary local HTTP server. On mobile, fall back to manual code paste by having the user copy the code from the browser URL bar after redirect to localhost fails. However, this is fragile on mobile.

### Recommended Decision for Planner

**Option A (RECOMMENDED): obsidian:// protocol + relay page.** Best UX, works on both platforms. Requires a simple static relay page. Users must add the relay URL as authorized redirect URI in their Google Cloud project.

**Option B: Desktop loopback + mobile-degraded.** No relay needed. Desktop uses local server. Mobile shows instructions to copy the auth code from URL manually after the localhost redirect fails (the code is visible in the URL bar). Fragile but zero external dependencies.

**Option C: Desktop loopback only, mark isDesktopOnly for Google sources.** Simplest implementation but violates INFR-04 (mobile support).

The planner should choose Option A or B. This research document provides implementation details for both.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian (`requestUrl`) | latest | HTTP client for Google API calls | Already used for ICS/CalDAV, bypasses CORS |
| obsidian (`registerObsidianProtocolHandler`) | latest | OAuth2 callback handling | Built-in Obsidian protocol handler for `obsidian://` URIs |
| ical.js (ICAL) | already bundled | ICS parsing (existing) | Already used, provides UIDs for deduplication |

### Supporting
No new dependencies required. Zero additions to package.json.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct REST calls | googleapis npm package | Would add ~500KB to bundle, violates D-05 |
| Manual token management | google-auth-library | Adds dependency, unnecessary for simple OAuth2 flow |

## Architecture Patterns

### Recommended Project Structure
```
src/
  sync/
    GoogleSyncAdapter.ts      # NEW: Google Calendar API client + OAuth2 token management
    GoogleAuthHelper.ts        # NEW: OAuth2 flow helper (PKCE, token exchange, refresh)
    IcsSyncAdapter.ts          # EXISTING: add uid extraction
    CalDavSyncAdapter.ts       # EXISTING: uid flows through from ICS adapter
    SyncManager.ts             # MODIFY: add `case 'google'`
  models/
    types.ts                   # MODIFY: extend CalendarSource.google, add uid to CalendarEvent
  store/
    EventStore.ts              # MODIFY: add deduplication in getter methods
    EventDeduplicator.ts       # NEW: deduplication logic (pure function, easily testable)
  settings/
    SettingsTab.ts             # MODIFY: add OAuth flow UI for Google sources
```

### Pattern 1: GoogleSyncAdapter (mirrors CalDavSyncAdapter)
**What:** Adapter that handles Google Calendar API calls, following the same `sync(source, rangeStart, rangeEnd) -> CalendarEvent[]` interface.
**When to use:** Called by SyncManager for sources with `type === 'google'`.
**Example:**
```typescript
// Source: Google Calendar API v3 REST documentation
export class GoogleSyncAdapter {
  async sync(
    source: CalendarSource,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const google = source.google;
    if (!google) throw new Error('日历源缺少Google配置');

    // Ensure valid access token (refresh if needed)
    const accessToken = await this.ensureValidToken(google);

    // Fetch events from selected calendar
    const events = await this.fetchEvents(
      google.calendarId!,
      accessToken,
      rangeStart,
      rangeEnd,
    );
    return events;
  }

  async discoverCalendars(accessToken: string): Promise<GoogleCalendarEntry[]> {
    const response = await requestUrl({
      url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const data = response.json;
    return data.items.map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary ?? false,
      backgroundColor: cal.backgroundColor,
    }));
  }

  private async fetchEvents(
    calendarId: string,
    accessToken: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: 'true',        // Expand recurring events
        maxResults: '2500',
        orderBy: 'startTime',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const response = await requestUrl({
        url,
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = response.json;

      for (const item of data.items ?? []) {
        allEvents.push(this.toCalendarEvent(item, sourceId));
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return allEvents;
  }
}
```

### Pattern 2: OAuth2 Token Management
**What:** Handle token exchange, storage, and auto-refresh using direct HTTP calls.
**When to use:** Before any Google API call, ensure access token is valid.
**Example:**
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/native-app
interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;  // Unix timestamp in ms
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<GoogleTokens> {
  const response = await requestUrl({
    url: 'https://oauth2.googleapis.com/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  });
  const data = response.json;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: Date.now() + (data.expires_in * 1000),
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; tokenExpiry: number }> {
  const response = await requestUrl({
    url: 'https://oauth2.googleapis.com/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = response.json;
  return {
    accessToken: data.access_token,
    tokenExpiry: Date.now() + (data.expires_in * 1000),
  };
}
```

### Pattern 3: PKCE Code Challenge Generation
**What:** Generate code_verifier and code_challenge for PKCE flow.
**When to use:** Before initiating OAuth2 authorization.
**Example:**
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/native-app
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  for (const byte of buffer) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

### Pattern 4: Event Deduplication (pure function)
**What:** Remove duplicate events across sources based on UID matching with time+title fallback.
**When to use:** In EventStore getter methods before returning events.
**Example:**
```typescript
// Deduplication per D-08, D-09, D-10
export function deduplicateEvents(
  events: CalendarEvent[],
  sourceOrder: string[],  // source IDs in order of addition (earliest first)
): CalendarEvent[] {
  // Sort events by source priority (earlier sources have lower index = higher priority)
  const priorityMap = new Map(sourceOrder.map((id, idx) => [id, idx]));

  const seen = new Map<string, CalendarEvent>();  // UID -> first event
  const seenByTimeTitleKey = new Map<string, CalendarEvent>();

  // Process events in source priority order
  const sorted = [...events].sort((a, b) => {
    const pa = priorityMap.get(a.sourceId) ?? Infinity;
    const pb = priorityMap.get(b.sourceId) ?? Infinity;
    return pa - pb;
  });

  const result: CalendarEvent[] = [];
  for (const event of sorted) {
    // UID-first match
    if (event.uid) {
      if (seen.has(event.uid)) continue;  // Duplicate -- skip
      seen.set(event.uid, event);
    }

    // Time+title fallback
    const fallbackKey = `${event.start}|${event.title.trim().toLowerCase()}`;
    if (seenByTimeTitleKey.has(fallbackKey)) continue;
    seenByTimeTitleKey.set(fallbackKey, event);

    result.push(event);
  }
  return result;
}
```

### Pattern 5: Google Event to CalendarEvent Mapping
**What:** Convert Google Calendar API event resource to internal CalendarEvent type.
**Example:**
```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events
private toCalendarEvent(googleEvent: any, sourceId: string): CalendarEvent {
  const isAllDay = !!googleEvent.start.date;
  const start = isAllDay
    ? googleEvent.start.date                    // "2026-04-01" format
    : googleEvent.start.dateTime;               // RFC3339 with timezone
  const end = isAllDay
    ? googleEvent.end.date
    : googleEvent.end.dateTime;

  // Google provides iCalUID for cross-source dedup with ICS/CalDAV
  const uid = googleEvent.iCalUID || googleEvent.id;

  return {
    id: `${sourceId}::${googleEvent.id}`,
    sourceId,
    title: googleEvent.summary || '',
    start: isAllDay ? start : new Date(start).toISOString(),
    end: isAllDay ? end : new Date(end).toISOString(),
    allDay: isAllDay,
    location: googleEvent.location || undefined,
    description: googleEvent.description || undefined,
    uid,
  };
}
```

### Anti-Patterns to Avoid
- **Storing dedup results:** D-08 explicitly says deduplication runs at render time, not storage time. Each source's events must remain independent in the cache.
- **Using googleapis library:** D-05 mandates zero new dependencies and direct REST calls.
- **Blocking sync on token refresh:** Token refresh should be transparent -- attempt refresh, only error if refresh fails.
- **Hardcoding client credentials:** D-02 says user provides their own. Architecture should support built-in credentials later but not implement them now.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ICS event parsing | Custom VEVENT parser | ical.js (already bundled) | Already handles RRULE, timezones, all-day events |
| PKCE code challenge | Custom crypto | Web Crypto API (`crypto.subtle.digest`) | Available in both Obsidian desktop and mobile |
| URL encoding | Manual string replacement | `URLSearchParams` and `encodeURIComponent` | Built-in, handles edge cases |
| UUID generation | Custom function | `crypto.randomUUID()` | Already used in existing code |

**Key insight:** The entire Google integration uses zero new npm dependencies. Everything is achievable with Obsidian's `requestUrl`, Web Crypto API, and the existing ical.js bundle.

## Common Pitfalls

### Pitfall 1: OOB Flow is Dead
**What goes wrong:** Implementing manual code paste (D-01 literal interpretation) will fail -- Google returns an error for `urn:ietf:wg:oauth:2.0:oob` redirect URIs.
**Why it happens:** Google deprecated OOB in January 2023.
**How to avoid:** Use `obsidian://` protocol handler or loopback redirect. See "CRITICAL: D-01 Requires Modification" section above.
**Warning signs:** Google returns `redirect_uri_mismatch` error during authorization.

### Pitfall 2: Google Custom URI Schemes Are Deprecated Too
**What goes wrong:** Trying to register `obsidian://` directly as a redirect URI in Google Cloud Console fails.
**Why it happens:** Google deprecated custom URI schemes for all client types.
**How to avoid:** Use a Web Application client type with a relay page that redirects to `obsidian://`. Or use Desktop App client type with loopback.
**Warning signs:** Google Cloud Console won't accept `obsidian://` as a redirect URI.

### Pitfall 3: `singleEvents=true` is Essential
**What goes wrong:** Without `singleEvents=true`, the Google Calendar API returns recurring event definitions (with RRULE) instead of expanded instances. You would then need to expand them manually.
**Why it happens:** Default API behavior returns master events, not instances.
**How to avoid:** Always pass `singleEvents=true` and `orderBy=startTime` in events.list requests. Google expands recurring events server-side.
**Warning signs:** Recurring events show as a single entry instead of multiple occurrences.

### Pitfall 4: Token Refresh Returns No New Refresh Token
**What goes wrong:** Code expects a new refresh_token in the refresh response and overwrites the stored one with `undefined`.
**Why it happens:** Google's token refresh endpoint typically only returns a new `access_token`, not a new `refresh_token`. The original refresh_token remains valid.
**How to avoid:** Only update `accessToken` and `tokenExpiry` from refresh response. Keep existing `refreshToken` unchanged.
**Warning signs:** After first token refresh, subsequent refreshes fail with "invalid_grant".

### Pitfall 5: RFC3339 Format Mismatch
**What goes wrong:** Google events use RFC3339 with timezone offset (`2026-04-01T10:00:00+08:00`) while existing CalendarEvent uses plain ISO 8601 (`2026-04-01T02:00:00.000Z`).
**Why it happens:** Google preserves the original timezone in dateTime fields.
**How to avoid:** Normalize to UTC ISO 8601 using `new Date(dateTime).toISOString()` for timed events. All-day events use `date` field directly (already `YYYY-MM-DD` format).
**Warning signs:** Events appear at wrong times or date comparison fails.

### Pitfall 6: Dedup UID Mismatch Between Google and ICS/CalDAV
**What goes wrong:** Google's `iCalUID` might not match the UID from the same event fetched via ICS/CalDAV.
**Why it happens:** Some calendar servers modify UIDs, or the same event might have different UIDs in different protocols.
**How to avoid:** Use UID matching as primary but always have time+title fallback (D-10). The fallback ensures dedup works even when UIDs differ.
**Warning signs:** Same event appears twice from different sources despite having the "same" calendar.

### Pitfall 7: Google API Pagination Silently Drops Events
**What goes wrong:** Only first page of events is fetched (max 2500). If user has more than 2500 events in 6 months, rest are silently dropped.
**Why it happens:** Forgetting to handle `nextPageToken`.
**How to avoid:** Loop on `nextPageToken` until it's absent.
**Warning signs:** User reports missing events that appear in Google Calendar web UI.

### Pitfall 8: Mobile Cannot Run Local HTTP Server
**What goes wrong:** Using `require('http').createServer()` for loopback OAuth crashes on Obsidian mobile.
**Why it happens:** Node.js APIs are not available on Obsidian mobile (iOS/Android).
**How to avoid:** Use platform detection (`Platform.isDesktop` / `Platform.isMobile`) to choose between loopback and protocol handler flows. Or use protocol handler universally.
**Warning signs:** Plugin crashes on mobile with "require is not defined" or similar.

## Code Examples

### Google Calendar API: calendarList.list
```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list
const response = await requestUrl({
  url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
const calendars = response.json.items;
// Each item: { id, summary, primary, backgroundColor, accessRole, ... }
```

### Google Calendar API: events.list (with pagination)
```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
const params = new URLSearchParams({
  timeMin: rangeStart.toISOString(),   // RFC3339
  timeMax: rangeEnd.toISOString(),     // RFC3339
  singleEvents: 'true',                // Expand recurring events
  maxResults: '2500',                   // Maximum per page
  orderBy: 'startTime',
});

const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
const response = await requestUrl({
  url,
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
// response.json: { items: [...events], nextPageToken?, ... }
```

### OAuth2 Authorization URL Construction
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/native-app
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly');
authUrl.searchParams.set('access_type', 'offline');  // Get refresh token
authUrl.searchParams.set('prompt', 'consent');        // Force consent to get refresh token
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('state', state);  // CSRF protection

// Open in system browser
window.open(authUrl.toString());
```

### Obsidian Protocol Handler Registration
```typescript
// Source: https://fleker.medium.com/oauth-in-obsidian-plugins-7385aac41feb
this.registerObsidianProtocolHandler('uni-calendar', async (data) => {
  // data is parsed from obsidian://uni-calendar?code=xxx&state=yyy
  const { code, state } = data;
  if (!code) return;
  // Exchange code for tokens...
});
```

### Type Extensions for CalendarSource and CalendarEvent
```typescript
// CalendarSource.google extended type
google?: {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;      // Unix timestamp in ms
  calendarId?: string;       // Selected calendar ID from discovery
  calendarName?: string;     // Display name of selected calendar
};

// CalendarEvent extended with uid
export interface CalendarEvent {
  id: string;
  sourceId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  recurrenceId?: string;
  uid?: string;              // NEW: iCalendar UID or Google event ID for dedup
}
```

### UID Extraction from ICS Events (modify IcsSyncAdapter)
```typescript
// In toCalendarEvent method of IcsSyncAdapter
// ical.js already provides uid via icalEvent.uid
const uid = icalEvent.uid;  // This is the iCalendar UID property
return {
  id: occurrence
    ? `${sourceId}::${uid}::${occurrence.toICALString()}`
    : `${sourceId}::${uid}`,
  sourceId,
  uid,  // NEW: pass through for dedup
  // ... rest of fields
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OOB flow (manual code paste) | Loopback IP / protocol handler | Jan 2023 | Must use redirect-based flow |
| Custom URI scheme (`com.googleusercontent.apps`) | Loopback IP (desktop) or SDK (mobile) | 2022 | Cannot use `obsidian://` directly with Google |
| googleapis npm library | Direct REST calls | Always available | Smaller bundle, fewer deps |
| Google Calendar API v2 | Google Calendar API v3 | 2014 | v3 is the only supported version |

**Deprecated/outdated:**
- `urn:ietf:wg:oauth:2.0:oob`: Fully blocked since Jan 2023
- Custom URI schemes for Google OAuth: Deprecated, not accepted
- Google+ API (sometimes confused with Calendar): Shut down

## Open Questions

1. **Relay page hosting for OAuth redirect**
   - What we know: Google won't accept `obsidian://` as redirect URI. A relay page is needed.
   - What's unclear: Whether the user should host their own relay or if the plugin should provide one. Existing plugins (obsidian-gcal-sync, obsidian-google-calendar) each host their own relay.
   - Recommendation: For D-02 (user provides own credentials), the simplest approach is to use loopback on desktop and provide instructions for a manual code extraction on mobile. Alternatively, implement a simple relay page that users add to their Google Cloud project redirect URIs. The planner should decide.

2. **obsidian:// protocol handler on mobile**
   - What we know: `registerObsidianProtocolHandler` is an Obsidian API. Works on desktop.
   - What's unclear: Whether it reliably triggers on iOS/Android when a web page redirects to `obsidian://...`. Deep linking behavior varies by OS and browser.
   - Recommendation: Test this on mobile early. If unreliable, fall back to loopback (desktop) + manual code paste instructions (mobile).

3. **Google Cloud Console client type**
   - What we know: "Web Application" type allows custom redirect URIs including relay URLs. "Desktop App" type allows loopback automatically.
   - What's unclear: Which client type to instruct users to create. Web Application requires explicit redirect URI configuration. Desktop App works with loopback but not with relay.
   - Recommendation: If using relay approach, instruct "Web Application" type. If using loopback, instruct "Desktop App" type.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Google Calendar events are fetched and parsed into CalendarEvent[] | unit | `npx vitest run tests/sync/GoogleSyncAdapter.test.ts -x` | Wave 0 |
| SYNC-01 | OAuth2 token exchange and refresh work correctly | unit | `npx vitest run tests/sync/GoogleAuthHelper.test.ts -x` | Wave 0 |
| SYNC-01 | SyncManager dispatches to GoogleSyncAdapter for google sources | unit | `npx vitest run tests/sync/SyncManager.test.ts -x` | Exists (needs update) |
| SYNC-04 | Deduplication by UID removes cross-source duplicates | unit | `npx vitest run tests/store/EventDeduplicator.test.ts -x` | Wave 0 |
| SYNC-04 | Deduplication by time+title fallback works when UIDs differ | unit | `npx vitest run tests/store/EventDeduplicator.test.ts -x` | Wave 0 |
| SYNC-04 | First-added source wins in dedup priority | unit | `npx vitest run tests/store/EventDeduplicator.test.ts -x` | Wave 0 |
| SYNC-04 | EventStore getters return deduplicated events | unit | `npx vitest run tests/store/EventStore.test.ts -x` | Exists (needs update) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/sync/GoogleSyncAdapter.test.ts` -- covers SYNC-01 event fetching and parsing
- [ ] `tests/sync/GoogleAuthHelper.test.ts` -- covers SYNC-01 token exchange/refresh
- [ ] `tests/store/EventDeduplicator.test.ts` -- covers SYNC-04 all dedup scenarios
- [ ] Update `tests/mocks/obsidian.ts` -- add `Platform` mock for desktop/mobile detection
- [ ] Update `tests/sync/SyncManager.test.ts` -- add Google source dispatch test
- [ ] Update `tests/store/EventStore.test.ts` -- add dedup integration test

## Project Constraints (from CLAUDE.md)

- **Platform**: Must work on both Obsidian desktop and mobile (INFR-04)
- **Bundle Size**: Single-file bundle via esbuild; keep dependencies minimal
- **Zero new dependencies**: D-05 mandates no new npm packages
- **requestUrl**: Use Obsidian's `requestUrl` for all HTTP calls (bypasses CORS)
- **Chinese locale**: All UI strings should be in Chinese (consistent with existing code)
- **DOM element naming**: `El` suffix convention for DOM references
- **Strict TypeScript**: noImplicitAny, strictNullChecks, noImplicitReturns enabled
- **GSD Workflow**: All code changes must go through GSD workflow

## Sources

### Primary (HIGH confidence)
- [Google Calendar API v3 Events: list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) -- endpoint, parameters, response format
- [Google Calendar API v3 CalendarList: list](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list) -- calendar discovery endpoint
- [Google Calendar API v3 Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events) -- event fields including iCalUID
- [Google Calendar API v3 CalendarList resource](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList) -- calendar fields
- [Google OAuth2 for Desktop/iOS Apps](https://developers.google.com/identity/protocols/oauth2/native-app) -- OAuth2 flow, PKCE, token endpoints
- [Google OOB Migration Guide](https://developers.google.com/identity/protocols/oauth2/resources/oob-migration) -- OOB deprecation timeline and alternatives

### Secondary (MEDIUM confidence)
- [OAuth in Obsidian Plugins](https://fleker.medium.com/oauth-in-obsidian-plugins-7385aac41feb) -- obsidian:// protocol handler pattern
- [obsidian-gcal-sync GitHub](https://github.com/Sasoon/obsidian-gcal-sync) -- reference implementation with loopback + Netlify relay
- [obsidian-google-calendar Setup](https://yukigasai.github.io/obsidian-google-calendar/Setup) -- reference for Vercel relay pattern
- [Obsidian Forum: Plugins can't access Node.js packages](https://forum.obsidian.md/t/plugins-cant-access-nodejs-packages/87277) -- Node.js unavailable on mobile

### Tertiary (LOW confidence)
- [Google OAuth2/OIDC and PKCE](https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html) -- Google still requires client_secret even with PKCE

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns verified against existing codebase
- Architecture: HIGH -- follows established adapter pattern from Phase 3, Google API endpoints verified via official docs
- OAuth2 flow: MEDIUM -- OOB deprecation is certain (HIGH), but best replacement strategy for Obsidian cross-platform needs planner decision
- Deduplication: HIGH -- straightforward algorithm, iCalUID availability confirmed in Google API docs
- Pitfalls: HIGH -- verified against official deprecation notices and API documentation

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (Google APIs are stable; OAuth2 changes are rare)

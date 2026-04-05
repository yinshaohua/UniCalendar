# Phase 3: CalDAV Integration — Research

**Researched:** 2026-04-01
**Phase:** 03-caldav-integration

## Domain Analysis

### CalDAV Protocol Overview

CalDAV (RFC 4791) = WebDAV + iCalendar. Core operations:
- **PROPFIND** — Discover calendars (XML request/response)
- **REPORT** — Query events with time-range filter (XML request, ICS response)
- **Multi-Status** — 207 response with multiple `<response>` elements

### Discovery Flow (3-step PROPFIND chain)

1. **PROPFIND on `/.well-known/caldav/`** (Depth: 0) → get `current-user-principal` URL
2. **PROPFIND on principal URL** (Depth: 0) → get `calendar-home-set` URL
3. **PROPFIND on calendar-home-set** (Depth: 1) → list all calendars (filter by `<calendar/>` resourcetype)

Each step uses Basic Auth header: `Authorization: Basic ${btoa(username:password)}`

### XML Request Bodies

**Step 1 — Get Principal:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:">
  <prop><current-user-principal/></prop>
</propfind>
```

**Step 2 — Get Calendar Home Set:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <prop><C:calendar-home-set/></prop>
</propfind>
```

**Step 3 — List Calendars:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<propfind xmlns="DAV:">
  <prop><resourcetype/><displayname/></prop>
</propfind>
```

**Event REPORT (calendar-query):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20260101T000000Z" end="20260701T000000Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>
```

### XML Response Parsing

Use browser-native `DOMParser` (available in Obsidian). Key challenge: namespace handling.

**Calendar list response:**
```xml
<multistatus xmlns="DAV:">
  <response>
    <href>/calendars/user/personal/</href>
    <propstat>
      <prop>
        <resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>
        <displayname>Personal</displayname>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>
```

Filter: only `<response>` elements where `<resourcetype>` contains element with `localName === 'calendar'`.

**Event REPORT response:**
```xml
<multistatus>
  <response>
    <href>/calendars/user/default/event1.ics</href>
    <propstat>
      <prop>
        <calendar-data>BEGIN:VCALENDAR...END:VCALENDAR</calendar-data>
      </prop>
    </propstat>
  </response>
</multistatus>
```

Extract `textContent` from each `<calendar-data>` element → pass to `IcsSyncAdapter.parseIcsText()`.

### DingTalk Specifics

- Server: `https://calendar.dingtalk.com`
- Auth: Basic Auth with app credentials
- Expected to follow standard CalDAV, but may have quirks:
  - May not support `.well-known/caldav/` redirect → fallback to direct PROPFIND on server root
  - Calendar paths may differ from standard `/calendars/user/` pattern
  - Need to test actual response format during implementation

### Date Format for CalDAV

CalDAV time-range uses UTC format: `YYYYMMDDTHHmmssZ`

```typescript
function dateToCalDavUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
// 2026-04-01T08:30:00.000Z → "20260401T083000Z"
```

## Codebase Analysis

### Files to Create
| File | Purpose |
|------|---------|
| `src/sync/CalDavSyncAdapter.ts` | CalDAV PROPFIND/REPORT + XML parsing |

### Files to Modify
| File | Changes |
|------|---------|
| `src/sync/SyncManager.ts` | Add `case 'caldav'` dispatch |
| `src/settings/SettingsTab.ts` | Add calendar discovery button + selection UI |
| `src/models/types.ts` | Extend `CalendarSource.caldav` with `discoveredCalendars` |

### Reusable Code
- `IcsSyncAdapter.parseIcsText()` — Parse ICS text from CalDAV REPORT `<calendar-data>`
- `requestUrl` from Obsidian — HTTP client for PROPFIND/REPORT
- `DOMParser` — Built-in browser API for XML parsing
- `btoa()` — Built-in for Basic Auth encoding

### Architecture Pattern

```
CalDavSyncAdapter
  ├── discoverCalendars(serverUrl, username, password) → CalendarInfo[]
  │   ├── getPrincipalUrl(serverUrl)          // PROPFIND .well-known
  │   ├── getCalendarHomeSet(principalUrl)     // PROPFIND principal
  │   └── listCalendars(homeSetUrl)            // PROPFIND home-set
  ├── sync(source, rangeStart, rangeEnd) → CalendarEvent[]
  │   ├── fetchCalendarEvents(calendarUrl)     // REPORT calendar-query
  │   └── IcsSyncAdapter.parseIcsText()        // Reuse ICS parser
  └── Helper methods
      ├── createBasicAuthHeader(username, password)
      ├── parseMultiStatusXml(xmlText)
      └── dateToCalDavUTC(date)
```

### Settings UI Enhancement

Current CalDAV form has: server URL, username, password, calendar path (optional).

Need to add:
1. "发现日历" button after credentials fields
2. On click: call `CalDavSyncAdapter.discoverCalendars()`
3. Show discovered calendars as selectable list
4. User picks one → sets `calendarPath`
5. Save creates the source

For multi-calendar per server: each discovered calendar becomes a separate `CalendarSource` with the same server credentials but different `calendarPath`.

## Plan Decomposition

### Wave 1 (Core):
1. **Plan 03-01:** CalDavSyncAdapter — PROPFIND discovery chain, REPORT event fetch, XML parsing, Basic Auth, SyncManager wiring

### Wave 2 (UI):
2. **Plan 03-02:** Settings UI calendar discovery — discover button, calendar selection, multi-calendar support

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| DingTalk `.well-known` not supported | Fallback: try PROPFIND on root `/` directly |
| XML namespace handling | Use `localName` property instead of `tagName` |
| Obsidian `requestUrl` PROPFIND support | Tested in Phase 1 — works on desktop, need mobile verify |
| Large calendar responses | Reuse ±3 month range from Phase 2 |

---

*Research completed: 2026-04-01*

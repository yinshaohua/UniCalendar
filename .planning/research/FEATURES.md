# Feature Landscape

**Domain:** Obsidian calendar/scheduling plugin with multi-source sync
**Researched:** 2026-03-31
**Confidence:** MEDIUM (based on training data knowledge of Obsidian plugin ecosystem, competing plugins, and calendar app conventions; web search unavailable for verification)

## Table Stakes

Features users expect from any calendar plugin that claims multi-source sync. Missing any of these means users stay with existing plugins or standalone apps.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Month view | Every calendar has this; primary orientation mode | Medium | Grid layout with event dots/snippets; must handle overflow gracefully |
| Week view | Standard time-based planning view | Medium | Hourly grid with event blocks; most-used view for scheduling context |
| Day view | Detailed single-day event timeline | Low | Simpler layout; hourly blocks with full event details |
| Google Calendar sync | Largest calendar platform; users expect it first | High | OAuth2 flow, token refresh, Obsidian desktop+mobile auth challenge |
| CalDAV sync | Protocol for Apple Calendar, Nextcloud, DingTalk, Fastmail, etc. | High | HTTP auth, PROPFIND/REPORT XML parsing, provider quirks |
| ICS feed import | Read-only subscription feeds (university, sports, holidays) | Low | HTTP fetch + iCalendar parsing; simplest sync source |
| Multi-source merging | Core value prop; show all events in one timeline | Medium | Deduplication, consistent data model across source types |
| Color-coded events by source | Visual distinction between calendars | Low | User-configurable color per source; essential for multi-source |
| Event detail popup/modal | Click event to see title, time, location, description | Low | Modal or sidebar panel; standard interaction pattern |
| Offline event cache | Events visible without network; Obsidian used offline frequently | Medium | Local storage via Obsidian's data API; cache invalidation on sync |
| Settings UI for source management | Add/remove/configure calendar sources | Medium | Obsidian settings tab; source list with add/edit/delete |
| Today navigation | One-click return to today's date | Low | Button always visible; every calendar app has this |
| Keyboard navigation | Arrow keys to move between days/weeks | Low | Expected by Obsidian power users; plugin convention |
| Loading/sync status indicator | Users need to know if data is fresh or stale | Low | Subtle indicator showing last sync time, sync-in-progress |
| Recurring event support | Most calendar events recur; must expand RRULE correctly | Medium | iCalendar RRULE parsing; tricky edge cases (EXDATE, timezone) |
| Timezone handling | Events from different sources in different zones | Medium | Must normalize to user's local timezone; all-day events are special |

## Differentiators

Features that set UniCalendar apart from existing Obsidian calendar plugins (Full Calendar, LifeOS). These address the explicit pain points in PROJECT.md.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Apple Calendar-inspired UI | Clean, rounded corners, soft colors -- direct contrast to Full Calendar's clunky UI | High | Custom CSS with careful design tokens; animations; this is the primary differentiator |
| DingTalk CalDAV compatibility | Full Calendar's CalDAV is broken for DingTalk; this is the user's trigger for building UniCalendar | Medium | DingTalk may use non-standard CalDAV extensions; needs provider-specific handling |
| Smart sync scheduling | Background polling with configurable intervals per source; exponential backoff on errors | Medium | Avoids hammering APIs; respects rate limits; sync only when Obsidian is active |
| Full-page view mode | Dedicated full-width calendar view (not squeezed into sidebar) | Low | Obsidian ItemView registration; contrast with sidebar-only calendar plugins |
| Mini calendar sidebar widget | Small month overview in the right sidebar for quick date navigation | Medium | Separate Obsidian leaf; click date to navigate full view; complements full-page view |
| Smooth view transitions | Animated transitions between month/week/day and date navigation | Medium | CSS transitions or lightweight animation; contributes to premium feel |
| Per-source toggle visibility | Show/hide individual calendar sources without removing them | Low | Checkbox per source; instant filter; standard in native calendar apps but missing in Obsidian plugins |
| All-day event bar | Distinct visual treatment for all-day events at top of day/week view | Low | Horizontal bar above time grid; standard in Apple/Google Calendar |
| Multi-day event spanning | Events spanning multiple days render as continuous bars across day columns | Medium | Layout algorithm for overlapping multi-day events; visually important |
| Event search/filter | Find events by text across all sources | Medium | Useful when you have many sources; not common in Obsidian calendar plugins |
| Drag to change date range (week view) | Horizontal swipe/drag to navigate time | Low | Mobile-friendly gesture; contributes to native app feel |

## Anti-Features

Features to explicitly NOT build. These are scoped out for good reasons.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Two-way sync (create/edit events) | Massively increases complexity: conflict resolution, partial failure states, write permissions, provider-specific write APIs | Read-only display; link out to source calendar app for editing |
| Daily note integration | Scope creep; other plugins (Periodic Notes, Templater) handle this well | Focus on calendar view; consider as v2 feature if demanded |
| Agenda/list view | Three view modes (month/week/day) cover core needs; list view adds design surface without proportional value | Day view serves the "what's happening today" use case |
| Task/to-do management | Calendar events and tasks are different domains; mixing them creates confusing UX | Display events only; users have Obsidian Tasks plugin for to-dos |
| Real-time push notifications | Requires persistent connections, background services, mobile push infrastructure | Polling-based sync on configurable interval; show events passively |
| Separate mobile UI | Maintaining two UI codebases doubles design work | Responsive CSS that adapts to mobile viewport; single codebase |
| Markdown event storage | Storing events as markdown files pollutes the vault with auto-generated content | Store in Obsidian's plugin data (data.json / IndexedDB); events are ephemeral cache, not notes |
| Custom event creation UI | Forms for creating events belong in the source calendar app | Read-only principle; open source calendar URL for event creation |
| iCalendar export | Users can export from their source calendars directly | Out of scope; no unique value from aggregating then re-exporting |
| Calendar sharing | Social/sharing features are for dedicated calendar platforms | Not relevant for a personal Obsidian plugin |

## Feature Dependencies

```
Google Calendar Sync ──┐
CalDAV Sync ───────────┼──> Multi-Source Merging ──> Calendar Views (Month/Week/Day)
ICS Feed Import ───────┘                                    │
                                                            ├──> Event Detail Popup
                                                            ├──> Color-Coded Events
                                                            └──> Per-Source Toggle

Settings UI ──> Source Management ──> All Sync Sources

Offline Cache ──> Multi-Source Merging (cache feeds merged timeline)

Recurring Event Support ──> All Sync Sources (RRULE expansion at parse time)

Timezone Handling ──> All Sync Sources (normalize at parse time)

Month View ──> Mini Calendar Sidebar (reuses month grid component)

Apple Calendar UI ──> All Views (design system applies everywhere)
```

### Critical Path

The dependency chain that determines build order:

1. **Event data model + timezone handling** -- everything depends on a solid unified event type
2. **ICS parsing** (simplest source) -- validates the data model works
3. **Basic month view** -- first visual output; validates rendering pipeline
4. **CalDAV sync** -- the user's primary pain point (DingTalk)
5. **Google Calendar sync** -- broadest appeal; OAuth2 is the complexity
6. **Week/Day views** -- builds on month view rendering infrastructure
7. **UI polish (Apple Calendar style)** -- applies design system across all views
8. **Offline cache** -- persistence layer for the merged event data

## MVP Recommendation

**Prioritize (Phase 1 -- Core Loop):**
1. Unified event data model with timezone normalization
2. ICS feed import (simplest source, proves the pipeline)
3. Month view with basic event rendering
4. Settings UI for adding/configuring sources
5. Today navigation + basic keyboard nav

**Prioritize (Phase 2 -- Primary Use Case):**
1. CalDAV sync with DingTalk compatibility (the reason this plugin exists)
2. Week view with hourly grid
3. Color-coded events by source
4. Event detail popup
5. Offline cache

**Prioritize (Phase 3 -- Full Feature Set):**
1. Google Calendar OAuth2 sync
2. Day view
3. Per-source toggle visibility
4. Recurring event expansion (RRULE)
5. Multi-day event spanning

**Prioritize (Phase 4 -- Polish):**
1. Apple Calendar-inspired UI refinement
2. Smooth view transitions/animations
3. Mini calendar sidebar widget
4. Smart sync scheduling with backoff
5. Event search/filter

**Defer indefinitely:**
- Two-way sync
- Daily note integration
- Agenda/list view
- Task management

## Competitor Feature Matrix

Based on training knowledge of the Obsidian plugin ecosystem:

| Feature | Full Calendar | LifeOS Calendar | UniCalendar (Target) |
|---------|---------------|-----------------|---------------------|
| Month view | Yes | Yes | Yes |
| Week view | Yes | Yes | Yes |
| Day view | Yes | Limited | Yes |
| Google Calendar sync | Yes | No | Yes |
| CalDAV sync | Broken (DingTalk fails) | No | Yes (primary goal) |
| ICS import | Yes | No | Yes |
| Event creation (write) | Yes | Yes (via notes) | No (read-only, by design) |
| Daily note link | No | Yes | No (v1) |
| UI quality | Dated, FullCalendar.js default | Better than Full Calendar | Apple Calendar-inspired (target) |
| Offline support | Partial | Yes (local notes) | Yes (cached events) |
| Color by source | Basic | N/A | Yes |
| Mobile support | Partial | Yes | Yes (responsive) |
| Recurring events | Via source | Via notes | Yes (RRULE parsing) |

**Key gaps UniCalendar fills:**
1. Working CalDAV sync (especially DingTalk) -- Full Calendar's is broken
2. Clean, modern UI -- neither competitor delivers Apple Calendar aesthetics
3. Multi-source aggregation that actually works reliably across Google + CalDAV + ICS

## Sources

- PROJECT.md project context and user requirements
- Training data knowledge of Obsidian plugin ecosystem (Full Calendar plugin, LifeOS, Obsidian API patterns)
- Training data knowledge of calendar app conventions (Apple Calendar, Google Calendar, Fantastical, Notion Calendar)
- Training data knowledge of CalDAV protocol and iCalendar standards (RFC 5545, RFC 4791)

**Confidence note:** Web search was unavailable during research. Feature landscape is based on training knowledge through early 2025. Specific plugin version details or features released after that date may not be reflected. The competitor analysis should be verified against current plugin versions.

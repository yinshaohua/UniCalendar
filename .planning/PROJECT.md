# UniCalendar

## What This Is

An Obsidian plugin that provides a unified, beautifully designed calendar view by syncing events from multiple calendar sources (Google Calendar, CalDAV/ICS) into a single interface. Read-only sync with Apple Calendar-inspired UI, Chinese lunar calendar overlay (农历、节气、法定假日), and dynamic holiday data. Designed to replace existing plugins that have poor CalDAV support and unfriendly interfaces.

## Core Value

Users can see all their calendar events from multiple sources in one clean, reliable view inside Obsidian — especially sources like DingTalk calendar that existing plugins fail to support.

## Requirements

### Validated

- ✓ Obsidian plugin scaffold with TypeScript + esbuild — existing
- ✓ ESLint with Obsidian-specific rules — existing
- ✓ Desktop & mobile compatible manifest — existing
- ✓ CalDAV protocol support (discovery, event sync, DingTalk fallback) — v1.0
- ✓ Offline cache for previously synced events — v1.0
- ✓ Calendar source management (add/remove/configure sources) — v1.0
- ✓ Settings UI for managing connections and preferences — v1.0
- ✓ ICS feed import — v1.0
- ✓ Color-coded events by calendar source — v1.0
- ✓ Chinese lunar calendar overlay (dates, solar terms, festivals) — v1.0
- ✓ Chinese statutory holiday/workday indicators (休/班) — v1.0
- ✓ Lunar/holiday display toggles in settings — v1.0
- ✓ Apple Calendar-inspired UI (clean, rounded corners, soft colors) — v1.0 (human visual check pending)
- ✓ Dynamic public holiday data with cache and static fallback — v1.0
- ✓ Google Calendar read-only sync (OAuth2 PKCE) — v1.0
- ✓ Full page calendar view with month/week/day modes — v1.0
- ✓ Multi-source event merging with deduplication — v1.0
- ✓ Recurring event expansion (RRULE) — v1.0
- ✓ Timezone-aware event display — v1.0
- ✓ Event detail modal (title, time, location, description) — v1.0
- ✓ Keyboard navigation and view switching — v1.0
- ✓ Sync status indicator — v1.0
- ✓ Mobile compatibility (isDesktopOnly: false) — v1.0
- ✓ Canonical Chinese festival display (9 festivals + dynamic 除夕) — v1.0
- ✓ Solar term-first display priority — v1.0

### Active

(None — next milestone requirements TBD)

### Out of Scope

- Two-way sync (create/edit events from Obsidian) — read-only for v1, complexity too high
- Daily note integration — calendar view only for v1
- Agenda/list view — month/week/day views cover the need
- Real-time push notifications — polling-based sync is sufficient
- Mobile-specific UI — responsive design that works on mobile, but no separate mobile UI
- Offline mode with full sync queue — online-first with cache fallback is sufficient

## Context

Shipped v1.0 with 4,363 LOC TypeScript + 1,417 LOC tests across 9 phases (25 plans) in 6 days.

**Tech stack:** TypeScript 5.8, esbuild, Obsidian API, ical.js (ICS parsing), chinese-days (lunar calendar), NateScarlet/holiday-cn (dynamic holidays via jsdelivr CDN).

**Architecture:** Plugin → SyncManager (ICS/CalDAV/Google adapters) → EventStore (with dedup) → CalendarView (month/week/day). LunarService + HolidayService overlay Chinese calendar data. Settings via card-based SettingsTab.

**Known issues:**
- SYNC-02: CalDAV code complete but DingTalk live server test still pending
- INFR-03: Apple Calendar CSS complete but human visual verification pending
- Nyquist compliance: 1/8 phases fully compliant (validation gaps in Phases 2-8)

## Constraints

- **Platform**: Must work on both Obsidian desktop and mobile
- **Auth**: Google Calendar requires OAuth2; need to handle token storage securely within Obsidian vault
- **CalDAV Compatibility**: Must work with DingTalk's CalDAV implementation specifically
- **Obsidian API**: Must use Obsidian's plugin API patterns (lifecycle, settings, views)
- **Bundle Size**: Single-file bundle via esbuild; keep dependencies minimal
- **Offline**: Must cache events locally for offline viewing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Read-only sync only | Reduces complexity significantly; two-way sync deferred | ✓ Good — shipped in 6 days |
| Apple Calendar-inspired UI | User preference; clean and modern look | ✓ Good — CSS polish in Phase 5 |
| Google + CalDAV/ICS as sources | Covers the main calendar ecosystems; CalDAV handles DingTalk, Apple, Nextcloud | ✓ Good — all 3 adapters working |
| Color-coded by source | Simple visual distinction without icons; consistent with Apple Calendar | ✓ Good — palette picker added |
| Local event cache | Enables offline viewing; reduces API calls | ✓ Good — EventStore JSON cache |
| ICS-first approach | Prove adapter-to-store-to-view pipeline with simplest source first | ✓ Good — validated architecture early |
| Custom CalDAV client (~300 LOC) | Avoid tsdav library mobile bundling risk | ✓ Good — lightweight, no deps |
| chinese-days library for lunar | Mature library with lunar dates, solar terms, holidays | ✓ Good — reduced complexity |
| Dynamic holiday fetch from holiday-cn | Static data goes stale; CDN fetch with 24h throttle | ✓ Good — auto-updates yearly |
| OAuth2 PKCE for Google | Secure auth without client secret; obsidian:// callback | ✓ Good — standard flow |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after v1.0 milestone*

# UniCalendar

## What This Is

An Obsidian plugin that provides a unified, beautifully designed calendar view by syncing events from multiple calendar sources (Google Calendar, CalDAV/ICS) into a single interface. Read-only sync with Apple Calendar-inspired UI, designed to replace existing plugins that have poor CalDAV support and unfriendly interfaces.

## Core Value

Users can see all their calendar events from multiple sources in one clean, reliable view inside Obsidian — especially sources like DingTalk calendar that existing plugins fail to support.

## Requirements

### Validated

- ✓ Obsidian plugin scaffold with TypeScript + esbuild — existing
- ✓ ESLint with Obsidian-specific rules — existing
- ✓ Desktop & mobile compatible manifest — existing
- ✓ CalDAV protocol support (discovery, event sync, DingTalk fallback) — Validated in Phase 3
- ✓ Offline cache for previously synced events — Validated in Phase 1
- ✓ Calendar source management (add/remove/configure sources) — Validated in Phase 1
- ✓ Settings UI for managing connections and preferences — Validated in Phase 1
- ✓ ICS feed import — Validated in Phase 2
- ✓ Color-coded events by calendar source — Validated in Phase 2
- ✓ Chinese lunar calendar overlay (dates, solar terms, festivals) — Validated in Phase 6
- ✓ Chinese statutory holiday/workday indicators (休/班) — Validated in Phase 6
- ✓ Lunar/holiday display toggles in settings — Validated in Phase 6

### Active

- [ ] Google Calendar read-only sync
- [ ] Full page calendar view with month/week/day modes (rendered, needs polish)
- [ ] Apple Calendar-inspired UI (clean, rounded corners, soft colors)
- [ ] Multi-source event merging into unified timeline

### Out of Scope

- Two-way sync (create/edit events from Obsidian) — read-only for v1, complexity too high
- Daily note integration — calendar view only for v1
- Agenda/list view — month/week/day views cover the need
- Real-time push notifications — polling-based sync is sufficient
- Mobile-specific UI — responsive design that works on mobile, but no separate mobile UI

## Context

- Existing Obsidian calendar plugins (Full Calendar, LifeOS calendar) have issues:
  - Full Calendar: CalDAV support broken (DingTalk calendar won't connect), UI unfriendly
  - LifeOS calendar: Closest to desired functionality, but UI needs improvement
- DingTalk calendar uses CalDAV protocol but may have non-standard quirks that need special handling
- Google Calendar requires OAuth2 authentication flow
- CalDAV requires HTTP basic/digest auth or OAuth depending on provider
- Current codebase is the Obsidian sample plugin template — essentially greenfield for features
- Target UI: Apple Calendar style — minimal, rounded corners, soft color palette, clean typography

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
| Read-only sync only | Reduces complexity significantly; two-way sync deferred | — Pending |
| Apple Calendar-inspired UI | User preference; clean and modern look | — Pending |
| Google + CalDAV/ICS as sources | Covers the main calendar ecosystems; CalDAV handles DingTalk, Apple, Nextcloud | — Pending |
| Color-coded by source | Simple visual distinction without icons; consistent with Apple Calendar | — Pending |
| Local event cache | Enables offline viewing; reduces API calls | — Pending |

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
*Last updated: 2026-04-02 after Phase 3 completion*

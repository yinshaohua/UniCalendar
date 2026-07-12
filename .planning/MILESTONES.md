# Milestones

## v1.0 MVP (Shipped: 2026-04-05)

**Phases completed:** 9 phases, 25 plans, 39 tasks

**Delivered:** Unified calendar view in Obsidian with ICS/CalDAV/Google Calendar sync, Chinese lunar calendar overlay, and Apple Calendar-inspired UI.

**Key accomplishments:**

1. Plugin foundation with EventStore, SyncManager, and card-based settings UI
2. ICS feed parsing with ical.js, RRULE expansion, and month/week/day calendar views
3. CalDAV protocol integration with PROPFIND discovery and DingTalk-targeted implementation
4. Google Calendar OAuth2 PKCE sync with cross-source event deduplication
5. Apple Calendar-inspired UI polish with rounded corners, soft colors, and color palette picker
6. Chinese lunar calendar overlay with solar terms, canonical festivals, statutory holidays, and dynamic holiday data fetching from NateScarlet/holiday-cn

**Stats:**
- 4,363 LOC TypeScript + 1,417 LOC tests
- 175 commits over 6 days (2026-03-31 → 2026-04-05)
- Git range: feat(01-01) → feat(09-01)

### Known Gaps

- **SYNC-02**: CalDAV sync code complete; DingTalk live server human test pending
- **INFR-03**: Apple Calendar UI CSS complete; human visual check pending

---

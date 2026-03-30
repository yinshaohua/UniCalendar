# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**Not Detected:**
- No external REST APIs, webhooks, or third-party services integrated
- No SDK imports (Stripe, Auth0, AWS, etc.) detected
- No HTTP clients (fetch, axios) or request libraries in use

This is a minimal sample plugin focused on demonstrating Obsidian API capabilities rather than external service integration.

## Data Storage

**Databases:**
- Not applicable - This is a plugin, not a standalone application
- Plugin data stored locally in Obsidian vault
- Storage method: `Plugin.loadData()` and `Plugin.saveData()` (lines 77-81 in `src/main.ts`)
  - Stores: `MyPluginSettings` interface (`src/settings.ts`, lines 4-6)
  - Format: JSON
  - Persisted to: Obsidian's local plugin data storage

**File Storage:**
- Local filesystem only (Obsidian vault)
- No cloud storage integration

**Caching:**
- Not applicable - No caching layer detected

## Authentication & Identity

**Auth Provider:**
- Not applicable
- No external authentication required
- Plugin runs within Obsidian's authenticated user context

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging only (`src/main.ts`, line 69)
- No log aggregation or monitoring service

## CI/CD & Deployment

**Hosting:**
- Obsidian Plugin Marketplace (potential)
- GitHub repository deployment

**CI Pipeline:**
- Not detected - No GitHub Actions or CI configuration files found

**Deployment:**
- Manual: Build output (`main.js`) committed to repository
- Plugin distributed via manifest.json + main.js bundle

## Environment Configuration

**Required env vars:**
- None - No environment variables used or required

**Secrets location:**
- Not applicable - No secrets management configured

**Configuration:**
- All configuration through plugin settings UI (`SampleSettingTab`, `src/settings.ts`, lines 12-36)
- Single setting exposed: `mySetting` (string field with "default" value)
- Settings persisted to Obsidian's plugin data storage

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

**Event Handlers:**
- DOM click event listener (global document click, `src/main.ts`, lines 64-66)
  - Shows "Click" notice on any document click
- Interval-based logging (every 5 minutes, `src/main.ts`, line 69)
  - Console logs "setInterval" for debugging

## Obsidian-Specific Integration Points

**Commands Registered:**
1. `open-modal-simple` - Opens a simple modal dialog
2. `replace-selected` - Replaces selected editor text
3. `open-modal-complex` - Context-aware modal (only available in Markdown view)

**UI Components:**
- Ribbon icon button - Left sidebar icon ("dice")
- Status bar item - Bottom status bar text display

**Settings:**
- Plugin settings tab with form inputs
- Single configurable string setting

**Event Listeners:**
- Global DOM click handler
- Interval callback (5-minute polling)

## Sample Plugin Purpose

This codebase is the **Obsidian Sample Plugin** template. It demonstrates:
- How to extend the Obsidian API
- Plugin lifecycle (onload, onunload)
- Settings management and persistence
- UI integration (commands, ribbons, modals, settings tabs)
- Event handling

It is **not** a functional calendar application. See project name "UniCalendar" for context on intended evolution.

---

*Integration audit: 2026-03-31*

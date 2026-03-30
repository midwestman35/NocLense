# Changelog

All notable changes to NocLense are documented here.

## [Unreleased] — 2026-03-30

### AI Diagnosis — Major Overhaul
- **Fixed: AI now actually correlates logs.** Previously `MAX_DIAGNOSIS_LOG_CHARS` was 15KB and `formatLogsForDiagnosis` stripped all payloads, JSON fields, and correlation IDs — the AI had nothing to work with. Now it's 100KB with full payloads, correlation IDs, and smart prioritization (ERROR > WARN > SIP failures > INFO).
- **New Carbyne system knowledge prompt** — The diagnosis prompt now explains all 6 log types (Datadog CSV, FDX JSON, CCS-SDK, Homer SIP, APEX PDFs, Call Logs) so the AI understands the data it's analyzing.
- **Homer + CCS log correlation** — AI now correlates Homer SIP logs and CCS/PBX logs, not just APEX.
- **Starring a log adds it to correlated logs** — When an agent stars a log, it's automatically added to AI-highlighted correlated logs with an explanation.

### Review & Refine (Phase 2) — Complete Rewrite
- **Diagnosis summary banner** — Shows root cause + AI summary at the top.
- **Merged correlated logs pane** — Left panel shows AI-correlated + agent-starred logs in a searchable mini log browser.
- **Troubleshooting + editable internal note** — Right panel with AI summary, editable notes, and AI refinement chat.
- **Bookmark all** — One-click to bookmark all correlated logs.

### Datadog Integration — New
- **Datadog Logs API v2** — Full integration for live log search from Datadog.
- **Station discovery** — Enter a CNC name, discover all stations reporting to Datadog. Tries multiple query strategies and indexes automatically.
- **Test Connection** — Validates API Key + Application Key + Logs API access with clear error messages about scopes.
- **Datadog proxy** — Vite dev proxy at `/datadog-proxy` routes to the configured Datadog site (supports `datadoghq.eu`).
- **Known issue:** Station discovery may return 0 results if the `@log.machineData.callCenterName` facet path differs in your Datadog org. Check the browser console (F12) for the exact queries tried. You can always type station names manually.

### Log Parsing Improvements
- **Call Log CSV parser** — New parser for the 26-column Carbyne call log format (ID, Created, Phone, Duration, Termination Reason, Station, Agent, Queue, etc.). Abandoned/missed calls and zero-duration calls auto-flagged as WARN.
- **Datadog CSV multiline fix** — Handles JSON content that spans multiple CSV rows.
- **CNC/Station extraction** — `cncID` and `stationId` extracted from `machineData` in Datadog CSVs.

### Source Filter
- **New Source dropdown** in the filter bar — Filter logs by source: Datadog, Homer SIP, Call Log, FDX, CCS/PBX, APEX Local.
- Color-coded pills per source type.
- Only appears when multiple sources are loaded.

### Vercel / Web Deployment
- **Code splitting** — `pdfjs-dist`, `jszip`, `react`, `@tanstack/react-virtual` split into separate chunks. Initial bundle reduced from 381KB to 222KB gzip (42% reduction).
- **Dynamic imports** — PDF and ZIP libraries lazy-loaded on first use.
- **`vercel.json`** — SPA rewrites and immutable asset caching configured.

### Investigation Setup Modal
- **New modal** — Configures ticket, timezone, attachments, Datadog enrichment, and APEX event selection before starting AI diagnosis.
- **PDF scanning** — Extracts APEX events from PDF attachments client-side.

### Other
- **Jira integration service** (`jiraService.ts`) — Create/update Jira issues from diagnosis results.
- **Token usage tracker** — Estimates LLM token usage and tracks cumulative input/output.
- **Log archive export** (`logArchive.ts`) — Export filtered logs as downloadable ZIP.
- Removed unused `FileUploader` import from `App.tsx`.
- AI Settings modal expanded with Datadog, Jira fields and token usage display.

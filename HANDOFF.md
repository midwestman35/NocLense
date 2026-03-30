# NocLense — Handoff for Enrique

**Last updated:** 2026-03-30 by Leandro (via Claude)

## Quick Start

```bash
git clone <repo> && cd NocLense
# Leandro already shared the .env file — drop it in the project root
npm install
npm run dev          # Web dev server at http://localhost:5173
npm run electron:dev # Electron + Vite
npm run build        # Production build (checks TypeScript too)
```

The `.env` file contains all API keys (Unleashed AI, Zendesk, Datadog, Jira). It's in `.gitignore` and never committed.

---

## Architecture at a Glance

```
React 19 + TypeScript + Vite + Electron
├── AI: Unleashed AI REST API (POST /chats, Bearer token)
├── Ticketing: Zendesk REST API (Basic auth)
├── Logs: Datadog Logs API v2 (API Key + App Key)
├── Issues: Jira REST API (Basic auth)
└── Proxies: Vite dev proxies (/ai-proxy, /zendesk-proxy, /datadog-proxy)
```

All credentials load from `.env` → `src/store/aiSettings.ts` → used by services.

---

## Where the Prompts Live

**All AI prompts are in the code, NOT in Unleashed AI.** This is intentional so we can version-control and customize them per situation.

| What | File | Function/Location |
|---|---|---|
| **Main diagnosis prompt** | `src/services/unleashService.ts` | `diagnoseLogs()` — the big system prompt with Carbyne log type knowledge |
| **Log formatting for AI** | `src/services/unleashService.ts` | `formatLogEntryForDiagnosis()`, `formatLogsForDiagnosis()`, `formatLogsForAi()` |
| **Carbyne system knowledge** | `src/services/unleashService.ts` | Inside `diagnoseLogs()` — explains all 6 log types to the AI |
| **Chat/refinement** | `src/services/unleashService.ts` | `chatWithAi()` |
| **Summarize logs** | `src/services/unleashService.ts` | `summarizeLogs()` |
| **Anomaly detection** | `src/services/unleashService.ts` | `detectAnomalies()` |
| **Context building** | `src/services/logContextBuilder.ts` | `LogContextBuilder` class — prioritizes errors, adds surrounding context |
| **Prompt templates** | `src/services/promptTemplates.ts` | Reusable prompt snippets |

To change AI behavior, edit `unleashService.ts`. The diagnosis prompt in `diagnoseLogs()` is the most important one — it tells the AI what each log type means and how to correlate them.

---

## New Components (since last major commit)

### `/src/components/` (UI)
| File | Purpose |
|---|---|
| `InvestigationSetupModal.tsx` | Modal to configure investigation (ticket, timezone, attachments, Datadog, APEX events) |
| `ai/DiagnoseTab.tsx` | Main diagnosis tab orchestrating the 3-phase flow |
| `ai/diagnose/DiagnosePhase1.tsx` | Phase 1: AI analysis + progress |
| `ai/diagnose/DiagnosePhase2.tsx` | Phase 2: Review & Refine — correlated logs, editable notes, AI chat |
| `ai/diagnose/DiagnosePhase3.tsx` | Phase 3: Final report generation |
| `ai/diagnose/ResizableSplit.tsx` | Draggable split panel used in Phase 2 |

### `/src/services/` (Business Logic)
| File | Purpose |
|---|---|
| `datadogService.ts` | Datadog Logs API v2 — search, station discovery, test connection |
| `apexEventParser.ts` | Extracts APEX events from PDF text |
| `jiraService.ts` | Create/update Jira issues from diagnosis |

### `/src/types/` (Type Definitions)
| File | Purpose |
|---|---|
| `diagnosis.ts` | `DiagnosisResult`, `CorrelatedLog`, phase types |
| `investigation.ts` | `InvestigationSetup`, `DatadogStation` |

### `/src/utils/` (Utilities)
| File | Purpose |
|---|---|
| `pdfExtractor.ts` | Client-side PDF text extraction (dynamic import of pdfjs-dist) |
| `zipExtractor.ts` | Client-side ZIP extraction (dynamic import of JSZip) |
| `logArchive.ts` | Export logs as downloadable ZIP |
| `tokenEstimator.ts` | LLM token counting + usage tracking |

### Modified Files (significant changes)
| File | What Changed |
|---|---|
| `src/services/unleashService.ts` | Complete rewrite of diagnosis — 100KB context, payloads, Carbyne knowledge prompt |
| `src/utils/parser.ts` | New call log CSV parser, Datadog CSV multiline fix, CNC extraction |
| `src/contexts/LogContext.tsx` | Source filter state, available sources detection, starring → correlated logs |
| `src/components/FilterBar.tsx` | Source filter dropdown with color-coded pills |
| `src/store/aiSettings.ts` | Datadog + Jira credential fields, layered env/localStorage loading |
| `vite.config.ts` | Code splitting (manualChunks), Datadog proxy |

---

## Known Issues / TODO

### Datadog Station Discovery (Priority)
- **Status:** API connects fine (Test Connection passes), but station discovery returns 0 results.
- **Root cause:** The facet path `@log.machineData.callCenterName` may not match your Datadog org's schema.
- **Debug:** Open browser console (F12), click "Discover Stations" — it logs every query strategy it tries.
- **Fix:** Check Datadog Log Explorer for the actual facet path, then update `discoverStationsForCnc()` in `datadogService.ts`.
- **Workaround:** Type station names manually in the comma-separated field.
- **Rate limits:** Datadog may throttle after repeated queries — wait a moment and retry.

### Datadog Tab in AI Panel
- User requested a dedicated "Datadog" tab in the AI panel (like the existing Chat/Diagnose tabs).
- Not yet implemented.

### Vercel Deployment
- Build passes, `vercel.json` is configured, code splitting is done.
- Not yet deployed — needs Vercel project setup and env vars configured there.
- The app is heavy (PDF parsing, ZIP extraction, virtual scrolling) but should work as a web app with the lazy loading in place.

### Modal Accidentally Closing
- Reported: clicking/highlighting text in the Investigation Setup Modal sometimes closes it.
- Likely cause: mouse events bubbling to the backdrop click handler.
- Fix: Add `onMouseDown` tracking to distinguish intentional backdrop clicks from accidental drags.

---

## Environment Variables (.env)

```
VITE_UNLEASH_TOKEN=<Unleashed AI bearer token>
VITE_UNLEASH_MODEL=<model name>
VITE_ZENDESK_SUBDOMAIN=<zendesk subdomain>
VITE_ZENDESK_EMAIL=<zendesk email>
VITE_ZENDESK_TOKEN=<zendesk API token>
VITE_DATADOG_API_KEY=<Datadog API key>
VITE_DATADOG_APP_KEY=<Datadog Application key — NOT the Application ID>
VITE_DATADOG_SITE=datadoghq.eu
VITE_JIRA_SUBDOMAIN=<Jira subdomain>
VITE_JIRA_EMAIL=<Jira email>
VITE_JIRA_TOKEN=<Jira API token>
VITE_JIRA_PROJECT_KEY=<Jira project key>
```

**Important:** The Datadog Application Key needs the `logs_read_data` scope. Go to Datadog → Organization Settings → Application Keys → click the key → Scopes → enable `logs_read_data`.

---

## Proxy Configuration (vite.config.ts)

All external APIs are proxied through Vite's dev server to avoid CORS:

| Route | Target | Auth |
|---|---|---|
| `/ai-proxy` | Unleashed AI API | Bearer token |
| `/zendesk-proxy` | Zendesk REST API | Basic auth |
| `/datadog-proxy` | `https://api.datadoghq.eu` (from `VITE_DATADOG_SITE`) | DD-API-KEY + DD-APPLICATION-KEY headers |

For production (Vercel), these proxies won't exist — you'll need Vercel serverless functions or a backend proxy.

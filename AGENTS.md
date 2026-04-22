# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**NocLense** (internal codename: LogScrub) is an Electron desktop application for analyzing SIP/VoIP and telecommunications logs. It supports 100,000+ log entries with virtualized rendering, large-file streaming via IndexedDB, correlation-based filtering, call flow visualization, and AI-powered log analysis via **Unleashed AI** (pre-configured with the organization's Confluence, Zendesk, and Slack knowledge base).

## Commands

```bash
# Renderer (React/Vite)
npm install              # Install dependencies
npm run dev              # Vite dev server (web, port 5173)
npm run electron:dev     # Development with Electron (Vite + Electron concurrently)
npm run build            # TypeScript check + Vite production build
npm run lint             # ESLint
npm run electron:build   # Package Electron app (NSIS installer for Windows, DMG for Mac)

# Testing
npm run test             # Vitest in watch mode
npm run test:run         # Single CI test run
npm run test:coverage    # Coverage report
npm run test:ui          # Interactive test UI
npx vitest src/services/__tests__/llmService.test.ts  # Single test file
npx vitest -- logContextBuilder                        # Filter by name pattern

# Backend server (server/ directory — separate process)
cd server && npm install
npm run dev              # tsx watch — Hono server (port configured in server/src/index.ts)
```

## Architecture

### Deployment Contexts

NocLense runs in three modes, each with different proxy/API routing:

| Context | AI endpoint | External APIs |
|---|---|---|
| Electron (dev) | Direct to Unleashed AI | Direct |
| Vite web (dev) | `/ai-proxy` → Vite proxy | `/zendesk-proxy`, `/datadog-proxy`, `/jira-proxy`, `/confluence-proxy` → Vite proxies |
| Vercel (production) | `/api/ai-proxy` → serverless | `api/` serverless functions handle all CORS proxying |

`unleashService.ts` auto-detects which URL to use via `resolveUrl()` — checking `import.meta.env.DEV` and `window.electronAPI`.

### Electron / React Boundary

- **`electron/main.js`** — Main process: creates BrowserWindow, handles IPC for crash reporting (`app:report-error`) and secure API key storage (`safeStorage.encryptString`).
- **`electron/preload.js`** — Exposes `window.electronAPI` as the sole bridge; no Node APIs leak to the renderer.
- **`src/`** — React renderer process; never access Node/Electron APIs directly, always go through `window.electronAPI`.

### Backend Server (`server/`)

A separate Hono + SQLite (sql.js) server for log ingestion and storage. It has its own `package.json` and runs independently from the Vite dev server. Routes in `server/src/routes/`: `upload`, `logs`, `jobs`, `stats`, `clear`. The server is not required for local file-based usage — only for the server-mode ingestion flow.

### Vercel Serverless Proxies (`api/`)

`api/ai-proxy.ts`, `api/datadog-proxy.ts`, `api/zendesk-proxy.ts`, `api/jira-proxy.ts`, `api/confluence-proxy.ts` — mirror the Vite dev proxies for production. The `api/tools/` subdirectory contains shared utilities for the serverless functions.

### Global State (Context Providers)

Both providers wrap the entire app (`App.tsx`: `ToastProvider → AIProvider → CaseProvider → LogProvider → NewWorkspaceLayout`).

| Context | File | Manages |
|---|---|---|
| `LogContext` | `src/contexts/LogContext.tsx` | Parsed logs, filtered logs, active correlations, IndexedDB mode flag, SIP filtering, source filter |
| `AIContext` | `src/contexts/AIContext.tsx` | API key (secure storage), selected model/provider, usage stats (RPM/RPD), conversation history |

Access via `useLogContext()` and `useAIContext()` hooks. **Never duplicate log state in components.**

### Settings / Credential Storage

`src/store/aiSettings.ts` uses a layered resolution strategy:
1. **Env vars** (`VITE_*`) — baked in at build time; form the base defaults
2. **`localStorage`** — per-field overrides from the in-app settings UI
3. Fields that are blank in localStorage fall back to the env-var value

This means `.env` credentials are bundled at build time. For Vercel, set them as project environment variables before building. For Electron, the `.env` file in the project root is used at build time.

### AI Integration

All AI features use **Unleashed AI** exclusively via `src/services/unleashService.ts`. It calls the Unleashed AI REST API (`POST /chats`) with a bearer token. Functions: `summarizeLogs()`, `detectAnomalies()`, `chatWithAi()`, `diagnoseLogs()`. The diagnosis prompt encodes Carbyne-specific log type knowledge. **All prompts live in the code, not in the Unleashed AI platform** — this is intentional for version control.

`src/services/providers/` (Gemini, Codex, Codex stubs) is unused legacy code — do not route new features through it.

**Rules:**
- Never call AI APIs from components — route through `unleashService.ts`
- All AI panel state lives in `src/components/ai/`
- Context building (`src/services/logContextBuilder.ts`): ERROR > WARN > INFO > DEBUG priority; 5 surrounding logs per error; payloads truncated to 200 chars; targets 10k tokens (max 100k)
- All pre-built prompt snippets live in `src/services/promptTemplates.ts` — never hardcode prompts in components
- AI features must not block core log viewing; lazy-load AI components and memoize context building

### Diagnosis 3-Phase Flow

`src/components/ai/DiagnoseTab.tsx` orchestrates:
1. **Phase 1** (`DiagnosePhase1.tsx`) — AI analysis + progress display
2. **Phase 2** (`DiagnosePhase2.tsx`) — Review & Refine: correlated logs, editable notes, AI chat, resizable split panel
3. **Phase 3** (`DiagnosePhase3.tsx`) — Final report generation and Jira/Confluence export

### Large File Handling (>50 MB)

Files above 50 MB trigger streaming mode in `src/utils/parser.ts`:
1. File is read in 2 MB chunks and written directly to IndexedDB (`src/utils/indexedDB.ts`).
2. `LogContext` sets `useIndexedDBMode = true` and lazy-loads filtered results from IndexedDB instead of holding the full array in memory.
3. UI components check `useIndexedDBMode` and `totalLogCount` for display.

Heavy parsing also runs in `src/workers/parseWorker.ts` (Web Worker) to avoid blocking the UI thread.

### Correlation System

Users filter logs by faceted correlations (Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, Message-ID). Logic: AND between types, OR within a type. Exclusion correlations are also supported. All correlation state lives in `LogContext`.

### Performance

- `LogViewer.tsx` uses `@tanstack/react-virtual` — only visible rows are rendered.
- Expensive filtering/sorting must use `useMemo`; event handlers use `useCallback`.
- `vite.config.ts` uses relative asset paths (`./`) for Electron compatibility.
- Build uses `manualChunks` to split `pdfjs-dist`, `jszip`, `react`, and `@tanstack/react-virtual` into separate lazy chunks.

## Environment Variables

All `VITE_*` vars are baked in at build time. Drop a `.env` file in the project root (gitignored).

```
VITE_UNLEASH_TOKEN=           # Unleashed AI bearer token
VITE_UNLEASH_ASSISTANT_ID=    # Unleashed AI assistant ID
VITE_UNLEASH_USER_EMAIL=      # Email sent with Unleashed AI requests
VITE_ZENDESK_SUBDOMAIN=       # e.g. carbyne
VITE_ZENDESK_EMAIL=
VITE_ZENDESK_TOKEN=
VITE_DATADOG_API_KEY=
VITE_DATADOG_APP_KEY=         # Needs logs_read_data scope (Org Settings → App Keys → Scopes)
VITE_DATADOG_SITE=            # e.g. datadoghq.eu
VITE_JIRA_SUBDOMAIN=          # e.g. carbyne.atlassian.net
VITE_JIRA_EMAIL=
VITE_JIRA_TOKEN=
VITE_JIRA_PROJECT_KEY=
VITE_CONFLUENCE_SPACE_ID=
VITE_CONFLUENCE_PARENT_PAGE_ID=
```

## Key Files

| File | Role |
|---|---|
| `src/types.ts` | Canonical `LogEntry` interface (40+ fields) — the data contract for the whole app |
| `src/types/` | Additional types: `ai.ts`, `case.ts`, `diagnosis.ts`, `investigation.ts`, `export.ts`, `correlationRules.ts` |
| `src/utils/parser.ts` | Multi-format log parser (Datadog CSV, Homer SIP, JSON, call log CSV); streaming chunked read |
| `src/utils/indexedDB.ts` | IndexedDB manager for large-file lazy-loading |
| `src/workers/parseWorker.ts` | Web Worker for off-thread log parsing |
| `src/services/unleashService.ts` | Unleashed AI calls: summarize, anomalies, chat, diagnose (contains Carbyne system knowledge prompt) |
| `src/services/logContextBuilder.ts` | Builds tokenized LLM context from filtered logs |
| `src/services/promptTemplates.ts` | All pre-built AI prompts |
| `src/services/datadogService.ts` | Datadog Logs API v2 — search, station discovery, connection test |
| `src/services/confluenceService.ts` | Confluence REST API — save investigation reports |
| `src/services/jiraService.ts` | Create/update Jira issues from diagnosis |
| `src/services/exportPackBuilder.ts` | Bundle logs + case + AI analysis into `.noclense` ZIP |
| `src/services/importService.ts` | Restore a session from a `.noclense` package |
| `src/services/redactor.ts` | PII/sensitive data scrubbing before AI submission |
| `src/services/embeddingService.ts` | Semantic embedding for similar-log search |
| `src/store/aiSettings.ts` | Layered credential resolution (env vars → localStorage) |
| `src/templates/nocTemplates.ts` | NOC report templates matched by ticket pattern |
| `src/styles/theme.css` | Theme color variables (light / dark / red themes) |
| `src/api/client.ts` | Typed fetch wrapper used by all service modules |

### Workspace Layout (Hybrid Redesign)

The UI uses a **Phase Rooms + Card Workspace** architecture. Three rooms with distinct layouts:

- **Import Room** — Centered card on empty canvas. Calm, focused on data intake.
- **Investigate Room** — CSS grid with 6 WorkspaceCards: Log Stream (large), AI Assistant, Evidence, Similar Tickets, Correlation Graph, Datadog Live. Maximum density.
- **Submit Room** — Two centered cards: Closure Note + Evidence Summary. Calm, focused on handoff.

Key components in `src/components/workspace/`:
- `NewWorkspaceLayout` — top-level layout, owns phase state, renders room content
- `RoomRouter` — composes PhaseHeader + WorkspaceGrid, delegates transitions
- `WorkspaceCard` — expandable card with accent dot, chevron, meta/badge slots
- `WorkspaceGrid` — CSS grid manager per room type
- `PhaseHeader` — header with logo, ticket context, PhaseDots, theme/settings
- `PhaseDots` — animated phase stepper (completed=clickable, future=disabled)
- `useRoomTransition` — exit/enter animation choreography between rooms

Phase navigation: forward via workflow actions (file upload, "Next: Submit" button). Back via phase dot clicks on completed phases. Room transitions use CSS fade+scale animations with card stagger entrance.

**Removed:** `AppLayout`, `IconRail`, `SidebarPanel`, `InvestigationPanels` — replaced by the workspace card system.

### Animation Architecture

- **Motion (Framer Motion)** — mount/unmount animations (Dialog, Sheet, AnimatePresence)
- **anime.js v4** — stagger effects, timeline orchestration, SVG, value tweening. Hooks in `src/utils/anime.ts`: `useAnimeStagger`, `useAnimeTimeline`, `useAnimeValue`
- **CSS transitions** — hover states, focus rings, room container transitions
- **CSS keyframes** — skeleton shimmer, toast entrance, phase dot pulse, evidence bounce

## Coding Conventions

- **TypeScript strict mode** — no `any` (use `unknown` for dynamic data); explicit return types on exported functions; interfaces for object shapes, type aliases for unions.
- **File size**: keep files under 500 lines; split otherwise.
- **Naming**: components `PascalCase`, hooks `use` prefix, services `[name]Service`, contexts `[Name]Context`, constants `UPPER_SNAKE_CASE`.
- **AI-related files** require: file-header JSDoc (purpose, dependencies), full JSDoc on every function (`@param`, `@returns`, `@throws`, `@example`), and "why" comments for non-obvious decisions.
- **Error handling**: classify API errors and throw user-facing messages; never expose raw API error text or log API keys to the console.
- **Styling**: Tailwind utility classes only; follow existing color scheme from `theme.css`; reference `FilterBar.tsx` for toolbar patterns, `Button.tsx` for button variants.

## Reference Patterns

- State management → `src/contexts/LogContext.tsx`
- External data / error handling → `src/components/FileUploader.tsx`
- Toolbar UI → `src/components/filter/FilterBar.tsx` (decomposed into SearchBar, FilterChips, FilterControls, FilterStatus)
- Workspace card → `src/components/workspace/WorkspaceCard.tsx`
- Room layout → `src/components/workspace/NewWorkspaceLayout.tsx`
- Animation hooks → `src/utils/anime.ts`
- AI implementation → `src/services/unleashService.ts` + `src/services/promptTemplates.ts`

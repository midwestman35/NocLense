# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NocLense** (internal codename: LogScrub) is an Electron desktop app — also deployable as a Vercel web app — for analyzing SIP/VoIP and telecommunications logs. It supports 100,000+ log entries with virtualized rendering, large-file streaming via IndexedDB, correlation-based filtering, call flow visualization, and AI-powered diagnosis via **Unleashed AI** (pre-configured with the organization's Confluence, Zendesk, and Slack knowledge base). The app also pulls live data from Datadog, Zendesk, and Jira.

> README.md advertises multi-provider AI (Gemini/Claude/OpenAI). That is outdated — all AI code paths run through `unleashService.ts`. Legacy stubs in `src/services/providers/` are not wired up.

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server (web, port 5173)
npm run electron:dev     # Vite + Electron concurrently
npm run build            # tsc -b && vite build  (TypeScript check must pass)
npm run lint             # ESLint (flat config, eslint.config.js)
npm run electron:build   # Package app (NSIS on Windows, DMG on macOS arm64)

npm run test             # Vitest watch mode
npm run test:run         # Single CI run
npm run test:coverage    # v8 coverage
npm run test:ui          # Interactive Vitest UI

# Run a single test file or filter by name pattern
npx vitest src/services/__tests__/unleashService.test.ts
npx vitest -- logContextBuilder
```

Optional backend (`server/`, Hono + sql.js) for server-side parsing/querying:

```bash
cd server && npm install && npm run dev   # listens on :3001
```

The renderer opts into the backend via `src/services/serverService.ts` (config in `localStorage` under `noclense-server-config`). Without it, parsing runs entirely in the browser/Electron.

## Architecture

### Process / Runtime Boundaries

```
Electron main (electron/main.js)
  └── IPC: app:report-error, safeStorage.encryptString
Preload (electron/preload.js)
  └── exposes window.electronAPI (sole bridge, no Node leakage)
Renderer (src/)
  ├── React 19 + Vite
  └── External APIs via Vite dev proxies (dev) or /api/* Vercel functions (prod)
```

- Never import Node or Electron APIs from `src/`; always go through `window.electronAPI`.
- External HTTP calls must go through the proxy routes below — calling third-party hosts directly breaks in both dev (CORS) and prod (credentials).

### External API Proxy Layer

The app talks to five external services. In dev, Vite proxies them (`vite.config.ts`); in Vercel prod, serverless functions in `api/` do the same.

| Service | Dev proxy | Prod proxy | Headers forwarded |
|---|---|---|---|
| Unleashed AI | `/ai-proxy` → `e-api.unleash.so` | `api/ai-proxy.ts` | `Authorization`, `unleash-account` |
| Jira | `/jira-proxy` → `${VITE_JIRA_SUBDOMAIN}.atlassian.net` | `api/jira-proxy.ts` | `Authorization` (Basic) |
| Confluence | `/confluence-proxy` → same Atlassian site as Jira | `api/confluence-proxy.ts` | `Authorization` (Basic) |
| Datadog | `/datadog-proxy` → `api.${VITE_DATADOG_SITE}` | `api/datadog-proxy.ts` | `DD-API-KEY`, `DD-APPLICATION-KEY` |
| Zendesk | `/zendesk-proxy` → `${VITE_ZENDESK_SUBDOMAIN}.zendesk.com` | `api/zendesk-proxy.ts` | `Authorization` (Basic) |

When adding a new integration, wire up **both** proxies or it will only work in one environment.

### Configuration Layering (`src/store/aiSettings.ts`)

Settings load in order: `VITE_*` env vars (from `.env`) → localStorage → in-app settings UI. Env vars win on first boot; the user can override them via the settings panel, and overrides persist. Datadog Application Key requires the `logs_read_data` scope. See `HANDOFF.md` for the full env var list.

### Provider Tree (`src/App.tsx`)

```
ToastProvider → AIProvider → CaseProvider → LogProvider → AppShell(NewWorkspaceLayout)
```

| Context | File | Manages |
|---|---|---|
| `LogContext` | `src/contexts/LogContext.tsx` | Parsed logs, filtered view, active correlations, IndexedDB mode flag, source filter, SIP filtering |
| `AIContext` | `src/contexts/AIContext.tsx` | Unleashed credentials (secure storage), chat/diagnosis state, token usage stats |
| `CaseProvider` | `src/store/caseContext.tsx` (not `contexts/`) | Case metadata, bookmarks, notes — persisted to localStorage via `caseReducer` + `store/localStorage.ts` |

Access via `useLogContext()`, `useAIContext()`, `useCase()`. **Never duplicate log state in components** — route reads through these hooks so memoization and IndexedDB mode stay consistent.

### Large File Handling (>50 MB)

`src/utils/parser.ts` switches to streaming mode above 50 MB:

1. File read in 2 MB chunks and written to IndexedDB (`src/utils/indexedDB.ts`).
2. `LogContext` sets `useIndexedDBMode = true` and lazy-loads filtered slices instead of holding the full array.
3. UI components check `useIndexedDBMode` + `totalLogCount` for display.

Heavy parsing can also be offloaded to a web worker (`src/workers/parseWorker.ts`) or to the optional `server/` backend.

### AI Integration (Unleashed AI only)

- All AI calls go through `src/services/unleashService.ts` (`summarizeLogs`, `detectAnomalies`, `chatWithAi`, `diagnoseLogs`). Never hit the API from components.
- **Prompts live in code, not in Unleashed.** The main diagnosis system prompt (explaining Carbyne's 6 log types) is inside `diagnoseLogs()` in `unleashService.ts`. Reusable snippets live in `src/services/promptTemplates.ts`. To change AI behavior, edit those files — do not hardcode prompts in components.
- **Context building** (`src/services/logContextBuilder.ts`): prioritizes ERROR > WARN > INFO > DEBUG, 5 surrounding logs per error, truncates payloads, targets ~10k tokens (100k max). Diagnosis can send up to 100KB of context with full payloads + correlation IDs.
- **Token accounting**: `src/utils/tokenEstimator.ts` tracks cumulative input/output usage.
- AI features must not block log viewing: lazy-load AI components and memoize context building.

### Diagnose Flow (3 phases)

`src/components/ai/DiagnoseTab.tsx` orchestrates three phases rendered inside a `ResizableSplit`:

1. `DiagnosePhase1` — runs AI analysis, shows progress.
2. `DiagnosePhase2` — Review & Refine: left pane is a mini log browser of AI-correlated + agent-starred logs; right pane is editable internal note + AI refinement chat.
3. `DiagnosePhase3` — final report generation (can push to Jira via `jiraService`).

Starring a log in the main viewer auto-adds it to Phase 2's correlated set.

### Correlation System

Users filter by faceted correlations: **Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, Message-ID**. Logic is AND between types, OR within a type; exclusion correlations are supported. All correlation state lives in `LogContext`. The parser extracts `cncID`/`stationId` from Datadog `machineData`.

### Workspace Layout (Phase Rooms + Card Workspace)

Three rooms with distinct layouts, all rendered by `src/components/workspace/NewWorkspaceLayout.tsx`:

- **Import Room** — single centered card for data intake.
- **Investigate Room** — CSS grid of `WorkspaceCard`s (Log Stream, AI Assistant, Evidence, Similar Tickets, Correlation Graph, Datadog Live). Maximum density.
- **Submit Room** — Closure Note + Evidence Summary, centered.

`NewWorkspaceLayout` owns phase state. Forward navigation is via workflow actions (upload, "Next: Submit"); back via `PhaseDots` clicks on completed phases. `useRoomTransition` choreographs exit/enter animations.

### Animation Layers

- **Motion (Framer Motion)** — mount/unmount (Dialog, Sheet, AnimatePresence).
- **anime.js v4** — stagger, timeline, SVG, value tweening via `src/utils/anime.ts` hooks (`useAnimeStagger`, `useAnimeTimeline`, `useAnimeValue`).
- **CSS transitions + keyframes** — hover/focus states, skeleton shimmer, toast entrance, phase dot pulse.

### Performance

- `LogViewer.tsx` uses `@tanstack/react-virtual`; only visible rows render.
- Expensive filtering/sorting uses `useMemo`; handlers use `useCallback`.
- `vite.config.ts` sets `base: './'` (Electron needs relative asset paths) and splits heavy libs (`pdfjs-dist`, `jszip`, `react`/`react-dom`, `@tanstack/react-virtual`) into separate chunks; PDF and ZIP libs are dynamically imported on first use.

## Key Files

| File | Role |
|---|---|
| `src/types.ts` | Canonical `LogEntry` interface (40+ fields) — the data contract for the whole app |
| `src/utils/parser.ts` | Multi-format parser (Datadog CSV with multiline JSON, Homer SIP JSON, plain-text, Call Log CSV); chunked streaming for large files |
| `src/utils/indexedDB.ts` | IndexedDB manager for large-file lazy-loading |
| `src/services/unleashService.ts` | All Unleashed AI calls + main diagnosis system prompt |
| `src/services/logContextBuilder.ts` | Builds tokenized LLM context from filtered logs |
| `src/services/promptTemplates.ts` | Reusable AI prompt snippets |
| `src/services/{datadog,zendesk,jira,confluence}Service.ts` | External integrations (all go through the proxy layer) |
| `src/services/serverService.ts` | Optional `server/` backend client |
| `src/services/redactor.ts` | PII redaction before sending data to external services |
| `src/store/aiSettings.ts` | Layered env/localStorage settings loader |
| `src/styles/theme.css` | Theme color variables (light / dark / red) |

## Coding Conventions

- **TypeScript strict mode** — no `any` (use `unknown`); explicit return types on exported functions; interfaces for object shapes, type aliases for unions.
- **File size** — keep files under 500 lines; split otherwise.
- **Naming** — components `PascalCase`, hooks `use` prefix, services `[name]Service`, contexts `[Name]Context`, constants `UPPER_SNAKE_CASE`.
- **AI-related files** — file-header JSDoc (purpose, dependencies, security notes), full JSDoc on every exported function (`@param`, `@returns`, `@throws`, `@example`), and "why" comments for non-obvious decisions.
- **Error handling** — classify API errors and throw user-facing messages (`RateLimitError`, `InvalidApiKeyError`, etc.); never expose raw API error text; never log API keys.
- **Styling** — Tailwind utility classes only; follow `theme.css` variables; reference `FilterBar.tsx` for toolbar patterns and `components/ui/Button.tsx` for button variants.

## Reference Patterns

- State management → `src/contexts/LogContext.tsx`
- External data + error handling → `src/components/FileUploader.tsx`
- Toolbar UI → `src/components/filter/FilterBar.tsx` (decomposed into SearchBar, FilterChips, FilterControls, FilterStatus)
- Workspace card → `src/components/workspace/WorkspaceCard.tsx`
- Room layout → `src/components/workspace/NewWorkspaceLayout.tsx`
- Animation hooks → `src/utils/anime.ts`
- AI implementation phases → `docs/plans/LLM_INTEGRATION_IMPLEMENTATION_PLAN.md`
- Recent major changes → `HANDOFF.md`, `CHANGELOG.md`

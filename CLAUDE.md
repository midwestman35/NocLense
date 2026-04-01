# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NocLense** (internal codename: LogScrub) is an Electron desktop application for analyzing SIP/VoIP and telecommunications logs. It supports 100,000+ log entries with virtualized rendering, large-file streaming via IndexedDB, correlation-based filtering, call flow visualization, and AI-powered log analysis via **Unleashed AI** (pre-configured with the organization's Confluence, Zendesk, and Slack knowledge base).

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Vite dev server (web, port 5173)
npm run electron:dev     # Development with Electron (Vite + Electron concurrently)
npm run build            # TypeScript check + Vite production build
npm run lint             # ESLint
npm run electron:build   # Package Electron app (NSIS installer for Windows, DMG for Mac)

npm run test             # Vitest in watch mode
npm run test:run         # Single CI test run
npm run test:coverage    # Coverage report
npm run test:ui          # Interactive test UI

# Run a single test file
npx vitest src/services/__tests__/llmService.test.ts
# Filter by name pattern
npx vitest -- logContextBuilder
```

## Architecture

### Electron / React Boundary

- **`electron/main.js`** — Main process: creates BrowserWindow, handles IPC for crash reporting (`app:report-error`) and secure API key storage (`safeStorage.encryptString`).
- **`electron/preload.js`** — Exposes `window.electronAPI` as the sole bridge; no Node APIs leak to the renderer.
- **`src/`** — React renderer process; never access Node/Electron APIs directly, always go through `window.electronAPI`.

### Global State (Context Providers)

Both providers wrap the entire app (`App.tsx`: `ToastProvider → AIProvider → CaseProvider → LogProvider → NewWorkspaceLayout`).

| Context | File | Manages |
|---|---|---|
| `LogContext` | `src/contexts/LogContext.tsx` | Parsed logs, filtered logs, active correlations, IndexedDB mode flag, SIP filtering |
| `AIContext` | `src/contexts/AIContext.tsx` | API key (secure storage), selected model/provider, usage stats (RPM/RPD), conversation history |

Access via `useLogContext()` and `useAIContext()` hooks. **Never duplicate log state in components.**

### Large File Handling (>50 MB)

Files above 50 MB trigger streaming mode in `src/utils/parser.ts`:
1. File is read in 2 MB chunks and written directly to IndexedDB (`src/utils/indexedDB.ts`).
2. `LogContext` sets `useIndexedDBMode = true` and lazy-loads filtered results from IndexedDB instead of holding the full array in memory.
3. UI components check `useIndexedDBMode` and `totalLogCount` for display.

### AI Integration

- **Never call AI APIs from components.** All Unleashed AI calls go through `src/services/unleashService.ts`; all AI panel state lives in `src/components/ai/`.
- **Unleash-only**: The app uses Unleashed AI exclusively. `src/services/providers/` contains legacy provider stubs — do not route new features through them. Use `unleashService.ts` directly.
- **Context building** (`src/services/logContextBuilder.ts`): prioritizes ERROR > WARN > INFO > DEBUG, includes 5 surrounding logs per error, truncates payloads to 200 chars, targets 10k tokens (max 100k).
- **Prompt templates** (`src/services/promptTemplates.ts`): all prompts live here — never hardcode prompts in components.
- **Rate limiting**: 15 RPM / 1,500 RPD tracked in `AIContext` for the free Gemini tier.
- AI features must not block core log viewing; lazy-load AI components and memoize context building.

### Correlation System

Users filter logs by faceted correlations (Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, Message-ID). Logic: AND between types, OR within a type. Exclusion correlations are also supported. All correlation state lives in `LogContext`.

### Performance

- `LogViewer.tsx` uses `@tanstack/react-virtual` — only visible rows are rendered.
- Expensive filtering/sorting must use `useMemo`; event handlers use `useCallback`.
- `vite.config.ts` uses relative asset paths (`./`) for Electron compatibility.

## Key Files

| File | Role |
|---|---|
| `src/types.ts` | Canonical `LogEntry` interface (40+ fields) — the data contract for the whole app |
| `src/utils/parser.ts` | Multi-format log parser (Datadog CSV, Homer SIP, JSON); streaming chunked read |
| `src/utils/indexedDB.ts` | IndexedDB manager for large-file lazy-loading |
| `src/services/unleashService.ts` | All Unleashed AI calls (summarize, anomalies, chat, diagnose) |
| `src/services/logContextBuilder.ts` | Builds tokenized LLM context from filtered logs |
| `src/services/promptTemplates.ts` | All pre-built AI prompts |
| `src/styles/theme.css` | Theme color variables (light / dark / red themes) |

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
- AI implementation phases → `docs/plans/LLM_INTEGRATION_IMPLEMENTATION_PLAN.md`


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NocLense** (internal codename: LogScrub) is an Electron desktop application for analyzing SIP/VoIP and telecommunications logs. It supports 100,000+ log entries with virtualized rendering, large-file streaming via IndexedDB, correlation-based filtering, call flow visualization, and AI-powered log analysis via Google Gemini and Claude.

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

Both providers wrap the entire app (`App.tsx`: `AIProvider → LogProvider → MainLayout`).

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

- **Never call AI APIs from components.** All API calls go through `llmService.ts` → surfaced to components via `AIContext`.
- **Multi-provider**: `src/services/providers/` contains a `ProviderRegistry` factory; `GeminiService` (singleton) and `ClaudeProvider` are current implementations.
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
| `src/services/llmService.ts` | GeminiService singleton + provider abstraction |
| `src/services/logContextBuilder.ts` | Builds tokenized LLM context from filtered logs |
| `src/services/promptTemplates.ts` | All pre-built AI prompts |
| `src/styles/theme.css` | Theme color variables (light / dark / red themes) |

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
- Toolbar UI → `src/components/FilterBar.tsx`
- AI implementation phases → `LLM_INTEGRATION_IMPLEMENTATION_PLAN.md`

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

**NocLense** (internal codename: LogScrub) is a Tauri desktop application for analyzing SIP, VoIP, and telecom logs. It supports 100,000+ log entries with virtualized rendering, IndexedDB-backed large-file handling, native file streaming for oversized imports, correlation-based filtering, call flow visualization, and AI-powered analysis through **Unleashed AI**.

## Commands

```bash
npm install            # Install dependencies
npm run tauri:dev      # Supported desktop dev runtime
npm run dev            # Renderer-only Vite dev server
npm run build          # TypeScript check + renderer build
npm run lint           # ESLint
npm run tauri:build    # Package the desktop app

npm run test           # Vitest watch mode
npm run test:run       # Single CI test run
npm run test:coverage  # Coverage report
npm run test:ui        # Interactive test UI

# Run a single test file
npx vitest src/services/__tests__/llmService.test.ts
# Filter by name pattern
npx vitest -- logContextBuilder
```

## Architecture

### Tauri / React Boundary

- **`src-tauri/src/lib.rs`** wires the Tauri app, plugins, and native commands.
- **`src-tauri/src/commands/`** contains native implementations for keyring access, crash-report persistence, and large-file chunk streaming.
- **`src/`** is the renderer. Components should stay browser-like and reach native functionality only through Tauri plugins or small service wrappers.

### Global State

Both providers wrap the app: `ToastProvider -> AIProvider -> CaseProvider -> LogProvider -> NewWorkspaceLayout`.

| Context | File | Manages |
|---|---|---|
| `LogContext` | `src/contexts/LogContext.tsx` | Parsed logs, filtered logs, active correlations, IndexedDB mode, SIP filtering |
| `AIContext` | `src/contexts/AIContext.tsx` | API keys, selected provider/model, usage stats, conversation history |

Access state through `useLogContext()` and `useAIContext()`. Do not duplicate log state inside components.

### Large File Handling

Files above 50 MB use the streaming path in `src/utils/parser.ts`:
1. Tauri imports can stream native file chunks through `src/services/fileStream.ts` and `src-tauri/src/commands/file_stream.rs`.
2. Parsed output is written into IndexedDB through `src/utils/indexedDB.ts`.
3. `LogContext` enables `useIndexedDBMode` so the UI can lazy-load results instead of holding the full log set in memory.

### AI Integration

- Never call AI APIs from components. Route all requests through `src/services/unleashService.ts` or the provider registry.
- Prompt assembly lives in `src/services/promptTemplates.ts`.
- Context packing lives in `src/services/logContextBuilder.ts`.
- Stored credentials go through `src/services/credentials.ts` and the Tauri keyring commands, with legacy migration handled in `src/store/apiKeyStorage.ts`.

### Performance

- `LogViewer.tsx` uses `@tanstack/react-virtual`; avoid work that defeats row virtualization.
- Expensive filtering and sorting should stay memoized.
- `vite.config.ts` uses relative asset paths (`./`) for desktop packaging.

## Key Files

| File | Role |
|---|---|
| `src/types.ts` | Canonical `LogEntry` interface |
| `src/utils/parser.ts` | Multi-format parser and streaming entrypoint |
| `src/utils/indexedDB.ts` | IndexedDB manager for large-file mode |
| `src/services/unleashService.ts` | Unleashed AI calls |
| `src/services/fileStream.ts` | Renderer wrapper around native chunk streaming |
| `src/services/credentials.ts` | Renderer wrapper around native keyring access |
| `src/services/logContextBuilder.ts` | LLM context construction |
| `src/services/promptTemplates.ts` | Prompt templates |
| `src/styles/theme.css` | Theme tokens |

## Workspace Layout

The UI uses a **Phase Rooms + Card Workspace** architecture:

- **Import Room**: centered intake card.
- **Investigate Room**: dense grid with Log Stream, AI Assistant, Evidence, Similar Tickets, Correlation Graph, and Datadog Live.
- **Submit Room**: handoff-focused closure and evidence cards.

Key components live under `src/components/workspace/`:
- `NewWorkspaceLayout`
- `RoomRouter`
- `WorkspaceCard`
- `WorkspaceGrid`
- `PhaseHeader`
- `PhaseDots`
- `useRoomTransition`

## Coding Conventions

- TypeScript strict mode; prefer `unknown` over `any`.
- Keep files under roughly 500 lines where practical.
- Components use `PascalCase`, hooks use `use*`, services use `[name]Service`.
- Classify user-facing errors and avoid logging secrets.
- Follow the existing Tailwind and token conventions in `src/styles/`.

## Multi-Agent Workflow

| Agent | Role | Scope |
|---|---|---|
| **Claude** | Project lead and reviewer | Plans phases, reviews slices, approves merges |
| **Codex** | Principal implementer | Lands approved slices, writes tests, commits code |
| **Gemini** | Documentation support | Rewrites docs after code is reviewed |

Workflow: Claude plans, Codex implements, Claude reviews, Gemini updates broad documentation after approval.

# src/CLAUDE.md

Module context for the renderer application.

## Scope
- React UI, contexts, services, and utilities in `src/`.
- No direct native platform API access from components.

## Rules
- Access log and AI state via `useLogContext()` and `useAIContext()`.
- Route all LLM calls through `src/services/llmService.ts`.
- Keep performance-sensitive work memoized for virtualized log viewing.

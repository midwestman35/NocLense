# Architecture

This document is the index for NocLense architecture documentation.

## System Boundaries
- Renderer app code: `src/`
- Electron main/preload boundary: `electron/`
- AI providers and orchestration: `src/services/`
- Large file streaming and persistence: `src/utils/parser.ts`, `src/utils/indexedDB.ts`

## Detailed References
- `docs/architecture/` for implementation and analysis documents.
- `docs/plans/` for upcoming implementation plans.
- `docs/decisions/` for ADRs and durable technical decisions.
- `docs/runbooks/` for setup, testing, and operational procedures.

# Developer Handoff

**Version:** 3.0 | **Last updated:** 2026-04-22

This document serves as the primary onboarding and reference guide for developers and AI agents working on the NocLense codebase. It replaces the legacy `HANDOFF.md`.

---

## 1. Quick Start

```bash
git clone <repo> && cd NocLense
npm install

# Setup environment variables (obtain .env from team lead)
# Start Vite web dev server:
npm run dev

# Start Electron + Vite concurrently:
npm run electron:dev

# Run tests in watch mode:
npm run test
```

---

## 2. Architecture at a Glance

NocLense uses a 5-layer architecture:

1. **Electron Main Process:** Manages native windowing, secure API key storage (`safeStorage`), and IPC communication.
2. **React Renderer:** The UI layer (React 19). Uses robust contexts (`LogContext`, `AIContext`) and services for business logic. 
3. **Workspace Layout:** The UI follows a strict **Phase Rooms + Card** architecture (Import Room → Investigate Room → Submit Room), heavily utilizing CSS Grid and animated transitions.
4. **AI Pipeline:** All LLM calls route through `unleashService.ts` via the `logContextBuilder` and use standardized `promptTemplates`.
5. **External Integrations:** Connects out to Zendesk, Datadog, Jira, and Confluence via Vite dev proxies or Vercel serverless endpoints.

---

## 3. Key Files

| File / Path | Description |
|---|---|
| `electron/main.js` | Main process; handles IPC and encrypted storage. |
| `electron/preload.js` | Exposes safe `window.electronAPI` bridge to React. |
| `src/types.ts` | Canonical `LogEntry` interface (the data contract for the whole app). |
| `src/contexts/LogContext.tsx` | Global log state (parsed logs, filters, correlations). |
| `src/contexts/AIContext.tsx` | Global AI state (API keys, models, usage stats). |
| `src/services/unleashService.ts` | Exclusive entry point for Unleashed AI interactions. |
| `src/services/logContextBuilder.ts` | Tokenizes and filters log context for LLM prompts. |
| `src/services/promptTemplates.ts` | All reusable AI prompts and templates. |
| `src/components/workspace/NewWorkspaceLayout.tsx` | Top-level orchestrator of the Phase Rooms layout. |
| `src/components/workspace/RoomRouter.tsx` | Manages transitions between Phase Rooms. |
| `src/components/workspace/PhaseHeader.tsx` | Header with logo, ticket context, and phase dots. |
| `src/components/workspace/WorkspaceGrid.tsx` | CSS grid manager per room type. |
| `src/components/workspace/WorkspaceCard.tsx` | Expandable card primitive with accent dot, chevron. |
| `src/components/ui/Spinner.tsx` | Reusable spinner primitive with reduced-motion support. |
| `src/utils/parser.ts` | Multi-format log parser with chunked streaming read. |
| `src/utils/indexedDB.ts` | IndexedDB manager for large-file (>50MB) lazy-loading. |
| `src/utils/anime.ts` | Animation hooks (`useAnimeStagger`, `useAnimeTimeline`, etc.). |
| `src/styles/tokens.css` | CSS custom properties, including transition constants. |

---

## 4. State Management

- **Rule:** Never duplicate log state inside components.
- State is exclusively managed by top-level Context Providers. 
- Provider Nesting Order: `<MotionConfig>` → `<ToastProvider>` → `<AIProvider>` → `<CaseProvider>` → `<EvidenceProvider>` → `<LogProvider>` → `<NewWorkspaceLayout>` (AppShell).
- Additional specialized contexts include `EvidenceContext` and `RoomLiveStateContext`.
- Access state only via custom hooks: `useLogContext()`, `useAIContext()`.
- Expensive filtering arrays are strictly memoized (`useMemo`) to maintain 60FPS scrolling in `@tanstack/react-virtual`.

---

## 5. Animation Architecture

Animations in NocLense are layered and deeply respect accessibility (reduced-motion):

1. **Motion (formerly Framer Motion):** Manages component mount/unmount animations. We enforce a global `<MotionConfig reducedMotion="user">` at the app root.
2. **anime.js v4:** Used for complex orchestrations. Custom hooks in `src/utils/anime.ts` include `usePrefersReducedMotion` guards that snap to the final state if enabled.
3. **CSS Transitions:** Used for hover states and room transitions. We strictly use exported Direction C curves (e.g., `--ease-spring`, `--ease-emphasized` in `tokens.css`).
4. **CSS Keyframes:** Utilized for infinite loops like the `<Spinner />` and skeleton shimmers, guarded by `motion-reduce:animate-none`.

---

## 6. Workspace Layout

The UI uses a **Phase Rooms + Card Workspace** architecture. Navigation proceeds forward via workflow actions and backward via phase dot clicks on completed phases. Room transitions use CSS fade+scale animations with card stagger entrance.

- **Import Room:** Centered card on an empty canvas. Calm, focused on data intake.
- **Investigate Room:** CSS grid with 6 `WorkspaceCard` instances: Log Stream (large), AI Assistant, Evidence, Similar Tickets, Correlation Graph, and Datadog Live. Designed for maximum density.
- **Submit Room:** Two centered cards: Closure Note + Evidence Summary. Calm, focused on handoff.

---

## 7. Where the Prompts Live

All AI prompts are in the code, NOT in Unleashed AI. This allows us to version-control and customize them per situation. To change AI behavior, edit `unleashService.ts`.

| Function / File | File | Purpose |
|---|---|---|
| `diagnoseLogs()` | `src/services/unleashService.ts` | Main diagnosis with Carbyne log knowledge |
| `formatLogsForDiagnosis()` | `src/services/unleashService.ts` | Log formatting for AI context |
| `chatWithAi()` | `src/services/unleashService.ts` | Chat/refinement |
| `summarizeLogs()` | `src/services/unleashService.ts` | One-click summarization |
| `detectAnomalies()` | `src/services/unleashService.ts` | Anomaly detection |
| `LogContextBuilder` | `src/services/logContextBuilder.ts` | Token-aware context prioritization |
| `promptTemplates` | `src/services/promptTemplates.ts` | Reusable prompt snippets |

---

## 8. Coding Conventions

- **TypeScript:** Strict mode enabled. No `any` (use `unknown`). Return types on exported functions are required.
- **Naming:** Components (`PascalCase`), hooks (`useCamelCase`), contexts (`[Name]Context`), constants (`UPPER_SNAKE_CASE`).
- **File constraints:** Maximum 500 lines per file.
- **AI Tooling:** All functions in AI services must include complete JSDoc (`@param`, `@returns`, `@throws`) and high-level behavioral comments.
- **Styling:** Exclusively Tailwind utility classes.
- **See [CLAUDE.md](../CLAUDE.md)** for further details.

---

## 9. Testing

The project uses **Vitest** + **React Testing Library**. 

**Key Test Patterns:**
- **DOM-Marker Pass-Through:** When testing `MotionConfig` or animation wrappers, use `vi.mock()` to render a basic DOM marker (e.g., `<div data-testid="motion-config">`) to assert on props without executing actual animations.
- **`motionDivSpy`:** Used to spy on `motion.div` implementations to ensure exact properties (like size or transition curves) are applied.
- **Module-Load Seam:** Used to isolate module dependencies and mock environment features prior to component imports.

---

## 10. Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_UNLEASH_TOKEN` | Required | Bearer token for Unleashed AI API. |
| `VITE_UNLEASH_ASSISTANT_ID` | Optional | Unleashed AI assistant identifier. |
| `VITE_UNLEASH_USER_EMAIL` | Optional | User email for Unleashed AI session tracking. |
| `VITE_ZENDESK_SUBDOMAIN` | Required | Zendesk target subdomain. |
| `VITE_ZENDESK_EMAIL` | Required | Authentication email for Zendesk. |
| `VITE_ZENDESK_TOKEN` | Required | Authentication token for Zendesk. |
| `VITE_DATADOG_API_KEY` | Optional | Datadog API authentication. |
| `VITE_DATADOG_APP_KEY` | Optional | Needs `logs_read_data` scope. |
| `VITE_DATADOG_SITE` | Optional | e.g., `datadoghq.eu`. |
| `VITE_JIRA_SUBDOMAIN` | Optional | Required for Jira/Confluence features. |
| `VITE_JIRA_EMAIL` | Optional | Required for Jira/Confluence features. |
| `VITE_JIRA_TOKEN` | Optional | Required for Jira/Confluence features. |
| `VITE_JIRA_PROJECT_KEY` | Optional | Jira project key for issue creation. |
| `VITE_CONFLUENCE_SPACE_ID` | Optional | Target Space ID for Investigation Memory. |
| `VITE_CONFLUENCE_PARENT_PAGE_ID` | Optional | Target Page ID for Investigation Memory. |

---

## 11. Proxy Configuration

To bypass CORS restrictions during local development, Vite proxies are used. In production on Vercel, these proxies are replaced by actual serverless functions. 

| Route | Target | Auth |
|---|---|---|
| `/ai-proxy` | Unleashed AI API | Bearer token |
| `/zendesk-proxy` | Zendesk REST API | Basic auth |
| `/datadog-proxy` | Datadog API (from `VITE_DATADOG_SITE`) | DD-API-KEY + DD-APPLICATION-KEY headers |

---

## 12. Known Issues / Tech Debt

- **Datadog Station Discovery:** Intermittently returns 0 results due to variable facet paths in `datadogService.ts`. Users must sometimes enter CNC names manually.
- **`act()` warnings in AIButton tests:** Some async state updates in test render cycles still lack proper `act()` wrappers.
- **EvidenceContext localStorage mock failure:** Occasionally flakes in CI due to global `window` contamination.
- **Pre-existing lint errors:** Some legacy files still hold `@ts-expect-error` comments; do not introduce new ones.

---

## 13. Phase History

- **Phase 04.5:** Component restructuring, testing boilerplate, initial AI hooks.
- **Phase 05:** Workspace Layout Redesign (Phase Rooms + Card Architecture), removal of legacy SidebarPanel/IconRail.
- **Phase 06A:** Reduced-motion accessibility sweep, Spinner primitives, anime.js guards, and global MotionConfig integration.

---

## 14. What's Next

- **Phase 06B:** Correlation Graph implementation (Visualizing node/edge relations for call flows).
- **Phase 06C:** Case Library (Indexing and retrieving past investigations beyond Confluence).
- **Phase 07:** Tauri migration (Replacing Electron for improved performance and bundle size).

---

## 15. Multi-Agent Workflow

NocLense is maintained by a multi-agent team. When working within this repo, adhere to the following roles:

- **Claude (CTO/Project Lead):** Drafts plans, conducts adversarial reviews, and steers high-level architectural decisions. 
- **Codex (Principal Engineer):** Executes code implementation, writes tests, and runs validations.
- **Gemini (Support Staff):** Maintains documentation, creates user guides, and handles onboarding materials.

**Active Work Protocol:** Always check `docs/superpowers/HANDOFF.md` before starting work to understand the currently active phase and dispatch instructions. For architectural guidelines, defer to the root `CLAUDE.md`. End-user workflows are documented in `docs/USAGE_GUIDE.md`.
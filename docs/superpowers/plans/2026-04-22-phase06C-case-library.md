# Phase 06C — Case Library (indexing + retrieval of past investigations)

> **For agentic workers:** Read `CLAUDE.md`, `AGENTS.md`,
> `src/CLAUDE.md`, `src/types/case.ts`, and
> `src/services/embeddingService.ts` fully before starting. Each
> slice is dispatchable as a self-contained Codex task with a named
> primary agent.
>
> **Review cadence:** Lightweight. One adversarial probe on this
> plan (not iterative rounds). Per-slice self-assessment at end of
> slice (not per-commit). Deep review at phase close-out.

---

## Revision log

**v1 → v2 (Codex round 1 adversarial review, 2026-04-22):** NO-GO on
2 items + 2 YELLOWs requiring framing/scope fixes. v2 is authoritative;
v1 is historical.

| # | v1 issue | v2 resolution |
|---|---|---|
| α | **Slice 3 grid overflow (NO-GO).** Investigate Room is a fixed 6-slot 3×3 grid (`WorkspaceGrid.tsx:107`, `CARD_GRID_CLASSES` lines 174–181); a 7th card auto-places into implicit row. Plan left "new card vs. replace Similar Tickets" unresolved. | **Resolved: expand existing `similar-tickets` slot.** The current card (Zendesk past tickets via `similarPastTickets`) gains a second section for Case Library results. No new slot, no grid change, no displacement of existing functionality. Card keeps `id="similar-tickets"` / slot class for minimal churn; visible title becomes "Similar" with subsections "Past tickets" (existing Zendesk content) and "Past cases" (new Case Library content). |
| β | **Wrong integration seams (NO-GO).** Plan referenced `src/contexts/CaseContext.tsx` + `useCaseContext()` + `src/services/importService.ts`; real surfaces are `src/store/caseContext.tsx` + `useCase()` exposing `activeCase` + `.noclense` flow through `src/components/import/WorkspaceImportPanel.tsx:124` + `src/services/noclenseImporter.ts:39`. | All file paths, hook names, and prop names in the file map + slice bodies now point at the verified seams. |
| γ | **Missing normal-case lifecycle persistence (NO-GO).** Plan proved import-side indexing but left routine local case creation/update unpersisted; `caseContext.tsx` reducer state would stay in-memory, contradicting the "persist every investigation" promise. | Slice 1 scope extended: CaseRepository is wired into `caseContext.tsx` so every `createCase`, `updateCase`, `deleteCase` reducer action writes through the repository. Close/status transition to `'resolved'` additionally triggers embedding via CaseLibraryService. Slice 3 now reads from the repo-backed state, not a fresh hook. |
| δ | **Embedding provider mid-phase flip risk (YELLOW).** "Default Gemini, flip if user confirms Unleashed" created config-split / version-churn risk mid-implementation. | **v1 frozen as Gemini-only.** Moving embeddings to Unleashed is explicitly out of scope for Phase 06C. Revisit as a dedicated decision in a later phase with its own plan + migration path. |
| ε | **Overpromised semantic similarity (YELLOW).** Plan framed matches as "same symptom or correlation pattern" — cosine similarity on `title + summary + impact` is dominated by boilerplate and cannot deliver that. | Framing tightened to "semantically similar summary/impact text." Correlation-overlap and log-shape reranking moved explicitly to non-goals as a v2 candidate. |
| ✓ | Probe 3 (Slice 2 idempotency): GO, no change needed. |

Codex's IndexedDB migration YELLOW (Probe 2) was low-risk but real:
blocked-upgrade handling and `initPromise` poisoning on failed open.
Both folded into Slice 1 scope — see Slice 1 §3 below.

---

## Context

NocLense operators work on many investigations over time. Today,
each investigation stands alone — there's no way to pull in a past
case that had a semantically similar summary. The Case Library
closes that loop: when an operator is mid-investigation, NocLense
surfaces the top-K past cases with the most similar written
description to the current one, letting the operator steal relevant
prior art.

**Scope (v1, local-only):**
- Persist every investigation as a retrievable `Case` in IndexedDB
  — including cases created through the normal in-app flow, not
  only imported `.noclense` packages
- Compute an embedding per case from `title + summary + impact`
- Retrieve top-K similar past cases by cosine similarity on demand
- Surface results by expanding the existing Investigate Room
  "Similar Tickets" card with a new "Past cases" section — no new
  grid slot
- `.noclense` import auto-adds to library via the real import
  pathway

**Out of scope (v2+ candidates):**
- Multi-user / team-wide case library (needs server — Phase 07+)
- Full-text search (similarity-only is sufficient for v1)
- Approximate nearest neighbor (brute-force cosine is fine for
  <10k cases — NocLense is nowhere near that scale)
- Cross-phase case-state replay ("load the filters + pivots from
  that past case") — surfacing is enough; replay is a separate
  phase
- Embedding model swap / local ONNX transformer (keeps the API
  dependency but isolates the provider seam)
- **Correlation-overlap or log-shape signal in similarity scoring**
  — v1 is text-semantic similarity only. Reranking by
  correlation-type Jaccard overlap or shared-log-signature is a
  real improvement for this domain but requires additional
  design; v2 candidate with its own plan.
- **Moving embeddings off Gemini to Unleashed AI** — v1 is frozen
  as Gemini-only. Any provider migration is its own phase with a
  dedicated plan; do not attempt mid-implementation.

---

## Embedding provider (frozen for v1)

The existing `embeddingService.ts` calls **Gemini**
(`text-embedding-004`) directly via `@google/generative-ai`. The
`AGENTS.md` "Unleash-only" rule targets routing *through*
`src/services/providers/`; `embeddingService.ts` sits at the
services root and predates that rule.

**v1 decision: keep Gemini.** The embedding seam is Gemini-only
for Phase 06C.

**Why frozen, not TBD:** Codex round-1 review flagged the
mid-phase flip risk as a real concern. The renderer already ships
multiple providers plus Gemini-specific wiring in
`src/contexts/AIContext.tsx:7/302`, `src/types/ai.ts:11`, and
`src/services/embeddingService.ts:20`. Adding a provider migration
inside Phase 06C multiplies config-split + version-churn surface
for no v1 value.

**What this means operationally:**
- `VITE_GEMINI_EMBEDDING_KEY` is a separate credential from the
  Unleashed token. Document this in `AGENTS.md` § Environment
  Variables (Slice 1 touches it).
- If the embedding key is missing, the Case Library surfaces an
  empty state with a "configure key" prompt rather than breaking.
- Moving embeddings to Unleashed (or a local ONNX model) is a
  separate phase with its own plan. Do not attempt during any
  Phase 06C slice.

---

## Foundation assumptions (verify before first commit of each slice)

1. `src/types/case.ts` already defines a rich `Case` interface. No
   schema edits needed in Slice 1 beyond adding optional
   `embedding?: number[]` and `embeddingVersion?: string` fields
   for Slice 2.
2. `dbManager` in `src/utils/indexedDB.ts:42` already carries
   additive-guarded upgrades; `initPromise` is cached at
   `src/utils/indexedDB.ts:24`. Slice 1 must add a new object store
   **and** add resilience for two failure modes the current
   manager doesn't handle: (a) blocked-upgrade events (other tab
   holds old version), (b) failed-init poisoning (cached rejected
   `initPromise` prevents retry without reload).
3. `embeddingService.ts` already has `cosineSimilarity()` +
   `retrieveTopKByQuery()` methods. Slice 2 extends, does not
   rewrite.
4. `.noclense` import flows through
   `src/components/import/WorkspaceImportPanel.tsx:124` (invoke
   point) and `src/services/noclenseImporter.ts:39` (the
   importer). `src/services/importService.ts` is a separate,
   older surface — **not** the current `.noclense` path. Slice 3
   wires auto-indexing into `noclenseImporter`, not
   `importService`.
5. **Case lifecycle lives in `src/store/caseContext.tsx`**, not
   `src/contexts/CaseContext.tsx`. The hook is `useCase()` and
   exposes `activeCase` (not `currentCase`). The reducer owns
   `state.cases` in-memory at `src/store/caseContext.tsx:41`. For
   "persist every investigation" to hold, every reducer action
   that mutates a case (`createCase`, `updateCase`, `deleteCase`,
   state-change transitions like open → resolved) must write
   through `CaseRepository`. Slice 1 owns this wiring.
6. The Investigate Room `similar-tickets` card
   (`NewWorkspaceLayout.tsx:270–300`) already renders Zendesk
   past tickets via `similarPastTickets`. Slice 3 extends this
   card with a second section for local Case Library results —
   NOT a new card. Grid has exactly 6 slots
   (`WorkspaceGrid.tsx:174–181`); adding a 7th overflows.

---

## File map

### New files
```
src/services/caseRepository.ts                                      (Slice 1)
src/services/caseLibraryService.ts                                  (Slice 2)
src/components/workspace/SimilarCasesSection.tsx                    (Slice 3)
src/services/__tests__/caseRepository.test.ts                       (Slice 1)
src/services/__tests__/caseLibraryService.test.ts                   (Slice 2)
src/components/workspace/__tests__/SimilarCasesSection.test.tsx     (Slice 3)
```

### Modified files
```
src/types/case.ts                                                   (Slice 1 — add embedding fields)
src/utils/indexedDB.ts                                              (Slice 1 — add cases object store; blocked + init-retry resilience)
src/store/caseContext.tsx                                           (Slice 1 — wire reducer actions through CaseRepository)
src/services/embeddingService.ts                                    (Slice 2 — add buildCaseEmbeddingText helper)
src/services/noclenseImporter.ts                                    (Slice 3 — auto-index imported cases)
src/components/import/WorkspaceImportPanel.tsx                      (Slice 3 — only if importer's return shape changes; ideally untouched)
src/components/workspace/NewWorkspaceLayout.tsx                     (Slice 3 — embed SimilarCasesSection inside similar-tickets card)
AGENTS.md                                                           (Slice 1 — document VITE_GEMINI_EMBEDDING_KEY env var)
docs/perf/reduced-motion-audit.md                                   (Slice 3 — new animated surfaces)
```

---

## Commit decomposition

Three slices, 3 commits total. Can run as a sequential pipeline or
Slice 1 + Slice 2 in parallel (independent files), then Slice 3
serially. Prefer sequential for simpler review.

### Slice 1 — Case storage, repository, and lifecycle wiring

**Primary agent:** `data-engineer`
**Rationale:** IndexedDB schema design + reducer integration are
the core concerns. The reducer wiring is thin (call-through, not
React rendering), so keeping it with the data layer avoids
splitting an atomic persistence contract across two agents.

**Files:** `src/services/caseRepository.ts` (new),
`src/utils/indexedDB.ts` (extend), `src/types/case.ts` (extend),
`src/store/caseContext.tsx` (wire reducer), `AGENTS.md` (env var
doc), tests.

**Commit 1 — CaseRepository + lifecycle persistence**

1. **Schema extension** (`src/types/case.ts`) — add optional
   `embedding?: number[]` and `embeddingVersion?: string` to the
   `Case` interface. No breaking changes; existing cases without
   embeddings still load.

2. **IndexedDB object store** (`src/utils/indexedDB.ts`) — add a
   `cases` object store with key path `id`. Bump the DB version
   by 1 in the open-upgrade handler. Add indexes on `createdAt`
   and `updatedAt` for list ordering.

3. **IndexedDB resilience** (same file — Codex Probe 2 YELLOW
   fix):
   - Handle `blocked` event on `IDBOpenDBRequest`: log warning
     and resolve with explicit error so callers can surface a
     "another tab holds an older database version — close other
     tabs and reload" message. Current init silently hangs.
   - On init failure, DO NOT cache the rejected promise at
     `initPromise` (current behavior at line 24 poisons all
     subsequent calls). Instead: clear `initPromise` in a
     `.catch` so the next call retries.

4. **CaseRepository service** — CRUD surface:
   ```ts
   export class CaseRepository {
     saveCase(case: Case): Promise<void>;         // upsert
     getCase(id: string): Promise<Case | null>;
     listCases(opts?: {
       limit?: number;
       orderBy?: 'createdAt' | 'updatedAt';
     }): Promise<Case[]>;
     deleteCase(id: string): Promise<void>;
     updateCaseEmbedding(
       id: string,
       embedding: number[],
       version: string,
     ): Promise<void>;
   }
   ```
   Mirror the log-embedding pattern already in `indexedDB.ts`.
   Export a singleton instance so all callers share one.

5. **Reducer integration** (`src/store/caseContext.tsx`) — the
   reducer currently holds `state.cases` in-memory only (line 41).
   Each lifecycle action must persist:
   - `createCase` → after reducer state updates, call
     `caseRepository.saveCase(newCase)` in an effect (not inside
     the reducer itself — reducers must stay pure).
   - `updateCase` → same; persist the updated case.
   - `deleteCase` → `caseRepository.deleteCase(id)`.
   - `addBookmark`, `addNote`, `updateCaseState`, etc. — these
     all mutate the active case; after-effect persists the
     updated case.
   - Persistence errors are logged, not thrown. Failed persist =
     stale-on-next-reload but does not break the current session.
   - On context mount, call `caseRepository.listCases()` and
     hydrate `state.cases` with previously persisted cases so the
     library survives reload.

6. **AGENTS.md env var doc** — append `VITE_GEMINI_EMBEDDING_KEY`
   to the Environment Variables block (§ Environment Variables)
   with a comment that it's distinct from the Unleashed token
   and only powers the Case Library embedding index.

7. **Tests** (`caseRepository.test.ts`) — CRUD roundtrip,
   ordering, embedding update, missing-case handling, blocked-
   upgrade behavior (mock the IDB open request to fire `blocked`),
   init-retry after failure (reject once, succeed on retry).

**Verification:**
- `npx tsc --noEmit` → 0
- `npm run test:run` (full suite) → green; specifically
  `caseContext.test.tsx` should NOT regress.
- Manual: create a case in the app, reload the page, confirm
  the case is still there.
- Manual: open a second tab (held at old DB version if possible),
  then trigger an upgrade in a third tab; observe the blocked-
  handler warning (dev-console check).

**Commit message:** `feat(phase-06c): CaseRepository + case lifecycle persistence`

---

### Slice 2 — Case embedding + retrieval

**Primary agent:** `ai-engineer`
**Rationale:** Embedding generation, retrieval ranking, and
provider selection are AI-system territory. `data-engineer` owns
the repository; `ai-engineer` owns what flows through it.

**Files:** `src/services/caseLibraryService.ts` (new),
`src/services/embeddingService.ts` (extend with case-text
builder), tests.

**Commit 2 — CaseLibraryService: indexing + similarity retrieval**

1. **Case-text builder in `embeddingService.ts`** — add
   `buildCaseEmbeddingText(case: Case): string` that concatenates
   `title + summary + impact` (the three highest-signal fields).
   Truncate to 2048 characters to match Gemini's embedding input
   limit.

2. **CaseLibraryService** — surface:
   ```ts
   export class CaseLibraryService {
     constructor(
       repo: CaseRepository,
       embedder: EmbeddingService,
     ) {}

     indexCase(case: Case): Promise<Case>;
       // Computes embedding, stores via repo, returns updated case.
       // Idempotent — if `case.embedding` already set AND
       // `embeddingVersion` matches CURRENT_VERSION, skip.

     findSimilar(
       query: Case | string,
       opts: {
         topK?: number;           // default 5
         filters?: {
           minDate?: number;
           maxDate?: number;
           severity?: CaseSeverity[];
           excludeCaseIds?: string[];  // for exclude-self
         };
       }
     ): Promise<Array<{ case: Case; score: number }>>;

     reindexAll(onProgress?: (pct: number) => void): Promise<void>;
       // For version bumps or initial bulk import.
   }
   ```

3. **Provider handling** — Gemini-only per frozen v1 decision. If
   `embeddingService.initialize()` has not been called (no
   `VITE_GEMINI_EMBEDDING_KEY` in env or no runtime override),
   `findSimilar` returns `[]` gracefully and `indexCase` is a
   no-op + `console.warn`. Do NOT throw. The UI renders a
   "configure embedding key in settings" state rather than
   crashing. Check-key pattern mirrors `AIContext.tsx` handling
   for missing Unleashed token.

4. **Embedding version constant** — hardcode `CURRENT_VERSION =
   'gemini-text-embedding-004'` (or whatever the active model
   returns). Stored on the case alongside the embedding so a
   future model swap triggers automatic reindex.

5. **Tests** — index a case, query by string, query by case,
   filter by date / severity / exclude-ids, version-mismatch
   reindex, graceful degradation when embedder not initialized.

**Verification:**
- `npx tsc --noEmit` → 0
- `npm run test:run -- src/services/__tests__/caseLibraryService.test.ts` → green
- No manual verification (UI lands in Slice 3).

**Commit message:** `feat(phase-06c): CaseLibraryService — embedding index + similarity retrieval`

---

### Slice 3 — UI integration + import-side auto-indexing

**Primary agent:** `react-specialist`
**Secondary:** `accessibility-tester` for live-region + keyboard
parity with Phase 06B Commit 4 (maintain the a11y bar we just
raised for the graph).

**Files:** `src/components/workspace/SimilarCasesSection.tsx`
(new — the "Past cases" subsection of the similar-tickets card),
`src/components/workspace/NewWorkspaceLayout.tsx` (embed the
section inside the existing `similar-tickets` card at lines
270–300), `src/services/noclenseImporter.ts` (auto-index on
import), `docs/perf/reduced-motion-audit.md` (append), tests.

**DO NOT add a new grid slot.** The Investigate Room grid is
locked at 6 slots (`WorkspaceGrid.tsx:174–181`); a 7th card
overflows. Slice 3 extends the existing `similar-tickets` card
with a second section.

**Commit 3 — SimilarCasesSection + auto-indexing**

1. **Similar card restructure** (`NewWorkspaceLayout.tsx:270–300`)
   — the existing WorkspaceCard at `id="similar-tickets"` keeps
   its slot and accent color. Inside the card:
   - Section header "Past tickets" wraps the existing Zendesk
     `similarPastTickets` render (keep verbatim — no behavior
     change to the Zendesk side).
   - New section header "Past cases" below, renders
     `<SimilarCasesSection />`.
   - Card `title` prop changes from "Similar Tickets" to
     "Similar" (the card now surfaces both). Card `meta`
     combines counts: `{zendeskCount} tickets · {cases.length} cases`.

2. **SimilarCasesSection component** — reads the active case via
   `useCase()` → `activeCase` (from `src/store/caseContext.tsx`,
   NOT a `useCaseContext()` that doesn't exist). If `activeCase`
   is null, renders "No active case yet." Otherwise calls
   `caseLibraryService.findSimilar(activeCase, {
     topK: 5,
     filters: { excludeCaseIds: [activeCase.id] }
   })` and renders:
   - Title (primary text)
   - 1-line summary preview (truncated at ~120 chars)
   - Severity badge (color-coded, reuse existing severity token
     if one exists; otherwise add a minimal colored dot)
   - Relative date ("3 days ago")
   - "Open" button — calls `setActiveCase(id)` from
     `useCase()` to switch to that case in the workspace

3. **Loading + empty states**
   - Loading: skeleton rows while `findSimilar` pending
   - Empty (zero results, library not empty): "No semantically
     similar cases in your library yet."
   - Empty (library truly empty): "The library fills as you
     create and resolve investigations — both new ones and
     imported `.noclense` packs."
   - Error (embedder not initialized): "Configure
     `VITE_GEMINI_EMBEDDING_KEY` to enable similar-case
     retrieval." with a Settings link.

4. **Keyboard a11y (reuse Phase 06B pattern)**
   - Section is a single tab-stop within the card; arrow keys
     traverse the up-to-5 result rows
   - Enter/Space on a row activates `setActiveCase`
   - aria-live="polite" announces result set changes ("Showing
     N similar past cases")
   - aria-live="assertive" announces case switch ("Switching to
     case CASE-1234")
   - Respect `usePrefersReducedMotion()` — skeleton shimmer
     animation skips on reduced-motion

5. **Import-side auto-indexing** — `src/services/noclenseImporter.ts`
   is the actual import surface (verified at line 39). Wire
   auto-indexing there:
   - After a `.noclense` pack successfully imports its case
     metadata, call `caseLibraryService.indexCase(case)` fire-
     and-forget with error logging.
   - The reducer-level persistence from Slice 1 already saves
     the case to the repository; this call only triggers the
     embedding compute.
   - Do NOT block the import success path on embedding; the
     pack lands in the library immediately, embedding catches
     up asynchronously.
   - If `WorkspaceImportPanel.tsx:124` needs to know embedding
     state (e.g., "indexing…" label), expose an optional
     callback from the importer; otherwise leave the panel
     unchanged.

6. **Reduced-motion audit append** — one new row block in
   `docs/perf/reduced-motion-audit.md` §2.7:
   - SimilarCasesSection skeleton shimmer: guarded by
     `usePrefersReducedMotion()`
   - No card-level entrance animation introduced (section is
     embedded in existing card; card's entrance is Phase 05/06A
     prior art)

7. **Tests** — render with cases → shows up to 5 rows; render
   empty → shows appropriate empty state; render no embedder →
   shows config prompt with env var name; keyboard nav; aria
   attributes; reduced-motion skips shimmer; `setActiveCase`
   called with correct id on row activation; `excludeCaseIds`
   includes the active case so it never self-lists.

**Verification:**
- `npx tsc --noEmit` → 0
- `npm run test:run` (full suite — watch for Phase 06B Correlation
  Graph regressions since we're touching the same grid row) →
  green
- Manual: create a case, resolve it (triggers Slice 1 persistence
  + Slice 2 indexing); create a new case with similar summary;
  confirm the first appears in the Past cases section.
- Manual: import a `.noclense` pack, wait ~2 seconds, switch to
  another active case, confirm the imported case appears.
- Manual a11y: keyboard nav + reduced-motion matches Phase 06B
  Correlation Graph parity.

**Commit message:** `feat(phase-06c): SimilarCasesSection inside Similar card + noclense auto-indexing`

---

## Phase 06C close-out

### Verification checklist
- [ ] `npx tsc --noEmit` → 0
- [ ] `npm run test:run` → green (target: Phase 06B close + ~15
      Phase 06C additions)
- [ ] `npx eslint <touched files>` → clean
- [ ] Manual: full flow — create/work case A, close it (index),
      create case B, confirm A appears in SimilarCasesCard
- [ ] Manual a11y: keyboard + reduced-motion working on
      SimilarCasesCard
- [ ] Reduced-motion audit doc has Phase 06C rows
- [ ] Embedding version constant documented — future model swap
      path is clear

### Phase 06C close-out sign-off (Codex emits after Slice 3)

```
## Phase 06C close-out sign-off
GO | NO-GO. If NO-GO: exact blockers. If GO: confirm full test
suite green, case library round-trip works end-to-end
(save → index → retrieve → surface in card), embedding provider
decision documented, no regressions to Phase 06B.

## Phase 07 readiness hand-off
3-5 primitives / contracts the Tauri migration should verify
before touching persistence — specifically, confirm the
IndexedDB schema is stable and case library will survive the
Electron → Tauri transition without a data migration.
```

---

## Slice dispatch guide

| Slice | Primary agent | Parallel-safe with |
|---|---|---|
| 1 — CaseRepository | `data-engineer` | Slice 2 (no file overlap; Slice 2 depends on Slice 1's API but can be drafted in parallel) |
| 2 — CaseLibraryService | `ai-engineer` | Slice 1 (drafting only; real impl needs Slice 1 merged) |
| 3 — SimilarCasesCard | `react-specialist` + `accessibility-tester` secondary | Serial — depends on 1 + 2 |

**Recommended dispatch order:** sequential (1 → 2 → 3) for
simpler review. If time-critical, Slice 1 + 2 can dispatch in
parallel with Slice 2 stubbing against Slice 1's interface.

---

## Review disposition

**Round 1 (2026-04-22):** Codex returned NO-GO on 2 items + 2
YELLOWs. All fixes applied in v2 (see Revision log at top).

**Round 2:** NOT SCHEDULED. Per the lightweight review policy,
one amendment cycle after a NO-GO is the cap; if v2 still
doesn't hold up, escalate to user for scope decision rather
than iterating.

**Status:** v2 ready to dispatch. If the user wants a
verification-only probe on the v2 amendments (not a fresh full
probe), one is available — but defaulting is direct dispatch
of Slice 1.

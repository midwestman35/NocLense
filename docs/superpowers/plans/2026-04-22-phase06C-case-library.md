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

## Context

NocLense operators work on many investigations over time. Today,
each investigation stands alone — there's no way to pull in a past
case that had the same symptom or correlation pattern. The Case
Library closes that loop: when an operator is mid-investigation,
NocLense surfaces the top-K past cases most semantically similar to
the current one, letting the operator steal relevant prior art.

**Scope (v1, local-only):**
- Persist every investigation as a retrievable `Case` in IndexedDB
- Compute an embedding per case from `summary + impact + title`
- Retrieve top-K similar past cases by cosine similarity on demand
- Surface results in a new `SimilarCasesCard` in the Investigate
  Room (or replace the existing SimilarTicketsPanel — TBD per
  Slice 3 design)
- Import/export via existing `.noclense` format auto-adds to library

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

---

## Open decision to resolve during probe

**EMBEDDING_PROVIDER** — the existing `embeddingService.ts` calls
**Gemini** (`text-embedding-004`) directly via `@google/generative-ai`,
while `AGENTS.md` states "Unleash-only: do not route new AI
features through `src/services/providers/`." `embeddingService.ts`
itself is not in `providers/` — it's at the services root — but
the spirit of the rule is "canonical AI goes through
`unleashService`."

Three options:

1. **Keep Gemini for embeddings** — embedding service stays as-is;
   document that `VITE_GEMINI_EMBEDDING_KEY` is a separate credential
   from the Unleashed token. Cheapest path; embeddings work today.
2. **Move embeddings to Unleashed** — check whether Unleashed
   exposes an embedding endpoint. If yes, port
   `embeddingService.ts` to hit `unleashService.ts`. Cleanest but
   requires user to confirm Unleashed capability.
3. **Local embedding model (ONNX)** — bundle a quantized
   transformer (~25MB). Zero API dependency, works offline.
   Bigger lift, punt to v2.

**Default for this plan:** Option 1 (keep Gemini). Flip to Option
2 if the user confirms Unleashed embedding support before Slice 2
dispatches.

---

## Foundation assumptions (verify before first commit of each slice)

1. `src/types/case.ts` already defines a rich `Case` interface. No
   schema edits needed in Slice 1 beyond adding optional
   `embedding?: number[]` and `embeddingVersion?: string` fields
   for Slice 2.
2. `dbManager` in `src/utils/indexedDB.ts` exposes `updateLogEmbedding`
   — pattern for `updateCaseEmbedding` should mirror it. Verify
   the IndexedDB schema version-bump mechanism before adding a new
   object store.
3. `embeddingService.ts` already has `cosineSimilarity()` +
   `retrieveTopKByQuery()` methods. Slice 2 extends, does not
   rewrite.
4. `importService.ts` parses `.noclense` packages. Verify whether
   current imports produce a complete `Case` object or just logs
   + attachments.
5. `SimilarTicketsPanel.tsx` exists under `src/components/ai/diagnose/`.
   Verify whether it's a diagnose-phase-scoped component (likely)
   or a general-purpose card (unlikely). Slice 3 may rename or
   coexist.

---

## File map

### New files
```
src/services/caseRepository.ts                                      (Slice 1)
src/services/caseLibraryService.ts                                  (Slice 2)
src/components/workspace/SimilarCasesCard.tsx                       (Slice 3)
src/services/__tests__/caseRepository.test.ts                       (Slice 1)
src/services/__tests__/caseLibraryService.test.ts                   (Slice 2)
src/components/workspace/__tests__/SimilarCasesCard.test.tsx        (Slice 3)
```

### Modified files
```
src/types/case.ts                                                   (Slice 1 — add embedding fields)
src/utils/indexedDB.ts                                              (Slice 1 — add cases object store + updateCaseEmbedding)
src/services/embeddingService.ts                                    (Slice 2 — add buildCaseEmbeddingText helper)
src/services/importService.ts                                       (Slice 3 — auto-add imported cases to library)
src/components/workspace/NewWorkspaceLayout.tsx                     (Slice 3 — mount SimilarCasesCard)
src/contexts/CaseContext.tsx                                        (Slice 3 — expose current case for similarity queries)
docs/perf/reduced-motion-audit.md                                   (Slice 3 — new animated surfaces)
```

---

## Commit decomposition

Three slices, 3 commits total. Can run as a sequential pipeline or
Slice 1 + Slice 2 in parallel (independent files), then Slice 3
serially. Prefer sequential for simpler review.

### Slice 1 — Case storage + repository layer

**Primary agent:** `data-engineer`
**Rationale:** IndexedDB schema design, data-model migration, and
persistence layer are the core concerns — React integration lands
in Slice 3.

**Files:** `src/services/caseRepository.ts` (new),
`src/utils/indexedDB.ts` (extend), `src/types/case.ts` (extend),
tests.

**Commit 1 — CaseRepository over IndexedDB**

1. **Schema extension** — add optional `embedding?: number[]` and
   `embeddingVersion?: string` to the `Case` interface in
   `src/types/case.ts`. No breaking changes; existing cases
   without embeddings still load.

2. **IndexedDB object store** — add a `cases` object store in
   `dbManager` with key path `id`. Bump the DB version by 1 in
   the open-upgrade handler. Add indexes on `createdAt` and
   `updatedAt` for list ordering.

3. **CaseRepository service** — CRUD surface:
   ```ts
   export class CaseRepository {
     saveCase(case: Case): Promise<void>;         // upsert
     getCase(id: string): Promise<Case | null>;
     listCases(opts?: { limit?: number; orderBy?: 'createdAt' | 'updatedAt' }): Promise<Case[]>;
     deleteCase(id: string): Promise<void>;
     updateCaseEmbedding(id: string, embedding: number[], version: string): Promise<void>;
   }
   ```
   Mirror the log-embedding pattern already in `indexedDB.ts`.

4. **Tests** — CRUD roundtrip, ordering, embedding update,
   missing-case handling.

**Verification:**
- `npx tsc --noEmit` → 0
- `npm run test:run -- src/services/__tests__/caseRepository.test.ts` → green
- Manual: open DevTools → Application → IndexedDB, confirm the
  new `cases` store exists after save.

**Commit message:** `feat(phase-06c): CaseRepository over IndexedDB for Case Library persistence`

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

3. **Provider handling** — per EMBEDDING_PROVIDER decision (Option
   1 default: Gemini). If `embeddingService.initialize()` has not
   been called, `findSimilar` and `indexCase` return gracefully
   (empty array / no-op + warn) rather than throwing. This lets
   the UI render a "no embedding key configured" state rather
   than crashing.

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

### Slice 3 — UI integration (SimilarCasesCard)

**Primary agent:** `react-specialist`
**Secondary:** `accessibility-tester` for live-region + keyboard
parity with Phase 06B Commit 4 (maintain the a11y bar we just
raised for the graph).

**Files:** `src/components/workspace/SimilarCasesCard.tsx` (new),
`src/components/workspace/NewWorkspaceLayout.tsx` (mount),
`src/contexts/CaseContext.tsx` (expose current case),
`src/services/importService.ts` (auto-add on import),
`docs/perf/reduced-motion-audit.md` (append), tests.

**Commit 3 — SimilarCasesCard + import-side auto-indexing**

1. **SimilarCasesCard component** — new WorkspaceCard variant
   mounted in the Investigate Room grid. Reads the current case
   from `useCaseContext()`, calls
   `CaseLibraryService.findSimilar(currentCase, { topK: 5 })`,
   renders top-5 results with:
   - Title (primary text)
   - 1-line summary preview (truncated at ~120 chars)
   - Severity badge (color-coded)
   - Relative date ("3 days ago")
   - "Open" button — emits a `caseOpened` event for now
     (full wiring to case-replay is a future phase)

2. **Loading + empty states**
   - Loading: skeleton rows while `findSimilar` pending
   - Empty (zero results or empty library): text-only message
     "No similar cases yet — library fills as you close more
     investigations"
   - Error (embedder not initialized): "Configure embedding key
     in settings" with a Settings link

3. **Keyboard a11y (reuse Phase 06B pattern)**
   - Card is a single tab-stop; arrow keys traverse the 5 result
     rows
   - Enter/Space on a row activates the "Open" action
   - aria-live="polite" announces result set changes ("Showing
     5 similar cases")
   - aria-live="assertive" announces open action ("Opening case
     CASE-1234")
   - Respect `usePrefersReducedMotion()` — skeleton shimmer
     animation skips on reduced-motion

4. **CaseContext exposure** — verify `useCaseContext()` exposes
   `currentCase`. If not, add it (reading from wherever cases
   are loaded).

5. **Import-side auto-indexing** — in `importService.ts`, after
   a `.noclense` package loads:
   - Extract the case metadata
   - Call `CaseLibraryService.indexCase(case)` in the background
   - Don't block the import success path on embedding completion;
     fire-and-forget with error logging

6. **Reduced-motion audit append** — one new row in
   `docs/perf/reduced-motion-audit.md` §2.7:
   - SimilarCasesCard skeleton shimmer: guarded by
     `usePrefersReducedMotion()`
   - Card entrance animation (if any — may not exist): note
     guard or "no motion"

7. **Tests** — render with cases → shows 5 rows; render empty →
   shows empty state; render no embedder → shows config prompt;
   keyboard nav; aria attributes; reduced-motion skips shimmer.

**Verification:**
- `npx tsc --noEmit` → 0
- `npm run test:run` (full suite to catch regressions) → green
- Manual: import a `.noclense` package, wait ~2 seconds, open
  another case, confirm the imported case appears in SimilarCases.
- Manual a11y: keyboard nav + screen-reader announcements match
  Phase 06B Correlation Graph.

**Commit message:** `feat(phase-06c): SimilarCasesCard + import-side auto-indexing`

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

## Probe prompt (single round per lightweight policy)

```
You are doing an adversarial review of a NocLense phase plan.

Target: docs/superpowers/plans/2026-04-22-phase06C-case-library.md

This is the ONLY review round for this plan. Flag only real
issues; YELLOWs that would take another round to resolve should
be documented as known-limitations in the revision log rather
than blocking.

Probe adversarially:
1. EMBEDDING_PROVIDER decision: is "default to Gemini, flip on
   confirmation" the right call? Any third option I'm missing?
   Any hidden risk in shipping with two AI providers in the
   renderer (Unleashed for everything else, Gemini for
   embeddings)?
2. Slice 1 IndexedDB schema: does adding a new object store
   and bumping the DB version have a meaningful migration risk
   for existing user databases? Is there a way this breaks on
   v1→v2 upgrade that I haven't accounted for?
3. Slice 2 idempotency: `indexCase` skips when
   embeddingVersion matches CURRENT_VERSION — does this
   correctly handle the case where embedding was set but
   version was never written (old data pre-dating this phase)?
4. Slice 3 component mounting: adding SimilarCasesCard to
   NewWorkspaceLayout — will that overflow the Investigate
   Room CSS grid? (The grid already carries 6 WorkspaceCards;
   this makes 7.)
5. Similar-case discovery semantics: cosine similarity on
   summary+impact+title may be dominated by common phrasing
   (e.g. "ticket for customer X") and miss the real signal
   (which logs / correlations were involved). Is this
   acceptable for v1, or should v1 include correlation-type
   overlap in the scoring?
6. Any proof hole, regression, or over-claimed framing
   introduced by this plan?

Output per-probe status + findings, then Verdict: GO or NO-GO
with required-fix bullets (NO-GO) or remaining YELLOWs (GO).
Be concise. No preamble.
```

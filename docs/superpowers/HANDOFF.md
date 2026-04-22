# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (Phase 06B closed; Phase 06C plan drafted, awaiting single probe)
**Branch:** `april-redesign`
**Current HEAD:** `143169d` — `chore: folder cleanup — archive stale docs, fix broken refs, track historical plans`

> Single source of truth for resuming the current planning/review cycle in
> a fresh Claude session on any device. Read this first, then act on the
> "Immediate next step" section.

---

## Role framing

Three-agent team:

| Agent | Role | Scope |
|---|---|---|
| **Claude** (Claude Code) | CTO / Project Lead | Plans, reviews, steers architecture, approves merges |
| **Codex** (OpenAI Codex CLI) | Principal Engineer | Implements from approved plans, writes tests, commits code |
| **Gemini** (Google Gemini CLI) | Support Staff / Doc Engineer | Maintains README, USAGE_GUIDE, DEVELOPER_HANDOFF, folder hygiene |

Claude plans → Codex implements → Claude reviews → Gemini updates docs.

**Review policy (as of 2026-04-22, lightweight):**
- One adversarial probe per plan (not iterative rounds).
- Per-slice self-assessment at end of slice (not per-commit).
- Deep review at phase close-out, not mid-phase.
- YELLOWs logged as known-limitations; only NO-GO blocks.
- Security-critical slices retain the rigorous cadence (exception).

**Never:**
- Use the `codex:rescue` skill or any `/codex:*` dispatch slash-skill.
- Implement source code yourself. Claude plans + reviews; Codex implements.
- Dispatch Codex without naming a primary agent per the slice-archetype
  convention (see `docs/superpowers/feedback_codex_agent_assignments.md`).

---

## Completed phases

| Phase | What shipped | Close commit |
|---|---|---|
| 04.5 | Direction C token base, Button + WorkspaceCard curves | `d0e45c9` |
| 05 | §4.2 transition-all sweep, citation-jump, reduced-motion audit | `cefc12e` |
| 06A | Spinner primitive, anime.js guards, MotionConfig wiring, Direction C transitions, room parity, audit consolidation | `78a1e22` |
| 06B | Correlation Graph card — G6 renderer, click-to-filter, keyboard a11y, large-graph performance (WebGL threshold, clustering, zoom controls) | `1783df1` |

Phase 06A survived 7 adversarial review rounds (v1→v8 GO). Phase 06B
shipped under the new lightweight-review policy in 5 commits + 1
folder-cleanup commit.

---

## Current state — Phase 06C (Case Library)

**Status:** Plan drafted. Awaiting single adversarial probe per new
lightweight review policy.

**Plan file:** `docs/superpowers/plans/2026-04-22-phase06C-case-library.md`

**Scope (v1, local-only):**
- Persist investigations as retrievable `Case` records in IndexedDB
- Compute embedding per case from `summary + impact + title`
- Retrieve top-K similar past cases by cosine similarity
- Surface in new `SimilarCasesCard` in Investigate Room
- Auto-index on `.noclense` import

**Structure (3 slices):**

| Slice | Scope | Primary agent |
|---|---|---|
| 1 | CaseRepository over IndexedDB (new object store, schema migration, CRUD) | `data-engineer` |
| 2 | CaseLibraryService (embedding indexing + cosine similarity retrieval with filters) | `ai-engineer` |
| 3 | SimilarCasesCard UI + import-side auto-indexing + a11y | `react-specialist` (+ `accessibility-tester` secondary) |

**Key open decision (to resolve during probe):** embedding provider.
Existing `embeddingService.ts` uses Gemini (`text-embedding-004`);
Unleashed-only policy creates tension. Default: keep Gemini. Flip
to Unleashed if user confirms Unleashed has an embedding endpoint.

---

## Immediate next step — run the Phase 06C probe

Paste the following into Codex CLI. Single round per new policy — if
the verdict is NO-GO, we do ONE amendment cycle; if still NO-GO,
escalate to the user for a scope decision rather than iterating.

```
You are doing an adversarial review of a NocLense phase plan.

Target: docs/superpowers/plans/2026-04-22-phase06C-case-library.md

This is the ONLY review round for this plan. Flag only real issues;
YELLOWs that would take another round to resolve should be documented
as known-limitations in the revision log rather than blocking.

Probe adversarially:
1. EMBEDDING_PROVIDER decision: is "default to Gemini, flip on
   confirmation" the right call? Any third option I'm missing?
   Any hidden risk in shipping with two AI providers in the renderer
   (Unleashed for everything else, Gemini for embeddings)?
2. Slice 1 IndexedDB schema: does adding a new object store and
   bumping the DB version have a meaningful migration risk for
   existing user databases? Is there a way this breaks on v1→v2
   upgrade that I haven't accounted for?
3. Slice 2 idempotency: `indexCase` skips when embeddingVersion
   matches CURRENT_VERSION — does this correctly handle the case
   where embedding was set but version was never written (old data
   pre-dating this phase)?
4. Slice 3 component mounting: adding SimilarCasesCard to
   NewWorkspaceLayout — will that overflow the Investigate Room CSS
   grid? (The grid already carries 6 WorkspaceCards; this makes 7.)
5. Similar-case discovery semantics: cosine similarity on
   summary+impact+title may be dominated by common phrasing (e.g.
   "ticket for customer X") and miss the real signal (which logs /
   correlations were involved). Is this acceptable for v1, or
   should v1 include correlation-type overlap in the scoring?
6. Any proof hole, regression, or over-claimed framing introduced by
   this plan?

Output per-probe status + findings, then Verdict: GO or NO-GO with
required-fix bullets (NO-GO) or remaining YELLOWs (GO). Be concise.
No preamble.
```

---

## Decision tree after probe returns

### If GO

Draft the Slice 1 dispatch prompt (primary agent: `data-engineer`)
following the convention in
`docs/superpowers/feedback_codex_agent_assignments.md`. Dispatch to
Codex, wait for Slice 1 self-assessment, greenlight, then Slice 2,
then Slice 3.

### If NO-GO

1. Address required fixes in the plan file directly.
2. Bump revision log with v1 → v2 resolution table.
3. Re-dispatch the probe ONCE more with v2 context.
4. If v2 still NO-GO → escalate to user for a scope decision
   (drop the contentious concern, accept the YELLOW, or ship as-is).
   Do NOT iterate to v3.

---

## After Phase 06C — Phase 07 (Tauri migration)

**Timing:** Planning starts next week per user direction (2026-04-22).

Until then, Phase 06C is the only in-flight work.

---

## Gemini documentation status

- `README.md`, `docs/USAGE_GUIDE.md`, `docs/DEVELOPER_HANDOFF.md`
  last rewritten by Gemini at `191069a` (round 2, 2026-04-22).
- Folder cleanup manifest executed at `143169d` (same day).
- Next Gemini engagement: end of Phase 06C or Phase 07 close-out
  for doc refresh.

---

## Pre-existing tech debt (not ours)

- `tsc` red on `src/contexts/logContextObject.ts` +
  `src/services/investigationExporter.ts` (pre-existing; not touched
  by Phase 06B).
- `vitest` red on `src/contexts/__tests__/EvidenceContext.test.tsx`
  and `.worktrees/ui-overhaul*/llmService.test.ts` (pre-existing).
- `act()` warnings in `src/components/__tests__/AIButton.test.tsx`
  (cosmetic).

## Phase 06B technical-debt backlog (surfaced at close-out)

- `src/components/correlation-graph/CorrelationGraph.tsx` at 601
  lines (+20% over 500-line cap); recommended split before Phase
  06C/07 extends the graph.
- `src/components/correlation-graph/graphPresentation.tsx` at 517
  lines; minor overage.
- Manual NVDA / VoiceOver smoke on Electron runtime — out-of-band
  a11y verification still pending.

---

## Posture

Tight, diagnostic, no fluff. Assume continuity — don't restart from
zero. Trust the lightweight review policy: one probe, per-slice
self-assessment, deep review at close-out.

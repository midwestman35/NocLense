# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (Phase 06B closed; Phase 06C plan v2 ready to dispatch)
**Branch:** `april-redesign`
**Current HEAD:** `ffe71b4` — `docs(phase-06c): v2 amendments — fix seams, add lifecycle persistence, freeze embedding provider`

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

## Current state — Phase 06C (Case Library) — v2, ready to dispatch

**Status:** Plan drafted + amended after round-1 Codex probe.
Ready to dispatch Slice 1.

**Plan file:** `docs/superpowers/plans/2026-04-22-phase06C-case-library.md`

**Scope (v1, local-only):**
- Persist investigations as retrievable `Case` records in IndexedDB,
  wired through the `caseContext` reducer so every created/updated/
  resolved case persists (not only imported `.noclense` packs)
- Compute embedding per case from `title + summary + impact` via
  Gemini `text-embedding-004` (frozen for v1)
- Retrieve top-K similar past cases by cosine similarity
- Surface in the existing Investigate Room "Similar" card (expanded
  with a "Past cases" section; NO new grid slot)
- Auto-index on `.noclense` import via `noclenseImporter.ts`

**Structure (3 slices):**

| Slice | Scope | Primary agent |
|---|---|---|
| 1 | CaseRepository + IndexedDB object store + blocked/init-retry resilience + reducer wiring in `caseContext.tsx` for lifecycle persistence | `data-engineer` |
| 2 | CaseLibraryService (embedding indexing + cosine similarity retrieval with filters); Gemini-only provider | `ai-engineer` |
| 3 | SimilarCasesSection inside existing Similar card + noclense auto-indexing + a11y | `react-specialist` (+ `accessibility-tester` secondary) |

**Round-1 probe fixes applied (v1 → v2):**
- Slice 3 grid overflow resolved by extending existing card, not adding a 7th slot
- Integration seams corrected: `useCase()` / `src/store/caseContext.tsx` / `noclenseImporter.ts` (not `useCaseContext` / `CaseContext.tsx` / `importService.ts`)
- Normal-case lifecycle persistence added to Slice 1 scope (plan previously only covered import-side)
- Embedding provider frozen as Gemini-only for v1; Unleashed migration explicitly out of scope
- Framing tightened to "semantically similar summary/impact text" (no longer overpromising correlation-pattern matching)
- IndexedDB blocked-upgrade + init-retry resilience folded into Slice 1

---

## Immediate next step — dispatch Slice 1 to Codex

Plan v2 is amended and ready. Claude drafts the Slice 1 dispatch
prompt (primary agent `data-engineer`) following the agent-
assignment convention; user runs in Codex CLI; returns the
self-assessment when done.

If the user prefers an optional verification-only probe on the v2
amendments before dispatch, request one explicitly — otherwise
direct dispatch is the default.

**Dispatch order:** Slice 1 → Slice 2 → Slice 3, serial. Slices 1+2
could run parallel with Slice 2 stubbing against Slice 1's types,
but serial is simpler and keeps reviews focused.

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

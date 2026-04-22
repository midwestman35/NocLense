# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (v7 plan drafted, awaiting Codex round 7 review)
**Branch:** `april-redesign`
**Current HEAD:** `b0d0ef2` — `docs(phase-06a): draft v7 plan`

> Single source of truth for resuming the current planning/review cycle in
> a fresh Claude session on any device. Read this first, then act on the
> "Immediate next step" section.
>
> Scope: this file covers the active superpowers phase only. For general
> project onboarding see the root `HANDOFF.md`.

---

## Role framing

You are steering Phase 06A. The user runs Codex in a separate CLI session
and pastes responses back. Your job is to draft prompts, review Codex
output, and iterate the plan — **not** to implement the Phase 06A work
yourself.

**Never:**
- Use the `codex:rescue` skill or any `/codex:*` dispatch slash-skill. The
  user's environment does not have dispatch enabled.
- Chain multiple Codex commits in a single session without explicit GO
  signals between them.
- Implement Phase 06A source code. Claude plans + reviews; Codex implements.

---

## Current state

- **Branch:** `april-redesign` (pushed to `origin/april-redesign`).
- **HEAD:** `084b165` — draft v5 plan.
- **Plan file:** `docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md`
- **Spec amendment:** `debd305` on `main` — allocates Phase 06A to this
  plan, 06B to Correlation Graph, 06C to case library, 07 to Tauri.
- **Main:** unchanged at `debd305`. `april-redesign` forks from there, so
  the branch carries the spec amendment + all Phase 05 commits.

---

## Plan status — 6 Codex review rounds survived

The plan iterated v1 → v7 through six adversarial reviews. Current status:
**v7 drafted, awaiting Codex round 7 verdict.** The full revision-log table
inside the plan file is authoritative; what follows is the short version.

| Round | Blockers | Key v-next fix |
|---|---|---|
| v1 → v2 | Slice 5 C7 premise wrong; audit-doc parallel conflict; brittle C4 matchMedia; C8 deferred | Slice 6 audit consolidation; matchMedia stub pattern |
| v2 → v3 | C4 couldn't prove wiring; stale paths; coarse Spinner scale | App-level `vi.mock('motion/react')` spy; explicit 17-site Spinner migration table |
| v3 → v4 | C9 greps too narrow; Spinner rounding too permissive; C4 miss on nested wrapper; miscount | 5 off-scale sites → numeric `size={N}`; grep-enforced numeric rule; `toHaveBeenCalledTimes(1)` |
| v4 → v5 | `toHaveBeenCalledTimes(1)` brittle to rerenders; numeric rule still policy-only; single-line MotionConfig grep; framing over-claimed | DOM-marker pass-through; grep enforces numeric rule; format-tolerant MotionConfig check; "source-state only" framing |
| v5 → v6 | Numeric Spinner grep: brittle count + missed non-literal expressions + test files in scope; `test -f` bash-only | Zero-violations grep with pathspec exclusions; `git ls-files --error-unmatch` |
| v6 → v7 | Approved-sites spot-check too weak (`-lE` file-list); prose over-claimed "numeric variable" coverage; `.test.ts` uncovered | Per-file `git grep -cE` counts (3/1/1/1); prose narrowed to "digit-bearing expressions"; `.test.ts` pathspec added |

---

## Structure

**9 commits across 6 slices:**

- Slice 1 (2 commits): Spinner primitive + spinner sweep.
- Slice 2 (1 commit): anime.js reduced-motion hook guard.
- Slice 3 (1 commit): `<MotionConfig reducedMotion="user">` at App root.
- Slice 4 (2 commits): Direction C curves on Dialog / DropdownMenu / Sheet / Tooltip.
- Slice 5 (2 commits): Import Room + `--room-transition-ease` alias.
- Slice 6 (1 commit): audit doc consolidation — serial, runs last.

**Dispatch:**

- **Wave 1:** Slices 1–5 all parallel-safe. User can open 5 concurrent Codex
  CLI tasks.
- **Wave 2:** Slice 6 serial — runs after every Wave 1 slice merges so its
  state-based pre-condition greps reflect ground truth.

---

## Immediate next step — run Codex round 7

Paste the following into the user's Codex CLI and ask them to return the
verbatim response:

```
You are doing an adversarial review of a NocLense phase plan.

Target: docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md

Context: this is v7. v6 NO-GO raised 2 items:
(α) Approved-sites spot-check used git grep -lE (file-list mode) —
    reports each file once regardless of match count.
    InvestigationSetupModal.tsx could drop from 3 to 1 numeric
    Spinner site and still pass.
(β) Prose claimed pattern catches "numeric variable names" but
    regex [^}]*[0-9] requires a literal digit in source text.
    Also .test.ts (non-JSX) was uncovered by pathspec exclusions.

v7 changes:
- α: Spot-check switched to `git grep -cE` (count mode) with per-file
  expected counts: InvestigationSetupModal.tsx=3, DiagnosePhase2.tsx=1,
  DiagnosePhase3.tsx=1, AIButton.tsx=1. A count mismatch (too low =
  over-sweep; too high = new unapproved site in excluded file) forces
  a conscious plan update.
- β: Prose narrowed from "numeric variable names" to "digit-bearing
  expressions" with explicit caveat that pure-variable references
  (size={spinnerSize}) are not catchable by grep — deferred to
  Spinner tests and code review. Added `:!src/**/*.test.ts` to
  pathspec exclusions alongside existing .test.tsx.

Probe adversarially:
1. Per-file counts: if a legitimate refactor adds a 4th numeric
   Spinner to InvestigationSetupModal.tsx, the count check breaks
   (expected 3, got 4). The zero-violations grep ALSO excludes that
   file, so it won't flag the new site either. Is the only recovery
   path a plan update + count bump? Is that acceptable or too rigid?
2. Pure-variable gap: the plan now acknowledges size={spinnerSize}
   falls through grep. Is there any realistic scenario in Phase 06A
   where a developer introduces a pure-variable numeric Spinner that
   bypasses both the grep AND the Spinner test suite?
3. Pathspec completeness: the plan now excludes __tests__/, *.test.tsx,
   *.test.ts. Does the codebase use *.spec.tsx or *.spec.ts anywhere?
   If so, those patterns need adding.
4. Any new regression introduced by the v7 changes?

Output per-probe status + findings, then Verdict: GO or NO-GO with
required-fix bullets (NO-GO) or remaining YELLOWs (GO). Be concise.
No preamble.
```

---

## Decision tree after Codex round 5

### If Codex returns GO

Draft per-slice dispatch prompts for Wave 1. Each slice prompt should:

- Point Codex to the plan path + slice number.
- Reference `CLAUDE.md` project + `src/CLAUDE.md` module context as mandatory
  pre-reads.
- Require per-commit self-assessment block (format in `feedback_codex_review_cycle.md`)
  with a hard stop between commits within the slice.
- State that the user will pass Claude's overview back to Codex before the
  next commit in that slice.

Dispatch order:
1. **Wave 1:** Slices 1, 2, 3, 4, 5 in parallel (user runs 5 concurrent
   Codex CLI sessions).
2. **Wave 2 (after all Wave 1 slices merge):** Slice 6.

### If Codex returns NO-GO

1. Address each required fix in the plan file directly.
2. Bump revision log to v6 with a `v5 → v6` resolution table.
3. Draft the round 6 probe prompt (same shape as round 5 above, but with
   v5→v6 context).
4. Update this `HANDOFF.md`:
   - Bump "Last updated" + HEAD sha.
   - Update the revision-round table.
   - Swap the inline round-5 prompt for the round-6 prompt.
5. Commit and push both changes together.

---

## Workflow rules (project memory)

Memory files live in:
```
~/.claude/projects/C--Users-envelazquez-Documents-NocLense-Primary/memory/
```

Critical memories to load before acting:

- `MEMORY.md` — index.
- `feedback_codex_review_cycle.md` — role split (Claude designs, Codex
  executes); per-commit self-assessment format; phase close-out GO/NO-GO
  template.
- `feedback_codex_workflow.md` — Codex runs in a separate CLI session only;
  never use `codex:rescue`.

---

## Environment caveat — if you run `/codex:review` locally

The working tree contains an orphaned git worktree at `.tmp-phase045-review/`
(its `.git` gitlink file makes `git ls-files` return the directory path,
which crashes Codex companion's scanner with `EISDIR`). The `/codex:*`
slash-skills will fail until this is resolved. Three options:

1. Add `/.tmp-phase045-review/` to `.gitignore` (least invasive).
2. `git worktree remove .tmp-phase045-review` if the Phase 04.5 review is
   truly done.
3. Temporarily rename the directory.

None of these are required for the current workflow (the user runs Codex
CLI directly, not via the plugin), but flag this if the user asks about
in-session review commands.

---

## Posture

Tight, diagnostic, no fluff. Single-sentence status updates at key moments.
End-of-turn: 1–2 sentences summarizing what changed + what's next. Match
the tone the user has been running for four review rounds — iterative,
rigorous, concrete. Don't restart from zero; assume continuity.

When unsure about scope, ask before acting — this project has a working
convention that Claude proposes, user confirms, Codex executes.

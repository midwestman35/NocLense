# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (v6 plan drafted, awaiting Codex round 6 review)
**Branch:** `april-redesign`
**Current HEAD:** `781553e` — `docs(phase-06a): draft v6 plan`

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

## Plan status — 5 Codex review rounds survived

The plan iterated v1 → v6 through five adversarial reviews. Current status:
**v6 drafted, awaiting Codex round 6 verdict.** The full revision-log table
inside the plan file is authoritative; what follows is the short version.

| Round | Blockers | Key v-next fix |
|---|---|---|
| v1 → v2 | Slice 5 C7 premise wrong; audit-doc parallel conflict; brittle C4 matchMedia; C8 deferred | Slice 6 audit consolidation; matchMedia stub pattern |
| v2 → v3 | C4 couldn't prove wiring; stale paths; coarse Spinner scale | App-level `vi.mock('motion/react')` spy; explicit 17-site Spinner migration table |
| v3 → v4 | C9 greps too narrow; Spinner rounding too permissive; C4 miss on nested wrapper; miscount | 5 off-scale sites → numeric `size={N}`; grep-enforced numeric rule; `toHaveBeenCalledTimes(1)` |
| v4 → v5 | `toHaveBeenCalledTimes(1)` brittle to rerenders; numeric rule still policy-only; single-line MotionConfig grep; framing over-claimed | DOM-marker pass-through; grep enforces numeric rule; format-tolerant MotionConfig check; "source-state only" framing |
| v5 → v6 | Numeric Spinner grep: brittle count + missed non-literal expressions + test files in scope; `test -f` bash-only | Zero-violations grep with pathspec exclusions; `git ls-files --error-unmatch` |

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

## Immediate next step — run Codex round 6

Paste the following into the user's Codex CLI and ask them to return the
verbatim response:

```
You are doing an adversarial review of a NocLense phase plan.

Target: docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md

Context: this is v6. v5 NO-GO raised 2 items:
(α) C9 numeric Spinner grep didn't catch digit-bearing expressions
    outside bare literals (e.g. size={loading ? 14 : 16} elsewhere);
    also scanned test files, making the "exactly 5" count fragile.
(β) C9 Slice 3 existence check used `test -f` — bash-only, fails in
    the PowerShell workspace.

v6 changes:
- α: Strategy flipped to zero-violations. Pattern widened to
  `<Spinner[^>]*size=\{[^}]*[0-9]` (any digit in size={...}).
  Approved source files + test files/dirs excluded via pathspec magic
  (:! prefix). Expect 0 matches outside approved sites. Separate
  approved-sites spot-check: `git grep -lE` on 4 files, expect all 4
  listed.
- β: `test -f` replaced with `git ls-files --error-unmatch`. Git
  handles path resolution cross-platform; also proves the file is
  tracked, not just present on disk.
- Probe 3 YELLOW (v5): §2.7 audit attribution for Dialog/DropdownMenu/
  Sheet/Tooltip corrected from "covered by MotionConfig" to "covered
  by Slice 4 greps/tests".
- Probe 1 GREEN note (v5): C4 rationale softened to acknowledge the
  test does not distinguish App-level wrapper from a lone child-level
  one.

Probe adversarially:
1. Pathspec exclusions: does `:!src/**/__tests__/**` exclude files
   inside nested `__tests__/` dirs (e.g.
   `src/components/__tests__/Spinner.test.tsx`)? Does
   `:!src/**/*.test.tsx` also cover co-located tests like
   `src/components/Spinner.test.tsx`? Any cross-platform concern when
   git is invoked from PowerShell — does `**` in pathspec magic work
   without shell glob expansion?
2. Approved-sites spot-check: `git grep -lE` reports a file once
   regardless of match count. InvestigationSetupModal.tsx should have
   3 numeric Spinner sites — does `-lE` catch the case where 2 of the
   3 are accidentally removed but 1 remains?
3. `git ls-files --error-unmatch`: any scenario where the command
   exits non-zero even though the file is present and correct — e.g.,
   untracked new file not yet staged, or a .gitignore match?
4. Any new regression introduced by the v6 changes?

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

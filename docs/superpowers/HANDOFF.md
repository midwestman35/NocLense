# Superpowers Handoff — Current In-Flight Work

**Last updated:** 2026-04-22 (v8 GO — Wave 1 dispatch prompts ready)
**Branch:** `april-redesign`
**Current HEAD:** `51084fa` — `docs(phase-06a): v8 GO + Wave 1 dispatch prompts`

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

## Plan status — v8 GO after 7 adversarial review rounds

The plan iterated v1 → v8 through seven adversarial reviews. **v8 passed
with GO verdict.** Two YELLOWs accepted: (1) historical revision-log rows
retain old wording (clearly marked superseded), (2) pure-variable and
multiline Spinner gaps remain convention/review-guarded (explicitly
acknowledged in plan). The full revision-log table inside the plan file is
authoritative; what follows is the short version.

| Round | Blockers | Key v-next fix |
|---|---|---|
| v1 → v2 | Slice 5 C7 premise wrong; audit-doc parallel conflict; brittle C4 matchMedia; C8 deferred | Slice 6 audit consolidation; matchMedia stub pattern |
| v2 → v3 | C4 couldn't prove wiring; stale paths; coarse Spinner scale | App-level `vi.mock('motion/react')` spy; explicit 17-site Spinner migration table |
| v3 → v4 | C9 greps too narrow; Spinner rounding too permissive; C4 miss on nested wrapper; miscount | 5 off-scale sites → numeric `size={N}`; grep-enforced numeric rule; `toHaveBeenCalledTimes(1)` |
| v4 → v5 | `toHaveBeenCalledTimes(1)` brittle to rerenders; numeric rule still policy-only; single-line MotionConfig grep; framing over-claimed | DOM-marker pass-through; grep enforces numeric rule; format-tolerant MotionConfig check; "source-state only" framing |
| v5 → v6 | Numeric Spinner grep: brittle count + missed non-literal expressions + test files in scope; `test -f` bash-only | Zero-violations grep with pathspec exclusions; `git ls-files --error-unmatch` |
| v6 → v7 | Approved-sites spot-check too weak (`-lE` file-list); prose over-claimed "numeric variable" coverage; `.test.ts` uncovered | Per-file `git grep -cE` counts (3/1/1/1); prose narrowed to "digit-bearing expressions"; `.test.ts` pathspec added |
| v7 → v8 | Slice 1 numeric-rule prose still said "exactly 5 + 1" — contradicted v7 zero-violations + per-file-count scheme | Updated Slice 1 prose to single source of truth matching v7 enforcement model |

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

## Immediate next step — dispatch Wave 1 (Slices 1–5 in parallel)

v8 passed adversarial review with GO. Open 5 concurrent Codex CLI
sessions — one per slice prompt below. Each slice is self-contained
and parallel-safe.

**After each commit within a slice:** Codex emits a self-assessment,
then STOPS. The user pastes Codex's output back here for Claude to
review before authorizing the next commit in that slice.

**After all 5 Wave 1 slices merge:** dispatch Slice 6 (Wave 2, serial).

---

### Slice 1 prompt (2 commits: C1 Spinner primitive, C2 Tailwind sweep)

```
You are implementing Slice 1 of Phase 06A for NocLense.

MANDATORY PRE-READS (read these files before writing any code):
1. CLAUDE.md (project root)
2. src/CLAUDE.md (module context)
3. docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md
   — read Slice 1 (Commits 1–2, starting at "### Slice 1")
4. docs/perf/reduced-motion-audit.md §2.3 (context for the ⚠️ rows
   this slice retires — but do NOT edit the audit doc; Slice 6 does that)

SCOPE: Slice 1 only. Two commits:

Commit 1 — Extract <Spinner /> primitive + migrate inline-style spinners.
- Create src/components/ui/Spinner.tsx with named scale + numeric fallback
- Add motion-safe:animate-spin + motion-reduce:animate-none guards
- Add role="status" + sr-only label for accessibility
- Migrate all inline-style `animation: 'spin ...'` sites to <Spinner />
- Write src/components/ui/__tests__/Spinner.test.tsx

Commit 2 — Migrate Tailwind animate-spin sites to <Spinner />.
- Sweep all 17 sites per the migration table in the plan
- Respect the numeric size rule: only the 6 approved sites use raw numbers
- All other sites use named scale (xs/sm/md/lg/xl)

WORKFLOW:
- Implement Commit 1, then emit a self-assessment block and STOP.
- Wait for the user to relay Claude's review before starting Commit 2.

SELF-ASSESSMENT FORMAT (emit after each commit):
## Self-Assessment — Slice 1, Commit [N]
- **Files changed:** [list]
- **Tests:** [pass/fail + command used]
- **Numeric size rule:** [confirm approved sites only use raw numbers]
- **Confidence:** [high/medium/low]
- **Risks or open questions:** [list or "none"]
```

### Slice 2 prompt (1 commit: C3 anime.js hook guard)

```
You are implementing Slice 2 of Phase 06A for NocLense.

MANDATORY PRE-READS (read these files before writing any code):
1. CLAUDE.md (project root)
2. src/CLAUDE.md (module context)
3. docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md
   — read Slice 2 (Commit 3, starting at "### Slice 2")
4. docs/perf/reduced-motion-audit.md §2.2 (context for the ⚠️ rows
   this slice retires — but do NOT edit the audit doc; Slice 6 does that)

SCOPE: Slice 2 only. One commit:

Commit 3 — Reduced-motion guard in src/utils/anime.ts.
- Add usePrefersReducedMotion hook (or import existing)
- Guard useAnimeStagger, useAnimeTimeline, useAnimeValue with
  reduced-motion check — snap to final state when reduced-motion is on
- Write/extend src/utils/__tests__/anime.test.ts

WORKFLOW:
- Implement Commit 3, then emit a self-assessment block and STOP.

SELF-ASSESSMENT FORMAT (emit after the commit):
## Self-Assessment — Slice 2, Commit 3
- **Files changed:** [list]
- **Tests:** [pass/fail + command used]
- **Guard pattern:** [describe how each hook snaps to final state]
- **Confidence:** [high/medium/low]
- **Risks or open questions:** [list or "none"]
```

### Slice 3 prompt (1 commit: C4 MotionConfig wiring)

```
You are implementing Slice 3 of Phase 06A for NocLense.

MANDATORY PRE-READS (read these files before writing any code):
1. CLAUDE.md (project root)
2. src/CLAUDE.md (module context)
3. docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md
   — read Slice 3 (Commit 4, starting at "### Slice 3"), paying close
   attention to the DOM-marker pass-through test pattern
4. docs/perf/reduced-motion-audit.md §2.5 (context only — do NOT edit)

SCOPE: Slice 3 only. One commit:

Commit 4 — <MotionConfig reducedMotion="user"> at App root + wiring test.
- Wrap the App tree with <MotionConfig reducedMotion="user"> from
  motion/react
- Write src/__tests__/App.motionConfig.test.tsx using the DOM-marker
  pass-through pattern described in the plan:
  - vi.mock('motion/react') to render a <div data-testid="motion-config"
    data-reduced-motion={prop}>{children}</div>
  - Assert: getAllByTestId length === 1, toHaveAttribute correct value,
    toHaveBeenCalled, mock.calls.every(prop === 'user')
- Do NOT add per-primitive reduced-motion tests — this slice is
  App-level wiring only

WORKFLOW:
- Implement Commit 4, then emit a self-assessment block and STOP.

SELF-ASSESSMENT FORMAT (emit after the commit):
## Self-Assessment — Slice 3, Commit 4
- **Files changed:** [list]
- **Tests:** [pass/fail + command used]
- **DOM marker assertions:** [confirm all 4 assertions pass]
- **Confidence:** [high/medium/low]
- **Risks or open questions:** [list or "none"]
```

### Slice 4 prompt (2 commits: C5 toast curve, C6 primitive transitions)

```
You are implementing Slice 4 of Phase 06A for NocLense.

MANDATORY PRE-READS (read these files before writing any code):
1. CLAUDE.md (project root)
2. src/CLAUDE.md (module context)
3. docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md
   — read Slice 4 (Commits 5–6, starting at "### Slice 4")
4. docs/perf/reduced-motion-audit.md §2.7 (context only — do NOT edit)

SCOPE: Slice 4 only. Two commits:

Commit 5 — Toast entrance uses --ease-emphasized.
- Update the toast entrance animation in index.css to use the
  --ease-emphasized CSS custom property instead of a hardcoded
  cubic-bezier
- Add a global reduced-motion media query that disables the toast
  entrance animation

Commit 6 — Direction C transition props on Dialog, DropdownMenu,
Sheet, Tooltip.
- Export a named transition const per primitive (e.g. DIALOG_TRANSITION)
- Apply Direction C curves: emphasized for Dialog + Sheet, spring for
  DropdownMenu + Tooltip
- Write per-primitive tests that import the transition const and verify
  curve values
- Do NOT test reduced-motion behavior here — that's covered by Slice 3

WORKFLOW:
- Implement Commit 5, then emit a self-assessment block and STOP.
- Wait for the user to relay Claude's review before starting Commit 6.

SELF-ASSESSMENT FORMAT (emit after each commit):
## Self-Assessment — Slice 4, Commit [N]
- **Files changed:** [list]
- **Tests:** [pass/fail + command used]
- **Transition consts exported:** [list names, commit 6 only]
- **Confidence:** [high/medium/low]
- **Risks or open questions:** [list or "none"]
```

### Slice 5 prompt (2 commits: C7 Import Room, C8 room-transition-ease)

```
You are implementing Slice 5 of Phase 06A for NocLense.

MANDATORY PRE-READS (read these files before writing any code):
1. CLAUDE.md (project root)
2. src/CLAUDE.md (module context)
3. docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md
   — read Slice 5 (Commits 7–8, starting at "### Slice 5")
4. docs/perf/reduced-motion-audit.md §2.6 (context only — do NOT edit)

SCOPE: Slice 5 only. Two commits:

Commit 7 — Import Room Direction C application + Submit Room verification.
- Apply Direction C hover-lift classes to WorkspaceImportPanel
- Write/extend WorkspaceImportPanel test verifying hover classes
- Write SubmitRoom test verifying its WorkspaceCard instances inherit
  Direction C hover-lift (Submit Room source unchanged — it already
  uses WorkspaceCard)

Commit 8 — --room-transition-ease aliased to var(--ease-spring).
- Add --room-transition-ease: var(--ease-spring) in tokens.css
- Replace the duplicated cubic-bezier tuple in room transition CSS
  with the new alias

WORKFLOW:
- Implement Commit 7, then emit a self-assessment block and STOP.
- Wait for the user to relay Claude's review before starting Commit 8.

SELF-ASSESSMENT FORMAT (emit after each commit):
## Self-Assessment — Slice 5, Commit [N]
- **Files changed:** [list]
- **Tests:** [pass/fail + command used]
- **Confidence:** [high/medium/low]
- **Risks or open questions:** [list or "none"]
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

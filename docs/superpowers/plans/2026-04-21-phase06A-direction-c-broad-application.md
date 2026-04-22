# Phase 06A — Direction C Broad Application + Reduced-Motion Cleanup

> **For agentic workers:** Read spec §3.3, §4.2, §4.8, §6.5 and
> `docs/perf/reduced-motion-audit.md` §2.1–§2.4, §4 before starting.
> Each slice is dispatchable as a self-contained Codex task. Within a
> slice, implement commit-by-commit; after each commit emit the
> self-assessment block and wait for Claude's overview.

---

## Revision log

**v1 → v2 (initial Codex adversarial review):** NO-GO on 5 items.
**v2 → v3 (second Codex adversarial review):** NO-GO on 3 items +
YELLOW Spinner mapping.
**v3 → v4 (third Codex adversarial review):** NO-GO on 4 items.
**v4 → v5 (fourth Codex adversarial review):** NO-GO on 4 items.
**v5 → v6 (fifth Codex adversarial review):** NO-GO on 2 items.
**v6 → v7 (sixth Codex adversarial review):** NO-GO on 1 RED + 1
YELLOW (both with required fixes).
**v7 → v8 (seventh Codex adversarial review):** NO-GO on 1 RED (stale
prose). v8 table is authoritative for current state;
v7/v6/v5/v4/v3/v2 are historical.

**v8 resolutions (2026-04-22, current):**

| # | v7 blocker | v8 resolution |
|---|---|---|
| α | Slice 1 numeric-size-rule prose (line ~370) still said "enforces exactly 5 literal-number matches + 1 ternary match" — contradicts the v7 zero-violations + per-file-count scheme. Two active contracts in the same plan. | Updated the Slice 1 prose to reference the v7 enforcement model: (1) zero-violations grep excluding approved files + tests, (2) per-file `git grep -cE` cardinality checks (3/1/1/1). Single source of truth. |

**v7 resolutions (2026-04-22, historical — superseded by v8 table above):**

| # | v6 blocker | v7 resolution |
|---|---|---|
| α | C9 approved-sites spot-check used `git grep -lE` (file-list mode), which reports each file once regardless of match count. InvestigationSetupModal.tsx could drop from 3 numeric Spinner sites to 1 and still pass. | Switched to `git grep -cE` (count mode) with per-file expected counts: InvestigationSetupModal.tsx=3, DiagnosePhase2.tsx=1, DiagnosePhase3.tsx=1, AIButton.tsx=1. A count mismatch (accidental over-sweep or new unapproved site in an excluded file) forces a conscious plan update. |
| β | Plan prose claimed pattern catches "numeric variable names" but regex `[^}]*[0-9]` requires a literal digit in source text — `size={spinnerSize}` falls through. | Narrowed prose to "digit-bearing expressions" with explicit caveat that pure-variable references are not catchable by grep — deferred to Spinner tests and code review. Also added `:!src/**/*.test.ts` to pathspec exclusions (Probe 1 caveat: `.test.ts` files were uncovered alongside `.test.tsx`). |

**v6 resolutions (2026-04-22, historical — superseded by v7 table above):**

| # | v5 blocker | v6 resolution |
|---|---|---|
| α | C9 numeric Spinner grep (`<Spinner[^>]*size=\{[0-9]+\}` expect exactly 5) did not catch digit-bearing expressions outside bare literals (e.g. `size={loading ? 14 : 16}` elsewhere), and scanned test files, making the "exactly 5" count fragile to test fixtures. | Flipped strategy from exact-count to zero-violations: grep all `src/` EXCLUDING the 4 approved source files and all test files/dirs via pathspec magic (`:!`). Pattern widened to `<Spinner[^>]*size=\{[^}]*[0-9]` to match any digit inside `size={...}` — covers bare literals, ternaries, numeric variables. Separate approved-sites spot-check (`git grep -lE` on 4 files) confirms each approved file still carries at least one numeric Spinner. Count assertion eliminated. |
| β | C9 Slice 3 existence check `test -f src/__tests__/App.motionConfig.test.tsx` is bash-only — fails in the PowerShell workspace. | Replaced with `git ls-files --error-unmatch src/__tests__/App.motionConfig.test.tsx`. Cross-platform (git resolves paths, not the shell); also proves the file is git-tracked, not just present on disk. |

Side tightening (Codex YELLOWs, not blockers):
- Probe 3: §2.7 audit attribution for Dialog/DropdownMenu/Sheet/Tooltip rows corrected from "covered by MotionConfig" to "covered by Slice 4 greps/tests" — MotionConfig governs reduced-motion runtime behavior; curve-value proof lives in Slice 4.
- Probe 1: C4 DOM-marker rationale softened to acknowledge the test does not distinguish an App-level wrapper from a lone child-level one — a conscious scope limitation, not a gap.

**v5 resolutions (2026-04-21, historical — superseded by v6 table above):**

| # | v4 blocker | v5 resolution |
|---|---|---|
| α | C4 test used `toHaveBeenCalledTimes(1)` — brittle under harmless rerenders (Strict Mode double-invocation, ancestor re-mount, future ref-forwarding parent). Encoded the contract on render-count, wrong axis. | Switched to **DOM-marker pass-through pattern** per Codex's proposed shape: mock `MotionConfig` as `<div data-testid="motion-config" data-reduced-motion={reducedMotion}>{children}</div>`. Assert `getAllByTestId('motion-config')` length is 1 (catches nested/missing wrappers via DOM, not call count), `toHaveAttribute('data-reduced-motion', 'user')` (catches wrong/missing prop), `toHaveBeenCalled()` (catches tree-shaken mock), and `mock.calls.every(...)` (catches mid-render prop drift). Survives rerenders because DOM reflects the settled mount state. |
| β | C9 Numeric size rule was policy text only — no grep enforced that raw `<Spinner size={N}>` appeared at exactly the allowed sites. | Added two C9 greps in Slice 1: `<Spinner[^>]*size=\{[0-9]+\}` (expected exactly 5 matches — the off-scale enumerated sites; AIButton's ternary doesn't match since it starts with `variant`), and `<Spinner[^>]*size=\{.*\?` (expected exactly 1 match — AIButton's dynamic caller retains its ternary shape). The rule is now state-enforced, not policy-only. |
| γ | C9 MotionConfig grep `git grep -nE 'MotionConfig[[:space:]]+reducedMotion="user"' src/App.tsx` was single-line — JSX attributes legitimately spanning lines would false-fail. | Split into two format-tolerant checks: `\bMotionConfig\b` present in App.tsx (≥2 hits: import + usage), and `test -f src/__tests__/App.motionConfig.test.tsx`. The wiring test itself (run by `vitest run`) is the full prop-value contract. C9 no longer duplicates that assertion via grep. |
| δ | C9 framing implied broader proof than the greps actually provided (e.g., Slice 3 test content not greppable; Slice 5 Submit Room inheritance test not greppable). | Added an explicit "Scope of these checks: source-state verification only" paragraph at the top of C9. The pre-condition greps prove structural shape; `npx vitest run` at phase close-out proves test contracts. C9 no longer claims to cover what it doesn't. |

Side tightening (Codex YELLOW, not blocker):
- Slice 4 primitive-transition-const grep loosened from hard-coded
  names (`DIALOG_TRANSITION|...`) to `[A-Z_]*TRANSITION[A-Z_]*` so a
  future rename doesn't false-fail the pre-condition.
- Numeric size rule table re-keyed on file + semantic anchor (button
  label / surrounding context) instead of line numbers. Line numbers
  drift with refactors; semantic anchors stay stable.

**v4 resolutions (2026-04-21, historical — superseded by v5 table
above):**

| # | v3 blocker | v4 resolution |
|---|---|---|
| I | Slice 6 C9 pre-condition greps (5 total) did not cover Slice 2 (anime hook guard), Slice 4 (primitive curves), Slice 5 C7 (Import Room hover contract), or Slice 1 (Spinner primitive shape). Audit doc would be flipped to ✅ without proving those contracts landed. | Expanded C9 into six per-slice grep blocks: Slice 1 (spin retirement + Spinner primitive shape), Slice 2 (anime.ts hooks use `usePrefersReducedMotion` + guard conditionals), Slice 3 (App wrapper + wiring test file), Slice 4 (named transition consts + curve tuples + toast-in ease), Slice 5 (Import Room hover class + spring ease + tokens.css alias), plus the Phase 05 `transition-all` invariant. |
| II | Spinner rounding — 5 off-scale sites rounding up 1px was too permissive for a polish phase; at 10–14px range, 1px drift is visible and misaligns against adjacent 11px text. | Switched sites 591, 612, 864, 448, 194 to explicit numeric `size={N}` (preserves exact fidelity). Added strict "Numeric size rule" block: numeric is ALLOWED only for the five enumerated off-scale sites plus `AIButton.tsx:222`'s dynamic ternary; any other numeric use is a migration bug. Named scale remains the default contract. |
| III | C2 "Four rounded sites" miscount — five line numbers listed, "four" claimed. | Corrected to "Five off-scale sites" + cross-reference to the Numeric size rule. |
| IV | C4 test assertion (`toBeGreaterThan(0)` + last-call prop check) didn't guard against a future nested `<MotionConfig>` masking a dropped top-level wrapper. | Hardened to `MotionConfigSpy.mockClear()` + `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: 'user' }), expect.anything())`. Any second wrapper now forces a conscious test update. |

**v3 resolutions (2026-04-21, historical — superseded by v4 table
above):**

| # | v2 blocker | v3 resolution |
|---|---|---|
| A | C4 test assertion (`getByRole('dialog')`) does not distinguish wired from unwired — Dialog renders on `open={true}` regardless of MotionConfig. | Rewrote C4 around a single App-level wiring test using `vi.mock('motion/react', …)` to intercept `MotionConfig` and assert `reducedMotion="user"` prop reaches it. Dropped the five per-primitive reduced-motion tests — they did not prove wiring. Side effect: Slice 3 → Slice 4 dependency eliminated (no longer touch same primitive test files); Slices 1–5 all become Wave 1 parallel-safe. |
| B | "Eight commits across five slices" line was stale (v2 added Slice 6 C9). | Updated to "Nine commits across six slices." |
| C | Slice 1 file paths were stale — `AiPanel.tsx` is under `ai/`, `ZendeskPanel.tsx` under `zendesk/`, `ExportModal.tsx` under `export/`. | Every file reference in Slice 1 (file map, foundation assumption 6/7, C1/C2 headers, migration tables) now uses the full path. |
| D | Spinner named scale too coarse for actual sizes in tree (10, 11, 12, 13, 14, 16, 20). | Expanded scale: `xs`=10, `sm`=12, `md`=14, `lg`=16, `xl`=20. Added explicit per-site migration table for all 17 Tailwind sites in C2 (rounds 11→12 and 13→14 where needed). Spinner API now accepts a pixel number fallback for dynamic-size callers like `AIButton.tsx:222`. |

**v2 resolutions (2026-04-21, historical — superseded by v3 table
above):**

| # | v1 blocker | v2 resolution |
|---|---|---|
| 1 | Slice 5 C7 premise wrong — `SubmitRoom.tsx:23` imports `WorkspaceCard`, used at `:60` and `:142`. Direction C already carries via Phase 04.5. | C7 rescoped around Import Room (the real non-WorkspaceCard surface). Submit Room work collapses to verification + tests that both `WorkspaceCard` instances inherit the Direction C hover-lift classes. |
| 2 | Slice 5 test files missing from file map. | File map lists `SubmitRoom.test.tsx` + `WorkspaceImportPanel.test.tsx` (both exist, extend rather than create). |
| 3 | Wave-1 parallelism false — `docs/perf/reduced-motion-audit.md` was marked "updated by every slice"; all four parallel slices would have conflicted there. | Removed audit updates from individual commits. New **Slice 6 — Audit consolidation** (Commit 9) runs serially after Wave 2 as the only writer to the audit doc. |
| 4 | C4 test assertion brittle — asserting inline `transition: none 0s …` string is not a reliable contract under motion/react v12 in JSDOM. | Rewrote to use `vi.stubGlobal('matchMedia', …)` pattern from `src/hooks/__tests__/useCuteLoadingLabel.hook.test.ts:24–40` with both modern and legacy MQL methods. *(Subsequently superseded by v3 item A — the matchMedia-based approach was itself insufficient because JSDOM Dialog renders on `open` regardless of motion config. See v3 table.)* |
| 5 | C8 left `--room-transition-ease` token decision open ("deferred to Codex's judgment"). | Resolved now: `--room-transition-ease: var(--ease-spring);` — preserves the semantic room-transition seam and eliminates the duplicated cubic-bezier tuple. No further ambiguity. |

---

## Context

Phase 05 shipped at `cefc12e` — §4.2 sweep + citation-jump polish + audit
doc. Phase 04.5 shipped the Direction C token base at `d0e45c9`, but
only `Button` and `WorkspaceCard` actually consume the new curves; the
rest of the primitive layer still uses pre-Direction-C easings (or
library defaults). This phase carries Direction C across the remaining
primitives and retires the three ⚠️ clusters the Phase 05 audit
deferred (motion/react primitive verification, anime.js hook guards,
spin-indicator sweep).

**Per-spec allocation (landed at `debd305`):** Phase 06A is Direction C
broad application + reduced-motion cleanup. Correlation Graph card →
Phase 06B. Case library → Phase 06C. Tauri packaging → 07 (unchanged).

**Spec anchors:**
- §3.3 — Glow tiers + shadow scale (unchanged, verification only)
- §4.2 — `transition: all` prohibition (already clean; stays clean)
- §4.8 — Reduced-motion must-have (the closing push)
- §6.5 — Phase table (amended at `debd305`)

**Tech stack:** React 19, TypeScript strict, motion/react (v12),
anime.js v4, Tailwind 4, CSS custom properties, Vitest + Testing Library.
No new runtime dependencies. `<MotionConfig>` is already exported from
`motion/react`.

---

## Foundation assumptions (verify before first commit of each slice)

1. `src/styles/tokens.css` already defines `--ease-emphasized`,
   `--ease-spring`, `--duration-scale-press-emphasized` (Phase 04.5
   Commit 1, lines 216–218). Slice 4 and Slice 5 depend on these
   tokens existing — Codex must verify at the top of each commit.
2. `src/utils/anime.ts` exports `useAnimeStagger`, `useAnimeValue`,
   `useAnimeTimeline` — all three lack `prefers-reduced-motion` guards
   at the hook level (verified `d0e45c9..cefc12e` diff).
3. A `usePrefersReducedMotion()` hook exists somewhere in the repo
   (EvidencePanel and CanonicalBlockRenderer already consume it per
   the audit §2.1). Slice 2 and Slice 1 need to locate and reuse it;
   **do not create a duplicate**. If the existing hook lives in a
   test-unfriendly location, document the finding and reuse as-is.
4. `motion/react` primitives currently in use: `Dialog`,
   `DropdownMenu`, `Sheet`, `Sidebar`, `Tooltip`, `EvidencePanel`,
   `CanonicalBlockRenderer`. No `<MotionConfig>` wrapper exists today
   (confirmed by grep — no hits outside of `motion/react` package).
5. `--room-transition-ease` in `tokens.css:275` is currently
   `cubic-bezier(0.33, 1, 0.68, 1)`. Swapping its value in Slice 5
   cascades across all room-transition consumers; no consumer edits
   needed.
6. Inline-style spinners currently present: `AIButton.tsx:290`,
   `ai/AiPanel.tsx:357`, `ai/AiPanel.tsx:448`,
   `zendesk/ZendeskPanel.tsx:101`, `zendesk/ZendeskPanel.tsx:200` —
   five sites with `style={{ animation: 'spin 1s linear infinite' }}`
   that bypass Tailwind's `motion-reduce:` prefix entirely.
7. Tailwind `animate-spin` sites (no `motion-reduce:animate-none`):
   17 sites total, enumerated in Slice 1 Commit 2's explicit size
   map. Sizes span 10–20px with per-site precision — the migration
   table in C2 is the authoritative contract.

---

## Non-goals (explicit carve-outs)

- **ToggleChip hover lift.** Dense form controls; hover lift would
  feel jittery at 1px. Explicitly out.
- **Correlation Graph card.** Phase 06B per spec amendment.
- **Case library.** Phase 06C.
- **Tauri packaging.** Phase 07.
- **New easing tokens.** Existing `--ease-emphasized` and `--ease-spring`
  cover every new application; no token additions.
- **Per-component motion presets library.** Every primitive touched in
  Slice 4 gets explicit `transition` props (per-component strategy,
  user-selected). No shared `transitions.ts` constant export.
- **Migrating loading.css TUI spinners.** Those are intentional
  multi-step cycle animations with steps() easing; not plain
  `animate-spin`. Out of scope.
- **PhaseDots pulse easing changes.** Spec §3.4 locks the pulse to its
  current token. Leave alone.
- **Changing `glow-live-pulse` animation.** Already motion-reduce
  guarded; leave alone.

---

## File map

### New files
```
src/components/ui/Spinner.tsx                              (Slice 1 C1)
src/components/ui/__tests__/Spinner.test.tsx               (Slice 1 C1)
```

### Modified files (grouped by slice)
```
# Slice 1 — Spinner unification
src/components/AIButton.tsx                                (C1 + C2)
src/components/ai/AiPanel.tsx                              (C1)
src/components/zendesk/ZendeskPanel.tsx                    (C1)
src/components/ai/diagnose/DiagnosePhase1.tsx              (C2)
src/components/ai/diagnose/DiagnosePhase2.tsx              (C2)
src/components/ai/diagnose/DiagnosePhase3.tsx              (C2)
src/components/ai/diagnose/SimilarTicketsPanel.tsx         (C2)
src/components/export/ExportModal.tsx                      (C2)
src/components/InvestigationSetupModal.tsx                 (C2)
src/components/ServerSettingsPanel.tsx                     (C2)

# Slice 2 — anime hook guard
src/utils/anime.ts                                         (C3)
src/utils/__tests__/anime.test.ts                          (C3, create if absent)

# Slice 3 — MotionConfig wiring at App root (Sidebar primitive not touched)
src/App.tsx                                                (C4)
src/__tests__/App.motionConfig.test.tsx                    (C4, new)

# Slice 4 — Direction C primitive transitions
src/index.css                                              (C5 toast-in easing)
src/components/ui/Dialog.tsx                               (C6)
src/components/ui/DropdownMenu.tsx                         (C6)
src/components/ui/Sheet.tsx                                (C6)
src/components/ui/Tooltip.tsx                              (C6)
src/components/ui/__tests__/Dialog.test.tsx                (C6, create if absent / extend if present)
src/components/ui/__tests__/DropdownMenu.test.tsx          (C6, create if absent / extend if present)
src/components/ui/__tests__/Sheet.test.tsx                 (C6, create if absent / extend if present)
src/components/ui/__tests__/Tooltip.test.tsx               (C6, create if absent / extend if present)

# Slice 5 — Room parity
src/components/import/WorkspaceImportPanel.tsx                             (C7, primary)
src/components/workspace/SubmitRoom.tsx                                     (C7, verification + tests)
src/components/import/__tests__/WorkspaceImportPanel.test.tsx              (C7, extend)
src/components/workspace/__tests__/SubmitRoom.test.tsx                      (C7, extend)
src/styles/tokens.css                                                       (C8)

# Slice 6 — Audit consolidation (serial, after all other slices merge)
docs/perf/reduced-motion-audit.md                                           (C9, only writer)
```

---

## Commit decomposition

Nine commits across six slices. Dispatch guidance at the bottom.

### Slice 1 — Spinner unification

#### Commit 1 — Extract `<Spinner />` primitive + migrate inline-style spinners

**Files:**
- `src/components/ui/Spinner.tsx` (new)
- `src/components/ui/__tests__/Spinner.test.tsx` (new)
- `src/components/AIButton.tsx` (5 inline-style sites retired; 1
  migrated here, 1 retained for C2)
- `src/components/ai/AiPanel.tsx`
- `src/components/zendesk/ZendeskPanel.tsx`

**Spinner contract:**

```tsx
// src/components/ui/Spinner.tsx
import { usePrefersReducedMotion } from '<existing path, locate in repo>';

/**
 * Named scale is chosen to cover the exact pixel sizes currently
 * used across the tree (verified 2026-04-21): 10, 11, 12, 13, 14,
 * 16, 20. 11 and 13 round UP to the next named size (sm=12, md=14).
 * All other current sizes map exactly.
 */
export interface SpinnerProps {
  /**
   *   'xs' = 10px  (smallest used)
   *   'sm' = 12px  (covers current 11 and 12)
   *   'md' = 14px  (covers current 13 and 14)
   *   'lg' = 16px
   *   'xl' = 20px  (largest used)
   * Or pass a pixel number for callers with dynamic sizing.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Override color; defaults to `currentColor` so it inherits context */
  className?: string;
  /** Accessible label; defaults to 'Loading' */
  label?: string;
}

export function Spinner({ size = 'sm', className, label = 'Loading' }: SpinnerProps): JSX.Element;
```

Render a simple SVG/border-based spinner. Under reduced motion, render
a static glyph (e.g. a `⋯` or a filled circle) OR a rotating spinner
with `animation: none` — consumer behavior should not be noticeably
broken, just static.

Use `role="status"` + `<span className="sr-only">{label}</span>` for
screen readers. Internal Tailwind: `motion-safe:animate-spin
motion-reduce:animate-none` as a defense-in-depth fallback even though
the hook short-circuits.

**Migration targets in C1 (inline-style sites — full paths):**

| File:line | Before | After |
|---|---|---|
| `src/components/AIButton.tsx:290` | `<span style={{ animation: 'spin 1s linear infinite' }} … />` | `<Spinner size="sm" />` |
| `src/components/ai/AiPanel.tsx:357` | inline animation | `<Spinner size="sm" />` |
| `src/components/ai/AiPanel.tsx:448` | "analyzing" inline animation | `<Spinner size="md" label="Analyzing" />` |
| `src/components/zendesk/ZendeskPanel.tsx:101` | search inline animation | `<Spinner size="sm" label="Searching" />` |
| `src/components/zendesk/ZendeskPanel.tsx:200` | analyzing inline animation | `<Spinner size="md" label="Analyzing" />` |

Codex: read each site before migrating to verify the current visible
pixel size matches the `size=` value. If the inline-style span was
sized by surrounding font-size and reads noticeably different from
the named size, fall back to a pixel-number `size={N}`.

Remove the now-dead `<style>{`@keyframes spin ...`}</style>` blocks in
`src/components/AIButton.tsx:329` and `src/components/ai/AiPanel.tsx:421`
since Tailwind's `animate-spin` provides the keyframe globally.
Double-check no other consumer depends on those inline style tags.

**Tests:**
- Spinner renders with correct `role="status"`.
- Spinner renders visible-to-AT label text.
- Under reduced motion, the root element does NOT carry a live
  `animate-spin` class (assert via mocked `usePrefersReducedMotion()`).

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green (target: baseline + 3-5 new assertions)
- `npx eslint <touched files>` → clean
- `git grep -nE "animation:\s*['\"]?spin\b" src/` → returns 0 matches

**Commit message:** `feat(phase-06a): extract Spinner primitive + migrate inline-style spinners`

---

#### Commit 2 — Migrate Tailwind `animate-spin` sites to `<Spinner />`

**Files (full paths — see table below for per-site line + size):**
- `src/components/AIButton.tsx`
- `src/components/InvestigationSetupModal.tsx` (5 animate-spin sites)
- `src/components/export/ExportModal.tsx`
- `src/components/ai/diagnose/DiagnosePhase1.tsx` (3 sites)
- `src/components/ai/diagnose/DiagnosePhase2.tsx` (2 sites)
- `src/components/ai/diagnose/DiagnosePhase3.tsx` (3 sites)
- `src/components/ai/diagnose/SimilarTicketsPanel.tsx`
- `src/components/ServerSettingsPanel.tsx`

**Migration:** replace each `<Loader2 size={N} className="animate-spin"
… />` instance with `<Spinner size={…} label="…" />`. Keep the
accompanying `<Loader2>` imports for non-spinning glyphs; only remove
them if no other consumer remains in the file.

**Explicit per-site size map (verified via `git grep animate-spin`
on 2026-04-21):**

| File:line | Current | Spinner `size` | Label suggestion |
|---|---|---|---|
| `src/components/AIButton.tsx:222` | dynamic ternary `16 / 14 / 20` | preserve ternary using numbers: `size={variant === 'icon' ? 16 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16}` | `"Loading"` |
| `src/components/InvestigationSetupModal.tsx:303` | `size={14}` | `"md"` | `"Fetching ticket"` |
| `src/components/InvestigationSetupModal.tsx:543` | `size={10}` | `"xs"` | `"Testing"` |
| `src/components/InvestigationSetupModal.tsx:591` | `size={11}` | `size={11}` (numeric — off-scale) | `"Discovering"` |
| `src/components/InvestigationSetupModal.tsx:612` | `size={11}` | `size={11}` (numeric — off-scale) | `"Searching"` |
| `src/components/InvestigationSetupModal.tsx:864` | `size={13}` | `size={13}` (numeric — off-scale) | `"Starting"` |
| `src/components/export/ExportModal.tsx:199` | `<span>?</span>` w/ `animate-spin` (text-as-spinner) | `"sm"` — replace the whole span | `"Exporting"` |
| `src/components/ai/diagnose/DiagnosePhase1.tsx:380` | `size={10}` | `"xs"` | `"Loading"` |
| `src/components/ai/diagnose/DiagnosePhase1.tsx:428` | `size={12}` | `"sm"` | `"Fetching"` |
| `src/components/ai/diagnose/DiagnosePhase1.tsx:485` | `size={12}` | `"sm"` | `"Creating"` |
| `src/components/ServerSettingsPanel.tsx:72` | `size={14}` | `"md"` | `"Checking"` |
| `src/components/ai/diagnose/DiagnosePhase2.tsx:401` | `size={10}` | `"xs"` | `"Updating"` |
| `src/components/ai/diagnose/DiagnosePhase2.tsx:448` | `size={13}` | `size={13}` (numeric — off-scale) | `"Refining"` |
| `src/components/ai/diagnose/DiagnosePhase3.tsx:194` | `size={11}` | `size={11}` (numeric — off-scale) | `"Retrying"` |
| `src/components/ai/diagnose/DiagnosePhase3.tsx:344` | `size={14}` | `"md"` | `"Posting"` |
| `src/components/ai/diagnose/DiagnosePhase3.tsx:415` | `size={14}` | `"md"` | `"Creating"` |
| `src/components/ai/diagnose/SimilarTicketsPanel.tsx:124` | `size={10}` | `"xs"` | `"Loading"` |

17 migration sites total.

**Numeric size rule (strict):**

`<Spinner size={N}>` with a raw number is ALLOWED only at the six
sites enumerated below. Sites are keyed on **file + semantic anchor**
(the button label or surrounding context the spinner annotates),
NOT on line number. Line numbers drift with refactors; semantic
anchors remain stable. Slice 6 C9 enforces this via two checks:
(1) a zero-violations grep that scans all `src/` EXCLUDING the four
approved source files and all test files — any digit-bearing
`size={...}` outside those files is a migration bug; (2) per-file
`git grep -cE` cardinality checks (3/1/1/1) that prove the approved
sites survived intact.

| # | File | Semantic anchor | Pixel size |
|---|---|---|---|
| 1 | `src/components/InvestigationSetupModal.tsx` | "Discover Stations" button (when `discoveringStations` is true) | `size={11}` |
| 2 | `src/components/InvestigationSetupModal.tsx` | Station details loading indicator | `size={11}` |
| 3 | `src/components/InvestigationSetupModal.tsx` | "Start Investigation" button (when `!ticket || scanningPdfs`) | `size={13}` |
| 4 | `src/components/ai/diagnose/DiagnosePhase2.tsx` | "Refine" send button (when `refining`) | `size={13}` |
| 5 | `src/components/ai/diagnose/DiagnosePhase3.tsx` | "Retry Attachment Upload" button (when `retryingAttachment`) | `size={11}` |
| 6 | `src/components/AIButton.tsx` | Dynamic variant-driven ternary | `size={variant === 'icon' ? 16 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16}` |

**Rationale for each exception:**

Sites 1–5 preserve exact pixel fidelity (11 or 13) because the
named-scale step (2px) is perceptible at icon scale — a 1px drift
on an 11px glyph next to 11px text reads as misalignment. Site 6
(AIButton) is not "off-scale" per se; it produces exact pixel values
at each branch of a variant-driven ternary, and collapsing to named
sizes would require five conditional mapping layers for no gain.

For every other site, use the named scale (`xs|sm|md|lg|xl`). The
Spinner primitive's type signature permits `size: number` to cover
the cases above, but **the plan contract is tighter than the type**:
named scale is the default, numeric is the audited exception.

If Codex encounters a new migration site during Slice 1 C2 that
doesn't map cleanly to the named scale, halt and flag to the
reviewer. Do not silently extend the numeric exception list — that
is exactly the drift the C9 grep prevents.

**Tests:** extend existing consumer tests where present (for example,
if `InvestigationSetupModal.test.tsx` asserts loading UI, swap
`animate-spin` assertions to `role="status"` or Spinner presence).

**Verification:**
- `git grep -n "animate-spin" src/` → returns only the Spinner
  primitive's own class declaration + any test-regex assertions.
- `git grep -nE "from.*lucide.*Loader2" src/` — flag any remaining
  `Loader2` imports that are no longer used; remove them.

**Commit message:** `feat(phase-06a): migrate Tailwind animate-spin sites to Spinner primitive`

*Audit-doc rows for the 15 retired spinner ⚠️ entries are consolidated
in Slice 6 C9.*

---

### Slice 2 — anime.js hook-level reduced-motion guard

#### Commit 3 — Reduced-motion guard in `src/utils/anime.ts`

**Files:** `src/utils/anime.ts`, `src/utils/__tests__/anime.test.ts` (create if absent).

**Implementation pattern:** each of `useAnimeStagger`, `useAnimeValue`,
`useAnimeTimeline` must consult `usePrefersReducedMotion()` and on
reduced motion either (a) snap the target element/value to the final
state without animating, or (b) skip the animation entirely if the
final state is the default.

**Concrete contracts:**

`useAnimeStagger` on reduced motion:
```tsx
// Set targets to their final state and return early.
targets.forEach((t) => {
  const el = t as HTMLElement;
  el.style.opacity = String(opts.opacity[1]);
  el.style.transform = `translateY(${opts.translateY[1]}px) scale(${opts.scale[1]})`;
});
return; // no animate() call
```

`useAnimeValue` on reduced motion:
```tsx
if (prefersReducedMotion) {
  setValue(to);
  return; // no animate() call
}
```

`useAnimeTimeline` on reduced motion: skip `createTimeline` entirely;
return a no-op controller object so callers' `.play()` / `.pause()`
still work.

**Tests (new file):**
- Mock `usePrefersReducedMotion` returning `true`; assert hook does
  NOT call `loadAnime()` (spy on the internal loader).
- Mock returning `false`; assert the hook proceeds normally
  (smoke-test that `animate` is called with expected props).
- `useAnimeValue(5, 100)` under reduced motion returns `100`
  immediately on first render.

Note: `loadAnime()` is a private module-level function in anime.ts.
Codex may need to refactor it into an injectable seam (e.g.
`export const __testing = { setLoader: (fn) => ... }`) OR the tests
can mock the `animejs` module via `vi.mock('animejs', ...)`.
Prefer the `vi.mock` approach — less invasive.

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green (adds ~6 new assertions)
- Manual smoke: toggle OS reduce-motion, open Log Stream, apply a
  filter. Count badges should update instantly (no tween). Timeline
  bars should render at final height (no stagger).

**Commit message:** `feat(phase-06a): reduced-motion guards in anime.ts hooks`

*Audit-doc rows for the four retired anime.js ⚠️ entries are
consolidated in Slice 6 C9.*

---

### Slice 3 — MotionConfig wiring at App root

#### Commit 4 — `<MotionConfig reducedMotion="user">` + App-level wiring test

**Files:** `src/App.tsx`, `src/__tests__/App.motionConfig.test.tsx` (new).

**App.tsx change:**

The current provider tree (verified at `src/App.tsx:18–30`) is:
`ToastProvider → AIProvider → CaseProvider → EvidenceProvider →
LogProvider → AppShell`. Note `EvidenceProvider` is present in source
— do not drop it while wrapping.

Wrap the tree with `<MotionConfig reducedMotion="user">` as the
outermost layer:

```tsx
import { MotionConfig } from 'motion/react';

const App = () => (
  <MotionConfig reducedMotion="user">
    <ToastProvider>
      <AIProvider>
        <CaseProvider>
          <EvidenceProvider>
            <LogProvider>
              <AppShell />
            </LogProvider>
          </EvidenceProvider>
        </CaseProvider>
      </AIProvider>
    </ToastProvider>
  </MotionConfig>
);
```

`reducedMotion="user"` tells motion/react to respect the user's
`prefers-reduced-motion` preference automatically for every `motion.*`
primitive. One line covers Dialog, DropdownMenu, Sheet, Tooltip,
Sidebar, EvidencePanel, CanonicalBlockRenderer.

**Wiring test — the only contract that holds in JSDOM:**

Behavioral tests at the primitive level (e.g. "Dialog renders
synchronously under reduced motion") do NOT distinguish wired from
unwired states in this codebase. The current Dialog renders its
content on `open={true}` regardless of whether `MotionConfig` is
present — `getByRole('dialog')` passes in both cases. The only
verifiable contract is `MotionConfig`'s props. Test via module-mock
spy at the App boundary.

Create `src/__tests__/App.motionConfig.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// Intercept motion/react MotionConfig with a DOM-marker pass-through.
// The marker keys the contract on rendered DOM, not render-count,
// so the test survives harmless rerenders (Strict Mode, ref-forwarding
// parents, ancestor re-mounts) while still catching a future nested
// <MotionConfig> — because a second wrapper produces a second marker.
const MotionConfigSpy = vi.fn(
  ({
    children,
    reducedMotion,
  }: {
    children: ReactNode;
    reducedMotion?: string;
  }) => (
    <div data-testid="motion-config" data-reduced-motion={reducedMotion}>
      {children}
    </div>
  ),
);

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    MotionConfig: MotionConfigSpy,
  };
});

// Import AFTER vi.mock so App sees the mocked MotionConfig.
import App from '../App';

describe('App — motion wiring', () => {
  it('wraps the tree with exactly one MotionConfig reducedMotion="user"', () => {
    MotionConfigSpy.mockClear();
    render(<App />);

    // (a) Exactly one wrapper. A future nested <MotionConfig> under
    //     the App tree produces a second marker → test fails → forces
    //     a conscious update. A missing top-level wrapper produces
    //     zero markers → test fails on the length assertion.
    expect(screen.getAllByTestId('motion-config')).toHaveLength(1);

    // (b) The rendered wrapper carries the correct reducedMotion prop.
    //     This is stable under rerenders — the DOM attribute reflects
    //     the final mounted tree, not the call history.
    expect(screen.getByTestId('motion-config')).toHaveAttribute(
      'data-reduced-motion',
      'user',
    );

    // (c) MotionConfig was actually called (catches someone accidentally
    //     rendering a literal <MotionConfig> element that got tree-shaken
    //     or replaced upstream).
    expect(MotionConfigSpy).toHaveBeenCalled();

    // (d) Every call carried the correct prop value. Rerenders are
    //     tolerated because each call is checked identically; a
    //     future code change that changes `reducedMotion` mid-render
    //     would fail this assertion.
    expect(
      MotionConfigSpy.mock.calls.every(
        ([props]) => (props as { reducedMotion?: string }).reducedMotion === 'user',
      ),
    ).toBe(true);
  });
});
```

**Why this pattern (rationale for reviewers):**

The v3 pattern asserted `toHaveBeenCalledTimes(1)` + last-call
`objectContaining`. That encoded the contract on render-count, which
is brittle under harmless rerenders (Strict Mode double-invocation
during dev tests, an ancestor re-mount, a future ref-forwarding
parent). The v4 pattern above uses the rendered DOM as the source of
truth: the DOM shows exactly one `motion-config` marker regardless of
how many times the mock is called, and the attribute reflects the
final settled prop value. Combined with assertion (d) — every call
carried the right prop — the test catches wrong prop values, a fully
absent MotionConfig (zero markers), and a spurious nested MotionConfig
added on top of the App-level one (two markers). Known scope limit:
if App.tsx simultaneously drops its wrapper and a child adds one, the
DOM count stays at 1 — not detected. Phase 06A introduces no
child-level MotionConfig, so this is a non-issue for the current
phase; flag it when reviewing future phases that add child wrappers.

**Assertion rules for this commit:**
- Do NOT add reduced-motion behavioral tests to individual primitives
  in this slice. Those assertions do not prove wiring for primitives
  whose open state is gated on a React prop. Slice 4 adds
  per-primitive tests for Direction C transition-value contracts —
  NOT for reduced-motion behavior.
- This single App-level test IS the reduced-motion wiring contract
  for Phase 06A. If it passes, `MotionConfig` is wired and
  `reducedMotion="user"` propagates down the tree per motion/react's
  own contract. Phase 06A does not separately re-verify that
  contract in Vitest — doing so would invite false-positive tests.
- Manual smoke at phase close-out (`npm run electron:dev` with OS
  reduce-motion enabled) is the end-to-end behavioral check. Between
  machine-verifying wiring and human-verifying observable behavior,
  the two levels cover the contract fully.

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green (adds 1 new test asserting the
  `reducedMotion="user"` prop reaches `MotionConfig`).
- Manual smoke: toggle OS reduce-motion, open a Dialog (Import),
  DropdownMenu (AI Assistant), Tooltip. Confirm each appears/
  disappears without slide/scale animation. If any of them still
  animate, `MotionConfig` is not wrapping that branch of the tree
  — investigate before claiming GO.

**Commit message:** `feat(phase-06a): MotionConfig reducedMotion=user at App root + wiring test`

*Audit-doc rows for the five retired motion/react primitive ⚠️
entries (Dialog, DropdownMenu, Tooltip, Sidebar, Sheet) are
consolidated in Slice 6 C9. Slice 6 C9 additionally grep-verifies
the `App.tsx` `MotionConfig reducedMotion="user"` string as part of
its pre-update state check.*

---

### Slice 4 — Direction C primitive transitions

#### Commit 5 — Toast entrance uses `--ease-emphasized`

**Files:** `src/index.css`.

**Change:** at line 92, swap the ease for `toast-in`:

```diff
- animation: toast-in 200ms var(--ease-out) forwards;
+ animation: toast-in 220ms var(--ease-emphasized) forwards;
```

Duration bumped 200 → 220ms to match `--duration-scale-press-emphasized`
— small overshoot reads better with the emphasized curve.

Keep the reduced-motion guard (should already be covered by the
global `@media (prefers-reduced-motion: reduce)` block in
`src/index.css:113` that covers `evidence-add`, `room-fade-in`,
`toast-in`, etc.). Verify.

**Tests:** locate the Toast test file (or create). Assert the toast
root carries `toast-in` keyframe class and either the specific ease
token or the composite `animation` property references
`var(--ease-emphasized)`. CSS-in-JS assertion is acceptable.

If no Toast test exists today, a minimal new test asserting the
container renders with `role="status"` and `animation-name:
toast-in` is acceptable — don't expand the test surface beyond
verifying the Direction C curve.

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green
- Manual: trigger a toast (import an invalid file, save evidence);
  confirm the entry has a perceivable overshoot before settling.

**Commit message:** `feat(phase-06a): Toast entrance uses Direction C emphasized curve`

---

#### Commit 6 — Dialog, DropdownMenu, Sheet, Tooltip transition props

**Files:** `Dialog.tsx`, `DropdownMenu.tsx`, `Sheet.tsx`, `Tooltip.tsx`, plus the four test files from Slice 3 (extend with transition-value assertions).

**Per-primitive strategy (user-selected: per-component explicit):**

Curves map to intent:
- **Dialog** — emphasized bounce (feels intentional, gets attention)
- **DropdownMenu** — spring (snappy, should feel responsive)
- **Sheet** — emphasized (enters from an edge; overshoot reads well)
- **Tooltip** — spring with short duration (spring feel at 150ms)

**Applied to `motion.*` `transition` prop:**

motion/react accepts cubic-bezier as a 4-tuple `[x1, y1, x2, y2]`:

```tsx
// Dialog.tsx content motion.div
<motion.div
  initial={{ opacity: 0, scale: 0.96 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.96 }}
  transition={{
    duration: 0.22,
    ease: [0.34, 1.56, 0.64, 1], // --ease-emphasized
  }}
>
```

```tsx
// DropdownMenu.tsx
<motion.div
  initial={{ opacity: 0, y: -4 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={{
    duration: 0.15,
    ease: [0.16, 1.11, 0.3, 1], // --ease-spring
  }}
>
```

```tsx
// Sheet.tsx
transition={{
  duration: 0.25,
  ease: [0.34, 1.56, 0.64, 1],
}}
```

```tsx
// Tooltip.tsx
transition={{
  duration: 0.15,
  ease: [0.16, 1.11, 0.3, 1],
}}
```

**Replace, don't append.** If a `transition` prop already exists,
overwrite the `ease` value; don't stack. If `duration` is already set
and sensible, keep it — only change if it conflicts with the
Direction C timing intent listed above.

**Rationale for hard-coded arrays (not `var(--ease-emphasized)`):**
motion/react consumes JS values, not CSS variables, for its
`transition.ease`. Hard-coding the four-tuple is the standard
pattern. Add a comment alongside each tuple referencing the token
name so future refactors stay synchronized:

```tsx
ease: [0.34, 1.56, 0.64, 1], // sync with --ease-emphasized
```

**Tests:** create (or extend, if already present) the four primitive
test files. Slice 3 no longer touches these files (v3 change), so C6
is the first writer. Add a test per primitive asserting the motion
`transition.ease` array value. Reading `transition.ease` from the
rendered DOM is impractical — instead, import the primitive's
module-level transition const and assert on its value directly. That
is why Codex should extract the transition object as a named const
(see the refactor snippet below).

Recommend extracting the transition object as a module-level const
in each primitive to make tests direct:

```tsx
// Dialog.tsx
const DIALOG_TRANSITION = {
  duration: 0.22,
  ease: [0.34, 1.56, 0.64, 1] as const,
};
// …
transition={DIALOG_TRANSITION}
```

Then tests can import the const.

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green (adds ~4 new assertions)
- Manual smoke: open Dialog (Import), DropdownMenu (AI Assistant),
  Sheet (any sheet), hover for Tooltip. Confirm each has the
  intended curve feel.

**Commit message:** `feat(phase-06a): Dialog/DropdownMenu/Sheet/Tooltip use Direction C curves`

*New audit-doc rows for Toast, Dialog, DropdownMenu, Sheet, Tooltip
Direction C application are consolidated in Slice 6 C9.*

---

### Slice 5 — Room parity

#### Commit 7 — Import Room Direction C application (+ Submit Room verification)

**Files:**
- `src/components/import/WorkspaceImportPanel.tsx` (primary — source edits)
- `src/components/workspace/SubmitRoom.tsx` (no source edits — verification target)
- `src/components/import/__tests__/WorkspaceImportPanel.test.tsx` (extend)
- `src/components/workspace/__tests__/SubmitRoom.test.tsx` (extend)

**Pre-implementation reality (verified during v2 rewrite):**

- `SubmitRoom.tsx:23` imports `WorkspaceCard`. Both `ClosureNoteCard`
  (`:60`) and `EvidenceSummaryCard` (`:142`) are `WorkspaceCard`
  instances. Direction C carries automatically via Phase 04.5 — hover
  lift, container transform, grid-template-rows, tracking all cascade.
  **No source edits needed in `SubmitRoom.tsx`.**
- `WorkspaceImportPanel.tsx` is the real non-`WorkspaceCard` surface.
  It renders its own card-shaped drop zone (hover scale added in
  Phase 04 `e2aa148`, progress bar fixed in Phase 05 C1). This is
  where the actual Direction C work happens.

**Primary work — `WorkspaceImportPanel.tsx`:**

Codex reads the file fully first, identifies the drop-zone container,
and applies:

1. **Hover lift on the drop-zone container:**
   `motion-safe:hover:-translate-y-[1px]` added to the card-shaped
   container's class list.
2. **Hover-scale transition uses Direction C spring curve:** the
   existing Phase 04 `e2aa148` hover-scale transition resolves its
   ease via `var(--ease-spring)`. If already tokenized, verify it
   maps correctly; if hard-coded, swap to `--ease-spring`.
3. **Transition timing:** `duration-[var(--duration-normal)]` (150ms)
   aligns with the Button hover intent. Do not diverge.
4. **No structural changes.** Do not add DOM elements. Do not add
   `data-focus-target`. Do not touch layout. Do not change the
   progress-bar transition already fixed in Phase 05 C1.

**Secondary work — `SubmitRoom.tsx` verification only:**

No source edits. **Tests only.** Assert that both `WorkspaceCard`
instances in SubmitRoom inherit the Direction C hover-lift contract
from Phase 04.5. This guards against future refactors that might swap
`WorkspaceCard` for a non-Direction-C alternative.

**What NOT to do:**

- Do NOT edit `SubmitRoom.tsx` source. Direction C already carries.
- Do NOT convert non-`WorkspaceCard` surfaces (textarea, buttons,
  badges) to `WorkspaceCard`. Out of scope.
- Do NOT change layout structure in `WorkspaceImportPanel.tsx`.
- Do NOT introduce new `data-surface` or `data-focus-target`
  attributes on the drop zone.

**Tests (extend both existing files):**

`WorkspaceImportPanel.test.tsx`:
- Drop-zone container's class list includes
  `motion-safe:hover:-translate-y-[1px]`.
- Hover-scale transition class references `var(--ease-spring)`
  (class-string assertion is acceptable; computed-style assertion
  if the class form shifts).

`SubmitRoom.test.tsx`:
- Closure Note card is rendered by `WorkspaceCard` — assert by
  `data-card-id="closure-note"` on the rendered tree (the Phase
  04.5 `WorkspaceCard` primitive's attribute).
- Evidence Summary card — assert by `data-card-id="evidence-summary"`.
- Both rendered roots carry the WorkspaceCard hover-lift class (or
  its current equivalent). If the `WorkspaceCard` primitive later
  moves away from that class literal, relax to a computed-style
  check against `motion-safe` — but keep the assertion in place as
  a regression guard.

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green (adds ~4 new assertions)
- Manual smoke: hover Import Room drop-zone — confirm spring-curve
  lift. Hover Submit Room cards — confirm Direction C already-
  inherited lift is present (unchanged behavior).

**Commit message:** `feat(phase-06a): Direction C on Import Room drop-zone; Submit Room verified via WorkspaceCard inheritance`

---

#### Commit 8 — `--room-transition-ease` aliased to `var(--ease-spring)`

**Files:** `src/styles/tokens.css` only.

**Change:**

```diff
- --room-transition-ease: cubic-bezier(0.33, 1, 0.68, 1);
+ --room-transition-ease: var(--ease-spring);
```

**Rationale (resolved in v2 — do not reopen during implementation):**

- `--ease-spring` (defined at `tokens.css:217`) is the Direction C
  curve intended for transitions longer than a single interaction
  beat. Room transitions (250ms exit + 350ms enter + staggered card
  entries ≈ 600ms total) fit that intent.
- Aliasing instead of copying the tuple preserves the **semantic
  room-transition seam**: if a future design pass wants room
  transitions to diverge from the primitive spring curve, the seam
  is a token-value edit rather than a consumer sweep. One token,
  one edit point.
- Eliminates the duplicated `cubic-bezier(...)` literal that today
  lives at both `tokens.css:217` (as `--ease-spring`) and
  `tokens.css:275` (as `--room-transition-ease`).

`--ease-emphasized` is explicitly the wrong choice here — its
overshoot (`y: 1.56`) would compound across the ~600ms room
sequence and read as the whole app bouncing. Do not substitute.

**Tests:** extend `tokens.css`-adjacent test (or create a smoke test
that reads `getComputedStyle(document.documentElement)` and asserts
`--room-transition-ease` resolves to the spring cubic-bezier).

**Verification:**
- `npx tsc --noEmit` → 0
- `npx vitest run` → all green
- `git grep -n "room-transition-ease" src/` → confirms all consumers
  (WorkspaceGrid ×4, index.css ×2, useRoomTransition ×2) resolve via
  the token without edits.
- Manual smoke: navigate Import → Investigate → Submit and back.
  Confirm the room transitions feel smoother (spring) without the
  previous curve's subtle tail.

**Commit message:** `feat(phase-06a): --room-transition-ease uses Direction C spring curve`

*New audit-doc row for room-transition Direction C alignment is
consolidated in Slice 6 C9.*

---

### Slice 6 — Audit consolidation (serial, runs after all other slices merge)

#### Commit 9 — Retire all Phase 06A ⚠️ rows in the reduced-motion audit

**Files:** `docs/perf/reduced-motion-audit.md` only. No source code,
no tests.

**Purpose:** single-writer consolidation. All five preceding slices
intentionally avoid touching this file so Wave 1 dispatch stays
parallel-safe. Slice 6 runs serially at the end and folds every
Phase 06A effect into the living audit doc in one commit.

**Pre-update state check (run BEFORE editing the audit doc):**

Scope of these checks: **source-state verification only.** They
prove that the shape of each preceding slice's source-level contract
is present in the working tree. They do NOT re-verify test contracts
(e.g., the App-level MotionConfig wiring assertion, the Spinner
role/label assertions, the primitive transition-value tests). Test
contracts are verified by `npx vitest run` at phase close-out — the
checklist below calls `vitest run` separately. Do not duplicate
assertions across both layers.

Each preceding slice's source contract gets at least one grep.
Greps are multi-line-tolerant where JSX attribute formatting could
span lines (see the MotionConfig block). If any check fails, halt
the commit and flag which preceding slice did not actually land its
contract. Prove state, not history. Pre-conditions fail fast; no
ancestor-SHA check required.

### Slice 1 — Spinner primitive + spin retirement + numeric-size rule

```bash
# Inline-style `animation: 'spin ...'` fully retired
git grep -nE "animation:\s*['\"]?spin\b" src/
# expect: 0 matches

# Tailwind animate-spin only lives inside the Spinner primitive
# and any test-regex assertions
git grep -n "animate-spin" src/
# expect: Spinner.tsx + *.test.tsx only

# Spinner primitive consumes the reduced-motion guard
git grep -n "motion-safe:animate-spin" src/components/ui/Spinner.tsx
git grep -n "motion-reduce:animate-none" src/components/ui/Spinner.tsx
# expect: >= 1 match each

# Spinner primitive exposes correct AT shape
git grep -nE 'role="status"' src/components/ui/Spinner.tsx
git grep -n "sr-only" src/components/ui/Spinner.tsx
# expect: >= 1 match each (role="status" + sr-only label)

# NUMERIC SIZE RULE ENFORCEMENT — strategy: prove zero violations exist
# outside the six approved sites rather than counting exact matches
# (count is fragile to test fixtures). Pattern `<Spinner[^>]*size=\{[^}]*[0-9]`
# catches any digit inside size={...}: bare literals (size={11}) and
# ternaries (size={cond ? 14 : 16}). Does NOT catch pure-variable
# references (size={spinnerSize}) where no digit appears in source
# text — those fall through to Spinner tests and code review. Applies
# to single-line Spinner JSX; multi-line formatted elements would
# require a multi-line grep strategy, but the codebase convention is
# single-line for inline primitives. NOTE: AIButton.tsx was reformatted
# to single-line to satisfy this grep — do not split across lines.
#
# Windows compat: `:!` pathspec magic fails on Git for Windows. Use
# the pipe-through-grep-v approach below instead.
git grep -nE '<Spinner[^>]*size=\{[^}]*[0-9]' src/ \
  | grep -vE '(InvestigationSetupModal|DiagnosePhase2|DiagnosePhase3|AIButton|__tests__|\.test\.tsx|\.test\.ts)'
# expect: 0 matches — any output is a migration bug outside approved sites

# Approved sites retain correct cardinality (per-file match counts).
# A count mismatch (too low = accidental over-sweep; too high = new
# unapproved site in an excluded file) forces a conscious plan update.
git grep -cE '<Spinner[^>]*size=\{[^}]*[0-9]' \
  src/components/InvestigationSetupModal.tsx
# expect: 3 (Discover Stations 11px, Station details 11px, Start
#            Investigation 13px — semantic anchors per numeric size table)

git grep -cE '<Spinner[^>]*size=\{[^}]*[0-9]' \
  src/components/ai/diagnose/DiagnosePhase2.tsx
# expect: 1 (Refine send button 13px)

git grep -cE '<Spinner[^>]*size=\{[^}]*[0-9]' \
  src/components/ai/diagnose/DiagnosePhase3.tsx
# expect: 1 (Retry Attachment Upload button 11px)

git grep -cE '<Spinner[^>]*size=\{[^}]*[0-9]' \
  src/components/AIButton.tsx
# expect: 1 (variant-driven ternary)
```

Grep proves source-state shape. Behavioral proof (label text, size
rendering, numeric-size visual fidelity) is handled by test suites
and manual smoke — C9 does not re-run those.

### Slice 2 — anime.js hook-level reduced-motion guards

```bash
# All three hooks reference a reduced-motion signal
git grep -nE "usePrefersReducedMotion|prefersReducedMotion" src/utils/anime.ts
# expect: >= 3 references (one per hook: stagger, value, timeline)

# Guards are gate-keepers, not logs — must be used in conditionals
git grep -nE "if \(.*[Rr]educedMotion\)" src/utils/anime.ts
# expect: >= 1 match (guard conditional before animate() / createTimeline())
```

Grep cannot prove the guards actually snap to final state correctly
— that's `src/utils/__tests__/anime.test.ts`'s job. C9 only verifies
the guards exist.

### Slice 3 — MotionConfig wiring

`git grep` is line-based. The contract
`<MotionConfig reducedMotion="user">` can legitimately be formatted
across multiple lines. Split the check: prove the wrapper exists in
App.tsx (format-tolerant), and prove the wiring test file exists.
The wiring test itself is the full prop-value contract — C9 does
not re-verify it here.

```bash
# MotionConfig wrapper is imported and used in App.tsx
git grep -nE '\bMotionConfig\b' src/App.tsx
# expect: >= 2 matches (import line + JSX element)

# App-level wiring test file exists (content contract verified by
# `npx vitest run` at phase close-out, not by grep)
git ls-files --error-unmatch src/__tests__/App.motionConfig.test.tsx
# expect: exit 0 (file is git-tracked; works cross-platform including
# PowerShell since path resolution is handled by git, not the shell)
```

### Slice 4 — Direction C primitive transitions

Assumes Codex adopted the "named transition const per primitive"
refactor recommended in C6 (required for testability):

```bash
# Each primitive exposes a named transition const that tests can
# import. Regex is loose on the const name (matches `*_TRANSITION`
# or any UPPER_CASE identifier containing "TRANSITION") so that a
# future rename doesn't trip the grep — the check is structural
# (there IS a named transition const), not nominal (it has exactly
# this name).
git grep -nE "const\s+[A-Z_]*TRANSITION[A-Z_]*\s*[:=]" \
  src/components/ui/Dialog.tsx \
  src/components/ui/DropdownMenu.tsx \
  src/components/ui/Sheet.tsx \
  src/components/ui/Tooltip.tsx
# expect: 4 matches (one per primitive)

# Direction C curve values land in the primitive files
git grep -nE "\[0\.34, 1\.56, 0\.64, 1\]|\[0\.16, 1\.11, 0\.3, 1\]" \
  src/components/ui/Dialog.tsx \
  src/components/ui/DropdownMenu.tsx \
  src/components/ui/Sheet.tsx \
  src/components/ui/Tooltip.tsx
# expect: 4 matches minimum (one per primitive — either emphasized
# or spring tuple per the C6 intent map)

# Toast entrance uses --ease-emphasized (C5)
git grep -n "toast-in" src/index.css
git grep -n "ease-emphasized" src/index.css
# expect: toast-in keyframe references --ease-emphasized
```

### Slice 5 — Room parity

```bash
# Import Room drop-zone hover-lift landed (C7 primary contract)
git grep -nE "motion-safe:hover:-translate-y-\[1px\]" \
  src/components/import/WorkspaceImportPanel.tsx
# expect: >= 1 match

# Import Room hover transition uses the spring curve
git grep -nE "ease-\[var\(--ease-spring\)\]" \
  src/components/import/WorkspaceImportPanel.tsx
# expect: >= 1 match

# Room transition token aliased (C8 contract)
git grep -n "room-transition-ease" src/styles/tokens.css
# expect: value line resolves to `var(--ease-spring)` — not a raw
# cubic-bezier tuple
```

### Phase 05 invariant (still held)

```bash
git grep -n "transition-all" src/
# expect: only test-regex assertions (Button.test.tsx)
```

**Required edits (verify each actually holds before flipping the row):**

§2.1 — motion/react surfaces:
- Dialog: ⚠️ → ✅, covered by MotionConfig (Phase 06A C4).
- DropdownMenu: ⚠️ → ✅, same.
- Tooltip: ⚠️ → ✅, same.
- Sidebar: ⚠️ → ✅, same.
- Sheet: ⚠️ → ✅, same.

§2.2 — anime.js surfaces:
- LogStreamHeader count stagger: ⚠️ → ✅, covered by hook-level
  guard in `useAnimeStagger` (Phase 06A C3).
- LogStreamHeader animated count: ⚠️ → ✅, covered by
  `useAnimeValue` (C3).
- LogViewer stagger: ⚠️ → ✅, covered by `useAnimeStagger` (C3).
- LogTimeline bar stagger: ⚠️ → ✅, covered by `useAnimeStagger`
  (C3).

§2.3 — Inline + Tailwind spin indicators:
- All 15 rows: ⚠️ → ✅, covered by `<Spinner />` primitive
  (Phase 06A C1/C2).

§2.7 — Phase 04.5 Direction C additions: append new Phase 06A rows
for:
- Toast entrance curve (C5): `--ease-emphasized`, covered by global
  reduced-motion media query.
- Dialog transition curve (C6): emphasized, covered by Slice 4 greps/tests.
- DropdownMenu transition curve (C6): spring, covered by Slice 4 greps/tests.
- Sheet transition curve (C6): emphasized, covered by Slice 4 greps/tests.
- Tooltip transition curve (C6): spring, covered by Slice 4 greps/tests.

§2.6 — Focus-mode / room transitions: append
- Room transitions (post-06A): `--room-transition-ease` aliased to
  `var(--ease-spring)`; global reduced-motion media query covers
  the `room-fade-in` + `evidence-add` keyframes.

§4 — Follow-up cleanup items: rewrite to reflect that items 1–3 are
now retired (covered by Phase 06A C1–C4). Close the section or
re-point it to Phase 06B / 06C hand-offs.

**Section 1 regression check:** confirm
`git grep -n 'transition-all' src/` still returns 0 matches outside
the `Button.test.tsx` regex assertion.

**Verification evidence block at the top of the updated file:**

```
**Last update:** Phase 06A Commit 9 (<sha>)
**Status:** All ⚠️ rows from v1 (Phase 05) retired via Phase 06A.
```

**Verification:**
- `npx tsc --noEmit` → 0 (no code changes, should be instant).
- `npx vitest run` → all green (no test file changes).
- Manual review: read the audit end-to-end; confirm no ⚠️ rows
  remain except any that Phase 06A explicitly left as-is.

**Commit message:** `docs(phase-06a): consolidate reduced-motion audit — all Phase 05 ⚠️ rows retired`

---

## Phase 06A close-out

### Verification checklist (Codex runs at phase close-out)

- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npx vitest run` — all tests pass. Target baseline: ~560
      (Phase 05 close) + ~25 Phase 06A additions ≈ ~585.
- [ ] `npx eslint <all phase-touched files>` — clean.
- [ ] `git grep -nE "animation:\s*['\"]?spin\b" src/` → 0 matches.
- [ ] `git grep -n "animate-spin" src/` — only hits are within
      `Spinner.tsx` itself and test-regex assertions.
- [ ] `git grep -n "transition-all" src/` → still 0 matches (Phase 05
      invariant holds).
- [ ] After Slice 6 C9 merges: `docs/perf/reduced-motion-audit.md` ⚠️
      count in §2.1–§2.3 → 0. §4 follow-up section closed or archived
      to Phase 06B hand-off. Verification-evidence block at the top
      of the file references Slice 6 C9's sha.
- [ ] Manual smoke in `npm run electron:dev`:
  - All 22 spinner sites (5 inline-style + 17 Tailwind) render
    `<Spinner />` primitive; under OS
    reduced-motion they're static.
  - Log Stream filter with reduce-motion: count stagger snaps, bars
    render at final height.
  - Dialog / DropdownMenu / Sheet / Tooltip open/close:
    - Normal: each has its intended Direction C feel.
    - Reduced-motion: each appears/disappears without animation.
  - Toast: entrance has emphasized curve overshoot.
  - Submit Room cards hover with 1px lift.
  - Import Room drop-zone hover scale uses spring.
  - Room transitions (Import ↔ Investigate ↔ Submit) feel smoother.
- [ ] `prefers-reduced-motion: reduce` OS toggle: end-to-end app
      flow works with no broken layouts, no stuck animations, no
      indefinite loaders.

### Phase 06A close-out sign-off (Codex emits after final commit)

```
## Phase 06A close-out sign-off
GO | NO-GO. If NO-GO: exact blockers. If GO: confirm full test
suite green, Spinner primitive is the only spin pattern, anime
hooks snap on reduced motion, MotionConfig covers all motion/react
primitives, all primitives use Direction C curves, room transitions
use --ease-spring.

## Phase 06B readiness hand-off
3-5 primitives / contracts / docs the Correlation Graph work should
verify before wiring. Likely candidates:
- `WorkspaceCard.dataAttributes` prop (unchanged from 04.5)
- `useLiveSurface` / `useSurfaceTier` (unchanged from 01a)
- Reduced-motion guard pattern used in anime.ts (will apply to
  graph layout animation)
- Direction C curves ([0.34, 1.56, 0.64, 1] and [0.16, 1.11, 0.3, 1])
  as the canonical values for any graph interaction transitions
```

---

## Slice dispatch guide (for Codex)

**Wave 1 (parallel-safe — dispatch all five simultaneously):**

1. **Slice 1 — Spinner unification** (2 commits). Touches `AIButton`,
   `ai/AiPanel`, `zendesk/ZendeskPanel`, four `ai/diagnose/*` files,
   `export/ExportModal`, `InvestigationSetupModal`,
   `ServerSettingsPanel`; creates `ui/Spinner.tsx` + test.
2. **Slice 2 — anime.js hook guard** (1 commit). Touches
   `src/utils/anime.ts` only + new test file.
3. **Slice 3 — MotionConfig wiring at App root** (1 commit).
   Touches `App.tsx` + one new App-level test.
   **Does NOT touch primitive test files** (rewritten in v3 — the
   only verifiable wiring contract is the App-level mock-spy).
4. **Slice 4 — Direction C primitive transitions** (2 commits).
   Touches `index.css`, `Dialog.tsx`, `DropdownMenu.tsx`, `Sheet.tsx`,
   `Tooltip.tsx`, 4 primitive test files. No longer depends on Slice
   3 now that Slice 3 doesn't touch primitive tests.
5. **Slice 5 — Room parity** (2 commits). Touches
   `WorkspaceImportPanel.tsx` (source + test), `SubmitRoom.test.tsx`
   (test-only; no source edits — Submit Room already uses
   `WorkspaceCard`), `tokens.css` (one-line alias in C8).

**Wave 2 (after every Wave 1 slice merges — single-writer, serial):**

6. **Slice 6 — Audit consolidation** (1 commit). Touches
   `docs/perf/reduced-motion-audit.md` only. Must run AFTER every
   preceding slice has merged so the audit-doc edits reflect ground
   truth, not plan intent. C9 runs state-based pre-condition greps
   (not SHA-ancestor checks) to verify each preceding contract
   actually landed before the audit is flipped to ✅.

**Per-slice Codex prompt template:**

When dispatching a slice, the user provides Codex with a prompt
containing:

1. A pointer to this plan: `docs/superpowers/plans/2026-04-21-phase06A-direction-c-broad-application.md` + the slice number.
2. The spec anchors list (§3.3, §4.2, §4.8, §6.5).
3. `docs/perf/reduced-motion-audit.md` as context for the ⚠️ rows
   the slice will eventually close (note: Slice 6 is the only writer;
   Slices 1–5 do NOT edit the audit doc, even if the work they do
   retires rows conceptually).
4. Reminder to read `CLAUDE.md` project + `src/CLAUDE.md` module
   context first.
5. Reminder to emit the per-commit self-assessment block and stop
   between commits within the slice (per `feedback_codex_review_cycle.md`).

---

## Deferred items (Phase 06B / 06C / 07 hand-offs)

| Item | Phase |
|---|---|
| Correlation Graph card (full implementation) | 06B |
| Case library learning loop | 06C |
| Standalone Tauri packaging | 07 |
| ToggleChip hover lift (skipped as design call) | n/a |
| Shared `transitions.ts` motion preset library | possible future cleanup |

Phase 06A closes the "Direction C broad application" branch of the
polish-pass follow-through. After it ships, the post-polish roadmap
is strictly feature work (06B graph, 06C case library, 07 packaging).

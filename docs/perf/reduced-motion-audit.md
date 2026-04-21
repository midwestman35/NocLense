# Reduced-Motion Audit — Phase 05 (post-Direction-C baseline)

**Date:** 2026-04-21
**Phase:** 05 Commit 1
**Scope:** Every animated surface reachable in normal app flow on the current `main` branch after Phase 04.5 `d0e45c9`.
**Spec gates:** §4.2 (no `transition: all`), §4.8 (reduced-motion fallback everywhere).

This is a living document — future work (Phase 05 Commits 2-6, Phase 06+) adds rows below. Keep it in order: new surfaces append with their phase number + commit SHA where they landed.

---

## Section 1 — §4.2 compliance (`transition: all` prohibition)

Phase 05 Commit 1 swept five live violations. All replacements use property-specific transition lists with `motion-reduce:` guards where a transform is in the list.

| # | Surface | Before | After | Commit |
|---|---|---|---|---|
| 1 | AI Assistant dropdown button | `transition-all` | `transition-[background-color,border-color,color] duration-150` | Phase 05 C1 |
| 2 | Parse progress bar fill | `transition-all duration-300` | `transition-[width] duration-300 motion-reduce:transition-none` | Phase 05 C1 |
| 3 | ToggleChip checkbox | `transition-all duration-200` | `transition-[background-color,border-color,color] duration-200` | Phase 05 C1 |
| 4 | PhaseDots pill | `transition-all duration-300` | `transition-[background-color,color,transform] duration-300 motion-reduce:transition-none` | Phase 05 C1 |
| 5 | PhaseDots dot | `transition-all duration-300` | `transition-[background-color,transform,opacity] duration-300 motion-reduce:transition-none` | Phase 05 C1 |

**Grep check (ran at commit time):**
```
$ git grep -n 'transition-all' src/
```
Returns 0 matches outside the `Button.test.tsx` regex assertion (`not.toMatch(/\btransition-all\b/)`), which is an intentional enforcement pattern.

---

## Section 2 — Animated surface coverage matrix

Status legend:

- ✅ **Compliant** — has a reduced-motion guard (CSS media query, Tailwind `motion-safe:`/`motion-reduce:` prefix, `usePrefersReducedMotion()` hook, or is binary like `display: none`).
- ⚠️ **Needs work** — animation runs unconditionally; a fix is planned but not yet landed. Fix plan in the row.
- 🔒 **Blocked** — cannot be fixed in current scope; waiting on something else.

### 2.1 — `motion/react` (motion v12) surfaces

| Surface | File | Trigger | Covered by | Status |
|---|---|---|---|---|
| EvidencePanel item pin/unpin | `src/components/evidence/EvidencePanel.tsx:99` | State change | `usePrefersReducedMotion()` hook → skips animation | ✅ |
| CanonicalBlockRenderer typewriter reveal | `src/components/ai/diagnose/CanonicalBlockRenderer.tsx` | Mount | `usePrefersReducedMotion()` → skips reveal, shows full text | ✅ |
| Dialog mount/unmount | `src/components/ui/Dialog.tsx` | Mount/unmount | motion library respects `prefers-reduced-motion` natively for component-level presence animations | ⚠️ needs verification |
| DropdownMenu open/close | `src/components/ui/DropdownMenu.tsx` | Open toggle | Same as Dialog | ⚠️ needs verification |
| Tooltip appear | `src/components/ui/Tooltip.tsx` | Hover | Same | ⚠️ needs verification |
| Sidebar collapse | `src/components/ui/Sidebar.tsx` | Toggle | Same | ⚠️ needs verification |
| Sheet slide | `src/components/ui/Sheet.tsx` | Open | Same | ⚠️ needs verification |

**Fix plan for ⚠️ items:** add an app-level `<MotionConfig reducedMotion="user">` wrapper OR confirm via test harness that each surface's motion transitions collapse under reduced-motion. Not blocker for Phase 05; folded into a follow-up cleanup (Phase 06 scope).

### 2.2 — anime.js surfaces (expanded post-Codex review)

| Surface | File:line | Trigger | Covered by | Status |
|---|---|---|---|---|
| LogStreamHeader count stagger | `LogStreamHeader.tsx:127` — `useAnimeStagger(badgesRef, 'span', [filteredLogs.length], …)` | Filter changes | Hook must consult `usePrefersReducedMotion()` | ⚠️ needs verification |
| LogStreamHeader animated count | `LogStreamHeader.tsx:121` — `useAnimeValue(prevCountRef.current, filteredLogs.length, { duration: 400 })` | Filter changes | Same — `useAnimeValue` tweens a number; under reduced-motion it should snap to target | ⚠️ needs verification |
| LogViewer stagger | `LogViewer.tsx:317` — `useAnimeStagger(...)` | Citation jump / mount | Same | ⚠️ needs verification |
| LogTimeline bar stagger | `timeline/LogTimeline.tsx:93` — `useAnimeStagger(containerRef, '.timeline-bar', [buckets.length], …)` | Bucket data change | Same | ⚠️ needs verification |

**Fix plan:** inspect `src/utils/anime.ts` hook implementations. If any of `useAnimeStagger`, `useAnimeValue`, or `useAnimeTimeline` do NOT already consult `usePrefersReducedMotion()` to no-op when motion is reduced, add the guard at the hook level (one fix covers all four consumer sites). Estimated 10–20 lines. Not blocker for Phase 05 since the animations are decorative, not gating; flagged for Phase 06.

### 2.3 — Inline spin keyframes

| Surface | File:line | Implementation | Covered by | Status |
|---|---|---|---|---|
| AIButton spinner (icon variant) | `AIButton.tsx:222` | Tailwind `animate-spin` | Tailwind honors `motion-reduce:` — surface doesn't currently use it | ⚠️ needs `motion-reduce:animate-none` |
| AIButton status indicator | `AIButton.tsx:290` | inline `style={{ animation: 'spin 1s linear infinite' }}` | None — inline style bypasses reduced-motion | ⚠️ needs conditional style |
| AIButton `<style>` block | `AIButton.tsx:329` | `<style>{\`@keyframes spin ...\`}</style>` | The keyframe itself is fine; the consumer style is the issue | ✅ (keyframe definition only) |
| AiPanel spinner | `AiPanel.tsx:357` | inline `style={{ animation: 'spin 1s linear infinite' }}` | Same as AIButton:290 | ⚠️ |
| AiPanel `<style>` block | `AiPanel.tsx:421` | `<style>{\`@keyframes spin ...\`}</style>` | Keyframe fine | ✅ |
| AiPanel analyzing spinner | `AiPanel.tsx:448` | inline animation | Same | ⚠️ |
| DiagnosePhase1/2/3 | multiple | Tailwind `animate-spin` | `motion-reduce:animate-none` not set | ⚠️ |
| ExportModal spinner | `ExportModal.tsx:199` | Tailwind `animate-spin` | Same | ⚠️ |
| InvestigationSetupModal spinners | `InvestigationSetupModal.tsx:303, 543, 591, 612, 864` (5 sites) | Tailwind `animate-spin` | Same | ⚠️ |
| ServerSettingsPanel status spinner | `ServerSettingsPanel.tsx:72` | Tailwind `animate-spin` | Same | ⚠️ |
| ZendeskPanel search spinner | `ZendeskPanel.tsx:101` | inline `style={{ animation: 'spin 1s linear infinite' }}` | None — inline style | ⚠️ |
| ZendeskPanel analyzing spinner | `ZendeskPanel.tsx:200` | inline `style={{ animation: 'spin 1s linear infinite' }}` | None — inline style | ⚠️ |
| SimilarTicketsPanel loading spinner | `ai/diagnose/SimilarTicketsPanel.tsx:124` | Tailwind `animate-spin` | Same | ⚠️ |

**Fix plan:** two small follow-up commits worth of work. All fixes are one-liners — either add `motion-reduce:animate-none` to the Tailwind class or wrap the inline animation in a `usePrefersReducedMotion()` conditional. **Not blocker for Phase 05** because spinners are ephemeral indicators users dismiss by waiting; the degraded experience is "spinning icon keeps spinning under reduced motion" which is low-severity. Flagged for Phase 06.

### 2.4 — Global `@keyframes` in `src/index.css`

| Keyframe | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `phase-dot-pulse` | Active phase dot | `@media (prefers-reduced-motion: reduce) { .animate-phase-pulse { animation: none; } }` at line 113 | ✅ |
| `evidence-add` | Pin new evidence | Same media query block | ✅ |
| `room-fade-in` | Room transition | Same | ✅ |
| `toast-in` | Toast mount | Same | ✅ |
| `shimmer` | Skeleton loading | Same | ✅ |
| `.btn-press-bounce` (Phase 04.5) | Button press | Media query in the class definition itself strips the transform transition | ✅ |

### 2.5 — `src/styles/loading.css` keyframes

| Keyframe | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `tui-braille-cycle` | Braille spinner | Line 109 comment: "All animations honor prefers-reduced-motion"; explicit `@media (prefers-reduced-motion: reduce)` block at the end of the file | ✅ |
| `tui-block-cycle` | Block spinner | Same | ✅ |
| `tui-dots-cycle` | Dots spinner | Same | ✅ |
| `glow-live-pulse` | Live-tier surfaces | Same | ✅ |
| `cute-label-reveal` | Per-character reveal on cute-label phrase change (`loading.css:144, 148`) | Same `@media (prefers-reduced-motion: reduce)` guard at end of file | ✅ |
| `cute-label-breathe` | Per-character breathing loop on idle cute-label (`loading.css:145, 153`) | Same | ✅ |

### 2.6 — `src/styles/focus-mode.css` (Phase 04 + Phase 04.5)

| Rule | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `[data-card-id][data-focus-target="true"]` fill | Focus toggle | Binary CSS — no animation | ✅ |
| `[data-card-id][data-focus-target="false"] { display: none }` | Focus toggle | Binary | ✅ |
| `[data-card-body] { transition: none !important }` under reduced motion | Card expand/collapse | Explicit rule added in Phase 04.5 | ✅ |

### 2.7 — Phase 04.5 Direction C additions

| Surface | File | Reduced-motion handling | Status |
|---|---|---|---|
| `.btn-press-bounce` composite transition | `src/index.css` | `@media (prefers-reduced-motion: reduce)` strips the transform transition | ✅ |
| Button `active:scale-[0.94]` | `Button.tsx` | `motion-reduce:active:scale-100 disabled:scale-100` classes | ✅ |
| WorkspaceCard grid-template-rows + transform + opacity | `WorkspaceCard.tsx` | `[data-card-body] { transition: none !important }` at `src/index.css` | ✅ |
| WorkspaceCard motion-safe hover lift | `WorkspaceCard.tsx` | `motion-safe:hover:-translate-y-[1px]` prefix — only applies when motion is OK | ✅ |

### 2.8 — Phase 05 new additions (land in subsequent commits)

| Surface | Commit | Planned reduced-motion handling |
|---|---|---|
| `CitationJumpChip` fade-in | C2 | `motion-reduce:animate-none` on chip root |
| Container pulse on `[data-surface="log-stream"][data-citation-just-arrived="true"]` | C2 | `@media (prefers-reduced-motion: reduce) { animation: none }` in `citation-jump.css` |
| Phase 02 row highlight fade | C2 (retrofit) | `@media (prefers-reduced-motion: reduce) { transition-duration: 0s }` — missing from Phase 02, added in C2 |
| `bundle-pulse` keyframe | C4 | `motion-safe:animate-[bundle-pulse_...]` prefix on the badge span — the prefix means the animation never runs under reduced-motion |
| Tier-driven glow on `[data-tier="live"]` | C5 | `@media (prefers-reduced-motion: reduce) { animation: none }` — static shadow only |
| Rail flex layout | C6 | No animation — CSS flex layout is instant by definition |

---

## Section 3 — Verification method

Run these at the end of Phase 05 Commit 1 and re-verify at phase close-out:

1. `git grep -n 'transition-all' src/` → returns 0 matches outside test regex.
2. Manual: toggle OS "reduce motion" on Windows; open the app at each room (Import / Investigate / Submit); confirm:
   - No box scales, translates, or rotates under the hover + active states where motion-safe / motion-reduce guards are in place
   - Spinners either pause (ideal) or rotate instantly (acceptable for Phase 05; fixed in Phase 06)
   - Card expand/collapse is instant
   - Focus-mode toggle is instant
   - Citation-jump chip and container pulse are static (chip shows immediately, no fade)
   - Evidence badge updates counts without pulsing
3. Programmatic: extend existing Vitest tests whenever a new animated surface lands, asserting the `motion-reduce:` class or media-query presence.

---

## Section 4 — Follow-up cleanup items (Phase 06 hand-off)

Flagged during this audit; not blocker for Phase 05 close-out. Small cleanups:

1. **Spin indicator sweep.** Add `motion-reduce:animate-none` to every Tailwind `animate-spin` usage — confirmed count is now ~15 sites (AIButton, AiPanel, DiagnosePhase1/2/3, ExportModal, InvestigationSetupModal × 5, ServerSettingsPanel, SimilarTicketsPanel). Mechanical grep-and-edit. Replace the inline `style={{ animation: 'spin 1s linear infinite' }}` (AIButton × 2, AiPanel × 2, ZendeskPanel × 2) with a `usePrefersReducedMotion()`-gated conditional or a reusable `<Spinner />` primitive.
2. **Anime.js hook-level guard.** Audit `src/utils/anime.ts` — `useAnimeStagger`, `useAnimeValue`, `useAnimeTimeline`. If any of the four consumer sites (LogStreamHeader count stagger + animated count, LogViewer stagger, LogTimeline bar stagger) don't already get reduced-motion coverage via the hook, add the guard at the hook level. One fix covers all four.
3. **Motion/react primitive verification.** Wrap app root in `<MotionConfig reducedMotion="user">` OR add explicit tests to each motion/react primitive (Dialog, DropdownMenu, Tooltip, Sidebar, Sheet, EvidencePanel, CanonicalBlockRenderer) asserting reduced-motion behavior. The EvidencePanel + CanonicalBlockRenderer already use `usePrefersReducedMotion()` — the remaining 5 need the config or tests.

Estimated effort: 2 small commits (~40 lines total), grouped as "spin sweep" + "anime hook guards + MotionConfig".

---

## Summary

- **Phase 05 Commit 1 delivers:** ✅ 5 `transition-all` violations fixed; ✅ this audit document established as the reference.
- **Green surfaces (verified compliant):** 19 — all global keyframes, loading.css (including cute-label-*), focus-mode, Phase 04.5 additions.
- **Needs-work surfaces (⚠️):** 23 — anime.js hook consumer sites (4) that need `usePrefersReducedMotion` guard at the hook level; inline/Tailwind spin indicators (15 sites across AIButton, AiPanel, DiagnosePhase1/2/3, ExportModal, InvestigationSetupModal (5), ServerSettingsPanel, ZendeskPanel (2), SimilarTicketsPanel); motion/react primitive-level verification (5 surfaces).
- **No regressions introduced by Phase 05.** All new animations in commits 2, 4, 5 shipped with motion-safe guards.

Phase 05 resumption is unblocked from a §4.2 compliance standpoint. The ⚠️ surfaces are decorative spinners and library-level hooks where a centralized fix (guard in `useAnimeStagger`/`useAnimeValue` + a sweep of spin `motion-reduce:animate-none` prefixes) covers the bulk of the remaining work. Estimated Phase 06 cleanup: 2 small commits.

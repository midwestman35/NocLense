# Reduced-Motion Audit - Phase 06A (post-cleanup baseline)

**Last update:** Phase 06A Commit 9 (pending local commit; verified on merged source baseline `b91a9ab`)
**Status:** All ⚠️ rows from v1 (Phase 05) retired via Phase 06A.
**Date:** 2026-04-22
**Phase:** 06A Commit 9
**Scope:** Every animated surface reachable in normal app flow on the current working tree after the Phase 06A Wave 1 slices merged.
**Spec gates:** §4.2 (no `transition: all`), §4.8 (reduced-motion fallback everywhere).

**Verification evidence (Phase 06A C9, 2026-04-22):**
- C9 pre-condition greps: passed.
- Source-state audit result: passed. All required Slice 1-5 contracts were present before this document was updated.
- `cmd /c npx vitest run`: failed in unrelated existing tests outside this docs-only slice, including `src/contexts/__tests__/EvidenceContext.test.tsx` and `.worktrees/ui-overhaul*/src/services/__tests__/llmService.test.ts`.
- Interpretation: the reduced-motion source audit is green, while the current repo-wide Vitest baseline remains red and must be triaged separately.

This is a living document. New animated surfaces should append below with the phase + commit where they landed and the reduced-motion contract they rely on.

---

## Section 1 - §4.2 compliance (`transition: all` prohibition)

Phase 05 Commit 1 swept five live violations. All replacements use property-specific transition lists with `motion-reduce:` guards where a transform is in the list.

| # | Surface | Before | After | Commit |
|---|---|---|---|---|
| 1 | AI Assistant dropdown button | `transition-all` | `transition-[background-color,border-color,color] duration-150` | Phase 05 C1 |
| 2 | Parse progress bar fill | `transition-all duration-300` | `transition-[width] duration-300 motion-reduce:transition-none` | Phase 05 C1 |
| 3 | ToggleChip checkbox | `transition-all duration-200` | `transition-[background-color,border-color,color] duration-200` | Phase 05 C1 |
| 4 | PhaseDots pill | `transition-all duration-300` | `transition-[background-color,color,transform] duration-300 motion-reduce:transition-none` | Phase 05 C1 |
| 5 | PhaseDots dot | `transition-all duration-300` | `transition-[background-color,transform,opacity] duration-300 motion-reduce:transition-none` | Phase 05 C1 |

**Grep check (re-verified for Phase 06A C9):**
```bash
$ git grep -n 'transition-all' src/
```
Returns only the intentional test-regex assertions in `Button.test.tsx`, `ToggleChip.test.tsx`, and `PhaseDots.test.tsx`.

---

## Section 2 - Animated surface coverage matrix

Status legend:

- ✅ **Compliant** - has a reduced-motion guard (CSS media query, Tailwind `motion-safe:`/`motion-reduce:` prefix, `usePrefersReducedMotion()` hook, or a binary/non-animated interaction).
- ⚠️ **Needs work** - animation runs unconditionally; a fix is planned but not yet landed.
- 🔒 **Blocked** - cannot be fixed in current scope; waiting on something else.

### 2.1 - `motion/react` (motion v12) surfaces

| Surface | File | Trigger | Covered by | Status |
|---|---|---|---|---|
| EvidencePanel item pin/unpin | `src/components/evidence/EvidencePanel.tsx:99` | State change | `usePrefersReducedMotion()` hook skips animation | ✅ |
| CanonicalBlockRenderer typewriter reveal | `src/components/ai/diagnose/CanonicalBlockRenderer.tsx` | Mount | `usePrefersReducedMotion()` shows the full text immediately | ✅ |
| Dialog mount/unmount | `src/components/ui/Dialog.tsx` | Mount/unmount | App-level `<MotionConfig reducedMotion="user">` in `src/App.tsx` (Phase 06A C4); Direction C tuple covered by Slice 4 greps/tests | ✅ |
| DropdownMenu open/close | `src/components/ui/DropdownMenu.tsx` | Open toggle | App-level `<MotionConfig reducedMotion="user">` in `src/App.tsx` (Phase 06A C4); Direction C tuple covered by Slice 4 greps/tests | ✅ |
| Tooltip appear | `src/components/ui/Tooltip.tsx` | Hover | App-level `<MotionConfig reducedMotion="user">` in `src/App.tsx` (Phase 06A C4); Direction C tuple covered by Slice 4 greps/tests | ✅ |
| Sidebar collapse | `src/components/ui/Sidebar.tsx` | Toggle | App-level `<MotionConfig reducedMotion="user">` in `src/App.tsx` (Phase 06A C4) | ✅ |
| Sheet slide | `src/components/ui/Sheet.tsx` | Open | App-level `<MotionConfig reducedMotion="user">` in `src/App.tsx` (Phase 06A C4); Direction C tuple covered by Slice 4 greps/tests | ✅ |

Phase 06A C4 established one app-level reduced-motion contract for the `motion/react` layer. Slice 4 then verified the Direction C transition tuples for the primitives that changed curves in this phase.

### 2.2 - anime.js surfaces

| Surface | File:line | Trigger | Covered by | Status |
|---|---|---|---|---|
| LogStreamHeader count stagger | `LogStreamHeader.tsx:127` - `useAnimeStagger(badgesRef, 'span', [filteredLogs.length], ...)` | Filter changes | Hook-level `usePrefersReducedMotion()` guard in `src/utils/anime.ts` (Phase 06A C3) | ✅ |
| LogStreamHeader animated count | `LogStreamHeader.tsx:121` - `useAnimeValue(prevCountRef.current, filteredLogs.length, { duration: 400 })` | Filter changes | Hook-level `usePrefersReducedMotion()` guard in `src/utils/anime.ts` (Phase 06A C3) | ✅ |
| LogViewer stagger | `LogViewer.tsx:317` - `useAnimeStagger(...)` | Citation jump / mount | Hook-level `usePrefersReducedMotion()` guard in `src/utils/anime.ts` (Phase 06A C3) | ✅ |
| LogTimeline bar stagger | `timeline/LogTimeline.tsx:93` - `useAnimeStagger(containerRef, '.timeline-bar', [buckets.length], ...)` | Bucket data change | Hook-level `usePrefersReducedMotion()` guard in `src/utils/anime.ts` (Phase 06A C3) | ✅ |

Phase 06A C3 moved the reduced-motion gate into the shared anime hooks, so every existing consumer inherits snap-to-final-state behavior without per-callsite branching.

### 2.3 - Spinner indicators (Phase 06A consolidated)

| Surface | File:line | Implementation | Covered by | Status |
|---|---|---|---|---|
| AIButton spinner (icon variant) | `src/components/AIButton.tsx:223` | `<Spinner size={variant === 'icon' ? 16 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| AIButton status indicator | `src/components/AIButton.tsx:291` | `<Spinner size="sm" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| AiPanel thinking spinner | `src/components/ai/AiPanel.tsx:358` | `<Spinner size="sm" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| AiPanel analyzing spinner | `src/components/ai/AiPanel.tsx:448` | `<Spinner size="md" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase1 loading spinner | `src/components/ai/diagnose/DiagnosePhase1.tsx:381` | `<Spinner size="xs" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase1 fetch spinner | `src/components/ai/diagnose/DiagnosePhase1.tsx:429` | `<Spinner size="sm" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase1 create spinner | `src/components/ai/diagnose/DiagnosePhase1.tsx:486` | `<Spinner size="sm" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase2 updating spinner | `src/components/ai/diagnose/DiagnosePhase2.tsx:402` | `<Spinner size="xs" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase2 refine spinner | `src/components/ai/diagnose/DiagnosePhase2.tsx:449` | `<Spinner size={13} />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| DiagnosePhase3 retry / submit / create spinners | `src/components/ai/diagnose/DiagnosePhase3.tsx:195,345,416` | `<Spinner size={11|"md"} />` callsites in the submit flow | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| ExportModal spinner | `src/components/export/ExportModal.tsx:200` | `<Spinner size="sm" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| InvestigationSetupModal spinners | `src/components/InvestigationSetupModal.tsx:304,544,592,613,865` | `<Spinner />` callsites including exact-size exceptions `11` and `13` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| ServerSettingsPanel status spinner | `src/components/ServerSettingsPanel.tsx:73` | `<Spinner size="md" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| ZendeskPanel search / analyzing spinners | `src/components/zendesk/ZendeskPanel.tsx:102,201` | `<Spinner size="sm" />` and `<Spinner size="md" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |
| SimilarTicketsPanel loading spinner | `src/components/ai/diagnose/SimilarTicketsPanel.tsx:125` | `<Spinner size="xs" />` | Shared `<Spinner />` primitive uses `motion-safe:animate-spin` + `motion-reduce:animate-none` | ✅ |

Phase 06A C1/C2 retired every inline `animation: 'spin ...'` style and every raw production `animate-spin` callsite. The only remaining `animate-spin` matches in `src/` are the Spinner primitive itself and its tests.

### 2.4 - Global `@keyframes` in `src/index.css`

| Keyframe | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `phase-dot-pulse` | Active phase dot | `@media (prefers-reduced-motion: reduce) { .animate-phase-pulse { animation: none; } }` | ✅ |
| `evidence-add` | Pin new evidence | Same media-query block | ✅ |
| `room-fade-in` | Room transition | Same media-query block | ✅ |
| `toast-in` | Toast mount | Same media-query block | ✅ |
| `shimmer` | Skeleton loading | Same media-query block | ✅ |
| `.btn-press-bounce` (Phase 04.5) | Button press | Media query in the class definition strips the transform transition | ✅ |

### 2.5 - `src/styles/loading.css` keyframes

| Keyframe | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `tui-braille-cycle` | Braille spinner | Explicit `@media (prefers-reduced-motion: reduce)` block at the end of the file | ✅ |
| `tui-block-cycle` | Block spinner | Same | ✅ |
| `tui-dots-cycle` | Dots spinner | Same | ✅ |
| `glow-live-pulse` | Live-tier surfaces | Same | ✅ |
| `cute-label-reveal` | Per-character reveal on cute-label phrase change | Same reduced-motion media query | ✅ |
| `cute-label-breathe` | Per-character breathing loop on idle cute-label | Same reduced-motion media query | ✅ |

### 2.6 - Focus mode + room transitions

| Rule | Trigger | Reduced-motion handling | Status |
|---|---|---|---|
| `[data-card-id][data-focus-target="true"]` fill | Focus toggle | Binary CSS - no animation | ✅ |
| `[data-card-id][data-focus-target="false"] { display: none }` | Focus toggle | Binary | ✅ |
| `[data-card-body] { transition: none !important }` under reduced motion | Card expand/collapse | Explicit rule added in Phase 04.5 | ✅ |
| Room transitions (`room-fade-in` + `--room-transition-ease`) | Room-to-room navigation | `--room-transition-ease: var(--ease-spring)` in `src/styles/tokens.css`; `@media (prefers-reduced-motion: reduce)` in `src/index.css` disables `room-fade-in` | ✅ |

### 2.7 - Phase 04.5 + Phase 06A Direction C additions

| Surface | File | Reduced-motion handling | Status |
|---|---|---|---|
| `.btn-press-bounce` composite transition | `src/index.css` | `@media (prefers-reduced-motion: reduce)` strips the transform transition | ✅ |
| Button `active:scale-[0.94]` | `Button.tsx` | `motion-reduce:active:scale-100 disabled:scale-100` classes | ✅ |
| WorkspaceCard grid-template-rows + transform + opacity | `WorkspaceCard.tsx` | `[data-card-body] { transition: none !important }` at `src/index.css` | ✅ |
| WorkspaceCard motion-safe hover lift | `WorkspaceCard.tsx` | `motion-safe:hover:-translate-y-[1px]` prefix applies only when motion is allowed | ✅ |
| Toast entrance curve | `src/index.css` | Uses `var(--ease-emphasized)` for normal motion; global `@media (prefers-reduced-motion: reduce)` disables `toast-in` | ✅ |
| Dialog transition curve | `src/components/ui/Dialog.tsx` | App-level `<MotionConfig reducedMotion="user">` handles reduced motion; Slice 4 greps/tests verify the emphasized tuple | ✅ |
| DropdownMenu transition curve | `src/components/ui/DropdownMenu.tsx` | App-level `<MotionConfig reducedMotion="user">` handles reduced motion; Slice 4 greps/tests verify the spring tuple | ✅ |
| Sheet transition curve | `src/components/ui/Sheet.tsx` | App-level `<MotionConfig reducedMotion="user">` handles reduced motion; Slice 4 greps/tests verify the emphasized tuple | ✅ |
| Tooltip transition curve | `src/components/ui/Tooltip.tsx` | App-level `<MotionConfig reducedMotion="user">` handles reduced motion; Slice 4 greps/tests verify the spring tuple | ✅ |

| Correlation Graph keyboard focus ring | `src/components/correlation-graph/CorrelationGraph.tsx` | Static outline and node glow only; no motion, no guard needed. Phase 06B Commit 4 introduced no new animated surfaces. | âœ… |

| Correlation Graph zoom controls | `src/components/correlation-graph/CorrelationGraph.tsx` | `graph.zoomTo()` and `graph.fitView()` use `{ duration: 180, easing: 'ease-out' }` only when motion is allowed; reduced motion and large-graph mode pass `false` for instant viewport updates. | âœ… |
| Correlation Graph layout reset | `src/components/correlation-graph/CorrelationGraph.tsx` | Reset reuses the force-layout config; `animation: false` is applied when reduced motion or large-graph mode is active before `graph.layout()` reruns. | âœ… |
| Correlation Graph large-graph overlay | `src/components/correlation-graph/CorrelationGraph.tsx` | Static dialog mount only; no motion, no guard needed. | âœ… |

### 2.8 - Phase 05 additions carried forward

| Surface | File | Reduced-motion handling | Status |
|---|---|---|---|
| `CitationJumpChip` fade-in | `citation-jump.css` | `motion-reduce:animate-none` on the chip root | ✅ |
| Container pulse on `[data-surface="log-stream"][data-citation-just-arrived="true"]` | `citation-jump.css` | `@media (prefers-reduced-motion: reduce) { animation: none }` | ✅ |
| Phase 02 row highlight fade | Phase 02 retrofit | `@media (prefers-reduced-motion: reduce) { transition-duration: 0s }` | ✅ |
| `bundle-pulse` keyframe | Phase 05 C4 | `motion-safe:animate-[bundle-pulse_...]` prefix means it never runs under reduced motion | ✅ |
| Tier-driven glow on `[data-tier="live"]` | Phase 05 C5 | `@media (prefers-reduced-motion: reduce) { animation: none }` - static shadow only | ✅ |
| Rail flex layout | Phase 05 C6 | No animation - layout is instant | ✅ |

---

## Section 3 - Verification method

Re-run these checks after any new animated surface lands:

1. `git grep -n 'transition-all' src/` -> returns only intentional test-regex assertions.
2. `git grep -nE "animation:\s*['\"]?spin\b" src/` -> returns 0 matches.
3. `git grep -n "animate-spin" src/` -> returns only `src/components/ui/Spinner.tsx` plus Spinner test assertions.
4. `npx vitest run` -> desired repo gate: full suite green. For the Phase 06A C9 docs-only run on 2026-04-22, this command was red due to unrelated existing failures in `src/contexts/__tests__/EvidenceContext.test.tsx` and `.worktrees/ui-overhaul*/src/services/__tests__/llmService.test.ts`, so treat Vitest as a separate baseline-triage task rather than evidence against this audit update.
5. Manual: toggle OS reduce motion on Windows; open the app in Import / Investigate / Submit and confirm:
   - All production spinner surfaces render `<Spinner />` and remain static under reduced motion
   - Anime-backed count and stagger surfaces snap directly to their final state
   - Dialog / DropdownMenu / Tooltip / Sidebar / Sheet appear and disappear without animation when reduced motion is active
   - Toast entrance and room transitions are static under reduced motion
   - Card expand/collapse and focus-mode toggles remain instant

Programmatic expectation: extend existing Vitest coverage whenever a new animated surface lands, asserting the `motion-reduce:` class, reduced-motion media-query handling, or App-level motion wiring as appropriate.

---

## Section 4 - Follow-up status (Phase 06A close-out)

The original Phase 05 hand-off items are now retired:

1. **Spin indicator sweep** - retired in Phase 06A C1/C2 via the shared `<Spinner />` primitive.
2. **Anime.js hook-level guard** - retired in Phase 06A C3 via `usePrefersReducedMotion()` guards in `useAnimeStagger`, `useAnimeTimeline`, and `useAnimeValue`.
3. **Motion/react primitive verification** - retired in Phase 06A C4 via the app-level `<MotionConfig reducedMotion="user">`; Slice 4 greps/tests cover the Direction C curve tuples for Dialog, DropdownMenu, Sheet, and Tooltip.

No reduced-motion cleanup debt remains from the original Phase 05 audit. Remaining post-polish hand-offs are feature-scope items rather than motion regressions:

- Correlation Graph card - Phase 06B
- Case library learning loop - Phase 06C
- Standalone Tauri packaging - Phase 07
- Shared `transitions.ts` motion preset library - optional future cleanup

---

## Summary

- **Phase 06A Commit 9 consolidates:** all Phase 05 reduced-motion follow-ups retired in one audit pass after the Wave 1 slices merged.
- **Verified compliant surfaces now include:** global keyframes, loading.css, focus-mode, Spinner-based indicators, anime.js hook consumers, app-level `motion/react` primitives, and all documented Direction C transition surfaces.
- **Open reduced-motion debt from the original Phase 05 audit:** 0.

Future motion work should append new rows for new surfaces rather than reopening the retired Phase 05 / Phase 06A entries.

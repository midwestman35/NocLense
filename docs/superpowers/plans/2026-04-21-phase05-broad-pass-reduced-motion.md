# Phase 05 — Broad Pass + Citation-Jump Polish + Reduced-Motion Audit

> **For agentic workers:** Read spec §6.1, §6.2, §6.4, §4.2, §4.8,
> §3.3, §3.4, §5.4, §5.5, §8 before starting. Implement task-by-task
> in commit order. Stop after each commit's self-assessment and wait
> for overview.

---

## Revision log

**v1 → v2 (initial Codex adversarial review):** NO-GO on 4 blockers and several yellows. See v2 source (superseded by this file).

**v2 → v3 (post-Phase-04.5 rewrite + v2 blocker resolution):**

| # | v2 blocker | v3 resolution |
|---|---|---|
| 1 | Rail CSS structurally wrong — pure-CSS sibling reassignment overlaps siblings in the same rail cell | Commit 6 switches to a **DOM split** via `InvestigateGridInner`. When a card is focused, the grid owner partitions children into a focused-column + a rail-flex-column. No CSS specificity wars, no `!important` cascade override. |
| 2 | Rail interaction model was ambiguous — header click had overloaded behavior, div-with-role="button" + inner focus icon = two targets for one action | Commit 6 renders each rail strip as a real `<button>` wrapping the header, replaces header `<div>` in rail mode, and suppresses the inner focus-icon button entirely when in rail mode. Single AT target per strip; Enter/Space transfers focus. Double-click on rail strip = no-op (no expand/collapse conflict). |
| 3 | Reduced-motion audit scope incomplete — only 5 transition-all fixes + shortlist of surfaces; missed Motion/anime/inline spin/global keyframes | Commit 1 expands the audit to a full sweep of every animated surface. Scope includes: `motion/react` usage in dialog/dropdown/sheet/tooltip/sidebar/evidence panel; anime.js usage in LogStreamHeader; inline `@keyframes spin` in AI button/AI panel/Zendesk panel; all global keyframes in `src/index.css` + `src/styles/loading.css`; and the new Phase 04.5 animations (btn-press-bounce, WorkspaceCard grid-template-rows, motion-safe hover lift). Audit report has a "covered by" column for every surface. |
| 4 | Correlation Graph deferral conflicted with spec §6.1 | **Spec amendment in Commit 6:** moves Correlation Graph card from Phase 05 "broad pass" to Phase 06A "feature work — graph surfaces." Rationale documented in spec §6.1 and §6.5 edit: graph implementation (node layout algo, edge co-occurrence, traceId integration, interactive selection) is categorically feature work, not polish. Phase 05 leaves the existing Correlation Graph stub text unchanged. |

**Post-Phase-04.5 baseline adjustments:**

- Direction C tokens live (warmed neutrals, motion tokens, type tracking)
- `btn-press-bounce` class + Button `active:scale-[0.94]` is the new baseline — reduced-motion audit adds it to "covered by" column
- WorkspaceCard uses `grid-template-rows` + container transform (replaces the old height-only JS animation) — audit covers it
- `motion-safe:hover:-translate-y-[1px]` on card root — audit covers it
- `WorkspaceCard` accepts `dataAttributes` prop (Phase 04.5 Commit 5) → Commit 5 (Datadog Live glow) is simplified: no primitive amendment needed.
- Destructive fill darkened to `#d93434` (WCAG AA) + `--shadow-glow-error` rgba matched. No change needed in Phase 05.
- `--glow-ready` color token restored (LogRow citation highlight renders with a real color now).

**Also addressed:** Codex hand-off from Phase 04.5 review — add a direct `data-focus-target` clobber test. Folded into Commit 5 where that test file is already open for editing.

---

## Context

Phase 04 shipped (focus-mode + polish, 537 tests). Phase 04.5 shipped (Direction C visual refresh, 546 tests at `d0e45c9`). Phase 05 is the final polish phase before the post-polish feature phases (Phase 06 case library, Phase 06A Correlation Graph, Phase 07 Tauri packaging).

**Spec anchors:**
- §6.1 — Broad pass outside the trio
- §6.2 — Cross-surface motion choreographies (citation-jump scope)
- §6.4 — Validation bars (reduced-motion row)
- §4.2 / §4.8 — Interruption rule + `transition: all` prohibition + reduced-motion must-have
- §3.3 / §3.4 — Glow tiers + shadow scale
- §5.4 — Evidence bundle-size pulse
- §5.5 / §8 — Rail-ratio open item resolution

**Tech stack:** React 19, TypeScript strict, Tailwind 4, CSS custom properties, Vitest + Testing Library. No new dependencies. Uses existing `RoomLiveStateProvider` from Phase 01a increment 7.

---

## Foundation assumptions (verify before first commit)

1. `src/contexts/RoomLiveStateContext.tsx` exports `useLiveSurface(id, kind)` and `useSurfaceTier(id)`. Verified in v2 Codex review; still current.
2. `src/styles/tokens.css` has `--shadow-glow-ready`, `--shadow-glow-live`, `--shadow-glow-error` shadow tokens AND the newly-restored `--glow-ready` color token (Phase 04.5 Commit 2).
3. `WorkspaceCard` accepts `dataAttributes: Record<\`data-${string}\`, string | undefined>` (Phase 04.5 Commit 5) with reserved-key filtering. Commit 5 of this phase consumes it without primitive changes.
4. `EvidenceContext.loadGeneration` counter from Phase 04 Commit 4 is still the source of truth for "deliberate reload." Commit 4 of this phase uses it to key the bundle-size pulse trigger.
5. Citation-jump data path is end-to-end from Phase 02 (`LogViewer.jumpToCitation` imperative ref, LogContext jump state). Citation notice state lives in `LogContext` + `LogViewer`, **not** in the workspace shell — Commit 2 respects that ownership.
6. WorkspaceCard root has Direction C hover lift classes (`motion-safe:hover:-translate-y-[1px]`, `ease-[var(--ease-spring)]`). Commit 6's rail-strip rendering keeps them.

---

## Non-goals (Phase 05 explicit carve-outs)

- **Correlation Graph card rendering.** Moved to Phase 06A via spec amendment in Commit 6. See revision log blocker #4.
- **Real Datadog streaming transport.** Commit 5 wires the glow tier via `useLiveSurface`, exposes the `store.notify()` hook for dev smoke + tests. Actual streaming is a future feature project.
- **URL-paste → investigate flow on Import Room.** Zendesk ticket intake already exists at `WorkspaceImportPanel.tsx:59, 162, 200, 244` (surfaced by Phase 04.5 mood board audit). This exploration does not redesign it; if URL-paste becomes a broader concern, that's Phase 06+ territory.
- **UI-level export→import round-trip smoke via Playwright.** Phase 06.
- **Non-log citation URL-opening policy audit.** Phase 06.
- **SubmitRoom integration test harness with real EvidenceProvider.** Phase 06.
- **Command palette / Ctrl+K.** Deferred per spec §7.
- **New dependencies.** None.

---

## File map

### New files
```
docs/perf/reduced-motion-audit.md                                    (Commit 1)
src/components/workspace/CitationJumpChip.tsx                         (Commit 2)
src/components/workspace/__tests__/CitationJumpChip.test.tsx          (Commit 2)
src/styles/citation-jump.css                                          (Commit 2)
src/hooks/useBundleSizePulse.ts                                       (Commit 4)
src/hooks/__tests__/useBundleSizePulse.test.ts                        (Commit 4)
```

### Modified files
```
src/components/AIAssistantDropdown.tsx                               (Commit 1, transition-all fix)
src/components/ui/ToggleChip.tsx                                      (Commit 1)
src/components/workspace/PhaseDots.tsx                                (Commit 1 + Commit 3)
src/components/workspace/PhaseHeader.tsx                              (Commit 3)
src/components/import/WorkspaceImportPanel.tsx                       (Commit 1, progress-bar transition-all fix)
src/components/LogViewer.tsx                                          (Commit 2)
src/components/LogStreamHeader.tsx                                    (Commit 2)
src/components/workspace/WorkspaceGrid.tsx                            (Commit 6, InvestigateGridInner rewrite)
src/components/workspace/WorkspaceCard.tsx                            (Commit 6, rail-strip render branch)
src/components/workspace/__tests__/WorkspaceCard.test.tsx             (Commit 6 + Phase 04.5 hand-off test)
src/components/workspace/NewWorkspaceLayout.tsx                       (Commit 4 + Commit 5)
src/styles/focus-mode.css                                             (Commit 6, rail CSS rewrite)
src/styles/tokens.css                                                 (Commit 2 + Commit 4 keyframes)
src/index.css                                                         (Commit 2 import)
docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md        (Commit 6, §5.5/§6.1/§6.5/§8 edits)
```

---

## Commit 1 — Reduced-motion audit (expanded scope) + §4.2 `transition-all` sweep

### §4.2 violations to fix (5 locations, confirmed via grep)

| File:line | Current | Replacement |
|---|---|---|
| `src/components/AIAssistantDropdown.tsx:26` | `transition-all` | `transition-[background-color,border-color,color] duration-150` |
| `src/components/import/WorkspaceImportPanel.tsx:330` | `transition-all duration-300` (progress bar width) | `transition-[width] duration-300 motion-reduce:transition-none` |
| `src/components/ui/ToggleChip.tsx:59` | `transition-all duration-200` | `transition-[background-color,border-color,color] duration-200` |
| `src/components/workspace/PhaseDots.tsx:37` | `transition-all duration-300` | `transition-[background-color,color,transform] duration-300 motion-reduce:transition-none` |
| `src/components/workspace/PhaseDots.tsx:46` | `transition-all duration-300` | `transition-[background-color,transform,opacity] duration-300 motion-reduce:transition-none` |

### Audit report — `docs/perf/reduced-motion-audit.md`

**Required structure:**

```markdown
# Reduced-Motion Audit — Phase 05 (post-Direction-C baseline)

**Date:** 2026-04-21
**Scope:** Every animated surface reachable in normal app flow
**Spec gates:** §4.2 (no `transition: all`), §4.8 (reduced-motion fallback everywhere)

## Section 1 — §4.2 compliance

After Commit 1 lands: `git grep -n 'transition-all' src/` returns 0 matches.

## Section 2 — Surface coverage matrix

Every animated surface is listed with:
- Surface (component file or CSS rule)
- Animation engine (CSS transition / CSS @keyframes / motion/react / anime.js / inline style)
- Trigger (mount, state change, hover, etc.)
- Reduced-motion handling (motion-safe: prefix / motion-reduce: override / media query / useReducedMotion hook / n/a if binary)
- Status (✅ compliant / ⚠️ needs work / 🔒 blocked)

Required categories to audit:
- **motion/react surfaces:** Dialog, DropdownMenu, Sheet, Tooltip, Sidebar, EvidencePanel, CanonicalBlockRenderer
- **anime.js surfaces:** LogStreamHeader (stagger)
- **Inline spin keyframes:** AIAssistantButton, AIPanel, ZendeskPanel
- **Global @keyframes:** `phase-dot-pulse`, `evidence-add`, `room-fade-in`, `toast-in`, `shimmer` (all in src/index.css), `btn-press-bounce` (Phase 04.5), all tui-*-cycle + glow-live-pulse (loading.css), focus-mode transitions (focus-mode.css)
- **Phase 04.5 additions:** Button `active:scale-[0.94]`, WorkspaceCard grid-template-rows + transform + opacity, motion-safe hover translate, `.btn-press-bounce` class
- **Phase 05 new (Commit 2+):** citation-jump chip, citation-jump container pulse, bundle-size pulse (Commit 4), Datadog Live tier CSS (Commit 5), rail transition (Commit 6)

Every row should be ✅ or documented with a fix plan. No unverified rows.

## Section 3 — Verification method

1. `git grep -n 'transition-all' src/` → 0 matches
2. `git grep -nE '(animation:|transition:)' src/` — every hit either has a `motion-safe:`/`motion-reduce:` Tailwind prefix, an `@media (prefers-reduced-motion: reduce)` parent, a `useReducedMotion()` guard, or is binary (display: none)
3. Manual smoke in Windows Electron with OS "reduce motion" toggled on — every interactive demo from the Direction C mood board and the live app continues to function with motion disabled
```

### Commit 1 task list

- [ ] **Step 1:** Write `docs/perf/reduced-motion-audit.md` per structure above. Sections 1–3 complete. Status column fully filled.
- [ ] **Step 2–6:** Apply the 5 `transition-all` fixes above.
- [ ] **Step 7:** Grep verification — `git grep -n 'transition-all' src/` returns 0.
- [ ] **Step 8:** Extend `PhaseDots.test.tsx` with regression assertions: no `transition-all` class, `motion-reduce:transition-none` present.
- [ ] **Step 9:** Extend `ToggleChip.test.tsx` (create if absent) with the same regression.
- [ ] **Step 10:** Verify (`tsc --noEmit`, `vitest run`, `eslint <scoped files>`).
- [ ] **Step 11:** Commit message: `feat(phase-05): reduced-motion audit report + §4.2 transition-all sweep (expanded scope)`

---

## Commit 2 — Citation-jump polish animation

### Scope

Spec §6.2's only in-scope cross-surface choreography. Phase 02 delivered the data path. Phase 05 adds:

1. **`CitationJumpChip` component** — header chip "⟵ jumped from H1" with a motion-safe fade-in keyframe.
2. **Container pulse CSS** — 200ms inset box-shadow flash on the Log Stream viewport after a jump.
3. **Row highlight motion-reduce guard** — the existing static background fade gets a proper `motion-reduce:transition-duration: 0s` guard added (it was missing in Phase 02's delivery).

### Ownership correction from v2

The v2 plan said "`NewWorkspaceLayout` owns citation jump state." That was **wrong** — state lives in `LogContext` + `LogViewer` (confirmed during mood-board audit, see `docs/design-exploration/.../README.md` §J #3). v3 wires the chip via the existing `LogContext.citationJumpSource`-style state (exact name TBD after reading LogContext).

Before writing Commit 2's `CitationJumpChip` integration, the implementor MUST:

1. Read `src/contexts/LogContext.tsx` and `src/components/LogViewer.tsx` fully.
2. Identify the actual state variable name that carries jump-source info (rank, label).
3. Plumb it into `LogStreamHeader` as a prop, not through the workspace shell.

### Chip component

Exported from `src/components/workspace/CitationJumpChip.tsx`:

```tsx
export interface CitationJumpSource {
  hypothesisRank?: 1 | 2 | 3;
  label?: string;
}

export interface CitationJumpChipProps {
  source: CitationJumpSource | null;
  onDismiss: () => void;
}

export function CitationJumpChip({ source, onDismiss }: CitationJumpChipProps): JSX.Element | null;
```

Behavior:
- Returns `null` when `source === null`.
- Renders `⟵ jumped from H2` when `source.hypothesisRank === 2`.
- Auto-dismisses after 4000ms (clears via `onDismiss`).
- Dismissible via `×` button.
- `role="status"` on the root.
- Fade-in via `@keyframes chip-enter` (defined in tokens.css or citation-jump.css).
- `motion-reduce:animate-none` so reduced-motion shows the chip instantly.

### Container pulse CSS — `src/styles/citation-jump.css`

```css
/* Brief inset pulse on the Log Stream viewport after a citation jump */
[data-surface="log-stream"][data-citation-just-arrived="true"] {
  animation: citation-jump-pulse 200ms var(--ease-enter-out) both;
}

@keyframes citation-jump-pulse {
  from { box-shadow: inset 0 0 0 2px var(--glow-ready, transparent); }
  to   { box-shadow: inset 0 0 0 0 transparent; }
}

@media (prefers-reduced-motion: reduce) {
  [data-surface="log-stream"][data-citation-just-arrived="true"] {
    animation: none;
  }
}

/* Motion-reduce guard on the Phase 02 row highlight fade (was missing) */
@media (prefers-reduced-motion: reduce) {
  [data-log-row-highlighted="true"] {
    transition-duration: 0s !important;
  }
}
```

Import from `src/index.css`:
```css
@import './styles/citation-jump.css';
```

### LogViewer wiring

The LogViewer container receives `data-surface="log-stream"`. On a jump, set `data-citation-just-arrived="true"` for 200ms via small imperative DOM update, then clear. No state management needed — the DOM attribute is the source of truth for the CSS animation.

### Commit 2 task list

- [ ] **Step 1:** Read `src/contexts/LogContext.tsx` + `src/components/LogViewer.tsx` to identify the actual jump-source state variable name. Document the finding at the top of the commit message.
- [ ] **Step 2:** Create `src/components/workspace/CitationJumpChip.tsx` per the shape above.
- [ ] **Step 3:** Create the chip test file with these cases: null source → null render, hypothesis rank shown, auto-dismiss after 4s, × click dismisses, role=status present, motion-reduce bypasses animation.
- [ ] **Step 4:** Create `src/styles/citation-jump.css` with the two keyframe + motion-reduce blocks above.
- [ ] **Step 5:** Import the new CSS from `src/index.css`.
- [ ] **Step 6:** Wire the chip via `LogStreamHeader` (pass `citationJumpSource` + `onDismiss` as props). Read the existing `LogStreamHeader` signature first and extend it carefully.
- [ ] **Step 7:** Add `data-surface="log-stream"` to the LogViewer scroll container root. Add the 200ms imperative `data-citation-just-arrived` toggle on jump.
- [ ] **Step 8:** Verify the Phase 02 row highlight CSS has a `data-log-row-highlighted="true"` attribute or equivalent so the motion-reduce guard targets the right element. If not, either retrofit the attribute or generalize the guard selector.
- [ ] **Step 9:** Verify + commit. Message: `feat(phase-05): citation-jump polish — chip + container pulse + reduced-motion guards`

---

## Commit 3 — PhaseHeader + PhaseDots token polish

### Scope

Smaller than v2 anticipated — most of the work is verification, not editing. PhaseHeader already has `tabular-nums` on the ticket ID (line 60 confirmed). PhaseDots had its `transition-all` fixed in Commit 1.

Remaining work:
1. Add `style={{ textWrap: 'pretty' }}` to the status label span in PhaseHeader.
2. Add `font-variant-numeric: tabular-nums` everywhere counters, byte sizes, timestamps appear in PhaseHeader (should be no-op if `tabular-nums` class is already applied globally via `src/index.css:31–32`).
3. Verify PhaseHeader consumes the Direction C background/border values via CSS variables — no hardcoded colors remain.

### Commit 3 task list

- [ ] **Step 1:** Add text-wrap + verify token usage in PhaseHeader.
- [ ] **Step 2:** Extend PhaseHeader test to assert: status label uses `text-wrap: pretty`, ticket ID still has `tabular-nums`, header uses `var(--header-surface)`/`var(--header-highlight)`.
- [ ] **Step 3:** Verify + commit. Message: `feat(phase-05): PhaseHeader text-wrap + token verification`

---

## Commit 4 — Evidence bundle-size pulse on 100 KB boundaries

### Scope (unchanged from v2)

Hook + badge wiring per spec §5.4.

Address v2 Codex yellow on Commit 4:
1. **Byte count correctness:** use `TextEncoder().encode(...).byteLength` inside `useMemo`, NOT `JSON.stringify(...).length` (which counts UTF-16 code units).
2. **Render-time side effect:** bump the pulse key in a `useEffect`, not during render. Use a `previousBucketRef` and compare in the effect.

### Hook contract

```typescript
// src/hooks/useBundleSizePulse.ts

export interface UseBundleSizePulseResult {
  sizeBytes: number;
  pulseKey: number;  // increments on every 100 KB boundary crossing
}

export function useBundleSizePulse(evidenceSet: EvidenceSet | null): UseBundleSizePulseResult;
```

Implementation sketch:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceSet } from '../types/canonical';

const BOUNDARY_BYTES = 100 * 1024;

export function useBundleSizePulse(evidenceSet: EvidenceSet | null): UseBundleSizePulseResult {
  const sizeBytes = useMemo(() => {
    if (!evidenceSet) return 0;
    try {
      return new TextEncoder().encode(JSON.stringify(evidenceSet)).byteLength;
    } catch {
      return 0;
    }
  }, [evidenceSet]);

  const [pulseKey, setPulseKey] = useState(0);
  const lastBucketRef = useRef(Math.floor(sizeBytes / BOUNDARY_BYTES));

  useEffect(() => {
    const bucket = Math.floor(sizeBytes / BOUNDARY_BYTES);
    if (bucket !== lastBucketRef.current) {
      lastBucketRef.current = bucket;
      setPulseKey((k) => k + 1);
    }
  }, [sizeBytes]);

  return { sizeBytes, pulseKey };
}
```

No mutation during render. No JSON.stringify-as-byte-count.

### Tests (unchanged shape from v2, updated for the effect-based bump)

- Returns 0 for null set.
- Size reflects real serialized byte count (TextEncoder).
- `pulseKey` stays stable within a bucket.
- `pulseKey` bumps after `useEffect` fires following a boundary crossing (needs `act()` + a rerender to observe).

### Commit 4 task list

- [ ] **Step 1:** Create `useBundleSizePulse.ts` with the effect-based pattern above.
- [ ] **Step 2:** Create the test file. Note: testing effect-based ref mutation needs `renderHook` with a `rerender` + `act` around the input change.
- [ ] **Step 3:** Wire `EvidenceBadge` in `NewWorkspaceLayout.tsx` to consume the hook + use `key={pulseKey}` to remount the badge at each boundary.
- [ ] **Step 4:** Add the `bundle-pulse` keyframe to `tokens.css` (3-phase scale pulse).
- [ ] **Step 5:** Verify + commit. Message: `feat(phase-05): Evidence bundle-size pulse on 100KB boundaries (TextEncoder-based)`

---

## Commit 5 — Datadog Live card glow wiring + Phase 04.5 hand-off test

### Scope

Wire the Datadog Live card accent to `useLiveSurface`/`useSurfaceTier`. Simpler than v2 because `WorkspaceCard.dataAttributes` is live (Phase 04.5 Commit 5).

### Integration

In `NewWorkspaceLayout.tsx`:

```tsx
function DatadogLiveCard(): JSX.Element {
  useLiveSurface('datadog-live', 'datadog-stream');
  const tier = useSurfaceTier('datadog-live');
  const accent = tierToAccent(tier);

  return (
    <WorkspaceCard
      id="datadog-live"
      title="Datadog Live"
      icon={<Database size={14} />}
      accentColor={accent}
      defaultExpanded={false}
      className={CARD_GRID_CLASSES['datadog-live']}
      dataAttributes={{
        'data-surface': 'datadog-live',
        'data-tier': tier,
      }}
    >
      <div className="p-3 text-xs text-[var(--muted-foreground)]">
        <p>Streaming production errors from Datadog API.</p>
        <p className="mt-2 text-[9px] uppercase tracking-wider">Tier: {tier}</p>
      </div>
    </WorkspaceCard>
  );
}
```

Tier-driven CSS lives in `src/styles/tokens.css` or a new `src/styles/live-state.css`:

```css
[data-tier="ready"] { box-shadow: var(--shadow-glow-ready); }
[data-tier="live"] {
  box-shadow: var(--shadow-glow-live);
  animation: glow-live-pulse 1.8s ease-in-out infinite;
}
[data-tier="alert"] { box-shadow: var(--shadow-glow-error); }
@media (prefers-reduced-motion: reduce) {
  [data-tier="live"] { animation: none; }
}
```

`glow-live-pulse` keyframe already exists in `loading.css` — reuse it; do not redeclare.

### Phase 04.5 hand-off test (folded in)

While the WorkspaceCard test file is already open: add one more test asserting `data-focus-target` cannot be clobbered through `dataAttributes`. Per Codex's Phase 04.5 hand-off: "add an explicit `data-focus-target` clobber test when Phase 05 touches the primitive again."

```typescript
it('does not forward reserved data-focus-target key', () => {
  const { container } = render(
    <CardFocusProvider>
      <WorkspaceCard
        id="t1"
        title="Card"
        icon={null}
        accentColor="#000"
        dataAttributes={{ 'data-focus-target': 'true' }}  // should be ignored
      >
        body
      </WorkspaceCard>
    </CardFocusProvider>
  );
  const root = container.querySelector('[data-card-id="t1"]')!;
  expect(root).toHaveAttribute('data-focus-target', 'false');
});
```

### Commit 5 task list

- [ ] **Step 1:** Add `DatadogLiveCard` inner component in `NewWorkspaceLayout.tsx`.
- [ ] **Step 2:** Add tier-driven CSS block (prefer `src/styles/live-state.css` — new file — to avoid bloating `tokens.css`).
- [ ] **Step 3:** Import `live-state.css` from `src/index.css`.
- [ ] **Step 4:** Add `DatadogLiveCard.test.tsx` (or extend `NewWorkspaceLayout` tests) with: default-on-mount tier = `ready`; after `store.notify('datadog-live', 'datadog-stream')`, tier = `live`.
- [ ] **Step 5:** Add the data-focus-target clobber test to `WorkspaceCard.test.tsx`.
- [ ] **Step 6:** Verify + commit. Message: `feat(phase-05): Datadog Live card glow via RoomLiveStateProvider (+ data-focus-target clobber guard)`

---

## Commit 6 — Visible rail for focused siblings + spec amendment

### Scope

1. **Rail implementation via DOM split** (v2 blocker #1 fix).
2. **Rail click + AT model** (v2 blocker #2 fix).
3. **Spec amendments:**
   - §5.5 — rail ratio resolved (80px right-side rail).
   - §6.1 — Correlation Graph moved to Phase 06A.
   - §6.5 — Phase row updated to reflect Phase 06A.
   - §8 — rail open item closed (moved to "resolved in Phase 05 Commit 6").

### Rail implementation — DOM split

In `src/components/workspace/WorkspaceGrid.tsx`, rewrite `InvestigateGridInner`:

```tsx
function InvestigateGridInner({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  const focus = useCardFocus();
  const focusedId = focus?.focusedCardId ?? null;

  if (focusedId) {
    return (
      <FocusedInvestigateLayout
        focusedId={focusedId}
        className={className}
      >
        {children}
      </FocusedInvestigateLayout>
    );
  }

  // Default (non-focused) — existing 3-column grid
  return (
    <div
      data-layout="investigate"
      data-room="investigate"
      className={clsx('h-full min-h-0 grid gap-2 p-2 overflow-hidden', className)}
      style={{
        gridTemplateColumns: '1fr 1fr 340px',
        gridTemplateRows: 'auto 1fr auto',
        background: 'var(--room-investigate-bg)',
      }}
    >
      {children}
    </div>
  );
}

function FocusedInvestigateLayout({
  focusedId,
  className,
  children,
}: {
  focusedId: string;
  className?: string;
  children: ReactNode;
}) {
  const focused: ReactNode[] = [];
  const rails: ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    // Only WorkspaceCard children are expected here; use a prop guard.
    const cardId = (child.props as { id?: string }).id;
    if (cardId === focusedId) focused.push(child);
    else rails.push(child);
  });

  return (
    <div
      data-layout="investigate"
      data-room="investigate"
      data-focused={focusedId}
      className={clsx('h-full min-h-0 grid gap-2 p-2 overflow-hidden', className)}
      style={{
        gridTemplateColumns: '1fr 80px',
        gridTemplateRows: '1fr',
        background: 'var(--room-investigate-bg)',
      }}
    >
      <div style={{ gridColumn: 1, gridRow: 1, minHeight: 0, overflow: 'hidden' }}>
        {focused}
      </div>
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Other cards"
        style={{
          gridColumn: 2,
          gridRow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto',
        }}
      >
        {rails}
      </div>
    </div>
  );
}
```

Focused-card children are rendered inside their own div with `gridColumn: 1`. Rail siblings are rendered inside a flex-column with `gridColumn: 2`. Each `WorkspaceCard`'s internal `CARD_GRID_CLASSES` classes become inert (no grid parent for them), which is fine — they just fill their parent.

### Rail strip rendering in `WorkspaceCard`

When `focusCtx.focusedCardId !== null && focusCtx.focusedCardId !== id`, the card is in "rail mode." Render a compact strip:

```tsx
const isRailMode = focusCtx !== undefined
  && focusCtx.focusedCardId !== null
  && focusCtx.focusedCardId !== id;

if (isRailMode) {
  return (
    <button
      type="button"
      role="tab"
      aria-label={`Focus ${title}`}
      onClick={() => focusCtx.toggleFocus(id)}
      data-card-id={id}
      data-focus-target="false"
      data-rail-strip="true"
      className={clsx(
        'flex items-center gap-2 px-3 w-full text-left',
        'rounded-[var(--card-radius)] border bg-[var(--card)]',
        'border-[var(--card-border)] hover:border-[var(--card-border-hover)]',
        'transition-[transform,border-color] duration-[var(--duration-slow)] ease-[var(--ease-spring)]',
        'motion-safe:hover:-translate-y-[1px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--card-border-hover)]',
      )}
      style={{
        height: 'var(--card-header-height)',
        minHeight: 'var(--card-header-height)',
      }}
    >
      <span
        className="block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      {icon}
      <span className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-[0.5px] truncate">
        {title}
      </span>
    </button>
  );
}

// Normal render path below (unchanged from Phase 04.5)
```

Clean AT model:
- One real `<button>` as the strip — not a div-with-role.
- No inner focus-icon button in rail mode (the whole strip IS the toggle).
- No header double-click handler in rail mode (the strip's `onClick` is the only handler).
- `role="tab"` + parent `role="tablist"` for screen readers.
- `aria-label` describes the action clearly.

### Focus-mode CSS changes

Replace `display: none` rule in `src/styles/focus-mode.css`. New rules:

```css
/* Focused card in the focused-column wrapper */
[data-layout="investigate"][data-focused] [data-card-id][data-focus-target="true"] {
  height: 100%;
  /* No grid-column/row — parent div already pins it to column 1 */
}

/* Rail strips: the `<button data-rail-strip="true">` is the only thing
   rendered for non-focused cards (see WorkspaceCard rail render branch).
   This rule is preventive — if any non-focused card somehow renders its
   full body, hide it. */
[data-layout="investigate"][data-focused] [data-card-id][data-focus-target="false"]:not([data-rail-strip]) {
  display: none;
}
```

### Spec amendments

In `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`:

- **§5.5:** `"Phase 05 ships this."` → `"Phase 04 ships the baseline; Phase 05 ships the visible rail."`
- **§6.1:** Remove the Correlation Graph bullet; replace with: `"Correlation Graph card — moved to Phase 06A (see §6.5). Existing stub text remains until the card is implemented."`
- **§6.5 Phase 05 row:** Add `+ spec cleanup` to the scope.
- **§6.5 table:** Add Phase 06A row: `**06A** | **Correlation Graph card.** One node per extracted correlation ID (traceId, callId, stationId, etc.); edges for co-occurrence; layout algo; interactive selection. Net-new feature work; categorically not polish. | Codex |`
- **§8 open items:** Remove the rail-ratio line; add "✅ Resolved in Phase 05 Commit 6 — 80px right-side rail, DOM-split via InvestigateGridInner, strip renders as a single `<button role="tab">`."

### Commit 6 task list

- [ ] **Step 1:** Extract `FocusedInvestigateLayout` in `WorkspaceGrid.tsx`. Partition children by card id using `React.Children.forEach` + prop guard.
- [ ] **Step 2:** Add the rail-strip render branch in `WorkspaceCard.tsx`. Preserve the normal render path below.
- [ ] **Step 3:** Update `src/styles/focus-mode.css` per the rewrite above.
- [ ] **Step 4:** Extend `WorkspaceCard.test.tsx` with rail-mode tests:
  - Rail strip renders as a `<button role="tab">` when not focused + provider has some other focused card.
  - Click on rail strip transfers focus (calls `toggleFocus(id)`).
  - Enter key on rail strip transfers focus (native button behavior).
  - No inner focus-icon button when in rail mode (query for `aria-label="Focus <title>"` on the parent button, not on a separate icon button).
  - No `onDoubleClick` handler in rail mode (no expand-toggle conflict).
- [ ] **Step 5:** Extend `WorkspaceGrid.test.tsx` with: focused-card renders in `gridColumn: 1` area; non-focused cards render in `gridColumn: 2` rail; `role="tablist"` on rail container.
- [ ] **Step 6:** Apply the spec amendments listed above.
- [ ] **Step 7:** Verify + commit. Message: `feat(phase-05): visible rail for focused-card siblings + spec §5.5/§6.1/§6.5/§8 cleanup`

---

## Commit summary

| # | Commit | Files touched |
|---|---|---|
| 1 | Reduced-motion audit + `transition-all` sweep | 1 new doc + 5 file fixes + 2 tests |
| 2 | Citation-jump polish — chip + container pulse | 1 new component + test + CSS + LogViewer + LogStreamHeader wiring |
| 3 | PhaseHeader text-wrap + token verification | 1 modified + test |
| 4 | Evidence bundle-size pulse | 1 new hook + test + badge wiring + keyframe |
| 5 | Datadog Live glow via RoomLiveStateProvider (+ clobber guard) | 1 layout + 1 CSS + 1 test + WorkspaceCard test add |
| 6 | Visible rail + spec §5.5/§6.1/§6.5/§8 cleanup | WorkspaceGrid + WorkspaceCard + focus-mode.css + spec edits + tests |

---

## Verification checklist (phase close-out)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` — all tests pass (current baseline 546 + Phase 05 new tests; target ~570+)
- [ ] `npx eslint <scoped files>` — clean
- [ ] `git grep -n 'transition-all' src/` → 0 matches
- [ ] Every audited surface in `docs/perf/reduced-motion-audit.md` Section 2 is ✅
- [ ] Manual smoke in `npm run electron:dev`:
  - Investigate Room: `⊞` on any card → other 5 cards collapse to right-side 80px rail with strip + accent dot + truncated title. Click any rail strip → focus transfers. Tab through strips + Enter transfers focus.
  - Citation click shows the chip + container pulse.
  - Evidence card badge pulses at 100 KB boundaries.
  - Datadog Live card accent changes when `store.notify('datadog-live', 'datadog-stream')` fires (dev console).
- [ ] `prefers-reduced-motion: reduce` OS toggle: all animations instant; no stutter; no broken layouts.

---

## Deferred items (Phase 06 / Phase 06A / Phase 07 hand-offs)

| Item | Phase |
|---|---|
| Correlation Graph card real implementation | 06A |
| Case library | 06 |
| Import Room URL-paste → investigate flow (stale claim; already works) | n/a |
| UI-level export→import Playwright round-trip | 06 |
| Non-log citation URL-opening policy audit | 06 |
| SubmitRoom integration test with real EvidenceProvider | 06 |
| Real Datadog streaming transport | Future feature |
| Tauri standalone packaging | 07 |

Phase 05 closes out the "UI polish redesign" spec. After it ships, the next phase of work is either feature-add (Correlation Graph in 06A, case library in 06) or operational (Tauri in 07).

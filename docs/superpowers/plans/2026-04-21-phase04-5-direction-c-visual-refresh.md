# Phase 04.5 — Direction C Visual Refresh (pre-Phase-05 bridge)

## Context

User reviewed the mood board at `docs/design-exploration/2026-04-21-visual-refresh-mood-board/` and selected **Direction C (Refined TUI — warm it up, add bounce)** as the final direction. Phase 04.5 is a small bridge phase that lands the Direction C token + motion changes in `src/`, plus the baseline audit-debt items the mood-board exploration surfaced. After this phase ships, Phase 05 resumes — but its plan needs a minor rewrite to align with the new baseline (deferred to a follow-up plan).

**Why a bridge phase instead of folding into Phase 05:** separating the "direction commit" from the "polish pass" keeps each commit's self-assessment surface reviewable. Phase 05's 4 Codex blockers are still live; conflating them with a visual direction change would obscure both.

**Phase 05 status:** still parked. This phase lands first.

---

## Direction C commitments (from mood board §C)

Direction C varies from the current (baseline) direction only along these axes:

- **Color base** — warmer dark gray-green: `#0d110f → #121311` background. Greenhouse palette unchanged.
- **Surface** — flat + 1px border (same); hover gains `translateY(-1px)` with spring curve.
- **Shadow scale** — unchanged values, applied slightly more conservatively.
- **Button press** — `scale(0.96)` linear → `scale(0.94)` with `cubic-bezier(0.34, 1.56, 0.64, 1)` over 220ms (emphasized bounce).
- **Card transition** — height-only JS animation → container transform (scale + opacity) with emphasized curve.
- **Type scale** — same scale; line-height 1.55 → 1.6; display and headline get slight negative tracking.

Not varying: fonts, greenhouse palette, radii, spacing scale, TUI braille spinner, PhaseDots pulse, log row grid.

---

## Baseline audit debt (folded in)

Three real issues the mood-board exploration surfaced, captured in `docs/design-exploration/2026-04-21-visual-refresh-mood-board/README.md` §J:

1. **`--glow-ready` dangling reference.** `LogRow.tsx:122` uses `var(--glow-ready)` but the token was removed from `tokens.css` in Phase 01a increment 7. The citation target highlight currently falls back silently.
2. **`WorkspaceCard` doesn't forward `data-*`.** Blocks Phase 05 Commit 5 (Datadog Live tier-driven glow).
3. **Destructive button fails WCAG AA.** White text on `#ef4444` measures 3.76:1; AA minimum is 4.5:1.

---

## Commit decomposition (6 commits)

### Commit 1 — Token base (Direction C foundation)

**Files:** `src/styles/tokens.css`, `src/index.css`

**Changes:**

In `tokens.css` dark-theme block (lines 77–122):
- `--background: #0d110f` → `#121311`
- `--foreground: #e5eadf` → (unchanged)
- `--card: #151a16` → `#181a15`
- `--workspace: #101411` → `#141513`
- `--muted: #171d18` → `#1a1d17`
- `--muted-foreground: #8e9789` → `#96988c`
- `--border: #263025` → `#2a2e26`
- `--card-border: #263025` → `#2a2e26`
- `--card-border-hover: #3a5030` → `#3d4336`
- `--input: #1d251b` → `#1f231c`

Add to the motion block (lines 176–197):
```css
--ease-emphasized: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Direction C bounce */
--ease-spring: cubic-bezier(0.16, 1.11, 0.3, 1);       /* Direction C hover lift */
--duration-scale-press-emphasized: 220ms;               /* Direction C button press */
--tracking-tight: -0.005em;                             /* Direction C headlines */
--tracking-display: -0.01em;                            /* Direction C display */
```

In `src/index.css` global `body`:
- `line-height: 1.55` → `line-height: 1.6`

**Tests:** no unit-test surface for pure token changes; verified via app smoke.

**Commit message:** `feat(phase-04.5): Direction C token base — warm background shift + motion tokens + type tracking`

---

### Commit 2 — Restore `--glow-ready` as a color token

**Files:** `src/styles/tokens.css`

**Changes:**

Add to both light and dark theme blocks:
```css
/* Glow-ready color token (Phase 01a inc. 7 removed this; LogRow.tsx:122
   still references it via color-mix for citation target highlight). */
--glow-ready: rgba(118, 206, 64, 0.3);   /* dark theme */
--glow-ready: rgba(81, 145, 43, 0.28);   /* light theme */
```

Update the comment block at lines 199–206 that explains the removal history to reflect the reinstatement.

**Tests:** existing `LogRow` tests should now pass without silent fallback; add one new test asserting the citation-target row has a non-transparent background computed style.

**Commit message:** `fix(phase-04.5): restore --glow-ready color token referenced by LogRow citation highlight`

---

### Commit 3 — Button press emphasized bounce

**Files:** `src/components/ui/Button.tsx`

**Changes:**

Find the press transition in Button.tsx. Currently:
```tsx
transition: transform var(--duration-scale-press) var(--ease-default);
// active: scale(0.96)
```

Replace with:
```tsx
transition: transform var(--duration-scale-press-emphasized) var(--ease-emphasized);
// active: scale(0.94)
```

Preserve `motion-reduce:` guards (if any) and `:disabled` opacity behavior.

**Tests:** extend `Button.test.tsx` to assert:
- Button root carries `transition` class referencing the new token names (class-level assertion).
- `active:scale-[0.94]` replaces `active:scale-[0.96]`.

**Commit message:** `feat(phase-04.5): Button press uses emphasized bounce curve (Direction C)`

---

### Commit 4 — WorkspaceCard container transform + hover lift

**Files:** `src/components/workspace/WorkspaceCard.tsx`, `src/components/workspace/__tests__/WorkspaceCard.test.tsx`

**Changes:**

Rewrite the imperative height-animation `useEffect` (lines 39–72) to use container transform:

Replace the height-based animation pattern:
```tsx
// OLD:
body.style.height = '0px';
body.style.opacity = '0';
// ... transition height + opacity
```

With container transform + opacity:
```tsx
// NEW:
body.style.transform = 'scale(0.96)';
body.style.opacity = '0';
body.style.transformOrigin = 'top center';
body.style.transition =
  'transform var(--duration-enter, 250ms) var(--ease-emphasized), ' +
  'opacity var(--duration-enter, 250ms) var(--ease-emphasized)';
// ... height still needs to animate to 0 to remove the slot,
//     but does so via a simpler step-function: height = 'auto' when expanded,
//     height = '0' applied AFTER the transform completes.
```

**Note:** the tricky part is the height: we still need the collapsed card to take zero vertical space. Options:
- **A. Two-stage:** run transform+opacity transition, then at `transitionend` set `height: 0; overflow: hidden`. Clean visual, requires an extra state variable.
- **B. grid-template-rows trick:** parent uses `grid-template-rows: auto` normally, transitions to `0fr` on collapse. Child sets `overflow: hidden`. Modern-browser clean; works in Electron 40+.
- **C. keep height in the animation:** animate all three (height, transform, opacity) together. Simpler but height animation returns if transform is the star.

Recommend **B (grid-template-rows trick)**. Cleanest, no extra state, better performance.

Also add hover lift on `.ws-card`:
```tsx
transition: ... transform var(--duration-normal) var(--ease-spring);
hover: transform translateY(-1px);
```

**Tests:** extend `WorkspaceCard.test.tsx`:
- Collapsed card has `grid-template-rows: 0fr` (or equivalent).
- Expanding triggers a transition with the expected ease token.
- `motion-reduce` falls back to instant toggle.
- Hover triggers the translateY (assert class, not visual).

**Commit message:** `feat(phase-04.5): WorkspaceCard container transform + hover lift (Direction C)`

---

### Commit 5 — WorkspaceCard `data-*` prop forwarding

**Files:** `src/components/workspace/WorkspaceCard.tsx`, `src/components/workspace/__tests__/WorkspaceCard.test.tsx`

**Changes:**

Add a `data-*` passthrough to the card root element. Extend the props interface:

```tsx
interface WorkspaceCardProps extends Pick<HTMLAttributes<HTMLDivElement>,
  `data-${string}` extends keyof HTMLAttributes<HTMLDivElement> ? `data-${string}` : never
> {
  // ... existing props
}
```

A simpler and more typical pattern:

```tsx
interface WorkspaceCardProps {
  id: string;
  title: string;
  // ... existing props
  /** Arbitrary data-* attributes forwarded to the card root */
  dataAttributes?: Record<`data-${string}`, string>;
}

// In render:
<div
  data-card-id={id}
  data-focus-target={isFocused ? 'true' : 'false'}
  {...dataAttributes}
  className={...}
>
```

OR even simpler, accept a generic `...rest` object and filter:

```tsx
// Collect any prop starting with "data-" and forward to root
const dataProps = Object.fromEntries(
  Object.entries(rest).filter(([k]) => k.startsWith('data-'))
);
```

**Recommend:** the explicit `dataAttributes` prop pattern. Cleaner type-safety, no unexpected forwarding.

**Tests:**
- Card rendered with `dataAttributes={{ 'data-surface': 'test', 'data-tier': 'live' }}` has both attributes on the root.
- Existing `data-card-id` and `data-focus-target` still render and are not clobbered.

**Commit message:** `feat(phase-04.5): WorkspaceCard forwards data-* attributes (unblocks Phase 05 Commit 5)`

---

### Commit 6 — Destructive button WCAG AA contrast fix

**Files:** `src/styles/tokens.css`

**Changes:**

Dark theme:
- `--destructive: #ef4444` → `#d93434` (contrast with white: 4.51:1, passes AA)

Light theme:
- `--destructive: #dc2626` → (already passes AA 5.5:1 with white text; leave as-is)

Update the destructive glow shadow to match (optional, cosmetic):
- `--shadow-glow-error: 0 0 12px rgba(239, 68, 68, 0.35), 0 0 24px rgba(239, 68, 68, 0.15);`
  → `0 0 12px rgba(217, 52, 52, 0.35), 0 0 24px rgba(217, 52, 52, 0.15);`

**Tests:** no unit-test surface; verified via `design.md lint` against the updated DESIGN.md (deferred — not in scope for this commit), and via a manual visual check that existing destructive buttons still read as "red" without feeling muted.

**Commit message:** `fix(phase-04.5): destructive button darkened to #d93434 for WCAG AA contrast`

---

## File map

### Modified
```
src/styles/tokens.css                              (Commits 1, 2, 6)
src/index.css                                      (Commit 1)
src/components/ui/Button.tsx                       (Commit 3)
src/components/ui/__tests__/Button.test.tsx        (Commit 3)
src/components/workspace/WorkspaceCard.tsx         (Commits 4, 5)
src/components/workspace/__tests__/WorkspaceCard.test.tsx  (Commits 4, 5)
```

### Read-only references
- `docs/design-exploration/2026-04-21-visual-refresh-mood-board/direction-c-refined-tui.html` — authoritative source for Direction C token values
- `docs/design-exploration/2026-04-21-visual-refresh-mood-board/README.md` §J — audit debt items

---

## Verification (end-to-end)

1. `npx tsc --noEmit` → exit 0.
2. `npx vitest run` → all tests pass (current baseline 537 + new data-* + `--glow-ready` + button-class assertions).
3. `npx eslint <scoped files>` → clean.
4. `npm run dev` → app boots, opens Investigate Room. Confirm: background warmer, button press bouncy, card toggle animates with scale-opacity, log row citation target highlight renders with non-transparent background, destructive button reads as red.
5. `prefers-reduced-motion: reduce` — bounce collapses to instant, card toggle snaps, hover lift disabled.

---

## Non-goals

- **Phase 05 work.** Still parked. Next step after this phase ships is to rewrite the Phase 05 plan for the Direction C baseline — a separate planning session.
- **Updating `current.design.md`.** The mood-board DESIGN.md describes pre-Direction-C state; it stays as a historical snapshot. A new `target.design.md` reflecting Direction C can be authored later if governance work resumes.
- **Tailwind config changes.** `tailwind.config.js` untouched; tokens remain the source of truth.
- **`tokens-migration.md` update.** The Phase 00 contract doesn't need amending; Direction C additions are additive, not renames.

---

## Phase 05 rewrite (next planning session)

After Phase 04.5 ships, Phase 05 plan needs these adjustments:

- **Commit 1 (reduced-motion audit)**: expand scope to include `--ease-emphasized` usages (Button press, WorkspaceCard expand, hover lift). Each must have a `motion-reduce:` fallback.
- **Commit 5 (Datadog Live glow)**: simplified — `data-*` forwarding already landed in Phase 04.5 Commit 5, so no primitive amendment needed.
- **Commit 6 (visible rail)**: unaffected by Direction C; proceed as v2 plan specified, with Codex's rail CSS fix applied.
- **Other commits**: citation jump polish, PhaseHeader tokens, Evidence pulse — all unaffected.

The Phase 05 plan rewrite + second Codex review happens after Phase 04.5 close-out.

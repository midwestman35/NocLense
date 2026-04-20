# Token Migration Map

**Phase:** 00 (contracts)
**Consumers:** Phase 01a (applies migration)
**Owner spec:** design §3.2

---

## 1. Purpose

Prevent two token systems running in parallel during Phase 01a. Every new token has a documented relationship to what it replaces, and every deprecated token has a phase by which it must be gone.

## 2. Actual stylesheet topology

| File | Role |
|---|---|
| `src/index.css` | Global entry. Imports `tailwindcss` then `./styles/tokens.css`. Owns global keyframes (`phase-dot-pulse`, `evidence-add`, `room-fade-in`, etc.), scrollbar styling, and body reset. |
| `src/styles/tokens.css` | All CSS custom properties. Primitives (`--green-house-*`), semantic colors (`--background`, `--foreground`), structural tokens (`--card-radius`), state tokens (`--phase-dot-active`). Light + dark + red theme blocks. |

**Ownership rule for Phase 01a (revised after Checkpoint 1 Codex review):**
- All NEW tokens added in Phase 01a land in `src/styles/tokens.css`.
- **Existing** global keyframes (`phase-dot-pulse`, `evidence-add`, `room-fade-in`, `toast-in`, `shimmer`) stay in `src/index.css`.
- **New loading-vocabulary keyframes** (`tui-braille-cycle`, `tui-block-cycle`, `tui-dots-cycle`, `glow-live-pulse`, `cute-label-reveal`, `cute-label-breathe`) land in `src/styles/loading.css`, imported from `src/index.css` after `tokens.css`. They're co-located with the `.tui-spinner`, `.glow-live`, and `.cute-label` classes that consume them so the loading-vocabulary primitives are a single reviewable file.
- No new `state-tokens.css` file. No separation of primitives vs. state into separate files.

## 3. Current live token inventory (from `src/styles/tokens.css`)

The token map below enumerates every token the UI polish redesign touches. Tokens not listed here are kept unchanged.

### 3.1 Shadow scale

| Current | Replacement | Deprecation phase |
|---|---|---|
| `--shadow-sm` (tokens.css:52) | `--shadow-flat` (1px border only) | 01a |
| `--shadow-md` (tokens.css:53) | `--shadow-raised` (1px + 2px layered) | 01a |
| `--shadow-lg` (tokens.css:54) | `--shadow-floating` (4px + 12px) | 01a |
| *(new)* | `--shadow-glow-live` (green multi-layer) | 01a |
| *(new)* | `--shadow-glow-error` (red multi-layer) | 01a |

Codemod: `rg -l '\-\-shadow-(sm|md|lg)' src/` → sweep in the Phase 01a PR.

### 3.2 Card / room structural tokens (kept, not migrated)

| Token (tokens.css line) | Disposition |
|---|---|
| `--card-radius: 12px` (172) | Kept. Audit during Phase 01a to ensure concentric outer = inner + padding is honored. |
| `--card-border` (173), `--card-border-hover` (174) | Kept. Layered on top of new glow tokens; not replaced. |
| `--card-header-height: 40px` (175), `--card-collapsed-height: 36px` (176) | Kept. |
| `--card-expand-duration: 350ms` (177) | Kept. |
| `--room-transition-duration: 600ms` (169), `--room-transition-ease` (170) | Kept; referenced by `evidence-add` keyframe. |

### 3.3 Phase dot tokens and keyframe

| Current | Disposition |
|---|---|
| `--phase-dot-size: 8px` (tokens.css:183) | Kept. |
| `--phase-dot-inactive` / `-complete` / `-active` (184–186) | Kept. |
| `--phase-dot-glow: 0 0 8px rgba(118,206,64,0.4)` (187) | Kept. Referenced by `.animate-phase-pulse`. |
| `@keyframes phase-dot-pulse` (index.css:39–42) | Kept. |
| `.animate-phase-pulse` utility (index.css:43–45) | Kept. |

### 3.4 Keyframe ownership

Existing keyframes in `src/index.css` (kept where they are):

| Keyframe | Location | Disposition |
|---|---|---|
| `phase-dot-pulse` | index.css:39 | Kept. |
| `evidence-add` | index.css:48 | Kept. |
| `room-fade-in` | index.css:58 | Kept. |
| `toast-in` | index.css:67 | Kept. Reduced-motion guard added in 01a ckpt 2. |
| `shimmer` | index.css:82 | Kept. Reduced-motion guard added in 01a ckpt 2. |

New Phase 01a keyframes live in `src/styles/loading.css`, co-located with the classes that consume them. Shipped in checkpoint 1 / 2:

| Keyframe | Location | Consumer class |
|---|---|---|
| `tui-braille-cycle` | loading.css | `.tui-spinner--braille` |
| `tui-block-cycle` | loading.css | `.tui-spinner--block` |
| `tui-dots-cycle` | loading.css | `.tui-spinner--dots` |
| `cute-label-reveal` | loading.css | `.cute-label__char` (first animation) |
| `cute-label-breathe` | loading.css | `.cute-label__char` (second animation) |
| `glow-live-pulse` | loading.css | `.glow-live::after` |

The Phase 00 first cut proposed names like `braille-step`, `block-step`, `progress-fill`, `typewriter-reveal`, `breathing-wave`. The shipped names above supersede those — update any downstream reference to the shipped names.

### 3.5 Motion tokens (additions, no replacements)

| Existing in tokens.css | Disposition |
|---|---|
| `--duration-fast / --duration-normal / --duration-slow / --duration-enter` | Kept, consumed by existing components. |
| `--ease-default / --ease-out / --ease-in` | Kept. |

| New (Phase 01a adds) | Runtime consumer |
|---|---|
| `--duration-interrupt: 120ms` | CSS — hover/focus/active transitions |
| `--duration-scale-press: 150ms` | CSS — button press (`active:scale-[0.96]`) |
| `--duration-stagger-step: 40ms` | CSS + anime.js — enter stagger across lists |
| `--duration-exit: 160ms` | CSS + Motion — AnimatePresence exit |
| `--duration-spinner-step: 100ms` | CSS `content` cycle (TUI glyphs) |
| `--ease-tui-step-8: steps(8, end)` | CSS — 8-frame glyphs (braille, block) |
| `--ease-tui-step-10: steps(10, end)` | CSS — 10-frame glyph (dots) |
| `--ease-enter-out: cubic-bezier(0.2,0,0,1)` | CSS + Motion — enter curves |
| `--ease-exit-in: cubic-bezier(0.4,0,1,1)` | CSS + Motion — exit curves |

**Runtime ownership** per the motion-library ownership table in design spec §4.1:
- CSS owns: state transitions, spinners, typewriter/breathing keyframes.
- Motion owns: AnimatePresence mount/unmount.
- anime.js owns: stagger orchestration on lists, timeline, value tweening.

### 3.6 Glow tier tokens (shipped)

The **canonical** glow-geometry token family is `--shadow-glow-*`,
declared in the light + dark theme blocks of `src/styles/tokens.css`.
Each is a full `box-shadow` value (not a color) so consumers compose
directly via `box-shadow: var(--shadow-glow-ready)`.

| Token | Geometry | Consumer (CSS class) | State machine reference |
|---|---|---|---|
| *(no shadow)* | `box-shadow: none` | `.glow-surface` base, no modifier | idle tier (no rendered glow) |
| `--shadow-glow-ready` | 4px subtle green | `.glow-surface--ready` | ready tier — surface connected |
| `--shadow-glow-live` | 10px multi-layer green, paired with `@keyframes glow-live-pulse` | `.glow-surface--live` | live tier — data streaming (arbitrated per room) |
| `--shadow-glow-error` | 12px red | `.glow-surface--alert` | alert tier |

A separate `--glow-idle/ready/live/alert` family was declared in
checkpoint 6 but never consumed by any class — removed in checkpoint
7 per the Codex review. `--shadow-glow-*` is the single source of
truth.

Values are finalized against `--green-house-*` (light/dark-tuned
green opacities) and `--destructive` (red).

## 4. Radius reconciliation

**Known issue from Codex review:** the design spec previously cited a `4/6/8/12/16` radius scale that does not match `--card-radius: 12px` or actual usage patterns. Phase 01a action:

1. Inventory every `border-radius` value in `src/` (Tailwind classes + raw CSS).
2. Reconcile: either normalize code to the scale, or publish the actual radii as the tokens.
3. Publish the reconciled scale in `tokens.css` with comments showing the concentric pattern (outer = inner + padding).

## 5. Alias and deprecation policy during Phase 01a

**Coexistence:** for a single PR cycle, both old and new shadow tokens MAY coexist in `tokens.css` with the new tokens defined and the old kept as-is. The Phase 01a PR MUST:

1. Introduce the new tokens.
2. Sweep all consumers to the new tokens via codemod.
3. Delete the old tokens in the SAME PR.

No long-tail deprecation cycle. The codebase is small enough that a single atomic sweep is lower risk than a two-step migration.

## 6. Primitive vs. state tokens (naming convention only)

**Rule:** state tokens compose primitives via `var()`; they never redefine primitives at the top level.

```css
:root {
  /* Primitive */
  --green-house-500: #417621;
  /* State (composes primitive) */
  --shadow-glow-live:
    0 0 10px rgba(118, 206, 64, 0.35),
    0 0 20px rgba(118, 206, 64, 0.15);
}
```

Both live in the same file (`tokens.css`). No structural separation.

## 7. Non-goals for Phase 01a

- Not restructuring the palette. `--green-house-50..950` stays as-is.
- Not changing font tokens.
- Not introducing a token-system library (Style Dictionary, etc.). Plain CSS custom properties only.
- Not migrating Tailwind custom config. Tailwind v4 `@theme` inline config lands separately if needed.

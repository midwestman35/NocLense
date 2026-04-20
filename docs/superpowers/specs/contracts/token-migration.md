# Token Migration Map

**Phase:** 00 (contracts)
**Consumers:** Phase 01a (applies migration)
**Owner spec:** design §3.2

---

## 1. Purpose

Prevent two token systems running in parallel during Phase 01a. Every new token has a documented relationship to what it replaces, and every deprecated token has a phase by which it must be gone.

## 2. Shadow scale

| Current (in `src/styles/theme.css` or inline) | Replacement | Deprecation phase |
|---|---|---|
| `--shadow-sm` | `--shadow-flat` (1px border only) | 01a |
| `--shadow-md` | `--shadow-raised` (1px + 2px layered) | 01a |
| `--shadow-lg` | `--shadow-floating` (4px + 12px) | 01a |
| *(new)* | `--shadow-glow-live` (green multi-layer) | 01a |
| *(new)* | `--shadow-glow-error` (red multi-layer) | 01a |

Codemod: `rg -l '\-\-shadow-(sm|md|lg)' src/` → sweep replacements in Phase 01a PR.

## 3. Accent / glow tokens

| Current | Replacement | Deprecation phase |
|---|---|---|
| Hardcoded accent-dot colors in `WorkspaceCard.tsx` variants | `--glow-idle` / `--glow-ready` / `--glow-live` / `--glow-alert` | 01a |
| Per-component `::after` pulse keyframes | Single `@keyframes pulse-live` in `tokens.css` | 01a |

## 4. Motion tokens

| Current | Status | Notes |
|---|---|---|
| `--duration-fast` | Kept | |
| `--duration-normal` | Kept | |
| `--duration-slow` | Kept | |
| `--duration-enter` | Kept | |
| `--ease-default` | Kept | |
| `--ease-out` | Kept | |
| `--ease-in` | Kept | |
| *(new)* `--duration-interrupt: 120ms` | Added | hover / focus / active |
| *(new)* `--duration-scale-press: 150ms` | Added | button press |
| *(new)* `--duration-stagger-step: 40ms` | Added | enter stagger |
| *(new)* `--duration-exit: 160ms` | Added | exit transitions |
| *(new)* `--duration-spinner-step: 100ms` | Added | TUI glyph cycle |
| *(new)* `--ease-tui-step-8` / `--ease-tui-step-10` | Added | steps() easing |
| *(new)* `--ease-enter-out` / `--ease-exit-in` | Added | cubic-beziers |

## 5. Radius scale

**Known issue:** the published scale (`4/6/8/12/16`) does not exactly match what's applied to the active shell today. Phase 01a:

1. Audit every `border-radius` value in `src/` against the scale.
2. Reconcile: either bring the code to the tokens, or publish the actual radii as the tokens.
3. Publish the reconciled scale in `tokens.css` with comments showing the concentric pattern (outer = inner + padding).

## 6. Primitive vs. state tokens

**Rule:** primitive tokens (colors, radii, durations, eases) are distinct from state tokens (e.g., `--shadow-glow-live`). State tokens compose primitives via CSS `var()`; they never redefine or alias primitives at the top level.

Example:

```css
:root {
  /* Primitive */
  --green-house-500: #4ade80;
  /* State (composes primitive) */
  --shadow-glow-live: 0 0 10px rgba(74, 222, 128, 0.35), 0 0 20px rgba(74, 222, 128, 0.15);
}
```

State tokens live in `src/styles/state-tokens.css` (new file Phase 01a); primitives stay in `src/styles/theme.css`.

## 7. Non-goals for Phase 01a

- Not restructuring the palette. `--green-house-50..950` stays as-is.
- Not changing font tokens.
- Not introducing a token-system library (e.g. Style Dictionary). Plain CSS custom properties only.

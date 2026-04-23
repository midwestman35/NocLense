# Phase 07A — Tokens + Fonts + Global Reskin (slice plan)

**Parent:** `docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md`
**Primary agent:** Codex (per HANDOFF.md role framing; see `feedback_codex_agent_assignments.md` for slice-archetype → agent mapping — this slice is visual/tokens, not security-critical).
**Owner review:** Claude (adversarial probe at plan level + deep review at phase close).
**Gemini:** kicks off at 07A close to update README Design System section + close DEVELOPER_HANDOFF 07A block.

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-22 | Initial slice plan (7 slices + pre-work split). |
| v1.1 | 2026-04-22 | Add baseline tsc unblocker; narrow pre-work file-split to only `CorrelationGraph.tsx`. |
| v1.2 | 2026-04-22 | Add vitest exclude for worktree/bug-scan dirs; document baseline red test set. |
| v1.3 | 2026-04-22 | Add lint baseline (419 problems) + count-based regression gate. |
| v2 | 2026-04-22 | Incorporate Gemini audit: (1) defer CorrelationGraph.tsx split out of 07A; (2) bridge legacy semantic CSS vars with aliases so ui/* primitives survive; (3) switch 07A.3 from tailwind.config.js to Tailwind v4 `@theme` in tokens.css; (4) remove Google Fonts CDN fallback in 07A.1 (vendor locally or stop); (5) add boot-time `data-theme="dark"` lock + `noclense-theme` localStorage scrub to 07A.1. |
| **v2.1** | **2026-04-22** | **Reverse §2.2 deferral: split already executed at `ab1f9b8` under v1.3 before v2 landed. Clean extraction to `useCorrelationGraphCanvas.ts`; regression isolation preserved by commit ordering. Keep the split; proceed to 07A.1. Remaining v2 changes (items 2–5) unchanged.** |

**If previously read v1.x, pay attention to §2.2 (deferred), §3 Slice 07A.1 (theme lock added; no CDN fallback), §3 Slice 07A.2 (bridge aliases — don't delete semantic vars), and §3 Slice 07A.3 (Tailwind v4 @theme in CSS, not tailwind.config.js).**

---

## 1. Goal

Swap the visual foundation from the current Green-House / light+dark tokens to the
v5.1 obsidian + phosphor dark-only system. No behavior changes. No new screens
(Auth + Dashboard land in 07B). When 07A closes, Investigate Room and Submit Room
look like the v5.1 deck.

## 2. Pre-work commits (run BEFORE slice 1)

### 2.1 Unblocker commit — clear baseline `tsc` errors

**Commit:** `fix(phase-07-prep): clear baseline tsc errors before 07A dispatch`

Codex's initial baseline `npm run build` (2026-04-22) surfaced three blockers
that predate this plan. All are small, logic-preserving fixes.

**Blocker A — React 19 dropped the global `JSX` namespace.** 5 sites across 3 files
reference `JSX.Element` which no longer resolves. Fix by importing the type from
React:

| File | Existing import line | Change |
|---|---|---|
| `src/components/correlation-graph/CorrelationGraph.tsx` | `import { type FocusEvent, type KeyboardEvent, ... } from 'react'` | add `type JSX` to the named imports |
| `src/components/correlation-graph/CorrelationGraphChrome.tsx` | `import type { KeyboardEvent, MutableRefObject } from 'react'` | add `JSX` to the named imports |
| `src/components/correlation-graph/graphPresentation.tsx` | `import type { Dispatch, SetStateAction } from 'react'` | add `JSX` to the named imports |

Leave the 5 `JSX.Element` return-type annotations as-is; the import now provides
the namespace.

**Blocker B — Untracked `src/contexts/logContextObject.ts` is a half-done
refactor.** It imports `LogContextType` from `LogContext.tsx:48`, but that
interface is not exported. The WIP file has **zero consumers** (grep confirmed;
the only reference is its own `useLogContext.ts` sibling, also untracked and
also unreferenced). The cleanest unblocker is to **export the type** so the WIP
file type-checks as dead code until its author finishes the refactor:

- `src/contexts/LogContext.tsx:48` — change `interface LogContextType extends LogState {` → `export interface LogContextType extends LogState {`

Do NOT delete the untracked WIP files. They represent in-flight author work
from a prior session; preserve them for the author to finish or discard.

**Blocker C — `src/services/investigationExporter.ts:55` crypto.subtle.digest
typing.** Pre-existing per HANDOFF.md §"Pre-existing tech debt." The call is:

```ts
const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
```

Newer `lib.dom` typings tightened `BufferSource` variance. Cast the argument:

```ts
const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
```

If that cast does not resolve the error on the local TS version, fall back to
`new Uint8Array(bytes).buffer` — but try the cast first.

**Blocker D — Vitest picks up duplicate test files from out-of-scope paths.**
`vite.config.ts` has no `test.exclude`, so vitest's default globs discover:

- `.worktrees/ui-overhaul/**` — separate git worktree, unrelated branch
- `.worktrees/ui-overhaul/.codex-beta-push/**` — scratch dir inside that worktree
- `.tmp-daily-bug-scan-20260422-090152/**` — extracted tarball, orphaned

These duplicates inflate the failure count by ~16 and add noise. Add an
explicit `exclude` block to `vite.config.ts` under `test`:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: true,
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.worktrees/**',
    '**/.tmp-daily-bug-scan-*/**',
    '**/.codex-beta-push/**',
  ],
  coverage: { /* existing */ },
},
```

**Gate for §2.1:** `npm run build` green (no new warnings); `npm run lint`
green; `npm run test:run` matches the documented baseline red set below (no
*new* failures introduced). Zero logic changes in src/.

### 2.1.1 Baseline red set (documented known-failures as of 2026-04-22)

These tests fail on baseline `april-redesign` HEAD before Phase 07 starts.
They are pre-existing Phase 06-era tech debt, explicitly out of 07A scope,
and do NOT block Phase 07 progress. Per HANDOFF lightweight review policy,
they are logged as known-limitations (YELLOW), not blockers.

| Test file | # failing | Symptom | Root cause (diagnosis) |
|---|---|---|---|
| `src/contexts/__tests__/EvidenceContext.test.tsx` | 14 | `TypeError: window.localStorage.clear is not a function` | Test-ordering pollution: `AIContext.test.tsx:148` and `theme.test.ts:10` reassign `window.localStorage` via `Object.defineProperty` with an incomplete mock, leaking into later tests. Pre-existing; listed in HANDOFF.md §"Pre-existing tech debt." |
| `src/store/__tests__/caseContext.test.tsx` | 4 | Same `localStorage.clear` | Same root cause as above. Phase 06C oversight; add to HANDOFF pre-existing list. |
| `.worktrees/ui-overhaul/src/services/__tests__/llmService.test.ts` | 2 | `ReferenceError: sharedCacheManagerMock is not defined` | Out-of-scope path; excluded by §2.1 Blocker D fix. |

**Regression rule:** after any Step 0 / Step 1 / 07A.N commit, `npm run test:run`
should fail with exactly the 18 known baseline failures above (EvidenceContext +
caseContext). Any *new* failure or any change in the red set is a regression →
halt and surface to Claude.

**Snapshot note:** if vitest writes updates to
`src/hooks/__tests__/__snapshots__/useCuteLoadingLabel.test.ts.snap` during a
run, review the diff. If it's a cosmetic change unrelated to our edits, revert
it; if it's a real regression, halt.

### 2.1.2 Lint baseline (count-based regression gate)

Baseline capture on `april-redesign` HEAD 2026-04-22:

```
✖ 419 problems (404 errors, 15 warnings)
```

The 404 errors are concentrated in Phase 06-era debt across `src/services/**`,
`src/utils/**`, `src/contexts/**`, and various test files. Dominant rules:
`@typescript-eslint/no-explicit-any` (~80%), `@typescript-eslint/no-unused-vars`,
`react-hooks/exhaustive-deps`, `react-refresh/only-export-components`,
`no-useless-escape`. All pre-existing, all out of 07A scope.

**Lint regression rule:**

- `npm run lint` error count must be **≤ 404**. Warning count must be **≤ 15**.
- If either count *decreases* incidentally (e.g., a token-swap removes an unused
  import), that's fine — update the baseline in this section at the next commit.
- If either count *increases*, that's a regression → halt.

**Step-0-specific lint check** (before committing Step 0 + vite.config.ts):

```
npx eslint \
  src/components/correlation-graph/CorrelationGraph.tsx \
  src/components/correlation-graph/CorrelationGraphChrome.tsx \
  src/components/correlation-graph/graphPresentation.tsx \
  src/contexts/LogContext.tsx \
  src/services/investigationExporter.ts \
  vite.config.ts
```

Expected result: **LogContext.tsx shows 9 pre-existing problems** (6 errors at
lines 117, 118, 188, 246, 358, 510; 3 warnings at lines 322, 1123, 1456 — all
`no-explicit-any`, `react-refresh/only-export-components`, `no-unused-vars`,
`react-hooks/exhaustive-deps`). The other 5 files must be clean.

Any error on LogContext.tsx at line 48 (where we added `export`) — or any new
error on any of the six files — is a regression.

### 2.2 File-size split — EXECUTED in `ab1f9b8` (rev v2.1)

**Status:** executed before v2 amendment landed.

Under slice plan v1.3, Codex committed
`refactor(phase-07-prep): split CorrelationGraph.tsx before 07A reskin` at
`ab1f9b8` (2026-04-22 21:19). The split extracted graph canvas lifecycle
wiring into a new `src/components/correlation-graph/useCorrelationGraphCanvas.ts`
hook (~304 LOC). CorrelationGraph.tsx dropped from 601 → ~322 lines. All
gates passed at that commit.

Rev v2 briefly moved this to "deferred" after Gemini audit Risk 4 flagged
regression-isolation concerns (stateful refactor colliding with CSS reskin).
On reflection, Risk 4 is **mitigated by commit ordering**: the split is its
own atomic commit before any token work, so `git bisect` still cleanly
isolates a graph regression to either the split (`ab1f9b8`) or a later
token-swap commit.

**Decision:** keep the split. Do not revert. Proceed to 07A.1.

**Note for 07A.4:** the token-swap on `correlation-graph/*` now includes the
new `useCorrelationGraphCanvas.ts` file. That file is pure logic (no JSX)
so it should have zero token references — verify and move on.

## 3. Slicing

Seven slices inside 07A. Each is one commit. Per-slice self-assessment at end.

### Slice 07A.1 — Font swap + boot-time theme lock (rev v2)

**Commit:** `feat(phase-07a): ckpt 07A.1; swap fonts to Inter Tight / Geist Mono / Instrument Serif + lock dark theme`

**A. Font swap**

- `npm uninstall @fontsource/dm-sans @fontsource/jetbrains-mono`
- `npm install @fontsource/inter-tight @fontsource/geist-mono @fontsource/instrument-serif`
- **No CDN fallback.** (Gemini audit Risk 3: Electron CSP + air-gapped NOC
  environments break `<link>` to fonts.googleapis.com.) Verify each
  `@fontsource` package exists on npm *before* running `npm install`. If
  any package is missing, download the licensed font files (WOFF2) from
  the upstream repository (rsms/inter, vercel/geist-font, or Google Fonts
  project source) and vendor them at `public/fonts/` with a per-weight
  `@font-face` rule in `tokens.css`. Halt and surface if this is needed;
  do not use a Google Fonts `<link>` tag.
- Update `src/main.tsx` imports: `@fontsource/inter-tight/300.css`,
  `.../400.css`, `.../500.css`, `.../600.css`, `.../700.css`;
  `@fontsource/geist-mono/300.css`–`600.css`;
  `@fontsource/instrument-serif/400-italic.css`.
- Delete any DM Sans / JetBrains Mono imports.

**B. Boot-time theme lock** (Gemini audit Risk 5)

Existing NOC operators still have `localStorage.getItem('noclense-theme')`
cached with potentially `"light"`. `src/utils/theme.ts` applies that as a
`data-theme` attribute on `<html>` on mount, even after we delete the
light-mode CSS rules. Third-party libraries (G6 graph chrome, Datadog
embed, un-reskinned ui/* primitives) that read `[data-theme="light"]`
could enter a hybrid state.

Add a scrub + lock to `src/main.tsx` **before `createRoot(...).render(...)`**:

```ts
// Phase 07A: lock dark theme; clear legacy light-mode preference
try {
  localStorage.removeItem('noclense-theme');
} catch { /* ignore (sandbox, private mode) */ }
document.documentElement.setAttribute('data-theme', 'dark');
```

Update `src/utils/theme.ts`:
- `setTheme(theme)`: force `theme = 'dark'` regardless of argument; still
  writes `localStorage.setItem('noclense-theme', 'dark')` and applies the
  `data-theme='dark'` attribute so existing tests pass without rewrite.
- `getTheme()` (or equivalent getter): always return `'dark'`.

Update `src/utils/__tests__/theme.test.ts` if assertions explicitly test
light-mode behavior (e.g., toggling). Keep the dark-path assertions.

**Gate:** app boots in Electron; no missing-font warnings in DevTools;
`document.documentElement.dataset.theme === 'dark'` in console; no network
requests to fonts.googleapis.com in Network tab. `npm run test:run`
baseline-match; `npm run lint` count-based baseline.

### Slice 07A.2 — `tokens.css` rewrite with semantic alias bridge (rev v2)

**Commit:** `feat(phase-07a): ckpt 07A.2; add obsidian + phosphor primitives + bridge semantic vars to new scale`

Gemini audit Risk 1: `ui/*` primitives (Button, Card, Dialog, Input, Toast,
Tooltip, etc.) reference semantic CSS variables — `--card`, `--border`,
`--foreground`, `--muted-foreground`, `--destructive`, `--ring`, `--input`,
`--popover`, `--accent` — across 52 occurrences in 17 files. These are NOT
in 07A's reskin scope (they belong to the 07B rebuild bucket). **If we
delete the semantic vars, every primitive instantly loses its background,
border, and text color, and the visual verification gate for Investigate
and Submit rooms fails.**

Fix: add the new obsidian + phosphor primitives, then **alias** the
existing semantic vars to the new scale. `ui/*` primitives keep working
during 07A; the aliases get deleted in 07B when primitives are rebuilt.

**New structure of `src/styles/tokens.css` `:root`:**

```css
:root {
  /* ── Obsidian + Phosphor primitives (new v5.1 scale) ─────────────── */
  --bg-0: #05070a;  /* root background, outside-panel */
  --bg-1: #0a0d12;  /* app surface */
  --bg-2: #0f1319;  /* raised panel */
  --bg-3: #151a22;  /* elevated card */
  --ink-0: #f3f5f7;
  --ink-1: #cfd4dc;
  --ink-2: #8a93a1;
  --ink-3: #5b6373;
  --line:   rgba(255,255,255,0.06);
  --line-2: rgba(255,255,255,0.10);

  --mint:      #8ef0b7;
  --mint-dim:  #4fb987;
  --mint-deep: #133b2a;
  --amber:     #f7b955;
  --red:       #ff6b7a;
  --violet:    #a58cff;
  --cyan:      #8be5ff;

  --font-display: 'Inter Tight', system-ui, sans-serif;
  --font-mono:    'Geist Mono', ui-monospace, monospace;
  --font-serif:   'Instrument Serif', serif;

  --radius-chip:  6px;
  --radius-input: 8px;
  --radius-row:   10px;
  --radius-panel: 14px;
  --radius-win:   2px;

  /* ── Legacy semantic aliases (DELETE IN 07B) ─────────────────────────
   * Kept during 07A so ui/* primitives don't break.
   * Delete this entire block when 07B rebuilds primitives against the
   * new scale directly.
   */
  --background:         var(--bg-1);
  --foreground:         var(--ink-0);
  --card:               var(--bg-2);
  --card-foreground:    var(--ink-0);
  --workspace:          var(--bg-1);
  --muted:              var(--bg-3);
  --muted-foreground:   var(--ink-2);
  --border:             var(--line-2);
  --input:              var(--bg-2);
  --ring:               var(--mint);
  --accent:             var(--mint-deep);
  --accent-foreground:  var(--ink-0);
  --destructive:        var(--red);
  --success:            var(--mint);
  --warning:            var(--amber);
  --info:               var(--cyan);
  --popover:            var(--bg-2);
  --popover-foreground: var(--ink-0);
}
```

**Also:**

- Add glass utilities per zip §Spacing-and-radii (the existing `.glass-panel`
  and `.glass-2` snippet from prior rev stays):

  ```css
  .glass-panel {
    background: linear-gradient(180deg, rgba(22,27,36,0.75), rgba(14,18,24,0.6));
    border: 0.5px solid var(--line-2);
    backdrop-filter: blur(30px) saturate(160%);
    border-radius: var(--radius-panel);
  }
  .glass-2 {
    background: rgba(14,18,24,0.5);
    border: 0.5px solid var(--line);
    border-radius: var(--radius-input);
  }
  ```

- **Delete:**
  - The `:root, [data-theme="light"]` combined selector block (lines 23+ in
    current `tokens.css`) — remove just the `[data-theme="light"]` selector
    addition and any light-mode-specific `--*` declarations within. Preserve
    `:root { --green-house-* }` primitives and `:root { --radius-*, --shadow-*,
    --correlation-* }` declarations further down.
  - The second `[data-theme="light"]` block at line ~325.
  - Any standalone `html[data-theme="light"]` selectors.

- **Keep (do NOT delete in 07A):**
  - `--green-house-*` scale. Currently unused by the new palette but may have
    stragglers; survey and clean up in 07B.
  - `--radius-*`, `--shadow-*`, `--correlation-*`, `--card-border`,
    `--phase-dot-*` and other structural tokens.
  - `[data-theme="dark"]` block — values are now redundant with the aliases in
    `:root`, but the selector is harmless since the app is locked to `dark`
    (Slice 07A.1). Leave it for 07B cleanup to avoid mid-07A diff noise.

**Gate:** `npm run build` green; `npm run test:run` baseline-match; `npm run
lint` count-based baseline; open the app in Electron and verify a Button, a
Card, a Dialog, and a Tooltip all still render (not broken boxes). If any
primitive is visually broken, the alias bridge is missing a variable — halt
and surface.

### Slice 07A.3 — Tailwind v4 `@theme` wire-up in tokens.css (rev v2)

**Commit:** `feat(phase-07a): ckpt 07A.3; add @theme block to tokens.css for Tailwind v4 utility generation`

Gemini audit Risk 2: NocLense runs Tailwind v4.2.1 (see `package.json`
and `@tailwindcss/postcss`). **Tailwind v4 removes `tailwind.config.js`
from the supported configuration surface; theme tokens now live in a CSS
`@theme` block.** Writing a `tailwind.config.js` with `theme.extend` would
be silently ignored by `@tailwindcss/postcss`, and every new utility
(`bg-bg-1`, `text-ink-0`, `text-mint`, `font-display`, `rounded-panel`)
would resolve to nothing.

Add a `@theme` block to `src/styles/tokens.css`, colocated with `:root`
so the entire token story lives in one file:

```css
@theme {
  /* Colors — exposed as bg-*, text-*, border-*, ring-*, etc. utilities */
  --color-bg-0: #05070a;
  --color-bg-1: #0a0d12;
  --color-bg-2: #0f1319;
  --color-bg-3: #151a22;
  --color-ink-0: #f3f5f7;
  --color-ink-1: #cfd4dc;
  --color-ink-2: #8a93a1;
  --color-ink-3: #5b6373;
  --color-line: rgba(255, 255, 255, 0.06);
  --color-line-2: rgba(255, 255, 255, 0.10);
  --color-mint: #8ef0b7;
  --color-mint-dim: #4fb987;
  --color-mint-deep: #133b2a;
  --color-amber: #f7b955;
  --color-red: #ff6b7a;
  --color-violet: #a58cff;
  --color-cyan: #8be5ff;

  /* Fonts — exposed as font-display, font-mono, font-serif */
  --font-display: 'Inter Tight', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
  --font-serif: 'Instrument Serif', serif;

  /* Radii — exposed as rounded-chip, rounded-input, rounded-row, rounded-panel, rounded-win */
  --radius-chip: 6px;
  --radius-input: 8px;
  --radius-row: 10px;
  --radius-panel: 14px;
  --radius-win: 2px;
}
```

**Do NOT create or modify `tailwind.config.js`** — in fact, consider deleting
the existing one (it's a near-empty `{ content, theme: { extend: {} } }`
scaffold from Tailwind v3 that no longer participates in the build). Decide
at commit time:

- If removing `tailwind.config.js` breaks anything (Vite plugin probe, IDE
  hint, etc.), leave it alone with its current empty `extend: {}` state and
  note in commit.
- If removal is clean, delete it in this commit.

**Sanity check before committing:**

Write a tiny test snippet — any temporary file or inline in a component's
JSX — using `bg-bg-1 text-ink-0 rounded-panel font-display`. Run
`npm run build` and inspect the compiled CSS (in `dist/assets/*.css` after
build) for the utilities. If they're absent from the emitted CSS, the
`@theme` block isn't being processed; halt and verify
`@tailwindcss/postcss` is loaded via `postcss.config.js` and that
`tokens.css` is imported via `@import` in `src/styles/index.css`.

Remove the test snippet before committing.

**Gate:** `npm run build` green. Compiled CSS includes `bg-bg-1`,
`text-ink-0`, `rounded-panel`, and `font-display` rules. Tests + lint at
baseline.

### Slice 07A.4 — Token-swap: `log/*` + `correlation-graph/*` + `workspace/*`

**Commit:** `feat(phase-07a): ckpt 07A.4; reskin log + correlation-graph + workspace to new tokens`

Mechanical replacement of hardcoded colors / font names to Tailwind utilities or CSS-variable refs across:

- `src/components/log/*.tsx` (including `LogViewer.tsx`, `LogRow.tsx`, `LogStreamHeader.tsx`, `LogTabs.tsx` and any siblings)
- `src/components/correlation-graph/*.tsx` (post-split files from pre-work)
- `src/components/workspace/*.tsx` (including the three rooms and the post-split `NewWorkspaceLayout` siblings)

**Mapping rules:**

| Old pattern | New pattern |
|---|---|
| `bg-slate-900`, `bg-gray-900`, `bg-zinc-950` | `bg-bg-0` or `bg-bg-1` (pick per surface depth) |
| `bg-slate-800`, `bg-gray-800` | `bg-bg-2` |
| `bg-slate-700`, `bg-gray-700` | `bg-bg-3` |
| `text-white`, `text-slate-50` | `text-ink-0` |
| `text-slate-300`, `text-gray-300` | `text-ink-1` |
| `text-slate-400`, `text-gray-400` | `text-ink-2` |
| `text-slate-500`, `text-gray-500` | `text-ink-3` |
| `text-green-400`, current mint | `text-mint` |
| `text-yellow-400`, `text-amber-400` | `text-amber` |
| `text-red-400`, `text-rose-400` | `text-red` |
| `text-purple-400`, `text-violet-400` | `text-violet` |
| `text-sky-400`, `text-cyan-400` | `text-cyan` |
| `font-mono` (JetBrains Mono) | `font-mono` (unchanged utility; now resolves to Geist Mono) |
| `font-sans` (DM Sans default) | `font-display` |
| border colors referencing white-alpha | `border-line` or `border-line-2` |

**Do not change:** component logic, props, event handlers, state management, or any `className` that is purely structural (flex, grid, gap, padding).

**Per-file checklist (Codex self-assessment):**
- [ ] Visual: rendering matches the zip deck for this surface.
- [ ] No raw hex values left in JSX (grep `#[0-9a-fA-F]{3,8}` in each touched file).
- [ ] No references to DM Sans or JetBrains Mono.
- [ ] Existing unit tests still pass; snapshot tests updated if fonts/colors asserted.

**Gate:** `npm run build` + `npm run test:run` green. Visual diff reviewed by Claude.

### Slice 07A.5 — Token-swap: `ai/*` + `evidence/*` + `filter/*`

**Commit:** `feat(phase-07a): ckpt 07A.5; reskin ai + evidence + filter to new tokens`

Same mechanical rules as Slice 07A.4. Directories:

- `src/components/ai/*` (includes `AiPanel.tsx`, `AiSettingsModal.tsx`, `AIButton.tsx`, etc.)
- `src/components/evidence/*`
- `src/components/filter/*`

**Gate:** as 07A.4.

### Slice 07A.6 — Token-swap: `case/*` + `timeline/*` + `zendesk/*` + remaining reskin bucket

**Commit:** `feat(phase-07a): ckpt 07A.6; reskin case + timeline + zendesk + residual to new tokens`

- `src/components/case/*`
- `src/components/timeline/*`
- `src/components/zendesk/*`
- Any remaining "reskin" bucket files from zip README §Repo-sweep not covered in 07A.4/07A.5 (e.g., `InvestigationSetupModal.tsx` if it lives outside `workspace/`).

**Gate:** as 07A.4. Grep `bg-slate-`, `bg-gray-`, `text-slate-`, `text-gray-` across `src/components/` and `src/pages/` — should return only the `ui/*` primitives (which are addressed separately in later phases) and/or be empty.

### Slice 07A.7 — Investigate + Submit room verification + snapshot sweep

**Commit:** `feat(phase-07a): ckpt 07A.7; verify Investigate + Submit rooms match v5.1 deck + refresh snapshots`

- Load the app in Electron; navigate to Investigate Room; compare against zip deck slide 07. Fix any visual regressions introduced during 07A.4–07A.6.
- Navigate to Submit Room (variation A); compare against slide 08. Fix any regressions.
- Run `npm run test:run -- -u` to refresh all snapshot tests across the affected surface area.
- Inspect updated snapshots; reject any snapshot update that represents a real regression (not just a class rename).
- Delete any test files under `src/styles/__tests__/` that hard-code Green-House color assertions and replace with token-based assertions.

**Gate:** Investigate + Submit rooms visually match the deck. `npm run test:run` green. Zero snapshot updates rejected.

---

## 4. Files that must NOT change in 07A

Behavior/logic-only files — no reskin touches:

- `src/services/**` — services are interface-stable until 07D/07E
- `src/contexts/**` — contexts are logic, not visual
- `src/utils/**` — utilities
- `src/hooks/**` — hooks
- `electron/**` — Electron retires in 07G; do not touch here
- `src-tauri/**` — does not exist yet; created in 07D
- `src/types.ts` — data contract

If a visual component uses an inline style for a non-visual reason (e.g., computed
layout math), leave it alone. Token swap is for theme values only.

## 5. Verification (full 07A gate)

- `npm run build` green
- `npm run test:run` green
- `npm run lint` green
- Claude's manual smoke-test pass on Electron: login → import sample log → Investigate → Submit → export. No visual regressions outside of intended reskin.
- Screenshot diff (Claude responsibility): Investigate Room, Submit Room, Log Viewer, AI Panel, Correlation Graph. Each matches zip deck.
- `grep -r "dm-sans\|jetbrains-mono\|bg-slate-\|bg-gray-\|text-slate-\|text-gray-" src/components/` returns empty outside `ui/*` primitives.
- `grep -r "prefers-color-scheme: light\|data-theme=\"light\"" src/` returns empty.

## 6. Risks specific to 07A

| # | Risk | Mitigation |
|---|---|---|
| A1 | Inter Tight / Instrument Serif not on npm `@fontsource/*` | Verify in 07A.1 first; Google Fonts `<link>` fallback |
| A2 | Tailwind v4 config syntax differs from v3 (project uses v4 per `package.json`) | Check `@tailwindcss/postcss` docs before 07A.3; use `@theme` block in CSS if v4 prefers it over `tailwind.config.js` |
| A3 | Token-swap diff noise is huge; hard to review | Split into 07A.4/5/6 by directory so each diff is bounded; Claude reviews each commit's visual diff before next slice |
| A4 | `ui/*` primitives (Button, Card, Dialog, etc.) out of reskin scope but cascade through app | These are noted in zip README §Rebuild bucket; addressed during 07B when new screens need them. 07A leaves them alone. |
| A5 | Existing snapshot tests assert specific hex values | 07A.7 refreshes snapshots; Claude reviews updates for regressions vs intended changes |

## 7. Codex dispatch prompt (ready to paste)

(User can copy the following into Codex CLI to kick off 07A.)

```
You are working in the NocLense repo at
C:/Users/somur/Documents/NocLense/NocLense on branch april-redesign.

Primary agent: frontend-design (per
docs/superpowers/feedback_codex_agent_assignments.md — tokens/visual slice).

Execute Phase 07A per
docs/superpowers/specs/2026-04-22-phase-07a-tokens-reskin-design.md.

Start with the pre-work commit (file-size split) as specified in §2.
Then run the 7 slices 07A.1–07A.7 in order, one commit each, using the
commit prefixes given.

Run per-slice self-assessment per HANDOFF.md lightweight review policy;
do not per-commit block on YELLOWs, log them. Only NO-GO blocks.

After each commit, run:
  npm run build
  npm run test:run
  npm run lint

If any are red, halt and pass the output back to Claude.

Do not touch:
- src/services/, src/contexts/, src/utils/, src/hooks/, src/types.ts
- electron/
- ui/* primitives (scope of 07B)

Reference for token values: the master plan at
docs/superpowers/specs/2026-04-22-phase-07-tauri-migration-master-plan.md
and the zip at NocLense Standalone.zip →
design_handoff_noclense_v5_tauri/README.md §Design-Tokens.
```

## 8. What Gemini does at 07A close

- Update `README.md` "Design System" / "Styling" section to reflect obsidian + phosphor tokens and new font stack.
- Update `docs/USAGE_GUIDE.md` only if screenshots are embedded (refresh them).
- Update `docs/DEVELOPER_HANDOFF.md` — close 07A block with shipped commits + scope note.
- Remove any residual Green-House mentions.
- Archive `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md` under an `archived/` subfolder if it is now superseded (decide at 07A close).

---

**End of 07A slice plan.** 07B (Auth + Dashboard) slice plan is written after 07A merges.

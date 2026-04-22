# Phase 04 — Focus-Mode Cards + Room Polish: Implementation Plan

> **For agentic workers:** Read spec §5.5, §6.1, §6.5 in
> `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`
> and the shortcut audit at
> `docs/superpowers/specs/contracts/shortcut-audit.md` before starting.
> Implement task-by-task in commit order. Stop after each commit's
> self-assessment and wait for overview.

**Goal:** Ship the focus-mode card toggle (the polish-pass substitute
for resizable panels), close out the Submit Room polish items flagged
during Phase 03 close-out, and add the Import Room hover/glow affordance
from §6.1. Also lands the investigation/evidence ID invariant guard
Codex hand-off item #2.

**Spec anchors:**
- §5.5 — focus-mode toggle as Phase-4 substitute for resize panels
- §6.1 — Import Room polish (hover scale, `glow-ready`)
- §6.5 — Phase 04 row
- §4.2 / §4.5 — interruption rule + press-scale exclusions

**Tech stack:** React 19, TypeScript strict, Tailwind 4, CSS custom
properties only, Vitest + Testing Library. **No new dependencies.**

---

## Revision v2 — Post-Codex review

v1 returned NO-GO with six required fixes. This revision addresses
each one explicitly; the plan below is the corrected version.

| # | v1 blocker | v2 resolution |
|---|---|---|
| 1 | Provider placed below `WorkspaceGrid`, which needs to consume focus state | `WorkspaceGrid` owns the provider internally for the `'investigate'` branch only. Non-investigate layouts render without a provider. |
| 2 | `NO_OP` default hides missing-provider bugs and contradicts the "no button outside provider" test | `useCardFocus()` returns `CardFocusContextValue \| undefined`. `WorkspaceCard` does an explicit undefined check and omits the focus button when outside a provider. |
| 3 | Siblings `opacity: 0` + `pointer-events: none` leaves controls reachable by AT; "rail" not delivered | Siblings use `display: none` (fully inert). A literal rail (with the §8 ratio open detail) is explicitly deferred to Phase 05. The spec's §8 rail-ratio open item moves from "Phase 04 resolves" to "Phase 05 resolves" via a single-line spec edit. |
| 4 | Esc capture handler didn't respect the shortcut suppression matrix; "second Esc aborts diagnose" claim was unsupported | Add `isInSuppressedContext` helper covering every audit §3 row the renderer can observe: `<input>`, `<textarea>`, `contenteditable`, open `<dialog>`, and `role="menu"`/`role="menubar"` ancestors (DOM-rendered menus). Electron-native menu suppression is OS-level — events never reach the renderer, so no code is needed. Remove the false AI-abort claim — current AI Esc is fast-forward reveal only (`CanonicalBlockRenderer.tsx:47`), no abort path exists today. |
| 5 | `transition-all` on the drop zone violates spec §4.2 "never use `transition: all`" | Specify `transition-transform`, `transition-shadow`, `duration-150 ease-out` as discrete Tailwind utilities. |
| 6 | Submit Room resync keyed on `investigation.id` misses same-id reloads | `EvidenceContext` exposes a monotonic `loadGeneration: number` counter that bumps inside `setInvestigation` and `restoreEvidenceSet`. SubmitRoom keys its reset effect on the counter, which increments on every deliberate load regardless of whether the id changed. |

Also corrected:
- **Foundation assumption 2** — `CARD_GRID_CLASSES` are applied at the call sites in `NewWorkspaceLayout.tsx`, not inside `WorkspaceGrid.tsx`. Plan mechanics are unaffected (focus-mode CSS selects on `[data-card-id]` regardless of where positioning classes live) but the assumption is now accurate.
- **Create-REP deferral** — spec §6.1's "one-click ... Create-REP ..." is satisfied by the existing "Copy Jira Template" button shipped in Phase 03. Phase 04 does NOT add a direct Jira API POST path; that's Phase 05+ scope. Documented explicitly in the non-goals table below.
- **Commit ordering** — reordered so the provider architecture lands in a single commit before any CSS or call-site work that depends on it.

### Revision v3 — Second-pass Codex follow-ups

v2 returned NO-GO on two live blockers + two stale references:

| # | v2 issue | v3 resolution |
|---|---|---|
| 1 | `isInSuppressedContext` missed audit §3 menu-bar / context-menu row | Added `active.closest('[role="menu"],[role="menubar"]')` check. Documented that Electron-native menus are OS-suppressed (events never reach renderer) so no extra code is needed for that row. Added two new unit tests covering menu + menubar roles. |
| 2 | Verification checklist still claimed "second Esc aborts diagnose" | Removed that bullet. Replaced with two accurate bullets covering Esc-exit semantics AND the suppression case. |
| 3 | File map listed `NewWorkspaceLayout.tsx` as modified | Removed the entry. Added explicit non-edit note: layout file is untouched in Phase 04. |
| 4 | Foundation assumption 3 attributed `loadGeneration` to Commit 6 | Corrected: Commit 4 owns the counter; Commit 6 adds the guard inside Commit 4's wrapper. |
| 5 | Live `transition-all` on `WorkspaceGrid` root ignored while Commit 2 edits the file | Added a Step-2 instruction to Commit 2 that replaces `transition-all` with specific properties (`transition-[background-color,opacity]`) on both the Import and Submit branches. |

---

## Spec ambiguity resolution

§5.5 contains the phrase "Phase 05 ships this" for the focus-mode
toggle. §6.5's roadmap table assigns it to Phase 04. **§6.5 wins** —
it's the authoritative phase ordering and was revised in the v2 spec
pass. This plan delivers focus mode in Phase 04. A side edit in the
final commit cleans up the §5.5 stray reference.

---

## Foundation assumptions (verify before first commit)

1. `src/components/workspace/WorkspaceCard.tsx` exists and exposes
   `id`, `expanded` state, and renders `data-card-id={id}`. The
   imperative height animation lifecycle must remain untouched by
   this phase — focus mode operates on the grid layer, not the
   card's internal layout.
2. `CARD_GRID_CLASSES` is EXPORTED from `WorkspaceGrid.tsx` but
   APPLIED at the call sites inside `NewWorkspaceLayout.tsx`
   (approx. lines 194–341). Focus mode does not touch these classes;
   it operates on `[data-card-id]` and `[data-focus-target]`
   attributes via CSS selectors, independent of layout classes.
3. `src/contexts/EvidenceContext.tsx` exposes `setInvestigation` and
   `restoreEvidenceSet` (Phase 03 Commit 3). Commit 4 adds a
   `loadGeneration` counter (bumped in both wrappers); Commit 6
   adds the ID invariant check inside the same `restoreEvidenceSet`
   wrapper Commit 4 authored. Between Commit 4 and Commit 6 the
   wrapper is temporarily unguarded — tolerable because the guard
   only catches developer-error, not user input.
4. `src/components/import/WorkspaceImportPanel.tsx` owns the drop
   zone — not `NewWorkspaceLayout` (same seam Codex flagged during
   Phase 03 Commit 4 review).
5. Shortcut audit (`docs/superpowers/specs/contracts/shortcut-audit.md`)
   names `Esc` for AI Diagnose. Verified actual behavior today:
   fast-forward reveal only (`CanonicalBlockRenderer.tsx:47`), no
   abort-in-flight path exists. Focus-exit Esc must still be
   higher-priority AND respect the suppression matrix in §3 of the
   audit.

---

## Non-goals (Phase 04 explicit carve-outs)

- **No new dependency.** `react-resizable-panels` is still deferred
  per spec §5.5.
- **No literal rail sidebar.** Spec §5.5 language "siblings collapse
  to rail" is interpreted for Phase 04 as "siblings removed from
  view" (`display: none`). A literal rail with visible strips/
  buttons is Phase 05 polish. The §8 open item on rail collapse
  ratio moves with it.
- **No direct Jira API POST (Create-REP).** Spec §6.1's "Create-REP"
  action is satisfied today by the "Copy Jira Template" button from
  Phase 03 Commit 5 — engineers paste into Jira. A direct API path
  is Phase 05+ scope. This is an explicit interpretation, not an
  undeclared deferral.
- **No Correlation Graph / Datadog Live / Similar Tickets polish.**
  Those belong to the Phase 05 broad pass.
- **No PhaseHeader / PhaseDots tokenization.** Phase 05.
- **No Ctrl+K command palette.** Still deferred per spec §7.
- **No URL-paste → investigate flow on Import Room.** The spec §6.1
  calls for this, but it requires a new routing surface. Captured as
  a Phase 05 hand-off.
- **No DOM-flight choreography.** Still deferred per spec §6.2.
- **No evidence bundle-size pulse at >100 KB (§5.4).** Visual polish
  deferred to Phase 05 broad pass.

---

## File map

### New files
```
src/components/workspace/CardFocusContext.tsx
src/components/workspace/__tests__/CardFocusContext.test.tsx
src/hooks/useCopyFeedback.ts
src/hooks/__tests__/useCopyFeedback.test.ts
src/styles/focus-mode.css
```

### Modified files
```
src/components/workspace/WorkspaceCard.tsx        (add ⊞ icon + toggle)
src/components/workspace/WorkspaceGrid.tsx        (owns provider for investigate layout; also strip transition-all)
src/components/workspace/SubmitRoom.tsx           (useCopyFeedback + resync via loadGeneration)
src/components/import/WorkspaceImportPanel.tsx    (hover scale + glow)
src/contexts/EvidenceContext.tsx                  (loadGeneration counter + id invariant guard)
src/services/investigationExporter.ts             (re-import InvestigationMismatchError from shared location)
src/index.css                                     (import focus-mode.css)
docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md  (§5.5 + §8 cleanup)
```

**Explicit non-edit:** `NewWorkspaceLayout.tsx` is NOT touched in Phase 04. `CardFocusProvider` lives inside `WorkspaceGrid` (Commit 2), so the layout file has no focus-mode concerns.

---

## Commit 1 — Card focus-mode infrastructure

**Scope:** Context provider, card header toggle button, CSS rules that
react to a `data-focused` attribute on the grid. No wiring into
specific rooms yet.

**State model:**

```
CardFocusContextValue = {
  focusedCardId: string | null,
  focusCard: (id: string) => void,
  unfocus: () => void,
  toggleFocus: (id: string) => void,
}
```

**Outside a provider:** `useCardFocus()` returns `undefined`.
Consumers (specifically `WorkspaceCard`) must explicit-check for
undefined and hide UI that depends on focus mode. This replaces the
v1 NO_OP pattern which hid missing-provider bugs and contradicted
the "no button outside provider" test.

**CSS approach (no new dependency):**

When `focusedCardId !== null`, the grid receives
`data-focused="<id>"`. Two CSS rules:

```css
/* Focused card: fill the entire grid */
[data-layout="investigate"][data-focused] [data-card-id][data-focus-target="true"] {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  z-index: 2;
}

/* Non-focused siblings: fully inert. Phase 04 uses display: none
   rather than opacity tricks so keyboard + assistive tech cannot
   reach them. A literal visible rail is Phase 05 scope. */
[data-layout="investigate"][data-focused] [data-card-id]:not([data-focus-target="true"]) {
  display: none;
}
```

No transitions on this rule because `display: none` is binary (can't
interpolate). The swap is instantaneous in both motion and reduced-
motion modes — which is also acceptable for AT users.

**Why this approach:** Uses existing grid tokens; no per-card JS
animation; no new library; no AT hazards from hidden-but-reachable
elements. The card's internal height animation machinery is
untouched. Focus mode is a pure parent-grid-level concern.

**Shortcut decision:**
- `⊞` icon click → toggle focus for that card.
- `Esc` while a card is focused → unfocus, subject to the
  suppression matrix below.
- No new global shortcut. `Ctrl+Enter` remains for AI chat send.

**Esc suppression matrix check (required — addresses v1 fix #4):**

The focus-exit Esc handler must NOT consume Esc when any of the
following are focused:
- `<input>` (any type)
- `<textarea>`
- element with `contenteditable="true"`
- inside an open native `<dialog>`

This matches `shortcut-audit.md` §3. In those cases the handler
returns without calling `unfocus()` and without calling
`stopPropagation()`, so the native Esc behavior inside the input/
dialog remains.

Helper lives beside the hook and is unit-tested independently.

**Esc priority clarification:** v1 claimed that a second Esc press
would abort an in-flight AI Diagnose request. That claim was
unsupported — the current AI Esc handler in
`CanonicalBlockRenderer.tsx:47` only fast-forwards the typewriter
reveal; there is no abort path. The v2 plan removes the abort claim.
Phase 04 behavior: single Esc (outside a text input) exits focus
mode; if no card is focused, Esc does nothing new.

---

### Task 1a: `CardFocusContext.tsx`

- [ ] **Step 1: Create the context and provider**

```typescript
/**
 * CardFocusContext — parent-scoped card focus state.
 *
 * Outside a provider, `useCardFocus()` returns `undefined`. Callers
 * must explicitly handle the undefined case (typically by NOT
 * rendering the focus button). This makes missing-provider bugs
 * visible in components rather than silently swallowing them.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

export interface CardFocusContextValue {
  focusedCardId: string | null;
  focusCard: (id: string) => void;
  unfocus: () => void;
  toggleFocus: (id: string) => void;
}

const CardFocusContext = createContext<CardFocusContextValue | undefined>(undefined);

export function CardFocusProvider({ children }: { children: ReactNode }): JSX.Element {
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  const focusCard = useCallback((id: string) => {
    setFocusedCardId(id);
  }, []);

  const unfocus = useCallback(() => {
    setFocusedCardId(null);
  }, []);

  const toggleFocus = useCallback((id: string) => {
    setFocusedCardId((current) => (current === id ? null : id));
  }, []);

  const value = useMemo<CardFocusContextValue>(
    () => ({ focusedCardId, focusCard, unfocus, toggleFocus }),
    [focusedCardId, focusCard, unfocus, toggleFocus],
  );

  return (
    <CardFocusContext.Provider value={value}>{children}</CardFocusContext.Provider>
  );
}

/**
 * Read the nearest CardFocusProvider. Returns `undefined` when no
 * provider is in scope; callers MUST handle this case. This is the
 * deliberate opt-in behavior for surfaces that don't offer focus
 * mode (Import Room, Submit Room).
 */
export function useCardFocus(): CardFocusContextValue | undefined {
  return useContext(CardFocusContext);
}

/**
 * Suppression matrix check — returns true when the currently-focused
 * DOM element is in a context where app shortcuts must not consume
 * the event. Mirrors `shortcut-audit.md` §3.
 *
 * Covers every row of §3 that the renderer CAN observe:
 *   - <input>, <textarea>, contenteditable (text entry)
 *   - open <dialog> (native modal)
 *   - role="menu" / role="menubar" (DOM-rendered menus and dropdowns
 *     from component libraries such as Radix UI ContextMenu)
 *
 * The §3 "Electron menu bar / context menu" row is covered
 * automatically by the OS — when a native Electron menu is open the
 * OS consumes keyboard input before it reaches the renderer
 * `window.addEventListener`. No renderer-side code is needed.
 *
 * Exported so other shortcut handlers in later phases can reuse it.
 */
export function isInSuppressedContext(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  const tag = active.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (active.isContentEditable) return true;
  if (active.closest('dialog[open]')) return true;
  // DOM-rendered menu / menubar (React dropdowns, Radix ContextMenu, etc.)
  if (active.closest('[role="menu"],[role="menubar"]')) return true;
  return false;
}
```

- [ ] **Step 2: Tests**

```typescript
// src/components/workspace/__tests__/CardFocusContext.test.tsx
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import {
  CardFocusProvider,
  isInSuppressedContext,
  useCardFocus,
} from '../CardFocusContext';

function wrapper({ children }: { children: ReactNode }) {
  return <CardFocusProvider>{children}</CardFocusProvider>;
}

describe('CardFocusContext', () => {
  it('defaults to null focus inside a provider', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });
    expect(result.current?.focusedCardId).toBe(null);
  });

  it('returns undefined outside a provider', () => {
    const { result } = renderHook(() => useCardFocus());
    expect(result.current).toBeUndefined();
  });

  it('focusCard sets focusedCardId', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });
    act(() => result.current?.focusCard('log-stream'));
    expect(result.current?.focusedCardId).toBe('log-stream');
  });

  it('unfocus clears focusedCardId', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });
    act(() => result.current?.focusCard('ai-assistant'));
    act(() => result.current?.unfocus());
    expect(result.current?.focusedCardId).toBe(null);
  });

  it('toggleFocus toggles the same card off', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });
    act(() => result.current?.toggleFocus('ai-assistant'));
    act(() => result.current?.toggleFocus('ai-assistant'));
    expect(result.current?.focusedCardId).toBe(null);
  });

  it('toggleFocus switches between cards', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });
    act(() => result.current?.toggleFocus('ai-assistant'));
    act(() => result.current?.toggleFocus('evidence'));
    expect(result.current?.focusedCardId).toBe('evidence');
  });
});

describe('isInSuppressedContext', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('returns false when no element is focused', () => {
    expect(isInSuppressedContext()).toBe(false);
  });

  it('returns true when an <input> is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when a <textarea> is focused', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when a contenteditable element is focused', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when focus is inside an open <dialog>', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    button.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when focus is inside a role="menu" element', () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    item.setAttribute('role', 'menuitem');
    menu.appendChild(item);
    document.body.appendChild(menu);
    item.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when focus is inside a role="menubar" element', () => {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'menubar');
    const item = document.createElement('button');
    bar.appendChild(item);
    document.body.appendChild(bar);
    item.focus();
    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns false for a plain <button>', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    expect(isInSuppressedContext()).toBe(false);
  });
});
```

---

### Task 1b: `WorkspaceCard.tsx` integration

- [ ] **Step 3: Add focus toggle to the card header**

Import `Maximize2` and `Minimize2` from `lucide-react` — these are
the closest built-in match for the `⊞` glyph. (Avoid unicode symbols
for glyph fidelity across fonts.)

Above `WorkspaceCard` function signature, import:

```typescript
import { Maximize2, Minimize2 } from 'lucide-react';
import { isInSuppressedContext, useCardFocus } from './CardFocusContext';
```

Inside the component:

```typescript
const focusCtx = useCardFocus();  // may be undefined outside a provider
const isFocused = focusCtx?.focusedCardId === id;
```

**Rendering rule:** the focus button renders only when
`focusCtx !== undefined` AND `expanded === true`. Cards outside a
provider (Import Room, Submit Room) show no button. Collapsed cards
show no button. Only expanded cards inside a `CardFocusProvider`
offer focus mode.

```tsx
{focusCtx !== undefined && expanded && (
  <button
    type="button"
    aria-label={isFocused ? `Exit focus for ${title}` : `Focus ${title}`}
    aria-pressed={isFocused}
    onClick={(event) => {
      event.stopPropagation();
      focusCtx.toggleFocus(id);
    }}
    className={clsx(
      'ml-1 shrink-0 p-1 rounded-[var(--radius-sm)]',
      'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      'hover:bg-[var(--muted)]/40',
      'transition-colors transition-background-color duration-150',
    )}
  >
    {isFocused ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
  </button>
)}
```

Position note: the existing `meta` slot uses `ml-auto` to push to
the right. The focus button uses `ml-1` and sits immediately after
meta, so meta keeps the right-push and the button follows it. If
meta is absent, the focus button also needs `ml-auto` — handle this
with a conditional class.

- [ ] **Step 4: Add `data-focus-target` to the card root**

Replace the root `<div>` attribute line:

```tsx
<div
  data-card-id={id}
  data-focus-target={isFocused ? 'true' : 'false'}
  ...
```

This attribute is what the CSS rules in Task 1c select on. Always
emit the attribute (not conditionally) so selectors can rely on it.

- [ ] **Step 5: Wire `Esc`-to-unfocus with suppression matrix**

Inside `WorkspaceCard`, add:

```typescript
useEffect(() => {
  if (!focusCtx || !isFocused) return;

  function handleKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    // Respect the suppression matrix: Esc in a text input, textarea,
    // contenteditable, or open dialog must fall through to native
    // behavior. See shortcut-audit.md §3.
    if (isInSuppressedContext()) return;
    event.stopPropagation();
    focusCtx.unfocus();
  }

  window.addEventListener('keydown', handleKey, /* capture */ true);
  return () => {
    window.removeEventListener('keydown', handleKey, true);
  };
}, [focusCtx, isFocused]);
```

Capture phase (`true`) ensures focus-exit runs before any AI Diagnose
Esc handler. `stopPropagation()` fires only when we actually consume
the event; text-input and dialog cases fall through untouched.

- [ ] **Step 6: Tests for `WorkspaceCard` focus integration**

Extend `src/components/workspace/__tests__/WorkspaceCard.test.tsx`:

```typescript
describe('WorkspaceCard focus mode', () => {
  function renderWithProvider(
    props?: Partial<React.ComponentProps<typeof WorkspaceCard>>,
  ) {
    return render(
      <CardFocusProvider>
        <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000" {...props}>
          body
        </WorkspaceCard>
      </CardFocusProvider>,
    );
  }

  it('renders focus button when expanded inside a provider', () => {
    renderWithProvider();
    expect(screen.getByRole('button', { name: /focus test/i })).toBeInTheDocument();
  });

  it('does NOT render focus button outside a CardFocusProvider', () => {
    render(
      <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000">
        body
      </WorkspaceCard>,
    );
    expect(
      screen.queryByRole('button', { name: /focus test/i }),
    ).not.toBeInTheDocument();
  });

  it('does NOT render focus button when collapsed (defaultExpanded=false)', () => {
    render(
      <CardFocusProvider>
        <WorkspaceCard
          id="t1"
          title="Test"
          icon={null}
          accentColor="#000"
          defaultExpanded={false}
        >
          body
        </WorkspaceCard>
      </CardFocusProvider>,
    );
    expect(
      screen.queryByRole('button', { name: /focus test/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking focus button sets data-focus-target=true', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider();
    await user.click(screen.getByRole('button', { name: /focus test/i }));
    expect(container.querySelector('[data-card-id="t1"]'))
      .toHaveAttribute('data-focus-target', 'true');
  });

  it('Esc while focused clears focus', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider();
    await user.click(screen.getByRole('button', { name: /focus test/i }));
    await user.keyboard('{Escape}');
    expect(container.querySelector('[data-card-id="t1"]'))
      .toHaveAttribute('data-focus-target', 'false');
  });

  it('Esc while focused and an <input> is focused does NOT clear focus', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CardFocusProvider>
        <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000">
          <input data-testid="inside-input" />
        </WorkspaceCard>
      </CardFocusProvider>,
    );
    await user.click(screen.getByRole('button', { name: /focus test/i }));
    screen.getByTestId('inside-input').focus();
    await user.keyboard('{Escape}');
    // Should still be focused because Esc was suppressed while input had focus
    expect(container.querySelector('[data-card-id="t1"]'))
      .toHaveAttribute('data-focus-target', 'true');
  });

  it('focus button clicks do not toggle expand/collapse', async () => {
    const onExpandChange = vi.fn();
    const user = userEvent.setup();
    renderWithProvider({ onExpandChange });
    await user.click(screen.getByRole('button', { name: /focus test/i }));
    expect(onExpandChange).not.toHaveBeenCalled();
  });
});
```

---

### Task 1c: `focus-mode.css`

- [ ] **Step 7: Create the CSS file**

```css
/* focus-mode.css — Phase 04 focus-mode toggle
 *
 * Activation: the Investigate grid stamps `data-focused="<cardId>"`
 * when a card is focused. The focused card renders
 * `data-focus-target="true"`; non-focused siblings render
 * `data-focus-target="false"`.
 *
 * Phase 04 siblings are display: none rather than opacity-hidden so
 * keyboard + AT cannot reach inert controls. A literal visible rail
 * is Phase 05 work (see plan §Non-goals).
 */

/* Focused card fills the grid (spans all columns and rows). */
[data-layout="investigate"][data-focused]
  [data-card-id][data-focus-target="true"] {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  z-index: 2;
}

/* Non-focused siblings: fully inert. */
[data-layout="investigate"][data-focused]
  [data-card-id][data-focus-target="false"] {
  display: none;
}
```

**No transitions:** `display: none` is binary — it cannot interpolate.
The swap is instantaneous, which is fine under both default and
reduced-motion conditions.

- [ ] **Step 8: Import from `src/index.css`**

```css
@import './styles/focus-mode.css';
```

(Place after existing imports.)

- [ ] **Step 9: Verify build and tests**

```bash
npx tsc --noEmit
npx vitest run
npx eslint <scoped files>
```

- [ ] **Step 10: Commit**

```bash
git add \
  src/components/workspace/CardFocusContext.tsx \
  src/components/workspace/__tests__/CardFocusContext.test.tsx \
  src/components/workspace/WorkspaceCard.tsx \
  src/components/workspace/__tests__/WorkspaceCard.test.tsx \
  src/styles/focus-mode.css \
  src/index.css
git commit -m "feat(phase-04): add card focus-mode infrastructure — CardFocusContext, WorkspaceCard toggle, CSS"
```

---

## Commit 2 — Wire focus-mode into Investigate Room grid

**Scope:** `WorkspaceGrid` owns the `CardFocusProvider` internally,
gated on `layout === 'investigate'`. An inner component INSIDE the
provider reads `useCardFocus()` and stamps `data-focused` on the
grid root. This resolves v1 blocker #1 — v1 placed the provider in
`NewWorkspaceLayout` children, but `WorkspaceGrid` (the consumer)
rendered in `RoomRouter` ABOVE those children.

**Provider scope rule:** The provider lives only inside the
`'investigate'` branch. Import Room and Submit Room render without
a provider, which means `useCardFocus()` returns `undefined` in
those trees and `WorkspaceCard` omits the focus button automatically.

**Architecture diagram:**

```
RoomRouter
  WorkspaceGrid (layout prop)
    ├── layout === 'import'    → centered flex container, no provider
    ├── layout === 'investigate' →
    │     CardFocusProvider
    │       InvestigateGridInner (reads useCardFocus, stamps data-focused)
    │         children (6 WorkspaceCards)
    └── layout === 'submit'    → side-by-side flex container, no provider
```

- [ ] **Step 1: Create `InvestigateGridInner` in `WorkspaceGrid.tsx`**

At the top of `src/components/workspace/WorkspaceGrid.tsx`, add:

```tsx
import { CardFocusProvider, useCardFocus } from './CardFocusContext';

function InvestigateGridInner({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const focus = useCardFocus();
  const focusedCardId = focus?.focusedCardId ?? null;
  return (
    <div
      data-layout="investigate"
      data-room="investigate"
      data-focused={focusedCardId ?? undefined}
      className={clsx(
        'h-full min-h-0 grid gap-2 p-2 overflow-hidden',
        className,
      )}
      style={{
        gridTemplateColumns: '1fr 1fr 340px',
        gridTemplateRows: 'auto 1fr auto',
        background: 'var(--room-investigate-bg)',
        transitionDuration: 'var(--room-transition-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
    >
      {children}
    </div>
  );
}
```

**Note on `data-focused={undefined}`:** React does not render an
attribute whose value is `undefined`. So when no card is focused
the attribute is absent entirely, and the focus-mode CSS selector
`[data-focused]` does not match. Intentional.

- [ ] **Step 2: Update the layout branch in `WorkspaceGrid`**

Replace the existing `layout === 'investigate'` branch in
`WorkspaceGrid` with the provider + inner composition:

```tsx
if (layout === 'investigate') {
  return (
    <CardFocusProvider>
      <InvestigateGridInner className={className}>
        {children}
      </InvestigateGridInner>
    </CardFocusProvider>
  );
}
```

The Import and Submit branches remain exactly as they are today —
no provider, no focus mode.

**Also strip the `transition-all` violation.** The current root
element uses `transition-all` (line ~15), which violates spec §4.2.
Since Commit 2 is already editing this file, replace `transition-all`
in both the Import and Submit branch class lists with specific
properties:

```tsx
// Before (both Import and Submit branches):
'h-full min-h-0 overflow-hidden transition-all',

// After:
'h-full min-h-0 overflow-hidden transition-[background-color,opacity] duration-[var(--room-transition-duration,200ms)]',
```

The grid root only ever transitions `background-color` (room tint)
and `opacity` (handled by `useRoomTransition`); no other property
changes at this layer. Listing them explicitly keeps §4.2 compliance
and removes a latent bug where unrelated hover styles on deeply
nested children would otherwise try to transition.

The `InvestigateGridInner` snippet in Step 1 already uses the
specific-property pattern via inline `style={{ transitionDuration, transitionTimingFunction }}` — no additional change needed there.

- [ ] **Step 3: No changes needed in `NewWorkspaceLayout`**

`NewWorkspaceLayout` passes `investigateContent` to `RoomRouter`
which passes it to `WorkspaceGrid`. The provider now lives inside
the grid, so nothing in the layout file needs to change. Confirm
by grep: `git grep -n CardFocusProvider src/components/workspace/NewWorkspaceLayout.tsx` should return no matches.

- [ ] **Step 4: Manual smoke in the dev server**

Before committing, run `npm run electron:dev` and verify:
1. Investigate Room shows `⊞` icon on each expanded card.
2. Clicking `⊞` on Log Stream makes it fill the grid; siblings
   vanish (`display: none`).
3. Clicking `⊟` (Minimize2) or pressing Esc returns to the default
   6-card layout.
4. Import Room drop zone: no `⊞` icon anywhere (no provider → no
   button).
5. Submit Room (Closure Note + Evidence Summary): no `⊞` icons.
6. Typing in the Closure Note textarea, pressing Esc does NOT exit
   focus (there is no focus to exit, and Esc-in-textarea is
   suppressed anyway).

- [ ] **Step 5: Tests**

Add `src/components/workspace/__tests__/WorkspaceGrid.test.tsx`
(create if absent):

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WorkspaceGrid } from '../WorkspaceGrid';
import { WorkspaceCard } from '../WorkspaceCard';

describe('WorkspaceGrid', () => {
  it('investigate layout provides CardFocusProvider to children', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WorkspaceGrid layout="investigate">
        <WorkspaceCard id="c1" title="Card 1" icon={null} accentColor="#000">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );
    // Focus button should be present (means provider is in scope)
    const btn = screen.getByRole('button', { name: /focus card 1/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(
      container.querySelector('[data-layout="investigate"]'),
    ).toHaveAttribute('data-focused', 'c1');
  });

  it('submit layout does NOT provide CardFocusProvider', () => {
    render(
      <WorkspaceGrid layout="submit">
        <WorkspaceCard id="c1" title="Card 1" icon={null} accentColor="#000">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );
    expect(
      screen.queryByRole('button', { name: /focus card 1/i }),
    ).not.toBeInTheDocument();
  });

  it('import layout does NOT provide CardFocusProvider', () => {
    render(
      <WorkspaceGrid layout="import">
        <WorkspaceCard id="c1" title="Card 1" icon={null} accentColor="#000">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );
    expect(
      screen.queryByRole('button', { name: /focus card 1/i }),
    ).not.toBeInTheDocument();
  });

  it('grid root carries no data-focused attribute when no card is focused', () => {
    const { container } = render(
      <WorkspaceGrid layout="investigate">
        <WorkspaceCard id="c1" title="Card 1" icon={null} accentColor="#000">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );
    expect(
      container.querySelector('[data-layout="investigate"]'),
    ).not.toHaveAttribute('data-focused');
  });
});
```

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
npx eslint <scoped files>

git add \
  src/components/workspace/WorkspaceGrid.tsx \
  src/components/workspace/__tests__/WorkspaceGrid.test.tsx
git commit -m "feat(phase-04): WorkspaceGrid owns CardFocusProvider for the investigate layout only"
```

---

## Commit 3 — Extract `useCopyFeedback` hook + apply to SubmitRoom

**Scope:** Codex's Phase 03 hand-off item: copy-state `setTimeout`
leaks when the component unmounts during the 2s window. Extract a
shared hook that handles cleanup correctly.

**Hook contract:**

```typescript
const [copied, triggerCopy] = useCopyFeedback(2000);
// triggerCopy returns a function that writes to clipboard + flashes `copied = true`.
// Unmount-safe: pending timeout is cleared in the useEffect cleanup.
```

- [ ] **Step 1: Create the hook**

```typescript
/**
 * useCopyFeedback — copy-to-clipboard with transient "Copied!"
 * feedback state. Cleans up its pending timeout on unmount so an
 * unmount mid-flash does not call setState on an unmounted component.
 *
 * @param flashMs  How long the `copied === true` state lingers after a
 *                 successful copy. Defaults to 2000ms.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCopyFeedbackResult {
  copied: boolean;
  /**
   * Writes `text` to the clipboard and flashes `copied = true` for
   * `flashMs`. If the clipboard write rejects, `copied` stays false
   * and the returned promise rejects with the underlying error.
   */
  copy: (text: string) => Promise<void>;
}

export function useCopyFeedback(flashMs = 2000): UseCopyFeedbackResult {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      if (!mountedRef.current) return;
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
        timeoutRef.current = null;
      }, flashMs);
    },
    [flashMs],
  );

  return { copied, copy };
}
```

- [ ] **Step 2: Tests**

```typescript
// src/hooks/__tests__/useCopyFeedback.test.ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyFeedback } from '../useCopyFeedback';

describe('useCopyFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Provide a minimal clipboard mock for jsdom
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with copied=false', () => {
    const { result } = renderHook(() => useCopyFeedback());
    expect(result.current.copied).toBe(false);
  });

  it('sets copied=true after a successful copy', async () => {
    const { result } = renderHook(() => useCopyFeedback(1000));
    await act(async () => { await result.current.copy('hello'); });
    expect(result.current.copied).toBe(true);
  });

  it('clears copied after the flash window', async () => {
    const { result } = renderHook(() => useCopyFeedback(1000));
    await act(async () => { await result.current.copy('hello'); });
    act(() => { vi.advanceTimersByTime(1001); });
    expect(result.current.copied).toBe(false);
  });

  it('does not throw when unmounting mid-flash', async () => {
    const { result, unmount } = renderHook(() => useCopyFeedback(1000));
    await act(async () => { await result.current.copy('hello'); });
    // No assertion beyond "unmount doesn't error"
    expect(() => unmount()).not.toThrow();
    // Advance timers after unmount — should not throw either
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });

  it('rejects when the clipboard write rejects', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('denied'),
    );
    const { result } = renderHook(() => useCopyFeedback());
    await expect(
      act(async () => { await result.current.copy('hello'); }),
    ).rejects.toThrow(/denied/);
    expect(result.current.copied).toBe(false);
  });
});
```

- [ ] **Step 3: Apply to SubmitRoom**

In `src/components/workspace/SubmitRoom.tsx`:

Replace the inline `setTimeout` patterns in both `ClosureNoteCard`
and `EvidenceSummaryCard`:

```typescript
// Before (ClosureNoteCard):
const [copied, setCopied] = useState(false);

async function handleCopy(): Promise<void> {
  await navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

// After:
const { copied, copy } = useCopyFeedback();
const handleCopy = () => copy(text);
```

Same substitution in `EvidenceSummaryCard` using `jiraFormatted`.

The `Button onClick` changes from `() => void handleCopy()` to
`() => void handleCopy()` (unchanged, still void-wrapping the
promise).

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
npx eslint <scoped files>

git add \
  src/hooks/useCopyFeedback.ts \
  src/hooks/__tests__/useCopyFeedback.test.ts \
  src/components/workspace/SubmitRoom.tsx
git commit -m "feat(phase-04): extract useCopyFeedback hook with unmount-safe cleanup, apply in SubmitRoom"
```

---

## Commit 4 — Normalize SubmitRoom initial-note resync via `loadGeneration`

**Scope:** Codex hand-off item + v1 blocker #6. Today `SubmitRoom`
calls `setPrevInitial` and `setEditedNote` during render when the
initial res-note text changes. This works today but is brittle
(React emits a dev warning under StrictMode; future React may
tighten). Move the logic into `useEffect`.

**v1 approach was too weak.** Keying on `investigation.id` misses
same-id reloads (import replaces the investigation with the same id,
server refresh, restore). A legit reload should reset; bare id
comparison misses that case.

**v2 approach:** `EvidenceContext` exposes a monotonic
`loadGeneration: number` counter. It starts at `0`. It increments
on every call to `setInvestigation` and every call to
`restoreEvidenceSet`. Mutations through `pinBlock`, `unpinBlock`,
`reorderItems`, and `updateItemNote` do NOT bump it — those are
incremental edits, not reloads.

`SubmitRoom` keys its reset effect on `loadGeneration`, so EVERY
deliberate load resets the engineer's edits, regardless of whether
the investigation id changed.

### Task 4a: Extend `EvidenceContext` with `loadGeneration`

- [ ] **Step 1: Add the counter to the context value**

In `src/contexts/EvidenceContext.tsx`:

```typescript
// In EvidenceContextValue interface:
loadGeneration: number;

// In EvidenceProvider body, add state:
const [loadGeneration, setLoadGeneration] = useState(0);

// Wrap the existing setInvestigation to also bump the counter:
const setInvestigation = useCallback((inv: Investigation) => {
  commitInvestigation(inv);
  commitEvidenceSet(buildEvidenceSet(inv, activeCaseId));
  setLoadGeneration((g) => g + 1);
}, [activeCaseId, commitEvidenceSet, commitInvestigation]);

// Wrap restoreEvidenceSet the same way:
const restoreEvidenceSet = useCallback((set: EvidenceSet) => {
  const currentInvestigation = investigationRef.current;
  if (currentInvestigation && set.investigationId !== currentInvestigation.id) {
    throw new InvestigationMismatchError(currentInvestigation.id, set.investigationId);
  }
  commitEvidenceSet(set);
  setLoadGeneration((g) => g + 1);
}, [commitEvidenceSet]);

// Include in value:
{ ..., loadGeneration }
```

**Note:** The id-mismatch guard (Commit 6) is folded into the
`restoreEvidenceSet` wrapper above. Commit 4 lands the wrapper
skeleton WITHOUT the guard; Commit 6 adds the guard line. This
keeps each commit atomic but requires Commit 6 to touch the same
function — ordered after Commit 4.

- [ ] **Step 2: Tests for the counter**

In `src/contexts/__tests__/EvidenceContext.test.tsx`:

```typescript
describe('loadGeneration', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useEvidence(), { wrapper });
    expect(result.current.loadGeneration).toBe(0);
  });

  it('increments on setInvestigation', () => {
    const { result } = renderHook(() => useEvidence(), { wrapper });
    act(() => result.current.setInvestigation(invA));
    expect(result.current.loadGeneration).toBe(1);
    act(() => result.current.setInvestigation(invA));
    expect(result.current.loadGeneration).toBe(2);
  });

  it('increments on restoreEvidenceSet', () => {
    const { result } = renderHook(() => useEvidence(), { wrapper });
    act(() => result.current.setInvestigation(invA));
    const customSet: EvidenceSet = { /* ... matching invA.id */ };
    act(() => result.current.restoreEvidenceSet(customSet));
    expect(result.current.loadGeneration).toBe(2);  // 1 from setInvestigation + 1 from restore
  });

  it('does NOT increment on pinBlock', () => {
    const { result } = renderHook(() => useEvidence(), { wrapper });
    act(() => result.current.setInvestigation(invA));
    const before = result.current.loadGeneration;
    act(() => result.current.pinBlock(someBlock, 'user'));
    expect(result.current.loadGeneration).toBe(before);
  });
});
```

### Task 4b: Rewrite SubmitRoom resync

- [ ] **Step 3: Replace the render-time setState block**

In `src/components/workspace/SubmitRoom.tsx`, find the current block:

```typescript
const [prevInitial, setPrevInitial] = useState(initialResNote);
if (initialResNote !== prevInitial) {
  setPrevInitial(initialResNote);
  setEditedNote(null);
}
```

Replace with:

```typescript
const { loadGeneration } = useEvidence();
const lastSyncedGenerationRef = useRef<number>(loadGeneration);

useEffect(() => {
  if (loadGeneration !== lastSyncedGenerationRef.current) {
    lastSyncedGenerationRef.current = loadGeneration;
    setEditedNote(null);
  }
}, [loadGeneration]);
```

Remove the `prevInitial` state and any imports that were only used
for the old pattern.

**Semantics:**
- Pinning / unpinning / editing an item note: same generation →
  engineer edits preserved.
- New `.noclense` import: `setInvestigation` bumps generation,
  `restoreEvidenceSet` bumps generation again. Both bumps reset —
  the second reset is a no-op if state is already fresh.
- Loading an investigation with the same id as the current one
  (server refresh, programmatic reload): generation bumps → edits
  reset, which is what we want.

- [ ] **Step 4: Update SubmitRoom tests**

Rewrite the old `investigation.id`-based tests to use
`loadGeneration` semantics. The shape of `useEvidence` mock must
include `loadGeneration` now:

```typescript
function renderWithContext(
  investigation: Investigation | null = inv,
  evidenceSet: EvidenceSet | null = evSet,
  loadGeneration = 1,
) {
  vi.spyOn(EvidenceContextModule, 'useEvidence').mockReturnValue({
    investigation,
    evidenceSet,
    loadGeneration,
    setInvestigation: vi.fn(),
    pinBlock: vi.fn(),
    unpinBlock: vi.fn(),
    reorderItems: vi.fn(),
    restoreEvidenceSet: vi.fn(),
    updateItemNote: vi.fn(),
  });
  return render(<SubmitRoom />);
}

it('preserves engineer edits when loadGeneration is unchanged', () => {
  const { rerender } = renderWithContext(inv, evSet, 5);
  const textarea = screen.getByRole('textbox', { name: /edit before posting/i });
  fireEvent.change(textarea, { target: { value: 'my custom note' } });
  // Simulate a re-render with same generation (e.g. a pin)
  renderWithContext(inv, evSetWithOneMoreItem, 5);
  rerender(<SubmitRoom />);
  expect(
    screen.getByRole('textbox', { name: /edit before posting/i }),
  ).toHaveValue('my custom note');
});

it('resets edits when loadGeneration bumps (same investigation id)', () => {
  const { rerender } = renderWithContext(inv, evSet, 5);
  const textarea = screen.getByRole('textbox', { name: /edit before posting/i });
  fireEvent.change(textarea, { target: { value: 'my custom note' } });
  // Re-render with a higher generation — even though inv.id is unchanged
  renderWithContext(inv, evSet, 6);
  rerender(<SubmitRoom />);
  expect(
    screen.getByRole('textbox', { name: /edit before posting/i }),
  ).not.toHaveValue('my custom note');
});
```

**Note on `rerender` limitation Codex flagged:** the v1 tests used
`rerender(<SubmitRoom />)` after calling `renderWithContext` twice,
which does not reliably switch the mock. v2 test uses the
`renderWithContext` re-call to reset the spy before rerendering.
If this still reads as weak, the alternative is to write an
integration test using a real `EvidenceProvider` instead of the
`useEvidence` spy — captured as a hand-off if Codex flags the test
harness again.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
npx eslint src/components/workspace/SubmitRoom.tsx \
           src/components/workspace/__tests__/SubmitRoom.test.tsx \
           src/contexts/EvidenceContext.tsx \
           src/contexts/__tests__/EvidenceContext.test.tsx

git add \
  src/contexts/EvidenceContext.tsx \
  src/contexts/__tests__/EvidenceContext.test.tsx \
  src/components/workspace/SubmitRoom.tsx \
  src/components/workspace/__tests__/SubmitRoom.test.tsx
git commit -m "feat(phase-04): EvidenceContext.loadGeneration counter + SubmitRoom resync keyed on it"
```

---

## Commit 5 — Import Room drop-zone polish

**Scope:** Per spec §6.1 — hover scale + `glow-ready` on the drop
zone. Deliberately minimal; the cute-label wiring during parse is
already in place from Phase 02. This commit adds only the
affordance on the idle drop zone.

- [ ] **Step 1: Read current styling**

Open `src/components/import/WorkspaceImportPanel.tsx` and locate the
drop zone wrapper element. Identify:
- The class that renders the dashed border box
- Whether hover state is already defined
- Whether the `glow-ready` token exists in `src/styles/tokens.css`
  (from Phase 01a per spec §3.3). If missing, add a minimal definition.

- [ ] **Step 2: Add hover scale + glow with specific transitions**

On the drop zone root element, add:

```tsx
className={clsx(
  /* existing classes */,
  // Specific properties only — spec §4.2 forbids `transition: all`.
  'transition-[transform,box-shadow] duration-150 ease-out',
  'motion-safe:hover:scale-[1.01]',
  'hover:shadow-[var(--shadow-glow-ready,none)]',
)}
```

**Why specific properties:** Spec §4.2 "never use `transition: all`".
Tailwind's `transition-all` maps to that and is forbidden. We list
the two properties that actually change on hover: `transform`
(for the scale) and `box-shadow` (for the glow). Specific
transitions also avoid the engine transitioning properties we didn't
intend (e.g., `border-color` on unrelated hover styles).

**Reduced motion:** `motion-safe:` prefix on the hover scale means
the scale is suppressed when `prefers-reduced-motion: reduce`. The
glow shadow still appears (not motion-related). Verify by toggling
the OS reduced-motion setting during manual smoke.

- [ ] **Step 3: Confirm `--shadow-glow-ready` token exists**

Grep `src/styles/tokens.css` for `--shadow-glow-ready` and
`--glow-ready`. If absent, Phase 04 adds minimal values:

```css
:root {
  --glow-ready: color-mix(in srgb, var(--green-house-400, #76ce40) 60%, transparent);
  --shadow-glow-ready: 0 0 0 1px var(--glow-ready), 0 0 12px 0 var(--glow-ready);
}
```

(Phase 01a might already have these — do not duplicate. The grep is
the pre-flight.)

- [ ] **Step 4: Tests**

Extend the existing `WorkspaceImportPanel.test.tsx`:

```typescript
it('drop zone applies motion-safe hover scale class', () => {
  render(/* mount WorkspaceImportPanel */);
  const dropZone = screen.getByTestId('import-drop-zone');
  expect(dropZone.className).toMatch(/motion-safe:hover:scale/);
});
```

(Add `data-testid="import-drop-zone"` to the root element if it
doesn't have a test hook yet.)

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
npx eslint <scoped files>

git add \
  src/components/import/WorkspaceImportPanel.tsx \
  src/components/import/__tests__/WorkspaceImportPanel.test.tsx \
  src/styles/tokens.css  # if token added
git commit -m "feat(phase-04): Import Room drop-zone hover scale + glow-ready"
```

---

## Commit 6 — Investigation/evidence ID invariant guard + spec cleanup

**Scope:** Codex hand-off item #2 from Phase 03. Commit 4 already
wrapped `restoreEvidenceSet` to bump `loadGeneration`. Commit 6
adds the ID-mismatch guard inside that same wrapper, promotes the
error class to a shared module, and does the spec cleanup.

**Design:** Reuse `InvestigationMismatchError` from the exporter.
Promote it to `src/types/errors.ts` so both the exporter and the
context can import it.

**Pre-flight:** Commit 4 landed the `restoreEvidenceSet` wrapper
WITHOUT the guard line. Commit 6 adds the guard line inside that
wrapper — no conflict.

- [ ] **Step 1: Promote the error type**

Create `src/types/errors.ts`:

```typescript
/**
 * Thrown when an EvidenceSet's investigationId does not match the
 * companion Investigation's id. Used by both the exporter (pre-
 * export sanity check) and the EvidenceContext (pre-restore guard).
 */
export class InvestigationMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `Investigation ID mismatch: expected "${expected}", got "${actual}". ` +
      `Refusing to mutate state with a mismatched pair.`,
    );
    this.name = 'InvestigationMismatchError';
  }
}
```

In `src/services/investigationExporter.ts`:

```typescript
import { InvestigationMismatchError } from '../types/errors';
// Delete the local `export class InvestigationMismatchError` block.
// Add a re-export so existing importers continue to work:
export { InvestigationMismatchError };
```

Pre-flight:

```bash
git grep -n "InvestigationMismatchError" src/
```

Expected: imports in the test file and in whatever consumer file
references it. Adjust import paths if any file imports from
`investigationExporter.ts`; leave others alone since the re-export
keeps that path valid.

- [ ] **Step 2: Add the guard line in `restoreEvidenceSet`**

Commit 4's wrapper is:

```typescript
const restoreEvidenceSet = useCallback((set: EvidenceSet) => {
  commitEvidenceSet(set);
  setLoadGeneration((g) => g + 1);
}, [commitEvidenceSet]);
```

Insert the guard at the top, then keep the rest:

```typescript
import { InvestigationMismatchError } from '../types/errors';

const restoreEvidenceSet = useCallback((set: EvidenceSet) => {
  const currentInvestigation = investigationRef.current;
  if (currentInvestigation && set.investigationId !== currentInvestigation.id) {
    throw new InvestigationMismatchError(currentInvestigation.id, set.investigationId);
  }
  commitEvidenceSet(set);
  setLoadGeneration((g) => g + 1);
}, [commitEvidenceSet]);
```

`investigationRef` — the existing internal ref from
`EvidenceProvider` — is read synchronously. Reading from state here
would stale-capture inside `useCallback`.

- [ ] **Step 3: Tests**

Extend `src/contexts/__tests__/EvidenceContext.test.tsx`:

```typescript
it('restoreEvidenceSet throws when investigationId does not match', () => {
  const { result } = renderHook(() => useEvidence(), { wrapper });
  act(() => result.current.setInvestigation(invA));
  const mismatchedSet: EvidenceSet = {
    caseId: asCaseId('case-1'),
    investigationId: asInvestigationId('different'),
    items: [],
  };
  expect(() => {
    act(() => result.current.restoreEvidenceSet(mismatchedSet));
  }).toThrow(/mismatch/i);
});

it('restoreEvidenceSet does NOT bump loadGeneration when it throws', () => {
  const { result } = renderHook(() => useEvidence(), { wrapper });
  act(() => result.current.setInvestigation(invA));
  const genBefore = result.current.loadGeneration;
  try {
    act(() => result.current.restoreEvidenceSet({
      caseId: asCaseId('case-1'),
      investigationId: asInvestigationId('different'),
      items: [],
    }));
  } catch {
    // expected
  }
  expect(result.current.loadGeneration).toBe(genBefore);
});
```

- [ ] **Step 4: `WorkspaceImportPanel` happy-path confirmation**

The panel already calls `setInvestigation(result.investigation)`
BEFORE `restoreEvidenceSet(result.evidenceSet)` — verified in Phase
03 Commit 4 diff. Both come from the same import result, so their
IDs match by construction. No new test needed; the existing happy-
path test covers it.

- [ ] **Step 5: Spec cleanup**

Edit `docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md`:
1. §5.5: change "Phase 05 ships this." → "Phase 04 ships this."
   (Focus-mode toggle now lands in Phase 04 per §6.5.)
2. §8 "Open details to resolve during implementation": change
   "Default focus-mode collapse ratio for the sibling rail in
   Phase 04 (20% vs 10%)." → "Focus-mode sibling rail deferred to
   Phase 05 (Phase 04 uses `display: none` for siblings — no rail)."

Two single-line edits; no other spec changes.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
npx eslint <scoped files>

git add \
  src/types/errors.ts \
  src/services/investigationExporter.ts \
  src/services/__tests__/investigationExporter.test.ts \
  src/contexts/EvidenceContext.tsx \
  src/contexts/__tests__/EvidenceContext.test.tsx \
  docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md
git commit -m "feat(phase-04): investigation/evidence ID invariant guard + spec §5.5/§8 cleanup"
```

---

## Commit summary (final order)

Commits 1 and 2 together land the focus-mode architecture — context
+ CSS first, then grid wiring. Commits 4 and 6 both touch
`EvidenceContext.restoreEvidenceSet`; commit 4 lands the
`loadGeneration` wrapper, commit 6 adds the mismatch guard inside it.
The commit ordering is chosen so each commit has a clean self-
assessment surface.

| # | Commit | Files touched |
|---|---|---|
| 1 | `CardFocusContext` + `WorkspaceCard` toggle + `focus-mode.css` | 3 new, 2 modified, 2 tests |
| 2 | `WorkspaceGrid` owns the provider for the investigate layout | 1 modified + 1 test |
| 3 | `useCopyFeedback` hook + SubmitRoom swap | 1 new hook, 1 modified, 2 tests |
| 4 | `EvidenceContext.loadGeneration` + SubmitRoom resync | 2 modified + 2 tests |
| 5 | Import Room hover + glow (specific transitions, no `all`) | 1 modified + test |
| 6 | Investigation/evidence ID invariant guard + spec cleanup | 3 modified + test + spec edit |

---

## Verification checklist (phase close-out)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run` — all tests pass (current baseline 497 + Phase 04 new tests)
- [ ] `npx eslint` — clean on all Phase 04 scoped files (pre-existing repo baseline unchanged)
- [ ] Manual smoke in `npm run electron:dev`:
  - Investigate Room: `⊞` on any card enters focus; `⊟` or Esc exits
  - Log Stream focus does not break virtualization (rows still visible, scroll works)
  - AI Assistant focus: Esc exits focus mode; native Esc handlers inside the card (fast-forward reveal in `CanonicalBlockRenderer`) continue to work when no card is focused
  - Esc while a textarea or `role="menu"` element has focus does NOT exit focus — verified manually by focusing the Closure Note textarea and pressing Esc while a card is focused in the Investigate Room
  - Import Room: drop zone has a subtle hover scale + green glow
  - Submit Room: Copy buttons work; no console warnings about setState on unmounted component
  - Submit Room: edit the closure note, pin an evidence item, verify edit is preserved
  - Submit Room: load a different `.noclense` file, verify the closure note resets
- [ ] `prefers-reduced-motion: reduce` audit:
  - Focus-mode transitions are instant
  - Hover scale on drop zone is suppressed
- [ ] No new Phase 04 lint warnings in the scoped files

---

## Deferred items (carried to Phase 05 or later)

| Item | Next Phase | Rationale |
|---|---|---|
| URL-paste → investigate flow on Import Room (§6.1) | Phase 05 | Needs routing surface design; scope outside polish pass |
| Evidence bundle-size pulse >100 KB (§5.4) | Phase 05 | Visual polish belongs in broad pass |
| Correlation Graph / Datadog Live / Similar Tickets polish (§6.1) | Phase 05 | Explicitly part of broad pass |
| PhaseHeader + PhaseDots tokenization (§6.1) | Phase 05 | Broad pass |
| Citation-jump polish animation (§6.2) | Phase 05 | Explicitly called out for Phase 05 |
| UI-level export→import round-trip smoke (Codex hand-off #1) | Phase 05 or Phase 04.1 | Requires Playwright harness; out of Phase 04 unit-test scope |
| Non-log citation URL-opening policy audit (Codex hand-off #3) | Phase 05 | Touches the citation system and deserves its own slice |
| Persisting focus state across phase navigations | Phase 06 | Case library territory; requires localStorage plan |
| Focus-mode for Submit Room cards | Future | Two-card room doesn't benefit; revisit only if users request |

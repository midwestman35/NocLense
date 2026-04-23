/* eslint-disable react-refresh/only-export-components */
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

/**
 * CardFocusContext; parent-scoped card focus state.
 *
 * Outside a provider, `useCardFocus()` returns `undefined`. Callers
 * must explicitly handle the undefined case (typically by NOT
 * rendering the focus button). This makes missing-provider bugs
 * visible in components rather than silently swallowing them.
 */
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

  return <CardFocusContext.Provider value={value}>{children}</CardFocusContext.Provider>;
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
 * Suppression matrix check; returns true when the currently-focused
 * DOM element is in a context where app shortcuts must not consume
 * the event. Mirrors `shortcut-audit.md` §3.
 *
 * Covers every row of §3 that the renderer CAN observe:
 *   - <input>, <textarea>, contenteditable (text entry)
 *   - open <dialog> (native modal)
 *   - role="menu" / role="menubar" (DOM-rendered menus and dropdowns
 *     from component libraries such as Radix UI ContextMenu)
 *
 * Native OS menu bars and context menus are covered automatically by
 * the OS; when one is open the platform consumes keyboard input before
 * it reaches the renderer
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
  if (active.contentEditable === 'true') return true;
  if (
    active.closest(
      '[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]',
    )
  ) {
    return true;
  }
  if (active.closest('dialog[open]')) return true;
  if (active.closest('[role="menu"],[role="menubar"]')) return true;

  return false;
}

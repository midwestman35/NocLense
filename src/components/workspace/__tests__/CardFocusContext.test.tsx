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

    act(() => {
      result.current?.focusCard('log-stream');
    });

    expect(result.current?.focusedCardId).toBe('log-stream');
  });

  it('unfocus clears focusedCardId', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });

    act(() => {
      result.current?.focusCard('ai-assistant');
    });
    act(() => {
      result.current?.unfocus();
    });

    expect(result.current?.focusedCardId).toBe(null);
  });

  it('toggleFocus toggles the same card off', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });

    act(() => {
      result.current?.toggleFocus('ai-assistant');
    });
    act(() => {
      result.current?.toggleFocus('ai-assistant');
    });

    expect(result.current?.focusedCardId).toBe(null);
  });

  it('toggleFocus switches between cards', () => {
    const { result } = renderHook(() => useCardFocus(), { wrapper });

    act(() => {
      result.current?.toggleFocus('ai-assistant');
    });
    act(() => {
      result.current?.toggleFocus('evidence');
    });

    expect(result.current?.focusedCardId).toBe('evidence');
  });
});

describe('isInSuppressedContext', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('returns false when no focus is suppressed', () => {
    expect(isInSuppressedContext()).toBe(false);
  });

  it('returns true when an input is focused', () => {
    const input = document.createElement('input');

    document.body.appendChild(input);
    input.focus();

    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when a textarea is focused', () => {
    const textarea = document.createElement('textarea');

    document.body.appendChild(textarea);
    textarea.focus();

    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when a contenteditable element is focused', () => {
    const editable = document.createElement('div');

    editable.contentEditable = 'true';
    editable.tabIndex = 0;
    document.body.appendChild(editable);
    editable.focus();

    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when focus is inside an open dialog', () => {
    const dialog = document.createElement('dialog');
    const button = document.createElement('button');

    dialog.setAttribute('open', '');
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    button.focus();

    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns false when a plain button is focused', () => {
    const button = document.createElement('button');

    document.body.appendChild(button);
    button.focus();

    expect(isInSuppressedContext()).toBe(false);
  });

  it('returns true when focus is inside a role="menu" element', () => {
    const menu = document.createElement('div');
    const item = document.createElement('button');

    menu.setAttribute('role', 'menu');
    item.setAttribute('role', 'menuitem');
    menu.appendChild(item);
    document.body.appendChild(menu);
    item.focus();

    expect(isInSuppressedContext()).toBe(true);
  });

  it('returns true when focus is inside a role="menubar" element', () => {
    const menubar = document.createElement('div');
    const item = document.createElement('button');

    menubar.setAttribute('role', 'menubar');
    item.setAttribute('role', 'menuitem');
    menubar.appendChild(item);
    document.body.appendChild(menubar);
    item.focus();

    expect(isInSuppressedContext()).toBe(true);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTheme, setTheme, toggleTheme, THEMES } from '../theme';

describe('theme utility', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
      },
      writable: true,
    });
  });

  it('returns "dark" as the forced theme', () => {
    expect(getTheme()).toBe('dark');
  });

  it('sets dark theme on document and localStorage', () => {
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('noclense-theme', 'dark');
  });

  it('ignores light requests and keeps the app dark', () => {
    setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('noclense-theme', 'dark');
  });

  it('toggleTheme preserves the dark lock', () => {
    toggleTheme();
    expect(getTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('noclense-theme', 'dark');
  });

  it('ignores persisted light-mode values', () => {
    store['noclense-theme'] = 'light';
    expect(getTheme()).toBe('dark');
  });

  it('reads persisted dark-mode values as dark', () => {
    store['noclense-theme'] = 'dark';
    expect(getTheme()).toBe('dark');
  });

  it('exports THEMES constant', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });
});

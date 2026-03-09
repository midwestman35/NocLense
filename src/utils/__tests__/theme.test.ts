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

  it('returns "light" as default theme', () => {
    expect(getTheme()).toBe('light');
  });

  it('sets theme on document and localStorage', () => {
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('noclense-theme', 'dark');
  });

  it('toggles between light and dark', () => {
    setTheme('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
  });

  it('reads persisted theme from localStorage', () => {
    store['noclense-theme'] = 'dark';
    expect(getTheme()).toBe('dark');
  });

  it('exports THEMES constant', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });
});

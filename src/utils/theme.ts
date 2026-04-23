export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'noclense-theme';

export function getTheme(): Theme {
  return 'dark';
}

export function setTheme(theme: Theme): void {
  theme = 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(): void {
  setTheme('dark');
}

/** Call once on app startup to apply persisted theme. */
export function initTheme(): void {
  setTheme('dark');
}

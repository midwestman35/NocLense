import type { Case } from '../types/case';

const CASES_KEY = 'noclense_cases';

/**
 * Save cases to localStorage.
 * Silently ignores quota exceeded or unavailable errors.
 */
export function saveCases(cases: Case[]): void {
  try {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases));
  } catch {
    // localStorage quota exceeded or unavailable — silently ignore
  }
}

/**
 * Load cases from localStorage.
 * Returns empty array on parse errors or missing data.
 */
export function loadCases(): Case[] {
  const data = localStorage.getItem(CASES_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    // Corrupted data — return empty and let next save overwrite
    return [];
  }
}

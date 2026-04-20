const SEARCH_HISTORY_KEY = 'noclense_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Save search history to localStorage.
 * localStorage is available in all browser contexts and only fails in unusual scenarios (quota exceeded).
 * Since search history is not critical (users can lose it), silent failure is acceptable.
 */
export function saveSearchHistory(history: string[]): void {
    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {
        // localStorage quota exceeded or unavailable — ignore to keep app functional
    }
}

/**
 * Load search history from localStorage.
 * Returns empty array on any failure (missing data, parse error, or quota issues).
 */
export function loadSearchHistory(): string[] {
    const data = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!data) return [];

    try {
        return JSON.parse(data);
    } catch {
        // Corrupted data — return empty and let next save overwrite it
        return [];
    }
}

export function addToSearchHistory(term: string): void {
    if (!term.trim()) return;

    const history = loadSearchHistory();
    // Remove if exists (to avoid duplicates)
    const filtered = history.filter(item => item !== term);
    // Add to beginning
    const updated = [term, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    saveSearchHistory(updated);
}

/**
 * Clear search history from localStorage.
 * Silently ignores failures since this is non-critical data.
 */
export function clearSearchHistory(): void {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
        // localStorage unavailable — ignore
    }
}


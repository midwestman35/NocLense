const SEARCH_HISTORY_KEY = 'noclense_search_history';
const MAX_HISTORY_ITEMS = 10;

export function saveSearchHistory(history: string[]): void {
    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('Failed to save search history:', e);
    }
}

export function loadSearchHistory(): string[] {
    try {
        const data = localStorage.getItem(SEARCH_HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to load search history:', e);
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

export function clearSearchHistory(): void {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
        console.error('Failed to clear search history:', e);
    }
}


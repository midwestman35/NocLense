# Search History Implementation Plan

## Overview
Implement a search history feature that displays previously searched terms when the user clicks into the search field, allowing quick access to recent searches.

## 1. Architecture & Design Decisions

### 1.1 Storage Strategy
- **Location**: `src/store/searchHistory.ts` (following existing localStorage pattern)
- **Storage Key**: `noclense_search_history`
- **Format**: Array of strings, most recent first
- **Max Items**: 10-15 recent searches (configurable)
- **Persistence**: localStorage (survives browser sessions)

### 1.2 State Management
- **Option A**: Add to `LogContext` (centralized, simple)
- **Option B**: Create separate `SearchHistoryContext` (better separation of concerns)
- **Recommendation**: Option A for simplicity, but Option B if search history grows in complexity

### 1.3 Component Structure
```
FilterBar.tsx (or TopBar.tsx)
├── SearchInput (existing)
└── SearchHistoryDropdown (new)
    ├── HistoryItem (clickable)
    ├── ClearHistoryButton (optional)
    └── EmptyState (when no history)
```

## 2. UI/UX Mockup Description

### 2.1 Visual Design
```
┌─────────────────────────────────────────────────┐
│  [🔍] Search logs (Call-ID, message...)        │ ← Search input (existing)
│  ┌───────────────────────────────────────────┐  │
│  │ Recent Searches                          │  │ ← Dropdown appears on focus
│  ├───────────────────────────────────────────┤  │
│  │ 🔍 INVITE sip:user@domain.com            │  │ ← History item (hoverable)
│  │ 🔍 Call-ID: abc123                        │  │
│  │ 🔍 component: sip-proxy                  │  │
│  │ 🔍 ERROR                                  │  │
│  ├───────────────────────────────────────────┤  │
│  │ [Clear History]                           │  │ ← Optional clear button
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 2.2 Behavior & Interactions

#### On Focus (Click into search field)
- Dropdown appears below search input
- Shows up to 10 most recent unique searches
- Most recent at top
- Dropdown positioned absolutely below input

#### On Blur (Click outside)
- Dropdown closes after 200ms delay (allows click on history item)
- If clicking a history item, dropdown closes immediately

#### On History Item Click
- Fills search input with selected term
- Applies the search immediately
- Moves clicked item to top of history (if not already)
- Closes dropdown

#### On Enter/Submit
- Adds current search to history (if not empty)
- Removes duplicates (moves to top if exists)
- Limits to max items (removes oldest if over limit)

#### Keyboard Navigation
- **Arrow Down**: Navigate through history items
- **Arrow Up**: Navigate backwards
- **Enter**: Select highlighted item
- **Escape**: Close dropdown

### 2.3 Styling
- **Dropdown**: 
  - Dark theme matching app (slate-800/900)
  - Border: slate-700
  - Shadow: subtle elevation
  - Max height: ~300px with scroll
- **History Items**:
  - Hover: slate-700 background
  - Active/Selected: blue-600 background
  - Icon: Search icon (lucide-react)
  - Text: slate-200
- **Clear Button**:
  - Small, subtle text
  - Hover: red tint
  - Position: bottom of dropdown

## 3. Implementation Steps

### Step 1: Create Search History Storage Utility
**File**: `src/store/searchHistory.ts`

```typescript
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
```

### Step 2: Update LogContext
**File**: `src/contexts/LogContext.tsx`

Add:
- `searchHistory: string[]` state
- `addToHistory: (term: string) => void` function
- `clearHistory: () => void` function
- Load history on mount
- Auto-save on search submit

### Step 3: Create SearchHistoryDropdown Component
**File**: `src/components/SearchHistoryDropdown.tsx`

Features:
- Props: `history: string[]`, `onSelect: (term: string) => void`, `onClear: () => void`, `isOpen: boolean`
- Render list of history items
- Handle click events
- Keyboard navigation support
- Empty state when no history

### Step 4: Update FilterBar Component
**File**: `src/components/FilterBar.tsx`

Changes:
- Add `isFocused` state for dropdown visibility
- Add `selectedIndex` state for keyboard navigation
- Import and render `SearchHistoryDropdown`
- Handle `onFocus` and `onBlur` events
- Handle `onKeyDown` for keyboard navigation
- Call `addToHistory` on Enter key or search submit
- Position dropdown absolutely below input

### Step 5: Handle Edge Cases
- Empty search terms (don't add to history)
- Duplicate searches (move to top, don't duplicate)
- Very long search terms (truncate in dropdown with ellipsis)
- localStorage quota exceeded (graceful degradation)
- Private/Incognito mode (handle localStorage errors)

## 4. Technical Considerations

### 4.1 Performance
- Debounce history saves (don't save on every keystroke)
- Only save on Enter or blur with non-empty value
- Memoize history list rendering

### 4.2 Accessibility
- ARIA labels for dropdown
- Keyboard navigation (Arrow keys, Enter, Escape)
- Focus management
- Screen reader announcements

### 4.3 Browser Compatibility
- localStorage fallback for older browsers
- Handle private browsing mode gracefully

## 5. Testing Checklist

- [ ] History appears on input focus
- [ ] History disappears on blur
- [ ] Clicking history item fills input and searches
- [ ] Enter key adds to history
- [ ] Duplicate searches move to top
- [ ] History limited to max items
- [ ] Clear history button works
- [ ] Keyboard navigation works
- [ ] History persists across page reloads
- [ ] Empty searches don't get added
- [ ] Long search terms are truncated properly
- [ ] Works in both FilterBar and TopBar (if both exist)

## 6. Future Enhancements (Optional)

- **Search Suggestions**: Autocomplete based on log content
- **Search Filters**: Save filter combinations (text + smart filter state)
- **Search Analytics**: Track most used searches
- **Export History**: Export search history as JSON
- **Search Groups**: Organize searches into categories
- **Fuzzy Search**: Highlight matching characters in history

## 7. Files to Create/Modify

### New Files:
1. `src/store/searchHistory.ts` - Storage utilities
2. `src/components/SearchHistoryDropdown.tsx` - Dropdown component

### Modified Files:
1. `src/contexts/LogContext.tsx` - Add history state and functions
2. `src/components/FilterBar.tsx` - Integrate dropdown
3. `src/components/layout/TopBar.tsx` - Integrate dropdown (if using visual-redesign branch)

## 8. Implementation Priority

**Phase 1 (MVP)**:
- Basic history storage
- Dropdown on focus
- Click to select
- Save on Enter

**Phase 2 (Enhanced)**:
- Keyboard navigation
- Clear history button
- Better styling/animations

**Phase 3 (Polish)**:
- Accessibility improvements
- Edge case handling
- Performance optimizations


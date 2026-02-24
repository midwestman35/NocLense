# Branch Feature Comparison: main vs feature/visual-redesign

**Date:** 2025-01-15  
**Purpose:** Identify features to migrate from `feature/visual-redesign` to `main` while keeping visual design separate

---

## Executive Summary

The `feature/visual-redesign` branch contains **new functional features** (favorites, export) that should be merged to `main`, while the **visual design changes** (themes, layout, styling) should remain separate for now.

---

## Feature Comparison Table

| Feature | main Branch | feature/visual-redesign Branch | Status |
|---------|-------------|-------------------------------|--------|
| **Core Log Viewing** | ✅ | ✅ | Same |
| **Log Parsing** | ✅ | ✅ | Same |
| **File Upload** | ✅ | ✅ | Same |
| **Search/Filter** | ✅ | ✅ | Same |
| **SIP Filter** | ✅ | ✅ | Same |
| **Correlation Sidebar** | ✅ | ✅ | Same |
| **Call Flow Viewer** | ✅ | ✅ | Same |
| **Timeline Scrubber** | ✅ | ✅ | Same |
| **Search History** | ✅ | ❌ | **Missing in visual-redesign** |
| **Case Management** | ✅ | ❌ | **Missing in visual-redesign** |
| **Favorites Feature** | ❌ | ✅ | **NEW - Should migrate to main** |
| **Export Feature** | ✅ (different impl) | ✅ (new impl) | **Different implementations** |
| **Visual Design** | Original | New themes/layout | **Keep separate** |

---

## Detailed Feature Analysis

### ✅ Features in Both Branches (Core Functionality)

These features exist in both branches and work similarly:

1. **Log Parsing & Display**
   - Multi-format log parsing (original + ISO date formats)
   - Virtual scrolling for performance
   - Log row expansion for payload viewing
   - Component filtering
   - Timestamp sorting

2. **Filtering & Search**
   - Text search (Call-ID, message, component)
   - SIP filter toggle
   - Correlation filtering (Call IDs, Reports, Operators, Stations)
   - Component/service filtering

3. **Correlation Sidebar**
   - Multi-select correlation items
   - Counts display
   - "Only" filter mode
   - Sort by count or alphabetically

4. **Call Flow Viewer**
   - SIP message visualization
   - Participant extraction
   - Direction indicators
   - Timeline display

5. **Timeline Scrubber**
   - Time-based navigation
   - Event density visualization

---

### 🆕 New Features in visual-redesign (Should Migrate to main)

#### 1. **Favorites Feature** ⭐
**Status:** ✅ Fully implemented in visual-redesign  
**Location:** 
- `src/contexts/LogContext.tsx` (state management)
- `src/components/LogRow.tsx` (star icon)
- `src/components/FilterBar.tsx` (show favorites only toggle)
- `src/components/export/ExportModal.tsx` (export favorites option)

**Features:**
- Star icon on each log row to favorite/unfavorite
- localStorage persistence
- "Show Favorites Only" filter toggle
- Favorites count display
- Export only favorites option
- Auto-clear when logs are cleared

**Migration Priority:** 🔴 **HIGH** - Core functionality, no visual dependencies

---

#### 2. **Export Feature (New Implementation)** 📥
**Status:** ✅ Implemented in visual-redesign  
**Location:** `src/components/export/ExportModal.tsx`

**Features:**
- JSONL export format
- CSV export format
- Export filtered logs
- Export only favorites option
- Event count display
- Clean modal UI

**Note:** Main branch has a different ExportModal implementation (uses case context). The visual-redesign version is simpler and more focused on log export.

**Migration Priority:** 🟡 **MEDIUM** - Different implementation, needs evaluation

---

### ❌ Features Missing in visual-redesign (Should Keep in main)

#### 1. **Search History Feature** 🔍
**Status:** ✅ In main, ❌ Missing in visual-redesign  
**Location:** 
- `src/components/SearchHistoryDropdown.tsx`
- `src/components/FilterBar.tsx` (main version)
- `src/contexts/LogContext.tsx` (searchHistory state)

**Features:**
- Dropdown with search history
- Keyboard navigation (arrow keys)
- History persistence
- Clear history option

**Action:** Keep in main, add to visual-redesign if needed

---

#### 2. **Case Management System** 📋
**Status:** ✅ In main, ❌ Missing in visual-redesign  
**Location:** `src/components/case/` folder

**Components:**
- `CaseForm.tsx`
- `CaseHeader.tsx`
- `CaseList.tsx`
- `EvidenceTab.tsx`

**Features:**
- Case creation and management
- Evidence tracking
- Case-based organization

**Action:** Keep in main, not needed in visual-redesign (different use case)

---

#### 3. **Layout Components** 🎨
**Status:** ✅ In main, ❌ Missing in visual-redesign  
**Location:** `src/components/layout/` folder

**Components:**
- `AppLayout.tsx`
- `DetailsPanel.tsx`
- `Sidebar.tsx`
- `Timeline.tsx`
- `TopBar.tsx`

**Action:** Different layout architecture - keep separate

---

### 🎨 Visual Design Differences (Keep Separate)

#### visual-redesign Branch Visual Features:
1. **Theme System**
   - Light/Dark/Red themes
   - Theme toggle button
   - CSS variable-based theming

2. **Header Design**
   - Carbyne logo integration
   - "Incident Management Tool" branding
   - Blue header with white text
   - Integrated controls

3. **Card-Based Layout**
   - Rounded card containers
   - Shadow effects
   - Border styling
   - Modern spacing

4. **Color Scheme**
   - CSS custom properties (`--var(--text-primary)`, etc.)
   - Consistent color tokens
   - Theme-aware colors

**Action:** Keep visual design in visual-redesign branch only

---

## Migration Plan: Features → main

### Phase 1: Favorites Feature (High Priority)

**Files to migrate:**
1. `src/contexts/LogContext.tsx`
   - Add favorites state management
   - Add localStorage persistence
   - Add favorites filter logic
   - **Note:** Merge carefully with existing searchHistory state

2. `src/components/LogRow.tsx`
   - Add star icon
   - Add isFavorite and onToggleFavorite props
   - Position star inline with message

3. `src/components/FilterBar.tsx`
   - Add "Show Favorites Only" checkbox
   - **Note:** Merge with existing searchHistory dropdown

4. `src/components/LogViewer.tsx`
   - Pass favorite props to LogRow

5. `src/components/export/ExportModal.tsx` (if keeping new version)
   - Add export favorites option

**Visual Design:** Use main branch's existing styling (no theme system)

---

### Phase 2: Export Feature (Medium Priority)

**Decision needed:**
- Keep main's ExportModal (case-based)?
- Replace with visual-redesign version (log-focused)?
- Merge both (support both use cases)?

**Recommendation:** Evaluate which export implementation better serves the use case. The visual-redesign version is simpler and more focused on log export.

---

## Files to NOT Migrate (Visual Design Only)

These files contain visual design changes and should stay in visual-redesign:

1. `src/App.tsx` - Header design, theme system
2. `src/index.css` - Theme CSS variables
3. Visual styling in components (use main's styling instead)

---

## Recommended Migration Strategy

### Option A: Cherry-pick Features (Recommended)
1. Create feature branch from `main`: `feature/favorites-export`
2. Cherry-pick favorites implementation
3. Adapt to main's styling
4. Merge to main
5. Keep visual-redesign separate

### Option B: Manual Port
1. Copy favorites code from visual-redesign
2. Adapt to main's component structure
3. Use main's styling
4. Test thoroughly
5. Merge to main

---

## Testing Checklist for Migration

After migrating features to main:

- [ ] Favorites star icon appears and works
- [ ] Favorites persist after page refresh
- [ ] "Show Favorites Only" filter works
- [ ] Favorites work with search history (main feature)
- [ ] Favorites work with all existing filters
- [ ] Export feature works (if migrated)
- [ ] Export favorites option works (if migrated)
- [ ] No visual regressions (uses main's styling)
- [ ] TypeScript compilation passes
- [ ] No linter errors

---

## Summary

**Features to Migrate:**
- ✅ **Favorites Feature** (complete implementation)
- ⚠️ **Export Feature** (evaluate vs main's version)

**Features to Keep Separate:**
- 🎨 **Visual Design** (themes, layout, styling)
- 🔍 **Search History** (already in main, add to visual-redesign if needed)
- 📋 **Case Management** (different use case)

**Next Steps:**
1. Create migration branch from `main`
2. Port favorites feature with main's styling
3. Evaluate export feature implementation
4. Test thoroughly
5. Merge to main
6. Keep visual-redesign branch for design work

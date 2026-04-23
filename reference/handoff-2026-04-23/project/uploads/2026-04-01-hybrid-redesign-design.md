# NocLense Hybrid Redesign: Phase Rooms + Card Workspace

**Date:** 2026-04-01
**Status:** Approved for implementation
**Direction:** Hybrid of A (Phase Rooms) + B (Card Workspace)

---

## 1. Core Concept

The application has **three distinct rooms** — Import, Investigate, Submit — each with its own layout and density. Transitioning between rooms is a full-viewport anime.js morph animation. The Investigate room uses a **card-based workspace** with 8 preset cards that expand in-place.

**Emotional arc:** Calm (Import) → Dense (Investigate) → Calm (Submit)

---

## 2. Room Definitions

### 2.1 Import Room

**Layout:** Centered card on empty canvas with subtle radial gradient glow.
**Density:** Minimal — nothing on screen except the import card and the header.
**Components:**
- Drop zone for `.log`, `.txt`, `.csv` files
- Paste toggle for AWS Console / raw log text
- Source type selector (APEX, Datadog, AWS, Unknown)
- Zendesk ticket input + "Investigate" button
- Datadog enrichment toggle

**Header state:** Logo + phase dots. No ticket context yet.
**Transition out:** Import card morphs outward — expands to fill viewport as the Investigate grid assembles behind it, then fades to reveal the workspace.

### 2.2 Investigate Room

**Layout:** CSS grid card workspace with 8 cards in a preset "Investigation" arrangement.
**Density:** Maximum — all tools visible.
**Grid:** `grid-template-columns: 1fr 1fr 340px` / `grid-template-rows: auto 1fr auto`

**Cards (8 total):**

| Card | Grid Position | Default State | Purpose |
|------|--------------|---------------|---------|
| Log Stream | col 1-2, row 1-2 (large) | Expanded | Virtualized log grid + embedded filter bar + embedded mini-timeline |
| AI Assistant | col 3, row 1 | Expanded | Unleashed AI chat + diagnosis result + closure note generation |
| Evidence | col 3, row 2 | Expanded | Bookmarks, starred logs, internal note |
| Timeline | Embedded in Log Stream header | Always visible | SVG stacked bar chart (existing LogTimeline component) |
| Similar Tickets | col 1, row 3 | Compact | Past resolved tickets matching current pattern |
| Correlation Graph | col 2, row 3 | Compact | Call-ID → extension → station → PBX tree visualization |
| Datadog Live | col 3, row 3 | Compact | Streaming production errors from Datadog API |
| Ticket Context | Header bar | Always visible | Priority badge, ticket ID, status — not a grid card |

**Card interactions:**
- **Click header** → Card expands in-place (anime.js spring). Neighbors shrink proportionally.
- **Double-click header** → Card collapses to header-only (one line, ~36px).
- **All cards visible at all times** — collapsed or expanded, never hidden.

**Header state:** Logo + ticket ID + priority badge + phase dots (Investigate glowing).
**Transition in:** Grid cards stagger-in from left to right (anime.js stagger, 40ms offset per card).
**Transition out:** Cards collapse inward, the two Submit cards emerge and center.

### 2.3 Submit Room

**Layout:** Two centered cards side-by-side on empty canvas.
**Density:** Minimal — focused on handoff.
**Components:**
- **Closure Note card** — AI-generated note (editable textarea), "Post to Zendesk & Save to Confluence" button, "Download Evidence Pack" button
- **Evidence Summary card** — List of bookmarked logs, similar tickets referenced, internal note, learning loop indicator

**Header state:** Logo + ticket ID + all phase dots completed (green).
**Transition in:** Two cards emerge from where the AI and Evidence cards were in Investigate, sliding to center with spring physics.
**Transition out:** Success animation (checkmark pulse), then fade to Import room for next ticket.

---

## 3. Animation Architecture

### 3.1 Room Transitions (anime.js timeline)

Each room change is a **choreographed timeline** with 4-6 steps:

**Import → Investigate:**
1. Import card scales up slightly (1.02x) — 100ms
2. Import card fades and stretches to fill viewport — 250ms
3. Grid skeleton appears (empty card outlines) — 150ms
4. Cards stagger-fill with content (left→right, top→bottom) — 40ms per card
5. Log rows stagger-in within Log Stream card — 15ms per visible row

**Investigate → Submit:**
1. Bottom-row cards collapse upward — 200ms
2. Log Stream card fades and shrinks — 200ms
3. AI + Evidence cards slide to center, morphing into Submit cards — 300ms spring
4. Background gradient glow fades in — 150ms

**Submit → Import (new investigation):**
1. Success checkmark pulse animation — 400ms
2. Cards shrink to center — 200ms
3. Import card fades in at center — 200ms

**Back-navigation (any room → previous):**
- Same timeline, reversed. `timeline.reverse()` via anime.js.

### 3.2 Card Interactions (anime.js spring)

**Expand in-place:**
```
duration: 350ms
easing: spring(1, 80, 10, 0)  // mass, stiffness, damping, velocity
properties: grid-row-end, grid-column-end (via CSS class toggle)
neighbors: shrink with same spring, 50ms delay
```

**Collapse to header:**
```
duration: 250ms
easing: easeOutCubic
properties: height → 36px, overflow hidden
```

### 3.3 Micro-interactions (existing + new)

| Element | Animation | Library |
|---------|-----------|---------|
| Log row hover | Background tint | CSS transition (existing) |
| Filter chip appear | Stagger translateY + opacity | anime.js (already built) |
| Log count change | Value tween | anime.js (already built) |
| Level badges | Stagger entrance | anime.js (already built) |
| Timeline bars | Stagger scaleY | anime.js (already built) |
| Toast notification | Slide-in from right | CSS animation (already built) |
| Card header hover | Border glow | CSS transition (new) |
| Phase dot progression | Fill + glow pulse | anime.js (new) |
| Evidence item add | Scale-in + bounce | anime.js (new) |
| AI response stream | Character-by-character reveal | anime.js value tween (new) |

---

## 4. Card Component Architecture

### 4.1 WorkspaceCard (new primitive)

```typescript
interface WorkspaceCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  accentColor: string;        // dot color
  meta?: React.ReactNode;     // right side of header (counts, badges)
  badge?: React.ReactNode;    // tag in header (e.g. "Unleashed", "Streaming")
  defaultExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  children: React.ReactNode;
}
```

Every card in the Investigate grid is a `WorkspaceCard`. The card manages its own expand/collapse state and communicates changes to the parent grid via callback.

### 4.2 WorkspaceGrid (layout manager)

```typescript
interface WorkspaceGridProps {
  layout: 'import' | 'investigate' | 'submit';
  children: React.ReactNode;
}
```

Manages the CSS grid configuration for each room. Handles the anime.js timeline for room transitions. Reads card expand/collapse states to adjust grid-template dynamically.

### 4.3 RoomRouter (phase manager)

```typescript
interface RoomRouterProps {
  phase: 'import' | 'investigate' | 'submit';
  onPhaseChange: (phase: Phase) => void;
  ticketId?: string;
  children?: React.ReactNode;  // for Investigate room content
}
```

Top-level component that replaces the current `AppLayout`. Manages which room is active and orchestrates the transition timeline.

---

## 5. Component Mapping (Current → New)

| Current Component | New Location | Changes |
|-------------------|-------------|---------|
| `AppLayout` | `RoomRouter` + `WorkspaceGrid` | Split into phase routing + grid layout |
| `IconRail` | **Removed** | Phase navigation moves to header dots. Card-level controls move to card headers. |
| `SidebarPanel` | **Removed** | Content moves into cards (Evidence, Similar Tickets, etc.) |
| `FilterBar` (decomposed) | Embedded in Log Stream card header | SearchBar, FilterChips, FilterControls, FilterStatus stay as-is |
| `LogViewer` | Log Stream card body | Unchanged — still virtualized |
| `LogTimeline` | Embedded in Log Stream card (below filter bar) | Unchanged |
| `AiPanel` + `AISidebar` | AI Assistant card | Tabs become card-internal tabs |
| `CaseHeader` | Ticket Context in header bar | Simplified — priority + ID + status |
| `InvestigationSetupModal` | Import Room (replaces modal with inline form) | No longer a modal — it's the room |
| `DiagnosePhase1/2/3` | Driven by room transitions + AI card state | Phase 1 = Import→Investigate transition. Phase 2 = Investigate room. Phase 3 = Submit room. |
| `WorkspaceImportPanel` | Import Room card body | Same logic, new container |
| `ExportModal` | Submit Room "Download Evidence Pack" button | Inline in Submit, not modal |
| `LogDetailsPanel` | Slide-up drawer within Log Stream card | Click log row → detail drawer slides up from bottom of Log Stream card (same 360px height). Stays within the card boundary, not a global drawer. |
| `ServerSettingsPanel` | Settings modal (from header gear icon) | Unchanged |

---

## 6. Header Evolution

The header adapts per room:

| Room | Left | Center | Right |
|------|------|--------|-------|
| Import | Logo + "NocLense" | — | Theme toggle + Settings gear |
| Investigate | Logo | Ticket ID + Priority badge + Status | Phase dots + Theme + Settings |
| Submit | Logo | Ticket ID + "Closing" status | Phase dots (all green) + Theme + Settings |

Phase dots in the header: three dots connected by a line. Completed phases fill green. Active phase glows. Clicking a completed dot navigates back (with reverse morph animation).

---

## 7. Design Tokens (New/Modified)

```css
/* Room transitions */
--room-transition-duration: 600ms;
--room-transition-ease: cubic-bezier(0.33, 1, 0.68, 1);

/* Card system */
--card-radius: 12px;
--card-border: #263025;
--card-border-hover: #3a5030;
--card-header-height: 40px;
--card-collapsed-height: 36px;
--card-expand-duration: 350ms;
--card-expand-ease: spring(1, 80, 10, 0);

/* Room backgrounds */
--room-import-glow: radial-gradient(ellipse at center, rgba(118,206,64,0.03) 0%, transparent 70%);
--room-submit-glow: radial-gradient(ellipse at center, rgba(118,206,64,0.02) 0%, transparent 70%);
--room-investigate-bg: var(--workspace);

/* Phase dots */
--phase-dot-size: 8px;
--phase-dot-inactive: #263025;
--phase-dot-complete: #51912b;
--phase-dot-active: #76ce40;
--phase-dot-glow: 0 0 8px rgba(118,206,64,0.4);
```

---

## 8. Preset Layouts (CSS Grid Definitions)

### Import
```css
.room-import {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--room-import-glow);
}
```

### Investigate
```css
.room-investigate {
  display: grid;
  grid-template-columns: 1fr 1fr 340px;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  padding: 8px;
}
/* Log Stream spans top-left 2x2 */
.card-log-stream { grid-column: 1 / 3; grid-row: 1 / 3; }
/* AI spans top-right */
.card-ai { grid-column: 3; grid-row: 1; }
/* Evidence spans mid-right */
.card-evidence { grid-column: 3; grid-row: 2; }
/* Bottom row: 3 compact cards */
.card-similar { grid-column: 1; grid-row: 3; }
.card-correlation { grid-column: 2; grid-row: 3; }
.card-datadog { grid-column: 3; grid-row: 3; }
```

### Submit
```css
.room-submit {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
  padding: 40px;
  background: var(--room-submit-glow);
}
```

---

## 9. Migration Strategy

### Phase 1: Foundation (non-breaking)
- Create `WorkspaceCard`, `WorkspaceGrid`, `RoomRouter` components
- Create `PhaseHeader` component (replaces current header)
- Create room transition timeline utility
- All new components — nothing removed yet

### Phase 2: Room Shell (feature-flagged)
- Wire `RoomRouter` as alternate to `AppLayout` behind a feature flag
- Import Room: move `WorkspaceImportPanel` into centered card
- Submit Room: move closure note + evidence summary into two cards
- Investigate Room: wrap existing `FilterBar` + `LogViewer` + `AiPanel` in card containers

### Phase 3: Card System
- Replace `IconRail` + `SidebarPanel` with card-based navigation
- Move correlation panels, file lists, evidence into dedicated cards
- Wire expand-in-place interactions
- Wire card collapse to header

### Phase 4: Animations
- Implement room-to-room morph timelines
- Card stagger entrance on room entry
- Phase dot progression animation
- Evidence item add animation
- AI response streaming animation

### Phase 5: Polish + Cleanup
- Remove `AppLayout`, `IconRail`, `SidebarPanel`
- Remove feature flag
- Audit all components for orphaned code
- Update tests

---

## 10. What's NOT Changing

- **LogViewer** virtualization — same `@tanstack/react-virtual` inside the Log Stream card
- **LogContext** / **AIContext** — same state management, same hooks
- **Parser, services, utilities** — all backend logic untouched
- **Server backend** — no API changes
- **Electron packaging** — same build, new UI renders in the same window
- **Design tokens** — extended, not replaced. Green House palette stays.
- **Toast, Skeleton, anime.js hooks** — all reused as-is

---

## 11. New Feature Gaps Filled

| Gap | Solution |
|-----|----------|
| No visual call flow | Correlation Graph card shows ID → entity tree |
| No similar ticket matching | Similar Tickets card surfaces past investigations |
| No live Datadog integration | Datadog Live card streams production errors |
| Investigation feels same across phases | Three rooms with distinct layouts + morphing transitions |
| Too much on screen at once | Import and Submit rooms are calm. Investigate is dense by design. |
| No progressive disclosure | Cards expand/collapse. Bottom row starts compact. |

---

## 12. Verification

1. `npm run build` — TypeScript compiles with new components
2. `npx vitest run` — all existing tests pass (no behavioral changes in Phase 1-2)
3. Feature flag toggle — switch between old `AppLayout` and new `RoomRouter`
4. Preview verification:
   - Import room renders centered card with drop zone
   - File drop → morph transition → Investigate room with card grid
   - Cards expand/collapse with spring animation
   - "Next: Submit" → morph transition → Submit room with closure note
   - Phase dot navigation works (click to go back)
   - All existing filters, correlations, AI features work within cards

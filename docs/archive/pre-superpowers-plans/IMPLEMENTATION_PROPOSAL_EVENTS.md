# Implementation Proposal: Investigating Events Feature

## Overview

This proposal outlines the implementation of the "Investigating Events" functionality (USAGE_GUIDE.md lines 70-78), which enables users to browse, select, filter, and navigate through log events in the NocSight application.

---

## Feature Requirements

Based on the usage guide, users need to:

1. **Browse Events**: Scroll through a virtualized event list
2. **Select Event**: Click an event to view details in the right panel
3. **Filter Events**: Use the search bar to filter by keywords
4. **Time Navigation**: Use the timeline scrubber to jump to specific times

---

## Technical Architecture

### 1. Event Data Model

**Current State**: `NormalizedEvent` interface exists in `src/types/event.ts`

**Enhancement Needed**: Ensure the model supports all required fields for filtering and display.

### 2. Event Store/Context

**New Component**: `src/store/eventContext.tsx`

Create a new context provider for event state management that handles:
- Event list storage
- Filtered events (based on search/filters)
- Selected event tracking
- Search query state
- Time range state
- Integration with Case context

### 3. Virtualized Event List

**File**: `src/components/log/LogList.tsx` (enhance existing)

**Technology**: Use `react-window` for virtualization

**Features**:
- Virtual scrolling for performance (handle 10k+ events)
- Row height: 44px (iOS touch target)
- Event highlighting for selected event
- Click handler for event selection
- Level-based visual indicators (grayscale)

**Dependencies to Add**:
```bash
npm install react-window @types/react-window
```

### 4. Search/Filter Bar

**File**: `src/components/layout/TopBar.tsx` (enhance existing)

**Implementation**:
- Real-time search input with debouncing (300ms)
- Search across: message, extractedFields, service, source, IDs
- Display filtered count: "X of Y events"
- Clear search button

### 5. Event Selection & Details Panel

**File**: `src/components/log/EventDetails.tsx` (enhance existing)

**Enhancement**:
- Display full event information when selected
- Show: ID, timestamp, level, service, requestId, traceId, callId
- Display message (with scroll for long messages)
- Collapsible payload section
- Bookmark actions (already implemented)
- Event-level notes (already implemented)

### 6. Timeline Scrubber

**File**: `src/components/layout/Timeline.tsx` (enhance existing)

**Implementation**:
- Visual timeline bar showing event distribution
- Event markers (dots) positioned by timestamp
- Click to navigate to nearest event
- Show time range (min/max timestamps)
- Highlight selected event on timeline
- Optional: Time range selection overlay

---

## Data Loading Strategy

### Option 1: File Upload (Client-Side)

**Component**: `src/components/log/FileLoader.tsx`

- File input for .log, .txt, .ndjson, .json files
- Parse NDJSON format (one JSON object per line)
- Parse plain text logs (line-by-line, basic format)
- Load events into EventContext
- Error handling and validation

### Option 2: API Integration (Future)

**Service**: `src/services/logLoader.ts`

- Fetch events from backend API
- Support filtering parameters
- Handle pagination if needed

---

## Implementation Phases

### Phase 1: Core Infrastructure
- Create EventContext and EventProvider
- Implement basic event state management
- Create event filtering/search logic
- Integrate with Case context

### Phase 2: Virtualized List
- Install react-window
- Implement LogList with virtualization
- Add event selection handling
- Style event rows (monochrome iOS theme)

### Phase 3: Search & Filter
- Enhance TopBar with search input
- Implement search algorithm
- Add search result count display
- Debounce search input

### Phase 4: Event Details
- Enhance EventDetails component
- Display full event information
- Integrate bookmarking from event details
- Add event-level notes

### Phase 5: Timeline Scrubber
- Implement timeline visualization
- Add click-to-navigate functionality
- Show event markers on timeline
- Add time range selection (optional)

### Phase 6: File Loading
- Create FileLoader component
- Implement NDJSON parser
- Add plain text log parser (basic)
- Error handling and validation

### Phase 7: Polish & Testing
- Performance optimization
- Accessibility improvements
- Error boundaries
- User testing and feedback

---

## Performance Considerations

### Virtualization
- Use react-window for lists with 1000+ items
- Estimated row height: 44px
- Viewport: ~20-30 visible rows at once

### Search Optimization
- Debounce search input (300ms)
- Pre-compute searchable text on event load
- Use useMemo for filtered results
- Consider Web Workers for very large datasets (10k+ events)

### Memory Management
- Limit loaded events to reasonable size (configurable)
- Implement pagination or lazy loading if needed
- Clear old events when loading new files

---

## Dependencies

### New Packages
```bash
npm install react-window @types/react-window
```

### Optional (for advanced features)
```bash
npm install date-fns  # Better date formatting
npm install fuse.js   # Advanced fuzzy search
```

---

## Testing Strategy

### Unit Tests
- Event filtering logic
- Search algorithm
- Timeline position calculations

### Integration Tests
- Event selection â†’ Details panel update
- Search â†’ Filtered list update
- Timeline click â†’ Event selection

### Acceptance Criteria
- [ ] Can load and display 10,000+ events without lag
- [ ] Search filters events in < 100ms
- [ ] Clicking event shows details in right panel
- [ ] Timeline navigation selects nearest event
- [ ] Selected event persists when switching cases
- [ ] All interactions work on mobile/tablet

---

## Future Enhancements

1. **Advanced Filtering**: Level, service, time range filters
2. **Export Selected**: Export only filtered/selected events
3. **Event Grouping**: Group by service, time window, etc.
4. **Real-time Updates**: WebSocket integration for live logs
5. **Log Format Support**: Syslog, JSON Lines, CSV, etc.
6. **Bookmark Quick Navigation**: Jump to bookmarked events

---

## Success Metrics

- **Performance**: < 100ms search response, smooth scrolling
- **Usability**: Users can find events in < 30 seconds
- **Reliability**: < 1% error rate on file loading
- **Adoption**: 80% of NOC team uses feature within 2 weeks

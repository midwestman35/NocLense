# Runbook — Investigate Room

**Surface:** `src/components/rooms/investigate/` — `InvestigateRoom.tsx`, `LogStreamPanel.tsx`, `FilterChipBar.tsx`, `CorrelationGraph.tsx`, `EvidencePanel.tsx`, `AIAssistantPanel.tsx`, `SimilarTicketsPanel.tsx`, `CitationJumpHandler.tsx`, `DatadogLiveCard.tsx`. Delegates to existing `src/components/LogViewer.tsx` for virtualization.
**Source commits:** `2efe2c4` (07G.1 log stream) + `610c35e` (07G.2 graph + evidence) + `373b80e` (07G.3 AI + citations) + `5435464` (polish)
**Automation share:** ~60% — G6 interactions + AI roundtrip need significant fixture infrastructure
**Last updated:** 2026-04-23

## Revision history

| Rev | Date | Summary |
|---|---|---|
| v1 | 2026-04-23 | Initial draft, post-07G.1/2/3 + polish. Densest surface in the app. |

## Preconditions

- Setup Room runbook §9 complete (transition to Investigate with case context).
- Case has ≥100k log entries (use `large.log` fixture or real export).
- Unleashed AI credentials configured via Setup Room so AI panel roundtrips actually reach the provider.
- If testing Datadog Live: Datadog API + app keys configured and an active station/host with live events.

## Steps

### 1. First paint (grid layout)

**Action:** Enter Investigate Room.

**Pass criteria:**
- Grid renders 6 cards per the workspace layout spec: Log Stream, AI Assistant, Evidence, Similar Tickets, Correlation Graph, Datadog Live.
- `CaseHeader` shows ticket ID + title.
- `FilterBar` + `LogTimeline` + `FilterChipBar` render above the log stream.
- Phase dots show Investigate active.
- No console errors.

### 2. Log stream virtualization

**Action:** Scroll the log stream from top to a position ~60% through the entry list.

**Pass criteria:**
- `LogViewer` delegates to `@tanstack/react-virtual`; only ~30–50 rows render in the DOM at any time.
- Scroll remains smooth (no frame drop >50ms measured in DevTools Performance tab).
- As scroll advances in IndexedDB mode, `LogViewer.tsx:241` triggers `loadLogsFromIndexedDB` for the new visible range.
- Row height is consistent; no layout thrash.

### 3. Filter chips — SIP method

**Action:** Click a SIP method chip (e.g., INVITE) in `FilterChipBar`.

**Pass criteria:**
- Log stream filters to entries where `log.sipMethod === 'INVITE'` (or equivalent).
- Row count reflects filtered subset.
- Chip renders in active state.
- Clicking again removes the filter.

### 4. Filter chips — level

**Action:** Click a level chip (e.g., ERROR).

**Pass criteria:**
- Log stream filters to `log.level === 'ERROR'`.
- Multiple chips combine as AND (level + sipMethod both apply).

### 5. Filter chips — correlation

**Action:** Right-click or select a log line to add its correlation ID (trace / call-id / session) to active correlations. Click the correlation chip if present.

**Pass criteria:**
- `LogContext.activeCorrelations` updates.
- Log stream filters to only entries with matching correlation.
- `CorrelationGraph` highlights the corresponding node(s) / edge(s).

### 6. Correlation graph (G6) render

**Action:** Observe the `CorrelationGraph` card once logs are loaded.

**Pass criteria:**
- G6 canvas renders with nodes for each correlation group.
- Node sizes reflect relative entry counts.
- Edges show temporal or session relationships.
- Pan + zoom work (mouse wheel zoom, drag pan).

### 7. Correlation graph interaction

**Action:** Click a node in the graph.

**Pass criteria:**
- Clicked correlation is added to `LogContext.activeCorrelations` (same effect as chip click).
- Log stream filters accordingly.
- Node renders in selected state.

### 8. AI assistant chat roundtrip

**Action:** In `AIAssistantPanel`, type a question like "Why is dispatch 4 seeing dropped audio?". Send.

**Pass criteria:**
- Request routes through `llmService` to Unleashed AI provider.
- Response streams back into the panel (token-by-token if provider supports streaming).
- Response body references specific log lines (citations) where the AI's reasoning uses them.
- No blocking UI — user can scroll log stream or click other cards while AI responds.

### 9. Citation jump from AI to log line

**Action:** In an AI response, click a citation marker (usually a timestamp or line number).

**Pass criteria:**
- `CitationJumpHandler` intercepts, calls `logViewerRef.current.jumpToCitation(...)`.
- Log stream scrolls to the cited entry.
- Cited entry is visually highlighted (CSS pulse or focus ring).
- Scroll position stable after the jump (no subsequent drift).

### 10. Evidence capture — highlight + pin

**Action:** Select text within a log entry. Click the "Pin as evidence" affordance (context menu or button).

**Pass criteria:**
- `EvidencePanel` list gains a new item with the selected text, source log ID, and a timestamp.
- `EvidenceContext.pinBlock` fires (known baseline test failure on `localStorage.clear` polyfill per inventory §1.5 — functional behavior is correct; test just fails at teardown).
- Evidence item is orderable (drag to reorder, or arrow buttons) — verify ordering persists via `EvidenceContext.reorderItems`.

### 11. Evidence unpin

**Action:** Click the unpin / remove affordance on a pinned evidence item.

**Pass criteria:**
- Item removes from `EvidencePanel`.
- `EvidenceContext.unpinBlock` fires.
- Remaining evidence items reorder without gaps.

### 12. Evidence note

**Action:** Add a free-text note to a pinned evidence item.

**Pass criteria:**
- `EvidenceContext.updateItemNote` persists the note.
- Note renders in the panel.
- Submitting an empty note clears the note (no orphan empty string).

### 13. Similar tickets panel

**Action:** Observe the `SimilarTicketsPanel` while case context is active.

**Pass criteria:**
- Panel lists ≥1 similar ticket if the embedding / retrieval service has indexed content.
- Each row shows ticket ID, title, similarity score or rank.
- Click a row → Confluence / Zendesk link opens (external browser) or a read-only panel renders the ticket body.

### 14. Datadog Live card

**Action:** With Datadog credentials + hosts configured, observe `DatadogLiveCard`.

**Pass criteria:**
- Card shows recent events from the configured indexes/hosts.
- Events update every N seconds (verify interval against `RoomLiveStateProvider` config).
- Click an event → jumps to the corresponding log entry in the log stream if matched, or opens a detail panel.

### 15. Filter bar — text search

**Action:** Type a substring in `FilterBar` text input.

**Pass criteria:**
- Log stream debounces (300ms per the server-filter debounce) and filters to matches.
- Match count updates in the filter bar UI.
- Empty string clears the filter.

### 16. Timeline zoom

**Action:** Drag the `LogTimeline` selection range.

**Pass criteria:**
- `LogContext.timelineZoomRange` updates.
- Log stream filters to entries within the zoomed window.
- Correlation graph may update to reflect the zoomed subset (if wired).

### 17. Log details panel

**Action:** Click a log row.

**Pass criteria:**
- `LogDetailsPanel` opens at the bottom (300px height per `LogStreamPanel.tsx:46`).
- Shows full entry body, parsed fields, actions (pin evidence, copy, etc.).
- Close button or Esc dismisses the panel.
- Jump button (if present) scrolls the log stream to the entry.

### 18. Keyboard shortcuts (if any)

**Action:** Attempt common shortcuts: Ctrl+F (filter), arrow keys (row nav), Esc (close panel), Space (pause live).

**Pass criteria:**
- Each implemented shortcut has its intended effect.
- Unimplemented shortcuts should be harmless no-ops (not trigger browser-default behavior that conflicts — e.g., Ctrl+F opening browser find-in-page).

### 19. Forward phase nav

**Action:** Click the Submit phase dot without completing Investigate "fully" (subjective).

**Pass criteria:**
- Navigation succeeds (post-07C.2 polish: forward navigation allowed).
- Submit Room mounts with whatever evidence + correlations + closure state exists at that moment.

### 20. Resize behavior

**Action:** Resize window between 1100×700 and 1920×1080.

**Pass criteria:**
- Grid reflows; cards stack or rearrange at narrow widths.
- Log stream remains the dominant area.
- G6 graph re-fits its canvas to the new card size.
- No horizontal scrollbar.

## Known failure modes

| Symptom | Root cause | Fix / watch |
|---|---|---|
| Log stream renders 0 rows despite logs in memory | `useIndexedDBMode` mismatch — `LogContext.logs` is empty but `indexedDBLogs` should be source of truth; `LogViewer` reading wrong array | Check `LogContext.tsx:959` source selection |
| Scroll janky at 100k entries | Virtualization broken — non-virtualized component wrapping `LogViewer`, OR oversized rows forcing reflow | Profiler: confirm `@tanstack/react-virtual` only renders visible slice |
| G6 graph blank | Canvas mount size is 0 (card layout collapse) OR G6 init called before ref is attached | Check `CorrelationGraph.tsx` useLayoutEffect for size |
| AI panel returns but no citations | Prompt template not instructing AI to cite; or citation marker format mismatched with parser | Check `src/services/promptTemplates.ts` + `CitationJumpHandler` regex |
| Citation click does nothing | `logViewerRef.current` is null (ref not attached) or `jumpToCitation` not on handle | Check `LogViewer.tsx` forwardRef + imperativeHandle |
| Evidence pin doesn't persist across reload | `EvidenceContext` is session-memory only; not serialized to IndexedDB | Expected behavior until Phase 08 persistence slice |

## Automation target (07J.3)

| Step | Automatable? | Notes |
|---|---|---|
| 1. First paint | YES | Assert 6-card layout markers |
| 2. Log stream virtualization | PARTIAL | Playwright can scroll + assert row count in DOM stays bounded; frame-drop measurement needs `performance.measure` hooks |
| 3–5. Filter chips | YES | Click chip, assert filter chip active state + row count change |
| 6–7. Correlation graph | PARTIAL | G6 renders to `<canvas>` — can't query DOM nodes. Possible via graph's public API exposed on `window.__graphInstance` (test-only hook) |
| 8. AI roundtrip | PARTIAL | Needs mocked LLM response stream (MSW or Playwright route). Real Unleashed API stays manual |
| 9. Citation jump | YES with mocked AI | Assert scroll position after click |
| 10–12. Evidence | YES | Already has test coverage in `EvidenceContext.test.tsx` (baseline failures on teardown, functional behavior correct) |
| 13. Similar tickets | PARTIAL | Mock embedding service response |
| 14. Datadog Live | PARTIAL | Mock Datadog service; real-time polling behavior needs time manipulation (`page.clock.fastForward`) |
| 15. Filter bar text search | YES | Fill input, assert debounced filter |
| 16. Timeline zoom | PARTIAL | Drag gesture in Playwright is fiddly but doable |
| 17. Log details panel | YES | Click row, assert panel |
| 18. Keyboard shortcuts | YES | `page.keyboard.press(...)` |
| 19. Forward nav | YES | Click phase dot, assert Submit mount |
| 20. Resize | PARTIAL | Visual-diff baseline needed |

`/smoke-tauri investigate-room` runs the automated subset. Given the complexity, this runbook will be the slowest to fully automate — expect 07J.3.a to ship with ~60% coverage and the rest landing incrementally in Phase 08.

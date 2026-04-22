# Apex New UI vs Old UI Log Analysis

This document summarizes findings from comparing **Old UI** logs (`oldui.txt`) and **New UI** logs (`log.backup14.txt`), with recommendations for parser efficiency, UI summarization, and feature improvements inspired by Datadog and AWS CloudWatch.

---

## 1. Log Format Comparison

### Old UI (CCS-SDK)

- **Header pattern:** `[INFO] [12/8/2025, 8:25:05 AM,539] [CCS-SDK]: Mon Dec 08 2025 ... | sip.Transport | Sending WebSocket message:`
- **Payload:** Multi-line SIP (OPTIONS, REGISTER, 200 OK, etc.) — typically 5–25 lines per entry.
- **Components:** Primarily `CCS-SDK` with sub-contexts like `sip.Transport`, `sip.Registerer`.
- **Identifiers:** Call-ID, From, To, CSeq, agentid (in Contact).

### New UI (multi-service)

- **Header pattern:** Same `[LEVEL] [date, time, ms] [component]: message` — **parser regex already matches**.
- **Payload:** Often **large JSON** (hundreds to ~930 lines per entry).
- **Components observed:**
  - `CNCMessageHandlerService` — CNC Web socket messages (e.g. `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`).
  - `FDXMessageHandlerService` — FDX Web socket (reportNLPConversation, fdxReportUpdateMessageData).
  - `HTTP-Logger` — HTTP requests/responses (e.g. POST ReportSubscribeCommand).
  - `CCS-SDK` — Still present (RTP metrics, sip.Transport).
  - `LocationDataService`, `LocationStore` — Location/locationDetailsList.
- **Identifiers in JSON:** `messageType`, `messageID`, `cncID`, `reportID`, `operatorID`, `extensionID`, `recordID`, `recipientsClientIDs`, `operatorsStatuses[]`, etc.

**Volume:** New UI has far more data per “log entry” (one header line + huge JSON). Same line-based parser correctly treats everything after the header until the next `[LEVEL] [date] [component]:` as payload, so one entry can be 900+ lines. Total line count in the new file is much higher; effective “event” count may be lower but each event is heavier.

---

## 2. Parser & Component Efficiency

### 2.1 What Already Works

- **Regex:** `logRegex1` / `logRegex2` in `src/utils/parser.ts` match both old and new header formats (same `[LEVEL] [date, time] [component]: message`).
- **Continuation lines:** Non-matching lines are appended to `currentLog.payload`, so multi-line JSON is one `LogEntry` with a large `payload`.
- **JSON parsing:** `processLogPayload()` parses payload when it starts/ends with `{}`, sets `log.json`, `log.type = 'JSON'`, and already extracts:
  - `reportNLPConversation.reportID` → `reportId`
  - `recipientsClientIDs[0]` / `operatorID` → `operatorId`
  - `extensionID` → `extensionId` / `stationId`
- **Streaming / IndexedDB:** Large files use `parseLogFileStreaming` or `parseLogFileStreamingToIndexedDB` (e.g. >50MB), which avoids loading the whole file into a single string.

### 2.2 Recommended Parser Updates

| Area | Change | Rationale |
|------|--------|-----------|
| **CNC/FDX message summary** | When `log.json` has `messageType` (string or number), set a short **summary** (e.g. new field `summaryMessage` or overwrite `displayMessage`) so the table row is useful without opening the payload. | New UI table rows currently show "CNC Web socket message:" or "FDX Web socket message:" for every such entry; summarization improves scan-ability. |
| **CNC-specific extraction** | If `log.json.messageType === 'CNC_OPERATORS_STATUSES_UPDATE_MESSAGE'` (or similar), parse `operatorsStatuses` and set summary to e.g. `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (N operators)`. Optionally extract `cncID`, `messageID` for correlation. | Reduces noise and enables correlation by cnc/session. |
| **FDX-specific extraction** | If payload has `reportNLPConversation`, use `reportID` (and optionally first line of transcript) for summary. If `fdxReportUpdateMessageData`, use `reportUpdateTypes` or report state for summary. | Aligns table with “what happened” (report id, update type). |
| **HTTP-Logger** | If component is `HTTP-Logger` and message matches `✅ Response: POST ... (Nms)` or `🚀 Sending Request: ...`, keep or slightly clean message as `displayMessage` (already readable). | No change needed if cleanup already preserves these. |
| **Service mappings** | Add `CNCMessageHandlerService` → `CNC`, `FDXMessageHandlerService` → `FDX` in `public/service-mappings.json` (and any other new components). | Consistent short names in Service column. |
| **Optional: payload cap** | For very large payloads (e.g. >500KB), consider storing a truncated payload in memory and optionally lazy-loading full payload from IndexedDB or file on demand. | Keeps memory and serialization cost bounded for 100k+ line files. |

### 2.3 Component / UI Efficiency

- **LogRow:** For entries with `log.type === 'JSON'` and a known `messageType` or summary, show the summary in the Message column instead of raw `displayMessage` so the main table stays readable.
- **Details panel (App.tsx):** When `selectedLog.json` is very large (e.g. `operatorsStatuses` with huge arrays), consider:
  - Collapsible sections by top-level key, or
  - “Summary” view (messageType, cncID, messageID, reportID, operator count) + “Raw JSON” toggle, or
  - Virtualized or truncated JSON view with “Show full” to avoid rendering 900+ lines at once.
- **Virtual list:** Already in use (`@tanstack/react-virtual`); ensure `estimateSize` and heavy payloads in expanded rows don’t cause layout thrash. Optional: don’t render full payload in expanded row for entries over a size threshold; show “Payload too large – view in details panel” instead.

---

## 3. UI Table Summarization & Antigravity Prompts

### 3.1 Common Fields Across Both Formats

- **Timestamp** — already shown.
- **Level** — already shown.
- **Component / Service** — already shown; add mappings for CNC/FDX.
- **Message / Summary** — needs to be derived for new UI:
  - **CNC:** `messageType` + e.g. `(N operators)` or `(queuesStatuses)`.
  - **FDX:** `reportID` + optional `reportUpdateTypes` or first transcript line.
  - **HTTP-Logger:** keep existing short message (e.g. `✅ Response: POST ... (108ms)`).
  - **CCS-SDK:** keep existing (SIP method, RTP metric, etc.).
  - **LocationDataService / LocationStore:** e.g. “Incoming Locations from ReportData” or “Updated locationDetailsList (N items)”.
- **Correlation:** Call-ID, Report ID, Operator ID, Extension ID already used; add **cncID**, **messageID** where present for “session” or “message” correlation.

### 3.2 Suggested Antigravity Prompts

Use these as focused prompts for implementation (e.g. with Antigravity or similar tooling).

1. **Parser – JSON summary and CNC/FDX extraction**  
   “In `src/utils/parser.ts`, inside `processLogPayload`, when `log.json` exists: (1) If `log.json.messageType` is a string (e.g. `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`), set `log.displayMessage` to a short summary including that type and, if present, the length of `log.json.operatorsStatuses` (e.g. ‘CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (12 operators)’). (2) If `log.json.reportNLPConversation` exists, include `reportID` in the summary. (3) If `log.json.fdxReportUpdateMessageData` exists, include `reportUpdateTypes` or report id in the summary. (4) Extract `log.json.cncID` and `log.json.messageID` onto the log entry for correlation (add optional fields to the LogEntry type if needed).”

2. **Service mappings**  
   “Add entries to `public/service-mappings.json`: `CNCMessageHandlerService` -> `CNC`, `FDXMessageHandlerService` -> `FDX`. Ensure `messageCleanup` or the parser uses these so the Service column shows CNC and FDX for the new Apex UI logs.”

3. **Details panel – large JSON**  
   “In the log details panel in `App.tsx`, when the selected log has `type === 'JSON'` and `selectedLog.json` is large (e.g. stringified length > 50KB): show a compact summary (e.g. messageType, cncID, messageID, reportID, operator count) at the top, then a collapsible ‘Raw JSON’ section that renders `JSON.stringify(selectedLog.json, null, 2)` only when expanded, or a truncated preview with a ‘Show full’ button.”

4. **Correlation – cncID and messageID**  
   “Extend correlation in `LogContext` and `CorrelationSidebar` to support `cncID` and `messageID` when present on log entries. Include them in the sidebar (e.g. under a ‘Session’ or ‘Message’ group) and allow filter-by-cncID and filter-by-messageID like existing report/callId filters.”

5. **LogEntry type**  
   “In `src/types.ts`, add optional fields to `LogEntry`: `messageType?: string`, `cncID?: string`, `messageID?: string`, and `summaryMessage?: string`. Parser and UI should set/use these for new UI logs.”

---

## 4. Feature Suggestions (Datadog / CloudWatch Style)

### 4.1 Visibility & Parsing

- **Structured fields panel:** Like CloudWatch Insights “Fields” – parse all JSON and SIP headers into a key-value list (e.g. messageType, cncID, reportID, Call-ID) and show in the details panel or a side panel for quick scanning and copy.
- **Log level distribution:** Small chart or counts (INFO / DEBUG / ERROR / WARN) for the current file or filtered set.
- **Component distribution:** Pie or bar chart of message count by component (CNC, FDX, CCS-SDK, HTTP-Logger, etc.) to see where volume is.
- **Time bucketing:** For very large files, optional “sampling” or “downsampling” (e.g. one row per 100ms or per component per second) to reduce rows while keeping distribution visible.

### 4.2 Correlation & Tracing

- **Session / trace ID:** Use `cncID` and `messageID` as trace/session identifiers; “Show all logs with this cncID” or “this messageID” like Call-ID today.
- **Report-centric view:** Filter or group by `reportID`; show timeline of all events for that report (FDX, HTTP, Location, etc.).
- **Operator-centric view:** Filter by `operatorID` or extension; show all CNC status updates and calls for that operator.
- **Call flow:** Already have Call-ID flow; extend to “Report flow” (reportID across FDX/HTTP/Location) or “CNC session” (cncID).

### 4.3 Filtering & Querying

- **Faceted search:** Filter by `messageType` (e.g. only `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`), by component, by level, by time range, then full-text.
- **Saved views / queries:** Save current filters (component + level + text + time range) as named “views” and recall them (like saved queries in Datadog/CloudWatch).
- **Exclude by messageType:** Option to hide high-volume, low-signal types (e.g. operator status updates) to focus on calls, reports, and errors.

### 4.4 Performance & Scale

- **Lazy payload:** For entries with payload size above a threshold, do not hold full payload in memory; store offset/length and load on demand when the user opens details or expands the row.
- **Web Worker parsing:** Move parsing (or at least JSON parsing and summary extraction) to a Web Worker so the main thread stays responsive on huge files.
- **IndexedDB schema:** If using IndexedDB for large files, consider storing summary fields (messageType, cncID, reportID, displayMessage) in the main index and payload in a separate store or blob, loaded on demand.

### 4.5 Operational / Ops Style

- **Live tail:** If logs are streamed (e.g. via WebSocket or repeated file drop), append new entries to the view with optional “pause” and “follow” like `tail -f`.
- **Alerts / highlights:** Optional rules (e.g. “if message contains MEDIA_TIMEOUT or level === ERROR, highlight row”) and simple counts of “matches” in the current view.
- **Export filtered:** Already have export; ensure export respects current filters and optionally exports only summary columns (timestamp, component, summaryMessage, reportID, callId) for sharing or external analysis.

---

## 5. Summary Table

| Topic | Old UI | New UI | Recommendation |
|-------|--------|--------|----------------|
| **Header format** | `[INFO] [date, time] [CCS-SDK]: ...` | Same pattern, more components | Parser OK; add service mappings for CNC, FDX. |
| **Payload size** | Small (SIP, few lines) | Large (JSON, 100s of lines) | Summarize in parser; optional payload cap / lazy load. |
| **Identifiers** | Call-ID, agentid | + messageType, cncID, messageID, reportID, operatorID | Extract in parser; add to LogEntry; use in correlation. |
| **Table message** | SIP first line / short message | “CNC Web socket message:” repeated | Derive summary from JSON (messageType, counts, reportID). |
| **Details panel** | Small payload, readable | Huge JSON, hard to read | Summary + collapsible raw JSON or truncated + “Show full”. |
| **Correlation** | Call-ID, report, operator | Same + cncID, messageID | Add cncID/messageID to sidebar and filters. |

Implementing the parser summarization and service mappings first will give the biggest gain for New UI logs; then add cncID/messageID correlation and details-panel handling for large JSON. The Antigravity prompts in §3.2 can be used as-is for those steps.

---

## 6. UI Suggestions: Clean, Readable, Category-Based Interface

Based on the current UI (search bar, Service filter, log table with Timestamp/Lvl/Service/Message, details panel with RAW PAYLOAD) and the log file analysis above, here are focused suggestions for a cleaner, more readable interface that leans on parser categorization.

### 6.1 Table: Message Column (Summarization)

- **Already in place:** The parser sets `displayMessage` from `buildJsonSummary()` for CNC/FDX JSON (e.g. `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (12 operators)`, `report 9075992`, etc.). `LogRow` shows `log.displayMessage`, so summarized rows should already appear when the parser runs.
- **Verify:** If you still see generic “CNC Web socket message:” or “FDX Web socket message:” in the Message column, ensure `processLogPayload()` runs for every entry and that `buildJsonSummary()` covers all your `messageType`/payload shapes (e.g. add more branches for new message types).
- **Prefer summary in list:** In `LogRow`, prefer `log.summaryMessage ?? log.displayMessage` so the list always shows the short summary when available, and the details panel can show full `log.message` + payload.

### 6.2 Table: Category / MessageType Badges

- **Add a small category badge** next to the message for quick scanning:
  - Use `log.messageType` when present (e.g. `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`, `reportNLPConversation`).
  - Use `log.type === 'JSON'` vs SIP vs plain LOG to style differently (e.g. JSON = subtle pill, SIP = method-colored tag you already have).
- **Service column:** You already map `CNCMessageHandlerService` → CNC and `FDXMessageHandlerService` → FDX in `service-mappings.json`; ensure `displayComponent` is used consistently so the Service column shows short names (CNC, FDX, CCS, HTTP-Logger) for a clean, scannable table.

### 6.3 Reduce Repetition in the List

- **Consecutive similar rows:** For consecutive rows with the same `messageType` and same `summaryMessage` (e.g. many “report 9075992” or “CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (N operators)”):
  - **Option A – Collapse:** Offer a “Collapse similar” mode: group consecutive identical `(displayComponent, summaryMessage)` and show one row with a count, e.g. “report 9075992 (×12)”, expandable to show individual rows.
  - **Option B – Filter:** Add a filter “Exclude by messageType” (e.g. hide `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`) so users can hide high-volume, low-signal types and focus on reports, calls, and errors.
- **Option B is simpler** and works well with the existing Filter bar; Option A requires grouping logic and expand/collapse in the virtual list.

### 6.4 Details Panel: Summary-First, Then Structure, Then Raw

- **Current behavior:** `LogDetailsPanel` already has a Summary block (messageType, cncID, messageID, reportID, operator count), Structured fields table, and collapsible Raw JSON/payload. This matches the “summary first, raw on demand” approach.
- **Improvements:**
  - **Always show Summary when available:** Use `summaryMessage` or the same fields (messageType, cncID, messageID, reportID) at the top so the user immediately sees “what this log is” before scrolling.
  - **Structured fields:** Keep the structured-fields table; it gives a CloudWatch-style “Fields” view and supports copy. Consider putting it above Raw payload and making Raw clearly “for debugging only.”
  - **Large payloads:** You already truncate and “Show full”; keep that. For very large JSON, avoid rendering the full tree in the panel; keep summary + structured fields + truncated raw.

### 6.5 Filtering by Category

- **Service (component):** Already in place via the Service column filter in `LogViewer` (e.g. CNC, FDX, CCS).
- **Message type:** Add an optional “Message type” filter (e.g. dropdown or multi-select): filter by `log.messageType` (e.g. only `CNC_OPERATORS_STATUSES_UPDATE_MESSAGE`, or only entries with `reportNLPConversation`). This helps users focus on one category of traffic.
- **Level and SIP:** You already have level and SIP method filters; no change needed for categorization.

### 6.6 Correlation Pills in the Table

- **Current:** Call-ID is shown as a colored pill in the Message column.
- **Extend:** When `log.reportId` or `log.cncID` / `log.messageID` are present, show small pills (e.g. “report 9075992”, “cncID: xyz”) in the same way, so users can quickly see correlation IDs and click to filter (if you wire “filter by this report/cncID” in the sidebar).

### 6.7 Readability and Layout

- **Wrap text:** You have “Wrap Text”; keep it. For long summary lines, consider capping the visible line count (e.g. 2 lines) with “Show more” so the table doesn’t grow too tall.
- **Details panel title:** Keep “Details: Log #2048” and add the category/summary in the subtitle, e.g. “CNC_OPERATORS_STATUSES_UPDATE_MESSAGE (12 operators)” so the panel is self-explanatory.
- **Log count:** “5000 / 5000” is clear; if you add “Collapse similar,” you could show “5000 entries (1200 unique)” or “N groups” when in collapsed mode.

### 6.8 Summary of Priorities

| Priority | Suggestion | Effort |
|----------|------------|--------|
| 1 | Ensure table uses parser summary (`summaryMessage` / `displayMessage`) for all JSON types; extend `buildJsonSummary()` if needed | Low |
| 2 | Add “Message type” filter (dropdown) to focus on one category | Low |
| 3 | Show reportID / cncID / messageID pills in the Message column (like Call-ID) and wire to correlation sidebar | Medium |
| 4 | Optional “Exclude by messageType” to hide noisy types | Low |
| 5 | Details panel: subtitle with summary/category; keep Summary + Structured fields + Raw layout | Low |
| 6 | Optional “Collapse similar” consecutive rows for dense, repetitive logs | High |

Together, these keep the UI clean and readable by relying on the parser’s categorization (messageType, summaryMessage, reportId, cncID, messageID) and making that visible in the table, filters, and details panel.

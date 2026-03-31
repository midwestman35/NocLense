# NocLense Implementation Plan — 3/30/2026

**Source:** Leandro + Enrique walkthrough session (3/30/2026)
**Author:** Enrique Velazquez
**Status:** Draft — Action items from live demo review of commit `a33596c`

---

## Table of Contents

1. [Datadog Station Discovery Failures](#1-datadog-station-discovery-failures)
2. [Empty Logs in the UI](#2-empty-logs-in-the-ui)
3. [Source Filter Column](#3-source-filter-column)
4. [AI Analysis Speed Optimization](#4-ai-analysis-speed-optimization)
5. [Scalable Right Sidebar](#5-scalable-right-sidebar)
6. [Custom Prompt Injection / Template Tool Call](#6-custom-prompt-injection--template-tool-call)
7. [Jira API Foundation + UI Mockups](#7-jira-api-foundation--ui-mockups)
8. [Historical Ticket Research (Zendesk + Unleashed)](#8-historical-ticket-research-zendesk--unleashed)
9. [Additional Read-Only Integrations (Twilio, Homer, etc.)](#9-additional-read-only-integrations-twilio-homer-etc)
10. [Log Correlation Verification](#10-log-correlation-verification)
11. [Remove Case Button / Simplify Navigation](#11-remove-case-button--simplify-navigation)
12. [Large File Crashes — Backend Offloading (ServerLense)](#12-large-file-crashes--backend-offloading-serverlense)
13. [UX Crashes — IndexedDB / Backend DB](#13-ux-crashes--indexeddb--backend-db)

---

## 1. Datadog Station Discovery Failures

**Problem:** `Discover Stations` button intermittently returns 0 results for a CNC name that previously returned 29+ stations. Worked moments before the demo, then stopped. Possible rate limiting.

**Current Implementation:**
- `datadogService.ts` → `discoverStationsForCnc()` uses 3 query strategies: facet path (`@log.machineData.callCenterName`), index-based, and freetext search.
- Multi-page aggregation (up to 3 pages).
- Auth: `DD-API-KEY` + `DD-APPLICATION-KEY` headers via `/datadog-proxy`.

**Investigation Steps:**
1. **Rate limit audit** — Datadog Logs API v2 has documented rate limits (300 requests/hour for search). Log response headers (`x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`) in the console on every call to `discoverStationsForCnc()`.
2. **Add retry with backoff** — If a 429 is returned, implement exponential backoff (1s, 2s, 4s) with a max of 3 retries.
3. **Cache station results** — Station-to-CNC mappings are relatively stable. Cache discovery results in `sessionStorage` with a 15-minute TTL so repeated clicks don't re-query.
4. **Surface rate limit info in UI** — If rate-limited, show a toast: "Datadog rate limit reached — try again in X seconds" rather than silently returning 0 results.

**Files to touch:**
- `src/services/datadogService.ts` — Add rate limit header logging, retry logic, caching
- `src/components/ai/diagnose/DiagnosePhase1.tsx` — Add rate limit error messaging in the station discovery UI

**Estimated complexity:** Medium

---

## 2. Empty Logs in the UI

**Problem:** Some log rows appear blank/empty in the log viewer after importing files. Unclear if this is a rendering issue (virtualization gap) or a parsing issue (entries parsed with no displayable fields).

**Current Implementation:**
- `LogViewer.tsx` uses `@tanstack/react-virtual` for virtualized rendering.
- `LogRow.tsx` renders individual entries.
- `parser.ts` handles Datadog CSV, Homer SIP, JSON, Call Log CSV, CCS/PBX, FDX.
- Large files (>50MB) use IndexedDB mode via `indexedDB.ts`.

**Investigation Steps:**
1. **Reproduce with Leandro's test ticket** — Use the exact ticket ID from the demo to replicate.
2. **Add defensive rendering** — In `LogRow.tsx`, if the entry has no `message` and no `rawLine`, render a placeholder: `[Empty entry — source: {entry.source}]` with a dim style. This at minimum makes the issue visible.
3. **Parser audit** — Add a post-parse validation step in `parser.ts` that flags entries with no `message`, no `timestamp`, and no `rawLine`. Log a warning with the line number and source file.
4. **Virtual scroll gap check** — Verify `estimateSize` in `LogViewer.tsx` matches actual rendered row heights. A mismatch can cause "phantom" rows that appear blank because the virtualizer thinks they're in view but the content is offset.

**Files to touch:**
- `src/components/LogRow.tsx` — Defensive empty-state rendering
- `src/utils/parser.ts` — Post-parse validation logging
- `src/components/LogViewer.tsx` — Audit virtualizer `estimateSize` vs actual row heights

**Estimated complexity:** Medium (could be quick if it's just a parser gap, longer if it's a virtualizer issue)

---

## 3. Source Filter Column

**Problem:** When multiple log sources are loaded (Datadog + Homer SIP + Call Logs, etc.), users need a way to filter by source in the "service" column. Leandro says the feature was built but isn't appearing when multiple sources are loaded.

**Current Implementation:**
- `FilterBar.tsx` already has a source filter dropdown with color-coded pills for: Datadog, Homer SIP, Call Log, FDX, CCS/PBX, APEX Local.
- `LogContext.tsx` has `sourceFilter` state (`string | null`) and filters logs by `entry.source`.
- The dropdown is gated by: it should only show when there are multiple distinct sources in the loaded logs.

**Investigation Steps:**
1. **Check the visibility condition** — In `FilterBar.tsx`, find the condition that gates the source filter dropdown. It may be checking `sources.size > 1` but the `source` field on parsed entries might not be consistently populated.
2. **Audit parser source tagging** — Verify that every parser path in `parser.ts` sets the `source` field on the `LogEntry`. Specifically check:
   - Datadog logs → should be `"Datadog"`
   - Homer SIP → should be `"Homer SIP"`
   - Call Log CSV → should be `"Call Log"`
   - JSON/generic → may be missing `source`
3. **Force-show for debugging** — Temporarily remove the multi-source gate to confirm the dropdown works, then fix the gate condition.

**Files to touch:**
- `src/components/FilterBar.tsx` — Fix visibility condition
- `src/utils/parser.ts` — Ensure every parser path sets `entry.source`
- `src/contexts/LogContext.tsx` — Verify `sourceFilter` logic

**Estimated complexity:** Low — likely a source-tagging gap in the parser

---

## 4. AI Analysis Speed Optimization

**Problem:** The Diagnose Phase 2 analysis takes too long, especially with large multi-source contexts. Leandro noted the processing is slow.

**Current Implementation:**
- `unleashService.ts` → `diagnoseLogs()` sends up to 100KB of context in a single request.
- `formatLogsForDiagnosis()` prioritizes ERROR > WARN > SIP failures > INFO, truncates payloads to 200 chars.
- Single-shot LLM call — no streaming, no chunking.

**Suggestions:**
1. **Implement streaming responses** — If the Unleashed API supports SSE/streaming, use it to show partial results as they arrive. Phase 2 could render the summary progressively instead of waiting for the full response.
2. **Reduce context size intelligently** — Current cap is 100KB. Analyze typical diagnosis calls:
   - If most useful signal comes from ERROR/WARN logs, consider a tiered approach: send ERRORs + WARNs first (fast pass), then offer a "Deep Analysis" button that includes INFO context.
   - Pre-filter irrelevant log types (e.g., skip Datadog logs for phone-only issues).
3. **Parallelize Datadog + local log processing** — Currently sequential. Fetch Datadog logs and parse local files concurrently.
4. **Add a progress indicator** — Even without streaming, show "Analyzing X logs across Y sources..." with a spinner. Perceived speed matters.
5. **Implement request cancellation** — Use `AbortController` so users can cancel a slow analysis and adjust parameters.

**Files to touch:**
- `src/services/unleashService.ts` — Streaming support, tiered context
- `src/components/ai/diagnose/DiagnosePhase2.tsx` — Progressive rendering, cancel button
- `src/services/logContextBuilder.ts` — Tiered context strategy

**Estimated complexity:** High (streaming is the biggest lift)

---

## 5. Scalable Right Sidebar

**Problem:** The AI right-side panel needs to be user-resizable rather than fixed-width.

**Current Implementation:**
- `AiPanel.tsx` uses a pop-out mode with `55vw` / `960px` max width.
- `ResizableSplit.tsx` already exists for the Phase 2 left/right pane split — it implements a draggable handle.

**Implementation Plan:**
1. **Reuse `ResizableSplit.tsx` pattern** — Apply the same draggable-handle approach to the main AI sidebar boundary (the edge between the log viewer and the AI panel).
2. **Persist width** — Store user's preferred width in `localStorage` so it survives sessions.
3. **Set min/max bounds** — Min ~300px (enough for readable content), max ~70vw (don't obscure log viewer entirely).
4. **Collapse handle** — Double-click the drag handle to toggle between collapsed (icon-only) and last-used width.

**Files to touch:**
- `src/components/ai/AiPanel.tsx` — Replace fixed width with resizable container
- `src/components/ai/diagnose/ResizableSplit.tsx` — May be reusable as-is or needs minor generalization
- `src/App.tsx` — Adjust layout to support variable-width sidebar

**Estimated complexity:** Low-Medium

---

## 6. Custom Prompt Injection / Template Tool Call

**Problem:** Users need to invoke pre-defined templates via natural language in the AI chat. Example: _"Can you take the evidence we have and conclusions we've drawn and fill out the close template?"_ This should trigger a template-aware response without the user copy-pasting a template.

**Context from transcript:** Enrique to investigate whether this is best handled as (a) a custom prompt injection in source code, (b) a tool call the model can invoke, or (c) a template selector in the AI settings.

**Suggestions & Analysis:**

### Option A: Alias-Based Prompt Injection (Recommended for MVP)
- Maintain a `templates/` registry (JSON or TS map) with named templates:
  ```
  "closure_note" → { trigger: ["close template", "closure note", "fill out the close"], prompt: "Using the evidence collected and conclusions drawn in this diagnosis, fill out the following template:\n\n{TEMPLATE_BODY}" }
  ```
- In `unleashService.ts` → `chatWithLogs()`, scan the user's message for trigger phrases. If matched, inject the template into the system prompt before sending to the LLM.
- **Pros:** Simple, no model tool-use needed, works with any LLM backend.
- **Cons:** Brittle keyword matching, limited to pre-defined triggers.

### Option B: LLM Tool Call (Better long-term)
- Define a `fill_template` tool in the LLM request:
  ```json
  { "name": "fill_template", "description": "Fill out a NOC template using investigation evidence", "parameters": { "template_name": "string (closure_note | jira_escalation | ...)" } }
  ```
- When the model decides to use the tool, the client intercepts, injects the template, and re-sends with template content.
- **Pros:** Model decides when to use it, natural language works broadly.
- **Cons:** Requires Unleashed API to support tool-use / function calling. **Check with Leandro if this is supported.**

### Option C: Template Selector in UI (Complement to A or B)
- Add a dropdown or button bar in Phase 2/Phase 3: `[Closure Note] [Jira Escalation] [Summary Report]`.
- Clicking pre-fills the chat input with the template request.
- **Pros:** Discoverable, no ambiguity. **Cons:** Extra UI surface.

**Recommendation:** Start with **Option A** (keyword-triggered prompt injection) + **Option C** (template buttons in UI) for MVP. Migrate to **Option B** when tool-use is available in the Unleashed API.

**Immediate next step:** Get the closure note template from Danielle (referenced in transcript). Standardize the template format.

**Files to touch:**
- New: `src/templates/nocTemplates.ts` — Template registry
- `src/services/unleashService.ts` — Template injection in `chatWithLogs()` / `diagnoseLogs()`
- `src/components/ai/diagnose/DiagnosePhase2.tsx` — Template button bar in the note editor
- `src/components/ai/diagnose/DiagnosePhase3.tsx` — Template selection before submit

**Estimated complexity:** Medium

---

## 7. Jira API Foundation + UI Mockups

**Problem:** A Jira API token is coming. Need to build the plumbing so we know where the Jira template and closure note will go. Need UI mockups for team consensus.

**Current Implementation:**
- `jiraService.ts` exists with `createJiraTicket()` and `buildAdfDescription()` — creates Bug-type issues with ADF formatting.
- `AiSettingsModal.tsx` has Jira credential fields (subdomain, email, token, project key).
- Phase 3 has a stub for Jira submission but no active "Submit to Jira" flow.

**Implementation Plan:**

### A. Backend Foundation
1. **Validate Jira connection** — Add `testJiraConnection()` in `jiraService.ts` (similar to `validateDatadogCredentials()`). Hit `/rest/api/3/myself` to confirm auth.
2. **Fetch Jira project metadata** — `getJiraIssueTypes()` and `getJiraFields()` so we can dynamically build the creation form based on the project's actual schema.
3. **Template mapping** — Map the NocLense diagnosis output to Jira fields:
   - Summary → Jira Summary
   - Root cause → Jira Description (ADF)
   - Correlated logs → Jira Attachment (ZIP) or embedded table
   - Internal note → Jira Comment
   - Severity → Jira Priority

### B. UI Mockup Locations
The following locations need mockups for team review:

| Location | Mockup Needed |
|----------|--------------|
| **Phase 3 Submit** | Checkbox: "Also submit to Jira" with project/issue-type selector |
| **Phase 3 Success** | Jira ticket link alongside Zendesk ticket link |
| **Phase 2 Note Editor** | "Preview as Jira" button showing ADF-formatted preview |
| **AI Settings Modal** | "Test Jira Connection" button (like Datadog has) |

### C. Closure Note → Jira Mapping
Per transcript discussion: the submit button in Phase 3 should have a "Submit to Jira also" checkbox. When checked:
1. The AI-generated summary + internal note gets formatted into ADF.
2. A Jira ticket is created with the closure note as the description.
3. Log archive ZIP is attached to the Jira ticket.
4. Success screen shows both Zendesk + Jira links.

**Files to touch:**
- `src/services/jiraService.ts` — `testJiraConnection()`, `getJiraIssueTypes()`, template mapping
- `src/components/ai/diagnose/DiagnosePhase3.tsx` — Jira submission checkbox + flow
- `src/components/ai/AiSettingsModal.tsx` — Jira test connection button
- New: `docs/mockups/jira-integration.md` — Wireframes for team review

**Estimated complexity:** Medium-High

---

## 8. Historical Ticket Research (Zendesk + Unleashed)

**Problem:** Can we search past Zendesk tickets to find relevant historical issues? Use customer history for agentic research on previous problems. Goal: make NocLense a comprehensive all-in-one correlation tool.

**Context from transcript:** Enrique raised a concern — going backwards may not work well because historical closure notes aren't standardized. Moving forward with standardized templates (from Danielle) would make this much more effective.

**Current State:**
- `zendeskService.ts` has `fetchZendeskTicket()` for individual tickets but no search/list endpoint.
- Unleashed has Confluence + Zendesk + Slack knowledge base connections.
- Zendesk Search API (`/api/v2/search.json`) supports full-text search across tickets.

**Implementation Plan:**

### A. Zendesk Search Integration
1. **Add `searchZendeskTickets()`** to `zendeskService.ts`:
   - Query: `type:ticket organization:{org} status:closed subject:"{keywords}"`
   - Return: Top 10 matching tickets with subject, status, closure date, assignee.
   - Pagination support for deep searches.
2. **Add `getCustomerHistory()`** — Fetch recent closed tickets for the same organization/requester.

### B. UI: "Similar Tickets" Panel
- In Phase 2, add a collapsible section: **"Previous Related Tickets"**
- Auto-populated after diagnosis: AI extracts keywords (CCS, SIP, station name) → Zendesk search.
- Each result shows: Ticket #, Subject, Closed date, Root cause (if in closure note).
- Click to expand → pulls full ticket + closure note inline.

### C. Agentic Research (Future — after standardized templates)
- Multi-step agent: Query Zendesk → fetch top 3 related tickets → download their logs → cross-reference with current investigation.
- **Concern:** This is expensive (many API calls, large context). Gate behind a "Deep Research" button.
- **Prerequisite:** Standardized closure notes (talk to Danielle).

### D. API Limitations to Investigate
- **Zendesk Search API rate limits:** 10 requests/minute for search endpoints. Need queuing.
- **Unleashed knowledge scope:** Does the Unleashed Zendesk connector index ticket comments and attachments, or just subjects? This determines how deep the AI can search without direct API calls.
- **Data volume:** How many total Zendesk tickets exist? If >10k, pagination and search specificity matter.

**Files to touch:**
- `src/services/zendeskService.ts` — `searchZendeskTickets()`, `getCustomerHistory()`
- `src/components/ai/diagnose/DiagnosePhase2.tsx` — "Similar Tickets" collapsible section
- `src/services/unleashService.ts` — Context enrichment with historical ticket summaries

**Estimated complexity:** High

---

## 9. Additional Read-Only Integrations (Twilio, Homer, etc.)

**Problem:** What other systems can we hook into for read-only data? Twilio? Homer direct API?

**Current State:**
- Homer SIP logs are parsed from uploaded files (`parser.ts` handles Homer SIP format).
- No direct Homer or Twilio API integration — both are file-upload only.

**Brainstorm — Potential Read-Only Integrations:**

| System | Data Available | API? | Value for NOC |
|--------|---------------|------|---------------|
| **Twilio** | Call logs, recordings, SIP trunking events | Yes — REST API with auth token | Call routing correlation, SIP error codes, trunk utilization |
| **Homer** (direct API) | SIP call flow, RTP stats, packet capture metadata | Yes — Homer API v7 (if deployed) | Real-time SIP ladder diagrams, call quality metrics without file export |
| **PagerDuty** | Incident history, on-call schedules | Yes — REST API v2 | Correlate log events with active incidents |
| **Slack** | Channel messages (NOC channels) | Yes — Conversations API | Context from team discussion during incidents |
| **Grafana** | Dashboard snapshots, alert history | Yes — HTTP API | Metric correlation with log events |
| **CCS (Call Control System)** | Call state, station status | Depends on vendor API | Real-time station health, call state validation |

**Recommendation — Priority Order:**
1. **Homer direct API** (if available) — Eliminates manual log export, enables real-time SIP analysis.
2. **Twilio** — Call routing is a common investigation need; REST API is well-documented.
3. **PagerDuty** — Low effort, high context value ("was there an active incident during this call?").
4. **Slack** — Nice-to-have for incident context, but noisy.

**Next step:** Check with Leandro which of these systems have API access available. For each, the pattern is the same: add a `{system}Service.ts`, a proxy route in `vite.config.ts`, and credential fields in `AiSettingsModal.tsx`.

**Estimated complexity:** Medium per integration

---

## 10. Log Correlation Verification

**Problem:** Files are not consistently correlated based on the information given. Need to verify the model IS reading loaded logs and using them to generate notes. Homer logs, CCS logs, and call logs should all be correlated to the investigation when relevant.

**Context from transcript:** Leandro loaded Homer + CCS logs but the AI didn't correlate them. The hooks are in the code but haven't been validated end-to-end.

**Investigation & Fix Plan:**

### A. Correlation Audit
1. **Manual ticket workflow test** — Pick 3 real tickets with known outcomes. For each:
   - Load the same files the agent used.
   - Run diagnosis.
   - Compare AI output to expected correlations.
   - Document: what was correlated, what was missed, why.
2. **Log the full prompt** — Temporarily log the exact payload sent to `diagnoseLogs()` (the formatted context string) to a debug panel or console. Verify that Homer/CCS/Call Log entries are actually present in the context window.

### B. Parser-to-Diagnosis Pipeline Check
- `parser.ts` → `LogContext` → `formatLogsForDiagnosis()` → LLM
- Verify at each stage:
  1. Parser correctly identifies source type and populates fields (callId, stationId, timestamp).
  2. `formatLogsForDiagnosis()` includes all source types (not just Datadog/JSON).
  3. The system prompt instructs the model to cross-reference across sources.

### C. System Prompt Enhancement
- In `unleashService.ts`, the Carbyne system knowledge prompt should explicitly instruct:
  > "You have logs from multiple sources. Cross-reference timestamps, call IDs, station IDs, and correlation IDs across ALL loaded sources (Datadog, Homer SIP, CCS, Call Logs, APEX) to build a complete picture."
- Add source labels to each log section in the formatted context so the model knows which source each log came from.

### D. Verification Method
- Add a "Debug: Show AI Context" toggle (dev-only) in Phase 2 that shows:
  - Total logs sent to model (by source)
  - Context size (KB)
  - Sources included
  - This lets us verify the model has the right inputs.

**Files to touch:**
- `src/services/unleashService.ts` — Enhanced system prompt, debug logging
- `src/utils/parser.ts` — Verify source tagging consistency
- `src/components/ai/diagnose/DiagnosePhase2.tsx` — Debug context viewer (dev mode)

**Estimated complexity:** Medium

---

## 11. Remove Case Button / Simplify Navigation

**Problem:** The "New Case" button is redundant. Users can just clear the workspace and start from the main page (Zendesk lookup).

**Context from transcript:** Leandro: "This button, I feel like we could honestly throw out. We don't need this one." Users just hit "Clear" and go to the investigation setup screen.

**Implementation:**
1. Remove the "New Case" button from the investigation UI.
2. Ensure "Clear Workspace" resets all state (logs, diagnosis, filters, AI context) and returns to the investigation setup / Zendesk lookup screen.
3. Keep the call ID search if it exists — Leandro indicated that might still be useful.

**Files to touch:**
- `src/App.tsx` or `src/components/InvestigationSetupModal.tsx` — Remove case button
- `src/contexts/LogContext.tsx` — Verify `clearAllData()` resets everything cleanly

**Estimated complexity:** Low

---

## 12. Large File Crashes — Backend Offloading (ServerLense)

**Problem:** Files that are too large crash the Electron application. Proposal: use the existing ServerLense architecture to offload heavy processing to a backend server.

**Current State:**
- All processing is client-side (Electron renderer process).
- Files >50MB trigger IndexedDB mode, but even with that, very large files can OOM the renderer.
- `pdfExtractor.ts` and `zipExtractor.ts` use lazy imports to reduce initial bundle.

**Evaluation Needed:**

### A. Cost Analysis
| Component | Self-Hosted (AWS) | Serverless (Vercel/Lambda) |
|-----------|-------------------|---------------------------|
| Compute (log parsing) | t3.medium ~$30/mo | Lambda: ~$0.20/million requests |
| Storage (temp files) | EBS: ~$10/mo | S3: ~$0.023/GB/mo |
| Memory (large file processing) | 4GB RAM | Lambda max 10GB, Vercel max 1GB |
| Data transfer | ~$0.09/GB out | Included in plan |

### B. Components to Move to Backend
1. **File parsing** (`parser.ts`) — CPU-intensive for large files.
2. **PDF extraction** (`pdfExtractor.ts`) — Memory-intensive, can crash renderer.
3. **ZIP extraction** (`zipExtractor.ts`) — Memory-intensive.
4. **AI context building** (`logContextBuilder.ts`) — Could pre-process server-side.
5. **IndexedDB replacement** — Server-side DB (Postgres/SQLite) for persistent log storage.

### C. Architecture Options
- **Option 1: Vercel Serverless Functions** — Already have `vercel.json`. Add API routes for parsing. Limited by 50MB request body and 60s timeout.
- **Option 2: Dedicated Node.js backend** — Fork from ServerLense. Full control, no size limits. Higher ops cost.
- **Option 3: Hybrid** — Keep small files client-side, offload >50MB to backend. Requires file size detection and routing logic.

**Recommendation:** Start with **Option 3 (Hybrid)**. Define a file-size threshold (e.g., 25MB). Below threshold: process client-side as today. Above: upload to a backend endpoint that returns parsed + indexed results. This minimizes infrastructure cost while solving the crash problem.

**Next step:** Review ServerLense codebase for reusable backend parsing logic. Draft a cost justification for Leandro.

**Estimated complexity:** Very High (multi-sprint)

---

## 13. UX Crashes — IndexedDB / Backend DB

**Problem:** Application crashes during use — specifically when navigating, loading large datasets, or during Datadog station discovery. Related to the large file problem but also affects normal-sized workflows.

**Context from transcript:** Leandro: "Sometimes it does it, sometimes it closes. I don't know why." Also: "See like it crashed."

**Investigation Plan:**
1. **Electron crash logs** — Check `%APPDATA%/logscrub/logs/` for renderer crash dumps. Look for OOM (out of memory) or unhandled promise rejections.
2. **Add global error boundary** — Wrap the main `App` component in a React error boundary that catches render crashes, logs the stack trace, and shows a recovery UI instead of a white screen.
3. **Memory profiling** — Use Electron's `process.getHeapStatistics()` to monitor memory usage. Log warnings at 80% heap utilization.
4. **IndexedDB stability** — If IndexedDB transactions are failing silently, logs appear to "disappear." Add transaction error handlers with user-visible toasts.
5. **Investigate the Datadog discovery crash** — The station discovery crash in the demo might be an unhandled rejection in `discoverStationsForCnc()` when the API returns an unexpected response format.

**Quick Wins:**
- Add `window.onerror` and `window.onunhandledrejection` handlers in the Electron renderer to catch and log crashes before the app dies.
- Add try/catch around every `async` call in `DiagnosePhase1.tsx` that hits external APIs.
- Increase Electron renderer memory limit if running near default: `--max-old-space-size=4096`.

**Files to touch:**
- `src/App.tsx` — Error boundary wrapper
- `electron/main.js` — Renderer memory limit, crash logging
- `src/components/ai/diagnose/DiagnosePhase1.tsx` — Defensive error handling on API calls
- `src/services/datadogService.ts` — Graceful handling of unexpected response shapes

**Estimated complexity:** Medium (investigation) + High (backend DB migration if pursued)

---

## Priority Matrix

| # | Item | Severity | Effort | Suggested Order |
|---|------|----------|--------|-----------------|
| 2 | Empty logs in UI | High | Medium | 1st — blocks demo credibility |
| 1 | Datadog station discovery | High | Medium | 2nd — blocks core workflow |
| 13 | UX crashes | High | Medium | 3rd — stability before features |
| 3 | Source filter column | Medium | Low | 4th — likely quick fix |
| 10 | Log correlation verification | High | Medium | 5th — core AI value prop |
| 11 | Remove case button | Low | Low | 6th — quick cleanup |
| 5 | Scalable right sidebar | Medium | Low-Med | 7th — UX improvement |
| 6 | Custom prompt / templates | Medium | Medium | 8th — needs Danielle's template |
| 7 | Jira API foundation | Medium | Med-High | 9th — waiting on API token |
| 4 | AI analysis speed | Medium | High | 10th — optimization pass |
| 8 | Historical ticket research | Medium | High | 11th — ambitious, needs standardized templates |
| 9 | Additional integrations | Low | Medium/ea | 12th — after core is solid |
| 12 | Backend offloading | High | Very High | 13th — requires cost justification + multi-sprint |

---

## Dependencies & Blockers

- **Jira API token** — Waiting on Leandro to provision. Blocks item #7.
- **Danielle's closure note template** — Needed for items #6 and #8. Enrique to request.
- **New .env file** — Leandro sent an updated .env. Must be deployed to dev + server.
- **ServerLense codebase access** — Needed to evaluate item #12.
- **Unleashed API tool-use support** — Determines approach for item #6 (Option A vs B).
- **Homer / Twilio API access** — Leandro to confirm availability for item #9.

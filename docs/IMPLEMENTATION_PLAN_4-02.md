# NocLense — Large File Stability & Deployment Prep

**Date:** 2026-04-02
**Author:** Claude Code (Opus 4.6) + Enrique
**Branch:** `beta`
**Target deployment:** Week of 2026-04-07

---

## Background

NocLense processes VoIP/SIP log files that routinely exceed 50 MB (Datadog CSV exports, Homer SIP captures, APEX system logs). An audit of the parser (`src/utils/parser.ts`) and IndexedDB manager (`src/utils/indexedDB.ts`) revealed several stability bottlenecks that cause OOM crashes, UI freezes, and degraded search performance at scale.

The **long-term solution** is a dedicated backend server (`noclense-server`) for offloading parse and search to server-side workers. That project exists (`midwestman35/noclense-server`) but resources have not yet been approved. Until then, the server mode UI is being **hidden** from the next deployment to avoid user confusion — all service code is preserved for re-introduction.

This plan addresses the **short-term client-side fixes** to keep the tool stable for 50 MB+ files.

---

## Audit Findings

| # | Problem | Severity | Location |
|---|---------|----------|----------|
| 1 | **O(n²) payload string concatenation** — `+=` on multi-line payloads | HIGH | `parser.ts:664, 678, 910, 923` |
| 2 | **CSV files bypass IDB streaming** — loaded fully into memory regardless of size | HIGH | `parser.ts:967` (`!isCSV` guard) |
| 3 | **Browser parse path blocks main thread** — 10-50 MB files parsed on UI thread | HIGH | `parser.ts` (no Web Worker for browser) |
| 4 | **No text search index** — trigram index (Phase 4 of prior plan) never shipped | HIGH | `indexedDB.ts` still DB_VERSION=3 |
| 5 | **IDB batch writes have no retry** — 1000-log transactions can timeout on slow machines | MEDIUM | `indexedDB.ts:addLogsBatch()` |
| 6 | **Server mode UI exposed but server not approved** — confuses users | UX | `IconRail.tsx`, `InvestigationPanels.tsx` |

---

## Phase 1 — Fix O(n²) Payload Concatenation

**Effort:** ~2 hours | **Risk:** Low | **Impact:** HIGH

### Problem
Four call sites in `parser.ts` use `currentLog.payload += "\n" + line` to accumulate multi-line log payloads. In JavaScript, `+=` on strings creates a new string instance each time, making this O(n²) for logs with hundreds of continuation lines (common in JSON/SIP payloads).

### Solution
Replace all 4 sites with a `string[]` accumulator pattern:
```typescript
// Before (O(n²))
currentLog.payload += (currentLog.payload ? "\n" : "") + line;

// After (O(n))
payloadLines.push(line);
// ... at log boundary:
currentLog.payload = payloadLines.join("\n");
payloadLines = [];
```

### Files Changed
- `src/utils/parser.ts` — 4 call sites (~lines 664, 678, 910, 923)

---

## Phase 2 — CSV Streaming via Papa Parse

**Effort:** ~1-2 days | **Risk:** Medium | **Impact:** HIGH

### Problem
`parseLogFile()` at line 967 gates IDB streaming with `!isCSV`, meaning CSV files (the most common Datadog export format) are always loaded fully into memory. A 100 MB CSV export will OOM the renderer process.

### Solution
Install [Papa Parse](https://www.papaparse.com/) (~30 KB) and implement a streaming CSV-to-IDB path:
- Papa Parse's `step` callback receives one row at a time
- Accumulate rows into 1000-log batches, same as the text parser
- Write batches via `dbManager.addLogsBatch()`
- Remove the `!isCSV` guard so CSV files >50 MB use IDB streaming

### Files Changed
- `package.json` — add `papaparse` dependency
- `src/utils/parser.ts` — new `parseCSVStreamingToIndexedDB()` function, update routing logic
- `src/utils/csvParser.ts` — (new) streaming CSV adapter wrapping Papa Parse

### Why Papa Parse
- Battle-tested streaming CSV parser with chunk callbacks
- Handles edge cases: quoted fields, multiline cells, BOM, different delimiters
- Web Worker support built-in (future enhancement)
- ~30 KB gzipped, no transitive dependencies

---

## Phase 3 — Web Worker for Browser Parse Path

**Effort:** ~1 day | **Risk:** Low-Medium | **Impact:** HIGH

### Problem
The Electron build uses `logParserWorker.js` (Worker Thread) for parsing, but the browser/Vite dev path runs `parseLogFileStreaming()` on the main thread. Files in the 10-50 MB range (below IDB threshold but still large) freeze the UI for seconds.

### Solution
Create a Web Worker that mirrors the Electron worker pattern:
- Worker receives file chunks via `postMessage`
- Parses lines, sends batches back to main thread
- Main thread stores results (in-memory or IDB depending on size)
- Vite handles Web Worker bundling natively via `new Worker(new URL(...), { type: 'module' })`

### Files Changed
- `src/workers/parseWorker.ts` — (new) Web Worker entry point
- `src/utils/parser.ts` — add `parseLogFileViaWorker()` that delegates to the worker
- `src/App.tsx` — use worker path for browser builds

---

## Phase 4 — Ship Trigram Search Index (DB V4)

**Effort:** ~2-3 days | **Risk:** Medium | **Impact:** HIGH

### Problem
Text search in IDB mode loads all matching records into memory, then scans with `.includes()`. For 100k+ logs with multi-KB payloads, this is extremely slow and memory-intensive. The trigram index design from the prior plan was never implemented.

### Solution
Bump `DB_VERSION` to 4, add a `search_index` object store, and implement:
- `buildTrigramIndex()` — scans all logs, builds trigram→logIds map, writes to IDB
- `searchByTrigram(query)` — intersects trigram posting lists for fast candidate lookup
- `getLogsByIds(ids)` — batch fetch by primary key

Wire into `LogContext.tsx` IDB filter effect: for text queries >= 3 chars, use trigram fast-path; fall back to cursor scan otherwise.

### Design Constants
- `MAX_TRIGRAM_IDS = 25,000` per trigram (saturated trigrams skipped in intersection)
- Index built in background after `enableIndexedDBMode()`
- `searchByTrigram` returns `null` (not `[]`) when index isn't ready — caller falls back

### Files Changed
- `src/utils/indexedDB.ts` — DB_VERSION=4, `search_index` store, trigram methods
- `src/contexts/LogContext.tsx` — trigram fast-path in IDB filter effect
- `src/App.tsx` — call `buildTrigramIndex()` after enabling IDB mode

---

## Phase 5 — IDB Batch Write Retry + Smaller Chunks

**Effort:** ~half day | **Risk:** Low | **Impact:** MEDIUM

### Problem
`addLogsBatch()` writes 1000 logs per transaction with no timeout handling or retry. On slower machines or when the browser is under memory pressure, transactions can abort silently, losing an entire batch.

### Solution
- Split 1000-log batches into 500-log sub-batches
- Wrap each sub-batch in try/catch
- On `AbortError` or timeout, retry once with a 100ms delay
- Log failed batches to console with count for debugging
- Update `parseLogFileStreamingToIndexedDB` to use new batch size

### Files Changed
- `src/utils/indexedDB.ts` — `addLogsBatch()` retry logic, configurable batch size
- `src/utils/parser.ts` — update `BATCH_SIZE` constant from 1000 to 500

---

## Phase 6 — Hide Server Mode UI

**Effort:** ~1 hour | **Risk:** None | **Impact:** UX cleanup

### Problem
The server mode UI (toggle, URL config, test connection) is visible in the left icon rail but the backend server has not been approved for deployment. Users see a non-functional feature.

### Solution
**Hide** the server mode panel from the UI while **preserving all code** for re-introduction:
- Remove `'server'` entry from `IconRail.tsx` panel definitions
- Remove `server:` title from `AppLayout.tsx` panel title map
- Remove `server:` content from `InvestigationPanels.tsx` panel renderer
- Add `// REMOVED-FOR-DEPLOY: server mode UI hidden — re-add when noclense-server is approved` comments at each removal point
- Leave `ServerSettingsPanel.tsx`, `serverService.ts`, and all LogContext server state **untouched**

### Files Changed
- `src/components/layout/IconRail.tsx` — remove server panel entry
- `src/components/layout/AppLayout.tsx` — remove server panel title
- `src/components/layout/InvestigationPanels.tsx` — remove server panel content
- `src/App.tsx` — skip server mode in file upload path (guard with `false &&` or remove conditional)

### Re-introduction
To bring server mode back:
1. Search codebase for `REMOVED-FOR-DEPLOY`
2. Restore the 3-4 removed lines
3. Verify `noclense-server` health endpoint is reachable
4. Test upload-and-parse flow end-to-end

---

## Execution Order & Dependencies

```
Phase 1 (payload concat)     ← no dependencies, standalone
Phase 2 (CSV streaming)      ← no dependencies, standalone
Phase 3 (Web Worker)         ← no dependencies, standalone
Phase 4 (trigram index)      ← depends on Phase 5 (batch retry) for reliability
Phase 5 (batch retry)        ← no dependencies, standalone
Phase 6 (hide server mode)   ← no dependencies, standalone
```

Phases 1, 2, 3, 5, and 6 are independent and can be implemented in parallel.
Phase 4 should follow Phase 5 since the trigram index builder uses batch writes.

---

## Rollback Plan

Each phase is a discrete, self-contained change. If any phase causes regressions:
- Revert the specific commit(s) for that phase
- Other phases remain unaffected
- Server mode can be restored by searching for `REMOVED-FOR-DEPLOY` comments

---

## Success Criteria

- [ ] 50 MB+ text log files import without OOM
- [ ] 50 MB+ CSV files (Datadog exports) import without OOM
- [ ] UI remains responsive during 10-50 MB file imports
- [ ] Text search on 100k+ IDB logs completes in <2 seconds
- [ ] No "Server Mode" visible in navigation for this deployment
- [ ] TypeScript builds cleanly (`tsc --noEmit` passes)

# Memory Analysis: 740MB File Crash

## Problem Summary
Chrome crashes with "out of memory" when uploading 740MB of log files. This is **both a Chrome limitation AND code inefficiency**.

## Root Causes

### 1. **Full File Accumulation** (Critical Issue)
**Location**: `src/utils/parser.ts:252-274` (`readFileInChunks`)

Despite reading in chunks, the function accumulates the **entire file** into a single string:
```typescript
let fullText = '';
// ... reads chunks ...
fullText += chunkText;  // Accumulates entire 740MB file
return fullText;  // Returns 740MB+ string
```

**Memory Impact**: 
- 740MB file → ~740MB string (UTF-16 encoding can double this to ~1.5GB)
- This happens **before** any parsing occurs

### 2. **All Logs Parsed into Memory**
**Location**: `src/utils/parser.ts:308-470`

Every log line creates a `LogEntry` object with multiple string properties:
- `message`, `displayMessage`, `component`, `displayComponent`
- `payload` (can be large for SIP messages)
- Pre-computed lowercase strings (`_messageLower`, `_componentLower`, etc.)

**Memory Impact**:
- 740MB file ≈ millions of log entries
- Each entry: ~500 bytes - 5KB (depending on payload)
- **Total**: Potentially 500MB - 5GB+ of parsed objects

### 3. **Multiple Array Copies**
**Location**: `src/components/FileUploader.tsx:62,70`

```typescript
allParsedLogs.push(...parsed);  // Spread operator creates copy
const mergedLogs = [...logs, ...allParsedLogs];  // Another copy
```

**Memory Impact**: Temporary 2x memory usage during merge

### 4. **All Data in React State**
**Location**: `src/contexts/LogContext.tsx:102`

All parsed logs stored in `useState<LogEntry[]>([])`, meaning:
- Everything stays in memory
- No pagination or lazy loading
- Virtual scrolling displays only visible rows, but all data is still in memory

## Chrome Memory Limits

- **Per-tab limit**: ~2-4GB (varies by system)
- **32-bit Chrome**: ~2GB
- **64-bit Chrome**: ~4GB (can be higher on systems with more RAM)

## Current Memory Usage Estimate (740MB file)

1. **File text in memory**: ~740MB - 1.5GB
2. **Parsed LogEntry objects**: ~500MB - 5GB
3. **React state overhead**: ~50-100MB
4. **Browser overhead**: ~200-500MB
5. **Total**: **~1.5GB - 7GB+** (exceeds Chrome limits)

## Solutions (Priority Order)

### Immediate Fixes (High Priority)

1. **Implement True Streaming Parser**
   - Process chunks line-by-line without accumulating full text
   - Parse and emit LogEntry objects as chunks are processed
   - Discard processed text immediately

2. **Add Memory Limit Checks**
   - Warn users before parsing files >200MB
   - Hard limit at ~500MB with option to proceed
   - Estimate memory usage before parsing

3. **Optimize Array Operations**
   - Use `Array.concat()` instead of spread operators for large arrays
   - Process files sequentially instead of accumulating all

### Medium-Term Solutions

4. **Implement Log Limit/Truncation**
   - Option to parse only first N lines
   - Option to parse only filtered subset (by date range, component, etc.)
   - Skip parsing payloads for non-SIP logs

5. **Use IndexedDB for Large Datasets**
   - Store parsed logs in IndexedDB instead of memory
   - Load logs on-demand as user scrolls
   - Implement pagination at storage level

6. **Lazy Payload Loading**
   - Don't parse payloads until user expands log row
   - Store payload offsets instead of full payload strings

### Long-Term Solutions

7. **Server-Side Processing**
   - Upload files to server for parsing
   - Stream results back to client
   - Only load visible/filtered logs

8. **Web Workers**
   - Move parsing to Web Worker thread
   - Prevents blocking main thread
   - Better memory isolation

## Recommended Immediate Action

**For 740MB files, recommend:**
1. Split file into smaller chunks (<200MB each)
2. Process files sequentially
3. Clear previous logs before loading new large file
4. Use filters to reduce memory footprint

## Code Changes Needed

1. Refactor `readFileInChunks` to process incrementally
2. Implement streaming parser that doesn't accumulate full text
3. Add memory estimation and warnings
4. Optimize array operations for large datasets

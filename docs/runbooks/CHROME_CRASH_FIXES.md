# Chrome Crash Fixes - Large File Upload

## Critical Issues Causing Chrome Crashes

### 🔴 CRITICAL: File Reading Issues

#### 1. Loading Entire File into Memory
**Location**: `src/utils/parser.ts:109`
```typescript
const text = await file.text(); // ⚠️ Loads ENTIRE file into memory
```

**Problem**:
- For a 100MB file, this loads 100MB+ into memory as a string
- Creates memory pressure that can crash Chrome
- No chunking or streaming - all or nothing

**Impact**: Chrome OOM (Out of Memory) killer terminates tab for files >50-100MB

---

#### 2. Splitting Entire File into Array
**Location**: `src/utils/parser.ts:117`
```typescript
const lines = text.split(/\r?\n/); // ⚠️ Creates array with potentially 100k+ entries
```

**Problem**:
- Doubles memory usage (original string + array of strings)
- For 100MB file with 100k lines = ~200MB memory
- Each line string has overhead

**Impact**: Memory exhaustion, Chrome crash

---

#### 3. Synchronous Parsing Loop
**Location**: `src/utils/parser.ts:129-207`
```typescript
for (let line of lines) {
    // Synchronous processing of potentially 100k+ lines
    // Blocks main thread for 30+ seconds
}
```

**Problem**:
- Blocks main thread for extended periods (30+ seconds for large files)
- Chrome thinks tab is frozen
- No way to yield control back to browser
- User can't interact, Chrome kills the tab

**Impact**: Tab appears frozen, Chrome kills it after timeout

---

#### 4. Massive Array Creation During Merge
**Location**: `src/components/FileUploader.tsx:58`
```typescript
const mergedLogs = [...logs, ...allParsedLogs].sort((a, b) => a.timestamp - b.timestamp);
```

**Problem**:
- Creates new array with ALL logs (existing + new)
- For 50k existing + 50k new = 100k element array
- Sorting 100k elements is expensive (O(n log n))
- All happens synchronously

**Impact**: Memory spike + blocking operation = crash

---

#### 5. Spread Operator on Large Arrays
**Location**: `src/components/FileUploader.tsx:45`
```typescript
let maxId = Math.max(0, ...logs.map(l => l.id)); // ⚠️ Can hit call stack limit
```

**Problem**:
- Spread operator `...` has call stack limits
- With 50k+ logs, this can throw "Maximum call stack size exceeded"
- Causes immediate crash

**Impact**: Immediate crash on file upload with existing large dataset

---

## Solutions to Prevent Crashes

### ✅ Solution 1: Chunked File Reading (Critical)

**Replace**: `file.text()` (loads all at once)

**With**: Streaming/chunked reading that yields control:

```typescript
async function* readFileChunks(file: File, chunkSize = 1024 * 1024): AsyncGenerator<string> {
    const fileSize = file.size;
    let offset = 0;
    
    while (offset < fileSize) {
        const chunk = file.slice(offset, offset + chunkSize);
        const text = await chunk.text();
        yield text;
        offset += chunkSize;
        
        // Yield control back to browser
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}
```

**Impact**: 
- Processes file in 1MB chunks
- Yields control between chunks
- Prevents memory exhaustion
- Keeps UI responsive

---

### ✅ Solution 2: Web Worker for Parsing (Critical)

**Move parsing to Web Worker** to keep main thread responsive:

```typescript
// parser.worker.ts
self.onmessage = async (e) => {
    const { fileData, startId, fileColor } = e.data;
    const parsed = parseLogFileInWorker(fileData, fileColor, startId);
    self.postMessage({ parsed, done: true });
};

// Main thread
const worker = new Worker('parser.worker.ts');
worker.postMessage({ fileData, startId, fileColor });
worker.onmessage = (e) => {
    // Update state incrementally
    setLogs(prev => [...prev, ...e.data.parsed]);
};
```

**Impact**:
- Parsing happens off main thread
- UI stays responsive
- Browser won't kill tab
- Can handle files 10x larger

---

### ✅ Solution 3: Incremental State Updates

**Replace**: Loading everything, then setting state once

**With**: Progressive updates with batching:

```typescript
const BATCH_SIZE = 1000; // Process 1000 logs at a time

for (let i = 0; i < parsedLogs.length; i += BATCH_SIZE) {
    const batch = parsedLogs.slice(i, i + BATCH_SIZE);
    setLogs(prev => [...prev, ...batch]);
    
    // Yield control every batch
    await new Promise(resolve => setTimeout(resolve, 0));
}
```

**Impact**:
- Prevents massive state update
- UI updates progressively
- Memory usage spread over time
- User sees progress

---

### ✅ Solution 4: Streaming Parser

**Replace**: Parse all lines, then return array

**With**: Generator that yields logs as they're parsed:

```typescript
async function* parseLogFileStreaming(file: File): AsyncGenerator<LogEntry> {
    // Read file in chunks
    // Parse lines as they come in
    // Yield each log entry immediately
    // Yield control periodically
}
```

**Impact**:
- Processes file incrementally
- Memory usage stays constant
- Can handle files of any size
- Progress updates possible

---

### ✅ Solution 5: Fix Spread Operator Issue

**Replace**: 
```typescript
Math.max(0, ...logs.map(l => l.id))
```

**With**:
```typescript
const maxId = logs.length > 0 
    ? Math.max(...logs.reduce((max, log) => Math.max(max, log.id), 0), 0)
    : 0;
```

**Or better**:
```typescript
const maxId = logs.reduce((max, log) => Math.max(max, log.id), 0);
```

**Impact**: No call stack limit issues

---

### ✅ Solution 6: Incremental Merge & Sort

**Replace**: Create massive array, sort all at once

**With**: Use efficient merge of pre-sorted arrays:

```typescript
// Both arrays should already be sorted
function mergeSortedLogs(existing: LogEntry[], newLogs: LogEntry[]): LogEntry[] {
    const merged: LogEntry[] = [];
    let i = 0, j = 0;
    
    while (i < existing.length && j < newLogs.length) {
        if (existing[i].timestamp <= newLogs[j].timestamp) {
            merged.push(existing[i++]);
        } else {
            merged.push(newLogs[j++]);
        }
    }
    
    // Add remaining
    while (i < existing.length) merged.push(existing[i++]);
    while (j < newLogs.length) merged.push(newLogs[j++]);
    
    return merged;
}
```

**Impact**:
- O(n) merge instead of O(n log n) sort
- Lower memory peak
- Faster for large datasets

---

## Priority Fixes for Chrome Crashes

### 🔴 CRITICAL (Fix First - Prevents Crashes)

1. **Chunked File Reading** (Solution 1)
   - Prevents loading entire file into memory
   - Keeps browser responsive
   - **Time**: 2-3 hours

2. **Web Worker for Parsing** (Solution 2)
   - Moves heavy computation off main thread
   - Prevents tab freezing/crash
   - **Time**: 4-6 hours

3. **Fix Spread Operator** (Solution 5)
   - Prevents immediate crash on large datasets
   - Quick fix, high impact
   - **Time**: 10 minutes

### 🟡 HIGH PRIORITY (Fixes Performance)

4. **Incremental State Updates** (Solution 3)
   - Prevents massive memory spikes
   - Better user experience
   - **Time**: 2-3 hours

5. **Incremental Merge** (Solution 6)
   - Faster merging for large datasets
   - Lower memory usage
   - **Time**: 1-2 hours

### 🟢 NICE TO HAVE (Optimization)

6. **Streaming Parser** (Solution 4)
   - Ultimate solution for very large files
   - Most complex to implement
   - **Time**: 6-8 hours

---

## Implementation Plan

### Phase 1: Immediate Crash Fixes (2-4 hours)
**Goal**: Prevent Chrome crashes on large files

1. Fix spread operator issue (10 min)
2. Add chunked file reading (2-3 hours)
3. Add progress indicators (30 min)

**Result**: Can handle 50-100MB files without crashing

---

### Phase 2: Off-Main-Thread Processing (4-6 hours)
**Goal**: Keep UI responsive during parsing

1. Implement Web Worker for parsing
2. Move heavy computations to worker
3. Add incremental updates

**Result**: Can handle 200MB+ files, UI stays responsive

---

### Phase 3: Advanced Optimizations (6-8 hours)
**Goal**: Handle files of any size

1. Implement streaming parser
2. Progressive state updates
3. Memory management (clear old logs if needed)

**Result**: Can handle 500MB+ files without issues

---

## Expected Results

### Before Fixes
- ❌ Crashes on files >50MB
- ❌ Tab freezes for 30+ seconds
- ❌ Chrome kills tab ("Page Unresponsive")
- ❌ Memory usage spikes to 500MB+ for 100MB file

### After Phase 1 (Quick Fixes)
- ✅ Handles files up to 100MB
- ✅ UI stays responsive (chunked reading)
- ✅ No spread operator crashes
- ✅ Memory usage: ~200-300MB for 100MB file

### After Phase 2 (Web Worker)
- ✅ Handles files up to 200MB+
- ✅ UI always responsive (parsing off main thread)
- ✅ Progress indicators work
- ✅ Memory usage: ~150-250MB for 100MB file

### After Phase 3 (Streaming)
- ✅ Handles files of any size (500MB+)
- ✅ Memory usage stays constant
- ✅ Can process multiple files simultaneously
- ✅ Memory usage: ~100-150MB regardless of file size

---

## Will the Previous Refactoring Help?

**YES!** The performance refactoring will:
- ✅ Reduce memory usage (memoization, better data structures)
- ✅ Speed up filtering (less re-renders)
- ✅ Reduce CPU usage (optimized algorithms)

**BUT** it won't fix:
- ❌ Main thread blocking during parsing
- ❌ Memory exhaustion from loading entire files
- ❌ Tab freezing during file processing

**Conclusion**: Need BOTH:
1. **Performance refactoring** (from PERFORMANCE_ANALYSIS.md) - fixes runtime performance
2. **Chrome crash fixes** (this document) - prevents crashes on upload

Together, they solve both problems completely.

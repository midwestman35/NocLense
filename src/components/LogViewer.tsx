import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogContext } from '../contexts/LogContext';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useAnimeStagger } from '../utils/anime';
import type { LogEntry } from '../types';
import LogRow from './LogRow';
import LogTabs from './LogTabs';
import ParseOverlay from './ParseOverlay';
import { LogHeader, TimeWindowStrip } from './LogStreamHeader';
import { CitationJumpChip, type CitationJumpSource } from './workspace/CitationJumpChip';

// Phase 05 Commit 2 — how long data-citation-just-arrived stays on the
// viewport element; the CSS pulse animation in src/styles/citation-jump.css
// runs for 200ms, we clear the attribute shortly after to reset state.
const CITATION_PULSE_MS = 250;

const HIGHLIGHT_CLEAR_MS = 4000;

interface ViewItem {
  firstLog: LogEntry;
  count: number;
  logs: LogEntry[];
}

interface LogViewerProps {
  parseProgress?: number | null;
}

export interface LogViewerHandle {
  jumpToCitation: (fileName: string, byteOffset: number) => void;
}

interface PendingJump {
  entryId: number;
  fileName: string;
}

function buildViewItems(logs: LogEntry[], collapseSimilar: boolean): ViewItem[] {
  if (!collapseSimilar) {
    return logs.map((log) => ({ firstLog: log, count: 1, logs: [log] }));
  }

  const groups: ViewItem[] = [];
  const keyOf = (log: LogEntry) => `${log.displayComponent}\u0000${log.summaryMessage ?? log.displayMessage}`;

  for (const log of logs) {
    const current = groups[groups.length - 1];
    if (current && keyOf(current.firstLog) === keyOf(log)) {
      current.logs.push(log);
      current.count = current.logs.length;
      continue;
    }
    groups.push({ firstLog: log, count: 1, logs: [log] });
  }

  return groups;
}

const LogViewer = forwardRef<LogViewerHandle, LogViewerProps>(function LogViewer(
  { parseProgress = null },
  ref,
) {
  const {
    logs,
    filteredLogs,
    selectedLogId,
    setSelectedLogId,
    isTextWrapEnabled,
    setVisibleRange,
    filterText,
    favoriteLogIds,
    toggleFavorite,
    aiHighlightedLogIds,
    hoveredCorrelation,
    useIndexedDBMode,
    loadLogsFromIndexedDB,
    visibleRange,
    isCollapseSimilarEnabled,
    activeCorrelations,
    toggleCorrelation,
    scrollTargetTimestamp,
    sortConfig,
  } = useLogContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  const parentRef = useRef<HTMLDivElement>(null);
  const highlightChipRef = useRef<HTMLDivElement>(null);
  const visibleRangeTimeoutRef = useRef<number | null>(null);
  const pendingRangeRef = useRef<{ start: number; end: number } | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [pendingJump, setPendingJump] = useState<PendingJump | null>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null);
  // Phase 05 Commit 2 — source of the most recent citation jump. Drives
  // the CitationJumpChip label. Today we default to { label: 'Diagnose' }
  // because the AI citation plumb-through does not yet pass hypothesis
  // rank; richer source info lands in a follow-up phase.
  const [citationJumpSource, setCitationJumpSource] = useState<CitationJumpSource | null>(null);

  const fileTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      if (!log.fileName) continue;
      counts.set(log.fileName, (counts.get(log.fileName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([fileName, count]) => ({ fileName, count }))
      .sort((left, right) => left.fileName.localeCompare(right.fileName));
  }, [logs]);

  const tabsVisible = logs.length > 0 && fileTabs.length >= 2;
  const tabFilteredLogs = useMemo(
    () => (activeTab ? filteredLogs.filter((entry) => entry.fileName === activeTab) : filteredLogs),
    [activeTab, filteredLogs],
  );
  const viewItems = useMemo(
    () => buildViewItems(tabFilteredLogs, isCollapseSimilarEnabled),
    [isCollapseSimilarEnabled, tabFilteredLogs],
  );

  useEffect(() => {
    if (!tabsVisible) {
      setActiveTab(null);
      return;
    }
    if (activeTab && !fileTabs.some((tab) => tab.fileName === activeTab)) {
      setActiveTab(null);
    }
  }, [activeTab, fileTabs, tabsVisible]);

  const estimateSize = useCallback(() => (isTextWrapEnabled ? 72 : 48), [isTextWrapEnabled]);

  const updateVisibleRange = useCallback((start: number, end: number) => {
    pendingRangeRef.current = { start, end };
    if (visibleRangeTimeoutRef.current !== null) {
      window.clearTimeout(visibleRangeTimeoutRef.current);
    }
    visibleRangeTimeoutRef.current = window.setTimeout(() => {
      if (pendingRangeRef.current) {
        setVisibleRange(pendingRangeRef.current);
        pendingRangeRef.current = null;
      }
      visibleRangeTimeoutRef.current = null;
    }, 100);
  }, [setVisibleRange]);

  // TanStack Virtual returns imperative methods that the React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: viewItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    measureElement: (element) => element?.getBoundingClientRect().height || estimateSize(),
    onChange: (instance) => {
      if (!instance.range) return;
      const { startIndex, endIndex } = instance.range;
      const startLog = viewItems[startIndex]?.firstLog;
      const endLog = viewItems[endIndex]?.firstLog;
      if (startLog && endLog) {
        updateVisibleRange(
          Math.min(startLog.timestamp, endLog.timestamp),
          Math.max(startLog.timestamp, endLog.timestamp),
        );
      }
    },
  });

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedEntryId(null);
    setCitationJumpSource(null);
  }, []);

  const setHighlightWithTimeout = useCallback((entryId: number) => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedEntryId(entryId);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedEntryId(null);
      highlightTimeoutRef.current = null;
    }, HIGHLIGHT_CLEAR_MS);
  }, []);

  useImperativeHandle(ref, () => ({
    jumpToCitation(fileName: string, byteOffset: number): void {
      const targetEntry = logs.find((entry) => entry.fileName === fileName && entry.byteOffset === byteOffset);
      if (!targetEntry) return;

      if (tabsVisible && activeTab !== fileName) {
        setActiveTab(fileName);
      }
      setPendingJump({ entryId: targetEntry.id, fileName });
    },
  }), [activeTab, logs, tabsVisible]);

  useEffect(() => () => {
    if (visibleRangeTimeoutRef.current !== null) {
      window.clearTimeout(visibleRangeTimeoutRef.current);
    }
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [activeTab, expandedIds, rowVirtualizer, viewItems.length]);

  useEffect(() => {
    if (!useIndexedDBMode || !visibleRange || (visibleRange.start === 0 && visibleRange.end === 1)) return;

    const loadVisibleLogs = async () => {
      try {
        await loadLogsFromIndexedDB({
          timestampRange: { start: visibleRange.start, end: visibleRange.end },
          limit: 5000,
        });
      } catch (error) {
        console.error('Failed to load visible logs from IndexedDB:', error);
      }
    };

    if (visibleRange.end > visibleRange.start && visibleRange.start > 0) {
      void loadVisibleLogs();
    }
  }, [loadLogsFromIndexedDB, useIndexedDBMode, visibleRange]);

  useEffect(() => {
    if (!selectedLogId || !parentRef.current) return;
    const index = viewItems.findIndex((item) => item.logs.some((log) => log.id === selectedLogId));
    if (index !== -1) {
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
    }
  }, [selectedLogId, viewItems, rowVirtualizer]);

  useEffect(() => {
    if (scrollTargetTimestamp === null || viewItems.length === 0) return;
    const index = sortConfig.direction === 'asc'
      ? viewItems.findIndex((item) => item.firstLog.timestamp >= scrollTargetTimestamp)
      : viewItems.findIndex((item) => item.firstLog.timestamp <= scrollTargetTimestamp);
    if (index !== -1) {
      rowVirtualizer.scrollToIndex(index, { align: 'start' });
      return;
    }
    rowVirtualizer.scrollToIndex(viewItems.length - 1, { align: 'end' });
  }, [rowVirtualizer, scrollTargetTimestamp, sortConfig.direction, viewItems]);

  useEffect(() => {
    if (!pendingJump) return;
    if (tabsVisible && activeTab !== pendingJump.fileName) return;

    const index = viewItems.findIndex((item) => item.logs.some((log) => log.id === pendingJump.entryId));
    if (index === -1) {
      setPendingJump(null);
      return;
    }

    const targetLog = viewItems[index].logs.find((log) => log.id === pendingJump.entryId) ?? viewItems[index].firstLog;
    rowVirtualizer.scrollToIndex(index, {
      align: 'center',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    setSelectedLogId(targetLog.id);
    setHighlightWithTimeout(targetLog.id);
    // Phase 05 Commit 2 — default source. Future plumbing can pass
    // a richer source object (with hypothesisRank) through pendingJump.
    setCitationJumpSource({ label: 'Diagnose' });

    // Phase 05 Commit 2 — fire the container pulse via data attribute.
    // The CSS animation in src/styles/citation-jump.css runs for 200ms
    // against [data-citation-just-arrived="true"]; we toggle it off a
    // bit later (250ms) so repeat jumps can re-trigger it cleanly.
    const scrollEl = parentRef.current;
    if (scrollEl && !prefersReducedMotion) {
      scrollEl.setAttribute('data-citation-just-arrived', 'true');
      window.setTimeout(() => {
        scrollEl.removeAttribute('data-citation-just-arrived');
      }, CITATION_PULSE_MS);
    }

    if (
      targetLog.traceId &&
      !activeCorrelations.some((item) => item.type === 'traceId' && !item.excluded && item.value === targetLog.traceId)
    ) {
      toggleCorrelation({ type: 'traceId', value: targetLog.traceId });
    }

    setPendingJump(null);
  }, [
    activeCorrelations,
    activeTab,
    pendingJump,
    prefersReducedMotion,
    rowVirtualizer,
    setHighlightWithTimeout,
    setSelectedLogId,
    tabsVisible,
    toggleCorrelation,
    viewItems,
  ]);

  useAnimeStagger(
    highlightChipRef,
    '[data-citation-chip]',
    prefersReducedMotion ? [] : [highlightedEntryId],
    {
      translateY: [-4, 0],
      opacity: [0, 1],
      stagger: 40,
      duration: 250,
    },
  );

  const toggleExpanded = useCallback((logId: number) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-full w-full flex-grow flex-col overflow-hidden bg-[var(--workspace)]">
      <TimeWindowStrip />
      <LogHeader />
      <div ref={highlightChipRef} className="shrink-0 bg-[var(--card)]">
        {highlightedEntryId !== null && (
          <div className="px-3 pt-2">
            <CitationJumpChip
              source={citationJumpSource}
              onDismiss={clearHighlight}
            />
          </div>
        )}
      </div>
      <ParseOverlay progress={parseProgress} />
      <LogTabs
        items={fileTabs}
        activeTab={activeTab}
        allCount={filteredLogs.length}
        onSelect={setActiveTab}
      />
      <div
        ref={parentRef}
        data-log-viewer-scroll
        data-log-viewer-rows={viewItems.length}
        data-surface="log-stream"
        className="relative flex-grow overflow-y-auto"
      >
        {viewItems.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--muted-foreground)]">
            No logs to display
          </div>
        ) : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = viewItems[virtualRow.index];
              const log = item.firstLog;
              return (
                <LogRow
                  key={item.count > 1 ? `group-${log.id}-${virtualRow.index}` : log.id}
                  log={log}
                  active={item.logs.some((entry) => entry.id === selectedLogId)}
                  collapseCount={item.count > 1 ? item.count : undefined}
                  isExpanded={expandedIds.has(log.id)}
                  isCitationTarget={item.logs.some((entry) => entry.id === highlightedEntryId)}
                  isHighlighted={
                    hoveredCorrelation?.type === 'file' ? log.fileName === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'callId' ? log.callId === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'report' ? log.reportId === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'operator' ? log.operatorId === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'extension' ? log.extensionId === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'station' ? log.stationId === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'cncID' ? log.cncID === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'messageID' ? log.messageID === hoveredCorrelation.value
                    : hoveredCorrelation?.type === 'traceId' ? log.traceId === hoveredCorrelation.value
                    : false
                  }
                  onClick={(entry) => setSelectedLogId(entry.id === selectedLogId ? null : entry.id)}
                  onToggleExpanded={toggleExpanded}
                  measureRef={rowVirtualizer.measureElement}
                  index={virtualRow.index}
                  isTextWrap={isTextWrapEnabled}
                  filterText={filterText}
                  isFavorite={favoriteLogIds.has(log.id)}
                  onToggleFavorite={() => toggleFavorite(log.id)}
                  isAiHighlighted={aiHighlightedLogIds.has(log.id)}
                  style={{
                    left: 0,
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: '100%',
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default LogViewer;

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogContext } from '../contexts/LogContext';
import LogRow from './LogRow';
import { ArrowUp, ArrowDown, Filter, ChevronRight, ChevronDown } from 'lucide-react';
import AIButton from './AIButton';
import serviceMappings from '../../public/service-mappings.json';

const LogHeader = () => {
  const { sortConfig, setSortConfig, selectedComponentFilter, setSelectedComponentFilter, logs } = useLogContext();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);

  const availableComponents = useMemo(() => {
    const components = new Set(logs.map((l) => l.displayComponent));
    if (showAllServices) {
      Object.values(serviceMappings).forEach((value) => components.add(value));
    }
    return Array.from(components).sort();
  }, [logs, showAllServices]);

  const toggleSort = (field: 'timestamp' | 'level') => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  return (
    <div className="log-grid bg-[var(--card)] border-b border-[var(--border)] text-[11px] font-medium text-[var(--muted-foreground)] h-8 px-2 sticky top-0 z-10 items-center">
      <div className="text-center">#</div>
      <div className="flex items-center gap-1 cursor-pointer hover:text-[var(--foreground)] transition-colors" onClick={() => toggleSort('timestamp')}>
        Timestamp
        {sortConfig.field === 'timestamp' && (sortConfig.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <span>Type</span>
        <div className="relative">
          <span className="flex items-center gap-1 cursor-pointer hover:text-[var(--foreground)] transition-colors" onClick={() => setIsFilterOpen(!isFilterOpen)}>
            Service
            <Filter size={10} className={selectedComponentFilter ? 'text-[var(--foreground)]' : ''} />
          </span>
          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--card)] border border-[var(--border)] z-30 p-1.5 shadow-[var(--shadow-md)]">
                <label className="flex items-center gap-2 text-[11px] text-[var(--foreground)] mb-1.5 pb-1.5 border-b border-[var(--border)] cursor-pointer px-1.5">
                  <input type="checkbox" checked={showAllServices} onChange={() => setShowAllServices(!showAllServices)} />
                  Show All
                </label>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <div className={`px-1.5 py-1 cursor-pointer text-[11px] ${!selectedComponentFilter ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'hover:bg-[var(--muted)] text-[var(--muted-foreground)]'}`} onClick={() => { setSelectedComponentFilter(null); setIsFilterOpen(false); }}>
                    All Services
                  </div>
                  {availableComponents.map((comp) => (
                    <div key={comp} className={`px-1.5 py-1 cursor-pointer text-[11px] ${selectedComponentFilter === comp ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'hover:bg-[var(--muted)] text-[var(--muted-foreground)]'}`} onClick={() => { setSelectedComponentFilter(comp); setIsFilterOpen(false); }}>
                      {comp}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <span className="flex items-center gap-1 cursor-pointer hover:text-[var(--foreground)] transition-colors" onClick={() => toggleSort('level')}>
          Lvl
          {sortConfig.field === 'level' && (sortConfig.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
        </span>
        <span>Message</span>
      </div>
    </div>
  );
};

function TimeWindowStrip() {
  const {
    filteredLogs,
    availableMessageTypes,
    selectedMessageTypeFilter,
    setSelectedMessageTypeFilter,
    visibleRange,
    setScrollTargetTimestamp,
  } = useLogContext();
  const [isOpen, setIsOpen] = useState(false);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of filteredLogs) {
      if (!log.messageType) continue;
      counts.set(log.messageType, (counts.get(log.messageType) ?? 0) + 1);
    }
    return counts;
  }, [filteredLogs]);

  const rangeLabel = useMemo(() => {
    if (!visibleRange || visibleRange.start === 0 || visibleRange.end === 1) return 'Full dataset';
    return `${new Date(visibleRange.start).toLocaleTimeString()} - ${new Date(visibleRange.end).toLocaleTimeString()}`;
  }, [visibleRange]);

  return (
    <div className="border-b border-[var(--border)] bg-[var(--card)] shrink-0">
      <div className="flex items-center gap-3 h-9 px-3 text-xs">
        <button type="button" onClick={() => setIsOpen((prev) => !prev)} className="flex items-center gap-1 text-[var(--foreground)]">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Time-window investigation
        </button>
        <span className="text-[var(--muted-foreground)]">{filteredLogs.length.toLocaleString()} events</span>
        <span className="text-[var(--muted-foreground)]">{rangeLabel}</span>
        <div className="ml-auto">
          <AIButton variant="secondary" size="sm" logs={filteredLogs} promptType="analyze" label="Analyze visible" />
        </div>
      </div>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)] bg-[var(--workspace)]">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" onClick={() => setScrollTargetTimestamp(visibleRange.start || null)}>
              Jump to range start
            </button>
            <button type="button" className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" onClick={() => setSelectedMessageTypeFilter(null)}>
              Full dataset
            </button>
            {availableMessageTypes.slice(0, 8).map((type) => {
              const active = selectedMessageTypeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMessageTypeFilter(active ? null : type)}
                  className={`rounded border px-2 py-1 ${active ? 'border-[var(--ring)] text-[var(--foreground)] bg-[var(--muted)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                >
                  {type} ({typeCounts.get(type) ?? 0})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const LogViewer = () => {
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
    hoveredCorrelation,
    useIndexedDBMode,
    loadLogsFromIndexedDB,
    visibleRange,
    isCollapseSimilarEnabled,
    collapsedViewList,
  } = useLogContext();
  const parentRef = useRef<HTMLDivElement>(null);
  const visibleRangeTimeoutRef = useRef<number | null>(null);
  const pendingRangeRef = useRef<{ start: number; end: number } | null>(null);

  const estimateSize = () => (isTextWrapEnabled ? 60 : 35);

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


  const viewItems = useMemo(() => {
    if (collapsedViewList && collapsedViewList.length > 0) {
      return collapsedViewList;
    }
    return filteredLogs.map((log) => ({ firstLog: log, count: 1 }));
  }, [collapsedViewList, filteredLogs]);

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
        requestAnimationFrame(() => {
          updateVisibleRange(Math.min(startLog.timestamp, endLog.timestamp), Math.max(startLog.timestamp, endLog.timestamp));
        });
      }
    },
  });

  useEffect(() => () => {
    if (visibleRangeTimeoutRef.current !== null) {
      window.clearTimeout(visibleRangeTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (selectedLogId && parentRef.current) {
      const index = viewItems.findIndex((item) => item.firstLog.id === selectedLogId);
      if (index !== -1) {
        rowVirtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }, [selectedLogId, viewItems, rowVirtualizer]);

  const { scrollTargetTimestamp, sortConfig } = useLogContext();
  useEffect(() => {
    if (scrollTargetTimestamp !== null && viewItems.length > 0) {
      const target = scrollTargetTimestamp;
      const index = sortConfig.direction === 'asc'
        ? viewItems.findIndex((item) => item.firstLog.timestamp >= target)
        : viewItems.findIndex((item) => item.firstLog.timestamp <= target);
      if (index !== -1) {
        rowVirtualizer.scrollToIndex(index, { align: 'start' });
      } else {
        rowVirtualizer.scrollToIndex(viewItems.length - 1, { align: 'end' });
      }
    }
  }, [rowVirtualizer, scrollTargetTimestamp, sortConfig.direction, viewItems]);

  return (
    <div className="flex-grow flex flex-col h-full w-full bg-[var(--workspace)] overflow-hidden">
      <TimeWindowStrip />
      <LogHeader />
      <div ref={parentRef} className="flex-grow w-full overflow-y-auto relative">
        {viewItems.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
            No logs to display
          </div>
        ) : (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const { firstLog: log, count } = viewItems[virtualRow.index];
              return (
                <LogRow
                  key={isCollapseSimilarEnabled && count > 1 ? `group-${log.id}-${virtualRow.index}` : log.id}
                  log={log}
                  active={log.id === selectedLogId}
                  collapseCount={count > 1 ? count : undefined}
                  isHighlighted={
                    hoveredCorrelation?.type === 'file' ? log.fileName === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'callId' ? log.callId === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'report' ? log.reportId === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'operator' ? log.operatorId === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'extension' ? log.extensionId === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'station' ? log.stationId === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'cncID' ? log.cncID === hoveredCorrelation.value :
                    hoveredCorrelation?.type === 'messageID' ? log.messageID === hoveredCorrelation.value : false
                  }
                  onClick={(l) => setSelectedLogId(l.id === selectedLogId ? null : l.id)}
                  measureRef={rowVirtualizer.measureElement}
                  index={virtualRow.index}
                  isTextWrap={isTextWrapEnabled}
                  filterText={filteredLogs !== logs ? filterText : ''}
                  isFavorite={favoriteLogIds.has(log.id)}
                  onToggleFavorite={() => toggleFavorite(log.id)}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;


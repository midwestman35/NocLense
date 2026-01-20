import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLogContext } from '../contexts/LogContext';
import LogRow from './LogRow';
import { ArrowUp, ArrowDown, Filter } from 'lucide-react';
import serviceMappings from '../../public/service-mappings.json';

const LogHeader = () => {
    const {
        sortConfig,
        setSortConfig,
        selectedComponentFilter,
        setSelectedComponentFilter,
        logs
    } = useLogContext();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [showAllServices, setShowAllServices] = useState(false);

    // Get unique components from current logs
    const availableComponents = useMemo(() => {
        const components = new Set(logs.map(l => l.displayComponent));
        // If "Show All" is checked, merge with service-mappings
        if (showAllServices) {
            Object.values(serviceMappings).forEach(v => components.add(v));
        }
        return Array.from(components).sort();
    }, [logs, showAllServices]);

    const toggleSort = (field: 'timestamp' | 'level') => {
        setSortConfig({
            field,
            direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc'
        });
    };

    return (
        <div className="log-grid bg-slate-800 border-b border-slate-700 text-xs font-semibold text-slate-400 py-2 px-2 sticky top-0 z-10 shadow-sm items-center">
            <div className="text-center">#</div>

            {/* Timestamp Header */}
            <div
                className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('timestamp')}
            >
                Timestamp
                {sortConfig.field === 'timestamp' && (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                )}
            </div>

            <div
                className="flex items-center justify-center gap-1 cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('level')}
            >
                Lvl
                {sortConfig.field === 'level' && (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                )}
            </div>

            {/* Component Header with Filter */}
            <div className="relative">
                <div
                    className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                    Service
                    <Filter size={12} className={selectedComponentFilter ? "text-blue-400" : ""} />
                </div>

                {isFilterOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-20"
                            onClick={() => setIsFilterOpen(false)}
                        ></div>
                        <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-600 rounded-md shadow-xl z-30 p-2">
                            <label className="flex items-center gap-2 text-xs text-slate-300 mb-2 pb-2 border-b border-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showAllServices}
                                    onChange={() => setShowAllServices(!showAllServices)}
                                />
                                Show All Options
                            </label>

                            <div className="max-h-48 overflow-y-auto space-y-1">
                                <div
                                    className={`px-2 py-1 rounded cursor-pointer ${!selectedComponentFilter ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                                    onClick={() => { setSelectedComponentFilter(null); setIsFilterOpen(false); }}
                                >
                                    All Services
                                </div>
                                {availableComponents.map(comp => (
                                    <div
                                        key={comp}
                                        className={`px-2 py-1 rounded cursor-pointer ${selectedComponentFilter === comp ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                                        onClick={() => { setSelectedComponentFilter(comp); setIsFilterOpen(false); }}
                                    >
                                        {comp}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div>Message</div>
        </div>
    );
};

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
        visibleRange
    } = useLogContext();
    const parentRef = useRef<HTMLDivElement>(null);
    // Phase 2 Optimization: Debounce timeline updates to reduce re-renders
    const visibleRangeTimeoutRef = useRef<number | null>(null);
    const pendingRangeRef = useRef<{ start: number; end: number } | null>(null);

    // Dynamic row height estimation based on text wrap setting
    const estimateSize = () => isTextWrapEnabled ? 60 : 35;

    // Phase 2 Optimization: Debounced update for visible range
    const updateVisibleRange = useCallback((start: number, end: number) => {
        pendingRangeRef.current = { start, end };
        
        // Clear existing timeout
        if (visibleRangeTimeoutRef.current !== null) {
            window.clearTimeout(visibleRangeTimeoutRef.current);
        }
        
        // Debounce the update - only update after scrolling stops for 100ms
        visibleRangeTimeoutRef.current = window.setTimeout(() => {
            if (pendingRangeRef.current) {
                setVisibleRange(pendingRangeRef.current);
                pendingRangeRef.current = null;
            }
            visibleRangeTimeoutRef.current = null;
        }, 100);
    }, [setVisibleRange]);

    // Lazy load logs from IndexedDB when visible range changes (for IndexedDB mode)
    useEffect(() => {
        if (!useIndexedDBMode || !visibleRange || (visibleRange.start === 0 && visibleRange.end === 1)) return;
        
        const loadVisibleLogs = async () => {
            try {
                // Load logs in the visible timestamp range
                // Note: This is a placeholder - the actual loading is handled by the filter effect in LogContext
                // This could be used for more aggressive lazy loading in the future
                await loadLogsFromIndexedDB({
                    timestampRange: {
                        start: visibleRange.start,
                        end: visibleRange.end
                    },
                    limit: 5000 // Load up to 5000 logs in visible range
                });
            } catch (error) {
                console.error('Failed to load visible logs from IndexedDB:', error);
            }
        };
        
        // Only load if range is meaningful (not initial state)
        if (visibleRange.end > visibleRange.start && visibleRange.start > 0) {
            loadVisibleLogs();
        }
    }, [useIndexedDBMode, visibleRange, loadLogsFromIndexedDB]);

    const rowVirtualizer = useVirtualizer({
        count: filteredLogs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: estimateSize,
        overscan: 5,
        measureElement: (element) => element?.getBoundingClientRect().height || estimateSize(),
        onChange: (instance) => {
            if (!instance.range) return;
            const { startIndex, endIndex } = instance.range;
            // Map indices to timestamps
            const startLog = filteredLogs[startIndex];
            const endLog = filteredLogs[endIndex];

            if (startLog && endLog) {
                // Phase 2 Optimization: Use debounced update instead of immediate setVisibleRange
                // In Descending sort, startLog timestamp might be later than endLog
                // We want visibleRange to be [minTS, maxTS] for TimelineScrubber
                requestAnimationFrame(() => {
                    updateVisibleRange(
                        Math.min(startLog.timestamp, endLog.timestamp),
                        Math.max(startLog.timestamp, endLog.timestamp)
                    );
                });
            }
        }
    });

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (visibleRangeTimeoutRef.current !== null) {
                window.clearTimeout(visibleRangeTimeoutRef.current);
            }
        };
    }, []);

    // Scroll to selected log if initiated externally
    useEffect(() => {
        if (selectedLogId && parentRef.current) {
            const index = filteredLogs.findIndex(l => l.id === selectedLogId);
            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'center' });
            }
        }
    }, [selectedLogId, filteredLogs, rowVirtualizer]);

    // Handle timeline scrubbing
    const { scrollTargetTimestamp, sortConfig } = useLogContext();
    useEffect(() => {
        if (scrollTargetTimestamp !== null && filteredLogs.length > 0) {
            const target = scrollTargetTimestamp;
            let index;

            if (sortConfig.direction === 'asc') {
                index = filteredLogs.findIndex(l => l.timestamp >= target);
            } else {
                index = filteredLogs.findIndex(l => l.timestamp <= target);
            }

            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'start' });
            } else {
                rowVirtualizer.scrollToIndex(filteredLogs.length - 1, { align: 'end' });
            }
        }
    }, [scrollTargetTimestamp, filteredLogs, rowVirtualizer, sortConfig.direction]);

    return (
        <div className="flex-grow flex flex-col h-full w-full bg-slate-900 overflow-hidden">
            <LogHeader />

            <div
                ref={parentRef}
                className="flex-grow w-full overflow-y-auto relative"
            >
                {filteredLogs.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                        No logs to display
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const log = filteredLogs[virtualRow.index];
                            return (
                                <LogRow
                                    key={log.id}
                                    log={log}
                                    active={log.id === selectedLogId}
                                    isHighlighted={
                                        hoveredCorrelation?.type === 'file' ? log.fileName === hoveredCorrelation.value :
                                            hoveredCorrelation?.type === 'callId' ? log.callId === hoveredCorrelation.value :
                                                hoveredCorrelation?.type === 'report' ? log.reportId === hoveredCorrelation.value :
                                                    hoveredCorrelation?.type === 'operator' ? log.operatorId === hoveredCorrelation.value :
                                                        hoveredCorrelation?.type === 'extension' ? log.extensionId === hoveredCorrelation.value :
                                                            hoveredCorrelation?.type === 'station' ? log.stationId === hoveredCorrelation.value :
                                                                false
                                    }
                                    onClick={(l) => setSelectedLogId(l.id === selectedLogId ? null : l.id)}
                                    measureRef={rowVirtualizer.measureElement}
                                    index={virtualRow.index}
                                    isTextWrap={isTextWrapEnabled}
                                    filterText={filteredLogs !== logs ? filterText : ''}
                                    isFavorite={favoriteLogIds.has(log.id)}
                                    onToggleFavorite={() => toggleFavorite(log.id)}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
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

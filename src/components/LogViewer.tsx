import { useRef, useEffect, useState, useMemo } from 'react';
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

    const toggleSort = (field: 'timestamp') => {
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

            <div className="text-center">Lvl</div>

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
    const { logs, filteredLogs, selectedLogId, setSelectedLogId, isTextWrapEnabled, setVisibleRange, filterText, favoriteLogIds, toggleFavorite } = useLogContext();
    const parentRef = useRef<HTMLDivElement>(null);

    // Dynamic row height estimation based on text wrap setting
    const estimateSize = () => isTextWrapEnabled ? 60 : 35;

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
            if (filteredLogs[startIndex] && filteredLogs[endIndex]) {
                // Avoid updating state during render
                requestAnimationFrame(() => {
                    setVisibleRange({
                        start: filteredLogs[startIndex].timestamp,
                        end: filteredLogs[endIndex].timestamp
                    });
                });
            }
        }
    });

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
    const { scrollTargetTimestamp } = useLogContext();
    useEffect(() => {
        if (scrollTargetTimestamp !== null && filteredLogs.length > 0) {
            // Find closest log index using binary search (assuming sorted by timestamp)
            // If not sorted by timestamp, fallback to linear search or rely on current sort

            // Simple linear approximate (findIndex is O(N))
            const target = scrollTargetTimestamp;
            // Find first log with timestamp >= target
            const index = filteredLogs.findIndex(l => l.timestamp >= target);

            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'start' });
            } else {
                // Scrolled past end?
                rowVirtualizer.scrollToIndex(filteredLogs.length - 1, { align: 'end' });
            }
        }
    }, [scrollTargetTimestamp, filteredLogs, rowVirtualizer]);

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

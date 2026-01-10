import { createContext, useContext, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import type { LogEntry, LogState } from '../types';
import { loadSearchHistory, addToSearchHistory as saveToHistory, clearSearchHistory as clearHistoryStorage } from '../store/searchHistory';

export interface CorrelationItem {
    type: 'report' | 'operator' | 'extension' | 'station' | 'callId' | 'file';
    value: string;
    excluded?: boolean;
}

interface LogContextType extends LogState {
    setLogs: (logs: LogEntry[]) => void;
    setLoading: (loading: boolean) => void;
    parsingProgress: number; // Progress from 0 to 1
    setParsingProgress: (progress: number) => void;
    setFilterText: (text: string) => void;
    isSipFilterEnabled: boolean;
    setIsSipFilterEnabled: (enabled: boolean) => void;
    // Deprecated alias aliases kept for compatibility if needed, otherwise removed
    smartFilterActive: boolean;
    setSmartFilterActive: (active: boolean) => void;

    setSelectedLogId: (id: number | null) => void;
    searchHistory: string[];
    addToSearchHistory: (term: string) => void;
    clearSearchHistory: () => void;
    clearAllFilters: () => void;

    // New View Options
    isTextWrapEnabled: boolean;
    setIsTextWrapEnabled: (enabled: boolean) => void;
    sortConfig: { field: 'timestamp' | 'level', direction: 'asc' | 'desc' };
    setSortConfig: (config: { field: 'timestamp' | 'level', direction: 'asc' | 'desc' }) => void;
    selectedComponentFilter: string | null;
    setSelectedComponentFilter: (component: string | null) => void;

    // Timeline States
    visibleRange: { start: number; end: number };
    setVisibleRange: (range: { start: number; end: number }) => void;
    scrollTargetTimestamp: number | null;
    setScrollTargetTimestamp: (timestamp: number | null) => void;
    timelineViewMode: 'full' | 'filtered';
    setTimelineViewMode: (mode: 'full' | 'filtered') => void;
    isTimelineCompact: boolean;
    setIsTimelineCompact: (isCompact: boolean) => void;

    // Correlation
    activeCorrelations: CorrelationItem[];
    setActiveCorrelations: (items: CorrelationItem[]) => void;
    toggleCorrelation: (item: CorrelationItem) => void;
    setOnlyCorrelation: (item: CorrelationItem) => void;
    correlationCounts: Record<string, number>;

    timelineZoomRange: { start: number; end: number } | null;
    setTimelineZoomRange: (range: { start: number; end: number } | null) => void;
    timelineEventFilters: { requests: boolean; success: boolean; provisional: boolean; error: boolean; options: boolean; keepAlive: boolean };
    setTimelineEventFilters: (filters: { requests: boolean; success: boolean; provisional: boolean; error: boolean; options: boolean; keepAlive: boolean }) => void;
    hoveredCallId: string | null;
    setHoveredCallId: (id: string | null) => void;

    // Navigation (Jump To)
    jumpState: { active: boolean; previousFilters: any | null };
    setJumpState: (state: { active: boolean; previousFilters: any | null }) => void;

    hoveredCorrelation: CorrelationItem | null;
    setHoveredCorrelation: (item: CorrelationItem | null) => void;

    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    isTimelineOpen: boolean;
    setIsTimelineOpen: (isOpen: boolean) => void;

    activeCallFlowId: string | null;
    setActiveCallFlowId: (id: string | null) => void;
    correlationData: {
        reportIds: string[];
        operatorIds: string[];
        extensionIds: string[];
        stationIds: string[];
        callIds: string[];
        fileNames: string[];
    };
    // Favorites
    favoriteLogIds: Set<number>;
    toggleFavorite: (logId: number) => void;
    isShowFavoritesOnly: boolean;
    setIsShowFavoritesOnly: (show: boolean) => void;
}

const LogContext = createContext<LogContextType | null>(null);

export const useLogContext = () => {
    const context = useContext(LogContext);
    if (!context) {
        throw new Error('useLogContext must be used within a LogProvider');
    }
    return context;
};

export const LogProvider = ({ children }: { children: ReactNode }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [parsingProgress, setParsingProgress] = useState<number>(0); // Progress from 0 to 1
    const [filterText, setFilterText] = useState('');
    const [isSipFilterEnabled, setIsSipFilterEnabled] = useState(false);
    const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    // Load search history on mount
    useEffect(() => {
        setSearchHistory(loadSearchHistory());
    }, []);

    // New State for View Options
    const [isTextWrapEnabled, setIsTextWrapEnabled] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ field: 'timestamp' | 'level', direction: 'asc' | 'desc' }>({ field: 'timestamp', direction: 'asc' });
    const [selectedComponentFilter, setSelectedComponentFilter] = useState<string | null>(null);
    const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 1 });
    const [scrollTargetTimestamp, setScrollTargetTimestamp] = useState<number | null>(null);
    const [timelineViewMode, setTimelineViewMode] = useState<'full' | 'filtered'>('filtered');

    // Reset zoom when switching between Full/Filtered modes to prevent "blank" timeline issues
    useEffect(() => {
        setTimelineZoomRange(null);
    }, [timelineViewMode]);
    const [isTimelineCompact, setIsTimelineCompact] = useState(false);
    const [timelineZoomRange, setTimelineZoomRange] = useState<{ start: number; end: number } | null>(null);
    const [timelineEventFilters, setTimelineEventFilters] = useState({ requests: true, success: true, provisional: true, error: true, options: true, keepAlive: true });
    const [hoveredCallId, setHoveredCallId] = useState<string | null>(null);
    const [jumpState, setJumpState] = useState<{ active: boolean; previousFilters: any | null }>({ active: false, previousFilters: null });
    const [hoveredCorrelation, setHoveredCorrelation] = useState<CorrelationItem | null>(null);

    // Correlation State
    const [activeCorrelations, setActiveCorrelations] = useState<CorrelationItem[]>([]);
    const [activeCallFlowId, setActiveCallFlowId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isTimelineOpen, setIsTimelineOpen] = useState(true);

    // Favorites State
    const [favoriteLogIds, setFavoriteLogIds] = useState<Set<number>>(new Set());
    const [isShowFavoritesOnly, setIsShowFavoritesOnly] = useState(false);

    // Phase 2 Optimization: Wrap event handlers in useCallback to prevent unnecessary re-renders
    const toggleCorrelation = useCallback((item: CorrelationItem) => {
        setActiveCorrelations(prev => {
            const exists = prev.some(i => i.type === item.type && i.value === item.value);
            if (exists) {
                return prev.filter(i => !(i.type === item.type && i.value === item.value));
            } else {
                return [...prev, item];
            }
        });
    }, []);

    const setOnlyCorrelation = useCallback((item: CorrelationItem) => {
        setActiveCorrelations([item]);
    }, []);

    // Favorites Functions
    const toggleFavorite = useCallback((logId: number) => {
        setFavoriteLogIds(prev => {
            const next = new Set(prev);
            if (next.has(logId)) {
                next.delete(logId);
            } else {
                next.add(logId);
            }
            return next;
        });
    }, []);

    // Load favorites from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('noclense-favorites');
        if (stored) {
            try {
                const ids = JSON.parse(stored) as number[];
                setFavoriteLogIds(new Set(ids));
            } catch (e) {
                console.error('Failed to load favorites:', e);
            }
        }
    }, []);

    // Save favorites to localStorage when they change
    useEffect(() => {
        localStorage.setItem('noclense-favorites', JSON.stringify(Array.from(favoriteLogIds)));
    }, [favoriteLogIds]);

    // Clear favorites when logs are cleared
    useEffect(() => {
        if (logs.length === 0) {
            setFavoriteLogIds(new Set());
        }
    }, [logs.length]);


    // Computed unique IDs and Counts for Sidebar
    const { correlationData, correlationCounts } = useMemo(() => {
        // 1. Determine local source logs based on "File" filters ONLY
        // This ensures the lists (Call IDs, etc.) show valid options for the selected files.
        const activeFileFilters = activeCorrelations.filter(c => c.type === 'file');
        const sourceLogs = activeFileFilters.length > 0
            ? logs.filter(log => activeFileFilters.some(f => f.value === log.fileName))
            : logs;

        const reportIds = new Set<string>();
        const operatorIds = new Set<string>();
        const extensionIds = new Set<string>();
        const stationIds = new Set<string>();
        const callIds = new Set<string>();
        const fileNames = new Set<string>();

        const counts: Record<string, number> = {};

        const increment = (type: string, value: string) => {
            const key = `${type}:${value}`;
            counts[key] = (counts[key] || 0) + 1;
        };

        // Note: For counts, we might want global counts or filtered counts. 
        // User asked "if you only have 1 file toggled just have all the call ids... from that log".
        // This implies the COUNT should also reflect that file.

        sourceLogs.forEach(log => {
            if (log.reportId) { reportIds.add(log.reportId); increment('report', log.reportId); }
            if (log.operatorId) { operatorIds.add(log.operatorId); increment('operator', log.operatorId); }
            if (log.extensionId) { extensionIds.add(log.extensionId); increment('extension', log.extensionId); }
            if (log.stationId) { stationIds.add(log.stationId); increment('station', log.stationId); }
            if (log.callId) { callIds.add(log.callId); increment('callId', log.callId); }
            if (log.fileName) { fileNames.add(log.fileName); increment('file', log.fileName); }
        });

        // Also ensure all available files are listed from the raw logs, but counts might be affected?
        // Actually, if we filter usage by File A, the count for File B is 0 in this view?
        // Standard behavior: List options from the *context*. If File A is selected, we only see File A stuff.
        // But for the "Files" list itself, we usually want to see ALL files to switch.
        // So `fileNames` should probably come from ALL logs.
        if (activeFileFilters.length > 0) {
            logs.forEach(log => {
                if (log.fileName) {
                    fileNames.add(log.fileName);
                    // We need a separate count for files independent of the filter?
                    // Let's stick to the mapped counts for now.
                }
            });
            // Re-calc file counts from ALL logs so user sees what they *could* select?
            // Simple approach: Counts reflect the current view. If filtered by File A, count for File B is hidden or 0.
            // Actually, for the File list specifically, we want valid counts for all files.
            logs.forEach(log => {
                if (log.fileName) {
                    // We need to NOT overwrite the "increment" logic if we want consistency.
                    // A cleaner way for Facets is: Counts are "hits if this filter were applied" (expensive) or "hits in current result".
                    // Let's stick to "hits in current filtered set" for metadata, but "All available" for Files list?
                    // Currently I used `sourceLogs` (filtered by file). 
                    // This means File B won't be in `sourceLogs`.
                    // So we must manually add File B to the list.
                }
            });
        }

        // Re-populate fileNames from ALL logs strictly for the list
        const allFiles = new Set<string>();
        logs.forEach(l => { if (l.fileName) allFiles.add(l.fileName); });

        // Recalculate File counts strictly based on Global logs? Or based on other filters?
        // Let's keep it simple: Correlation Data assumes context of Selected Files.
        // Exception: The File List itself needs to show all files.

        return {
            correlationData: {
                reportIds: Array.from(reportIds).sort(),
                operatorIds: Array.from(operatorIds).sort(),
                extensionIds: Array.from(extensionIds).sort(),
                stationIds: Array.from(stationIds).sort(),
                callIds: Array.from(callIds).sort(),
                fileNames: Array.from(allFiles).sort()
            },
            correlationCounts: counts // Note: Counts for non-selected files will be 0 or missing in this object.
        };
    }, [logs, activeCorrelations]);

    // Phase 2 Optimization: Pre-compute correlation indexes and lowercase filter text outside the filter loop
    const correlationIndexes = useMemo(() => {
        if (activeCorrelations.length === 0) return { inclusions: {}, exclusions: {} };
        
        const inclusions: Record<string, Set<string>> = {};
        const exclusions: Record<string, Set<string>> = {};
        
        activeCorrelations.forEach(c => {
            const target = c.excluded ? exclusions : inclusions;
            if (!target[c.type]) target[c.type] = new Set();
            target[c.type].add(c.value);
        });
        
        return { inclusions, exclusions };
    }, [activeCorrelations]);

    // Phase 2 Optimization: Pre-compute lowercase filter text once
    const lowerFilterText = useMemo(() => filterText.toLowerCase(), [filterText]);

    // Computed filtered logs - Phase 2 Optimized
    const filteredLogs = useMemo(() => {
        if (!logs.length) return [];

        const { inclusions, exclusions } = correlationIndexes;
        const hasCorrelationFilters = Object.keys(inclusions).length > 0 || Object.keys(exclusions).length > 0;

        let result = logs.filter(log => {
            // If this is the selected log, always include it so the viewer can sync to it
            if (selectedLogId !== null && log.id === selectedLogId) return true;

            // Correlation Filter (Facetted Logic: AND between types, OR within type)
            // Phase 2: Use pre-computed indexes instead of building them inside the loop
            if (hasCorrelationFilters) {
                // 1. Handle Inclusions (AND between types, OR within type)
                for (const type in inclusions) {
                    const values = inclusions[type];
                    let match = false;
                    switch (type) {
                        case 'report': match = !!log.reportId && values.has(log.reportId); break;
                        case 'operator': match = !!log.operatorId && values.has(log.operatorId); break;
                        case 'extension': match = !!log.extensionId && values.has(log.extensionId); break;
                        case 'station': match = !!log.stationId && values.has(log.stationId); break;
                        case 'callId': match = !!log.callId && values.has(log.callId); break;
                        case 'file': match = !!log.fileName && values.has(log.fileName); break;
                    }
                    if (!match) return false;
                }

                // 2. Handle Exclusions (Always AND NOT)
                for (const type in exclusions) {
                    const values = exclusions[type];
                    let matchExclude = false;
                    switch (type) {
                        case 'report': matchExclude = !!log.reportId && values.has(log.reportId); break;
                        case 'operator': matchExclude = !!log.operatorId && values.has(log.operatorId); break;
                        case 'extension': matchExclude = !!log.extensionId && values.has(log.extensionId); break;
                        case 'station': matchExclude = !!log.stationId && values.has(log.stationId); break;
                        case 'callId': matchExclude = !!log.callId && values.has(log.callId); break;
                        case 'file': matchExclude = !!log.fileName && values.has(log.fileName); break;
                    }
                    if (matchExclude) return false; // Fail if any excluded value matches
                }
            }

            // Component Filter
            if (selectedComponentFilter && log.displayComponent !== selectedComponentFilter) {
                return false;
            }

            // SIP Filter (Show Only SIP)
            if (isSipFilterEnabled && !log.isSip) return false;

            // Phase 2 Optimization: Use pre-computed lowercase strings from parsing for O(1) string operations
            // This eliminates toLowerCase() calls during filtering (major performance win for 100k+ logs)
            if (lowerFilterText) {
                const matchContent =
                    (log._messageLower && log._messageLower.includes(lowerFilterText)) ||
                    (log._payloadLower && log._payloadLower.includes(lowerFilterText)) ||
                    (log._componentLower && log._componentLower.includes(lowerFilterText)) ||
                    (log._callIdLower && log._callIdLower.includes(lowerFilterText));

                if (!matchContent) return false;
            }

            return true;
        });


        // Favorites filter (applied last)
        if (isShowFavoritesOnly) {
            result = result.filter(log => favoriteLogIds.has(log.id));
        }

        // Sorting
        result.sort((a, b) => {
            if (sortConfig.field === 'timestamp') {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            } else if (sortConfig.field === 'level') {
                const levels = { ERROR: 3, WARN: 2, INFO: 1, DEBUG: 0 };
                const valA = levels[a.level] || 0;
                const valB = levels[b.level] || 0;
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });

        return result;
    }, [logs, selectedLogId, correlationIndexes, selectedComponentFilter, isSipFilterEnabled, lowerFilterText, sortConfig, isShowFavoritesOnly, favoriteLogIds]);

    // Phase 2 Optimization: Wrap event handlers in useCallback
    const addToSearchHistory = useCallback((term: string) => {
        saveToHistory(term);
        setSearchHistory(loadSearchHistory());
    }, []);

    const clearSearchHistory = useCallback(() => {
        clearHistoryStorage();
        setSearchHistory([]);
    }, []);

    // Phase 2 Optimization: Wrap clearAllFilters in useCallback
    const clearAllFilters = useCallback(() => {
        setFilterText('');
        setIsSipFilterEnabled(false);
        setSelectedComponentFilter(null);
        setActiveCorrelations([]);
        setSelectedLogId(null);
        setIsShowFavoritesOnly(false);
    }, []);

    // Phase 2 Optimization: Memoize context value to prevent unnecessary re-renders
    // This is critical - without memoization, the entire value object is recreated on every render
    // causing all consuming components to re-render unnecessarily
    // Note: Setters from useState are stable and don't need to be in dependencies
    // Callbacks wrapped in useCallback are also stable
    const value = useMemo(() => ({
        logs,
        setLogs,
        loading,
        setLoading,
        parsingProgress,
        setParsingProgress,
        filterText,
        setFilterText,
        isSipFilterEnabled,
        setIsSipFilterEnabled,
        smartFilterActive: isSipFilterEnabled, // Alias
        setSmartFilterActive: setIsSipFilterEnabled, // Alias
        filteredLogs,
        selectedLogId,
        setSelectedLogId,
        searchHistory,
        addToSearchHistory,
        clearSearchHistory,
        clearAllFilters,
        isTextWrapEnabled,
        setIsTextWrapEnabled,
        sortConfig,
        setSortConfig,
        selectedComponentFilter,
        setSelectedComponentFilter,
        visibleRange,
        setVisibleRange,
        scrollTargetTimestamp,
        setScrollTargetTimestamp,
        timelineViewMode,
        setTimelineViewMode,
        isTimelineCompact,
        setIsTimelineCompact,
        timelineZoomRange,
        setTimelineZoomRange,
        timelineEventFilters,
        setTimelineEventFilters,
        hoveredCallId,
        setHoveredCallId,
        hoveredCorrelation,
        setHoveredCorrelation,
        jumpState,
        setJumpState,
        activeCorrelations,
        setActiveCorrelations,
        toggleCorrelation,
        setOnlyCorrelation,
        correlationCounts,
        isSidebarOpen,
        setIsSidebarOpen,
        isTimelineOpen,
        setIsTimelineOpen,
        activeCallFlowId,
        setActiveCallFlowId,
        correlationData,
        favoriteLogIds,
        toggleFavorite,
        isShowFavoritesOnly,
        setIsShowFavoritesOnly
    }), [
        // Only include values that actually change and affect consumers
        logs,
        loading,
        parsingProgress,
        filterText,
        isSipFilterEnabled,
        filteredLogs,
        selectedLogId,
        searchHistory,
        isTextWrapEnabled,
        sortConfig,
        selectedComponentFilter,
        visibleRange,
        scrollTargetTimestamp,
        timelineViewMode,
        isTimelineCompact,
        timelineZoomRange,
        timelineEventFilters,
        hoveredCallId,
        hoveredCorrelation,
        jumpState,
        activeCorrelations,
        correlationCounts,
        isSidebarOpen,
        isTimelineOpen,
        activeCallFlowId,
        correlationData,
        favoriteLogIds,
        isShowFavoritesOnly,
        // Stable callbacks - included to satisfy exhaustive-deps but won't cause unnecessary recalculations
        addToSearchHistory,
        clearSearchHistory,
        clearAllFilters,
        toggleCorrelation,
        setOnlyCorrelation,
        toggleFavorite
    ]);

    return (
        <LogContext.Provider value={value}>
            {children}
        </LogContext.Provider>
    );
};

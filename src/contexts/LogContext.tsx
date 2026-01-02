import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';
import type { LogEntry, LogState } from '../types';
import { loadSearchHistory, addToSearchHistory as saveToHistory, clearSearchHistory as clearHistoryStorage } from '../store/searchHistory';

export interface CorrelationItem {
    type: 'report' | 'operator' | 'extension' | 'station' | 'callId';
    value: string;
}

interface LogContextType extends LogState {
    setLogs: (logs: LogEntry[]) => void;
    setLoading: (loading: boolean) => void;
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
    sortConfig: { field: 'timestamp', direction: 'asc' | 'desc' };
    setSortConfig: (config: { field: 'timestamp', direction: 'asc' | 'desc' }) => void;
    selectedComponentFilter: string | null;
    setSelectedComponentFilter: (component: string | null) => void;

    // Timeline States
    visibleRange: { start: number; end: number };
    setVisibleRange: (range: { start: number; end: number }) => void;
    scrollTargetTimestamp: number | null;
    setScrollTargetTimestamp: (timestamp: number | null) => void;
    timelineViewMode: 'full' | 'filtered';
    setTimelineViewMode: (mode: 'full' | 'filtered') => void;

    // Correlation
    activeCorrelations: CorrelationItem[];
    toggleCorrelation: (item: CorrelationItem) => void;
    setOnlyCorrelation: (item: CorrelationItem) => void;
    correlationCounts: Record<string, number>;

    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;

    activeCallFlowId: string | null;
    setActiveCallFlowId: (id: string | null) => void;
    correlationData: {
        reportIds: string[];
        operatorIds: string[];
        extensionIds: string[];
        stationIds: string[];
        callIds: string[];
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
    const [sortConfig, setSortConfig] = useState<{ field: 'timestamp', direction: 'asc' | 'desc' }>({ field: 'timestamp', direction: 'asc' });
    const [selectedComponentFilter, setSelectedComponentFilter] = useState<string | null>(null);
    const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 1 });
    const [scrollTargetTimestamp, setScrollTargetTimestamp] = useState<number | null>(null);
    const [timelineViewMode, setTimelineViewMode] = useState<'full' | 'filtered'>('full');

    // Correlation State
    const [activeCorrelations, setActiveCorrelations] = useState<CorrelationItem[]>([]);
    const [activeCallFlowId, setActiveCallFlowId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Favorites State
    const [favoriteLogIds, setFavoriteLogIds] = useState<Set<number>>(new Set());
    const [isShowFavoritesOnly, setIsShowFavoritesOnly] = useState(false);

    const toggleCorrelation = (item: CorrelationItem) => {
        setActiveCorrelations(prev => {
            const exists = prev.some(i => i.type === item.type && i.value === item.value);
            if (exists) {
                return prev.filter(i => !(i.type === item.type && i.value === item.value));
            } else {
                return [...prev, item];
            }
        });
    };

    const setOnlyCorrelation = (item: CorrelationItem) => {
        setActiveCorrelations([item]);
    };

    // Favorites Functions
    const toggleFavorite = (logId: number) => {
        setFavoriteLogIds(prev => {
            const next = new Set(prev);
            if (next.has(logId)) {
                next.delete(logId);
            } else {
                next.add(logId);
            }
            return next;
        });
    };

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

    // Filter Helper
    const clearAllFilters = () => {
        setFilterText('');
        setIsSipFilterEnabled(false);
        setSelectedComponentFilter(null);
        setActiveCorrelations([]);
        setSelectedLogId(null);
        setIsShowFavoritesOnly(false);
    };

    // Computed unique IDs and Counts for Sidebar
    const { correlationData, correlationCounts } = useMemo(() => {
        const reportIds = new Set<string>();
        const operatorIds = new Set<string>();
        const extensionIds = new Set<string>();
        const stationIds = new Set<string>();
        const callIds = new Set<string>();

        const counts: Record<string, number> = {};

        const increment = (type: string, value: string) => {
            const key = `${type}:${value}`;
            counts[key] = (counts[key] || 0) + 1;
        };

        logs.forEach(log => {
            if (log.reportId) { reportIds.add(log.reportId); increment('report', log.reportId); }
            if (log.operatorId) { operatorIds.add(log.operatorId); increment('operator', log.operatorId); }
            if (log.extensionId) { extensionIds.add(log.extensionId); increment('extension', log.extensionId); }
            if (log.stationId) { stationIds.add(log.stationId); increment('station', log.stationId); }
            if (log.callId) { callIds.add(log.callId); increment('callId', log.callId); }
        });

        return {
            correlationData: {
                reportIds: Array.from(reportIds).sort(),
                operatorIds: Array.from(operatorIds).sort(),
                extensionIds: Array.from(extensionIds).sort(),
                stationIds: Array.from(stationIds).sort(),
                callIds: Array.from(callIds).sort()
            },
            correlationCounts: counts
        };
    }, [logs]);

    // Computed filtered logs
    const filteredLogs = useMemo(() => {
        if (!logs.length) return [];

        let result = logs.filter(log => {
            // Correlation Filter (OR Logic)
            if (activeCorrelations.length > 0) {
                const matchesAny = activeCorrelations.some(corr => {
                    switch (corr.type) {
                        case 'report': return log.reportId === corr.value;
                        case 'operator': return log.operatorId === corr.value;
                        case 'extension': return log.extensionId === corr.value;
                        case 'station': return log.stationId === corr.value;
                        case 'callId': return log.callId === corr.value;
                        default: return false;
                    }
                });
                if (!matchesAny) return false;
            }

            // Component Filter
            if (selectedComponentFilter && log.displayComponent !== selectedComponentFilter) {
                return false;
            }

            // SIP Filter (Show Only SIP)
            if (isSipFilterEnabled) {
                // If filter is ON, show ONLY SIP messages
                if (!log.isSip) return false;
            }

            // Text Search Logic
            if (filterText) {
                const lowerFilter = filterText.toLowerCase();
                const matchContent =
                    log.message.toLowerCase().includes(lowerFilter) ||
                    (log.payload && log.payload.toLowerCase().includes(lowerFilter)) ||
                    log.component.toLowerCase().includes(lowerFilter) ||
                    (log.callId && log.callId.toLowerCase().includes(lowerFilter)); // Also search Call ID

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
            }
            return 0;
        });

        return result;
    }, [logs, filterText, isSipFilterEnabled, selectedComponentFilter, sortConfig, activeCorrelations, isShowFavoritesOnly, favoriteLogIds]);

    const addToSearchHistory = (term: string) => {
        saveToHistory(term);
        setSearchHistory(loadSearchHistory());
    };

    const clearSearchHistory = () => {
        clearHistoryStorage();
        setSearchHistory([]);
    };

    const value = {
        logs,
        setLogs,
        loading,
        setLoading,
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
        activeCorrelations,
        toggleCorrelation,
        setOnlyCorrelation,
        correlationCounts,
        isSidebarOpen,
        setIsSidebarOpen,
        activeCallFlowId,
        setActiveCallFlowId,
        correlationData,
        favoriteLogIds,
        toggleFavorite,
        isShowFavoritesOnly,
        setIsShowFavoritesOnly
    };

    return (
        <LogContext.Provider value={value}>
            {children}
        </LogContext.Provider>
    );
};

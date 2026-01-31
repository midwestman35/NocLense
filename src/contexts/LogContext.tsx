import { createContext, useContext, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import type { LogEntry, LogLevel, LogState } from '../types';
import { loadSearchHistory, addToSearchHistory as saveToHistory, clearSearchHistory as clearHistoryStorage } from '../store/searchHistory';
import { dbManager } from '../utils/indexedDB';

export interface CorrelationItem {
    type: 'report' | 'operator' | 'extension' | 'station' | 'callId' | 'file' | 'cncID' | 'messageID';
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
    selectedLevels: Set<LogLevel>;
    toggleLevel: (level: LogLevel) => void;
    selectedSipMethods: Set<string>;
    toggleSipMethod: (method: string) => void;
    // Deprecated alias aliases kept for compatibility if needed, otherwise removed
    smartFilterActive: boolean;
    setSmartFilterActive: (active: boolean) => void;

    setSelectedLogId: (id: number | null) => void;
    searchHistory: string[];
    addToSearchHistory: (term: string) => void;
    clearSearchHistory: () => void;
    clearAllFilters: () => void;
    clearFilterSelections: () => void;

    // New View Options
    isTextWrapEnabled: boolean;
    setIsTextWrapEnabled: (enabled: boolean) => void;
    sortConfig: { field: 'timestamp' | 'level', direction: 'asc' | 'desc' };
    setSortConfig: (config: { field: 'timestamp' | 'level', direction: 'asc' | 'desc' }) => void;
    selectedComponentFilter: string | null;
    setSelectedComponentFilter: (component: string | null) => void;
    // Message type: exclude noisy types (6.3) and filter to one type (6.5)
    excludedMessageTypes: Set<string>;
    toggleExcludedMessageType: (type: string) => void;
    selectedMessageTypeFilter: string | null;
    setSelectedMessageTypeFilter: (type: string | null) => void;
    availableMessageTypes: string[];
    // Collapse similar consecutive rows (6.3 Option A)
    isCollapseSimilarEnabled: boolean;
    setIsCollapseSimilarEnabled: (enabled: boolean) => void;
    /** When collapse similar is on, one row per group; each item has firstLog + count */
    collapsedViewList: Array<{ firstLog: LogEntry; count: number }> | null;

    // Timeline States
    visibleRange: { start: number; end: number };
    setVisibleRange: (range: { start: number; end: number }) => void;
    scrollTargetTimestamp: number | null;
    setScrollTargetTimestamp: (timestamp: number | null) => void;
    /** True when any filter is applied; timeline uses full scope when false, filtered when true */
    hasActiveFilters: boolean;

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
        cncIds: string[];
        messageIds: string[];
    };
    // Favorites
    favoriteLogIds: Set<number>;
    toggleFavorite: (logId: number) => void;
    isShowFavoritesOnly: boolean;
    setIsShowFavoritesOnly: (show: boolean) => void;
    
    // IndexedDB support (for large files)
    useIndexedDBMode: boolean;
    totalLogCount: number;
    loadLogsFromIndexedDB: (filters?: {
        component?: string;
        callId?: string;
        timestampRange?: { start: number; end: number };
        limit?: number;
    }) => Promise<LogEntry[]>;
    clearAllData: () => Promise<void>;
    enableIndexedDBMode: () => Promise<void>;
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
    const [useIndexedDBMode, setUseIndexedDBMode] = useState(false); // Flag to indicate if IndexedDB is being used
    const [totalLogCount, setTotalLogCount] = useState(0); // Total count when using IndexedDB
    const [filterText, setFilterText] = useState('');
    const [isSipFilterEnabled, setIsSipFilterEnabled] = useState(false);
    const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(() => new Set());
    const [selectedSipMethods, setSelectedSipMethods] = useState<Set<string>>(() => new Set());
    const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    
    // Initialize IndexedDB and check if we have stored logs
    useEffect(() => {
        const initIndexedDB = async () => {
            try {
                await dbManager.init();
                const metadata = await dbManager.getMetadata();
                if (metadata && metadata.totalLogs > 0) {
                    setUseIndexedDBMode(true);
                    setTotalLogCount(metadata.totalLogs);
                    // Load initial batch of logs for display
                    const initialLogs = await dbManager.getLogsByTimestampRange(
                        metadata.dateRange.min,
                        metadata.dateRange.max,
                        1000 // Load first 1000 logs
                    );
                    setLogs(initialLogs.sort((a, b) => a.timestamp - b.timestamp));
                }
            } catch (error) {
                console.error('Failed to initialize IndexedDB:', error);
            }
        };
        initIndexedDB();
    }, []);
    
    // State for IndexedDB-loaded logs (when using IndexedDB mode)
    const [indexedDBLogs, setIndexedDBLogs] = useState<LogEntry[]>([]);
    const [indexedDBLoading, setIndexedDBLoading] = useState(false);
    
    // Function to load logs from IndexedDB when needed
    const loadLogsFromIndexedDB = useCallback(async (filters?: {
        component?: string;
        callId?: string;
        timestampRange?: { start: number; end: number };
        limit?: number;
        isSip?: boolean;
        level?: string;
        fileName?: string;
    }) => {
        if (!useIndexedDBMode) return [];
        try {
            const loadedLogs = await dbManager.getLogsFiltered(filters || {});
            return loadedLogs;
        } catch (error) {
            console.error('Failed to load logs from IndexedDB:', error);
            return [];
        }
    }, [useIndexedDBMode]);
    
    // Load search history on mount
    useEffect(() => {
        setSearchHistory(loadSearchHistory());
    }, []);

    // New State for View Options
    const [isTextWrapEnabled, setIsTextWrapEnabled] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ field: 'timestamp' | 'level', direction: 'asc' | 'desc' }>({ field: 'timestamp', direction: 'asc' });
    const [selectedComponentFilter, setSelectedComponentFilter] = useState<string | null>(null);
    const [excludedMessageTypes, setExcludedMessageTypes] = useState<Set<string>>(new Set());
    const [selectedMessageTypeFilter, setSelectedMessageTypeFilter] = useState<string | null>(null);
    const [isCollapseSimilarEnabled, setIsCollapseSimilarEnabled] = useState(false);
    const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 1 });
    const [scrollTargetTimestamp, setScrollTargetTimestamp] = useState<number | null>(null);
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

    // Load logs from IndexedDB when filters change (for IndexedDB mode)
    // This must be after all state declarations
    useEffect(() => {
        if (!useIndexedDBMode) {
            setIndexedDBLogs([]);
            return;
        }
        
        const loadFilteredLogs = async () => {
            setIndexedDBLoading(true);
            try {
                // Build filters from current state
                const filters: any = {};
                
                // Component filter
                if (selectedComponentFilter) {
                    filters.component = selectedComponentFilter;
                }

                // Level filter (IndexedDB supports single level; multi-level filtered in memory below)
                if (selectedLevels.size === 1) {
                    filters.level = [...selectedLevels][0];
                }
                
                // SIP filter
                if (isSipFilterEnabled) {
                    filters.isSip = true;
                }
                
                // Correlation filters
                const activeFileFilters = activeCorrelations.filter(c => c.type === 'file' && !c.excluded);
                if (activeFileFilters.length > 0) {
                    filters.fileName = activeFileFilters[0].value; // For now, use first file filter
                }
                
                const callIdFilters = activeCorrelations.filter(c => c.type === 'callId' && !c.excluded);
                if (callIdFilters.length > 0) {
                    filters.callId = callIdFilters[0].value;
                }
                
                // CRITICAL: Limit initial load to prevent memory exhaustion
                // For large datasets, only load a reasonable number of logs initially
                // Virtual scrolling will load more as needed
                const MAX_INITIAL_LOGS = 5000;
                
                // If no specific filters, limit the load
                const hasSpecificFilters = selectedComponentFilter || selectedLevels.size > 0 || isSipFilterEnabled || 
                    activeFileFilters.length > 0 || callIdFilters.length > 0 || filterText;
                
                if (!hasSpecificFilters) {
                    // No filters - load limited sample for initial display
                    filters.limit = MAX_INITIAL_LOGS;
                }
                
                // Text search - for now, load all and filter in memory (IndexedDB doesn't support full-text search easily)
                // In the future, we could add a full-text search index
                let loadedLogs = await loadLogsFromIndexedDB(filters);
                
                // Apply text filter in memory if present
                if (filterText) {
                    const lowerFilterText = filterText.toLowerCase();
                    loadedLogs = loadedLogs.filter(log => {
                        return (
                            (log._messageLower && log._messageLower.includes(lowerFilterText)) ||
                            (log._payloadLower && log._payloadLower.includes(lowerFilterText)) ||
                            (log._componentLower && log._componentLower.includes(lowerFilterText)) ||
                            (log._callIdLower && log._callIdLower.includes(lowerFilterText))
                        );
                    });
                }
                
                // Level filter in memory (multi-level or when IndexedDB didn't apply)
                if (selectedLevels.size > 0) {
                    loadedLogs = loadedLogs.filter(log => selectedLevels.has(log.level));
                }

                // SIP method filter in memory
                const normalizeMethod = (method: string): string => {
                    const responseMatch = method.match(/^(\d{3})\s+(\w+)(?:\s+.*)?$/i);
                    if (responseMatch) {
                        const code = responseMatch[1];
                        const firstWord = responseMatch[2].charAt(0).toUpperCase() + responseMatch[2].slice(1).toLowerCase();
                        return `${code} ${firstWord}`;
                    }
                    return method;
                };
                if (isSipFilterEnabled && selectedSipMethods.size > 0) {
                    loadedLogs = loadedLogs.filter(log => {
                        if (!log.isSip || !log.sipMethod) return false;
                        const normalizedLog = normalizeMethod(log.sipMethod);
                        return [...selectedSipMethods].some(m => normalizeMethod(m) === normalizedLog);
                    });
                }
                
                // Apply favorites filter
                if (isShowFavoritesOnly) {
                    loadedLogs = loadedLogs.filter(log => favoriteLogIds.has(log.id));
                }

                // Message type: exclude (6.3) and include-only (6.5)
                if (excludedMessageTypes.size > 0) {
                    loadedLogs = loadedLogs.filter(log => !log.messageType || !excludedMessageTypes.has(log.messageType));
                }
                if (selectedMessageTypeFilter !== null) {
                    loadedLogs = loadedLogs.filter(log => log.messageType === selectedMessageTypeFilter);
                }

                // Correlation filters (cncID / messageID) – in memory (no IDB index)
                const cncIdFilters = activeCorrelations.filter(c => c.type === 'cncID' && !c.excluded);
                const msgIdFilters = activeCorrelations.filter(c => c.type === 'messageID' && !c.excluded);
                const cncIdExcl = activeCorrelations.filter(c => c.type === 'cncID' && c.excluded);
                const msgIdExcl = activeCorrelations.filter(c => c.type === 'messageID' && c.excluded);
                if (cncIdFilters.length > 0 || msgIdFilters.length > 0 || cncIdExcl.length > 0 || msgIdExcl.length > 0) {
                    const cncSet = new Set(cncIdFilters.map(c => c.value));
                    const msgSet = new Set(msgIdFilters.map(c => c.value));
                    const cncExclSet = new Set(cncIdExcl.map(c => c.value));
                    const msgExclSet = new Set(msgIdExcl.map(c => c.value));
                    loadedLogs = loadedLogs.filter(log => {
                        if (cncExclSet.size && log.cncID && cncExclSet.has(log.cncID)) return false;
                        if (msgExclSet.size && log.messageID && msgExclSet.has(log.messageID)) return false;
                        if (cncSet.size && (!log.cncID || !cncSet.has(log.cncID))) return false;
                        if (msgSet.size && (!log.messageID || !msgSet.has(log.messageID))) return false;
                        return true;
                    });
                }
                
                // Sort
                loadedLogs.sort((a, b) => {
                    if (sortConfig.field === 'timestamp') {
                        const timeA = a.timestamp;
                        const timeB = b.timestamp;
                        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
                    } else if (sortConfig.field === 'level') {
                        const levels = { ERROR: 3, WARN: 2, INFO: 1, DEBUG: 0 };
                        const valA = levels[a.level] || 0;
                        const valB = levels[b.level] || 0;
                        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
                    }
                    return 0;
                });
                
                setIndexedDBLogs(loadedLogs);
            } catch (error) {
                console.error('Failed to load filtered logs from IndexedDB:', error);
            } finally {
                setIndexedDBLoading(false);
            }
        };
        
        // Debounce the load to avoid excessive queries
        const timeoutId = setTimeout(loadFilteredLogs, 300);
        return () => clearTimeout(timeoutId);
    }, [
        useIndexedDBMode,
        selectedComponentFilter,
        selectedLevels,
        isSipFilterEnabled,
        selectedSipMethods,
        activeCorrelations,
        filterText,
        isShowFavoritesOnly,
        favoriteLogIds,
        sortConfig,
        loadLogsFromIndexedDB,
        excludedMessageTypes,
        selectedMessageTypeFilter
    ]);
    
    // Update totalLogCount when logs are cleared
    useEffect(() => {
        if (logs.length === 0 && useIndexedDBMode) {
            // If logs are cleared but IndexedDB mode is active, reload count
            dbManager.getTotalCount().then(count => setTotalLogCount(count));
        }
    }, [logs.length, useIndexedDBMode]);

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


    // State for correlation data (loaded asynchronously for IndexedDB mode)
    const [correlationDataState, setCorrelationDataState] = useState<{
        reportIds: string[];
        operatorIds: string[];
        extensionIds: string[];
        stationIds: string[];
        callIds: string[];
        fileNames: string[];
        cncIds: string[];
        messageIds: string[];
    }>({
        reportIds: [],
        operatorIds: [],
        extensionIds: [],
        stationIds: [],
        callIds: [],
        fileNames: [],
        cncIds: [],
        messageIds: []
    });
    const [correlationCountsState, setCorrelationCountsState] = useState<Record<string, number>>({});

    // Load correlation data from IndexedDB when in IndexedDB mode
    useEffect(() => {
        if (!useIndexedDBMode) {
            // Use in-memory computation for small files
            return;
        }

        const loadCorrelationData = async () => {
            try {
                // Use IndexedDB's efficient getUniqueValues instead of iterating all logs
                const [reportIdsSet, operatorIdsSet, extensionIdsSet, stationIdsSet, callIdsSet, fileNamesSet, cncIdsSet, messageIdsSet] = await Promise.all([
                    dbManager.getUniqueValues('reportId'),
                    dbManager.getUniqueValues('operatorId'),
                    dbManager.getUniqueValues('extensionId'),
                    dbManager.getUniqueValues('stationId'),
                    dbManager.getUniqueValues('callId'),
                    dbManager.getUniqueValues('fileName'),
                    dbManager.getUniqueValues('cncID'),
                    dbManager.getUniqueValues('messageID')
                ]);

                const reportIds = Array.from(reportIdsSet).sort();
                const operatorIds = Array.from(operatorIdsSet).sort();
                const extensionIds = Array.from(extensionIdsSet).sort();
                const stationIds = Array.from(stationIdsSet).sort();
                const callIds = Array.from(callIdsSet).sort();
                const fileNames = Array.from(fileNamesSet).sort();
                const cncIds = Array.from(cncIdsSet).sort();
                const messageIds = Array.from(messageIdsSet).sort();

                setCorrelationDataState({
                    reportIds,
                    operatorIds,
                    extensionIds,
                    stationIds,
                    callIds,
                    fileNames,
                    cncIds,
                    messageIds
                });

                // Get ACTUAL counts from IndexedDB for file names
                // This queries IndexedDB directly for accurate counts per file
                const counts: Record<string, number> = {};
                
                // Get file counts from IndexedDB (this is the most important one)
                const fileCountsMap = await dbManager.getCountsByIndex('fileName');
                fileCountsMap.forEach((count, fileName) => {
                    counts[`file:${fileName}`] = count;
                });
                
                // For other correlation types, we can compute from indexedDBLogs
                // since they're less critical and there are usually fewer unique values
                if (indexedDBLogs.length > 0) {
                    indexedDBLogs.forEach(log => {
                        if (log.reportId) counts[`report:${log.reportId}`] = (counts[`report:${log.reportId}`] || 0) + 1;
                        if (log.operatorId) counts[`operator:${log.operatorId}`] = (counts[`operator:${log.operatorId}`] || 0) + 1;
                        if (log.extensionId) counts[`extension:${log.extensionId}`] = (counts[`extension:${log.extensionId}`] || 0) + 1;
                        if (log.stationId) counts[`station:${log.stationId}`] = (counts[`station:${log.stationId}`] || 0) + 1;
                        if (log.callId) counts[`callId:${log.callId}`] = (counts[`callId:${log.callId}`] || 0) + 1;
                        if (log.cncID) counts[`cncID:${log.cncID}`] = (counts[`cncID:${log.cncID}`] || 0) + 1;
                        if (log.messageID) counts[`messageID:${log.messageID}`] = (counts[`messageID:${log.messageID}`] || 0) + 1;
                    });
                }
                
                setCorrelationCountsState(counts);
            } catch (error) {
                console.error('Failed to load correlation data from IndexedDB:', error);
            }
        };

        loadCorrelationData();
    }, [useIndexedDBMode, indexedDBLogs, totalLogCount]);

    // Computed unique IDs and Counts for Sidebar (for in-memory mode)
    const { correlationData, correlationCounts } = useMemo(() => {
        // For IndexedDB mode, use the async-loaded state
        if (useIndexedDBMode) {
            return {
                correlationData: correlationDataState,
                correlationCounts: correlationCountsState
            };
        }

        // For in-memory mode, compute from logs
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
        const cncIds = new Set<string>();
        const messageIds = new Set<string>();

        const counts: Record<string, number> = {};

        const increment = (type: string, value: string) => {
            const key = `${type}:${value}`;
            counts[key] = (counts[key] || 0) + 1;
        };

        sourceLogs.forEach(log => {
            if (log.reportId) { reportIds.add(log.reportId); increment('report', log.reportId); }
            if (log.operatorId) { operatorIds.add(log.operatorId); increment('operator', log.operatorId); }
            if (log.extensionId) { extensionIds.add(log.extensionId); increment('extension', log.extensionId); }
            if (log.stationId) { stationIds.add(log.stationId); increment('station', log.stationId); }
            if (log.callId) { callIds.add(log.callId); increment('callId', log.callId); }
            if (log.fileName) { fileNames.add(log.fileName); increment('file', log.fileName); }
            if (log.cncID) { cncIds.add(log.cncID); increment('cncID', log.cncID); }
            if (log.messageID) { messageIds.add(log.messageID); increment('messageID', log.messageID); }
        });

        // Re-populate fileNames from ALL logs strictly for the list
        const allFiles = new Set<string>();
        logs.forEach(l => { if (l.fileName) allFiles.add(l.fileName); });

        return {
            correlationData: {
                reportIds: Array.from(reportIds).sort(),
                operatorIds: Array.from(operatorIds).sort(),
                extensionIds: Array.from(extensionIds).sort(),
                stationIds: Array.from(stationIds).sort(),
                callIds: Array.from(callIds).sort(),
                fileNames: Array.from(allFiles).sort(),
                cncIds: Array.from(cncIds).sort(),
                messageIds: Array.from(messageIds).sort()
            },
            correlationCounts: counts
        };
    }, [logs, useIndexedDBMode, correlationDataState, correlationCountsState, activeCorrelations]);

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

    // Available message types from current logs (for Exclude / Filter by message type UI)
    const availableMessageTypes = useMemo(() => {
        const source = useIndexedDBMode ? indexedDBLogs : logs;
        const set = new Set<string>();
        source.forEach(log => {
            if (log.messageType && log.messageType.trim()) set.add(log.messageType);
        });
        return Array.from(set).sort();
    }, [useIndexedDBMode, logs, indexedDBLogs]);

    const toggleExcludedMessageType = useCallback((type: string) => {
        setExcludedMessageTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    }, []);

    // Computed filtered logs - Phase 2 Optimized
    // When using IndexedDB mode, use indexedDBLogs instead of logs
    const filteredLogs = useMemo(() => {
        // If using IndexedDB mode, return IndexedDB-loaded logs
        if (useIndexedDBMode) {
            return indexedDBLogs;
        }
        
        // Otherwise, use traditional in-memory filtering
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
                        case 'cncID': match = !!log.cncID && values.has(log.cncID); break;
                        case 'messageID': match = !!log.messageID && values.has(log.messageID); break;
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
                        case 'cncID': matchExclude = !!log.cncID && values.has(log.cncID); break;
                        case 'messageID': matchExclude = !!log.messageID && values.has(log.messageID); break;
                    }
                    if (matchExclude) return false; // Fail if any excluded value matches
                }
            }

            // Component Filter
            if (selectedComponentFilter && log.displayComponent !== selectedComponentFilter) {
                return false;
            }

            // Message type: exclude selected types (6.3 Option B)
            if (log.messageType && excludedMessageTypes.has(log.messageType)) return false;

            // Message type: show only selected type (6.5)
            if (selectedMessageTypeFilter !== null) {
                if (!log.messageType || log.messageType !== selectedMessageTypeFilter) return false;
            }

            // Level Filter (multi-select: show only logs whose level is in selectedLevels)
            if (selectedLevels.size > 0 && !selectedLevels.has(log.level)) return false;

            // SIP Filter (Show Only SIP)
            if (isSipFilterEnabled && !log.isSip) return false;

            // SIP Method Filter (multi-select: when methods selected, only show SIP logs matching any of them)
            const normalizeMethod = (method: string): string => {
                const responseMatch = method.match(/^(\d{3})\s+(\w+)(?:\s+.*)?$/i);
                if (responseMatch) {
                    const code = responseMatch[1];
                    const firstWord = responseMatch[2].charAt(0).toUpperCase() + responseMatch[2].slice(1).toLowerCase();
                    return `${code} ${firstWord}`;
                }
                return method;
            };
            if (isSipFilterEnabled && selectedSipMethods.size > 0) {
                if (!log.isSip || !log.sipMethod) return false;
                const normalizedLog = normalizeMethod(log.sipMethod);
                const matchesAny = [...selectedSipMethods].some(m => normalizeMethod(m) === normalizedLog);
                if (!matchesAny) return false;
            }

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
    }, [logs, selectedLogId, correlationIndexes, selectedComponentFilter, selectedLevels, isSipFilterEnabled, selectedSipMethods, lowerFilterText, sortConfig, isShowFavoritesOnly, favoriteLogIds, useIndexedDBMode, indexedDBLogs, excludedMessageTypes, selectedMessageTypeFilter]);

    // Collapse similar: group consecutive rows with same (displayComponent, summaryMessage/displayMessage) (6.3 Option A)
    const collapsedViewList = useMemo((): Array<{ firstLog: LogEntry; count: number }> | null => {
        if (!isCollapseSimilarEnabled || filteredLogs.length === 0) return null;
        const groups: Array<{ key: string; logs: LogEntry[] }> = [];
        const keyOf = (log: LogEntry) => `${log.displayComponent}\0${log.summaryMessage ?? log.displayMessage}`;
        for (const log of filteredLogs) {
            const k = keyOf(log);
            if (groups.length > 0 && groups[groups.length - 1].key === k) {
                groups[groups.length - 1].logs.push(log);
            } else {
                groups.push({ key: k, logs: [log] });
            }
        }
        return groups.map(g => ({ firstLog: g.logs[0], count: g.logs.length }));
    }, [isCollapseSimilarEnabled, filteredLogs]);

    /** True when any filter is applied; timeline shows full scope when false, filtered when true */
    const hasActiveFilters = useMemo(() => {
        if (filterText.trim() !== '') return true;
        if (selectedLevels.size > 0) return true;
        if (selectedComponentFilter != null) return true;
        if (excludedMessageTypes.size > 0) return true;
        if (selectedMessageTypeFilter != null) return true;
        if (isSipFilterEnabled) return true;
        if (activeCorrelations.length > 0) return true;
        if (isShowFavoritesOnly) return true;
        return false;
    }, [filterText, selectedLevels, selectedComponentFilter, excludedMessageTypes, selectedMessageTypeFilter, isSipFilterEnabled, activeCorrelations, isShowFavoritesOnly]);

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
        setSelectedLevels(new Set());
        setSelectedSipMethods(new Set());
        setIsSipFilterEnabled(false);
        setSelectedComponentFilter(null);
        setExcludedMessageTypes(new Set());
        setSelectedMessageTypeFilter(null);
        setActiveCorrelations([]);
        setSelectedLogId(null);
        setIsShowFavoritesOnly(false);
    }, []);

    const clearFilterSelections = useCallback(() => {
        setSelectedLevels(new Set());
        setSelectedSipMethods(new Set());
        setIsSipFilterEnabled(false);
    }, []);

    const toggleLevel = useCallback((level: LogLevel) => {
        setSelectedLevels(prev => {
            const next = new Set(prev);
            if (next.has(level)) next.delete(level);
            else next.add(level);
            return next;
        });
    }, []);

    const toggleSipMethod = useCallback((method: string) => {
        const wasSelected = selectedSipMethods.has(method);
        setSelectedSipMethods(prev => {
            const next = new Set(prev);
            if (next.has(method)) next.delete(method);
            else next.add(method);
            return next;
        });
        if (!wasSelected) setIsSipFilterEnabled(true);
    }, [selectedSipMethods]);

    // Phase 2 Optimization: Memoize context value to prevent unnecessary re-renders
    // This is critical - without memoization, the entire value object is recreated on every render
    // causing all consuming components to re-render unnecessarily
    // Note: Setters from useState are stable and don't need to be in dependencies
    // Callbacks wrapped in useCallback are also stable
    // Clear all data including IndexedDB
    const clearAllData = useCallback(async () => {
        // Clear IndexedDB first
        try {
            await dbManager.clearAll();
        } catch (error) {
            console.error('Failed to clear IndexedDB:', error);
        }
        
        // Clear all state
        setLogs([]);
        setIndexedDBLogs([]);
        setUseIndexedDBMode(false);
        setTotalLogCount(0);
        setCorrelationDataState({
            reportIds: [],
            operatorIds: [],
            extensionIds: [],
            stationIds: [],
            callIds: [],
            fileNames: [],
            cncIds: [],
            messageIds: []
        });
        setCorrelationCountsState({});
    }, []);

    // Enhanced setLogs that detects IndexedDB mode
    const enhancedSetLogs = useCallback((newLogs: LogEntry[], clearMode: boolean = false) => {
        // If clearMode is true, clear everything including IndexedDB
        if (clearMode || newLogs.length === 0) {
            clearAllData();
            return;
        }
        
        // Setting logs directly (small files) - disable IndexedDB mode
        setLogs(newLogs);
        setUseIndexedDBMode(false);
        setIndexedDBLogs([]);
    }, [clearAllData]);
    
    // Function to trigger IndexedDB mode after parsing completes
    const enableIndexedDBMode = useCallback(async () => {
        const count = await dbManager.getTotalCount();
        if (count > 0) {
            setUseIndexedDBMode(true);
            setTotalLogCount(count);
            // Load initial batch from IndexedDB
            const metadata = await dbManager.getMetadata();
            if (metadata) {
                const initialLogs = await dbManager.getLogsByTimestampRange(
                    metadata.dateRange.min,
                    metadata.dateRange.max,
                    5000 // Load 5k logs initially
                );
                setIndexedDBLogs(initialLogs.sort((a, b) => a.timestamp - b.timestamp));
            }
        }
    }, []);
    
    const value = useMemo(() => ({
        logs: useIndexedDBMode ? indexedDBLogs : logs,
        setLogs: enhancedSetLogs,
        loading: loading || indexedDBLoading,
        setLoading,
        parsingProgress,
        setParsingProgress,
        filterText,
        setFilterText,
        isSipFilterEnabled,
        setIsSipFilterEnabled,
        selectedLevels,
        toggleLevel,
        selectedSipMethods,
        toggleSipMethod,
        smartFilterActive: isSipFilterEnabled, // Alias
        setSmartFilterActive: setIsSipFilterEnabled, // Alias
        filteredLogs,
        selectedLogId,
        setSelectedLogId,
        searchHistory,
        addToSearchHistory,
        clearSearchHistory,
        clearAllFilters,
        clearFilterSelections,
        isTextWrapEnabled,
        setIsTextWrapEnabled,
        sortConfig,
        setSortConfig,
        selectedComponentFilter,
        setSelectedComponentFilter,
        excludedMessageTypes,
        toggleExcludedMessageType,
        selectedMessageTypeFilter,
        setSelectedMessageTypeFilter,
        availableMessageTypes,
        isCollapseSimilarEnabled,
        setIsCollapseSimilarEnabled,
        collapsedViewList,
        visibleRange,
        setVisibleRange,
        scrollTargetTimestamp,
        setScrollTargetTimestamp,
        hasActiveFilters,
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
        setIsShowFavoritesOnly,
        // IndexedDB support (for large files)
        useIndexedDBMode,
        totalLogCount,
        loadLogsFromIndexedDB,
        clearAllData,
        enableIndexedDBMode
    }), [
        // Only include values that actually change and affect consumers
        logs,
        indexedDBLogs,
        useIndexedDBMode,
        loading,
        indexedDBLoading,
        parsingProgress,
        filterText,
        isSipFilterEnabled,
        selectedLevels,
        selectedSipMethods,
        filteredLogs,
        selectedLogId,
        searchHistory,
        isTextWrapEnabled,
        sortConfig,
        selectedComponentFilter,
        excludedMessageTypes,
        selectedMessageTypeFilter,
        availableMessageTypes,
        isCollapseSimilarEnabled,
        collapsedViewList,
        visibleRange,
        scrollTargetTimestamp,
        hasActiveFilters,
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
        totalLogCount,
        // Stable callbacks - included to satisfy exhaustive-deps but won't cause unnecessary recalculations
        addToSearchHistory,
        clearSearchHistory,
        clearAllFilters,
        toggleCorrelation,
        setOnlyCorrelation,
        toggleFavorite,
        loadLogsFromIndexedDB,
        enhancedSetLogs
    ]);

    return (
        <LogContext.Provider value={value}>
            {children}
        </LogContext.Provider>
    );
};

export type LogLevel = 'INFO' | 'DEBUG' | 'ERROR' | 'WARN';

export interface LogEntry {
    id: number;
    timestamp: number;
    rawTimestamp: string;
    level: LogLevel;
    component: string; // Original component path (for details panel)
    displayComponent: string; // Cleaned component name (for list view)
    message: string; // Original message (for details panel)
    displayMessage: string; // Cleaned message (for list view)
    payload: string;
    type: 'LOG' | 'JSON';
    json?: any;
    isSip: boolean;
    sipMethod?: string | null;
    callId?: string;
    // Correlation Fields
    reportId?: string;
    operatorId?: string;
    extensionId?: string;
    stationId?: string;
    sipFrom?: string;
    sipTo?: string;
    fileName?: string;
    fileColor?: string;
    // Phase 2 Optimization: Pre-computed lowercase strings for faster filtering
    _messageLower?: string; // Pre-computed lowercase message
    _componentLower?: string; // Pre-computed lowercase component
    _payloadLower?: string; // Pre-computed lowercase payload
    _callIdLower?: string; // Pre-computed lowercase callId
}

export interface LogState {
    logs: LogEntry[];
    filteredLogs: LogEntry[];
    loading: boolean;
    filterText: string;
    smartFilterActive: boolean;
    selectedLogId: number | null;
}

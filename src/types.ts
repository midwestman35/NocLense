export type LogLevel = 'INFO' | 'DEBUG' | 'ERROR' | 'WARN';
export type LogSourceType = 'apex' | 'datadog' | 'aws' | 'unknown';

export interface ImportedDataset {
    id: string;
    importBatchId: string;
    sourceType: LogSourceType;
    sourceLabel: string;
    fileName: string;
    kind: 'file' | 'paste';
    size: number;
    importedAt: number;
    logCount: number;
    warnings: string[];
}

export interface LogEntry {
    id: number;
    timestamp: number;
    rawTimestamp: string;
    level: LogLevel;
    component: string;
    displayComponent: string;
    message: string;
    displayMessage: string;
    payload: string;
    type: 'LOG' | 'JSON';
    json?: any;
    isSip: boolean;
    sipMethod?: string | null;
    callId?: string;
    reportId?: string;
    operatorId?: string;
    extensionId?: string;
    stationId?: string;
    sipFrom?: string;
    sipTo?: string;
    messageType?: string;
    cncID?: string;
    messageID?: string;
    summaryMessage?: string;
    fileName?: string;
    fileColor?: string;
    sourceType?: LogSourceType;
    sourceLabel?: string;
    importBatchId?: string;
    importedAt?: number;
    _messageLower?: string;
    _componentLower?: string;
    _payloadLower?: string;
    _callIdLower?: string;
    embedding?: number[];
    hasEmbedding?: boolean;
}

export interface LogState {
    logs: LogEntry[];
    filteredLogs: LogEntry[];
    loading: boolean;
    filterText: string;
    smartFilterActive: boolean;
    selectedLogId: number | null;
}

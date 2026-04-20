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
    displayTimestamp?: string;
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

    /**
     * Phase 00 additions (UI polish redesign — canonical citation model).
     * All optional for backward compatibility with existing parsers.
     * See docs/superpowers/specs/2026-04-20-ui-polish-redesign-design.md §5.3.
     */

    /** First-class correlation field extracted from OC-format JSON body. */
    traceId?: string;
    /** 1-based line number in the source file where this entry starts. */
    lineNumber?: number;
    /** Byte offset where this entry starts in the source file. Stable citation locator. */
    byteOffset?: number;
    /** True when the JSON body failed to parse. Entry still renders with muted marker. */
    jsonMalformed?: boolean;
}

export interface LogState {
    logs: LogEntry[];
    filteredLogs: LogEntry[];
    loading: boolean;
    filterText: string;
    smartFilterActive: boolean;
    selectedLogId: number | null;
}

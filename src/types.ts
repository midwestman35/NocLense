export type LogLevel = 'INFO' | 'DEBUG' | 'ERROR' | 'WARN';

export interface LogEntry {
    id: number;
    timestamp: number;
    rawTimestamp: string;
    level: LogLevel;
    component: string;
    message: string;
    payload: string;
    type: 'LOG' | 'JSON';
    json?: any;
    isSip: boolean;
    sipMethod?: string | null;
    callId?: string;
}

export interface LogState {
    logs: LogEntry[];
    filteredLogs: LogEntry[];
    loading: boolean;
    filterText: string;
    smartFilterActive: boolean;
    selectedLogId: number | null;
}

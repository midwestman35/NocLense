import { format } from 'date-fns';
import type { LogEntry } from '../types';

const LOG_TIMESTAMP_PATTERN = 'MM/dd HH:mm:ss.SSS';
const logTimestampCache = new Map<number, string>();

export const formatLogTimestamp = (timestamp: number): string => format(new Date(timestamp), LOG_TIMESTAMP_PATTERN);

export const getLogDisplayTimestamp = (log: Pick<LogEntry, 'id' | 'timestamp' | 'displayTimestamp'>): string => {
    if (log.displayTimestamp) return log.displayTimestamp;

    const cached = logTimestampCache.get(log.id);
    if (cached) return cached;

    const formatted = formatLogTimestamp(log.timestamp);
    logTimestampCache.set(log.id, formatted);
    return formatted;
};

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { LogEntry, LogState } from '../types';

interface LogContextType extends LogState {
    setLogs: (logs: LogEntry[]) => void;
    setLoading: (loading: boolean) => void;
    setFilterText: (text: string) => void;
    setSmartFilterActive: (active: boolean) => void;
    setSipOnly: (active: boolean) => void;
    setSelectedLogId: (id: number | null) => void;
    addLogs: (newLogs: LogEntry[]) => void;
    clearLogs: () => void;
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
    const [smartFilterActive, setSmartFilterActive] = useState(false);
    const [sipOnly, setSipOnly] = useState(false);
    const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

    // Computed filtered logs
    const filteredLogs = useMemo(() => {
        if (!logs.length) return [];

        return logs.filter(log => {
            // Smart Filter Logic
            if (smartFilterActive) {
                if (log.level === 'DEBUG') return false;
                if (log.message.includes('OPTIONS sip:')) return false;
                if (log.sipMethod === 'OPTIONS') return false;
                if (log.sipMethod === 'OPTIONS') return false;
            }

            // SIP Only Logic
            if (sipOnly && !log.isSip) {
                return false;
            }

            // Text Search Logic
            if (filterText) {
                const lowerFilter = filterText.toLowerCase();
                const matchContent =
                    log.message.toLowerCase().includes(lowerFilter) ||
                    (log.payload && log.payload.toLowerCase().includes(lowerFilter)) ||
                    log.component.toLowerCase().includes(lowerFilter);

                if (!matchContent) return false;
            }

            return true;
        });
    }, [logs, filterText, smartFilterActive, sipOnly]);

    const addLogs = (newLogs: LogEntry[]) => {
        setLogs(prevLogs => {
            // Combine and sort by timestamp
            const combined = [...prevLogs, ...newLogs].sort((a, b) => a.timestamp - b.timestamp);
            return combined;
        });
    };

    const clearLogs = () => {
        setLogs([]);
        setSelectedLogId(null);
        setFilterText("");
    };

    const value = {
        logs,
        setLogs,
        loading,
        setLoading,
        filterText,
        setFilterText,
        smartFilterActive,
        setSmartFilterActive,
        sipOnly,
        setSipOnly,
        filteredLogs,
        selectedLogId,
        setSelectedLogId,
        addLogs,
        clearLogs
    };

    return (
        <LogContext.Provider value={value}>
            {children}
        </LogContext.Provider>
    );
};

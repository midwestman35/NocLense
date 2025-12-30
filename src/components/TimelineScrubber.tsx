import { useMemo } from 'react';
import { useLogContext } from '../contexts/LogContext';
import type { LogEntry } from '../types';

const TimelineScrubber = () => {
    const { logs, setSelectedLogId } = useLogContext();

    const { minTime, duration, relevantLogs } = useMemo(() => {
        if (!logs.length) return { minTime: 0, maxTime: 0, duration: 1, relevantLogs: [] };

        const minTime = logs[0].timestamp;
        const maxTime = logs[logs.length - 1].timestamp; // Assumed sorted
        const duration = maxTime - minTime || 1;

        // Filter only interesting logs for the timeline to improve performance
        const relevantLogs = logs.filter(l =>
            l.level === 'ERROR' ||
            (l.isSip && ['INVITE', 'BYE', 'CANCEL'].includes(l.sipMethod || ''))
        );

        return { minTime, maxTime, duration, relevantLogs };
    }, [logs]);

    const getPosition = (ts: number) => {
        return ((ts - minTime) / duration) * 100;
    };

    const getColor = (log: LogEntry) => {
        if (log.level === 'ERROR') return '#ef4444'; // Red-500
        if (log.sipMethod === 'INVITE') return '#22c55e'; // Green-500
        if (log.sipMethod === 'BYE' || log.sipMethod === 'CANCEL') return '#eab308'; // Yellow-500
        return 'gray';
    };

    if (!logs.length) return null;

    return (
        <div className="h-16 bg-slate-800 border-t border-slate-700 relative select-none shrink-0">
            <div className="absolute inset-x-0 bottom-0 h-full w-full overflow-hidden">
                {/* Base line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-600 transform -translate-y-1/2"></div>

                {/* Markers */}
                {relevantLogs.map(log => (
                    <div
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className="absolute top-1/2 w-1.5 h-6 cursor-pointer transform -translate-y-1/2 hover:scale-125 transition-transform hover:z-10"
                        style={{
                            left: `${getPosition(log.timestamp)}%`,
                            backgroundColor: getColor(log),
                            borderRadius: '2px',
                            opacity: 0.8
                        }}
                        title={`${new Date(log.timestamp).toLocaleTimeString()} - ${log.level} - ${log.message}`}
                    ></div>
                ))}
            </div>

            {/* Time Labels */}
            <div className="absolute bottom-1 left-2 text-xs text-slate-500">
                {new Date(minTime).toLocaleTimeString()}
            </div>
            <div className="absolute bottom-1 right-2 text-xs text-slate-500">
                {new Date(minTime + duration).toLocaleTimeString()}
            </div>
        </div>
    );
};

export default TimelineScrubber;

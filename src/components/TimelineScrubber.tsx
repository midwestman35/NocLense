import { useMemo } from 'react';
import { useLogContext } from '../contexts/LogContext';
import type { LogEntry } from '../types';
import { format } from 'date-fns';

interface TimelineScrubberProps {
    height?: number;
}

const TimelineScrubber: React.FC<TimelineScrubberProps> = ({ height = 48 }) => {
    const {
        logs,
        filteredLogs,
        setSelectedLogId,
        visibleRange,
        timelineViewMode,
        setTimelineViewMode,
        setScrollTargetTimestamp
    } = useLogContext();

    // Decide which logs to show on timeline
    const sourceLogs = timelineViewMode === 'full' ? logs : filteredLogs;

    const { minTime, duration, relevantLogs, fileSegments } = useMemo(() => {
        if (!sourceLogs.length) return { minTime: 0, duration: 1, relevantLogs: [], fileSegments: [] };

        const minTime = sourceLogs[0].timestamp;
        const maxTime = sourceLogs[sourceLogs.length - 1].timestamp;
        const duration = maxTime - minTime || 1;

        // 1. Filter interesting logs for markers (Errors & SIP Methods)
        const relevantLogs = sourceLogs.filter(l =>
            l.level === 'ERROR' ||
            (l.isSip && ['INVITE', 'BYE', 'CANCEL'].includes(l.sipMethod || ''))
        );

        // 2. Compute File Segments for the "File Lane"
        // We cluster logs by fileName to show colored bars
        const fileSegments: { fileName: string, color: string, start: number, end: number }[] = [];
        if (sourceLogs.length > 0) {
            let currentSegment = {
                fileName: sourceLogs[0].fileName || 'Unknown',
                color: sourceLogs[0].fileColor || '#64748b',
                start: sourceLogs[0].timestamp,
                end: sourceLogs[0].timestamp
            };

            for (let i = 1; i < sourceLogs.length; i++) {
                const log = sourceLogs[i];
                const logFileName = log.fileName || 'Unknown';

                // If file changes or large gap (optional), start new segment
                // For now, just change on filename
                if (logFileName !== currentSegment.fileName) {
                    fileSegments.push(currentSegment);
                    currentSegment = {
                        fileName: logFileName,
                        color: log.fileColor || '#64748b',
                        start: log.timestamp,
                        end: log.timestamp
                    };
                } else {
                    currentSegment.end = log.timestamp;
                }
            }
            fileSegments.push(currentSegment);
        }

        return { minTime, duration, relevantLogs, fileSegments };
    }, [sourceLogs]);

    const getPosition = (ts: number) => {
        return ((ts - minTime) / duration) * 100;
    };

    const getWidth = (start: number, end: number) => {
        const w = ((end - start) / duration) * 100;
        return Math.max(w, 0.5); // Min width 0.5%
    };

    const getColor = (log: LogEntry) => {
        if (log.level === 'ERROR') return '#ef4444'; // Red-500
        if (log.sipMethod === 'INVITE') return '#22c55e'; // Green-500
        if (log.sipMethod === 'BYE' || log.sipMethod === 'CANCEL') return '#eab308'; // Yellow-500
        return 'gray';
    };

    // Scrubbing Logic
    const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only scrub if main button pressed (handled by click/drag)
        if (e.buttons !== 1 && e.type !== 'click') return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const targetTime = minTime + (percentage * duration);

        setScrollTargetTimestamp(targetTime);
    };

    if (!logs.length) return null;

    return (
        <div className="flex flex-col bg-slate-800 border-t border-slate-700 shrink-0 select-none">
            {/* Controls Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 text-[10px] text-slate-400 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Timeline</span>
                    <label className="flex items-center cursor-pointer hover:text-slate-200">
                        <input
                            type="checkbox"
                            className="mr-1 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                            checked={timelineViewMode === 'full'}
                            onChange={() => setTimelineViewMode(timelineViewMode === 'full' ? 'filtered' : 'full')}
                        />
                        Show All Logs ({timelineViewMode === 'full' ? 'On' : 'Off'})
                    </label>
                </div>
                <div>
                    {format(new Date(minTime), 'HH:mm:ss')} - {format(new Date(minTime + duration), 'HH:mm:ss')}
                </div>
            </div>

            {/* Timeline Area (Dynamic Height) */}
            <div
                className="relative w-full overflow-hidden group cursor-crosshair"
                style={{ height }}
                onMouseDown={handleScrub}
                onMouseMove={handleScrub}
            >
                {/* 1. File Lane (Top Strip) */}
                <div className="absolute top-0 left-0 right-0 h-4 flex pointer-events-none opacity-90 z-20">
                    {fileSegments.map((seg, idx) => (
                        <div
                            key={idx}
                            title={`File: ${seg.fileName}`}
                            className="h-full border-r border-slate-900/20 box-border text-[9px] text-white/90 px-1 overflow-hidden whitespace-nowrap flex items-center shadow-sm"
                            style={{
                                position: 'absolute',
                                left: `${getPosition(seg.start)}%`,
                                width: `${getWidth(seg.start, seg.end)}%`,
                                backgroundColor: seg.color
                            }}
                        >
                            {seg.fileName}
                        </div>
                    ))}
                </div>

                {/* 2. Base Line */}
                <div className="absolute top-[60%] left-0 right-0 h-px bg-slate-600 transform -translate-y-1/2"></div>

                {/* 3. Event Markers */}
                {relevantLogs.map(log => (
                    <div
                        key={log.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedLogId(log.id); }}
                        className="absolute top-[60%] w-1 h-3 cursor-pointer transform -translate-y-1/2 hover:scale-150 hover:z-30 transition-all opacity-80 hover:opacity-100"
                        style={{
                            left: `${getPosition(log.timestamp)}%`,
                            backgroundColor: getColor(log),
                            borderRadius: '1px'
                        }}
                        title={`${format(new Date(log.timestamp), 'HH:mm:ss')} - ${log.level} - ${log.message}\nFile: ${log.fileName || 'Unknown'}`}
                    ></div>
                ))}

                {/* 4. Viewport Indicator (Window) */}
                {visibleRange.start > 0 && (
                    <div
                        className="absolute top-0 bottom-0 bg-white/10 border-x border-white/30 pointer-events-none z-10"
                        style={{
                            left: `${getPosition(visibleRange.start)}%`,
                            width: `${Math.max(getPosition(visibleRange.end) - getPosition(visibleRange.start), 0.5)}%`
                        }}
                    ></div>
                )}
            </div>
        </div>
    );
};

export default TimelineScrubber;

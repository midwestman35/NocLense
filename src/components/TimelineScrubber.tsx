import { useMemo, useState } from 'react';
import { useLogContext } from '../contexts/LogContext';
import type { LogEntry } from '../types';
import { format } from 'date-fns';
import { stc, getSipColorHex } from '../utils/colorUtils';
import clsx from 'clsx';

interface TimelineScrubberProps {
    height?: number;
}

// No local stringToColor needed, use stc from colorUtils

const TimelineScrubber: React.FC<TimelineScrubberProps> = ({ height = 80 }) => {
    const {
        logs,
        filteredLogs,
        selectedLogId,
        setSelectedLogId,
        visibleRange,
        hasActiveFilters,
        setScrollTargetTimestamp,
        timelineEventFilters,
        setTimelineEventFilters,
        setHoveredCallId,
        hoveredCallId,
        hoveredCorrelation
    } = useLogContext();

    // Full scope by default; use filtered logs only when filters are actually selected
    const MAX_TIMELINE_EVENTS = 10000;
    const sourceLogsRaw = hasActiveFilters ? filteredLogs : logs;
    const sourceLogs = useMemo(() => {
        let limitedLogs = sourceLogsRaw;
        if (sourceLogsRaw.length > MAX_TIMELINE_EVENTS) {
            const step = Math.ceil(sourceLogsRaw.length / MAX_TIMELINE_EVENTS);
            limitedLogs = sourceLogsRaw.filter((_, idx) => idx % step === 0).slice(0, MAX_TIMELINE_EVENTS);
        }
        if (hasActiveFilters) return limitedLogs;
        const needsSort = limitedLogs.length > 1 && limitedLogs.some((log, idx) =>
            idx > 0 && limitedLogs[idx - 1].timestamp > log.timestamp
        );
        return needsSort ? [...limitedLogs].sort((a, b) => a.timestamp - b.timestamp) : limitedLogs;
    }, [sourceLogsRaw, hasActiveFilters]);

    const { minTime, duration, relevantLogs, fileSegments, callSegments, maxLanes } = useMemo(() => {
        if (!sourceLogs.length) return { minTime: 0, duration: 1, relevantLogs: [], fileSegments: [], callSegments: [], maxLanes: 0 };

        const minTime = sourceLogs[0].timestamp;
        const maxTime = sourceLogs[sourceLogs.length - 1].timestamp;
        const duration = maxTime - minTime || 1;

        // 1. Filter interesting logs for markers (Errors & SIP Methods)
        const relevantLogs = sourceLogs.filter(l => {
            // Global Error filter (Levels)
            if (l.level === 'ERROR' && !timelineEventFilters.error) return false;

            if (l.isSip) {
                const m = (l.sipMethod || '').toUpperCase();

                if (m === 'OPTIONS') return timelineEventFilters.options;
                if (/^[1]/.test(m)) return timelineEventFilters.provisional;
                if (/^2/.test(m)) return timelineEventFilters.success;
                if (/^[456]/.test(m)) return timelineEventFilters.error;
                if (['REGISTER', 'NOTIFY', 'SUBSCRIBE', 'PUBLISH'].includes(m)) return timelineEventFilters.keepAlive;

                // Fallback for general requests (INVITE, BYE, CANCEL, ACK, etc.)
                return timelineEventFilters.requests;
            }

            return l.level === 'ERROR';
        });

        // 2. Compute File Segments (gaps not rendered in compact view)
        const fileSegments: { fileName: string, color: string, start: number, end: number, duration: number }[] = [];

        if (sourceLogs.length > 0) {
            let currentSegment = {
                fileName: sourceLogs[0].fileName || 'Unknown',
                color: sourceLogs[0].fileColor || '#64748b',
                start: sourceLogs[0].timestamp,
                end: sourceLogs[0].timestamp,
                duration: 0
            };

            for (let i = 1; i < sourceLogs.length; i++) {
                const log = sourceLogs[i];
                const logFileName = log.fileName || 'Unknown';

                if (logFileName !== currentSegment.fileName) {
                    currentSegment.duration = currentSegment.end - currentSegment.start;
                    fileSegments.push(currentSegment);

                    currentSegment = {
                        fileName: logFileName,
                        color: log.fileColor || '#64748b',
                        start: log.timestamp,
                        end: log.timestamp,
                        duration: 0
                    };
                } else {
                    currentSegment.end = log.timestamp;
                }
            }
            currentSegment.duration = currentSegment.end - currentSegment.start;
            fileSegments.push(currentSegment);
        }

        // 3. Compute Call Segments (Sessions) with Laning
        const callGroups: Record<string, { start: number, end: number, count: number, id: string }> = {};
        sourceLogs.forEach(log => {
            if (log.callId) {
                if (!callGroups[log.callId]) {
                    callGroups[log.callId] = { start: log.timestamp, end: log.timestamp, count: 0, id: log.callId };
                }
                callGroups[log.callId].end = log.timestamp;
                callGroups[log.callId].count++;
            }
        });

        // Phase 2 Optimization: Sort calls once
        const sortedCalls = Object.values(callGroups).sort((a, b) => a.start - b.start);
        const lanes: number[] = [];
        const callSegments = sortedCalls.map(seg => {
            let laneIndex = 0;
            // 2s buffer between calls in same lane
            while (lanes[laneIndex] !== undefined && lanes[laneIndex] > seg.start - 2000) {
                laneIndex++;
            }
            lanes[laneIndex] = seg.end;
            return { ...seg, laneIndex };
        });

        // Phase 2 Optimization: Use Map for O(1) lookup instead of O(n) find in loop
        // This changes O(n²) to O(n) complexity - critical for large datasets
        const callIdToLaneMap = new Map<string, number>();
        callSegments.forEach(seg => {
            callIdToLaneMap.set(seg.id, (seg as any).laneIndex);
        });

        const logsWithLanes = relevantLogs.map(log => {
            const laneIndex = log.callId ? (callIdToLaneMap.get(log.callId) ?? 0) : 0;
            return { ...log, laneIndex };
        });

        return { minTime, duration, relevantLogs: logsWithLanes, fileSegments, callSegments, maxLanes: lanes.length };
    }, [sourceLogs, timelineEventFilters]); // Re-calc when filters change

    // Linear time mapping: full time range (first event → last event) maps to 0% → 100% width.
    // This ensures events span from one side to the other instead of clustering by file segments.
    const getPosition = (ts: number) => {
        return ((ts - minTime) / duration) * 100;
    };

    const getWidth = (start: number, end: number) => {
        const w = ((end - start) / duration) * 100;
        return Math.max(w, 0.2);
    };

    const getColor = (log: LogEntry) => {
        if (log.level === 'ERROR') return '#f43f5e'; // Rose-500
        if (log.isSip) {
            return getSipColorHex(log.sipMethod || null);
        }
        return '#94a3b8';
    };

    const isKeepAlive = (log: LogEntry) => {
        const m = (log.sipMethod || '').toUpperCase();
        return log.isSip && ['REGISTER', 'NOTIFY', 'SUBSCRIBE', 'PUBLISH'].includes(m);
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Compact view is always on; wheel zoom is disabled. Prevent wheel from scrolling the page when over the scrubber.
        e.preventDefault();
    };

    const [hoveredEvent, setHoveredEvent] = useState<{ log: LogEntry; x: number; y: number } | null>(null);

    // Phase 2 Optimization: Pre-index logs by callId for O(1) lookup instead of filtering on every hover
    // This prevents filtering entire logs array every time hover changes
    const logsByCallId = useMemo(() => {
        const index = new Map<string, LogEntry[]>();
        logs.forEach(log => {
            if (log.callId && log.isSip) {
                if (!index.has(log.callId)) {
                    index.set(log.callId, []);
                }
                index.get(log.callId)!.push(log);
            }
        });
        // Sort each call's logs once
        index.forEach((callLogs) => {
            callLogs.sort((a, b) => a.timestamp - b.timestamp);
        });
        return index;
    }, [logs]);

    // Get related logs for the flow tooltip - Phase 2 Optimized: O(1) lookup instead of O(n) filter
    const relatedFlowLogs = useMemo(() => {
        if (!hoveredEvent || !hoveredEvent.log.callId) return [];
        return logsByCallId.get(hoveredEvent.log.callId) || [];
    }, [hoveredEvent, logsByCallId]);
    const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.buttons !== 1 && e.type !== 'click') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;

        const targetTime = minTime + (percentage * duration);

        setScrollTargetTimestamp(targetTime);
    };

    if (!logs.length) return null;

    const startTime = minTime;
    const endTime = minTime + duration;

    return (
        <div className="flex flex-col bg-slate-800 border-t border-slate-700 shrink-0 select-none" style={{ height }}>
            {/* Controls Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 text-[10px] text-slate-400 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Time Range - Instrument Look */}
                    <div className="flex items-center gap-1 font-mono bg-slate-950/40 px-2 py-0.5 rounded border border-slate-700/50 text-[#94a3b8] text-[9px] min-w-[140px] justify-center">
                        <span className="text-emerald-400/90">{format(new Date(startTime), 'HH:mm:ss')}</span>
                        <span className="opacity-20 mx-1">—</span>
                        <span className="text-emerald-400/90">{format(new Date(endTime), 'HH:mm:ss')}</span>
                    </div>

                </div>

                <div className="flex items-center gap-3 ml-4 border-l border-slate-700 pl-4 overflow-x-auto no-scrollbar">
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#10b981] bg-slate-700 border-none focus:ring-0 checked:bg-[#10b981]"
                            checked={timelineEventFilters.requests} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, requests: !timelineEventFilters.requests })} />
                        <span className="text-[#10b981] group-hover:text-emerald-300">Requests</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#4ade80] bg-slate-700 border-none focus:ring-0 checked:bg-[#4ade80]"
                            checked={timelineEventFilters.success} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, success: !timelineEventFilters.success })} />
                        <span className="text-[#4ade80] group-hover:text-green-300">Success</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#22d3ee] bg-slate-700 border-none focus:ring-0 checked:bg-[#22d3ee]"
                            checked={timelineEventFilters.provisional} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, provisional: !timelineEventFilters.provisional })} />
                        <span className="text-[#22d3ee] group-hover:text-cyan-300">Provisional</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#f43f5e] bg-slate-700 border-none focus:ring-0 checked:bg-[#f43f5e]"
                            checked={timelineEventFilters.error} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, error: !timelineEventFilters.error })} />
                        <span className="text-[#f43f5e] group-hover:text-rose-300">Error</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#818cf8] bg-slate-700 border-none focus:ring-0 checked:bg-[#818cf8]"
                            checked={timelineEventFilters.options} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, options: !timelineEventFilters.options })} />
                        <span className="text-[#818cf8] group-hover:text-indigo-300">Options</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800 rounded px-1 group shrink-0">
                        <input type="checkbox" className="rounded-full w-2 h-2 text-[#64748b] bg-slate-700 border-none focus:ring-0 checked:bg-[#64748b]"
                            checked={timelineEventFilters.keepAlive} onChange={() => setTimelineEventFilters({ ...timelineEventFilters, keepAlive: !timelineEventFilters.keepAlive })} />
                        <span className="text-[#64748b] group-hover:text-slate-300">Other</span>
                    </label>
                </div>
            </div>


            {/* Timeline Area with Scrolling */}
            <div
                className="relative w-full flex-1 overflow-x-auto overflow-y-hidden group cursor-crosshair bg-slate-900/30 custom-scrollbar-h"
                onMouseDown={handleScrub}
                onMouseMove={handleScrub}
                onWheel={handleWheel}
            >
                <div
                    className="relative h-full"
                    style={{
                        width: '100%',
                        minHeight: `${40 + (maxLanes * 22)}px`
                    }}
                >
                    {/* 1. File Lane (Minimal Top Strip) */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 z-30 opacity-80">
                        {fileSegments.map((seg, idx) => (
                            <div
                                key={idx}
                                className="h-full border-r border-slate-900/20 box-border group/file"
                                style={{
                                    position: 'absolute',
                                    left: `${getPosition(seg.start)}%`,
                                    width: `${getWidth(seg.start, seg.end)}%`,
                                    backgroundColor: seg.color,
                                    minWidth: '2px'
                                }}
                                title={seg.fileName}
                            >
                                {/* File Label (Floating) */}
                                <div className="absolute top-2 left-1 whitespace-nowrap bg-slate-900/80 text-white px-1 py-0.5 rounded text-[8px] font-bold opacity-0 group-hover/file:opacity-100 transition-opacity z-50 border border-slate-700 pointer-events-none">
                                    {seg.fileName}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 2. Gaps */}

                    {/* 3. Call Sessions (Multi-track) */}
                    <div className="absolute top-4 left-0 right-0 bottom-0 z-10">
                        {callSegments.map((seg) => {
                            const isSelected = hoveredCallId === seg.id || (hoveredCorrelation?.type === 'callId' && hoveredCorrelation.value === seg.id);
                            return (
                                <div
                                    key={seg.id}
                                    title={`Call: ${seg.id} (${seg.count} events)`}
                                    className={clsx(
                                        "absolute h-5 rounded-md transition-all border border-white/5 shadow-sm group/call flex items-center",
                                        isSelected ? "opacity-100 z-50 ring-2 ring-yellow-400/50 bg-yellow-400/10" : "opacity-40 hover:opacity-70"
                                    )}
                                    style={{
                                        left: `${getPosition(seg.start)}%`,
                                        width: `${getWidth(seg.start, seg.end)}%`,
                                        top: `${(seg as any).laneIndex * 22}px`,
                                        backgroundColor: `${stc(seg.id)}55`
                                    }}
                                    onMouseEnter={() => setHoveredCallId(seg.id)}
                                    onMouseLeave={() => setHoveredCallId(null)}
                                >
                                    <span className="text-[10px] text-white/90 px-1 truncate w-full block leading-none font-mono">
                                        {seg.id}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 4. Event Markers (Tall bars sticking up from lanes) */}
                    <div className="absolute top-4 left-0 right-0 bottom-0 z-20 pointer-events-none">
                        {relevantLogs.map(log => {
                            const keepAlive = isKeepAlive(log);
                            const laneTop = (log as any).laneIndex * 22;
                            const isSelected = log.id === selectedLogId;

                            return (
                                <div
                                    key={log.id}
                                    className={clsx(
                                        "absolute cursor-pointer pointer-events-auto transition-all",
                                        keepAlive ? "h-2 w-1 rounded-full opacity-40 top-0.5" : "h-5 opacity-90 shadow-[0_0_5px_rgba(0,0,0,0.5)] w-[2px] hover:w-[4px] hover:z-50",
                                        isSelected ? "z-[60] w-[4px] ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900" : ""
                                    )}
                                    style={{
                                        left: `${getPosition(log.timestamp)}%`,
                                        top: `${laneTop}px`,
                                        backgroundColor: isSelected ? '#fbbf24' : getColor(log), // Gold if selected
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedLogId(log.id === selectedLogId ? null : log.id); }}
                                    onMouseEnter={() => {
                                        setHoveredCallId(log.callId || null);
                                        setHoveredEvent({ log, x: getPosition(log.timestamp), y: laneTop });
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredCallId(null);
                                        setHoveredEvent(null);
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* 5. Flow Tooltip */}
                    {hoveredEvent && relatedFlowLogs.length > 0 && (
                        <div
                            className="absolute z-[100] bg-slate-900/95 border border-slate-700 rounded shadow-2xl p-2 pointer-events-none backdrop-blur-sm min-w-[200px]"
                            style={{
                                left: `${hoveredEvent.x}%`,
                                top: `${hoveredEvent.y + 25}px`,
                                transform: hoveredEvent.x > 80 ? 'translateX(-100%)' : 'none'
                            }}
                        >
                            <div className="text-[9px] font-bold text-slate-500 mb-1 flex justify-between items-center">
                                <span className="truncate max-w-[120px]">{hoveredEvent.log.callId}</span>
                                <span>{relatedFlowLogs.length} events</span>
                            </div>
                            <div className="flex flex-col gap-0.5 max-h-[150px] overflow-y-auto no-scrollbar">
                                {relatedFlowLogs.map((rl) => (
                                    <div
                                        key={rl.id}
                                        className={clsx(
                                            "flex items-center gap-1.5 px-1 rounded text-[9px] py-0.5",
                                            rl.id === hoveredEvent.log.id ? "bg-slate-700/50" : "opacity-70"
                                        )}
                                    >
                                        <div
                                            className="w-1.5 h-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: getSipColorHex(rl.sipMethod || null) }}
                                        />
                                        <span className="font-mono text-slate-400 shrink-0">{format(new Date(rl.timestamp), 'HH:mm:ss')}</span>
                                        <span className="font-bold text-slate-200 truncate">{rl.sipMethod || rl.message.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Connector line */}
                            <div className="absolute -top-1.5 left-2 w-3 h-3 bg-slate-900 border-l border-t border-slate-700 transform rotate-45" style={{ left: hoveredEvent.x > 80 ? 'calc(100% - 12px)' : '8px' }} />
                        </div>
                    )}

                    {/* 5. Viewport Indicator */}
                    {visibleRange.start > 0 && (
                        <div
                            className="absolute top-0 bottom-0 bg-white/5 border-x border-white/20 pointer-events-none z-10"
                            style={{
                                left: `${getPosition(visibleRange.start)}%`,
                                width: `${Math.max(getPosition(visibleRange.end) - getPosition(visibleRange.start), 0.1)}%`
                            }}
                        />
                    )}
                </div>
            </div>
        </div >
    );
};

export default TimelineScrubber;

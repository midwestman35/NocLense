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
        timelineViewMode,
        setTimelineViewMode,
        setScrollTargetTimestamp,
        isTimelineCompact,
        setIsTimelineCompact,
        timelineZoomRange,
        setTimelineZoomRange,
        timelineEventFilters,
        setTimelineEventFilters,
        setHoveredCallId,
        hoveredCallId,
        hoveredCorrelation
    } = useLogContext();


    // Decide which logs to show on timeline
    // Phase 2 Optimization: filteredLogs is already sorted, so only sort if using 'full' mode or if order changed
    const sourceLogsRaw = timelineViewMode === 'full' ? logs : filteredLogs;
    const sourceLogs = useMemo(() => {
        // filteredLogs is already sorted, so only sort for 'full' mode or if timestamps aren't already sorted
        if (timelineViewMode === 'filtered') {
            // filteredLogs should already be sorted, so we can use it directly
            return sourceLogsRaw;
        }
        // For 'full' mode, check if already sorted, otherwise sort
        const needsSort = sourceLogsRaw.length > 1 && sourceLogsRaw.some((log, idx) => 
            idx > 0 && sourceLogsRaw[idx - 1].timestamp > log.timestamp
        );
        return needsSort ? [...sourceLogsRaw].sort((a, b) => a.timestamp - b.timestamp) : sourceLogsRaw;
    }, [sourceLogsRaw, timelineViewMode]);

    const { minTime, duration, relevantLogs, fileSegments, callSegments, gaps, maxLanes } = useMemo(() => {
        if (!sourceLogs.length) return { minTime: 0, duration: 1, relevantLogs: [], fileSegments: [], callSegments: [], gaps: [], maxLanes: 0 };

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

        // 2. Compute File Segments and Gaps
        const fileSegments: { fileName: string, color: string, start: number, end: number, duration: number }[] = [];
        const gaps: { start: number, end: number, duration: number }[] = [];
        const GAP_THRESHOLD = 60000; // 1 minute

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

                    // Check for gap between previous end and new start
                    if (log.timestamp - currentSegment.end > GAP_THRESHOLD) {
                        gaps.push({
                            start: currentSegment.end,
                            end: log.timestamp,
                            duration: log.timestamp - currentSegment.end
                        });
                    }

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

        return { minTime, duration, relevantLogs: logsWithLanes, fileSegments, callSegments, gaps, maxLanes: lanes.length };
    }, [sourceLogs, timelineEventFilters]); // Re-calc when filters change

    // Compact Mode Coordinate Mapping
    const COMPACT_GAP_MS = 30000; // Visual gap weight (30s)

    // We pre-calculate cumulative offsets for segments in compact mode
    const compactMetadata = useMemo(() => {
        if (!isTimelineCompact) return null;

        let currentOffset = 0;
        const segmentOffsets: Record<number, number> = {}; // idx -> offset
        const gapOffsets: Record<number, number> = {}; // idx -> offset

        fileSegments.forEach((seg, idx) => {
            segmentOffsets[idx] = currentOffset;
            currentOffset += seg.duration;
            if (idx < fileSegments.length - 1) {
                gapOffsets[idx] = currentOffset;
                currentOffset += COMPACT_GAP_MS;
            }
        });

        return { totalDuration: currentOffset, segmentOffsets, gapOffsets };
    }, [isTimelineCompact, fileSegments]);

    const getPosition = (ts: number) => {
        // Apply Zoom if active (and not in compact mode for now, or handle both??)
        // Let's support zoom on top of current view.
        if (timelineZoomRange && !isTimelineCompact) { // Compact mode zoom is tricky, let's disable zoom in compact for V1 or handle mapped time.
            // Actually, simplest is to Map global time -> % -> then Zoom transforms that %.
            // But for now let's apply zoom to Local Duration.

            // Linear Mode Zoom:
            const zoomDuration = timelineZoomRange.end - timelineZoomRange.start;
            return ((ts - timelineZoomRange.start) / zoomDuration) * 100;
        }

        if (!isTimelineCompact || !compactMetadata) {
            return ((ts - minTime) / duration) * 100;
        }

        // Phase 2 Optimization: Optimize segment lookup for compact mode
        // For typical use (1-10 files), linear search is fine. For 50+ files, could use binary search
        // But fileSegments is typically small, so O(n) where n=number of files is acceptable
        for (let i = 0; i < fileSegments.length; i++) {
            const seg = fileSegments[i];
            if (ts >= seg.start && ts <= seg.end) {
                const offset = compactMetadata.segmentOffsets[i];
                return ((offset + (ts - seg.start)) / compactMetadata.totalDuration) * 100;
            }
            // Phase 2: Early exit optimization - if timestamp is before this segment, we're done
            // (Segments are sorted by start time)
            if (i < fileSegments.length - 1 && ts < seg.start) {
                break;
            }
            // If between segments, put it at the gap or closest segment
            if (i < fileSegments.length - 1 && ts > seg.end && ts < fileSegments[i + 1].start) {
                const gapOffset = compactMetadata.gapOffsets[i];
                const gapDuration = fileSegments[i + 1].start - seg.end;
                const progressInGap = (ts - seg.end) / gapDuration;
                return ((gapOffset + (progressInGap * COMPACT_GAP_MS)) / compactMetadata.totalDuration) * 100;
            }
        }

        // Fallback
        return ((ts - minTime) / duration) * 100;
    };

    const getWidth = (start: number, end: number) => {
        if (timelineZoomRange && !isTimelineCompact) {
            const zoomDuration = timelineZoomRange.end - timelineZoomRange.start;
            const w = ((end - start) / zoomDuration) * 100;
            return Math.max(w, 0.2);
        }

        if (!isTimelineCompact || !compactMetadata) {
            const w = ((end - start) / duration) * 100;
            return Math.max(w, 0.2);
        }

        // For segments themselves
        const w = ((end - start) / compactMetadata.totalDuration) * 100;
        return Math.max(w, 0.1);
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
        if (isTimelineCompact) return;

        // If Shift is held, allow native horizontal scrolling
        if (e.shiftKey) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const relativeX = (mouseX + e.currentTarget.scrollLeft) / (rect.width * (zoomLevel || 1));

        const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
        const newZoom = Math.min(100, Math.max(1, (zoomLevel || 1) * zoomFactor));

        // Anchor zoom on mouse
        const newScrollLeft = (relativeX * rect.width * newZoom) - mouseX;
        setZoomLevel(newZoom);

        // Use requestAnimationFrame to ensure the scroll happens after the width update
        const target = e.currentTarget;
        requestAnimationFrame(() => {
            target.scrollLeft = newScrollLeft;
        });
    };

    const [zoomLevel, setZoomLevel] = useState(1);
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

        let targetTime;
        if (timelineZoomRange && !isTimelineCompact) {
            const zoomDuration = timelineZoomRange.end - timelineZoomRange.start;
            targetTime = timelineZoomRange.start + (percentage * zoomDuration);
        } else {
            targetTime = minTime + (percentage * duration);
        }

        setScrollTargetTimestamp(targetTime);
    };

    if (!logs.length) return null;

    const startTime = timelineZoomRange && !isTimelineCompact ? timelineZoomRange.start : minTime;
    const endTime = timelineZoomRange && !isTimelineCompact ? timelineZoomRange.end : minTime + duration;

    return (
        <div className="flex flex-col bg-slate-800 border-t border-slate-700 shrink-0 select-none" style={{ height }}>
            {/* Controls Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 text-[10px] text-slate-400 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2">
                    {/* View Mode Tabs */}
                    <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 mr-2">
                        <button
                            onClick={() => setTimelineViewMode('filtered')}
                            className={clsx(
                                "px-2 py-0.5 rounded transition-all",
                                timelineViewMode === 'filtered' ? "bg-slate-700 text-slate-100 shadow-sm font-semibold" : "hover:text-slate-200"
                            )}
                        >
                            Filtered
                        </button>
                        <button
                            onClick={() => setTimelineViewMode('full')}
                            className={clsx(
                                "px-2 py-0.5 rounded transition-all",
                                timelineViewMode === 'full' ? "bg-slate-700 text-slate-100 shadow-sm font-semibold" : "hover:text-slate-200"
                            )}
                        >
                            Full Scope
                        </button>
                    </div>

                    <div className="h-4 w-[1px] bg-slate-700 mx-1" />

                    <label className="flex items-center cursor-pointer hover:text-slate-200 select-none ml-2 gap-1.5">
                        <input
                            type="checkbox"
                            className="mr-1 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                            checked={isTimelineCompact}
                            onChange={() => setIsTimelineCompact(!isTimelineCompact)}
                        />
                        Compact
                    </label>

                    <div className="h-4 w-[1px] bg-slate-700 mx-2" />

                    {/* Time Range - Instrument Look */}
                    <div className="flex items-center gap-1 font-mono bg-slate-950/40 px-2 py-0.5 rounded border border-slate-700/50 text-[#94a3b8] text-[9px] min-w-[140px] justify-center">
                        <span className="text-emerald-400/90">{format(new Date(startTime), 'HH:mm:ss')}</span>
                        <span className="opacity-20 mx-1">—</span>
                        <span className="text-emerald-400/90">{format(new Date(endTime), 'HH:mm:ss')}</span>
                    </div>

                    {timelineZoomRange && !isTimelineCompact && (
                        <button
                            onClick={() => setTimelineZoomRange(null)}
                            className="ml-2 px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[9px] uppercase font-bold transition-colors"
                        >
                            Reset Zoom
                        </button>
                    )}
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
                        width: `${zoomLevel * 100}%`,
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
                    {!isTimelineCompact && gaps.map((gap, idx) => (
                        <div
                            key={`gap-${idx}`}
                            className="absolute h-full flex flex-col items-center justify-center opacity-30 pointer-events-none border-x border-dashed border-slate-600/50 bg-slate-500/5"
                            style={{
                                left: `${getPosition(gap.start)}%`,
                                width: `${getWidth(gap.start, gap.end)}%`
                            }}
                        />
                    ))}

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

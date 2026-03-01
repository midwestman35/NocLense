import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useLogContext } from '../contexts/LogContext';
import type { LogEntry } from '../types';
import { format } from 'date-fns';
import { getSipColorHex } from '../utils/colorUtils';
import clsx from 'clsx';
import {
    drawTimeline,
    type BucketData,
    type LogWithLane,
    type CallSegment,
    type FileSegment,
    LANE_H,
    SESSIONS_TOP,
} from '../utils/timelineCanvas';
import { dbManager } from '../utils/indexedDB';

interface TimelineScrubberProps {
    height?: number;
}

const MOUSE_DEBOUNCE_MS = 16; // one frame at 60fps

/**
 * Selective context subscription — only the 12 values TimelineScrubber actually uses.
 * Future unrelated context additions (sortConfig, searchHistory, etc.) will not
 * trigger timeline re-renders because they are not subscribed here.
 */
function useTimelineData() {
    const ctx = useLogContext();
    return {
        logs: ctx.logs,
        filteredLogs: ctx.filteredLogs,
        selectedLogId: ctx.selectedLogId,
        setSelectedLogId: ctx.setSelectedLogId,
        visibleRange: ctx.visibleRange,
        hasActiveFilters: ctx.hasActiveFilters,
        setScrollTargetTimestamp: ctx.setScrollTargetTimestamp,
        timelineEventFilters: ctx.timelineEventFilters,
        setTimelineEventFilters: ctx.setTimelineEventFilters,
        setHoveredCallId: ctx.setHoveredCallId,
        hoveredCallId: ctx.hoveredCallId,
        hoveredCorrelation: ctx.hoveredCorrelation,
        useIndexedDBMode: ctx.useIndexedDBMode,
    };
}

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
        hoveredCorrelation: _hoveredCorrelation,
        useIndexedDBMode,
    } = useTimelineData();

    // ── Refs ──────────────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);
    // Stores current hit-test data so mouse handlers can read it without
    // being recreated every time relevantLogs / callSegments change.
    const hitDataRef = useRef<{ logs: LogWithLane[]; segments: CallSegment[] }>({
        logs: [], segments: [],
    });
    // Stores latest draw options so the ResizeObserver can trigger a redraw
    // with the current state without closing over stale values.
    const drawOptsRef = useRef<Omit<Parameters<typeof drawTimeline>[0], 'canvas'>>({
        minTime: 0, duration: 1, fileSegments: [], callSegments: [],
        relevantLogs: [], visibleRange: { start: 0, end: 1 },
        selectedLogId: null, hoveredCallId: null, densityBuckets: null, maxLanes: 0,
    });
    const mouseMoveTimestampRef = useRef<number>(0);

    // ── Data computation (unchanged logic, same shape as before) ──────────────
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
        if (!sourceLogs.length) {
            return { minTime: 0, duration: 1, relevantLogs: [], fileSegments: [], callSegments: [], maxLanes: 0 };
        }

        const minTime = sourceLogs[0].timestamp;
        const maxTime = sourceLogs[sourceLogs.length - 1].timestamp;
        const duration = maxTime - minTime || 1;

        // Filter interesting logs for markers (Errors & SIP Methods)
        const relevantLogs = sourceLogs.filter(l => {
            if (l.level === 'ERROR' && !timelineEventFilters.error) return false;
            if (l.isSip) {
                const m = (l.sipMethod || '').toUpperCase();
                if (m === 'OPTIONS') return timelineEventFilters.options;
                if (/^[1]/.test(m)) return timelineEventFilters.provisional;
                if (/^2/.test(m)) return timelineEventFilters.success;
                if (/^[456]/.test(m)) return timelineEventFilters.error;
                if (['REGISTER', 'NOTIFY', 'SUBSCRIBE', 'PUBLISH'].includes(m)) return timelineEventFilters.keepAlive;
                return timelineEventFilters.requests;
            }
            return l.level === 'ERROR';
        });

        // Compute File Segments
        const fileSegments: FileSegment[] = [];
        if (sourceLogs.length > 0) {
            let cur = {
                fileName: sourceLogs[0].fileName || 'Unknown',
                color: sourceLogs[0].fileColor || '#64748b',
                start: sourceLogs[0].timestamp,
                end: sourceLogs[0].timestamp,
            };
            for (let i = 1; i < sourceLogs.length; i++) {
                const log = sourceLogs[i];
                const logFileName = log.fileName || 'Unknown';
                if (logFileName !== cur.fileName) {
                    fileSegments.push(cur);
                    cur = {
                        fileName: logFileName,
                        color: log.fileColor || '#64748b',
                        start: log.timestamp,
                        end: log.timestamp,
                    };
                } else {
                    cur.end = log.timestamp;
                }
            }
            fileSegments.push(cur);
        }

        // Compute Call Segments with laning
        const callGroups: Record<string, { start: number; end: number; count: number; id: string }> = {};
        for (const log of sourceLogs) {
            if (log.callId) {
                if (!callGroups[log.callId]) {
                    callGroups[log.callId] = { start: log.timestamp, end: log.timestamp, count: 0, id: log.callId };
                }
                callGroups[log.callId].end = log.timestamp;
                callGroups[log.callId].count++;
            }
        }
        const sortedCalls = Object.values(callGroups).sort((a, b) => a.start - b.start);
        const lanes: number[] = [];
        const callSegments: CallSegment[] = sortedCalls.map(seg => {
            let laneIndex = 0;
            while (lanes[laneIndex] !== undefined && lanes[laneIndex] > seg.start - 2000) laneIndex++;
            lanes[laneIndex] = seg.end;
            return { ...seg, laneIndex };
        });

        const callIdToLaneMap = new Map<string, number>();
        callSegments.forEach(seg => callIdToLaneMap.set(seg.id, seg.laneIndex));

        const logsWithLanes: LogWithLane[] = relevantLogs.map(log => ({
            ...log,
            laneIndex: log.callId ? (callIdToLaneMap.get(log.callId) ?? 0) : 0,
        }));

        return { minTime, duration, relevantLogs: logsWithLanes, fileSegments, callSegments, maxLanes: lanes.length };
    }, [sourceLogs, timelineEventFilters]);

    // Fix 2C: iterate sourceLogs (≤10k subsampled) instead of the raw logs array (up to 400k)
    const logsByCallId = useMemo(() => {
        const index = new Map<string, LogEntry[]>();
        sourceLogs.forEach(log => {
            if (log.callId && log.isSip) {
                if (!index.has(log.callId)) index.set(log.callId, []);
                index.get(log.callId)!.push(log);
            }
        });
        index.forEach(callLogs => callLogs.sort((a, b) => a.timestamp - b.timestamp));
        return index;
    }, [sourceLogs]); // was [logs] — now correctly bounded to ≤10k entries

    // ── IDB bucket state (Tier 3 — heatmap for IndexedDB mode) ───────────────
    const [idbBuckets, setIdbBuckets] = useState<BucketData[] | null>(null);
    useEffect(() => {
        if (!useIndexedDBMode) { setIdbBuckets(null); return; }
        let cancelled = false;
        dbManager.getTimestampBuckets(200).then(b => { if (!cancelled) setIdbBuckets(b); });
        return () => { cancelled = true; };
    }, [useIndexedDBMode, logs.length]); // re-fetch when files are added/removed

    // ── Keep hit-test data current ────────────────────────────────────────────
    useEffect(() => {
        hitDataRef.current = { logs: relevantLogs, segments: callSegments };
    }, [relevantLogs, callSegments]);

    // ── Canvas drawing — RAF-scheduled, with ResizeObserver for layout changes ─
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Update the ref so ResizeObserver always draws with the latest state
        drawOptsRef.current = {
            minTime, duration, fileSegments, callSegments, relevantLogs,
            visibleRange, selectedLogId, hoveredCallId, densityBuckets: idbBuckets, maxLanes,
        };

        const scheduleRedraw = () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                if (canvasRef.current) {
                    drawTimeline({ canvas: canvasRef.current, ...drawOptsRef.current });
                }
                rafRef.current = null;
            });
        };

        scheduleRedraw();

        const observer = new ResizeObserver(scheduleRedraw);
        observer.observe(canvas);

        return () => {
            observer.disconnect();
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [minTime, duration, fileSegments, callSegments, relevantLogs, visibleRange, selectedLogId, hoveredCallId, idbBuckets, maxLanes]);

    // ── Hover state for tooltip overlay ──────────────────────────────────────
    const [hoveredEvent, setHoveredEvent] = useState<{ log: LogWithLane; x: number; y: number } | null>(null);

    const relatedFlowLogs = useMemo(() => {
        if (!hoveredEvent || !hoveredEvent.log.callId) return [];
        return logsByCallId.get(hoveredEvent.log.callId) || [];
    }, [hoveredEvent, logsByCallId]);

    // ── Event handlers — all wrapped in useCallback (Fix 2A) ─────────────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
    }, []);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        // Fix 2B: debounce to ≤1 call per frame (16ms at 60fps)
        const now = performance.now();
        if (now - mouseMoveTimestampRef.current < MOUSE_DEBOUNCE_MS) return;
        mouseMoveTimestampRef.current = now;

        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const w = rect.width;
        const { logs: hitLogs, segments: hitSegments } = hitDataRef.current;

        // O(n) hit-test for nearest marker within ±4px on X axis (n ≤ 10,000)
        let bestLog: LogWithLane | null = null;
        let bestDist = 4;
        for (const log of hitLogs) {
            const lx = ((log.timestamp - minTime) / duration) * w;
            const dist = Math.abs(mouseX - lx);
            if (dist < bestDist) { bestDist = dist; bestLog = log; }
        }

        if (bestLog) {
            const lx = ((bestLog.timestamp - minTime) / duration) * w;
            setHoveredEvent({ log: bestLog, x: (lx / w) * 100, y: SESSIONS_TOP + bestLog.laneIndex * LANE_H });
            setHoveredCallId(bestLog.callId || null);
        } else {
            // Fallback: check if cursor is over a call session bar
            let foundCallId: string | null = null;
            for (const seg of hitSegments) {
                const sx = ((seg.start - minTime) / duration) * w;
                const sw = Math.max(((seg.end - seg.start) / duration) * w, 4);
                const top = SESSIONS_TOP + seg.laneIndex * LANE_H;
                if (mouseX >= sx && mouseX <= sx + sw && mouseY >= top && mouseY <= top + 20) {
                    foundCallId = seg.id;
                    break;
                }
            }
            setHoveredCallId(foundCallId);
            setHoveredEvent(null);
        }
    }, [minTime, duration, setHoveredCallId]);

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const w = rect.width;
        const { logs: hitLogs } = hitDataRef.current;

        // Slightly wider hit radius for click (6px) vs hover (4px)
        let bestLog: LogWithLane | null = null;
        let bestDist = 6;
        for (const log of hitLogs) {
            const lx = ((log.timestamp - minTime) / duration) * w;
            const dist = Math.abs(mouseX - lx);
            if (dist < bestDist) { bestDist = dist; bestLog = log; }
        }

        if (bestLog) {
            setSelectedLogId(bestLog.id === selectedLogId ? null : bestLog.id);
        } else {
            // No marker hit — scrub timeline to clicked position
            setScrollTargetTimestamp(minTime + (mouseX / w) * duration);
        }
    }, [minTime, duration, selectedLogId, setSelectedLogId, setScrollTargetTimestamp]);

    const handleCanvasMouseLeave = useCallback(() => {
        setHoveredCallId(null);
        setHoveredEvent(null);
    }, [setHoveredCallId]);

    // ── Early exit ────────────────────────────────────────────────────────────
    if (!logs.length) return null;

    const startTime = minTime;
    const endTime = minTime + duration;
    const canvasHeight = Math.max(40, SESSIONS_TOP + maxLanes * LANE_H + 4);

    return (
        <div className="flex flex-col bg-slate-800 border-t border-slate-700 shrink-0 select-none" style={{ height }}>
            {/* Controls Bar */}
            <div className="flex items-center justify-between px-2 py-1 bg-slate-900/50 text-[10px] text-slate-400 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center gap-2">
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

            {/* Timeline Area */}
            <div
                className="relative w-full flex-1 overflow-x-auto overflow-y-hidden group cursor-crosshair bg-slate-900/30 custom-scrollbar-h"
                onWheel={handleWheel}
            >
                <div
                    className="relative h-full"
                    style={{ width: '100%', minHeight: `${canvasHeight}px` }}
                >
                    {/* Single canvas replaces all DOM marker/session layers */}
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full block"
                        onMouseMove={handleCanvasMouseMove}
                        onClick={handleCanvasClick}
                        onMouseLeave={handleCanvasMouseLeave}
                    />

                    {/* Flow Tooltip — React overlay positioned by hit-test result */}
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
                            {/* Connector arrow */}
                            <div
                                className="absolute -top-1.5 w-3 h-3 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"
                                style={{ left: hoveredEvent.x > 80 ? 'calc(100% - 12px)' : '8px' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(TimelineScrubber);

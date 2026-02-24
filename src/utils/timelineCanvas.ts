/**
 * Canvas-based timeline drawing utility.
 * Pure function — no React, no DOM side effects other than drawing to the canvas.
 * Replaces up to 10,000 absolute-positioned DOM markers with a single GPU-composited layer.
 */

import { getSipColorHex, stc } from './colorUtils';
import type { LogEntry } from '../types';

export interface BucketData {
    bucketStart: number;
    bucketEnd: number;
    count: number;
    errorCount: number;
}

export interface FileSegment {
    fileName: string;
    color: string;
    start: number;
    end: number;
}

export interface CallSegment {
    id: string;
    start: number;
    end: number;
    count: number;
    laneIndex: number;
}

export type LogWithLane = LogEntry & { laneIndex: number };

export interface DrawTimelineOptions {
    canvas: HTMLCanvasElement;
    minTime: number;
    duration: number;
    fileSegments: FileSegment[];
    callSegments: CallSegment[];
    relevantLogs: LogWithLane[];
    visibleRange: { start: number; end: number };
    selectedLogId: number | null;
    hoveredCallId: string | null;
    densityBuckets?: BucketData[] | null;
    maxLanes: number;
}

export const FILE_STRIP_H = 6;
export const SESSIONS_TOP = FILE_STRIP_H + 10; // 16px offset from top for call session bars
export const LANE_H = 22;

const KEEP_ALIVE_METHODS = new Set(['REGISTER', 'NOTIFY', 'SUBSCRIBE', 'PUBLISH']);

export function drawTimeline(opts: DrawTimelineOptions): void {
    const {
        canvas, minTime, duration, fileSegments, callSegments, relevantLogs,
        visibleRange, selectedLogId, hoveredCallId, densityBuckets,
    } = opts;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.offsetWidth;
    const displayH = canvas.offsetHeight;

    // Resize backing store only when needed — avoids clearing context state unnecessarily
    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx || displayW === 0 || displayH === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayW, displayH);

    const w = displayW;
    const tsX = (ts: number) => ((ts - minTime) / duration) * w;
    const segW = (start: number, end: number) => Math.max(((end - start) / duration) * w, 1);

    // ── Layer 0: IDB density heatmap (greyed/rose tint background) ────────────
    if (densityBuckets && densityBuckets.length > 0) {
        const bw = w / densityBuckets.length;
        const maxCount = Math.max(...densityBuckets.map(b => b.count), 1);
        for (let i = 0; i < densityBuckets.length; i++) {
            const bucket = densityBuckets[i];
            if (bucket.count === 0) continue;
            const baseAlpha = (bucket.count / maxCount) * 0.18;
            const errorAlpha = (bucket.errorCount / bucket.count) * 0.22;
            ctx.fillStyle = errorAlpha > 0.01
                ? `rgba(244, 63, 94, ${errorAlpha})`    // rose tint for error clusters
                : `rgba(148, 163, 184, ${baseAlpha})`;  // slate tint for normal density
            ctx.fillRect(i * bw, 0, bw + 0.5, displayH);
        }
    }

    // ── Layer 1: File lane strip (top FILE_STRIP_H px) ────────────────────────
    ctx.globalAlpha = 0.8;
    for (const seg of fileSegments) {
        ctx.fillStyle = seg.color;
        ctx.fillRect(tsX(seg.start), 0, segW(seg.start, seg.end), FILE_STRIP_H);
    }
    ctx.globalAlpha = 1;

    // ── Layer 2: Call session bars (per lane) ─────────────────────────────────
    for (const seg of callSegments) {
        const sx = tsX(seg.start);
        const sw = Math.max(segW(seg.start, seg.end), 4);
        const top = SESSIONS_TOP + seg.laneIndex * LANE_H;
        const bh = 20;
        const isHovered = hoveredCallId === seg.id;
        const color = stc(seg.id);

        ctx.globalAlpha = isHovered ? 1.0 : 0.4;
        ctx.fillStyle = color + '55';

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(sx, top, sw, bh, 4);
        } else {
            ctx.rect(sx, top, sw, bh);
        }
        ctx.fill();

        if (isHovered) {
            ctx.strokeStyle = '#fbbf2488';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Call-ID label (only when bar is wide enough to show it)
        if (sw > 40) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '9px monospace';
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.beginPath();
            ctx.rect(sx + 2, top, sw - 4, bh);
            ctx.clip();
            ctx.fillText(seg.id, sx + 4, top + bh / 2);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }

    // ── Layer 3: Event markers (colored by SIP method / level) ───────────────
    for (const log of relevantLogs) {
        const lx = tsX(log.timestamp);
        const top = SESSIONS_TOP + log.laneIndex * LANE_H;
        const isSelected = log.id === selectedLogId;
        const method = (log.sipMethod || '').toUpperCase();
        const isKeepAlive = log.isSip && KEEP_ALIVE_METHODS.has(method);

        if (isKeepAlive) {
            // Small dot for keep-alive messages
            ctx.fillStyle = getSipColorHex(log.sipMethod || null);
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(lx, top + 4, 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const color = isSelected
                ? '#fbbf24'
                : (log.level === 'ERROR' ? '#f43f5e' : getSipColorHex(log.sipMethod || null));
            const mw = isSelected ? 3 : 2;
            ctx.fillStyle = color;
            ctx.globalAlpha = isSelected ? 1 : 0.9;
            ctx.fillRect(lx - mw / 2, top, mw, 20);
            if (isSelected) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(lx - mw / 2 - 1, top - 1, mw + 2, 22);
            }
        }
        ctx.globalAlpha = 1;
    }

    // ── Layer 4: Viewport indicator overlay ───────────────────────────────────
    if (visibleRange.start > 0) {
        const vx = tsX(visibleRange.start);
        const vw = Math.max(tsX(visibleRange.end) - vx, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(vx, 0, vw, displayH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx + 0.5, 0);
        ctx.lineTo(vx + 0.5, displayH);
        ctx.moveTo(vx + vw - 0.5, 0);
        ctx.lineTo(vx + vw - 0.5, displayH);
        ctx.stroke();
    }
}

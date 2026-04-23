/**
 * LogTimeline — SVG stacked bar chart for log density over time.
 *
 * Renders TimelineBucket data as animated stacked bars (DEBUG → INFO → WARN → ERROR → SIP).
 * Click a bar to zoom the log viewer to that time range.
 * Uses anime.js stagger for entrance animation.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { format } from 'date-fns';
import { ZoomOut } from 'lucide-react';
import { useAnimeStagger } from '../../utils/anime';
import { TimelineTooltip } from './TimelineTooltip';

interface TimelineBucket {
  timestamp: number;
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  sip: number;
}

interface LogTimelineProps {
  height?: number;
  className?: string;
}

const BAR_GAP = 1;
const LABEL_HEIGHT = 16;
const BUCKET_SIZE_MS = 60_000; // 1-minute buckets (client-side aggregation)

// Design token colors (hardcoded for SVG since CSS vars aren't supported in SVG fills)
const COLORS = {
  debug: '#5b6373',    // ink-3
  info: '#8a93a1',     // ink-2
  warn: '#f7b955',     // amber
  error: '#ff6b7a',    // red
  sip: '#8be5ff',      // cyan
};

function bucketizeLogs(
  logs: Array<{ timestamp: number; level: string; isSip: boolean }>,
  bucketSize: number
): TimelineBucket[] {
  if (logs.length === 0) return [];

  const minTs = logs[0].timestamp;
  const maxTs = logs[logs.length - 1].timestamp;
  const bucketCount = Math.max(1, Math.ceil((maxTs - minTs) / bucketSize) + 1);
  // Cap at 200 buckets for performance
  const adjustedSize = bucketCount > 200 ? Math.ceil((maxTs - minTs) / 200) : bucketSize;
  const finalCount = Math.max(1, Math.ceil((maxTs - minTs) / adjustedSize) + 1);

  const buckets: TimelineBucket[] = Array.from({ length: finalCount }, (_, i) => ({
    timestamp: minTs + i * adjustedSize,
    total: 0, error: 0, warn: 0, info: 0, debug: 0, sip: 0,
  }));

  for (const log of logs) {
    const idx = Math.min(finalCount - 1, Math.floor((log.timestamp - minTs) / adjustedSize));
    const b = buckets[idx];
    b.total++;
    if (log.isSip) b.sip++;
    switch (log.level) {
      case 'ERROR': b.error++; break;
      case 'WARN': b.warn++; break;
      case 'INFO': b.info++; break;
      case 'DEBUG': b.debug++; break;
    }
  }

  return buckets;
}

export default function LogTimeline({ height = 80, className = '' }: LogTimelineProps) {
  const { logs, filteredLogs, hasActiveFilters, timelineZoomRange, setTimelineZoomRange } = useLogContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ bucket: TimelineBucket; x: number; y: number } | null>(null);
  const scopedLogs = hasActiveFilters || timelineZoomRange ? filteredLogs : logs;

  // Sorted logs for bucketing
  const sortedLogs = useMemo(() => {
    return [...scopedLogs].sort((a, b) => a.timestamp - b.timestamp);
  }, [scopedLogs]);

  const buckets = useMemo(() => bucketizeLogs(sortedLogs, BUCKET_SIZE_MS), [sortedLogs]);
  const maxCount = useMemo(() => Math.max(1, ...buckets.map(b => b.total)), [buckets]);

  // Trigger stagger animation when buckets change
  useAnimeStagger(containerRef, '.timeline-bar', [buckets.length], {
    translateY: [4, 0],
    opacity: [0, 1],
    stagger: 15,
    duration: 250,
    easing: 'easeOutCubic',
  });

  const handleBarClick = useCallback((bucket: TimelineBucket) => {
    // Determine time range for this bucket (± half bucket duration)
    const halfBucket = buckets.length > 1
      ? Math.abs(buckets[1].timestamp - buckets[0].timestamp) / 2
      : BUCKET_SIZE_MS / 2;
    setTimelineZoomRange({
      start: bucket.timestamp - halfBucket,
      end: bucket.timestamp + halfBucket,
    });
  }, [buckets, setTimelineZoomRange]);

  const handleClearZoom = useCallback(() => {
    setTimelineZoomRange(null);
  }, [setTimelineZoomRange]);

  if (buckets.length === 0) return null;

  const chartHeight = height - LABEL_HEIGHT;
  const barWidth = buckets.length > 0 ? Math.max(2, 100 / buckets.length - BAR_GAP) : 4;

  // Time labels — show ~5 evenly spaced
  const labelCount = Math.min(5, buckets.length);
  const labelStep = Math.max(1, Math.floor(buckets.length / labelCount));
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.min(i * labelStep, buckets.length - 1);
    return { x: (idx / buckets.length) * 100, time: buckets[idx].timestamp };
  });

  return (
    <div
      ref={containerRef}
      className={`relative w-full border-b border-[var(--border)] bg-[var(--workspace)] select-none ${className}`}
      style={{ height }}
    >
      {/* Zoom indicator */}
      {timelineZoomRange && (
        <div className="absolute top-1 right-2 z-10 flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
            {format(new Date(timelineZoomRange.start), 'HH:mm:ss')} — {format(new Date(timelineZoomRange.end), 'HH:mm:ss')}
          </span>
          <button
            onClick={handleClearZoom}
            className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Clear time zoom"
          >
            <ZoomOut size={12} />
          </button>
        </div>
      )}

      {/* SVG Chart */}
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 100 ${chartHeight}`}
        preserveAspectRatio="none"
        className="block"
      >
        {buckets.map((bucket, i) => {
          const x = (i / buckets.length) * 100;
          // Stack from bottom: debug → info → warn → error → sip
          let y = chartHeight;
          const segments: Array<{ color: string; h: number; key: string }> = [];

          const addSegment = (count: number, color: string, key: string) => {
            if (count <= 0) return;
            const h = (count / maxCount) * chartHeight;
            y -= h;
            segments.push({ color, h, key });
          };

          addSegment(bucket.debug, COLORS.debug, 'debug');
          addSegment(bucket.info, COLORS.info, 'info');
          addSegment(bucket.warn, COLORS.warn, 'warn');
          addSegment(bucket.error, COLORS.error, 'error');
          addSegment(bucket.sip, COLORS.sip, 'sip');

          // Reset y for rendering
          let renderY = chartHeight;

          return (
            <g
              key={i}
              className="timeline-bar cursor-pointer"
              onClick={() => handleBarClick(bucket)}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as SVGGElement).ownerSVGElement?.getBoundingClientRect();
                if (rect) {
                  setTooltip({
                    bucket,
                    x: rect.left + (x / 100) * rect.width + (barWidth / 100) * rect.width / 2,
                    y: rect.top,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Hover area — full height, transparent */}
              <rect x={x} y={0} width={barWidth} height={chartHeight} fill="transparent" />
              {segments.map((seg) => {
                renderY -= seg.h;
                return (
                  <rect
                    key={seg.key}
                    x={x}
                    y={renderY}
                    width={barWidth}
                    height={seg.h}
                    fill={seg.color}
                    rx={0.3}
                    opacity={0.85}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Time labels */}
      <div className="flex justify-between px-1" style={{ height: LABEL_HEIGHT }}>
        {labels.map((label, i) => (
          <span key={i} className="text-[9px] font-mono text-[var(--muted-foreground)] opacity-60">
            {format(new Date(label.time), 'HH:mm')}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <TimelineTooltip
          bucket={tooltip.bucket}
          x={tooltip.x - (containerRef.current?.getBoundingClientRect().left ?? 0)}
          y={tooltip.y - (containerRef.current?.getBoundingClientRect().top ?? 0)}
          bucketWidth={barWidth}
        />
      )}
    </div>
  );
}

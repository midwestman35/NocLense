import { format } from 'date-fns';

interface TimelineBucket {
  timestamp: number;
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  sip: number;
}

interface TimelineTooltipProps {
  bucket: TimelineBucket;
  x: number;
  y: number;
  bucketWidth: number;
}

export function TimelineTooltip({ bucket, x, y }: TimelineTooltipProps) {
  const time = format(new Date(bucket.timestamp), 'HH:mm:ss');

  return (
    <div
      className="absolute z-50 pointer-events-none px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-md)] text-[10px] leading-relaxed whitespace-nowrap"
      style={{ left: x, top: y - 8, transform: 'translate(-50%, -100%)' }}
    >
      <div className="font-semibold text-[11px] mb-1 font-mono">{time}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span className="text-[var(--muted-foreground)]">Total</span>
        <span className="font-mono font-medium text-right">{bucket.total}</span>
        {bucket.error > 0 && (
          <>
            <span className="text-[var(--destructive)]">ERROR</span>
            <span className="font-mono font-medium text-right">{bucket.error}</span>
          </>
        )}
        {bucket.warn > 0 && (
          <>
            <span className="text-[var(--warning)]">WARN</span>
            <span className="font-mono font-medium text-right">{bucket.warn}</span>
          </>
        )}
        {bucket.info > 0 && (
          <>
            <span className="text-[var(--muted-foreground)]">INFO</span>
            <span className="font-mono font-medium text-right">{bucket.info}</span>
          </>
        )}
        {bucket.debug > 0 && (
          <>
            <span className="text-[var(--muted-foreground)] opacity-60">DEBUG</span>
            <span className="font-mono font-medium text-right opacity-60">{bucket.debug}</span>
          </>
        )}
        {bucket.sip > 0 && (
          <>
            <span className="text-cyan-400">SIP</span>
            <span className="font-mono font-medium text-right">{bucket.sip}</span>
          </>
        )}
      </div>
    </div>
  );
}

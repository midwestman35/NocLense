/**
 * ProgressBar — determinate and indeterminate progress indicator.
 *
 * Determinate (value prop): animated width transition using --success color.
 * Indeterminate: sliding gradient keyframe (progress-slide in index.css).
 * Reuses theme vars from tokens.css; no hardcoded colors.
 */

interface ProgressBarProps {
  /** Normalized 0..1 for determinate mode. Omit for indeterminate. */
  value?: number;
  /** Force indeterminate animation even when value is provided. */
  indeterminate?: boolean;
  /** Label shown above the bar; determinate mode appends the percentage. */
  label?: string;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, indeterminate = false, label, size = 'sm' }: ProgressBarProps) {
  const height = size === 'md' ? '6px' : '4px';
  const isDeterminate = !indeterminate && value !== undefined;
  const pct = isDeterminate ? Math.min(100, Math.max(0, value! * 100)) : 0;

  return (
    <div className="w-full space-y-1">
      {label !== undefined && (
        <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
          <span>{label}</span>
          {isDeterminate && <span>{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-[var(--border)]"
        style={{ height }}
      >
        {isDeterminate ? (
          <div
            className="h-full rounded-full bg-[var(--success)] transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div
            className="h-full w-full animate-progress-slide rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--success) 40%, var(--phase-dot-active) 60%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        )}
      </div>
    </div>
  );
}

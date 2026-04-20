/**
 * TuiProgress.tsx — determinate progress bar rendered as TUI blocks.
 *
 * Phase 01a component. Distinct from `TuiSpinner` because this is a
 * known-ETA indicator driven by a value 0..1. Used for file parse
 * progress per the loading vocabulary state chart (spec §4.5).
 *
 * Pure CSS rendering — no animation on the bar itself. JS updates the
 * `value` prop; the filled/empty block ratio recomputes on render.
 */

import type { HTMLAttributes } from 'react';

const WIDTH = 8; // character cells between brackets

export interface TuiProgressProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** 0..1 inclusive. Values outside this range are clamped. */
  value: number;
  /**
   * Accessible label announced by screen readers, e.g. "Parsing log file".
   * The visible percentage is appended automatically.
   */
  label: string;
  /** When true, appends the numeric percentage next to the bar. */
  showPercent?: boolean;
}

export function TuiProgress({
  value,
  label,
  showPercent = true,
  className,
  ...rest
}: TuiProgressProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const filled = Math.round(clamped * WIDTH);
  const empty = WIDTH - filled;
  const percent = Math.round(clamped * 100);
  const cls = ['tui-progress', className].filter(Boolean).join(' ');
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cls}
      {...rest}
    >
      <span className="tui-progress__bracket">[</span>
      <span className="tui-progress__track">
        <span className="tui-progress__fill">{'█'.repeat(filled)}</span>
        <span className="tui-progress__empty">{'░'.repeat(empty)}</span>
      </span>
      <span className="tui-progress__bracket">]</span>
      {showPercent && (
        <span className="tabular-nums" aria-hidden="true">{percent}%</span>
      )}
    </span>
  );
}

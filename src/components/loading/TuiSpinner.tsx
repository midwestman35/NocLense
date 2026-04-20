/**
 * TuiSpinner.tsx — CSS-only TUI glyph spinner.
 *
 * Phase 01a component. Thin React wrapper over the classes in
 * `src/styles/loading.css`. Every spinner is paired with a
 * visually-hidden accessible label because the animated glyph itself
 * is not meaningful to screen readers.
 *
 * Usage:
 *   <TuiSpinner kind="braille" label="Thinking" />
 *   <TuiSpinner kind="dots"    label="Searching Datadog" />
 *
 * For determinate progress, use <TuiProgress /> instead.
 */

import type { HTMLAttributes } from 'react';

export type TuiSpinnerKind = 'braille' | 'block' | 'dots';

export interface TuiSpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  kind?: TuiSpinnerKind;
  /**
   * Accessible label announced by screen readers. Required — a bare
   * animated glyph is not meaningful without context.
   */
  label: string;
}

const KIND_CLASS: Record<TuiSpinnerKind, string> = {
  braille: 'tui-spinner--braille',
  block: 'tui-spinner--block',
  dots: 'tui-spinner--dots',
};

export function TuiSpinner({
  kind = 'braille',
  label,
  className,
  ...rest
}: TuiSpinnerProps) {
  const cls = ['tui-spinner', KIND_CLASS[kind], className].filter(Boolean).join(' ');
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cls}
      {...rest}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}

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

/**
 * Accessibility invariants (role, aria-live, aria-label) are not
 * overridable. Callers that want the spinner decorative (paired with
 * a sibling status element like LoadingLabel) pass `decorative`.
 */
type ReservedAria = 'role' | 'aria-live' | 'aria-label' | 'aria-atomic';
type BaseSpanProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | ReservedAria>;

export interface TuiSpinnerProps extends BaseSpanProps {
  /** Glyph family. Default `dots` — the safest Unicode coverage across Windows font stacks. */
  kind?: TuiSpinnerKind;
  /**
   * Accessible label announced by screen readers. Required unless
   * `decorative` is true.
   */
  label?: string;
  /**
   * When true, the spinner is marked `aria-hidden` and contributes no
   * announcements. Use when paired with a sibling status element (e.g.
   * LoadingLabel with its own announce) to prevent double announcement.
   */
  decorative?: boolean;
}

const KIND_CLASS: Record<TuiSpinnerKind, string> = {
  braille: 'tui-spinner--braille',
  block: 'tui-spinner--block',
  dots: 'tui-spinner--dots',
};

export function TuiSpinner({
  kind = 'dots',
  label,
  decorative = false,
  className,
  ...rest
}: TuiSpinnerProps) {
  const cls = ['tui-spinner', KIND_CLASS[kind], className].filter(Boolean).join(' ');
  // Rest spread FIRST so invariant aria attrs below it win.
  if (decorative) {
    return <span {...rest} className={cls} aria-hidden="true" />;
  }
  const resolvedLabel = label ?? 'Loading';
  return (
    <span
      {...rest}
      className={cls}
      role="status"
      aria-live="polite"
      aria-label={resolvedLabel}
    >
      <span className="sr-only">{resolvedLabel}</span>
    </span>
  );
}

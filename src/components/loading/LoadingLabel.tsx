/**
 * LoadingLabel.tsx — renders a cute loading phrase with character-level
 * typewriter reveal + breathing wave.
 *
 * Phase 01a component. Pair with `useCuteLoadingLabel` for the phrase
 * cycling and OperationKind seeding.
 *
 * Animation model: every character is a separate inline element with a
 * CSS custom property `--cute-i` carrying its index. `loading.css`
 * keyframes reveal (180ms forwards) and then breathe (1.8s loop with
 * 400ms head-start delay). Key change forces re-mount → new reveal.
 *
 * Non-breaking spaces are substituted for literal spaces so the inline
 * layout stays tight without affecting the animation.
 */

import type { CSSProperties, HTMLAttributes } from 'react';

/**
 * Accessibility invariants (role, aria-live, aria-label) are NOT exposed
 * as props — callers cannot accidentally override the live-region
 * contract. If a label is decorative (paired with another status
 * element), pass `decorative` to suppress the live region entirely.
 */
type ReservedAria = 'role' | 'aria-live' | 'aria-label' | 'aria-atomic';
type BaseSpanProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | ReservedAria>;

export interface LoadingLabelProps extends BaseSpanProps {
  /** The phrase to render. Change triggers a re-reveal via key mount. */
  text: string;
  /**
   * Accessible status label, announced by screen readers. NOT the cute
   * phrase — pass a describing phrase like "Analyzing logs" instead so
   * the assistive experience stays informative. Ignored when
   * `decorative` is true.
   */
  ariaStatus?: string;
  /**
   * When true, the label is marked `aria-hidden` and contributes no
   * live-region announcements. Use when pairing with a sibling status
   * element (e.g. TuiSpinner with its own announce) to avoid double
   * announcements for one operation.
   */
  decorative?: boolean;
}

/** Type helper for CSS custom properties — no `unknown` cast gymnastics. */
type CssVarStyle = CSSProperties & Record<`--${string}`, string | number>;

export function LoadingLabel({
  text,
  ariaStatus,
  decorative = false,
  className,
  ...rest
}: LoadingLabelProps) {
  const cls = ['cute-label', className].filter(Boolean).join(' ');
  const chars = (
    <span aria-hidden="true">
      {Array.from(text).map((ch, i) => (
        <span
          key={`${text}-${i}`}
          className="cute-label__char"
          style={{ '--cute-i': i } as CssVarStyle}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );

  // Rest is spread FIRST so the invariant aria props below it cannot be
  // overridden by callers. ReservedAria is also stripped from props.
  if (decorative) {
    return (
      <span {...rest} className={cls} aria-hidden="true">
        {chars}
      </span>
    );
  }
  return (
    <span
      {...rest}
      className={cls}
      role="status"
      aria-live="polite"
      aria-label={ariaStatus ?? 'Loading'}
    >
      <span className="sr-only">{ariaStatus ?? 'Loading'}</span>
      {chars}
    </span>
  );
}

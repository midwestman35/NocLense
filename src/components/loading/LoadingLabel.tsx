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

export interface LoadingLabelProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The phrase to render. Change triggers a re-reveal via key mount. */
  text: string;
  /**
   * Accessible status label, announced by screen readers. NOT the cute
   * phrase — pass a describing phrase like "Analyzing logs" instead so
   * the assistive experience stays informative.
   */
  ariaStatus: string;
}

export function LoadingLabel({ text, ariaStatus, className, ...rest }: LoadingLabelProps) {
  const cls = ['cute-label', className].filter(Boolean).join(' ');
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={ariaStatus}
      className={cls}
      {...rest}
    >
      <span className="sr-only">{ariaStatus}</span>
      <span aria-hidden="true">
        {Array.from(text).map((ch, i) => (
          <span
            key={`${text}-${i}`}
            className="cute-label__char"
            style={{ ['--cute-i' as unknown as string]: i } as CSSProperties}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
      </span>
    </span>
  );
}

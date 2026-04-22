import type { JSX } from 'react';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const SPINNER_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
} as const;

export interface SpinnerProps {
  size?: keyof typeof SPINNER_SIZES | number;
  className?: string;
  label?: string;
}

export function Spinner({
  size = 'sm',
  className,
  label = 'Loading',
}: SpinnerProps): JSX.Element {
  const prefersReducedMotion = usePrefersReducedMotion();
  const resolvedSize = typeof size === 'number' ? size : SPINNER_SIZES[size];

  return (
    <span
      role="status"
      aria-live="polite"
      className={twMerge(
        clsx(
          'inline-flex shrink-0 items-center justify-center text-current',
          'motion-safe:animate-spin motion-reduce:animate-none',
          prefersReducedMotion && 'opacity-80',
          className
        )
      )}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-size={resolvedSize}
    >
      <svg
        aria-hidden="true"
        width={resolvedSize}
        height={resolvedSize}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.2"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default Spinner;

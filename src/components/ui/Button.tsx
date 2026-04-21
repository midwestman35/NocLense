import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'destructive' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Phase 04.5 Direction C: `.btn-press-bounce` (defined in src/index.css)
// composes color transitions + an emphasized-bounce transform transition
// with per-property durations. `active:scale-[0.94]` drives the press feel;
// `motion-reduce:active:scale-100` honors prefers-reduced-motion at the
// consumer level (the transition class also strips the transform branch
// under reduced motion so there's nothing left to animate).
const base =
  'inline-flex items-center justify-center font-medium ' +
  'btn-press-bounce ' +
  'rounded-[var(--radius-md)] ' +
  'active:scale-[0.94] motion-reduce:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] ' +
  'focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'disabled:scale-100';

const variants: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90',
  ghost:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)]',
  destructive:
    'bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90',
  icon:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] p-0',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 py-1 text-[var(--text-xs)]',
  md: 'h-9 px-4 py-2 text-[var(--text-base)]',
  lg: 'h-11 px-5 py-2.5 text-[var(--text-md)]',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const sizeClass = variant === 'icon' ? iconSizes[size] : sizes[size];

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizeClass, className))}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;

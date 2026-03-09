import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'default'
  | 'outline'
  | 'level-error'
  | 'level-warn'
  | 'level-info'
  | 'level-debug';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const base =
  'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 ' +
  'text-[var(--text-xs)] font-[var(--font-weight-medium)] leading-none';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  outline: 'border border-[var(--border)] text-[var(--muted-foreground)] bg-transparent',
  'level-error': 'bg-[var(--destructive)]/10 text-[var(--destructive)]',
  'level-warn': 'bg-[var(--warning)]/10 text-[var(--warning)]',
  'level-info': 'bg-[var(--foreground)]/10 text-[var(--foreground)]',
  'level-debug': 'bg-[var(--muted)] text-[var(--muted-foreground)]',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    />
  );
}

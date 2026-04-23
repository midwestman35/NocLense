import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type CardVariant = 'default' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const cardVariants: Record<CardVariant, string> = {
  default:
    'rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--ink-0)]',
  elevated:
    'rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--bg-2)] text-[var(--ink-0)] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9),0_0_40px_-30px_rgba(142,240,183,0.35)]',
};

export function Card({ variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={twMerge(clsx(cardVariants[variant], className))}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)] ' +
            'border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent)] ' +
            'font-[var(--font-weight-semibold)] text-[13px] text-[var(--ink-1)]',
          className
        )
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(clsx('p-[var(--space-4)] text-[var(--ink-1)]', className))}
      {...props}
    />
  );
}

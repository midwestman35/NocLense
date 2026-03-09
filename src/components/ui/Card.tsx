import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type CardVariant = 'default' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const cardVariants: Record<CardVariant, string> = {
  default:
    'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]',
  elevated:
    'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-md)]',
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
            'border-b border-[var(--border)] font-[var(--font-weight-semibold)] text-[var(--text-md)]',
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
      className={twMerge(clsx('p-[var(--space-4)]', className))}
      {...props}
    />
  );
}

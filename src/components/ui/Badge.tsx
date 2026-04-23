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
  'tag';

const variants: Record<BadgeVariant, string> = {
  default: '',
  outline: 'ink',
  'level-error': 'red',
  'level-warn': 'amber',
  'level-info': 'violet',
  'level-debug': 'ink',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    />
  );
}

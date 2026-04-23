import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({
  orientation = 'horizontal',
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={twMerge(
        clsx(
          'shrink-0 bg-[var(--line)]',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className
        )
      )}
      {...props}
    />
  );
}

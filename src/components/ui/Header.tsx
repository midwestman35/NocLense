import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function Header({ left, center, right, className, ...props }: HeaderProps) {
  return (
    <header
      className={twMerge(
        clsx(
          'flex items-center h-[var(--header-height)] px-[var(--space-4)]',
          'border-b border-[var(--border)] bg-[var(--card)]',
          'z-[var(--z-sticky)]',
          className
        )
      )}
      {...props}
    >
      {/* Left slot */}
      <div className="flex items-center gap-[var(--space-2)] shrink-0">{left}</div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center slot */}
      {center && (
        <div className="flex items-center gap-[var(--space-2)]">{center}</div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right slot */}
      <div className="flex items-center gap-[var(--space-2)] shrink-0">{right}</div>
    </header>
  );
}

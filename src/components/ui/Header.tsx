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
          'flex h-[var(--header-height)] items-center px-[var(--space-4)]',
          'border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(20,24,32,0.82),rgba(12,15,20,0.64))]',
          'text-[var(--ink-1)] backdrop-blur-xl',
          'z-[var(--z-sticky)]',
          className
        )
      )}
      {...props}
    >
      {/* Left slot */}
      <div className="flex shrink-0 items-center gap-[var(--space-2)]">{left}</div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center slot */}
      {center && (
        <div className="flex items-center gap-[var(--space-2)]">{center}</div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right slot */}
      <div className="flex shrink-0 items-center gap-[var(--space-2)]">{right}</div>
    </header>
  );
}

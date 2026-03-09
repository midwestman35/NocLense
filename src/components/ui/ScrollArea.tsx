import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max height before scrolling kicks in. */
  maxHeight?: string;
}

export function ScrollArea({
  maxHeight,
  className,
  style,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={twMerge(
        clsx('overflow-y-auto overflow-x-hidden', className)
      )}
      style={{ maxHeight, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

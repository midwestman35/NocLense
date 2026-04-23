import React from 'react';
import { clsx } from 'clsx';

interface AmbientProps {
  children?: React.ReactNode;
  variant?: 'default' | string;
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
}

export function Ambient({
  children,
  variant = 'default',
  className,
  contentClassName,
  style,
}: AmbientProps) {
  return (
    <div className={clsx('nl-ambient', className)} data-variant={variant} style={style}>
      <div className="aurora" />
      <div className="grid-overlay" />
      <div className="noise" />
      <div className={clsx('nl-ambient-content', contentClassName)}>{children}</div>
    </div>
  );
}

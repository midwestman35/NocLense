import React from 'react';
import { clsx } from 'clsx';

interface MacWindowProps {
  title?: React.ReactNode;
  right?: React.ReactNode;
  titleDot?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MacWindow({
  title = 'NocLense',
  right = null,
  titleDot = true,
  children,
  className,
  style,
}: MacWindowProps) {
  return (
    <div className={clsx('mac-window', className)} style={style}>
      <div className="mac-titlebar">
        <div className="mac-lights" aria-hidden="true">
          <span className="mac-light r" />
          <span className="mac-light y" />
          <span className="mac-light g" />
        </div>
        <div className="mac-title">
          {titleDot && <span className="dot" />}
          <span>{title}</span>
        </div>
        <div className="mac-title-right">{right}</div>
      </div>
      <div className="mac-body">{children}</div>
    </div>
  );
}

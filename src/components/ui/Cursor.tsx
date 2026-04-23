import React from 'react';

interface CursorProps {
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Cursor({
  color = 'var(--mint)',
  className,
  style,
}: CursorProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        width: 7,
        height: '1em',
        marginLeft: 2,
        verticalAlign: '-2px',
        background: color,
        animation: 'nl-blink 1s steps(2) infinite',
        ...style,
      }}
    />
  );
}

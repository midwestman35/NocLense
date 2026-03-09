import React, { useCallback, useRef } from 'react';
import { clsx } from 'clsx';

interface ResizeHandleProps {
  /** Called continuously during drag with the delta in pixels. */
  onResize: (delta: number) => void;
  /** Called when drag ends. */
  onResizeEnd?: () => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function ResizeHandle({
  onResize,
  onResizeEnd,
  orientation = 'horizontal',
  className,
}: ResizeHandleProps) {
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startPos.current = orientation === 'horizontal' ? e.clientY : e.clientX;

      const handleMouseMove = (ev: MouseEvent) => {
        const current = orientation === 'horizontal' ? ev.clientY : ev.clientX;
        onResize(current - startPos.current);
        startPos.current = current;
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd?.();
      };

      document.body.style.cursor = orientation === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, onResizeEnd, orientation]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={clsx(
        'group flex items-center justify-center',
        'transition-colors duration-[var(--duration-fast)]',
        orientation === 'horizontal'
          ? 'h-2 w-full cursor-row-resize hover:bg-[var(--accent)]'
          : 'h-full w-2 cursor-col-resize hover:bg-[var(--accent)]',
        className
      )}
    >
      <div
        className={clsx(
          'rounded-full bg-[var(--border)] group-hover:bg-[var(--muted-foreground)]',
          'transition-colors duration-[var(--duration-fast)]',
          orientation === 'horizontal' ? 'h-0.5 w-8' : 'h-8 w-0.5'
        )}
      />
    </div>
  );
}

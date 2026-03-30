/**
 * ResizableSplit.tsx
 * A two-pane container separated by a draggable divider.
 * Drag the center bar left/right to resize panels.
 */
import { useState, useRef, useCallback } from 'react';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Initial left pane width as percentage (0–100). Default: 42 */
  initialSplit?: number;
  /** Min left pane width %. Default: 20 */
  minLeft?: number;
  /** Max left pane width %. Default: 80 */
  maxLeft?: number;
  className?: string;
}

export default function ResizableSplit({
  left,
  right,
  initialSplit = 42,
  minLeft = 20,
  maxLeft = 80,
  className = '',
}: ResizableSplitProps) {
  const [split, setSplit] = useState(initialSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(maxLeft, Math.max(minLeft, pct)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [minLeft, maxLeft]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full overflow-hidden ${className}`}
    >
      {/* Left pane */}
      <div style={{ width: `${split}%`, flexShrink: 0, overflow: 'auto' }}>
        {left}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={onMouseDown}
        className="group relative flex w-1 flex-shrink-0 cursor-col-resize items-center justify-center"
        style={{ backgroundColor: 'var(--border)' }}
        title="Drag to resize"
      >
        {/* Visual handle dots */}
        <div className="absolute flex flex-col gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
          {[0,1,2].map(i => (
            <div key={i} className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--muted-foreground)' }} />
          ))}
        </div>
        {/* Wider invisible hit area */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      {/* Right pane — flex column so children fill full width */}
      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {right}
      </div>
    </div>
  );
}

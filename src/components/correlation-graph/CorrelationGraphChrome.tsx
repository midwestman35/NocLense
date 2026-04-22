import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { KeyboardEvent, MutableRefObject } from 'react';

import { Button } from '../ui/Button';

interface CorrelationGraphControlsProps {
  disableResetLayout: boolean;
  onFitView: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

interface LargeGraphOverlayProps {
  edgeCount: number;
  headingId: string;
  nodeCount: number;
  onKeepClustered: () => void;
  onShowAll: () => void;
  primaryButtonRef: MutableRefObject<HTMLButtonElement | null>;
}

export function CorrelationGraphEmptyState(): JSX.Element {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-2 px-5 text-center">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">No correlations to show</h3>
      <p className="max-w-[260px] text-xs text-[var(--muted-foreground)]">
        Load logs and apply filters to see the correlation graph.
      </p>
    </div>
  );
}

export function CorrelationGraphControls({
  disableResetLayout,
  onFitView,
  onResetLayout,
  onZoomIn,
  onZoomOut,
}: CorrelationGraphControlsProps): JSX.Element {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)]/70 bg-[color:rgba(15,18,13,0.86)] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      <Button type="button" variant="icon" size="sm" aria-label="Zoom in" onClick={onZoomIn}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="icon" size="sm" aria-label="Zoom out" onClick={onZoomOut}>
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="icon" size="sm" aria-label="Reset view" onClick={onFitView}>
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="icon"
        size="sm"
        aria-label="Reset layout"
        onClick={onResetLayout}
        disabled={disableResetLayout}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function LargeGraphOverlay({
  edgeCount,
  headingId,
  nodeCount,
  onKeepClustered,
  onShowAll,
  primaryButtonRef,
}: LargeGraphOverlayProps): JSX.Element {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onKeepClustered();
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby={headingId}
      aria-describedby={`${headingId}-description`}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-20 flex items-center justify-center bg-[color:rgba(6,8,6,0.68)] px-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-[320px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
        <h3 id={headingId} className="text-sm font-semibold text-[var(--foreground)]">
          Large graph detected
        </h3>
        <p id={`${headingId}-description`} className="mt-2 text-xs text-[var(--muted-foreground)]">
          {nodeCount} nodes and {edgeCount} edges. Rendering may be slow.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={onShowAll}
            className="inline-flex h-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--foreground)] px-2.5 py-1 text-[var(--text-xs)] font-medium text-[var(--background)] focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] disabled:pointer-events-none disabled:opacity-50"
          >
            Show all
          </button>
          <Button type="button" variant="outline" size="sm" onClick={onKeepClustered}>
            Keep clustered
          </Button>
        </div>
      </div>
    </div>
  );
}

import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Phase } from './types';

interface WorkspaceGridProps {
  layout: Phase;
  children: ReactNode;
  className?: string;
}

export function WorkspaceGrid({ layout, children, className }: WorkspaceGridProps) {
  return (
    <div
      className={clsx(
        'flex-1 min-h-0 overflow-hidden transition-all',
        layout === 'import' && 'flex items-center justify-center',
        layout === 'investigate' && 'grid gap-2 p-2',
        layout === 'submit' && 'flex items-start justify-center gap-6 p-10',
        className,
      )}
      style={{
        ...(layout === 'import' && { background: 'var(--room-import-glow)' }),
        ...(layout === 'investigate' && {
          gridTemplateColumns: '1fr 1fr 340px',
          gridTemplateRows: 'auto 1fr auto',
          background: 'var(--room-investigate-bg)',
        }),
        ...(layout === 'submit' && { background: 'var(--room-submit-glow)' }),
        transitionDuration: 'var(--room-transition-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
      data-room={layout}
    >
      {children}
    </div>
  );
}

/** CSS class names for card grid positions in the Investigate layout */
export const CARD_GRID_CLASSES: Record<string, string> = {
  'log-stream': 'col-span-2 row-span-2',
  'ai-assistant': 'col-start-3 row-start-1',
  'evidence': 'col-start-3 row-start-2',
  'similar-tickets': 'col-start-1 row-start-3',
  'correlation-graph': 'col-start-2 row-start-3',
  'datadog-live': 'col-start-3 row-start-3',
};

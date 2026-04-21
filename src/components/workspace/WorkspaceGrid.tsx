/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { Phase } from './types';
import { CardFocusProvider, useCardFocus } from './CardFocusContext';

interface WorkspaceGridProps {
  layout: Phase;
  children: ReactNode;
  className?: string;
}

interface InvestigateGridInnerProps {
  children: ReactNode;
  className?: string;
}

function InvestigateGridInner({
  children,
  className,
}: InvestigateGridInnerProps) {
  const focus = useCardFocus();
  const focusedCardId = focus?.focusedCardId ?? null;

  return (
    <div
      data-layout="investigate"
      data-room="investigate"
      data-focused={focusedCardId ?? undefined}
      className={clsx('h-full min-h-0 grid gap-2 p-2 overflow-hidden', className)}
      style={{
        gridTemplateColumns: '1fr 1fr 340px',
        gridTemplateRows: 'auto 1fr auto',
        background: 'var(--room-investigate-bg)',
        transitionDuration: 'var(--room-transition-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
    >
      {children}
    </div>
  );
}

export function WorkspaceGrid({ layout, children, className }: WorkspaceGridProps) {
  if (layout === 'investigate') {
    return (
      <CardFocusProvider>
        <InvestigateGridInner className={className}>
          {children}
        </InvestigateGridInner>
      </CardFocusProvider>
    );
  }

  if (layout === 'import') {
    return (
      <div
        data-room="import"
        className={clsx(
          'h-full min-h-0 overflow-hidden transition-[background-color,opacity] duration-[var(--room-transition-duration,200ms)]',
          'flex items-center justify-center',
          className,
        )}
        style={{
          background: 'var(--room-import-glow)',
          transitionTimingFunction: 'var(--room-transition-ease)',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      data-room="submit"
      className={clsx(
        'h-full min-h-0 overflow-hidden transition-[background-color,opacity] duration-[var(--room-transition-duration,200ms)]',
        'flex items-start justify-center gap-6 p-10',
        className,
      )}
      style={{
        background: 'var(--room-submit-glow)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
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

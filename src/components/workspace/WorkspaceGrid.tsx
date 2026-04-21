/* eslint-disable react-refresh/only-export-components */
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
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

/**
 * Phase 05 Commit 6 — visible rail via DOM split.
 *
 * When focused (focusCtx.focusedCardId !== null), InvestigateGridInner
 * partitions its children by matching `id` prop against focusedCardId.
 * The focused card renders full-height in column 1; non-focused cards
 * stack in a flex-column 80px rail on the right.
 *
 * This avoids the CSS specificity war the v2 plan's pure-CSS rail
 * would have needed (CARD_GRID_CLASSES' `col-start-* row-start-*`
 * classes own positions in the default grid; !important overrides are
 * fragile). The DOM split is explicit, testable, and the non-focused
 * classes become inert because their parent is no longer a grid.
 *
 * Rail strips: each non-focused WorkspaceCard detects rail mode
 * internally (focusCtx.focusedCardId !== null && !== id) and renders
 * a compact <button role="tab"> strip instead of its normal card body.
 * See WorkspaceCard.tsx for the rail-mode render branch.
 *
 * Spec §5.5 / §8: rail width 80px resolves the open "20% vs 10%" item.
 */
function partitionCardsByFocus(
  children: ReactNode,
  focusedId: string,
): { focused: ReactElement[]; rails: ReactElement[] } {
  const focused: ReactElement[] = [];
  const rails: ReactElement[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const cardId = (child.props as { id?: string }).id;
    if (cardId === focusedId) {
      focused.push(child);
    } else {
      rails.push(child);
    }
  });
  return { focused, rails };
}

function InvestigateGridInner({
  children,
  className,
}: InvestigateGridInnerProps) {
  const focus = useCardFocus();
  const focusedCardId = focus?.focusedCardId ?? null;

  if (focusedCardId !== null) {
    const { focused, rails } = partitionCardsByFocus(children, focusedCardId);
    return (
      <div
        data-layout="investigate"
        data-room="investigate"
        data-focused={focusedCardId}
        className={clsx('h-full min-h-0 grid gap-2 p-2 overflow-hidden', className)}
        style={{
          gridTemplateColumns: '1fr 80px',
          gridTemplateRows: '1fr',
          background: 'var(--room-investigate-bg)',
          transitionDuration: 'var(--room-transition-duration)',
          transitionTimingFunction: 'var(--room-transition-ease)',
        }}
      >
        <div
          data-focus-column
          style={{ gridColumn: 1, gridRow: 1, minHeight: 0, overflow: 'hidden' }}
        >
          {focused}
        </div>
        <div
          data-focus-rail
          role="tablist"
          aria-orientation="vertical"
          aria-label="Other cards"
          style={{
            gridColumn: 2,
            gridRow: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {rails}
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="investigate"
      data-room="investigate"
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

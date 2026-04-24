import { useState, useCallback, useEffect, type CSSProperties, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

import { isInSuppressedContext, useCardFocus } from './CardFocusContext';

/**
 * Phase 04.5 Direction C — WorkspaceCard expand/collapse uses container
 * transform + the grid-template-rows trick, not the imperative height
 * animation of Phase 04 and earlier.
 *
 * How the animation works:
 *   - The body wrapper is `display: grid; grid-template-rows: 1fr|0fr`.
 *   - The body child is `overflow: hidden; min-height: 0` so it collapses
 *     to zero height when the parent row is 0fr.
 *   - Three properties transition together with --ease-emphasized and
 *     --card-expand-duration: grid-template-rows (the height collapse),
 *     opacity (fade), and transform (scale 0.97→1).
 *
 * Browser support: grid-template-rows interpolation requires Chromium 123+
 * or Firefox 119+. The jsdom test environment does not compute transitions;
 * tests assert on inline style properties and a
 * data-card-body-state attribute for a stable testing surface.
 *
 * Reduced motion: the transition is stripped via the CSS rule in
 * src/index.css (`@media (prefers-reduced-motion: reduce)` block). The
 * layout still flips, just instantly.
 */

const bodyWrapperBaseStyle: CSSProperties = {
  display: 'grid',
  transformOrigin: 'top center',
  transition:
    'grid-template-rows var(--card-expand-duration) var(--ease-emphasized), ' +
    'opacity var(--card-expand-duration) var(--ease-emphasized), ' +
    'transform var(--card-expand-duration) var(--ease-emphasized)',
};

const bodyChildStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'hidden',
};

/**
 * Extra `data-*` attributes forwarded to the card root. Useful for
 * Phase 05 surface-tier wiring (e.g. Datadog Live card sets
 * `data-surface="datadog-live"` / `data-tier="live"` to drive tier-
 * aware CSS). Reserved keys `data-card-id` and `data-focus-target` are
 * owned by the primitive and CANNOT be overridden via this prop — the
 * reserved-key filter inside the component enforces this.
 */
type CardDataAttributes = Record<`data-${string}`, string | undefined>;

const RESERVED_DATA_KEYS = new Set(['data-card-id', 'data-focus-target']);

interface WorkspaceCardProps {
  id: string;
  title: string;
  icon: ReactNode;
  accentColor: string;
  meta?: ReactNode;
  badge?: ReactNode;
  defaultExpanded?: boolean;
  /** When false, hides chevron and disables expand/collapse interaction */
  collapsible?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  /** Arbitrary data-* attributes forwarded to the card root. See type docs above. */
  dataAttributes?: CardDataAttributes;
  children: ReactNode;
  className?: string;
}

export function WorkspaceCard({
  id,
  title,
  icon,
  accentColor,
  meta,
  badge,
  defaultExpanded = true,
  collapsible = true,
  onExpandChange,
  dataAttributes,
  children,
  className,
}: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const focusCtx = useCardFocus();
  const isFocused = focusCtx?.focusedCardId === id;
  // Phase 05 Commit 6 — rail mode: another card is focused, so this card
  // renders as a compact <button role="tab"> strip in the rail column
  // instead of its normal body. See WorkspaceGrid InvestigateGridInner
  // for the DOM-split owner.
  const isRailStrip = focusCtx !== undefined
    && focusCtx.focusedCardId !== null
    && focusCtx.focusedCardId !== id;

  // Strip reserved data-* keys so callers can't clobber the primitive's
  // own contract (data-card-id, data-focus-target).
  const forwardedDataAttrs = dataAttributes
    ? Object.fromEntries(
        Object.entries(dataAttributes).filter(
          ([key, value]) => !RESERVED_DATA_KEYS.has(key) && value !== undefined,
        ),
      )
    : undefined;

  // Body wrapper inline style composed from the shared base + expand-state.
  // React rerenders this whenever `expanded` changes; the browser transitions
  // the three properties automatically via the shared transition string.
  const bodyWrapperStyle: CSSProperties = {
    ...bodyWrapperBaseStyle,
    gridTemplateRows: expanded ? '1fr' : '0fr',
    opacity: expanded ? 1 : 0,
    transform: expanded ? 'scale(1)' : 'scale(0.97)',
  };

  useEffect(() => {
    if (!focusCtx || !isFocused) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isInSuppressedContext()) return;

      focusCtx.unfocus();
      event.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [focusCtx, isFocused]);

  const handleClick = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      onExpandChange?.(true);
    }
  }, [expanded, onExpandChange]);

  const handleDoubleClick = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  }, [expanded, onExpandChange]);

  // ── Phase 05 Commit 6 — rail mode render branch ──
  // When another card is focused, render this one as a compact
  // <button role="tab"> strip. Clicking/Enter/Space transfers focus to
  // this card. No double-click toggling (the header isn't a header
  // here), no inner focus-icon button (the strip IS the toggle), no
  // expand/collapse body. Single real AT target, no duplication.
  if (isRailStrip) {
    return (
      <button
        {...forwardedDataAttrs}
        type="button"
        role="tab"
        aria-label={`Focus ${title}`}
        data-card-id={id}
        data-focus-target="false"
        data-rail-strip="true"
        onClick={() => focusCtx.toggleFocus(id)}
        className={clsx(
          'flex w-full items-center gap-2 px-3 text-left',
          'rounded-[var(--card-radius)] border',
          'bg-[linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))]',
          'border-[var(--card-border)] hover:border-[var(--card-border-hover)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--card-border-hover)]',
          'transition-[transform,border-color]',
          'duration-[var(--duration-slow)] ease-[var(--ease-spring)]',
          'motion-safe:hover:-translate-y-[1px]',
          className,
        )}
        style={{
          height: 'var(--card-header-height)',
          minHeight: 'var(--card-header-height)',
        }}
      >
        <span
          className="block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex items-center gap-2 shrink-0">{icon}</span>
        <span className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-[0.5px] truncate">
          {title}
        </span>
      </button>
    );
  }

  return (
    <div
      {...forwardedDataAttrs}
      data-card-id={id}
      data-focus-target={isFocused ? 'true' : 'false'}
      className={clsx(
        'flex flex-col overflow-hidden',
        'rounded-[var(--card-radius)] border',
        'bg-[linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))]',
        'shadow-[0_12px_70px_-60px_rgba(142,240,183,0.5)]',
        'border-[var(--card-border)]',
        'hover:border-[var(--card-border-hover)]',
        // Phase 04.5 Direction C — hover lift via spring curve.
        // motion-safe: suppresses the translate under prefers-reduced-motion.
        'transition-[transform,border-color]',
        'duration-[var(--duration-slow)] ease-[var(--ease-spring)]',
        'motion-safe:hover:-translate-y-[1px]',
        className,
      )}
    >
      {/* Header */}
      <div
        data-card-header
        onClick={collapsible ? handleClick : undefined}
        onDoubleClick={collapsible ? handleDoubleClick : undefined}
        className={clsx(
          'flex items-center gap-2 px-3.5 shrink-0 select-none',
          collapsible && 'cursor-pointer',
          'border-b transition-colors duration-150',
          expanded ? 'border-[var(--card-border)]' : 'border-transparent',
          collapsible && 'hover:bg-[var(--muted)]/30',
        )}
        style={{ height: expanded ? 'var(--card-header-height)' : 'var(--card-collapsed-height)' }}
      >
        {collapsible && (
          <span className="text-[var(--muted-foreground)] shrink-0 transition-transform duration-150">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        <span
          className="block w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex items-center gap-2 shrink-0">{icon}</span>
        <span className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-[0.5px]">
          {title}
        </span>
        {badge && <span className="ml-1">{badge}</span>}
        {meta && <span className="ml-auto text-[10px] font-mono text-[var(--muted-foreground)]">{meta}</span>}
        {focusCtx && expanded && (
          <button
            type="button"
            aria-label={isFocused ? `Exit focus for ${title}` : `Focus ${title}`}
            aria-pressed={isFocused}
            onClick={(event) => {
              event.stopPropagation();
              focusCtx.toggleFocus(id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
            }}
            className={clsx(
              'inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--muted-foreground)]',
              meta ? 'ml-1' : 'ml-auto',
              'hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--card-border-hover)]',
              'transition-colors transition-background-color duration-150',
            )}
          >
            {isFocused ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}
      </div>

      {/* Body — grid-template-rows trick. Expanded: 1fr, collapsed: 0fr.
          Transitioned together with opacity + scale via --ease-emphasized. */}
      <div
        data-card-body
        data-card-body-state={expanded ? 'expanded' : 'collapsed'}
        style={bodyWrapperStyle}
      >
        <div style={bodyChildStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

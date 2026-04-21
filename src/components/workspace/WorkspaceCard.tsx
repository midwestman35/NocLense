import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';

import { isInSuppressedContext, useCardFocus } from './CardFocusContext';

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
  children,
  className,
}: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);
  const focusCtx = useCardFocus();
  const isFocused = focusCtx?.focusedCardId === id;

  // Only animate height on user-initiated expand/collapse, NOT on mount
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return; // Skip mount animation — use CSS initial state instead
    }

    const body = bodyRef.current;
    if (!body) return;

    if (expanded) {
      const contentHeight = contentRef.current?.scrollHeight ?? 0;
      body.style.height = '0px';
      body.style.opacity = '0';
      requestAnimationFrame(() => {
        body.style.transition = 'height var(--card-expand-duration) var(--room-transition-ease), opacity var(--card-expand-duration) var(--room-transition-ease)';
        body.style.height = `${contentHeight}px`;
        body.style.opacity = '1';
        const onEnd = () => {
          body.style.height = 'auto';
          body.removeEventListener('transitionend', onEnd);
        };
        body.addEventListener('transitionend', onEnd, { once: true });
      });
    } else {
      const currentHeight = body.scrollHeight;
      body.style.height = `${currentHeight}px`;
      body.style.transition = 'none';
      requestAnimationFrame(() => {
        body.style.transition = 'height var(--card-expand-duration) var(--room-transition-ease), opacity var(--card-expand-duration) var(--room-transition-ease)';
        body.style.height = '0px';
        body.style.opacity = '0';
      });
    }
  }, [expanded]);

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

  return (
    <div
      data-card-id={id}
      data-focus-target={isFocused ? 'true' : 'false'}
      className={clsx(
        'flex flex-col overflow-hidden',
        'rounded-[var(--card-radius)] border bg-[var(--card)]',
        'border-[var(--card-border)]',
        !expanded && 'hover:border-[var(--card-border-hover)]',
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

      {/* Body — CSS handles initial state, JS handles subsequent expand/collapse */}
      <div
        ref={bodyRef}
        data-card-body
        className="overflow-hidden"
        style={{
          height: defaultExpanded ? 'auto' : '0px',
          opacity: defaultExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="h-full">
          {children}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface WorkspaceCardProps {
  id: string;
  title: string;
  icon: ReactNode;
  accentColor: string;
  meta?: ReactNode;
  badge?: ReactNode;
  defaultExpanded?: boolean;
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
  onExpandChange,
  children,
  className,
}: WorkspaceCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);

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
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'flex items-center gap-2 px-3.5 shrink-0 cursor-pointer select-none',
          'border-b transition-colors duration-150',
          expanded ? 'border-[var(--card-border)]' : 'border-transparent',
          'hover:bg-[var(--muted)]/30',
        )}
        style={{ height: expanded ? 'var(--card-header-height)' : 'var(--card-collapsed-height)' }}
      >
        <span className="text-[var(--muted-foreground)] shrink-0 transition-transform duration-150">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
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

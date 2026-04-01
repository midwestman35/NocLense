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

  // Animate height on expand/collapse
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    if (expanded) {
      // Expand: measure content height, animate from 0 to auto
      const contentHeight = contentRef.current?.scrollHeight ?? 0;
      body.style.height = '0px';
      body.style.opacity = '0';
      requestAnimationFrame(() => {
        body.style.transition = 'height var(--card-expand-duration) var(--room-transition-ease), opacity var(--card-expand-duration) var(--room-transition-ease)';
        body.style.height = `${contentHeight}px`;
        body.style.opacity = '1';
        // After transition, set to auto for dynamic content
        const onEnd = () => {
          body.style.height = 'auto';
          body.removeEventListener('transitionend', onEnd);
        };
        body.addEventListener('transitionend', onEnd, { once: true });
      });
    } else {
      // Collapse: animate from current height to 0
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
    // Single click: expand if collapsed
    if (!expanded) {
      setExpanded(true);
      onExpandChange?.(true);
    }
  }, [expanded, onExpandChange]);

  const handleDoubleClick = useCallback(() => {
    // Double click: toggle (primarily used to collapse)
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
        expanded && 'border-[var(--card-border)]',
        !expanded && 'border-[var(--card-border)] hover:border-[var(--card-border-hover)]',
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
        {/* Expand/collapse chevron */}
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

      {/* Body — animated height */}
      <div
        ref={bodyRef}
        data-card-body
        className="overflow-hidden"
        style={{
          height: defaultExpanded ? 'auto' : '0px',
          opacity: defaultExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}

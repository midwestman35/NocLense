import { useState, useCallback, type ReactNode } from 'react';
import { clsx } from 'clsx';

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

  const handleDoubleClick = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  }, [expanded, onExpandChange]);

  return (
    <div
      data-card-id={id}
      className={clsx(
        'flex flex-col overflow-hidden transition-all',
        'rounded-[var(--card-radius)] border bg-[var(--card)]',
        'border-[var(--card-border)]',
        className,
      )}
      style={{
        transitionDuration: 'var(--card-expand-duration)',
        transitionTimingFunction: 'var(--room-transition-ease)',
      }}
    >
      {/* Header */}
      <div
        data-card-header
        onDoubleClick={handleDoubleClick}
        className={clsx(
          'flex items-center gap-2 px-3.5 shrink-0 cursor-pointer select-none',
          'border-b transition-colors',
          expanded ? 'border-[var(--card-border)]' : 'border-transparent',
          'hover:border-[var(--card-border-hover)]',
        )}
        style={{ height: expanded ? 'var(--card-header-height)' : 'var(--card-collapsed-height)' }}
      >
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

      {/* Body */}
      <div
        data-card-body
        className="overflow-hidden transition-all"
        style={{
          height: expanded ? 'auto' : '0px',
          opacity: expanded ? 1 : 0,
          transitionDuration: 'var(--card-expand-duration)',
          transitionTimingFunction: 'var(--room-transition-ease)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

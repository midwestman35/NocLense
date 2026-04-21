import React from 'react';
import { clsx } from 'clsx';

interface ToggleChipProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  /** Tailwind classes for the checkbox when checked (e.g. 'bg-[var(--warning)]/10 border-[var(--warning)]') */
  activeClassName?: string;
  /** Tailwind classes for the label on hover when active (e.g. 'group-hover:text-[var(--warning)]') */
  activeLabelClassName?: string;
  count?: number;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function ToggleChip({
  label,
  checked,
  onChange,
  icon,
  activeClassName = 'bg-[var(--foreground)] border-[var(--foreground)]',
  activeLabelClassName = 'group-hover:text-[var(--foreground)]',
  count,
  disabled = false,
  className,
  title,
}: ToggleChipProps) {
  return (
    <label
      className={clsx(
        'flex items-center gap-2 text-xs select-none group transition-colors',
        disabled
          ? 'cursor-default text-[var(--muted-foreground)] opacity-40'
          : 'cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
        className
      )}
      title={title}
    >
      <div
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.stopPropagation();
          onChange(!checked);
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={clsx(
          'w-4 h-4 border rounded transition-[background-color,border-color,color] duration-200 flex items-center justify-center',
          checked && !disabled ? activeClassName : 'border-[var(--muted-foreground)] bg-transparent'
        )}
      >
        {icon}
      </div>
      <span className={clsx('font-medium transition-colors', !disabled && activeLabelClassName)}>
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] opacity-70">({count})</span>
      )}
    </label>
  );
}

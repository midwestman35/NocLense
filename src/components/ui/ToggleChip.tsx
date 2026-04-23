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
        'tag group select-none transition-colors',
        disabled
          ? 'cursor-default opacity-40'
          : 'cursor-pointer hover:border-[var(--line-2)]',
        checked && !disabled ? 'border-[rgba(142,240,183,0.28)] bg-[rgba(142,240,183,0.1)] text-[var(--mint)]' : 'ink',
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
          'flex h-4 w-4 items-center justify-center rounded border transition-[background-color,border-color,color] duration-200',
          checked && !disabled ? activeClassName : 'border-[var(--ink-3)] bg-transparent text-[var(--ink-3)]'
        )}
      >
        {icon}
      </div>
      <span className={clsx('font-medium transition-colors', !disabled && checked && activeLabelClassName)}>
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="text-[10px] opacity-70">({count})</span>
      )}
    </label>
  );
}

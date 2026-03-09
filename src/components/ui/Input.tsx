import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type InputVariant = 'default' | 'search';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  label?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

const inputBase =
  'flex w-full rounded-[var(--radius-md)] border border-[var(--input)] ' +
  'bg-transparent px-3 py-2 text-[var(--text-base)] text-[var(--foreground)] ' +
  'placeholder:text-[var(--muted-foreground)] ' +
  'transition-colors duration-[var(--duration-fast)] ' +
  'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function Input({
  variant = 'default',
  label,
  icon,
  className,
  wrapperClassName,
  ...props
}: InputProps) {
  return (
    <div className={twMerge(clsx('flex flex-col gap-[var(--space-1)]', wrapperClassName))}>
      {label && (
        <label className="text-[var(--text-sm)] font-[var(--font-weight-medium)] text-[var(--muted-foreground)]">
          {label}
        </label>
      )}
      <div className="relative">
        {variant === 'search' && icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            {icon}
          </div>
        )}
        <input
          className={twMerge(
            clsx(inputBase, variant === 'search' && icon && 'pl-10', className)
          )}
          {...props}
        />
      </div>
    </div>
  );
}

export default Input;

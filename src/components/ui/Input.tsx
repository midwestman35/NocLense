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
  'w-full text-[13.5px] text-[var(--ink-0)] placeholder:text-[var(--ink-3)] ' +
  'focus-visible:outline-none ' +
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
        <label className="text-[11px] font-[var(--font-weight-medium)] uppercase tracking-[0.08em] text-[var(--ink-2)]">
          {label}
        </label>
      )}
      <div className="field">
        {variant === 'search' && icon && (
          <span className="lead">
            {icon}
          </span>
        )}
        <input
          className={twMerge(
            clsx(inputBase, className)
          )}
          {...props}
        />
      </div>
    </div>
  );
}

export default Input;

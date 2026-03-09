import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'destructive' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  'inline-flex items-center justify-center font-medium transition-colors ' +
  'duration-[var(--duration-fast)] ease-[var(--ease-default)] ' +
  'rounded-[var(--radius-md)] text-[var(--text-base)] ' +
  'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] ' +
  'focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  default:
    'bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90 h-9 px-4 py-2',
  ghost:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] h-9 px-4 py-2',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] h-9 px-4 py-2',
  destructive:
    'bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90 h-9 px-4 py-2',
  icon:
    'bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] h-9 w-9 p-0',
};

export function Button({
  variant = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(clsx(base, variants[variant], className))}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;

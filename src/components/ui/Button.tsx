import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'default' | 'ghost' | 'outline' | 'destructive' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'btn focus-visible:outline-none focus-visible:ring-[var(--ring-width)] ' +
  'focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)]';

const variants: Record<ButtonVariant, string> = {
  default: 'primary',
  ghost: 'ghost',
  outline: '',
  destructive: 'ghost text-[var(--red)] hover:text-[var(--red)]',
  icon: 'ghost p-0',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-7 px-2.5 py-1 text-[11.5px]',
  md: 'min-h-9 px-3.5 py-2 text-[13px]',
  lg: 'min-h-11 px-5 py-2.5 text-[13.5px]',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const sizeClass = variant === 'icon' ? iconSizes[size] : sizes[size];

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizeClass, className))}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;

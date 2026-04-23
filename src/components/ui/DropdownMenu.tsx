import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DROPDOWN_MENU_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1.11, 0.3, 1] as const, // sync with --ease-spring
};

export function DropdownMenu({ trigger, children, align = 'left', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={DROPDOWN_MENU_TRANSITION}
            className={twMerge(
              clsx(
                'glass absolute top-full z-[var(--z-dropdown)] mt-1 min-w-[180px] overflow-hidden',
                'text-[var(--ink-1)] shadow-[0_24px_70px_-42px_rgba(0,0,0,0.95)]',
                'py-1',
                align === 'right' ? 'right-0' : 'left-0',
                className
              )
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(142,240,183,0.14),transparent_56%)]" />
            <div className="relative">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DropdownItemProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function DropdownItem({ active, className, children, ...props }: DropdownItemProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-[var(--text-sm)]',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[rgba(142,240,183,0.1)] text-[var(--mint)]'
            : 'hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--ink-0)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

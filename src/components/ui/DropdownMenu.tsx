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
            transition={{ duration: 0.12 }}
            className={twMerge(
              clsx(
                'absolute top-full mt-1 z-[var(--z-dropdown)] min-w-[180px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--button-subtle-border)]',
                'text-[var(--popover-foreground)] shadow-[var(--shadow-raised)] backdrop-blur-md',
                'py-1',
                align === 'right' ? 'right-0' : 'left-0',
                className
              )
            )}
            style={{ backgroundImage: 'var(--menu-surface)' }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--menu-highlight)' }} />
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
            ? 'bg-[var(--menu-item-hover)] text-[var(--accent-foreground)]'
            : 'hover:bg-[var(--menu-item-hover)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}

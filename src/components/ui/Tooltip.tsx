import React, { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  className?: string;
  side?: 'top' | 'right';
}

const POSITION_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
} as const;

const MOTION_PROPS = {
  top: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
  },
  right: {
    initial: { opacity: 0, x: -4 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -4 },
  },
} as const;

export function Tooltip({ content, children, delay = 200, className, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  const motionProps = MOTION_PROPS[side];

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={motionProps.initial}
            animate={motionProps.animate}
            exit={motionProps.exit}
            transition={{ duration: 0.12 }}
            className={twMerge(
              clsx(
                'pointer-events-none absolute z-[var(--z-toast)] border border-[var(--border)]',
                'rounded-[var(--radius-sm)] bg-[var(--card)] text-[var(--foreground)]',
                'px-2.5 py-1 text-[var(--text-xs)] whitespace-nowrap shadow-[var(--shadow-sm)]',
                POSITION_CLASSES[side],
                className
              )
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

// eslint-disable-next-line react-refresh/only-export-components
export const TOOLTIP_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1.11, 0.3, 1] as const, // sync with --ease-spring
};

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
            transition={TOOLTIP_TRANSITION}
            className={twMerge(
              clsx(
                'pointer-events-none absolute z-[var(--z-toast)] border border-[var(--line-2)]',
                'rounded-[var(--radius-input)] bg-[rgba(14,18,24,0.86)] text-[var(--ink-1)]',
                'px-2.5 py-1 text-[11px] whitespace-nowrap shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md',
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

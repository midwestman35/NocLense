import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type SheetSide = 'left' | 'right' | 'bottom';

type AxisVariant = {
  x?: string | number;
  y?: string | number;
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  children: React.ReactNode;
  className?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SHEET_TRANSITION = {
  duration: 0.25,
  ease: [0.34, 1.56, 0.64, 1] as const, // sync with --ease-emphasized
};

const slideVariants: Record<SheetSide, { initial: AxisVariant; animate: AxisVariant; exit: AxisVariant }> = {
  left: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  right: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
  bottom: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
};

const sideClasses: Record<SheetSide, string> = {
  left: 'inset-y-0 left-0 w-[var(--sidebar-width)] border-r',
  right: 'inset-y-0 right-0 w-[var(--sidebar-width)] border-l',
  bottom: 'inset-x-0 bottom-0 h-auto max-h-[80vh] border-t',
};

export function Sheet({ open, onClose, side = 'left', children, className }: SheetProps) {
  const variants = slideVariants[side];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50"
          />
          <motion.div
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={SHEET_TRANSITION}
            className={twMerge(clsx('fixed z-[var(--z-modal)] bg-[var(--card)] border-[var(--border)]', sideClasses[side], className))}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

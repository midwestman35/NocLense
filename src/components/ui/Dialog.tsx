import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DIALOG_TRANSITION = {
  duration: 0.22,
  ease: [0.34, 1.56, 0.64, 1] as const, // sync with --ease-emphasized
};

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center bg-black/70 p-[var(--space-6)] backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={DIALOG_TRANSITION}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[80vh] w-full max-w-[500px] flex-col overflow-hidden text-[var(--ink-0)] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-[var(--space-5)] py-[var(--space-4)]">
              <h2 className="text-[var(--text-lg)] font-[var(--font-weight-semibold)] tracking-[var(--tracking-display)]">
                {title}
              </h2>
              <Button variant="icon" onClick={onClose} aria-label="Close">
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-[var(--space-5)] py-[var(--space-4)] text-[var(--ink-1)]">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-[var(--space-2)] border-t border-[var(--line)] px-[var(--space-5)] py-[var(--space-4)]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

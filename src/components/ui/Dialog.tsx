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
          className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center bg-black/55 p-[var(--space-6)]"
        >
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] max-h-[80vh] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-floating)]"
          >
            <div className="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] border-b border-[var(--border)]">
              <h2 className="text-[var(--text-lg)] font-[var(--font-weight-semibold)]">
                {title}
              </h2>
              <Button variant="icon" onClick={onClose} aria-label="Close">
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-[var(--space-5)] py-[var(--space-4)]">
              {children}
            </div>

            {footer && (
              <div className="flex items-center justify-end gap-[var(--space-2)] px-[var(--space-5)] py-[var(--space-4)] border-t border-[var(--border)]">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

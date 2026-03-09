import React, { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const SidebarPanel = memo(function SidebarPanel({
  title,
  isOpen,
  onClose,
  children,
}: SidebarPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 'var(--sidebar-panel-width)', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
          className={clsx(
            'relative z-[var(--z-sidebar)] flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)]'
          )}
          style={{ backgroundImage: 'var(--sidebar-surface)' }}
        >
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--sidebar-highlight)' }} />

          <div
            className="relative flex h-9 shrink-0 items-center justify-between border-b border-[var(--border)] px-3"
            style={{ backgroundImage: 'var(--panel-header-surface)' }}
          >
            <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
              {title}
            </span>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--muted-foreground)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--button-subtle-border)] hover:bg-[var(--button-subtle-surface)] hover:text-[var(--foreground)]"
              aria-label={`Close ${title}`}
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});

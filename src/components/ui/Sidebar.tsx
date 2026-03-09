import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, children, ...props }: SidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <motion.aside
      animate={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={twMerge(
        clsx(
          'relative flex flex-col h-full overflow-hidden',
          'border-r border-[var(--border)] bg-[var(--card)]',
          'z-[var(--z-sidebar)]',
          className
        )
      )}
      {...(props as React.ComponentProps<typeof motion.aside>)}
    >
      {children}
    </motion.aside>
  );
}

interface SidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export function SidebarItem({ icon, label, active, className, ...props }: SidebarItemProps) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)]',
          'rounded-[var(--radius-md)] cursor-pointer',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
          className
        )
      )}
      title={collapsed ? label : undefined}
      {...props}
    >
      <div className="shrink-0 w-[var(--icon-lg)] h-[var(--icon-lg)] flex items-center justify-center">
        {icon}
      </div>
      {!collapsed && (
        <span className="text-[var(--text-sm)] font-[var(--font-weight-medium)] truncate">
          {label}
        </span>
      )}
    </div>
  );
}

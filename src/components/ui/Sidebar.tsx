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

// eslint-disable-next-line react-refresh/only-export-components
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

type SidebarProps = React.HTMLAttributes<HTMLDivElement>;

export function Sidebar({ className, children, ...props }: SidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <motion.aside
      animate={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={twMerge(
        clsx(
          'relative flex h-full flex-col overflow-hidden',
          'border-r border-[var(--line)] bg-[linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))]',
          'text-[var(--ink-1)] shadow-[12px_0_70px_-60px_rgba(142,240,183,0.5)]',
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
            ? 'border border-[rgba(142,240,183,0.22)] bg-[rgba(142,240,183,0.08)] text-[var(--mint)]'
            : 'text-[var(--ink-2)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--ink-0)]',
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

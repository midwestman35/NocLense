import { useState, useCallback, type ReactNode } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { Button } from '../ui/Button';
import { PhaseDots } from './PhaseDots';
import type { Phase } from './types';

const APP_ICON_SRC = `${import.meta.env.BASE_URL}app-icons/noclense-icon-lens-trace.svg`;

interface PhaseHeaderProps {
  phase: Phase;
  onPhaseChange: (phase: Phase) => void;
  ticketId?: string;
  priorityLabel?: string;
  statusLabel?: string;
  /** Action buttons rendered between ticket context and phase dots */
  actions?: ReactNode;
}

export function PhaseHeader({
  phase,
  onPhaseChange,
  ticketId,
  priorityLabel,
  statusLabel,
  actions,
}: PhaseHeaderProps) {
  const [theme, setThemeState] = useState(getTheme);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    setThemeState(getTheme());
  }, []);

  return (
    <header
      className="relative h-[var(--header-height)] shrink-0 border-b border-[var(--border)]"
      style={{ backgroundImage: 'var(--header-surface)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'var(--header-highlight)' }}
      />
      <div className="relative flex h-full items-center px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[var(--foreground)]">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] shadow-[var(--shadow-flat)]">
            <img
              src={APP_ICON_SRC}
              alt="NocLense icon"
              className="h-[18px] w-[18px] shrink-0 rounded-[var(--radius-xs)]"
            />
          </div>
          <span className="leading-none">NocLense</span>
        </div>

        {/* Center-left: Ticket context (investigate + submit only) */}
        {ticketId && phase !== 'import' && (
          <div className="ml-6 flex items-center gap-2">
            <span className="text-xs font-mono tabular-nums text-[var(--muted-foreground)]">#{ticketId}</span>
            {priorityLabel && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--destructive)]/12 text-[var(--destructive)] border border-[var(--destructive)]/20">
                {priorityLabel}
              </span>
            )}
            {statusLabel && (
              <span className="text-[10px] text-[var(--muted-foreground)]">{statusLabel}</span>
            )}
          </div>
        )}

        {/* Center: Action buttons (optional) */}
        {actions && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {actions}
          </div>
        )}

        {/* Right: Phase dots + controls */}
        <div className={`${actions ? 'ml-4' : 'ml-auto'} flex items-center gap-3`}>
          <PhaseDots current={phase} onNavigate={onPhaseChange} />

          <div className="w-px h-5 bg-[var(--border)]" />

          <Button
            variant="icon"
            size="sm"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] text-[var(--foreground)] hover:bg-[var(--button-subtle-hover)]"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </Button>

        </div>
      </div>
    </header>
  );
}

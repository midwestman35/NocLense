import { useState, useCallback, type ReactNode } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { Button } from '../ui/Button';
import { PhaseDots } from './PhaseDots';
import type { Phase } from './types';

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
    <header className="relative h-[var(--header-height)] shrink-0 border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))] text-[var(--ink-1)] shadow-[0_12px_70px_-60px_rgba(142,240,183,0.5)]">
      <div className="relative flex h-full items-center px-4">
        {/* Center-left: Ticket context (investigate + submit only) */}
        {ticketId && phase !== 'import' && (
          <div className="flex items-center gap-2">
            <span className="mono text-xs tabular-nums text-[var(--ink-2)]">#{ticketId}</span>
            {priorityLabel && (
              <span className="rounded-full border border-[rgba(255,107,122,0.2)] bg-[rgba(255,107,122,0.1)] px-2 py-0.5 text-[9px] font-semibold text-[var(--red)]">
                {priorityLabel}
              </span>
            )}
            {statusLabel && (
              <span className="text-[10px] text-[var(--ink-3)]" style={{ textWrap: 'pretty' }}>
                {statusLabel}
              </span>
            )}
          </div>
        )}

        {/* Center: Action buttons (optional) */}
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
          </div>
        )}

        {/* Right: Phase dots + controls */}
        <div className={`${actions ? 'ml-4' : 'ml-auto'} flex items-center gap-3`}>
          <PhaseDots current={phase} onNavigate={onPhaseChange} />

          <div className="h-5 w-px bg-[var(--line)]" />

          <Button
            variant="icon"
            size="sm"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="border border-[var(--line)] bg-[rgba(255,255,255,0.02)] text-[var(--ink-1)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--ink-0)]"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </Button>
        </div>
      </div>
    </header>
  );
}

import React, { memo, useCallback } from 'react';
import {
  Ticket,
  FileText,
  Hash,
  BarChart3,
  Radio,
  Sparkles,
  Filter,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Tooltip } from '../ui';

export type PanelId = 'case' | 'files' | 'callIds' | 'reports' | 'stations' | 'ai' | 'filters';

interface IconRailProps {
  activePanel: PanelId | null;
  onPanelToggle: (panel: PanelId) => void;
  onSettingsClick: () => void;
}

const PANEL_ITEMS: { id: PanelId; icon: React.ElementType; label: string }[] = [
  { id: 'case', icon: Ticket, label: 'Tickets' },
  { id: 'files', icon: FileText, label: 'Files' },
  { id: 'callIds', icon: Hash, label: 'Call IDs' },
  { id: 'reports', icon: BarChart3, label: 'Reports' },
  { id: 'stations', icon: Radio, label: 'Stations' },
  { id: 'ai', icon: Sparkles, label: 'AI Analysis' },
  { id: 'filters', icon: Filter, label: 'Filters' },
];

const RailButton = memo(function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label} side="right" className="min-w-[72px] text-left">
      <button
        onClick={onClick}
        className={clsx(
          'relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-transparent',
          'transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--button-subtle-surface)] text-[var(--foreground)] border-[var(--button-subtle-border)]'
            : 'text-[var(--muted-foreground)] hover:bg-[var(--button-subtle-surface)] hover:text-[var(--foreground)] hover:border-[var(--button-subtle-border)]'
        )}
        aria-label={label}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[var(--ring)]" />}
        <Icon size={20} />
      </button>
    </Tooltip>
  );
});

export const IconRail = memo(function IconRail({
  activePanel,
  onPanelToggle,
  onSettingsClick,
}: IconRailProps) {
  const handleClick = useCallback((id: PanelId) => () => onPanelToggle(id), [onPanelToggle]);

  return (
    <nav
      className={clsx(
        'relative z-[var(--z-sidebar)] flex w-[var(--icon-rail-width)] shrink-0 flex-col items-center gap-1 overflow-hidden border-r border-[var(--border)] py-2'
      )}
      style={{ backgroundImage: 'var(--sidebar-surface)' }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--sidebar-highlight)' }} />
      <div className="relative flex h-full w-full flex-col items-center gap-1">
        {PANEL_ITEMS.map(({ id, icon, label }) => (
          <RailButton key={id} icon={icon} label={label} active={activePanel === id} onClick={handleClick(id)} />
        ))}

        <div className="flex-1" />

        <RailButton icon={Settings} label="Settings" active={false} onClick={onSettingsClick} />
      </div>
    </nav>
  );
});

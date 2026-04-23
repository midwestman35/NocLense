import type { JSX } from 'react';
import { Button, Icon, Sidebar as UiSidebar, SidebarItem, SidebarProvider } from '../ui';

interface DashboardSidebarProps {
  openCount: number;
  closedCount: number;
  onOpenWorkspace: () => void;
  onResetAuth: () => void;
}

export function DashboardSidebar({
  openCount,
  closedCount,
  onOpenWorkspace,
  onResetAuth,
}: DashboardSidebarProps): JSX.Element {
  return (
    <SidebarProvider>
      <UiSidebar className="w-[280px] shrink-0 px-4 py-5">
        <div className="flex items-center gap-3 border-b border-[var(--line)] pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[rgba(142,240,183,0.25)] bg-[linear-gradient(160deg,#1f5a3f,#0a1e15)]">
            <Icon name="radar" size={18} className="text-[var(--mint)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-[-0.02em] text-[var(--ink-0)]">NocLense</p>
            <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Carbyne · NOC</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <SidebarItem active icon={<Icon name="activity" size={16} />} label="Home" />
          <SidebarItem icon={<Icon name="import" size={16} />} label="Import room" onClick={onOpenWorkspace} />
          <SidebarItem icon={<Icon name="radar" size={16} />} label="Investigate room" onClick={onOpenWorkspace} />
          <SidebarItem icon={<Icon name="check" size={16} />} label="Submit room" onClick={onOpenWorkspace} />
        </div>

        <div className="mt-6 rounded-[var(--radius-panel)] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Queue health</p>
          <div className="mt-4 grid gap-3">
            <SidebarMetric icon="ticket" label="Open" value={openCount} accent="text-[var(--amber)]" />
            <SidebarMetric icon="check" label="Closed" value={closedCount} accent="text-[var(--mint)]" />
            <SidebarMetric icon="db" label="Integrations" value="3" accent="text-[var(--ink-1)]" />
          </div>
        </div>

        <div className="mt-6 rounded-[var(--radius-panel)] border border-[var(--line)] bg-[rgba(255,255,255,0.015)] p-4">
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Integrations</p>
          <div className="mt-4 space-y-3 text-sm text-[var(--ink-2)]">
            <IntegrationRow label="Zendesk" detail="Queue connected" />
            <IntegrationRow label="Datadog" detail="Telemetry ready" />
            <IntegrationRow label="Case library" detail="Local history indexed" />
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-6">
          <Button type="button" variant="ghost" className="w-full justify-start" onClick={onOpenWorkspace}>
            <Icon name="plus" size={14} />
            Open workspace
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-start text-[var(--ink-2)]" onClick={onResetAuth}>
            <Icon name="lock" size={14} />
            Sign out
          </Button>
        </div>
      </UiSidebar>
    </SidebarProvider>
  );
}

function SidebarMetric({
  icon,
  label,
  value,
  accent,
}: {
  icon: 'ticket' | 'check' | 'db';
  label: string;
  value: number | string;
  accent: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-input)] border border-[var(--line)] bg-[rgba(255,255,255,0.03)]">
        <Icon name={icon} size={14} className="text-[var(--ink-2)]" />
      </div>
      <div className="min-w-0">
        <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">{label}</p>
        <p className={`text-sm font-medium ${accent}`}>{value}</p>
      </div>
    </div>
  );
}

function IntegrationRow({ label, detail }: { label: string; detail: string }): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 h-2 w-2 rounded-full bg-[var(--mint)] shadow-[0_0_6px_var(--mint)]" />
      <div className="min-w-0">
        <p className="text-sm text-[var(--ink-1)]">{label}</p>
        <p className="text-xs text-[var(--ink-3)]">{detail}</p>
      </div>
    </div>
  );
}

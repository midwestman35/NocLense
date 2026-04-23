import type { JSX } from 'react';
import type { Case } from '../../types/case';
import { Button, Card, CardContent, Icon } from '../ui';

interface InvestigationRowProps {
  caseItem: Case;
  onOpenWorkspace: () => void;
}

export function InvestigationRow({ caseItem, onOpenWorkspace }: InvestigationRowProps): JSX.Element {
  return (
    <Card className="border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))]">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[88px_minmax(0,1fr)_140px_110px] lg:items-center">
        <div className="space-y-2">
          <p className="mono text-[11px] text-[var(--ink-2)]">#{caseItem.externalRef ?? caseItem.id}</p>
          <SeverityPill severity={caseItem.severity} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--ink-0)]">{caseItem.title}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-3)]">
            {caseItem.summary || caseItem.impact || 'No summary captured yet.'}
          </p>
        </div>

        <div className="space-y-1 text-xs text-[var(--ink-3)]">
          <p className="mono uppercase tracking-[0.12em]">Owner</p>
          <p className="text-sm text-[var(--ink-1)]">{caseItem.owner ?? 'Unassigned'}</p>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="text-right">
            <p className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">Updated</p>
            <p className="text-sm text-[var(--ink-1)]">{formatRelativeTime(caseItem.updatedAt)}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenWorkspace}>
            <Icon name="arrowRight" size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityPill({ severity }: { severity: Case['severity'] }): JSX.Element {
  const className = severity === 'critical' || severity === 'high'
    ? 'bg-[rgba(255,107,122,0.12)] text-[var(--red)] border-[rgba(255,107,122,0.2)]'
    : severity === 'medium'
      ? 'bg-[rgba(247,185,85,0.12)] text-[var(--amber)] border-[rgba(247,185,85,0.2)]'
      : 'bg-[rgba(255,255,255,0.04)] text-[var(--ink-2)] border-[var(--line)]';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 mono text-[10px] uppercase tracking-[0.12em] ${className}`}>
      {severity}
    </span>
  );
}

function formatRelativeTime(timestamp: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

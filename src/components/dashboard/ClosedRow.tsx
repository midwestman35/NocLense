import type { JSX } from 'react';
import type { Case } from '../../types/case';
import { Icon } from '../ui';

export function ClosedRow({ caseItem }: { caseItem: Case }): JSX.Element {
  return (
    <div className="grid gap-3 border-b border-[var(--line)] py-3 text-sm text-[var(--ink-2)] lg:grid-cols-[96px_minmax(0,1fr)_160px_120px] lg:items-center">
      <span className="mono text-[11px] text-[var(--ink-3)]">#{caseItem.externalRef ?? caseItem.id}</span>
      <span className="truncate text-[var(--ink-1)]">{caseItem.title}</span>
      <span className="mono text-[11px] text-[var(--ink-3)]">{caseItem.owner ?? 'Unassigned'}</span>
      <span className="inline-flex items-center gap-2 text-[var(--mint)]">
        <Icon name="check" size={12} />
        Archived
      </span>
    </div>
  );
}

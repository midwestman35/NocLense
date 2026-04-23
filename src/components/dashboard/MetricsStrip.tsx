import { useMemo, type JSX } from 'react';
import type { Case } from '../../types/case';
import { Card, CardContent } from '../ui';

interface MetricsStripProps {
  cases: Case[];
  similarCount: number;
}

export function MetricsStrip({ cases, similarCount }: MetricsStripProps): JSX.Element {
  const metrics = useMemo(() => {
    const openCount = cases.filter((caseItem) => caseItem.status !== 'resolved').length;
    const highCount = cases.filter((caseItem) => caseItem.severity === 'high' || caseItem.severity === 'critical').length;
    const handoffCount = cases.filter((caseItem) => caseItem.status === 'handoff').length;
    const notesCount = cases.reduce((sum, caseItem) => sum + caseItem.notes.length, 0);

    return [
      { label: 'Open', value: openCount, accent: 'text-[var(--ink-0)]' },
      { label: 'High', value: highCount, accent: 'text-[var(--amber)]' },
      { label: 'Handoff', value: handoffCount, accent: 'text-[var(--mint)]' },
      { label: 'Notes', value: notesCount, accent: 'text-[var(--ink-1)]' },
      { label: 'Related', value: similarCount, accent: 'text-[var(--violet)]' },
    ];
  }, [cases, similarCount]);

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-[var(--line)] bg-[rgba(255,255,255,0.02)]">
          <CardContent className="space-y-2 p-4">
            <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">{metric.label}</p>
            <p className={`text-2xl font-medium tracking-[-0.03em] ${metric.accent}`}>{metric.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

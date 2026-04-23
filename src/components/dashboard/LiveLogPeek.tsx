import type { JSX } from 'react';
import type { SimilarCaseMatch } from '../../services/caseLibraryService';
import type { Case } from '../../types/case';
import { Card, CardContent, CardHeader, Icon, LogHistogram } from '../ui';

interface LiveLogPeekProps {
  caseItem: Case | null;
  similarMatches: SimilarCaseMatch[];
}

export function LiveLogPeek({ caseItem, similarMatches }: LiveLogPeekProps): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]">
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--mint)] shadow-[0_0_8px_var(--mint)] animate-phase-pulse" />
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)]">Live log peek</span>
          </div>
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
            {caseItem ? `#${caseItem.externalRef ?? caseItem.id}` : 'No active case'}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogHistogram bars={88} height={54} accent="var(--mint)" />
          <p className="text-sm leading-6 text-[var(--ink-2)]">
            {caseItem
              ? caseItem.summary || caseItem.impact || 'Case summary will appear here as investigations are persisted.'
              : 'Import or create a case to see the dashboard summary and room handoff context.'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-[var(--line)] bg-[linear-gradient(180deg,rgba(165,140,255,0.05),transparent)]">
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <Icon name="spark" size={13} className="text-[var(--violet)]" />
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)]">Case library</span>
          </div>
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--violet)]">{similarMatches.length} related</span>
        </CardHeader>
        <CardContent className="space-y-3">
          {similarMatches.length === 0 ? (
            <p className="text-sm leading-6 text-[var(--ink-2)]">
              Similar closed cases will appear here when the local embedding index is available.
            </p>
          ) : (
            similarMatches.map((match) => (
              <div key={match.case.id} className="rounded-[var(--radius-input)] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-3">
                <p className="truncate text-sm text-[var(--ink-1)]">{match.case.title}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--ink-3)]">
                  <span className="mono">#{match.case.externalRef ?? match.case.id}</span>
                  <span className="mono text-[var(--violet)]">{Math.round(match.score * 100)}%</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

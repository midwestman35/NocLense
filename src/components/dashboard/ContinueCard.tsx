import type { JSX } from 'react';
import type { Case } from '../../types/case';
import { Badge, Button, Card, CardContent, Icon, Spark } from '../ui';

interface ContinueCardProps {
  caseItem: Case;
  relatedCount: number;
  onResume: () => void;
}

export function ContinueCard({ caseItem, relatedCount, onResume }: ContinueCardProps): JSX.Element {
  return (
    <Card variant="elevated" className="overflow-hidden border-[var(--line-2)] bg-[linear-gradient(180deg,rgba(18,24,20,0.88),rgba(10,13,18,0.82))]">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center lg:p-7">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="mono text-[10px] uppercase tracking-[0.12em]">Continue</Badge>
            <Badge variant="outline" className="mono text-[10px] uppercase tracking-[0.12em]">
              {caseItem.status}
            </Badge>
            <span className="mono text-[11px] text-[var(--ink-3)]">#{caseItem.externalRef ?? caseItem.id}</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-medium tracking-[-0.03em] text-[var(--ink-0)]">{caseItem.title}</h2>
            <p className="max-w-[58ch] text-sm leading-6 text-[var(--ink-2)]">
              {caseItem.summary || caseItem.impact || 'Resume the most recent investigation from the current case repository.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-[var(--ink-3)]">
            <span className="mono uppercase tracking-[0.12em]">Owner · {caseItem.owner ?? 'Unassigned'}</span>
            <span className="mono uppercase tracking-[0.12em]">Severity · {caseItem.severity}</span>
            <span className="mono uppercase tracking-[0.12em]">Related cases · {relatedCount}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onResume}>
              <Icon name="arrowRight" size={14} />
              Resume investigation
            </Button>
            <Button type="button" variant="ghost" onClick={onResume}>
              <Icon name="import" size={14} />
              Open workspace
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-panel)] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] p-5">
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Activity profile</p>
          <div className="mt-4">
            <Spark
              data={[
                Math.max(caseItem.bookmarks.length, 1),
                caseItem.notes.length + 1,
                caseItem.attachments.length + 1,
                relatedCount + 1,
                caseItem.summary.length > 0 ? 4 : 2,
                caseItem.impact.length > 0 ? 5 : 2,
              ]}
              color="var(--mint)"
              w={180}
              h={48}
            />
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[var(--ink-2)]">
            <div className="flex items-center justify-between">
              <span>Attachments</span>
              <span className="mono text-[var(--ink-1)]">{caseItem.attachments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Evidence bookmarks</span>
              <span className="mono text-[var(--ink-1)]">{caseItem.bookmarks.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Notes</span>
              <span className="mono text-[var(--ink-1)]">{caseItem.notes.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

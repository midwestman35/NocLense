import type { CSSProperties } from 'react';
import { Badge } from '../../../ui/Badge';
import Button from '../../../ui/Button';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import { Tooltip } from '../../../ui/Tooltip';
import type { ActionPayload, BlockOf } from '../../../../types/canonical';

interface ActionBlockProps {
  block: BlockOf<'action'>;
}

const ACTION_META: Record<ActionPayload['kind'], { label: string; button: string; style: CSSProperties }> = {
  resolve: { label: 'Resolve', button: 'Resolve', style: { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' } },
  jira: { label: 'Create Jira', button: 'Create Jira', style: { backgroundColor: 'color-mix(in srgb, var(--info) 14%, transparent)', color: 'var(--info)' } },
  'test-script': { label: 'Run Test Script', button: 'Run Script', style: { backgroundColor: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning)' } },
  escalate: { label: 'Escalate', button: 'Escalate', style: { backgroundColor: 'color-mix(in srgb, var(--destructive) 14%, transparent)', color: 'var(--destructive)' } },
};

function renderPayload(payload: ActionPayload) {
  switch (payload.kind) {
    case 'resolve':
      return (
        <div className="space-y-[var(--space-2)]">
          <pre className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)] p-[var(--space-2)] whitespace-pre-wrap break-words text-[var(--text-xs)] text-[var(--foreground)]">
            {payload.resolutionNote}
          </pre>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {payload.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
        </div>
      );
    case 'jira':
      return (
        <div className="space-y-[var(--space-2)] text-[var(--text-sm)]">
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <span className="font-[var(--font-weight-medium)] text-[var(--foreground)]">{payload.projectKey}</span>
            {payload.priority && <Badge variant="outline">{payload.priority}</Badge>}
          </div>
          <p className="text-[var(--foreground)]">{payload.summary}</p>
          <p className="whitespace-pre-wrap break-words text-[var(--muted-foreground)]">{payload.description}</p>
        </div>
      );
    case 'test-script':
      return (
        <div className="space-y-[var(--space-2)] text-[var(--text-sm)]">
          <p className="font-[var(--font-weight-medium)] text-[var(--foreground)]">{payload.scriptId}</p>
          {payload.parameters && (
            <table className="w-full text-left text-[var(--text-xs)]">
              <tbody>
                {Object.entries(payload.parameters).map(([key, value]) => (
                  <tr key={key} className="border-t border-[var(--border)]">
                    <th className="py-[var(--space-1)] font-[var(--font-weight-medium)] text-[var(--muted-foreground)]">{key}</th>
                    <td className="py-[var(--space-1)] text-[var(--foreground)]">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    case 'escalate':
      return (
        <div className="space-y-[var(--space-2)] text-[var(--text-sm)]">
          <p className="font-[var(--font-weight-medium)] text-[var(--foreground)]">{payload.team}</p>
          <p className="whitespace-pre-wrap break-words text-[var(--muted-foreground)]">{payload.reason}</p>
        </div>
      );
  }
}

export default function ActionBlock({ block }: ActionBlockProps) {
  const headingId = `canonical-block-${block.id}`;
  const meta = ACTION_META[block.body.payload.kind];

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[var(--card-radius)]">
      <CardHeader className="items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0 space-y-[var(--space-2)]">
          <Badge aria-label={`Action kind: ${meta.label.toLowerCase()}`} data-action-kind={block.body.payload.kind} style={meta.style}>
            {meta.label}
          </Badge>
          <h3 id={headingId} className="text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]">
            Action
          </h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-[var(--space-3)]">
        <p className="whitespace-pre-wrap break-words text-[var(--text-sm)] text-[var(--foreground)]">
          {block.body.summary}
        </p>
        {renderPayload(block.body.payload)}
        <Tooltip content="Action wiring lands in Phase 03" delay={0}>
          <Button type="button" variant="outline" size="sm" disabled>
            {meta.button}
          </Button>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

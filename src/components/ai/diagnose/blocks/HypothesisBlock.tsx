import { Badge } from '../../../ui/Badge';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import type { BlockOf } from '../../../../types/canonical';
import StatusChip from './StatusChip';

interface HypothesisBlockProps {
  block: BlockOf<'hypothesis'>;
}

const SECTION_LABELS: Array<{
  key: keyof BlockOf<'hypothesis'>['body'];
  label: string;
}> = [
  { key: 'supportingEvidence', label: 'Supporting Evidence' },
  { key: 'evidenceToConfirm', label: 'Evidence to Confirm' },
  { key: 'evidenceToRuleOut', label: 'Evidence to Rule Out' },
];

export default function HypothesisBlock({ block }: HypothesisBlockProps) {
  const headingId = `canonical-block-${block.id}`;

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[var(--card-radius)]">
      <CardHeader className="items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0 space-y-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Badge variant="outline" aria-label={`Hypothesis rank ${block.body.rank}`}>
              H{block.body.rank}
            </Badge>
            <StatusChip status={block.body.status} />
          </div>
          <h3
            id={headingId}
            className="text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
          >
            {block.body.title}
          </h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-[var(--space-2)]">
        {SECTION_LABELS.map(({ key, label }) => (
          <details
            key={key}
            open
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)] px-[var(--space-3)] py-[var(--space-2)]"
          >
            <summary className="cursor-pointer list-none text-[var(--text-sm)] font-[var(--font-weight-medium)] text-[var(--foreground)]">
              {label}
            </summary>
            <p className="mt-[var(--space-2)] whitespace-pre-wrap break-words text-[var(--text-sm)] text-[var(--muted-foreground)]">
              {block.body[key] || 'No details provided.'}
            </p>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

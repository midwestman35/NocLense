import type { CSSProperties } from 'react';
import { Badge } from '../../../ui/Badge';
import Button from '../../../ui/Button';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import type {
  BlockOf,
  CitationId,
  Investigation,
  PriorArtSource,
} from '../../../../types/canonical';

interface PriorArtBlockProps {
  block: BlockOf<'prior-art'>;
  investigation: Investigation;
  onCitationClick?: (citationId: CitationId) => void;
}

const warnedMissingCitations = new Set<string>();

const SOURCE_META: Record<PriorArtSource, { label: string; style: CSSProperties }> = {
  jira: { label: 'JIRA', style: { backgroundColor: 'color-mix(in srgb, var(--info) 14%, transparent)', color: 'var(--info)' } },
  zendesk: { label: 'ZENDESK', style: { backgroundColor: 'color-mix(in srgb, var(--warning) 14%, transparent)', color: 'var(--warning)' } },
  slack: { label: 'SLACK', style: { backgroundColor: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' } },
  datadog: { label: 'DATADOG', style: { backgroundColor: 'color-mix(in srgb, var(--accent-foreground) 14%, transparent)', color: 'var(--accent-foreground)' } },
  confluence: { label: 'CONFLUENCE', style: { backgroundColor: 'color-mix(in srgb, var(--foreground) 14%, transparent)', color: 'var(--foreground)' } },
  'local-folder': { label: 'LOCAL', style: { backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 14%, transparent)', color: 'var(--muted-foreground)' } },
};

export default function PriorArtBlock({
  block,
  investigation,
  onCitationClick,
}: PriorArtBlockProps) {
  const headingId = `canonical-block-${block.id}`;
  const meta = SOURCE_META[block.body.source];
  const citation = investigation.citations[block.body.sourceCitationId];

  if (!citation && !warnedMissingCitations.has(block.id)) {
    console.warn(
      `Missing prior-art citation for block ${block.id}: ${block.body.sourceCitationId}`,
    );
    warnedMissingCitations.add(block.id);
  }

  return (
    <Card
      variant="elevated"
      className="overflow-hidden rounded-[var(--card-radius)]"
      data-source={block.body.source}
    >
      <CardHeader className="items-start gap-[var(--space-3)]">
        <Badge style={meta.style}>{meta.label}</Badge>
        <h3
          id={headingId}
          className="min-w-0 text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
          style={{ textWrap: 'balance' }}
        >
          {block.body.title}
        </h3>
      </CardHeader>
      <CardContent className="space-y-[var(--space-3)]">
        {block.body.summary && (
          <p
            className="whitespace-pre-wrap break-words text-[var(--text-sm)] text-[var(--foreground)]"
            style={{ textWrap: 'pretty' }}
          >
            {block.body.summary}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={!citation}
          disabled={!citation}
          className="h-7 rounded-[var(--radius-sm)] text-[var(--text-xs)]"
          aria-label={
            citation?.source.kind === 'log'
              ? `Log reference ${citation.displayText}`
              : undefined
          }
          onClick={() => {
            onCitationClick?.(block.body.sourceCitationId);
          }}
        >
          {citation?.displayText ?? 'Source citation unavailable'}
        </Button>
      </CardContent>
    </Card>
  );
}

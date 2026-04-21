import Button from '../../../ui/Button';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import {
  isBlockOfKind,
  type BlockOf,
  type CitationId,
  type Investigation,
} from '../../../../types/canonical';
import StatusChip from './StatusChip';

interface AnalysisBlockProps {
  block: BlockOf<'analysis'>;
  investigation: Investigation;
  onCitationClick?: (citationId: CitationId) => void;
}

export default function AnalysisBlock({
  block,
  investigation,
  onCitationClick,
}: AnalysisBlockProps) {
  const headingId = `canonical-block-${block.id}`;
  const linkedBlock = investigation.blocks.find(
    (candidate) => candidate.id === block.body.hypothesisBlockId,
  );
  const hypothesisTitle =
    linkedBlock && isBlockOfKind(linkedBlock, 'hypothesis')
      ? linkedBlock.body.title
      : 'Unknown hypothesis';

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[var(--card-radius)]">
      <CardHeader className="items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
          >
            Analysis: {hypothesisTitle}
          </h3>
        </div>
        <StatusChip status={block.body.statusUpdate} />
      </CardHeader>
      <CardContent className="space-y-[var(--space-3)]">
        <p className="whitespace-pre-wrap break-words text-[var(--text-sm)] text-[var(--foreground)]">
          {block.body.summary}
        </p>
        {block.citations.length > 0 && (
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {block.citations.map((citationId) => {
              const citation = investigation.citations[citationId];

              return (
                <Button
                  key={citationId}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-[var(--radius-sm)] text-[var(--text-xs)]"
                  onClick={() => {
                    onCitationClick?.(citationId);
                  }}
                >
                  {citation?.displayText ?? String(citationId)}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

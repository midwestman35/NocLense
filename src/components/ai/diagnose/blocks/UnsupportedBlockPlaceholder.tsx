import { Card, CardContent } from '../../../ui/Card';
import type { Block } from '../../../../types/canonical';

interface UnsupportedBlockPlaceholderProps {
  block: Block;
}

export default function UnsupportedBlockPlaceholder({
  block,
}: UnsupportedBlockPlaceholderProps) {
  const headingId = `canonical-block-${block.id}`;

  return (
    <Card
      className="rounded-[var(--card-radius)] border-dashed bg-[var(--muted)]"
      data-testid={`unsupported-block-${block.kind}`}
    >
      <CardContent className="space-y-[var(--space-2)]">
        <h3
          id={headingId}
          className="text-[var(--text-sm)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
        >
          Block: {block.kind} (renderer pending)
        </h3>
        <pre className="overflow-auto rounded-[var(--radius-md)] bg-[var(--background)] p-[var(--space-2)] text-[10px] leading-4 text-[var(--muted-foreground)]">
          {JSON.stringify(block.body, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

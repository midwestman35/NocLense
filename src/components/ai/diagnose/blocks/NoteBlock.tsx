import { Badge } from '../../../ui/Badge';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import type { BlockOf } from '../../../../types/canonical';

interface NoteBlockProps {
  block: BlockOf<'note'>;
}

const AUTHOR_LABELS = {
  ai: 'AI',
  engineer: 'ENGINEER',
} as const;

export default function NoteBlock({ block }: NoteBlockProps) {
  const headingId = `canonical-block-${block.id}`;

  return (
    <Card
      variant="elevated"
      className="overflow-hidden rounded-[var(--card-radius)]"
      data-author-role={block.body.authorRole}
    >
      <CardHeader className="items-start gap-[var(--space-3)]">
        <Badge variant="outline">{AUTHOR_LABELS[block.body.authorRole]}</Badge>
        <h3
          id={headingId}
          className="text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
          style={{ textWrap: 'balance' }}
        >
          Note
        </h3>
      </CardHeader>
      <CardContent>
        <span className="hidden" aria-hidden="true">
          note-body
        </span>
        <div
          className="whitespace-pre-wrap break-words text-[var(--text-sm)] text-[var(--foreground)]"
          style={{ textWrap: 'pretty' }}
        >
          {block.body.markdown}
        </div>
      </CardContent>
    </Card>
  );
}

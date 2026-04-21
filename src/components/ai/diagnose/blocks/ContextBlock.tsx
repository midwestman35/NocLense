import { Card, CardContent, CardHeader } from '../../../ui/Card';
import type { BlockOf } from '../../../../types/canonical';

interface ContextBlockProps {
  block: BlockOf<'context'>;
}

export default function ContextBlock({ block }: ContextBlockProps) {
  const headingId = `canonical-block-${block.id}`;
  const details = [
    ['Site', block.body.site],
    ['CNC', block.body.cnc],
    ['Region', block.body.region],
    ['Version', block.body.version],
    ['Event ID', block.body.eventId],
  ].filter((detail): detail is [string, string] => Boolean(detail[1]?.trim()));

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[var(--card-radius)]">
      <CardHeader className="justify-between">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="truncate text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]"
          >
            {block.body.customer}
          </h3>
          {block.body.ticketUrl && (
            <a
              href={block.body.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-sm)] text-[var(--info)] underline-offset-2 hover:underline"
            >
              Open ticket
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-[var(--space-3)]">
        {details.length > 0 && (
          <dl className="grid gap-[var(--space-3)] text-[var(--text-sm)] sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[var(--muted-foreground)]">{label}</dt>
                <dd className="truncate text-[var(--foreground)]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {block.body.reported && (
          <p className="whitespace-pre-wrap break-words text-[var(--text-sm)] italic text-[var(--muted-foreground)]">
            {block.body.reported}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

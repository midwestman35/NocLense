import Button from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Card, CardContent, CardHeader } from '../../../ui/Card';
import { isBlockOfKind, type BlockOf, type CollectionStepDependency, type Investigation } from '../../../../types/canonical';

interface CollectionBlockProps {
  block: BlockOf<'collection'>;
  investigation: Investigation;
}

function getDependencyLabel(dependency?: CollectionStepDependency): string | null {
  if (!dependency) return null;
  return dependency.kind === 'do-first' ? 'Do first' : `If ${dependency.ofStepLabel} fails`;
}

export default function CollectionBlock({ block, investigation }: CollectionBlockProps) {
  const headingId = `canonical-block-${block.id}`;
  const linkedBlock = block.body.targetHypothesisBlockId ? investigation.blocks.find((candidate) => candidate.id === block.body.targetHypothesisBlockId) : null;
  const hypothesisTitle = linkedBlock && isBlockOfKind(linkedBlock, 'hypothesis') ? linkedBlock.body.title : null;

  return (
    <Card variant="elevated" className="overflow-hidden rounded-[var(--card-radius)]">
      <CardHeader className="flex-col items-start gap-[var(--space-1)]">
        <h3 id={headingId} className="text-[var(--text-base)] font-[var(--font-weight-semibold)] text-[var(--foreground)]">
          Collection Guidance
        </h3>
        {hypothesisTitle && (
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            For hypothesis: {hypothesisTitle}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ol className="space-y-[var(--space-3)]">
          {block.body.steps.map((step, index) => {
            const dependencyLabel = getDependencyLabel(step.dependsOn);

            return (
              <li
                key={`${step.label}-${index}`}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-[var(--space-3)] py-[var(--space-3)] transition-shadow hover:shadow-[var(--shadow-raised)]"
              >
                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  <span className="text-[var(--text-sm)] font-[var(--font-weight-medium)] text-[var(--foreground)]">
                    {step.label}
                  </span>
                  {dependencyLabel && <Badge variant="outline">{dependencyLabel}</Badge>}
                </div>
                {step.command && (
                  <div className="mt-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)] p-[var(--space-2)]">
                    <div className="mb-[var(--space-2)] flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[var(--text-xs)]"
                        onClick={() => {
                          void navigator.clipboard.writeText(step.command ?? '');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-words font-[var(--font-mono)] text-[var(--text-xs)] tabular-nums text-[var(--foreground)]">
                      {step.command}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

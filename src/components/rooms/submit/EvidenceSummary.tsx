import { useMemo, type JSX } from 'react';
import { Bookmark, Check, Copy } from 'lucide-react';
import { Badge, Button } from '../../ui';
import { useEvidence } from '../../../contexts/EvidenceContext';
import { useCopyFeedback } from '../../../hooks/useCopyFeedback';
import { buildJiraTemplate } from '../../../services/jiraTemplateBuilder';
import type { Block } from '../../../types/canonical';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';

const MAX_EVIDENCE_PREVIEW = 5;

export interface EvidencePreviewItem {
  label: string;
  kind: Block['kind'] | 'unknown';
  note?: string;
}

function labelForBlock(block: Block | undefined): string {
  if (!block) return 'Missing investigation block';
  switch (block.kind) {
    case 'context':
      return block.body.customer;
    case 'hypothesis':
      return block.body.title;
    case 'analysis':
      return block.body.summary;
    case 'action':
      return block.body.summary;
    case 'note':
      return block.body.markdown;
    case 'prior-art':
      return block.body.title;
    case 'collection':
      return block.body.steps.map((step) => step.label).join(', ') || 'Collection step';
  }
}

export function EvidenceSummary(): JSX.Element {
  const { investigation, evidenceSet } = useEvidence();
  const { copied, copy } = useCopyFeedback();

  const previewItems = useMemo<EvidencePreviewItem[]>(() => {
    if (!investigation || !evidenceSet) return [];
    return evidenceSet.items.slice(0, MAX_EVIDENCE_PREVIEW).map((item) => {
      const block = investigation.blocks.find((candidate) => candidate.id === item.blockId);
      return {
        label: labelForBlock(block).slice(0, 90),
        kind: block?.kind ?? 'unknown',
        note: item.note,
      };
    });
  }, [investigation, evidenceSet]);

  const jiraFormatted = useMemo(
    () => (investigation ? buildJiraTemplate(investigation).formatted : ''),
    [investigation],
  );

  const itemCount = evidenceSet?.items.length ?? 0;

  return (
    <WorkspaceCard
      id="evidence-summary"
      title="Evidence Summary"
      icon={<Bookmark size={14} />}
      accentColor="#f59e0b"
      collapsible={false}
      meta={<span>{itemCount} pinned</span>}
      className="min-h-0"
    >
      <div className="flex min-h-0 flex-col gap-4 p-4">
        <div>
          <p className="font-mono text-[26px] leading-none text-[var(--ink-0)]">
            {itemCount}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
            item{itemCount === 1 ? '' : 's'} pinned for handoff
          </p>
        </div>

        {itemCount === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-4 text-[12px] leading-relaxed text-[var(--ink-3)]">
            Capture evidence in Investigate before final export. Pinned blocks appear here and in the
            Jira handoff template.
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Pinned evidence items">
            {previewItems.map((item, index) => (
              <li
                key={`${item.kind}-${index}`}
                className="grid grid-cols-[72px_1fr] gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.02)] px-3 py-2"
              >
                <Badge variant={item.kind === 'unknown' ? 'level-warn' : 'outline'}>
                  {item.kind}
                </Badge>
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-[var(--ink-1)]">{item.label}</p>
                  {item.note && (
                    <p className="mt-1 truncate font-mono text-[10px] text-[var(--ink-3)]">
                      {item.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {itemCount > MAX_EVIDENCE_PREVIEW && (
              <li className="font-mono text-[10px] text-[var(--ink-3)]">
                +{itemCount - MAX_EVIDENCE_PREVIEW} more evidence items in the export
              </li>
            )}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copy(jiraFormatted)}
          disabled={!jiraFormatted}
          className="w-full justify-center"
          aria-label="Copy Jira creation template to clipboard"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy Jira Template'}
        </Button>
      </div>
    </WorkspaceCard>
  );
}

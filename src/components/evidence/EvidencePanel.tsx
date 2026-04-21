import { useMemo, useState, type CSSProperties, type DragEvent, type JSX } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GripVertical, PinOff, StickyNote } from 'lucide-react';
import { useEvidence } from '../../contexts/EvidenceContext';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { Badge } from '../ui/Badge';
import Button from '../ui/Button';
import StatusChip from '../ai/diagnose/blocks/StatusChip';
import type { ActionPayload, Block, EvidenceItem, PriorArtSource } from '../../types/canonical';

const PRIOR_ART_LABELS: Record<PriorArtSource, string> = {
  jira: 'JIRA',
  zendesk: 'ZENDESK',
  slack: 'SLACK',
  datadog: 'DATADOG',
  confluence: 'CONFLUENCE',
  'local-folder': 'LOCAL',
};

const ACTION_LABELS: Record<ActionPayload['kind'], string> = {
  resolve: 'RESOLVE',
  jira: 'JIRA',
  'test-script': 'SCRIPT',
  escalate: 'ESCALATE',
};

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function formatPinnedAt(timestamp: number): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;
  return `${Math.floor(deltaHours / 24)}d ago`;
}

function renderPreview(block: Block): JSX.Element {
  switch (block.kind) {
    case 'context':
      return <p className="text-[var(--text-sm)] text-[var(--foreground)]">{block.body.customer} · {block.body.ticketUrl ?? '(no ticket)'}</p>;
    case 'prior-art':
      return (
        <div className="flex items-center gap-[var(--space-2)]">
          <Badge variant="outline">{PRIOR_ART_LABELS[block.body.source]}</Badge>
          <p className="min-w-0 truncate text-[var(--text-sm)] text-[var(--foreground)]">{block.body.title}</p>
        </div>
      );
    case 'hypothesis':
      return (
        <div className="flex min-w-0 items-center gap-[var(--space-2)]">
          <Badge variant="outline">H{block.body.rank}</Badge>
          <p className="min-w-0 truncate text-[var(--text-sm)] text-[var(--foreground)]">{block.body.title}</p>
          <StatusChip status={block.body.status} />
        </div>
      );
    case 'collection':
      return <p className="text-[var(--text-sm)] text-[var(--foreground)]">{block.body.steps.length} steps</p>;
    case 'analysis':
      return (
        <div className="flex min-w-0 items-center gap-[var(--space-2)]">
          <StatusChip status={block.body.statusUpdate} />
          <p className="min-w-0 truncate text-[var(--text-sm)] text-[var(--foreground)]">{truncate(block.body.summary, 80)}</p>
        </div>
      );
    case 'action':
      return (
        <div className="flex min-w-0 items-center gap-[var(--space-2)]">
          <Badge variant="outline">{ACTION_LABELS[block.body.payload.kind]}</Badge>
          <p className="min-w-0 truncate text-[var(--text-sm)] text-[var(--foreground)]">{truncate(block.body.summary, 80)}</p>
        </div>
      );
    case 'note':
      return (
        <div className="flex min-w-0 items-center gap-[var(--space-2)]">
          <Badge variant="outline">{block.body.authorRole === 'ai' ? 'AI' : 'ENG'}</Badge>
          <p className="min-w-0 truncate text-[var(--text-sm)] text-[var(--foreground)]">{truncate(block.body.markdown, 80)}</p>
        </div>
      );
  }
}

function itemAnimation(prefersReducedMotion: boolean): Record<string, unknown> {
  return prefersReducedMotion
    ? {}
    : {
        initial: { y: 6, scale: 0.95, opacity: 0 },
        animate: { y: 0, scale: 1, opacity: 1 },
        exit: { y: 2, opacity: 0 },
        transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
      };
}

export function EvidencePanel(): JSX.Element {
  const { evidenceSet, investigation, reorderItems, unpinBlock, updateItemNote } = useEvidence();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const items = useMemo(() => [...(evidenceSet?.items ?? [])].sort((a, b) => a.order - b.order), [evidenceSet?.items]);

  if (!items.length) {
    return (
      <div role="status" aria-label="No evidence pinned" className="flex flex-col items-center gap-[var(--space-2)] p-[var(--space-4)] text-center text-[var(--muted-foreground)]">
        <span aria-hidden="true" style={{ fontVariantEmoji: 'text' }}>∅</span>
        <p className="text-[var(--text-sm)] text-[var(--foreground)]" style={{ textWrap: 'balance' }}>Nothing pinned yet</p>
        <p className="text-[var(--text-xs)]" style={{ textWrap: 'pretty' }}>
          Focus a block and press <kbd>Ctrl+Shift+P</kbd> to pin it to Evidence.
        </p>
      </div>
    );
  }

  const animation = itemAnimation(prefersReducedMotion);
  const rowStyle: CSSProperties = {
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '150ms',
    transitionTimingFunction: 'var(--ease-enter-out)',
  };

  function handleDrop(event: DragEvent<HTMLDivElement>, targetId: EvidenceItem['blockId']): void {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) return;
    const orderedIds = [...items.map((item) => item.blockId)];
    const draggedIndex = orderedIds.indexOf(draggedId as EvidenceItem['blockId']);
    const targetIndex = orderedIds.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [moved] = orderedIds.splice(draggedIndex, 1);
    orderedIds.splice(targetIndex, 0, moved);
    reorderItems(orderedIds);
  }

  return (
    <div className="flex h-full flex-col gap-[var(--space-2)] overflow-y-auto p-[var(--space-3)]">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item) => {
          const block = investigation?.blocks.find((candidate) => candidate.id === item.blockId) ?? null;
          return (
            <motion.div
              key={item.blockId}
              layout
              {...animation}
            >
              <div
                className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-[var(--space-3)] shadow-[var(--shadow-raised)] hover:-translate-y-px hover:shadow-[var(--shadow-floating)]"
                style={rowStyle}
                draggable
                onDragStart={(event: DragEvent<HTMLDivElement>) => event.dataTransfer.setData('text/plain', item.blockId)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, item.blockId)}
              >
              <div className="flex items-start gap-[var(--space-2)]">
                <div className="flex min-h-10 min-w-10 items-center justify-center text-[var(--muted-foreground)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <GripVertical size={16} />
                </div>
                <div className="min-w-0 flex-1 space-y-[var(--space-2)]">
                  <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                    <Badge variant="outline">{block?.kind ?? 'missing'}</Badge>
                    <span className="text-[var(--text-xs)] text-[var(--muted-foreground)]">{formatPinnedAt(item.pinnedAt)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto min-h-10 min-w-10 px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      aria-label="Unpin from Evidence"
                      onClick={() => unpinBlock(item.blockId)}
                    >
                      <PinOff size={14} />
                    </Button>
                  </div>
                  {block ? (
                    renderPreview(block)
                  ) : (
                    <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">Block no longer available</p>
                  )}
                  <div className="rounded-[var(--radius-md)] bg-[var(--muted)]/60 p-[var(--space-2)]">
                    {editingBlockId === item.blockId ? (
                      <textarea
                        autoFocus
                        value={draftNote}
                        onChange={(event) => setDraftNote(event.target.value)}
                        onBlur={() => {
                          const nextNote = draftNote.trim() ? draftNote : undefined;
                          updateItemNote(item.blockId, nextNote);
                          setEditingBlockId(null);
                          setDraftNote('');
                        }}
                        className="min-h-20 w-full resize-none rounded-[var(--radius-md)] border bg-[var(--background)] p-[var(--space-2)] text-[var(--text-sm)] text-[var(--foreground)] focus:outline-none"
                        style={{ borderColor: 'var(--glow-ready)' }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex min-h-10 w-full items-start gap-[var(--space-2)] text-left"
                        onClick={() => {
                          setEditingBlockId(item.blockId);
                          setDraftNote(item.note ?? '');
                        }}
                      >
                        <StickyNote size={14} className="mt-0.5 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="whitespace-pre-wrap break-words text-[var(--text-xs)] text-[var(--muted-foreground)]">
                          {item.note ?? 'Add evidence note'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default EvidencePanel;

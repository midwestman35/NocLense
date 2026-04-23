/**
 * SubmitRoom.tsx - Submit phase two-card layout.
 *
 * Cards:
 *  - Closure Note: editable res-note pre-filled from Investigation.
 *    Copy-for-Zendesk and Export-.noclense actions.
 *  - Evidence Summary: pinned item count + top items + Jira copy.
 *
 * Uses useEvidence() for all data; no prop drilling.
 * buildNoclenseZip is async so export uses local loading state.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from 'react';
import { Bookmark, Check, Copy, Download, FileText } from 'lucide-react';
import { WorkspaceCard } from './WorkspaceCard';
import Button from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useEvidence } from '../../contexts/EvidenceContext';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { buildResNote } from '../../services/resNoteBuilder';
import { buildJiraTemplate } from '../../services/jiraTemplateBuilder';
import {
  buildNoclenseZip,
  noclenseFileName,
} from '../../services/investigationExporter';
import { downloadBlob } from '../../services/zipBuilder';

const APP_VERSION = '2.0.0';
const MAX_EVIDENCE_PREVIEW = 5;

interface ClosureNoteCardProps {
  text: string;
  isDraft: boolean;
  onTextChange: (next: string) => void;
  onExport: () => Promise<void>;
  exportLoading: boolean;
  exportError: string | null;
}

function ClosureNoteCard({
  text,
  isDraft,
  onTextChange,
  onExport,
  exportLoading,
  exportError,
}: ClosureNoteCardProps): JSX.Element {
  const { copied, copy } = useCopyFeedback();
  const handleCopy = () => copy(text);

  return (
    <WorkspaceCard
      id="closure-note"
      title="Closure Note"
      icon={<FileText size={14} />}
      accentColor="#76ce40"
      className="w-[420px]"
    >
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
        {isDraft && (
          <div role="status" aria-label="Closure note is a draft">
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">
              Draft - no confirmed hypothesis
            </Badge>
          </div>
        )}

        <label
          htmlFor="closure-note-textarea"
          className="text-[var(--text-xs)] text-[var(--muted-foreground)]"
        >
          Edit before posting to Zendesk
        </label>
        <textarea
          id="closure-note-textarea"
          value={text}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onTextChange(event.target.value)}
          className="min-h-[180px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--input)] p-[var(--space-3)] font-mono text-[var(--text-xs)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          spellCheck={false}
        />

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void handleCopy()}
          className="w-full"
          aria-label="Copy closure note to clipboard for Zendesk"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-[var(--space-2)]">{copied ? 'Copied!' : 'Copy for Zendesk'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onExport()}
          disabled={exportLoading}
          className="w-full"
          aria-label="Export investigation as .noclense file"
        >
          <Download size={14} />
          <span className="ml-[var(--space-2)]">
            {exportLoading ? 'Exporting...' : 'Export .noclense'}
          </span>
        </Button>

        {exportError && (
          <p role="alert" className="text-[var(--text-xs)] text-[var(--destructive)]">
            {exportError}
          </p>
        )}
      </div>
    </WorkspaceCard>
  );
}

interface EvidenceSummaryCardProps {
  itemCount: number;
  previewItems: { label: string; kind: string }[];
  jiraFormatted: string;
}

function EvidenceSummaryCard({
  itemCount,
  previewItems,
  jiraFormatted,
}: EvidenceSummaryCardProps): JSX.Element {
  const { copied: copiedJira, copy } = useCopyFeedback();
  const handleCopyJira = () => copy(jiraFormatted);

  return (
    <WorkspaceCard
      id="evidence-summary"
      title="Evidence Summary"
      icon={<Bookmark size={14} />}
      accentColor="#f59e0b"
      className="w-[320px]"
    >
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
        <p
          className="text-[var(--text-sm)] text-[var(--foreground)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {itemCount} item{itemCount !== 1 ? 's' : ''} pinned
        </p>

        {itemCount === 0 ? (
          <p
            className="text-[var(--text-xs)] text-[var(--muted-foreground)]"
            style={{ textWrap: 'pretty' }}
          >
            Pin evidence blocks from the AI Assistant with <kbd>Ctrl+Shift+P</kbd>.
          </p>
        ) : (
          <ul className="flex flex-col gap-[var(--space-1)]" aria-label="Pinned evidence items">
            {previewItems.map((item, index) => (
              <li key={index} className="flex items-center gap-[var(--space-2)] text-[var(--text-xs)]">
                <Badge variant="outline">{item.kind}</Badge>
                <span className="min-w-0 truncate text-[var(--muted-foreground)]">{item.label}</span>
              </li>
            ))}
            {itemCount > MAX_EVIDENCE_PREVIEW && (
              <li className="text-[var(--text-xs)] text-[var(--muted-foreground)]">
                +{itemCount - MAX_EVIDENCE_PREVIEW} more
              </li>
            )}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopyJira()}
          className="w-full"
          aria-label="Copy Jira creation template to clipboard"
        >
          {copiedJira ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-[var(--space-2)]">{copiedJira ? 'Copied!' : 'Copy Jira Template'}</span>
        </Button>
      </div>
    </WorkspaceCard>
  );
}

export function SubmitRoom(): JSX.Element {
  const { investigation, evidenceSet, loadGeneration } = useEvidence();

  const { text: initialResNote, isDraft } = useMemo(
    () =>
      investigation && evidenceSet
        ? buildResNote(investigation, evidenceSet)
        : { text: '', isDraft: true },
    [investigation, evidenceSet],
  );

  const [editedNote, setEditedNote] = useState<string | null>(null);
  const resNoteText = editedNote ?? initialResNote;
  const lastSyncedGenerationRef = useRef<number>(loadGeneration);

  useEffect(() => {
    if (loadGeneration !== lastSyncedGenerationRef.current) {
      lastSyncedGenerationRef.current = loadGeneration;
      setEditedNote(null);
    }
  }, [loadGeneration]);

  const jiraTemplate = useMemo(
    () => (investigation ? buildJiraTemplate(investigation) : null),
    [investigation],
  );

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!investigation || !evidenceSet) {
      setExportError('No investigation to export.');
      return;
    }
    setExportLoading(true);
    setExportError(null);
    try {
      const { blob } = await buildNoclenseZip(investigation, evidenceSet, APP_VERSION);
      downloadBlob(noclenseFileName(investigation), blob);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Export failed. Check disk space and try again.',
      );
    } finally {
      setExportLoading(false);
    }
  }, [investigation, evidenceSet]);

  const previewItems = useMemo(() => {
    if (!investigation || !evidenceSet) return [];
    return evidenceSet.items.slice(0, MAX_EVIDENCE_PREVIEW).map((item) => {
      const block = investigation.blocks.find((b) => b.id === item.blockId);
      const kind = block?.kind ?? 'unknown';
      const label =
        block?.kind === 'hypothesis'
          ? block.body.title
          : block?.kind === 'analysis'
            ? block.body.summary.slice(0, 60)
            : block?.kind === 'context'
              ? block.body.customer
              : kind;
      return { label, kind };
    });
  }, [investigation, evidenceSet]);

  return (
    <>
      <ClosureNoteCard
        text={resNoteText}
        isDraft={isDraft}
        onTextChange={setEditedNote}
        onExport={handleExport}
        exportLoading={exportLoading}
        exportError={exportError}
      />
      <EvidenceSummaryCard
        itemCount={evidenceSet?.items.length ?? 0}
        previewItems={previewItems}
        jiraFormatted={jiraTemplate?.formatted ?? ''}
      />
    </>
  );
}

export default SubmitRoom;

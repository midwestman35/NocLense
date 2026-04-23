import { type ChangeEvent, type JSX } from 'react';
import { Check, Copy, FileText } from 'lucide-react';
import { Badge, Button } from '../../ui';
import { useCopyFeedback } from '../../../hooks/useCopyFeedback';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';

interface ClosureNoteProps {
  text: string;
  isDraft: boolean;
  onTextChange: (next: string) => void;
}

export function ClosureNote({
  text,
  isDraft,
  onTextChange,
}: ClosureNoteProps): JSX.Element {
  const { copied, copy } = useCopyFeedback();

  return (
    <WorkspaceCard
      id="closure-note"
      title="Closure Note"
      icon={<FileText size={14} />}
      accentColor="#76ce40"
      collapsible={false}
      className="min-h-0"
      meta={<span>{isDraft ? 'draft' : 'resolved'}</span>}
      badge={
        <Badge variant={isDraft ? 'level-warn' : 'level-info'}>
          {isDraft ? 'AI Drafted' : 'Ready'}
        </Badge>
      }
    >
      <div className="flex min-h-0 flex-col gap-4 p-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Edit before posting to Zendesk</Badge>
            <Badge variant={isDraft ? 'level-warn' : 'level-info'}>
              {isDraft ? 'No confirmed hypothesis' : 'Resolved'}
            </Badge>
          </div>
          <p className="max-w-[64ch] text-[12px] leading-relaxed text-[var(--ink-3)]">
            Review the generated closure note, adjust customer-facing language, then copy it into the
            Zendesk internal note.
          </p>
        </div>

        <label
          htmlFor="closure-note-textarea"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]"
        >
          Closure note body
        </label>
        <textarea
          id="closure-note-textarea"
          value={text}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onTextChange(event.target.value)}
          className="min-h-[320px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--line)] bg-[rgba(0,0,0,0.28)] p-4 font-mono text-[12px] leading-relaxed text-[var(--ink-1)] focus:outline-none focus:ring-1 focus:ring-[var(--mint)]"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <Button
            type="button"
            size="sm"
            onClick={() => void copy(text)}
            aria-label="Copy closure note to clipboard for Zendesk"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy for Zendesk'}
          </Button>
          <span className="font-mono text-[10px] text-[var(--ink-3)]">
            cites log evidence through the attached investigation pack
          </span>
        </div>
      </div>
    </WorkspaceCard>
  );
}

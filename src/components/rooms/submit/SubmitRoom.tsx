import { useMemo, useState, type JSX } from 'react';
import { useEvidence } from '../../../contexts/EvidenceContext';
import { buildResNote } from '../../../services/resNoteBuilder';
import { ClosureNote } from './ClosureNote';
import { EvidenceSummary } from './EvidenceSummary';
import { HandoffExport } from './HandoffExport';

export function SubmitRoom(): JSX.Element {
  const { investigation, evidenceSet, loadGeneration } = useEvidence();

  const { text: initialResNote, isDraft } = useMemo(
    () =>
      investigation && evidenceSet
        ? buildResNote(investigation, evidenceSet)
        : { text: '', isDraft: true },
    [investigation, evidenceSet],
  );

  const [editedNote, setEditedNote] = useState<{ generation: number; text: string } | null>(null);
  const resNoteText = editedNote?.generation === loadGeneration ? editedNote.text : initialResNote;

  return (
    <section className="h-full min-h-0 w-full overflow-y-auto px-6 py-5">
      <div className="mx-auto flex min-h-full max-w-[1400px] flex-col">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mint)]">
              ROOM 4 / 4 · SUBMIT
            </p>
            <h1 className="mt-2 text-[32px] font-medium leading-none tracking-[-0.04em] text-[var(--ink-0)]">
              Review.
            </h1>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-[var(--ink-3)]">
              Review your AI-drafted closure note, pin evidence, and package the handoff for
              Zendesk, Jira, and Confluence follow-up.
            </p>
          </div>
          <div className="rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
            {evidenceSet?.items.length ?? 0} evidence items
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
          <ClosureNote
            text={resNoteText}
            isDraft={isDraft}
            onTextChange={(text) => setEditedNote({ generation: loadGeneration, text })}
          />

          <div className="flex min-h-0 flex-col gap-4">
            <EvidenceSummary />
            <HandoffExport />
          </div>
        </div>
      </div>
    </section>
  );
}

export default SubmitRoom;

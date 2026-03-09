import { useMemo, useState } from 'react';
import { Button } from '../ui';
import { useCase } from '../../store/caseContext';
import { useLogContext } from '../../contexts/LogContext';
import type { CaseSeverity, CaseStatus } from '../../types/case';

const SEVERITY_OPTIONS: CaseSeverity[] = ['low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS: CaseStatus[] = ['open', 'monitoring', 'handoff', 'resolved'];

function formatDateTimeInput(value?: number | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeInput(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{label}</div>
      {children}
    </label>
  );
}

export function CasePanel() {
  const { cases, activeCase, activeCaseId, createCase, updateCase, deleteCase, setActiveCase } = useCase();
  const { logs } = useLogContext();
  const [newCaseTitle, setNewCaseTitle] = useState('');

  const evidencePreview = useMemo(() => {
    if (!activeCase) return [];
    return activeCase.bookmarks
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6)
      .map((bookmark) => ({
        bookmark,
        log: logs.find((entry) => entry.id === bookmark.logId),
      }))
      .reverse();
  }, [activeCase, logs]);

  const createNewCase = () => {
    const title = newCaseTitle.trim();
    if (!title) return;
    createCase({ title });
    setNewCaseTitle('');
  };

  const updateTimeWindow = (field: 'start' | 'end', value: string) => {
    if (!activeCase) return;
    const parsed = parseDateTimeInput(value);
    const current = activeCase.timeWindow ?? { start: Date.now(), end: Date.now() };
    updateCase(activeCase.id, {
      timeWindow: {
        ...current,
        [field]: parsed ?? current[field],
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <section className="border-b border-[var(--border)] px-3 py-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Cases</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCaseTitle}
              onChange={(event) => setNewCaseTitle(event.target.value)}
              className="h-8 flex-1 rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
              placeholder="Create a case..."
            />
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={createNewCase}>
              New case
            </Button>
          </div>
          <div className="space-y-1">
            {cases.length === 0 ? (
              <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                Cases are optional. Create one when the incident needs evidence capture or a stakeholder handoff.
              </div>
            ) : (
              cases
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((caseItem) => (
                  <button
                    key={caseItem.id}
                    type="button"
                    onClick={() => setActiveCase(caseItem.id)}
                    className={`w-full rounded border px-3 py-2 text-left ${activeCaseId === caseItem.id ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{caseItem.title}</span>
                      <span className="text-[10px] uppercase tracking-[0.16em]">{caseItem.status}</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      {caseItem.externalRef ? `${caseItem.externalRef} · ` : ''}
                      {caseItem.bookmarks.length} evidence · {caseItem.attachments.length} sources
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      </section>

      <section className="px-3 py-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Active case</div>
        {!activeCase ? (
          <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Select a case to autosave pivots, capture evidence, and build a handoff pack.
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Title">
              <input
                type="text"
                value={activeCase.title}
                onChange={(event) => updateCase(activeCase.id, { title: event.target.value })}
                className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Incident ref">
                <input
                  type="text"
                  value={activeCase.externalRef ?? ''}
                  onChange={(event) => updateCase(activeCase.id, { externalRef: event.target.value })}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
                  placeholder="INC-4821"
                />
              </Field>
              <Field label="Owner">
                <input
                  type="text"
                  value={activeCase.owner ?? ''}
                  onChange={(event) => updateCase(activeCase.id, { owner: event.target.value })}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
                  placeholder="Primary investigator"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Severity">
                <select
                  value={activeCase.severity}
                  onChange={(event) => updateCase(activeCase.id, { severity: event.target.value as CaseSeverity })}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]"
                >
                  {SEVERITY_OPTIONS.map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={activeCase.status}
                  onChange={(event) => updateCase(activeCase.id, { status: event.target.value as CaseStatus })}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Stakeholder team">
              <input
                type="text"
                value={activeCase.stakeholderTeam ?? ''}
                onChange={(event) => updateCase(activeCase.id, { stakeholderTeam: event.target.value })}
                className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
                placeholder="Internal team receiving evidence"
              />
            </Field>

            <Field label="Summary">
              <textarea
                value={activeCase.summary}
                onChange={(event) => updateCase(activeCase.id, { summary: event.target.value })}
                className="min-h-[80px] w-full rounded border border-[var(--input)] bg-transparent px-2 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
                placeholder="What happened, what is affected, and what is most likely true so far."
              />
            </Field>

            <Field label="Impact">
              <textarea
                value={activeCase.impact}
                onChange={(event) => updateCase(activeCase.id, { impact: event.target.value })}
                className="min-h-[80px] w-full rounded border border-[var(--input)] bg-transparent px-2 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
                placeholder="Customer or system impact for the stakeholder handoff."
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Incident start">
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(activeCase.timeWindow?.start)}
                  onChange={(event) => updateTimeWindow('start', event.target.value)}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]"
                />
              </Field>
              <Field label="Incident end">
                <input
                  type="datetime-local"
                  value={formatDateTimeInput(activeCase.timeWindow?.end)}
                  onChange={(event) => updateTimeWindow('end', event.target.value)}
                  className="h-8 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]"
                />
              </Field>
            </div>

            <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
              Investigation filters and selected rows autosave into this case while it is active.
            </div>

            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Attached sources</div>
              {activeCase.attachments.length === 0 ? (
                <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                  Import data while this case is active to record provenance automatically.
                </div>
              ) : (
                <div className="space-y-1">
                  {activeCase.attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                      <div className="font-medium text-[var(--foreground)]">{attachment.fileName}</div>
                      <div>{attachment.sourceLabel} · {attachment.kind}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Recent evidence</div>
              {evidencePreview.length === 0 ? (
                <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                  No evidence captured yet. Use the details drawer to add evidence and notes.
                </div>
              ) : (
                <div className="space-y-1">
                  {evidencePreview.map(({ bookmark, log }) => (
                    <div key={bookmark.id} className="rounded border border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium uppercase tracking-[0.14em] text-[var(--foreground)]">{bookmark.tag}</span>
                        <span>{new Date(bookmark.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[var(--foreground)]">{log?.summaryMessage ?? log?.displayMessage ?? `Log ${bookmark.logId}`}</div>
                      {bookmark.note ? <div className="mt-1">{bookmark.note}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setActiveCase(null)}>
                Detach case
              </Button>
              <Button
                variant="ghost"
                className="h-8 px-2 text-xs text-[var(--destructive)] hover:text-[var(--destructive)]"
                onClick={() => deleteCase(activeCase.id)}
              >
                Delete case
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

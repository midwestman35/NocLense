import { useMemo, useState } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { getStructuredFields, type FieldEntry } from '../../utils/structuredFields';
import { format } from 'date-fns';
import { Filter, X, LocateFixed, ChevronDown, ChevronRight, Copy, BookmarkPlus, PencilLine } from 'lucide-react';
import type { LogEntry } from '../../types';
import AIButton from '../AIButton';
import { useCase } from '../../store/caseContext';
import type { BookmarkTag } from '../../types/case';

const LARGE_JSON_BYTES = 50 * 1024;
const PAYLOAD_PREVIEW_LINES = 80;
const BOOKMARK_TAGS: BookmarkTag[] = ['evidence', 'symptom', 'milestone', 'red-herring', 'action'];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function StructuredFieldsSection({ fields }: { fields: FieldEntry[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  if (fields.length === 0) return null;

  const handleCopy = (key: string, value: string | number | boolean | null) => {
    copyToClipboard(value === null ? '' : String(value));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 800);
  };

  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Structured fields</div>
      <div className="border border-[var(--border)] overflow-hidden max-h-48 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {fields.map(({ key, value, type }) => {
              const valStr = value === null ? '-' : String(value);
              const typeClr =
                type === 'correlation'
                  ? 'text-[var(--foreground)]'
                  : type === 'sip'
                    ? 'text-[var(--warning)]'
                    : 'text-[var(--muted-foreground)]';
              return (
                <tr key={key} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--accent)]">
                  <td className="py-1 px-2 w-8 align-top">
                    <button type="button" onClick={() => handleCopy(key, value)} className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Copy value">
                      {copiedKey === key ? <span className="text-[10px]">OK</span> : <Copy size={10} />}
                    </button>
                  </td>
                  <td className={`py-1 px-2 ${typeClr} break-all`}>{key}</td>
                  <td className="py-1 px-2 text-[var(--foreground)] break-all">{valStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RawPayloadSection({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isJson = log.type === 'JSON' && log.json != null;
  const raw = isJson ? JSON.stringify(log.json, null, 2) : log.payload;
  const sizeBytes = new Blob([raw]).size;
  const isLarge = sizeBytes > LARGE_JSON_BYTES;
  const lines = raw.split(/\r?\n/);
  const truncated = isLarge && !expanded;
  const display = truncated ? `${lines.slice(0, PAYLOAD_PREVIEW_LINES).join('\n')}\n... [truncated]` : raw;

  return (
    <div className="mb-2">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-1">
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {isJson ? 'Raw JSON' : 'Raw payload'}
        {isLarge && !expanded && ` (${(sizeBytes / 1024).toFixed(0)} KB - Show full)`}
      </button>
      <pre className="bg-[var(--accent)] p-3 border border-[var(--border)] overflow-auto max-h-60 text-xs whitespace-pre-wrap break-all font-mono">{display}</pre>
    </div>
  );
}

export default function LogDetailsPanel({ log, onClose, onJumpToLog }: { log: LogEntry; onClose: () => void; onJumpToLog: () => void }) {
  const { logs, toggleCorrelation, setActiveCorrelations, activeCorrelations } = useLogContext();
  const { activeCase, addBookmark, addNote } = useCase();
  const [bookmarkTag, setBookmarkTag] = useState<BookmarkTag>('evidence');
  const [noteText, setNoteText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const fields = useMemo(() => getStructuredFields(log), [log]);
  const aiContextLogs = useMemo(() => {
    const index = logs.findIndex((entry) => entry.id === log.id);
    if (index === -1) return [log];
    const start = Math.max(0, index - 5);
    const end = Math.min(logs.length, index + 6);
    return logs.slice(start, end);
  }, [logs, log]);

  const sessionItems = useMemo(() => {
    const items: Array<{ type: 'cncID' | 'messageID'; value: string }> = [];
    if (log.cncID) items.push({ type: 'cncID', value: log.cncID });
    if (log.messageID) items.push({ type: 'messageID', value: log.messageID });
    return items;
  }, [log.cncID, log.messageID]);

  const existingBookmark = activeCase?.bookmarks.find((bookmark) => bookmark.logId === log.id) ?? null;

  const handleSessionOnly = () => {
    setActiveCorrelations(sessionItems.map(({ type, value }) => ({ type, value })));
  };

  const handleAddEvidence = () => {
    if (!activeCase) {
      setNotice('Select a case before adding evidence.');
      return;
    }
    if (existingBookmark) {
      setNotice('This log is already captured as evidence in the active case.');
      return;
    }

    addBookmark(activeCase.id, {
      id: `bookmark_${Date.now()}`,
      logId: log.id,
      tag: bookmarkTag,
      note: noteText.trim() || undefined,
      timestamp: log.timestamp,
    });
    if (noteText.trim()) {
      addNote(activeCase.id, {
        id: `note_${Date.now()}`,
        caseId: activeCase.id,
        logId: log.id,
        content: noteText.trim(),
        timestamp: Date.now(),
      });
    }
    setNotice('Evidence saved to the active case.');
    setNoteText('');
  };

  const handleAddNote = () => {
    if (!activeCase) {
      setNotice('Select a case before adding notes.');
      return;
    }
    if (!noteText.trim()) {
      setNotice('Write a note before saving it to the case.');
      return;
    }

    addNote(activeCase.id, {
      id: `note_${Date.now()}`,
      caseId: activeCase.id,
      logId: log.id,
      content: noteText.trim(),
      timestamp: Date.now(),
    });
    setNotice('Note added to the active case.');
    setNoteText('');
  };

  const handleCopyCitation = () => {
    const citation = [
      `Time: ${format(new Date(log.timestamp), 'MM/dd/yyyy HH:mm:ss.SSS')}`,
      `Source: ${log.sourceLabel ?? 'Workspace'} / ${log.fileName ?? 'in-memory import'}`,
      `Component: ${log.component}`,
      `Message: ${log.summaryMessage ?? log.message}`,
      log.callId ? `Call-ID: ${log.callId}` : null,
      log.reportId ? `Report ID: ${log.reportId}` : null,
      `Log ID: ${log.id}`,
    ]
      .filter(Boolean)
      .join('\n');
    copyToClipboard(citation);
    setNotice('Evidence citation copied to the clipboard.');
  };

  return (
    <div className="flex-1 bg-[var(--card)] overflow-hidden flex flex-col relative z-20">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex-wrap gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-sm text-[var(--foreground)]">Details: {log.messageType ?? log.level} event</span>
          <span className="text-[11px] text-[var(--muted-foreground)] truncate font-mono" title={log.summaryMessage ?? log.messageType}>
            {log.summaryMessage ?? log.messageType}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {log.callId && (
            <button onClick={() => toggleCorrelation({ type: 'callId', value: log.callId! })} className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <Filter size={12} />
              Filter
            </button>
          )}
          {sessionItems.length > 0 && (
            <button onClick={handleSessionOnly} className="px-2 py-1 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              Window +/- session
            </button>
          )}
          <button onClick={onJumpToLog} className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <LocateFixed size={12} />
            Jump To
          </button>
          <AIButton variant="secondary" size="sm" promptType="custom" customPrompt="Explain this event and suggest troubleshooting steps. Reference the most relevant log IDs." logs={aiContextLogs} label="Explain with AI" />
          <button onClick={onClose} className="px-2 py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 overflow-auto font-mono text-xs text-[var(--foreground)] h-full bg-[var(--card)]">
        <div className="mb-4 rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {activeCase ? `Active case: ${activeCase.title}` : 'No active case'}
            </div>
            {existingBookmark ? (
              <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--foreground)]">
                Already saved as {existingBookmark.tag}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(0,120px)_1fr_auto_auto] gap-2 items-start">
            <select
              value={bookmarkTag}
              onChange={(event) => setBookmarkTag(event.target.value as BookmarkTag)}
              className="h-8 rounded border border-[var(--input)] bg-transparent px-2 text-[11px] text-[var(--foreground)]"
              disabled={!activeCase}
            >
              {BOOKMARK_TAGS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              className="min-h-[64px] rounded border border-[var(--input)] bg-transparent px-2 py-2 text-[11px] text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
              placeholder={activeCase ? 'Why does this event matter for the case?' : 'Select a case to capture notes and evidence.'}
            />
            <button onClick={handleAddEvidence} className="flex h-8 items-center gap-1 rounded border border-[var(--border)] px-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50" disabled={!activeCase}>
              <BookmarkPlus size={12} />
              Add evidence
            </button>
            <button onClick={handleAddNote} className="flex h-8 items-center gap-1 rounded border border-[var(--border)] px-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50" disabled={!activeCase}>
              <PencilLine size={12} />
              Add note
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
            <button onClick={handleCopyCitation} className="rounded border border-[var(--border)] px-2 py-1 hover:text-[var(--foreground)]">
              Copy citation
            </button>
            {notice ? <span>{notice}</span> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
          <div><span className="text-[var(--muted-foreground)]">Time:</span> {format(new Date(log.timestamp), 'MM/dd HH:mm:ss.SSS')}</div>
          <div><span className="text-[var(--muted-foreground)]">Component:</span> {log.component}</div>
          <div><span className="text-[var(--muted-foreground)]">Source:</span> {log.sourceLabel ?? 'Workspace'}</div>
          <div><span className="text-[var(--muted-foreground)]">Dataset:</span> {log.fileName ?? 'Untitled import'}</div>
          <div className="col-span-2 flex gap-2">
            <span className="text-[var(--muted-foreground)] shrink-0">Message:</span>
            <span>{log.summaryMessage || log.message}</span>
          </div>
          {log.reportId && <div><span className="text-[var(--muted-foreground)]">Report ID:</span> {log.reportId}</div>}
          {log.operatorId && <div><span className="text-[var(--muted-foreground)]">Operator ID:</span> {log.operatorId}</div>}
          {log.callId && <div><span className="text-[var(--muted-foreground)]">Call ID:</span> {log.callId}</div>}
          {log.cncID && <div><span className="text-[var(--muted-foreground)]">cncID:</span> {log.cncID}</div>}
          {log.messageID && <div><span className="text-[var(--muted-foreground)]">messageID:</span> {log.messageID}</div>}
          {activeCorrelations.length > 0 && <div><span className="text-[var(--muted-foreground)]">Active filters:</span> {activeCorrelations.length}</div>}
        </div>
        <StructuredFieldsSection fields={fields} />
        <RawPayloadSection log={log} />
      </div>
    </div>
  );
}

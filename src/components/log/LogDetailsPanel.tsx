import { useMemo, useState } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { getStructuredFields, type FieldEntry } from '../../utils/structuredFields';
import { format } from 'date-fns';
import { Filter, X, LocateFixed, ChevronDown, ChevronRight, Copy, Sparkles } from 'lucide-react';
import type { LogEntry } from '../../types';
import AIButton from '../AIButton';

const LARGE_JSON_BYTES = 50 * 1024;
const PAYLOAD_PREVIEW_LINES = 80;

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
  const { logs, toggleCorrelation, setActiveCorrelations, activeCorrelations, aiHighlightedLogIds, aiHighlightReasons } = useLogContext();

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

  const handleSessionOnly = () => {
    setActiveCorrelations(sessionItems.map(({ type, value }) => ({ type, value })));
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
        {/* AI Diagnosis Reason */}
        {aiHighlightedLogIds.has(log.id) && (
          <div className="mb-4 rounded border border-violet-500/30 bg-violet-500/8 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={11} className="text-violet-400 shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-400">AI Diagnosis</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--foreground)]">
              {aiHighlightReasons.get(log.id) ?? 'This log was correlated with the active Zendesk ticket.'}
            </p>
          </div>
        )}

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

import { useState, useMemo } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { getStructuredFields, type FieldEntry } from '../../utils/structuredFields';
import { format } from 'date-fns';
import { Download, Filter, X, LocateFixed, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type { LogEntry } from '../../types';

const LARGE_JSON_BYTES = 50 * 1024;
const PAYLOAD_PREVIEW_LINES = 80;

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function SummaryBlock({ log }: { log: LogEntry }) {
  const parts: string[] = [];
  if (log.messageType) parts.push(log.messageType);
  if (log.cncID) parts.push(`cncID: ${log.cncID}`);
  if (log.messageID) parts.push(`messageID: ${log.messageID}`);
  if (log.reportId) parts.push(`reportID: ${log.reportId}`);
  const j = log.json as Record<string, unknown> | undefined;
  const nOps = Array.isArray(j?.operatorsStatuses) ? j.operatorsStatuses.length : 0;
  if (nOps > 0) parts.push(`${nOps} operators`);
  if (parts.length === 0) return null;
  return (
    <div className="mb-3 p-2 rounded bg-[var(--bg-light)] border border-[var(--border-color)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Summary</div>
      <div className="text-xs text-[var(--text-primary)]">{parts.join(' · ')}</div>
    </div>
  );
}

function StructuredFieldsSection({ fields }: { fields: FieldEntry[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  if (fields.length === 0) return null;

  const handleCopy = (k: string, v: string | number | boolean | null) => {
    const text = v === null ? '' : String(v);
    copyToClipboard(text);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(null), 800);
  };

  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Structured fields</div>
      <div className="rounded border border-[var(--border-color)] overflow-hidden max-h-48 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {fields.map(({ key, value, type }) => {
              const valStr = value === null ? '—' : String(value);
              const typeClr = type === 'correlation' ? 'text-blue-400' : type === 'sip' ? 'text-amber-400' : 'text-[var(--text-secondary)]';
              return (
                <tr key={key} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-light)]">
                  <td className="py-1 px-2 w-8 align-top">
                    <button
                      type="button"
                      onClick={() => handleCopy(key, value)}
                      className="p-0.5 rounded hover:bg-[var(--accent-blue)]/20 text-[var(--text-secondary)] hover:text-[var(--accent-blue)]"
                      title="Copy value"
                    >
                      {copiedKey === key ? <span className="text-[10px]">✓</span> : <Copy size={10} />}
                    </button>
                  </td>
                  <td className={`py-1 px-2 ${typeClr} break-all`}>{key}</td>
                  <td className="py-1 px-2 text-[var(--text-primary)] break-all">{valStr}</td>
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
  const display = truncated ? lines.slice(0, PAYLOAD_PREVIEW_LINES).join('\n') + '\n… [truncated]' : raw;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-1"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {isJson ? 'Raw JSON' : 'Raw payload'}
        {isLarge && !expanded && ` (${(sizeBytes / 1024).toFixed(0)} KB – Show full)`}
      </button>
      <pre className="bg-[var(--bg-light)] p-3 rounded border border-[var(--border-color)] overflow-auto max-h-60 text-xs whitespace-pre-wrap break-all font-mono">
        {display}
      </pre>
    </div>
  );
}

export default function LogDetailsPanel({ log, onClose, onJumpToLog }: {
  log: LogEntry;
  onClose: () => void;
  onJumpToLog: () => void;
}) {
  const {
    toggleCorrelation,
    setActiveCorrelations,
    activeCorrelations,
    setIsSidebarOpen,
    setActiveCallFlowId,
  } = useLogContext();

  const fields = useMemo(() => getStructuredFields(log), [log]);
  const showSummary = log.type === 'JSON' && log.json && (log.messageType || log.cncID || log.messageID || log.reportId);

  const hasSessionContext = !!(log.cncID || log.messageID);
  const sessionItems = useMemo(() => {
    const items: Array<{ type: 'cncID' | 'messageID'; value: string }> = [];
    if (log.cncID) items.push({ type: 'cncID', value: log.cncID });
    if (log.messageID) items.push({ type: 'messageID', value: log.messageID });
    return items;
  }, [log.cncID, log.messageID]);

  const handleFilter = (type: 'callId' | 'cncID' | 'messageID', value: string) => {
    const t = type === 'callId' ? 'callId' as const : type === 'cncID' ? 'cncID' as const : 'messageID' as const;
    toggleCorrelation({ type: t, value });
    setIsSidebarOpen(true);
  };

  const handleSessionFilter = () => {
    const active = activeCorrelations.filter(c => (c.type === 'cncID' || c.type === 'messageID') && !c.excluded);
    const activeSet = new Set(active.map(c => `${c.type}:${c.value}`));
    const allActive = sessionItems.every(({ type, value }) => activeSet.has(`${type}:${value}`));
    if (allActive && active.length === sessionItems.length) {
      sessionItems.forEach(({ type, value }) => toggleCorrelation({ type, value }));
    } else {
      const next = activeCorrelations.filter(c => c.type !== 'cncID' && c.type !== 'messageID');
      sessionItems.forEach(({ type, value }) => next.push({ type, value }));
      setActiveCorrelations(next);
    }
    setIsSidebarOpen(true);
  };

  const handleSessionOnly = () => {
    setActiveCorrelations(sessionItems.map(({ type, value }) => ({ type, value })));
    setIsSidebarOpen(true);
  };

  return (
    <div className="flex-1 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden flex flex-col relative z-20">
      {/* Header (6.4 / 6.7: title + subtitle with summary/category) */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-light)] flex-wrap gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold text-sm text-[var(--text-primary)]">Details: Log #{log.id}</span>
          {(log.summaryMessage || log.messageType) && (
            <span className="text-[11px] text-[var(--text-secondary)] truncate font-mono" title={log.summaryMessage ?? log.messageType}>
              {log.summaryMessage ?? log.messageType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {log.callId && (
            <>
              <button
                onClick={() => setActiveCallFlowId(log.callId!)}
                className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors border border-blue-500/20"
              >
                <Download size={12} className="rotate-180" />
                Flow
              </button>
              <button
                onClick={() => handleFilter('callId', log.callId!)}
                className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-[var(--border-color)] transition-colors border border-[var(--border-color)]"
              >
                <Filter size={12} />
                Filter
              </button>
            </>
          )}
          {hasSessionContext && (
            <>
              <button
                onClick={handleSessionFilter}
                className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-[var(--border-color)] transition-colors border border-[var(--border-color)]"
                title={log.cncID && log.messageID ? 'Filter by this session (cncID + messageID)' : log.cncID ? 'Filter by cncID' : 'Filter by messageID'}
              >
                <Filter size={12} />
                Filter
              </button>
              <button
                onClick={handleSessionOnly}
                className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-[var(--border-color)] transition-colors border border-[var(--border-color)]"
                title={log.cncID && log.messageID ? 'Show only this session (cncID + messageID)' : log.cncID ? 'Show only this cncID' : 'Show only this messageID'}
              >
                Only
              </button>
            </>
          )}
          <button
            onClick={onJumpToLog}
            className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--accent-blue)] hover:text-white transition-colors border border-[var(--border-color)]"
            title="Jump to this log in main view (clears filters temporarily)"
          >
            <LocateFixed size={12} />
            Jump To
          </button>
          <button
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--bg-light)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto font-mono text-xs text-[var(--text-primary)] h-full">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
          <div><span className="text-[var(--text-secondary)]">Time:</span> {format(new Date(log.timestamp), 'MM/dd HH:mm:ss.SSS')}</div>
          <div><span className="text-[var(--text-secondary)]">Component:</span> {log.component}</div>
          <div className="col-span-2 flex gap-2">
            <span className="text-[var(--text-secondary)] shrink-0">Message:</span>
            <span>{log.summaryMessage || log.message}</span>
          </div>
          {log.reportId && <div><span className="text-[var(--text-secondary)]">Report ID:</span> <span className="text-blue-500">{log.reportId}</span></div>}
          {log.operatorId && <div><span className="text-[var(--text-secondary)]">Operator ID:</span> <span className="text-purple-500">{log.operatorId}</span></div>}
          {log.callId && <div><span className="text-[var(--text-secondary)]">Call ID:</span> <span className="text-yellow-500">{log.callId}</span></div>}
          {log.cncID && <div><span className="text-[var(--text-secondary)]">cncID:</span> <span className="text-cyan-500">{log.cncID}</span></div>}
          {log.messageID && <div><span className="text-[var(--text-secondary)]">messageID:</span> <span className="text-emerald-500">{log.messageID}</span></div>}
        </div>

        {showSummary && <SummaryBlock log={log} />}
        <StructuredFieldsSection fields={fields} />
        <RawPayloadSection log={log} />
      </div>
    </div>
  );
}

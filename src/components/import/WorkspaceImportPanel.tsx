import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Files, PencilLine, Stethoscope } from 'lucide-react';
import { Button, useToast } from '../ui';
import { useLogContext } from '../../contexts/LogContext';
import { useCase } from '../../store/caseContext';
import { dbManager } from '../../utils/indexedDB';
import { appendLogsToIndexedDB, importFiles, importPastedLogs } from '../../services/importService';
import type { ImportedDataset, LogSourceType } from '../../types';
import type { Attachment } from '../../types/case';

const SOURCE_OPTIONS: Array<{ id: LogSourceType; label: string; description: string }> = [
  { id: 'apex', label: 'APEX', description: 'Application logs and exported text files.' },
  { id: 'datadog', label: 'Datadog', description: 'CSV or text exports from Datadog.' },
  { id: 'aws', label: 'AWS Console', description: 'Paste CloudWatch or AWS console log output.' },
  { id: 'unknown', label: 'Unknown', description: 'Use when the source is mixed or uncertain.' },
];

function toAttachment(dataset: ImportedDataset): Attachment {
  return {
    id: dataset.id,
    importBatchId: dataset.importBatchId,
    fileName: dataset.fileName,
    sourceType: dataset.sourceType,
    sourceLabel: dataset.sourceLabel,
    size: dataset.size,
    importedAt: dataset.importedAt,
    kind: dataset.kind,
    warnings: dataset.warnings,
  };
}

function mergeAttachments(existing: Attachment[], datasets: ImportedDataset[]): Attachment[] {
  const next = [...existing];
  datasets.forEach((dataset) => {
    if (!next.some((attachment) => attachment.importBatchId === dataset.importBatchId)) {
      next.push(toAttachment(dataset));
    }
  });
  return next.sort((a, b) => a.importedAt - b.importedAt);
}

interface WorkspaceImportPanelProps {
  onComplete?: () => void;
  /** Called after successful import when a Zendesk ticket # was entered — begins investigation */
  onInvestigationReady?: (ticketId: string) => void;
}

export function WorkspaceImportPanel({ onComplete, onInvestigationReady }: WorkspaceImportPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'files' | 'paste'>('files');
  const [sourceType, setSourceType] = useState<LogSourceType>('apex');
  const [pasteText, setPasteText] = useState('');
  const [pasteLabel, setPasteLabel] = useState('aws-console-paste.log');
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [zdTicketInput, setZdTicketInput] = useState('');

  const {
    logs,
    setLogs,
    setLoading,
    setSelectedLogId,
    parsingProgress,
    setParsingProgress,
    enableIndexedDBMode,
    useIndexedDBMode,
    addImportedDatasets,
    serverMode,
    serverUploadAndParse,
  } = useLogContext();
  const { activeCase, updateCase } = useCase();

  const hasWorkspaceLogs = logs.length > 0;

  const helperText = useMemo(() => {
    if (mode === 'paste' && sourceType === 'aws') {
      return 'Paste CloudWatch or AWS console output directly. NocLense will fall back to line-by-line import when needed.';
    }
    if (mode === 'paste') {
      return 'Paste raw log text when exporting is slower than copying the incident window.';
    }
    return hasWorkspaceLogs
      ? 'New imports append to the current workspace and keep the existing investigation state intact.'
      : 'Start with files or paste, then build evidence and handoff notes from one workspace.';
  }, [hasWorkspaceLogs, mode, sourceType]);

  const attachToCase = (datasets: ImportedDataset[]) => {
    if (!activeCase || datasets.length === 0) return;
    updateCase(activeCase.id, {
      attachments: mergeAttachments(activeCase.attachments, datasets),
    });
  };

  const getNextLogId = async () => {
    if (useIndexedDBMode) {
      return (await dbManager.getMaxLogId()) + 1;
    }
    return logs.reduce((max, log) => Math.max(max, log.id), 0) + 1;
  };

  const mergeLogs = (incomingLogs: typeof logs) => {
    const merged = logs.concat(incomingLogs);
    merged.sort((a, b) => a.timestamp - b.timestamp);
    setLogs(merged);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setError(null);
    setNotices([]);
    setLoading(true);
    setParsingProgress(0);

    try {
      const files = Array.from(fileList);

      // --- Server mode: upload to backend for parsing ---
      if (serverMode) {
        try {
          const result = await serverUploadAndParse(files, setParsingProgress);
          setSelectedLogId(null);
          setNotices([`Server parsed ${result.count.toLocaleString()} log entries from ${files.length} file${files.length === 1 ? '' : 's'}.`]);
          toast(`Server parsed ${result.count.toLocaleString()} logs`, { variant: 'success' });
          const zdId = zdTicketInput.trim().replace(/\D/g, '');
          if (zdId) onInvestigationReady?.(zdId);
          onComplete?.();
          return;
        } catch {
          // Server unreachable — fall through to local parsing so upload isn't blocked.
          setParsingProgress(0);
          setNotices(['Server mode unavailable — parsing locally instead.']);
        }
      }

      // --- Local mode: parse client-side (existing behavior) ---
      const nextId = await getNextLogId();
      const shouldUseIndexedDB = useIndexedDBMode || logs.length === 0;
      const result = await importFiles(files, {
        sourceType,
        startId: nextId,
        onProgress: setParsingProgress,
        useIndexedDB: shouldUseIndexedDB,
      });

      if (result.usedIndexedDB) {
        await enableIndexedDBMode();
      } else if (useIndexedDBMode && result.logs.length > 0) {
        await appendLogsToIndexedDB(result.logs, result.datasets);
        await enableIndexedDBMode();
      } else if (result.logs.length > 0) {
        mergeLogs(result.logs);
      }

      addImportedDatasets(result.datasets);
      attachToCase(result.datasets);
      setSelectedLogId(null);
      setNotices(result.warnings.length > 0 ? result.warnings : [`Imported ${result.datasets.length} dataset${result.datasets.length === 1 ? '' : 's'}.`]);
      toast(`Imported ${result.datasets.length} dataset${result.datasets.length === 1 ? '' : 's'}`, { variant: 'success' });
      const zdId = zdTicketInput.trim().replace(/\D/g, '');
      if (zdId) onInvestigationReady?.(zdId);
      onComplete?.();
    } catch (importError) {
      const msg = importError instanceof Error ? importError.message : 'Failed to import files.';
      setError(msg);
      toast(msg, { variant: 'error' });
    } finally {
      setLoading(false);
      setParsingProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePasteImport = async () => {
    setError(null);
    setNotices([]);
    setLoading(true);
    setParsingProgress(0.15);

    try {
      const nextId = await getNextLogId();
      const result = await importPastedLogs(pasteText, {
        sourceType,
        startId: nextId,
        label: pasteLabel.trim() || undefined,
      });

      if (useIndexedDBMode) {
        await appendLogsToIndexedDB(result.logs, [result.dataset]);
        await enableIndexedDBMode();
      } else {
        mergeLogs(result.logs);
      }
      addImportedDatasets([result.dataset]);
      attachToCase([result.dataset]);
      setSelectedLogId(null);
      setNotices(result.warnings.length > 0 ? result.warnings : [`Imported ${result.dataset.logCount.toLocaleString()} pasted events.`]);
      toast(`Imported ${result.dataset.logCount.toLocaleString()} pasted events`, { variant: 'success' });
      const zdId = zdTicketInput.trim().replace(/\D/g, '');
      if (zdId) onInvestigationReady?.(zdId);
      onComplete?.();
    } catch (importError) {
      const msg = importError instanceof Error ? importError.message : 'Failed to import pasted logs.';
      setError(msg);
      toast(msg, { variant: 'error' });
    } finally {
      setLoading(false);
      setParsingProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('files')}
          className={`rounded border px-3 py-2 text-left ${mode === 'files' ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Files size={15} />
            Upload files
          </div>
          <div className="mt-1 text-[11px]">Use `.log`, `.txt`, or `.csv` exports from APEX or Datadog.</div>
        </button>
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`rounded border px-3 py-2 text-left ${mode === 'paste' ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <PencilLine size={15} />
            Paste logs
          </div>
          <div className="mt-1 text-[11px]">Best for AWS Console and short incident windows copied from live tooling.</div>
        </button>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Source</div>
        <div className="grid grid-cols-2 gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSourceType(option.id)}
              className={`rounded border px-3 py-2 text-left ${sourceType === option.id ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="mt-1 text-[11px]">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
        {helperText}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notices.length > 0 && (
        <div className="space-y-2 rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {notices.map((notice) => (
            <div key={notice}>{notice}</div>
          ))}
        </div>
      )}

      {parsingProgress > 0 && parsingProgress < 1 && (
        <div className="space-y-2 rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Importing workspace data...</span>
            <span>{Math.round(parsingProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div className="h-full bg-[var(--foreground)] transition-all duration-300" style={{ width: `${parsingProgress * 100}%` }} />
          </div>
        </div>
      )}

      {/* ── Zendesk Investigation ───────────────────────────────────── */}
      <div className="rounded border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--foreground)]">
            Zendesk Ticket
          </span>
          <span className="rounded bg-[var(--success)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[var(--success)]">
            optional
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={zdTicketInput}
            onChange={e => setZdTicketInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && zdTicketInput.trim().replace(/\D/g, '') && onInvestigationReady) {
                onInvestigationReady(zdTicketInput.trim().replace(/\D/g, ''));
                onComplete?.();
              }
            }}
            placeholder="Ticket # or URL"
            className="flex-1 rounded border border-[var(--input)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
          />
          {onInvestigationReady && (
            <button
              type="button"
              disabled={!zdTicketInput.trim().replace(/\D/g, '')}
              onClick={() => {
                const id = zdTicketInput.trim().replace(/\D/g, '');
                if (id) { onInvestigationReady(id); onComplete?.(); }
              }}
              className="flex shrink-0 items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: '#7c3aed', backgroundColor: '#7c3aed', color: '#fff' }}
              title="Open in Diagnose tab — no log file required"
            >
              <Stethoscope size={13} />
              Investigate
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">
          Enter a ticket number to begin a Diagnose session. Log files are optional — AI can pull context from Datadog and the ticket itself.
        </p>
      </div>

      {mode === 'files' ? (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".log,.txt,.csv"
            multiple
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--workspace)] px-4 py-6 text-center hover:border-[var(--ring)] hover:bg-[var(--muted)]"
          >
            <FileUp size={28} className="mb-2 text-[var(--foreground)]" />
            <div className="text-sm font-medium text-[var(--foreground)]">Choose files to import</div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">Supports `.log`, `.txt`, and `.csv`. Multiple files are merged by timestamp.</div>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Label</div>
            <input
              type="text"
              value={pasteLabel}
              onChange={(event) => setPasteLabel(event.target.value)}
              className="w-full rounded border border-[var(--input)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
              placeholder="incident-window-paste.log"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Pasted logs</div>
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              className="min-h-[180px] w-full rounded border border-[var(--input)] bg-transparent px-3 py-2 font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
              placeholder="Paste incident logs here..."
            />
          </label>
          <Button onClick={() => void handlePasteImport()} className="h-9 px-3 text-xs">
            Import pasted logs
          </Button>
        </div>
      )}
    </div>
  );
}

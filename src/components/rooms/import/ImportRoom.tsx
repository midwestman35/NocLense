import { useMemo, useState, type JSX } from 'react';
import type { ImportedDataset, LogEntry, LogSourceType } from '../../../types';
import { useLogContext } from '../../../contexts/LogContext';
import { useEvidence } from '../../../contexts/EvidenceContext';
import { useCase } from '../../../store/caseContext';
import { dbManager } from '../../../utils/indexedDB';
import { appendLogsToIndexedDB, importFiles, importPastedLogs } from '../../../services/importService';
import type { ImportFileSource } from '../../../services/importFileSource';
import { importNoclenseFile } from '../../../services/noclenseImporter';
import { Badge, Button, Card, CardContent, CardHeader, Icon, Input, useToast } from '../../ui';
import { ImportDropzone } from './ImportDropzone';
import { ImportProgress } from './ImportProgress';
import { ImportSummary, type ImportSummaryData } from './ImportSummary';
import {
  FILE_STREAM_THRESHOLD_BYTES,
  SOURCE_OPTIONS,
  formatTimeRange,
  mergeAttachments,
  normalizeTicketInput,
  upsertImportedCase,
} from './importRoomShared';

interface ImportRoomProps {
  onComplete?: () => void;
  onInvestigationReady?: (ticketId: string) => void;
  embedded?: boolean;
}

export function ImportRoom({
  onComplete,
  onInvestigationReady,
  embedded = false,
}: ImportRoomProps): JSX.Element {
  const { toast } = useToast();
  const [mode, setMode] = useState<'files' | 'paste'>('files');
  const [sourceType, setSourceType] = useState<LogSourceType>('apex');
  const [pasteText, setPasteText] = useState('');
  const [pasteLabel, setPasteLabel] = useState('aws-console-paste.log');
  const [ticketInput, setTicketInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummaryData | null>(null);
  const [streamingActive, setStreamingActive] = useState(false);

  const {
    logs,
    setLogs,
    setLoading,
    setSelectedLogId,
    parsingProgress,
    setParsingProgress,
    clearAllData,
    enableIndexedDBMode,
    useIndexedDBMode,
    addImportedDatasets,
  } = useLogContext();
  const { setInvestigation, restoreEvidenceSet } = useEvidence();
  const { activeCase, updateCase, cases, dispatch, setActiveCase } = useCase();

  const selectedSource = SOURCE_OPTIONS.find((option) => option.id === sourceType) ?? SOURCE_OPTIONS[0];
  const ticketId = normalizeTicketInput(ticketInput);
  const hasWorkspaceLogs = logs.length > 0 || useIndexedDBMode;
  const isImporting = parsingProgress > 0 && parsingProgress < 1;

  const helperText = useMemo(() => {
    if (mode === 'paste' && sourceType === 'aws') {
      return 'Paste CloudWatch or AWS console output directly. NocLense will fall back to line-by-line import when needed.';
    }
    if (mode === 'paste') {
      return 'Paste raw incident windows when exporting is slower than copying logs from live tooling.';
    }
    return hasWorkspaceLogs
      ? 'New imports append to the current workspace and preserve the active investigation state.'
      : 'Drop log files or start from a Zendesk ticket. NocLense will parse, correlate, and prepare the workspace.';
  }, [hasWorkspaceLogs, mode, sourceType]);

  const attachToCase = (datasets: ImportedDataset[]) => {
    if (!activeCase || datasets.length === 0) {
      return;
    }

    updateCase(activeCase.id, {
      attachments: mergeAttachments(activeCase.attachments, datasets),
    });
  };

  const getNextLogId = async (): Promise<number> => {
    if (useIndexedDBMode) {
      return (await dbManager.getMaxLogId()) + 1;
    }

    return logs.reduce((maxId, log) => Math.max(maxId, log.id), 0) + 1;
  };

  const mergeLogs = (incomingLogs: LogEntry[]) => {
    const merged = logs.concat(incomingLogs);
    merged.sort((left, right) => left.timestamp - right.timestamp);
    setLogs(merged);
  };

  const buildSummary = async (
    datasets: ImportedDataset[],
    importedLogs: LogEntry[],
    storageMode: 'memory' | 'indexeddb',
  ): Promise<ImportSummaryData> => {
    const importedEntryCount = datasets.reduce((total, dataset) => total + dataset.logCount, 0);
    let minTimestamp = importedLogs.length > 0
      ? Math.min(...importedLogs.map((entry) => entry.timestamp))
      : null;
    let maxTimestamp = importedLogs.length > 0
      ? Math.max(...importedLogs.map((entry) => entry.timestamp))
      : null;

    if (storageMode === 'indexeddb') {
      const metadata = await dbManager.getMetadata();
      minTimestamp = metadata?.dateRange.min ?? minTimestamp;
      maxTimestamp = metadata?.dateRange.max ?? maxTimestamp;
    }

    return {
      datasetCount: datasets.length,
      entryCount: importedEntryCount,
      fileLabel: datasets.length === 1 ? datasets[0].fileName : `${datasets.length} datasets imported`,
      formatLabel: selectedSource.label,
      storageMode,
      timeRangeLabel: formatTimeRange(minTimestamp, maxTimestamp),
    };
  };

  const finishImport = async (
    datasets: ImportedDataset[],
    importedLogs: LogEntry[],
    storageMode: 'memory' | 'indexeddb',
    nextNotices: string[],
  ) => {
    setSummary(await buildSummary(datasets, importedLogs, storageMode));
    setNotices(nextNotices);
    setSelectedLogId(null);

    if (ticketId) {
      onInvestigationReady?.(ticketId);
      return;
    }

    onComplete?.();
  };

  const handleFiles = async (fileList: FileList | ImportFileSource[] | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setError(null);
    setSummary(null);
    setNotices([]);
    setLoading(true);
    setParsingProgress(0);

    try {
      const files = Array.isArray(fileList) ? fileList : Array.from(fileList);
      setStreamingActive(files.some((file) => file.size > FILE_STREAM_THRESHOLD_BYTES));

      const firstFile = files[0];
      if (firstFile && firstFile.name.toLowerCase().endsWith('.noclense')) {
        if (files.length > 1) {
          const message = 'Drop .noclense files alone. Do not mix with log files.';
          setError(message);
          toast('Drop .noclense files alone', { variant: 'error' });
          return;
        }

        const result = await importNoclenseFile(firstFile);
        if (!result.ok) {
          setError(result.error);
          toast(result.error, { variant: 'error' });
          return;
        }

        if (typeof clearAllData === 'function') {
          await clearAllData();
        } else {
          toast('Logs from the previous session remain loaded.', { variant: 'warning' });
        }

        setSelectedLogId(null);
        setInvestigation(result.investigation);
        restoreEvidenceSet(result.evidenceSet);
        dispatch({ type: 'LOAD_CASES', payload: upsertImportedCase(cases, result.importedCase) });
        setActiveCase(result.importedCase.id);
        setNotices(['Investigation archive restored.']);
        toast('Investigation imported.', { variant: 'success' });
        onComplete?.();
        return;
      }

      const nextId = await getNextLogId();
      const shouldUseIndexedDB = useIndexedDBMode || logs.length === 0;
      const result = await importFiles(files, {
        sourceType,
        startId: nextId,
        onProgress: setParsingProgress,
        useIndexedDB: shouldUseIndexedDB,
      });

      let storageMode: 'memory' | 'indexeddb' = 'memory';

      if (result.usedIndexedDB) {
        await enableIndexedDBMode();
        storageMode = 'indexeddb';
      } else if (useIndexedDBMode && result.logs.length > 0) {
        await appendLogsToIndexedDB(result.logs, result.datasets);
        await enableIndexedDBMode();
        storageMode = 'indexeddb';
      } else if (result.logs.length > 0) {
        mergeLogs(result.logs);
      }

      addImportedDatasets(result.datasets);
      attachToCase(result.datasets);
      toast(`Imported ${result.datasets.length} dataset${result.datasets.length === 1 ? '' : 's'}`, { variant: 'success' });

      await finishImport(
        result.datasets,
        result.logs,
        storageMode,
        result.warnings.length > 0 ? result.warnings : [`Imported ${result.datasets.length} dataset${result.datasets.length === 1 ? '' : 's'}.`],
      );
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Failed to import files.';
      setError(message);
      toast(message, { variant: 'error' });
    } finally {
      setLoading(false);
      setParsingProgress(0);
    }
  };

  const handlePasteImport = async () => {
    setError(null);
    setSummary(null);
    setNotices([]);
    setStreamingActive(false);
    setLoading(true);
    setParsingProgress(0.15);

    try {
      const nextId = await getNextLogId();
      const result = await importPastedLogs(pasteText, {
        sourceType,
        startId: nextId,
        label: pasteLabel.trim() || undefined,
      });

      let storageMode: 'memory' | 'indexeddb' = 'memory';

      if (useIndexedDBMode) {
        await appendLogsToIndexedDB(result.logs, [result.dataset]);
        await enableIndexedDBMode();
        storageMode = 'indexeddb';
      } else {
        mergeLogs(result.logs);
      }

      addImportedDatasets([result.dataset]);
      attachToCase([result.dataset]);
      toast(`Imported ${result.dataset.logCount.toLocaleString()} pasted events`, { variant: 'success' });

      await finishImport(
        [result.dataset],
        result.logs,
        storageMode,
        result.warnings.length > 0 ? result.warnings : [`Imported ${result.dataset.logCount.toLocaleString()} pasted events.`],
      );
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Failed to import pasted logs.';
      setError(message);
      toast(message, { variant: 'error' });
    } finally {
      setLoading(false);
      setParsingProgress(0);
    }
  };

  return (
    <Card
      variant={embedded ? 'default' : 'elevated'}
      className={[
        embedded
          ? 'w-full border-[var(--line)] bg-[var(--bg-2)]'
          : 'w-full max-w-5xl bg-[linear-gradient(180deg,rgba(15,19,25,0.94),rgba(10,13,18,0.96))] shadow-[0_12px_70px_-60px_rgba(142,240,183,0.5)]',
        'overflow-hidden',
      ].join(' ')}
    >
      <CardHeader className="items-start justify-between gap-4">
        <div className="space-y-2">
          {!embedded && (
            <Badge variant="outline" className="mono w-fit text-[10px] uppercase tracking-[0.16em] text-[var(--mint)]">
              Room 1 / 3 · Import
            </Badge>
          )}
          <div>
            <h1 className="text-[28px] font-medium tracking-[-0.03em] text-[var(--ink-0)]">
              Start an <span className="serif text-[var(--mint)]">investigation</span>.
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[var(--ink-2)]">
              Drop log files or paste an incident window. NocLense will parse, correlate, and prepare the workspace.
            </p>
          </div>
        </div>
        <div className="space-y-1 text-right">
          <p className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Runtime</p>
          <p className="text-sm text-[var(--ink-1)]">
            {useIndexedDBMode ? 'IndexedDB active' : 'Local parse ready'}
          </p>
        </div>
      </CardHeader>

      <CardContent className={embedded ? 'space-y-5 p-5' : 'space-y-6 p-6 sm:p-8'}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('files')}
              className={[
                'rounded-[var(--radius-panel)] border p-4 text-left transition-colors',
                mode === 'files'
                  ? 'border-[rgba(142,240,183,0.25)] bg-[rgba(142,240,183,0.05)] text-[var(--ink-0)]'
                  : 'border-[var(--line)] bg-[rgba(255,255,255,0.015)] text-[var(--ink-2)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Icon name="import" size={14} stroke={mode === 'files' ? 'var(--mint)' : 'currentColor'} />
                <span className="text-sm font-medium">Upload files</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-3)]">
                Use .log, .txt, .csv, .zip, .pdf, or .noclense exports.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('paste')}
              className={[
                'rounded-[var(--radius-panel)] border p-4 text-left transition-colors',
                mode === 'paste'
                  ? 'border-[rgba(142,240,183,0.25)] bg-[rgba(142,240,183,0.05)] text-[var(--ink-0)]'
                  : 'border-[var(--line)] bg-[rgba(255,255,255,0.015)] text-[var(--ink-2)]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Icon name="terminal" size={14} stroke={mode === 'paste' ? 'var(--mint)' : 'currentColor'} />
                <span className="text-sm font-medium">Paste logs</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--ink-3)]">
                Best for AWS Console output and short incident windows copied from live tooling.
              </p>
            </button>
          </div>

          <Card className="border-[var(--line)] bg-[rgba(255,255,255,0.015)]">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Icon name="ticket" size={14} stroke="var(--mint)" />
                <p className="text-sm font-medium text-[var(--ink-0)]">Zendesk ticket</p>
                <Badge variant="outline" className="mono text-[9px] uppercase tracking-[0.14em]">
                  Optional
                </Badge>
              </div>
              <Input
                label="Ticket # or URL"
                value={ticketInput}
                onChange={(event) => setTicketInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && ticketId) {
                    onInvestigationReady?.(ticketId);
                  }
                }}
                placeholder="Ticket # or URL"
              />
              <p className="text-xs leading-5 text-[var(--ink-3)]">
                Enter a ticket number to begin from Zendesk context. Log files remain optional.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={!ticketId}
                onClick={() => {
                  if (ticketId) {
                    onInvestigationReady?.(ticketId);
                  }
                }}
                className="w-full justify-center"
              >
                <Icon name="spark" size={14} />
                Investigate ticket
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 border-b border-[var(--line)] pb-3">
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-1)]">Source</span>
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">
              optional parser hint
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SOURCE_OPTIONS.map((option) => {
              const active = option.id === sourceType;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSourceType(option.id)}
                  className={[
                    'rounded-[var(--radius-panel)] border p-4 text-left transition-colors',
                    active
                      ? 'border-[rgba(142,240,183,0.25)] bg-[rgba(142,240,183,0.05)]'
                      : 'border-[var(--line)] bg-[rgba(255,255,255,0.015)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={option.icon} size={12} stroke={active ? 'var(--mint)' : 'currentColor'} />
                    <span className={active ? 'text-sm font-medium text-[var(--mint)]' : 'text-sm font-medium text-[var(--ink-1)]'}>
                      {option.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-3)]">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Card className="border-[var(--line)] bg-[rgba(255,255,255,0.015)]">
          <CardContent className="p-4">
            <p className="text-sm leading-6 text-[var(--ink-2)]">{helperText}</p>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)]">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-[var(--red)]">
              <Icon name="shield" size={14} stroke="var(--red)" className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {mode === 'files' ? (
          <ImportDropzone disabled={isImporting} onSelectFiles={handleFiles} />
        ) : (
          <Card className="border-[var(--line)] bg-[rgba(255,255,255,0.015)]">
            <CardContent className="space-y-4 p-4">
              <Input
                label="Label"
                value={pasteLabel}
                onChange={(event) => setPasteLabel(event.target.value)}
                placeholder="incident-window-paste.log"
              />
              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-2)]">
                  Pasted logs
                </span>
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  className="min-h-[220px] rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--bg-1)] px-4 py-3 font-mono text-xs text-[var(--ink-0)] placeholder:text-[var(--ink-3)] focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)]"
                  placeholder="Paste incident logs here..."
                />
              </label>
              <Button type="button" onClick={() => void handlePasteImport()} disabled={!pasteText.trim()}>
                <Icon name="import" size={14} />
                Import pasted logs
              </Button>
            </CardContent>
          </Card>
        )}

        <ImportProgress progress={parsingProgress} streaming={streamingActive && selectedSource.id !== 'aws'} />

        {summary && <ImportSummary summary={summary} />}

        {notices.length > 0 && (
          <Card className="border-[var(--line)] bg-[rgba(255,255,255,0.015)]">
            <CardContent className="space-y-2 p-4">
              {notices.map((notice) => (
                <p key={notice} className="text-xs leading-5 text-[var(--ink-2)]">
                  {notice}
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

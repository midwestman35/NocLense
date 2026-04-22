import { useMemo, useState } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { useCase } from '../../store/caseContext';
import { Download, Star } from 'lucide-react';
import type { LogEntry } from '../../types';
import { Dialog } from '../ui';
import { Button } from '../ui';
import Spinner from '../ui/Spinner';
import type { ExportOptions, PackType, RedactionPreset } from '../../types/export';
import { buildPack } from '../../services/exportPackBuilder';
import { buildZip, downloadBlob } from '../../services/zipBuilder';
import { dbManager } from '../../utils/indexedDB';

type ExportFormat = 'jsonl' | 'csv';
type ExportMode = 'data' | 'pack';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function sanitizeFileName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'case';
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { filteredLogs, logs, favoriteLogIds, importedDatasets, useIndexedDBMode } = useLogContext();
  const { activeCase } = useCase();
  const [mode, setMode] = useState<ExportMode>('data');
  const [format, setFormat] = useState<ExportFormat>('jsonl');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFavoritesOnly, setExportFavoritesOnly] = useState(false);
  const [packType, setPackType] = useState<PackType>('full');
  const [redactionPreset, setRedactionPreset] = useState<RedactionPreset>('internal');

  const eventsToExport = useMemo(() => {
    let events = filteredLogs.length > 0 ? filteredLogs : logs;
    if (exportFavoritesOnly) {
      events = events.filter((event) => favoriteLogIds.has(event.id));
    }
    return events;
  }, [filteredLogs, logs, exportFavoritesOnly, favoriteLogIds]);

  const evidenceBookmarkCount = activeCase?.bookmarks.length ?? 0;

  const packOptions = useMemo<ExportOptions>(
    () => ({
      packType,
      redactionPreset,
      includePayload: true,
      timeBufferSeconds: 0,
      maxEvents: 500,
    }),
    [packType, redactionPreset]
  );

  const exportToJSONL = (events: LogEntry[]) => {
    const lines = events.map((event) =>
      JSON.stringify({
        id: event.id,
        timestamp: event.timestamp,
        rawTimestamp: event.rawTimestamp,
        level: event.level,
        component: event.component,
        message: event.message,
        payload: event.payload,
        type: event.type,
        json: event.json,
        isSip: event.isSip,
        sipMethod: event.sipMethod,
        callId: event.callId,
        reportId: event.reportId,
        operatorId: event.operatorId,
        extensionId: event.extensionId,
        stationId: event.stationId,
        sipFrom: event.sipFrom,
        sipTo: event.sipTo,
        fileName: event.fileName,
        fileColor: event.fileColor,
        sourceType: event.sourceType,
        sourceLabel: event.sourceLabel,
        importBatchId: event.importBatchId,
        importedAt: event.importedAt,
      })
    );
    return lines.join('\n');
  };

  const exportToCSV = (events: LogEntry[]) => {
    const headers = [
      'ID',
      'Timestamp',
      'Raw Timestamp',
      'Level',
      'Component',
      'Message',
      'Payload',
      'Type',
      'Is SIP',
      'SIP Method',
      'Call ID',
      'Report ID',
      'Operator ID',
      'Extension ID',
      'Station ID',
      'File Name',
      'Source Type',
      'Source Label',
    ];

    const rows = events.map((event) => [
      event.id.toString(),
      new Date(event.timestamp).toISOString(),
      `"${event.rawTimestamp.replace(/"/g, '""')}"`,
      event.level,
      `"${event.component.replace(/"/g, '""')}"`,
      `"${event.message.replace(/"/g, '""')}"`,
      `"${event.payload.replace(/"/g, '""')}"`,
      event.type,
      event.isSip ? 'true' : 'false',
      event.sipMethod || '',
      event.callId || '',
      event.reportId || '',
      event.operatorId || '',
      event.extensionId || '',
      event.stationId || '',
      event.fileName || '',
      event.sourceType || '',
      event.sourceLabel || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  };

  const handleExport = async () => {
    if (mode === 'data' && eventsToExport.length === 0) {
      alert('No events to export.');
      return;
    }
    if (mode === 'pack' && (!activeCase || evidenceBookmarkCount === 0)) {
      alert('Select a case with captured evidence before exporting an evidence pack.');
      return;
    }

    setIsExporting(true);
    try {
      if (mode === 'data') {
        const content = format === 'jsonl' ? exportToJSONL(eventsToExport) : exportToCSV(eventsToExport);
        const mimeType = format === 'jsonl' ? 'application/jsonl' : 'text/csv';
        const extension = format === 'jsonl' ? 'jsonl' : 'csv';
        const blob = new Blob([content], { type: mimeType });
        downloadBlob(`noclense-export-${new Date().toISOString().split('T')[0]}.${extension}`, blob);
      } else if (activeCase) {
        const resolvedEvidenceLogs = (await Promise.all(
          activeCase.bookmarks.map(async (bookmark) => {
            const inMemory = logs.find((log) => log.id === bookmark.logId);
            if (inMemory) return inMemory;
            if (useIndexedDBMode) {
              return dbManager.getLog(bookmark.logId);
            }
            return undefined;
          })
        )).filter(Boolean) as LogEntry[];

        if (resolvedEvidenceLogs.length === 0) {
          alert('No evidence logs could be resolved for export.');
          return;
        }

        const pack = buildPack(activeCase, resolvedEvidenceLogs, importedDatasets, packOptions, '2.0.0', 'parser-v1');
        const zipBlob = buildZip([
          { name: 'report.md', content: pack.report },
          { name: 'case.json', content: pack.caseJson },
          { name: 'events.jsonl', content: pack.filteredLogs },
          { name: 'queries.txt', content: pack.queries },
          { name: 'provenance.json', content: JSON.stringify(pack.provenance, null, 2) },
        ]);
        downloadBlob(`noclense-evidence-pack-${sanitizeFileName(activeCase.externalRef ?? activeCase.title)}.zip`, zipBlob);
      }
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Export"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting || (mode === 'data' ? eventsToExport.length === 0 : !activeCase || evidenceBookmarkCount === 0)}>
            {isExporting ? (
              <>
                <Spinner size="sm" label="Exporting" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('data')}
            className={`rounded border px-3 py-2 text-left ${mode === 'data' ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
          >
            <div className="font-medium">Data Export</div>
            <div className="mt-1 text-xs">Export the current filtered view for spreadsheets or raw analysis.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode('pack')}
            className={`rounded border px-3 py-2 text-left ${mode === 'pack' ? 'border-[var(--ring)] bg-[var(--muted)] text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
          >
            <div className="font-medium">Evidence Pack</div>
            <div className="mt-1 text-xs">Create a deterministic case handoff with evidence, queries, and provenance.</div>
          </button>
        </div>

        {mode === 'data' ? (
          <>
            <p className="text-sm text-[var(--muted-foreground)]">
              Exporting <span className="font-semibold text-[var(--foreground)]">{eventsToExport.length.toLocaleString()}</span> event{eventsToExport.length !== 1 ? 's' : ''}
              {exportFavoritesOnly && favoriteLogIds.size > 0 && (
                <span className="text-xs text-[var(--warning)] ml-2">
                  ({favoriteLogIds.size} favorite{favoriteLogIds.size !== 1 ? 's' : ''})
                </span>
              )}
            </p>

            {favoriteLogIds.size > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={exportFavoritesOnly}
                  onChange={(event) => setExportFavoritesOnly(event.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-[var(--foreground)] mb-1 flex items-center gap-2">
                    <Star size={14} className={exportFavoritesOnly ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--muted-foreground)]'} />
                    Export Only Favorites
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Export only {favoriteLogIds.size} favorited event{favoriteLogIds.size !== 1 ? 's' : ''}
                  </div>
                </div>
              </label>
            )}

            <div className="space-y-3">
              {(['jsonl', 'csv'] as ExportFormat[]).map((candidate) => (
                <label key={candidate} className="flex items-start gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--border)] hover:bg-[var(--accent)] cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="format"
                    value={candidate}
                    checked={format === candidate}
                    onChange={(event) => setFormat(event.target.value as ExportFormat)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--foreground)] mb-1">{candidate.toUpperCase()}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {candidate === 'jsonl' ? 'Full event data, one event per line.' : 'Flattened fields for spreadsheets.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {!activeCase ? (
              <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                No active case. Select a case before exporting an evidence pack.
              </div>
            ) : evidenceBookmarkCount === 0 ? (
              <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                The active case has no captured evidence yet. Add evidence from the details drawer first.
              </div>
            ) : (
              <div className="rounded border border-[var(--border)] bg-[var(--workspace)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                Building a pack for <span className="font-medium text-[var(--foreground)]">{activeCase.title}</span> with{' '}
                <span className="font-medium text-[var(--foreground)]">{evidenceBookmarkCount.toLocaleString()}</span> evidence event{evidenceBookmarkCount === 1 ? '' : 's'} and{' '}
                <span className="font-medium text-[var(--foreground)]">{importedDatasets.length}</span> attached source{importedDatasets.length === 1 ? '' : 's'}.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Pack type</div>
                <select value={packType} onChange={(event) => setPackType(event.target.value as PackType)} className="h-9 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]">
                  <option value="full">Full</option>
                  <option value="uc">UC</option>
                  <option value="network">Network</option>
                  <option value="rd">RD</option>
                  <option value="aws">AWS</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Redaction</div>
                <select value={redactionPreset} onChange={(event) => setRedactionPreset(event.target.value as RedactionPreset)} className="h-9 w-full rounded border border-[var(--input)] bg-transparent px-2 text-sm text-[var(--foreground)]">
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                  <option value="raw">Raw</option>
                </select>
              </label>
            </div>

            <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              Evidence packs include `report.md`, `case.json`, `events.jsonl`, `queries.txt`, and `provenance.json` in one `.zip` file.
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

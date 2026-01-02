import { useState, useMemo } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { Download, X, Star } from 'lucide-react';
import type { LogEntry } from '../../types';

type ExportFormat = 'jsonl' | 'csv';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { filteredLogs, logs, favoriteLogIds } = useLogContext();
  const [format, setFormat] = useState<ExportFormat>('jsonl');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFavoritesOnly, setExportFavoritesOnly] = useState(false);

  const eventsToExport = useMemo(() => {
    let events = filteredLogs.length > 0 ? filteredLogs : logs;
    if (exportFavoritesOnly) {
      events = events.filter(e => favoriteLogIds.has(e.id));
    }
    return events;
  }, [filteredLogs, logs, exportFavoritesOnly, favoriteLogIds]);

  const eventCount = eventsToExport.length;

  const exportToJSONL = (events: LogEntry[]) => {
    const lines = events.map(event => JSON.stringify({
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
      fileColor: event.fileColor
    }));
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
      'SIP From',
      'SIP To',
      'File Name'
    ];

    const rows = events.map(event => [
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
      event.sipFrom || '',
      event.sipTo || '',
      event.fileName || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  const handleExport = async () => {
    if (eventCount === 0) {
      alert('No events to export');
      return;
    }

    setIsExporting(true);
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'jsonl') {
        content = exportToJSONL(eventsToExport);
        filename = `noclense-export-${new Date().toISOString().split('T')[0]}.jsonl`;
        mimeType = 'application/jsonl';
      } else {
        content = exportToCSV(eventsToExport);
        filename = `noclense-export-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Export</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-slate-400 mb-4">
              Exporting <span className="font-semibold text-slate-200">{eventCount.toLocaleString()}</span> event{eventCount !== 1 ? 's' : ''}
              {exportFavoritesOnly && favoriteLogIds.size > 0 && (
                <span className="text-xs text-yellow-500 ml-2">
                  ({favoriteLogIds.size} favorite{favoriteLogIds.size !== 1 ? 's' : ''})
                </span>
              )}
            </p>

            {/* Export Favorites Only Option */}
            {favoriteLogIds.size > 0 && (
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors mb-3">
                <input
                  type="checkbox"
                  checked={exportFavoritesOnly}
                  onChange={(e) => setExportFavoritesOnly(e.target.checked)}
                  className="mt-1 w-4 h-4 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-200 mb-1 flex items-center gap-2">
                    <Star size={14} className={exportFavoritesOnly ? "fill-yellow-500 text-yellow-500" : "text-slate-400"} />
                    Export Only Favorites
                  </div>
                  <div className="text-xs text-slate-400">
                    Export only {favoriteLogIds.size} favorited event{favoriteLogIds.size !== 1 ? 's' : ''}
                  </div>
                </div>
              </label>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="jsonl"
                  checked={format === 'jsonl'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="mt-1 w-4 h-4 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-200 mb-1">JSONL</div>
                  <div className="text-xs text-slate-400">Full event data, one per line</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  className="mt-1 w-4 h-4 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-200 mb-1">CSV</div>
                  <div className="text-xs text-slate-400">Flattened fields for spreadsheets</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || eventCount === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <span className="animate-spin">⏳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

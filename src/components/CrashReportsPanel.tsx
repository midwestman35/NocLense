import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCopy, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';

interface CrashReportRecord {
  reportId: string;
  source: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface CrashReportsPanelProps {
  onClose?: () => void;
}

/**
 * Crash reports viewer for support/debug workflows.
 *
 * Why:
 * - Gives operators a single place to inspect recent crashes without opening files manually.
 * - Allows quick copy/share of structured crash payloads for triage.
 */
export default function CrashReportsPanel({ onClose }: CrashReportsPanelProps) {
  const [reports, setReports] = useState<CrashReportRecord[]>([]);
  const [logPath, setLogPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedReport = useMemo(
    () => reports.find((report) => report.reportId === selectedId) ?? reports[0] ?? null,
    [reports, selectedId]
  );

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI?.getCrashReports?.({ limit: 100 });
      if (!response?.ok) {
        setError(response?.error ?? 'Failed to load crash reports');
        setReports([]);
        return;
      }
      const loadedReports = response.reports ?? [];
      setReports(loadedReports);
      setLogPath(response.logPath ?? '');
      setSelectedId(loadedReports[0]?.reportId ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load crash reports');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleCopyReport = useCallback(async () => {
    if (!selectedReport) return;
    await navigator.clipboard.writeText(JSON.stringify(selectedReport, null, 2));
  }, [selectedReport]);

  const handleOpenLocation = useCallback(async () => {
    await window.electronAPI?.openCrashLogLocation?.();
  }, []);

  const handleClearReports = useCallback(async () => {
    const confirmClear = window.confirm('Clear all crash reports from local log file?');
    if (!confirmClear) return;
    const response = await window.electronAPI?.clearCrashReports?.();
    if (!response?.ok) {
      setError(response?.error ?? 'Failed to clear crash reports');
      return;
    }
    await loadReports();
  }, [loadReports]);

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-[var(--destructive)]" />
          <h2 className="text-lg font-semibold">Crash Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadReports()}
            className="px-3 py-1.5 rounded bg-[var(--muted)] border border-[var(--border)] text-sm inline-flex items-center gap-1 hover:bg-[var(--muted)]/80"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[var(--muted)] border border-[var(--border)] text-sm hover:bg-[var(--muted)]/80"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
        <button
          onClick={() => void handleOpenLocation()}
          className="px-3 py-1.5 rounded bg-[var(--muted)] border border-[var(--border)] text-sm inline-flex items-center gap-1 hover:bg-[var(--muted)]/80"
        >
          <ExternalLink size={14} />
          Open Log Location
        </button>
        <button
          onClick={() => void handleCopyReport()}
          disabled={!selectedReport}
          className="px-3 py-1.5 rounded bg-[var(--muted)] border border-[var(--border)] text-sm inline-flex items-center gap-1 hover:bg-[var(--muted)]/80 disabled:opacity-50"
        >
          <ClipboardCopy size={14} />
          Copy Selected Report
        </button>
        <button
          onClick={() => void handleClearReports()}
          className="px-3 py-1.5 rounded bg-[var(--destructive)]/10 border border-red-500/30 text-sm inline-flex items-center gap-1 hover:bg-[var(--destructive)]/20 text-[var(--destructive)]"
        >
          <Trash2 size={14} />
          Clear Reports
        </button>
      </div>

      {logPath && (
        <div className="px-4 py-2 text-xs text-[var(--muted-foreground)] border-b border-[var(--border)]">
          Local file: <span className="font-mono">{logPath}</span>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 p-3 rounded bg-[var(--destructive)]/10 border border-red-500/30 text-[var(--destructive)] text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden grid grid-cols-5">
        <div className="col-span-2 border-r border-[var(--border)] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-[var(--muted-foreground)]">Loading crash reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted-foreground)]">No crash reports recorded yet.</div>
          ) : (
            reports.map((report) => (
              <button
                key={report.reportId}
                onClick={() => setSelectedId(report.reportId)}
                className={`w-full text-left p-3 border-b border-[var(--border)] hover:bg-[var(--muted)]/60 ${
                  selectedReport?.reportId === report.reportId ? 'bg-[var(--muted)]' : ''
                }`}
              >
                <div className="text-xs text-[var(--muted-foreground)]">{new Date(report.timestamp).toLocaleString()}</div>
                <div className="text-sm font-medium break-all">{report.source}</div>
                <div className="text-xs text-[var(--muted-foreground)] font-mono break-all">{report.reportId}</div>
              </button>
            ))
          )}
        </div>

        <div className="col-span-3 overflow-y-auto p-4">
          {selectedReport ? (
            <>
              <div className="mb-3">
                <div className="text-xs text-[var(--muted-foreground)]">Report ID</div>
                <div className="font-mono text-sm break-all">{selectedReport.reportId}</div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-[var(--muted-foreground)]">Source</div>
                <div className="text-sm">{selectedReport.source}</div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-[var(--muted-foreground)]">Timestamp</div>
                <div className="text-sm">{new Date(selectedReport.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted-foreground)] mb-1">Payload</div>
                <pre className="text-xs p-3 rounded bg-[var(--muted)] border border-[var(--border)] overflow-auto">
                  {JSON.stringify(selectedReport.payload, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--muted-foreground)]">Select a crash report to inspect details.</div>
          )}
        </div>
      </div>
    </div>
  );
}

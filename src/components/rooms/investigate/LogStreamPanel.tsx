import type { JSX, Ref } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { LogEntry } from '../../../types';
import FilterBar from '../../FilterBar';
import LogViewer, { type LogViewerHandle } from '../../LogViewer';
import LogTimeline from '../../timeline/LogTimeline';
import LogDetailsPanel from '../../log/LogDetailsPanel';
import { CaseHeader } from '../../case/CaseHeader';
import { FilterChipBar } from './FilterChipBar';

interface LogStreamPanelProps {
  fileError: string | null;
  logViewerRef: Ref<LogViewerHandle>;
  parseProgress: number | null;
  selectedLog: LogEntry | null;
  onCloseSelectedLog: () => void;
  onJumpToSelectedLog: () => void;
}

export function LogStreamPanel({
  fileError,
  logViewerRef,
  parseProgress,
  selectedLog,
  onCloseSelectedLog,
  onJumpToSelectedLog,
}: LogStreamPanelProps): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {fileError && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--destructive)]/20 px-3 py-2 text-xs text-[var(--destructive)]">
          <AlertTriangle size={14} />
          {fileError}
        </div>
      )}
      <CaseHeader />
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-2 py-1">
        <FilterBar />
      </div>
      <LogTimeline />
      <FilterChipBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <LogViewer ref={logViewerRef} parseProgress={parseProgress} />
      </div>
      {selectedLog && (
        <div className="shrink-0 overflow-hidden border-t border-[var(--border)] bg-[var(--card)]" style={{ height: 300 }}>
          <LogDetailsPanel
            log={selectedLog}
            onClose={onCloseSelectedLog}
            onJumpToLog={onJumpToSelectedLog}
          />
        </div>
      )}
    </div>
  );
}

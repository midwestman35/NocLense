import { type JSX, type Ref, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { markImport } from '../../../utils/perfMarks';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import type { LogViewerHandle } from '../../LogViewer';
import type { LogEntry } from '../../../types';
import type { CitationId, EvidenceSet } from '../../../types/canonical';
import type { SimilarPastTicket } from '../../../types/diagnosis';
import type { InvestigationSetup } from '../../../types/investigation';
import { AIAssistantPanel } from './AIAssistantPanel';
import { CorrelationGraph } from './CorrelationGraph';
import { DatadogLiveCard } from './DatadogLiveCard';
import { EvidencePanel } from './EvidencePanel';
import { LogStreamPanel } from './LogStreamPanel';
import { SimilarTicketsPanel } from './SimilarTicketsPanel';

interface InvestigateRoomProps {
  filteredLogCount: number;
  fileError: string | null;
  logViewerRef: Ref<LogViewerHandle>;
  parseProgress: number | null;
  selectedLog: LogEntry | null;
  pendingSetup: InvestigationSetup | null;
  similarPastTickets: SimilarPastTicket[];
  evidenceSet: EvidenceSet | null;
  onCloseSelectedLog: () => void;
  onJumpToSelectedLog: () => void;
  onSetupAI: () => void;
  onSetupConsumed: () => void;
  onCitationClick: (citationId: CitationId) => void;
}

export function InvestigateRoom({
  filteredLogCount,
  fileError,
  logViewerRef,
  parseProgress,
  selectedLog,
  pendingSetup,
  similarPastTickets,
  evidenceSet,
  onCloseSelectedLog,
  onJumpToSelectedLog,
  onSetupAI,
  onSetupConsumed,
  onCitationClick,
}: InvestigateRoomProps): JSX.Element {
  useEffect(() => {
    markImport('investigate.mount');
  }, []);

  return (
    <>
      <WorkspaceCard
        id="log-stream"
        title="Log Stream"
        icon={<FileText size={14} />}
        accentColor="#76ce40"
        meta={<span>{filteredLogCount.toLocaleString()} events</span>}
        className={CARD_GRID_CLASSES['log-stream']}
      >
        <LogStreamPanel
          fileError={fileError}
          logViewerRef={logViewerRef}
          parseProgress={parseProgress}
          selectedLog={selectedLog}
          onCloseSelectedLog={onCloseSelectedLog}
          onJumpToSelectedLog={onJumpToSelectedLog}
        />
      </WorkspaceCard>

      <AIAssistantPanel
        pendingSetup={pendingSetup}
        onSetupAI={onSetupAI}
        onSetupConsumed={onSetupConsumed}
        onCitationClick={onCitationClick}
      />

      <EvidencePanel evidenceSet={evidenceSet} />

      <SimilarTicketsPanel similarPastTickets={similarPastTickets} />

      <CorrelationGraph />

      <DatadogLiveCard />
    </>
  );
}

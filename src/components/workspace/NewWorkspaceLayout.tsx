/**
 * NewWorkspaceLayout — the primary application layout.
 *
 * Uses RoomRouter with three rooms: Import, Investigate, Submit.
 * Each room has a distinct layout with WorkspaceCard containers.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { useAI } from '../../contexts/AIContext';
import { RoomRouter } from './RoomRouter';
import type { Phase } from './types';

// Existing components — reused as card content
import type { LogViewerHandle } from '../LogViewer';
import { ImportRoom } from '../rooms/import/ImportRoom';
import { SetupRoom } from '../rooms/setup/SetupRoom';
import { InvestigateRoom } from '../rooms/investigate/InvestigateRoom';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui';
// ServerSettingsPanel — kept in codebase but removed from UI until backend plans are decided
// import ServerSettingsPanel from '../ServerSettingsPanel';
import InvestigationSetupModal from '../InvestigationSetupModal';
import { AIOnboardingWizard } from '../onboarding/AIOnboardingWizard';
import ExportModal from '../export/ExportModal';
import { SubmitRoom } from './SubmitRoom';

import { CaseStateBridge } from '../case/CaseStateBridge';
import { FolderPlus, Download, Trash2 } from 'lucide-react';
import type { InvestigationSetup } from '../../types/investigation';
import type { ZendeskTicket } from '../../services/zendeskService';
import { loadAiSettings } from '../../store/aiSettings';
import { useEvidence } from '../../contexts/EvidenceContext';
import type { Citation, CitationId } from '../../types/canonical';

function formatTicketLabel(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

function buildCitationUrl(citation: Citation): string | null {
  const settings = loadAiSettings();

  switch (citation.source.kind) {
    case 'jira':
      return settings.jiraSubdomain
        ? `https://${settings.jiraSubdomain}/browse/${citation.source.key}`
        : null;
    case 'zendesk':
      return settings.zendeskSubdomain
        ? `https://${settings.zendeskSubdomain}.zendesk.com/agent/tickets/${citation.source.ticketId}`
        : null;
    case 'confluence':
      return settings.jiraSubdomain
        ? `https://${settings.jiraSubdomain}/wiki/spaces/${citation.source.spaceKey}/pages/${citation.source.pageId}`
        : null;
    case 'slack':
      return citation.source.messageTs
        ? `https://${citation.source.workspace}.slack.com/archives/${citation.source.channelId}/p${citation.source.messageTs.replace('.', '')}`
        : `https://${citation.source.workspace}.slack.com/archives/${citation.source.channelId}`;
    case 'datadog': {
      const params = new URLSearchParams({
        query: citation.source.query,
        from_ts: String(citation.source.startMs),
        to_ts: String(citation.source.endMs),
        live: 'false',
      });
      return `https://app.${settings.datadogSite}/logs?${params.toString()}`;
    }
    default:
      return null;
  }
}

export function NewWorkspaceLayout() {
  const {
    logs,
    selectedLogId,
    filteredLogs,
    setSelectedLogId,
    setFilterText,
    activeCorrelations,
    setActiveCorrelations,
    setJumpState,
    setScrollTargetTimestamp,
    filterText,
    clearAllData,
    parsingProgress,
  } = useLogContext();
  const { similarPastTickets } = useAI();
  const { evidenceSet, investigation } = useEvidence();
  const logViewerRef = useRef<LogViewerHandle>(null);

  const [explicitPhase, setExplicitPhase] = useState<Phase | null>(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [investigationModalTicketId, setInvestigationModalTicketId] = useState<string | null>(null);
  const [pendingSetup, setPendingSetup] = useState<InvestigationSetup | null>(null);
  const [activeTicket, setActiveTicket] = useState<ZendeskTicket | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [fileError] = useState<string | null>(null);
  const holdImportPhase = investigationModalTicketId !== null;
  const derivedPhase: Phase = explicitPhase ?? (holdImportPhase ? 'import' : logs.length === 0 ? 'import' : 'investigate');

  const selectedLog = selectedLogId
    ? filteredLogs.find((e) => e.id === selectedLogId) ?? logs.find((e) => e.id === selectedLogId) ?? null
    : null;
  const parseProgress = parsingProgress > 0 && parsingProgress < 1 ? parsingProgress * 100 : null;

  const handleCitationClick = useCallback((citationId: CitationId) => {
    const citation = investigation?.citations[citationId];
    if (!citation) return;

    if (citation.source.kind === 'log') {
      logViewerRef.current?.jumpToCitation(citation.source.fileName, citation.source.byteOffset);
      return;
    }

    const url = buildCitationUrl(citation);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [investigation]);

  // Phase dot navigation — user clicks a completed phase dot
  const handlePhaseChange = useCallback((next: Phase) => {
    setExplicitPhase(next);
  }, []);

  const handleClearLogs = useCallback(async () => {
    await clearAllData();
    setSelectedLogId(null);
    setFilterText('');
    setActiveTicket(null);
    setExplicitPhase(null); // Reset to derived (will go to 'import' since logs are cleared)
  }, [clearAllData, setSelectedLogId, setFilterText]);

  // When logs are loaded, auto-advance to investigate
  const handleImportComplete = useCallback(() => {
    setActiveTicket(null);
    setExplicitPhase('setup');
  }, []);

  const handleInvestigationReady = useCallback((ticketId: string) => {
    setActiveTicket(null);
    setInvestigationModalTicketId(ticketId);
  }, []);

  // ── Import Room ────────────────────────────────────────────────
  const importContent = useMemo(() => (
    <ImportRoom
      onComplete={handleImportComplete}
      onInvestigationReady={handleInvestigationReady}
    />
  ), [handleImportComplete, handleInvestigationReady]);

  const setupContent = useMemo(() => (
    <SetupRoom
      onBack={() => setExplicitPhase('import')}
      onContinue={() => setExplicitPhase('investigate')}
    />
  ), []);

  // ── Investigate Room ───────────────────────────────────────────
  const investigateContent = useMemo(() => (
    <InvestigateRoom
      filteredLogCount={filteredLogs.length}
      fileError={fileError}
      logViewerRef={logViewerRef}
      parseProgress={parseProgress}
      selectedLog={selectedLog}
      pendingSetup={pendingSetup}
      similarPastTickets={similarPastTickets}
      evidenceSet={evidenceSet}
      onCloseSelectedLog={() => setSelectedLogId(null)}
      onJumpToSelectedLog={() => {
        if (!selectedLog) return;
        setJumpState({ active: true, previousFilters: { activeCorrelations: [...activeCorrelations], filterText } });
        setActiveCorrelations(activeCorrelations.filter((correlation) => correlation.type === 'file'));
        setFilterText('');
        setScrollTargetTimestamp(selectedLog.timestamp);
      }}
      onSetupAI={() => setShowOnboardingWizard(true)}
      onSetupConsumed={() => setPendingSetup(null)}
      onCitationClick={handleCitationClick}
    />
  ), [filteredLogs.length, selectedLog, fileError, activeCorrelations, filterText,
      pendingSetup, similarPastTickets, setSelectedLogId, setJumpState, setActiveCorrelations,
      setFilterText, setScrollTargetTimestamp, parseProgress, handleCitationClick, evidenceSet]);

  // ── Submit Room ────────────────────────────────────────────────
  const submitContent = <SubmitRoom />;

  return (
    <>
      <CaseStateBridge />
      <RoomRouter
        phase={derivedPhase}
        onPhaseChange={handlePhaseChange}
        ticketId={activeTicket ? String(activeTicket.id) : undefined}
        priorityLabel={formatTicketLabel(activeTicket?.priority)}
        statusLabel={formatTicketLabel(activeTicket?.status)}
        headerActions={logs.length > 0 ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowImportDialog(true)} className="text-xs h-7 px-2">
              <FolderPlus size={14} className="mr-1" />
              Import
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExportModalOpen(true)} className="text-xs h-7 px-2">
              <Download size={14} className="mr-1" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleClearLogs()}
              className="text-xs h-7 px-2 text-[var(--destructive)] hover:text-[var(--destructive)]"
            >
              <Trash2 size={14} className="mr-1" />
              Clear
            </Button>
          </>
        ) : undefined}
        importContent={importContent}
        setupContent={setupContent}
        investigateContent={investigateContent}
        submitContent={submitContent}
      />

      {/* Modals */}
      {investigationModalTicketId && (
        <InvestigationSetupModal
          ticketId={investigationModalTicketId}
          onConfirm={(setup) => {
            setInvestigationModalTicketId(null);
            setActiveTicket(setup.ticket);
            setPendingSetup(setup);
            setExplicitPhase('investigate');
          }}
          onCancel={() => setInvestigationModalTicketId(null)}
        />
      )}

      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} title="Import Incident Data">
        <ImportRoom
          embedded
          onComplete={() => { setShowImportDialog(false); handleImportComplete(); }}
          onInvestigationReady={(id) => { setShowImportDialog(false); handleInvestigationReady(id); }}
        />
      </Dialog>

      <AIOnboardingWizard
        open={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        onComplete={() => setShowOnboardingWizard(false)}
      />

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </>
  );
}

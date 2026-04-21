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
import { WorkspaceCard } from './WorkspaceCard';
import { CARD_GRID_CLASSES } from './WorkspaceGrid';
import type { Phase } from './types';

// Existing components — reused as card content
import FilterBar from '../FilterBar';
import LogViewer, { type LogViewerHandle } from '../LogViewer';
import LogTimeline from '../timeline/LogTimeline';
import { AISidebar } from '../AISidebar';
import { WorkspaceImportPanel } from '../import/WorkspaceImportPanel';
import LogDetailsPanel from '../log/LogDetailsPanel';
import { CaseHeader } from '../case/CaseHeader';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
// ServerSettingsPanel — kept in codebase but removed from UI until backend plans are decided
// import ServerSettingsPanel from '../ServerSettingsPanel';
import InvestigationSetupModal from '../InvestigationSetupModal';
import { AIOnboardingWizard } from '../onboarding/AIOnboardingWizard';
import ExportModal from '../export/ExportModal';
import EvidencePanel from '../evidence/EvidencePanel';
import { SubmitRoom } from './SubmitRoom';

import { CaseStateBridge } from '../case/CaseStateBridge';
import { Sparkles, FileText, Bookmark, Clock, Search, Database, AlertTriangle, FolderPlus, Download, Trash2, ExternalLink } from 'lucide-react';
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
    ? filteredLogs.find((e) => e.id === selectedLogId) || logs.find((e) => e.id === selectedLogId)
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
    setExplicitPhase('investigate');
  }, []);

  const handleInvestigationReady = useCallback((ticketId: string) => {
    setActiveTicket(null);
    setInvestigationModalTicketId(ticketId);
  }, []);

  // ── Import Room ────────────────────────────────────────────────
  const importContent = useMemo(() => (
    <div className="w-full max-w-xl">
      <WorkspaceCard
        id="import"
        title="Import"
        icon={<FileText size={14} />}
        accentColor="var(--phase-dot-active)"
        collapsible={false}
      >
        <div className="p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1">Start an Investigation</h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Drop log files or enter a Zendesk ticket to begin. NocLense will parse, correlate, and prepare your workspace.
          </p>
          <WorkspaceImportPanel
            onComplete={handleImportComplete}
            onInvestigationReady={handleInvestigationReady}
          />
        </div>
      </WorkspaceCard>
    </div>
  ), [handleImportComplete, handleInvestigationReady]);

  // ── Investigate Room ───────────────────────────────────────────
  const investigateContent = useMemo(() => (
    <>
      {/* Log Stream card — spans 2 columns, 2 rows */}
      <WorkspaceCard
        id="log-stream"
        title="Log Stream"
        icon={<FileText size={14} />}
        accentColor="#76ce40"
        meta={<span>{filteredLogs.length.toLocaleString()} events</span>}
        className={CARD_GRID_CLASSES['log-stream']}
      >
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {fileError && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs border-b border-[var(--destructive)]/20 text-[var(--destructive)] shrink-0">
              <AlertTriangle size={14} />
              {fileError}
            </div>
          )}
          <CaseHeader />
          <div className="shrink-0 px-2 py-1 border-b border-[var(--border)] bg-[var(--card)]">
            <FilterBar />
          </div>
          <LogTimeline />
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <LogViewer ref={logViewerRef} parseProgress={parseProgress} />
          </div>
          {selectedLog && (
            <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] overflow-hidden" style={{ height: 300 }}>
              <LogDetailsPanel
                log={selectedLog}
                onClose={() => setSelectedLogId(null)}
                onJumpToLog={() => {
                  if (!selectedLog) return;
                  setJumpState({ active: true, previousFilters: { activeCorrelations: [...activeCorrelations], filterText } });
                  setActiveCorrelations(activeCorrelations.filter((c) => c.type === 'file'));
                  setFilterText('');
                  setScrollTargetTimestamp(selectedLog.timestamp);
                }}
              />
            </div>
          )}
        </div>
      </WorkspaceCard>

      {/* AI Assistant card */}
      <WorkspaceCard
        id="ai-assistant"
        title="AI Assistant"
        icon={<Sparkles size={14} />}
        accentColor="#76ce40"
        badge={
          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--success)]/10 text-[var(--success)]">
            Unleashed
          </span>
        }
        className={CARD_GRID_CLASSES['ai-assistant']}
      >
        <div className="h-full min-h-0 overflow-hidden">
          <AISidebar
            onSetupAI={() => setShowOnboardingWizard(true)}
            pendingSetup={pendingSetup}
            onSetupConsumed={() => setPendingSetup(null)}
            onCitationClick={handleCitationClick}
          />
        </div>
      </WorkspaceCard>

      {/* Evidence card */}
      <WorkspaceCard
        id="evidence"
        title="Evidence"
        icon={<Bookmark size={14} />}
        accentColor="#f59e0b"
        badge={
          <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[9px] font-semibold text-[var(--warning)]">
            {evidenceSet?.items.length ?? 0}
          </span>
        }
        className={CARD_GRID_CLASSES['evidence']}
      >
        <EvidencePanel />
      </WorkspaceCard>

      {/* Bottom row — compact cards */}
      <WorkspaceCard
        id="similar-tickets"
        title="Similar Tickets"
        icon={<Search size={14} />}
        accentColor="#60a5fa"
        defaultExpanded={similarPastTickets.length > 0}
        meta={similarPastTickets.length > 0 ? <span>{similarPastTickets.length} found</span> : undefined}
        className={CARD_GRID_CLASSES['similar-tickets']}
      >
        {similarPastTickets.length === 0 ? (
          <div className="p-3 text-xs text-[var(--muted-foreground)]">
            <p>Past resolved tickets matching this investigation will surface here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] max-h-[200px] overflow-y-auto">
            {similarPastTickets.map(t => {
              const subdomain = loadAiSettings().zendeskSubdomain;
              const zdUrl = subdomain
                ? `https://${subdomain}.zendesk.com/agent/tickets/${t.id}`
                : null;
              return (
                <div key={t.id} className="px-3 py-2 hover:bg-[var(--muted)]/50 transition-colors">
                  <p className="text-[11px] font-medium text-[var(--foreground)] truncate">
                    #{t.id}: {t.subject}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[var(--muted-foreground)]">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                    </span>
                    {t.tags.length > 0 && (
                      <span className="text-[9px] text-[var(--muted-foreground)]">
                        {t.tags.filter(tag => tag.startsWith('noc:')).slice(0, 2).join(', ') || t.tags.slice(0, 2).join(', ')}
                      </span>
                    )}
                    {zdUrl && (
                      <a
                        href={zdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 ml-auto"
                      >
                        <ExternalLink size={8} />
                        Open
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WorkspaceCard>

      <WorkspaceCard
        id="correlation-graph"
        title="Correlation Graph"
        icon={<Clock size={14} />}
        accentColor="#a78bfa"
        defaultExpanded={false}
        className={CARD_GRID_CLASSES['correlation-graph']}
      >
        <div className="p-3 text-xs text-[var(--muted-foreground)]">
          <p>Call-ID → extension → station → PBX entity tree visualization.</p>
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        id="datadog-live"
        title="Datadog Live"
        icon={<Database size={14} />}
        accentColor="#a855f7"
        defaultExpanded={false}
        className={CARD_GRID_CLASSES['datadog-live']}
      >
        <div className="p-3 text-xs text-[var(--muted-foreground)]">
          <p>Streaming production errors from Datadog API.</p>
        </div>
      </WorkspaceCard>
    </>
  ), [filteredLogs.length, selectedLog, fileError, activeCorrelations, filterText,
      pendingSetup, similarPastTickets, setSelectedLogId, setJumpState, setActiveCorrelations,
      setFilterText, setScrollTargetTimestamp, parseProgress, handleCitationClick, evidenceSet?.items.length]);

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
        <WorkspaceImportPanel
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

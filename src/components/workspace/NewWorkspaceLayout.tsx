/**
 * NewWorkspaceLayout — Phase 2 feature-flagged replacement for MainLayout.
 *
 * Uses RoomRouter with three rooms: Import, Investigate, Submit.
 * Wraps existing components (FilterBar, LogViewer, AiPanel, etc.)
 * inside WorkspaceCard containers in the Investigate room.
 *
 * Feature flag: localStorage key 'noclense-use-workspace-ui'
 */

import { useState, useCallback, useMemo } from 'react';
import { useLogContext } from '../../contexts/LogContext';
import { useAI } from '../../contexts/AIContext';
import { RoomRouter } from './RoomRouter';
import { WorkspaceCard } from './WorkspaceCard';
import { CARD_GRID_CLASSES } from './WorkspaceGrid';
import type { Phase } from './types';

// Existing components — reused as card content
import FilterBar from '../FilterBar';
import LogViewer from '../LogViewer';
import LogTimeline from '../timeline/LogTimeline';
import { AISidebar } from '../AISidebar';
import { WorkspaceImportPanel } from '../import/WorkspaceImportPanel';
import LogDetailsPanel from '../log/LogDetailsPanel';
import { CaseHeader } from '../case/CaseHeader';
import { Dialog } from '../ui/Dialog';
import ServerSettingsPanel from '../ServerSettingsPanel';
import InvestigationSetupModal from '../InvestigationSetupModal';
import { AIOnboardingWizard } from '../onboarding/AIOnboardingWizard';
import ExportModal from '../export/ExportModal';

import { Sparkles, FileText, Bookmark, Clock, Search, Database, AlertTriangle } from 'lucide-react';
import type { InvestigationSetup } from '../../types/investigation';

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
  } = useLogContext();
  useAI(); // Ensure AI context is available for child components

  // Phase state — derived from app state
  const [explicitPhase, setExplicitPhase] = useState<Phase | null>(null);
  const derivedPhase: Phase = explicitPhase ?? (logs.length === 0 ? 'import' : 'investigate');

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [investigationModalTicketId, setInvestigationModalTicketId] = useState<string | null>(null);
  const [pendingSetup, setPendingSetup] = useState<InvestigationSetup | null>(null);
  const [pendingZdTicketId, setPendingZdTicketId] = useState<string>('');
  const [fileError] = useState<string | null>(null);

  const selectedLog = selectedLogId
    ? filteredLogs.find((e) => e.id === selectedLogId) || logs.find((e) => e.id === selectedLogId)
    : null;

  // Phase dot navigation — user clicks a completed phase dot
  const handlePhaseChange = useCallback((next: Phase) => {
    setExplicitPhase(next);
  }, []);

  // When logs are loaded, auto-advance to investigate
  const handleImportComplete = useCallback(() => {
    setExplicitPhase('investigate');
  }, []);

  // ── Import Room ────────────────────────────────────────────────
  const importContent = useMemo(() => (
    <div className="w-full max-w-xl">
      <WorkspaceCard
        id="import"
        title="Import"
        icon={<FileText size={14} />}
        accentColor="var(--phase-dot-active)"
      >
        <div className="p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-1">Start an Investigation</h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Drop log files or enter a Zendesk ticket to begin. NocLense will parse, correlate, and prepare your workspace.
          </p>
          <WorkspaceImportPanel
            onComplete={handleImportComplete}
            onInvestigationReady={(id) => setInvestigationModalTicketId(id)}
          />
        </div>
      </WorkspaceCard>
    </div>
  ), [handleImportComplete]);

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
        <div className="flex flex-col h-full min-h-0">
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
            <LogViewer />
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
            pendingTicketId={pendingZdTicketId}
            onTicketHandled={() => setPendingZdTicketId('')}
            pendingSetup={pendingSetup}
            onSetupConsumed={() => setPendingSetup(null)}
          />
        </div>
      </WorkspaceCard>

      {/* Evidence card */}
      <WorkspaceCard
        id="evidence"
        title="Evidence"
        icon={<Bookmark size={14} />}
        accentColor="#f59e0b"
        className={CARD_GRID_CLASSES['evidence']}
      >
        <div className="p-3 text-xs text-[var(--muted-foreground)]">
          <p>Evidence bookmarks and internal notes will appear here during investigation.</p>
        </div>
      </WorkspaceCard>

      {/* Bottom row — compact cards */}
      <WorkspaceCard
        id="similar-tickets"
        title="Similar Tickets"
        icon={<Search size={14} />}
        accentColor="#60a5fa"
        defaultExpanded={false}
        className={CARD_GRID_CLASSES['similar-tickets']}
      >
        <div className="p-3 text-xs text-[var(--muted-foreground)]">
          <p>Past resolved tickets matching this investigation will surface here.</p>
        </div>
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
  ), [filteredLogs.length, selectedLog, selectedLogId, fileError, activeCorrelations, filterText,
      pendingZdTicketId, pendingSetup, setSelectedLogId, setJumpState, setActiveCorrelations,
      setFilterText, setScrollTargetTimestamp]);

  // ── Submit Room ────────────────────────────────────────────────
  const submitContent = useMemo(() => (
    <>
      <WorkspaceCard
        id="closure-note"
        title="Closure Note"
        icon={<FileText size={14} />}
        accentColor="#76ce40"
        className="w-[400px]"
      >
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            AI-generated closure note for the investigation. Edit before posting.
          </p>
          <textarea
            className="w-full min-h-[140px] bg-[var(--input)] border border-[var(--border)] rounded-[var(--radius-md)] p-3 text-xs text-[var(--foreground)] font-mono resize-none focus:outline-none focus:ring-[var(--ring-width)] focus:ring-[var(--ring)]"
            placeholder="Closure note will be generated by AI after investigation..."
            readOnly
          />
          <button
            className="w-full mt-3 h-9 rounded-[var(--radius-md)] bg-[var(--success)] text-white text-xs font-semibold hover:bg-[var(--success)]/90 transition-colors"
          >
            Post to Zendesk & Save to Confluence
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full mt-2 h-9 rounded-[var(--radius-md)] border border-[var(--border)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Download Evidence Pack
          </button>
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        id="evidence-summary"
        title="Evidence Summary"
        icon={<Bookmark size={14} />}
        accentColor="#f59e0b"
        className="w-[320px]"
      >
        <div className="p-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Bookmarked logs, similar tickets referenced, and internal notes from this investigation.
          </p>
          <div className="rounded-[var(--radius-md)] border border-[var(--success)]/20 bg-[var(--success)]/4 p-3 mt-4">
            <div className="text-[9px] font-semibold text-[var(--success)] uppercase tracking-wider mb-1">Learning Loop</div>
            <div className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">
              This investigation will be saved to Confluence and indexed for future ticket matching.
            </div>
          </div>
        </div>
      </WorkspaceCard>
    </>
  ), []);

  return (
    <>
      <RoomRouter
        phase={derivedPhase}
        onPhaseChange={handlePhaseChange}
        ticketId={pendingZdTicketId || undefined}
        onSettingsClick={() => setShowSettingsDialog(true)}
        importContent={importContent}
        investigateContent={investigateContent}
        submitContent={submitContent}
      />

      {/* Modals — same as old layout */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} title="Settings">
        <ServerSettingsPanel />
      </Dialog>

      {investigationModalTicketId && (
        <InvestigationSetupModal
          ticketId={investigationModalTicketId}
          onConfirm={(setup) => {
            setInvestigationModalTicketId(null);
            setPendingSetup(setup);
            setExplicitPhase('investigate');
          }}
          onCancel={() => setInvestigationModalTicketId(null)}
        />
      )}

      <AIOnboardingWizard
        open={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        onComplete={() => setShowOnboardingWizard(false)}
      />

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </>
  );
}

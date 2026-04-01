import { useEffect, useState } from 'react';
import { LogProvider, useLogContext } from './contexts/LogContext';
import { AIProvider, useAI } from './contexts/AIContext';
import { CaseProvider } from './store/caseContext';
import FilterBar from './components/FilterBar';
import LogViewer from './components/LogViewer';
import { AISidebar } from './components/AISidebar';
import ExportModal from './components/export/ExportModal';
import ChangelogDropdown from './components/ChangelogDropdown';
import { Download, AlertTriangle, ArrowLeft, ClipboardCopy, FolderPlus } from 'lucide-react';
import LogDetailsPanel from './components/log/LogDetailsPanel';
import { AppLayout } from './components/layout/AppLayout';
import type { PanelId } from './components/layout/IconRail';
import { useInvestigationPanels } from './components/layout/InvestigationPanels';
import { initTheme } from './utils/theme';
import { Button, Dialog, ToastProvider } from './components/ui';
import { AIOnboardingWizard } from './components/onboarding/AIOnboardingWizard';
import { ProductUpdateWizard } from './components/onboarding/ProductUpdateWizard';
import { WorkspaceImportPanel } from './components/import/WorkspaceImportPanel';
import { CaseHeader } from './components/case/CaseHeader';
import { CaseStateBridge } from './components/case/CaseStateBridge';
import InvestigationSetupModal from './components/InvestigationSetupModal';
import ServerSettingsPanel from './components/ServerSettingsPanel';
import LogTimeline from './components/timeline/LogTimeline';
import type { InvestigationSetup } from './types/investigation';
import { NewWorkspaceLayout } from './components/workspace/NewWorkspaceLayout';

const WORKSPACE_UI_FLAG = 'noclense-use-workspace-ui';
function useWorkspaceUI(): boolean {
  try {
    return localStorage.getItem(WORKSPACE_UI_FLAG) === 'true';
  } catch {
    return false;
  }
}

const PRODUCT_UPDATE_KEY = 'noclense-v2-product-update-seen';

function hasSeenProductUpdate(): boolean {
  try {
    return localStorage.getItem(PRODUCT_UPDATE_KEY) === 'true';
  } catch (error) {
    console.error('Failed to read product update onboarding state:', error);
    return false;
  }
}

function markProductUpdateSeen(): void {
  try {
    localStorage.setItem(PRODUCT_UPDATE_KEY, 'true');
  } catch (error) {
    console.error('Failed to save product update onboarding state:', error);
  }
}

const MainLayout = () => {
  const {
    logs,
    selectedLogId,
    filteredLogs,
    setSelectedLogId,
    setFilterText,
    activeCorrelations,
    setActiveCorrelations,
    jumpState,
    setJumpState,
    setScrollTargetTimestamp,
    filterText,
    clearAllData,
  } = useLogContext();
  const { onboardingCompleted } = useAI();

  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [showProductUpdateWizard, setShowProductUpdateWizard] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [pendingZdTicketId, setPendingZdTicketId] = useState<string>('');
  // Investigation setup modal
  const [investigationModalTicketId, setInvestigationModalTicketId] = useState<string | null>(null);
  const [pendingSetup, setPendingSetup] = useState<InvestigationSetup | null>(null);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (activePanel === 'ai' && !onboardingCompleted) {
      setShowOnboardingWizard(true);
    }
  }, [activePanel, onboardingCompleted]);

  useEffect(() => {
    if (hasSeenProductUpdate()) return;
    setShowProductUpdateWizard(true);
  }, []);

  const selectedLog = selectedLogId
    ? filteredLogs.find((entry) => entry.id === selectedLogId) || logs.find((entry) => entry.id === selectedLogId)
    : null;

  const handleClearLogs = async () => {
    await clearAllData();
    setSelectedLogId(null);
    setFileError(null);
    setFileWarning(null);
    setFilterText('');
  };

  const handleJumpToLog = () => {
    if (!selectedLog) return;
    setJumpState({
      active: true,
      previousFilters: {
        activeCorrelations: [...activeCorrelations],
        filterText,
      },
    });
    const fileFilters = activeCorrelations.filter((correlation) => correlation.type === 'file');
    setActiveCorrelations(fileFilters);
    setFilterText('');
    setScrollTargetTimestamp(selectedLog.timestamp);
  };

  const handleBackFromJump = () => {
    if (!jumpState.active || !jumpState.previousFilters) return;
    setActiveCorrelations(jumpState.previousFilters.activeCorrelations);
    setFilterText(jumpState.previousFilters.filterText);
    setJumpState({ active: false, previousFilters: null });
    setScrollTargetTimestamp(null);
  };

  const handleCopyLatestCrashReport = async () => {
    try {
      const result = await window.electronAPI?.getCrashReports?.({ limit: 1 });
      if (!result?.ok) {
        setFileError(result?.error || 'Failed to load crash reports.');
        return;
      }
      const latest = result.reports?.[0];
      if (!latest) {
        setFileWarning('No crash reports available yet.');
        return;
      }
      await navigator.clipboard.writeText(JSON.stringify(latest, null, 2));
      setFileWarning(`Copied latest crash report (${latest.reportId}) to clipboard.`);
      setFileError(null);
    } catch (error) {
      console.error('Failed to copy latest crash report:', error);
      setFileError('Failed to copy latest crash report.');
    }
  };

  const handleDismissProductUpdate = () => {
    markProductUpdateSeen();
    setShowProductUpdateWizard(false);
  };

  const panelContent = useInvestigationPanels({
    onSetupAI: () => {
      setShowOnboardingWizard(true);
      setActivePanel('ai');
    },
  });

  const headerContent = (
    <div className="flex items-center gap-2 w-full">
      <div className="ml-auto flex items-center gap-1 shrink-0">
        <ChangelogDropdown />
        <Button variant="ghost" onClick={() => setShowImportDialog(true)} className="text-xs h-7 px-2">
          <FolderPlus size={14} className="mr-1" />
          Import
        </Button>
        {logs.length > 0 && (
          <>
            <Button variant="ghost" onClick={() => setIsExportModalOpen(true)} className="text-xs h-7 px-2">
              <Download size={14} className="mr-1" />
              Export
            </Button>
            <Button variant="ghost" onClick={() => void handleCopyLatestCrashReport()} className="text-xs h-7 px-2">
              <ClipboardCopy size={13} className="mr-1" />
              Crash
            </Button>
            <Button
              variant="ghost"
              onClick={() => void handleClearLogs()}
              className="text-xs h-7 px-2 text-[var(--destructive)] hover:text-[var(--destructive)]"
            >
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AppLayout
        activePanel={activePanel}
        onActivePanelChange={setActivePanel}
        panelContent={panelContent}
        headerContent={headerContent}
        onSettingsClick={() => setShowSettingsDialog(true)}
        rightSidebar={
          <AISidebar
            onSetupAI={() => setShowOnboardingWizard(true)}
            pendingTicketId={pendingZdTicketId}
            onTicketHandled={() => setPendingZdTicketId('')}
            pendingSetup={pendingSetup}
            onSetupConsumed={() => setPendingSetup(null)}
          />
        }
      >
        <CaseStateBridge activePanel={activePanel} onActivePanelChange={setActivePanel} />

        {jumpState.active && (
          <div className="flex items-center px-3 py-1 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
            <Button variant="ghost" onClick={handleBackFromJump} className="text-xs text-[var(--warning)] h-7 px-2">
              <ArrowLeft size={14} className="mr-1" />
              Restore Filters
            </Button>
          </div>
        )}

        {fileError && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs border-b border-[var(--destructive)]/20 text-[var(--destructive)] shrink-0">
            <AlertTriangle size={14} />
            {fileError}
          </div>
        )}
        {fileWarning && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs border-b border-[var(--warning)]/20 text-[var(--warning)] shrink-0">
            <AlertTriangle size={14} />
            {fileWarning}
          </div>
        )}

        {logs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-[var(--workspace)]">
            <div className="max-w-3xl w-full border border-[var(--border)] bg-[var(--card)] px-5 py-5">
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">Import Incident Data</h2>
              <p className="text-xs text-[var(--muted-foreground)] mb-4">
                Start with exported files or pasted AWS console logs, then move straight into case building, evidence capture, and stakeholder handoff.
              </p>
              <WorkspaceImportPanel
                onInvestigationReady={(id) => setInvestigationModalTicketId(id)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CaseHeader />
            <div className="shrink-0 px-2 py-1 border-b border-[var(--border)] bg-[var(--card)]">
              <FilterBar />
            </div>

            <LogTimeline />

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <LogViewer />
            </div>

            {selectedLog && (
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] overflow-hidden" style={{ height: 360 }}>
                <LogDetailsPanel log={selectedLog} onClose={() => setSelectedLogId(null)} onJumpToLog={handleJumpToLog} />
              </div>
            )}
          </div>
        )}
      </AppLayout>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} title="Settings">
        <ServerSettingsPanel />
      </Dialog>

      {/* Investigation Setup Modal — shown when agent clicks "Investigate" from the Import screen */}
      {investigationModalTicketId && (
        <InvestigationSetupModal
          ticketId={investigationModalTicketId}
          onConfirm={(setup) => {
            setInvestigationModalTicketId(null);
            setPendingSetup(setup);
          }}
          onCancel={() => setInvestigationModalTicketId(null)}
        />
      )}

      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} title="Import Incident Data">
        <WorkspaceImportPanel
          onComplete={() => setShowImportDialog(false)}
          onInvestigationReady={(id) => { setInvestigationModalTicketId(id); setShowImportDialog(false); }}
        />
      </Dialog>

      <ProductUpdateWizard
        open={showProductUpdateWizard}
        onClose={handleDismissProductUpdate}
        onOpenCasePanel={() => setActivePanel('case')}
      />

      <AIOnboardingWizard
        open={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        onComplete={() => setShowOnboardingWizard(false)}
      />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </>
  );
};

function LayoutSwitch() {
  const isWorkspace = useWorkspaceUI();
  return isWorkspace ? <NewWorkspaceLayout /> : <MainLayout />;
}

const App = () => (
  <ToastProvider>
    <AIProvider>
      <CaseProvider>
        <LogProvider>
          <LayoutSwitch />
        </LogProvider>
      </CaseProvider>
    </AIProvider>
  </ToastProvider>
);

export default App;

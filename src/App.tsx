import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogProvider, useLogContext } from './contexts/LogContext';
import { AIProvider } from './contexts/AIContext';
import OnboardingGate from './components/OnboardingGate';
import { getOnboardingCompleted } from './components/OnboardingPage';
import FilterBar from './components/FilterBar';
import LogViewer from './components/LogViewer';
import CallFlowViewer from './components/CallFlowViewer';
import TimelineScrubber from './components/TimelineScrubber';
import CorrelationSidebar from './components/CorrelationSidebar';
import ExportModal from './components/export/ExportModal';
import ChangelogDropdown from './components/ChangelogDropdown';
import AIAssistantDropdown from './components/AIAssistantDropdown';
import SplashPage from './components/splash/SplashPage';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCopy,
  Download,
  Filter,
  Flame,
  FolderOpen,
  Moon,
  PanelRightOpen,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import LogDetailsPanel from './components/log/LogDetailsPanel';
import { parseLogFile } from './utils/parser';
import { validateFile } from './utils/fileUtils';
import type { LogEntry } from './types';
import clsx from 'clsx';

const AIAssistantPanel = lazy(() => import('./components/AIAssistantPanel'));
const AISettingsPanel = lazy(() => import('./components/AISettingsPanel'));
const CrashReportsPanel = lazy(() => import('./components/CrashReportsPanel'));

const MainLayout = () => {
  const {
    logs,
    setLogs,
    selectedLogId,
    filteredLogs,
    setSelectedLogId,
    setLoading,
    setFilterText,
    activeCallFlowId,
    setActiveCallFlowId,
    activeCorrelations,
    setActiveCorrelations,
    isSidebarOpen,
    setIsSidebarOpen,
    isTimelineOpen,
    setIsTimelineOpen,
    jumpState,
    setJumpState,
    setScrollTargetTimestamp,
    filterText,
    clearAllData,
    enableIndexedDBMode,
  } = useLogContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isCrashReportsOpen, setIsCrashReportsOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'none' | 'details' | 'ai'>('none');
  const [aiInitialQuery, setAiInitialQuery] = useState('');
  const [aiPanelKey, setAiPanelKey] = useState(0);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark' | 'red'>('dark');

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.body;
    root.classList.remove('dark', 'red-theme');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'red') {
      root.classList.add('red-theme');
    }
    // light is default (no class)
  }, [theme]);

  // Panel Sizes
  const [timelineHeight, setTimelineHeight] = useState(128);

  const selectedLog = useMemo(() => {
    if (!selectedLogId) {
      return null;
    }

    return filteredLogs.find(l => l.id === selectedLogId) || logs.find(l => l.id === selectedLogId) || null;
  }, [filteredLogs, logs, selectedLogId]);

  const isRightPanelVisible = rightPanelMode === 'ai' || (rightPanelMode === 'details' && !!selectedLog);

  const openAIPanel = useCallback((query?: string) => {
    if (typeof query === 'string') {
      setAiInitialQuery(query);
      setAiPanelKey(prev => prev + 1);
    }
    setRightPanelMode('ai');
  }, []);

  useEffect(() => {
    if (selectedLogId) {
      setRightPanelMode(prev => (prev === 'ai' ? 'ai' : 'details'));
      return;
    }

    setRightPanelMode(prev => (prev === 'details' ? 'none' : prev));
  }, [selectedLogId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTypingTarget) return;

      event.preventDefault();
      openAIPanel();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openAIPanel]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFileError(null);
    setFileWarning(null);

    // Validate all files first
    const filesArray = Array.from(files);
    const validationResults = filesArray.map(file => ({
      file,
      ...validateFile(file),
    }));

    const invalidFiles = validationResults.filter(r => !r.valid);
    if (invalidFiles.length > 0) {
      setFileError(`Invalid file type(s): ${invalidFiles.map(r => r.file.name).join(', ')}. Please upload text or log files.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const largeFiles = validationResults.filter(r => r.warning);
    if (largeFiles.length > 0) {
      setFileWarning(`Warning: ${largeFiles.map(r => r.file.name).join(', ')} are large (>50MB). Processing may take a moment.`);
    }

    setLoading(true);
    try {
      if (clearAllData) {
        await clearAllData();
      } else {
        setLogs([]);
      }

      setSelectedLogId(null);
      setActiveCallFlowId(null);
      setRightPanelMode('none');

      const allLogs: LogEntry[] = [];
      let nextStartId = 1;
      const shouldUseIndexedDB = validationResults.some(({ file }) => file.size > 50 * 1024 * 1024);
      for (const { file } of validationResults) {
        const parsed = await parseLogFile(file, '#3b82f6', nextStartId, undefined, shouldUseIndexedDB);
        if (Array.isArray(parsed)) {
          allLogs.push(...parsed);
          nextStartId += parsed.length;
          continue;
        }

        if (parsed && typeof parsed === 'object' && 'totalParsed' in parsed) {
          const totalParsed = typeof parsed.totalParsed === 'number' ? parsed.totalParsed : 0;
          nextStartId += totalParsed;
        }
      }

      if (shouldUseIndexedDB && enableIndexedDBMode) {
        await enableIndexedDBMode();
      } else {
        // Sort combined logs by timestamp
        allLogs.sort((a, b) => a.timestamp - b.timestamp);
        setLogs(allLogs);
      }
    } catch (err) {
      setFileError('Failed to process uploaded log files. Please verify file format and try again.');
      console.error(err);
    } finally {
      setLoading(false);
      // clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearLogs = async () => {
    try {
      // Use clearAllData to clear both in-memory and IndexedDB data
      if (clearAllData) {
        await clearAllData();
      } else {
        setLogs([]);
      }
    } catch (error) {
      // Fall back to in-memory clear so UI can continue even if persistent cleanup fails.
      setLogs([]);
      setFileWarning('Cleared in-memory logs, but background storage cleanup failed.');
      console.error('Failed to clear all data storage:', error);
    } finally {
      setSelectedLogId(null);
      setActiveCallFlowId(null);
      setFileError(null);
      setFilterText('');
      setRightPanelMode('none');
    }
  };

  const cycleTheme = () => {
    const modes: ('light' | 'dark' | 'red')[] = ['light', 'dark', 'red'];
    const next = modes[(modes.indexOf(theme) + 1) % modes.length];
    setTheme(next);
  };

  const handleJumpToLog = () => {
    if (!selectedLog) return;

    // Save state
    setJumpState({
      active: true,
      previousFilters: {
        activeCorrelations: [...activeCorrelations],
        filterText,
      },
    });

    // Clear filters (except file)
    const fileFilters = activeCorrelations.filter(c => c.type === 'file');
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

  /**
   * Copy most recent crash report to clipboard for quick support handoff.
   *
   * Why:
   * - Fastest path for users/operators to share latest failure context.
   * - Avoids opening the full crash panel for common triage workflows.
   */
  const handleCopyLatestCrashReport = async () => {
    try {
      const result = await window.electronAPI?.getCrashReports?.({ limit: 1 });
      if (!result?.ok) {
        setFileError('Failed to load crash reports.');
        if (result?.error) {
          console.error('Crash report retrieval error:', result.error);
        }
        return;
      }

      const latest = result.reports?.[0];
      if (!latest) {
        setFileWarning('No crash reports available yet.');
        return;
      }

      const redactedReport = JSON.stringify(
        latest,
        (key: string, value: unknown) => {
          if (/api|token|secret|password|authorization|key/i.test(key)) {
            return '[REDACTED]';
          }
          return value;
        },
        2
      );

      await navigator.clipboard.writeText(redactedReport);
      setFileWarning(`Copied latest crash report (${latest.reportId}) to clipboard.`);
      setFileError(null);
    } catch (error) {
      console.error('Failed to copy latest crash report:', error);
      setFileError('Failed to copy latest crash report.');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[var(--text-primary)]">
      <header
        className="shrink-0 h-16 px-4 md:px-6 flex items-center justify-between shadow-[var(--shadow)] z-50"
        style={{ backgroundColor: 'var(--primary-blue)', color: '#fff' }}
      >
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <h1 className="text-lg md:text-xl font-bold">NocLense</h1>
            <p className="text-xs text-blue-200/90">Log Analysis Workspace</p>
          </div>
          <ChangelogDropdown />

          {jumpState.active && (
            <div className="flex items-center animate-in fade-in slide-in-from-top-2 duration-300 ml-4">
              <button
                onClick={handleBackFromJump}
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500 text-white rounded shadow-sm hover:bg-yellow-400 transition-colors font-semibold text-xs animate-pulse"
              >
                <ArrowLeft size={14} />
                Restore Filters (Back)
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <AIAssistantDropdown
              onOpenAssistant={() => openAIPanel()}
              onOpenSettings={() => setIsAISettingsOpen(true)}
            />
            <button
              onClick={() => setIsCrashReportsOpen(true)}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-all text-sm font-semibold border border-red-300/30"
              title="Open Crash Reports"
            >
              Crash Reports
            </button>
            <button
              onClick={() => void handleCopyLatestCrashReport()}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold border border-white/10 inline-flex items-center gap-2"
              title="Copy latest crash report"
            >
              <ClipboardCopy size={14} />
              Copy Latest Crash
            </button>
          </div>

          {logs.length > 0 && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2 border border-white/10"
              title="Export logs"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2 border border-white/10"
          >
            <FolderOpen size={16} />
            <span className="hidden sm:inline">Open Log</span>
          </button>

          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="px-3 py-2 text-blue-200 hover:text-white hover:bg-red-500/20 hover:border-red-400/50 border border-transparent rounded-lg transition-all text-sm flex items-center gap-2"
            >
              <X size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            multiple
            accept=".log,.txt"
          />

          <div className="flex items-center bg-white/10 rounded-lg p-1 border border-white/20">
            <button
              onClick={cycleTheme}
              className="p-2 text-white hover:bg-white/10 rounded-md transition-all"
              title={`Current Theme: ${theme.toUpperCase()}`}
            >
              {theme === 'light' && <Sun size={18} />}
              {theme === 'dark' && <Moon size={18} />}
              {theme === 'red' && <Flame size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div
          className={clsx(
            'shrink-0 h-full border-r border-[var(--border-color)] bg-[var(--card-bg)] transition-all duration-200 ease-out',
            isSidebarOpen ? 'w-80' : 'w-16'
          )}
        >
          <div className="h-full flex">
            <div className="w-16 border-r border-[var(--border-color)] bg-[var(--bg-light)]/40 p-2 flex flex-col items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={clsx(
                  'w-11 h-11 rounded-lg border transition-colors flex items-center justify-center',
                  isSidebarOpen
                    ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                    : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/50'
                )}
                title="Toggle correlation filters"
              >
                <Filter size={18} />
              </button>
              <button
                onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                className={clsx(
                  'w-11 h-11 rounded-lg border transition-colors flex items-center justify-center',
                  isTimelineOpen
                    ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                    : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/50'
                )}
                title="Toggle timeline"
              >
                <Download size={18} className="-rotate-90" />
              </button>
              <button
                onClick={() => openAIPanel()}
                className={clsx(
                  'w-11 h-11 rounded-lg border transition-colors flex items-center justify-center',
                  rightPanelMode === 'ai'
                    ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                    : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/50'
                )}
                title="Open AI Assistant (Cmd/Ctrl + K)"
              >
                <Sparkles size={18} />
              </button>
              <button
                onClick={() => setIsAISettingsOpen(true)}
                className="w-11 h-11 rounded-lg border bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/50 transition-colors flex items-center justify-center"
                title="Open AI settings"
              >
                <PanelRightOpen size={18} />
              </button>
              <button
                onClick={() => setIsCrashReportsOpen(true)}
                className="w-11 h-11 rounded-lg border bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/50 transition-colors flex items-center justify-center"
                title="Open crash reports"
              >
                <AlertTriangle size={18} />
              </button>
            </div>
            <div
              className={clsx(
                'overflow-hidden transition-all duration-200 ease-out',
                isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
              )}
            >
              <CorrelationSidebar />
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-light)] relative">
            {logs.length > 0 && (
              <div className="shrink-0 p-4 pb-0 z-40 relative">
                <div className="bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow)] border border-[var(--border-color)] p-1">
                  <FilterBar />
                </div>
              </div>
            )}

            {(fileError || fileWarning) && (
              <div className="px-4 pt-4 shrink-0">
                {fileError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 mb-2">
                    <AlertTriangle size={18} />
                    {fileError}
                  </div>
                )}
                {fileWarning && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {fileWarning}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4 min-h-0">
              {logs.length === 0 ? (
                <div className="flex-1 min-h-0 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden">
                  <SplashPage
                    hasLogs={logs.length > 0}
                    onUploadClick={() => fileInputRef.current?.click()}
                    onPromptSelect={(prompt) => {
                      setAiInitialQuery(prompt);
                      setFileWarning('Upload logs to enable analysis');
                    }}
                    onSubmitPrompt={(prompt) => {
                      setAiInitialQuery(prompt);
                      setFileWarning('Upload logs to enable analysis');
                    }}
                  />
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden flex flex-col text-[var(--text-primary)]">
                    {activeCallFlowId ? (
                      <CallFlowViewer callId={activeCallFlowId} onClose={() => setActiveCallFlowId(null)} />
                    ) : (
                      <LogViewer />
                    )}
                  </div>

                  {isTimelineOpen && logs.length > 0 && (
                    <div
                      className="shrink-0 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow)] border border-[var(--border-color)] overflow-hidden relative flex flex-col"
                      style={{ height: timelineHeight }}
                    >
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5 bg-transparent hover:bg-[var(--accent-blue)] cursor-row-resize z-50 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startY = e.clientY;
                          const startH = timelineHeight;
                          const onMove = (mv: MouseEvent) => {
                            setTimelineHeight(Math.max(60, Math.min(600, startH + (startY - mv.clientY))));
                          };
                          const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                          };
                          document.addEventListener('mousemove', onMove);
                          document.addEventListener('mouseup', onUp);
                        }}
                      />
                      <TimelineScrubber height={timelineHeight} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className={clsx(
              'shrink-0 h-full border-l border-[var(--border-color)] bg-[var(--card-bg)] transition-all duration-200 ease-out transform overflow-hidden',
              isRightPanelVisible ? 'w-[420px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-2 pointer-events-none'
            )}
          >
            {rightPanelMode === 'ai' && (
              <div className="h-full min-w-[420px]">
                <Suspense fallback={<div className="h-full animate-pulse bg-[var(--bg-light)]" />}>
                  <AIAssistantPanel
                    key={aiPanelKey}
                    layoutMode="inline"
                    initialQuery={aiInitialQuery}
                    onClose={() => {
                      setRightPanelMode(selectedLog ? 'details' : 'none');
                    }}
                    logs={filteredLogs}
                    onOpenSettings={() => {
                      setIsAISettingsOpen(true);
                    }}
                  />
                </Suspense>
              </div>
            )}
            {rightPanelMode === 'details' && selectedLog && (
              <div className="h-full min-w-[420px] overflow-hidden">
                <LogDetailsPanel
                  log={selectedLog}
                  onClose={() => setSelectedLogId(null)}
                  onJumpToLog={handleJumpToLog}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />

      {isAISettingsOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl h-[85vh] bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden">
            <Suspense fallback={<div className="h-full animate-pulse bg-[var(--bg-light)]" />}>
              <AISettingsPanel onClose={() => setIsAISettingsOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}

      {isCrashReportsOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[85vh] bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden">
            <Suspense fallback={<div className="h-full animate-pulse bg-[var(--bg-light)]" />}>
              <CrashReportsPanel onClose={() => setIsCrashReportsOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const showOnboarding = !getOnboardingCompleted();
  const [, setRefresh] = useState(0);

  const handleOnboardingDone = useCallback(() => {
    setRefresh((r) => r + 1);
  }, []);

  if (showOnboarding) {
    return (
      <AIProvider>
        <OnboardingGate onDone={handleOnboardingDone} />
      </AIProvider>
    );
  }

  return (
    <AIProvider>
      <LogProvider>
        <MainLayout />
      </LogProvider>
    </AIProvider>
  );
};

export default App;

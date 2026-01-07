import { useRef, useState, useEffect } from 'react';
import { LogProvider, useLogContext } from './contexts/LogContext';
import FileUploader from './components/FileUploader';
import FilterBar from './components/FilterBar';
import LogViewer from './components/LogViewer';
import CallFlowViewer from './components/CallFlowViewer';
import TimelineScrubber from './components/TimelineScrubber';
import CorrelationSidebar from './components/CorrelationSidebar';
import ExportModal from './components/export/ExportModal';
import ChangelogDropdown from './components/ChangelogDropdown';
import { Download, FolderOpen, X, AlertTriangle, Filter, Moon, Sun, Flame, LocateFixed, ArrowLeft } from 'lucide-react';
import { parseLogFile } from './utils/parser';
import { validateFile } from './utils/fileUtils';
import clsx from 'clsx';

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
    toggleCorrelation,
    isSidebarOpen,
    setIsSidebarOpen,
    isTimelineOpen,
    setIsTimelineOpen,
    jumpState,
    setJumpState,
    setScrollTargetTimestamp,
    filterText
  } = useLogContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
  const [detailsHeight, setDetailsHeight] = useState(256);
  const [timelineHeight, setTimelineHeight] = useState(128);

  const selectedLog = selectedLogId ? filteredLogs.find(l => l.id === selectedLogId) || logs.find(l => l.id === selectedLogId) : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFileError(null);
    setFileWarning(null);

    // Validate all files first
    const filesArray = Array.from(files);
    const validationResults = filesArray.map(file => ({
      file,
      ...validateFile(file)
    }));

    const invalidFiles = validationResults.filter(r => !r.valid);
    if (invalidFiles.length > 0) {
      setFileError(`Invalid file type(s): ${invalidFiles.map(r => r.file.name).join(', ')}. Please upload text or log files.`);
      return;
    }

    const largeFiles = validationResults.filter(r => r.warning);
    if (largeFiles.length > 0) {
      setFileWarning(`Warning: ${largeFiles.map(r => r.file.name).join(', ')} are large (>50MB). Processing may take a moment.`);
    }

    setLoading(true);
    setLogs([]);
    setSelectedLogId(null);
    setActiveCallFlowId(null);

    try {
      const allLogs = [];
      for (const { file } of validationResults) {
        const parsed = await parseLogFile(file);
        allLogs.push(...parsed);
      }

      // Sort combined logs by timestamp
      allLogs.sort((a, b) => a.timestamp - b.timestamp);

      setLogs(allLogs);
    } catch (err) {
      setFileError('Failed to parse log file. Please check the format.');
      console.error(err);
    } finally {
      setLoading(false);
      // clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    setSelectedLogId(null);
    setActiveCallFlowId(null);
    setFileError(null);
    setFileWarning(null);
    setFilterText('');
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
        filterText
      }
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

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[var(--text-primary)]">
      {/* Header - Styled per NOC Tool */}
      <header className="shrink-0 h-16 px-6 flex items-center justify-between shadow-[var(--shadow)] z-50"
        style={{ backgroundColor: 'var(--primary-blue)', color: '#fff' }}>

        <div className="flex items-center gap-4">
          <img
            src="https://carbyne.com/wp-content/uploads/2024/12/carbyne-registered-logo.png"
            alt="Carbyne Logo"
            className="h-8 w-auto filter brightness-0 invert" /* Making white for blue bg */
          />
          <div>
            <h1 className="text-xl font-bold leading-tight">Incident Management Tool</h1>
            <p className="text-xs text-blue-200 opacity-90">NOC Incident Automation (Log Viewer)</p>
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

        <div className="flex items-center gap-4">
          {/* File Controls */}
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={clsx(
                "p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium",
                isSidebarOpen ? "bg-white/20 text-white" : "text-blue-100 hover:bg-white/10"
              )}
              title="Toggle Correlation Sidebar"
            >
              <Filter size={18} />
              <span className="opacity-90">Filters</span>
            </button>

            <button
              onClick={() => setIsTimelineOpen(!isTimelineOpen)}
              className={clsx(
                "p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium",
                isTimelineOpen ? "bg-white/20 text-white" : "text-blue-100 hover:bg-white/10"
              )}
              title="Toggle Timeline"
            >
              <Download size={18} className="-rotate-90" />
              <span className="opacity-90">Timeline</span>
            </button>

            {logs.length > 0 && (
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2 border border-white/10"
                title="Export logs"
              >
                <Download size={16} />
                Export
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2 border border-white/10"
            >
              <FolderOpen size={16} />
              Open Log
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="px-3 py-2 text-blue-200 hover:text-white hover:bg-red-500/20 hover:border-red-400/50 border border-transparent rounded-lg transition-all text-sm flex items-center gap-2"
              >
                <X size={16} />
                Clear
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
          </div>

          {/* Theme Toggle */}
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

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="shrink-0 z-10 h-full border-r border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shadow-lg)] transition-all duration-300">
            <CorrelationSidebar />
          </div>
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-light)] relative">

          {/* Filter Bar (Search) - Only show if logs exist or always? Usually always is fine but better if logs exist */}
          {logs.length > 0 && (
            <div className="shrink-0 p-4 pb-0 z-40 relative">
              <div className="bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow)] border border-[var(--border-color)] p-1">
                <FilterBar />
              </div>
            </div>
          )}

          {/* Error/Warning Banners */}
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

          {/* Viewers */}
          <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">

            {logs.length === 0 ? (
              /* EMPTY STATE - FILE UPLOADER */
              <div className="flex-1 flex items-center justify-center p-8 text-[var(--text-secondary)]">
                <div className="bg-[var(--card-bg)] p-8 rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border-color)] max-w-2xl w-full flex flex-col items-center">
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Upload Logs to Begin</h2>
                  <FileUploader />
                </div>
              </div>
            ) : (
              <>
                {/* Top: Call Flow (Conditional) OR Log List */}
                <div className="flex-1 min-h-0 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden flex flex-col text-[var(--text-primary)]">
                  {activeCallFlowId ? (
                    <CallFlowViewer callId={activeCallFlowId} onClose={() => setActiveCallFlowId(null)} />
                  ) : (
                    <LogViewer />
                  )}
                </div>

                {/* Decoupled Timeline */}
                {/* Decoupled Timeline */}
                {isTimelineOpen && logs.length > 0 && (
                  <div className="shrink-0 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow)] border border-[var(--border-color)] overflow-hidden relative flex flex-col" style={{ height: timelineHeight }}>
                    {/* Draggable Handle (Top) */}
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

                {/* Bottom: Details */}
                {selectedLog && (
                  <div className="shrink-0 flex flex-col" style={{ height: detailsHeight }}>
                    {/* Integrated Details Panel */}
                    <div className="flex-1 bg-[var(--card-bg)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden flex flex-col relative z-20">
                      {/* Draggable Handle */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 bg-[var(--border-color)] hover:bg-[var(--accent-blue)] cursor-row-resize z-50 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startY = e.clientY;
                          const startH = detailsHeight;
                          const onMove = (mv: MouseEvent) => {
                            setDetailsHeight(Math.max(150, startH + (startY - mv.clientY)));
                          };
                          const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                          };
                          document.addEventListener('mousemove', onMove);
                          document.addEventListener('mouseup', onUp);
                        }}
                      />

                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-light)]">
                        <span className="font-semibold text-sm text-[var(--text-primary)]">Details: Log #{selectedLog.id}</span>
                        <div className="flex items-center gap-2">
                          {selectedLog.callId && (
                            <>
                              <button
                                onClick={() => setActiveCallFlowId(selectedLog.callId!)}
                                className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                              >
                                <Download size={12} className="rotate-180" />
                                Flow
                              </button>
                              <button
                                onClick={() => {
                                  toggleCorrelation({ type: 'callId', value: selectedLog.callId! });
                                  setIsSidebarOpen(true);
                                }}
                                className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-[var(--border-color)] transition-colors border border-[var(--border-color)]"
                              >
                                <Filter size={12} />
                                Filter
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedLogId(null)}
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--bg-light)]"
                          >
                            Close
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleJumpToLog}
                            className="flex items-center gap-1 text-xs bg-[var(--bg-light)] text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--accent-blue)] hover:text-white transition-colors border border-[var(--border-color)]"
                            title="Jump to this log in main view (clears filters temporarily)"
                          >
                            <LocateFixed size={12} />
                            Jump To
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 overflow-auto font-mono text-xs text-[var(--text-primary)] h-full">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
                          <div><span className="text-[var(--text-secondary)]">Time:</span> {selectedLog.rawTimestamp}</div>
                          <div><span className="text-[var(--text-secondary)]">Component:</span> {selectedLog.component}</div>
                          <div className="col-span-2 flex gap-2">
                            <span className="text-[var(--text-secondary)] shrink-0">Message:</span>
                            <span>{selectedLog.message}</span>
                          </div>
                          {selectedLog.reportId && <div><span className="text-[var(--text-secondary)]">Report ID:</span> <span className="text-blue-500">{selectedLog.reportId}</span></div>}
                          {selectedLog.operatorId && <div><span className="text-[var(--text-secondary)]">Operator ID:</span> <span className="text-purple-500">{selectedLog.operatorId}</span></div>}
                          {selectedLog.callId && <div><span className="text-[var(--text-secondary)]">Call ID:</span> <span className="text-yellow-500">{selectedLog.callId}</span></div>}
                        </div>

                        <div className="bg-[var(--bg-light)] p-3 rounded border border-[var(--border-color)] mt-2 overflow-auto max-h-60">
                          {selectedLog.type === 'JSON' ? (
                            <pre>{JSON.stringify(selectedLog.json, null, 2)}</pre>
                          ) : (
                            <pre className="whitespace-pre-wrap">{selectedLog.payload}</pre>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
};

const App = () => (
  <LogProvider>
    <MainLayout />
  </LogProvider>
);

export default App;

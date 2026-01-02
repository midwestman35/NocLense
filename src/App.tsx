import { useRef, useState } from 'react';
import { LogProvider, useLogContext } from './contexts/LogContext';
import FileUploader from './components/FileUploader';
import FilterBar from './components/FilterBar';
import LogViewer from './components/LogViewer';
import CallFlowViewer from './components/CallFlowViewer';
import TimelineScrubber from './components/TimelineScrubber';
import CorrelationSidebar from './components/CorrelationSidebar';
import ExportModal from './components/export/ExportModal';
import { Download, FolderOpen, X, AlertTriangle, Filter } from 'lucide-react';
import { parseLogFile } from './utils/parser';
import { validateFile } from './utils/fileUtils';

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
    toggleCorrelation, // New
    isSidebarOpen, // New
    setIsSidebarOpen // New
  } = useLogContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Panel Sizes
  const [detailsHeight, setDetailsHeight] = useState(256);
  const [timelineHeight, setTimelineHeight] = useState(64);


  const selectedLog = selectedLogId ? filteredLogs.find(l => l.id === selectedLogId) || logs.find(l => l.id === selectedLogId) : null;

  // ... (handleFileUpload and handleClearLogs remain same) ...
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFileError(null);
    setFileWarning(null);

    // Validate all files first
    const filesArray = Array.from(files);
    const validationResults = filesArray.map(file => ({
      file,
      validation: validateFile(file)
    }));

    // Check for validation errors
    const errors = validationResults.filter(r => !r.validation.valid);
    if (errors.length > 0) {
      setFileError(errors[0].validation.error || 'Invalid file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Collect warnings
    const warnings = validationResults
      .map(r => r.validation.warning)
      .filter((w): w is string => !!w);

    if (warnings.length > 0) {
      setFileWarning(warnings[0]); // Show first warning
    }

    setLoading(true);
    try {
      // Process all files
      const allParsedLogs = [];
      let maxId = Math.max(0, ...logs.map(l => l.id)); // Get max ID from existing logs

      // File colors (Tailwind-ish palette)
      const FILE_COLORS = [
        '#3b82f6', // blue-500
        '#eab308', // yellow-500
        '#a855f7', // purple-500
        '#ec4899', // pink-500
        '#22c55e', // green-500
        '#f97316', // orange-500
        '#06b6d4', // cyan-500
        '#64748b', // slate-500
      ];

      for (let i = 0; i < validationResults.length; i++) {
        const { file } = validationResults[i];
        const color = FILE_COLORS[i % FILE_COLORS.length];
        const parsed = await parseLogFile(file, color, maxId);
        allParsedLogs.push(...parsed);
        maxId = Math.max(maxId, ...parsed.map(l => l.id));
      }

      // Merge with existing logs (append mode)
      setLogs([...logs, ...allParsedLogs]);
      setSelectedLogId(null);
    } catch (err) {
      console.error("Failed to parse", err);
      setFileError(`Failed to parse file${files.length > 1 ? 's' : ''}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Clear warnings after 5 seconds
      if (fileWarning) {
        setTimeout(() => setFileWarning(null), 5000);
      }
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    setSelectedLogId(null);
    setFilterText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center px-4 bg-slate-800 border-b border-slate-700 justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-md transition-colors ${isSidebarOpen ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
          >
            <Filter size={20} />
          </button>

          {logs.length > 0 && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="p-1.5 bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
              title="Export logs"
            >
              <Download size={20} className="text-white" />
            </button>
          )}
          <h1 className="font-bold text-lg tracking-tight">LogScrub</h1>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".log,.txt"
            multiple
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-sm bg-slate-700 px-3 py-1.5 rounded-md hover:bg-blue-600 hover:text-white transition-colors border border-slate-600"
            title="Open one or more log files"
          >
            <FolderOpen size={16} />
            Open File{logs.length > 0 ? '(s)' : ''}
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 text-sm bg-slate-700 px-3 py-1.5 rounded-md hover:bg-red-600 hover:text-white transition-colors border border-slate-600"
              title="Clear all logs"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Error/Warning Messages */}
      {(fileError || fileWarning) && (
        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
          {fileError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle size={16} />
              <span>{fileError}</span>
              <button
                onClick={() => setFileError(null)}
                className="ml-auto text-red-500 hover:text-red-300"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {fileWarning && !fileError && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <AlertTriangle size={16} />
              <span>{fileWarning}</span>
              <button
                onClick={() => setFileWarning(null)}
                className="ml-auto text-yellow-500 hover:text-yellow-300"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {logs.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <FileUploader />
        </div>
      ) : (
        <>
          <FilterBar />

          <div className="flex-grow flex overflow-hidden relative">
            {isSidebarOpen && <CorrelationSidebar />}
            <div className="flex-grow flex flex-col overflow-hidden relative min-w-0">
              <div className="flex-grow relative min-h-0">
                <LogViewer />
              </div>

              {/* Details Panel */}
              {selectedLog && (
                <>
                  <div
                    className="h-1 bg-slate-700 hover:bg-blue-500 cursor-row-resize z-30 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startY = e.clientY;
                      const startH = detailsHeight;
                      const onMove = (mv: MouseEvent) => {
                        setDetailsHeight(Math.max(100, startH + (startY - mv.clientY)));
                      };
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                      };
                      document.addEventListener('mousemove', onMove);
                      document.addEventListener('mouseup', onUp);
                    }}
                  />
                  <div style={{ height: detailsHeight }} className="bg-slate-800 flex flex-col shrink-0 overflow-hidden shadow-2xl z-20 transition-all">
                    <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-b border-slate-700">
                      <span className="font-semibold text-sm text-slate-300">Details: Log #{selectedLog.id}</span>
                      <div className="flex items-center gap-2">
                        {selectedLog.callId && (
                          <>
                            <button
                              onClick={() => {
                                console.log("Setting activeCallFlowId to:", selectedLog.callId);
                                setActiveCallFlowId(selectedLog.callId!);
                              }}
                              className="flex items-center gap-1 text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/40 transition-colors border border-blue-500/30"
                              title="View Call Flow Diagram"
                            >
                              <Download size={12} className="rotate-180" />
                              Flow
                            </button>
                            <button
                              onClick={() => {
                                toggleCorrelation({ type: 'callId', value: selectedLog.callId! });
                                setIsSidebarOpen(true); // Ensure sidebar is visible to see the selection works
                              }}
                              className="flex items-center gap-1 text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors border border-slate-600"
                              title="Add Call ID to Filter"
                            >
                              <Filter size={12} />
                              Filter
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedLogId(null)}
                          className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="p-4 overflow-auto font-mono text-xs text-slate-300 h-full">
                      <div className="mb-2"><span className="text-slate-500">Time:</span> {selectedLog.rawTimestamp}</div>
                      <div className="mb-2"><span className="text-slate-500">Component:</span> {selectedLog.component}</div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-slate-500">Message:</span>
                        {selectedLog.message}
                      </div>
                      {selectedLog.reportId && <div className="mb-1"><span className="text-slate-500">Report ID:</span> <span className="text-blue-400">{selectedLog.reportId}</span></div>}
                      {selectedLog.operatorId && <div className="mb-1"><span className="text-slate-500">Operator ID:</span> <span className="text-purple-400">{selectedLog.operatorId}</span></div>}
                      {selectedLog.extensionId && <div className="mb-1"><span className="text-slate-500">Extension:</span> <span className="text-green-400">{selectedLog.extensionId}</span></div>}
                      {selectedLog.callId && <div className="mb-1"><span className="text-slate-500">Call ID:</span> <span className="text-yellow-400">{selectedLog.callId}</span></div>}

                      <div className="bg-black/30 p-2 rounded border border-slate-700 mt-2">
                        {selectedLog.type === 'JSON' ? (
                          <pre>{JSON.stringify(selectedLog.json, null, 2)}</pre>
                        ) : (
                          <pre className="whitespace-pre-wrap">{selectedLog.payload}</pre>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Timeline Resize Handle */}
              <div
                className="h-1 bg-slate-700 hover:bg-blue-500 cursor-row-resize z-30 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startH = timelineHeight;
                  const onMove = (mv: MouseEvent) => {
                    setTimelineHeight(Math.max(40, startH + (startY - mv.clientY)));
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
          </div>
        </>
      )}
      {activeCallFlowId && (
        <CallFlowViewer
          callId={activeCallFlowId}
          onClose={() => setActiveCallFlowId(null)}
        />
      )}
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
};

function App() {
  return (
    <LogProvider>
      <MainLayout />
    </LogProvider>
  );
}

export default App;

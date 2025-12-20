import { useRef } from 'react';
import { LogProvider, useLogContext } from './contexts/LogContext';
import FileUploader from './components/FileUploader';
import FilterBar from './components/FilterBar';
import LogViewer from './components/LogViewer';
import TimelineScrubber from './components/TimelineScrubber';
import { Download, FolderOpen } from 'lucide-react';
import { parseLogFile } from './utils/parser';

const MainLayout = () => {
  const { logs, setLogs, selectedLogId, filteredLogs, setSelectedLogId, setLoading } = useLogContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLog = selectedLogId ? filteredLogs.find(l => l.id === selectedLogId) || logs.find(l => l.id === selectedLogId) : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const parsed = await parseLogFile(file);
      setLogs(parsed);
      setSelectedLogId(null);
    } catch (err) {
      console.error("Failed to parse", err);
      // alert("Failed to parse log file.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center px-4 bg-slate-800 border-b border-slate-700 justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500 rounded-md">
            <Download size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">LogScrub</h1>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".log,.txt"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-sm bg-slate-700 px-3 py-1.5 rounded-md hover:bg-blue-600 hover:text-white transition-colors border border-slate-600"
          >
            <FolderOpen size={16} />
            Open File
          </button>
        </div>
      </header>

      {/* Content */}
      {logs.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <FileUploader />
        </div>
      ) : (
        <>
          <FilterBar />

          <div className="flex-grow flex flex-col overflow-hidden relative">
            <div className="flex-grow relative min-h-0">
              <LogViewer />
            </div>

            {/* Details Panel */}
            {selectedLog && (
              <div className="h-64 bg-slate-800 border-t border-slate-700 flex flex-col shrink-0 overflow-hidden shadow-2xl z-20 transition-all">
                <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-b border-slate-700">
                  <span className="font-semibold text-sm text-slate-300">Details: Log #{selectedLog.id}</span>
                  <button
                    onClick={() => setSelectedLogId(null)}
                    className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
                <div className="p-4 overflow-auto font-mono text-xs text-slate-300">
                  <div className="mb-2"><span className="text-slate-500">Time:</span> {selectedLog.rawTimestamp}</div>
                  <div className="mb-2"><span className="text-slate-500">Component:</span> {selectedLog.component}</div>
                  <div className="mb-2"><span className="text-slate-500">Message:</span> {selectedLog.message}</div>
                  <div className="bg-black/30 p-2 rounded border border-slate-700">
                    {selectedLog.type === 'JSON' ? (
                      <pre>{JSON.stringify(selectedLog.json, null, 2)}</pre>
                    ) : (
                      <pre className="whitespace-pre-wrap">{selectedLog.payload}</pre>
                    )}
                  </div>
                </div>
              </div>
            )}

            <TimelineScrubber />
          </div>
        </>
      )}
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

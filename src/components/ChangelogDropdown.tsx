import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  features?: string[];
  fixes?: string[];
  changes?: string[];
}

// Latest changelog entries - update this when new features are added
const changelogEntries: ChangelogEntry[] = [
  {
    version: '1.5.0',
    date: '2026-01-20',
    features: [
      '💾 IndexedDB Storage - Large files (>50MB) automatically stored in browser IndexedDB for persistent, memory-efficient access',
      '🚀 Automatic Mode Detection - Seamlessly switches between in-memory (small files) and IndexedDB (large files) modes',
      '🔍 IndexedDB Filtering - All filters (component, SIP, correlation, text search) work with IndexedDB-stored logs',
      '📊 Lazy Loading - Only loads visible/filtered logs into memory, dramatically reducing memory usage',
      '⚡ Efficient Querying - IndexedDB indexes enable fast filtering by timestamp, component, callId, and more',
      '🔄 Backward Compatible - Small files continue to use fast in-memory processing',
      '📈 Scalability - Support for files of any size without browser crashes (tested with 740MB+ files)'
    ],
    fixes: [
      '🔧 Fixed memory exhaustion for very large files - logs now stored in IndexedDB instead of React state',
      '⚡ Optimized correlation data computation for IndexedDB mode',
      '🎯 Improved initial load performance for large datasets'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-01-20',
    features: [
      '🚀 Streaming Parser - Process large files (740MB+) without Chrome crashes by parsing in 2MB chunks',
      '💾 Memory Optimization - Reduced memory usage by ~99% during parsing (from ~1.5GB+ to ~50-100MB)',
      '📊 Memory Estimation - See estimated memory usage before processing large files',
      '⚠️ Enhanced Warnings - Progressive warnings for files >50MB, >200MB, and >500MB with memory estimates',
      '✅ Confirmation Dialog - Requires confirmation before processing files >500MB to prevent crashes'
    ],
    fixes: [
      '🔧 Fixed Chrome "out of memory" crashes when processing large log files',
      '⚡ Optimized array operations for large datasets to prevent stack overflow errors'
    ]
  },
  {
    version: '1.3.2',
    date: '2026-01-20',
    features: [
      '🔍 SIP Filter Dropdown - Dynamic dropdown for filtering by specific SIP methods/codes when Homer logs are loaded',
      '🎯 Intelligent Method Extraction - Automatically detects and lists all unique SIP response codes and request methods from Homer logs',
      '✨ Normalized Response Codes - Duplicate variants (e.g., "100 trying" variations) are normalized to single entries for cleaner filtering'
    ]
  },
  {
    version: '1.3.1',
    date: '2026-01-20',
    fixes: [
      '⏰ Fixed timestamp parsing with milliseconds - Logs with comma-separated milliseconds (e.g., "5:04:57 AM,388") now display correct timestamps instead of file upload time'
    ]
  },
  {
    version: '1.3.0',
    date: '2025-01-18',
    features: [
      '📞 Homer SIP Export Support - Import and parse SIP call text files exported from Homer',
      '🔍 Automatic Format Detection - Automatically detects Homer export format by proto: header pattern',
      '⏰ Timestamp Extraction - Extracts accurate timestamps from Homer export headers',
      '📡 SIP Message Parsing - Each SIP message parsed as separate log entry with full payload',
      '🎯 Call-ID Extraction - Automatic extraction of Call-IDs and SIP methods from Homer logs'
    ]
  },
  {
    version: '1.2.1',
    date: '2025-01-15',
    fixes: [
      '🔧 Fixed Call-ID filter mismatch - Call-ID filters now correctly catch all entries with matching Call-IDs',
      '⏰ Improved timestamp parsing - Timestamps are now extracted from message content when timezone info is available for better accuracy',
      '🎯 Enhanced Call-ID extraction - Support for more Call-ID formats and improved whitespace handling'
    ]
  },
  {
    version: '1.2.0',
    date: '2025-01-15',
    features: [
      '⭐ Favorites feature - Star logs to mark them as favorites',
      '📥 Export functionality - Export logs in JSONL or CSV format',
      '🔍 Show Favorites Only filter - Filter logs to show only favorited entries',
      '📊 Export favorites option - Export only your favorited logs',
      '💾 LocalStorage persistence - Favorites are saved across sessions',
      '📈 Vercel Analytics integration - Track usage analytics'
    ],
    fixes: [
      'Fixed export button positioning in header',
      'Improved favorites star icon placement for better visibility'
    ]
  },
  {
    version: '1.1.0',
    date: '2025-12-31',
    features: [
      'Multiple file selection support',
      'File merging with automatic chronological sorting',
      'ID conflict resolution when merging files',
      'File size validation and warnings',
      'Append mode for adding new files to existing logs'
    ]
  }
];

const ChangelogDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors group"
        title="View changelog"
      >
        <h1 className="font-bold text-lg tracking-tight">LogScrub</h1>
        <ChevronDown 
          size={16} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-750">
              <div>
                <h2 className="font-semibold text-slate-200">Changelog</h2>
                <p className="text-xs text-slate-400 mt-0.5">Latest updates and features</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {changelogEntries.map((entry, index) => (
                <div
                  key={entry.version}
                  className={`px-4 py-3 ${index !== changelogEntries.length - 1 ? 'border-b border-slate-700' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-blue-400">v{entry.version}</span>
                    <span className="text-xs text-slate-500">{entry.date}</span>
                    {index === 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">
                        Latest
                      </span>
                    )}
                  </div>

                  {entry.features && entry.features.length > 0 && (
                    <div className="mb-2">
                      <h3 className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Features
                      </h3>
                      <ul className="space-y-1">
                        {entry.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-slate-500 mt-0.5">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.fixes && entry.fixes.length > 0 && (
                    <div className="mb-2">
                      <h3 className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Fixes
                      </h3>
                      <ul className="space-y-1">
                        {entry.fixes.map((fix, idx) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-slate-500 mt-0.5">•</span>
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {entry.changes && entry.changes.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Changes
                      </h3>
                      <ul className="space-y-1">
                        {entry.changes.map((change, idx) => (
                          <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-slate-500 mt-0.5">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChangelogDropdown;

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Sparkles, Wrench, RefreshCw, X } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  date: string;
  features?: string[];
  fixes?: string[];
  changes?: string[];
}

const changelogEntries: ChangelogEntry[] = [
  {
    version: '2.1.0',
    date: '2026-03-29',
    features: [
      'Unleashed AI is now the default provider with Summary, Anomalies, Chat, Auto-tag, and Ticket workflows in one panel.',
      'Zendesk ticket lookup can pull ticket details into the AI workflow for direct log-to-ticket analysis.',
      'AI settings now support Unleash and Zendesk credentials with local overrides on top of environment defaults.',
    ],
    changes: [
      'Replaced the modal AI assistant flow with an inline results panel for faster follow-up questions against the current log set.',
      'Updated onboarding and welcome copy to match the team-managed Unleashed AI setup.',
    ],
    fixes: [
      'Aligned the new Unleash chat flows with the existing chat message contract so the branch builds again.',
      'Restored AI button gating when AI is disabled or no provider token is configured.',
      'Brought the new provider usage tracking back into the shared stats interface used by the rest of the AI stack.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-03-08',
    features: [
      'Case-centered investigation workspace with an active case panel, persistent case header, and saved working state.',
      'Structured evidence workflow in the details drawer with case-linked notes, tags, and citation support.',
      'Unified import flow for .log, .txt, and .csv plus paste-first intake for AWS Console and CloudWatch logs.',
      'Dataset provenance tracking across imported files and pasted log batches for stronger evidence traceability.',
      'Evidence Pack export with report, case context, events, follow-up queries, and provenance bundled into a single archive.',
      'Operational shell refinement with denser surfaces, quieter gradients, and a more durable long-session layout.',
      'AI onboarding flow and setup path integrated into the current shell without blocking core investigation work.',
    ],
    changes: [
      'Refined the application around incident intake, correlation, evidence capture, and stakeholder handoff instead of raw log browsing alone.',
      'Relabeled the OpenAI provider in the UI as ChatGPT (OpenAI) while keeping internal compatibility intact.',
      'Shifted dark mode to the green-house accent family with #51912b as the primary accent signal.',
      'Added restrained gradient treatments to the header, changelog surfaces, left rail, left panels, and right sidebar.',
      'Deprecated the legacy call-flow workflow from the active product path and removed the unused Flow action from the details bar.',
    ],
    fixes: [
      'Fixed empty icon-rail hover tooltips by correcting tooltip placement for the vertical rail layout.',
      'Fixed the changelog dropdown being clipped by the header after the shell styling pass.',
      'Fixed the changelog dropdown overlapping the AI sidebar by making it end-aligned and width-aware.',
      'Cleaned up corrupted changelog text rendering and normalized the menu copy hierarchy.',
      'Resolved shell regressions while preserving the existing investigation skeleton and workflows.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-02-07',
    features: [
      'AI Assistant chat for log analysis (Cmd/Ctrl+K).',
      'AI Settings for provider, key, model, and usage limits.',
      'Analyze Visible Logs for one-click review of the filtered window.',
      'Explain with AI from the log details panel.',
      'Correlation analysis from sidebar pivots like Call-ID and Report ID.',
      'Smart prompts for error analysis, pattern recognition, and timeline review.',
      'Gemini 3 support with migration away from deprecated models.',
    ],
    changes: [
      'More resilient API error handling for key, rate-limit, and model failures.',
      'Improved empty-state behavior when AI actions are unavailable.',
    ],
    fixes: [
      'Resolved deprecated-model 404 behavior by defaulting to Gemini 3.',
      'Handled malformed AI responses more gracefully.',
      'Added retry with exponential backoff for transient network failures.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-02-05',
    features: [
      'Dedicated SIP column with color-coded methods and response codes.',
      'Individual file removal without clearing the full workspace.',
      'Message truncation for cleaner dense log scans.',
      'Case-insensitive level parsing and broader level alias support.',
      'JSON level extraction for payload-driven severity detection.',
      'SIP error classification that treats 4xx as warn and 5xx/6xx as error.',
    ],
    changes: [
      'Refined the list into a 6-column layout for faster scanning.',
      'Reduced visual noise around compact correlation identifiers.',
    ],
    fixes: [
      'Improved Homer SIP error detection from response codes.',
      'Fixed level filtering for lowercase and alias-based log formats.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-01-29',
    fixes: [
      'Fixed a race condition that could clear newly uploaded logs.',
      'Corrected LogContext hook and declaration ordering issues.',
      'Added bootstrap error handling around service mapping startup.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-01-29',
    changes: ['Wrap text is now the default log-reading mode.'],
  },
  {
    version: '1.5.0',
    date: '2026-01-20',
    features: [
      'IndexedDB storage for large files above 50 MB.',
      'Automatic switching between memory and IndexedDB modes.',
      'IndexedDB-backed filtering for text, SIP, and correlation workflows.',
      'Lazy loading for better memory usage on large datasets.',
      'IndexedDB indexing for faster queries.',
      'Backward compatibility for smaller files.',
      'Support for extremely large datasets without browser crashes.',
    ],
    fixes: [
      'Resolved memory exhaustion for very large files.',
      'Optimized correlation computation for IndexedDB mode.',
      'Improved initial load performance on large datasets.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-01-20',
    features: [
      'Streaming parser for very large files.',
      'Major memory reduction during parsing.',
      'Memory estimation before processing large inputs.',
      'Progressive warnings for large files.',
      'Confirmation step for especially large files.',
    ],
    fixes: [
      'Fixed out-of-memory crashes during large-file processing.',
      'Optimized array work to avoid stack overflow conditions.',
    ],
  },
  {
    version: '1.3.2',
    date: '2026-01-20',
    features: [
      'Dynamic SIP filter dropdown for Homer logs.',
      'Smarter extraction and normalization of SIP methods and response codes.',
    ],
  },
  {
    version: '1.3.1',
    date: '2026-01-20',
    fixes: ['Fixed timestamp parsing for comma-separated milliseconds.'],
  },
  {
    version: '1.3.0',
    date: '2025-01-18',
    features: [
      'Homer SIP export support.',
      'Automatic format detection from proto headers.',
      'Timestamp extraction from exported content.',
      'Per-message SIP parsing with payload retention.',
      'Call-ID extraction from Homer logs.',
    ],
  },
  {
    version: '1.2.1',
    date: '2025-01-15',
    fixes: [
      'Improved Call-ID filter coverage.',
      'Improved timestamp parsing with timezone-aware extraction.',
      'Expanded Call-ID extraction for additional formats.',
    ],
  },
  {
    version: '1.2.0',
    date: '2025-01-15',
    features: [
      'Favorites for marking notable logs.',
      'Export in JSONL or CSV.',
      'Show Favorites Only filtering.',
      'Export favorites only.',
      'Local persistence for favorites.',
      'Vercel analytics integration.',
    ],
    fixes: [
      'Fixed export button positioning in the header.',
      'Improved favorite star visibility.',
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-31',
    features: [
      'Multiple file selection.',
      'Chronological file merging.',
      'ID conflict resolution during merges.',
      'File size validation and warnings.',
      'Append mode for adding logs to an existing session.',
    ],
  },
];

interface EntrySectionProps {
  title: string;
  items: string[];
  icon: typeof Sparkles;
}

function EntrySection({ title, items, icon: Icon }: EntrySectionProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        <Icon size={12} />
        <span>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex min-w-0 items-start gap-2 text-sm text-[var(--foreground)]">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green-house-300)]" />
            <span className="min-w-0 flex-1 break-words leading-5 whitespace-normal">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ChangelogDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] px-2.5 text-[13px] font-semibold text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors hover:bg-[var(--button-subtle-hover)]"
        title="View changelog"
      >
        <span>LogScrub</span>
        <ChevronDown size={15} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="fixed z-50 flex max-h-[min(42rem,calc(100vh-5rem))] flex-col overflow-hidden rounded-[14px] border border-[var(--button-subtle-border)] shadow-[var(--shadow-md)] backdrop-blur-md"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              backgroundImage: 'var(--menu-surface)',
              width: 'min(38rem, max(24rem, calc(100vw - var(--ai-sidebar-width) - 2.5rem)))',
              maxWidth: 'calc(100vw - var(--ai-sidebar-width) - 2.5rem)',
            }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--menu-highlight)' }} />

            <div
              className="relative flex items-start justify-between border-b border-[var(--border)] px-4 py-3"
              style={{ backgroundImage: 'var(--panel-header-surface)' }}
            >
              <div className="min-w-0 pr-3">
                <h2 className="font-semibold text-[var(--foreground)]">Changelog</h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Latest updates and features</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--muted-foreground)] transition-colors hover:border-[var(--button-subtle-border)] hover:bg-[var(--button-subtle-surface)] hover:text-[var(--foreground)]"
                aria-label="Close changelog"
              >
                <X size={15} />
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto">
              {changelogEntries.map((entry, index) => (
                <section
                  key={entry.version}
                  className={`space-y-3 px-4 py-3 ${index !== changelogEntries.length - 1 ? 'border-b border-[var(--border)]' : ''}`}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-[var(--green-house-100)]">v{entry.version}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">{entry.date}</span>
                    {index === 0 ? (
                      <span className="rounded-md border border-[var(--button-subtle-border)] bg-[var(--menu-item-hover)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--green-house-50)]">
                        Latest
                      </span>
                    ) : null}
                  </div>

                  {entry.features?.length ? <EntrySection title="Features" items={entry.features} icon={Sparkles} /> : null}
                  {entry.fixes?.length ? <EntrySection title="Fixes" items={entry.fixes} icon={Wrench} /> : null}
                  {entry.changes?.length ? <EntrySection title="Changes" items={entry.changes} icon={RefreshCw} /> : null}
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChangelogDropdown;

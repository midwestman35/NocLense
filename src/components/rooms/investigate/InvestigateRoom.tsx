import { useState, type JSX, type Ref } from 'react';
import { Bookmark, Database, ExternalLink, FileText, Search, Sparkles } from 'lucide-react';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import { SimilarCasesSection } from '../../workspace/SimilarCasesSection';
import { Badge } from '../../ui';
import { AISidebar } from '../../AISidebar';
import EvidencePanel from '../../evidence/EvidencePanel';
import { CorrelationGraph } from '../../correlation-graph/CorrelationGraph';
import type { LogViewerHandle } from '../../LogViewer';
import type { LogEntry } from '../../../types';
import type { CitationId, EvidenceSet } from '../../../types/canonical';
import type { SimilarPastTicket } from '../../../types/diagnosis';
import type { InvestigationSetup } from '../../../types/investigation';
import { loadAiSettings } from '../../../store/aiSettings';
import { useBundleSizePulse } from '../../../hooks/useBundleSizePulse';
import { DatadogLiveCard } from './DatadogLiveCard';
import { LogStreamPanel } from './LogStreamPanel';

interface InvestigateRoomProps {
  filteredLogCount: number;
  fileError: string | null;
  logViewerRef: Ref<LogViewerHandle>;
  parseProgress: number | null;
  selectedLog: LogEntry | null;
  pendingSetup: InvestigationSetup | null;
  similarPastTickets: SimilarPastTicket[];
  evidenceSet: EvidenceSet | null;
  onCloseSelectedLog: () => void;
  onJumpToSelectedLog: () => void;
  onSetupAI: () => void;
  onSetupConsumed: () => void;
  onCitationClick: (citationId: CitationId) => void;
}

function EvidenceBadge({ evidenceSet }: { evidenceSet: EvidenceSet | null }): JSX.Element {
  const { pulseKey } = useBundleSizePulse(evidenceSet);
  return (
    <span
      key={pulseKey}
      className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--warning)] motion-safe:animate-[bundle-pulse_300ms_var(--ease-enter-out,ease-out)_both]"
    >
      {evidenceSet?.items.length ?? 0}
    </span>
  );
}

export function InvestigateRoom({
  filteredLogCount,
  fileError,
  logViewerRef,
  parseProgress,
  selectedLog,
  pendingSetup,
  similarPastTickets,
  evidenceSet,
  onCloseSelectedLog,
  onJumpToSelectedLog,
  onSetupAI,
  onSetupConsumed,
  onCitationClick,
}: InvestigateRoomProps): JSX.Element {
  const [similarCaseCount, setSimilarCaseCount] = useState(0);

  return (
    <>
      <WorkspaceCard
        id="log-stream"
        title="Log Stream"
        icon={<FileText size={14} />}
        accentColor="#76ce40"
        meta={<span>{filteredLogCount.toLocaleString()} events</span>}
        className={CARD_GRID_CLASSES['log-stream']}
      >
        <LogStreamPanel
          fileError={fileError}
          logViewerRef={logViewerRef}
          parseProgress={parseProgress}
          selectedLog={selectedLog}
          onCloseSelectedLog={onCloseSelectedLog}
          onJumpToSelectedLog={onJumpToSelectedLog}
        />
      </WorkspaceCard>

      <WorkspaceCard
        id="ai-assistant"
        title="AI Assistant"
        icon={<Sparkles size={14} />}
        accentColor="#76ce40"
        badge={<Badge variant="level-info">Unleashed</Badge>}
        className={CARD_GRID_CLASSES['ai-assistant']}
      >
        <div className="h-full min-h-0 overflow-hidden">
          <AISidebar
            onSetupAI={onSetupAI}
            pendingSetup={pendingSetup}
            onSetupConsumed={onSetupConsumed}
            onCitationClick={onCitationClick}
          />
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        id="evidence"
        title="Evidence"
        icon={<Bookmark size={14} />}
        accentColor="#f59e0b"
        badge={<EvidenceBadge evidenceSet={evidenceSet} />}
        className={CARD_GRID_CLASSES['evidence']}
      >
        <EvidencePanel />
      </WorkspaceCard>

      <WorkspaceCard
        id="similar-tickets"
        title="Similar"
        icon={<Search size={14} />}
        accentColor="#60a5fa"
        defaultExpanded={similarPastTickets.length > 0}
        meta={<span>{similarPastTickets.length} tickets {similarCaseCount} cases</span>}
        className={CARD_GRID_CLASSES['similar-tickets']}
      >
        <div className="divide-y divide-[var(--border)]">
          <section className="space-y-2 p-3" aria-labelledby="similar-past-tickets-heading">
            <h3 id="similar-past-tickets-heading" className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Past tickets
            </h3>

            {similarPastTickets.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Past resolved tickets matching this investigation will surface here.
              </p>
            ) : (
              <div className="max-h-[200px] divide-y divide-[var(--border)] overflow-y-auto">
                {similarPastTickets.map((ticket) => {
                  const subdomain = loadAiSettings().zendeskSubdomain;
                  const zendeskUrl = subdomain
                    ? `https://${subdomain}.zendesk.com/agent/tickets/${ticket.id}`
                    : null;
                  return (
                    <div key={ticket.id} className="px-3 py-2 transition-colors hover:bg-[var(--muted)]/50">
                      <p className="truncate text-[11px] font-medium text-[var(--foreground)]">
                        #{ticket.id}: {ticket.subject}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[9px] text-[var(--muted-foreground)]">
                          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}
                        </span>
                        {ticket.tags.length > 0 && (
                          <span className="text-[9px] text-[var(--muted-foreground)]">
                            {ticket.tags.filter((tag) => tag.startsWith('noc:')).slice(0, 2).join(', ') || ticket.tags.slice(0, 2).join(', ')}
                          </span>
                        )}
                        {zendeskUrl && (
                          <a
                            href={zendeskUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-0.5 text-[9px] text-blue-400 hover:text-blue-300"
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
          </section>

          <section className="space-y-2 p-3" aria-labelledby="similar-past-cases-heading">
            <h3 id="similar-past-cases-heading" className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Past cases
            </h3>
            <SimilarCasesSection onCountChange={setSimilarCaseCount} />
          </section>
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        id="correlation-graph"
        title="Correlation Graph"
        icon={<Database size={14} />}
        accentColor="var(--correlation-call-id)"
        defaultExpanded={false}
        className={CARD_GRID_CLASSES['correlation-graph']}
      >
        <CorrelationGraph />
      </WorkspaceCard>

      <DatadogLiveCard />
    </>
  );
}

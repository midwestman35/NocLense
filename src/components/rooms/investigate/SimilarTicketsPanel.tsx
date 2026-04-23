import { useState, type JSX } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { WorkspaceCard } from '../../workspace/WorkspaceCard';
import { CARD_GRID_CLASSES } from '../../workspace/WorkspaceGrid';
import { SimilarCasesSection } from '../../workspace/SimilarCasesSection';
import { loadAiSettings } from '../../../store/aiSettings';
import type { SimilarPastTicket } from '../../../types/diagnosis';

interface SimilarTicketsPanelProps {
  similarPastTickets: SimilarPastTicket[];
}

function formatTicketTags(tags: string[]): string {
  return tags.filter((tag) => tag.startsWith('noc:')).slice(0, 2).join(', ') || tags.slice(0, 2).join(', ');
}

export function SimilarTicketsPanel({ similarPastTickets }: SimilarTicketsPanelProps): JSX.Element {
  const [similarCaseCount, setSimilarCaseCount] = useState(0);

  return (
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
                          {formatTicketTags(ticket.tags)}
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
  );
}

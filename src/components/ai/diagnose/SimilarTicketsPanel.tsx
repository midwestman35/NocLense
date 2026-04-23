/**
 * SimilarTicketsPanel.tsx
 *
 * Collapsible panel shown in Phase 2 that displays past closed Zendesk tickets
 * matching the current investigation's root cause, components, and error patterns.
 * Clicking a ticket fetches its full closure note on-demand.
 */
import { useState, useCallback } from 'react';
import { ChevronDown, Search, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { SimilarPastTicket } from '../../../types/diagnosis';
import type { AiSettings } from '../../../store/aiSettings';
import { fetchZendeskTicket } from '../../../services/zendeskService';
import Spinner from '../../ui/Spinner';

interface SimilarTicketsPanelProps {
  tickets: SimilarPastTicket[];
  settings: AiSettings;
  /** Called when a closure note is fetched so parent can persist it on the result */
  onClosureNoteFetched?: (ticketId: number, note: string) => void;
}

export default function SimilarTicketsPanel({ tickets, settings, onClosureNoteFetched }: SimilarTicketsPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [closureNotes, setClosureNotes] = useState<Map<number, string>>(new Map());
  const [collapsed, setCollapsed] = useState(false);

  const handleExpand = useCallback(async (ticketId: number) => {
    if (expandedId === ticketId) {
      setExpandedId(null);
      return;
    }

    // If we already fetched this ticket's closure note, just expand
    if (closureNotes.has(ticketId)) {
      setExpandedId(ticketId);
      return;
    }

    // Fetch the full ticket to get comments (closure note)
    setLoadingId(ticketId);
    setExpandedId(ticketId);
    try {
      const ticket = await fetchZendeskTicket(settings, String(ticketId));
      // Last comment is typically the closure note
      const note = ticket.comments.length > 0
        ? ticket.comments[ticket.comments.length - 1]
        : 'No closure note found.';
      setClosureNotes(prev => new Map([...prev, [ticketId, note]]));
      onClosureNoteFetched?.(ticketId, note);
    } catch {
      setClosureNotes(prev => new Map([...prev, [ticketId, 'Failed to load closure note.']]));
    } finally {
      setLoadingId(null);
    }
  }, [expandedId, closureNotes, settings, onClosureNoteFetched]);

  if (tickets.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
        style={{
          borderTop: '1px solid var(--border)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          backgroundColor: 'var(--muted)',
        }}
      >
        <Search size={10} className="text-violet shrink-0" />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em] flex-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Similar Past Tickets ({tickets.length})
        </span>
        <ChevronDown
          size={11}
          className={clsx('shrink-0 transition-transform', collapsed && '-rotate-90')}
          style={{ color: 'var(--muted-foreground)' }}
        />
      </button>

      {!collapsed && (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {tickets.map(t => (
            <div key={t.id}>
              {/* Ticket summary row */}
              <div
                className="px-3 py-2 cursor-pointer hover:bg-[var(--muted)]/50 transition-colors"
                onClick={() => void handleExpand(t.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                      #{t.id}: {t.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                      {t.tags.length > 0 && (
                        <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                          {t.tags.filter(tag => tag.startsWith('noc:')).slice(0, 3).join(', ') || t.tags.slice(0, 2).join(', ')}
                        </span>
                      )}
                      {settings.zendeskSubdomain && (
                        <a
                          href={`https://${settings.zendeskSubdomain}.zendesk.com/agent/tickets/${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-[9px] text-violet hover:text-ink-0"
                        >
                          <ExternalLink size={8} />
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {loadingId === t.id && <Spinner size="xs" className="text-violet" label="Loading" />}
                    <ChevronDown
                      size={11}
                      className={clsx('transition-transform', expandedId === t.id ? 'rotate-180' : '')}
                      style={{ color: 'var(--muted-foreground)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded closure note */}
              {expandedId === t.id && (
                <div
                  className="px-3 py-2 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
                >
                  {loadingId === t.id ? (
                    <p className="text-[10px] italic" style={{ color: 'var(--muted-foreground)' }}>
                      Loading closure note...
                    </p>
                  ) : (
                    <div
                      className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-words overflow-auto"
                      style={{ color: 'var(--foreground)', maxHeight: 200 }}
                    >
                      {closureNotes.get(t.id) ?? t.closureNote ?? 'No closure note available.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

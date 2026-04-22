import { useState, useCallback } from 'react';
import { Search, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import { loadAiSettings } from '../../store/aiSettings';
import {
  fetchZendeskTicket,
  formatTicketForAi,
  type ZendeskTicket,
} from '../../services/zendeskService';
import { analyzeTicket } from '../../services/unleashService';
import { useLogContext } from '../../contexts/LogContext';
import Spinner from '../ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  open: 'var(--destructive)',
  pending: 'var(--warning)',
  solved: 'var(--success)',
  closed: 'var(--muted-foreground)',
  new: 'var(--info)',
};

export function ZendeskPanel() {
  const { filteredLogs, logs } = useLogContext();
  const activeLogs = filteredLogs.length > 0 ? filteredLogs : logs;

  const [query, setQuery] = useState('');
  const [fetching, setFetching] = useState(false);
  const [ticket, setTicket] = useState<ZendeskTicket | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const settings = loadAiSettings();
  const hasZendesk = !!(settings.zendeskSubdomain && settings.zendeskToken);
  const hasLogs = activeLogs.length > 0;

  const handleFetch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setFetching(true);
    setFetchError(null);
    setTicket(null);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const result = await fetchZendeskTicket(settings, q);
      setTicket(result);
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setFetching(false);
    }
  }, [query, settings]);

  const handleAnalyze = useCallback(async () => {
    if (!ticket) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const ticketText = formatTicketForAi(ticket);
      const result = await analyzeTicket(settings, ticketText, activeLogs);
      setAnalysis(result);
    } catch (e: any) {
      setAnalysisError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }, [ticket, settings, activeLogs]);

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Search bar */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleFetch(); }}
            placeholder="Ticket # or URL..."
            disabled={fetching}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
              backgroundColor: 'var(--input)', border: '1px solid var(--border)',
              color: 'var(--foreground)', outline: 'none',
            }}
          />
          <button
            onClick={() => void handleFetch()}
            disabled={!query.trim() || fetching || !hasZendesk}
            style={{
              padding: '6px 10px', borderRadius: '6px', border: 'none',
              backgroundColor: query.trim() && !fetching && hasZendesk ? 'var(--success)' : 'var(--muted)',
              color: query.trim() && !fetching && hasZendesk ? '#fff' : 'var(--muted-foreground)',
              cursor: query.trim() && !fetching && hasZendesk ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {fetching ? <Spinner size="sm" label="Searching" /> : <Search size={14} />}
          </button>
        </div>

        {!hasZendesk && (
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginTop: '5px' }}>
            Configure Zendesk credentials in AI Settings (gear icon on right panel).
          </p>
        )}
        {fetchError && (
          <div style={{ marginTop: '6px', display: 'flex', gap: '5px', alignItems: 'flex-start', fontSize: '11px', color: 'var(--destructive)' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{fetchError}</span>
          </div>
        )}
      </div>

      {/* Ticket card */}
      {ticket && (
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            borderRadius: '8px', border: '1px solid var(--border)',
            backgroundColor: 'var(--card)', overflow: 'hidden',
          }}>
            {/* Ticket header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: '600' }}>
                  #{ticket.id}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                  color: STATUS_COLORS[ticket.status] ?? 'var(--muted-foreground)',
                }}>
                  {ticket.status}
                </span>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground)', marginTop: '4px', lineHeight: '1.4' }}>
                {ticket.subject}
              </p>
            </div>

            {/* Ticket fields */}
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Field label="Requester" value={`${ticket.requesterName}${ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : ''}`} />
              {ticket.priority && <Field label="Priority" value={ticket.priority} />}
              <Field label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
              {ticket.tags.length > 0 && (
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tags</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                    {ticket.tags.map(tag => (
                      <span key={tag} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ticket.description && (
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</span>
                  <p style={{ fontSize: '11px', color: 'var(--foreground)', marginTop: '3px', lineHeight: '1.5', maxHeight: '80px', overflow: 'auto' }}>
                    {ticket.description.slice(0, 400)}{ticket.description.length > 400 ? '…' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Open in Zendesk link */}
            {settings.zendeskSubdomain && (
              <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)' }}>
                <a
                  href={`https://${settings.zendeskSubdomain}.zendesk.com/agent/tickets/${ticket.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                >
                  <ExternalLink size={11} /> Open in Zendesk
                </a>
              </div>
            )}
          </div>

          {/* Analyze button */}
          <button
            onClick={() => void handleAnalyze()}
            disabled={!hasLogs || analyzing}
            title={!hasLogs ? 'Load logs first to analyze' : ''}
            style={{
              width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)',
              cursor: !hasLogs || analyzing ? 'not-allowed' : 'pointer',
              backgroundColor: !hasLogs || analyzing ? 'var(--muted)' : 'var(--success)',
              color: !hasLogs || analyzing ? 'var(--muted-foreground)' : '#fff',
              fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            {analyzing
              ? <><Spinner size="md" label="Analyzing" /> Analyzing... (15–30 sec)</>
              : <><Sparkles size={13} /> Analyze Against Loaded Logs</>
            }
          </button>

          {!hasLogs && (
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', textAlign: 'center' }}>Load a log file to enable AI analysis</p>
          )}

          {analysisError && (
            <div style={{ fontSize: '11px', color: 'var(--destructive)', backgroundColor: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.25)' }}>
              {analysisError}
            </div>
          )}

          {analysis && (
            <div style={{
              fontSize: '11px', lineHeight: '1.6', color: 'var(--foreground)',
              backgroundColor: 'var(--muted)', borderRadius: '8px', padding: '10px 12px',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border)',
            }}>
              {analysis}
            </div>
          )}
        </div>
      )}

      {!ticket && !fetching && !fetchError && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <Search size={24} style={{ color: 'var(--muted-foreground)', marginBottom: '10px' }} />
          <p style={{ fontSize: '12px', color: 'var(--foreground)', marginBottom: '4px' }}>Zendesk Ticket Lookup</p>
          <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.5' }}>
            Enter a ticket number to pull up details and cross-reference with loaded logs.
          </p>
        </div>
      )}

    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <p style={{ fontSize: '11px', color: 'var(--foreground)', marginTop: '2px' }}>{value}</p>
    </div>
  );
}

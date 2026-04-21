/**
 * DiagnosePhase1.tsx
 *
 * Phase 1 of the NOC Diagnosis workflow.
 * Handles ticket input (fetch existing / create new / skip),
 * timezone confirmation, and triggers the AI scan.
 *
 * Props:
 *   settings         — AiSettings (Zendesk + AI credentials)
 *   logCount         — number of loaded log events
 *   initialTicketId  — ticket # arriving from the Import screen (auto-fetched on mount)
 *   onScanReady      — called with ticket (or null) + confirmed timezone when ready to scan
 */
import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Plus, SkipForward, Stethoscope, Database, ChevronDown, ChevronRight, FileText, Download, CheckCircle2 } from 'lucide-react';
import type { AiSettings } from '../../../store/aiSettings';
import {
  fetchZendeskTicket,
  createZendeskTicket,
  downloadZendeskAttachment,
  type ZendeskTicket,
  type ZendeskAttachment,
} from '../../../services/zendeskService';
import type { DatadogEnrichmentOptions } from '../../../services/datadogService';
import { useLogContext } from '../../../contexts/LogContext';
import { importFiles, appendLogsToIndexedDB } from '../../../services/importService';
import { isZipFile, extractLogFilesFromZip } from '../../../utils/zipExtractor';
import InvestigateUrlEntry from './InvestigateUrlEntry';
import { TIMEZONE_OPTIONS } from './timezoneOptions';

// Common timezones: display label → value sent to AI prompt

type TicketMode = 'existing' | 'create' | 'skip';

interface Props {
  settings: AiSettings;
  logCount: number;
  /** First and last log timestamp — used to pre-fill Datadog window */
  logTimeRange?: { start: number; end: number };
  /** Ticket # arriving from the Import screen — auto-fetched on mount */
  initialTicketId?: string;
  /** Called once the initialTicketId has been consumed so parent can clear it */
  onTicketConsumed?: () => void;
  onScanReady: (ticket: ZendeskTicket | null, customerTimezone: string, ddOpts: DatadogEnrichmentOptions) => void;
  useInvestigateUrlEntry?: boolean;
}

const INPUT = 'w-full rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]';
const LABEL = 'block text-[11px] font-medium text-[var(--muted-foreground)] mb-1';

export default function DiagnosePhase1({
  settings,
  logCount,
  logTimeRange,
  initialTicketId,
  onTicketConsumed,
  onScanReady,
  useInvestigateUrlEntry = false,
}: Props) {
  const { logs, setLogs, setLoading, setParsingProgress, useIndexedDBMode, enableIndexedDBMode, addImportedDatasets } = useLogContext();

  const [mode, setMode] = useState<TicketMode>('existing');

  // Existing mode state
  const [ticketIdInput, setTicketIdInput] = useState('');
  const [fetchedTicket, setFetchedTicket] = useState<ZendeskTicket | null>(null);
  const [zdFetching, setZdFetching] = useState(false);
  const [zdError, setZdError] = useState<string | null>(null);

  // Attachment loading state
  const [loadingAttId, setLoadingAttId] = useState<number | null>(null);
  const [loadedAttIds, setLoadedAttIds] = useState<Set<number>>(new Set());
  const [attErrors, setAttErrors] = useState<Map<number, string>>(new Map());

  // Create mode state
  const [createSubject, setCreateSubject] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Timezone — pre-fill from fetched ticket, allow override
  const [timezone, setTimezone] = useState<string>('Eastern Time (US & Canada)');

  // ── Datadog Enrichment state ──────────────────────────────────────────────
  const hasDdCreds = !!(settings.datadogApiKey && settings.datadogAppKey);
  const [ddOpen, setDdOpen] = useState(hasDdCreds);
  const [ddEnabled, setDdEnabled] = useState(hasDdCreds);
  const [ddExpandBefore, setDdExpandBefore] = useState(0);  // minutes to expand before log start
  const [ddExpandAfter, setDdExpandAfter] = useState(0);    // minutes to expand after log end
  const [ddFilter, setDdFilter] = useState('');
  const [ddHosts, setDdHosts] = useState(settings.datadogDefaultHosts ?? '');
  const [ddIndexes, setDdIndexes] = useState(settings.datadogDefaultIndexes ?? '');

  // Auto-suggest filter query from ticket
  const ddSuggestedFilter = useMemo(() => {
    if (!fetchedTicket) return '';
    const parts: string[] = [];
    if (fetchedTicket.orgName) parts.push(`@org:"${fetchedTicket.orgName}"`);
    if (fetchedTicket.tags?.length) parts.push(`service:${fetchedTicket.tags[0]}`);
    return parts.join(' ');
  }, [fetchedTicket]);

  useEffect(() => {
    if (ddSuggestedFilter && !ddFilter) setDdFilter(ddSuggestedFilter);
  }, [ddSuggestedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const ddFromMs = (logTimeRange?.start ?? Date.now() - 60 * 60 * 1000) - ddExpandBefore * 60 * 1000;
  const ddToMs   = (logTimeRange?.end   ?? Date.now()) + ddExpandAfter * 60 * 1000;

  // Auto-fetch ticket from Import screen when initialTicketId is provided
  useEffect(() => {
    if (!initialTicketId || fetchedTicket) return;
    const id = initialTicketId.trim().replace(/\D/g, '');
    if (!id) return;
    setTicketIdInput(id);
    setMode('existing');
    setZdFetching(true);
    setZdError(null);
    fetchZendeskTicket(settings, id)
      .then(t => {
        setFetchedTicket(t);
        applyTicketTimezone(t);
        onTicketConsumed?.();
      })
      .catch((e: unknown) => {
        setZdError(e instanceof Error ? e.message : String(e));
        onTicketConsumed?.(); // clear pending even on error so it doesn't retry
      })
      .finally(() => setZdFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicketId]);

  // Update timezone when ticket is fetched
  function applyTicketTimezone(t: ZendeskTicket) {
    const tz = t.requesterTimezone ?? t.orgTimezone;
    if (tz) setTimezone(tz);
  }

  async function doFetchTicket(nextTicketId?: string) {
    const id = (nextTicketId ?? ticketIdInput).trim().replace(/\D/g, '');
    if (!id) return;
    setTicketIdInput(id);
    setZdFetching(true);
    setZdError(null);
    setFetchedTicket(null);
    try {
      const t = await fetchZendeskTicket(settings, id);
      setFetchedTicket(t);
      applyTicketTimezone(t);
    } catch (e: unknown) {
      setZdError(e instanceof Error ? e.message : String(e));
    } finally {
      setZdFetching(false);
    }
  }

  async function doCreateTicket() {
    if (!createSubject.trim() || !createDescription.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const t = await createZendeskTicket(settings, {
        subject: createSubject.trim(),
        description: createDescription.trim(),
        requesterEmail: createEmail.trim() || undefined,
      });
      setFetchedTicket(t);
      applyTicketTimezone(t);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleLoadAttachment(att: ZendeskAttachment) {
    setLoadingAttId(att.id);
    setAttErrors(prev => { const m = new Map(prev); m.delete(att.id); return m; });

    try {
      const blob = await downloadZendeskAttachment(settings, att);

      // Unzip if needed — extract all .log/.txt/.csv files inside
      let filesToImport: File[];
      if (isZipFile(att.fileName, att.contentType)) {
        filesToImport = await extractLogFilesFromZip(blob, att.fileName);
        if (filesToImport.length === 0) {
          throw new Error(`No .log, .txt, or .csv files found inside ${att.fileName}`);
        }
      } else {
        filesToImport = [new File([blob], att.fileName, { type: att.contentType })];
      }

      const shouldUseIndexedDB = useIndexedDBMode || logs.length === 0;
      let currentLogs = [...logs];

      for (const file of filesToImport) {
        const startId = currentLogs.reduce((max, l) => Math.max(max, l.id), 0) + 1;
        const result = await importFiles([file], {
          sourceType: 'apex',
          startId,
          onProgress: setParsingProgress,
          useIndexedDB: shouldUseIndexedDB,
        });

        if (result.usedIndexedDB) {
          await enableIndexedDBMode();
        } else if (useIndexedDBMode && result.logs.length > 0) {
          await appendLogsToIndexedDB(result.logs, result.datasets);
          await enableIndexedDBMode();
        } else if (result.logs.length > 0) {
          currentLogs = [...currentLogs, ...result.logs].sort((a, b) => a.timestamp - b.timestamp);
        }
        addImportedDatasets(result.datasets);
      }

      if (currentLogs.length > logs.length) setLogs(currentLogs);
      setLoadedAttIds(prev => new Set([...prev, att.id]));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAttErrors(prev => new Map([...prev, [att.id, msg]]));
    } finally {
      setLoadingAttId(null);
      setLoading(false);
      setParsingProgress(0);
    }
  }

  function handleScan() {
    const ticket = mode === 'skip' ? null : (fetchedTicket ?? null);
    const ddOpts: DatadogEnrichmentOptions = {
      enabled: ddEnabled && hasDdCreds,
      fromMs: ddFromMs,
      toMs: ddToMs,
      filter: ddFilter.trim(),
      hosts: ddHosts.split(',').map(h => h.trim()).filter(Boolean),
      indexes: ddIndexes.split(',').map(i => i.trim()).filter(Boolean),
    };
    onScanReady(ticket, timezone, ddOpts);
  }

  // Is scan button enabled?
  // Allow scanning with 0 local logs when a ticket is loaded — AI can use Datadog + ticket context alone
  const hasTicket = mode !== 'skip' && fetchedTicket != null;
  const canScan =
    mode === 'skip'
      ? logCount > 0                          // skip mode still needs local logs
      : hasTicket && (logCount > 0 || (ddEnabled && hasDdCreds));  // ticket mode: logs OR datadog

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Log count badge */}
      <div
        className="rounded border px-3 py-2 text-[11px]"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--accent)' }}
      >
        <span className="font-medium" style={{ color: 'var(--foreground)' }}>
          {logCount.toLocaleString()} events
        </span>
        <span style={{ color: 'var(--muted-foreground)' }}> loaded and ready for analysis</span>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1.5">
        {([
          { id: 'existing' as TicketMode, label: 'Existing Ticket', icon: <Search size={11} /> },
          { id: 'create' as TicketMode, label: 'Create Ticket', icon: <Plus size={11} /> },
          { id: 'skip' as TicketMode, label: 'Skip', icon: <SkipForward size={11} /> },
        ] as const).map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => { setMode(opt.id); setFetchedTicket(null); setZdError(null); setCreateError(null); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors"
            style={{
              borderColor: mode === opt.id ? 'var(--success)' : 'var(--border)',
              backgroundColor: mode === opt.id ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'var(--muted)',
              color: mode === opt.id ? 'var(--success)' : 'var(--muted-foreground)',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Mode: Existing Ticket ── */}
      {mode === 'existing' && (
        <div className="flex flex-col gap-2">
          {fetchedTicket ? (
            <>
            <div
              className="rounded border px-3 py-2"
              style={{ borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--success) 8%, transparent)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--success)' }}>
                    Ticket Loaded
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>
                    #{fetchedTicket.id}: {fetchedTicket.subject}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    {fetchedTicket.status} · {fetchedTicket.requesterName}
                    {fetchedTicket.orgName && ` · ${fetchedTicket.orgName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFetchedTicket(null); setTicketIdInput(''); setLoadedAttIds(new Set()); setAttErrors(new Map()); }}
                  className="shrink-0 rounded px-2 py-0.5 text-[10px] transition-colors hover:bg-[var(--muted)]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Change
                </button>
              </div>
            </div>

            {/* ── Ticket Attachments ── */}
            {fetchedTicket.attachments.length > 0 && (
              <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  Ticket Attachments ({fetchedTicket.attachments.length})
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {fetchedTicket.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 px-3 py-2">
                      <FileText size={12} style={{ color: isZipFile(att.fileName, att.contentType) ? '#f97316' : 'var(--muted-foreground)', flexShrink: 0 }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium" style={{ color: 'var(--foreground)' }} title={att.fileName}>
                          {att.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isZipFile(att.fileName, att.contentType) && (
                            <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                              ZIP
                            </span>
                          )}
                          <span
                            className="rounded px-1 py-0.5 text-[9px] font-medium"
                            style={{
                              backgroundColor: att.commentType === 'internal'
                                ? 'color-mix(in srgb, var(--warning) 15%, transparent)'
                                : 'color-mix(in srgb, var(--muted-foreground) 15%, transparent)',
                              color: att.commentType === 'internal' ? 'var(--warning)' : 'var(--muted-foreground)',
                            }}
                          >
                            {att.commentType === 'internal' ? 'Internal' : 'Public'}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            {att.size > 1024 * 1024
                              ? `${(att.size / 1024 / 1024).toFixed(1)} MB`
                              : `${Math.round(att.size / 1024)} KB`}
                          </span>
                          {attErrors.get(att.id) && (
                            <span className="truncate text-[10px] text-red-400" title={attErrors.get(att.id)}>
                              {attErrors.get(att.id)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLoadAttachment(att)}
                        disabled={loadingAttId !== null || loadedAttIds.has(att.id)}
                        title={loadedAttIds.has(att.id) ? 'Already loaded' : 'Load into workspace'}
                        className="flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50"
                        style={{
                          borderColor: loadedAttIds.has(att.id) ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'var(--border)',
                          backgroundColor: loadedAttIds.has(att.id) ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'var(--muted)',
                          color: loadedAttIds.has(att.id) ? 'var(--success)' : 'var(--foreground)',
                        }}
                      >
                        {loadingAttId === att.id
                          ? <><Loader2 size={10} className="animate-spin" /> Loading…</>
                          : loadedAttIds.has(att.id)
                            ? <><CheckCircle2 size={10} /> Loaded</>
                            : <><Download size={10} /> Load</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>
          ) : (
            useInvestigateUrlEntry ? (
              <div className="flex flex-col gap-2">
                <InvestigateUrlEntry
                  value={ticketIdInput}
                  onChange={setTicketIdInput}
                  onSubmit={(ticketId) => void doFetchTicket(ticketId)}
                  loading={zdFetching}
                  error={zdError}
                />
                {!settings.zendeskToken && (
                  <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    Configure Zendesk credentials in settings to enable auto-fetch.
                  </p>
                )}
              </div>
            ) : (
            <div>
              <label className={LABEL}>Zendesk Ticket # or URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticketIdInput}
                  onChange={e => setTicketIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doFetchTicket()}
                  placeholder="e.g. 12345"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={() => {
                    void doFetchTicket();
                  }}
                  disabled={zdFetching || !ticketIdInput.trim()}
                  className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  {zdFetching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  {zdFetching ? 'Fetching…' : 'Fetch'}
                </button>
              </div>
              {zdError && <p className="mt-1.5 text-[11px] text-red-400">{zdError}</p>}
              {!settings.zendeskToken && (
                <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  Configure Zendesk credentials in settings to enable auto-fetch.
                </p>
              )}
            </div>
            )
          )}
        </div>
      )}

      {/* ── Mode: Create Ticket ── */}
      {mode === 'create' && (
        <div className="flex flex-col gap-2">
          {fetchedTicket ? (
            <div
              className="rounded border px-3 py-2"
              style={{ borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--success) 8%, transparent)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--success)' }}>
                Ticket Created — #{fetchedTicket.id}
              </p>
              <p className="mt-0.5 truncate text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>{fetchedTicket.subject}</p>
            </div>
          ) : (
            <>
              <div>
                <label className={LABEL}>Subject <span className="text-red-400">*</span></label>
                <input type="text" value={createSubject} onChange={e => setCreateSubject(e.target.value)} placeholder="Brief description of the issue" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Description <span className="text-red-400">*</span></label>
                <textarea
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  placeholder="Describe the issue, symptoms, and any details…"
                  rows={3}
                  className={`${INPUT} resize-none`}
                />
              </div>
              <div>
                <label className={LABEL}>Requester Email <span style={{ color: 'var(--muted-foreground)' }}>(optional)</span></label>
                <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="customer@example.com" className={INPUT} />
              </div>
              {createError && <p className="text-[11px] text-red-400">{createError}</p>}
              <button
                type="button"
                onClick={doCreateTicket}
                disabled={creating || !createSubject.trim() || !createDescription.trim()}
                className="flex items-center justify-center gap-2 rounded border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {creating ? 'Creating…' : 'Create Zendesk Ticket'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Mode: Skip ── */}
      {mode === 'skip' && (
        <div
          className="rounded border px-3 py-2 text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Scanning without a Zendesk ticket. The AI will perform a general anomaly and error analysis on the loaded logs.
        </div>
      )}

      {/* Timezone */}
      <div
        className="rounded border p-2.5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <label className={LABEL}>
          Customer timezone
          {fetchedTicket?.requesterTimezone || fetchedTicket?.orgTimezone
            ? <span className="ml-1.5 rounded bg-green-500/15 px-1 py-0.5 text-[9px] text-green-400">from Zendesk</span>
            : null}
        </label>
        <select
          value={timezone}
          onChange={e => setTimezone(e.target.value)}
          className={INPUT}
        >
          {TIMEZONE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
          {/* If Zendesk returned a timezone not in our list, add it */}
          {(fetchedTicket?.requesterTimezone ?? fetchedTicket?.orgTimezone) &&
           !TIMEZONE_OPTIONS.some(o => o.value === (fetchedTicket?.requesterTimezone ?? fetchedTicket?.orgTimezone)) && (
            <option value={fetchedTicket!.requesterTimezone ?? fetchedTicket!.orgTimezone ?? ''}>
              {fetchedTicket!.requesterTimezone ?? fetchedTicket!.orgTimezone} (from Zendesk)
            </option>
          )}
        </select>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          Used to correlate ticket-reported times with log timestamps
        </p>
      </div>

      {/* ── Datadog Enrichment ── */}
      <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
        {/* Header row — always visible */}
        <button
          type="button"
          onClick={() => setDdOpen(o => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
          style={{ backgroundColor: 'var(--muted)' }}
        >
          <div className="flex items-center gap-2">
            <Database size={12} style={{ color: ddEnabled && hasDdCreds ? '#60a5fa' : 'var(--muted-foreground)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
              Datadog Enrichment
            </span>
            {ddEnabled && hasDdCreds && (
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">ON</span>
            )}
            {!hasDdCreds && (
              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>— configure in ⚙ Settings</span>
            )}
          </div>
          {ddOpen ? <ChevronDown size={12} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />}
        </button>

        {ddOpen && (
          <div className="flex flex-col gap-2.5 px-3 pb-3 pt-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
            {/* Enable toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => hasDdCreds && setDdEnabled(v => !v)}
                role="button"
                tabIndex={hasDdCreds ? 0 : -1}
                className={`relative h-4 w-7 rounded-full transition-colors ${ddEnabled && hasDdCreds ? 'bg-blue-500' : 'bg-[var(--border)]'} ${!hasDdCreds ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${ddEnabled && hasDdCreds ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--foreground)' }}>
                Enrich scan with live Datadog logs
              </span>
            </label>

            {ddEnabled && hasDdCreds && (
              <>
                {/* Time window */}
                <div>
                  <label className={LABEL}>Time window</label>
                  <div className="rounded border px-2 py-1.5 text-[11px] font-mono" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}>
                    {new Date(ddFromMs).toLocaleTimeString()} – {new Date(ddToMs).toLocaleTimeString()}
                    <span className="ml-1.5 text-[10px] opacity-60">
                      ({Math.round((ddToMs - ddFromMs) / 60000)} min)
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Expand:</span>
                    {[10, 30].map(m => (
                      <button key={`b-${m}`} type="button" onClick={() => setDdExpandBefore(v => v + m)}
                        className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        −{m}m
                      </button>
                    ))}
                    <button type="button" onClick={() => { setDdExpandBefore(0); setDdExpandAfter(0); }}
                      className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                      reset
                    </button>
                    {[10, 30].map(m => (
                      <button key={`a-${m}`} type="button" onClick={() => setDdExpandAfter(v => v + m)}
                        className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Query filter */}
                <div>
                  <label className={LABEL}>
                    Query / Filter
                    {ddSuggestedFilter && ddFilter !== ddSuggestedFilter && (
                      <button type="button" onClick={() => setDdFilter(ddSuggestedFilter)}
                        className="ml-2 text-[10px] text-blue-400 hover:underline">use suggested</button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={ddFilter}
                    onChange={e => setDdFilter(e.target.value)}
                    placeholder='service:apex-ng status:error'
                    className={INPUT}
                  />
                </div>

                {/* Stations / Hosts */}
                <div>
                  <label className={LABEL}>Stations / Hosts <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(comma-separated)</span></label>
                  <input
                    type="text"
                    value={ddHosts}
                    onChange={e => setDdHosts(e.target.value)}
                    placeholder="station1, station2, pos-01"
                    className={INPUT}
                  />
                </div>

                {/* Indexes */}
                <div>
                  <label className={LABEL}>Indexes <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(blank = all)</span></label>
                  <input
                    type="text"
                    value={ddIndexes}
                    onChange={e => setDdIndexes(e.target.value)}
                    placeholder="main, ops"
                    className={INPUT}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scan button */}
      <button
        type="button"
        onClick={handleScan}
        disabled={!canScan}
        className="flex items-center justify-center gap-2 rounded py-2.5 text-[12px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: canScan ? '#7c3aed' : undefined, opacity: canScan ? 1 : undefined }}
      >
        <Stethoscope size={15} />
        {mode === 'skip' ? 'Scan Logs' : 'Scan Logs Against Ticket'}
      </button>

      {logCount === 0 && !(ddEnabled && hasDdCreds && hasTicket) && (
        <p className="text-center text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          {hasDdCreds
            ? 'Load a log file or enable Datadog enrichment to scan.'
            : 'Load a log file first to enable scanning.'}
        </p>
      )}
    </div>
  );
}

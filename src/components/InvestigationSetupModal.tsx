/**
 * InvestigationSetupModal.tsx
 *
 * Full-screen dialog shown when the agent clicks "Investigate" from the Import screen.
 * It auto-fetches the Zendesk ticket, scans PDF attachments for APEX event data
 * (station, call center name, event ID), and lets the agent choose:
 *   • Which attachments to import (log files / zips / PDFs)
 *   • Whether to pull Datadog logs (pre-filled from detected station)
 *   • The customer timezone
 *
 * On "Start Investigation" it returns an InvestigationSetup object to the parent,
 * which feeds it into DiagnoseTab to run the AI scan.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Loader2, AlertTriangle, FileText, CheckCircle2,
  Database, Globe, ChevronDown, ChevronRight, X, Zap, Search,
} from 'lucide-react';
import { loadAiSettings } from '../store/aiSettings';
import {
  fetchZendeskTicket,
  downloadZendeskAttachment,
  type ZendeskTicket,
  type ZendeskAttachment,
} from '../services/zendeskService';
import {
  discoverStationsForCnc,
  validateDatadogCredentials,
  type DatadogEnrichmentOptions,
  type DatadogStation,
} from '../services/datadogService';
import type { InvestigationSetup } from '../types/investigation';
import {
  parseApexEventPdf,
  buildDatadogQueryFromApex,
  buildDatadogEventIdQuery,
  type ApexEventData,
} from '../services/apexEventParser';
import { extractTextFromPdf } from '../utils/pdfExtractor';
import { isZipFile } from '../utils/zipExtractor';
import { TIMEZONE_OPTIONS } from './ai/diagnose/timezoneOptions';

// Attachments that can carry log data or useful context
function isImportableAttachment(att: ZendeskAttachment): boolean {
  const ext = att.fileName.toLowerCase().split('.').pop() ?? '';
  return ['log', 'txt', 'csv', 'zip', 'pdf'].includes(ext);
}

function isPdf(att: ZendeskAttachment): boolean {
  const ext = att.fileName.toLowerCase().split('.').pop() ?? '';
  return ext === 'pdf' || att.contentType === 'application/pdf';
}

interface Props {
  ticketId: string;
  onConfirm: (setup: InvestigationSetup) => void;
  onCancel: () => void;
}

const INPUT = 'w-full rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-[12px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]';
const LABEL = 'block text-[11px] font-medium text-[var(--muted-foreground)] mb-1';

export default function InvestigationSetupModal({ ticketId, onConfirm, onCancel }: Props) {
  const settings = loadAiSettings();
  const hasDdCreds = !!(settings.datadogApiKey && settings.datadogAppKey);

  // Track where mousedown started so we only close when both down+up are on the backdrop
  const mouseDownOnBackdrop = useRef(false);

  // ── Ticket state ──
  const [ticket, setTicket] = useState<ZendeskTicket | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── PDF scanning state ──
  const [scanningPdfs, setScanningPdfs] = useState(false);
  const [apexEvents, setApexEvents] = useState<ApexEventData[]>([]);
  const [detectedCnc, setDetectedCnc] = useState<string | null>(null);

  // ── Datadog station discovery ──
  const [discoveringStations, setDiscoveringStations] = useState(false);
  const [discoveredStations, setDiscoveredStations] = useState<DatadogStation[]>([]);
  const [selectedStations, setSelectedStations] = useState<Set<string>>(new Set());
  const [stationDiscoveryError, setStationDiscoveryError] = useState<string | null>(null);
  const [manualCnc, setManualCnc] = useState('');
  const [ddTestResult, setDdTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [ddTesting, setDdTesting] = useState(false);

  // ── Attachment selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Timezone ──
  const [timezone, setTimezone] = useState('Eastern Time (US & Canada)');

  // ── Datadog ──
  const [ddOpen, setDdOpen] = useState(hasDdCreds);
  const [ddEnabled, setDdEnabled] = useState(hasDdCreds);
  const [ddExpandBefore, setDdExpandBefore] = useState(0);
  const [ddExpandAfter, setDdExpandAfter] = useState(0);
  const [ddFilter, setDdFilter] = useState('');
  const [ddHosts, setDdHosts] = useState(settings.datadogDefaultHosts ?? '');
  const [ddIndexes, setDdIndexes] = useState(settings.datadogDefaultIndexes ?? '');

  const now = Date.now();
  const ddFromMs = now - 2 * 60 * 60 * 1000 - ddExpandBefore * 60 * 1000;
  const ddToMs   = now + ddExpandAfter * 60 * 1000;

  // Auto-suggest DD filter from ticket
  const ddSuggested = useMemo(() => {
    if (!ticket) return '';
    const parts: string[] = [];
    if (ticket.orgName) parts.push(`@org:"${ticket.orgName}"`);
    if (ticket.tags?.length) parts.push(`service:${ticket.tags[0]}`);
    return parts.join(' ');
  }, [ticket]);

  // ── Auto-fetch ticket on mount ──
  useEffect(() => {
    const id = ticketId.trim().replace(/\D/g, '');
    if (!id) { setFetchError('Invalid ticket ID.'); return; }

    fetchZendeskTicket(settings, id)
      .then(t => {
        setTicket(t);
        // Pre-select all importable attachments
        const importable = t.attachments.filter(isImportableAttachment);
        setSelectedIds(new Set(importable.map(a => a.id)));
        // Timezone from Zendesk
        const tz = t.requesterTimezone ?? t.orgTimezone;
        if (tz) setTimezone(tz);
        // Apply DD filter suggestion from ticket org
        if (t.orgName) {
          const filter = t.tags?.length
            ? `@org:"${t.orgName}" service:${t.tags[0]}`
            : `@org:"${t.orgName}"`;
          setDdFilter(filter);
        }
        // Scan PDF attachments for APEX event data
        scanPdfAttachments(t);
      })
      .catch((e: unknown) => setFetchError(e instanceof Error ? e.message : String(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  /**
   * Downloads and parses PDF attachments to extract APEX event data.
   * Uses the first CNC/station found to pre-fill Datadog fields.
   */
  async function scanPdfAttachments(t: ZendeskTicket) {
    const pdfs = t.attachments.filter(isPdf);
    if (pdfs.length === 0) return;

    setScanningPdfs(true);
    const events: ApexEventData[] = [];

    for (const att of pdfs) {
      try {
        const blob = await downloadZendeskAttachment(settings, att);
        const text = await extractTextFromPdf(blob);
        const event = parseApexEventPdf(text);
        if (event) events.push(event);
      } catch {
        // Non-fatal — skip unreadable PDFs
      }
    }

    setApexEvents(events);

    // Pre-fill Datadog from the first detected event
    if (events.length > 0) {
      const first = events[0];
      if (first.callCenterName) {
        setDetectedCnc(first.callCenterName);

        // Build CNC-level Datadog query with service:prod
        const cncQuery = buildDatadogQueryFromApex(first);

        // If we have an event ID, add it as an OR clause so we catch event-specific logs too
        const eventQuery = buildDatadogEventIdQuery(first);
        const fullQuery = eventQuery
          ? `(${cncQuery}) OR (${eventQuery})`
          : cncQuery;

        setDdFilter(fullQuery);
        setDdIndexes('main');

        // Auto-discover stations from Datadog if we have credentials
        if (hasDdCreds) {
          discoverStations(first.callCenterName);
        }
      }
    }

    setScanningPdfs(false);
  }

  /**
   * Query Datadog to discover all operator/station names for a CNC.
   * Uses the Logs Aggregate API grouped by @log.machineData.name.
   */
  async function discoverStations(cncName: string) {
    setDiscoveringStations(true);
    setStationDiscoveryError(null);
    setDiscoveredStations([]);
    try {
      // Search last 24 hours (wider window to find stations)
      // discoverStationsForCnc tries multiple query strategies and index combos automatically
      const stations = await discoverStationsForCnc(settings, cncName, ['main'], 24 * 60 * 60 * 1000);
      setDiscoveredStations(stations);
      if (stations.length === 0) {
        setStationDiscoveryError(
          `No stations found for "${cncName}" (tried multiple queries and all indexes over 24h).\n` +
          `Check the browser console (F12) for details. Verify in Datadog Log Explorer that ` +
          `the @log.machineData.callCenterName facet exists and has data. ` +
          `You can still type station names manually below.`
        );
      }
    } catch (e: unknown) {
      setStationDiscoveryError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscoveringStations(false);
    }
  }

  function toggleStation(name: string) {
    setSelectedStations(prev => {
      const updated = new Set(prev);
      if (updated.has(name)) updated.delete(name); else updated.add(name);
      // Sync into ddHosts field
      setDdHosts([...updated].join(', '));
      return updated;
    });
  }

  function toggleAtt(id: number) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function handleStart() {
    if (!ticket) return;
    const ddOpts: DatadogEnrichmentOptions = {
      enabled: ddEnabled && hasDdCreds,
      fromMs: ddFromMs,
      toMs: ddToMs,
      filter: ddFilter.trim(),
      hosts: ddHosts.split(',').map(h => h.trim()).filter(Boolean),
      indexes: ddIndexes.split(',').map(i => i.trim()).filter(Boolean),
    };
    onConfirm({
      ticket,
      timezone,
      selectedAttachmentIds: [...selectedIds],
      ddOpts,
      apexEvents,
    });
  }

  const canStart = !!ticket && !scanningPdfs && (selectedIds.size > 0 || (ddEnabled && hasDdCreds));

  return (
    /* Backdrop — only close when both mousedown AND mouseup are on the backdrop itself.
       This prevents accidental closes when users drag-select text inside the modal. */
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={e => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onCancel();
        mouseDownOnBackdrop.current = false;
      }}
    >
      {/* Panel */}
      <div
        className="relative flex w-full max-w-lg flex-col rounded-xl border shadow-[var(--shadow-floating)]"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between rounded-t-xl px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
        >
          <div className="flex items-center gap-2.5">
            <Zap size={16} className="text-violet-400" />
            <span className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>
              Investigation Setup
            </span>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1 transition-colors hover:bg-[var(--accent)]" style={{ color: 'var(--muted-foreground)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">

          {/* ── Ticket ── */}
          <div>
            {!ticket && !fetchError && (
              <div className="flex items-center gap-2.5 rounded border px-4 py-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
                <Loader2 size={14} className="animate-spin text-violet-400" />
                <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>Fetching ticket #{ticketId}…</span>
              </div>
            )}
            {fetchError && (
              <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
                <AlertTriangle size={13} />
                {fetchError}
              </div>
            )}
            {ticket && (
              <div
                className="rounded border px-4 py-3"
                style={{ borderColor: 'color-mix(in srgb, var(--success) 35%, transparent)', backgroundColor: 'color-mix(in srgb, var(--success) 8%, transparent)' }}
              >
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-green-400">Ticket Loaded</p>
                    <p className="mt-0.5 truncate text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>
                      #{ticket.id}: {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                      {ticket.status} · {ticket.requesterName}
                      {ticket.orgName && ` · ${ticket.orgName}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {ticket && (
            <>
              {/* ── Detected Station (from PDF scan) ── */}
              {scanningPdfs && (
                <div className="flex items-center gap-2 rounded border px-3 py-2.5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
                  <Search size={12} className="animate-pulse text-violet-400" />
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    Scanning PDF attachments for station info…
                  </span>
                </div>
              )}

              {!scanningPdfs && apexEvents.length > 0 && (
                <div
                  className="rounded border px-4 py-3"
                  style={{ borderColor: 'color-mix(in srgb, #60a5fa 30%, transparent)', backgroundColor: 'color-mix(in srgb, #60a5fa 8%, transparent)' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-400 mb-1.5">
                    Detected from {apexEvents.length} APEX Event PDF{apexEvents.length !== 1 ? 's' : ''}
                  </p>
                  {apexEvents.map((ev, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--foreground)' }}>
                      <span>
                        <span style={{ color: 'var(--muted-foreground)' }}>CNC:</span>{' '}
                        <span className="font-semibold">{ev.callCenterName || '—'}</span>
                      </span>
                      <span>
                        <span style={{ color: 'var(--muted-foreground)' }}>Station:</span>{' '}
                        <span className="font-semibold">{ev.station}</span>
                      </span>
                      <span>
                        <span style={{ color: 'var(--muted-foreground)' }}>Event:</span>{' '}
                        #{ev.eventId}
                      </span>
                      <span>
                        <span style={{ color: 'var(--muted-foreground)' }}>Agent:</span>{' '}
                        {ev.agentName}
                      </span>
                      <span>
                        <span style={{ color: 'var(--muted-foreground)' }}>Time:</span>{' '}
                        {ev.eventDateTime}
                      </span>
                    </div>
                  ))}
                  <p className="mt-2 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                    Datadog fields below have been pre-filled from this data. Please confirm before starting.
                  </p>
                </div>
              )}

              {/* ── Attachments ── */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className={LABEL + ' mb-0'}>
                    Attachments&nbsp;
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>— select which to import</span>
                  </label>
                  {ticket.attachments.length > 1 && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedIds(new Set(ticket.attachments.filter(isImportableAttachment).map(a => a.id)))}
                        className="text-[10px] text-blue-400 hover:underline">all</button>
                      <button type="button" onClick={() => setSelectedIds(new Set())}
                        className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>none</button>
                    </div>
                  )}
                </div>

                {ticket.attachments.length === 0 ? (
                  <div className="rounded border px-3 py-2.5 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                    No attachments on this ticket.
                  </div>
                ) : (
                  <div className="divide-y rounded border" style={{ borderColor: 'var(--border)' }}>
                    {ticket.attachments.map(att => {
                      const selectable = isImportableAttachment(att);
                      const checked = selectedIds.has(att.id);
                      const pdf = isPdf(att);
                      const zip = isZipFile(att.fileName, att.contentType);
                      return (
                        <label
                          key={att.id}
                          className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${selectable ? 'hover:bg-[var(--accent)]' : 'opacity-40 cursor-not-allowed'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!selectable}
                            onChange={() => selectable && toggleAtt(att.id)}
                            className="accent-violet-500"
                          />
                          <FileText size={12} style={{ color: zip ? '#f97316' : pdf ? '#ef4444' : 'var(--muted-foreground)', flexShrink: 0 }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium" style={{ color: 'var(--foreground)' }} title={att.fileName}>
                              {att.fileName}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {zip && (
                                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316' }}>ZIP</span>
                              )}
                              {pdf && (
                                <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>PDF</span>
                              )}
                              <span className="rounded px-1 py-0.5 text-[9px] font-medium"
                                style={{
                                  backgroundColor: att.commentType === 'internal'
                                    ? 'color-mix(in srgb, var(--warning) 15%, transparent)'
                                    : 'color-mix(in srgb, var(--muted-foreground) 15%, transparent)',
                                  color: att.commentType === 'internal' ? 'var(--warning)' : 'var(--muted-foreground)',
                                }}>
                                {att.commentType === 'internal' ? 'Internal' : 'Public'}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                                {att.size > 1048576 ? `${(att.size / 1048576).toFixed(1)} MB` : `${Math.round(att.size / 1024)} KB`}
                              </span>
                              {!selectable && (
                                <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>— not importable</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Timezone ── */}
              <div>
                <label className={LABEL}>
                  <Globe size={11} className="inline mr-1 text-[var(--muted-foreground)]" />
                  Customer timezone
                  {(ticket.requesterTimezone || ticket.orgTimezone) && (
                    <span className="ml-2 rounded bg-green-500/15 px-1 py-0.5 text-[9px] text-green-400">from Zendesk</span>
                  )}
                </label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className={INPUT}>
                  {TIMEZONE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  {(ticket.requesterTimezone ?? ticket.orgTimezone) &&
                    !TIMEZONE_OPTIONS.some(o => o.value === (ticket.requesterTimezone ?? ticket.orgTimezone)) && (
                    <option value={ticket.requesterTimezone ?? ticket.orgTimezone ?? ''}>
                      {ticket.requesterTimezone ?? ticket.orgTimezone} (from Zendesk)
                    </option>
                  )}
                </select>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  Correlates ticket-reported times with log timestamps
                </p>
              </div>

              {/* ── Datadog ── */}
              <div className="rounded border" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setDdOpen(o => !o)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent)]"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <div className="flex items-center gap-2">
                    <Database size={13} style={{ color: ddEnabled && hasDdCreds ? '#60a5fa' : 'var(--muted-foreground)' }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>Datadog Enrichment</span>
                    {ddEnabled && hasDdCreds && (
                      <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">ON</span>
                    )}
                    {(detectedCnc || manualCnc.trim()) && ddEnabled && hasDdCreds && (
                      <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400">
                        {manualCnc.trim() || detectedCnc}
                      </span>
                    )}
                    {!hasDdCreds && (
                      <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>— add credentials in ⚙ Settings</span>
                    )}
                  </div>
                  {ddOpen ? <ChevronDown size={12} style={{ color: 'var(--muted-foreground)' }} /> : <ChevronRight size={12} style={{ color: 'var(--muted-foreground)' }} />}
                </button>

                {ddOpen && (
                  <div className="flex flex-col gap-3 border-t px-3 pb-3 pt-3" style={{ borderColor: 'var(--border)' }}>
                    {/* Toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div
                        onClick={() => hasDdCreds && setDdEnabled(v => !v)}
                        role="button"
                        tabIndex={hasDdCreds ? 0 : -1}
                        className={`relative h-4 w-7 rounded-full transition-colors ${ddEnabled && hasDdCreds ? 'bg-blue-500' : 'bg-[var(--border)]'} ${!hasDdCreds ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${ddEnabled && hasDdCreds ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--foreground)' }}>Pull live Datadog logs for this investigation</span>
                    </label>

                    {/* Test Connection */}
                    {hasDdCreds && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setDdTesting(true);
                            setDdTestResult(null);
                            const result = await validateDatadogCredentials(settings);
                            setDdTestResult(result);
                            setDdTesting(false);
                          }}
                          disabled={ddTesting}
                          className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--accent)]"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                        >
                          {ddTesting ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                          Test Connection
                        </button>
                        {ddTestResult && (
                          <span className={`text-[10px] ${ddTestResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                            {ddTestResult.valid ? '✓' : '✗'} {ddTestResult.message}
                          </span>
                        )}
                      </div>
                    )}

                    {ddEnabled && hasDdCreds && (
                      <>
                        {/* CNC / Call Center Name */}
                        <div>
                          <label className={LABEL}>
                            Call Center Name (CNC)
                            {detectedCnc && (
                              <span className="ml-2 rounded bg-violet-500/15 px-1 py-0.5 text-[9px] text-violet-400">
                                detected from PDF
                              </span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualCnc || detectedCnc || ''}
                              onChange={e => setManualCnc(e.target.value)}
                              placeholder="e.g. us-il-glenview-apex"
                              className={INPUT + ' flex-1'}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cncToSearch = manualCnc.trim() || detectedCnc || '';
                                if (cncToSearch) {
                                  discoverStations(cncToSearch);
                                  // Also update the DD filter to include this CNC
                                  if (!ddFilter.includes('callCenterName')) {
                                    const cncQuery = `@log.machineData.callCenterName:${cncToSearch} service:prod`;
                                    setDdFilter(prev => prev ? `(${prev}) OR (${cncQuery})` : cncQuery);
                                  }
                                }
                              }}
                              disabled={discoveringStations || (!(manualCnc.trim()) && !detectedCnc)}
                              className="flex items-center gap-1.5 whitespace-nowrap rounded border px-3 py-1.5 text-[11px] font-medium text-blue-400 transition-colors hover:bg-blue-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
                              style={{ borderColor: 'color-mix(in srgb, #60a5fa 40%, transparent)' }}
                            >
                              {discoveringStations ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                              Discover Stations
                            </button>
                          </div>
                          <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                            The Datadog <code className="font-mono">@log.machineData.callCenterName</code> value. Type it manually or it auto-fills from APEX PDFs.
                          </p>
                        </div>

                        {/* Stations / Hosts */}
                        <div>
                          <label className={LABEL}>
                            Stations / Hosts
                            <span className="ml-1 font-normal" style={{ color: 'var(--muted-foreground)' }}>(comma-separated, optional)</span>
                          </label>
                          <input type="text" value={ddHosts} onChange={e => { setDdHosts(e.target.value); setSelectedStations(new Set()); }}
                            placeholder="e.g. us-il-glenview-south-apex-02" className={INPUT} />

                          {/* Station Discovery */}
                          {discoveringStations && (
                            <div className="mt-2 flex items-center gap-2 rounded border px-2.5 py-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}>
                              <Loader2 size={11} className="animate-spin text-blue-400" />
                              <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                                Searching Datadog for stations in <span className="font-mono font-semibold">{manualCnc.trim() || detectedCnc || 'CNC'}</span>…
                              </span>
                            </div>
                          )}

                          {stationDiscoveryError && (
                            <div className="mt-2 rounded border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[10px] text-red-400">
                              Station discovery failed: {stationDiscoveryError}
                            </div>
                          )}

                          {!discoveringStations && discoveredStations.length > 0 && (
                            <div className="mt-2 rounded border" style={{ borderColor: 'color-mix(in srgb, #60a5fa 30%, transparent)' }}>
                              <div className="flex items-center justify-between px-2.5 py-1.5" style={{ backgroundColor: 'color-mix(in srgb, #60a5fa 8%, transparent)', borderBottom: '1px solid color-mix(in srgb, #60a5fa 15%, transparent)' }}>
                                <span className="text-[10px] font-semibold text-blue-400">
                                  {discoveredStations.length} station{discoveredStations.length !== 1 ? 's' : ''} found in Datadog
                                </span>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => { const all = new Set(discoveredStations.map(s => s.name)); setSelectedStations(all); setDdHosts([...all].join(', ')); }}
                                    className="text-[9px] text-blue-400 hover:underline">all</button>
                                  <button type="button" onClick={() => { setSelectedStations(new Set()); setDdHosts(''); }}
                                    className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>none</button>
                                </div>
                              </div>
                              <div className="max-h-36 overflow-y-auto">
                                {discoveredStations.map(s => (
                                  <label
                                    key={s.name}
                                    className="flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-[var(--accent)]"
                                    style={{ borderBottom: '1px solid var(--border)' }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedStations.has(s.name)}
                                      onChange={() => toggleStation(s.name)}
                                      className="accent-blue-500"
                                    />
                                    <span className="flex-1 truncate font-mono text-[11px]" style={{ color: 'var(--foreground)' }} title={s.name}>
                                      {s.name}
                                    </span>
                                    <span className="shrink-0 rounded bg-[var(--muted)] px-1.5 py-0.5 text-[9px] font-medium tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                                      {s.count.toLocaleString()} logs
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {!discoveringStations && discoveredStations.length === 0 && !stationDiscoveryError && (detectedCnc || manualCnc.trim()) && (
                            <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                              No stations discovered yet. Click "Discover Stations" above, or type station names manually.
                            </p>
                          )}

                          {!detectedCnc && !manualCnc.trim() && (
                            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                              The <code className="font-mono">@log.machineData.name</code> value from Datadog (not the physical station ID)
                            </p>
                          )}
                        </div>

                        {/* Query */}
                        <div>
                          <label className={LABEL}>
                            Query / Filter
                            {detectedCnc && (
                              <span className="ml-2 rounded bg-violet-500/15 px-1 py-0.5 text-[9px] text-violet-400">
                                from PDF
                              </span>
                            )}
                            {ddSuggested && ddFilter !== ddSuggested && !detectedCnc && (
                              <button type="button" onClick={() => setDdFilter(ddSuggested)} className="ml-2 text-[10px] text-blue-400 hover:underline">
                                use suggested
                              </button>
                            )}
                          </label>
                          <input type="text" value={ddFilter} onChange={e => setDdFilter(e.target.value)}
                            placeholder='@log.machineData.callCenterName:us-il-glenview-apex service:prod' className={INPUT} />
                        </div>

                        {/* Time window */}
                        <div>
                          <label className={LABEL}>Time window (last 2 h by default)</label>
                          <div className="rounded border px-2 py-1.5 text-[11px] font-mono" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--accent)', color: 'var(--muted-foreground)' }}>
                            {new Date(ddFromMs).toLocaleTimeString()} – {new Date(ddToMs).toLocaleTimeString()}
                            <span className="ml-1.5 text-[10px] opacity-60">({Math.round((ddToMs - ddFromMs) / 60000)} min)</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>Expand:</span>
                            {[10, 30, 60].map(m => (
                              <button key={`b${m}`} type="button" onClick={() => setDdExpandBefore(v => v + m)}
                                className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>−{m}m</button>
                            ))}
                            <button type="button" onClick={() => { setDdExpandBefore(0); setDdExpandAfter(0); }}
                              className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>reset</button>
                            {[10, 30, 60].map(m => (
                              <button key={`a${m}`} type="button" onClick={() => setDdExpandAfter(v => v + m)}
                                className="rounded border px-1.5 py-0.5 text-[10px] hover:bg-[var(--muted)]" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>+{m}m</button>
                            ))}
                          </div>
                        </div>

                        {/* Indexes */}
                        <div>
                          <label className={LABEL}>Indexes <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(blank = all)</span></label>
                          <input type="text" value={ddIndexes} onChange={e => setDdIndexes(e.target.value)}
                            placeholder="main, ops" className={INPUT} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── Investigation Plan ── */}
              <div className="rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--accent)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--foreground)' }}>
                    Investigation Plan
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 px-3 py-2.5">
                  {/* Attachments */}
                  <div className="flex items-start gap-2 text-[11px]">
                    <span style={{ color: selectedIds.size > 0 ? '#22c55e' : 'var(--muted-foreground)' }}>
                      {selectedIds.size > 0 ? '✓' : '○'}
                    </span>
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {selectedIds.size > 0
                        ? <>Download & parse <span style={{ color: 'var(--foreground)' }}>{selectedIds.size} attachment{selectedIds.size !== 1 ? 's' : ''}</span>
                          {apexEvents.length > 0 && <> (incl. {apexEvents.length} APEX event PDF{apexEvents.length !== 1 ? 's' : ''} for context)</>}
                        </>
                        : 'No attachments selected'}
                    </span>
                  </div>

                  {/* APEX Event ID correlation */}
                  {apexEvents.length > 0 && (
                    <div className="flex items-start gap-2 text-[11px]">
                      <span style={{ color: '#22c55e' }}>✓</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        Search Datadog by Event ID{apexEvents.length > 1 ? 's' : ''}:{' '}
                        {apexEvents.map((ev, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            <span className="font-mono font-semibold" style={{ color: '#60a5fa' }}>#{ev.eventId}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {/* CNC / Station */}
                  {(detectedCnc || manualCnc.trim()) && (
                    <div className="flex items-start gap-2 text-[11px]">
                      <span style={{ color: '#22c55e' }}>✓</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        Search CNC:{' '}
                        <span className="font-mono font-semibold" style={{ color: '#a78bfa' }}>{manualCnc.trim() || detectedCnc}</span>
                        {apexEvents[0]?.station && apexEvents[0].station !== 'N/A' && (
                          <> · Physical station: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{apexEvents[0].station}</span></>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Datadog */}
                  <div className="flex items-start gap-2 text-[11px]">
                    <span style={{ color: ddEnabled && hasDdCreds ? '#22c55e' : 'var(--muted-foreground)' }}>
                      {ddEnabled && hasDdCreds ? '✓' : '○'}
                    </span>
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      {ddEnabled && hasDdCreds
                        ? <>Pull live Datadog logs <span className="font-mono text-[10px]" style={{ color: 'var(--foreground)' }}>(index: {ddIndexes || 'all'}, service: prod)</span></>
                        : 'Datadog enrichment disabled'}
                    </span>
                  </div>

                  {/* Selected stations */}
                  {ddEnabled && hasDdCreds && ddHosts.trim() && (
                    <div className="flex items-start gap-2 text-[11px]">
                      <span style={{ color: '#22c55e' }}>✓</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        Filtering to station{ddHosts.split(',').filter(h => h.trim()).length !== 1 ? 's' : ''}:{' '}
                        {ddHosts.split(',').filter(h => h.trim()).map((h, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            <span className="font-mono font-semibold" style={{ color: '#60a5fa' }}>{h.trim()}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}

                  {/* Operator name hint — only if no stations selected and discovery hasn't run */}
                  {detectedCnc && ddEnabled && hasDdCreds && !ddHosts.trim() && discoveredStations.length === 0 && !discoveringStations && (
                    <div className="mt-1 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[10px]" style={{ color: 'var(--warning)' }}>
                      💡 Select specific stations above for more precise Datadog results, or leave blank to search the entire CNC.
                    </div>
                  )}

                  {/* Timezone */}
                  <div className="flex items-start gap-2 text-[11px]">
                    <span style={{ color: '#22c55e' }}>✓</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      Timezone: <span style={{ color: 'var(--foreground)' }}>{timezone}</span>
                    </span>
                  </div>

                  {/* AI analysis */}
                  <div className="flex items-start gap-2 text-[11px]">
                    <span style={{ color: '#a78bfa' }}>⟶</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>
                      Run <span style={{ color: 'var(--foreground)' }}>Unleashed AI</span> to correlate all sources and generate internal note draft
                    </span>
                  </div>

                  {/* No sources warning */}
                  {selectedIds.size === 0 && !(ddEnabled && hasDdCreds) && (
                    <div className="mt-1 text-[11px] text-amber-400">
                      ⚠ No data sources selected — pick at least one attachment or enable Datadog.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-end gap-2.5 rounded-b-xl px-5 py-4"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2 text-[12px] font-medium transition-colors hover:bg-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="flex items-center gap-2 rounded px-5 py-2 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#7c3aed' }}
          >
            {!ticket || scanningPdfs ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Start Investigation
          </button>
        </div>
      </div>
    </div>
  );
}

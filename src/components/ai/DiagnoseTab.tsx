/**
 * DiagnoseTab.tsx
 *
 * NOC Diagnosis Assistant — orchestrates the 3-phase diagnosis workflow.
 *
 * Phase 1 (DiagnosePhase1): Ticket selection (existing / create / skip) + timezone + scan
 * Phase 2 (DiagnosePhase2): Resizable split — correlated logs ↔ editable internal note
 * Phase 3 (DiagnosePhase3): Log archive + post internal note to Zendesk (or copy/create)
 *
 * This component owns all shared state: ticket, diagnosis result, internal note,
 * and AI highlight IDs. The phase components are purely presentational.
 */
import { useState, useEffect } from 'react';
import { Loader2, Stethoscope } from 'lucide-react';
import { useLogContext } from '../../contexts/LogContext';
import { useCase } from '../../store/caseContext';
import { loadAiSettings } from '../../store/aiSettings';
import { diagnoseLogs, generateInternalNote, refineInternalNote } from '../../services/unleashService';
import { downloadZendeskAttachment, formatTicketForAi, searchZendeskTickets, type ZendeskTicket } from '../../services/zendeskService';
import { searchConfluenceInvestigations } from '../../services/confluenceService';
import { searchDatadogLogs, formatDatadogLogsForAi, type DatadogEnrichmentOptions } from '../../services/datadogService';
import { importFiles } from '../../services/importService';
import { isZipFile, extractLogFilesFromZip } from '../../utils/zipExtractor';
import { extractTextFromPdf } from '../../utils/pdfExtractor';
import { buildArchiveFilename } from '../../utils/logArchive';
import { formatApexEventForAi } from '../../services/apexEventParser';
import type { DiagnosisResult } from '../../types/diagnosis';
import type { LogEntry } from '../../types';
import type { InvestigationSetup } from '../../types/investigation';
import DiagnosePhase1 from './diagnose/DiagnosePhase1';
import DiagnosePhase2 from './diagnose/DiagnosePhase2';
import DiagnosePhase3 from './diagnose/DiagnosePhase3';

type Phase = 1 | 2 | 3;

interface Props {
  /** Ticket # arriving from the Import screen — auto-fetched in Phase 1 */
  initialTicketId?: string;
  /** Called once the initialTicketId has been consumed so parent can clear it */
  onTicketConsumed?: () => void;
  /**
   * Full investigation config from InvestigationSetupModal.
   * When set, DiagnoseTab skips Phase 1 and runs the scan immediately
   * using the agent-confirmed attachments, timezone, and Datadog options.
   */
  pendingSetup?: InvestigationSetup | null;
  /** Called once the pendingSetup has been consumed so parent can clear it */
  onSetupConsumed?: () => void;
}

// Detect the browser/system timezone label for the NOC agent
function getNocTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export default function DiagnoseTab({ initialTicketId, onTicketConsumed, pendingSetup, onSetupConsumed }: Props) {
  const { filteredLogs, logs, setLogs, setAiHighlightedLogIds, setAiHighlightReasons, clearAiHighlights, addImportedDatasets } = useLogContext();
  const { activeCase, addBookmark } = useCase();
  const activeLogs = filteredLogs.length > 0 ? filteredLogs : logs;
  const settings = loadAiSettings();

  const [phase, setPhase] = useState<Phase>(1);

  // Phase 1 outputs
  const [ticket, setTicket] = useState<ZendeskTicket | null>(null);
  const [customerTimezone, setCustomerTimezone] = useState('Eastern Time (US & Canada)');

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Analyzing with Unleashed AI…');

  // Phase 2 outputs
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [refining, setRefining] = useState(false);

  // Phase 3 — archive filename built from ticket/org context
  const archiveFilename = buildArchiveFilename({
    orgName: ticket?.orgName ?? undefined,
    siteOrPosition: ticket?.tags?.[0] ?? ticket?.subject?.split(' ')[0] ?? 'logs',
    dateStr: ticket?.createdAt
      ? new Date(ticket.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  });

  // ── Auto-start: triggered by InvestigationSetupModal confirmation ────────────
  // Skips Phase 1: downloads selected attachments → Datadog → AI scan
  useEffect(() => {
    if (!pendingSetup || phase !== 1 || scanning) return;
    onSetupConsumed?.();
    handleSetupStart(pendingSetup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSetup]);

  async function handleSetupStart(setup: InvestigationSetup) {
    const { ticket: t, timezone: tz, selectedAttachmentIds, ddOpts, apexEvents } = setup;
    setTicket(t);
    setCustomerTimezone(tz);
    setScanning(true);
    setScanError(null);
    clearAiHighlights();

    let allLogs: LogEntry[] = [...logs];
    const pdfTexts: string[] = [];

    try {
      // 1. Download selected attachments
      const selectedAtts = t.attachments.filter(a => selectedAttachmentIds.includes(a.id));
      if (selectedAtts.length > 0) {
        setScanStatus(`Loading ${selectedAtts.length} attachment${selectedAtts.length !== 1 ? 's' : ''}…`);
        for (const att of selectedAtts) {
          try {
            const blob = await downloadZendeskAttachment(settings, att);
            const ext = att.fileName.toLowerCase().split('.').pop() ?? '';

            // PDF attachments → extract text for AI context (not loaded as log entries)
            if (ext === 'pdf' || att.contentType === 'application/pdf') {
              const text = await extractTextFromPdf(blob);
              pdfTexts.push(`[PDF: ${att.fileName}]\n${text}`);
              continue;
            }

            const filesToImport: File[] = isZipFile(att.fileName, att.contentType)
              ? await extractLogFilesFromZip(blob, att.fileName)
              : [new File([blob], att.fileName, { type: att.contentType })];

            for (const file of filesToImport) {
              const startId = allLogs.reduce((max, l) => Math.max(max, l.id), 0) + 1;
              const result = await importFiles([file], { sourceType: 'apex', startId, useIndexedDB: false });
              if (result.logs.length > 0) {
                allLogs = [...allLogs, ...result.logs].sort((a, b) => a.timestamp - b.timestamp);
              }
              addImportedDatasets(result.datasets);
            }
          } catch { /* non-fatal — skip unreadable attachment */ }
        }
        if (allLogs.length > logs.length) setLogs(allLogs);
      }

      // 2. Optionally enrich with Datadog
      let datadogContext: string | undefined;
      if (ddOpts.enabled) {
        setScanStatus('Fetching Datadog logs…');
        const effectiveDdOpts = allLogs.length > 0
          ? { ...ddOpts, fromMs: Math.min(ddOpts.fromMs, allLogs[0].timestamp), toMs: Math.max(ddOpts.toMs, allLogs[allLogs.length - 1].timestamp) }
          : ddOpts;
        try {
          const ddLogs = await searchDatadogLogs(settings, effectiveDdOpts);
          if (ddLogs.length > 0) {
            datadogContext = `DATADOG ENRICHMENT (${ddLogs.length} entries, window: ${new Date(effectiveDdOpts.fromMs).toLocaleTimeString()} – ${new Date(effectiveDdOpts.toMs).toLocaleTimeString()}):\n${formatDatadogLogsForAi(ddLogs)}`;
          }
        } catch (ddErr: unknown) {
          datadogContext = `DATADOG ENRICHMENT: Failed to fetch — ${ddErr instanceof Error ? ddErr.message : String(ddErr)}`;
        }
      }

      // 3. Build combined context (ticket + APEX PDFs + Datadog)
      let combinedDdContext = datadogContext;
      // Add APEX event context from parsed PDFs
      if (apexEvents.length > 0) {
        const apexContext = apexEvents.map(e => formatApexEventForAi(e)).join('\n\n---\n\n');
        combinedDdContext = [
          `APEX EVENT PDF CONTEXT (${apexEvents.length} event${apexEvents.length !== 1 ? 's' : ''}):\n${apexContext}`,
          combinedDdContext,
        ].filter(Boolean).join('\n\n');
      }
      // Add raw PDF text that wasn't parsed as APEX events
      const nonApexPdfs = pdfTexts.filter(t => !apexEvents.some(e => t.includes(e.eventId)));
      if (nonApexPdfs.length > 0) {
        const pdfContext = nonApexPdfs.join('\n\n---\n\n');
        combinedDdContext = [
          `PDF ATTACHMENT CONTEXT:\n${pdfContext}`,
          combinedDdContext,
        ].filter(Boolean).join('\n\n');
      }

      // 4. Run AI diagnosis
      setScanStatus('Analyzing with Unleashed AI…');
      const ticketText = formatTicketForAi(t);
      const result = await diagnoseLogs(settings, ticketText, allLogs, tz, combinedDdContext);
      setDiagnosisResult(result);

      const ids = new Set(result.correlatedLogs.map(l => l.logId));
      setAiHighlightedLogIds(ids);
      const reasons = new Map(result.correlatedLogs.map(l => [l.logId, l.reason]));
      setAiHighlightReasons(reasons);

      // Search for similar past tickets (non-blocking)
      searchSimilarTicketsAsync(result);

      // 4. Generate internal note draft
      const note = await generateInternalNote(settings, result, ticketText, tz, getNocTimezone());
      setInternalNote(note);

      setPhase(2);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  // ── Phase 1 → scan ──────────────────────────────────────────────────────────
  async function handleScanReady(resolvedTicket: ZendeskTicket | null, tz: string, ddOpts: DatadogEnrichmentOptions) {
    setTicket(resolvedTicket);
    setCustomerTimezone(tz);
    setScanning(true);
    setScanError(null);
    setScanStatus('Analyzing with Unleashed AI…');
    clearAiHighlights();

    try {
      const ticketText = resolvedTicket
        ? formatTicketForAi(resolvedTicket)
        : 'No ticket — perform a general anomaly and error analysis on the loaded logs.';

      // Optionally fetch Datadog logs to enrich the AI context
      let datadogContext: string | undefined;
      if (ddOpts.enabled) {
        setScanStatus('Fetching Datadog logs…');
        try {
          const ddLogs = await searchDatadogLogs(settings, ddOpts);
          if (ddLogs.length > 0) {
            datadogContext = `DATADOG ENRICHMENT (${ddLogs.length} entries, window: ${new Date(ddOpts.fromMs).toLocaleTimeString()} – ${new Date(ddOpts.toMs).toLocaleTimeString()}):\n${formatDatadogLogsForAi(ddLogs)}`;
          }
        } catch (ddErr: unknown) {
          // Non-fatal — log scan still runs, user sees a note about DD failure
          datadogContext = `DATADOG ENRICHMENT: Failed to fetch — ${ddErr instanceof Error ? ddErr.message : String(ddErr)}`;
        }
        setScanStatus('Correlating logs with Unleashed AI…');
      }

      // Run diagnosis
      const result = await diagnoseLogs(settings, ticketText, activeLogs, tz, datadogContext);
      setDiagnosisResult(result);

      // Highlight correlated log IDs in the main viewer
      const ids = new Set(result.correlatedLogs.map(l => l.logId));
      setAiHighlightedLogIds(ids);

      // Store per-log AI reasons so the details panel can show them
      const reasons = new Map(result.correlatedLogs.map(l => [l.logId, l.reason]));
      setAiHighlightReasons(reasons);

      // Search for similar past tickets (non-blocking)
      searchSimilarTicketsAsync(result);

      // Generate internal note draft
      const note = await generateInternalNote(
        settings,
        result,
        ticketText,
        tz,
        getNocTimezone()
      );
      setInternalNote(note);

      setPhase(2);
    } catch (e: unknown) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  // ── Similar past tickets + investigations (async, non-blocking) ─────────────
  function searchSimilarTicketsAsync(result: DiagnosisResult) {
    const keywords: string[] = [];
    if (result.rootCause && result.rootCause !== 'Insufficient data') {
      const words = result.rootCause.split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) keywords.push(words.slice(0, 4).join(' '));
    }
    const components = [...new Set(result.correlatedLogs.map(l => l.component))].filter(Boolean);
    keywords.push(...components.slice(0, 2));
    const idMatches = (result.summary ?? '').match(/(?:station|cnc|ccs|pbx|sip)\S*/gi);
    if (idMatches) keywords.push(...idMatches.slice(0, 2));

    if (keywords.length === 0) return;

    // Search both Zendesk and Confluence in parallel
    const zdSearch = searchZendeskTickets(settings, keywords, 5)
      .then(results => {
        const filtered = ticket ? results.filter(r => r.id !== ticket.id) : results;
        return filtered.map(r => ({ ...r, closureNote: undefined, source: 'zendesk' as const }));
      })
      .catch(() => [] as Array<{ id: number; subject: string; status: string; createdAt: string; tags: string[]; closureNote: undefined; source: 'zendesk' }>);

    const confSearch = searchConfluenceInvestigations(settings, keywords, 5)
      .then(results => results.map(r => ({
        id: parseInt(r.pageId, 10) || 0,
        subject: r.title,
        status: 'closed',
        createdAt: r.lastModified || '',
        tags: [] as string[],
        closureNote: r.excerpt || undefined,
        source: 'confluence' as const,
        url: r.url,
      })))
      .catch(() => [] as Array<{ id: number; subject: string; status: string; createdAt: string; tags: string[]; closureNote: string | undefined; source: 'confluence'; url: string }>);

    Promise.all([zdSearch, confSearch]).then(([zdResults, confResults]) => {
      // Confluence results first (past investigations are richer than raw Zendesk results)
      const combined = [...confResults, ...zdResults].slice(0, 8);
      if (combined.length > 0) {
        const updated = {
          ...result,
          similarPastTickets: combined,
        };
        setDiagnosisResult(updated);
      }
    });
  }

  // ── Phase 2 — AI note refinement ────────────────────────────────────────────
  async function handleRefineNote(instruction: string) {
    setRefining(true);
    try {
      const updated = await refineInternalNote(settings, internalNote, instruction);
      setInternalNote(updated);
    } catch {
      // Silently fail — agent still has the note to edit manually
    } finally {
      setRefining(false);
    }
  }

  // ── Reset everything ────────────────────────────────────────────────────────
  function reset() {
    setPhase(1);
    setTicket(null);
    setDiagnosisResult(null);
    setInternalNote('');
    setScanError(null);
    clearAiHighlights();
  }

  // ── Scanning spinner ────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 size={28} className="animate-spin text-violet-400" />
        <p className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>
          {scanStatus}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
          Correlating {activeLogs.length.toLocaleString()} events
          {ticket ? ` with ticket #${ticket.id}` : ''}
          {customerTimezone !== 'UTC' ? ` · Customer TZ: ${customerTimezone}` : ''}
          <br />
          This may take 15–30 seconds.
        </p>
      </div>
    );
  }

  // ── Phase 1 ─────────────────────────────────────────────────────────────────
  if (phase === 1) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Step indicator */}
        <StepBar current={1} />
        {scanError && (
          <div className="mx-3 mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            {scanError}
          </div>
        )}
        <DiagnosePhase1
          settings={settings}
          logCount={activeLogs.length}
          logTimeRange={activeLogs.length > 0 ? { start: activeLogs[0].timestamp, end: activeLogs[activeLogs.length - 1].timestamp } : undefined}
          initialTicketId={initialTicketId}
          onTicketConsumed={onTicketConsumed}
          onScanReady={handleScanReady}
        />
        {/* Stethoscope watermark when no logs */}
        {activeLogs.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <Stethoscope size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
            <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              Load a log file to begin diagnosis
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Phase 2 ─────────────────────────────────────────────────────────────────
  if (phase === 2 && diagnosisResult) {
    return (
      <div className="flex h-full flex-col">
        <StepBar current={2} />
        <div className="flex-1 overflow-hidden">
          <DiagnosePhase2
            diagnosisResult={diagnosisResult}
            internalNote={internalNote}
            onNoteChange={setInternalNote}
            onRefineNote={handleRefineNote}
            onNext={() => setPhase(3)}
            onBack={reset}
            refining={refining}
            settings={settings}
            activeCase={activeCase}
            addBookmark={addBookmark}
          />
        </div>
      </div>
    );
  }

  // ── Phase 3 ─────────────────────────────────────────────────────────────────
  if (phase === 3) {
    return (
      <div className="flex h-full flex-col">
        <StepBar current={3} />
        <div className="flex-1 overflow-hidden">
          <DiagnosePhase3
            settings={settings}
            ticket={ticket}
            diagnosisResult={diagnosisResult}
            customerTimezone={customerTimezone}
            internalNote={internalNote}
            logs={activeLogs}
            defaultFilename={archiveFilename}
            onBack={() => setPhase(2)}
            onDone={reset}
          />
        </div>
      </div>
    );
  }

  return null;
}

/** 3-step progress bar */
function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Ticket & Scan' },
    { n: 2, label: 'Review & Refine' },
    { n: 3, label: 'Submit' },
  ];
  return (
    <div
      className="flex shrink-0 items-center px-3 py-2 gap-0"
      style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
    >
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shrink-0"
              style={{
                backgroundColor: s.n <= current ? '#7c3aed' : 'var(--border)',
                color: s.n <= current ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {s.n}
            </div>
            <span
              className="text-[10px] font-medium whitespace-nowrap"
              style={{ color: s.n === current ? 'var(--foreground)' : 'var(--muted-foreground)' }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 mx-2" style={{ borderTop: '1px solid var(--border)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

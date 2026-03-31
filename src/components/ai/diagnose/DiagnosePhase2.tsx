/**
 * DiagnosePhase2.tsx
 *
 * Phase 2 of the NOC Diagnosis workflow — Review & Refine.
 *
 * Redesigned for real agent workflow:
 * - Top banner: AI diagnosis summary + root cause
 * - Left pane: Correlated logs (AI + agent-starred) with full detail, bookmark buttons,
 *   and a mini log browser for starring additional logs
 * - Right pane: Editable internal note draft + AI chat refinement
 *
 * Starring a log in the main viewer now adds it to the correlated set.
 * The agent can type a reason or ask AI to explain why the log is relevant.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bookmark, ChevronRight, ChevronLeft, Loader2, Send, CheckCircle,
  Star, Search, Plus, Sparkles, AlertTriangle, Info,
} from 'lucide-react';
import clsx from 'clsx';
import type { DiagnosisResult, AiCorrelatedLog } from '../../../types/diagnosis';
import type { BookmarkTag } from '../../../types/case';
import type { AiSettings } from '../../../store/aiSettings';
import type { LogEntry } from '../../../types';
import { useLogContext } from '../../../contexts/LogContext';
import ResizableSplit from './ResizableSplit';
import SimilarTicketsPanel from './SimilarTicketsPanel';

interface CaseRef {
  id: string;
}

interface Props {
  diagnosisResult: DiagnosisResult;
  internalNote: string;
  onNoteChange: (note: string) => void;
  onRefineNote: (instruction: string) => void;
  onNext: () => void;
  onBack: () => void;
  refining: boolean;
  settings: AiSettings;
  activeCase: CaseRef | null;
  addBookmark: (caseId: string, bookmark: { id: string; logId: number; tag: BookmarkTag; note: string; timestamp: number }) => void;
}

export default function DiagnosePhase2({
  diagnosisResult,
  internalNote,
  onNoteChange,
  onRefineNote,
  onNext,
  onBack,
  refining,
  settings,
  activeCase,
  addBookmark,
}: Props) {
  const { logs, favoriteLogIds, toggleFavorite, aiHighlightedLogIds, setAiHighlightedLogIds, aiHighlightReasons, setAiHighlightReasons } = useLogContext();

  const [refineInput, setRefineInput] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());
  const [logSearchText, setLogSearchText] = useState('');
  const [showLogBrowser, setShowLogBrowser] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Merge AI-correlated logs with agent-starred (favorited) logs
  const allCorrelatedLogs = useMemo(() => {
    const aiLogs = diagnosisResult.correlatedLogs;
    const aiLogIds = new Set(aiLogs.map(l => l.logId));

    // Add any starred logs that aren't already AI-correlated
    const starredExtras: AiCorrelatedLog[] = [];
    for (const logId of favoriteLogIds) {
      if (aiLogIds.has(logId)) continue;
      // Also include logs that are AI-highlighted (agent may have starred them)
      const log = logs.find(l => l.id === logId);
      if (!log) continue;
      starredExtras.push({
        logId: log.id,
        index: 0, // Not from original diagnosis
        rawTimestamp: log.rawTimestamp,
        level: log.level,
        component: log.displayComponent,
        message: log.displayMessage,
        reason: aiHighlightReasons.get(log.id) || '⭐ Added by agent',
      });
    }

    return [...aiLogs, ...starredExtras];
  }, [diagnosisResult.correlatedLogs, favoriteLogIds, logs, aiHighlightReasons]);

  // Browsable log list (for adding more logs)
  const browsableLogs = useMemo(() => {
    if (!logSearchText.trim()) return logs.slice(0, 100);
    const lower = logSearchText.toLowerCase();
    return logs.filter(l =>
      l.displayMessage.toLowerCase().includes(lower) ||
      l.displayComponent.toLowerCase().includes(lower) ||
      l.rawTimestamp.toLowerCase().includes(lower) ||
      (l.payload && l.payload.toLowerCase().includes(lower))
    ).slice(0, 100);
  }, [logs, logSearchText]);

  // Auto-grow textarea
  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto';
      noteRef.current.style.height = `${noteRef.current.scrollHeight}px`;
    }
  }, [internalNote]);

  function addLogToCase(logId: number) {
    if (!activeCase) return;
    addBookmark(activeCase.id, {
      id: `bm_${Date.now()}_${logId}`,
      logId,
      tag: 'evidence',
      note: 'Added from AI Diagnosis',
      timestamp: Date.now(),
    });
    setBookmarkedIds(prev => new Set([...prev, logId]));
  }

  /** Star a log from the mini browser → add to AI highlights + favorites */
  function starLogAsCorrelated(log: LogEntry, reason?: string) {
    // Add to favorites (starred)
    if (!favoriteLogIds.has(log.id)) {
      toggleFavorite(log.id);
    }
    // Add to AI highlights so it shows in the main viewer
    const newIds = new Set(aiHighlightedLogIds);
    newIds.add(log.id);
    setAiHighlightedLogIds(newIds);
    // Add reason
    const newReasons = new Map(aiHighlightReasons);
    newReasons.set(log.id, reason || '⭐ Added by agent');
    setAiHighlightReasons(newReasons);
  }

  function handleRefine() {
    const instruction = refineInput.trim();
    if (!instruction || refining) return;
    setRefineInput('');
    onRefineNote(instruction);
  }

  const levelBadge = (level: string) => clsx(
    'mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium',
    level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
    level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
    'bg-blue-500/20 text-blue-400'
  );

  const leftPane = (
    <div className="flex h-full flex-col" style={{ borderRight: '1px solid var(--border)' }}>
      {/* Diagnosis Summary Banner */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.06))' }}>
        <div className="flex items-start gap-2 mb-1.5">
          <Sparkles size={12} className="text-violet-400 mt-0.5 shrink-0" />
          <p className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
            {diagnosisResult.summary || 'No diagnosis summary available.'}
          </p>
        </div>
        {diagnosisResult.rootCause && (
          <div className="flex items-start gap-2 mt-1.5 ml-0.5">
            <AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Root Cause:</span>{' '}
              {diagnosisResult.rootCause}
            </p>
          </div>
        )}
      </div>

      {/* Correlated Logs Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
          Correlated Logs ({allCorrelatedLogs.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogBrowser(!showLogBrowser)}
            className="flex items-center gap-1 text-[10px] transition-colors hover:text-violet-400"
            style={{ color: 'var(--muted-foreground)' }}
            title="Browse & add more logs"
          >
            <Plus size={10} /> Add logs
          </button>
          {allCorrelatedLogs.length > 0 && activeCase && (
            <button
              type="button"
              onClick={() => allCorrelatedLogs.forEach(l => addLogToCase(l.logId))}
              className="text-[10px] transition-colors hover:text-[var(--success)]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Bookmark all
            </button>
          )}
        </div>
      </div>

      {/* Correlated Log list */}
      <div className="flex-1 overflow-y-auto">
        {allCorrelatedLogs.length === 0 ? (
          <div className="p-4 text-center">
            <Info size={20} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              No logs correlated yet.
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Star ⭐ logs in the main viewer or click "Add logs" above to manually correlate entries.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {allCorrelatedLogs.map(l => (
              <div key={l.logId} className="px-3 py-2 hover:bg-[var(--muted)]/50 transition-colors">
                <div className="flex items-start gap-1.5">
                  <span className={levelBadge(l.level)}>{l.level}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                        {l.rawTimestamp}
                      </p>
                      {/* Show star if agent-added */}
                      {l.index === 0 && (
                        <Star size={9} className="fill-[var(--warning)] text-[var(--warning)]" />
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] break-words" style={{ color: 'var(--foreground)' }}>
                      <span style={{ color: 'var(--muted-foreground)' }}>{l.component}:</span> {l.message}
                    </p>
                    {l.reason && (
                      <p className="mt-0.5 text-[10px] italic leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                        💡 {l.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    {activeCase && (
                      <button
                        type="button"
                        onClick={() => addLogToCase(l.logId)}
                        disabled={bookmarkedIds.has(l.logId)}
                        title="Add to Case"
                        className={clsx(
                          'rounded p-0.5 transition-colors',
                          bookmarkedIds.has(l.logId)
                            ? 'text-[var(--success)]'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                        )}
                      >
                        {bookmarkedIds.has(l.logId)
                          ? <CheckCircle size={11} />
                          : <Bookmark size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mini Log Browser — for manually adding correlated logs */}
        {showLogBrowser && (
          <>
            <div
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)' }}
            >
              Browse Logs — Star to add
            </div>
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  value={logSearchText}
                  onChange={e => setLogSearchText(e.target.value)}
                  placeholder="Search by message, component, timestamp…"
                  className="w-full rounded border py-1 pl-7 pr-2 text-[10px] outline-none"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input)', color: 'var(--foreground)' }}
                />
              </div>
            </div>
            <div className="max-h-[200px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
              {browsableLogs.map(log => {
                const isAlreadyCorrelated = allCorrelatedLogs.some(c => c.logId === log.id);
                return (
                  <div
                    key={log.id}
                    className={clsx(
                      'px-3 py-1.5 flex items-start gap-1.5 text-[10px] cursor-pointer transition-colors',
                      isAlreadyCorrelated ? 'bg-violet-500/5' : 'hover:bg-[var(--muted)]/50'
                    )}
                    onClick={() => !isAlreadyCorrelated && starLogAsCorrelated(log)}
                  >
                    <span className={levelBadge(log.level)}>{log.level}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-mono" style={{ color: 'var(--muted-foreground)' }}>{log.rawTimestamp}</span>
                      <span className="ml-1 font-mono" style={{ color: 'var(--foreground)' }}>
                        {log.displayComponent}: {log.displayMessage.slice(0, 100)}
                      </span>
                    </div>
                    {isAlreadyCorrelated ? (
                      <CheckCircle size={11} className="text-violet-400 shrink-0 mt-0.5" />
                    ) : (
                      <Star size={11} className="shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
                    )}
                  </div>
                );
              })}
              {browsableLogs.length === 0 && (
                <p className="p-3 text-center text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  No logs match "{logSearchText}"
                </p>
              )}
            </div>
          </>
        )}

        {/* Log source suggestions */}
        {diagnosisResult.logSuggestions.length > 0 && (
          <>
            <div
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)' }}
            >
              Also check
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {diagnosisResult.logSuggestions.map((s, i) => (
                <div key={i} className="px-3 py-2">
                  <span className="rounded border px-1.5 py-0.5 text-[9px] font-medium" style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                    {s.source}
                  </span>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--foreground)' }}>{s.reason}</p>
                  {s.query && (
                    <p className="mt-0.5 font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{s.query}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Similar Past Tickets — async-populated after diagnosis */}
        {diagnosisResult.similarPastTickets && diagnosisResult.similarPastTickets.length > 0 && (
          <SimilarTicketsPanel
            tickets={diagnosisResult.similarPastTickets}
            settings={settings}
          />
        )}
      </div>
    </div>
  );

  const rightPane = (
    <div className="flex w-full flex-col" style={{ height: '100%' }}>
      {/* Troubleshooting summary */}
      {diagnosisResult.appliedTroubleshooting && (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(34,197,94,0.04)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--success)' }}>
            Troubleshooting
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {diagnosisResult.appliedTroubleshooting}
          </p>
        </div>
      )}

      {/* Note header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted-foreground)' }}>
          Internal Note Draft
        </span>
        {refining && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            <Loader2 size={10} className="animate-spin" /> AI updating…
          </span>
        )}
      </div>

      {/* Editable note */}
      <div className="flex-1 overflow-y-auto p-3">
        <textarea
          ref={noteRef}
          value={internalNote}
          onChange={e => onNoteChange(e.target.value)}
          disabled={refining}
          className="w-full resize-none rounded border bg-transparent p-0 font-mono text-[11px] leading-relaxed outline-none disabled:opacity-60"
          style={{
            minHeight: '240px',
            border: 'none',
            color: 'var(--foreground)',
            caretColor: 'var(--success)',
          }}
          placeholder={refining ? 'AI is rewriting the note…' : 'Your internal note will appear here after scanning…'}
          spellCheck={false}
        />
      </div>

      {/* AI chat refinement */}
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="mb-1.5 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          Ask AI to refine this note:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={refineInput}
            onChange={e => setRefineInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
            disabled={refining}
            placeholder='e.g. "add the auth error at 14:20" or "shorten next steps"'
            className="flex-1 rounded border px-2 py-1.5 text-[11px] outline-none disabled:opacity-50"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--input)', color: 'var(--foreground)' }}
          />
          <button
            type="button"
            onClick={handleRefine}
            disabled={!refineInput.trim() || refining}
            className="flex items-center justify-center rounded px-2 py-1.5 transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--success)', color: '#fff' }}
          >
            {refining ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Phase nav */}
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] transition-colors hover:text-[var(--foreground)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ChevronLeft size={13} /> Back
        </button>
        <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
          Step 2 — Review &amp; Refine
          <span className="ml-2 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            ⭐ Star logs in the viewer to add them here
          </span>
        </span>
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
          style={{ backgroundColor: '#7c3aed' }}
        >
          Next <ChevronRight size={13} />
        </button>
      </div>

      {/* Resizable split */}
      <div className="flex-1 overflow-hidden">
        <ResizableSplit left={leftPane} right={rightPane} initialSplit={45} />
      </div>
    </div>
  );
}

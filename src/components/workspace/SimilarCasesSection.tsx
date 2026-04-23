import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { caseLibraryService, type SimilarCaseMatch } from '../../services/caseLibraryService';
import { embeddingService } from '../../services/embeddingService';
import { useCase } from '../../store/caseContext';
import type { CaseSeverity } from '../../types/case';

const RESULT_LIMIT = 5;
const SUMMARY_PREVIEW_LIMIT = 120;

type SimilarCasesState = 'idle' | 'loading' | 'ready';

type AnnouncementState = {
  nonce: number;
  text: string;
};

interface SimilarCasesSectionProps {
  onCountChange?: (count: number) => void;
}

function truncateSummary(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3)}...`;
}

function formatRelativeTime(timestamp: number): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  return `${Math.floor(deltaHours / 24)}d ago`;
}

function severityBadgeClassName(severity: CaseSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]';
    case 'high':
      return 'border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]';
    case 'medium':
      return 'border-[#60a5fa]/30 bg-[#60a5fa]/10 text-[#60a5fa]';
    case 'low':
    default:
      return 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]';
  }
}

function SimilarCasesSkeleton({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const shimmerClassName = prefersReducedMotion
    ? 'bg-[var(--muted)]/70'
    : 'animate-shimmer bg-gradient-to-r from-[var(--muted)] via-[var(--accent)] to-[var(--muted)] bg-[length:200%_100%]';

  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={`similar-cases-skeleton-${index}`}
          data-testid="similar-cases-skeleton"
          className="rounded-[var(--radius-md)] border border-[var(--border)]/70 p-3"
        >
          <div className="flex items-center gap-2">
            <div className={clsx('h-4 rounded-[var(--radius-sm)]', shimmerClassName)} style={{ width: '48%' }} />
            <div className={clsx('h-4 rounded-full', shimmerClassName)} style={{ width: 52 }} />
            <div className={clsx('ml-auto h-4 rounded-[var(--radius-sm)]', shimmerClassName)} style={{ width: 56 }} />
          </div>
          <div className="mt-2 space-y-2">
            <div className={clsx('h-3 rounded-[var(--radius-sm)]', shimmerClassName)} style={{ width: '88%' }} />
            <div className={clsx('h-3 rounded-[var(--radius-sm)]', shimmerClassName)} style={{ width: '62%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimilarCasesSection({ onCountChange }: SimilarCasesSectionProps) {
  const { activeCase, cases, setActiveCase } = useCase();
  const prefersReducedMotion = usePrefersReducedMotion();
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [matches, setMatches] = useState<SimilarCaseMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState<SimilarCasesState>('idle');
  const [resultAnnouncement, setResultAnnouncement] = useState<AnnouncementState>({ nonce: 0, text: '' });
  const [actionAnnouncement, setActionAnnouncement] = useState<AnnouncementState>({ nonce: 0, text: '' });
  const embedderReady = embeddingService.isInitialized();

  const hasPastCases = useMemo(
    () => (activeCase ? cases.some((caseItem) => caseItem.id !== activeCase.id) : false),
    [activeCase, cases],
  );

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, matches.length);
  }, [matches.length]);

  useEffect(() => {
    if (!activeCase || !embedderReady) {
      onCountChange?.(0);
    }
  }, [activeCase, embedderReady, onCountChange]);

  useEffect(() => {
    if (!activeCase || !embedderReady) {
      return;
    }

    let cancelled = false;
    const loadMatches = async (): Promise<void> => {
      setMatches([]);
      setActiveIndex(0);
      setState('loading');
      onCountChange?.(0);

      try {
        const results = await caseLibraryService.findSimilar(activeCase, {
          topK: RESULT_LIMIT,
          filters: { excludeCaseIds: [activeCase.id] },
        });

        if (cancelled) {
          return;
        }

        const nextMatches = results.slice(0, RESULT_LIMIT);
        setMatches(nextMatches);
        setState('ready');
        onCountChange?.(nextMatches.length);
        setResultAnnouncement((current) => ({
          nonce: current.nonce + 1,
          text: `Showing ${nextMatches.length} similar past cases`,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Failed to load similar cases:', error);
        setMatches([]);
        setState('ready');
        onCountChange?.(0);
        setResultAnnouncement((current) => ({
          nonce: current.nonce + 1,
          text: 'Showing 0 similar past cases',
        }));
      }
    };

    void loadMatches();

    return () => {
      cancelled = true;
    };
  }, [activeCase, embedderReady, onCountChange]);

  const activateCase = useCallback((index: number) => {
    const nextMatch = matches[index];
    if (!nextMatch) {
      return;
    }

    setActiveCase(nextMatch.case.id);
    setActionAnnouncement((current) => ({
      nonce: current.nonce + 1,
      text: `Switching to case ${nextMatch.case.id}`,
    }));
  }, [matches, setActiveCase]);

  const focusRow = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, matches.length - 1));
    setActiveIndex(clampedIndex);
    rowRefs.current[clampedIndex]?.focus();
  }, [matches.length]);

  const handleRowKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        focusRow(index + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        focusRow(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusRow(0);
        break;
      case 'End':
        event.preventDefault();
        focusRow(matches.length - 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        activateCase(index);
        break;
      default:
        break;
    }
  }, [activateCase, focusRow, matches.length]);

  let content: ReactNode;

  if (!activeCase) {
    content = <p className="text-xs text-[var(--muted-foreground)]">No active case yet.</p>;
  } else if (!embedderReady) {
    content = (
      <p className="text-xs text-[var(--muted-foreground)]">
        Configure <code className="font-mono text-[11px] text-[var(--foreground)]">VITE_GEMINI_EMBEDDING_KEY</code> to enable similar-case retrieval.
      </p>
    );
  } else if (state === 'loading') {
    content = <SimilarCasesSkeleton prefersReducedMotion={prefersReducedMotion} />;
  } else if (matches.length === 0) {
    content = (
      <p className="text-xs text-[var(--muted-foreground)]">
        {hasPastCases
          ? 'No semantically similar cases in your library yet.'
          : 'The library fills as you create and resolve investigations both new ones and imported `.noclense` packs.'}
      </p>
    );
  } else {
    content = (
      <div className="space-y-2">
        {matches.map((match, index) => {
          const preview = truncateSummary(
            match.case.summary || match.case.impact || 'No summary captured yet.',
            SUMMARY_PREVIEW_LIMIT,
          );
          const descriptionId = `similar-case-description-${match.case.id}`;

          return (
            <button
              key={match.case.id}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              type="button"
              data-testid="similar-case-row"
              tabIndex={index === activeIndex ? 0 : -1}
              aria-describedby={descriptionId}
              onClick={() => activateCase(index)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              className={clsx(
                'flex w-full items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left',
                'transition-[border-color,background-color] duration-150',
                'focus-visible:outline-none focus-visible:ring-[var(--ring-width)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-[var(--ring-offset)] focus-visible:ring-offset-[var(--card)]',
                index === activeIndex
                  ? 'border-[var(--ring)] bg-[var(--muted)]/60'
                  : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40',
              )}
            >
              <div className="min-w-0 flex-1" id={descriptionId}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--foreground)]">
                    {match.case.title}
                  </p>
                  <span
                    className={clsx(
                      'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]',
                      severityBadgeClassName(match.case.severity),
                    )}
                  >
                    {match.case.severity}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {formatRelativeTime(match.case.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[var(--muted-foreground)]">
                  {preview}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-[var(--button-subtle-border)] bg-[var(--button-subtle-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--foreground)]">
                Open
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {content}
      <div
        className="sr-only"
        data-testid="similar-cases-status-live"
        aria-live="polite"
        aria-atomic="true"
      >
        <span key={resultAnnouncement.nonce}>{resultAnnouncement.text}</span>
      </div>
      <div
        className="sr-only"
        data-testid="similar-cases-action-live"
        aria-live="assertive"
        aria-atomic="true"
      >
        <span key={actionAnnouncement.nonce}>{actionAnnouncement.text}</span>
      </div>
    </>
  );
}

export default SimilarCasesSection;

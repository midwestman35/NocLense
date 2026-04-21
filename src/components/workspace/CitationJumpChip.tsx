import { useEffect, useState, type JSX } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * CitationJumpChip — header chip shown after a citation-jump navigation
 * lands the user on a specific log entry.
 *
 * Owner: LogViewer. State for "what did we jump from" lives alongside
 * the existing `highlightedEntryId` state in LogViewer; this component
 * is a pure presentational chip that auto-dismisses after 4s.
 *
 * Spec §6.2: "⟵ jumped from H1" (hypothesis rank). Falls back to a
 * generic label when rank is not available at the jump site; callers
 * plumb richer source info through the `source` prop as capabilities
 * expand.
 *
 * Reduced-motion: `motion-reduce:animate-none` strips the fade-in so
 * the chip appears instantly. Auto-dismiss timer is unaffected.
 */

export interface CitationJumpSource {
  /** When the jump originated from a hypothesis block, its 1-based rank. */
  hypothesisRank?: 1 | 2 | 3;
  /** Fallback label when rank is not known (e.g. "Diagnose", "AI"). */
  label?: string;
}

export interface CitationJumpChipProps {
  /** Non-null shows the chip. Setting to null (or autodismiss) hides it. */
  source: CitationJumpSource | null;
  /** Called when the user clicks ×, or when auto-dismiss fires. */
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Defaults to 4000 per spec §6.2. */
  autoDismissMs?: number;
}

const DEFAULT_AUTO_DISMISS_MS = 4000;

function sourceLabel(source: CitationJumpSource): string {
  if (source.hypothesisRank) return `⟵ jumped from H${source.hypothesisRank}`;
  if (source.label) return `⟵ jumped from ${source.label}`;
  return '⟵ jumped from citation';
}

export function CitationJumpChip({
  source,
  onDismiss,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
}: CitationJumpChipProps): JSX.Element | null {
  const [visible, setVisible] = useState(source !== null);

  useEffect(() => {
    if (source === null) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, autoDismissMs);
    return () => window.clearTimeout(timeoutId);
  }, [source, onDismiss, autoDismissMs]);

  if (!source || !visible) return null;

  return (
    <div
      data-citation-chip
      data-testid="citation-jump-chip"
      role="status"
      aria-label="Jumped to citation target"
      className={clsx(
        'inline-flex items-center gap-2',
        'rounded-full border border-[var(--ring)]/30 bg-[var(--accent)]',
        'px-3 py-1 text-xs text-[var(--foreground)]',
        'shadow-[var(--shadow-raised)]',
        // Fade-in via existing room-fade-in keyframe (src/index.css).
        // motion-reduce: suppresses the entrance animation; the chip
        // snaps in instead.
        'motion-safe:animate-[room-fade-in_var(--duration-enter,250ms)_var(--ease-enter-out,ease-out)_both]',
      )}
    >
      <span>{sourceLabel(source)}</span>
      <button
        type="button"
        aria-label="Dismiss citation jump notice"
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        className="rounded-full p-0.5 text-[var(--muted-foreground)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default CitationJumpChip;

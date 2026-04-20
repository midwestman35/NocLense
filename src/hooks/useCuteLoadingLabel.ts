/**
 * useCuteLoadingLabel.ts — deterministic phrase cycling for loading states.
 *
 * Phase 01a implementation of design spec §3.7. Returns the current
 * phrase; the surrounding `<LoadingLabel>` component renders it with
 * character-level animation.
 *
 * Determinism: phrase sequence is derived from a per-OperationKind seed
 * (simple LCG shuffle). Tests, reloads, and concurrent loads of the same
 * operation produce the same sequence; concurrent loads of different
 * operations produce independent sequences. No shared global state.
 *
 * Reduced motion: returns index-0 of the sequence and does not start the
 * interval. The visual reveal animation also short-circuits in CSS
 * (`loading.css @media (prefers-reduced-motion: reduce)`).
 */

import { useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type OperationKind =
  | 'file-parse'
  | 'ai-diagnose'
  | 'ai-chat'
  | 'datadog-query'
  | 'zendesk-lookup'
  | 'jira-lookup'
  | 'evidence-export'
  | 'connector-heartbeat'
  | 'generic';

/** Universal pool of 20 phrases. Order here is the unseeded canonical order. */
export const CUTE_PHRASE_POOL: readonly string[] = Object.freeze([
  'thinking…',
  'working…',
  'cooking…',
  'brewing…',
  'crunching…',
  'parsing…',
  'indexing…',
  'untangling…',
  'digging in…',
  'cross-referencing…',
  'hmm…',
  'assembling…',
  'grepping…',
  'unpacking…',
  'mulling it over…',
  'chewing on it…',
  'sifting…',
  'tracing…',
  'puzzling it out…',
  'brb…',
]);

/**
 * Per-operation seed. Chosen so the first phrase for each operation differs
 * and the sequences don't obviously rhyme. Stable across refactors — change
 * only with a comment explaining why.
 */
const OPERATION_SEEDS: Record<OperationKind, number> = {
  'file-parse': 2,
  'ai-diagnose': 5,
  'ai-chat': 11,
  'datadog-query': 17,
  'zendesk-lookup': 23,
  'jira-lookup': 29,
  'evidence-export': 37,
  'connector-heartbeat': 41,
  generic: 0,
};

/** Phrase change cadence, matches spec §3.7. */
export const CUTE_LABEL_CYCLE_MS = 2500;

/** Linear-congruential generator — fast, deterministic, good enough for shuffle. */
function lcg(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

/**
 * Fisher–Yates shuffle seeded from `seed`. Pure function: same seed → same
 * output. Exported so callers (and tests) can pre-compute sequences.
 */
export function buildPhraseSequence(seed: number): string[] {
  const pool = CUTE_PHRASE_POOL.slice();
  let state = lcg(seed || 1);
  for (let i = pool.length - 1; i > 0; i--) {
    state = lcg(state);
    const j = state % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool;
}

export interface UseCuteLoadingLabelResult {
  /** Current phrase. Stable reference across re-renders while idle. */
  phrase: string;
  /** Zero-based index into the operation's phrase sequence. */
  index: number;
  /** True when the hook's interval is active. */
  active: boolean;
}

/**
 * @param operation — which operation is loading. Determines the phrase sequence.
 * @param isLoading — when false, the hook pauses cycling and returns phrase #0.
 */
export function useCuteLoadingLabel(
  operation: OperationKind,
  isLoading: boolean,
): UseCuteLoadingLabelResult {
  const reducedMotion = usePrefersReducedMotion();
  const sequence = useMemo(
    () => buildPhraseSequence(OPERATION_SEEDS[operation]),
    [operation],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isLoading || reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % sequence.length);
    }, CUTE_LABEL_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [isLoading, reducedMotion, sequence.length]);

  // When not loading, report phrase #0 without mutating state. The
  // internal `index` persists across loading sessions — a subsequent load
  // may resume mid-sequence, which is visually fine (only one phrase is
  // visible at a time). Callers needing a forced reset should re-mount
  // the consuming component via a `key` prop.
  const visibleIndex = isLoading ? index : 0;

  return {
    phrase: sequence[visibleIndex],
    index: visibleIndex,
    active: isLoading && !reducedMotion,
  };
}

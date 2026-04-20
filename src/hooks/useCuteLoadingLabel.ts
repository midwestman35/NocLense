/**
 * useCuteLoadingLabel.ts — deterministic phrase cycling for loading states.
 *
 * Phase 01a implementation of design spec §3.7. Returns the current
 * phrase; the surrounding `<LoadingLabel>` component renders it with
 * character-level animation.
 *
 * Determinism: the phrase sequence is a Fisher–Yates shuffle seeded
 * with a stable djb2 hash of the `OperationKind` string. Different
 * operations always produce different seeds (no hand-maintained seed
 * table); the same operation always produces the same sequence
 * (tests, reloads, and concurrent loads all agree).
 *
 * Reduced motion: when `prefers-reduced-motion: reduce` is active,
 * the hook returns phrase #0 of the operation's sequence and does
 * not start the interval. Spec §3.7: "picks the operation-specific
 * first phrase and stays there."
 *
 * Operation change: the interval re-keys on `operation`, so swapping
 * operations resets the index to 0 rather than leaking stale state
 * from a different sequence.
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

/** Phrase change cadence, matches spec §3.7. */
export const CUTE_LABEL_CYCLE_MS = 2500;

/**
 * Per-operation first phrase. Hand-assigned from the pool so each
 * operation has a semantically relevant opener AND uniqueness is
 * guaranteed without relying on hash distribution (djb2 + 9 operations
 * across 20 phrases doesn't spread perfectly — verified in tests).
 *
 * Adding a new OperationKind: pick an unused CUTE_PHRASE_POOL index.
 * Tests enforce uniqueness.
 */
const FIRST_PHRASE_INDEX: Record<OperationKind, number> = {
  'file-parse': 5, // parsing…
  'ai-diagnose': 0, // thinking…
  'ai-chat': 10, // hmm…
  'datadog-query': 12, // grepping…
  'zendesk-lookup': 6, // indexing…
  'jira-lookup': 17, // tracing…
  'evidence-export': 11, // assembling…
  'connector-heartbeat': 19, // brb…
  generic: 1, // working…
};

/** djb2 hash — deterministic, good enough to seed the per-op shuffle. */
export function hashOperationKind(operation: string): number {
  let hash = 5381;
  for (let i = 0; i < operation.length; i++) {
    hash = ((hash << 5) + hash + operation.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1; // never 0 (breaks LCG)
}

/** Linear-congruential generator — pure deterministic integer sequence. */
function lcg(seed: number): number {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

/** Seeded Fisher–Yates. Pure function: same (arr, seed) → same output. */
function shuffleSeeded<T>(arr: readonly T[], seed: number): T[] {
  const out = arr.slice();
  let state = lcg(seed || 1);
  for (let i = out.length - 1; i > 0; i--) {
    state = lcg(state);
    const j = state % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Full-pool shuffle seeded by integer. Retained as an export for tests
 * that want to validate the shuffle itself independent of first-phrase
 * assignment. Consumers should prefer `sequenceForOperation`.
 */
export function buildPhraseSequence(seed: number): string[] {
  return shuffleSeeded(CUTE_PHRASE_POOL, seed);
}

/**
 * Per-operation phrase sequence. Starts with the operation's assigned
 * first phrase (guaranteed unique per operation), then cycles through
 * the remaining 19 phrases in a seeded-deterministic order.
 */
export function sequenceForOperation(operation: OperationKind): string[] {
  const firstIdx = FIRST_PHRASE_INDEX[operation];
  const first = CUTE_PHRASE_POOL[firstIdx];
  const rest = CUTE_PHRASE_POOL.filter((_, i) => i !== firstIdx);
  const shuffledRest = shuffleSeeded(rest, hashOperationKind(operation));
  return [first, ...shuffledRest];
}

export interface UseCuteLoadingLabelResult {
  /** Current phrase. Under reduced motion, always the operation's phrase #0. */
  phrase: string;
  /** Zero-based index into the operation's phrase sequence. */
  index: number;
  /** True when the hook's interval is active. */
  active: boolean;
}

/**
 * @param operation — which operation is loading. Determines the phrase
 *                    sequence via hashOperationKind().
 * @param isLoading — when false, the hook pauses cycling and returns
 *                    phrase #0.
 */
export function useCuteLoadingLabel(
  operation: OperationKind,
  isLoading: boolean,
): UseCuteLoadingLabelResult {
  const reducedMotion = usePrefersReducedMotion();
  const sequence = useMemo(() => sequenceForOperation(operation), [operation]);
  const [index, setIndex] = useState(0);

  // A "session key" changes on ANY transition that should reset the
  // phrase index: operation change, isLoading flipping either
  // direction. React's "derive state from props" pattern (setState
  // during render; see react.dev/reference/react/useState) resets
  // index on every session boundary without an effect round-trip.
  // This fixes the prior same-operation re-entry bug where
  // isLoading: false → true preserved stale index.
  const sessionKey = `${operation}:${isLoading ? 'on' : 'off'}`;
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    setIndex(0);
  }

  useEffect(() => {
    if (!isLoading || reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % sequence.length);
    }, CUTE_LABEL_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [operation, isLoading, reducedMotion, sequence.length]);

  // Visible index is always 0 under reduced motion or while idle;
  // spec §3.7 requires reduced-motion users see only the operation's
  // first phrase. Purely derived — no state mutation here.
  const visibleIndex = isLoading && !reducedMotion ? index : 0;

  return {
    phrase: sequence[visibleIndex],
    index: visibleIndex,
    active: isLoading && !reducedMotion,
  };
}

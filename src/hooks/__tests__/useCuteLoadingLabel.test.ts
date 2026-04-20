/**
 * useCuteLoadingLabel.test.ts — verifies the determinism guarantees
 * the hook promises. Runs under vitest.
 */

import { describe, expect, it } from 'vitest';
import {
  CUTE_PHRASE_POOL,
  buildPhraseSequence,
  hashOperationKind,
  sequenceForOperation,
  type OperationKind,
} from '../useCuteLoadingLabel';

const ALL_OPERATIONS: OperationKind[] = [
  'file-parse',
  'ai-diagnose',
  'ai-chat',
  'datadog-query',
  'zendesk-lookup',
  'jira-lookup',
  'evidence-export',
  'connector-heartbeat',
  'generic',
];

describe('hashOperationKind', () => {
  it('is deterministic', () => {
    for (const op of ALL_OPERATIONS) {
      expect(hashOperationKind(op)).toBe(hashOperationKind(op));
    }
  });

  it('produces a distinct hash per operation', () => {
    const hashes = ALL_OPERATIONS.map(hashOperationKind);
    expect(new Set(hashes).size).toBe(ALL_OPERATIONS.length);
  });

  it('never returns 0 (would break the LCG)', () => {
    for (const op of ALL_OPERATIONS) {
      expect(hashOperationKind(op)).not.toBe(0);
    }
  });
});

describe('buildPhraseSequence', () => {
  it('is a permutation of the phrase pool', () => {
    const seq = buildPhraseSequence(42);
    expect(seq).toHaveLength(CUTE_PHRASE_POOL.length);
    expect(new Set(seq).size).toBe(CUTE_PHRASE_POOL.length);
    for (const phrase of CUTE_PHRASE_POOL) {
      expect(seq).toContain(phrase);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(buildPhraseSequence(42)).toEqual(buildPhraseSequence(42));
    expect(buildPhraseSequence(99)).toEqual(buildPhraseSequence(99));
  });

  it('produces different sequences for different seeds', () => {
    expect(buildPhraseSequence(1)).not.toEqual(buildPhraseSequence(2));
  });
});

describe('sequenceForOperation', () => {
  it('first phrase is unique across every OperationKind', () => {
    const firsts = ALL_OPERATIONS.map((op) => sequenceForOperation(op)[0]);
    expect(new Set(firsts).size).toBe(ALL_OPERATIONS.length);
  });

  it('full sequence differs between every pair of operations', () => {
    for (let i = 0; i < ALL_OPERATIONS.length; i++) {
      for (let j = i + 1; j < ALL_OPERATIONS.length; j++) {
        const a = sequenceForOperation(ALL_OPERATIONS[i]);
        const b = sequenceForOperation(ALL_OPERATIONS[j]);
        expect(a).not.toEqual(b);
      }
    }
  });

  it('is stable across refactors (snapshot of first phrase per operation)', () => {
    const firsts = Object.fromEntries(
      ALL_OPERATIONS.map((op) => [op, sequenceForOperation(op)[0]] as const),
    );
    // Regenerate this block if the pool order or hash function changes.
    // The point is to fail loudly when determinism changes, so callers
    // notice before snapshot-tested UI drifts silently.
    expect(firsts).toMatchSnapshot();
  });
});

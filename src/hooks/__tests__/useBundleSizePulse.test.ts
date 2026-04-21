import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBundleSizePulse } from '../useBundleSizePulse';
import {
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
} from '../../types/canonical';

function makeSet(totalNoteKb: number): EvidenceSet {
  return {
    caseId: asCaseId('c1'),
    investigationId: asInvestigationId('i1'),
    items: [
      {
        blockId: asBlockId('b1'),
        pinnedAt: 0,
        pinnedBy: 'user',
        order: 0,
        note: 'x'.repeat(Math.max(0, totalNoteKb) * 1024),
      },
    ],
  };
}

describe('useBundleSizePulse', () => {
  it('returns 0 size and key when evidence set is null', () => {
    const { result } = renderHook(() => useBundleSizePulse(null));
    expect(result.current.sizeBytes).toBe(0);
    expect(result.current.pulseKey).toBe(0);
  });

  it('reports byte length using TextEncoder (not code-unit count)', () => {
    const set = makeSet(50);
    const { result } = renderHook(() => useBundleSizePulse(set));
    // At least 50 KB of notes + some JSON overhead
    expect(result.current.sizeBytes).toBeGreaterThan(50 * 1024);
  });

  it('counts multi-byte characters correctly (TextEncoder byteLength)', () => {
    // Each '中' is 3 bytes in UTF-8 but 1 JS string code-unit.
    // JSON.stringify adds quotes + whitespace; we mainly check the
    // hook uses byteLength, which produces a size > code-unit length.
    const set: EvidenceSet = {
      caseId: asCaseId('c1'),
      investigationId: asInvestigationId('i1'),
      items: [
        {
          blockId: asBlockId('b1'),
          pinnedAt: 0,
          pinnedBy: 'user',
          order: 0,
          note: '中'.repeat(1000), // 1000 chars = 3000 bytes UTF-8
        },
      ],
    };
    const jsonStr = JSON.stringify(set);
    const { result } = renderHook(() => useBundleSizePulse(set));
    // byteLength > string length proves TextEncoder is used
    expect(result.current.sizeBytes).toBeGreaterThan(jsonStr.length);
    expect(result.current.sizeBytes).toBeGreaterThan(3000);
  });

  it('pulseKey stays stable across rerenders within the same 100KB bucket', () => {
    const { result, rerender } = renderHook(
      ({ set }: { set: EvidenceSet }) => useBundleSizePulse(set),
      { initialProps: { set: makeSet(10) } },
    );
    const initialKey = result.current.pulseKey;
    rerender({ set: makeSet(20) });
    expect(result.current.pulseKey).toBe(initialKey);
    rerender({ set: makeSet(50) });
    expect(result.current.pulseKey).toBe(initialKey);
  });

  it('pulseKey bumps after a 100KB boundary crossing (effect-based)', () => {
    const { result, rerender } = renderHook(
      ({ set }: { set: EvidenceSet }) => useBundleSizePulse(set),
      { initialProps: { set: makeSet(10) } },
    );
    const initialKey = result.current.pulseKey;

    // Cross the 100 KB threshold
    act(() => {
      rerender({ set: makeSet(150) });
    });

    expect(result.current.pulseKey).toBeGreaterThan(initialKey);
  });

  it('pulseKey does not bump during render (no render-time side effect)', () => {
    // This is hard to observe directly, but we can assert:
    // 1) First render returns pulseKey 0 (effect hasn't run yet AT ALL
    //    when there's no state change to observe).
    // 2) Rerendering with the SAME set does not grow pulseKey.
    const set = makeSet(50);
    const { result, rerender } = renderHook(
      ({ s }: { s: EvidenceSet }) => useBundleSizePulse(s),
      { initialProps: { s: set } },
    );
    const firstKey = result.current.pulseKey;
    rerender({ s: set });
    rerender({ s: set });
    rerender({ s: set });
    expect(result.current.pulseKey).toBe(firstKey);
  });
});

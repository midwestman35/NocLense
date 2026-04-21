/**
 * useBundleSizePulse — emits a monotonic key that bumps every time the
 * serialized EvidenceSet size crosses a 100 KB boundary. Consumers use
 * the key as React `key` prop to re-trigger an entry animation on the
 * evidence badge per spec §5.4.
 *
 * Phase 05 Commit 4 implementation notes (post-v2 Codex yellows):
 *   - Byte count via TextEncoder.encode(...).byteLength rather than
 *     JSON.stringify(...).length, which would count UTF-16 code units
 *     and misreport multi-byte characters.
 *   - pulseKey is bumped inside a useEffect (not during render) so
 *     there is no render-time side effect.
 *   - Size is memoized on the evidence set reference; incidental
 *     rerenders from unrelated parent state do not re-serialize.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceSet } from '../types/canonical';

const BOUNDARY_BYTES = 100 * 1024;

export interface UseBundleSizePulseResult {
  /** Serialized evidence set size in bytes (UTF-8). */
  sizeBytes: number;
  /** Bumps once per 100 KB boundary crossing. Use as React `key` to replay a keyframe. */
  pulseKey: number;
}

function safeByteLength(set: EvidenceSet | null): number {
  if (!set) return 0;
  try {
    return new TextEncoder().encode(JSON.stringify(set)).byteLength;
  } catch {
    return 0;
  }
}

export function useBundleSizePulse(
  evidenceSet: EvidenceSet | null,
): UseBundleSizePulseResult {
  const sizeBytes = useMemo(() => safeByteLength(evidenceSet), [evidenceSet]);

  const [pulseKey, setPulseKey] = useState(0);
  const lastBucketRef = useRef(Math.floor(sizeBytes / BOUNDARY_BYTES));

  useEffect(() => {
    const bucket = Math.floor(sizeBytes / BOUNDARY_BYTES);
    if (bucket !== lastBucketRef.current) {
      lastBucketRef.current = bucket;
      setPulseKey((k) => k + 1);
    }
  }, [sizeBytes]);

  return { sizeBytes, pulseKey };
}

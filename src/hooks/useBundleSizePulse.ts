/**
 * useBundleSizePulse — emits a key that changes every time the
 * serialized EvidenceSet size crosses a 100 KB boundary. Consumers use
 * the key as React `key` prop to re-trigger an entry animation on the
 * evidence badge per spec §5.4.
 *
 * Phase 05 Commit 4 implementation (post-Codex follow-up): fully
 * derived — no useState, no useEffect, no ref mutation in render. The
 * pulseKey IS the bucket number (Math.floor(sizeBytes / 100 KB)),
 * which trivially satisfies the "same bucket → same key" and
 * "boundary crossing → new key" contracts without any React state.
 *
 * Byte count uses TextEncoder.encode(...).byteLength (UTF-8) rather
 * than JSON.stringify(...).length, which would count UTF-16 code units
 * and misreport multi-byte characters.
 *
 * Size is memoized on the evidence set reference; incidental rerenders
 * from unrelated parent state do not re-serialize.
 */

import { useMemo } from 'react';
import type { EvidenceSet } from '../types/canonical';

const BOUNDARY_BYTES = 100 * 1024;

export interface UseBundleSizePulseResult {
  /** Serialized evidence set size in bytes (UTF-8). */
  sizeBytes: number;
  /** Changes at every 100 KB boundary crossing. Use as React `key` to replay a keyframe. */
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
  const pulseKey = Math.floor(sizeBytes / BOUNDARY_BYTES);
  return { sizeBytes, pulseKey };
}

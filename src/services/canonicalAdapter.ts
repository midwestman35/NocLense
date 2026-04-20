/**
 * canonicalAdapter.ts — contract between Unleashed AI responses and the
 * canonical Investigation schema.
 *
 * Phase 00 deliverable: interface only. Phase 01b implements the adapter
 * by calling `unleashService.diagnose()` and mapping the response into a
 * stream of canonical Blocks via the stage pipeline.
 *
 * The adapter is the ONE place that knows how to translate free-form AI
 * output into the canonical discriminated union. UI surfaces consume the
 * canonical types only — they never see raw Unleashed payloads.
 */

import type { Block, Citation, Investigation } from '../types/canonical';

export type DiagnoseStage =
  | 'ingest'
  | 'pattern'
  | 'hypothesize'
  | 'collect'
  | 'analyze'
  | 'act';

export interface StageStartEvent {
  kind: 'stage-start';
  stage: DiagnoseStage;
  at: number;
}

export interface StageCompleteEvent {
  kind: 'stage-complete';
  stage: DiagnoseStage;
  at: number;
  /** Blocks produced by this stage, ready to insert into Investigation.blocks. */
  producedBlocks: Block[];
  /** New citations produced by this stage, keyed for merge into investigation.citations. */
  producedCitations: Citation[];
}

export interface AdapterErrorEvent {
  kind: 'error';
  stage?: DiagnoseStage;
  at: number;
  message: string;
  cause?: unknown;
}

export interface AdapterCompleteEvent {
  kind: 'complete';
  at: number;
  investigation: Investigation;
}

export type AdapterEvent =
  | StageStartEvent
  | StageCompleteEvent
  | AdapterErrorEvent
  | AdapterCompleteEvent;

export interface DiagnoseAdapterInput {
  ticketUrl: string;
  /** Pre-fetched Zendesk context or undefined to let the adapter fetch. */
  seedContext?: string;
  /** Unix ms timestamp used as creation time. Defaults to Date.now(). */
  now?: number;
  /** Abort signal for user-initiated cancel. */
  signal?: AbortSignal;
}

/**
 * Adapter signature: produces an async-iterable of events. UI consumes events
 * to update the stage bar and block renderer incrementally. Phase 01b renders
 * blocks as they arrive (typewriter reveal) but all arrive together today
 * because Unleashed is request-response.
 *
 * Phase 05+ may swap in a truly streaming implementation without changing
 * this contract.
 */
export interface CanonicalDiagnoseAdapter {
  diagnose(input: DiagnoseAdapterInput): AsyncIterable<AdapterEvent>;
}

/**
 * Response-contract assertion helpers. Phase 01b will use these to validate
 * Unleashed responses conform to expectations before attempting to map them.
 * Phase 00 exports the contract only — no runtime behavior yet.
 */
export interface ExpectedUnleashResponseShape {
  /** We expect at least one of these top-level fields on every Diagnose response. */
  summary?: string;
  rootCause?: string;
  hypotheses?: unknown;
  correlatedLogs?: unknown;
  logSuggestions?: unknown;
  appliedTroubleshooting?: string;
  rawResponse?: string;
}

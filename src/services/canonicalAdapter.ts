/**
 * canonicalAdapter.ts — contract between Unleashed AI responses and the
 * canonical Investigation schema.
 *
 * Phase 00 deliverable: contract + intermediate shapes. Phase 01b
 * implements by mapping Unleashed responses through the stage pipeline.
 *
 * Separation of concerns:
 *   - Validator: parses `unknown` (raw HTTP body) → `UnleashResponseShape`
 *     with structural guarantees. Throws on failure.
 *   - Adapter: takes validated `UnleashResponseShape` → stream of
 *     stage-typed canonical Blocks.
 *
 * The adapter is the ONE place that knows how to translate AI output
 * into canonical types. Consumers see canonical types only.
 */

import type {
  BlockOf,
  Citation,
  Investigation,
} from '../types/canonical';

// ─── Stage → allowed block kinds (enforced at the type level) ────────────

export type DiagnoseStage =
  | 'ingest'
  | 'pattern'
  | 'hypothesize'
  | 'collect'
  | 'analyze'
  | 'act';

/**
 * Each stage produces blocks of exactly one kind. This map makes the
 * constraint checkable at compile time and prevents accidentally emitting
 * (e.g.) a `hypothesis` block from the `ingest` stage.
 */
export type StageBlockKindMap = {
  ingest: 'context';
  pattern: 'prior-art';
  hypothesize: 'hypothesis';
  collect: 'collection';
  analyze: 'analysis';
  act: 'action';
};

export type BlocksProducedByStage<S extends DiagnoseStage> = Array<
  BlockOf<StageBlockKindMap[S]>
>;

// ─── Adapter events ──────────────────────────────────────────────────────

export interface StageStartEvent<S extends DiagnoseStage = DiagnoseStage> {
  kind: 'stage-start';
  stage: S;
  at: number;
}

export interface StageCompleteEvent<S extends DiagnoseStage = DiagnoseStage> {
  kind: 'stage-complete';
  stage: S;
  at: number;
  /**
   * Blocks produced by this stage. Typed to the exact kind the stage
   * is allowed to emit (see StageBlockKindMap).
   */
  producedBlocks: BlocksProducedByStage<S>;
  /** New citations produced by this stage, keyed into the investigation's citation pool. */
  producedCitations: Citation[];
  /**
   * Merge semantics for reruns. On a fresh diagnose this is 'append'.
   * On log-attach or refine reruns, later stages may replace prior
   * outputs of the same stage (e.g. analyze runs again against new logs).
   */
  merge: 'append' | 'replace-stage-output';
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
  | StageCompleteEvent<DiagnoseStage>
  | AdapterErrorEvent
  | AdapterCompleteEvent;

// ─── Adapter input — supports fresh + rerun modes ────────────────────────

/**
 * Diagnose mode, discriminated. Phase 01b handles 'fresh'; 'attach-logs'
 * and 'refine' land in Phase 02 and 01b respectively.
 */
export type DiagnoseMode =
  | {
      kind: 'fresh';
      ticketUrl: string;
      /** Optional pre-fetched Zendesk context to skip Stage 0 fetch. */
      seedContext?: string;
    }
  | {
      kind: 'attach-logs';
      /** The investigation already produced by a prior fresh run. */
      priorInvestigation: Investigation;
      /** Logs that just arrived — triggers re-run of stages 3/4. */
      attachedLogs: Array<{ fileName: string; byteCount: number }>;
    }
  | {
      kind: 'refine';
      priorInvestigation: Investigation;
      /** The user's follow-up question that refines analysis. */
      question: string;
    };

export interface DiagnoseAdapterInput {
  mode: DiagnoseMode;
  /** Unix ms timestamp used as creation time. Defaults to Date.now(). */
  now?: number;
  /** Abort signal for user-initiated cancel. */
  signal?: AbortSignal;
}

/**
 * Adapter signature: async-iterable of events. UI consumes events to
 * update the stage bar and block renderer incrementally. Phase 01b's
 * implementation yields all events at once because Unleashed is
 * request-response; Phase 05+ may swap in a streaming backend without
 * changing this contract.
 */
export interface CanonicalDiagnoseAdapter {
  diagnose(input: DiagnoseAdapterInput): AsyncIterable<AdapterEvent>;
}

// ─── Validator contract (separate from narrowing type guards) ────────────

/**
 * Intermediate shape — what the adapter requires the validated Unleashed
 * response to look like. Structural, not behavioral. Replaces the
 * loose `ExpectedUnleashResponseShape` from the Phase 00 first cut.
 *
 * Phase 01b's validator parses the raw HTTP response body against this
 * shape and throws on structural failure. The adapter trusts this shape;
 * downstream narrowing happens via canonical type guards.
 */
export interface UnleashResponseShape {
  summary: string;
  rootCause: string;
  hypotheses: UnleashHypothesis[];
  correlatedLogs: UnleashCorrelatedLog[];
  logSuggestions: UnleashLogSuggestion[];
  appliedTroubleshooting: string;
  /** Verbatim assistant text for audit / .noclense export. */
  rawResponse: string;
}

export interface UnleashHypothesis {
  rank: 1 | 2 | 3;
  title: string;
  supportingEvidence: string;
  evidenceToConfirm: string;
  evidenceToRuleOut: string;
  statusHint?: 'INCONCLUSIVE' | 'CONFIRMED' | 'RULED_OUT';
}

export interface UnleashCorrelatedLog {
  /** Session-scoped LogEntry.id. Resolved to a persisted citation locator by the adapter. */
  logId: number;
  index: number;
  reason: string;
}

export interface UnleashLogSuggestion {
  source: string;
  reason: string;
  query?: string;
}

/**
 * Validator contract. Phase 01b implements. Phase 00 exports the shape.
 */
export interface UnleashResponseValidator {
  /**
   * @throws StructuralValidationError when `raw` does not match the
   *         expected shape. The adapter is responsible for surfacing the
   *         failure as an AdapterErrorEvent.
   */
  validate(raw: unknown): UnleashResponseShape;
}

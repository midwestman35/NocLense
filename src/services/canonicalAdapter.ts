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

import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCitationId,
  asInvestigationId,
  type Block,
  type BlockId,
  type BlockOf,
  type Citation,
  type CitationId,
  type CitationSource,
  type Investigation,
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

// ═══ Phase 01b implementations ═══════════════════════════════════════════

/** Thrown by validateUnleashResponse with a path-precise message. */
export class StructuralValidationError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`${message} at ${path}`);
    this.name = 'StructuralValidationError';
    this.path = path;
  }
}

function vAssert(cond: unknown, message: string, path: string): asserts cond {
  if (!cond) throw new StructuralValidationError(message, path);
}

function vIsRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function vOptionalString(v: unknown, path: string): string {
  if (v === undefined || v === null) return '';
  vAssert(typeof v === 'string', 'expected string or missing', path);
  return v;
}

function vIsNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * Validates a raw HTTP response body (or a loose DiagnosisResult) into
 * a strict UnleashResponseShape.
 *
 * Graceful defaults:
 *   - Missing arrays → empty array (hypotheses, correlatedLogs,
 *     logSuggestions).
 *   - Missing strings → empty string (summary, rootCause,
 *     appliedTroubleshooting, rawResponse).
 *
 * Strict checks:
 *   - Top-level must be an object.
 *   - Array fields, if present, must actually be arrays.
 *   - Hypothesis rank must be 1 | 2 | 3 (no coercion).
 *   - Correlated log `logId` and `index` must be non-negative integers.
 */
export function validateUnleashResponse(raw: unknown): UnleashResponseShape {
  vAssert(vIsRecord(raw), 'not an object', '$');

  const hypothesesRaw = raw.hypotheses;
  const hypotheses: UnleashHypothesis[] = [];
  if (hypothesesRaw !== undefined) {
    vAssert(Array.isArray(hypothesesRaw), 'not an array', '$.hypotheses');
    for (let i = 0; i < hypothesesRaw.length; i++) {
      const h = hypothesesRaw[i];
      const path = `$.hypotheses[${i}]`;
      vAssert(vIsRecord(h), 'not an object', path);
      vAssert(
        h.rank === 1 || h.rank === 2 || h.rank === 3,
        'rank must be 1 | 2 | 3',
        `${path}.rank`,
      );
      const statusHint = h.statusHint;
      if (statusHint !== undefined) {
        vAssert(
          statusHint === 'CONFIRMED' ||
            statusHint === 'RULED_OUT' ||
            statusHint === 'INCONCLUSIVE',
          'statusHint must be CONFIRMED | RULED_OUT | INCONCLUSIVE',
          `${path}.statusHint`,
        );
      }
      hypotheses.push({
        rank: h.rank,
        title: vOptionalString(h.title, `${path}.title`),
        supportingEvidence: vOptionalString(h.supportingEvidence, `${path}.supportingEvidence`),
        evidenceToConfirm: vOptionalString(h.evidenceToConfirm, `${path}.evidenceToConfirm`),
        evidenceToRuleOut: vOptionalString(h.evidenceToRuleOut, `${path}.evidenceToRuleOut`),
        statusHint: statusHint as UnleashHypothesis['statusHint'],
      });
    }
  }

  const correlatedRaw = raw.correlatedLogs;
  const correlatedLogs: UnleashCorrelatedLog[] = [];
  if (correlatedRaw !== undefined) {
    vAssert(Array.isArray(correlatedRaw), 'not an array', '$.correlatedLogs');
    for (let i = 0; i < correlatedRaw.length; i++) {
      const c = correlatedRaw[i];
      const path = `$.correlatedLogs[${i}]`;
      vAssert(vIsRecord(c), 'not an object', path);
      vAssert(
        vIsNonNegativeInteger(c.logId),
        'logId must be a non-negative integer',
        `${path}.logId`,
      );
      vAssert(
        vIsNonNegativeInteger(c.index),
        'index must be a non-negative integer',
        `${path}.index`,
      );
      correlatedLogs.push({
        logId: c.logId,
        index: c.index,
        reason: vOptionalString(c.reason, `${path}.reason`),
      });
    }
  }

  const suggRaw = raw.logSuggestions;
  const logSuggestions: UnleashLogSuggestion[] = [];
  if (suggRaw !== undefined) {
    vAssert(Array.isArray(suggRaw), 'not an array', '$.logSuggestions');
    for (let i = 0; i < suggRaw.length; i++) {
      const s = suggRaw[i];
      const path = `$.logSuggestions[${i}]`;
      vAssert(vIsRecord(s), 'not an object', path);
      logSuggestions.push({
        source: vOptionalString(s.source, `${path}.source`),
        reason: vOptionalString(s.reason, `${path}.reason`),
        query: s.query === undefined ? undefined : vOptionalString(s.query, `${path}.query`),
      });
    }
  }

  return {
    summary: vOptionalString(raw.summary, '$.summary'),
    rootCause: vOptionalString(raw.rootCause, '$.rootCause'),
    hypotheses,
    correlatedLogs,
    logSuggestions,
    appliedTroubleshooting: vOptionalString(raw.appliedTroubleshooting, '$.appliedTroubleshooting'),
    rawResponse: vOptionalString(raw.rawResponse, '$.rawResponse'),
  };
}

/** Source-locator for a correlated log. Returned by the caller's resolver. */
export interface ResolvedLogLocator {
  fileName: string;
  lineNumber: number;
  byteOffset: number;
}

export interface BuildInvestigationInput {
  response: UnleashResponseShape;
  ticketUrl?: string;
  /**
   * Customer name for ContextBody (§5.1 required field). Defaults to
   * '(unknown customer)' when the caller can't resolve one.
   */
  customer?: string;
  /** Investigation id. Defaults to a fresh UUID via idFactory. */
  investigationId?: string;
  /** UUID source. Defaults to globalThis.crypto.randomUUID. Inject for tests. */
  idFactory?: () => string;
  /** Clock source. Defaults to Date.now. */
  now?: () => number;
  /**
   * Resolves an Unleash logId + prompt index to a persisted citation
   * locator. Returning null skips that citation entirely — the log
   * ref is lost but the response still produces a usable Investigation.
   */
  resolveLogLocator?: (logId: number, index: number) => ResolvedLogLocator | null;
}

/**
 * Build a canonical Investigation from a validated Unleash response.
 *
 * Mapping (v1 approximation per spec §5.2):
 *   - Context:    single block; `customer`, `ticketUrl`, `reported`
 *                 (reported is `summary` truncated to 280 chars).
 *   - Prior Art:  none — the current Unleash prompt doesn't emit
 *                 structured prior-art rows. Added in Phase 01b.3+
 *                 when the prompt grows.
 *   - Hypotheses: one block per UnleashHypothesis, mapping rank /
 *                 title / supportingEvidence / evidenceToConfirm /
 *                 evidenceToRuleOut / status (default INCONCLUSIVE).
 *   - Collection: single block with one step per logSuggestion.
 *                 Omitted when no suggestions.
 *   - Analysis:   one block per Hypothesis. The rank-1 hypothesis
 *                 gets `summary = rootCause || summary` and all
 *                 resolved correlated-log citations. Other ranks get
 *                 a placeholder until per-hypothesis analysis lands.
 *   - Action:     single block, kind='resolve', summary =
 *                 appliedTroubleshooting || rootCause || summary.
 *
 * Deterministic when both `idFactory` and `now` are injected — tests
 * lock the output without snapshot fragility.
 */
export function buildInvestigationFromResponse(input: BuildInvestigationInput): Investigation {
  const now = input.now ?? Date.now;
  const idFactory = input.idFactory ?? (() => globalThis.crypto.randomUUID());
  const createdAt = now();
  const customer = input.customer ?? '(unknown customer)';
  const investigationId = asInvestigationId(input.investigationId ?? idFactory());

  // ─── Citations pool (from correlatedLogs that resolve a locator) ───────
  const citations: Record<CitationId, Citation> = {};
  const citationIdsInOrder: CitationId[] = [];
  for (const cl of input.response.correlatedLogs) {
    const locator = input.resolveLogLocator?.(cl.logId, cl.index);
    if (!locator) continue;
    const id = asCitationId(idFactory());
    const source: CitationSource = {
      kind: 'log',
      fileName: locator.fileName,
      lineNumber: locator.lineNumber,
      byteOffset: locator.byteOffset,
    };
    citations[id] = {
      id,
      displayText: `${locator.fileName}:${locator.lineNumber}`,
      source,
      createdAt,
    };
    citationIdsInOrder.push(id);
  }

  const blocks: Block[] = [];

  // ─── Context ───────────────────────────────────────────────────────────
  blocks.push({
    id: asBlockId(idFactory()),
    kind: 'context',
    createdAt,
    updatedAt: createdAt,
    citations: [],
    body: {
      customer,
      ticketUrl: input.ticketUrl,
      reported: truncate(input.response.summary, 280),
    },
  });

  // ─── Hypotheses ────────────────────────────────────────────────────────
  const hypothesisBlocks: Array<{
    blockId: BlockId;
    hypothesis: UnleashHypothesis;
  }> = [];
  for (const h of input.response.hypotheses) {
    const id = asBlockId(idFactory());
    hypothesisBlocks.push({ blockId: id, hypothesis: h });
    blocks.push({
      id,
      kind: 'hypothesis',
      createdAt,
      updatedAt: createdAt,
      citations: [],
      body: {
        rank: h.rank,
        title: h.title,
        supportingEvidence: h.supportingEvidence,
        evidenceToConfirm: h.evidenceToConfirm,
        evidenceToRuleOut: h.evidenceToRuleOut,
        status: h.statusHint ?? 'INCONCLUSIVE',
      },
    });
  }

  // ─── Collection (optional) ─────────────────────────────────────────────
  if (input.response.logSuggestions.length > 0) {
    blocks.push({
      id: asBlockId(idFactory()),
      kind: 'collection',
      createdAt,
      updatedAt: createdAt,
      citations: [],
      body: {
        steps: input.response.logSuggestions.map((s) => ({
          label: s.source ? `${s.source}: ${s.reason}` : s.reason,
          command: s.query,
        })),
      },
    });
  }

  // ─── Analysis — one per hypothesis ─────────────────────────────────────
  // Rank-1 hypothesis receives the correlated-log citations and the
  // substantive summary. Others get placeholders — per-hypothesis
  // analysis relies on richer Unleash prompting (Phase 01b.3+).
  let topRankHypothesisId: BlockId | null = null;
  let topRankValue = Number.POSITIVE_INFINITY;
  for (const { blockId, hypothesis } of hypothesisBlocks) {
    if (hypothesis.rank < topRankValue) {
      topRankHypothesisId = blockId;
      topRankValue = hypothesis.rank;
    }
  }
  const topRankSummary =
    input.response.rootCause ||
    input.response.summary ||
    'No analysis produced by the AI response.';
  for (const { blockId, hypothesis } of hypothesisBlocks) {
    const isTop = blockId === topRankHypothesisId;
    blocks.push({
      id: asBlockId(idFactory()),
      kind: 'analysis',
      createdAt,
      updatedAt: createdAt,
      citations: isTop ? citationIdsInOrder.slice() : [],
      body: {
        hypothesisBlockId: blockId,
        statusUpdate: hypothesis.statusHint ?? 'INCONCLUSIVE',
        summary: isTop ? topRankSummary : 'Further investigation needed.',
      },
    });
  }

  // ─── Action ────────────────────────────────────────────────────────────
  const actionSummary =
    input.response.appliedTroubleshooting ||
    input.response.rootCause ||
    input.response.summary ||
    'Recommend further investigation.';
  blocks.push({
    id: asBlockId(idFactory()),
    kind: 'action',
    createdAt,
    updatedAt: createdAt,
    citations: [],
    body: {
      summary: actionSummary,
      payload: {
        kind: 'resolve',
        resolutionNote: actionSummary,
        tags: [],
      },
    },
  });

  return {
    schemaVersion: INVESTIGATION_SCHEMA_VERSION,
    id: investigationId,
    ticketUrl: input.ticketUrl,
    createdAt,
    updatedAt: createdAt,
    blocks,
    citations,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

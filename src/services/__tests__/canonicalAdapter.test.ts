/**
 * canonicalAdapter.test.ts — Phase 01b.1 tests for the validator and
 * the Investigation builder. Pure functions, deterministic via
 * injected idFactory + now.
 */

import { describe, expect, it } from 'vitest';
import {
  StructuralValidationError,
  buildInvestigationFromResponse,
  validateUnleashResponse,
  type ResolvedLogLocator,
  type UnleashResponseShape,
} from '../canonicalAdapter';
import {
  INVESTIGATION_SCHEMA_VERSION,
  isBlockOfKind,
  type BlockKind,
  type CitationOf,
} from '../../types/canonical';

// ─── validateUnleashResponse ───────────────────────────────────────────

describe('validateUnleashResponse', () => {
  it('coerces a full minimal DiagnosisResult-shaped object', () => {
    const raw = {
      summary: 'Call dropped on station 42',
      rootCause: 'PBX registration failure',
      appliedTroubleshooting: 'Re-registered extension 4201',
      rawResponse: '```json\n{...}\n```',
    };
    const shape = validateUnleashResponse(raw);
    expect(shape.summary).toBe('Call dropped on station 42');
    expect(shape.rootCause).toBe('PBX registration failure');
    expect(shape.hypotheses).toEqual([]);
    expect(shape.correlatedLogs).toEqual([]);
    expect(shape.logSuggestions).toEqual([]);
    expect(shape.appliedTroubleshooting).toBe('Re-registered extension 4201');
    expect(shape.rawResponse).toBe('```json\n{...}\n```');
  });

  it('accepts rich hypotheses / correlatedLogs / logSuggestions arrays', () => {
    const raw = {
      summary: 'x',
      rootCause: 'y',
      hypotheses: [
        {
          rank: 1,
          title: 'PBX reg failure',
          supportingEvidence: 'e1',
          evidenceToConfirm: 'c1',
          evidenceToRuleOut: 'r1',
          statusHint: 'INCONCLUSIVE',
        },
      ],
      correlatedLogs: [{ logId: 142, index: 3, reason: 'ERROR at t0' }],
      logSuggestions: [{ source: 'Datadog', reason: 'pull last 1h', query: 'service:pbx' }],
      appliedTroubleshooting: 't',
      rawResponse: 'r',
    };
    const shape = validateUnleashResponse(raw);
    expect(shape.hypotheses).toHaveLength(1);
    expect(shape.hypotheses[0].rank).toBe(1);
    expect(shape.correlatedLogs[0].logId).toBe(142);
    expect(shape.logSuggestions[0].query).toBe('service:pbx');
  });

  it('throws on top-level non-object', () => {
    expect(() => validateUnleashResponse('oops')).toThrow(StructuralValidationError);
    expect(() => validateUnleashResponse(null)).toThrow(/\$/);
    expect(() => validateUnleashResponse([])).toThrow(/\$/);
  });

  it('throws with path-precise error on bad hypothesis.rank', () => {
    const raw = {
      hypotheses: [
        {
          rank: 5,
          title: 't',
          supportingEvidence: 'e',
          evidenceToConfirm: 'c',
          evidenceToRuleOut: 'r',
        },
      ],
    };
    expect(() => validateUnleashResponse(raw)).toThrow(/\$\.hypotheses\[0\]\.rank/);
  });

  it('throws on bad correlated log id type', () => {
    const raw = { correlatedLogs: [{ logId: 'not-a-number', index: 1, reason: 'x' }] };
    expect(() => validateUnleashResponse(raw)).toThrow(/\$\.correlatedLogs\[0\]\.logId/);
  });

  it('throws on non-array hypotheses when present', () => {
    expect(() => validateUnleashResponse({ hypotheses: 'no' })).toThrow(
      /\$\.hypotheses/,
    );
  });

  it('rejects statusHint values outside the canonical set', () => {
    const raw = {
      hypotheses: [
        {
          rank: 1,
          title: 't',
          supportingEvidence: 'e',
          evidenceToConfirm: 'c',
          evidenceToRuleOut: 'r',
          statusHint: 'UNKNOWN',
        },
      ],
    };
    expect(() => validateUnleashResponse(raw)).toThrow(/statusHint must be/);
  });

  it('StructuralValidationError exposes the `path` field', () => {
    try {
      validateUnleashResponse(42);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(StructuralValidationError);
      expect((err as StructuralValidationError).path).toBe('$');
    }
  });
});

// ─── buildInvestigationFromResponse ───────────────────────────────────

/** Deterministic idFactory for tests — monotonically increasing stable IDs. */
function makeIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(++n).toString().padStart(3, '0')}`;
}

const FIXED_NOW = 1_745_000_000_000;

function baseInput(response: UnleashResponseShape) {
  return {
    response,
    ticketUrl: 'https://carbyne.zendesk.com/agent/tickets/45892',
    customer: 'Acme PSAP',
    idFactory: makeIdFactory('id'),
    now: () => FIXED_NOW,
  };
}

const EMPTY_RESPONSE: UnleashResponseShape = {
  summary: '',
  rootCause: '',
  hypotheses: [],
  correlatedLogs: [],
  logSuggestions: [],
  appliedTroubleshooting: '',
  rawResponse: '',
};

describe('buildInvestigationFromResponse — structural shape', () => {
  it('always produces a Context block and an Action block', () => {
    const inv = buildInvestigationFromResponse(baseInput(EMPTY_RESPONSE));
    expect(inv.schemaVersion).toBe(INVESTIGATION_SCHEMA_VERSION);
    const kinds = inv.blocks.map((b) => b.kind);
    expect(kinds[0]).toBe('context');
    expect(kinds[kinds.length - 1]).toBe('action');
  });

  it('Context carries customer + ticketUrl from input', () => {
    const inv = buildInvestigationFromResponse(baseInput(EMPTY_RESPONSE));
    const context = inv.blocks.find((b) => b.kind === 'context')!;
    if (!isBlockOfKind(context, 'context')) throw new Error('unreachable');
    expect(context.body.customer).toBe('Acme PSAP');
    expect(context.body.ticketUrl).toBe('https://carbyne.zendesk.com/agent/tickets/45892');
  });

  it('defaults customer to "(unknown customer)" when not supplied', () => {
    const inv = buildInvestigationFromResponse({
      response: EMPTY_RESPONSE,
      idFactory: makeIdFactory('id'),
      now: () => FIXED_NOW,
    });
    const context = inv.blocks.find((b) => b.kind === 'context')!;
    if (!isBlockOfKind(context, 'context')) throw new Error('unreachable');
    expect(context.body.customer).toBe('(unknown customer)');
  });

  it('truncates very long summary to ≤280 chars in context.reported', () => {
    const summary = 'x'.repeat(500);
    const inv = buildInvestigationFromResponse(
      baseInput({ ...EMPTY_RESPONSE, summary }),
    );
    const context = inv.blocks.find((b) => b.kind === 'context')!;
    if (!isBlockOfKind(context, 'context')) throw new Error('unreachable');
    expect(context.body.reported).toBeDefined();
    expect(context.body.reported!.length).toBeLessThanOrEqual(280);
    expect(context.body.reported!.endsWith('…')).toBe(true);
  });

  it('emits one Hypothesis block per Unleash hypothesis, preserving rank', () => {
    const inv = buildInvestigationFromResponse(
      baseInput({
        ...EMPTY_RESPONSE,
        hypotheses: [
          { rank: 1, title: 'A', supportingEvidence: 'e1', evidenceToConfirm: 'c1', evidenceToRuleOut: 'r1' },
          { rank: 2, title: 'B', supportingEvidence: 'e2', evidenceToConfirm: 'c2', evidenceToRuleOut: 'r2' },
          { rank: 3, title: 'C', supportingEvidence: 'e3', evidenceToConfirm: 'c3', evidenceToRuleOut: 'r3' },
        ],
      }),
    );
    const hyps = inv.blocks.filter((b) => b.kind === 'hypothesis');
    expect(hyps).toHaveLength(3);
    for (const h of hyps) if (isBlockOfKind(h, 'hypothesis')) {
      expect(['A', 'B', 'C']).toContain(h.body.title);
      expect(h.body.status).toBe('INCONCLUSIVE');
    }
  });

  it('emits a Collection block only when there are logSuggestions', () => {
    const withoutSuggs = buildInvestigationFromResponse(baseInput(EMPTY_RESPONSE));
    expect(withoutSuggs.blocks.some((b) => b.kind === 'collection')).toBe(false);

    const withSuggs = buildInvestigationFromResponse(
      baseInput({
        ...EMPTY_RESPONSE,
        logSuggestions: [
          { source: 'Datadog', reason: 'pull last hour', query: 'service:pbx' },
          { source: 'HOMER', reason: 'SIP captures for callId' },
        ],
      }),
    );
    const collection = withSuggs.blocks.find((b) => b.kind === 'collection');
    if (!collection || !isBlockOfKind(collection, 'collection')) {
      throw new Error('expected a collection block');
    }
    expect(collection.body.steps).toHaveLength(2);
    expect(collection.body.steps[0].label).toContain('Datadog');
    expect(collection.body.steps[0].command).toBe('service:pbx');
  });

  it('emits one Analysis block per Hypothesis; rank-1 gets citations', () => {
    const resolveLogLocator = (): ResolvedLogLocator => ({
      fileName: 'log.txt',
      lineNumber: 14382,
      byteOffset: 820_123,
    });
    const inv = buildInvestigationFromResponse({
      ...baseInput({
        ...EMPTY_RESPONSE,
        rootCause: 'PBX reg failure',
        hypotheses: [
          { rank: 1, title: 'Top', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' },
          { rank: 2, title: 'Alt', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' },
        ],
        correlatedLogs: [
          { logId: 142, index: 1, reason: 'ERROR' },
          { logId: 199, index: 2, reason: 'WARN' },
        ],
      }),
      resolveLogLocator,
    });
    const analyses = inv.blocks.filter((b) => b.kind === 'analysis');
    expect(analyses).toHaveLength(2);
    const [top, alt] = analyses;
    expect(top.citations).toHaveLength(2); // both logs attach to rank-1
    expect(alt.citations).toHaveLength(0);
    if (isBlockOfKind(top, 'analysis')) expect(top.body.summary).toBe('PBX reg failure');
    if (isBlockOfKind(alt, 'analysis')) expect(alt.body.summary).toMatch(/Further investigation/);
  });

  it('skips citations when resolveLogLocator returns null', () => {
    const inv = buildInvestigationFromResponse({
      ...baseInput({
        ...EMPTY_RESPONSE,
        hypotheses: [{ rank: 1, title: 'T', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' }],
        correlatedLogs: [{ logId: 142, index: 1, reason: 'r' }],
      }),
      resolveLogLocator: () => null,
    });
    expect(Object.keys(inv.citations)).toHaveLength(0);
    const analysis = inv.blocks.find((b) => b.kind === 'analysis');
    if (!analysis) throw new Error('expected analysis');
    expect(analysis.citations).toEqual([]);
  });

  it('Action body prefers appliedTroubleshooting > rootCause > summary', () => {
    const inv = buildInvestigationFromResponse(
      baseInput({
        ...EMPTY_RESPONSE,
        summary: 's',
        rootCause: 'rc',
        appliedTroubleshooting: 'at',
      }),
    );
    const action = inv.blocks.find((b) => b.kind === 'action')!;
    if (!isBlockOfKind(action, 'action')) throw new Error('unreachable');
    expect(action.body.summary).toBe('at');
    expect(action.body.payload.kind).toBe('resolve');
  });

  it('Action falls back to rootCause when appliedTroubleshooting is empty', () => {
    const inv = buildInvestigationFromResponse(
      baseInput({ ...EMPTY_RESPONSE, rootCause: 'rc' }),
    );
    const action = inv.blocks.find((b) => b.kind === 'action')!;
    if (!isBlockOfKind(action, 'action')) throw new Error('unreachable');
    expect(action.body.summary).toBe('rc');
  });

  it('Action falls back to the placeholder when every source is empty', () => {
    const inv = buildInvestigationFromResponse(baseInput(EMPTY_RESPONSE));
    const action = inv.blocks.find((b) => b.kind === 'action')!;
    if (!isBlockOfKind(action, 'action')) throw new Error('unreachable');
    expect(action.body.summary).toMatch(/further investigation/i);
  });

  it('is fully deterministic given a deterministic idFactory + now', () => {
    const a = buildInvestigationFromResponse(
      baseInput({
        ...EMPTY_RESPONSE,
        summary: 'A',
        hypotheses: [{ rank: 1, title: 'T', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' }],
      }),
    );
    const b = buildInvestigationFromResponse(
      baseInput({
        ...EMPTY_RESPONSE,
        summary: 'A',
        hypotheses: [{ rank: 1, title: 'T', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' }],
      }),
    );
    expect(a).toEqual(b);
  });

  it('citations are valid Citation objects with a log source', () => {
    const inv = buildInvestigationFromResponse({
      ...baseInput({
        ...EMPTY_RESPONSE,
        hypotheses: [{ rank: 1, title: 'T', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' }],
        correlatedLogs: [{ logId: 7, index: 0, reason: 'r' }],
      }),
      resolveLogLocator: () => ({ fileName: 'log.txt', lineNumber: 100, byteOffset: 5000 }),
    });
    const cits = Object.values(inv.citations) as CitationOf<'log'>[];
    expect(cits).toHaveLength(1);
    expect(cits[0].source.kind).toBe('log');
    expect(cits[0].source.fileName).toBe('log.txt');
    expect(cits[0].displayText).toBe('log.txt:100');
  });
});

describe('Block kind counts per response shape (integration)', () => {
  function kindCounts(blocks: Array<{ kind: BlockKind }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const b of blocks) counts[b.kind] = (counts[b.kind] ?? 0) + 1;
    return counts;
  }

  it('empty response: just Context + Action', () => {
    const inv = buildInvestigationFromResponse(baseInput(EMPTY_RESPONSE));
    expect(kindCounts(inv.blocks)).toEqual({ context: 1, action: 1 });
  });

  it('three hypotheses + two suggestions + one correlated log', () => {
    const inv = buildInvestigationFromResponse({
      ...baseInput({
        ...EMPTY_RESPONSE,
        rootCause: 'rc',
        hypotheses: [
          { rank: 1, title: 'A', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' },
          { rank: 2, title: 'B', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' },
          { rank: 3, title: 'C', supportingEvidence: '', evidenceToConfirm: '', evidenceToRuleOut: '' },
        ],
        logSuggestions: [
          { source: 'Datadog', reason: 'r1' },
          { source: 'HOMER', reason: 'r2' },
        ],
        correlatedLogs: [{ logId: 1, index: 0, reason: 'r' }],
      }),
      resolveLogLocator: () => ({ fileName: 'x.log', lineNumber: 10, byteOffset: 100 }),
    });
    expect(kindCounts(inv.blocks)).toEqual({
      context: 1,
      hypothesis: 3,
      collection: 1,
      analysis: 3,
      action: 1,
    });
  });
});

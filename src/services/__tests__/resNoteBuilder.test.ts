import { describe, expect, it } from 'vitest';
import { buildResNote } from '../resNoteBuilder';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../types/canonical';

const evidenceSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [],
};

const emptyInvestigation: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [],
  citations: {},
};

describe('buildResNote', () => {
  it('marks isDraft=true when no CONFIRMED analysis', () => {
    const { isDraft } = buildResNote(emptyInvestigation, evidenceSet);
    expect(isDraft).toBe(true);
  });

  it('prepends [DRAFT] header when isDraft', () => {
    const { text } = buildResNote(emptyInvestigation, evidenceSet);
    expect(text).toMatch(/^\[DRAFT/);
  });

  it('fills customer from context block', () => {
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: asBlockId('ctx'),
          kind: 'context',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: { customer: 'Acme Corp' },
        },
      ],
    };
    const { text } = buildResNote(inv, evidenceSet);
    expect(text).toContain('Acme Corp');
  });

  it('isDraft=false when analysis block has CONFIRMED status', () => {
    const hId = asBlockId('h1');
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: hId,
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Registration storm',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'CONFIRMED',
          },
        },
        {
          id: asBlockId('a1'),
          kind: 'analysis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            hypothesisBlockId: hId,
            statusUpdate: 'CONFIRMED',
            summary: 'Platform restage resolved the storm.',
          },
        },
      ],
    };
    const { isDraft, text } = buildResNote(inv, evidenceSet);
    expect(isDraft).toBe(false);
    expect(text).not.toMatch(/^\[DRAFT/);
    expect(text).toContain('Registration storm');
    expect(text).toContain('Platform restage resolved');
  });

  it('includes evidence item count', () => {
    const setWith3: EvidenceSet = {
      ...evidenceSet,
      items: [
        { blockId: asBlockId('b1'), pinnedAt: 1, pinnedBy: 'user', order: 0 },
        { blockId: asBlockId('b2'), pinnedAt: 2, pinnedBy: 'ai', order: 1 },
        { blockId: asBlockId('b3'), pinnedAt: 3, pinnedBy: 'user', order: 2 },
      ],
    };
    const { text } = buildResNote(emptyInvestigation, setWith3);
    expect(text).toContain('Evidence Items: 3');
  });

  it('draft path surfaces analysis summary for top hypothesis even when not CONFIRMED', () => {
    const hId = asBlockId('h1');
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: hId,
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Candidate: storm on registration socket',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'INCONCLUSIVE',
          },
        },
        {
          id: asBlockId('a1'),
          kind: 'analysis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            hypothesisBlockId: hId,
            statusUpdate: 'INCONCLUSIVE',
            summary: 'Observed 12 reconnect cycles/min; root cause unverified.',
          },
        },
      ],
    };
    const { isDraft, text } = buildResNote(inv, evidenceSet);
    expect(isDraft).toBe(true);
    expect(text).toContain('Observed 12 reconnect cycles');
    expect(text).not.toContain('(no analysis recorded)');
    expect(text).not.toContain('(analysis pending');
  });

  it('draft path with no analysis shows "analysis pending" marker', () => {
    const inv: Investigation = {
      ...emptyInvestigation,
      blocks: [
        {
          id: asBlockId('h1'),
          kind: 'hypothesis',
          createdAt: 1000,
          updatedAt: 1000,
          citations: [],
          body: {
            rank: 1,
            title: 'Placeholder',
            supportingEvidence: '',
            evidenceToConfirm: '',
            evidenceToRuleOut: '',
            status: 'INCONCLUSIVE',
          },
        },
      ],
    };
    const { text } = buildResNote(inv, evidenceSet);
    expect(text).toContain('(analysis pending for top hypothesis)');
  });
});

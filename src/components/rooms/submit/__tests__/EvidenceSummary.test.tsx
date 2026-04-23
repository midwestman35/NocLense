import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvidenceSummary } from '../EvidenceSummary';
import { useEvidence } from '../../../../contexts/EvidenceContext';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../../../types/canonical';

vi.mock('../../../../contexts/EvidenceContext', () => ({
  useEvidence: vi.fn(),
}));

const investigation: Investigation = {
  schemaVersion: INVESTIGATION_SCHEMA_VERSION,
  id: asInvestigationId('inv-1'),
  createdAt: 1000,
  updatedAt: 1000,
  blocks: [
    {
      id: asBlockId('ctx'),
      kind: 'context',
      createdAt: 1000,
      updatedAt: 1000,
      citations: [],
      body: { customer: 'Carbyne Test' },
    },
    {
      id: asBlockId('hyp-1'),
      kind: 'hypothesis',
      createdAt: 1000,
      updatedAt: 1000,
      citations: [],
      body: {
        rank: 1,
        title: 'Kamailio WSS keepalive regression',
        supportingEvidence: 'Registrar flaps',
        evidenceToConfirm: 'Compare keepalive cadence',
        evidenceToRuleOut: 'Check workstation audio device',
        status: 'CONFIRMED',
      },
    },
  ],
  citations: {},
};

const evidenceSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [
    { blockId: asBlockId('hyp-1'), pinnedAt: 1, pinnedBy: 'user', order: 0, note: 'root cause' },
  ],
};

const mockUseEvidence = vi.mocked(useEvidence);

describe('EvidenceSummary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders captured items from mocked EvidenceContext', () => {
    mockUseEvidence.mockReturnValue({
      investigation,
      evidenceSet,
      loadGeneration: 1,
      setInvestigation: vi.fn(),
      restoreEvidenceSet: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidenceSummary />);

    expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Kamailio WSS keepalive regression')).toBeInTheDocument();
    expect(screen.getByText('root cause')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy jira/i })).toBeEnabled();
  });

  it('renders the empty evidence state', () => {
    mockUseEvidence.mockReturnValue({
      investigation,
      evidenceSet: { ...evidenceSet, items: [] },
      loadGeneration: 1,
      setInvestigation: vi.fn(),
      restoreEvidenceSet: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidenceSummary />);

    expect(screen.getByText(/Capture evidence in Investigate/i)).toBeInTheDocument();
  });
});

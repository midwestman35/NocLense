import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitRoom } from '../SubmitRoom';
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

vi.mock('../../../../services/investigationExporter', () => ({
  buildNoclenseZip: vi.fn(async () => ({ blob: new Blob(['zip']), manifest: {} })),
  noclenseFileName: vi.fn(() => 'carbyne-test-2026-04-23.noclense'),
}));

vi.mock('../../../../services/zipBuilder', () => ({
  downloadBlob: vi.fn(),
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
    {
      id: asBlockId('ana-1'),
      kind: 'analysis',
      createdAt: 1000,
      updatedAt: 1000,
      citations: [],
      body: {
        hypothesisBlockId: asBlockId('hyp-1'),
        statusUpdate: 'CONFIRMED',
        summary: 'Restart stabilized keepalives.',
      },
    },
  ],
  citations: {},
};

const evidenceSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [
    { blockId: asBlockId('hyp-1'), pinnedAt: 1, pinnedBy: 'user', order: 0 },
  ],
};

const mockUseEvidence = vi.mocked(useEvidence);

function mockEvidence(nextEvidenceSet: EvidenceSet | null = evidenceSet, loadGeneration = 1) {
  mockUseEvidence.mockReturnValue({
    investigation,
    evidenceSet: nextEvidenceSet,
    loadGeneration,
    setInvestigation: vi.fn(),
    restoreEvidenceSet: vi.fn(),
    pinBlock: vi.fn(),
    unpinBlock: vi.fn(),
    reorderItems: vi.fn(),
    updateItemNote: vi.fn(),
  });
}

describe('SubmitRoom', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the submit room panels', () => {
    mockEvidence();

    render(<SubmitRoom />);

    expect(screen.getByText('ROOM 4 / 4 · SUBMIT')).toBeInTheDocument();
    expect(screen.getByText('Closure Note')).toBeInTheDocument();
    expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
    expect(screen.getByText('Handoff Export')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export.*noclense/i })).toBeInTheDocument();
  });

  it('pre-fills the closure note from canonical investigation data', () => {
    mockEvidence();

    render(<SubmitRoom />);

    const textarea = screen.getByRole('textbox', { name: /closure note body/i });
    expect((textarea as HTMLTextAreaElement).value).toContain('Carbyne Test');
    expect((textarea as HTMLTextAreaElement).value).toContain('Kamailio WSS keepalive regression');
  });

  it('preserves edits while loadGeneration is unchanged', () => {
    mockEvidence(evidenceSet, 5);
    const { rerender } = render(<SubmitRoom />);
    const textarea = screen.getByRole('textbox', { name: /closure note body/i });

    fireEvent.change(textarea, { target: { value: 'custom closure note' } });

    mockEvidence({ ...evidenceSet, items: [] }, 5);
    rerender(<SubmitRoom />);

    expect(screen.getByRole('textbox', { name: /closure note body/i })).toHaveValue(
      'custom closure note',
    );
  });

  it('resets edits when loadGeneration changes', () => {
    mockEvidence(evidenceSet, 5);
    const { rerender } = render(<SubmitRoom />);
    const textarea = screen.getByRole('textbox', { name: /closure note body/i });

    fireEvent.change(textarea, { target: { value: 'custom closure note' } });

    mockEvidence(evidenceSet, 6);
    rerender(<SubmitRoom />);

    expect(screen.getByRole('textbox', { name: /closure note body/i })).not.toHaveValue(
      'custom closure note',
    );
  });
});

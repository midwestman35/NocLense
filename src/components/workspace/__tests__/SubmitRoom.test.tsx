import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmitRoom } from '../SubmitRoom';
import * as EvidenceContextModule from '../../../contexts/EvidenceContext';
import {
  INVESTIGATION_SCHEMA_VERSION,
  asBlockId,
  asCaseId,
  asInvestigationId,
  type EvidenceSet,
  type Investigation,
} from '../../../types/canonical';

const inv: Investigation = {
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
  ],
  citations: {},
};

const evSet: EvidenceSet = {
  caseId: asCaseId('case-1'),
  investigationId: asInvestigationId('inv-1'),
  items: [],
};

function renderWithContext(
  investigation: Investigation | null = inv,
  evidenceSet: EvidenceSet | null = evSet,
) {
  vi.spyOn(EvidenceContextModule, 'useEvidence').mockReturnValue({
    investigation,
    evidenceSet,
    setInvestigation: vi.fn(),
    restoreEvidenceSet: vi.fn(),
    pinBlock: vi.fn(),
    unpinBlock: vi.fn(),
    reorderItems: vi.fn(),
    updateItemNote: vi.fn(),
  });
  return render(<SubmitRoom />);
}

describe('SubmitRoom', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both cards', () => {
    renderWithContext();
    expect(screen.getByText('Closure Note')).toBeInTheDocument();
    expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
  });

  it('pre-fills textarea with res-note content', () => {
    renderWithContext();
    const textarea = screen.getByRole('textbox', { name: /edit before posting/i });
    expect((textarea as HTMLTextAreaElement).value).toContain('Carbyne Test');
  });

  it('shows draft badge when no confirmed hypothesis', () => {
    renderWithContext();
    expect(screen.getByRole('status')).toHaveTextContent(/draft/i);
  });

  it('shows "0 items pinned" when evidence set is empty', () => {
    renderWithContext();
    expect(screen.getByText('0 items pinned')).toBeInTheDocument();
  });

  it('shows "1 item pinned" with singular form', () => {
    const setWithOne: EvidenceSet = {
      ...evSet,
      items: [{ blockId: asBlockId('ctx'), pinnedAt: 1, pinnedBy: 'user', order: 0 }],
    };
    renderWithContext(inv, setWithOne);
    expect(screen.getByText('1 item pinned')).toBeInTheDocument();
  });

  it('Copy for Zendesk button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /copy.*zendesk/i })).toBeInTheDocument();
  });

  it('Copy Jira Template button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /copy jira/i })).toBeInTheDocument();
  });

  it('Export .noclense button is present', () => {
    renderWithContext();
    expect(screen.getByRole('button', { name: /export.*noclense/i })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEvidence } from '../../../contexts/EvidenceContext';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { makeInvestigation, buildNoteBlock } from '../../ai/diagnose/__tests__/canonicalBlockTestUtils';
import { asBlockId, asCaseId, type EvidenceSet, type Investigation } from '../../../types/canonical';
import EvidencePanel from '../EvidencePanel';

vi.mock('../../../contexts/EvidenceContext', () => ({
  useEvidence: vi.fn(),
}));

vi.mock('../../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: vi.fn(),
}));

vi.mock('motion/react', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: {
      div: ({ children, layout: _layout, ...props }: React.HTMLAttributes<HTMLDivElement> & { layout?: boolean }) =>
        React.createElement('div', props, children),
    },
  };
});

function makeEvidenceSet(items: EvidenceSet['items']): EvidenceSet {
  return {
    caseId: asCaseId('case-001'),
    investigationId: makeInvestigation().id,
    items,
  };
}

describe('EvidencePanel', () => {
  beforeEach(() => {
    vi.mocked(usePrefersReducedMotion).mockReturnValue(false);
  });

  it('renders the empty state when no evidence items exist', () => {
    vi.mocked(useEvidence).mockReturnValue({
      investigation: null,
      evidenceSet: makeEvidenceSet([]),
      setInvestigation: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidencePanel />);

    expect(screen.getByRole('status', { name: 'No evidence pinned' })).toBeTruthy();
    expect(screen.getByText('Nothing pinned yet')).toBeTruthy();
  });

  it('renders the correct preview for hypothesis and note items', () => {
    const investigation = makeInvestigation();
    const note = buildNoteBlock({ body: { authorRole: 'ai', markdown: 'Escalate to carrier.' } });
    investigation.blocks.push(note.block);
    investigation.citations = { ...investigation.citations, ...note.citations };
    vi.mocked(useEvidence).mockReturnValue({
      investigation,
      evidenceSet: makeEvidenceSet([
        { blockId: investigation.blocks[1].id, pinnedAt: 1_000, pinnedBy: 'user', order: 0 },
        { blockId: note.block.id, pinnedAt: 2_000, pinnedBy: 'ai', order: 1 },
      ]),
      setInvestigation: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidencePanel />);

    expect(screen.getByText('H1')).toBeTruthy();
    expect(screen.getByText('PBX registration failure')).toBeTruthy();
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('Escalate to carrier.')).toBeTruthy();
  });

  it('calls unpinBlock with the correct block id', async () => {
    const unpinBlock = vi.fn();
    const investigation = makeInvestigation();
    vi.mocked(useEvidence).mockReturnValue({
      investigation,
      evidenceSet: makeEvidenceSet([
        { blockId: investigation.blocks[0].id, pinnedAt: 1_000, pinnedBy: 'user', order: 0 },
      ]),
      setInvestigation: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock,
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidencePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Unpin from Evidence' }));

    expect(unpinBlock).toHaveBeenCalledWith(investigation.blocks[0].id);
  });

  it('renders a tombstone when the pinned block is missing from the investigation', () => {
    const investigation: Investigation = makeInvestigation();
    vi.mocked(useEvidence).mockReturnValue({
      investigation,
      evidenceSet: makeEvidenceSet([
        { blockId: asBlockId('missing-block'), pinnedAt: 1_000, pinnedBy: 'user', order: 0 },
      ]),
      setInvestigation: vi.fn(),
      pinBlock: vi.fn(),
      unpinBlock: vi.fn(),
      reorderItems: vi.fn(),
      updateItemNote: vi.fn(),
    });

    render(<EvidencePanel />);

    expect(screen.getByText('Block no longer available')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpin from Evidence' })).toBeTruthy();
  });
});

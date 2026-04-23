import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidencePanel } from '../EvidencePanel';
import type { EvidenceSet } from '../../../../types/canonical';

vi.mock('../../../evidence/EvidencePanel', () => ({ default: () => <div>captured evidence list</div> }));
vi.mock('../../../../hooks/useBundleSizePulse', () => ({ useBundleSizePulse: () => ({ pulseKey: 7 }) }));

describe('EvidencePanel', () => {
  it('wraps captured evidence with the investigate room card chrome', () => {
    const evidenceSet = { items: [{ id: 'e-1' }, { id: 'e-2' }] } as unknown as EvidenceSet;

    render(<EvidencePanel evidenceSet={evidenceSet} />);

    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('captured evidence list')).toBeInTheDocument();
  });
});

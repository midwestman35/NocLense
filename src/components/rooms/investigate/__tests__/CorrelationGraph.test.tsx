import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CorrelationGraph } from '../CorrelationGraph';

vi.mock('../../../correlation-graph/CorrelationGraph', () => ({
  CorrelationGraph: () => <div>g6 graph surface</div>,
}));

describe('CorrelationGraph', () => {
  it('wraps the G6 graph with investigate room card chrome', () => {
    render(<CorrelationGraph />);

    expect(screen.getByText('Correlation Graph')).toBeInTheDocument();
    expect(screen.getByText('g6 graph surface')).toBeInTheDocument();
  });
});

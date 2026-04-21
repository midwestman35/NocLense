import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceCard } from '../WorkspaceCard';
import { WorkspaceGrid } from '../WorkspaceGrid';

function renderGrid(layout: 'import' | 'investigate' | 'submit') {
  return render(
    <WorkspaceGrid layout={layout}>
      <WorkspaceCard id="log-stream" title="Log Stream" icon={null} accentColor="#76ce40">
        body
      </WorkspaceCard>
    </WorkspaceGrid>,
  );
}

describe('WorkspaceGrid', () => {
  it('investigate layout provides CardFocusProvider', () => {
    renderGrid('investigate');

    expect(screen.getByRole('button', { name: /focus log stream/i })).toBeInTheDocument();
  });

  it('submit layout does not provide CardFocusProvider', () => {
    renderGrid('submit');

    expect(screen.queryByRole('button', { name: /focus log stream/i })).not.toBeInTheDocument();
  });

  it('import layout does not provide CardFocusProvider', () => {
    renderGrid('import');

    expect(screen.queryByRole('button', { name: /focus log stream/i })).not.toBeInTheDocument();
  });

  it('grid root has no data-focused attribute when no card is focused', () => {
    const { container } = renderGrid('investigate');

    expect(container.querySelector('[data-layout="investigate"]')).not.toHaveAttribute('data-focused');
  });

  it('after clicking the focus button, the grid root carries data-focused with the card id', () => {
    const { container } = renderGrid('investigate');

    fireEvent.click(screen.getByRole('button', { name: /focus log stream/i }));

    expect(container.querySelector('[data-layout="investigate"]')).toHaveAttribute(
      'data-focused',
      'log-stream',
    );
  });
});

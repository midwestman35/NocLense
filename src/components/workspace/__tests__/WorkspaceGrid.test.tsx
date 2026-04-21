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

  // Phase 05 Commit 6 — visible rail for focused siblings
  it('investigate layout splits focused + rail children when a card is focused', () => {
    const { container } = render(
      <WorkspaceGrid layout="investigate">
        <WorkspaceCard id="log-stream" title="Log Stream" icon={null} accentColor="#76ce40">
          body-log
        </WorkspaceCard>
        <WorkspaceCard id="ai-assistant" title="AI Assistant" icon={null} accentColor="#8cf34d">
          body-ai
        </WorkspaceCard>
        <WorkspaceCard id="evidence" title="Evidence" icon={null} accentColor="#f59e0b">
          body-evidence
        </WorkspaceCard>
      </WorkspaceGrid>,
    );

    // No card focused yet — default 3-col grid, no split.
    expect(container.querySelector('[data-focus-column]')).toBeNull();
    expect(container.querySelector('[data-focus-rail]')).toBeNull();

    // Focus the first card.
    fireEvent.click(screen.getByRole('button', { name: /focus log stream/i }));

    const focusColumn = container.querySelector('[data-focus-column]');
    const rail = container.querySelector('[data-focus-rail]');
    expect(focusColumn).toBeInTheDocument();
    expect(rail).toBeInTheDocument();

    // Focused card lives in the focus column
    expect(focusColumn!.querySelector('[data-card-id="log-stream"]')).toBeInTheDocument();
    // Non-focused cards live in the rail
    expect(rail!.querySelector('[data-card-id="ai-assistant"]')).toBeInTheDocument();
    expect(rail!.querySelector('[data-card-id="evidence"]')).toBeInTheDocument();
    // Rail uses role=tablist + aria-orientation for AT
    expect(rail).toHaveAttribute('role', 'tablist');
    expect(rail).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('rail strips are <button role="tab"> with Focus-<title> aria-label', () => {
    render(
      <WorkspaceGrid layout="investigate">
        <WorkspaceCard id="log-stream" title="Log Stream" icon={null} accentColor="#76ce40">
          body
        </WorkspaceCard>
        <WorkspaceCard id="evidence" title="Evidence" icon={null} accentColor="#f59e0b">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: /focus log stream/i }));

    // The rail strip is a single button with role="tab" — no duplicate icon-button inside.
    const railStrip = screen.getByRole('tab', { name: /focus evidence/i });
    expect(railStrip.tagName).toBe('BUTTON');
    expect(railStrip).toHaveAttribute('data-rail-strip', 'true');
    expect(railStrip).toHaveAttribute('data-focus-target', 'false');
  });

  it('clicking a rail strip transfers focus to that card', () => {
    const { container } = render(
      <WorkspaceGrid layout="investigate">
        <WorkspaceCard id="log-stream" title="Log Stream" icon={null} accentColor="#76ce40">
          body
        </WorkspaceCard>
        <WorkspaceCard id="evidence" title="Evidence" icon={null} accentColor="#f59e0b">
          body
        </WorkspaceCard>
      </WorkspaceGrid>,
    );

    fireEvent.click(screen.getByRole('button', { name: /focus log stream/i }));
    expect(container.querySelector('[data-layout="investigate"]')).toHaveAttribute('data-focused', 'log-stream');

    const railStrip = screen.getByRole('tab', { name: /focus evidence/i });
    fireEvent.click(railStrip);

    expect(container.querySelector('[data-layout="investigate"]')).toHaveAttribute('data-focused', 'evidence');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceCard } from '../WorkspaceCard';

describe('WorkspaceCard', () => {
  it('renders title and children', () => {
    render(
      <WorkspaceCard id="test" title="Test Card" icon={<span data-testid="icon">T</span>} accentColor="#76ce40">
        <p>Card content</p>
      </WorkspaceCard>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders meta and badge in header', () => {
    render(
      <WorkspaceCard
        id="test"
        title="AI"
        icon={<span>A</span>}
        accentColor="#76ce40"
        meta={<span>5,000 logs</span>}
        badge={<span>Unleashed</span>}
      >
        Content
      </WorkspaceCard>
    );
    expect(screen.getByText('5,000 logs')).toBeInTheDocument();
    expect(screen.getByText('Unleashed')).toBeInTheDocument();
  });

  it('starts expanded by default — content is in the DOM', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Visible content</p>
      </WorkspaceCard>
    );
    // Content is rendered in the DOM (animation may not complete in jsdom)
    expect(screen.getByText('Visible content')).toBeInTheDocument();
    // Chevron-down indicates expanded state
    expect(document.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });

  it('calls onExpandChange(false) on double-click when expanded', () => {
    const onExpandChange = vi.fn();
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" onExpandChange={onExpandChange}>
        Content
      </WorkspaceCard>
    );
    const header = screen.getByText('Card').closest('[data-card-header]')!;
    fireEvent.doubleClick(header);
    expect(onExpandChange).toHaveBeenCalledWith(false);
  });

  it('calls onExpandChange(true) on single click when collapsed', () => {
    const onExpandChange = vi.fn();
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={false} onExpandChange={onExpandChange}>
        Content
      </WorkspaceCard>
    );
    const header = screen.getByText('Card').closest('[data-card-header]')!;
    fireEvent.click(header);
    expect(onExpandChange).toHaveBeenCalledWith(true);
  });

  it('respects defaultExpanded=false', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={false}>
        <p>Hidden content</p>
      </WorkspaceCard>
    );
    const body = screen.getByText('Hidden content').closest('[data-card-body]')!;
    expect(body.style.height).toBe('0px');
    expect(body.style.opacity).toBe('0');
  });

  it('shows chevron-right when collapsed', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={false}>
        Content
      </WorkspaceCard>
    );
    expect(document.querySelector('.lucide-chevron-right')).toBeInTheDocument();
  });

  it('shows chevron-down when expanded', () => {
    render(
      <WorkspaceCard id="test" title="Expanded" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={true}>
        Content
      </WorkspaceCard>
    );
    expect(document.querySelector('.lucide-chevron-down')).toBeInTheDocument();
  });
});

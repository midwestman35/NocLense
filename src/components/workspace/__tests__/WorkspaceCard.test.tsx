import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('starts expanded by default', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Visible content</p>
      </WorkspaceCard>
    );
    expect(screen.getByText('Visible content')).toBeVisible();
  });

  it('collapses on double-click of header', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Content to hide</p>
      </WorkspaceCard>
    );
    const header = screen.getByText('Card').closest('[data-card-header]')!;
    fireEvent.doubleClick(header);
    const body = screen.getByText('Content to hide').closest('[data-card-body]')!;
    expect(body.style.height).toBe('0px');
  });

  it('calls onExpandChange when toggled', () => {
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

  it('respects defaultExpanded=false', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40" defaultExpanded={false}>
        <p>Hidden content</p>
      </WorkspaceCard>
    );
    const body = screen.getByText('Hidden content').closest('[data-card-body]')!;
    expect(body.style.height).toBe('0px');
  });
});

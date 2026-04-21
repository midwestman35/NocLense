import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardFocusProvider } from '../CardFocusContext';
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
    // Phase 04.5 Direction C: body uses grid-template-rows trick + transform.
    // Collapsed state: grid-rows 0fr, opacity 0, scale(0.97). Still mounted.
    const body = screen.getByText('Hidden content').closest('[data-card-body]') as HTMLElement;
    expect(body).toHaveAttribute('data-card-body-state', 'collapsed');
    expect(body.style.gridTemplateRows).toBe('0fr');
    expect(body.style.opacity).toBe('0');
    expect(body.style.transform).toBe('scale(0.97)');
  });

  it('body uses grid-template-rows 1fr + scale(1) when expanded (Phase 04.5 Direction C)', () => {
    render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        <p>Visible content</p>
      </WorkspaceCard>
    );
    const body = screen.getByText('Visible content').closest('[data-card-body]') as HTMLElement;
    expect(body).toHaveAttribute('data-card-body-state', 'expanded');
    expect(body.style.gridTemplateRows).toBe('1fr');
    expect(body.style.transform).toBe('scale(1)');
  });

  it('card root has motion-safe hover lift class (Phase 04.5 Direction C)', () => {
    const { container } = render(
      <WorkspaceCard id="test" title="Card" icon={<span>C</span>} accentColor="#76ce40">
        Content
      </WorkspaceCard>
    );
    const root = container.querySelector('[data-card-id="test"]')!;
    expect(root.className).toContain('motion-safe:hover:-translate-y-[1px]');
    expect(root.className).toContain('ease-[var(--ease-spring)]');
  });

  // Phase 04.5 Commit 5 — data-* forwarding (prep for Phase 05 Datadog Live)
  it('forwards dataAttributes to the card root', () => {
    const { container } = render(
      <WorkspaceCard
        id="t1"
        title="Card"
        icon={null}
        accentColor="#000"
        dataAttributes={{ 'data-surface': 'datadog-live', 'data-tier': 'live' }}
      >
        body
      </WorkspaceCard>
    );
    const root = container.querySelector('[data-card-id="t1"]')!;
    expect(root).toHaveAttribute('data-surface', 'datadog-live');
    expect(root).toHaveAttribute('data-tier', 'live');
  });

  it('does not forward reserved data-card-id key (primitive owns it)', () => {
    const { container } = render(
      <WorkspaceCard
        id="actual-id"
        title="Card"
        icon={null}
        accentColor="#000"
        dataAttributes={{ 'data-card-id': 'malicious-override', 'data-surface': 'ok' }}
      >
        body
      </WorkspaceCard>
    );
    const root = container.querySelector('[data-card-id="actual-id"]')!;
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('data-surface', 'ok');
    expect(container.querySelector('[data-card-id="malicious-override"]')).toBeNull();
  });

  it('handles undefined dataAttributes without breaking pre-Phase-04.5 call sites', () => {
    const { container } = render(
      <WorkspaceCard id="t1" title="Card" icon={null} accentColor="#000">
        body
      </WorkspaceCard>
    );
    const root = container.querySelector('[data-card-id="t1"]')!;
    expect(root).toBeInTheDocument();
    expect(root).not.toHaveAttribute('data-surface');
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

describe('WorkspaceCard focus mode', () => {
  function renderWithProvider(props?: Partial<ComponentProps<typeof WorkspaceCard>>) {
    return render(
      <CardFocusProvider>
        <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000" {...props}>
          body
        </WorkspaceCard>
      </CardFocusProvider>
    );
  }

  it('renders focus button when expanded inside a provider', () => {
    renderWithProvider();

    expect(screen.getByRole('button', { name: /focus test/i })).toBeInTheDocument();
  });

  it('does not render focus button outside a provider', () => {
    render(
      <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000">
        body
      </WorkspaceCard>
    );

    expect(screen.queryByRole('button', { name: /focus test/i })).not.toBeInTheDocument();
  });

  it('does not render focus button when defaultExpanded=false', () => {
    render(
      <CardFocusProvider>
        <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000" defaultExpanded={false}>
          body
        </WorkspaceCard>
      </CardFocusProvider>
    );

    expect(screen.queryByRole('button', { name: /focus test/i })).not.toBeInTheDocument();
  });

  it('clicking the focus button sets data-focus-target=true', () => {
    const { container } = renderWithProvider();

    fireEvent.click(screen.getByRole('button', { name: /focus test/i }));

    expect(container.querySelector('[data-card-id="t1"]')).toHaveAttribute('data-focus-target', 'true');
  });

  it('Esc clears focus', () => {
    const { container } = renderWithProvider();

    fireEvent.click(screen.getByRole('button', { name: /focus test/i }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(container.querySelector('[data-card-id="t1"]')).toHaveAttribute('data-focus-target', 'false');
  });

  it('Esc while an input is focused does not clear focus', () => {
    const { container } = render(
      <CardFocusProvider>
        <WorkspaceCard id="t1" title="Test" icon={null} accentColor="#000">
          <input data-testid="inside-input" />
        </WorkspaceCard>
      </CardFocusProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /focus test/i }));
    screen.getByTestId('inside-input').focus();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(container.querySelector('[data-card-id="t1"]')).toHaveAttribute('data-focus-target', 'true');
  });

  it('focus button click does not fire onExpandChange', () => {
    const onExpandChange = vi.fn();

    renderWithProvider({ onExpandChange });
    fireEvent.click(screen.getByRole('button', { name: /focus test/i }));

    expect(onExpandChange).not.toHaveBeenCalled();
  });
});

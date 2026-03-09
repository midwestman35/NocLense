import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, SidebarProvider, useSidebar } from '../Sidebar';

function TestConsumer() {
  const { collapsed, toggle } = useSidebar();
  return (
    <div>
      <span data-testid="state">{collapsed ? 'collapsed' : 'expanded'}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  );
}

describe('Sidebar', () => {
  it('starts expanded by default', () => {
    render(
      <SidebarProvider>
        <TestConsumer />
      </SidebarProvider>
    );
    expect(screen.getByTestId('state').textContent).toBe('expanded');
  });

  it('toggles collapsed state', () => {
    render(
      <SidebarProvider>
        <TestConsumer />
      </SidebarProvider>
    );
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('state').textContent).toBe('collapsed');
  });

  it('renders Sidebar panel', () => {
    render(
      <SidebarProvider>
        <Sidebar data-testid="sidebar">Content</Sidebar>
      </SidebarProvider>
    );
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });
});

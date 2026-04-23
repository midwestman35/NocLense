import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIAssistantPanel } from '../AIAssistantPanel';

vi.mock('../../../AISidebar', () => ({ AISidebar: () => <div>assistant chat surface</div> }));

describe('AIAssistantPanel', () => {
  it('wraps the assistant chat with investigate room card chrome', () => {
    render(
      <AIAssistantPanel
        pendingSetup={null}
        onSetupAI={vi.fn()}
        onSetupConsumed={vi.fn()}
        onCitationClick={vi.fn()}
      />,
    );

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Unleashed')).toBeInTheDocument();
    expect(screen.getByText('assistant chat surface')).toBeInTheDocument();
  });
});

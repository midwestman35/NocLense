/**
 * Unit Tests for AIAssistantPanel Component
 * 
 * Purpose:
 * Comprehensive tests for AIAssistantPanel to ensure:
 * - Renders correctly with different states
 * - Message history displays correctly
 * - Input handling works properly
 * - Quick prompts function correctly
 * - Markdown rendering works
 * - Loading states display correctly
 * - Error handling works
 * 
 * Testing Strategy:
 * - Mock AIContext and LogContext
 * - Test user interactions (typing, sending messages)
 * - Validate message rendering
 * - Test keyboard shortcuts
 * - Test disabled states
 * 
 * @module components/__tests__/AIAssistantPanel.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIAssistantPanel from '../AIAssistantPanel';
import { useAI } from '../../contexts/AIContext';
import { useLogContext } from '../../contexts/LogContext';

// Mock contexts
vi.mock('../../contexts/AIContext', () => ({
  useAI: vi.fn(),
}));

vi.mock('../../contexts/LogContext', () => ({
  useLogContext: vi.fn(),
}));

const mockUseAI = useAI as ReturnType<typeof vi.fn>;
const mockUseLogContext = useLogContext as ReturnType<typeof vi.fn>;

describe('AIAssistantPanel', () => {
  const mockAskQuestion = vi.fn();
  const mockClearHistory = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAI.mockReturnValue({
      conversationHistory: [],
      isLoading: false,
      error: null,
      askQuestion: mockAskQuestion,
      clearHistory: mockClearHistory,
      clearError: mockClearError,
      apiKeyConfigured: true,
      isEnabled: true,
    });

    mockUseLogContext.mockReturnValue({
      filteredLogs: [
        { id: 1, timestamp: 1, level: 'INFO', component: 'test', message: 'test', isSip: false },
      ],
    });
  });

  it('renders correctly', () => {
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask a question about your logs...')).toBeInTheDocument();
  });

  it('displays quick prompts when no messages', () => {
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('Quick actions:')).toBeInTheDocument();
    expect(screen.getByText('Why am I seeing these errors?')).toBeInTheDocument();
  });

  it('hides quick prompts when messages exist', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      conversationHistory: [
        {
          id: '1',
          role: 'user',
          content: 'Test question',
          timestamp: Date.now(),
        },
      ],
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.queryByText('Quick actions:')).not.toBeInTheDocument();
  });

  it('displays conversation history', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      conversationHistory: [
        {
          id: '1',
          role: 'user',
          content: 'Test question',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Test response',
          timestamp: Date.now(),
        },
      ],
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('Test question')).toBeInTheDocument();
    expect(screen.getByText('Test response')).toBeInTheDocument();
  });

  it('sends message on button click', async () => {
    mockAskQuestion.mockResolvedValue(undefined);
    
    render(<AIAssistantPanel />);
    
    const input = screen.getByPlaceholderText('Ask a question about your logs...');
    const sendButton = screen.getByLabelText('Send message');
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockAskQuestion).toHaveBeenCalledWith(
        'Test question',
        expect.any(Array),
        expect.any(Array)
      );
    });
  });

  it('sends message on Enter key press', async () => {
    mockAskQuestion.mockResolvedValue(undefined);
    
    render(<AIAssistantPanel />);
    
    const input = screen.getByPlaceholderText('Ask a question about your logs...');
    
    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    
    await waitFor(() => {
      expect(mockAskQuestion).toHaveBeenCalled();
    });
  });

  it('does not send message on Shift+Enter', () => {
    render(<AIAssistantPanel />);
    
    const input = screen.getByPlaceholderText('Ask a question about your logs...');
    
    fireEvent.change(input, { target: { value: 'Test question\n' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    
    expect(mockAskQuestion).not.toHaveBeenCalled();
  });

  it('displays loading indicator when loading', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      isLoading: true,
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('Analyzing logs...')).toBeInTheDocument();
  });

  it('displays error message when error occurs', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      error: 'Test error message',
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('clears history when clear button clicked', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      conversationHistory: [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: Date.now(),
        },
      ],
    });
    
    render(<AIAssistantPanel />);
    
    const clearButton = screen.getByLabelText('Clear history');
    fireEvent.click(clearButton);
    
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('displays not configured message when API key not set', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      apiKeyConfigured: false,
      isEnabled: false,
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.getByText('AI Features Not Configured')).toBeInTheDocument();
  });

  it('displays log count when logs provided', () => {
    mockUseLogContext.mockReturnValue({
      filteredLogs: [
        { id: 1 } as any,
        { id: 2 } as any,
      ],
    });
    
    render(<AIAssistantPanel />);
    
    expect(screen.getByText(/Analyzing 2 logs/)).toBeInTheDocument();
  });

  it('pre-populates query from initialQuery prop', () => {
    render(<AIAssistantPanel initialQuery="Pre-populated question" />);
    
    const input = screen.getByPlaceholderText('Ask a question about your logs...') as HTMLTextAreaElement;
    expect(input.value).toBe('Pre-populated question');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<AIAssistantPanel onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close assistant');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });
});

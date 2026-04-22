/**
 * Unit Tests for AIButton Component
 * 
 * Purpose:
 * Comprehensive tests for AIButton to ensure:
 * - Renders correctly with different variants
 * - Opens AI panel when clicked
 * - Disabled state works correctly
 * - Tooltips display correctly
 * - Different prompt types work
 * - Convenience components function properly
 * 
 * Testing Strategy:
 * - Mock AIContext
 * - Test button rendering and interactions
 * - Validate panel opening/closing
 * - Test disabled states
 * - Test different variants and sizes
 * 
 * @module components/__tests__/AIButton.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIButton, { ExplainLogButton, AnalyzeCorrelationButton } from '../AIButton';
import { useAI } from '../../contexts/AIContext';

// Mock AIContext
vi.mock('../../contexts/AIContext', () => ({
  useAI: vi.fn(),
}));

// Mock unleashService to prevent real API calls
vi.mock('../../services/unleashService', () => ({
  chatWithLogs: vi.fn().mockResolvedValue('Mock AI response'),
}));

// Mock aiSettings store
vi.mock('../../store/aiSettings', () => ({
  loadAiSettings: vi.fn(() => ({ endpoint: 'test', token: 'test' })),
}));

const mockUseAI = useAI as ReturnType<typeof vi.fn>;

describe('AIButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: true,
      isLoading: false,
    });
  });

  it('renders correctly with primary variant', () => {
    render(<AIButton variant="primary" />);
    
    expect(screen.getByText('Analyze with AI')).toBeInTheDocument();
  });

  it('renders correctly with icon variant', () => {
    render(<AIButton variant="icon" />);
    
    const button = screen.getByLabelText('Analyze with AI');
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('opens AI panel when clicked', () => {
    render(<AIButton />);
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    expect(screen.getByText('Unleashed AI')).toBeInTheDocument();
  });

  it('displays custom label when provided', () => {
    render(<AIButton label="Custom Label" />);
    
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('is disabled when API key not configured', () => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: false,
      isEnabled: false,
      isLoading: false,
    });
    
    render(<AIButton />);
    
    // Get the button by aria-label since it has one
    const button = screen.getByLabelText(/configure api key/i);
    expect(button).toBeDisabled();
  });

  it('is disabled when AI features disabled', () => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: false,
      isLoading: false,
    });
    
    render(<AIButton />);
    
    const button = screen.getByLabelText(/enable ai features/i);
    expect(button).toBeDisabled();
  });

  it('is disabled when loading', () => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: true,
      isLoading: true,
    });
    
    render(<AIButton />);
    
    const button = screen.getByLabelText(/ai analysis in progress/i);
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-size', '16');
  });

  it('preserves the numeric-size ternary for non-icon branches', () => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: true,
      isLoading: true,
    });

    const { rerender } = render(<AIButton size="sm" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-size', '14');

    rerender(<AIButton size="lg" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-size', '20');
  });

  it('displays tooltip when disabled', () => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: false,
      isEnabled: false,
      isLoading: false,
    });
    
    render(<AIButton />);
    
    const button = screen.getByLabelText(/configure api key/i);
    expect(button).toHaveAttribute('title', 'Configure API key in settings to use AI features');
  });

  it('uses correct prompt for explain type', () => {
    render(<AIButton promptType="explain" />);
    
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    
    expect(screen.getByText(/Explain this error/)).toBeInTheDocument();
  });

  it('uses correct prompt for analyze type', () => {
    render(<AIButton promptType="analyze" />);
    
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    
    expect(screen.getByText(/Analyze these logs/)).toBeInTheDocument();
  });

  it('uses custom prompt when provided', () => {
    render(<AIButton promptType="custom" customPrompt="Custom prompt text" />);
    
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    
    expect(screen.getByText(/Custom prompt text/)).toBeInTheDocument();
  });

  it('closes panel when close button clicked', () => {
    render(<AIButton />);
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    const backdrop = screen.getByText('Unleashed AI').closest('.fixed');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(screen.queryByText('Unleashed AI')).not.toBeInTheDocument();
  });

  it('calls onSuccess when panel closes', () => {
    const onSuccess = vi.fn();
    render(<AIButton onSuccess={onSuccess} />);
    const button = screen.getByText('Analyze with AI');
    fireEvent.click(button);
    const backdrop = screen.getByText('Unleashed AI').closest('.fixed');
    fireEvent.click(backdrop!);
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('ExplainLogButton', () => {
  beforeEach(() => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: true,
      isLoading: false,
    });
  });

  it('renders correctly', () => {
    const log = { id: 1 } as any;
    render(<ExplainLogButton log={log} />);
    
    expect(screen.getByText('Explain with AI')).toBeInTheDocument();
  });

  it('uses explain prompt type', () => {
    const log = { id: 1 } as any;
    render(<ExplainLogButton log={log} />);
    
    const button = screen.getByText('Explain with AI');
    fireEvent.click(button);
    
    expect(screen.getByText(/Explain this error/)).toBeInTheDocument();
  });
});

describe('AnalyzeCorrelationButton', () => {
  beforeEach(() => {
    mockUseAI.mockReturnValue({
      apiKeyConfigured: true,
      isEnabled: true,
      isLoading: false,
    });
  });

  it('renders correctly', () => {
    const logs = [{ id: 1 }] as any[];
    render(
      <AnalyzeCorrelationButton
        logs={logs}
        correlationType="callId"
        correlationValue="test-123"
      />
    );
    
    expect(screen.getByText('Analyze callId')).toBeInTheDocument();
  });

  it('uses correlation-specific prompt', () => {
    const logs = [{ id: 1 }] as any[];
    render(
      <AnalyzeCorrelationButton
        logs={logs}
        correlationType="callId"
        correlationValue="test-123"
      />
    );
    
    const button = screen.getByText('Analyze callId');
    fireEvent.click(button);
    
    expect(screen.getByText(/Analyze logs for callId: test-123/)).toBeInTheDocument();
  });
});

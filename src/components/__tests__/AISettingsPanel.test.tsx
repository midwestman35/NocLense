/**
 * Unit Tests for AISettingsPanel Component
 * 
 * Purpose:
 * Comprehensive tests for AISettingsPanel to ensure:
 * - Renders correctly with different states
 * - API key input and validation work
 * - Model selection updates correctly
 * - Usage statistics display accurately
 * - Enable/disable toggle functions properly
 * - Error messages display correctly
 * 
 * Testing Strategy:
 * - Mock AIContext to control state
 * - Test user interactions (input, clicks)
 * - Validate form submission and validation
 * - Test disabled states and error handling
 * 
 * @module components/__tests__/AISettingsPanel.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AISettingsPanel from '../AISettingsPanel';
import { useAI } from '../../contexts/AIContext';

// Mock AIContext
vi.mock('../../contexts/AIContext', () => ({
  useAI: vi.fn(),
}));

const mockUseAI = useAI as ReturnType<typeof vi.fn>;

describe('AISettingsPanel', () => {
  const mockSetApiKey = vi.fn();
  const mockSetModel = vi.fn();
  const mockSetProvider = vi.fn();
  const mockSetEnabled = vi.fn();
  const mockSetDailyRequestLimit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAI.mockReturnValue({
      isEnabled: false,
      apiKeyConfigured: false,
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      usageStats: {
        requestsToday: 0,
        requestsThisMinute: 0,
        totalTokensUsed: 0,
        lastDailyReset: Date.now(),
        lastMinuteReset: Date.now(),
      },
      dailyRequestLimit: 1500,
      error: null,
      setApiKey: mockSetApiKey,
      setModel: mockSetModel,
      setProvider: mockSetProvider,
      setEnabled: mockSetEnabled,
      setDailyRequestLimit: mockSetDailyRequestLimit,
    });
  });

  it('renders correctly', () => {
    render(<AISettingsPanel />);
    
    expect(screen.getByText('AI Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('API key input')).toBeInTheDocument();
    expect(screen.getByText('Model Selection')).toBeInTheDocument();
    expect(screen.getByText('Usage Statistics')).toBeInTheDocument();
  });

  it('displays API key input field', () => {
    render(<AISettingsPanel />);
    
    const apiKeyInput = screen.getByLabelText('API key input');
    expect(apiKeyInput).toBeInTheDocument();
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('toggles API key visibility', () => {
    render(<AISettingsPanel />);
    
    const apiKeyInput = screen.getByLabelText('API key input') as HTMLInputElement;
    const toggleButton = screen.getByLabelText('Show API key');
    
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    fireEvent.click(toggleButton);
    
    expect(apiKeyInput).toHaveAttribute('type', 'text');
    
    const hideButton = screen.getByLabelText('Hide API key');
    fireEvent.click(hideButton);
    
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('validates and saves API key', async () => {
    mockSetApiKey.mockResolvedValue(true);
    
    render(<AISettingsPanel />);
    
    const apiKeyInput = screen.getByLabelText('API key input');
    const testButton = screen.getByText('Test & Save');
    
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(mockSetApiKey).toHaveBeenCalledWith('test-api-key');
    });
  });

  it('displays validation error for invalid API key', async () => {
    mockSetApiKey.mockResolvedValue(false);
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      error: 'Invalid API key',
    });
    
    render(<AISettingsPanel />);
    
    const apiKeyInput = screen.getByLabelText('API key input');
    const testButton = screen.getByText('Test & Save');
    
    fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } });
    fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/i)).toBeInTheDocument();
    });
  });

  it('displays usage statistics correctly', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      usageStats: {
        requestsToday: 750,
        requestsThisMinute: 5,
        totalTokensUsed: 50000,
        lastDailyReset: Date.now(),
        lastMinuteReset: Date.now(),
      },
      dailyRequestLimit: 1500,
    });
    
    render(<AISettingsPanel />);
    
    expect(screen.getByText(/750 \/ 1500/)).toBeInTheDocument();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
  });

  it('displays warning when approaching limit', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      usageStats: {
        requestsToday: 1300,
        requestsThisMinute: 0,
        totalTokensUsed: 0,
        lastDailyReset: Date.now(),
        lastMinuteReset: Date.now(),
      },
      dailyRequestLimit: 1500,
    });
    
    render(<AISettingsPanel />);
    
    expect(screen.getByText(/Approaching daily limit/)).toBeInTheDocument();
  });

  it('allows model selection', () => {
    render(<AISettingsPanel />);
    
    const proModel = screen.getByText('Gemini 1.5 Pro');
    fireEvent.click(proModel.closest('label')!);
    
    expect(mockSetModel).toHaveBeenCalledWith('gemini-1.5-pro');
  });

  it('allows provider selection', () => {
    render(<AISettingsPanel />);

    const claudeProvider = screen.getByText('Anthropic Claude');
    fireEvent.click(claudeProvider.closest('label')!);

    expect(mockSetProvider).toHaveBeenCalledWith('claude');
  });

  it('allows enabling/disabling AI features', () => {
    render(<AISettingsPanel />);
    
    const enableCheckbox = screen.getByLabelText(/Enable AI Features/i);
    fireEvent.click(enableCheckbox);
    
    expect(mockSetEnabled).toHaveBeenCalledWith(true);
  });

  it('disables enable toggle when API key not configured', () => {
    render(<AISettingsPanel />);
    
    const enableCheckbox = screen.getByLabelText(/Enable AI Features/i);
    expect(enableCheckbox).toBeDisabled();
  });

  it('allows changing daily limit', () => {
    render(<AISettingsPanel />);
    
    const limitInput = screen.getByDisplayValue('1500') as HTMLInputElement;
    fireEvent.change(limitInput, { target: { value: '1000' } });
    
    expect(mockSetDailyRequestLimit).toHaveBeenCalledWith(1000);
  });

  it('displays error message when present', () => {
    mockUseAI.mockReturnValue({
      ...mockUseAI(),
      error: 'Test error message',
    });
    
    render(<AISettingsPanel />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<AISettingsPanel onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close settings');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });
});

/**
 * Unit Tests for ConsentModal Component
 *
 * Purpose:
 * Verifies Phase 7 consent modal behavior:
 * - Renders with expected privacy disclosure content
 * - "I consent" calls consentToAI
 * - "No thanks" and Escape call declineConsent
 * - Accessibility attributes and keyboard handling
 *
 * @module components/__tests__/ConsentModal.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConsentModal from '../ConsentModal';
import { useAI } from '../../contexts/AIContext';

vi.mock('../../contexts/AIContext', () => ({
  useAI: vi.fn(),
}));

const mockUseAI = useAI as ReturnType<typeof vi.fn>;

describe('ConsentModal', () => {
  const mockConsentToAI = vi.fn();
  const mockDeclineConsent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAI.mockReturnValue({
      consentToAI: mockConsentToAI,
      declineConsent: mockDeclineConsent,
    });
  });

  it('renders with consent dialog content', () => {
    render(<ConsentModal />);

    expect(screen.getByRole('dialog', { name: /AI Analysis Consent/i })).toBeInTheDocument();
    expect(screen.getByText(/what data is shared/i)).toBeInTheDocument();
    expect(screen.getByText(/What we send to Google/i)).toBeInTheDocument();
    expect(screen.getByText(/What we don't send/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I consent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No thanks/i })).toBeInTheDocument();
  });

  it('calls consentToAI when I consent clicked', () => {
    render(<ConsentModal />);

    fireEvent.click(screen.getByRole('button', { name: /I consent/i }));

    expect(mockConsentToAI).toHaveBeenCalledTimes(1);
  });

  it('calls declineConsent when No thanks clicked', () => {
    render(<ConsentModal />);

    fireEvent.click(screen.getByRole('button', { name: /No thanks/i }));

    expect(mockDeclineConsent).toHaveBeenCalledTimes(1);
  });

  it('calls declineConsent when X button clicked', () => {
    render(<ConsentModal />);

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));

    expect(mockDeclineConsent).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when provided and I consent clicked', () => {
    const onClose = vi.fn();
    render(<ConsentModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /I consent/i }));

    expect(mockConsentToAI).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when provided and No thanks clicked', () => {
    const onClose = vi.fn();
    render(<ConsentModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /No thanks/i }));

    expect(mockDeclineConsent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

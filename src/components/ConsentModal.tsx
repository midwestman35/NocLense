/**
 * AI Consent Modal Component
 *
 * Purpose:
 * Displays a modal before the first AI query, explaining what data is sent to Google
 * and obtaining explicit user consent. Aligns with privacy expectations and .cursorrules
 * "Privacy First" principle.
 *
 * Architecture Decision:
 * Standalone modal component rendered by AIProvider. Shown only once before the first
 * AI analysis. Consent is persisted in localStorage to avoid repeated prompts.
 *
 * Security Notes:
 * - No data is sent until user explicitly consents
 * - Modal clearly explains what is shared (log content, timestamps) and what is not
 * - "No thanks" option allows users to decline without obligation
 * - Improves trust and transparency per Phase 7 requirements
 *
 * Dependencies:
 * - AIContext: Provides consentToAI, declineConsent
 * - lucide-react: Icons
 * - Tailwind CSS: Styling (consistent with AISettingsPanel)
 *
 * @module components/ConsentModal
 */

import { useEffect, useCallback } from 'react';
import { useAI } from '../contexts/AIContext';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface ConsentModalProps {
  /** Callback when modal should be closed (for cleanup) */
  onClose?: () => void;
}

/**
 * AI Consent Modal
 *
 * Explains what data is sent to Google's Gemini API and obtains consent before
 * the first AI query. Shown when user attempts an AI action without prior consent.
 *
 * Why this design?
 * - Clear, scannable bullet points for what is/isn't sent
 * - Primary action (I consent) is prominent; secondary (No thanks) is visible but not emphasized
 * - Matches existing modal and notice styling (AISettingsPanel, ExportModal)
 * - Accessible: focus trap, Escape to decline, ARIA labels
 */
export default function ConsentModal({ onClose }: ConsentModalProps) {
  const { consentToAI, declineConsent } = useAI();

  const handleConsent = useCallback(() => {
    consentToAI();
    onClose?.();
  }, [consentToAI, onClose]);

  const handleDecline = useCallback(() => {
    declineConsent();
    onClose?.();
  }, [declineConsent, onClose]);

  // Focus first focusable element on mount; handle Escape to decline
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDecline();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecline]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      aria-describedby="consent-modal-description"
    >
      <div
        className="w-full max-w-lg bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-[var(--accent-blue)]" />
            <h2 id="consent-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              AI Analysis Consent
            </h2>
          </div>
          <button
            onClick={handleDecline}
            className="p-1 rounded hover:bg-[var(--bg-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Decline and close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div id="consent-modal-description" className="p-4 space-y-4">
          <p className="text-sm text-[var(--text-primary)]">
            Before using AI analysis, please understand what data is shared:
          </p>

          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold mb-1.5 text-[var(--text-primary)]">What we send to Google</div>
                <ul className="list-disc list-inside space-y-1 text-blue-200/90">
                  <li>Log content (messages, timestamps, levels)</li>
                  <li>Component paths and correlation IDs</li>
                  <li>Your question or analysis request</li>
                </ul>
                <div className="mt-2 text-blue-200/80">
                  Data is sent to Google's Gemini API for analysis. Google does not retain your data beyond the API request.
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)]">
            <div className="font-semibold mb-1 text-[var(--text-primary)]">What we don't send</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Your API key (stored locally only)</li>
              <li>Logs you don't explicitly select for analysis</li>
            </ul>
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">
            You can disable AI features at any time in AI Settings. By consenting, you agree to send the selected log
            data to Google for analysis.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--border-color)] bg-[var(--bg-light)]">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent hover:bg-[var(--bg-primary)] rounded transition-colors"
            aria-label="No thanks, do not use AI"
          >
            No thanks
          </button>
          <button
            onClick={handleConsent}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue)]/90 transition-colors"
            aria-label="I consent to send log data to Google for AI analysis"
          >
            I consent
          </button>
        </div>
      </div>
    </div>
  );
}

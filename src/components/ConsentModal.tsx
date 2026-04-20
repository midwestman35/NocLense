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

import { useCallback } from 'react';
import { useEscapeKey } from '../utils/useEscapeKey';
import { useAI } from '../contexts/AIContext';
import { AlertTriangle } from 'lucide-react';
import { Dialog, Button } from './ui';

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

  useEscapeKey(handleDecline);

  return (
    <Dialog
      open={true}
      onClose={handleDecline}
      title="AI Analysis Consent"
      footer={
        <>
          <Button variant="ghost" onClick={handleDecline} aria-label="No thanks, do not use AI">
            No thanks
          </Button>
          <Button onClick={handleConsent} aria-label="I consent to send log data to Google for AI analysis">
            I consent
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--foreground)]">
          Before using AI analysis, please understand what data is shared:
        </p>

        <div className="p-3 bg-[var(--foreground)]/10 border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--muted-foreground)]">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1.5 text-[var(--foreground)]">What we send to Google</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Log content (messages, timestamps, levels)</li>
                <li>Component paths and correlation IDs</li>
                <li>Your question or analysis request</li>
              </ul>
              <div className="mt-2 opacity-80">
                Data is sent to Google's Gemini API for analysis. Google does not retain your data beyond the API request.
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--muted-foreground)]">
          <div className="font-semibold mb-1 text-[var(--foreground)]">What we don't send</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Your API key (stored locally only)</li>
            <li>Logs you don't explicitly select for analysis</li>
          </ul>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          You can disable AI features at any time in AI Settings. By consenting, you agree to send the selected log
          data to Google for analysis.
        </p>
      </div>
    </Dialog>
  );
}

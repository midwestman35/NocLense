/**
 * Quota Exceeded Modal Component
 *
 * Purpose:
 * Displays a modal when the user hits their daily AI request limit.
 * Ensures awareness before any further requests are attempted.
 *
 * Why this component?
 * - Users should see a clear dialog when limit is hit, not just a banner
 * - Prevents accidental over-use without awareness
 * - Provides actionable next steps (try tomorrow, adjust limit in settings)
 *
 * @module components/QuotaExceededModal
 */

import { useEffect, useCallback } from 'react';
import { useAI } from '../contexts/AIContext';
import { GEMINI_FREE_TIER_DAILY_LIMIT } from '../types/ai';
import { AlertTriangle, Calendar, Settings, X } from 'lucide-react';

interface QuotaExceededModalProps {
  /** Callback when modal should be closed */
  onClose?: () => void;
}

export default function QuotaExceededModal({ onClose }: QuotaExceededModalProps) {
  const { usageStats, dailyRequestLimit, dismissQuotaExceeded } = useAI();

  const handleDismiss = useCallback(() => {
    dismissQuotaExceeded();
    onClose?.();
  }, [dismissQuotaExceeded, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
      aria-describedby="quota-modal-description"
    >
      <div
        className="w-full max-w-md bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={24} className="text-amber-500" />
            <h2 id="quota-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Daily Limit Reached
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-[var(--bg-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div id="quota-modal-description" className="p-4 space-y-4">
          <p className="text-sm text-[var(--text-primary)]">
            You've reached your daily AI request limit ({usageStats.requestsToday} / {dailyRequestLimit}).
          </p>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm text-[var(--text-primary)]">
            <div className="flex items-start gap-2">
              <Calendar size={18} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <div>
                <div className="font-medium mb-1">What happens next?</div>
                <p className="text-[var(--text-secondary)] text-xs">
                  Your limit resets at midnight UTC. You can continue using AI analysis tomorrow, or adjust your daily
                  limit in AI Settings if you have a higher quota.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)]">
            <div className="flex items-start gap-2">
              <Settings size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p>
                  The free Gemini API tier allows up to {GEMINI_FREE_TIER_DAILY_LIMIT.toLocaleString()} requests per day.
                  You can set a lower limit in AI Settings to avoid unexpected usage.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-light)]">
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2 text-sm font-medium bg-[var(--accent-blue)] text-white rounded hover:bg-[var(--accent-blue)]/90 transition-colors"
            aria-label="Got it"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

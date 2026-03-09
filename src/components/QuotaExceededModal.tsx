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
import { Calendar, Settings } from 'lucide-react';
import { Dialog, Button } from './ui';

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
    <Dialog
      open={true}
      onClose={handleDismiss}
      title="Daily Limit Reached"
      footer={
        <Button onClick={handleDismiss} className="w-full" aria-label="Got it">
          Got it
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--foreground)]">
          You've reached your daily AI request limit ({usageStats.requestsToday} / {dailyRequestLimit}).
        </p>

        <div className="p-3 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-[var(--radius-md)] text-sm text-[var(--foreground)]">
          <div className="flex items-start gap-2">
            <Calendar size={18} className="mt-0.5 flex-shrink-0 text-[var(--warning)]" />
            <div>
              <div className="font-medium mb-1">What happens next?</div>
              <p className="text-[var(--muted-foreground)] text-xs">
                Your limit resets at midnight UTC. You can continue using AI analysis tomorrow, or adjust your daily
                limit in AI Settings if you have a higher quota.
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--muted-foreground)]">
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
    </Dialog>
  );
}

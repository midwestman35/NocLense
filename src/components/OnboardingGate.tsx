/**
 * Onboarding Gate — shows AI onboarding walkthrough and optional AISettingsPanel modal.
 *
 * Rendered by App when noclense_onboarding_completed is not set. Calls onDone when
 * user completes or skips so App can re-render and show the main app.
 *
 * @module components/OnboardingGate
 */

import { lazy, Suspense, useState, useCallback } from 'react';
import OnboardingPage, { setOnboardingCompleted } from './OnboardingPage';

const AISettingsPanel = lazy(() => import('./AISettingsPanel'));

interface OnboardingGateProps {
  onDone: () => void;
}

export default function OnboardingGate({ onDone }: OnboardingGateProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleComplete = useCallback(() => {
    setOnboardingCompleted(true);
    onDone();
  }, [onDone]);

  const handleSkip = useCallback(() => {
    setOnboardingCompleted(true);
    onDone();
  }, [onDone]);

  return (
    <>
      <OnboardingPage
        onOpenSettings={() => setShowSettings(true)}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
      {showSettings && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col">
            <Suspense fallback={<div className="h-64 animate-pulse bg-[var(--bg-light)]" />}>
              <AISettingsPanel onClose={() => setShowSettings(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}

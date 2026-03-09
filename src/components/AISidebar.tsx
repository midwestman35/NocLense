import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button, Separator } from './ui';
import AIAssistantPanel from './AIAssistantPanel';
import AISettingsPanel from './AISettingsPanel';
import { useLogContext } from '../contexts/LogContext';
import { useAI } from '../contexts/AIContext';

export function AISidebar({ onSetupAI }: { onSetupAI?: () => void }) {
  const { filteredLogs } = useLogContext();
  const { apiKeyConfigured, isEnabled, onboardingCompleted } = useAI();
  const [showSettings, setShowSettings] = useState(!apiKeyConfigured || !isEnabled);

  return (
    <div className="flex flex-col h-full bg-[var(--card)]">
      <div className="px-3 py-3 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">AI Assistant</div>
            <div className="text-xs text-[var(--muted-foreground)]">Operational support for the current working set.</div>
          </div>
          <Button variant="ghost" onClick={() => setShowSettings((prev) => !prev)} className="h-8 px-2 text-xs">
            {showSettings ? <ArrowLeft size={14} className="mr-1" /> : <Settings size={14} className="mr-1" />}
            {showSettings ? 'Back' : 'Settings'}
          </Button>
        </div>
        {!onboardingCompleted && onSetupAI && (
          <Button variant="outline" onClick={onSetupAI} className="h-8 w-full justify-between text-xs">
            Set up AI
            <Settings size={14} />
          </Button>
        )}
      </div>

      <Separator />

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {showSettings ? (
            <motion.div
              key="settings-panel"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <AISettingsPanel />
            </motion.div>
          ) : (
            <motion.div
              key="chat-panel"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <AIAssistantPanel logs={filteredLogs} onOpenSettings={() => setShowSettings(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

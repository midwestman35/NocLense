/**
 * AI Button Component
 * 
 * Purpose:
 * Reusable button component for triggering AI actions throughout the application.
 * Provides consistent behavior and styling for AI features.
 * 
 * Architecture Decision:
 * Reusable component ensures consistent behavior and reduces code duplication.
 * This component can be placed in toolbars, panels, and context menus.
 * 
 * Key Features:
 * - Multiple variants (primary, secondary, icon)
 * - Pre-populated queries for common actions
 * - Disabled state when API key not configured
 * - Tooltip explaining why disabled
 * - Loading state during analysis
 * - Opens AIAssistantPanel with pre-populated query
 * 
 * Why Reusable Component Instead of Inline Buttons?
 * - Ensures consistent behavior across the app
 * - Reduces code duplication
 * - Centralizes AI button logic
 * - Easier to maintain and update
 * 
 * Why Pre-populated Queries?
 * - Improves UX by reducing typing
 * - Ensures queries are well-formed
 * - Faster workflow for common actions
 * - Demonstrates AI capabilities
 * 
 * Integration Points:
 * - LogViewer toolbar (analyze filtered logs)
 * - LogDetailsPanel (explain specific log)
 * - CorrelationSidebar (analyze correlation)
 * - Context menu for selected logs
 * 
 * Dependencies:
 * - AIContext: Provides AI state and actions
 * - lucide-react: Icons (Sparkles for AI)
 * - Tailwind CSS: Styling (consistent with existing components)
 * 
 * @module components/AIButton
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAI } from '../contexts/AIContext';
import { Sparkles, Loader2, X, Send } from 'lucide-react';
import type { LogEntry } from '../types';
import { loadAiSettings } from '../store/aiSettings';
import { chatWithLogs } from '../services/unleashService';

interface AIButtonProps {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'icon';
  /** Logs to analyze (if not provided, uses filtered logs from context) */
  logs?: LogEntry[];
  /** Pre-defined prompt type */
  promptType?: 'explain' | 'analyze' | 'troubleshoot' | 'custom';
  /** Custom prompt text (for custom promptType) */
  customPrompt?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Callback after AI response (optional) */
  onSuccess?: () => void;
  /** Button label (for non-icon variants) */
  label?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get prompt text based on prompt type
 * 
 * Why: Centralizes prompt templates for consistency
 */
function getPromptText(
  promptType: 'explain' | 'analyze' | 'troubleshoot' | 'custom',
  customPrompt?: string
): string {
  switch (promptType) {
    case 'explain':
      return 'Explain this error and suggest troubleshooting steps.';
    case 'analyze':
      return 'Analyze these logs and identify key patterns, errors, and important events.';
    case 'troubleshoot':
      return "What's causing these issues? Analyze the logs and provide troubleshooting recommendations.";
    case 'custom':
      return customPrompt || 'Analyze these logs.';
    default:
      return 'Analyze these logs.';
  }
}

/**
 * AI Button Component
 * 
 * Why this component structure?
 * - Reusable across different contexts
 * - Handles panel state internally
 * - Provides consistent UX
 * - Accessible with proper ARIA labels
 */
export default function AIButton({
  variant = 'primary',
  logs,
  promptType = 'analyze',
  customPrompt,
  disabled: externalDisabled,
  onSuccess,
  label,
  tooltip,
  size = 'md',
  className = '',
}: AIButtonProps) {
  const { apiKeyConfigured, isEnabled, isLoading } = useAI();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-send the initial prompt when the panel opens
  useEffect(() => {
    if (!isPanelOpen || !promptText || aiReply || aiLoading) return;
    void (async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const settings = loadAiSettings();
        const reply = await chatWithLogs(settings, promptText, logs ?? [], []);
        setAiReply(reply);
      } catch (e: any) {
        setAiError(e.message);
      } finally {
        setAiLoading(false);
      }
    })();
  }, [isPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiReply, aiLoading]);

  function handleClose() {
    setIsPanelOpen(false);
    setAiReply(null);
    setAiError(null);
    setChatInput('');
    onSuccess?.();
  }

  async function handleFollowUp() {
    const msg = chatInput.trim();
    if (!msg || aiLoading) return;
    setChatInput('');
    setAiLoading(true);
    setAiError(null);
    try {
      const settings = loadAiSettings();
      const history = aiReply
        ? [{ role: 'User' as const, text: promptText }, { role: 'Assistant' as const, text: aiReply }]
        : [];
      const reply = await chatWithLogs(settings, msg, logs ?? [], history.map(h => ({ role: h.role === 'User' ? 'user' : 'assistant' as const, content: h.text })));
      setAiReply(prev => (prev ? `${prev}\n\n---\n\n**Q: ${msg}**\n\n${reply}` : reply));
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  // Phase 6.2: Disable when no logs - user must load/select logs first
  const hasLogs = logs === undefined || logs.length > 0;

  // Disable when no logs or external disabled (no longer require apiKeyConfigured since Unleash handles it)
  const isDisabled =
    externalDisabled ||
    isLoading ||
    !hasLogs;

  // Get prompt text
  const promptText = getPromptText(promptType, customPrompt);

  /**
   * Handle button click
   * 
   * Why: Opens AI panel with pre-populated query
   */
  const handleClick = useCallback(() => {
    if (isDisabled) {
      return;
    }
    setIsPanelOpen(true);
  }, [isDisabled]);

  /**
   * Handle panel close
   * 
   * Why: Cleans up state and calls success callback
   */
  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    onSuccess?.();
  }, [onSuccess]);

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-[var(--foreground)] text-white hover:bg-[var(--foreground)]/90',
    secondary: 'bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/80',
    icon: 'p-2 bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/80',
  };

  // Button content based on variant
  const buttonContent = (
    <>
      {isLoading ? (
        <Loader2 size={variant === 'icon' ? 16 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="animate-spin" />
      ) : (
        <Sparkles size={variant === 'icon' ? 16 : size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      )}
      {variant !== 'icon' && (
        <span className={size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'}>
          {label || 'Analyze with AI'}
        </span>
      )}
    </>
  );

  // Tooltip text - Phase 6.2: Clear, actionable messages per .cursorrules
  const tooltipText =
    tooltip ||
    (!hasLogs ? 'Load logs first to use AI analysis' :
     isLoading ? 'AI analysis in progress...' :
     undefined);

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          inline-flex items-center gap-2 rounded font-medium transition-colors
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        title={tooltipText}
        aria-label={tooltipText || (variant === 'icon' ? 'Analyze with AI' : label || 'Analyze with AI')}
        aria-disabled={isDisabled}
      >
        {buttonContent}
      </button>

      {/* Inline AI result panel */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
          <div
            className="w-full max-w-2xl max-h-[80vh] m-4 rounded-lg shadow-xl flex flex-col"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={15} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--foreground)' }}>Unleashed AI</span>
              </div>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px' }}>
                <X size={15} />
              </button>
            </div>

            {/* Prompt */}
            <div style={{ padding: '10px 16px', backgroundColor: 'var(--muted)', flexShrink: 0, fontSize: '12px', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
              {promptText}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              {aiLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-foreground)', fontSize: '12px' }}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--success)' }} />
                  Analyzing... (15–30 sec)
                </div>
              )}
              {aiError && (
                <div style={{ fontSize: '12px', color: 'var(--destructive)', backgroundColor: 'rgba(239,68,68,0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)' }}>
                  {aiError}
                </div>
              )}
              {aiReply && (
                <div style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {aiReply}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Follow-up input */}
            {aiReply && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleFollowUp(); } }}
                  placeholder="Ask a follow-up question..."
                  disabled={aiLoading}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--foreground)', outline: 'none' }}
                />
                <button
                  onClick={() => void handleFollowUp()}
                  disabled={!chatInput.trim() || aiLoading}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: chatInput.trim() && !aiLoading ? 'var(--success)' : 'var(--muted)', color: chatInput.trim() && !aiLoading ? '#fff' : 'var(--muted-foreground)' }}
                >
                  <Send size={13} />
                </button>
              </div>
            )}
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
}

/**
 * Convenience component for "Explain this log" action
 * 
 * Why: Common use case deserves a dedicated component
 */
export function ExplainLogButton({ log, className }: { log: LogEntry; className?: string }) {
  // Get surrounding logs for context (5 before, 5 after)
  // Why: Provides temporal context for better AI understanding
  // Note: This would need access to LogContext to get surrounding logs
  // For now, just pass the single log
  return (
    <AIButton
      variant="secondary"
      size="sm"
      promptType="explain"
      logs={[log]}
      label="Explain with AI"
      className={className}
    />
  );
}

/**
 * Convenience component for "Analyze correlation" action
 * 
 * Why: Common use case for correlation analysis
 */
export function AnalyzeCorrelationButton({
  logs,
  correlationType,
  correlationValue,
  className,
}: {
  logs: LogEntry[];
  correlationType: string;
  correlationValue: string;
  className?: string;
}) {
  const customPrompt = `Analyze logs for ${correlationType}: ${correlationValue}. Identify patterns, errors, and important events related to this correlation.`;
  
  return (
    <AIButton
      variant="secondary"
      size="sm"
      promptType="custom"
      customPrompt={customPrompt}
      logs={logs}
      label={`Analyze ${correlationType}`}
      className={className}
    />
  );
}

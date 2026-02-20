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

import { useState, useCallback } from 'react';
import { useAI } from '../contexts/AIContext';
import { Sparkles, Loader2 } from 'lucide-react';
import type { LogEntry } from '../types';
import AIAssistantPanel from './AIAssistantPanel';

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

  // Phase 6.2: Disable when no logs - user must load/select logs first
  const hasLogs = logs === undefined || logs.length > 0;

  // Determine if button should be disabled
  // Why: Disabled when API not configured, external disabled, loading, or no logs
  const isDisabled =
    externalDisabled ||
    !apiKeyConfigured ||
    !isEnabled ||
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
    primary: 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90',
    secondary: 'bg-[var(--bg-light)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-light)]/80',
    icon: 'p-2 bg-[var(--bg-light)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-light)]/80',
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
     !apiKeyConfigured ? 'Configure API key in settings to use AI features' :
     !isEnabled ? 'Enable AI features in settings' :
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

      {/* AI Assistant Panel */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full h-full max-w-4xl max-h-[90vh] m-4 bg-[var(--bg-primary)] rounded-lg shadow-xl flex flex-col">
            <AIAssistantPanel
              onClose={handlePanelClose}
              initialQuery={promptText}
              logs={logs}
            />
          </div>
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

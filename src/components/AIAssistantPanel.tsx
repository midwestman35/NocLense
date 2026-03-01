/**
 * AI Assistant Panel Component
 * 
 * Purpose:
 * Provides a chat interface for interacting with Google Gemini AI for log analysis.
 * Users can ask questions, view conversation history, and get AI-powered insights
 * about their logs.
 * 
 * Architecture Decision:
 * Chat interface pattern enables iterative refinement of questions and maintains
 * conversation context. This component integrates with AIContext for state management
 * and LogContext for accessing filtered logs.
 * 
 * Key Features:
 * - Chat interface with message history (user + assistant messages)
 * - Pre-defined prompt buttons (quick actions for common queries)
 * - Markdown rendering for AI responses (code blocks, lists, formatting)
 * - Copy response button for each AI message
 * - Clear history button
 * - Context indicator showing which logs are being analyzed
 * - Loading indicator during AI responses
 * - Auto-scroll to latest message
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * 
 * Why Chat Interface Instead of Single Q&A?
 * - Enables iterative refinement ("Tell me more about...")
 * - Maintains conversation history for context
 * - Familiar pattern (ChatGPT, etc.)
 * - Allows follow-up questions without re-selecting logs
 * 
 * Why Pre-defined Prompts?
 * - Reduces friction for new users (examples of what to ask)
 * - Ensures queries are well-formed
 * - Faster than typing common questions
 * - Demonstrates capabilities
 * 
 * Why Show Which Logs Are Being Analyzed?
 * - Transparency builds trust
 * - Users can verify correct context
 * - Helps debug unexpected responses
 * - Educational (shows how to select relevant logs)
 * 
 * Dependencies:
 * - AIContext: Provides AI state and actions
 * - LogContext: Provides filtered logs for context
 * - lucide-react: Icons for UI elements
 * - Tailwind CSS: Styling (consistent with existing components)
 * 
 * @module components/AIAssistantPanel
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAI } from '../contexts/AIContext';
import { useLogContext } from '../contexts/LogContext';
import { 
  Send, 
  X, 
  Copy, 
  Trash2, 
  Sparkles, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import type { LogEntry } from '../types';

interface AIAssistantPanelProps {
  /** Callback when panel should be closed */
  onClose?: () => void;
  /** Optional: Presentation mode for modal or inline panel usage */
  layoutMode?: 'modal' | 'inline';
  /** Optional: Pre-populated query */
  initialQuery?: string;
  /** Optional: Specific logs to analyze (if not provided, uses filtered logs) */
  logs?: LogEntry[];
  /** Optional: Opens Settings modal (for API key errors - actionable next step) */
  onOpenSettings?: () => void;
}

/**
 * Simple markdown renderer for AI responses
 * 
 * Why: No external markdown library needed for basic formatting
 * Handles common cases: code blocks, lists, bold, links, inline code
 * 
 * Security: Uses textContent for user-generated content, only renders
 * safe HTML structures
 */
function MarkdownRenderer({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((copyError) => {
        console.error('Failed to copy AI response:', copyError);
      });
  }, [content]);

  // Simple markdown parsing
  // Why: Basic rendering without external dependencies
  const renderMarkdown = useCallback((text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Code blocks (```...```)
    const codeBlockRegex = /```([\s\S]*?)```/g;
    let match;
    let key = 0;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(<span key={`text-${key++}`}>{renderInlineMarkdown(beforeText)}</span>);
      }
      
      // Code block
      parts.push(
        <pre key={`code-${key++}`} className="bg-[var(--bg-light)] p-3 rounded border border-[var(--border-color)] overflow-x-auto my-2 text-xs font-mono">
          <code>{match[1].trim()}</code>
        </pre>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${key++}`}>{renderInlineMarkdown(text.slice(lastIndex))}</span>);
    }
    
    return parts.length > 0 ? parts : <span>{renderInlineMarkdown(text)}</span>;
  }, []);

  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const nodes: React.ReactNode[] = [];
    const inlineCodeRegex = /`([^`]+)`/g;
    let cursor = 0;
    let codeKey = 0;
    let boldKey = 0;

    const appendBoldSegments = (segment: string) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
      let segmentCursor = 0;
      let boldMatch: RegExpExecArray | null;

      while ((boldMatch = boldRegex.exec(segment)) !== null) {
        if (boldMatch.index > segmentCursor) {
          nodes.push(segment.slice(segmentCursor, boldMatch.index));
        }
        nodes.push(
          <strong key={`bold-${boldKey++}`} className="font-semibold">
            {boldMatch[1]}
          </strong>
        );
        segmentCursor = boldMatch.index + boldMatch[0].length;
      }

      if (segmentCursor < segment.length) {
        nodes.push(segment.slice(segmentCursor));
      }
    };

    let codeMatch: RegExpExecArray | null;
    while ((codeMatch = inlineCodeRegex.exec(text)) !== null) {
      if (codeMatch.index > cursor) {
        appendBoldSegments(text.slice(cursor, codeMatch.index));
      }
      nodes.push(
        <code key={`inline-code-${codeKey++}`} className="bg-[var(--bg-light)] px-1.5 py-0.5 rounded text-xs font-mono">
          {codeMatch[1]}
        </code>
      );
      cursor = codeMatch.index + codeMatch[0].length;
    }

    if (cursor < text.length) {
      appendBoldSegments(text.slice(cursor));
    }

    return nodes.length > 0 ? nodes : text;
  };

  return (
    <div className="prose prose-invert max-w-none">
      <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
        {renderMarkdown(content)}
      </div>
      <button
        onClick={handleCopy}
        className="mt-2 flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        aria-label="Copy response"
      >
        {copied ? (
          <>
            <CheckCircle2 size={12} />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <Copy size={12} />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Pre-defined prompt templates
 * 
 * Why: Common queries that users frequently ask
 * Provides quick actions and demonstrates capabilities
 */
const QUICK_PROMPTS = [
  {
    label: 'Why am I seeing these errors?',
    query: 'Why am I seeing these errors? Analyze the error patterns and explain what might be causing them.',
  },
  {
    label: 'Explain this error pattern',
    query: 'Explain this error pattern. What does it indicate and what troubleshooting steps should I take?',
  },
  {
    label: "What's causing the call failures?",
    query: "What's causing the call failures? Analyze the SIP messages and identify the root cause.",
  },
  {
    label: 'Summarize these logs',
    query: 'Provide a summary of these logs. Highlight key events, errors, and important patterns.',
  },
];

/**
 * AI Assistant Panel Component
 * 
 * Why this component structure?
 * - Chat interface familiar to users
 * - Message history enables context
 * - Pre-defined prompts reduce friction
 * - Context indicator builds trust
 */
export default function AIAssistantPanel({
  onClose,
  layoutMode = 'modal',
  initialQuery,
  logs: providedLogs,
  onOpenSettings,
}: AIAssistantPanelProps) {
  const {
    conversationHistory,
    isLoading,
    error,
    askQuestion,
    clearHistory,
    clearError,
    apiKeyConfigured,
    isEnabled,
  } = useAI();

  const { filteredLogs } = useLogContext();

  // Use provided logs or fall back to filtered logs
  // Why: Allows component to work with specific logs or current filter
  const logsToAnalyze = useMemo(() => {
    return providedLogs || filteredLogs;
  }, [providedLogs, filteredLogs]);

  const [query, setQuery] = useState(initialQuery || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSentInitialQueryRef = useRef(false);
  const safeErrorMessage = useMemo(() => {
    if (!error) {
      return null;
    }

    const normalized = error.toLowerCase();
    if (normalized.includes('api key') || normalized.includes('auth')) {
      return 'AI authentication failed. Open settings and verify your provider credentials.';
    }
    if (normalized.includes('rate limit') || normalized.includes('quota')) {
      return 'AI request limit reached. Please wait and try again.';
    }
    if (normalized.includes('network') || normalized.includes('fetch')) {
      return 'Network issue while contacting the AI provider. Check your connection and retry.';
    }
    return 'AI request failed. Please try again.';
  }, [error]);

  // Auto-scroll to latest message
  // Why: Keeps conversation visible as new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isLoading]);

  // Focus input on mount if no initial query
  // Why: Improves UX by allowing immediate typing
  useEffect(() => {
    if (!initialQuery) {
      inputRef.current?.focus();
    }
  }, [initialQuery]);

  /**
   * Handle sending a query
   * 
   * Why: Validates input, sends to AI, and manages state
   */
  const handleSend = useCallback(async (queryText?: string): Promise<boolean> => {
    const textToSend = queryText || query.trim();
    if (!textToSend || isLoading || !apiKeyConfigured || !isEnabled) {
      return false;
    }
    // Phase 6.2: No logs - AIContext will also reject, but avoid unnecessary round-trip
    if (logsToAnalyze.length === 0) {
      return false;
    }

    // Get log IDs for context
    const logIds = logsToAnalyze.map(log => log.id);

    try {
      // Send question with logs as context
      await askQuestion(textToSend, logIds, logsToAnalyze);

      // Clear input if it was the current query
      if (!queryText) {
        setQuery('');
      }
      return true;
    } catch (sendError) {
      console.error('Failed to send question to AI provider:', sendError);
      return false;
    }
  }, [query, isLoading, apiKeyConfigured, isEnabled, askQuestion, logsToAnalyze]);

  // Auto-send initial query if provided
  // Why: Allows pre-populated queries from other components.
  useEffect(() => {
    if (hasAutoSentInitialQueryRef.current) {
      return;
    }

    if (initialQuery && conversationHistory.length === 0 && apiKeyConfigured && isEnabled) {
      const autoSendInitialQuery = async () => {
        try {
          const didSend = await handleSend(initialQuery);
          if (didSend) {
            hasAutoSentInitialQueryRef.current = true;
          }
        } catch (sendError) {
          console.error('Failed to auto-send initial AI query:', sendError);
        }
      };
      void autoSendInitialQuery();
    }
  }, [apiKeyConfigured, conversationHistory.length, handleSend, initialQuery, isEnabled]);

  /**
   * Handle keyboard shortcuts
   * 
   * Why: Enter to send, Shift+Enter for new line (standard chat UX)
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /**
   * Handle quick prompt click
   * 
   * Why: Pre-populates query for quick actions
   */
  const handleQuickPrompt = useCallback((promptQuery: string) => {
    setQuery(promptQuery);
    inputRef.current?.focus();
    // Optionally auto-send
    // handleSend(promptQuery);
  }, []);

  // Check if AI is properly configured
  const isConfigured = apiKeyConfigured && isEnabled;
  const logCount = logsToAnalyze.length;
  const isInlineLayout = layoutMode === 'inline';

  return (
    <div
      className={`flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] ${
        isInlineLayout ? 'min-h-0 overflow-hidden rounded-none' : ''
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-[var(--border-color)] ${
          isInlineLayout ? 'px-3 py-2.5' : 'p-4'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--accent-blue)]" />
          <h2 className="text-lg font-semibold">AI Assistant</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close assistant"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Context Indicator - Phase 6.2: Show log count, sampling notice, or empty state */}
      {logCount > 0 ? (
        <div className="px-4 py-2 bg-[var(--bg-light)] border-b border-[var(--border-color)] text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <FileText size={14} />
          <span>
            {logCount > 10000
              ? `Analyzing sample from ${logCount.toLocaleString()} logs (context optimized for token limits)`
              : `Analyzing ${logCount} log${logCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      ) : isConfigured && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <AlertCircle size={14} />
          <span>Load logs first to use AI analysis. Select or filter logs to analyze.</span>
        </div>
      )}

      {/* Not Configured Message */}
      {!isConfigured && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <AlertCircle size={48} className="mx-auto mb-4 text-[var(--text-secondary)]" />
            <h3 className="text-lg font-semibold mb-2">AI Features Not Configured</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Please configure your API key and enable AI features in settings to use the AI Assistant.
            </p>
          </div>
        </div>
      )}

      {/* Messages Area */}
      {isConfigured && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Quick Prompts (shown when no messages) */}
            {conversationHistory.length === 0 && !isLoading && (
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-secondary)] mb-2">Quick actions:</div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickPrompt(prompt.query)}
                      className="text-left px-3 py-2 bg-[var(--bg-light)] hover:bg-[var(--bg-light)]/80 border border-[var(--border-color)] rounded text-sm transition-colors"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {conversationHistory.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={16} className="text-[var(--accent-blue)]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-[var(--bg-light)] border border-[var(--border-color)]'
                  }`}
                >
                  {message.role === 'user' ? (
                    <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-light)] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-[var(--text-secondary)]">You</span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={16} className="text-[var(--accent-blue)]" />
                </div>
                <div className="bg-[var(--bg-light)] border border-[var(--border-color)] rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing logs...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Display - Phase 6.1: Clear, actionable, dismissible */}
          {safeErrorMessage && (
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-red-400 min-w-0 flex-1">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span className="break-words">{safeErrorMessage}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {onOpenSettings && error !== null && (error.toLowerCase().includes('api key') || error.toLowerCase().includes('settings')) && (
                  <button
                    onClick={onOpenSettings}
                    className="text-xs font-medium text-red-400 hover:text-red-300 underline"
                    aria-label="Open AI Settings"
                  >
                    Open Settings
                  </button>
                )}
                <button
                  onClick={clearError}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-[var(--border-color)]">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your logs..."
                disabled={isLoading || !isConfigured}
                rows={3}
                className="flex-1 px-3 py-2 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleSend()}
                  disabled={!query.trim() || isLoading || !isConfigured || logCount === 0}
                  title={logCount === 0 ? 'Load logs first to use AI analysis' : undefined}
                  className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded text-sm font-medium hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  aria-label="Send message"
                  aria-describedby={logCount === 0 ? 'no-logs-tooltip' : undefined}
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
                {conversationHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="px-4 py-2 bg-[var(--bg-light)] border border-[var(--border-color)] rounded text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-light)]/80 flex items-center gap-2"
                    aria-label="Clear history"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-[var(--text-tertiary)]">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </>
      )}
    </div>
  );
}

# LLM Integration Implementation Plan for NocLense

## Table of Contents
1. [Overview](#overview)
2. [Phase Implementation Plan](#phase-implementation-plan)
3. [Testing Strategy](#testing-strategy)
4. [Code Standards & Comments](#code-standards--comments)
5. [Cursor Rules Configuration](#cursor-rules-configuration)

---

## Overview

**Objective**: Integrate Google Gemini AI API to provide intelligent log analysis and troubleshooting assistance in NocLense.

**Architecture Decision Rationale**:
- **Why Gemini?**: Free tier with 1,500 requests/day, 1M token context window, no credit card required
- **Why Services Pattern?**: Separation of concerns - AI logic isolated from UI components
- **Why Context API?**: Consistent with existing LogContext pattern, provides global AI state management
- **Why Optional Feature?**: User privacy control, API key requirement, graceful degradation

---

## Phase Implementation Plan

### **PHASE 1: Foundation & API Integration**
**Goal**: Set up Gemini API client and basic infrastructure
**Duration**: 2-3 days
**Dependencies**: None

#### 1.1 Install Dependencies

**PROMPT FOR CURSOR:**
```
Install the following npm packages for Gemini AI integration:
- @google/generative-ai (latest version)

Add these to package.json dependencies. Ensure TypeScript types are available.
```

**Manual Command**:
```bash
npm install @google/generative-ai
```

**Why These Dependencies**:
- `@google/generative-ai`: Official Google SDK with TypeScript support, streaming, and error handling built-in

---

#### 1.2 Create Type Definitions

**FILE**: `src/types/ai.ts`

**PROMPT FOR CURSOR:**
```
Create a new file src/types/ai.ts with TypeScript type definitions for the AI integration feature.

Include the following types:
1. AIMessage - represents a chat message (user or assistant)
2. AIAnalysisRequest - represents a request to analyze logs
3. AIAnalysisResponse - represents the AI's response
4. AIConfig - configuration for API key, model selection, and limits
5. AIUsageStats - tracks API usage (requests per day, tokens used)

For each type, add JSDoc comments explaining:
- Purpose of the type
- Why each field exists
- Validation constraints

Reasoning:
- Strong typing prevents runtime errors
- JSDoc provides inline documentation
- Separates AI concerns from existing log types
- Makes the API contract explicit and maintainable
```

**Expected File Structure**:
```typescript
// src/types/ai.ts

/**
 * Represents a message in the AI conversation
 * Why: Enables chat-style interaction with conversation history
 */
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // Associated log IDs provide context for the conversation
  logIds?: number[];
}

/**
 * Configuration for AI service
 * Why: Allows users to control API usage, costs, and model selection
 */
export interface AIConfig {
  apiKey: string;
  model: 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash';
  // Free tier limit is 1,500 RPD; allow users to set lower limit for budget control
  dailyRequestLimit: number;
  // Enable/disable to respect user privacy preferences
  enabled: boolean;
}

// ... additional types
```

---

#### 1.3 Create LLM Service

**FILE**: `src/services/llmService.ts`

**PROMPT FOR CURSOR:**
```
Create src/services/llmService.ts as the main service for interacting with Google Gemini API.

Requirements:
1. Export a GeminiService class with the following methods:
   - initialize(apiKey: string, model: string): Initialize the Gemini client
   - analyzeLog(query: string, logs: LogEntry[], options?): Send logs to Gemini for analysis
   - streamResponse(query: string, logs: LogEntry[]): Stream response for better UX
   - validateApiKey(apiKey: string): Test if API key is valid
   - getUsageStats(): Return current usage statistics

2. Implement rate limiting:
   - Track requests per minute (15 RPM for free tier)
   - Track requests per day (1,500 RPD for free tier)
   - Throw appropriate errors when limits exceeded

3. Error handling:
   - Invalid API key
   - Network errors
   - Rate limit errors
   - Token limit exceeded
   - API quota exceeded

4. Add comprehensive JSDoc comments explaining:
   - Why singleton pattern is used
   - Why rate limiting is necessary
   - How error handling works
   - Security considerations

Reasoning:
- Singleton ensures single API client instance (prevents multiple connections)
- Rate limiting prevents unexpected API charges and quota exhaustion
- Streaming improves perceived performance for long responses
- Error handling provides clear user feedback
- Service pattern isolates API logic from UI components

Reference the existing LogContext.tsx for patterns on state management and error handling.
```

**Key Implementation Notes**:
```typescript
// src/services/llmService.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LogEntry } from '../types';
import type { AIConfig, AIUsageStats } from '../types/ai';

/**
 * Singleton service for managing Gemini AI interactions
 * 
 * Why Singleton?
 * - Ensures single API client instance across the app
 * - Centralizes rate limiting and usage tracking
 * - Prevents multiple concurrent API connections
 * - Simplifies state management for API quota
 */
export class GeminiService {
  private static instance: GeminiService;
  private client: GoogleGenerativeAI | null = null;
  private model: any = null;
  
  // Rate limiting state
  // Why: Free tier has 15 RPM, 1,500 RPD limits - must track to avoid quota errors
  private requestsThisMinute: number = 0;
  private requestsToday: number = 0;
  private lastMinuteReset: number = Date.now();
  private lastDayReset: number = Date.now();
  
  // ... implementation
}
```

---

#### 1.4 Create Context Builder Service

**FILE**: `src/services/logContextBuilder.ts`

**PROMPT FOR CURSOR:**
```
Create src/services/logContextBuilder.ts to prepare log data for sending to the LLM.

Requirements:
1. Export a LogContextBuilder class with methods:
   - buildContext(logs: LogEntry[], focusLogId?: number): Format logs for LLM
   - extractErrorPatterns(logs: LogEntry[]): Identify error clusters
   - addCorrelationContext(logs: LogEntry[], correlations: CorrelationItem[]): Include related logs
   - optimizeContextSize(context: string, maxTokens: number): Truncate intelligently
   - generateSummary(logs: LogEntry[]): Create statistical summary

2. Context optimization strategy:
   - Prioritize ERROR and WARN level logs
   - Include temporal context (logs before/after errors)
   - Truncate long payloads (preserve first/last 200 chars)
   - Remove duplicate messages (keep first occurrence with count)
   - Format for LLM readability (structured markdown)

3. Token estimation:
   - Implement rough token counting (1 token ≈ 4 characters)
   - Target 5,000-10,000 tokens for typical queries
   - Never exceed 100,000 tokens (leave room for response)

4. Add detailed comments explaining:
   - Why certain logs are prioritized
   - How context window is managed
   - Why payload truncation is necessary
   - How correlation context helps accuracy

Reasoning:
- Context quality directly impacts AI response accuracy
- Token optimization reduces API costs and improves speed
- Error prioritization focuses AI on relevant issues
- Temporal context helps AI understand event sequences
- Structured formatting improves LLM comprehension

Reference src/contexts/LogContext.tsx to understand how logs are structured and filtered.
Reference src/types.ts for LogEntry and CorrelationItem interfaces.
```

**Key Implementation Patterns**:
```typescript
// src/services/logContextBuilder.ts

/**
 * Why separate context builder?
 * - Separates data preparation from API calls
 * - Reusable across different AI queries
 * - Testable in isolation
 * - Easier to optimize and refine
 */
export class LogContextBuilder {
  
  /**
   * Build optimized context from logs
   * 
   * Strategy:
   * 1. Prioritize errors (most relevant for troubleshooting)
   * 2. Add surrounding context (understand what led to errors)
   * 3. Include correlations (related logs across files/components)
   * 4. Format for LLM (structured, readable markdown)
   * 
   * Why this approach?
   * - Focuses AI attention on actionable issues
   * - Provides causal context without overwhelming with data
   * - Respects token limits while maximizing information density
   */
  buildContext(logs: LogEntry[], options?: ContextOptions): string {
    // Implementation
  }
}
```

---

### **PHASE 2: State Management & Context**
**Goal**: Create React context for AI state management
**Duration**: 2-3 days
**Dependencies**: Phase 1 complete

#### 2.1 Create AI Context

**FILE**: `src/contexts/AIContext.tsx`

**PROMPT FOR CURSOR:**
```
Create src/contexts/AIContext.tsx following the same pattern as src/contexts/LogContext.tsx.

Requirements:
1. Create AIContextType interface with:
   - State: isEnabled, apiKeyConfigured, model, conversationHistory, isLoading, error
   - Actions: askQuestion, setApiKey, setModel, clearHistory, getUsageStats
   
2. Create AIProvider component:
   - Initialize state from localStorage (persist API key, config)
   - Load usage stats from localStorage
   - Provide all AI functionality to child components
   - Handle errors gracefully with user-friendly messages

3. Export useAI() hook:
   - Return context value
   - Throw error if used outside provider
   
4. Implement localStorage persistence:
   - Save API key securely (note: in Electron, use secure storage later)
   - Save model preference
   - Save daily usage stats (reset at midnight UTC)
   - Save enabled/disabled state

5. Add comprehensive comments:
   - Why state is structured this way
   - Why localStorage is used (and limitations)
   - How usage tracking works
   - Security considerations for API key storage

Reasoning:
- Context API provides global state consistent with existing patterns
- localStorage persistence maintains config across sessions
- Usage tracking prevents accidental quota exhaustion
- Graceful error handling maintains app stability
- Hook pattern simplifies component consumption

Reference LogContext.tsx for patterns. Maintain consistency with existing context architecture.
```

**Key Implementation Notes**:
```typescript
// src/contexts/AIContext.tsx

/**
 * AI Context for managing Gemini integration state
 * 
 * Why Context API?
 * - Consistent with existing LogContext pattern
 * - Provides global AI state without prop drilling
 * - Enables any component to access AI features
 * - Simplifies testing and mocking
 */

interface AIContextType {
  // State
  isEnabled: boolean;
  apiKeyConfigured: boolean;
  model: AIModel;
  conversationHistory: AIMessage[];
  isLoading: boolean;
  error: string | null;
  usageStats: AIUsageStats;
  
  // Actions
  askQuestion: (query: string, logIds?: number[]) => Promise<void>;
  setApiKey: (key: string) => Promise<boolean>;
  // ... etc
}

/**
 * Why localStorage for API key?
 * - Pros: Simple, persists across sessions, no backend needed
 * - Cons: Not fully secure (XSS risk), visible in dev tools
 * - Mitigation: Show security warning to users, recommend Electron secure storage
 * - Future: Implement electron-store for production Electron builds
 */
```

---

### **PHASE 3: UI Components**
**Goal**: Build user interface for AI interactions
**Duration**: 3-4 days
**Dependencies**: Phase 2 complete

#### 3.1 AI Settings Panel

**FILE**: `src/components/AISettingsPanel.tsx`

**PROMPT FOR CURSOR:**
```
Create src/components/AISettingsPanel.tsx for configuring AI features.

Requirements:
1. UI Elements:
   - API key input (password field with show/hide toggle)
   - "Get Free API Key" button (links to ai.google.dev)
   - Model selector (radio buttons for Flash/Pro)
   - Enable/disable AI features toggle
   - Usage statistics display (requests today, percentage of limit)
   - "Test Connection" button to validate API key
   
2. Features:
   - Real-time API key validation
   - Show success/error messages with toast notifications
   - Display cost estimates based on model selection
   - Warning when approaching daily limits
   - Privacy notice about data being sent to Google
   
3. Styling:
   - Follow existing NocLense design system (reference FilterBar.tsx)
   - Use Tailwind classes consistently
   - Responsive layout
   - Accessible (ARIA labels, keyboard navigation)
   
4. Add comments explaining:
   - Why password field is used for API key
   - Why real-time validation is important
   - How usage warnings help users
   - Security considerations displayed to users

Reasoning:
- Settings UI is entry point for AI features - must be intuitive
- Real-time validation prevents invalid API key frustration
- Usage display builds trust and prevents surprise charges
- Privacy notice respects user consent
- Consistent styling maintains professional appearance

Reference src/components/FilterBar.tsx for existing styling patterns and Tailwind usage.
Reference src/contexts/AIContext.tsx for state management integration.
```

---

#### 3.2 AI Assistant Panel

**FILE**: `src/components/AIAssistantPanel.tsx`

**PROMPT FOR CURSOR:**
```
Create src/components/AIAssistantPanel.tsx as the main chat interface for AI interactions.

Requirements:
1. Layout:
   - Header with title and close button
   - Message list (scrollable, auto-scroll to latest)
   - Input area with text field and send button
   - Loading indicator when AI is responding
   - Error display area

2. Features:
   - Pre-defined prompt buttons (quick actions):
     * "Why am I seeing these errors?"
     * "Explain this error pattern"
     * "What's causing the call failures?"
     * "Summarize these logs"
   - Message history (user + assistant messages)
   - Markdown rendering for AI responses (code blocks, lists, etc.)
   - Copy response button for each AI message
   - Clear history button
   - Context indicator showing which logs are being analyzed
   
3. Interactivity:
   - Submit on Enter, Shift+Enter for new line
   - Disable input while loading
   - Show typing indicator when streaming response
   - Smooth animations for message appearance
   
4. Integration:
   - Access filtered logs from LogContext
   - Send selected/filtered logs as context
   - Display log IDs being analyzed
   - Allow clicking log ID to jump to that log
   
5. Add detailed comments:
   - Why chat interface pattern is used
   - How context from logs is attached
   - Why markdown rendering is important
   - How streaming improves UX
   - Accessibility considerations

Reasoning:
- Chat interface is familiar and intuitive for AI interactions
- Pre-defined prompts help users get started quickly
- Markdown rendering displays structured responses clearly
- Context indicator builds trust (users see what AI analyzes)
- Message history enables iterative refinement of questions
- Smooth UX maintains professional feel

Reference src/components/LogViewer.tsx for log interaction patterns.
Reference src/contexts/LogContext.tsx for accessing filtered logs.
Use lucide-react for icons consistently with existing components.
```

**Key UI/UX Decisions**:
```typescript
// src/components/AIAssistantPanel.tsx

/**
 * Why chat interface instead of single query/response?
 * - Enables iterative refinement ("Tell me more about...")
 * - Maintains conversation history for context
 * - Familiar pattern (ChatGPT, etc.)
 * - Allows follow-up questions without re-selecting logs
 */

/**
 * Why pre-defined prompts?
 * - Reduces friction for new users (examples of what to ask)
 * - Ensures queries are well-formed
 * - Faster than typing common questions
 * - Demonstrates capabilities
 */

/**
 * Why show which logs are being analyzed?
 * - Transparency builds trust
 * - Users can verify correct context
 * - Helps debug unexpected responses
 * - Educational (shows how to select relevant logs)
 */
```

---

#### 3.3 AI Action Buttons

**FILE**: `src/components/AIButton.tsx`

**PROMPT FOR CURSOR:**
```
Create src/components/AIButton.tsx as a reusable button component for triggering AI actions.

Requirements:
1. Props:
   - variant: 'primary' | 'secondary' | 'icon'
   - logs: LogEntry[] (logs to analyze)
   - promptType: 'explain' | 'analyze' | 'troubleshoot' | 'custom'
   - customPrompt?: string (for custom queries)
   - disabled?: boolean
   - onSuccess?: callback after AI response
   
2. Features:
   - Opens AIAssistantPanel with pre-populated query
   - Disabled state when no API key configured
   - Tooltip explaining why disabled
   - Loading state during analysis
   - Icon from lucide-react (Sparkles icon for AI)
   
3. Integration points:
   - Place in LogViewer toolbar
   - Place in LogDetailsPanel
   - Place in CorrelationSidebar
   - Context menu for selected logs
   
4. Add comments explaining:
   - Why reusable component instead of inline buttons
   - How it communicates with AIContext
   - Disabled state logic
   - Icon choice reasoning

Reasoning:
- Reusable component ensures consistent behavior
- Pre-populated queries improve UX
- Disabled state with tooltip guides configuration
- Strategic placement makes AI accessible throughout app
- Icon choice (Sparkles) is recognizable AI symbol

Reference existing button patterns in src/components/ui/Button.tsx for styling consistency.
```

---

### **PHASE 4: Integration with Existing Features**
**Goal**: Connect AI features to existing NocLense functionality
**Duration**: 2-3 days
**Dependencies**: Phase 3 complete

#### 4.1 Integrate with LogViewer

**FILE**: `src/components/LogViewer.tsx` (modifications)

**PROMPT FOR CURSOR:**
```
Update src/components/LogViewer.tsx to integrate AI assistance.

Changes needed:
1. Add AI button to toolbar (next to existing filter/sort controls)
2. Pass currently filtered logs to AI button
3. Show AI panel as overlay or side panel (configurable)
4. Add keyboard shortcut (Cmd/Ctrl + K) to open AI assistant

Implementation:
- Import AIButton and AIAssistantPanel
- Add state for AI panel visibility
- Wire up filtered logs from LogContext to AI components
- Maintain existing functionality (no breaking changes)

Add comments explaining:
- Why toolbar placement was chosen
- How filtered logs are passed to AI
- Panel visibility logic
- Keyboard shortcut choice

Reasoning:
- Toolbar placement is discoverable without cluttering UI
- Filtered logs provide relevant context automatically
- Overlay/side panel keeps logs visible during AI chat
- Keyboard shortcut enables power user workflow

Read the current src/components/LogViewer.tsx first to understand existing structure.
Reference src/contexts/LogContext.tsx for accessing filteredLogs.
Maintain existing component patterns and styling.
```

---

#### 4.2 Integrate with LogDetailsPanel

**FILE**: `src/components/log/LogDetailsPanel.tsx` (modifications)

**PROMPT FOR CURSOR:**
```
Update src/components/log/LogDetailsPanel.tsx to add "Explain this log" AI action.

Changes needed:
1. Add "Explain with AI" button in the panel header or actions area
2. Pass the currently selected log + surrounding context (5 before, 5 after)
3. Pre-populate AI query: "Explain this error and suggest troubleshooting steps"

Implementation:
- Import AIButton component
- Get selected log from LogContext
- Get surrounding logs for context
- Wire up to AI assistant

Add comments:
- Why surrounding logs are included
- Query template reasoning
- Button placement decision

Reasoning:
- Single log explanation is common use case
- Surrounding context helps AI understand sequence of events
- Quick access from details panel improves workflow
- Pre-populated query makes feature obvious

Read current src/components/log/LogDetailsPanel.tsx first.
Maintain existing functionality and styling patterns.
```

---

#### 4.3 Integrate with CorrelationSidebar

**FILE**: `src/components/CorrelationSidebar.tsx` (modifications)

**PROMPT FOR CURSOR:**
```
Update src/components/CorrelationSidebar.tsx to add "Analyze correlation" AI action.

Changes needed:
1. Add AI button for each active correlation
2. Query template: "Analyze logs for {correlationType}: {correlationValue}"
3. Pass logs filtered by that correlation

Implementation:
- Add AIButton next to each correlation item
- Include correlation metadata in AI context
- Pre-populate relevant query

Add comments:
- Why correlation-specific analysis is useful
- How correlation context enhances AI accuracy

Reasoning:
- Correlation analysis is a key troubleshooting workflow
- AI can identify patterns across correlated logs
- Contextual AI queries are more accurate than generic ones

Read current src/components/CorrelationSidebar.tsx first.
Understand correlation structure from src/contexts/LogContext.tsx.
```

---

### **PHASE 5: Prompt Engineering & Templates**
**Goal**: Create effective prompts for accurate AI responses
**Duration**: 2-3 days
**Dependencies**: Phase 4 complete

#### 5.1 Create Prompt Templates

**FILE**: `src/services/promptTemplates.ts`

**PROMPT FOR CURSOR:**
```
Create src/services/promptTemplates.ts with pre-engineered prompts for common scenarios.

Requirements:
1. Export prompt template functions that accept:
   - logs: LogEntry[]
   - context: { timeRange, logCount, errorCount, correlations }
   - userQuery: string
   
2. Templates needed:
   - ERROR_ANALYSIS: Why errors occurred, root cause, recommendations
   - PATTERN_RECOGNITION: Identify recurring issues
   - CALL_FLOW_ANALYSIS: SIP/VoIP specific troubleshooting
   - TIMELINE_ANALYSIS: What happened during time period
   - CORRELATION_ANALYSIS: Analyze related logs
   - GENERAL_QUERY: Open-ended questions
   
3. Prompt engineering best practices:
   - Give AI a role: "You are a telecommunications log analysis expert"
   - Provide context: System info, time range, log types
   - Be specific: Request structured output (bullet points, numbered steps)
   - Include examples: Show desired response format
   - Add constraints: "Reference log IDs", "Be concise"
   
4. Format logs for LLM:
   - Structured markdown with clear sections
   - Highlight errors/warnings
   - Include relevant metadata
   - Truncate long payloads
   
5. Add extensive comments:
   - Why each prompt is structured this way
   - What makes the prompt effective
   - How to customize for different scenarios
   - Examples of good vs bad prompts

Reasoning:
- Well-engineered prompts dramatically improve accuracy
- Templates ensure consistency across different queries
- Structured output is easier to display and parse
- Domain-specific context (telecom/VoIP) improves relevance
- Modular templates enable easy refinement

Research prompt engineering best practices for log analysis before implementing.
Reference src/types.ts for LogEntry structure to format logs correctly.
```

**Key Prompt Engineering Patterns**:
```typescript
// src/services/promptTemplates.ts

/**
 * Why structured prompts instead of passing raw user questions?
 * - Ensures AI has necessary context (system type, log format)
 * - Produces consistent, actionable responses
 * - Handles edge cases (no errors, mixed log types)
 * - Easier to improve over time with A/B testing
 */

export const ERROR_ANALYSIS_TEMPLATE = (
  logs: LogEntry[],
  context: AnalysisContext
): string => {
  return `You are an expert in telecommunications and VoIP log analysis, specializing in SIP, call flow troubleshooting, and network issues.

CONTEXT:
- System: NocLense Log Analyzer
- Time Range: ${context.timeRange.start} to ${context.timeRange.end}
- Total Logs: ${context.logCount}
- Error Count: ${context.errorCount}
- Components: ${context.components.join(', ')}

LOGS:
${formatLogsForLLM(logs)}

TASK:
Analyze these logs and provide:

1. **Error Summary**: What errors occurred? (2-3 sentences)
2. **Root Cause Analysis**: Why did these errors happen? Consider:
   - Temporal patterns (what happened before errors?)
   - Component relationships (which systems are involved?)
   - Correlation IDs (related transactions)
3. **Impact Assessment**: Severity and user impact
4. **Recommended Actions**: Specific troubleshooting steps (numbered list)

CONSTRAINTS:
- Reference specific log IDs using [Log #123] format
- Be concise but thorough
- Focus on actionable insights
- If uncertain, say so clearly

OUTPUT FORMAT:
Use markdown with clear sections as shown above.`;
};

/**
 * Why this prompt structure works:
 * 1. Role: Establishes domain expertise for accurate technical responses
 * 2. Context: Provides metadata AI needs to understand log scale/scope
 * 3. Logs: Formatted data for analysis
 * 4. Task: Clear deliverables with structured format
 * 5. Constraints: Ensures responses are useful (log IDs, concise, honest)
 * 
 * Result: Consistent, high-quality, actionable analysis
 */
```

---

### **PHASE 6: Error Handling & Edge Cases**
**Goal**: Handle failures gracefully and edge cases
**Duration**: 2 days
**Dependencies**: Phase 5 complete

#### 6.1 Comprehensive Error Handling

**PROMPT FOR CURSOR:**
```
Review and enhance error handling across all AI-related files:
- src/services/llmService.ts
- src/contexts/AIContext.tsx
- src/components/AIAssistantPanel.tsx

Add handling for:
1. Invalid API key (clear error message, link to setup)
2. Network errors (retry logic with exponential backoff)
3. Rate limits (clear message, show when limits reset)
4. Token limits exceeded (truncate context automatically, warn user)
5. API quota exceeded (explain free tier limits, suggest upgrade)
6. Malformed responses (fallback message)
7. Empty log context (warn user to select/filter logs first)

For each error type:
- User-friendly error message
- Actionable next steps
- Appropriate UI feedback (toast, inline message, modal)
- Logging for debugging (console.error with context)

Add comments explaining:
- Why each error is handled differently
- Retry logic reasoning
- User message choices
- When to fail silently vs loudly

Reasoning:
- API failures are common (network issues, invalid keys, quotas)
- Clear errors reduce user frustration and support burden
- Graceful degradation maintains app stability
- Actionable messages guide users to resolution
- Retry logic handles transient failures automatically

Test each error scenario manually and document test cases.
```

---

#### 6.2 Edge Case Handling

**PROMPT FOR CURSOR:**
```
Implement handling for edge cases in AI features:

1. No logs available:
   - Disable AI buttons
   - Show tooltip: "Load logs first to use AI analysis"
   
2. Too many logs selected (>10,000):
   - Warn user about token limits
   - Auto-sample logs (keep errors, sample others)
   - Show: "Analyzing sample of 500 logs (10,000 selected)"
   
3. No errors in logs (all INFO/DEBUG):
   - Adjust prompt to focus on patterns/insights
   - Don't assume problems exist
   
4. Very short logs (<10 logs):
   - Warn that analysis may be limited
   - Proceed anyway (don't block)
   
5. API key not set:
   - Show setup modal on first AI action attempt
   - Link to API key guide
   
6. Logs from multiple files with different formats:
   - Include file context in prompt
   - Handle mixed log formats gracefully
   
7. User queries in non-English:
   - Pass through (Gemini supports multiple languages)
   - Response will match query language

Add comments explaining:
- Why each edge case matters
- Trade-offs in handling approach
- User experience considerations

Reasoning:
- Edge cases cause majority of user frustration
- Proactive warnings prevent confusion
- Auto-sampling balances accuracy and token limits
- Context-aware prompts improve response quality
- Graceful fallbacks maintain professional appearance

Document all edge cases in code comments for future maintenance.
```

---

### **PHASE 7: Security & Privacy**
**Goal**: Implement security best practices and user consent
**Duration**: 2 days
**Dependencies**: Phase 6 complete

#### 7.1 Privacy & Consent Flow

**FILE**: `src/components/AIConsentModal.tsx`

**PROMPT FOR CURSOR:**
```
Create src/components/AIConsentModal.tsx for first-time AI usage consent.

Requirements:
1. Modal that appears before first AI query
2. Content:
   - Clear explanation: "AI analysis sends your log data to Google's Gemini API"
   - What data is sent: "Selected log messages, timestamps, components, error messages"
   - What's NOT sent: "No automatic uploads - only logs you choose to analyze"
   - Privacy notice: Link to Google AI Terms of Service
   - Recommendation: "Review logs for sensitive information (passwords, PII) before analysis"
   - Option: "Don't send log payloads (reduces accuracy but increases privacy)"
   
3. Actions:
   - "I Understand, Enable AI" (saves consent to localStorage)
   - "Learn More" (expands details)
   - "Cancel" (closes modal, disables AI)
   - Checkbox: "Don't show this again"
   
4. Styling:
   - Professional, trustworthy design
   - Clear hierarchy (important info stands out)
   - Not dismissible by clicking outside (requires explicit choice)

Add comments explaining:
- Why explicit consent is required
- What privacy considerations exist
- How consent is persisted
- Why payload option is offered

Reasoning:
- Transparency builds trust
- Explicit consent respects user privacy and may be legally required
- Payload option gives users control over sensitive data
- Clear communication prevents misuse/misunderstanding
- Professional presentation maintains brand credibility

Reference existing modal patterns in src/components/ui/Modal.tsx for consistency.
```

---

#### 7.2 Data Sanitization (Optional)

**FILE**: `src/services/dataSanitizer.ts`

**PROMPT FOR CURSOR:**
```
Create src/services/dataSanitizer.ts to optionally redact sensitive data before sending to AI.

Requirements:
1. Export sanitize() function that accepts LogEntry[] and returns sanitized copy
2. Detection patterns for:
   - Phone numbers (various formats)
   - Email addresses
   - IP addresses (IPv4/IPv6)
   - Credit card numbers
   - Social security numbers
   - Passwords in logs (password=, pwd=, etc.)
   - API keys (Bearer tokens, api_key=, etc.)
   - Custom patterns (user-configurable)

3. Redaction strategy:
   - Replace with placeholders: [PHONE], [EMAIL], [IP], [REDACTED]
   - Preserve structure: "555-1234" → "[PHONE]" (not removed completely)
   - Maintain log readability for AI

4. Configuration:
   - Enable/disable in settings
   - Customize redaction patterns
   - Preview redacted logs before sending

Add detailed comments:
- Regex patterns explanation
- Why structure preservation matters
- Limitations (can't catch everything)
- Performance considerations

Reasoning:
- Adds safety layer for sensitive environments
- Opt-in feature respects user choice
- Placeholders maintain context for AI analysis
- Custom patterns support org-specific needs
- Preview builds confidence

Note: This is an optional feature. Users should review logs themselves as primary defense.
```

---

### **PHASE 8: Performance Optimization**
**Goal**: Ensure AI features don't slow down the app
**Duration**: 2 days
**Dependencies**: Phase 7 complete

#### 8.1 Optimization Tasks

**PROMPT FOR CURSOR:**
```
Optimize AI integration for performance:

1. Lazy load AI components:
   - Use React.lazy() for AIAssistantPanel
   - Only load when AI is enabled and user opens panel
   - Reduces initial bundle size
   
2. Debounce API calls:
   - If user types quickly, don't send every keystroke
   - Wait 300ms after user stops typing
   
3. Memoize context building:
   - Use useMemo for formatLogsForLLM()
   - Recompute only when logs change
   
4. Implement streaming efficiently:
   - Stream tokens as they arrive (don't buffer)
   - Update UI incrementally
   - Use React 18 concurrent features if available
   
5. Cache responses:
   - Store recent queries and responses
   - If user asks same question, return cached result
   - Cache expires after 1 hour or when logs change
   
6. Web Worker for context building (optional):
   - Offload heavy log processing to worker
   - Keep UI responsive during large log analysis

Add comments explaining:
- Why each optimization is necessary
- Performance impact measurements
- Trade-offs (complexity vs speed)

Reasoning:
- AI features shouldn't slow down core log viewing
- Large log files (100k+ logs) need efficient processing
- Streaming improves perceived performance
- Caching reduces API costs and latency
- Workers prevent UI blocking during heavy computation

Measure performance before and after optimizations. Document in comments.
```

---

### **PHASE 9: Polish & Documentation**
**Goal**: Final refinements and comprehensive documentation
**Duration**: 2-3 days
**Dependencies**: Phase 8 complete

#### 9.1 User Documentation

**FILE**: `LLM_INTEGRATION_USER_GUIDE.md`

**PROMPT FOR CURSOR:**
```
Create LLM_INTEGRATION_USER_GUIDE.md with comprehensive user documentation.

Sections:
1. **Getting Started**:
   - How to get free Google API key (step-by-step with screenshots)
   - How to configure in NocLense
   - Testing the connection
   
2. **Using AI Analysis**:
   - Where to find AI features in the UI
   - Pre-defined prompts and when to use them
   - Writing effective custom queries
   - Understanding AI responses
   
3. **Best Practices**:
   - How to select relevant logs for analysis
   - Asking follow-up questions
   - Interpreting AI suggestions
   - What AI can and cannot do
   
4. **Troubleshooting**:
   - "Invalid API key" error
   - "Rate limit exceeded" error
   - "Poor quality responses" - how to improve queries
   - API quota management
   
5. **Privacy & Security**:
   - What data is sent to Google
   - How to review logs before analysis
   - Using data sanitization features
   - API key security best practices
   
6. **FAQ**:
   - Cost questions
   - Accuracy expectations
   - Supported languages
   - Feature limitations

Use clear, non-technical language. Include examples and screenshots where helpful.
```

---

#### 9.2 Developer Documentation

**FILE**: `LLM_INTEGRATION_DEVELOPER_GUIDE.md`

**PROMPT FOR CURSOR:**
```
Create LLM_INTEGRATION_DEVELOPER_GUIDE.md for future developers maintaining this feature.

Sections:
1. **Architecture Overview**:
   - Component hierarchy diagram
   - Data flow (logs → context → API → response → UI)
   - State management explanation
   
2. **Key Files & Responsibilities**:
   - Each file's purpose
   - Dependencies between files
   - Extension points
   
3. **Prompt Engineering**:
   - How prompts are structured
   - Customizing prompts
   - Testing prompt effectiveness
   - A/B testing prompts
   
4. **Adding New Features**:
   - How to add new prompt templates
   - How to add AI actions to new components
   - How to extend context builder
   
5. **Debugging**:
   - Common issues and solutions
   - Logging strategy
   - Testing with mock API responses
   
6. **Performance Considerations**:
   - Token usage optimization
   - Rate limiting strategy
   - Caching approach
   
7. **Security Notes**:
   - API key handling
   - Data sanitization
   - Privacy compliance

Include code examples and reference relevant files throughout.
```

---

## Testing Strategy

### Testing Approach Overview

**Why Testing Matters for AI Integration**:
- AI features involve external API calls (flaky, rate-limited)
- User input is unpredictable (edge cases abound)
- Context building logic is complex (many branches)
- Errors must be handled gracefully (many failure modes)
- Performance impacts core app (must be tested)

**Testing Layers**:
1. **Unit Tests**: Services and utilities in isolation
2. **Integration Tests**: Components with mocked API
3. **E2E Tests**: Full workflows with real API (dev environment)
4. **Manual Testing**: UX validation, edge cases

---

### Unit Testing

#### Test: LLM Service

**FILE**: `src/services/__tests__/llmService.test.ts`

**PROMPT FOR CURSOR:**
```
Create unit tests for src/services/llmService.ts using Vitest (or Jest if already configured).

Tests to implement:
1. API key validation:
   - Valid API key returns true
   - Invalid API key returns false
   - Empty string throws error
   
2. Rate limiting:
   - Blocks requests after 15 per minute
   - Blocks requests after daily limit
   - Resets counters correctly
   
3. Error handling:
   - Network errors thrown with correct type
   - Invalid API key errors thrown
   - Quota exceeded errors thrown
   
4. Context preparation:
   - Logs formatted correctly
   - Token limits respected
   - Sanitization applied when enabled

Mock the Gemini API using jest.mock() or similar.
Add comments explaining what each test validates and why.

Run tests with: npm test
```

---

#### Test: Context Builder

**FILE**: `src/services/__tests__/logContextBuilder.test.ts`

**PROMPT FOR CURSOR:**
```
Create unit tests for src/services/logContextBuilder.ts.

Tests to implement:
1. Context building:
   - Prioritizes ERROR logs correctly
   - Includes surrounding context (before/after)
   - Truncates long payloads
   - Formats markdown correctly
   
2. Token optimization:
   - Stays under max token limit
   - Removes duplicates correctly
   - Preserves critical information
   
3. Edge cases:
   - Empty log array returns valid context
   - Single log works correctly
   - 10,000+ logs truncated intelligently
   - Mixed log levels handled

Use sample LogEntry objects for testing.
Validate output structure and content.
```

---

### Integration Testing

#### Test: AI Context with Components

**FILE**: `src/contexts/__tests__/AIContext.test.tsx`

**PROMPT FOR CURSOR:**
```
Create integration tests for src/contexts/AIContext.tsx with components.

Tests to implement:
1. Context provider:
   - Provides all expected values
   - Throws error when used outside provider
   
2. State management:
   - API key persists to localStorage
   - Usage stats update correctly
   - Conversation history maintained
   
3. Actions:
   - askQuestion() calls API correctly
   - setApiKey() validates and saves
   - clearHistory() resets state
   
4. Component integration:
   - AIButton receives correct props from context
   - AIAssistantPanel updates when context changes

Use React Testing Library for component testing.
Mock llmService to avoid real API calls.
```

---

### Manual Testing Checklist

**PROMPT FOR CURSOR:**
```
Create a manual testing checklist in LLM_INTEGRATION_TESTING_CHECKLIST.md.

Sections:
1. **Setup Testing**:
   - [ ] Fresh install - no API key configured
   - [ ] Modal appears on first AI action
   - [ ] API key validation works
   - [ ] Invalid key shows error
   - [ ] Valid key saves successfully
   - [ ] Settings persist after reload

2. **Feature Testing**:
   - [ ] AI button in LogViewer works
   - [ ] AI button in LogDetailsPanel works
   - [ ] AI panel opens/closes smoothly
   - [ ] Pre-defined prompts work
   - [ ] Custom queries work
   - [ ] Response displays correctly (markdown)
   - [ ] Copy response button works
   - [ ] Conversation history maintained
   - [ ] Clear history works

3. **Error Scenarios**:
   - [ ] No API key - shows setup prompt
   - [ ] Invalid API key - shows error
   - [ ] Rate limit hit - shows clear message
   - [ ] Network offline - handles gracefully
   - [ ] Empty logs - disables AI buttons
   - [ ] Too many logs - shows warning

4. **Edge Cases**:
   - [ ] Single log analysis
   - [ ] 10,000+ logs (performance test)
   - [ ] Mixed log levels
   - [ ] Multiple files
   - [ ] Non-English queries
   - [ ] Very long log payloads

5. **Performance Testing**:
   - [ ] AI panel loads quickly (<500ms)
   - [ ] Large log context building (<2s)
   - [ ] Streaming response smooth
   - [ ] No UI blocking during API call
   - [ ] Memory usage acceptable

6. **Privacy & Security**:
   - [ ] Consent modal appears first time
   - [ ] Privacy settings saved
   - [ ] Data sanitization works if enabled
   - [ ] API key not visible in dev tools

For each item, document:
- Steps to test
- Expected result
- Actual result
- Pass/Fail
- Screenshots if applicable
```

---

### Automated Testing with Cursor

#### How to Use Cursor for Testing

**TESTING WORKFLOW:**

1. **Generate Tests Automatically**:
```
PROMPT: "Generate comprehensive unit tests for [filename] including edge cases, error scenarios, and happy paths. Use Vitest and React Testing Library. Mock external dependencies."
```

2. **Run Tests in Terminal**:
```
PROMPT: "Run the test suite for AI services and show results. If any tests fail, analyze the failure and suggest fixes."
```

3. **Test Coverage Analysis**:
```
PROMPT: "Analyze test coverage for src/services/llmService.ts. Identify untested code paths and generate tests for them."
```

4. **Integration Test Generation**:
```
PROMPT: "Create integration tests for AIAssistantPanel that test the full user flow: opening panel → entering query → receiving response → displaying result. Mock the API."
```

5. **Snapshot Testing for UI**:
```
PROMPT: "Create snapshot tests for all AI-related React components. Include different states: loading, error, empty, with data."
```

---

### Testing Utilities

**FILE**: `src/services/__tests__/testUtils.ts`

**PROMPT FOR CURSOR:**
```
Create testing utilities in src/services/__tests__/testUtils.ts:

1. Mock log generators:
   - createMockLogEntry(overrides): Generate realistic log entries
   - createMockLogSet(count, options): Generate log sets with patterns
   
2. Mock API responses:
   - createMockGeminiResponse(content): Simulate API response
   - createMockStreamResponse(content): Simulate streaming
   
3. Test data:
   - Sample error logs (various types)
   - Sample SIP logs
   - Sample correlation IDs
   
4. Assertion helpers:
   - expectValidContext(context): Validate context structure
   - expectValidPrompt(prompt): Validate prompt format

Export all utilities for use in test files.
Add JSDoc comments for each utility explaining usage.
```

---

## Code Standards & Comments

### Commenting Guidelines

**MANDATORY COMMENT TYPES:**

#### 1. File-Level Comments
```typescript
/**
 * AI Service - Gemini Integration
 * 
 * Purpose:
 * Manages all interactions with Google Gemini API including initialization,
 * request/response handling, rate limiting, and error management.
 * 
 * Architecture Decision:
 * Singleton pattern ensures single API client instance across the app,
 * which is necessary for accurate rate limiting and quota tracking.
 * 
 * Key Features:
 * - Rate limiting (15 RPM, 1,500 RPD for free tier)
 * - Automatic retry with exponential backoff
 * - Token estimation and context optimization
 * - Response streaming for better UX
 * 
 * Dependencies:
 * - @google/generative-ai: Official Google SDK
 * - LogContextBuilder: Formats logs for LLM
 * 
 * @module services/llmService
 */
```

#### 2. Class/Function-Level Comments
```typescript
/**
 * Analyzes logs using Gemini AI
 * 
 * Why this approach?
 * - Accepts pre-formatted context to separate concerns
 * - Returns structured response for consistent UI rendering
 * - Implements retry logic for transient failures
 * 
 * @param query - User's question or analysis request
 * @param logs - LogEntry[] to analyze (should be pre-filtered)
 * @param options - Optional config (model, temperature, etc.)
 * @returns Promise<AIAnalysisResponse> - Structured analysis result
 * @throws RateLimitError - When API quota exceeded
 * @throws InvalidApiKeyError - When API key is invalid/expired
 * 
 * @example
 * ```typescript
 * const response = await geminiService.analyzeLog(
 *   "Why did these calls fail?",
 *   errorLogs,
 *   { model: 'gemini-1.5-pro' }
 * );
 * ```
 */
async analyzeLog(
  query: string,
  logs: LogEntry[],
  options?: AnalysisOptions
): Promise<AIAnalysisResponse> {
  // Implementation
}
```

#### 3. Complex Logic Comments
```typescript
// RATE LIMITING STRATEGY
// Why: Free tier limits are 15 RPM, 1,500 RPD - must enforce to prevent quota errors
// How: Track requests in-memory with time windows
// Trade-off: In-memory means limits reset on app restart (acceptable for this use case)

private checkRateLimits(): void {
  const now = Date.now();
  
  // Reset minute counter if 60 seconds elapsed
  // Why: Sliding window would be more accurate but adds complexity
  // This simpler approach is sufficient given typical usage patterns
  if (now - this.lastMinuteReset > 60000) {
    this.requestsThisMinute = 0;
    this.lastMinuteReset = now;
  }
  
  // Check minute limit
  if (this.requestsThisMinute >= 15) {
    throw new RateLimitError('Exceeded 15 requests per minute');
  }
  
  // Similar for daily limit...
}
```

#### 4. Why Comments (Most Important!)
```typescript
// WHY: Using markdown for AI responses instead of plain text
// Reason: AI often returns structured content (lists, code blocks, bold text)
// Markdown rendering preserves structure and improves readability
// Alternative considered: Plain text - rejected because loses formatting
// Library choice: react-markdown - lightweight, well-maintained, supports GFM
```

#### 5. Security/Privacy Comments
```typescript
// SECURITY NOTE: API key stored in localStorage
// Risk: Vulnerable to XSS attacks, visible in browser dev tools
// Mitigation: Show security warning to users
// Future: Use Electron secure storage (electron-store) in production builds
// Why not now: Want to maintain web compatibility for development
// TODO: Implement secure storage before v1.0 release
```

#### 6. Performance Comments
```typescript
// PERFORMANCE: Memoize context building to avoid repeated computation
// Why: Building context from 10,000+ logs is expensive (~500ms)
// When: Only recompute when logs array identity changes
// Trade-off: Increased memory usage (cached context) vs faster re-renders
// Measurement: Reduced repeat queries from 500ms to <10ms (50x improvement)
const formattedContext = useMemo(
  () => buildContext(logs, options),
  [logs, options]
);
```

---

### Code Organization Standards

**FILE STRUCTURE PATTERN:**
```typescript
// 1. Imports (grouped: external → internal → types → styles)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LogEntry } from '../types';
import type { AIConfig } from '../types/ai';
import './styles.css';

// 2. Constants (with explanation comments)
const DEFAULT_MODEL = 'gemini-1.5-flash';
const MAX_CONTEXT_TOKENS = 100000; // Leave room for response (1M total - 100k = 900k buffer)

// 3. Types/Interfaces (exported first, internal last)
export interface ServiceConfig { }
interface InternalState { }

// 4. Main class/function
export class GeminiService { }

// 5. Helper functions (if needed, otherwise extract to utils)
function formatTimestamp() { }

// 6. Exports (if using named exports pattern)
export { GeminiService };
```

---

### Code Quality Standards

**PROMPT FOR CURSOR (Use this when writing any AI-related code):**
```
When implementing AI integration code, follow these standards:

1. **TypeScript Strict Mode**:
   - No `any` types (use `unknown` if truly dynamic)
   - Explicit return types for all functions
   - Strict null checks enabled

2. **Error Handling**:
   - Use custom error classes (RateLimitError, InvalidApiKeyError, etc.)
   - Always catch and handle errors - no silent failures
   - Provide actionable error messages

3. **Comments**:
   - Every file has file-level comment explaining purpose
   - Every public function has JSDoc with @param and @returns
   - Complex logic has inline "Why" comments
   - Security/privacy concerns clearly marked

4. **Testing**:
   - Every service function has corresponding unit test
   - Every component has integration test
   - Edge cases explicitly tested

5. **Performance**:
   - Use useMemo/useCallback for expensive operations
   - Lazy load components when possible
   - Document performance measurements in comments

6. **Accessibility**:
   - All buttons have aria-labels
   - Keyboard navigation works
   - Screen reader compatible

7. **Naming Conventions**:
   - Services: `[Name]Service` (e.g., GeminiService)
   - Contexts: `[Name]Context` (e.g., AIContext)
   - Components: PascalCase (e.g., AIAssistantPanel)
   - Hooks: `use[Name]` (e.g., useAI)
   - Utils: camelCase (e.g., formatLogsForLLM)

Apply these standards to all code you generate.
```

---

## Cursor Rules Configuration

### .cursorrules File

**FILE**: `.cursorrules`

**PROMPT FOR CURSOR:**
```
Update .cursorrules to add guidelines for LLM integration development.

Add a new section at the end of the file (preserve existing rules).
```

**ADD TO `.cursorrules`:**
```
# =============================================================================
# LLM INTEGRATION RULES (Google Gemini AI)
# =============================================================================

## Context & Purpose
This project integrates Google Gemini AI for intelligent log analysis.
The AI features help users understand errors, identify patterns, and troubleshoot issues.

## Architecture Principles

1. **Separation of Concerns**:
   - Services (llmService, logContextBuilder) handle business logic
   - Contexts (AIContext) manage state
   - Components render UI only
   - Never mix API calls directly in components

2. **Error Handling Philosophy**:
   - External API calls can fail - always have fallbacks
   - Show user-friendly messages (not raw API errors)
   - Log detailed errors to console for debugging
   - Never crash the app due to AI failures

3. **Privacy First**:
   - AI features are opt-in (require user consent)
   - Clearly communicate what data is sent externally
   - Provide data sanitization options
   - API keys stored with security warnings

4. **Performance**:
   - AI features must not block core log viewing functionality
   - Lazy load AI components (only when enabled)
   - Memoize expensive operations (context building)
   - Use streaming for better perceived performance

## Coding Standards for AI Features

### Type Safety
- No `any` types in AI code (use `unknown` if dynamic)
- All API responses must be validated before use
- Explicit types for all function parameters and returns

### Comments (MANDATORY)
Every AI-related file/function must have:
1. **File header**: Purpose, architecture decision, dependencies
2. **Function JSDoc**: @param, @returns, @throws, @example
3. **Why comments**: Explain reasoning for non-obvious decisions
4. **Security notes**: Flag privacy/security considerations

Example:
```typescript
/**
 * Builds optimized context from logs for LLM analysis
 * 
 * Why this approach?
 * - Prioritizes errors (most relevant for troubleshooting)
 * - Includes temporal context (what led to errors)
 * - Respects token limits (100k max to leave room for response)
 * 
 * @param logs - Pre-filtered logs to analyze
 * @param options - Context options (focus log, max tokens, etc.)
 * @returns Formatted markdown context ready for LLM
 */
```

### Error Handling Pattern
```typescript
try {
  const response = await geminiAPI.call();
  return response;
} catch (error) {
  // ALWAYS log detailed error for debugging
  console.error('Gemini API error:', error);
  
  // Classify error type for user-appropriate message
  if (error instanceof RateLimitError) {
    throw new UserFacingError('Rate limit exceeded. Try again in 1 minute.');
  } else if (error instanceof InvalidApiKeyError) {
    throw new UserFacingError('Invalid API key. Check settings.');
  } else {
    // Generic fallback
    throw new UserFacingError('AI analysis failed. Check your connection.');
  }
}
```

### Context Builder Rules
When building context for LLM:
1. **Prioritize by log level**: ERROR > WARN > INFO > DEBUG
2. **Include surrounding context**: 5 logs before/after each error
3. **Truncate long payloads**: Keep first/last 200 chars only
4. **Remove duplicates**: Keep first occurrence + count
5. **Format for readability**: Use markdown with clear sections
6. **Stay under token limit**: Target 10k tokens, max 100k

### Prompt Engineering Rules
When creating or modifying prompts:
1. **Give AI a role**: "You are a telecommunications expert..."
2. **Provide context**: System type, log format, time range
3. **Be specific**: Request structured output (bullets, numbered lists)
4. **Add constraints**: "Reference log IDs", "Be concise"
5. **Include examples**: Show desired response format
6. **Test thoroughly**: Validate with various log scenarios

## Testing Requirements

### Must Test
- [ ] Invalid API key handling
- [ ] Rate limit scenarios
- [ ] Network failures
- [ ] Empty log context
- [ ] 10,000+ logs (performance)
- [ ] Various error types
- [ ] Streaming responses
- [ ] Context building with edge cases

### Test File Location
- Unit tests: `src/services/__tests__/[service].test.ts`
- Integration tests: `src/contexts/__tests__/[context].test.tsx`
- Component tests: `src/components/__tests__/[component].test.tsx`

## UI/UX Guidelines for AI Features

1. **Discoverability**: AI buttons should be obvious but not intrusive
2. **Feedback**: Always show loading states during API calls
3. **Errors**: Clear, actionable error messages (not technical jargon)
4. **Context**: Show users what logs are being analyzed
5. **Streaming**: Display responses incrementally (don't buffer entire response)
6. **Accessibility**: All AI features keyboard navigable, screen reader compatible

## Integration Points

When adding AI to existing components:
1. Import AIButton or AIAssistantPanel
2. Pass currently filtered/selected logs
3. Add loading/error states
4. Don't modify existing component logic (add alongside)
5. Make AI features clearly optional (disable gracefully if not configured)

## Security Checklist

Before committing AI code:
- [ ] No hardcoded API keys
- [ ] API key not logged to console
- [ ] Security warnings shown to users
- [ ] Data sanitization available (even if optional)
- [ ] Error messages don't leak sensitive info
- [ ] HTTPS enforced for API calls

## Performance Checklist

Before committing AI code:
- [ ] Expensive operations memoized
- [ ] Components lazy loaded
- [ ] Large log sets sampled (not all sent to API)
- [ ] Context building doesn't block UI
- [ ] No memory leaks in streaming responses

## Common Mistakes to Avoid

❌ **Don't**: Call Gemini API directly from components
✅ **Do**: Use AIContext and llmService

❌ **Don't**: Send all 100,000 logs to API
✅ **Do**: Sample intelligently, prioritize errors

❌ **Don't**: Show raw API errors to users
✅ **Do**: Translate to user-friendly messages

❌ **Don't**: Hardcode prompts in components
✅ **Do**: Use prompt templates from promptTemplates.ts

❌ **Don't**: Assume API calls succeed
✅ **Do**: Implement comprehensive error handling

❌ **Don't**: Store API keys insecurely without warning
✅ **Do**: Show security notice, plan Electron secure storage

## File Naming Conventions

- Services: `[name]Service.ts` (e.g., llmService.ts)
- Context: `[Name]Context.tsx` (e.g., AIContext.tsx)
- Components: `[Name].tsx` (e.g., AIAssistantPanel.tsx)
- Types: `ai.ts` (in src/types/)
- Tests: `[name].test.ts` or `[Name].test.tsx`
- Utils: `[name].ts` (e.g., tokenCounter.ts)

## When in Doubt

1. Check existing patterns in LogContext.tsx (state management)
2. Follow error handling in FileUploader.tsx (external data)
3. Match styling in FilterBar.tsx (toolbars)
4. Refer to this document for AI-specific decisions

## Code Review Checklist

Before marking AI work as complete:
- [ ] All functions have JSDoc comments
- [ ] Complex logic has "Why" comments
- [ ] Tests written and passing
- [ ] Error handling comprehensive
- [ ] Performance measured (document in comments)
- [ ] Accessibility validated
- [ ] Security checklist completed
- [ ] Manual testing checklist completed
```

---

## Implementation Workflow

### Phase-by-Phase Execution

**For Each Phase:**

1. **Read Planning Doc**: Review phase objectives and requirements
2. **Read Reference Files**: Understand existing patterns
3. **Generate Code**: Use provided Cursor prompts
4. **Add Comments**: Follow commenting standards (mandatory)
5. **Test**: Unit tests → Integration tests → Manual testing
6. **Document**: Update relevant docs
7. **Commit**: Clear commit message referencing phase

**Example Workflow (Phase 1):**
```bash
# 1. Read plan
Read: LLM_INTEGRATION_IMPLEMENTATION_PLAN.md (Phase 1 section)

# 2. Install dependencies
npm install @google/generative-ai

# 3. Create type definitions
Use Cursor prompt for Phase 1.2
Review generated code
Add missing "Why" comments
Run type checker: npm run type-check

# 4. Create LLM service
Use Cursor prompt for Phase 1.3
Add comprehensive error handling
Add rate limiting logic
Add extensive comments

# 5. Create context builder
Use Cursor prompt for Phase 1.4
Implement token estimation
Add optimization logic
Comment reasoning

# 6. Test
Run: npm test
Fix any failing tests

# 7. Commit
git add .
git commit -m "Phase 1: Foundation - Add Gemini integration core services

- Install @google/generative-ai dependency
- Create AI type definitions (src/types/ai.ts)
- Implement GeminiService with rate limiting
- Implement LogContextBuilder with token optimization
- Add comprehensive error handling
- Add unit tests for services"
```

---

## Summary

This implementation plan provides:

✅ **Detailed Phase Plan**: 9 phases with specific tasks and prompts
✅ **Cursor Prompts**: Ready-to-use prompts for each component
✅ **Testing Strategy**: Unit, integration, E2E, and manual testing
✅ **Code Standards**: Mandatory commenting guidelines
✅ **Cursor Rules**: Updated .cursorrules for AI agent guidance
✅ **Explicit Reasoning**: "Why" comments and architectural decisions

**Next Steps:**
1. Review this plan thoroughly
2. Ask clarifying questions if needed
3. Execute Phase 1 using provided prompts
4. Report back with results before proceeding to Phase 2

**Estimated Timeline**:
- Phase 1-2: Week 1
- Phase 3-4: Week 2
- Phase 5-7: Week 3
- Phase 8-9: Week 4
- Testing & Polish: Week 5

**Total: ~5 weeks for complete implementation**

---

*This plan is a living document. Update as implementation progresses and new insights emerge.*

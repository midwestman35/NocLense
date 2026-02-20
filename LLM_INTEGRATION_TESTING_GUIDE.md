# LLM Integration Testing Guide

## Overview

This guide provides comprehensive testing instructions for the Gemini AI integration in NocLense, including how-to guides, automated testing with Cursor, and validation checklists.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Environment Setup](#test-environment-setup)
3. [Automated Testing with Cursor](#automated-testing-with-cursor)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [Manual Testing Checklists](#manual-testing-checklists)
7. [Performance Testing](#performance-testing)
8. [Security Testing](#security-testing)
9. [Test Data Generation](#test-data-generation)

---

## Testing Philosophy

### Why Testing Matters for AI Integration

**External Dependencies**: The AI feature relies on Google's Gemini API, which introduces:
- Network failures
- Rate limiting
- API changes
- Quota exhaustion
- Varying response quality

**Complex State**: AI features add significant state complexity:
- API key configuration
- Conversation history
- Usage tracking
- Multi-modal interactions (user input → log context → API → response)

**User Experience**: Poor testing leads to:
- Unexpected errors during log analysis
- Silent failures (users think AI isn't working)
- Privacy concerns (unclear what data is sent)
- Performance degradation

**Testing Strategy**: Layered approach
1. **Unit tests**: Services in isolation (fast, reliable)
2. **Integration tests**: Components with mocked API (realistic, controllable)
3. **E2E tests**: Full workflow with real API (slow, comprehensive)
4. **Manual tests**: UX validation, edge cases, exploratory

---

## Test Environment Setup

### Prerequisites

1. **Install Test Dependencies**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

2. **Configure Vitest** (add to `vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**', 'src/contexts/**', 'src/components/**'],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx']
    }
  }
});
```

3. **Create Test Setup File** (`src/test/setup.ts`):
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock console to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
```

4. **Get Test API Key**:
- Create separate API key for testing at [ai.google.dev](https://ai.google.dev)
- Store in `.env.test`:
```
VITE_GEMINI_TEST_API_KEY=your_test_api_key_here
```
- Add `.env.test` to `.gitignore`

---

## Automated Testing with Cursor

### Overview

Cursor can automate test generation, execution, and debugging. This section provides ready-to-use prompts for common testing tasks.

---

### 1. Generate Unit Tests

**USE CASE**: Create comprehensive unit tests for a service or utility.

**CURSOR PROMPT**:
```
Generate comprehensive unit tests for src/services/llmService.ts using Vitest.

Requirements:
1. Test all public methods
2. Mock @google/generative-ai dependency
3. Test error scenarios:
   - Invalid API key
   - Network failures
   - Rate limit exceeded
   - Token limit exceeded
4. Test rate limiting logic (15 RPM, 1,500 RPD)
5. Test success scenarios with various inputs
6. Use descriptive test names (should...)
7. Add comments explaining what each test validates

Follow the patterns in .cursorrules for AI code testing.
Create the test file at src/services/__tests__/llmService.test.ts
```

**Expected Output**: Complete test file with 15-20 test cases covering happy paths, error scenarios, and edge cases.

---

### 2. Generate Integration Tests

**USE CASE**: Test React components with context integration.

**CURSOR PROMPT**:
```
Generate integration tests for src/components/AIAssistantPanel.tsx using React Testing Library.

Requirements:
1. Wrap component in AIContext provider with mock values
2. Test user interactions:
   - Typing a query and submitting
   - Clicking pre-defined prompt buttons
   - Copying AI responses
   - Clearing conversation history
3. Test loading states
4. Test error displays
5. Mock llmService to avoid real API calls
6. Use userEvent for realistic interactions
7. Add assertions for accessibility (aria labels)

Create the test file at src/components/__tests__/AIAssistantPanel.test.tsx
```

---

### 3. Run Tests and Fix Failures

**USE CASE**: Execute test suite and automatically fix failing tests.

**CURSOR PROMPT**:
```
Run the test suite for AI services:

npm test src/services/__tests__/llmService.test.ts

If any tests fail:
1. Show me the failure output
2. Analyze why the test failed
3. Suggest fixes to the implementation or test
4. Apply the fixes
5. Re-run tests to verify

Show all test results including pass/fail counts and coverage.
```

---

### 4. Test Coverage Analysis

**USE CASE**: Identify untested code and generate missing tests.

**CURSOR PROMPT**:
```
Analyze test coverage for AI integration code:

1. Run: npm test -- --coverage
2. Show coverage report for:
   - src/services/llmService.ts
   - src/services/logContextBuilder.ts
   - src/contexts/AIContext.tsx
3. Identify uncovered code paths (branches, functions)
4. Generate tests for uncovered code
5. Aim for >80% coverage on all files

For each uncovered path, explain:
- Why it's not covered
- What test case would cover it
- Generate the test code
```

---

### 5. Generate Snapshot Tests

**USE CASE**: Create visual regression tests for AI components.

**CURSOR PROMPT**:
```
Create snapshot tests for all AI-related React components:

1. src/components/AIAssistantPanel.tsx
2. src/components/AISettingsPanel.tsx
3. src/components/AIButton.tsx

For each component, create snapshots of:
- Default/empty state
- Loading state
- Error state
- Success state with data
- Disabled state

Use Vitest's expect().toMatchSnapshot() API.
Add comments explaining what each snapshot captures.
Store snapshots in __snapshots__/ directory.
```

---

### 6. Performance Testing

**USE CASE**: Validate that AI features don't slow down the app.

**CURSOR PROMPT**:
```
Create performance tests for AI context building:

Test scenarios:
1. Build context from 100 logs (should be <50ms)
2. Build context from 1,000 logs (should be <200ms)
3. Build context from 10,000 logs (should be <1000ms)
4. Test token counting accuracy (estimate vs actual)
5. Test context optimization (truncation, deduplication)

Use console.time() and console.timeEnd() to measure.
Add performance benchmarks in comments.
Fail test if performance degrades >20% from baseline.

Create file: src/services/__tests__/performance.test.ts
```

---

### 7. Mock API Responses

**USE CASE**: Test with realistic API responses without making real calls.

**CURSOR PROMPT**:
```
Create a mock Gemini API module for testing:

File: src/test/mocks/geminiMock.ts

Requirements:
1. Mock generateContent() method with realistic responses
2. Mock generateContentStream() for streaming tests
3. Include various response types:
   - Successful analysis (structured markdown)
   - Error responses (invalid key, rate limit, etc.)
   - Empty responses
   - Malformed responses
4. Allow configuring mock behavior per test
5. Track calls for assertion (toHaveBeenCalledWith)

Export mockGemini instance and helper functions for test setup.
Add JSDoc explaining how to use in tests.
```

---

### 8. Test Error Scenarios

**USE CASE**: Ensure all error paths are handled gracefully.

**CURSOR PROMPT**:
```
Generate tests for all error scenarios in AI integration:

For src/services/llmService.ts:
1. Invalid API key error
2. Network timeout error
3. Rate limit error (429)
4. Quota exceeded error (429 with different message)
5. Token limit exceeded error
6. Malformed API response
7. API key revoked/expired

For each error:
- Mock the error condition
- Verify error is caught and classified correctly
- Verify user-friendly error message is generated
- Verify error is logged to console
- Verify app doesn't crash

Create file: src/services/__tests__/errorHandling.test.ts
```

---

### 9. Accessibility Testing

**USE CASE**: Ensure AI features are accessible to all users.

**CURSOR PROMPT**:
```
Create accessibility tests for AI components using @testing-library/react and jest-axe:

Install: npm install --save-dev jest-axe

Test all AI components for:
1. Keyboard navigation (tab order, enter to submit, esc to close)
2. ARIA labels (buttons, inputs, panels)
3. Focus management (focus input on panel open)
4. Screen reader announcements (loading, errors, new messages)
5. Color contrast (use axe-core rules)

For each component, run axe accessibility scanner and fix violations.

Create file: src/components/__tests__/accessibility.test.tsx
```

---

### 10. End-to-End Testing

**USE CASE**: Test complete user workflows with real API.

**CURSOR PROMPT**:
```
Create an E2E test script for AI integration:

File: e2e/ai-workflow.spec.ts (using Playwright or Cypress)

Test workflow:
1. Open NocLense app
2. Load sample log file (include test log file)
3. Filter to ERROR logs
4. Open AI assistant
5. Configure API key (use test key from env)
6. Submit query: "Why am I seeing these errors?"
7. Wait for AI response
8. Verify response contains analysis
9. Test follow-up question
10. Close AI assistant

Include:
- Screenshots on failure
- Retry logic for flaky network calls
- Cleanup (clear API key after test)

Note: This test uses real API and counts toward quota.
```

---

## Unit Testing

### Service: LLM Service

**File**: `src/services/__tests__/llmService.test.ts`

**MANUAL TESTING STEPS**:

1. **Setup**:
```bash
# Create test file
mkdir -p src/services/__tests__
touch src/services/__tests__/llmService.test.ts
```

2. **Write Tests** (or use Cursor prompt from above):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiService } from '../llmService';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Gemini SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
      generateContentStream: vi.fn()
    })
  }))
}));

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    service = GeminiService.getInstance();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid API key', () => {
      const result = service.initialize('valid-api-key', 'gemini-1.5-flash');
      expect(result).toBe(true);
    });

    it('should reject empty API key', () => {
      expect(() => service.initialize('', 'gemini-1.5-flash')).toThrow();
    });

    it('should reject invalid model name', () => {
      expect(() => service.initialize('key', 'invalid-model' as any)).toThrow();
    });
  });

  describe('rate limiting', () => {
    it('should allow 15 requests per minute', async () => {
      service.initialize('test-key', 'gemini-1.5-flash');
      
      // Make 15 requests (should all succeed)
      for (let i = 0; i < 15; i++) {
        await expect(service.analyzeLog('query', [])).resolves.not.toThrow();
      }
    });

    it('should block 16th request in same minute', async () => {
      service.initialize('test-key', 'gemini-1.5-flash');
      
      // Make 15 requests
      for (let i = 0; i < 15; i++) {
        await service.analyzeLog('query', []);
      }
      
      // 16th should fail
      await expect(service.analyzeLog('query', [])).rejects.toThrow('Rate limit exceeded');
    });

    it('should reset counter after 60 seconds', async () => {
      service.initialize('test-key', 'gemini-1.5-flash');
      
      // Make 15 requests
      for (let i = 0; i < 15; i++) {
        await service.analyzeLog('query', []);
      }
      
      // Mock time passing
      vi.useFakeTimers();
      vi.advanceTimersByTime(61000); // 61 seconds
      
      // Next request should succeed
      await expect(service.analyzeLog('query', [])).resolves.not.toThrow();
      
      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const mockError = new Error('Network timeout');
      mockGenerateContent.mockRejectedValueOnce(mockError);
      
      await expect(service.analyzeLog('query', [])).rejects.toThrow('AI analysis failed');
    });

    it('should handle invalid API key errors', async () => {
      const mockError = new Error('API key not valid');
      mockGenerateContent.mockRejectedValueOnce(mockError);
      
      await expect(service.analyzeLog('query', [])).rejects.toThrow('Invalid API key');
    });
  });
});
```

3. **Run Tests**:
```bash
npm test src/services/__tests__/llmService.test.ts
```

4. **Verify Coverage**:
```bash
npm test -- --coverage src/services/llmService.ts
```

**Expected Result**: All tests pass, coverage >80%.

---

### Service: Context Builder

**File**: `src/services/__tests__/logContextBuilder.test.ts`

**Key Test Cases**:

1. **Prioritization Test**:
```typescript
it('should prioritize ERROR logs over INFO logs', () => {
  const logs = [
    createMockLog({ level: 'INFO', message: 'Info message' }),
    createMockLog({ level: 'ERROR', message: 'Error message' }),
    createMockLog({ level: 'DEBUG', message: 'Debug message' }),
  ];
  
  const context = builder.buildContext(logs, { maxLogs: 2 });
  
  // Should include ERROR first, then INFO
  expect(context).toContain('Error message');
  expect(context).toContain('Info message');
  expect(context).not.toContain('Debug message');
});
```

2. **Token Limit Test**:
```typescript
it('should stay under max token limit', () => {
  const logs = Array(1000).fill(null).map((_, i) => 
    createMockLog({ message: `Log entry ${i}`.repeat(100) })
  );
  
  const context = builder.buildContext(logs, { maxTokens: 10000 });
  
  const estimatedTokens = context.length / 4; // rough estimate
  expect(estimatedTokens).toBeLessThan(10000);
});
```

3. **Payload Truncation Test**:
```typescript
it('should truncate long payloads', () => {
  const longPayload = 'A'.repeat(1000);
  const log = createMockLog({ payload: longPayload });
  
  const context = builder.buildContext([log]);
  
  // Should keep first/last 200 chars only
  expect(context.length).toBeLessThan(longPayload.length);
  expect(context).toContain('...'); // truncation indicator
});
```

---

## Integration Testing

### Component: AIAssistantPanel

**File**: `src/components/__tests__/AIAssistantPanel.test.tsx`

**Test Setup**:
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIAssistantPanel } from '../AIAssistantPanel';
import { AIProvider } from '../../contexts/AIContext';
import { vi } from 'vitest';

// Mock llmService
vi.mock('../../services/llmService', () => ({
  GeminiService: {
    getInstance: () => ({
      analyzeLog: vi.fn().mockResolvedValue('Mock AI response'),
      isConfigured: () => true,
    })
  }
}));

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <AIProvider>
      {ui}
    </AIProvider>
  );
};
```

**Key Test Cases**:

1. **User Interaction Test**:
```typescript
it('should submit query when user types and presses enter', async () => {
  const user = userEvent.setup();
  renderWithContext(<AIAssistantPanel logs={mockLogs} />);
  
  const input = screen.getByPlaceholderText(/ask a question/i);
  await user.type(input, 'Why am I seeing errors?{Enter}');
  
  await waitFor(() => {
    expect(screen.getByText(/Mock AI response/i)).toBeInTheDocument();
  });
});
```

2. **Pre-defined Prompt Test**:
```typescript
it('should use pre-defined prompt when button clicked', async () => {
  const user = userEvent.setup();
  const mockAnalyze = vi.fn().mockResolvedValue('Analysis result');
  
  renderWithContext(<AIAssistantPanel logs={mockLogs} />);
  
  const button = screen.getByText(/Why am I seeing these errors/i);
  await user.click(button);
  
  await waitFor(() => {
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.stringContaining('Why am I seeing these errors'),
      expect.anything()
    );
  });
});
```

3. **Loading State Test**:
```typescript
it('should show loading indicator while waiting for response', async () => {
  const user = userEvent.setup();
  const slowResponse = new Promise(resolve => setTimeout(resolve, 1000));
  vi.mocked(mockAnalyze).mockReturnValue(slowResponse);
  
  renderWithContext(<AIAssistantPanel logs={mockLogs} />);
  
  const input = screen.getByPlaceholderText(/ask a question/i);
  await user.type(input, 'Test query{Enter}');
  
  // Should show loading
  expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  expect(input).toBeDisabled();
  
  await waitFor(() => {
    expect(screen.queryByText(/analyzing/i)).not.toBeInTheDocument();
  });
});
```

---

## Manual Testing Checklists

### Checklist 1: Setup and Configuration

**Purpose**: Verify initial setup experience for new users.

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| First-time user - no API key | 1. Open NocLense (fresh install)<br>2. Click AI button in toolbar | Consent modal appears explaining data usage | ☐ | |
| API key setup | 1. Open AI settings<br>2. Click "Get Free API Key"<br>3. Copy key<br>4. Paste into input<br>5. Click "Test Connection" | Link opens to ai.google.dev<br>Connection test succeeds<br>Green checkmark shown | ☐ | |
| Invalid API key | 1. Enter "invalid-key-123"<br>2. Click "Test Connection" | Error message: "Invalid API key. Please check..."<br>Link to troubleshooting guide | ☐ | |
| API key persistence | 1. Set valid API key<br>2. Close app<br>3. Reopen app<br>4. Check AI settings | API key still present<br>(shows as ****) | ☐ | |
| Model selection | 1. Open AI settings<br>2. Select "Gemini 1.5 Pro"<br>3. Close settings<br>4. Reopen | Selection persists | ☐ | |

---

### Checklist 2: Core Functionality

**Purpose**: Test main AI analysis features.

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Analyze error logs | 1. Load sample log file<br>2. Filter to ERROR level<br>3. Click "Ask AI" button<br>4. Click "Why am I seeing these errors?" | AI panel opens<br>Query submitted<br>Response shows analysis with log IDs referenced | ☐ | |
| Custom query | 1. Open AI panel<br>2. Type "What happened before the timeout?"<br>3. Press Enter | Response addresses query<br>References relevant logs | ☐ | |
| Follow-up question | 1. After getting response<br>2. Ask "Tell me more about log #123" | AI provides more detail<br>Maintains conversation context | ☐ | |
| Copy response | 1. Get AI response<br>2. Click copy button on message | Response copied to clipboard<br>Toast notification shown | ☐ | |
| Clear history | 1. Have conversation with multiple messages<br>2. Click "Clear History" | All messages cleared<br>Input remains available | ☐ | |

---

### Checklist 3: Error Scenarios

**Purpose**: Verify graceful error handling.

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| No API key configured | 1. Clear API key<br>2. Click AI button | Setup modal appears<br>Clear instructions shown | ☐ | |
| Network offline | 1. Disconnect network<br>2. Submit AI query | Error: "Connection failed. Check network."<br>Retry button available | ☐ | |
| Rate limit exceeded | 1. Submit 16 queries rapidly | 16th query shows: "Rate limit exceeded. Wait 1 minute." | ☐ | |
| Empty log selection | 1. Clear all filters (no logs visible)<br>2. Click AI button | Warning: "No logs selected. Load or filter logs first." | ☐ | |
| API quota exhausted | 1. Exhaust daily quota<br>2. Submit query | Error: "Daily quota reached (1,500 requests). Resets at midnight UTC." | ☐ | |

---

### Checklist 4: Edge Cases

**Purpose**: Test unusual but valid scenarios.

| Test Case | Steps | Expected Result | Pass/Fail | Notes |
|-----------|-------|-----------------|-----------|-------|
| Single log analysis | 1. Select one log<br>2. Click "Explain this log" | AI provides analysis of single log<br>May note limited context | ☐ | |
| 10,000+ logs selected | 1. Load large log file<br>2. Select all<br>3. Submit AI query | Warning: "Analyzing sample of 500 logs (10,247 selected)"<br>Analysis proceeds with sample | ☐ | |
| No errors in logs | 1. Load INFO-only log file<br>2. Ask "Why am I seeing errors?" | AI responds: "No errors found in selected logs..."<br>Offers to analyze patterns instead | ☐ | |
| Multi-file analysis | 1. Load 3 different log files<br>2. Ask about correlation | AI mentions logs from multiple files<br>File names included in context | ☐ | |
| Non-English query | 1. Type query in Spanish: "¿Por qué hay errores?"<br>2. Submit | AI responds in Spanish<br>Analysis still accurate | ☐ | |
| Very long query | 1. Type 1,000-word query<br>2. Submit | Query accepted<br>Response addresses key points | ☐ | |

---

### Checklist 5: Performance

**Purpose**: Ensure AI features don't slow down the app.

| Test Case | Steps | Expected Result | Pass/Fail | Measurement | Notes |
|-----------|-------|-----------------|-----------|-------------|-------|
| AI panel open time | 1. Click AI button | Panel opens in <500ms | ☐ | ___ms | |
| Context building (100 logs) | 1. Select 100 logs<br>2. Submit query | Context ready in <100ms | ☐ | ___ms | |
| Context building (10k logs) | 1. Select 10,000 logs<br>2. Submit query | Context ready in <2s | ☐ | ___ms | |
| Streaming response | 1. Submit query<br>2. Watch response appear | Tokens appear incrementally<br>No stuttering/freezing | ☐ | Smooth? Y/N | |
| Memory usage | 1. Submit 10 queries<br>2. Check DevTools memory | No memory leaks<br>Stable memory usage | ☐ | ___MB | |
| Core app unaffected | 1. Open AI panel<br>2. Scroll log list while AI responds | Log scrolling remains smooth<br>No lag | ☐ | Smooth? Y/N | |

---

## Performance Testing

### Load Testing Script

**File**: `src/services/__tests__/performance.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { LogContextBuilder } from '../logContextBuilder';
import { createMockLogEntry } from './testUtils';

describe('Performance - Context Building', () => {
  const builder = new LogContextBuilder();

  it('should build context from 100 logs in <100ms', () => {
    const logs = Array(100).fill(null).map((_, i) => createMockLogEntry({ id: i }));
    
    const start = performance.now();
    const context = builder.buildContext(logs);
    const duration = performance.now() - start;
    
    console.log(`100 logs: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(100);
  });

  it('should build context from 1,000 logs in <500ms', () => {
    const logs = Array(1000).fill(null).map((_, i) => createMockLogEntry({ id: i }));
    
    const start = performance.now();
    const context = builder.buildContext(logs);
    const duration = performance.now() - start;
    
    console.log(`1,000 logs: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500);
  });

  it('should build context from 10,000 logs in <2000ms', () => {
    const logs = Array(10000).fill(null).map((_, i) => createMockLogEntry({ id: i }));
    
    const start = performance.now();
    const context = builder.buildContext(logs, { maxLogs: 500 });
    const duration = performance.now() - start;
    
    console.log(`10,000 logs (sampled to 500): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(2000);
  });
});
```

**Run Performance Tests**:
```bash
npm test -- performance.test.ts
```

---

## Security Testing

### Security Checklist

| Security Concern | Test | Expected Result | Pass/Fail | Notes |
|------------------|------|-----------------|-----------|-------|
| API key not logged | 1. Set API key<br>2. Check browser console<br>3. Check network tab | API key not visible anywhere | ☐ | |
| API key in localStorage | 1. Set API key<br>2. Open DevTools → Application → Local Storage | Key stored (acceptable with warning shown) | ☐ | |
| Security warning shown | 1. First time setting API key | Modal warns about localStorage security | ☐ | |
| No hardcoded keys | 1. Search codebase for "AIza"<br>2. Check environment files | No API keys in code | ☐ | |
| HTTPS enforced | 1. Check API requests in Network tab | All requests use HTTPS | ☐ | |
| Error messages safe | 1. Trigger various errors<br>2. Check error messages | No sensitive data leaked | ☐ | |

---

## Test Data Generation

### Mock Log Generator

**File**: `src/test/mocks/mockLogGenerator.ts`

```typescript
import type { LogEntry, LogLevel } from '../../types';

export function createMockLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  const defaults: LogEntry = {
    id: Math.floor(Math.random() * 100000),
    timestamp: Date.now(),
    rawTimestamp: new Date().toISOString(),
    level: 'INFO',
    component: 'MockComponent',
    displayComponent: 'MockComponent',
    message: 'Mock log message',
    displayMessage: 'Mock log message',
    payload: '{}',
    type: 'LOG',
    isSip: false,
  };
  
  return { ...defaults, ...overrides };
}

export function createErrorLog(message: string): LogEntry {
  return createMockLogEntry({
    level: 'ERROR',
    message,
    displayMessage: message,
  });
}

export function createSipLog(method: string, callId: string): LogEntry {
  return createMockLogEntry({
    isSip: true,
    sipMethod: method,
    callId,
    message: `SIP ${method} for call ${callId}`,
  });
}

export function createLogSet(count: number, options?: {
  errorRate?: number;
  sipRate?: number;
}): LogEntry[] {
  const { errorRate = 0.1, sipRate = 0.3 } = options || {};
  const logs: LogEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    const random = Math.random();
    
    if (random < errorRate) {
      logs.push(createErrorLog(`Error message ${i}`));
    } else if (random < errorRate + sipRate) {
      logs.push(createSipLog('INVITE', `call-${i}`));
    } else {
      logs.push(createMockLogEntry({ id: i }));
    }
  }
  
  return logs;
}
```

**Usage in Tests**:
```typescript
import { createMockLogEntry, createLogSet, createErrorLog } from '../test/mocks/mockLogGenerator';

// Single log
const log = createMockLogEntry({ level: 'ERROR' });

// Error log
const error = createErrorLog('Connection timeout');

// Large dataset
const logs = createLogSet(10000, { errorRate: 0.05, sipRate: 0.4 });
```

---

## Test Execution Commands

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test src/services/__tests__/llmService.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Only Failed Tests
```bash
npm test -- --reporter=verbose --bail
```

### Run E2E Tests (if configured)
```bash
npm run test:e2e
```

---

## Debugging Failed Tests

### Common Issues and Solutions

**Issue**: "Module not found" error
```bash
# Solution: Check import paths
npm test -- --reporter=verbose
# Review stack trace for incorrect import
```

**Issue**: "API key invalid" in tests
```bash
# Solution: Check test API key in .env.test
cat .env.test
# Verify key is valid at ai.google.dev
```

**Issue**: Tests timeout
```bash
# Solution: Increase timeout for slow tests
it('slow test', async () => {
  // Add timeout
}, 10000); // 10 seconds
```

**Issue**: Flaky tests (pass sometimes, fail sometimes)
```bash
# Solution: Add wait conditions
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 3000 });
```

---

## Test Reporting

### Generate HTML Coverage Report
```bash
npm test -- --coverage --reporter=html
open coverage/index.html
```

### CI/CD Integration

**GitHub Actions Example** (`.github/workflows/test.yml`):
```yaml
name: Test AI Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Summary

This testing guide provides:

✅ **Automated Testing Prompts**: Ready-to-use Cursor prompts for test generation
✅ **Manual Testing Checklists**: Comprehensive scenarios for human validation
✅ **Performance Testing**: Scripts to measure and validate speed
✅ **Security Testing**: Checklists for privacy and security validation
✅ **Test Data Generation**: Utilities for creating realistic test data

**Testing Coverage Goals**:
- Unit tests: >80% code coverage
- Integration tests: All user workflows covered
- Manual tests: All checklists completed
- Performance tests: Benchmarks documented

**Next Steps**:
1. Set up test environment (install dependencies)
2. Generate initial tests using Cursor prompts
3. Run test suite and establish baselines
4. Complete manual testing checklists
5. Document results and iterate

---

*Keep this guide updated as new tests are added and issues are discovered.*

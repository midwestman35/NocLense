# LLM Integration - File Structure & Manifest

## Overview

This document lists all files that will be created during the LLM integration implementation. Use this as a checklist to track progress and ensure nothing is missed.

---

## 📁 New Files to Create

### Types (`src/types/`)

- [ ] **`ai.ts`** *(Phase 1)*
  - AIMessage, AIConfig, AIAnalysisRequest, AIAnalysisResponse
  - AIUsageStats, AIModel, AIError types
  - **Why**: Strong typing prevents runtime errors, clear API contracts

---

### Services (`src/services/`)

- [ ] **`llmService.ts`** *(Phase 1)*
  - GeminiService singleton class
  - API initialization, request handling, rate limiting
  - Error classification and handling
  - **Why**: Centralizes all Gemini API interactions

- [ ] **`logContextBuilder.ts`** *(Phase 1)*
  - LogContextBuilder class
  - Context optimization, token estimation
  - Log prioritization and sampling
  - **Why**: Separates data preparation from API calls, testable

- [ ] **`promptTemplates.ts`** *(Phase 5)*
  - Pre-engineered prompt functions
  - ERROR_ANALYSIS, PATTERN_RECOGNITION, CALL_FLOW_ANALYSIS templates
  - **Why**: Consistent, high-quality prompts, easy to refine

- [ ] **`dataSanitizer.ts`** *(Phase 7, Optional)*
  - Redact sensitive data before API calls
  - Phone numbers, emails, IPs, passwords, etc.
  - **Why**: Additional privacy layer for sensitive environments

---

### Contexts (`src/contexts/`)

- [ ] **`AIContext.tsx`** *(Phase 2)*
  - AIProvider component
  - useAI hook
  - State management for AI features
  - localStorage persistence
  - **Why**: Global AI state, consistent with LogContext pattern

---

### Components (`src/components/`)

- [ ] **`AISettingsPanel.tsx`** *(Phase 3)*
  - API key configuration UI
  - Model selection
  - Usage statistics display
  - Test connection button
  - **Why**: User-friendly setup experience

- [ ] **`AIAssistantPanel.tsx`** *(Phase 3)*
  - Chat interface for AI interactions
  - Message history display
  - Input field with pre-defined prompts
  - Markdown rendering for responses
  - **Why**: Main AI feature UI, familiar chat pattern

- [ ] **`AIButton.tsx`** *(Phase 3)*
  - Reusable button component
  - Triggers AI actions from various locations
  - Shows disabled state with tooltip
  - **Why**: Consistent AI trigger across app

- [ ] **`AIConsentModal.tsx`** *(Phase 7)*
  - First-time consent flow
  - Privacy policy explanation
  - Data usage transparency
  - **Why**: User privacy and transparency

---

### Utilities (`src/utils/`)

- [ ] **`tokenCounter.ts`** *(Phase 8, Optional)*
  - Estimate token count for context
  - Validate against limits
  - **Why**: Prevent token limit errors, optimize context size

- [ ] **`contextOptimizer.ts`** *(Phase 8, Optional)*
  - Advanced context optimization
  - Intelligent truncation
  - **Why**: Performance optimization for large log sets

---

### Tests (`src/services/__tests__/`, `src/contexts/__tests__/`, `src/components/__tests__/`)

#### Service Tests

- [ ] **`llmService.test.ts`** *(Phase 1)*
  - Test initialization, API calls, rate limiting, errors
  - Mock Gemini API
  - **Coverage Target**: >80%

- [ ] **`logContextBuilder.test.ts`** *(Phase 1)*
  - Test context building, prioritization, token estimation
  - Various log scenarios
  - **Coverage Target**: >80%

- [ ] **`promptTemplates.test.ts`** *(Phase 5)*
  - Test prompt generation
  - Validate prompt structure
  - **Coverage Target**: >80%

- [ ] **`dataSanitizer.test.ts`** *(Phase 7, Optional)*
  - Test redaction patterns
  - Verify structure preservation
  - **Coverage Target**: >80%

- [ ] **`performance.test.ts`** *(Phase 8)*
  - Benchmark context building
  - Measure token counting
  - **Performance Targets**: Documented in test

- [ ] **`errorHandling.test.ts`** *(Phase 6)*
  - Test all error scenarios
  - Verify error classification
  - **Coverage**: All error paths

#### Context Tests

- [ ] **`AIContext.test.tsx`** *(Phase 2)*
  - Test provider, hook, state management
  - localStorage persistence
  - **Coverage Target**: >80%

#### Component Tests

- [ ] **`AISettingsPanel.test.tsx`** *(Phase 3)*
  - Test API key input, validation, model selection
  - Mock llmService
  - **Coverage Target**: >80%

- [ ] **`AIAssistantPanel.test.tsx`** *(Phase 3)*
  - Test chat interactions, query submission
  - Loading states, error displays
  - **Coverage Target**: >80%

- [ ] **`AIButton.test.tsx`** *(Phase 3)*
  - Test button states, disabled conditions
  - Integration with AIContext
  - **Coverage Target**: >80%

- [ ] **`AIConsentModal.test.tsx`** *(Phase 7)*
  - Test consent flow, localStorage persistence
  - **Coverage Target**: >80%

- [ ] **`accessibility.test.tsx`** *(Phase 9)*
  - Test keyboard navigation, ARIA labels
  - Use jest-axe for automated checks
  - **Coverage**: All AI components

#### Integration Tests

- [ ] **`aiIntegration.test.tsx`** *(Phase 4)*
  - Test full workflow: setup → query → response
  - Mock API responses
  - **Coverage**: All user workflows

---

### Test Utilities (`src/test/`)

- [ ] **`setup.ts`** *(Testing Setup)*
  - Global test configuration
  - Mock setup (localStorage, console)
  - **Why**: Consistent test environment

- [ ] **`mocks/mockLogGenerator.ts`** *(Testing Setup)*
  - Generate mock LogEntry objects
  - Create realistic test data
  - **Why**: Reusable test data across tests

- [ ] **`mocks/geminiMock.ts`** *(Testing Setup)*
  - Mock Gemini API responses
  - Configurable for different scenarios
  - **Why**: Test without real API calls

---

### Documentation Files (Already Created)

- [x] **`LLM_INTEGRATION_IMPLEMENTATION_PLAN.md`**
  - Complete phase-by-phase implementation guide
  - Cursor prompts for each component
  - Architecture decisions with reasoning

- [x] **`LLM_INTEGRATION_TESTING_GUIDE.md`**
  - Comprehensive testing strategy
  - Automated and manual testing
  - Test data generation

- [x] **`LLM_INTEGRATION_SUMMARY.md`**
  - Overview and getting started
  - Progress tracking
  - Success criteria

- [x] **`LLM_INTEGRATION_QUICK_REFERENCE.md`**
  - Quick reference card
  - Essential prompts and commands
  - Validation checklists

- [x] **`.cursorrules`**
  - Project-wide coding standards
  - AI-specific development rules
  - Security and performance checklists

---

### Additional Documentation (To Create During Phase 9)

- [ ] **`LLM_INTEGRATION_USER_GUIDE.md`** *(Phase 9)*
  - User-facing documentation
  - Setup instructions with screenshots
  - Best practices and FAQ
  - **Why**: Help users get started quickly

- [ ] **`LLM_INTEGRATION_DEVELOPER_GUIDE.md`** *(Phase 9)*
  - Developer documentation
  - Architecture details
  - Extension points
  - **Why**: Future maintainability

---

## 📊 File Count Summary

| Category | Count | Status |
|----------|-------|--------|
| Type Definitions | 1 | To create |
| Services | 4 | To create |
| Contexts | 1 | To create |
| Components | 4 | To create |
| Utilities | 2 | To create |
| Tests | 15 | To create |
| Test Utilities | 3 | To create |
| Planning Docs | 5 | ✅ Complete |
| User Docs | 2 | To create (Phase 9) |
| **Total New Files** | **37** | **5 complete, 32 to create** |

---

## 🗂️ File Tree (After Implementation)

```
NocLense/
├── src/
│   ├── types/
│   │   ├── ai.ts                          [NEW]
│   │   └── (existing types...)
│   │
│   ├── services/
│   │   ├── llmService.ts                  [NEW]
│   │   ├── logContextBuilder.ts           [NEW]
│   │   ├── promptTemplates.ts             [NEW]
│   │   ├── dataSanitizer.ts               [NEW, Optional]
│   │   ├── __tests__/
│   │   │   ├── llmService.test.ts         [NEW]
│   │   │   ├── logContextBuilder.test.ts  [NEW]
│   │   │   ├── promptTemplates.test.ts    [NEW]
│   │   │   ├── dataSanitizer.test.ts      [NEW, Optional]
│   │   │   ├── performance.test.ts        [NEW]
│   │   │   └── errorHandling.test.ts      [NEW]
│   │   └── (existing services...)
│   │
│   ├── contexts/
│   │   ├── AIContext.tsx                  [NEW]
│   │   ├── __tests__/
│   │   │   └── AIContext.test.tsx         [NEW]
│   │   └── (existing contexts...)
│   │
│   ├── components/
│   │   ├── AISettingsPanel.tsx            [NEW]
│   │   ├── AIAssistantPanel.tsx           [NEW]
│   │   ├── AIButton.tsx                   [NEW]
│   │   ├── AIConsentModal.tsx             [NEW]
│   │   ├── __tests__/
│   │   │   ├── AISettingsPanel.test.tsx   [NEW]
│   │   │   ├── AIAssistantPanel.test.tsx  [NEW]
│   │   │   ├── AIButton.test.tsx          [NEW]
│   │   │   ├── AIConsentModal.test.tsx    [NEW]
│   │   │   ├── aiIntegration.test.tsx     [NEW]
│   │   │   └── accessibility.test.tsx     [NEW]
│   │   └── (existing components...)
│   │
│   ├── utils/
│   │   ├── tokenCounter.ts                [NEW, Optional]
│   │   ├── contextOptimizer.ts            [NEW, Optional]
│   │   └── (existing utils...)
│   │
│   └── test/
│       ├── setup.ts                       [NEW]
│       └── mocks/
│           ├── mockLogGenerator.ts        [NEW]
│           └── geminiMock.ts              [NEW]
│
├── .cursorrules                           [NEW] ✅
├── LLM_INTEGRATION_IMPLEMENTATION_PLAN.md [NEW] ✅
├── LLM_INTEGRATION_TESTING_GUIDE.md       [NEW] ✅
├── LLM_INTEGRATION_SUMMARY.md             [NEW] ✅
├── LLM_INTEGRATION_QUICK_REFERENCE.md     [NEW] ✅
├── LLM_INTEGRATION_USER_GUIDE.md          [NEW, Phase 9]
├── LLM_INTEGRATION_DEVELOPER_GUIDE.md     [NEW, Phase 9]
└── (existing files...)
```

---

## 🔄 Modified Files

These existing files will be modified during implementation:

### Phase 4: Integration with Existing Features

- [ ] **`src/components/LogViewer.tsx`**
  - Add AI button to toolbar
  - Integrate AIAssistantPanel
  - **Changes**: Add imports, add button, wire up state

- [ ] **`src/components/log/LogDetailsPanel.tsx`**
  - Add "Explain with AI" action
  - Pass selected log + context to AI
  - **Changes**: Add AIButton, wire up log data

- [ ] **`src/components/CorrelationSidebar.tsx`**
  - Add "Analyze correlation" action
  - Pass correlated logs to AI
  - **Changes**: Add AIButton for each correlation

- [ ] **`src/App.tsx`** *(Optional)*
  - Wrap app in AIProvider
  - **Changes**: Add AIProvider import and wrapper

### Phase 1: Dependencies

- [ ] **`package.json`**
  - Add `@google/generative-ai` dependency
  - **Changes**: One new dependency

### Configuration Files

- [ ] **`vite.config.ts`** *(Testing Setup)*
  - Configure Vitest
  - **Changes**: Add test configuration block

- [ ] **`.env.example`** *(Optional)*
  - Add example for VITE_GEMINI_API_KEY
  - **Changes**: Add one line

- [ ] **`.gitignore`** *(Optional)*
  - Ensure `.env.test` is ignored
  - **Changes**: Add `.env.test` if not already present

---

## ✅ Progress Tracker

### Phase 1: Foundation & API Integration
- [ ] `src/types/ai.ts`
- [ ] `src/services/llmService.ts`
- [ ] `src/services/logContextBuilder.ts`
- [ ] `src/services/__tests__/llmService.test.ts`
- [ ] `src/services/__tests__/logContextBuilder.test.ts`

### Phase 2: State Management & Context
- [ ] `src/contexts/AIContext.tsx`
- [ ] `src/contexts/__tests__/AIContext.test.tsx`

### Phase 3: UI Components
- [ ] `src/components/AISettingsPanel.tsx`
- [ ] `src/components/AIAssistantPanel.tsx`
- [ ] `src/components/AIButton.tsx`
- [ ] `src/components/__tests__/AISettingsPanel.test.tsx`
- [ ] `src/components/__tests__/AIAssistantPanel.test.tsx`
- [ ] `src/components/__tests__/AIButton.test.tsx`

### Phase 4: Integration
- [ ] Modified: `src/components/LogViewer.tsx`
- [ ] Modified: `src/components/log/LogDetailsPanel.tsx`
- [ ] Modified: `src/components/CorrelationSidebar.tsx`
- [ ] `src/components/__tests__/aiIntegration.test.tsx`

### Phase 5: Prompt Engineering
- [ ] `src/services/promptTemplates.ts`
- [ ] `src/services/__tests__/promptTemplates.test.ts`

### Phase 6: Error Handling & Edge Cases
- [ ] `src/services/__tests__/errorHandling.test.ts`
- [ ] Enhanced error handling in existing AI files

### Phase 7: Security & Privacy
- [ ] `src/components/AIConsentModal.tsx`
- [ ] `src/components/__tests__/AIConsentModal.test.tsx`
- [ ] `src/services/dataSanitizer.ts` (Optional)
- [ ] `src/services/__tests__/dataSanitizer.test.ts` (Optional)

### Phase 8: Performance Optimization
- [ ] `src/services/__tests__/performance.test.ts`
- [ ] `src/utils/tokenCounter.ts` (Optional)
- [ ] `src/utils/contextOptimizer.ts` (Optional)
- [ ] Performance optimizations in existing AI files

### Phase 9: Polish & Documentation
- [ ] `src/components/__tests__/accessibility.test.tsx`
- [ ] `LLM_INTEGRATION_USER_GUIDE.md`
- [ ] `LLM_INTEGRATION_DEVELOPER_GUIDE.md`
- [ ] Manual testing complete

---

## 📝 Notes

### Optional Files

Some files marked "Optional" may be created based on:
- Performance requirements
- Privacy needs
- Project complexity
- Time constraints

**Recommended to include**:
- `dataSanitizer.ts` (if handling sensitive data)
- `tokenCounter.ts` (for better context optimization)
- `performance.test.ts` (to establish benchmarks)

**Can skip initially**:
- `contextOptimizer.ts` (only if performance issues arise)
- Advanced utilities (create if needed)

### Test File Strategy

**Unit Tests**: One test file per service/utility
**Integration Tests**: Group related component tests
**E2E Tests**: Optional, only for critical workflows

### Documentation Strategy

**During Development**: Keep inline comments comprehensive
**Phase 9**: Create user and developer guides
**Ongoing**: Update as features evolve

---

## 🎯 Quick Check

**Before starting Phase 1:**
- [ ] All planning docs reviewed
- [ ] File structure understood
- [ ] Ready to create first file (`src/types/ai.ts`)

**Before completing Phase 1:**
- [ ] All Phase 1 files created and tested
- [ ] No files skipped
- [ ] Tests passing

**Before final release:**
- [ ] All non-optional files created
- [ ] All tests written and passing
- [ ] All documentation complete
- [ ] Modified files properly integrated

---

*Use this manifest to track progress and ensure completeness.*
*Last Updated: February 7, 2026*

# LLM Integration - Quick Reference Card

*Keep this handy during implementation*

---

## 📁 Key Files

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `LLM_INTEGRATION_SUMMARY.md` | Overview & getting started | **Start here** |
| `LLM_INTEGRATION_IMPLEMENTATION_PLAN.md` | Detailed phase plans with prompts | During coding |
| `LLM_INTEGRATION_TESTING_GUIDE.md` | Testing strategy & prompts | Writing tests |
| `.cursorrules` | Coding standards for AI | Auto-referenced |

---

## 🔄 Workflow

```
1. Read Phase Requirements → 2. Use Cursor Prompt → 3. Review Generated Code
         ↓                             ↓                        ↓
4. Add "Why" Comments → 5. Write Tests → 6. Validate → 7. Commit
```

---

## 💬 Essential Cursor Prompts

### Start a Phase
```
Implement Phase [N].[Task] from LLM_INTEGRATION_IMPLEMENTATION_PLAN.md
Follow all .cursorrules standards. Add comprehensive "Why" comments.
```

### Generate Tests
```
Generate tests for [file] using LLM_INTEGRATION_TESTING_GUIDE.md
Mock dependencies, cover edge cases, >80% coverage target.
```

### Debug Issue
```
Debug [issue] in [file]. Analyze root cause, suggest fix, apply it.
Reference .cursorrules for error handling patterns.
```

### Code Review
```
Review [file] against .cursorrules checklist:
- All functions have JSDoc?
- "Why" comments for complex logic?
- Error handling comprehensive?
- Performance optimizations applied?
```

---

## 📋 Phase Sequence

| Phase | Focus | Duration | Key Deliverable |
|-------|-------|----------|-----------------|
| 1 | Foundation | 2-3 days | LLM service + context builder |
| 2 | State | 2-3 days | AIContext with persistence |
| 3 | UI | 3-4 days | Settings + Chat + Button components |
| 4 | Integration | 2-3 days | AI in LogViewer/Details/Sidebar |
| 5 | Prompts | 2-3 days | Engineered prompt templates |
| 6 | Errors | 2 days | Comprehensive error handling |
| 7 | Security | 2 days | Consent + privacy features |
| 8 | Performance | 2 days | Optimization + benchmarks |
| 9 | Polish | 2-3 days | Docs + final testing |

**Total: ~5 weeks**

---

## ✅ Validation Checklist (Before Moving to Next Phase)

- [ ] All code has "Why" comments
- [ ] Tests pass with >80% coverage
- [ ] TypeScript compiles (no errors)
- [ ] Follows .cursorrules patterns
- [ ] Manual testing complete (if applicable)
- [ ] Performance acceptable
- [ ] Committed with clear message

---

## 🏗️ Architecture Quick Reference

```
User Action
    ↓
AIButton (component)
    ↓
useAI() hook → AIContext (state management)
    ↓
GeminiService (API calls)
    ↑
LogContextBuilder (prepares logs)
    ↑
filtered logs from LogContext
```

---

## 🧪 Testing Quick Commands

```bash
# Run all tests
npm test

# Run specific file
npm test src/services/__tests__/llmService.test.ts

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Performance tests
npm test -- performance.test.ts
```

---

## 🔒 Security Reminders

- [ ] Never hardcode API keys
- [ ] Always catch and classify errors
- [ ] Show security warnings to users
- [ ] Don't log sensitive data
- [ ] Validate all API responses

---

## 🚨 Common Mistakes to Avoid

❌ Calling API directly from components → ✅ Use AIContext + llmService
❌ Sending all logs to API → ✅ Sample intelligently (max 500)
❌ Showing raw API errors → ✅ User-friendly messages
❌ No "Why" comments → ✅ Explain all decisions
❌ Forgetting tests → ✅ Write tests as you code

---

## 📞 When Stuck

1. **Read the phase requirements again** (Implementation Plan)
2. **Check .cursorrules** for patterns
3. **Look at existing code** (LogContext.tsx for patterns)
4. **Use Cursor debugging prompt** (see above)
5. **Review Testing Guide** for validation steps

---

## 🎯 Success Indicators

**Phase Complete When:**
- All validation checklist items checked
- Tests green (>80% coverage)
- Manual testing passed (if applicable)
- Code reviewed against .cursorrules
- Committed and ready for next phase

**Overall Success When:**
- User can configure API key
- User can ask AI about logs
- AI responds with accurate analysis
- Error handling graceful
- Performance acceptable
- Security/privacy respected

---

## 📊 Quick Status Update Template

**Copy this to track progress:**

```markdown
## Phase [N] Status

**Started**: [date]
**Current Task**: [task description]

Progress:
- [x] Task 1
- [ ] Task 2
- [ ] Task 3

Blockers: [none/describe]
Questions: [none/list]

**Completed**: [date] / Not yet
```

---

## 💡 Pro Tips

1. **Work in small increments** - Complete one task, test, commit
2. **Use Cursor liberally** - It knows .cursorrules, use prompts freely
3. **Comment as you go** - Don't wait until end to add "Why" comments
4. **Test early** - Don't accumulate untested code
5. **Take breaks** - Complex AI logic requires fresh eyes
6. **Read existing code** - LogContext.tsx is your best friend for patterns

---

## 🎉 Phase 1 Starter Prompt

**Ready to begin? Use this:**

```
I'm starting Phase 1 of the LLM integration for NocLense.

Step 1: Read LLM_INTEGRATION_IMPLEMENTATION_PLAN.md Phase 1 section
Step 2: Install @google/generative-ai dependency
Step 3: Report back when complete, then I'll ask for Phase 1.2

Follow all .cursorrules standards. Let's go!
```

---

*Keep this card visible while working. Reference full docs for details.*
*Last Updated: February 7, 2026*

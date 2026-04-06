# Validation Agent (Post-Review)

**Your sole focus:** Read all review findings from `.claude/review-findings/{timestamp}/` (after deduplication), check the actual source code, and mark false positives for removal.

## Input

1. Read `.claude/review-findings/{timestamp}/dedup-report.json` to see what was already removed
2. Read all `*.json` files in `.claude/review-findings/{timestamp}/` (skip `dedup-report.json` and `validation-report.json`)
3. For each issue, read the actual source file and verify the issue is real

## False Positive Categories

### 1. Issue Already Fixed
The code at the reported line no longer has the problem (possibly fixed by a concurrent change).

### 2. Interface Requirement
```
Finding: "Unused parameter 'cancellationToken' in ProcessAsync"
Reality: Parameter required by IProcessor interface — not dead code
→ FALSE POSITIVE
```

### 3. Intentional Pattern
```
Finding: "Unnecessary async — method has no awaits"
Reality: Method implements an async interface, must return Task
→ FALSE POSITIVE
```

### 4. Wrong Line / Stale Reference
The issue references a line number that doesn't match the described problem (agent hallucinated or code shifted).

### 5. Project Convention
```
Finding: "Over-engineering — interface ITradeService has only one implementation"
Reality: Project requires interfaces for all services (DI + NSubstitute testing)
→ FALSE POSITIVE
```

### 6. Out of Scope
```
Finding: "Missing input validation on player.Age"
Reality: Age is set internally by the aging system, never from user input
→ FALSE POSITIVE (no system boundary crossed)
```

### 7. Misread Code
The agent misunderstood what the code does — the described issue doesn't match actual behavior.

## Validation Process

For each finding:

1. **Read the source file** at the reported line
2. **Read surrounding context** (10 lines above and below)
3. **Check if the issue is real** against the categories above
4. **Verdict:** `confirmed`, `false_positive`, or `needs_context` (can't determine without running the code)

## Output

Write `.claude/review-findings/{timestamp}/validation-report.json`:

```json
{
  "validated": [
    {
      "agent": "02_NULL_SAFETY",
      "file": "TradeService.cs",
      "line": 42,
      "description": "Missing null check before .Value",
      "verdict": "confirmed",
      "evidence": "Line 42: var teamId = player.TeamId!.Value; — no HasValue guard"
    }
  ],
  "falsePositives": [
    {
      "agent": "20_OVER_ENGINEERING",
      "file": "TradeService.cs",
      "line": 1,
      "description": "Interface with single implementation",
      "verdict": "false_positive",
      "reason": "Project convention: all services require interfaces for DI and NSubstitute testing",
      "category": "project_convention"
    }
  ],
  "needsContext": [
    {
      "agent": "10_LOGIC_ERRORS",
      "file": "SimulationService.cs",
      "line": 155,
      "description": "Condition may be inverted",
      "verdict": "needs_context",
      "reason": "Cannot determine correct behavior without understanding game rules"
    }
  ],
  "summary": {
    "totalIssuesReviewed": 42,
    "confirmed": 35,
    "falsePositives": 5,
    "needsContext": 2,
    "totalValidIssues": 37
  }
}
```

## Rules

- **Always read the actual source code** — never validate based on the finding description alone
- Mark the corresponding TaskCreate entries as `deleted` for false positives
- Issues marked `needs_context` stay open — let the human decide
- Do NOT second-guess severity ratings — only determine if the issue is real or not
- When in doubt, mark as `confirmed` — it's better to fix a low-value issue than miss a real bug
- Read `CLAUDE.md` and project conventions before starting to understand what patterns are intentional

# Deduplication Agent (Post-Review)

**Your sole focus:** Read all review findings files from `.claude/review-findings/{timestamp}/` and identify duplicate or overlapping issues reported by different agents.

## Input

Read every `*.json` file in `.claude/review-findings/{timestamp}/`. Each file contains an array of issues from one review agent:

```json
[
  {
    "agent": "02_NULL_SAFETY",
    "file": "Services/TradeService.cs",
    "line": 42,
    "description": "Missing null check before .Value access",
    "severity": "Critical",
    "suggestedFix": "Add HasValue check before accessing TeamId.Value"
  }
]
```

## What Counts as a Duplicate

**Exact duplicate:** Same file, same line (within 3 lines), same underlying issue reported by different agents.

```
Agent 02 (Null Safety):  "TradeService.cs:42 — Missing null check before .Value"
Agent 17 (Error Handling): "TradeService.cs:42 — No guard clause for nullable TeamId"
→ DUPLICATE — keep the one with more specific description
```

**Overlapping issue:** Same file, same method, describing the same root cause from different angles.

```
Agent 11 (Edge Cases):  "RosterService.cs:88 — .First() on possibly empty collection"
Agent 02 (Null Safety): "RosterService.cs:90 — Result of .FirstOrDefault() not null-checked"
→ OVERLAPPING — keep both but link them as related (same root cause)
```

## What is NOT a Duplicate

**Same file, different issue:** Two agents flagging different problems in the same file.

```
Agent 01 (Magic Numbers): "TradeService.cs:15 — Magic number 25 for roster limit"
Agent 03 (Thread Safety): "TradeService.cs:42 — Missing lock on _players dictionary"
→ NOT duplicates — completely different issues
```

**Same pattern, different locations:** The same type of issue appearing in multiple files.

```
Agent 19 (Dead Code): "TradeService.cs:10 — Unused using statement"
Agent 19 (Dead Code): "RosterService.cs:8 — Unused using statement"
→ NOT duplicates — different files, both valid
```

## Output

Write `.claude/review-findings/{timestamp}/dedup-report.json`:

```json
{
  "duplicatesRemoved": [
    {
      "kept": { "agent": "02_NULL_SAFETY", "file": "TradeService.cs", "line": 42, "description": "..." },
      "removed": { "agent": "17_ERROR_HANDLING", "file": "TradeService.cs", "line": 42, "description": "..." },
      "reason": "Same null-check issue reported by both agents"
    }
  ],
  "relatedGroups": [
    {
      "rootCause": "Empty collection not handled in RosterService.GetStarters",
      "issues": [
        { "agent": "11_EDGE_CASES", "file": "RosterService.cs", "line": 88 },
        { "agent": "02_NULL_SAFETY", "file": "RosterService.cs", "line": 90 }
      ]
    }
  ],
  "summary": {
    "totalIssuesBefore": 47,
    "duplicatesRemoved": 5,
    "relatedGroupsFound": 3,
    "totalIssuesAfter": 42
  }
}
```

## Rules

- When removing a duplicate, keep the issue with the **higher severity** rating
- If same severity, keep the one with the **more specific description and suggested fix**
- Mark the corresponding TaskCreate entries as `deleted` for removed duplicates
- Do NOT remove issues just because they're in the same file — they must describe the same underlying problem
- Related groups are informational — do not delete either issue, just note they share a root cause

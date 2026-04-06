# Code Review Skill

Execute a multi-agent code review, then fix issues using sequential TDD agents with handoff file.

## Mode Detection

- If "full codebase" → Go to FULL CODEBASE MODE
- Otherwise → Go to STANDARD MODE (changed files only)

---

# FULL CODEBASE MODE

## Recovery Check

If `.claude/review-state.json` exists → Resume from `currentChunk` and `currentPhase`

## Phase 1 — Chunk the Codebase

1. **Count lines per folder** to create chunks targeting ~15,000 lines each
2. **Create state file** with chunk definitions

## Phase 2-4 — Review, Fix, Commit Each Chunk

For each chunk:
1. Run review agents (21 agents in 7-7-7 batches)
2. Fix issues using sequential TDD agents with handoff
3. Commit chunk fixes
4. Advance to next chunk

## Final Report

After all chunks: produce summary, delete state file.

---

# STANDARD MODE (Changed Files Only)

## State Files

- `.claude/review-findings/{timestamp}/` — Timestamped directory per review run (e.g., `20260228_143052/`)
- `.claude/review-findings/{timestamp}/XX_NAME.json` — Each review agent writes its findings here (survives compaction)
- `.claude/review-findings/{timestamp}/dedup-report.json` — Deduplication agent output
- `.claude/review-findings/{timestamp}/validation-report.json` — Validation agent output
- `.claude/review-handoff.json` — Context for fix agents (deleted after each fix group)

**At the start of each review run**, generate the timestamp directory:
```
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p .claude/review-findings/$timestamp
```
Pass this path to all agents in the run.

## Recovery

If resuming after compaction:
1. Re-read this file
2. Find the latest timestamped directory in `.claude/review-findings/`
3. Check for existing agent output — skip agents that already have findings files
4. Run `TaskList` to see tracked issues
5. Continue from current phase

---

## Phase 1 — Batched Specialized Review

1. **Identify changed files:** `git diff --name-only`

2. **Spawn 21 review agents in batches (7-7-7):**

   Each agent reads from `Docs/CODE_REVIEW_AGENTS/XX_NAME.md` and reviews changed files.

   | Batch | Agents |
   |-------|--------|
   | 1 | 01-07: Magic Numbers, Null Safety, Thread Safety, Blazor, Test Quality, Player State, Repository |
   | 2 | 08-14: Architecture, Plan Compliance, Logic Errors, Edge Cases, Performance, LINQ, Save/Load |
   | 3 | 15-21: Resource Management, Assertion Quality, Error Handling, Duplicate Code, Dead Code, Over-Engineering, Security Basics |

   **Agent prompt:**
   ```
   Read C:\Projects\BaseballManager\Docs\CODE_REVIEW_AGENTS\{XX_NAME}.md
   Review these files for issues in your specialty: [file list]
   Report: File, line, description, severity (Critical/High/Medium/Low), suggested fix

   IMPORTANT: Write your findings to .claude/review-findings/{timestamp}/{XX_NAME}.json as an array:
   [
     {
       "agent": "{XX_NAME}",
       "file": "path/to/file.cs",
       "line": 42,
       "description": "Description of the issue",
       "severity": "Critical|High|Medium|Low",
       "suggestedFix": "How to fix it"
     }
   ]
   Write an empty array [] if no issues found.
   ```

3. **After each batch:** Create `TaskCreate` for every issue found
4. **Recovery:** If `.claude/review-findings/{timestamp}/{XX_NAME}.json` already exists, skip that agent

---

## Phase 2 — Automated Synthesis

After all 21 review agents complete, spawn two post-review agents **sequentially**:

### Step 1: @deduplicator
```
Spawn agent (subagent_type: "general-purpose", name: "deduplicator")
Prompt: Read C:\Projects\BaseballManager\Docs\CODE_REVIEW_AGENTS\22_DEDUPLICATION.md
        Read all JSON files in .claude/review-findings/{timestamp}/
        Identify and remove duplicate findings
        Write output to .claude/review-findings/{timestamp}/dedup-report.json
        Mark duplicate TaskCreate entries as deleted
```

### Step 2: @validator (after deduplicator completes)
```
Spawn agent (subagent_type: "general-purpose", name: "validator")
Prompt: Read C:\Projects\BaseballManager\Docs\CODE_REVIEW_AGENTS\23_VALIDATION.md
        Read C:\Projects\BaseballManager\Docs\CLAUDE.md for project conventions
        Read .claude/review-findings/{timestamp}/dedup-report.json
        Read all remaining findings in .claude/review-findings/{timestamp}/
        Validate each issue against actual source code
        Write output to .claude/review-findings/{timestamp}/validation-report.json
        Mark false positive TaskCreate entries as deleted
```

### Step 3: Report
1. **Read** `validation-report.json` for final counts
2. **Grade code quality** (0-10 per category, deduct for confirmed issues)
3. **Report summary** by agent and severity — include dedup/validation stats

---

## Phase 3 — Sequential TDD Fix

**For each issue group (by file or related concern):**

### Create handoff file
```json
// .claude/review-handoff.json
{
  "issueGroup": "Thread safety in FooService",
  "issues": [
    { "file": "FooService.cs", "line": 42, "description": "Missing lock", "severity": "High" }
  ],
  "testFiles": [],
  "implFiles": [],
  "notes": []
}
```

### Step 1: @test-writer
```
Spawn agent (subagent_type: "general-purpose", name: "test-writer")
Prompt: Read .claude/skills/sprint/test-writer.md
        Read .claude/review-handoff.json for issues
        Write tests exposing these issues
        Update handoff.testFiles and handoff.notes
```

### Step 2: @test-verifier
```
Spawn agent (subagent_type: "general-purpose", name: "test-verifier")
Prompt: Read .claude/skills/sprint/test-verifier.md
        Read .claude/review-handoff.json for issue context
        Review the tests written by @test-writer for quality and coverage
        Report PASS or FAIL with specific issues
```

### Step 2b: Handle test-verifier result
- **PASS (no issues at all):** Continue to Step 3
- **FAIL:** Respawn @test-writer with the specific issues, then re-verify with @test-verifier
- **"PASS with suggestions/improvements":** Treat as FAIL. Any suggestion means tests aren't strong enough.
- Iterate until @test-verifier reports a clean PASS — do NOT proceed to @coder with weak tests

### Step 3: @coder
```
Spawn agent (subagent_type: "general-purpose", name: "coder")
Prompt: Read .claude/skills/sprint/coder.md
        Read .claude/review-handoff.json for context
        Fix issues to make tests pass
        Update handoff.implFiles and handoff.notes
```

### Step 4: @verifier
```
Spawn agent (subagent_type: "general-purpose", name: "verifier")
Prompt: Read .claude/skills/sprint/verifier.md
        Read .claude/review-handoff.json for file paths
        Verify fixes
```

### Step 5: Handle result
- **PASS:** Mark issues complete, delete handoff, continue to next group
- **FAIL:** Respawn @coder with failure details, re-verify

**Process in severity order:** Critical → High → Medium → Low

---

## Phase 4 — Verification Review

1. Re-run review agents on files modified in Phase 3
2. Fix any new issues or regressions (use sequential TDD agents)
3. Iterate until clean

---

## Phase 5 — Final

1. **Run full test suite:** `dotnet test BaseballManager.Tests/BaseballManager.Tests.csproj`
2. **Produce final report** with grades and fix summary

---

## Rules

- Run ALL phases — never stop early
- Launch review agents in batches (7-7-7), never all 21 at once
- Track ALL issues via TaskCreate
- Fix issues using sequential TDD agents with handoff — never fix directly
- All tests must pass before reporting complete

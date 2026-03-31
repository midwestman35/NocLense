# Ideas: Auto-Tag Learning Loop & Agentic Investigation

**Created:** 2026-03-30
**Authors:** Enrique Velazquez, Leandro Taboada
**Status:** Exploration / Research
**Source:** 3/30 walkthrough session transcript

---

## Overview

Two interconnected features that would transform NocLense from a single-investigation tool into a **learning, self-improving NOC platform**:

1. **Auto-Tag Learning Loop** — Categorize closed tickets by root cause, build a knowledge base, and use it to accelerate future investigations.
2. **Agentic Investigation** — Spawn AI sub-agents that autonomously research past tickets, download logs, and cross-reference until they find answers.

These are the long-term vision features discussed in the 3/30 session. This document analyzes what we have, what we need, and how to get there incrementally.

---

## Part 1: Auto-Tag Learning Loop

### The Idea (from transcript)

> *Enrique:* "We can use [auto-tag] to categorize closed tickets... have it become smarter over time. Like, OK, the root cause of this issue ended up being a CCS problem. We could have it be tagged that way, so next time you see any CCS error, it can vector it and use the conclusion to help troubleshoot."

### What We Have Today

| Component | Status | Location |
|-----------|--------|----------|
| `autoTagLogs()` | **Exists** — classifies logs into categories (SIP, AUTH, NETWORK, MEDIA, etc.) | `unleashService.ts` |
| `diagnoseLogs()` | **Exists** — returns structured `DiagnosisResult` with `rootCause`, `summary`, `correlatedLogs` | `unleashService.ts` |
| Zendesk ticket fetch | **Exists** — gets ticket + comments + attachments + org info | `zendeskService.ts` |
| Zendesk ticket tagging | **Missing** — no `updateTicketTags()` or `updateTicketFields()` | `zendeskService.ts` |
| Zendesk ticket search | **Missing** — no search endpoint exposed | `zendeskService.ts` |
| IndexedDB persistence | **Exists** — schema v3, can store embeddings, has batch update | `utils/indexedDB.ts` |
| Vector embeddings | **Exists** — Gemini `text-embedding-004` with cosine similarity + IndexedDB persist | `services/embeddingService.ts` |
| Case/investigation state | **Exists** — full case lifecycle with bookmarks, notes, severity, status | `store/caseContext.ts` |
| Closure note template | **Exists** — triggered by keyword phrases in chat | `templates/nocTemplates.ts` |

### What We Need to Build

#### Phase 1: Tag Storage & Zendesk Sync (Foundation)

**Goal:** When a ticket investigation is completed, save the root cause category and auto-tag the Zendesk ticket.

**New Zendesk endpoints needed in `zendeskService.ts`:**
```typescript
// Update ticket tags (add root cause category)
async function updateZendeskTicketTags(
  settings: AiSettings,
  ticketId: number,
  tags: string[]
): Promise<void>
// PUT /api/v2/tickets/{id}.json
// Body: { ticket: { tags: [...existingTags, ...newTags] } }

// Search tickets by query
async function searchZendeskTickets(
  settings: AiSettings,
  query: string,
  page?: number
): Promise<ZendeskSearchResult[]>
// GET /api/v2/search.json?query={query}&sort_by=created_at&sort_order=desc
// Zendesk Search API: 10 req/min rate limit
// Query syntax: "type:ticket organization:{org} tags:ccs_issue status:closed"
```

**New tag taxonomy (standardized categories):**
```
Root Cause Tags:
  noc:root-ccs          — CCS / Call Control System issue
  noc:root-sip          — SIP routing / protocol error
  noc:root-pbx          — PBX registration / extension issue
  noc:root-network      — Network connectivity / latency
  noc:root-media        — Audio / media stream failure
  noc:root-fdx          — FDX WebSocket / message delivery
  noc:root-config       — Configuration / provisioning error
  noc:root-carrier      — Upstream carrier / trunk issue
  noc:root-workstation  — Station-specific hardware/software
  noc:root-unknown      — Insufficient data to determine

Symptom Tags:
  noc:symptom-no-audio  — One-way or no audio
  noc:symptom-dropped   — Dropped / disconnected calls
  noc:symptom-routing   — Calls not routing correctly
  noc:symptom-quality   — Audio quality degradation
  noc:symptom-login     — Agent login / extension issues
```

**Auto-tag flow in Phase 3 (Submit):**
1. User completes diagnosis and is on Phase 3 (Submit).
2. AI has already produced `DiagnosisResult.rootCause`.
3. Add a new AI call: `classifyRootCause(rootCause, summary)` → returns one or more tags from the taxonomy.
4. Display suggested tags as checkboxes before submit.
5. On submit: post internal note to Zendesk AND `updateZendeskTicketTags()` with selected tags.

**Files to create/modify:**
- `src/services/zendeskService.ts` — Add `updateZendeskTicketTags()`, `searchZendeskTickets()`
- `src/services/unleashService.ts` — Add `classifyRootCause()` function
- `src/templates/nocTemplates.ts` — Add tag taxonomy constants
- `src/components/ai/diagnose/DiagnosePhase3.tsx` — Tag selection UI before submit

---

#### Phase 2: Historical Ticket Search (Query Past Knowledge)

**Goal:** During Phase 2, offer a "Similar Past Tickets" panel that searches Zendesk for tagged tickets matching the current investigation's characteristics.

**How it works:**
1. After `diagnoseLogs()` returns, extract keywords: root cause category, station name, CNC, error patterns.
2. Call `searchZendeskTickets()` with: `type:ticket tags:noc:root-ccs organization:{orgName} status:closed`
3. Display top 5 results in a collapsible panel with: ticket #, subject, closed date, root cause tag, first 200 chars of closure note.
4. Click to expand → fetch full ticket + closure note inline.

**Prerequisite:** Phase 1 must be in place so closed tickets actually have tags. As Enrique noted in the transcript: *"From here backwards it might not work well because we don't always have good closed notes. But if we standardize moving forward..."*

**Talk to Danielle:** Get the official closure note template standardized across the team. The more consistent the closure notes, the better the historical search works.

**Files to create/modify:**
- `src/services/zendeskService.ts` — `searchZendeskTickets()` with rate limit handling
- `src/components/ai/diagnose/DiagnosePhase2.tsx` — "Similar Tickets" collapsible section
- New: `src/components/ai/diagnose/SimilarTicketsPanel.tsx`

---

#### Phase 3: Vector-Based Similarity (Semantic Search)

**Goal:** Go beyond tag matching — use embeddings to find semantically similar past investigations even if they weren't perfectly tagged.

**What we already have:**
- `embeddingService.ts` with Gemini `text-embedding-004`
- `retrieveTopKByQuery()` for cosine similarity ranking
- IndexedDB embedding persistence

**What we need:**
- A **local knowledge store** of past diagnosis summaries + root causes + ticket IDs.
- On each completed investigation, embed the `DiagnosisResult.summary + rootCause` and store it.
- On new investigations, embed the current ticket description and find the top-K similar past investigations.

**New storage needed:**
```typescript
// New IndexedDB object store: 'investigations'
{
  id: string;              // investigation_${timestamp}
  ticketId: number;
  ticketSubject: string;
  orgName: string;
  rootCause: string;
  rootCauseTags: string[];
  summary: string;
  closureNote: string;
  embedding: number[];     // vector embedding of summary + rootCause
  createdAt: number;
  stationIds: string[];
  cncName: string;
}
```

**Similarity search flow:**
1. User starts new investigation with ticket.
2. Embed: `ticket.subject + ticket.description`.
3. Query `investigations` store for top-5 by cosine similarity.
4. Display: "This looks similar to Ticket #12345 (CCS registration failure at Charleston, resolved 2026-03-15)."

**Consideration:** This requires the **Gemini API key** (for embeddings), which is separate from the Unleashed token. Currently the embedding service is only active when `provider === 'gemini'`. We'd need to either:
- Always initialize the embedding service regardless of AI provider, OR
- Use the Unleashed API for embeddings if it supports them (check with Leandro), OR
- Build a simple TF-IDF / keyword-based similarity as a fallback (no API needed, less accurate)

---

## Part 2: Agentic Investigation

### The Idea (from transcript)

> *Leandro:* "We could literally set this like an agent that could spawn other agents. And actually investigate this until it figures it out. Because it has all of our Zendesk tickets, and it has Unleashed with the new token."

### Architecture: Multi-Step Agent Workflow

The key insight: NocLense already has all the API integrations. An "agent" is just a loop of:
1. **Observe** — Read current evidence (ticket, logs, Datadog, past tickets).
2. **Think** — Ask the AI what to do next.
3. **Act** — Execute the AI's suggested action (fetch more logs, search Zendesk, query Datadog).
4. **Repeat** until the AI says "I have enough evidence" or a max iteration limit is reached.

### What We Have vs. What We Need

| Capability | Have It? | Details |
|-----------|----------|---------|
| Fetch a Zendesk ticket | Yes | `fetchZendeskTicket()` |
| Download ticket attachments | Yes | `downloadZendeskAttachment()` |
| Search Zendesk tickets | **No** | Need `searchZendeskTickets()` |
| Query Datadog logs | Yes | `searchDatadogLogs()` |
| Discover Datadog stations | Yes | `discoverStationsForCnc()` |
| Parse log files (all formats) | Yes | `parser.ts` handles CSV, Homer, JSON, Call Log |
| Run AI diagnosis | Yes | `diagnoseLogs()` |
| Chat with AI | Yes | `chatWithLogs()` |
| Multi-turn conversation | Yes | History tracked in `chatWithLogs()` |
| Tool/function calling | **No** | Unleashed API may not support tool-use |

### Proposed Agent Loop

```
┌──────────────────────────────────────────────────┐
│                 INVESTIGATION AGENT               │
│                                                   │
│  Input: Zendesk Ticket ID                         │
│                                                   │
│  Step 1: Fetch ticket + attachments               │
│  Step 2: Parse any attached log files             │
│  Step 3: Run initial diagnosis                    │
│  Step 4: AI decides next action:                  │
│     ┌─────────────────────────────────────┐       │
│     │ "SEARCH_ZENDESK" → query: "..."     │       │
│     │ "SEARCH_DATADOG" → filter: "..."    │       │
│     │ "FETCH_TICKET"   → ticketId: 12345  │       │
│     │ "DOWNLOAD_LOGS"  → attachmentId     │       │
│     │ "DONE"           → final report     │       │
│     └─────────────────────────────────────┘       │
│  Step 5: Execute action, add results to context   │
│  Step 6: If not DONE and iterations < max, → 4    │
│  Step 7: Generate final report                    │
│                                                   │
│  Output: DiagnosisResult + all gathered evidence   │
└──────────────────────────────────────────────────┘
```

### Implementation Approach

#### Option A: Prompt-Based Agent (No tool-use API needed)

Since we don't know if Unleashed supports function calling, we can implement the agent loop entirely in our code:

```typescript
// New: src/services/agentService.ts

interface AgentAction {
  type: 'SEARCH_ZENDESK' | 'SEARCH_DATADOG' | 'FETCH_TICKET' | 'DOWNLOAD_LOGS' | 'DONE';
  params: Record<string, string>;
  reasoning: string;
}

async function runAgentStep(
  settings: AiSettings,
  context: string,        // accumulated evidence so far
  ticket: ZendeskTicket,
  iteration: number
): Promise<AgentAction> {
  const prompt = `You are an autonomous NOC investigation agent.

Current evidence:
${context}

Based on the evidence so far, what should I do next?
Reply with EXACTLY ONE JSON action:
{"type": "SEARCH_ZENDESK", "params": {"query": "..."}, "reasoning": "..."}
{"type": "SEARCH_DATADOG", "params": {"filter": "...", "fromMs": "...", "toMs": "..."}, "reasoning": "..."}
{"type": "FETCH_TICKET", "params": {"ticketId": "..."}, "reasoning": "..."}
{"type": "DONE", "params": {}, "reasoning": "I have enough evidence to conclude."}

Iteration ${iteration}/5. If you have enough evidence, say DONE.`;

  const response = await post(settings, [{ role: 'User', text: prompt }], { skipAssistant: true });
  return parseAgentAction(response);
}

async function executeAgentAction(
  settings: AiSettings,
  action: AgentAction
): Promise<string> {
  switch (action.type) {
    case 'SEARCH_ZENDESK':
      const tickets = await searchZendeskTickets(settings, action.params.query);
      return `Found ${tickets.length} related tickets:\n${tickets.map(t => `#${t.id}: ${t.subject}`).join('\n')}`;
    case 'SEARCH_DATADOG':
      const logs = await searchDatadogLogs(settings, { /* ... */ });
      return `Found ${logs.length} Datadog log entries...`;
    case 'FETCH_TICKET':
      const ticket = await fetchZendeskTicket(settings, action.params.ticketId);
      return formatTicketForAi(settings, ticket);
    // ...
  }
}
```

**Advantages:** Works with any LLM backend, no tool-use API needed, full control over the loop.
**Disadvantages:** More brittle (parsing JSON from free text), can't leverage built-in tool-use optimization.

#### Option B: Unleashed Tool-Use (If Supported)

If Unleashed supports function calling / tool-use:

```typescript
const tools = [
  {
    name: 'search_zendesk',
    description: 'Search past Zendesk tickets by keyword, tag, or organization',
    parameters: { query: 'string', maxResults: 'number' }
  },
  {
    name: 'search_datadog',
    description: 'Query Datadog logs by filter and time window',
    parameters: { filter: 'string', fromMs: 'number', toMs: 'number' }
  },
  // ...
];

// Send to Unleashed API with tools parameter
const body = { messages, tools };
// API responds with tool_call → we execute → send result back → repeat
```

**Check with Leandro:** Does the Unleashed `/chats` endpoint support a `tools` parameter?

---

### Safety & Guardrails

Agentic investigation needs guardrails to prevent runaway API calls:

| Guard | Implementation |
|-------|---------------|
| **Max iterations** | Hard cap at 5-8 steps per investigation |
| **Rate limiting** | Respect Zendesk (10 req/min for search) and Datadog (300 req/hr) limits |
| **Token budget** | Cap total context at 200KB across all agent steps |
| **User visibility** | Show each agent step in the UI with reasoning — no black-box behavior |
| **Manual approval** | For expensive actions (downloading large attachments), prompt the user |
| **Abort button** | User can stop the agent at any point |
| **Cost tracking** | Log total API calls and estimated token usage per agent run |

---

## Incremental Rollout Plan

| Phase | What | Depends On | Effort |
|-------|------|-----------|--------|
| **1a** | Add `searchZendeskTickets()` + `updateZendeskTicketTags()` to service | Nothing | Low |
| **1b** | Add `classifyRootCause()` to AI service | 1a | Low |
| **1c** | Tag selection UI in Phase 3 submit flow | 1a + 1b | Medium |
| **2a** | "Similar Past Tickets" panel in Phase 2 | 1a | Medium |
| **2b** | Standardize closure notes (coordinate with Danielle) | Process change, not code | N/A |
| **3a** | Investigation embedding store (IndexedDB v4) | Nothing | Medium |
| **3b** | Vector similarity search on new investigations | 3a + embedding service | Medium |
| **4a** | Prompt-based agent loop (Option A) | 1a + all services | High |
| **4b** | Agent UI (step-by-step visibility, abort) | 4a | Medium |
| **4c** | Tool-use agent (Option B) — only if API supports it | Check with Leandro | High |

**Recommended starting point:** Phase 1a — adding the two Zendesk endpoints. Everything else builds on that.

---

## Open Questions for Leandro

1. **Does the Unleashed API support function calling / tool-use?** This determines agent architecture (Option A vs B).
2. **Does Unleashed have an embedding endpoint?** Could replace Gemini for vector search.
3. **Zendesk tag permissions:** Can the API token we have create/update tags, or do we need elevated permissions?
4. **Monday.com:** Is the Unleashed assistant already pulling from Monday? If so, what data is accessible?
5. **Budget:** Is there a concern about API call volume for the agentic workflow? Each investigation could make 10-20 API calls.

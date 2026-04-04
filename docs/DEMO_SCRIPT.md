# NocLense Demo Script — 3/31/2026

## Quick Pitch (30 seconds)

NocLense is an AI-powered NOC investigation tool. Load logs, enter a ticket number, and the AI diagnoses root cause, correlates evidence across multiple log sources, and generates closure notes. Every completed investigation saves to Confluence — so the tool gets smarter with every ticket the team closes.

---

## Demo Flow (5 minutes)

### 1. Load and Diagnose (1 min)
- Upload log files (drag-and-drop)
- Enter a Zendesk ticket number → Fetch
- Enable Datadog enrichment if relevant
- Click **Scan Logs Against Ticket**
- AI analyzes in 15-30 seconds

### 2. Review Results (2 min)
- **Root cause** highlighted at top
- **Correlated logs** highlighted in violet in the main viewer
- **Source filter** — toggle between Datadog, Homer SIP, CCS/PBX, etc.
- **Similar Past Tickets** — shows past closed tickets and Confluence investigations matching this issue
- **Editable note** — AI-generated internal note on the right
- Ask the AI: *"Fill out the closing note"* → auto-uses the standardized template

### 3. Submit (1 min)
- Click **Next** → Phase 3
- Click **Post Internal Note**
- Three things happen automatically:
  - Note posts to Zendesk
  - Log archive downloads
  - **Investigation saves to Confluence**
- Success screen shows links to both

### 4. The Learning Loop (1 min)
- Open the Confluence link — show the structured investigation page
- Explain: *"Next time someone gets a similar ticket, this shows up automatically in their investigation. At 75 tickets a day, this knowledge base builds fast."*
- Show the test investigation page as an example

---

## Key Talking Points

- **Every investigation teaches the tool something** — saved to Confluence, searchable by future investigations
- **Multi-user ready** — Leo and Enrique can work tickets simultaneously, no conflicts
- **Closure note template** — just say "fill out the closing note" and the AI uses the standard format
- **No extra steps** — the memory system is automatic on submit, zero additional effort for agents
- **Resizable sidebar** — drag to make the AI panel as wide as you need

## What's Coming Next
- Auto-tagging tickets with root cause categories (CCS, SIP, PBX, etc.)
- Vector similarity search (finds semantically similar past cases)
- Agentic investigation (AI autonomously researches past tickets and Datadog logs)
- Jira integration (submit to Jira on Phase 3)

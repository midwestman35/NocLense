# Unleash Agent Optimization Design

**Date:** 2026-04-01
**Author:** Enrique Velazquez + Claude
**Status:** Draft
**Project:** NocLense / Noc toolAgent (Unleash)

---

## Problem Statement

The "Noc toolAgent" Unleash agent is used by the NOC team in two modes: (1) through NocLense's Diagnose tab, which builds a detailed Carbyne-specific prompt client-side, and (2) directly via the Unleash chat interface for ad-hoc ticket triage and knowledge base lookup.

Mode 2 is severely underperforming because:

- **No custom instructions** — the agent has zero domain knowledge about Carbyne's architecture, log formats, or troubleshooting patterns. All intelligence lives in `unleashService.ts` client-side prompts.
- **No workflow guidance** — new NOC agents don't know how to use the agent effectively. The only prompt template is a generic placeholder (`Ask about [topic] or [project name]`).
- **No autonomous data access** — agents must manually copy-paste ticket details, logs, and Datadog output into the chat. The agent can't fetch context on its own.

## Goals

1. Make the Unleash agent independently useful for ticket triage and KB lookup without NocLense.
2. Provide structured prompt templates that guide NOC agents through common workflows.
3. Enable the agent to autonomously fetch Zendesk tickets, Datadog errors, and Confluence investigations when given an identifier.
4. Reduce time-to-triage for incoming tickets.

## Non-Goals

- Replacing NocLense's Diagnose tab (it handles multi-file log correlation which the agent chat cannot).
- Giving the agent write access to any system (no ticket updates, no DynamoDB mutations).
- Modifying the existing `unleashService.ts` or `UnleashProvider.ts` code.

---

## Approach A: Agent Instructions + Prompt Templates

### A1. Custom System Instructions

Paste the following into the Unleash agent's "Instructions" field in the admin panel. This encodes Carbyne domain knowledge derived from real ticket patterns, APEX event structures, and operational runbooks.

```
You are a Senior NOC (Network Operations Center) analyst for Carbyne, a 911/emergency
communications platform serving PSAPs (Public Safety Answering Points) across the US.
You support daily operations, ticket triage, troubleshooting, and root cause analysis.

## CARBYNE TECHNOLOGY STACK

**APEX** -- Core call-handling platform deployed at PSAPs.
- Each PSAP has stations (operator workstations) identified as POS numbers (e.g., APEX POS 4)
- Stations connect to a CNC (Call & Notification Center) -- the regional server cluster
- Station IDs follow patterns like: us-fl-miamidade-universe-113, Dispatch 1, EC32
- Queues: 911 (primary), 911-GV/911-HP (geographic variants), Admin, non-emergency (e.g. "2222")
- Key services: PBXCallMonitoringService, FDXMessageHandlerService, CCS-SDK, LogEventData

**CCS-SDK (Call Control System)** -- SIP call routing, extension registration, PBX monitoring.
Common error patterns and what they mean:
- "Failed to send initial outgoing request" = SIP transport layer failure (network/firewall)
- "Not connected" = WebSocket/TCP connection to PBX lost
- "Transport error in non-INVITE client transaction" = Network instability during active session
- "503 Service Unavailable" = PBX overloaded or unreachable
- Extension registration failures = calls not delivered to stations

**FDX (Field Data Exchange)** -- WebSocket protocol for real-time data (IoT, CAD, ALI).
Message types: reportNLPConversation, fdxReportUpdateMessageData, operator status, queue changes.

**SIP/RTP** -- Voice signaling. Methods: INVITE, BYE, CANCEL, ACK.
Error codes: 4xx (client), 5xx (server), 6xx (global). PIDF+XML carries E911 geolocation.

**APEX Event Exports** -- Standardized call lifecycle records containing:
- Attributes: Event ID, timestamp, direction, type (Emergency/Non-emergency), queue, caller phone
- Location: Multi-method tracking (ANI/ALI from carrier, i3 GPS 9-46m accuracy, AML device-based)
- Intelligence: Carrier info (Verizon, T-Mobile, AT&T), subscriber vCard, NENA identifiers
- Transcript: Speaker-labeled with timestamps, translation markers (e.g., "Translated from Spanish")
- Audit trail: Agent actions (Answer Call, Warm Transfer) with timestamps and SIP URIs
- Termination reasons: Agent Ended Call, Abandoned, Transferred
- Qualifiers: "Translated" flag when Language Line used

**CCU (Control Center Universe)** -- Admin/management interface for APEX.
Known issues: PDF export errors (browser-specific), log permission issues on "New UI" deployments.

**DynamoDB** -- Backend state management for call queues.
Known issue: Calls can get stuck in abandoned queue requiring backend cleanup.

**Integration Points:**
- Zendesk: Ticket management (subdomain-based, Basic auth)
- Datadog: Production monitoring. Query: service:apex-ng status:error.
  Key fields: logSource, machineData.callCenterName (CNC), machineData.name (station).
  Indexes: main, ops
- Confluence: Knowledge base and investigation memory
- Language Line: Translation service accessed via DTMF. Common issue: DTMF not recognized,
  codes rejected -- often user workflow error, not APEX issue
- Spikko: Sequential ringing configuration (secure.spikko.com)
- Twilio Studio: IVR call flows (per-location subaccounts, e.g., North Miami Beach IVR)
- Jira: Issue tracking
- Monday: Project management

## OPERATIONAL PROCEDURES

**Datadog Agent Reset** (for false alarms / stale metrics):
- Method 1 (Fast, 2-5 min): Stop agent, clear cache, restart
- Method 2 (Full, 5-10 min): Stop, backup config, clear all data, reinstall config, restart
- Key paths: /etc/datadog-agent/, /var/lib/datadog, /var/cache/datadog
- Commands: systemctl stop/start datadog, datadog-agent status

**Spikko Number Changes:**
- secure.spikko.com > Package Advanced Features > Sequential Ringing > edit user number

**Twilio IVR Updates:**
- console.twilio.com > subaccount (by location) > Studio > flow > Connect Call To widget > publish

## ROOT CAUSE ATTRIBUTION FRAMEWORK

Based on historical ticket patterns, apply this triage framework:

Audio/hardware (single station, works after reboot):
  Attribution: Not Carbyne -- equipment issue.
  Action: Request remote access for audio script.

DTMF/Language Line (codes rejected, freezing on dial):
  Attribution: Often user error -- workflow gap.
  Action: Share APEX user guide dial pad section.

Missing caller ID/location (AML not enabled for queue type):
  Attribution: Customer config -- not Carbyne.
  Action: Check queue capabilities in APEX admin.

PDF export errors (browser-specific, not reproducible):
  Attribution: Environment issue.
  Action: Test in alternate browser, isolate station.

Stuck calls in queue (call trapped in abandoned queue):
  Attribution: DynamoDB state issue.
  Action: Clear in DynamoDB backend.

SIP transport errors ("Not connected", 503s, transport failures):
  Attribution: Network/infrastructure.
  Action: Check station network, PBX connectivity.

CNC-wide errors (multiple stations same CNC, same time):
  Attribution: Escalate to L2/L3.
  Action: Check CNC health, network between CNC and stations.

Key insight: approximately 80% of tickets are "Not Carbyne's Fault" (customer-caused,
unable to duplicate, or no issue found). Identifying attribution early saves escalation time.

## HOW TO HELP NOC AGENTS

1. Ticket Triage: Given a ticket, provide: Severity (P1-P4), Root cause category,
   Attribution (Carbyne vs customer vs infrastructure), Recommended first steps,
   Escalation recommendation (yes/no + reason).

2. Log Interpretation: Given log snippets, identify the error pattern, explain what
   each component is doing, and suggest which other log sources to cross-reference.
   Always correlate timestamps across sources (plus or minus 2 minute window).

3. Runbook Lookup: Search Confluence for known issues, past investigations, and standard
   procedures. Reference specific page titles.

4. APEX Event Analysis: When given event exports, extract: call timeline, location accuracy
   comparison (ANI/ALI vs i3 vs AML), termination reason, and any anomalies.

5. Escalation Guidance:
   - Escalate: CNC-wide outages, SIP infrastructure failures, DynamoDB issues
   - Do not escalate: Single-station audio, user workflow errors, browser-specific bugs,
     missing AML on non-911 queues

## RESPONSE FORMAT

- Be concise -- NOC agents work under time pressure on active 911 systems
- Lead with diagnosis, then evidence
- Cite timestamps, station names, error codes, and log sources
- For triage always include: Severity | Root cause hypothesis | Attribution | Next steps | Escalate?
- For closure notes use this format:

  Issue Summary: [what happened]
  Troubleshooting Steps Taken: [specific actions with timestamps]
  Root Cause: [cause or "Unable to determine -- monitoring recommended"]
  "We have addressed your ticket and are closing the case. Contact support
  to reopen or create a new ticket."
```

### A2. Prompt Templates

Replace the generic placeholder with these four task-specific templates in the Unleash admin panel:

| # | Template Text | Purpose |
|---|---------------|---------|
| 1 | `Triage Zendesk ticket #[ticket number]: assess severity, root cause category, attribution (Carbyne vs customer vs infra), and recommended next steps` | Daily ticket intake |
| 2 | `Interpret these log entries and identify the error pattern, affected components, and what to cross-reference: [paste logs]` | Ad-hoc log analysis |
| 3 | `Generate a closure note for ticket #[ticket number] with issue summary, troubleshooting steps taken, and root cause determination` | End-of-investigation |
| 4 | `Search for known issues or past investigations related to: [symptom or error message]` | Knowledge base lookup |

### A3. Display Preferences

- **Pin to Chat Sidebar:** ON -- makes the agent visible to all NOC agents with Interact permission.
- **Display on Quick Search:** ON -- agents can invoke from Homepage/Launch Bar without navigating.

### A4. Implementation Steps

1. Open Unleash Admin Center > Assistants > "Noc toolAgent".
2. Paste the system instructions from A1 into the Instructions field.
3. Delete the existing generic prompt template.
4. Add the four templates from A2.
5. Toggle "Pin to Chat Sidebar" and "Display on Quick Search" to ON.
6. Test with a real ticket triage scenario.

No code changes required. Estimated effort: 15 minutes.

---

## Approach B: Custom Tool Endpoints

### B1. Architecture

The existing Vercel proxy endpoints (`/api/zendesk-proxy`, `/api/datadog-proxy`, etc.) pass through raw API calls and require client-side auth headers. For the Unleash agent to call them autonomously, we need a new layer of **tool endpoints** that:

1. Authenticate server-side using Vercel environment variables (no client credentials needed).
2. Return structured, summarized JSON (not raw API passthrough).
3. Are read-only (no mutations).

```
Unleash Agent (Custom Tool call)
  |
  v
/api/tools/zendesk-ticket?id=39325
  |
  v
Vercel Serverless Function
  - Reads VITE_ZENDESK_* from process.env
  - Calls Zendesk API with Basic auth
  - Returns structured summary JSON
```

### B2. Endpoint Specifications

#### `GET /api/tools/zendesk-ticket`

**Parameters:** `id` (required) -- Zendesk ticket number.

**Response:**
```json
{
  "ticketId": 39325,
  "subject": "Caller ID Missing (Location & Name)",
  "status": "solved",
  "priority": "normal",
  "requester": "Georgia Tech PD",
  "createdAt": "2026-03-10T14:20:00Z",
  "tags": ["apex", "missing_location"],
  "description": "Wireless 911 callers showing as unknown caller...",
  "commentCount": 8,
  "latestComments": [
    { "author": "NOC Agent", "body": "Reviewed call analytics...", "createdAt": "..." }
  ],
  "attachmentCount": 2
}
```

**Auth:** Server-side Basic auth from `VITE_ZENDESK_SUBDOMAIN`, `VITE_ZENDESK_EMAIL`, `VITE_ZENDESK_TOKEN`.

#### `GET /api/tools/zendesk-search`

**Parameters:** `q` (required) -- search query string.

**Response:**
```json
{
  "count": 3,
  "tickets": [
    { "id": 39325, "subject": "Caller ID Missing", "status": "solved", "createdAt": "..." },
    { "id": 38979, "subject": "DTMF Not Recognized", "status": "solved", "createdAt": "..." }
  ]
}
```

**Auth:** Same as above.

#### `POST /api/tools/datadog-errors`

**Body:**
```json
{
  "from": "2026-03-21T21:00:00Z",
  "to": "2026-03-22T04:00:00Z",
  "query": "service:apex-ng status:error",
  "hosts": ["station1", "station2"],
  "indexes": ["main", "ops"],
  "limit": 50
}
```

**Response:**
```json
{
  "totalMatched": 238,
  "returned": 50,
  "timeRange": { "from": "...", "to": "..." },
  "logs": [
    {
      "timestamp": "2026-03-21T21:27:01.163Z",
      "service": "CCS-SDK",
      "host": "station1",
      "level": "ERROR",
      "message": "sip.transaction.nict | Failed to send initial outgoing request."
    }
  ],
  "summary": {
    "byService": { "CCS-SDK": 180, "sip.user-agent-client": 58 },
    "byLevel": { "ERROR": 238 },
    "byHost": { "station1": 120, "station2": 118 }
  }
}
```

**Auth:** Server-side from `VITE_DATADOG_API_KEY`, `VITE_DATADOG_APP_KEY`, `VITE_DATADOG_SITE`.

#### `GET /api/tools/confluence-search`

**Parameters:** `q` (required) -- CQL search query or plain text.

**Response:**
```json
{
  "count": 2,
  "results": [
    {
      "pageId": "123456",
      "title": "Investigation: DTMF failures at RioCOG Presidio",
      "excerpt": "User workflow error confirmed...",
      "url": "https://carbyne.atlassian.net/wiki/spaces/.../pages/123456",
      "lastModified": "2026-03-15T10:00:00Z"
    }
  ]
}
```

**Auth:** Server-side Basic auth from `VITE_JIRA_SUBDOMAIN`, `VITE_JIRA_EMAIL`, `VITE_JIRA_TOKEN`.

### B3. Unleash Custom Tool Definitions

Register each endpoint as a Custom Tool in the Unleash agent admin panel. Each tool definition includes:

**Tool 1: Fetch Zendesk Ticket**
- Name: `fetch_zendesk_ticket`
- Description: "Fetch a Zendesk support ticket by its number, including subject, status, priority, requester, description, and recent comments."
- URL: `https://noc-lense-clone.vercel.app/api/tools/zendesk-ticket`
- Method: GET
- Parameters: `id` (string, required) -- "The Zendesk ticket number, e.g. 39325"

**Tool 2: Search Zendesk Tickets**
- Name: `search_zendesk_tickets`
- Description: "Search Zendesk tickets by keyword to find related or similar issues."
- URL: `https://noc-lense-clone.vercel.app/api/tools/zendesk-search`
- Method: GET
- Parameters: `q` (string, required) -- "Search query, e.g. 'audio POS 4' or 'DTMF Language Line'"

**Tool 3: Fetch Datadog Errors**
- Name: `fetch_datadog_errors`
- Description: "Fetch recent error logs from Datadog for a time window and optional station/host filter. Returns log entries and a summary breakdown by service, level, and host."
- URL: `https://noc-lense-clone.vercel.app/api/tools/datadog-errors`
- Method: POST
- Parameters:
  - `from` (string, required) -- "ISO-8601 start time"
  - `to` (string, required) -- "ISO-8601 end time"
  - `query` (string, optional, default: "service:apex-ng status:error") -- "Datadog query"
  - `hosts` (array of strings, optional) -- "Station/host names to filter"
  - `indexes` (array of strings, optional, default: ["main", "ops"]) -- "Datadog indexes"
  - `limit` (number, optional, default: 50) -- "Max log entries to return"

**Tool 4: Search Confluence KB**
- Name: `search_confluence_kb`
- Description: "Search the Carbyne Confluence knowledge base for known issues, past investigations, runbooks, and procedures."
- URL: `https://noc-lense-clone.vercel.app/api/tools/confluence-search`
- Method: GET
- Parameters: `q` (string, required) -- "Search query, e.g. 'stuck call abandoned queue' or 'Datadog agent reset'"

### B4. Security Considerations

- All tool endpoints are **read-only**. No mutations to Zendesk, Datadog, Confluence, or any other system.
- Auth credentials live in Vercel environment variables, never exposed to the Unleash agent or browser.
- Endpoints validate a shared secret header (`X-Tool-Secret`) to prevent unauthorized access. If the header is missing or does not match the `TOOL_SECRET` Vercel env var, the endpoint returns `401 Unauthorized` with `{"error": "Unauthorized"}`. The same secret is configured in each Unleash Custom Tool's request headers.
- Rate limiting: Each endpoint should enforce a per-minute cap (e.g., 30 req/min) to prevent abuse.

### B5. File Structure

New files to create in `NocLense/api/tools/`:

```
api/tools/
  zendesk-ticket.ts    -- GET /api/tools/zendesk-ticket?id=...
  zendesk-search.ts    -- GET /api/tools/zendesk-search?q=...
  datadog-errors.ts    -- POST /api/tools/datadog-errors
  confluence-search.ts -- GET /api/tools/confluence-search?q=...
```

Each file follows the same pattern as existing proxy files but with:
1. Server-side auth (reads from `process.env`).
2. Structured response (transforms raw API data into summary JSON).
3. Shared secret validation via `X-Tool-Secret` header.
4. Rate limiting via in-memory counter (acceptable for Vercel serverless scale).

### B6. Implementation Steps

1. Create the four tool endpoint files in `api/tools/`.
2. Add `TOOL_SECRET` to Vercel environment variables.
3. Deploy to Vercel (auto-deploys on push to main).
4. Register each Custom Tool in the Unleash agent admin panel with the production URLs.
5. Test each tool independently via curl, then test via the agent chat.

Estimated effort: 2-3 hours for endpoints + testing, 30 minutes for Unleash admin config.

---

## Testing Plan

### Approach A Validation
- [ ] Open Unleash agent chat (direct, not through NocLense)
- [ ] Use "Triage Ticket" template with a real ticket number -- verify agent uses attribution framework
- [ ] Use "Interpret Logs" template with CCS-SDK errors from screenshot -- verify agent identifies SIP transport failure pattern
- [ ] Use "Find Known Issue" template with "DTMF Language Line" -- verify agent searches Confluence
- [ ] Use "Closure Note" template -- verify format matches the specified structure
- [ ] Have a new NOC agent attempt the workflow without prior training -- measure if templates are self-explanatory

### Approach B Validation
- [ ] curl each `/api/tools/*` endpoint with valid parameters -- verify structured JSON response
- [ ] curl with missing/invalid `X-Tool-Secret` -- verify 401 rejection
- [ ] From Unleash agent chat, say "Look up ticket 39325" -- verify agent calls `fetch_zendesk_ticket` tool
- [ ] From Unleash agent chat, say "Check Datadog for errors on station1 in the last hour" -- verify agent calls `fetch_datadog_errors`
- [ ] From Unleash agent chat, say "Find known issues about stuck calls" -- verify agent calls `search_confluence_kb`
- [ ] Test rate limiting -- send 35 requests in 60 seconds, verify last 5 are rejected

---

## Rollout Plan

**Phase 1 (Today):** Approach A -- paste instructions, add templates, toggle display prefs.
**Phase 2 (Today):** Approach B -- implement tool endpoints, deploy, register in Unleash.
**Phase 3 (This week):** Collect feedback from 2-3 NOC agents using the direct chat for real triage.
**Phase 4 (Next week):** Iterate on instructions and tool responses based on feedback.

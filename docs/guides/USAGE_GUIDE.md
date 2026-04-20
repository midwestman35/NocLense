# NocLense Usage Guide

**Version:** 2.0 | **Updated:** 2026-03-30

---

## Getting Started

### Web (Vercel)
Navigate to your deployed NocLense URL. All API credentials are configured via Vercel environment variables — no local setup needed.

### Local Development
```bash
git clone https://github.com/midwestman35/NocLense.git
cd NocLense
npm install
# Drop the .env file in the project root (get from team lead)
npm run dev          # Web at http://localhost:5173
npm run electron:dev # Desktop app (Electron + Vite)
```

---

## Core Workflow: Investigating a Ticket

### Step 1: Import Incident Data

**Option A — Start from a Zendesk ticket:**
1. Enter a ticket number in the "Zendesk Ticket" field on the main screen
2. Click **Investigate**
3. The Investigation Setup Modal opens — select attachments, timezone, Datadog enrichment
4. Click **Start Investigation** — files are downloaded and parsed automatically

**Option B — Upload log files directly:**
1. Click **Upload files** or drag-and-drop `.log`, `.txt`, or `.csv` files
2. Select the source type (APEX, Datadog, AWS Console, Unknown)
3. Multiple files are merged by timestamp automatically

**Option C — Paste logs:**
1. Click **Paste logs**
2. Paste CloudWatch or console output directly
3. Good for short incident windows

### Step 2: Run AI Diagnosis

1. Open the **Diagnose** tab in the AI sidebar (right side)
2. Enter a Zendesk ticket number and click **Fetch** (or click **Skip** for ticket-free analysis)
3. Select the customer timezone
4. Optionally enable **Datadog Enrichment** to pull live server logs
5. Click **Scan Logs Against Ticket**
6. Wait 15–30 seconds for the AI analysis

### Step 3: Review & Refine (Phase 2)

After the scan completes, you land on the Review & Refine screen:

**Left pane:**
- **AI Diagnosis** — Root cause and summary at the top
- **Correlated Logs** — Logs the AI identified as relevant (highlighted in violet in the main viewer)
- **Also Check** — Suggested additional log sources
- **Similar Past Tickets** — Past closed tickets and Confluence investigations matching this issue (auto-populated)

**Right pane:**
- **Troubleshooting** — Steps already taken or recommended
- **Internal Note** — Editable draft that will be posted to Zendesk
- **AI Refinement** — Type instructions to have the AI rewrite parts of the note

**Actions you can take:**
- Star additional logs in the main viewer — they get added to the correlated set
- Edit the internal note directly
- Ask the AI to refine: *"Make the root cause section more specific"*
- Ask for a closure note: *"Fill out the closing note with our conclusions"* (triggers the closure template automatically)
- Click a similar past ticket to see its closure note
- Click **Next** when satisfied

### Step 4: Submit (Phase 3)

1. Review the closure note preview
2. Options:
   - **Include log archive** — bundles filtered logs as a ZIP
   - **Download locally** — saves the ZIP to your computer
   - **Attach to Zendesk** — uploads the ZIP to the ticket
3. Click **Post Internal Note**
4. Three things happen:
   - Internal note posts to the Zendesk ticket
   - Log archive downloads/attaches (if selected)
   - **Investigation saves to Confluence** automatically (under Operations > NOC Investigations)
5. Success screen shows links to both Zendesk and Confluence

---

## AI Features

### Diagnose Tab
Full 3-phase investigation workflow (described above). Correlates Zendesk tickets with loaded logs using Carbyne-specific knowledge of APEX, CCS, FDX, Homer SIP, and Datadog log formats.

### Summary Tab
One-click log summarization. Identifies what happened, key events, errors, and overall outcome.

### Anomalies Tab
Scans logs for anomalies, errors, and root causes. Returns a numbered list of issues with likely causes and recommended actions.

### Chat Tab
Free-form conversation with the AI about your logs. The AI has context of all loaded log entries. Supports multi-turn conversation (remembers previous exchanges).

**Template triggers:** Certain phrases automatically inject templates:
- *"closing note"*, *"closure note"*, *"close the ticket"* → Triggers the closure note template (Issue Summary, Troubleshooting Steps, Root Cause + closing boilerplate)

### Auto-tag Tab
Classifies logs into categories (SIP, Authentication, Network, Media, System, Database, Timeout, Error) with counts and analysis.

---

## Filtering & Navigation

### Log Viewer
- **Search** — Full-text search with history (arrow keys to browse past searches)
- **Level filter** — Toggle ERROR, WARN, INFO, DEBUG
- **SIP filter** — Show only SIP messages, filter by method (INVITE, BYE, etc.)
- **Source filter** — Filter by log source when multiple are loaded (Datadog, Homer SIP, Call Log, FDX, CCS/PBX, APEX Local)
- **Message type filter** — Filter by message type with exclude support
- **Collapse similar** — Merge consecutive similar rows with a count badge
- **Favorites** — Star logs with the star icon, then filter to show only favorites
- **AI highlighted** — Filter to show only logs the AI identified as relevant (violet highlight)

### Correlation System
Click colored dots next to Call-IDs, Report-IDs, or Station-IDs to filter by that value. Multiple correlations use AND between types, OR within a type.

### Sidebar Panels (left rail)
- **Files** — Manage imported log files
- **Call IDs** — Browse and filter by Call-ID
- **Reports** — Browse and filter by Report-ID
- **Stations** — Browse and filter by Station-ID
- **AI Analysis** — The AI sidebar (also accessible via the right panel)
- **Filters** — Advanced filter management

### Resizable AI Sidebar
The AI sidebar on the right is resizable — drag the left edge to make it wider or narrower. Your preferred width is saved automatically.

---

## Investigation Memory (Confluence)

Every completed investigation is automatically saved to Confluence under **Operations > NOC Investigations**. This builds a team knowledge base over time.

### What gets saved:
- Ticket ID, subject, organization
- Root cause with auto-detected category tags
- AI diagnosis summary
- Key evidence (correlated log entries with timestamps)
- Troubleshooting steps
- Full closure note
- Suggested additional log sources

### How it helps future investigations:
When you run a new diagnosis, the **Similar Past Tickets** panel in Phase 2 searches Confluence for past investigations matching the current issue's root cause, components, and error patterns. If a similar case was resolved before, you'll see it immediately — along with the resolution that worked.

### Multi-user:
Each agent's investigations save independently. Leo submitting ticket #100 and you submitting ticket #200 at the same time creates two separate Confluence pages — no conflicts.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Submit search / send chat message |
| `Escape` | Close dropdown / clear search |
| `Arrow Up/Down` | Browse search history |

---

## Supported Log Formats

| Format | Source | Auto-detected by |
|--------|--------|-----------------|
| APEX logs | `[LEVEL] [date, time] [component]: message` | Regex pattern |
| ISO logs | `[LEVEL] [YYYY-MM-DD HH:MM:SS,ms] [component] message` | Regex pattern |
| Datadog CSV | `Date,Host,Service,Content` (JSON in Content field) | `.csv` extension + header |
| Call Log CSV | `ID,Created,Phone,...,Station,...` (26-column Carbyne format) | `.csv` extension + header |
| Homer SIP | `proto:PROTOCOL TIMESTAMP SOURCE ---> DESTINATION` | `proto:` header detection |
| JSON payloads | Embedded in log entries | `{` ... `}` detection in payload |
| PDF attachments | APEX event summaries | `.pdf` extension (text extracted) |
| ZIP archives | Contains any of the above | `.zip` extension (extracted) |

---

## Troubleshooting

### "Unleash API error (400)"
- Check that `VITE_UNLEASH_TOKEN` is set and valid
- If the error mentions "Assistant must be of type general", the assistant ID may be incorrect — clear `VITE_UNLEASH_ASSISTANT_ID` in the env

### Datadog station discovery returns 0 results
- Open browser console (F12) to see which query strategies were tried
- Check that your Datadog Application Key has the `logs_read_data` scope
- Results are cached for 15 minutes — wait or use a different CNC name to test
- You can always type station names manually

### Empty/blank log rows
- If you see entries showing `[Empty entry — source]`, the parser found a line it couldn't extract a message from. The source label tells you which parser handled it.

### Confluence save not working
- Verify `VITE_JIRA_EMAIL` and `VITE_JIRA_TOKEN` are set (Confluence uses the same Atlassian credentials as Jira)
- Verify `VITE_CONFLUENCE_SPACE_ID` and `VITE_CONFLUENCE_PARENT_PAGE_ID` are set
- The Confluence save is non-blocking — if it fails, the Zendesk post still succeeds

### Large files crashing the app
- Files over 50MB trigger IndexedDB streaming mode automatically
- For very large files (100MB+), consider splitting them before import
- The app has a global error boundary — if it crashes, click "Try Again" to recover without losing data

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_UNLEASH_TOKEN` | Yes | Unleashed AI bearer token |
| `VITE_UNLEASH_ASSISTANT_ID` | No | Optional assistant ID (leave empty for default) |
| `VITE_ZENDESK_SUBDOMAIN` | Yes | Zendesk subdomain (e.g., `carbyne`) |
| `VITE_ZENDESK_EMAIL` | Yes | Zendesk agent email |
| `VITE_ZENDESK_TOKEN` | Yes | Zendesk API token |
| `VITE_DATADOG_API_KEY` | No | Datadog API key (enables Datadog enrichment) |
| `VITE_DATADOG_APP_KEY` | No | Datadog Application Key (needs `logs_read_data` scope) |
| `VITE_DATADOG_SITE` | No | Datadog site (default: `datadoghq.com`) |
| `VITE_JIRA_SUBDOMAIN` | No | Atlassian site (e.g., `reporty.atlassian.net`) |
| `VITE_JIRA_EMAIL` | No | Atlassian email (for Jira + Confluence) |
| `VITE_JIRA_TOKEN` | No | Atlassian API token |
| `VITE_CONFLUENCE_SPACE_ID` | No | Confluence space ID for investigation store |
| `VITE_CONFLUENCE_PARENT_PAGE_ID` | No | Parent page ID under which investigations are saved |

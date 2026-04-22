# NocLense Usage Guide

**Version:** 3.0 | **Last updated:** 2026-04-22

Welcome to NocLense! This guide will help you quickly navigate the application, investigate telecom incidents, and close tickets with confidence. 

---

## 1. Getting Started

You can access NocLense in two ways:
- **Web Browser:** Navigate to the internal company URL provided by your team lead.
- **Desktop Application:** Install the desktop app if you handle very large files (100MB+) frequently.

---

## 2. The 3-Phase Workflow

NocLense is built around a structured, 3-phase investigation process to keep you focused.

### Phase 1: IMPORT ROOM
This is where you bring your incident data into the tool.
- **Upload Files:** Drag and drop `.log`, `.txt`, `.csv`, or `.noclense` files directly onto the screen. Note that PDF and ZIP extraction only works through the Diagnose pipeline (Zendesk attachments), NOT through the main Import Room file upload.
- **Resume Workspace:** You can also re-open a saved `.noclense` investigation file to pick up where you left off.
- **Zendesk Fetch:** Enter a ticket number to automatically pull attachments and metadata from Zendesk.
- **Paste Logs:** Click the "Paste logs" option to quickly drop in copied snippets from AWS CloudWatch or server consoles.

### Phase 2: INVESTIGATE ROOM
Once your data is loaded, you enter the Investigate Room. This workspace uses a 6-card layout:
1. **Log Stream:** The main view of all your parsed logs.
2. **AI Assistant:** Your troubleshooting partner to diagnose issues and answer questions.
3. **Evidence:** A staging area where you pin important log lines.
4. **Similar Tickets:** Automatically surfaces past Confluence investigations matching your current issue.
5. **Correlation Graph:** A visual map of how calls and systems connect.
6. **Datadog Live:** Connects to Datadog to pull real-time enrichment data.

**To run an AI Diagnosis:**
1. In the AI Assistant card, click **Diagnose**.
2. Make sure your Zendesk ticket number and timezone are correct.
3. Click **Scan Logs Against Ticket**. 
4. The AI will scan the logs, highlight relevant lines (in violet), and provide a root cause summary.
5. You can refine the analysis by typing instructions in the chat box.

### Phase 3: SUBMIT ROOM
When you've found the issue, move to the Submit Room to wrap up.
- **Closure Note:** Review the AI-generated draft explaining the root cause and troubleshooting steps.
- **Evidence Bundle:** Check the logs you've starred to ensure they are automatically attached to the summary.
- **Post to Zendesk:** Click **Post Internal Note** to automatically send your summary and evidence ZIP directly to Zendesk.
- **Save to Confluence:** NocLense automatically saves a copy of your investigation to the Confluence NOC Knowledge Base so your team can learn from it next time.

---

## 3. Filtering & Navigation

Managing 100,000+ lines of text is easy using the built-in filters above the Log Stream:

- **Search:** Full-text search to find specific phrases or numbers.
- **Level Filter:** Toggle between showing ERROR, WARN, INFO, or DEBUG messages.
- **SIP Filter:** Show only SIP messages, or isolate specific methods (like INVITE or BYE).
- **Source Filter:** When looking at multiple files, easily hide or show logs from Datadog, Homer, APEX, etc.
- **Message Type:** Filter by specific structural formats.
- **Correlation Dots:** Click the colored dots next to a Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, or Message-ID to instantly see only logs related to that ID.
- **Favorites (Starring):** Click the star icon next to any log line to save it as Evidence. 

---

## 4. AI Features

Your AI Assistant has several built-in tools:

- **Diagnose:** Scans your logs against a specific Zendesk ticket to find the root cause.
- **Summary:** Gives a quick, high-level overview of what happened during the loaded timeframe.
- **Anomalies:** Automatically hunts for unexpected errors or strange patterns you might have missed.
- **Chat:** Talk directly with the AI. You can ask things like, *"What caused the 503 error at 14:02?"*
- **Auto-tag:** Categorizes logs into system areas (Network, Media, Database, etc.) so you know where the bulk of the activity happened.

**Magic Phrases (Templates):**
Typing any of these phrases into the Chat will automatically tell the AI to draft a final summary for you:
- *"closing note"*
- *"closure note"*
- *"close the ticket"*

---

## 5. Keyboard Shortcuts

Work faster with these hotkeys:
- **Enter:** Submit your search or send a chat message.
- **Escape:** Close a dropdown menu or clear your current search.
- **Arrow Up / Down:** Browse through your previous searches in the search bar.

---

## 6. Supported Log Formats

NocLense automatically understands these formats:

| Format | What it looks like / Source |
|---|---|
| **APEX logs** | `[ERROR] [2026-04-22, 14:00:00] [media-router]: timeout` |
| **Datadog CSV** | Exported CSVs with `Date, Host, Service, Content` columns. |
| **Call Log CSV** | Standard 26-column format. |
| **Homer SIP** | `proto:UDP 2026-04-22 14:00:00 10.0.0.1 ---> 10.0.0.2` |
| **ISO Logs** | `[INFO] [2026-04-22 14:00:00,123] [auth] token refreshed` |
| **JSON Payloads** | Embedded `{ ... }` objects inside log text. |
| **PDF & ZIP** | NocLense unpacks ZIPs and extracts text from PDFs automatically! (Via Zendesk attachments) |

---

## 7. Troubleshooting FAQ

**"Unleash API error (400)"**
A 400 error means a malformed request (bad payload or model mismatch), NOT an expired token. An expired/missing token produces a separate "No API token configured" error.

**Datadog station discovery returns 0 results**
Make sure your Datadog Application Key has the `logs_read_data` scope enabled. You can also just type the station names manually if auto-discovery fails.

**Empty or blank log rows**
This means the parser found a line it couldn't read properly. You can safely ignore these, or check the file manually if you suspect missing data.

**Large files are slowing down my browser**
If a file is over 50MB, NocLense automatically streams it from your hard drive to save memory. For files over 100MB, we highly recommend using the Desktop app version instead of the web browser.

---

## 8. Investigation Memory

Every time you submit a closure note in Phase 3, NocLense silently saves a clean copy of your investigation to the **Operations > NOC Investigations** space in Confluence. 

Because of this, the next time someone on your team encounters a similar error or component failure, the **Similar Tickets** card will light up with your past resolution. This builds a shared brain for the entire NOC!
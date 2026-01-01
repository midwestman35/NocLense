# NocSight User Guide

## Overview

NocSight is a NOC-focused log investigation tool designed for SaaS NG911 products. It helps NOC teams create investigation cases, bookmark evidence, add notes, and generate export packs for handoff to UC, Network, R&D, and AWS/Platform teams.

---

## Getting Started

### Installation

```bash
cd C:\Users\somur\Documents\NocSight
npm install
npm run dev
```

### Access the Application

Open your browser and navigate to:
- **Local:** http://localhost:3000
- **Network:** http://[your-ip]:3000

---

## Application Layout

The interface is divided into four main areas:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        TOP BAR                              â”‚
â”‚  [Search] [Filters] [Pivot Chips]     [Case Header] [Export]â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          â”‚                                â”‚                 â”‚
â”‚ SIDEBAR  â”‚         MAIN LOG AREA          â”‚  DETAILS PANEL  â”‚
â”‚          â”‚                                â”‚                 â”‚
â”‚ Cases    â”‚    Virtualized Event List      â”‚  Event Details  â”‚
â”‚ Files    â”‚                                â”‚  Bookmarks      â”‚
â”‚ Pivots   â”‚                                â”‚  Notes          â”‚
â”‚          â”‚                                â”‚  Evidence Tab   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                      TIMELINE SCRUBBER                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Core Workflows

### 1. Creating a Case

1. Click **"+ New Case"** in the left sidebar
2. Fill in the case details:
   - **Title**: Descriptive name (e.g., "Call Drop Issue - Tenant ABC")
   - **Severity**: Low, Medium, High, or Critical
   - **Summary**: Brief description of the issue
   - **Impact**: Business impact description
3. Click **"Create Case"**

The new case becomes active and appears in the sidebar.

### 2. Managing Cases

- **Switch Cases**: Click any case in the sidebar to make it active
- **Case Header**: Shows current case title and severity in the top bar
- **Auto-Save**: All changes are automatically saved to localStorage

### 3. Investigating Events

Once log files are loaded (future feature), events appear in the main log area:

1. **Browse Events**: Scroll through the virtualized event list
2. **Select Event**: Click an event to view details in the right panel
3. **Filter Events**: Use the search bar to filter by keywords
4. **Time Navigation**: Use the timeline scrubber to jump to specific times

### 4. Bookmarking Evidence

When viewing an event in the Details panel:

1. Click a bookmark tag button:
   - **Evidence**: Key proof of the issue
   - **Symptom**: Observable effect or indicator
   - **Milestone**: Important timeline marker
   - **Red Herring**: Investigated but not relevant
   - **Action**: Action taken or required

2. Optionally add a note to the bookmark

Bookmarks are saved to the active case and appear in the Evidence tab.

### 5. Adding Notes

**Case-Level Notes:**
1. Go to Details panel (no event selected)
2. Click "Add Case Note"
3. Enter your note and click "Save"

**Event-Level Notes:**
1. Select an event in the log list
2. Type in the note textarea in Details panel
3. Click "Save Note"

### 6. Viewing Evidence

1. Click the **"Evidence"** tab in the Details panel
2. View all bookmarks in chronological order
3. Each bookmark shows:
   - Tag type (color-coded)
   - Timestamp
   - Event ID
   - Associated note (if any)

---

## Export Packs

Generate handoff artifacts for different teams:

### Opening Export Modal

1. Ensure a case is active
2. Click **"Export"** button in the top bar

### Export Options

| Option | Description |
|--------|-------------|
| **Pack Type** | Target team/purpose |
| **Redaction** | Level of data masking |
| **Include Payload** | Include raw event payloads |
| **Max Events** | Limit events to prevent huge exports |

### Pack Types

| Pack | Purpose | Includes |
|------|---------|----------|
| **UC** | Unified Communications team | SIP call flows, signaling events, call timing, Call-IDs |
| **Network** | Network team | Timing anomalies, retransmits, timeouts, connectivity hints |
| **R&D** | R&D team | Errors/warnings, stack traces, trace/request IDs, evidence excerpts |
| **AWS/Platform** | AWS/Platform team | AWS events, request IDs, CloudWatch Insights templates |
| **Full** | Complete export | All events and data |

### Redaction Presets

| Preset | Description |
|--------|-------------|
| **External** | Aggressive redaction - masks phones, emails, tokens, tenant IDs |
| **Internal** | Moderate redaction - masks tokens/auth, keeps correlation IDs |
| **Raw** | No redaction - original data (use with caution) |

### Export Files Generated

| File | Content |
|------|---------|
| `report.md` | Human-readable case report |
| `case.json` | Structured case data with events |
| `filtered_logs.ndjson` | Normalized events (one JSON per line) |
| `queries.txt` | Suggested query templates |
| `provenance.json` | Export metadata and audit trail |

---

## Query Templates

Export packs include suggested queries for:

### CloudWatch Insights
```
fields @timestamp, @message
| filter @requestId = "abc-123"
| sort @timestamp asc
```

### Datadog
```
service:my-service @traceId:xyz-789
```

### SIP Filters
```
Call-ID: abcd-1234-efgh
Method: INVITE
Status: 503
```

---

## Data Persistence

- **Storage**: All data is stored in browser localStorage
- **Auto-Save**: Changes save automatically
- **Reload**: Data persists across browser refreshes
- **Clear Data**: Clear browser storage to reset

---

## Keyboard Tips

| Action | Method |
|--------|--------|
| Search logs | Click search bar, type query |
| Close modal | Click outside or press Escape |
| Quick scroll | Use mouse wheel in log list |

---

## Design Philosophy

### Monochrome iOS-Style Dark UI

- **Colors**: Black, white, and gray only
- **Background**: Near-black (#000000)
- **Surfaces**: Charcoal (#1c1c1e)
- **Text**: White/gray hierarchy
- **Accents**: Bright white for primary actions
- **Corners**: Rounded (iOS-style)
- **Shadows**: Subtle depth indicators

### Pure Functions

Core logic is implemented as pure functions for testability:
- `redactor.ts` - Event redaction
- `exportPackBuilder.ts` - Pack generation
- `queryGenerator.ts` - Query templates

---

## Troubleshooting

### App not loading?
```bash
cd C:\Users\somur\Documents\NocSight
npm install
npm run dev
```

### Port in use?
Vite will automatically try the next available port (3001, 3002, etc.)

### Data lost?
Check if localStorage was cleared. Data is browser-specific.

### Export not working?
Ensure a case is active before clicking Export.

---

## Roadmap (v1 Limitations)

Current v1 is client-side only:
- [ ] Log file loading/parsing
- [ ] Virtualized event list with real data
- [ ] Timeline scrubber functionality
- [ ] Pivot and filter UI
- [ ] ZIP export option
- [ ] Backend integration (future)

---

## Support

For issues or feature requests, contact your NOC team lead or development team.

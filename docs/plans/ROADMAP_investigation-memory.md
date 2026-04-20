# Roadmap: Investigation Memory System

**Created:** 2026-03-30
**Author:** Enrique Velazquez
**Status:** Approved concept — ready for phased implementation

---

## Vision

Every completed investigation teaches NocLense something. Today that knowledge disappears when the browser tab closes. This roadmap turns NocLense into a tool that **remembers** — using a dead-simple approach: markdown files.

No database server. No cloud infrastructure. Just structured markdown files that accumulate over time and become the team's living knowledge base.

---

## Architecture: Markdown as Memory

Each completed investigation produces a `.md` file saved to a local directory:

```
~/.noclense/investigations/
├── 2026-03-28_ticket-45231_ccs-registration-charleston.md
├── 2026-03-29_ticket-45299_sip-audio-failure-utc.md
├── 2026-03-30_ticket-45350_fdx-websocket-disconnect.md
└── index.json          ← lightweight search index
```

### Why Markdown?

| Benefit | Details |
|---------|---------|
| **No infrastructure** | No database, no server, no cloud service. Just files on disk. |
| **Human-readable** | Any team member can open and read them directly. |
| **Version-controllable** | Push to a shared git repo and the whole team has the same knowledge base. |
| **Portable** | Copy the folder to a new machine and you have full history. |
| **AI-friendly** | LLMs are great at reading markdown. Feed past investigations directly into context. |
| **Searchable** | Simple text search (grep/ripgrep) or a lightweight JSON index for structured queries. |

### Investigation File Format

```markdown
---
ticket_id: 45231
ticket_subject: "Two-way audio failure at Charleston PSAP"
organization: "Charleston County"
cnc_name: "Charleston"
stations: ["pos-01", "pos-03", "pos-07"]
root_cause_tags: ["noc:root-ccs", "noc:root-sip"]
root_cause: "CCS extension registration failure caused SIP INVITE to route to voicemail instead of agent station"
severity: "high"
resolved_at: "2026-03-28T16:45:00Z"
investigated_by: "Enrique Velazquez"
log_sources: ["Datadog", "Homer SIP", "CCS/PBX"]
duration_minutes: 35
---

# Investigation: Two-way audio failure at Charleston PSAP

## Ticket Summary
Customer reported two-way audio failure on multiple stations at Charleston
PSAP starting at approximately 2:15 PM EST. Calls were connecting but agents
could not hear callers.

## Root Cause
CCS extension registration failed for stations pos-01, pos-03, and pos-07
after a PBX firmware update at 2:10 PM. The registration failure caused
incoming SIP INVITEs to fall through to the voicemail routing rule instead
of being delivered to agent extensions.

## Key Evidence
- [14:10:32] CCS-SDK ERROR: "Failed to monitor call for extensionID: Optional[1017]"
- [14:12:15] Homer SIP: 408 Request Timeout for INVITE to sip:1017@pbx.charleston
- [14:15:00] Datadog: PBXCallMonitoringService restart detected on pos-01
- Call Log CSV: 5 calls with duration 0:00:00 and termination "No Answer" between 14:10-14:30

## Resolution
1. Restarted CCS-SDK service on affected stations
2. Verified extension registration restored via Datadog
3. Confirmed audio working on test call at 16:30

## Closure Note
Issue Summary: Two-way audio failure affecting 3 stations at Charleston PSAP.

Troubleshooting Steps Taken: Reviewed Homer SIP traces (408 timeouts),
CCS-SDK logs (registration failures), Datadog monitoring (PBX service restarts).
Cross-referenced call log CSV showing 5 zero-duration calls in the affected window.

Root Cause: CCS extension registration failure after PBX firmware update
caused SIP routing to bypass agent stations.

## Tags
ccs, sip, registration, audio, pbx, charleston, extension
```

### Search Index (`index.json`)

A lightweight JSON file rebuilt on each save — enables fast structured search without parsing every markdown file:

```json
[
  {
    "file": "2026-03-28_ticket-45231_ccs-registration-charleston.md",
    "ticket_id": 45231,
    "subject": "Two-way audio failure at Charleston PSAP",
    "organization": "Charleston County",
    "root_cause_tags": ["noc:root-ccs", "noc:root-sip"],
    "root_cause": "CCS extension registration failure...",
    "stations": ["pos-01", "pos-03", "pos-07"],
    "cnc_name": "Charleston",
    "resolved_at": "2026-03-28T16:45:00Z",
    "tags": ["ccs", "sip", "registration", "audio", "pbx", "charleston"]
  }
]
```

---

## Phased Rollout

### Phase 0: Save Investigations (Foundation)
**Effort:** Low | **Depends on:** Nothing | **Unlocks:** Everything else

When a user completes Phase 3 (Submit), save the investigation as a markdown file.

**What to build:**
- `src/services/investigationStore.ts` — read/write investigation markdown files + index.json
  - `saveInvestigation(result, ticket, note, logs)` → writes `.md` file + updates index
  - `loadIndex()` → reads `index.json` for fast search
  - `searchInvestigations(keywords)` → searches index by tags, root cause, org, station
  - `loadInvestigation(filename)` → reads full `.md` file
- Storage location:
  - **Electron:** `app.getPath('userData')/investigations/` (e.g., `%APPDATA%/logscrub/investigations/`)
  - **Web/Vercel:** `localStorage` or IndexedDB fallback (JSON-serialized markdown)
- Hook into Phase 3 submit: after posting the Zendesk comment, call `saveInvestigation()`
- Add IPC bridge in `electron/preload.js` for file read/write (Electron only)

**Files to create/modify:**
- New: `src/services/investigationStore.ts`
- New: `electron/investigationFs.js` (Electron file I/O)
- Modify: `electron/preload.js` (expose `window.electronAPI.investigations.*`)
- Modify: `src/components/ai/diagnose/DiagnosePhase3.tsx` (call save on submit)

---

### Phase 1: Search Past Investigations Locally
**Effort:** Medium | **Depends on:** Phase 0 | **Unlocks:** Instant similar-case lookup

Replace (or augment) the Zendesk search in the "Similar Past Tickets" panel with a **local search** against the investigation store. This is faster (no API call), richer (full root cause + resolution), and works offline.

**What to build:**
- In `DiagnoseTab.tsx`, after diagnosis completes:
  1. Search local `index.json` for matching tags/stations/orgs
  2. If local results found, show them in "Past Investigations" panel (higher priority than Zendesk results)
  3. Fall back to Zendesk search for cases not in local store
- New panel variant or section in `SimilarTicketsPanel.tsx`:
  - Local results show: root cause, resolution, key evidence — much richer than Zendesk search results
  - "View Full Investigation" button opens the markdown inline or in a modal

**Search strategy (scored ranking):**
```
Score = (matching root_cause_tags × 3)
      + (matching stations × 2)
      + (matching cnc_name × 2)
      + (matching organization × 1)
      + (matching free-text tags × 1)
```

---

### Phase 2: Feed Past Investigations into AI Context
**Effort:** Medium | **Depends on:** Phase 1 | **Unlocks:** AI that learns from team history

When running `diagnoseLogs()`, include relevant past investigations in the AI prompt context. The AI can then say: *"This looks similar to a CCS registration failure at Charleston on 3/28 — the resolution was restarting CCS-SDK on affected stations."*

**What to build:**
- In `unleashService.ts` → `diagnoseLogs()`:
  1. Before sending the prompt, search local investigations for similar cases
  2. If found, append a new section to the prompt:
     ```
     ## SIMILAR PAST INVESTIGATIONS
     The following past investigations may be relevant:

     ### Investigation: Ticket #45231 (2026-03-28)
     Root Cause: CCS extension registration failure...
     Resolution: Restarted CCS-SDK on affected stations...
     Key Evidence: [timestamps and log lines]

     Use these past cases to inform your diagnosis. If the current issue
     matches a known pattern, reference the past resolution.
     ```
  3. Cap at 2-3 past investigations to stay within token limits (~5KB each)

**This is where the magic happens.** The AI doesn't just correlate logs — it correlates logs AND past team experience.

---

### Phase 3: Shared Team Knowledge via Git
**Effort:** Low | **Depends on:** Phase 0 | **Unlocks:** Team-wide learning

The investigation files are just markdown in a folder. Push that folder to a shared git repo and every team member gets the full history.

**Options:**
- **Option A: Dedicated repo** — `noclense-investigations` repo that agents clone/pull
- **Option B: Submodule** — Add investigations as a git submodule in the NocLense repo
- **Option C: Network share** — Point the investigation store to a shared network path

**What to build:**
- Settings field in `AiSettingsModal.tsx`: "Investigation Store Path" (defaults to local, can point to shared location)
- Optional: "Sync" button that runs `git pull` on the investigations directory
- Optional: Auto-commit on save (`git add . && git commit -m "Investigation: Ticket #45231"`)

---

### Phase 4: Auto-Tag Zendesk Tickets
**Effort:** Low | **Depends on:** Phase 0 | **Unlocks:** Better Zendesk search results for everyone

When saving an investigation, also tag the Zendesk ticket with standardized root cause tags.

**What to build:**
- `src/services/zendeskService.ts` — Add `updateZendeskTicketTags(settings, ticketId, tags)`
- In Phase 3 submit flow: after posting the internal note, call `updateZendeskTicketTags()` with the `root_cause_tags` from the investigation
- Tag taxonomy (standardized):
  ```
  noc:root-ccs, noc:root-sip, noc:root-pbx, noc:root-network,
  noc:root-media, noc:root-fdx, noc:root-config, noc:root-carrier,
  noc:root-workstation, noc:root-unknown
  ```
- AI-generated tag suggestion: add `classifyRootCause()` to `unleashService.ts` that maps the diagnosis root cause to 1-2 tags from the taxonomy

---

### Phase 5: Vector Similarity (Semantic Search)
**Effort:** High | **Depends on:** Phase 0 + embedding service | **Unlocks:** Fuzzy matching

The keyword search in Phase 1 only finds exact matches. Vector embeddings find **semantically similar** cases even when the words are different.

**What to build:**
- On save: embed `root_cause + summary` using `embeddingService.ts` (Gemini `text-embedding-004`)
- Store the embedding vector in `index.json` alongside the metadata
- On search: embed the current diagnosis summary, find top-K by cosine similarity
- **Fallback:** If no Gemini API key, fall back to keyword search (Phase 1 still works)

**Example:** A new ticket says "caller can't hear agent" — vector search finds the past "two-way audio failure" investigation even though the words are different, because the embeddings capture semantic similarity.

---

### Phase 6: Agentic Investigation
**Effort:** Very High | **Depends on:** Phase 0 + Phase 2 | **Unlocks:** Autonomous research

The agent loop from our ideas doc, now powered by local investigation memory:

1. Agent receives a ticket
2. Searches local investigations for similar cases
3. If found: uses past resolution as a starting hypothesis
4. Queries Datadog/Zendesk to validate the hypothesis against current data
5. If confirmed: generates resolution note referencing the past case
6. If not: continues autonomous investigation (search more tickets, pull more logs)

This is the end-state vision from Leandro's transcript: *"An agent that spawns other agents and actually investigates until it figures it out."*

---

## Cost & Infrastructure Summary

| Phase | Infrastructure Needed | API Calls | Storage |
|-------|----------------------|-----------|---------|
| **0** | None (local files) | 0 | ~5KB per investigation |
| **1** | None (local search) | 0 | index.json in memory |
| **2** | None (prompt injection) | +0 (uses existing diagnosis call) | ~5KB context per similar case |
| **3** | Git repo (free) | 0 | Shared folder |
| **4** | None | +1 Zendesk PUT per investigation | 0 |
| **5** | Gemini API key | +1 embedding call per investigation | ~3KB vector per investigation |
| **6** | None new | +5-10 API calls per agent run | 0 |

**Total new infrastructure: zero.** Everything runs on local files + existing APIs.

After 100 investigations, the store is ~500KB of markdown. After 1,000 investigations, it's ~5MB. This scales trivially.

---

## Timeline Suggestion

| Phase | When | Prerequisite |
|-------|------|-------------|
| **0** (Save investigations) | Next session | None — start here |
| **1** (Local search) | Same session as Phase 0 | Phase 0 |
| **2** (AI context injection) | Following session | Phase 1 + a few saved investigations to test with |
| **3** (Git sharing) | When team is ready | Phase 0 + team buy-in |
| **4** (Zendesk tagging) | When standardized with Danielle | Phase 0 + closure note template |
| **5** (Vector search) | When Gemini API key available | Phase 0 + API key |
| **6** (Agentic) | After Phases 0-2 are proven | Phase 2 + significant investigation history |

---

## Open Questions

1. **Electron vs Web:** In Electron, we write to the filesystem. On Vercel/web, we'd need IndexedDB or a remote store. Should we build for Electron-first and add web support later?
2. **Who owns the shared repo?** If we go with git-based sharing, who manages the repo? Does it live under the Carbyne GitHub org?
3. **Privacy:** Are investigation files sensitive? Do they contain customer PII that shouldn't be in a shared repo? May need to redact customer names/phone numbers before saving.
4. **Danielle's template:** Phase 4 (Zendesk tagging) works best when closure notes are standardized. When can we get her template finalized?
5. **Gemini API key:** Phase 5 needs it. Does the team have one, or should we use Unleashed for embeddings if they support it?

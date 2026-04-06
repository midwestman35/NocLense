# NocLense Changelog — 3/30/2026 Session

## Bug Fixes
- **Empty log rows** — Blank entries now show `[Empty entry — source]` instead of invisible rows
- **Source filter dropdown** — Fixed: wasn't appearing when multiple log sources were loaded. Parser now tags every entry with a source label
- **Datadog station discovery** — Added retry with exponential backoff on rate limits, 15-min cache, better error messages. Confirmed working
- **Unleash API 400 error** — Fixed `"Assistant must be of type general"` by skipping the assistant ID on custom-prompt calls
- **Modal closing on text select** — Investigation Setup Modal no longer closes when highlighting text inside it
- **Error boundary** — Added "Try Again" soft reset option alongside hard reload

## UI Improvements
- **Case button removed** — Redundant; users clear workspace and start from main screen
- **Resizable AI sidebar** — Drag the left edge to resize (280px–65vw). Width persists across sessions

## AI Improvements
- **Better log correlation** — Each log line now tagged with `[Source]` (Datadog, Homer SIP, CCS/PBX, etc.) in AI context. Added explicit cross-referencing instruction
- **Closure note template** — Say "fill out the closing note" or "closure note" in chat and the AI auto-uses the standardized template (Issue Summary / Troubleshooting Steps / Root Cause / closing boilerplate)

## New Features
- **Similar Past Tickets** — After diagnosis, Phase 2 shows past closed tickets matching the current issue (searches Zendesk + Confluence in parallel)
- **Confluence Investigation Memory** — Every completed investigation auto-saves to Confluence (Operations > NOC Investigations). Builds a searchable team knowledge base over time
- **Confluence link on submit** — Success screen shows link to the saved Confluence page alongside the Zendesk link

## Documentation
- Implementation plan (13 action items from walkthrough)
- Ideas doc (auto-tag learning loop + agentic investigation concepts)
- Investigation memory roadmap (6-phase plan)
- Full usage guide

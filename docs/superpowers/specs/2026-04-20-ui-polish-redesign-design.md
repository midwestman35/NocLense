# NocLense UI Polish Redesign — Design Spec

**Date:** 2026-04-20
**Status:** Draft — pending Codex review
**Author:** Enrique Velazquez (with Claude)
**Scope:** UI/UX polish of existing Electron/React app with AI-first investigation flow
**Parked projects:** NOC workbench vision expansion (#2), Tauri/Rust packaging (#3) — Phase 7

---

## 1. Context

NocLense is out of production due to a Vercel incident over the weekend. With maintenance pressure off, this is a dedicated polish pass on the existing Phase Rooms + Workspace Cards shell.

The user is a Network Engineer in SaaS Operations on the Carbyne APEX team (NG911 platform), operating as NOC support. Daily workflows include Zendesk ticket triage, Jira escalations to R&D, Confluence context, Datadog monitoring, Slack sweeps, and a canonical 6-stage investigation workflow documented in `DailyNOC/investigate.txt`.

**Primary pain points to address (ranked):**
1. **Sterile** — looks fine but lacks personality; feels like a prototype.
2. **Crowded** — Investigate Room's six cards don't breathe.
3. **Sluggish** (runner-up) — loading states are generic spinners; user can't tell if ops are in flight.

**Non-negotiable constraints:**
- Performance: must not crash or stutter under 100k+ log entries. Happy-to-use daily AT THE CONDITION of stability.
- Windows-first (Electron on Windows) — macOS/web are secondary.
- `prefers-reduced-motion: reduce` fully respected.

---

## 2. Direction

**Personality: "Cold panel with live readouts."** Synthesis of The Instrument (Linear/Bloomberg Terminal: dense, mono, confident, zero decoration) and The Cockpit (Grafana/observability: surface depth, disciplined glow on live signals). Built on the existing greenhouse green palette — no rebrand.

**Motion identity: TUI/terminal tradition.** Braille spinners (`⣾⣷⣯⣟⡿⢿⣻⣽`), block fills, dot cascades, ASCII progress bars. Character-level typewriter reveal + breathing wave on loading labels. Universal pool of 20 playful phrases (`thinking…`, `cooking…`, `grepping…`, `brb…`). CSS `content` cycling + `steps()` easing — zero JS per-frame work.

**Approach: Extract-then-propagate (B/C mix).** Build the design system *through* the showpiece surface (AI/Diagnose), extracting tokens as they're needed; then propagate outward to Log Stream and Evidence; broad pass last. Avoids both the inconsistency risk of deep-first and the over-engineering risk of system-first.

**Workflow reframe: AI-first, Log Stream supplemental.** Logs should not appear in Log Stream until Unleashed AI has ingested, correlated, and produced a human-readable canonical output with citations back to specific log lines. Log Stream is the citation target and deep-dive surface, not the primary entry point.

---

## 3. Section A — Token system extensions

### 3.1 Kept from current `tokens.css`
- **Greenhouse palette** (`--green-house-50 → 950`) — unchanged. Anchor identity.
- **Radius scale** (`4/6/8/12/16`) — enforced concentrically (outer = inner + padding).
- **Typography tokens** (DM Sans + JetBrains Mono, size scale) — unchanged.
- **Existing motion tokens** (`--duration-fast/normal/slow/enter`, `--ease-default/out/in`) — kept, additional tokens added.

### 3.2 New — Glow tier system

Disciplined spending of green glow. Replaces ambient glow-everywhere.

| Tier | Visual | Semantic |
|---|---|---|
| `idle` | No glow, muted border | Default card state |
| `ready` | Subtle glow (4px) | Surface connected and operational |
| `live` | Pulsing glow (10px, 1.8s ease) | Data streaming in right now |
| `alert` | Red glow (12px) | Failed action or error needing attention |

Rules:
- Only ONE card per room may be in `live` state at a time.
- `live` auto-decays to `ready` after 3s of no data.
- `alert` persists until acknowledged or resolved.

### 3.3 New — Shadow scale

Semantic elevation, replaces generic `--shadow-sm/md/lg`.

- `--shadow-flat` — no shadow, 1px border
- `--shadow-raised` — 1px + 2px layered (default card elevation)
- `--shadow-floating` — 4px + 12px (modal, hover-lift)
- `--shadow-glow-live` — green multi-layer glow (live state)
- `--shadow-glow-error` — red multi-layer glow (alert state)

### 3.4 New — TUI spinner glyph family

Four CSS-only spinners. Zero dependencies. CSS `content` cycling with `animation-timing-function: steps()`. Each has a specific semantic use.

| Glyph | Frames | Use |
|---|---|---|
| `braille` | `⣾⣷⣯⣟⡿⢿⣻⣽` | Default thinking indicator. AI streaming, query in flight. |
| `block` | `▏▎▍▌▋▊▉█` | Bounded progress, unknown ETA. Single-item loading. |
| `dots` | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Secondary/quiet. Inline next to a label. |
| `progress` | `[█░░░░░░░]` → `[████████]` | Known ETA. File parse, streamed chunk ingest. |

### 3.5 New — Motion tokens

```css
/* CSS custom properties (used across the app) */
--duration-interrupt: 120ms;      /* hover, focus, active state */
--duration-scale-press: 150ms;    /* button scale-on-press */
--duration-stagger-step: 40ms;    /* enter stagger between items */
--duration-exit: 160ms;           /* exit, faster than enter */
--duration-spinner-step: 100ms;   /* TUI glyph cycle (multiplied by frame count) */
--ease-tui-step-8: steps(8, end);       /* braille, block — 8-frame glyphs */
--ease-tui-step-10: steps(10, end);     /* dots — 10-frame glyph */
--ease-enter-out: cubic-bezier(0.2,0,0,1);
--ease-exit-in:  cubic-bezier(0.4,0,1,1);
```

Motion library tokens (not CSS; used as Motion `transition` props):

```ts
export const SPRING_SOFT = { type: 'spring', duration: 0.3, bounce: 0 } as const;
```

### 3.6 New — Cute-label hook

Universal pool of 20 phrases cycled while any operation is loading:

```
thinking…  working…  cooking…  brewing…  crunching…
parsing…  indexing…  untangling…  digging in…  cross-referencing…
hmm…  assembling…  grepping…  unpacking…  mulling it over…
chewing on it…  sifting…  tracing…  puzzling it out…  brb…
```

`useCuteLoadingLabel(isLoading: boolean)` hook:
- Shuffles pool on mount
- Cycles every 2500ms while loading
- Returns current phrase
- Respects `prefers-reduced-motion` (picks one phrase, stays)

Character-level animation:
- **Typewriter reveal on phrase change** — each char fades in with 25ms stagger, 180ms duration, `translateY(3px) → 0`.
- **Breathing wave while idle** — each char opacity oscillates 0.65↔1.0 on 1.8s cycle with 60ms phase offset.

Both use `opacity` and `transform` only — zero layout cost.

---

## 4. Section B — Motion and loading choreography

### 4.1 Interruption rule
- **Interactive state** (hover, focus, active, expand) → CSS `transition` on specific properties. Interruptible mid-flight.
- **Staged sequence** (card enter, phase transition) → CSS `@keyframes` or Motion's `initial`/`animate`. Runs once.
- **Hard rule:** never use `@keyframes` for interactive state; never use `transition: all`.

### 4.2 Enter animations (split + stagger)
- Never animate a single container; split by semantic unit.
- `translateY(4px) + opacity(0→1)` for text/inline; `scale(0.98) + opacity(0→1)` for cards.
- `--duration-stagger-step` (40ms) between items. Max 12 items; beyond that, instant display.
- `initial={false}` on top-level AnimatePresence; room transitions animate on nav, not page load.

### 4.3 Exit animations (subtle)
- `--duration-exit` (160ms) — deliberately faster than enter.
- `translateY(2px) + opacity(1→0)`. No height collapse, no scale, no rotation.
- AnimatePresence `mode="popLayout"` prevents sibling reflow mid-exit.

### 4.4 Interactive state
- Scale on press: `active:scale-[0.96]` everywhere. Never below 0.95.
- Hover: specific properties only (`transform`, `opacity`, `border-color`, `background-color`).
- Hit area: minimum 40×40px; extend via pseudo-element if visible element is smaller.

### 4.5 Loading vocabulary per operation

| Operation | Glyph | Duration | Treatment |
|---|---|---|---|
| File parse, < 10 MB | — | < 1s | Skeleton shimmer only |
| File parse, 10–200 MB | `progress` | 1–30s | Inline on destination card; % + byte count |
| File parse, 200 MB+ (IndexedDB) | `progress` | 30s–min | Dedicated overlay; chunks, rows/sec, ETA |
| AI Diagnose full analysis | `braille` | 15–30s | Braille + cute label; phase dots; stream response |
| AI chat turn | `braille` | 1–10s | Inline braille; disappears on first token |
| Datadog query | `dots` | 1–5s | Dots in card header next to query label |
| Zendesk/Jira lookup | `dots` | < 2s | Dots inline; fades to result list |
| Evidence export ZIP | `block` | 2–8s | Block next to current step label; modal-anchored |
| Connector heartbeat | live-dot | ambient | Pulsing dot on card accent; decays to ready after 3s |

### 4.6 Text wrapping (cheap universal fix)
- `text-wrap: balance` on every heading, card title, modal title, empty-state message.
- `text-wrap: pretty` on every body paragraph, AI response, description.
- `font-variant-numeric: tabular-nums` at `:root` for mono font; applied to every counter, timestamp, byte size, duration, percentage, log count, ETA.

### 4.7 Performance gates (non-negotiable)
- **No animations on items inside virtualized lists.** Row-level animation creates jank during scroll. Animations live on the list container.
- **`will-change`** added on animation start, removed on `transitionend`/`animationend`. Never `will-change: all`.
- **Every motion branch** has a `prefers-reduced-motion: reduce` fallback → instant.
- **Spinners** via CSS `content` + `steps()`. Zero `setInterval` per-frame.
- **Measurement gate:** any new animated surface must be measured under 100k-row load before shipping; < 55 fps means the animation is wrong.

---

## 5. Section C — Trio deep-surface specs (AI-first flow)

### 5.1 Canonical investigation format (shared data model)

The `investigate.txt` structure becomes the app's shared data model. One shape across AI output, Evidence items, and `.noclense` exports.

**Structure:**
- **Context Block** — Customer, Site, CNC, Region, Version, Event ID, Reported (verbatim)
- **Prior Art** — signal rows for Jira, Historical tickets (local folder), Zendesk history, Slack, Datadog, each with clickable source link
- **Hypotheses** (ranked 1–3, expandable) — rank, title, supporting evidence, evidence-to-confirm, evidence-to-rule-out, status (CONFIRMED/RULED OUT/INCONCLUSIVE)
- **Collection Guidance** — sequential cards per evidence needed; "do first" / "if X fails" badges; copy-command buttons
- **Analysis** — per-hypothesis status update with supporting evidence and citations
- **Action** — recommendation (Jira / Test script / Resolve)

**Source link patterns:**
- Zendesk: `https://carbyne.zendesk.com/agent/tickets/[ID]`
- Jira: `https://reporty.atlassian.net/browse/[REP-XXXXX]`
- Slack: `https://app.slack.com/client/[workspace]/[channel_id]`
- Local folder: no link, rendered "local" in muted text
- All links open in new tab.

**Citation format:**
- Log line: `log.txt:14382` (filename + line number)
- Datadog time window: `dd:14:29-14:52`
- PCAP file: `CA6f9b25fb.pcap`

### 5.2 AI Assistant · Diagnose (primary triage + rendering)

- **Stage bar** — 6 stages matching `investigate.txt` exactly (`ingest / pattern / hypothesize / collect / analyze / act`). Active stage has `glow-ready` shadow; done phases solid green.
- **Investigate URL entry** — prompt at top accepts Zendesk URL; kicks off Stage 0–2 pipeline; cute label during ~30s wait.
- **Canonical block renderer** — Context Block, Prior Art, Hypotheses, Collection Guidance, Analysis, Action. Every block pinnable to Evidence via `Ctrl+P` or pin button.
- **Streaming response** — card border switches `flat → glow-live` while streaming; braille + token count stays inline until first character, then morphs to `streaming-indicator` pill.
- **Citations clickable** — every `log.txt:14382` anchor links to Log Stream row; `citation-jump` choreography highlights the target.
- **Log attach zone** — drop zone at bottom of Collection Guidance; dropping files triggers Log Stream ingestion; Stage 4 analysis auto-kicks-off.
- **Chat refinement** — below rendered report; follow-up questions reference existing blocks with citations.
- **Action bar** — Stage 5 routes to existing DailyNOC skills: Res-note template, Jira creation template, test-script template.

**Keyboard:**
- `Ctrl+P` — pin currently-focused block to Evidence
- `Ctrl+↑/↓` — navigate phase history
- `Ctrl+K` — command palette (jump to phase, rerun diagnosis, export state)

### 5.3 Log Stream (supplemental + citation target)

Opens empty and quiet. Lights up when logs are attached. Must handle 100k+ entries at 60fps scroll.

**Parser requirements:**
- **Operator Client format** — parses `[LEVEL] [M/D/YYYY, H:MM:SS AM/PM,MS] [Component]: message` + multi-line JSON body. One logical entry = one row. JSON body folded by default, syntax-highlighted on expand. `traceId`, `cpeStation.id`, `cpeUser.cncID`, `callId` extracted from JSON body for correlation (not regex from text).
- **Datadog CSV extract** — `Date,Host,Service,Content`.
- **Homer SIP JSON** — existing parser retained.
- **Call log PCAP** — short term: user runs wireshark/tshark locally to pre-convert. Long term: bundled in standalone app (Phase 7 Tauri evaluation).
- **Carbyne Event PDF** — extract and render text inline via `pdfjs-dist` (already in `package.json`).

**Multi-format tabs** — `log.txt`, `extract.csv`, PCAP files, `event.txt`, Carbyne Event PDF — each as a tab above the row grid.

**Citation-jump choreography** — click a citation in AI → Log Stream: smooth scroll to row (300ms), row highlight fade-in (150ms), "⟵ jumped from Hx" chip appears in header with 40ms stagger.

**Row rendering** — 35px row, virtualized via `@tanstack/react-virtual`. Level-colored 2px left border on ERR/WARN rows (static, painted on — no animation). Hover = `background-color` transition only, 120ms. Click → expands JSON body inline (off-screen `content-visibility: auto`).

**Parse overlay** — dedicated panel at top of card body during parse. Progress glyph + cute label + ETA + chunks/sec. Collapses (`height → 0`, 200ms) on completion.

**Filter chips** — traceId, callId, station, level, time window. Applied filters shown as removable chips; populated from AI citations on citation-jump.

**Live mode indicator** — pulsing `live` dot + "LIVE · DATADOG" label in card header when Datadog streaming is active. Auto-decays to `ready` after 3s silence.

**Performance gates (critical path):**
- No animations on rows, no `will-change` on rows, no transforms.
- Hover: only `background-color` change.
- Large file (52MB+): streams to IndexedDB as today; row count stays manageable because JSON bodies are folded into single entries.
- Measurement: must scroll at ≥ 55 fps on 100k rows before shipping.

### 5.4 Evidence (block-aware working memory)

- **Block-aware pins** — Context Block, Hypothesis card, Prior Art row, raw log, AI finding, engineer note. Each type renders distinctly in Evidence with provenance metadata.
- **Pin-in animation** — new items enter at top with `translateY(6px) + scale(0.95) → (0, 1)`, 250ms, `ease-enter-out`.
- **Unpin-out animation** — `translateY(2px) + opacity → 0`, 160ms. popLayout mode prevents sibling reflow.
- **Hover lift** — `translateY(-1px) + raised→floating shadow`, 150ms.
- **Drag reorder** — drag handle (`⋮⋮`) appears on hover; native HTML5 drag API; drop settles in 180ms.
- **Note edit** — click a NOTE item → expands to textarea with `glow-ready` border; blur saves and collapses.
- **Empty state** — single muted glyph (`∅` or `⌗`), text-wrap balance title ("Nothing pinned yet."), text-wrap pretty body ("Pin items from Log Stream with Ctrl+P, or from AI findings directly.").
- **Bundle size** — tabular-nums in header; subtle pulse on badge at >100 KB increments.

**Export templates** — Evidence set drives:
- `Res-note.txt` format (Issue summary / Root cause / Resolution / Linked Jira / Customer action / Status)
- `JiraCreation.txt` format (Summary / Description / Priority / Labels), pre-filled from Context Block + H1-confirmed hypothesis
- `.noclense` ZIP — canonical JSON + raw logs + AI transcript + PDFs + PCAPs; resumable in another NocLense session

### 5.5 Resizable surfaces

Every card in Investigate Room is resizable via `react-resizable-panels`. Sizes persist per-user per-room in `localStorage`.

- **Min sizes** per card prevent collapse-to-useless.
- **Resize handles** — 2px gap widens to 4px on hover with green tint; cursor changes.
- **Keyboard** — Tab to focus handle; arrow keys adjust by 20px; Shift+arrow by 80px.
- **Double-click reset** — resets adjacent cards to equal share.
- **Room settings** — "Reset layout to default" button.

---

## 6. Section D — Broad pass, integration, validation, roadmap

### 6.1 Broad pass (outside the trio)

- **Import Room** — single centered drop zone; fills on hover with subtle scale + `glow-ready`; cute label during parse; URL paste kicks off investigate flow; `/` prefix opens command palette.
- **Submit Room** — canonical fields matching `Res-note.txt`; pre-filled from Evidence; one-click Copy-to-Zendesk, Create-REP, Export-.noclense.
- **Correlation Graph card** — one node per extracted correlation ID; edges for co-occurrence; motion only on layout compute.
- **Datadog Live card** — `glow-live` while streaming; decays to `ready`.
- **Similar Tickets card** — compact list from local folder + Zendesk history (future: case library).
- **PhaseHeader + PhaseDots** — apply new tokens, tabular-nums on ticket ID, text-wrap on customer names.

### 6.2 Cross-surface motion choreographies

Four named patterns that recur across the app:

| Pattern | Origin → Target | Choreography |
|---|---|---|
| **citation-jump** | AI → Log Stream | Scroll-to-row (300ms) + highlight fade-in (150ms) + "⟵ jumped from Hx" chip with 40ms stagger |
| **evidence-yank** | Any canonical block → Evidence | Block scale to 0.98 (120ms) + small glyph flies along cubic Bézier to Evidence card header + pulse-expand on arrival |
| **log-anchor** | Log Stream row → Evidence | Row clones into floating element, translates toward Evidence, scale-in on drop |
| **return-to-AI** | Evidence hypothesis → AI | AI scrolls to block, highlights with `glow-ready` for 500ms, fades |

All use Motion (framer-motion). All collapse to instant under `prefers-reduced-motion: reduce`.

### 6.3 Case library (Phase 6, long-term roadmap)

**Not part of the polish pass.** The polish pass builds the foundation — the canonical format is the case-file shape.

- **Source:** Each completed NocLense investigation exports a `.noclense` file.
- **Store:** Embeddings of H1-confirmed error signatures (H1 title + confirmed evidence + error message + stack top-5 frames) indexed in IndexedDB; optional shared team folder.
- **Retrieve:** New investigation starts → nearest matches surfaced in Similar Tickets card before Unleash hypothesizes.
- **Feed mechanism:** Drop `.noclense` files into a watched folder; NocLense bulk-indexes on change. **Bulk-import every existing ticket in `DailyNOC/` on first run** — the onboarding killer feature.
- **Privacy:** All embeddings local by default. Shared folder is opt-in per-user.

### 6.4 Validation bars (per phase)

| Metric | How measured | Target |
|---|---|---|
| Log Stream scroll FPS | 100k rows, 10s continuous scroll, `Performance.now()` sampling | ≥ 55 fps |
| File parse, 50MB | Parse MACC `log.backup1.txt`, drop-to-first-row-visible | ≤ 8 s |
| File parse, 200MB+ | Synthetic 250MB via IndexedDB streaming, end-to-end | ≤ 45 s |
| Citation-jump latency | Click citation → row highlighted + in viewport | ≤ 250 ms |
| AI Diagnose → first char | Submit URL → first streamed char | ≤ 3 s |
| Evidence export | 20-item evidence set to ZIP download | ≤ 2 s |
| Memory on 100k-row load | Chrome DevTools snapshot after 10min idle | ≤ 500 MB |
| Reduced-motion compliance | Every animated surface collapses to instant | 100% |
| Subjective "feels right" | Full shift use with no regressions | Qualitative signoff |

### 6.5 Implementation phases

Each phase completes when validation bar is clear AND Codex has reviewed.

| # | Scope | Gate |
|---|---|---|
| **01** | Tokens + AI/Diagnose deep polish (canonical renderer, streaming, stage bar, pin-to-evidence) | Codex |
| **02** | Log Stream deep polish (OC parser, JSON folding, citation-jump, multi-format tabs, parse overlay) | Codex |
| **03** | Evidence deep polish (block-aware pins, drag reorder, export templates, .noclense ZIP) | Codex |
| **04** | Resizable surfaces + Import Room + Submit Room | Codex |
| **05** | Broad pass (rest of app) + cross-surface motion choreographies + reduced-motion audit | Codex |
| **06** | *(future)* Case library learning loop — separate spec after 05 ships |
| **07** | *(future)* Standalone app packaging (Tauri evaluation memo) — separate spec |

### 6.6 Standalone app packaging — reopened project #3

Previously parked; reopened implicitly by (1) weekend Vercel incident, (2) API keys in build-time bundles, (3) wireshark/tshark local dependency.

**Recommendation:** Don't block polish on this. Polish work lives in `src/` and ports to any shell. Ship Phases 01–05 first. Do a Tauri evaluation memo post-Phase-05 with concrete numbers: bundle size, memory, cold start, file-system access, keychain integration for API keys, native PCAP parsing. Decide then.

**Exception:** If the Vercel security incident is severe enough to prevent any production deployment, flip the order — do Tauri first, polish after.

---

## 7. Non-goals (explicit)

To prevent scope creep:

- **Not rebuilding the workflow.** The 6-stage investigate.txt workflow is canonical; the UI renders it, it doesn't replace it.
- **Not expanding beyond log analysis.** Vision #2 (NOC workbench covering all of Zendesk/Jira/Slack/Datadog/Teams/Confluence directly in-app) is a separate project.
- **Not changing AI provider.** Unleashed AI only. `src/services/providers/` is unused legacy (per CLAUDE.md).
- **Not rebranding.** Greenhouse palette stays. "NocLense" name stays. Logo unchanged.
- **Not rewriting parser.** Existing `parser.ts` gets extended for OC format; streaming + IndexedDB paths are kept.
- **Not adding multi-user/sync.** Per-user localStorage only. No accounts, no cloud sync.

---

## 8. Open details to resolve during implementation

These are intentionally left for the per-phase implementation rather than the spec:

- Exact motion timing values for cross-surface choreographies (Phase 05 tuning).
- Whether to use `framer-motion` or existing `motion` package for a specific surface (Phase 01 decision).
- Keyboard shortcut conflicts with OS/browser defaults — audit pass in Phase 04.
- Specific color for Carbyne Event PDF extracted-text link treatment — Phase 02.
- How deeply to flatten nested JSON when "expand all" is triggered — Phase 02.
- Share semantics for team case library (Phase 06 scope, not this spec).

---

## 9. Success criteria

The redesign is successful when:

1. All nine validation bars in 6.4 are cleared.
2. User can complete a full NOC shift using only NocLense for investigation work (no fallback to Notepad++).
3. An investigation from URL-paste to `.noclense` export follows the canonical structure without format adapters.
4. Reduced-motion users have a usable experience indistinguishable from the animated one functionally.
5. User's subjective report after one week of daily use: "happy to use, not tolerating."

---

**End of spec. Hard stop here. Ready for `/codex:review`.**

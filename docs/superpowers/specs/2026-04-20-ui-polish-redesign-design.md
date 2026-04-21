# NocLense UI Polish Redesign — Design Spec

**Date:** 2026-04-20
**Status:** Draft v2 — post-Codex review revisions applied
**Author:** Enrique Velazquez (with Claude)
**Scope:** UI/UX polish of existing Electron/React app with AI-first investigation flow
**Parked projects:** NOC workbench vision expansion (#2), Tauri/Rust packaging (#3) — Phase 7

**v2 changelog:** Added Phase 00 (contracts); split Phase 01 into 01a/01b/01c; deferred resizable surfaces to roadmap; harmonized FPS gates; defined canonical schema, citation model, glow state machine, motion ownership, and loading state chart; expanded non-goals; tightened validation bar targets.

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

**Motion identity: TUI/terminal tradition.** Braille spinners (`⣾⣷⣯⣟⡿⢿⣻⣽`), block fills, dot cascades, ASCII progress bars. Character-level typewriter reveal + breathing wave on loading labels. Universal pool of 20 playful phrases (`thinking…`, `cooking…`, `grepping…`, `brb…`). CSS `content` cycling + `steps()` easing — zero JS per-frame work for the glyph itself.

**Approach: Extract-then-propagate (B/C mix).** Build the design system *through* the showpiece surface (AI/Diagnose), extracting tokens as they're needed; then propagate outward to Log Stream and Evidence; broad pass last. Avoids both the inconsistency risk of deep-first and the over-engineering risk of system-first.

**Workflow reframe: AI-first, Log Stream supplemental.** Logs should not appear in Log Stream until Unleashed AI has ingested, correlated, and produced a human-readable canonical output with citations back to specific log lines. Log Stream is the citation target and deep-dive surface, not the primary entry point.

---

## 3. Section A — Token system extensions

### 3.1 Kept from current `tokens.css`
- **Greenhouse palette** (`--green-house-50 → 950`) — unchanged. Anchor identity.
- **Typography tokens** (DM Sans + JetBrains Mono, size scale) — unchanged.
- **Existing motion tokens** (`--duration-fast/normal/slow/enter`, `--ease-default/out/in`) — kept, additional tokens added.
- **Radius scale baseline caveat:** the published scale (`4/6/8/12/16`) does not exactly match what's applied to the active shell today. Phase 01a reconciles the tokens with what's rendered and publishes the final scale before any new component consumes them.

### 3.2 Token migration inventory

To prevent two token systems running in parallel, Phase 01a produces and commits this table before introducing any new token:

| Current token (in code) | Replacement (new) | Deprecated? | First phase consuming |
|---|---|---|---|
| `--shadow-sm / --shadow-md / --shadow-lg` | `--shadow-flat / --shadow-raised / --shadow-floating / --shadow-glow-live / --shadow-glow-error` | Yes, after 01a | 01a (global sweep) |
| Card accent dot color (hardcoded) | `--glow-{idle,ready,live,alert}` | Yes | 01a |
| `--duration-fast/normal/slow/enter` | kept; add `--duration-interrupt / --duration-scale-press / --duration-stagger-step / --duration-exit / --duration-spinner-step` | No | 01a |
| Ad-hoc keyframes in component CSS | `@keyframes` centralized in `tokens.css` | Yes | 01a (codemod) |

Primitive tokens (colors, radii, durations, eases) remain distinct from **state tokens** (`glow-live`, `shadow-glow-error`). State tokens compose primitives; they never alias or redefine them.

### 3.3 New — Glow tier system (state machine)

Disciplined spending of green glow. Replaces ambient glow-everywhere.

| Tier | Visual | Trigger | Auto-decay |
|---|---|---|---|
| `idle` | No glow, muted border | Default | — |
| `ready` | Subtle glow (4px) | Surface connected and operational | — |
| `live` | Pulsing glow (10px, 1.8s ease) | Data arriving right now | → `ready` after 3s of no data |
| `alert` | Red glow (12px) | Failed action or error | Until acknowledged or resolved |

**Live-state arbitration (per room):**

A room may contain multiple surfaces that could be "live" simultaneously (AI stream, Datadog stream, connector heartbeat, parse overlay). Only **one** surface renders as `live` at a time. Priority, highest wins:

1. `alert` on any surface (red always wins)
2. Parse overlay active (Import / Investigate)
3. AI response streaming / generating
4. Datadog stream with fresh data (< 3s)
5. Connector heartbeat (ambient, lowest)

Lower-priority surfaces render as `ready` (solid green, no pulse) while a higher-priority surface is `live`. The event source is a room-scoped context (`useRoomLiveState`) that each surface subscribes to and publishes into. Debounce: 300ms between priority swaps to avoid flicker.

### 3.4 New — Shadow scale

Semantic elevation, replaces generic `--shadow-sm/md/lg`.

- `--shadow-flat` — no shadow, 1px border
- `--shadow-raised` — 1px + 2px layered (default card elevation)
- `--shadow-floating` — 4px + 12px (modal, hover-lift)
- `--shadow-glow-live` — green multi-layer glow (live state)
- `--shadow-glow-error` — red multi-layer glow (alert state)

### 3.5 New — TUI spinner glyph family

Four CSS-only spinners. Zero per-frame JS. CSS `content` cycling with `animation-timing-function: steps()`. Each has a specific semantic use.

| Glyph | Frames | Use |
|---|---|---|
| `braille` | `⣾⣷⣯⣟⡿⢿⣻⣽` | Default thinking indicator. AI streaming, query in flight. |
| `block` | `▏▎▍▌▋▊▉█` | Bounded progress, unknown ETA. Single-item loading. |
| `dots` | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Secondary/quiet. Inline next to a label. |
| `progress` | `[█░░░░░░░]` → `[████████]` | Known ETA. File parse, streamed chunk ingest. |

**Accessibility + Windows font fallback:**
- Every spinner is paired with a visually-hidden `role="status"` label (`"Loading…"`, `"Parsing…"`, etc.) — screen readers never receive the glyph itself.
- Glyph rendering fallback: if the OS cannot render braille (`U+2800–U+28FF`) or block characters (`U+2580–U+259F`), CSS `@supports not (font-variant-emoji: text)` branches to an ASCII fallback (`. .. ... ....`). Verified on Windows default font stack.

### 3.6 New — Motion tokens

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

### 3.7 New — Cute-label hook (deterministic)

Universal pool of 20 phrases cycled while any operation is loading:

```
thinking…  working…  cooking…  brewing…  crunching…
parsing…  indexing…  untangling…  digging in…  cross-referencing…
hmm…  assembling…  grepping…  unpacking…  mulling it over…
chewing on it…  sifting…  tracing…  puzzling it out…  brb…
```

`useCuteLoadingLabel(operation: OperationKind, isLoading: boolean)` hook:
- **Deterministic ordering** per `OperationKind` (e.g., `"ai-diagnose"`, `"file-parse"`, `"datadog-query"`) via a stable hash seed. Tests and reloads produce the same sequence; concurrent loads of different operations produce independent sequences.
- Cycles every 2500ms while loading.
- Respects `prefers-reduced-motion` — picks the operation-specific phrase #0 and stays.
- Always paired with a `role="status"` announcement of the operation ("Parsing log file…"), not the cute phrase.

Character-level animation (on phrase change):
- **Typewriter reveal** — each char fades in with 25ms stagger, 180ms duration, `translateY(3px) → 0`.
- **Breathing wave while steady** — each char opacity oscillates 0.65↔1.0 on 1.8s cycle with 60ms phase offset.

Both use `opacity` and `transform` only — zero layout cost.

---

## 4. Section B — Motion and loading choreography

### 4.1 Motion library ownership

Per existing CLAUDE.md conventions plus new cross-surface needs:

| Interaction type | Library | Rationale |
|---|---|---|
| CSS transitions on state change (hover, focus, expand, color, background) | **CSS** only | Interruptible, cheap, no bundle cost |
| Component mount / unmount / AnimatePresence | **Motion** (`motion` v12) | Existing convention, handles exit timing |
| Stagger effect on a list (enter), timeline orchestration | **anime.js** v4 | Existing convention, per CLAUDE.md hook set |
| Value tweening for non-DOM numbers (counters, progress) | **anime.js** v4 | Matches existing `useAnimeValue` pattern |
| Cross-surface choreography (citation-jump pulse/highlight) | **CSS** (container-level) | Deferred Motion usage — see §6.2 |
| Spinners, glyph cycles | **CSS** `content` + `steps()` | Zero JS per-frame |
| Typewriter reveal, breathing wave | **CSS** `@keyframes` + `animation-delay` | Pre-computed stagger via CSS custom props |

Phase 05 may introduce Motion for one named choreography only (`citation-jump` container pulse). DOM-flight clones (`evidence-yank`, `log-anchor`) are **not** in scope for the polish pass; see §6.2 for the pulse/highlight alternative.

### 4.2 Interruption rule
- **Interactive state** (hover, focus, active, expand) → CSS `transition` on specific properties. Interruptible mid-flight.
- **Staged sequence** (card enter, phase transition) → CSS `@keyframes` or Motion's `initial`/`animate`. Runs once.
- **Hard rule:** never use `@keyframes` for interactive state; never use `transition: all`.

### 4.3 Enter animations (split + stagger)
- Never animate a single container; split by semantic unit.
- `translateY(4px) + opacity(0→1)` for text/inline; `scale(0.98) + opacity(0→1)` for cards.
- `--duration-stagger-step` (40ms) between items. Max 12 items; beyond that, instant display.
- `initial={false}` on top-level AnimatePresence; room transitions animate on nav, not page load.

### 4.4 Exit animations (subtle)
- `--duration-exit` (160ms) — deliberately faster than enter.
- `translateY(2px) + opacity(1→0)`. No height collapse, no scale, no rotation.
- AnimatePresence `mode="popLayout"` prevents sibling reflow mid-exit.

### 4.5 Interactive state
- **Press-scale (`active:scale-[0.96]`)** applies to: primary/secondary buttons, icon buttons, card headers, pin/unpin controls, drop zones, phase dots.
- **Exclusions** (no press-scale):
  - Log Stream rows (virtualized — would cause scroll jank)
  - Evidence items inside a draggable list
  - `<input>` / `<textarea>` / `<select>` / contenteditable
  - Resize handles (Phase 04+ scope — not applicable to polish pass)
  - Links rendered inline in AI response text
- Hover: specific properties only (`transform`, `opacity`, `border-color`, `background-color`).
- Hit area: minimum 40×40px; extend via pseudo-element if visible element is smaller.

### 4.6 Loading vocabulary per operation (state chart)

The loading vocabulary is a **state chart**, not a fixed promise of duration. Every operation below moves through states: `start → sub-10s steady → escalation (>10s) → success | cancelled | error`. Each state picks a glyph and label.

| Operation | < 1s | 1–10s | > 10s escalation | On cancel | On error |
|---|---|---|---|---|---|
| File parse, < 10 MB | Skeleton shimmer | Skeleton + `block` | Switch to dedicated overlay with `progress` + cute label + chunks/sec | Drop zone reappears | Red border + "Parse failed · retry" button |
| File parse, 10–200 MB | — | `progress` inline + % + byte count | Stays inline; cute label appears | Chunk discard, drop zone reappears | Red border + row count if partial |
| File parse, 200 MB+ (IndexedDB) | — | Dedicated overlay from t=0 | Overlay stays; ETA + rows/sec + cancel button | IndexedDB partial flush kept, overlay collapses | Overlay turns red, "partial data retained" CTA |
| AI Diagnose (full analysis, non-streaming in 01b) | — | `braille` + cute label, phase dots | `braille` stays, cute label cycles | Cancel button below stage bar; in-flight request aborted | Red border on Diagnose card + "Retry" |
| AI chat turn | `braille` inline | `braille` | Cute label appears below | Send button reappears | Chat bubble reverts to input |
| Datadog query | `dots` | `dots` + query label | `dots` stays, "still searching…" subtext | Query chip removed | Red chip "Datadog · retry" |
| Zendesk / Jira lookup | `dots` | `dots` | Cute label appears | Empty result list | Red inline "auth? check settings" |
| Evidence export ZIP | `block` next to step | `block` | Cute label + step list | Cancel returns to Evidence | Red inline "export failed · check disk" |
| Connector heartbeat | Ambient `ready` | Pulsing `ready→live` | Decays to `ready` after 3s | N/A | Amber dot "connector disconnected" |

**"Live-dot" clarification:** This is not a new glyph family. "Live state" is produced by the `glow-live` shadow on the card accent, not a separate element. Removed the ambiguous `live-dot` name from the vocabulary.

### 4.7 Text wrapping (cheap universal fix)
- `text-wrap: balance` on every heading, card title, modal title, empty-state message.
- `text-wrap: pretty` on every body paragraph, AI response, description.
- `font-variant-numeric: tabular-nums` at `:root` for mono font; applied to every counter, timestamp, byte size, duration, percentage, log count, ETA.

### 4.8 Performance gates (non-negotiable, measurable)

**Rules:**
- **No animations on items inside virtualized lists.** Row-level animation creates jank during scroll.
- **Citation target feedback is a container-level effect**, not a row animation. The Log Stream viewport receives a brief inset `box-shadow` pulse (200ms) and a header chip ("⟵ jumped from H1"); the target row itself gets a static `background-color` that fades over 600ms using a single CSS transition on the row's parent `<tr>`. This is compatible with `@tanstack/react-virtual` because the parent row element is stable across renders.
- **`will-change`** added on animation start, removed on `transitionend`/`animationend`. Never `will-change: all`.
- **Every motion branch** has a `prefers-reduced-motion: reduce` fallback → instant.
- **Spinners** via CSS `content` + `steps()`. Zero `setInterval` per-frame.

**Benchmark harness (Phase 01a delivers the harness; all subsequent phases use it):**

| Parameter | Spec |
|---|---|
| Hardware class | Windows 11, Intel i7-12th gen class, 32GB RAM, integrated GPU — matches user's daily machine |
| Build mode | Electron production build (`npm run electron:build` output) |
| Dataset fixture | Synthetic 100k-row log derived from real `DailyNOC` MACC backup (reproducible seed) |
| Scroll script | Programmatic `scrollBy()` at 1000px/s for 10s continuous, driven from the renderer (no CDP required) |
| FPS capture | `requestAnimationFrame` timestamps captured in the renderer; FPS percentiles (avg / p5 / p50 / p95) computed from frame intervals |
| Pass threshold | ≥ 55 fps average, ≥ 45 fps p5 |
| Memory | `process.memoryUsage().heapUsed` sampled every 2s; pass if heap growth < 50 MB over 10 min idle |

Harness lives in `scripts/perf-harness.ts`. CI does not run it (too flaky in headless); developer runs locally before closing a phase. Results logged to `docs/perf/<phase>-<date>.json`.

---

## 5. Section C — Trio deep-surface specs (AI-first flow)

### 5.1 Canonical investigation format (shared data model)

**Phase 00 deliverable.** Every surface in §5.2–§5.4 consumes this. Land the schema before any UI work.

**Conceptual structure (from `investigate.txt`):**
- **Context Block** — Customer, Site, CNC, Region, Version, Event ID, Reported (verbatim)
- **Prior Art** — signal rows for Jira, Historical tickets (local folder), Zendesk history, Slack, Datadog
- **Hypotheses** (ranked 1–3, expandable) — rank, title, supporting evidence, evidence-to-confirm, evidence-to-rule-out, status (CONFIRMED/RULED OUT/INCONCLUSIVE)
- **Collection Guidance** — sequential evidence cards; "do first" / "if X fails" badges; copy-command buttons
- **Analysis** — per-hypothesis status update with supporting evidence and citations
- **Action** — recommendation (Jira / Test script / Resolve)

**TypeScript schema (versioned, Phase 00 lands in `src/types/canonical.ts`):**

*(File-location note: `src/types/investigation.ts` was already taken by the Investigation Setup Modal handoff type with four import sites. Rather than relocate that legacy type and retest imports, the canonical schema lives alongside it under `canonical.ts`. This avoids a disruptive rename for a purely cosmetic alignment.)*

```ts
export const INVESTIGATION_SCHEMA_VERSION = 1 as const;

export type BlockId = string;  // uuid
export type CitationId = string;  // uuid

export type BlockKind =
  | 'context' | 'prior-art' | 'hypothesis'
  | 'collection' | 'analysis' | 'action' | 'note';

export interface Block {
  id: BlockId;
  kind: BlockKind;
  createdAt: number;   // unix ms
  updatedAt: number;
  citations: CitationId[];
  body: BlockBody;     // discriminated union per BlockKind
}

export interface Citation {
  id: CitationId;
  kind: 'log' | 'datadog' | 'pcap' | 'jira' | 'zendesk' | 'slack' | 'confluence' | 'pdf';
  displayText: string;              // "log.txt:14382", "REP-18421"
  source: CitationSource;           // discriminated — see below
  createdAt: number;
  lastVerifiedAt?: number;
}

export type CitationSource =
  | { kind: 'log'; fileName: string; lineNumber: number; byteOffset: number; entryId: number; }
  | { kind: 'datadog'; startMs: number; endMs: number; query: string; }
  | { kind: 'pcap'; fileName: string; packetIndex?: number; }
  | { kind: 'jira'; key: string; }
  | { kind: 'zendesk'; ticketId: string; }
  | { kind: 'slack'; workspace: string; channelId: string; messageTs?: string; }
  | { kind: 'confluence'; spaceKey: string; pageId: string; }
  | { kind: 'pdf'; fileName: string; page: number; };

export interface Investigation {
  schemaVersion: typeof INVESTIGATION_SCHEMA_VERSION;
  id: string;
  ticketUrl?: string;
  createdAt: number;
  updatedAt: number;
  blocks: Block[];
  citations: Record<CitationId, Citation>;  // flat pool, referenced by Block.citations
}
```

**Rules:**
- Blocks reference Citations by ID, never inline — supports dedupe, drag-to-Evidence, export reuse.
- Every citation stores a **canonical source descriptor** (structured fields). `displayText` is a render hint; UI re-derives human-friendly strings from source on render.
- Schema version is stamped on every `.noclense` export. Import flow checks version and runs migrations (Phase 03).
- `byteOffset` is the stable locator for log citations; `lineNumber` is secondary (can drift if log file is re-parsed with different line-break handling); `entryId` is session-scoped only and is NOT persisted to exports.

**Migration map from current model (Phase 00 deliverable):**

| Current (code) | Canonical |
|---|---|
| `LogEntry.id` (sequential) | `Citation.source.entryId` (session-only, regenerated on parse) |
| `bookmark` (session) | `Block` of kind `'note'` OR `'hypothesis'` depending on context |
| `.noclense` case pack (today) | `Investigation` (versioned v1); v0 packs load via compatibility shim |
| AI diagnosis response (today: free-form prose) | Array of `Block` produced by Unleashed response adapter |

**Display link patterns** (rendered from `Citation.source` — not stored as strings):
- Zendesk: `https://carbyne.zendesk.com/agent/tickets/[ID]`
- Jira: `https://reporty.atlassian.net/browse/[REP-XXXXX]`
- Slack: `https://app.slack.com/client/[workspace]/[channel_id]` (message deep-link if `messageTs` present)
- Local folder: no link, rendered "local" in muted text
- Log line: `${fileName}:${lineNumber}` (byte offset is the actual locator, line number is display)
- Datadog window: `dd:${startIso}–${endIso}` in user's local TZ
- All external links open in new tab.

### 5.2 AI Assistant · Diagnose (primary triage + rendering)

**Process stages (the 6-step pipeline) are distinct from content blocks (the canonical data model).** The stage bar shows pipeline progress; the canonical block renderer below shows the produced content.

| Stage | Pipeline step | Produces blocks of kind |
|---|---|---|
| 0 · ingest | Parallel fetch of ticket, Confluence overviews, history, prior tickets | `context` |
| 1 · pattern | Jira REP search, portal mapping, Slack channels, Datadog errors | `prior-art` |
| 2 · hypothesize | Structured context + 1–3 ranked hypotheses | `hypothesis` (×1–3) |
| 3 · collect | Log collection guidance, commands per hypothesis | `collection` |
| 4 · analyze | Log analysis against hypotheses | `analysis` (×N) |
| 5 · act | Action recommendation (Jira / test / resolve) | `action` |

**UI contract:**

- **Stage bar** — six stage dots matching the pipeline. Active stage: `glow-ready` shadow. Completed: solid green. Future: muted. Stage bar is purely a progress indicator; it does NOT act as a content block tab.
- **Investigate URL entry** — prompt at top accepts Zendesk URL; kicks off Stage 0–2 pipeline; cute label during wait.
- **Canonical block renderer** — renders `Investigation.blocks` in canonical order. Every block pinnable to Evidence via `Ctrl+Shift+P` or pin button (shortcut changed from `Ctrl+P` to avoid OS print conflict).
- **Non-streaming in Phase 01b.** Unleashed `POST /chats` is request-response today; no native streaming. Phase 01b renders the full response when it arrives with a typewriter reveal on each block (40ms/char stagger, interruptible by Esc). If Unleashed adds streaming later, it becomes an optional Phase 05+ enhancement. The card border switches `flat → glow-live` while the request is in flight and back to `ready` when complete.
- **Citations clickable** — every `Citation` of kind `log` triggers citation-jump choreography into Log Stream (§6.2).
- **Log attach zone** — drop zone at bottom of Collection Guidance; dropping files triggers Log Stream ingestion; Stage 4 analysis auto-re-runs.
- **Chat refinement** — below rendered report; follow-up questions produce additional `analysis` or `note` blocks.
- **Action bar** — Stage 5 routes to existing DailyNOC skills: Res-note template, Jira creation template, test-script template.

**Keyboard (conflict-audited map — Phase 00 produces the full list; these are the AI surface set):**
- `Ctrl+Shift+P` — pin currently-focused block to Evidence (avoids OS print conflict)
- `Alt+↑/↓` — navigate phase/investigation history (avoids browser tab nav)
- `Esc` — abort in-flight request / cancel streaming reveal

Command palette (`Ctrl+K`) is **out of scope** for Phase 01 — deferred. Does not ship until a full shortcut conflict audit lands (non-goal for polish pass; see §7).

**Case activation rule:** When a user clicks "Pin to Evidence" and no active case exists, the app auto-creates a case titled from the Context Block (`${customer} · ${ticketId}`) and activates it before pinning. No modal.

### 5.3 Log Stream (supplemental + citation target)

Opens empty and quiet. Lights up when logs are attached. Must handle 100k+ entries at ≥ 55 fps scroll (harmonized with §4.8 — the prior "60 fps" target is retired as unmeasurably strict for the real hardware class).

**Parser contract (Phase 00 deliverable for OC format; other formats kept as-is):**

The Operator Client parser is a *new format extension* to `parser.ts`. Existing formats (Datadog CSV, Homer SIP JSON, plain text, call log CSV) are untouched. The OC parser delivers:

- **Entry boundary detection:** a line that starts with `[LEVEL]` where LEVEL ∈ `{ERROR, WARN, INFO, DEBUG}` is the start-of-entry marker.
- **Header parse:** `[LEVEL] [M/D/YYYY, H:MM:SS AM/PM,MS] [Component]: message`.
- **JSON body:** every subsequent line until the next start-of-entry or EOF forms the body. The body is attempted as JSON; on parse failure, body is kept as raw text and the entry gets a `jsonMalformed: true` flag (still renders, citations still work).
- **Correlation extraction:** `traceId`, `cpeStation.id`, `cpeUser.cncID`, `callId` are read from the parsed JSON (`null`-safe) and promoted to first-class `LogEntry` fields. `traceId` is a new indexed correlation field (added to `src/types.ts` in Phase 00).
- **Stored locator:** every entry persists `fileName`, `lineNumber` (start-of-entry line in the source file), `byteOffset` (byte index of start-of-entry). These three together are the Citation source; `id` remains the session-scoped index.
- **Malformed entries** are not dropped — they render with a muted orange left border and a tooltip ("malformed JSON body"); AI can still cite them.

**Multi-format tabs** — `log.txt`, `extract.csv`, PCAP (pre-converted tshark output as text), `event.txt`, Carbyne Event PDF (extracted text) — each as a tab above the row grid. Filters, citations, and active correlation set are **per-tab**; jumping to a citation in a different tab switches tabs first, then scrolls.

**Citation-jump choreography (Phase 02):**
- Switch to citing tab if needed (instant).
- Smooth scroll to target row (container-level scroll animation, 300ms).
- Target row receives `background-color` fade-in over 600ms (CSS transition on the stable parent element — not per-row JS animation, see §4.8).
- Header chip "⟵ jumped from H1" enters with 40ms stagger, persists 4s, then fades.

**Row rendering** — 35px row, virtualized via `@tanstack/react-virtual`. Level-colored 2px left border on ERR/WARN rows (static, painted on — no animation). Hover = `background-color` transition only, 120ms. Click → expands JSON body inline.

**JSON folding (Phase 02, minimal):** the JSON body collapses to a single-line preview by default (first 80 chars of the `msg` or first key/value). Click expands inline. **Inline syntax highlighting is deferred to Phase 05 or a later pass** — the initial expand shows monospace plain text with 2-space indentation only. This avoids the virtualization + highlighting performance risk flagged by Codex.

**Parse overlay** — dedicated panel at top of card body during parse. Progress glyph + cute label + ETA + chunks/sec. Collapses (`height → 0`, 200ms) on completion.

**Filter chips** — traceId, callId, station, level, time window. Applied filters shown as removable chips; populated from AI citations on citation-jump.

**Live mode indicator** — pulsing `live` dot + "LIVE · DATADOG" label in card header when Datadog streaming is active. Auto-decays to `ready` after 3s silence (subject to arbitration rules in §3.3).

### 5.4 Evidence (block-aware working memory)

**Evidence items are canonical `Block` references + provenance metadata.** No new item union — the block schema from §5.1 is the item type.

```ts
export interface EvidenceItem {
  blockId: BlockId;             // references Investigation.blocks
  pinnedAt: number;
  pinnedBy: 'user' | 'ai';      // ai = auto-pin on confirmed hypothesis
  order: number;                // user-controlled sort
  note?: string;                // engineer-added overlay, separate from block.body
}

export interface EvidenceSet {
  caseId: string;
  items: EvidenceItem[];
}
```

**Dedupe rule:** `blockId` is unique within an `EvidenceSet`. Re-pinning a block updates `pinnedAt` and re-orders to top; does not create a duplicate.

**UI contract:**
- **Pin-in animation** — new items enter at top with `translateY(6px) + scale(0.95) → (0, 1)`, 250ms, `ease-enter-out`.
- **Unpin-out animation** — `translateY(2px) + opacity → 0`, 160ms. popLayout mode prevents sibling reflow.
- **Hover lift** — `translateY(-1px) + raised→floating shadow`, 150ms.
- **Drag reorder** — drag handle (`⋮⋮`) appears on hover; native HTML5 drag API; drop settles in 180ms.
- **Note edit** — click a NOTE overlay → expands to textarea with `glow-ready` border; blur saves and collapses.
- **Empty state** — single muted glyph (`∅` or `⌗`), text-wrap balance title, text-wrap pretty body with correct shortcut ("Pin items with Ctrl+Shift+P").
- **Bundle size** — tabular-nums in header; subtle pulse on badge at >100 KB increments.

**Export templates (Phase 03 deliverable):**
- `Res-note.txt` format (Issue summary / Root cause / Resolution / Linked Jira / Customer action / Status) — pre-filled from Context Block + confirmed-hypothesis Analysis.
- `JiraCreation.txt` format (Summary / Description / Priority / Labels) — pre-filled from Context Block + top-ranked hypothesis.
- `.noclense` ZIP export manifest (`manifest.json`):
  ```json
  {
    "schemaVersion": 1,
    "createdAt": 1745000000000,
    "app": { "name": "NocLense", "version": "2.0.0" },
    "investigation": { "id": "...", "schemaVersion": 1 },
    "attachments": [{ "fileName": "log.txt", "size": 54321000, "sha256": "..." }],
    "redaction": { "applied": true, "rules": ["phone", "email"] }
  }
  ```
- **Resume behavior:** importing a `.noclense` file parses `manifest.json` first; if `schemaVersion` is unknown, import fails with a user-visible error. Migration shim for `schemaVersion: 0` (pre-canonical case packs) is optional and lands post-01.
- **No-confirmed-hypothesis fallback:** if no hypothesis reaches CONFIRMED status, `Res-note` uses the top-ranked hypothesis and adds a "[DRAFT — unconfirmed]" header; Jira export uses INCONCLUSIVE summary template.

### 5.5 Resizable surfaces — deferred to roadmap

**Removed from polish pass.** The Investigate Room is a CSS grid with named slots today; swapping to `react-resizable-panels` is a layout architecture change, not polish. `react-resizable-panels` is not in `package.json` and would require a dependency review.

Resizable surfaces move to **Phase 6+ roadmap**, bundled with the case library work. If prioritized later:

1. Decide grid vs. nested-panel tree (separate design memo).
2. If nested-panel: full hierarchy spec, persistence keys, min sizes, keyboard semantics, reset behavior.
3. If grid: column/row span via user drag of grid-line handles; persistence as `localStorage` grid-template.

**Polish-pass substitute:** card headers gain a `⊞` icon that toggles the card between default size and "focused" (fills the grid, siblings collapse to rail). Phase 04 ships the baseline (focused card fills, siblings hidden). Phase 05 Commit 6 ships the visible 80px right-side rail via a DOM-split `InvestigateGridInner` with `<button role="tab">` strips for each sibling.

---

## 6. Section D — Broad pass, integration, validation, roadmap

### 6.1 Broad pass (outside the trio)

- **Import Room** — single centered drop zone; fills on hover with subtle scale + `glow-ready`; cute label during parse; URL paste kicks off investigate flow. (`/` prefix command palette is deferred — see §7.)
- **Submit Room** — canonical fields matching `Res-note.txt`; pre-filled from Evidence; one-click Copy-to-Zendesk, Create-REP, Export-.noclense.
- **Correlation Graph card** — moved to Phase 06A (see §6.5 and v3 Phase 05 plan). Net-new feature work (graph layout algorithm, edge co-occurrence, interactive node selection, traceId integration) rather than polish. Existing stub text in `NewWorkspaceLayout.tsx` remains until the card is implemented.
- **Datadog Live card** — `glow-live` while streaming; decays to `ready` per arbitration rules.
- **Similar Tickets card** — compact list from local folder + Zendesk history (future: case library).
- **PhaseHeader + PhaseDots** — apply new tokens, tabular-nums on ticket ID, text-wrap on customer names.

### 6.2 Cross-surface motion choreographies

**Only one choreography is in scope for the polish pass: `citation-jump` (Phase 02 delivers the data path; Phase 05 polishes the visual).**

| Pattern | Scope | Implementation |
|---|---|---|
| **citation-jump** (AI → Log Stream) | In scope (Phase 05 polish) | Container-level: tab switch + scroll (300ms) + row background fade (600ms) + header chip stagger (40ms). CSS only. See §4.8. |
| **evidence-yank** (block → Evidence) | **Deferred** to post-polish roadmap | If revived: use pulse on origin + bounce on Evidence badge; no DOM-flight clones. |
| **log-anchor** (row → Evidence) | **Deferred** to post-polish roadmap | Same substitute pattern as evidence-yank. |
| **return-to-AI** (Evidence → AI) | **Deferred** to post-polish roadmap | If revived: AI card scrolls to referenced block + `glow-ready` pulse 500ms. |

DOM-flight clone choreographies were flagged as fragile under virtualized scroll and filter changes. The pulse/highlight alternative keeps the visual language without fighting the list virtualizer. Revisit after the polish pass if users ask for it.

All motion respects `prefers-reduced-motion: reduce` → instant jump, no animation.

### 6.3 Case library (Phase 6, long-term roadmap — separated from polish)

**Not part of the polish pass.** The polish pass only builds the foundation (canonical format is the case-file shape).

Scope moved to a separate memo (`docs/roadmap/case-library.md`, Phase 6 deliverable):
- Source, store, retrieve, and feed mechanism.
- **Embeddings policy:** Unleashed-only constraint means embeddings must come from Unleashed (if supported) or via a local-only model (no third-party SaaS). If Unleashed does not expose embeddings, case-library retrieval falls back to structured metadata match (customer + error-signature regex) in Phase 6.0 and revisits embeddings in a Phase 6.1 memo. **No Google/OpenAI embedding usage** — consistent with Unleashed-only rule.
- **Bulk historical ingestion** (onboarding bulk-import of all tickets in `DailyNOC/`) moves to its own memo under `docs/roadmap/bulk-ingest.md` — separate operational project covering privacy, dedupe, rate limits, and resume semantics.
- Privacy: local-only by default; shared folder opt-in.

### 6.4 Validation bars (per phase, reproducible)

All targets use the Phase 01a benchmark harness (§4.8). Targets split between **UX perceived latency** and **transport latency** where both apply.

| Metric | Layer | How measured | Target (warm cache) | Target (cold cache) |
|---|---|---|---|---|
| Log Stream scroll FPS | UX | Harness: 100k rows, 10s wheel scroll | ≥ 55 fps avg, ≥ 45 fps p5 | Same |
| File parse, 50MB | Transport | Real MACC `log.backup1.txt`, drop-to-first-row-visible | ≤ 8 s | ≤ 12 s |
| File parse, 200MB+ | Transport | Synthetic 250MB via IndexedDB streaming, end-to-end | ≤ 45 s | ≤ 60 s |
| Citation-jump | UX (perceived) | Click citation → target row visible + highlight started | ≤ 500 ms | ≤ 700 ms |
| Citation-jump total animation | UX (completion) | Click citation → scroll done + highlight fade complete | ≤ 1000 ms | ≤ 1200 ms |
| AI Diagnose total turnaround | Transport | Submit URL → full response rendered (non-streaming) | ≤ 25 s median | ≤ 40 s p90 |
| AI Diagnose first visible block | UX | Submit URL → first `context` block painted | ≤ 10 s | ≤ 18 s |
| Evidence export | Transport | 20-item evidence set → ZIP download | ≤ 2 s | ≤ 3 s |
| Memory on 100k-row load | Resource | Heap sampling every 2s for 10 min idle | heap growth < 50 MB | Same |
| Reduced-motion compliance | UX | Every animated surface instant under `prefers-reduced-motion` | 100% surfaces verified | Same |
| Subjective "feels right" | UX | Full shift use with no regressions | Qualitative signoff | N/A |

The prior "first streamed character ≤ 3s" target is retired because non-streaming is the Phase 01b contract; "first visible block" replaces it.

### 6.5 Implementation phases

Each phase completes when its validation bars are clear AND Codex has reviewed.

| # | Scope | Gate |
|---|---|---|
| **00** | **Contracts.** Canonical investigation schema (`src/types/canonical.ts` v1 — `investigation.ts` name is taken by the Setup modal handoff). Citation model with byte-offset locator. AI response adapter contract. OC parser grammar contract. Token migration map. Shortcut conflict audit. LogEntry field additions (`traceId`, `byteOffset`, `lineNumber`). Benchmark harness skeleton. | Codex |
| **01a** | **Visual polish (surface-neutral).** Token inventory applied, glow tiers + state machine, shadow scale, spinner family, cute-label hook, motion tokens, text-wrap sweep. No data-model changes. No canonical renderer yet. | Codex |
| **01b** | **AI/Diagnose renderer.** Canonical block renderer (non-streaming), stage bar, Investigate URL entry, typewriter reveal, shortcut set from Phase 00. | Codex |
| **01c** | **Pin-to-Evidence integration.** Evidence surface consumes block references from §5.4 schema. No export work yet. | Codex |
| **02** | **Log Stream deep polish.** OC parser implementation, `traceId`/byte-offset persistence, JSON folding (minimal), citation-jump data path, parse overlay, multi-format tabs. No inline JSON highlighting. | Codex |
| **03** | **Evidence exports.** Res-note / Jira / `.noclense` templates. Manifest versioning. Import shim for v0 case packs. | Codex |
| **04** | **Focus-mode cards + Import Room + Submit Room.** Card focus toggle (substitute for resizable surfaces). Not resize panels. | Codex |
| **05** | **Broad pass + citation-jump polish + reduced-motion audit** + spec cleanup. | Codex |
| **06** | *(future)* Case library learning loop — separate spec after 05 ships. |
| **06A** | *(future)* **Correlation Graph card.** One node per extracted correlation ID (`traceId`, `callId`, `stationId`, etc.); edges for co-occurrence; layout algorithm; interactive selection. Categorically feature work rather than polish — moved out of Phase 05 §6.1 broad pass scope. | Codex |
| **07** | *(future)* Standalone app packaging (Tauri evaluation memo) — separate spec. |

Phase 00 is non-optional. Phases 01a–01c can be landed as separate PRs but all three belong to "Phase 01" conceptually.

### 6.6 Standalone app packaging — parked project #3

Previously parked; reopened implicitly by (1) weekend Vercel incident, (2) API keys in build-time bundles, (3) wireshark/tshark local dependency.

**Recommendation:** Don't block polish on this. Polish work lives in `src/` and ports to any shell. Ship Phases 00–05 first. Do a Tauri evaluation memo post-Phase-05 with concrete numbers: bundle size, memory, cold start, file-system access, keychain integration for API keys, native PCAP parsing. Decide then.

**Exception:** If the Vercel security incident is severe enough to prevent any production deployment, flip the order — do Tauri first, polish after.

---

## 7. Non-goals (explicit and expanded)

To prevent scope creep:

- **Not rebuilding the workflow.** The 6-stage investigate.txt workflow is canonical; the UI renders it, it doesn't replace it.
- **Not expanding beyond log analysis.** Vision #2 (NOC workbench covering all of Zendesk/Jira/Slack/Datadog/Teams/Confluence directly in-app) is a separate project.
- **Not changing AI provider.** Unleashed AI only. `src/services/providers/` is unused legacy (per CLAUDE.md).
- **Not rebranding.** Greenhouse palette stays. "NocLense" name stays. Logo unchanged.
- **Not rewriting the parser.** Existing formats (Datadog CSV, Homer SIP JSON, text, CSV) are extended with a new OC format handler only. No changes to streaming / IndexedDB code paths.
- **Not swapping the layout engine.** Investigate Room stays a CSS grid. `react-resizable-panels` and any nested-panel tree are out of scope for polish; focus-mode card toggle is the polish-pass substitute.
- **Not implementing AI streaming transport.** Unleashed `POST /chats` is request-response; Phase 01b renders full responses with typewriter reveal. If Unleashed adds native streaming later, it's a Phase 05+ enhancement, not a polish-pass requirement.
- **Not shipping a command palette.** `Ctrl+K` and `/`-prefix command palette are deferred until a full shortcut conflict audit lands (post-polish).
- **Not rewriting the evidence model inside polish phases.** Evidence items are canonical block references; no new item union type.
- **Not implementing watched-folder ingestion.** Bulk-import of `DailyNOC/` tickets moves to a separate roadmap memo.
- **Not adding inline JSON syntax highlighting** in Phase 02. Folded-body preview + plain monospace expand only. Highlighting revisits post-Phase-05 when harness confirms no virtualization regression.
- **Not adding DOM-flight clone choreographies** (`evidence-yank`, `log-anchor`, `return-to-AI`). Pulse/highlight is the polish-pass alternative.
- **Not adding multi-user/sync.** Per-user localStorage only. No accounts, no cloud sync.

---

## 8. Open details to resolve during implementation

These are intentionally left for the per-phase implementation rather than the spec:

- Exact color ramp for alert state on `--shadow-glow-error` (Phase 01a tuning against existing error red).
- Specific micro-copy for cute-label phrase variants per operation (Phase 01a, once hook is wired).
- How deeply to flatten nested JSON when "expand all" is triggered (Phase 02).
- Exact drop zone behavior when a partially-parsed file fails mid-stream (Phase 02 error UX).
- ✅ Focus-mode sibling rail resolved in Phase 05 Commit 6 — 80px right-side rail via DOM-split `InvestigateGridInner`; each non-focused card renders as a single `<button role="tab">` strip with accent dot + icon + title. Clicking any strip transfers focus to that card. Keyboard-accessible via Tab + Enter/Space.
- Specific Unleashed prompt adjustments to coerce the AI response into canonical block structure (Phase 00 + 01b iteration).

---

## 9. Success criteria

The redesign is successful when:

1. All validation bars in §6.4 are cleared for both warm- and cold-cache conditions.
2. User can complete a full NOC shift using only NocLense for investigation work (no fallback to Notepad++).
3. An investigation from URL-paste to `.noclense` export uses the v1 canonical structure end-to-end without format adapters.
4. Reduced-motion users have a usable experience indistinguishable from the animated one functionally.
5. User's subjective report after one week of daily use: "happy to use, not tolerating."

---

**End of spec v2. Ready for Phase 00 kickoff once user approves.**


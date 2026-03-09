# NocLense

**NocLense** is a desktop application for analyzing SIP/VoIP and telecommunications logs. Built for NOC engineers and support teams, it handles 100,000+ log entries with virtualized rendering, AI-powered analysis, and multi-format import support.

> Runs as an Electron desktop app or in-browser via Vite dev server.

---

## Features

### Log Analysis
- **High-performance rendering** — `@tanstack/react-virtual` renders only visible rows; handles 100k+ entries without lag
- **Multi-format import** — Datadog CSV, Homer SIP JSON, and plain-text log files
- **Large-file streaming** — Files over 50 MB are streamed into IndexedDB in 2 MB chunks; no browser memory limits
- **SIP/VoIP awareness** — Highlights SIP methods (INVITE, BYE, ACK, etc.), 4xx/5xx response codes, and call flows with automatic color coding
- **Detailed inspection** — Expand any row for full JSON payload, structured fields, and raw message content
- **Smart Filter** — One-click removal of DEBUG logs and SIP OPTIONS heartbeats to surface signal from noise

### Filtering & Correlation
- **Faceted correlation sidebar** — Filter by Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, or Message-ID
- **AND/OR logic** — Correlations use AND between types, OR within a type; exclusion correlations supported
- **Search history** — Persisted across sessions with keyboard navigation
- **Message type filter** — Filter by SIP method category, error level, or log format

### AI-Powered Analysis
- **Multi-provider support** — Google Gemini 3.1 (default), Claude 4.x (Sonnet/Haiku/Opus), and OpenAI Codex
- **AI Assistant** — Conversational interface for asking questions about your logs
- **Analyze Visible Logs** — One-click analysis of the current filtered view
- **Explain with AI** — Contextual analysis for a selected log entry plus surrounding context
- **Correlation analysis** — Analyze all logs for a given Call-ID or correlation from the sidebar
- **Onboarding wizard** — Step-by-step API key setup with provider selection and key validation
- **Secure key storage** — API keys encrypted at rest via Electron `safeStorage`

### Case & Workspace Management
- **Case context** — Attach a title, analyst name, notes, and tags to any investigation session
- **Export packs** — Bundle logs, case metadata, and AI analysis into a `.noclense` ZIP archive
- **Workspace import** — Restore a previous session from a saved workspace package

---

## Getting Started

### Desktop App (Electron)

```bash
npm install
npm run electron:dev     # Electron + Vite dev server
npm run electron:build   # Package installer (NSIS on Windows, DMG on macOS)
```

### Web (Browser)

```bash
npm install
npm run dev              # Vite dev server → http://localhost:5173
npm run build            # TypeScript check + production build
```

### Load Your First Logs

1. Launch the app and click **Open File** (or drag and drop)
2. Supported formats: `.log`, `.txt`, `.csv` (Datadog), `.json` (Homer SIP)
3. Multiple files are merged and sorted chronologically
4. Use the **Correlation Sidebar** to filter by Call-ID or other identifiers
5. Optionally configure an AI provider via the **AI Settings** panel (gear icon)

---

## AI Setup

NocLense supports three AI providers. All keys are stored encrypted — never in plaintext.

| Provider | Models | API Key Source |
|----------|--------|----------------|
| Google Gemini | `gemini-3.1-flash-lite-preview` (default), `gemini-3.1-pro-preview` | [Google AI Studio](https://aistudio.google.com) — free tier available |
| Anthropic Claude | `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-6` | [Anthropic Console](https://console.anthropic.com) |
| OpenAI Codex | `codex` | [OpenAI Platform](https://platform.openai.com) |

Use the onboarding wizard (launches on first run) or the **AI Settings** panel to configure your provider.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Desktop | Electron (with `safeStorage`, IPC bridge, preload isolation) |
| Build | Vite + `vite-plugin-electron` |
| Styling | Tailwind CSS + custom design token system |
| Animation | Motion (`framer-motion` successor) |
| Virtualization | `@tanstack/react-virtual` |
| Storage | IndexedDB (large files), `localStorage` (settings/history) |
| Testing | Vitest + React Testing Library |
| AI Providers | `@google/generative-ai`, `@anthropic-ai/sdk`, OpenAI API |

---

## Development

```bash
npm run test             # Vitest watch mode
npm run test:run         # Single CI run
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```

See [`CLAUDE.md`](./CLAUDE.md) for architecture notes, coding conventions, and key file references.
See [`docs/releases/CHANGELOG.md`](./docs/releases/CHANGELOG.md) for full version history.

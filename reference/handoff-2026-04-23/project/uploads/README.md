# NocLense

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

NocLense is a high-performance desktop and browser application designed specifically for NOC engineers and support analysts. It solves the challenge of drowning in massive log files by rapidly ingesting 100,000+ lines across 8+ different telecom formats, allowing engineers to correlate SIP call flows, diagnose root causes with AI, and seamlessly close Zendesk tickets with attached evidence.

<!-- Screenshot: add docs/assets/investigate-room.png when available -->

## Key Features

- **Multi-format log ingestion**: Natively supports APEX, Datadog CSV, Homer SIP, Call Log CSV, ISO logs, embedded JSON payloads, and automatically extracts text from PDF and ZIP files.
- **Virtualized rendering**: Easily handles 100k+ entries with `@tanstack/react-virtual` and IndexedDB streaming for files larger than 50MB, bypassing browser memory limits.
- **Faceted correlation system**: Filter instantly across 8 correlation types (Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, Message-ID) with full AND/OR logic.
- **AI-powered 3-phase investigation**: A guided workflow spanning the **Import Room** (data intake), **Investigate Room** (AI diagnosis, Datadog live enrichment, log correlation), and **Submit Room** (handoff and closure).
- **Zendesk & Confluence integration**: Fetch tickets directly, draft internal closure notes, and automatically save investigation memory to Confluence to surface similar future tickets.
- **Datadog live enrichment**: Live integration with Datadog to pull real-time server logs and discover CNC stations.
- **Accessibility**: Comprehensive reduced-motion support, including the `<Spinner />` primitive with `role="status"` and `sr-only` labels, `<MotionConfig reducedMotion="user">` at the App root, the `usePrefersReducedMotion` hook in anime.js guards, and per-component `motion-safe`/`motion-reduce` CSS guards.
- **Workspace Export**: Bundle logs, evidence, and AI diagnosis into a `.noclense` workspace archive.

## Quick Start

NocLense can run as a standalone Electron desktop app or as a web application via the Vite dev server.

```bash
# Clone and install dependencies
git clone <repo> && cd NocLense
npm install

# Option A: Run as a Web App (available at http://localhost:5173)
npm run dev

# Option B: Run as a Desktop App (Electron + Vite)
npm run electron:dev

# Build for Production
npm run build          # Web build
npm run electron:build # Package Electron app (NSIS/DMG)
```

## Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 + TypeScript + Vite |
| **Desktop Environment** | Electron (with safeStorage, IPC bridge) |
| **Styling** | TailwindCSS + custom tokens |
| **Animations** | Motion (formerly Framer Motion), anime.js v4 |
| **Performance** | `@tanstack/react-virtual`, IndexedDB |
| **Testing** | Vitest + React Testing Library |

## AI Setup

NocLense integrates exclusively with **Unleashed AI**, acting as a secure abstraction layer pre-configured with the organization's Zendesk, Slack, and Confluence knowledge base.

To configure the AI:
1. Obtain an Unleashed AI token from your administrator.
2. Provide the token via the `VITE_UNLEASH_TOKEN` environment variable.

*Note: Multi-provider integrations (Gemini/Claude/OpenAI) have been deprecated in favor of the unified Unleashed AI pipeline.*

## Environment Variables

Create a `.env` file in the project root:

| Variable | Description |
|---|---|
| `VITE_UNLEASH_TOKEN` | Unleashed AI bearer token (Required) |
| `VITE_UNLEASH_ASSISTANT_ID` | Unleashed AI assistant identifier |
| `VITE_UNLEASH_USER_EMAIL` | User email for Unleashed AI session tracking |
| `VITE_ZENDESK_SUBDOMAIN` | Zendesk subdomain (e.g., carbyne) |
| `VITE_ZENDESK_EMAIL` | Zendesk agent email |
| `VITE_ZENDESK_TOKEN` | Zendesk API token |
| `VITE_DATADOG_API_KEY` | Datadog API key for live enrichment |
| `VITE_DATADOG_APP_KEY` | Datadog App Key (requires `logs_read_data` scope) |
| `VITE_DATADOG_SITE` | Datadog site (e.g., `datadoghq.eu`) |
| `VITE_JIRA_SUBDOMAIN` | Atlassian site for Jira/Confluence |
| `VITE_JIRA_EMAIL` | Atlassian email |
| `VITE_JIRA_TOKEN` | Atlassian API token |
| `VITE_JIRA_PROJECT_KEY` | Jira project key for issue creation |
| `VITE_CONFLUENCE_SPACE_ID` | Confluence space ID for investigation memory |
| `VITE_CONFLUENCE_PARENT_PAGE_ID` | Parent page ID for saving investigations |

## Development Commands

```bash
npm run test          # Run Vitest in watch mode
npm run test:run      # Single CI test run
npm run test:coverage # Coverage report
npm run lint          # Run ESLint
npm run build         # TypeScript type check & build
```

## Project Structure

```
NocLense/
├── electron/         # Electron main process & preload scripts
├── public/           # Static assets
├── src/              
│   ├── components/   # UI components (workspace, ai, filter)
│   ├── contexts/     # Global state (LogContext, AIContext)
│   ├── services/     # Integrations (Unleashed, Zendesk, Datadog)
│   └── utils/        # Parsers, token estimators, animation hooks
├── docs/             # Documentation & plans
└── vite.config.ts    # Vite & proxy configuration
```

## Documentation

- **[Architecture & Conventions](CLAUDE.md)**: Deep dive into the codebase and core concepts.
- **[Developer Handoff](docs/DEVELOPER_HANDOFF.md)**: Onboarding guide for contributors and AI agents.
- **[Usage Guide](docs/USAGE_GUIDE.md)**: Task-oriented guide for NOC engineers using the app.
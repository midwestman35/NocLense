# NocLense

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

NocLense is a Tauri desktop application for NOC engineers and support analysts. It is built to ingest large telecom log sets quickly, correlate SIP call flows, diagnose root causes with AI, and package evidence for ticket handoff.

<!-- Screenshot: add docs/assets/investigate-room.png when available -->

## Key Features

- **Multi-format log ingestion**: APEX, Datadog CSV, Homer SIP, Call Log CSV, ISO logs, embedded JSON payloads, and automatic PDF and ZIP text extraction.
- **Large-file handling**: `@tanstack/react-virtual`, IndexedDB streaming, and native chunk streaming for imports larger than 50 MB.
- **Faceted correlation system**: Filter across Call-ID, Report-ID, Operator-ID, Extension-ID, Station-ID, File Name, CNC-ID, and Message-ID with full AND/OR logic.
- **AI-powered 3-phase investigation**: Import Room, Investigate Room, and Submit Room for intake, diagnosis, and handoff.
- **Zendesk and Confluence integration**: Pull tickets, draft closure notes, and save investigation memory.
- **Datadog live enrichment**: Query live logs and CNC station data during an investigation.
- **Workspace export**: Bundle logs, evidence, and AI diagnosis into a `.noclense` workspace archive.

## Quick Start

NocLense now ships as a Tauri desktop app. `npm run dev` is still useful for renderer-only UI work, but vendor-backed integrations are expected to hit CORS outside Tauri.

```bash
# Clone and install dependencies
git clone <repo> && cd NocLense
npm install

# Supported desktop dev runtime
npm run tauri:dev

# Optional renderer-only preview for UI work
npm run dev

# Builds
npm run build
npm run tauri:build
```

## Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19 + TypeScript + Vite |
| **Desktop Environment** | Tauri 2 |
| **Native Integrations** | Tauri commands + dialog/fs/http plugins |
| **Styling** | TailwindCSS + custom tokens |
| **Animations** | Motion, anime.js v4 |
| **Performance** | `@tanstack/react-virtual`, IndexedDB |
| **Testing** | Vitest + React Testing Library |

## AI Setup

NocLense integrates exclusively with **Unleashed AI**, acting as a secure abstraction layer pre-configured with the organization's Zendesk, Slack, and Confluence knowledge base.

To configure the AI:
1. Obtain an Unleashed AI token from your administrator.
2. Provide the token via the `VITE_UNLEASH_TOKEN` environment variable.

## Environment Variables

Create a `.env` file in the project root:

| Variable | Description |
|---|---|
| `VITE_UNLEASH_TOKEN` | Unleashed AI bearer token (required) |
| `VITE_UNLEASH_ASSISTANT_ID` | Unleashed AI assistant identifier |
| `VITE_UNLEASH_USER_EMAIL` | User email for Unleashed AI session tracking |
| `VITE_ZENDESK_SUBDOMAIN` | Zendesk subdomain (for example `carbyne`) |
| `VITE_ZENDESK_EMAIL` | Zendesk agent email |
| `VITE_ZENDESK_TOKEN` | Zendesk API token |
| `VITE_DATADOG_API_KEY` | Datadog API key for live enrichment |
| `VITE_DATADOG_APP_KEY` | Datadog app key with `logs_read_data` scope |
| `VITE_DATADOG_SITE` | Datadog site (for example `datadoghq.eu`) |
| `VITE_JIRA_SUBDOMAIN` | Atlassian site for Jira and Confluence |
| `VITE_JIRA_EMAIL` | Atlassian email |
| `VITE_JIRA_TOKEN` | Atlassian API token |
| `VITE_JIRA_PROJECT_KEY` | Jira project key for issue creation |
| `VITE_CONFLUENCE_SPACE_ID` | Confluence space ID for investigation memory |
| `VITE_CONFLUENCE_PARENT_PAGE_ID` | Parent page ID for saved investigations |

## Development Commands

```bash
npm run tauri:dev     # Supported vendor-capable desktop dev runtime
npm run dev           # Renderer-only Vite dev server
npm run build         # TypeScript type check + renderer build
npm run tauri:build   # Package the desktop app
npm run lint          # ESLint
npm run test          # Vitest watch mode
npm run test:run      # Single CI test run
npm run test:coverage # Coverage report
```

## Project Structure

```text
NocLense/
|-- public/           # Static assets
|-- src/              # React renderer
|   |-- components/   # UI components
|   |-- contexts/     # Global state
|   |-- services/     # Integrations and native wrappers
|   `-- utils/        # Parsers, token estimators, animation hooks
|-- src-tauri/        # Tauri shell, Rust commands, packaging config
|-- docs/             # Documentation and phase plans
`-- vite.config.ts    # Renderer bundling config
```

## Documentation

- **[Architecture & Conventions](CLAUDE.md)**: Codebase conventions and working notes for implementation agents.
- **[Developer Handoff](docs/DEVELOPER_HANDOFF.md)**: Contributor onboarding and handoff notes.
- **[Usage Guide](docs/USAGE_GUIDE.md)**: Task-oriented operator guide.

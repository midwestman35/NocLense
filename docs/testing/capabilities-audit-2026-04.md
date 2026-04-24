# Capabilities Audit - 2026-04

Scope: 07I.a.2 audit of `src-tauri/capabilities/default.json` against renderer call sites under `src/`.

| scope | caller file(s) | action taken |
|---|---|---|
| `core:default` | Tauri main window bootstrap | kept |
| `dialog:default` | `src/services/importFileSource.ts` | kept |
| `dialog:allow-open` | `src/services/importFileSource.ts` (`openImportFilesDialog`) | kept |
| `dialog:allow-save` | none found under `src/` | pruned |
| `fs:default` | `src/services/importFileSource.ts` | kept |
| `fs:allow-open` | `src/services/importFileSource.ts` (`readImportFileSliceText`) | kept |
| `fs:allow-read-file` | `src/services/importFileSource.ts` (`toBrowserImportFile`) | kept |
| `fs:allow-read-text-file` | `src/services/importFileSource.ts` (`readImportFileText`) | kept |
| `fs:allow-stat` | `src/services/importFileSource.ts` (`openImportFilesDialog`) | kept |
| `fs:scope` `$DESKTOP/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `fs:scope` `$DOCUMENT/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `fs:scope` `$DOWNLOAD/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `fs:scope` `$HOME/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `fs:scope` `$PUBLIC/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `fs:scope` `$TEMP/**/*` | `src/services/importFileSource.ts` user-selected import paths | kept |
| `http:default` | `src/services/unleashService.ts`, `src/services/providers/UnleashProvider.ts`, `src/services/zendeskService.ts`, `src/services/datadogService.ts`, `src/services/jiraService.ts`, `src/services/confluenceService.ts` | kept |
| `http:allow-fetch` `https://e-api.unleash.so/**` | `src/services/unleashService.ts`, `src/services/providers/UnleashProvider.ts` | kept |
| `http:allow-fetch` `https://**.zendesk.com/**` | `src/services/zendeskService.ts` | kept |
| `http:allow-fetch` `https://**.datadoghq.com/**` | `src/services/datadogService.ts` via `getDatadogBase()` | kept |
| `http:allow-fetch` `https://**.datadoghq.eu/**` | `src/services/datadogService.ts` via `getDatadogBase()` and Setup Room `datadoghq.eu` site support | added |
| `http:allow-fetch` `https://**.atlassian.net/**` | `src/services/jiraService.ts`, `src/services/confluenceService.ts` | kept |
| `http:allow-fetch` `https://generativelanguage.googleapis.com/**` | none using `@tauri-apps/plugin-http`; Gemini paths use `@google/generative-ai` | pruned |
| native `fetch` `https://api.openai.com/v1/responses` | `src/services/providers/CodexProvider.ts` | no Tauri capability required |
| native `fetch` `https://api.anthropic.com/v1/messages` | `src/services/providers/ClaudeProvider.ts` | no Tauri capability required |
| native `fetch` `/service-mappings.json` | `src/utils/messageCleanup.ts`, `src/components/LogStreamHeader.tsx` | no Tauri capability required |
| native `fetch` server API base URL | `src/api/client.ts`, `src/services/serverService.ts` | no Tauri capability required; legacy/server-mode path is outside plugin-http allowlist |

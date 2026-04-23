# electron/CLAUDE.md

Module context for Electron main/preload code.

## Scope
- `main.js`: window lifecycle, IPC endpoints, app-level integrations.
- `preload.js`: secure bridge exposed via `window.electronAPI`.

## Rules
- Do not expose raw Node APIs to the renderer.
- Keep IPC contracts explicit and minimal.
- Keep secret handling in main process only.

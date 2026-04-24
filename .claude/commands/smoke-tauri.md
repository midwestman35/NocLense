---
description: Run a NocLense Tauri runbook smoke through WebdriverIO and tauri-driver.
argument-hint: <runbook-name|all>
allowed-tools: Bash
---

# /smoke-tauri

Run the named runbook through the local automation harness.

Usage:

```text
/smoke-tauri splash
/smoke-tauri all
```

Behavior:

- Fails fast on macOS with `automation not supported on macOS, walk the runbook manually`.
- Reads `docs/testing/runbooks/<name>.md`.
- Drives the app through `tools/claude-automation/driver.ts`.
- Captures screenshots at automated checkpoints.
- Writes `tools/claude-automation/reports/<timestamp>/report.md`.
- Exits `0` when every automated assertion passes; exits `1` on any failure.

Command:

```powershell
npx ts-node --esm tools/claude-automation/smoke-tauri.ts $ARGUMENTS
```

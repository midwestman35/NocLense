# NocLense Claude Automation Harness

This harness drives the standalone Tauri app from the markdown runbooks in `docs/testing/runbooks/`.

## One-time setup

Install the Tauri WebDriver bridge with Cargo:

```powershell
cargo install tauri-driver --locked
```

`tauri-driver` is a dev-environment prerequisite. It is intentionally not a packaged npm dependency.

On Windows, `tauri-driver` also requires `msedgedriver.exe` on PATH, or a custom native driver path passed to `tauri-driver --native-driver`. Install the Microsoft Edge WebDriver version that matches the local Edge runtime before running `/smoke-tauri`. If the driver is not on PATH, set `TAURI_NATIVE_DRIVER_PATH` to the full `msedgedriver.exe` path before running the harness.

Install the repo dev dependencies after pulling this slice:

```powershell
npm install
```

## Run

Build the app first so the release binary exists:

```powershell
npm run tauri:build
```

Then run either the Claude slash command or WebdriverIO directly:

```text
/smoke-tauri splash
```

```powershell
$env:NOCLENSE_RUNBOOK = "splash"
npx wdio tools/claude-automation/wdio.conf.ts
```

For direct TypeScript execution:

```powershell
npx ts-node --esm tools/claude-automation/smoke-tauri.ts splash
```

Reports are written to `tools/claude-automation/reports/<timestamp>/report.md`, with screenshots beside the report.

## Platform Matrix

| Platform | Status | Notes |
|---|---|---|
| Windows | Automated | Primary 07J.3 target. |
| Linux | Automated | Supported by `tauri-driver`; binary name resolves without `.exe`. |
| macOS | Manual only | WKWebView does not expose the WebDriver protocol for this harness. Walk `docs/testing/runbooks/` manually. |

## Fixtures

Committed fixtures:

- `fixtures/small-sip.log` - small SIP happy path and trunk failover sample.
- `fixtures/medium-mixed.log` - compact mixed vendor/event sample; use the large generator when size matters.
- `fixtures/malformed.log` - truncated/error-path sample.

Generate a large local fixture under ignored `fixtures/.local/`:

```powershell
npx ts-node tools/claude-automation/fixtures/generate-large.ts
```

Pass a byte target as the first argument to override the default 110 MB output.

import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { remote, type Browser } from 'webdriverio';
import { resolveTauriBinary } from './wdio.conf.ts';

export type RoomName = 'splash' | 'dashboard' | 'import' | 'setup' | 'investigate' | 'submit';

export interface StartedApp {
  browser: Browser;
  stop: () => Promise<void>;
}

export interface StartAppOptions {
  useBuild?: boolean;
  reportRoot?: string;
}

let tauriDriver: ChildProcessWithoutNullStreams | null = null;
let activeBrowser: Browser | null = null;
let activeReportDir = '';

const roomMarkers: Record<RoomName, string[]> = {
  splash: ['aria/heading[name="NocLense"]', 'aria/button[name="Continue"]'],
  dashboard: ['aria/button[name="Open workspace"]', 'aria/button[name="New investigation"]'],
  import: ['[data-testid="import-dropzone"]', '[data-testid="import-file-input"]'],
  setup: ['aria/heading[name="Investigation Setup"]', 'aria/button[name="Continue"]'],
  investigate: ['[data-testid="correlation-graph"]', 'aria/button[name="Investigate ticket"]'],
  submit: ['aria/button[name="Export investigation as .noclense file"]', 'aria/heading[name="Submit"]'],
};

export function getReportDir(): string {
  if (!activeReportDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    activeReportDir = resolve(process.cwd(), 'tools', 'claude-automation', 'reports', stamp);
  }

  mkdirSync(activeReportDir, { recursive: true });
  return activeReportDir;
}

export async function startApp(options: StartAppOptions = {}): Promise<StartedApp> {
  if (process.platform === 'darwin') {
    throw new Error('automation not supported on macOS, walk the runbook manually');
  }

  const application = resolveTauriBinary();
  if (options.useBuild !== false && !existsSync(application)) {
    throw new Error(`Tauri release binary not found at ${application}. Run npm run tauri:build first.`);
  }

  activeReportDir = options.reportRoot ? resolve(options.reportRoot) : getReportDir();
  mkdirSync(activeReportDir, { recursive: true });

  const driverArgs = process.env.TAURI_NATIVE_DRIVER_PATH
    ? ['--native-driver', process.env.TAURI_NATIVE_DRIVER_PATH]
    : [];

  tauriDriver = spawn('tauri-driver', driverArgs, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  captureProcessLog(tauriDriver, resolve(activeReportDir, 'tauri-driver.log'));
  await Promise.race([
    waitForPort(4444, '127.0.0.1', 15_000),
    once(tauriDriver, 'exit').then(([code]) => {
      throw new Error(`tauri-driver exited before accepting connections (code ${code ?? 'unknown'})`);
    }),
  ]);

  activeBrowser = await remote({
    hostname: 'localhost',
    port: 4444,
    path: '/',
    capabilities: {
      'tauri:options': {
        application,
      },
    },
  });

  return { browser: activeBrowser, stop: stopApp };
}

export async function stopApp(): Promise<void> {
  const browser = activeBrowser;
  activeBrowser = null;

  if (browser) {
    try {
      await browser.deleteSession();
    } catch {
      // Session may already be gone if the app crashed; the driver process cleanup below still runs.
    }
  }

  const proc = tauriDriver;
  tauriDriver = null;

  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    await Promise.race([
      once(proc, 'exit'),
      sleep(2_000).then(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }),
    ]);
  }
}

export async function screenshot(name: string): Promise<string> {
  assertBrowser();
  const safeName = basename(name).replace(/[^a-z0-9._-]/gi, '-');
  const path = resolve(getReportDir(), `${safeName.endsWith('.png') ? safeName : `${safeName}.png`}`);
  await activeBrowser!.saveScreenshot(path);
  return path;
}

export async function waitForRoom(name: RoomName): Promise<void> {
  assertBrowser();
  const selectors = roomMarkers[name];
  await activeBrowser!.waitUntil(async () => {
    for (const selector of selectors) {
      const item = await activeBrowser!.$(selector);
      if (await item.isDisplayed().catch(() => false)) return true;
    }
    return false;
  }, {
    timeout: 15_000,
    timeoutMsg: `Room marker did not appear for ${name}`,
  });
}

export async function clickByRole(role: string, name: string): Promise<void> {
  assertBrowser();
  const escapedName = name.replace(/"/g, '\\"');
  const ariaSelector = `aria/${role}[name="${escapedName}"]`;
  const candidate = await activeBrowser!.$(ariaSelector);

  if (await candidate.isExisting()) {
    await candidate.click();
    return;
  }

  const domCandidate = await activeBrowser!.$(`//*[self::button or self::a or @role="${role}"][normalize-space(.)="${name}" or @aria-label="${name}"]`);
  await domCandidate.waitForDisplayed({ timeout: 5_000 });
  await domCandidate.click();
}

export async function importFile(path: string): Promise<void> {
  assertBrowser();
  const absolute = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const input = await activeBrowser!.$('input[type="file"]');
  await input.waitForExist({ timeout: 10_000 });
  await input.setValue(absolute);
}

export async function saveCredential(
  service: 'zendesk' | 'datadog' | 'jira' | 'confluence',
  fields: Record<string, string>,
): Promise<void> {
  assertBrowser();
  await waitForRoom('setup');

  const card = await activeBrowser!.$(`//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${service}")]`);
  await card.waitForDisplayed({ timeout: 10_000 });

  for (const [label, value] of Object.entries(fields)) {
    const input = await activeBrowser!.$(`//label[contains(normalize-space(.), "${label}")]/following::input[1]`);
    await input.waitForDisplayed({ timeout: 5_000 });
    await input.setValue(value);
  }

  const saveButton = await activeBrowser!.$(`//button[contains(., "Save") or contains(@aria-label, "Save")]`);
  await saveButton.waitForClickable({ timeout: 5_000 });
  await saveButton.click();
}

function assertBrowser(): void {
  if (!activeBrowser) throw new Error('NocLense automation browser is not running. Call startApp() first.');
}

function captureProcessLog(proc: ChildProcessWithoutNullStreams, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const stream = createWriteStream(path, { flags: 'a' });
  proc.stdout.pipe(stream);
  proc.stderr.pipe(stream);
}

async function waitForPort(port: number, host: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port, host)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function canConnect(port: number, host: string): Promise<boolean> {
  return new Promise((resolveCanConnect) => {
    const socket = net.connect(port, host);
    socket.once('connect', () => {
      socket.end();
      resolveCanConnect(true);
    });
    socket.once('error', () => resolveCanConnect(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolveCanConnect(false);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

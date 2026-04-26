import { resolve } from 'node:path';

export function resolveTauriBinary(): string {
  const exeName = process.platform === 'win32' ? 'noclense.exe' : 'noclense';
  const binary = resolve(process.cwd(), 'src-tauri', 'target', 'release', exeName);
  return binary;
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: [resolve(process.cwd(), 'tools', 'claude-automation', 'smoke-runner.ts')],
  hostname: 'localhost',
  port: 4444,
  path: '/',
  logLevel: 'info',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 120_000,
  },
  capabilities: [
    {
      'tauri:options': {
        application: resolveTauriBinary(),
      },
    },
  ],
};

export default config;

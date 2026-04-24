import { runRunbook } from './runbook-runner.ts';

describe('NocLense runbook smoke', () => {
  it('runs the requested runbook', async () => {
    const runbook = process.env.NOCLENSE_RUNBOOK ?? 'splash';
    const exitCode = await runRunbook(runbook);
    if (exitCode !== 0) {
      throw new Error(`/smoke-tauri ${runbook} failed`);
    }
  });
});

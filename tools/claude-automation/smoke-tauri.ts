import { runRunbook } from './runbook-runner.ts';

const runbook = process.argv[2] ?? 'splash';
runRunbook(runbook)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

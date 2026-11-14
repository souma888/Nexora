import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('coverage', { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    '--experimental-test-coverage',
    '--test',
    '--test-concurrency=2',
    '--test-coverage-include=backend/**',
    '--test-coverage-include=api/**',
    '--test-reporter=spec',
    '--test-reporter=lcov',
    '--test-reporter-destination=stdout',
    '--test-reporter-destination=coverage/lcov.info',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;

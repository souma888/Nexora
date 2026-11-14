import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// Optional ML/3D libraries create large syntax trees. Limit native bundler
// concurrency so the build also works on memory-constrained developer machines.
const result = spawnSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build'], {
  stdio: 'inherit',
  env: { ...process.env, RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? '1' },
});
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else await import('./build-platform.mjs');

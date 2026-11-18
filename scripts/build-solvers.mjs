import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
await build({
  configFile: false,
  build: {
    outDir: resolve('packages/solvers/dist'),
    emptyOutDir: true,
    lib: {
      entry: resolve('packages/solvers/entry.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
});
await copyFile('LICENSE', 'packages/solvers/LICENSE');
await copyFile('THIRD_PARTY_NOTICES.md', 'packages/solvers/THIRD_PARTY_NOTICES.md');
await copyFile(
  'frontend/public/steam-library-license.txt',
  'packages/solvers/steam-library-license.txt',
);

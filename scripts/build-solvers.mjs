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

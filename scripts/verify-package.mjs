import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run package:check.');
const run = (args, cwd = process.cwd()) => {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr + result.stdout);
  return result.stdout;
};
await import('./build-solvers.mjs');
await mkdir('tmp/package-consumer', { recursive: true });
const packed = JSON.parse(
  run([
    npm,
    'pack',
    './packages/solvers',
    '--ignore-scripts',
    '--pack-destination',
    'tmp',
    '--json',
  ]),
);
const archive = resolve('tmp', packed[0].filename),
  cwd = resolve('tmp/package-consumer');
await writeFile(resolve(cwd, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
run([npm, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', archive], cwd);
await writeFile(
  resolve(cwd, 'check.mjs'),
  `import assert from 'node:assert/strict';import {solveLab,solveTruss,convert,listLabs} from '@souma88/solvers';assert.equal(solveLab('divider',{voltage:12,upper:10,lower:10,load:10}).summary.loaded,4);assert.equal(convert(1,'kN/m²','Pa'),1000);assert.ok(listLabs().some((lab)=>lab.id==='trussfem'));assert.equal(typeof solveTruss,'function');console.log('Packed ESM consumer passed.');`,
);
console.log(run([resolve(cwd, 'check.mjs')], cwd));
await writeFile(
  resolve(cwd, 'check.ts'),
  `import {solveTruss,solveLab,convert} from '@souma88/solvers';solveLab('divider',{voltage:{value:12000,unit:'mV'},upper:10,lower:10,load:10});const x:number=convert(1,'kN','N');void x;\n// @ts-expect-error matrix source must be JSON text\nsolveTruss(42);`,
);
run([
  resolve('node_modules/typescript/bin/tsc'),
  '--ignoreConfig',
  '--noEmit',
  '--strict',
  '--target',
  'es2022',
  '--module',
  'nodenext',
  '--moduleResolution',
  'nodenext',
  '--types',
  'node',
  '--skipLibCheck',
  resolve(cwd, 'check.ts'),
]);
const info = await readFile('packages/solvers/package.json', 'utf8');
console.log(`Verified ${JSON.parse(info).name}: packed runtime and TypeScript consumer.`);

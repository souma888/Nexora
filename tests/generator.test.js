import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newLab } from '../scripts/new-lab.mjs';
test('lab generator refuses collisions and adds a runnable reference plus registry entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nexora-generator-'));
  await mkdir(join(root, 'backend'));
  await writeFile(join(root, 'backend/custom-labs.js'), 'export const customModels = {};\n');
  const paths = await newLab('samplelab', 'mechanical', root, true);
  assert.equal(paths.length, 3);
  await assert.rejects(() => readFile(paths[0]), { code: 'ENOENT' });
  await newLab('samplelab', 'mechanical', root);
  const module = await readFile(paths[0], 'utf8'),
    registry = await readFile(paths[2], 'utf8'),
    reference = await readFile(paths[1], 'utf8');
  assert.match(module, /force:stiffness\*displacement/);
  assert.match(registry, /samplelab,/);
  assert.match(reference, /summary.force,10/);
  await assert.rejects(() => newLab('samplelab', 'mechanical', root), /overwrite/);
  await assert.rejects(() => newLab('../escape', 'mechanical', root), /identifier/);
  await assert.rejects(() => newLab('unusedlab', 'unknown', root), /discipline/);
  await assert.rejects(() => newLab('trussfem', 'civil', root), /already exists/);
});

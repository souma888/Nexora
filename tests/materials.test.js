import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../api/materials.js';

const run = (model, input) => POST(new Request('http://localhost/api/materials', {
  method: 'POST', body: JSON.stringify({ model, input }),
}));

test('axial benchmark preserves tension and compression signs', async () => {
  for (const sign of [-1, 1]) {
    const response = await run('axial', { force: sign * 50, length: 2, area: 500, modulus: 200 });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).summary, {
      stress: sign * 100, strain: sign * 0.0005, displacement: sign,
    });
  }
});

test('plane stress benchmark recovers the principal values and orientation', async () => {
  const response = await run('mohr', { sigmaX: 80, sigmaY: 20, tauXY: 40 });
  assert.equal(response.status, 200);
  const { summary } = await response.json();
  assert.equal(summary.principalMax, 100);
  assert.equal(summary.principalMin, 0);
  assert.equal(summary.radius, 50);
  assert.ok(Math.abs(summary.principalAngle - 26.565051177) < 1e-9);
});

test('equal biaxial stress has no unique principal orientation', async () => {
  const response = await run('mohr', { sigmaX: -20, sigmaY: -20, tauXY: 0 });
  const { summary } = await response.json();
  assert.equal(summary.principalAngle, null);
  assert.equal(summary.principalMax, -20);
  assert.equal(summary.radius, 0);
});

test('materials API rejects invalid geometry and unknown models', async () => {
  assert.equal((await run('axial', { force: 1, length: 2, area: 0, modulus: 200 })).status, 422);
  assert.equal((await run('unknown', {})).status, 422);
});

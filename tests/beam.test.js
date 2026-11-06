import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../api/beam.js';

const run = body => POST(new Request('http://localhost/api/beam', {
  method: 'POST', body: JSON.stringify(body),
}));
const inputs = { span: 6, load: 24, modulus: 200, inertia: 8000 };
const references = [
  { model: 'point', reactions: [12, 12], moment: 36, deflection: -6.75, at: 3, slope: 3.375 },
  { model: 'uniform', reactions: [72, 72], moment: 108, deflection: -25.3125, at: 3, slope: 13.5 },
  { model: 'cantilever', reactions: [24, null], moment: -144, deflection: -108, at: 6, slope: -27 },
];

for (const { model, reactions, moment, deflection, at, slope } of references) {
  test(`matches the closed-form ${model} benchmark`, async () => {
    const response = await run({ ...inputs, case: model });
    assert.equal(response.status, 200);
    const { summary, series } = await response.json();
    assert.deepEqual([summary.reactionA, summary.reactionB], reactions);
    assert.equal(summary.moment, moment);
    assert.ok(Math.abs(summary.deflection - deflection) < 1e-9);
    assert.equal(summary.deflectionAt, at);
    assert.equal(series[0].deflection, 0);
    assert.ok(Math.abs(series.at(-1).slope - slope) < 1e-9);
    if (model === 'point') {
      const limits = series.filter(point => point.x === 3);
      assert.deepEqual(limits.map(point => point.shear), [12, -12]);
    }
  });
}

test('rejects out-of-domain inputs and unsupported cases', async () => {
  assert.equal((await run({ ...inputs, case: 'point', span: 0 })).status, 422);
  assert.equal((await run({ ...inputs, case: ['point'] })).status, 422);
  assert.equal((await run({ ...inputs, case: 'other' })).status, 422);
});

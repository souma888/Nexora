import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, POST } from '../api/waves.js';

const { models } = await GET().json();
const request = async (model, overrides = {}) => {
  const { inputs } = models.find(definition => definition.id === model);
  const defaults = Object.fromEntries(Object.entries(inputs).map(([key, field]) => [key, field.initial]));
  return POST(new Request('http://localhost/api/waves', {
    method: 'POST', body: JSON.stringify({ model, input: { ...defaults, ...overrides } }),
  }));
};

test('equal 10 kΩ resistors give 6 V unloaded and 4 V with a 10 kΩ load', async () => {
  const { summary } = await request('divider').then(response => response.json());
  assert.deepEqual(summary, { loaded: 4, unloaded: 6, current: 0.4 });
});

test('RC starts at zero and reaches about 63.2% of the supply at one time constant', async () => {
  const { summary, series } = await request('rc').then(response => response.json());
  assert.equal(summary.tau, 1000);
  assert.equal(series[0].y, 0);
  assert.ok(Math.abs(series.find(point => point.x === 1000).y - 3.1606) < 0.0001);
});

test('rectifier blocks the entire waveform below the forward drop', async () => {
  const nominal = await request('rectifier').then(response => response.json());
  assert.equal(nominal.summary.peak, 4.3);
  const blocked = await request('rectifier', { amplitude: 0.5 }).then(response => response.json());
  assert.equal(blocked.summary.conduction, 0);
  assert.ok(blocked.series.every(point => point.y === 0));
});

test('inverting op-amp clips in both directions and retains linear gain inside the limits', async () => {
  for (const [voltage, expected] of [[1, -5], [-1, 5], [0.2, -2]]) {
    const { summary } = await request('opamp', { voltage }).then(response => response.json());
    assert.equal(summary.output, expected);
    assert.equal(summary.threshold, 0.5);
  }
});

test('8 Hz and 4 Hz cosines agree at every sample instant when sampled at 12 Hz', async () => {
  const { summary, series } = await request('sampling').then(response => response.json());
  assert.deepEqual(summary, { nyquist: 6, alias: 4, count: 13 });
  const markers = series.filter(point => Number.isFinite(point.sample));
  assert.equal(markers.length, 13);
  assert.ok(markers.every(point => Math.abs(point.sample - point.reference) < 1e-12));
});

test('four-sample moving average ramps in quarters and rejects fractional windows', async () => {
  const { series } = await request('average').then(response => response.json());
  assert.deepEqual(series.filter(point => point.x >= -1 && point.x <= 3).map(point => point.y),
    [0, 0.25, 0.5, 0.75, 1]);
  const invalid = await request('average', { window: 2.5 });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).field, 'window');
});

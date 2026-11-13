import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, POST } from '../api/waves.js';

const { models } = await GET().json();
const request = async (model, overrides = {}) => {
  const { inputs } = models.find((definition) => definition.id === model);
  const defaults = Object.fromEntries(
    Object.entries(inputs).map(([key, field]) => [key, field.initial]),
  );
  return POST(
    new Request('http://localhost/api/waves', {
      method: 'POST',
      body: JSON.stringify({ model, input: { ...defaults, ...overrides } }),
    }),
  );
};

test('equal 10 kΩ resistors give 6 V unloaded and 4 V with a 10 kΩ load', async () => {
  const { summary } = await request('divider').then((response) => response.json());
  assert.deepEqual(summary, { loaded: 4, unloaded: 6, current: 0.4 });
});

test('RC starts at zero and reaches about 63.2% of the supply at one time constant', async () => {
  const { summary, series } = await request('rc').then((response) => response.json());
  assert.equal(summary.tau, 1000);
  assert.equal(series[0].y, 0);
  assert.ok(Math.abs(series.find((point) => point.x === 1000).y - 3.1606) < 0.0001);
});

test('rectifier blocks the entire waveform below the forward drop', async () => {
  const nominal = await request('rectifier').then((response) => response.json());
  assert.equal(nominal.summary.peak, 4.3);
  const blocked = await request('rectifier', { amplitude: 0.5 }).then((response) =>
    response.json(),
  );
  assert.equal(blocked.summary.conduction, 0);
  assert.ok(blocked.series.every((point) => point.y === 0));
});

test('inverting op-amp clips in both directions and retains linear gain inside the limits', async () => {
  for (const [voltage, expected] of [
    [1, -5],
    [-1, 5],
    [0.2, -2],
  ]) {
    const { summary } = await request('opamp', { voltage }).then((response) => response.json());
    assert.equal(summary.output, expected);
    assert.equal(summary.threshold, 0.5);
  }
});

test('8 Hz and 4 Hz cosines agree at every sample instant when sampled at 12 Hz', async () => {
  const { summary, series } = await request('sampling').then((response) => response.json());
  assert.deepEqual(summary, { nyquist: 6, alias: 4, count: 13 });
  const markers = series.filter((point) => Number.isFinite(point.sample));
  assert.equal(markers.length, 13);
  assert.ok(markers.every((point) => Math.abs(point.sample - point.reference) < 1e-12));
});

test('four-sample moving average ramps in quarters and rejects fractional windows', async () => {
  const { series } = await request('average').then((response) => response.json());
  assert.deepEqual(
    series.filter((point) => point.x >= -1 && point.x <= 3).map((point) => point.y),
    [0, 0.25, 0.5, 0.75, 1],
  );
  const invalid = await request('average', { window: 2.5 });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).field, 'window');
});

const solve = (model, input) => request(model, input).then((response) => response.json());
const closeTo = (actual, expected, tolerance) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} ≈ ${expected}`);
};

test('Euler buckling follows the inverse square of effective length', async () => {
  const pinned = await solve('buckling');
  closeTo(pinned.summary.critical, 493.4802, 0.0001);
  const cantilever = await solve('buckling', { factor: 2 });
  assert.equal(cantilever.summary.critical, pinned.summary.critical / 4);
});

test('a surface-level gate has its resultant at two-thirds of the height', async () => {
  const { summary, series } = await solve('hydrostatic');
  closeTo(summary.force, 58.86, 1e-9);
  closeTo(summary.center, 4 / 3, 1e-9);
  assert.equal(series[0].y, 0);
});

test('doubling shaft diameter cuts twist by sixteen and shear stress by eight', async () => {
  const { summary } = await solve('torsion');
  const doubled = await solve('torsion', { diameter: 80 });
  closeTo(summary.twist, 0.569932, 0.00001);
  closeTo(doubled.summary.twist, summary.twist / 16, 1e-12);
  closeTo(doubled.summary.stress, summary.stress / 8, 1e-12);
});

test('the released mass returns to the starting position after one period', async () => {
  const { summary, series } = await solve('oscillator');
  closeTo(summary.period, 0.628319, 0.000001);
  closeTo(summary.energy, 0.125, 1e-12);
  closeTo(series[80].y, 50, 1e-9);
  closeTo(series[40].y, -50, 1e-9);
});

test('the RL circuit reaches 1.264 A after 10 ms', async () => {
  const { summary, series } = await solve('rl');
  assert.equal(summary.tau, 10);
  assert.equal(summary.final, 2);
  closeTo(series[48].y, 1.264241, 0.000001);
});

test('at series resonance the inductor and capacitor reactances cancel', async () => {
  const { summary, series } = await solve('resonance');
  closeTo(summary.resonance, 159.15494, 0.00001);
  assert.equal(summary.peak, 0.5);
  closeTo(series[120].y, 0.5, 1e-12);
  closeTo(series[120].reference, 0.353553, 0.000001);
});

test('the low-pass filter is 0.707 at cutoff and has unity DC gain', async () => {
  const { summary, series } = await solve('lowpass', { frequency: 5000 / Math.PI });
  closeTo(summary.cutoff, 1591.5494, 0.0001);
  closeTo(summary.gain, 0.7071068, 0.000001);
  closeTo(summary.phase, -45, 1e-10);
  assert.equal(series[0].y, 1);
});

test('the bridge repeats at twice the frequency and an ideal bridge averages 2A/π', async () => {
  const { summary, series } = await solve('bridge', { drop: 0 });
  assert.equal(summary.ripple, 100);
  closeTo(summary.average, 10 / Math.PI, 1e-12);
  closeTo(series[30].y, series[90].y, 1e-12);
  const blocked = await solve('bridge', { amplitude: 1 });
  assert.equal(blocked.summary.ripple, null);
  assert.ok(blocked.series.every((point) => point.y === 0));
});

test('unequal rectangular pulses convolve into a trapezoid of the expected area', async () => {
  const { summary, series } = await solve('convolution', {
    widthA: 1,
    widthB: 3,
    heightA: 2,
    heightB: 1,
  });
  assert.deepEqual(summary, { peak: 2, duration: 4, area: 6 });
  assert.deepEqual(series.slice(1, 5), [
    { x: 0, y: 0 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 0 },
  ]);
});

test('two tones have a beat frequency equal to their difference, with no beats at equal frequency', async () => {
  const { summary } = await solve('beats');
  assert.deepEqual(summary, { beat: 2, carrier: 9, peak: 2 });
  const same = await solve('beats', { second: 8 });
  assert.equal(same.summary.beat, 0);
  assert.ok(same.series.every((point) => point.reference === 2));
});

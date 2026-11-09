import assert from 'node:assert/strict';
import test from 'node:test';
import { controlModels } from '../backend/control-experiments.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';

const defaults = id => Object.fromEntries(Object.entries(controlModels[id].definition.inputs).map(([key, f]) => [key, f.initial]));
const solve = (id, overrides = {}) => controlModels[id].solve({ ...defaults(id), ...overrides });
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const at = (result, time) => result.series.reduce((best, p) => Math.abs(p.x - time) < Math.abs(best.x - time) ? p : best).y;

test('first-order response reaches 1 − e^-1 after one time constant', () => {
  near(at(solve('firstorder'), 1), 1 - Math.exp(-1));
  near(solve('firstorder', { gain: 2 }).summary.final, 2 * (1 - Math.exp(-5)));
});
test('second-order solution covers undamped, critical and overdamped limits', () => {
  near(at(solve('secondorder', { damping: 0 }), 1), 1 - Math.cos(2));
  near(at(solve('secondorder', { damping: 1 }), 1), 1 - 3 * Math.exp(-2));
  near(at(solve('secondorder', { damping: 2 }), 1), 0.36963997772, 1e-10);
  const expectedPeak = 1 + Math.exp(-0.3 * Math.PI / Math.sqrt(1 - 0.3 ** 2));
  near(solve('secondorder').summary.peak, expectedPeak, 0.0003);
});
test('PID RK4 reproduces a critically damped proportional/derivative closed form', () => {
  const result = solve('pid', { kp: 3, ki: 0, kd: 3 });
  near(at(result, 1), 0.75 * (1 - 3 * Math.exp(-2)), 1e-10);
  assert.ok(solve('pid', { kp: 0, ki: 0, kd: 0 }).series.every(p => p.y === 0));
});
test('motor converges to the equilibrium from independent torque and voltage balances', () => {
  near(solve('motor').summary.final, 0.01 * 20 / (0.1 + 0.01 ** 2 + 0.01 * 20), 1e-7);
  assert.equal(solve('motor', { gain: 0 }).summary.final, 0);
});
test('cruise equilibrium is mass independent while its time scale changes', () => {
  const a = solve('cruise'), b = solve('cruise', { mass: 2000 });
  near(a.summary.final, 20 * 100 / 150 * (1 - Math.exp(-6)));
  near(b.summary.final, a.summary.final); near(b.series.at(-1).x, 2 * a.series.at(-1).x);
});
test('tank feedback follows the flow balance and zero gain supplies no water', () => {
  near(solve('tank').summary.final, 2 / 3 * (1 - Math.exp(-6)));
  assert.equal(solve('tank', { gain: 0 }).summary.final, 0);
});
test('thermal proportional-only response matches its scalar closed form', () => {
  near(at(solve('thermal', { ki: 0 }), 1), 0.8 * (1 - Math.exp(-2.5)), 1e-10);
  assert.ok(Math.abs(solve('thermal').summary.error) < 0.01);
});
test('pendulum at gravity-cancelling gain and zero damping holds its angle', () => {
  const result = solve('pendulum', { kp: 9.81, kd: 0 });
  assert.ok(result.series.every(p => p.y === 3));
  assert.ok(Math.abs(solve('pendulum').summary.final) < 0.01);
});
test('antiwindup reduces the post-drop integral recovery delay', () => {
  const off = solve('windup', { antiwindup: 0 }), on = solve('windup');
  near(at(on, 4), 1 - Math.exp(-4), 1e-8);
  assert.ok(Math.abs(at(on, 8) - 0.5) < Math.abs(at(off, 8) - 0.5));
  assert.ok(on.series.every(p => p.y <= 1 + 1e-8));
});
test('Bode corner is −3.0103 dB and shifts inversely with time constant', () => {
  near(solve('bode').summary.atCorner, -3.01029995664, 1e-10);
  assert.equal(solve('bode', { tau: 2 }).summary.corner, 0.5);
});
test('lead and lag phase peaks have opposite signs and the geometric-mean frequency', () => {
  near(solve('lead').summary.phase, 41.8103148958, 1e-9);
  near(solve('lag').summary.phase, -41.8103148958, 1e-9);
  near(solve('lead').summary.frequency, Math.sqrt(5));
  near(solve('lag').summary.highGain, 0.2);
});
test('pole locus has −1 ± j√3 at gain 4 and real roots at low gain', () => {
  const p = solve('poles'); near(p.summary.real, -1); near(p.summary.imaginary, Math.sqrt(3));
  near(solve('poles', { gain: 0 }).summary.real, 0);
  assert.equal(p.series.filter(p => Number.isFinite(p.sample)).length, 2);
});
test('Nyquist points lie on the K/2 circle and tau changes corner frequency', () => {
  const result = solve('nyquist');
  for (const p of result.series) near((p.x - 1) ** 2 + p.y ** 2, 1);
  near(solve('nyquist', { tau: 2 }).summary.frequency, 0.5);
});
test('digital zero pole settles in one update and unstable mode alternates', () => {
  const stable = solve('digital'); near(stable.series[1].y, 0.8); near(stable.series[30].y, 0.8);
  const unstable = solve('digital', { gain: 3, memory: 0 });
  assert.ok(unstable.series[29].y > 1e10); assert.ok(unstable.series[30].y < -1e10);
});
test('all 15 control models have finite outputs at defaults and individual input bounds', async () => {
  assert.equal(Object.keys(controlModels).length, 15);
  for (const [id, { definition }] of Object.entries(controlModels)) {
    for (const [key, field] of Object.entries(definition.inputs)) for (const value of [field.min, field.max]) {
      const input = { ...defaults(id), [key]: value };
      assert.ok(validate(definition, input).values);
      const result = controlModels[id].solve(input);
      assert.ok(Object.values(result.summary).every(Number.isFinite), `${id}: summary at ${key}=${value}`);
      assert.ok(result.series.every(p => Object.values(p).every(Number.isFinite)), `${id}: series`);
    }
    const response = await POST(new Request('http://localhost/api/waves', { method: 'POST', body: JSON.stringify({ model: id, input: defaults(id) }) }));
    assert.equal(response.status, 200);
    const json = await response.json(); assert.equal(json.version, '1.0'); assert.ok(json.units);
    const key = Object.keys(definition.inputs)[0];
    const invalid = await POST(new Request('http://localhost/api/waves', { method: 'POST', body: JSON.stringify({ model: id, input: { ...defaults(id), [key]: definition.inputs[key].max + 1 } }) }));
    assert.equal(invalid.status, 422); assert.equal((await invalid.json()).field, key);
  }
});

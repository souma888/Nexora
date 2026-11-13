import assert from 'node:assert/strict';
import test from 'node:test';
import { communicationModels } from '../backend/communications.js';
import { energyModels, pvOperatingPoint } from '../backend/power-energy.js';
import { aerospaceModels, standardAtmosphere, isentropic } from '../backend/aerospace.js';
import { chemicalModels } from '../backend/chemical-process.js';
import { industrialModels } from '../backend/industrial.js';
import { validate } from '../backend/contract.js';
import { GET, POST } from '../api/waves.js';

const expansionModels = {
  ...communicationModels,
  ...energyModels,
  ...aerospaceModels,
  ...chemicalModels,
  ...industrialModels,
};
const defaults = (id) =>
  Object.fromEntries(
    Object.entries(expansionModels[id].definition.inputs).map(([key, f]) => [key, f.initial]),
  );
const solve = (id, overrides = {}) => expansionModels[id].solve({ ...defaults(id), ...overrides });
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);
const integrate = (points, fn) =>
  points
    .slice(1)
    .reduce((sum, p, i) => sum + ((p.x - points[i].x) * (fn(p) + fn(points[i]))) / 2, 0);

test('AM signal mean-square power agrees with a numerical cycle integral; overmodulation is explicit', () => {
  const r = solve('amradio');
  near(integrate(r.series, (p) => p.y ** 2) / r.series.at(-1).x / 50, 0.045, 1e-10);
  near(r.summary.power, 0.045);
  near(r.summary.minimum, 1);
  near(r.summary.efficiency, 100 / 9);
  assert.ok(solve('amradio', { index: 1.25 }).warnings.length);
  near(solve('amradio', { index: 0 }).summary.power, 0.04);
});
test('FM zero deviation equals its reference and Carson bandwidth matches a known tone', () => {
  const r = solve('fmradio');
  assert.deepEqual(r.summary, { beta: 2, bandwidth: 12, minimum: 26 });
  const zero = solve('fmradio', { deviation: 0 });
  assert.ok(zero.series.every((p) => p.y === p.reference));
  assert.ok(r.series.every((p) => Math.abs(p.y) <= 2));
});
test('BPSK has antipodal symbols and independently integrated bit energy', () => {
  const r = solve('bpsk', { bits: '0,1' }),
    half = r.series.at(-1).x / 2;
  for (const p of r.series) {
    const bit = p.x < half ? 0 : 1;
    near(p.y, (bit ? -1 : 1) * p.other);
  }
  near(integrate(r.series, (p) => p.y * p.y) / 2, 25, 0.01);
  near(r.summary.energy, 25);
  near(r.summary.carrier, 60);
});
test('QPSK has constant complex energy and adjacent Gray labels differ by one bit', () => {
  const r = solve('qpsk', { symbols: '0,1,3,2' });
  near(r.summary.energy, 50);
  near(r.summary.bitrate, 40);
  for (const p of r.series) near(p.y * p.y + p.reference * p.reference, 1);
  const labels = r.table.rows.map((row) => row[1]);
  for (let i = 0; i < 4; i++)
    assert.equal([...labels[i]].filter((b, j) => b !== labels[(i + 1) % 4][j]).length, 1);
  assert.deepEqual(
    r.table.rows.map((row) => row.at(-1)),
    [45, 135, 225, 315],
  );
});
test('Friis loss matches the 2.4 GHz/1 km reference and inverse-square distance scaling', () => {
  const r = solve('radiolink');
  near(r.summary.pathloss, 100.0520080561155, 1e-8);
  near(r.summary.received, -78.0520080561155);
  near(
    r.summary.received - solve('radiolink', { distance: 2 }).summary.received,
    20 * Math.log10(2),
  );
  near(
    r.summary.received - solve('radiolink', { frequency: 4800 }).summary.received,
    20 * Math.log10(2),
  );
  assert.ok(solve('radiolink', { distance: 20 }).warnings.length);
});
test('Shannon capacity is one bit/s/Hz at 0 dB and scales linearly with fixed-SNR bandwidth', () => {
  const r = solve('shannon', { snr: 0 });
  near(r.summary.capacity, 0.1);
  near(r.summary.efficiency, 1);
  near(r.summary.linear, 1);
  near(
    solve('shannon', { bandwidth: 200 }).summary.capacity,
    2 * solve('shannon').summary.capacity,
  );
  assert.ok(r.series.every((p, i) => !i || p.y > r.series[i - 1].y));
});
test('ideal PV endpoints, stationarity and dense independent power scan agree with MPP', () => {
  const input = defaults('solarpv'),
    p = pvOperatingPoint(input),
    r = solve('solarpv');
  near(p.at(0), 5);
  near(p.at(p.open), 0);
  near(p.open, 20);
  const h = 1e-4,
    dp = ((p.voltage + h) * p.at(p.voltage + h) - (p.voltage - h) * p.at(p.voltage - h)) / (2 * h);
  near(dp, 0, 1e-7);
  let brute = 0;
  for (let i = 0; i <= 100000; i++) {
    const v = (20 * i) / 100000;
    const current = 5 * (1 - (Math.exp(v) - 1) / (Math.exp(20) - 1));
    brute = Math.max(brute, v * current);
  }
  near(r.summary.power, brute, 1e-7);
  assert.ok(r.summary.fill > 0 && r.summary.fill < 100);
  const half = pvOperatingPoint({ ...input, irradiance: 500 });
  near(half.isc, p.isc / 2);
  assert.ok(half.open < p.open);
});
test('wind power is cubic in speed, quadratic in radius and bounded by Betz', () => {
  const r = solve('windpower');
  near(solve('windpower', { speed: 20 }).summary.electric, 8 * r.summary.electric);
  near(solve('windpower', { radius: 10 }).summary.electric, 4 * r.summary.electric);
  assert.ok(r.series.every((p) => p.y <= p.reference));
  near(solve('windpower', { speed: 0 }).summary.electric, 0);
  near(
    solve('windpower', { coefficient: 16 / 27, efficiency: 1 }).summary.electric,
    (r.summary.available * 16) / 27,
  );
});
test('battery charge and delivered-energy integrals conserve energy through cutoff', () => {
  const r = solve('batterydischarge');
  near(r.summary.energy, 14.48);
  near(r.summary.runtime, 2.5);
  near(r.summary.soc, 20);
  near(
    integrate(r.series, (p) => 2 * p.y),
    r.summary.energy,
  );
  const cutoff = solve('batterydischarge', { duration: 5 });
  near(cutoff.summary.soc, 0);
  near(cutoff.summary.energy, 17.5);
  near(cutoff.series.at(-1).y, 0);
  assert.ok(cutoff.warnings.length);
  const idle = solve('batterydischarge', { current: 0 });
  assert.equal(idle.summary.runtime, null);
  near(idle.summary.energy, 0);
  near(idle.summary.soc, 100);
  near(
    solve('batterydischarge', { resistance: 0 }).summary.energy - r.summary.energy,
    2 ** 2 * 0.05 * 2,
  );
});
for (const boost of [false, true])
  test(`${boost ? 'boost' : 'buck'} CCM obeys inductor volt-second balance and ripple slopes`, () => {
    const id = boost ? 'boostconverter' : 'buckconverter',
      r = solve(id),
      input = defaults(id),
      vo = r.summary.output,
      d = input.duty,
      vin = input.voltage;
    near((boost ? vin : vin - vo) * d + (boost ? vin - vo : -vo) * (1 - d), 0);
    const mean = r.table.rows[2][1];
    near(integrate(r.series, (p) => p.y) / (r.series.at(-1).x - r.series[0].x), mean);
    near(
      Math.max(...r.series.map((p) => p.y)) - Math.min(...r.series.map((p) => p.y)),
      r.summary.ripple,
    );
    near(
      r.series[1].y - r.series[0].y,
      (((boost ? vin : vin - vo) / (input.inductance / 1000)) * (r.series[1].x - r.series[0].x)) /
        1e6,
    );
    if (boost) near(vin * mean, vo * r.summary.current);
    assert.ok(solve(id, { resistance: 100, inductance: 0.1, frequency: 1 }).warnings.length);
  });
test('balanced three-phase instantaneous power sums to active power and leading Q is negative', () => {
  for (const kind of ['leading', 'lagging']) {
    const r = solve('threephase', { kind }),
      s = r.summary;
    for (const p of r.series) near(p.y + p.reference + p.other, s.active);
    near(s.active * s.active + s.reactive * s.reactive, s.apparent * s.apparent);
    assert.equal(Math.sign(s.reactive), kind === 'leading' ? -1 : 1);
  }
  near(solve('threephase', { factor: 1 }).summary.reactive, 0);
  near(solve('threephase', { current: 0 }).summary.active, 0);
});
test('ballistic flight lands exactly and complementary level-ground angles have equal range', () => {
  const r = solve('ballistic');
  near(r.summary.range, 50 ** 2 / 9.80665);
  near(r.series.at(-1).y, 0);
  near(
    solve('ballistic', { angle: 30 }).summary.range,
    solve('ballistic', { angle: 60 }).summary.range,
  );
  assert.ok(solve('ballistic', { height: 50 }).summary.time > r.summary.time);
  near(r.series.at(-1).x, r.summary.range);
});
test('drag polar maintains lift and has equal induced/parasite drag at minimum drag speed', () => {
  const r = solve('dragpolar');
  for (const p of r.series) near(p.y, p.reference + p.other);
  const speed = r.table.rows.find((row) => String(row[0]).includes('Minimum'))?.[1];
  assert.ok(Number.isFinite(speed));
  const at = solve('dragpolar', { speed });
  near(at.summary.drag / 2, 0.5 * 1.225 * speed ** 2 * 16 * 0.025);
  near(r.summary.lift * 0.5 * 1.225 * 50 ** 2 * 16, 10000);
  assert.ok(solve('dragpolar', { speed: 20 }).warnings.length);
});
test('coordinated bank turn closes its circle and satisfies v=Rω and n cosφ=1', () => {
  const r = solve('bankturn');
  near((r.summary.radius * r.summary.rate * Math.PI) / 180, 50);
  near(r.summary.load * Math.cos(Math.PI / 6), 1);
  near(r.series.at(-1).y, 0);
  near(r.series.at(-1).reference, 0);
  assert.ok(solve('bankturn', { speed: 20, bank: 75 }).warnings.length);
});
test('rocket equation matches a mass-ratio-two case and scales with specific impulse', () => {
  const r = solve('rocketequation');
  near(r.summary.delta, 9.80665 * 300 * Math.log(2));
  near(r.summary.fraction, 50);
  near(solve('rocketequation', { impulse: 150 }).summary.delta, r.summary.delta / 2);
});
test('standard troposphere matches sea-level and 11 km references and ideal-gas consistency', () => {
  const sea = standardAtmosphere(0),
    top = standardAtmosphere(11000);
  near(sea.pressure, 101325);
  near(sea.density, 1.225, 1e-7);
  near(top.temperature, 216.65);
  near(top.pressure, 22632.04, 0.1);
  for (let h = 0; h <= 11000; h += 100) {
    const p = standardAtmosphere(h);
    near(p.density * 287.05287 * p.temperature, p.pressure, 1e-8);
    if (h) assert.ok(p.pressure < standardAtmosphere(h - 100).pressure);
  }
});
test('isentropic sonic condition and Mach-two ratios match textbook references', () => {
  const sonic = isentropic(1, 1.4);
  near(sonic.area, 1);
  near(sonic.temperature, 5 / 6);
  near(sonic.pressure, 0.5282817877, 1e-10);
  const supersonic = isentropic(2, 1.4);
  near(supersonic.area, 1.6875);
  near(supersonic.pressure, 0.1278045255, 1e-10);
  for (const m of [0.1, 0.5, 1, 2, 3]) {
    const p = isentropic(m, 1.4);
    assert.ok(p.area >= 1 - 1e-12);
    near(p.pressure / p.density, p.temperature);
  }
});
test('first-order CSTR/PFR conversion and reactor volume match independent Da=1 balances', () => {
  const tank = solve('reactorconversion'),
    plug = solve('reactorconversion', { reactor: 'pfr' });
  near(tank.summary.conversion, 50);
  near(plug.summary.conversion, 100 * (1 - 1 / Math.E));
  near(tank.summary.volume, 10);
  near(tank.summary.outlet, 0.5);
  assert.ok(plug.series.every((p) => p.y >= p.reference));
});
test('Arrhenius returns its reference constant and activation energy doubles the log ratio', () => {
  const r = solve('arrhenius'),
    same = solve('arrhenius', { temperature: 300 });
  near(same.summary.rate, 0.1);
  near(same.summary.multiplier, 1);
  near(solve('arrhenius', { activation: 100 }).summary.multiplier, r.summary.multiplier ** 2);
  near(r.summary.half * r.summary.rate, Math.LN2);
  const slopes = r.series.slice(1).map((p, i) => (p.y - r.series[i].y) / (p.x - r.series[i].x));
  assert.ok(slopes.every((s) => Math.abs(s - slopes[0]) < 1e-8));
});
test('consecutive reactions conserve total concentration including the equal-rate analytical limit', () => {
  for (const second of [0.1, 0.2, 0.20000000001, 1]) {
    const r = solve('consecutive', { second });
    for (const p of r.series) {
      near(p.y + p.reference + p.other, 1);
      assert.ok(Math.min(p.y, p.reference, p.other) >= -1e-12);
    }
  }
  const eq = solve('consecutive', { second: 0.2 });
  const at = eq.series.find((p) => p.x === 5);
  near(at.reference, 1 / Math.E);
  near(eq.summary.peak, 1 / Math.E);
  const a = solve('consecutive', { second: 0.2 }),
    b = solve('consecutive', { second: 0.20000000001 });
  a.series.forEach((p, i) => near(p.reference, b.series[i].reference, 1e-9));
});
test('mixing tank reaches 63.2% after one residence time and satisfies integral mass balance', () => {
  const r = solve('mixingtank', { duration: 10 });
  near(r.summary.final, 1 - 1 / Math.E);
  near(r.summary.tau, 10);
  near(10 * 10 - integrate(r.series, (p) => 10 * p.y), 100 * r.summary.final, 0.001);
  assert.ok(solve('mixingtank', { initial: 1, feed: 1 }).series.every((p) => p.y === 1));
  near(solve('mixingtank', { initial: 1, feed: 0, duration: 10 }).summary.final, 1 / Math.E);
});
test('Langmuir half-saturation, clean reservoir and finite capacity are respected', () => {
  const r = solve('langmuir');
  near(r.summary.loading, 10);
  near(r.summary.coverage, 50);
  near(r.summary.half, 2);
  near(solve('langmuir', { concentration: 0 }).summary.loading, 0);
  assert.ok(r.series.every((p) => p.y < 20));
  near(solve('langmuir', { capacity: 40 }).summary.loading, 2 * r.summary.loading);
});
test('osmosis has zero flow at osmotic balance and correctly signed reverse transport', () => {
  const r = solve('osmosis');
  near(r.summary.osmotic, 24.789570296, 1e-7);
  near(solve('osmosis', { pressure: r.summary.osmotic }).summary.flux, 0);
  assert.ok(solve('osmosis', { pressure: 0 }).summary.flux < 0);
  near(r.summary.flow, 10 * r.summary.flux);
  near(solve('osmosis', { area: 20 }).summary.flow, 2 * r.summary.flow);
});
test('M/M/1 satisfies Little’s law and reports its omitted stationary tail exactly', () => {
  const r = solve('mm1queue');
  near(r.summary.number, (4 * r.summary.time) / 60);
  near(r.summary.time - r.summary.waiting, 60 / 6);
  near(r.series.reduce((s, p) => s + p.y, 0) + r.table.rows.at(-1)[1], 100);
  near(r.series[0].y, 100 / 3);
  assert.ok(solve('mm1queue', { arrival: 5.9 }).summary.time > r.summary.time);
});
test('EOQ optimal ordering and holding costs are equal and nearby policies cost more', () => {
  const r = solve('eoq');
  near(r.summary.optimal, Math.sqrt(50000));
  near(r.summary.cost, 450);
  near(r.summary.cycle, 73);
  const q = r.summary.optimal,
    opt = solve('eoq', { quantity: q });
  near(opt.table.rows[0][2], opt.table.rows[0][3]);
  for (const quantity of [q * 0.9, q * 1.1])
    assert.ok(solve('eoq', { quantity }).summary.cost > opt.summary.cost);
});
test('CPM matches independently enumerated source-to-terminal paths and precedence bounds', () => {
  for (const durations of ['3,2,4,5,2,3', '3,3,5,5,3,3', '30,1,1,1,30,1']) {
    const d = durations.split(',').map(Number),
      r = solve('criticalpath', { durations }),
      s = r.schedule;
    const paths = [
      [0, 2, 4],
      [0, 3, 4],
      [1, 3, 4],
      [0, 3, 5],
      [1, 3, 5],
    ];
    near(r.summary.duration, Math.max(...paths.map((path) => path.reduce((a, i) => a + d[i], 0))));
    s.predecessors.forEach((parents, i) => {
      parents.forEach((p) => assert.ok(s.early[i] >= s.finish[p]));
      assert.ok(s.slack[i] >= 0);
      near(s.late[i] - s.early[i], s.slack[i]);
    });
  }
  assert.equal(solve('criticalpath').summary.duration, 11);
  assert.equal(solve('criticalpath', { durations: '3,3,5,5,3,3' }).summary.critical, 6);
});
test('Weibull characteristic life, median and exponential/singular hazard limits are explicit', () => {
  const r = solve('weibull');
  near(r.summary.reliability, 100 / Math.E);
  near(solve('weibull', { age: r.summary.median }).summary.reliability, 50);
  near(solve('weibull', { shape: 1, age: 0 }).summary.hazard, 0.001);
  near(solve('weibull', { shape: 1, age: 10000 }).summary.hazard, 0.001);
  const singular = solve('weibull', { shape: 0.5, age: 0 });
  assert.equal(singular.summary.hazard, null);
  near(singular.summary.reliability, 100);
  assert.ok(singular.warnings.length);
});
test('series/parallel reliability agrees with exhaustive independent component-state probabilities', () => {
  const r = [0.9, 0.9, 0.95, 0.8];
  let all = 0,
    any = 0;
  for (let state = 0; state < 16; state++) {
    let probability = 1;
    for (let i = 0; i < 4; i++) probability *= state & (1 << i) ? r[i] : 1 - r[i];
    if (state === 15) all += probability;
    if (state) any += probability;
  }
  near(solve('systemreliability').summary.reliability, 100 * all);
  near(solve('systemreliability', { topology: 'parallel' }).summary.reliability, 100 * any);
  near(solve('systemreliability', { components: '0,100' }).summary.reliability, 0);
  near(
    solve('systemreliability', { components: '0,100', topology: 'parallel' }).summary.reliability,
    100,
  );
});
test('seeded X-bar chart applies the shift only after subgroup 18 and uses correct standard error', () => {
  const baseline = solve('controlchart', { shift: 0 }),
    shifted = solve('controlchart', { shift: 2 });
  assert.deepEqual(baseline, solve('controlchart', { shift: 0 }));
  baseline.series.forEach((p, i) =>
    near(shifted.series[i].y - p.y, i < 18 ? 0 : 2 * Math.sqrt(5), 1e-12),
  );
  near(baseline.summary.upper, 100 + 6 / Math.sqrt(5));
  near(baseline.summary.lower, 100 - 6 / Math.sqrt(5));
  near(shifted.summary.alarms, shifted.table.rows.filter((row) => row[4] === 'outside').length);
});

for (const [id, { definition: d }] of Object.entries(expansionModels))
  test(`${id}: defaults, all presets and accepted field boundaries produce finite contracted outputs`, () => {
    const base = defaults(id),
      cases = [base, ...Object.values(d.presets ?? {}).map((p) => ({ ...base, ...p }))];
    for (const [key, f] of Object.entries(d.inputs)) {
      const bounds =
        f.type === 'enum'
          ? f.options
          : f.type === 'integer-list'
            ? [
                Array(id === 'criticalpath' ? 6 : 1)
                  .fill(f.minItem)
                  .join(','),
                Array(f.maxItems).fill(f.maxItem).join(','),
              ]
            : [f.min, f.max];
      for (const value of bounds) cases.push({ ...base, [key]: value });
    }
    for (const input of cases) {
      if (validate(d, input).message) continue;
      const r = expansionModels[id].solve(input);
      assert.deepEqual(Object.keys(r.summary), Object.keys(d.outputs.summary));
      for (const v of Object.values(r.summary))
        assert.ok(v === null || Number.isFinite(v), `${id}: ${JSON.stringify(input)}`);
      for (const p of r.series)
        for (const v of Object.values(p))
          assert.ok(v === null || Number.isFinite(v), `${id} contains a nonfinite plot coordinate`);
    }
    assert.ok(d.example && d.equation && d.limits && d.prediction);
    assert.equal(d.version, '1.0');
  });
test('discovery includes all 30 new models and API rejects cross-field and fixed-list invalid inputs', async () => {
  const { models } = await GET().json();
  for (const id of Object.keys(expansionModels)) assert.ok(models.some((d) => d.id === id));
  for (const [id, input, key] of [
    ['mm1queue', { arrival: 6, service: 6 }, 'arrival'],
    ['criticalpath', { durations: '1,2,3' }, 'durations'],
    ['rocketequation', { initial: 500, final: 500 }, 'final'],
    ['amradio', { carrier: 5, message: 5 }, 'message'],
  ]) {
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: { ...defaults(id), ...input } }),
      }),
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).field, key);
  }
  for (const id of Object.keys(expansionModels)) {
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: defaults(id) }),
      }),
    );
    assert.equal(response.status, 200);
    const r = await response.json();
    assert.equal(r.model, id);
    assert.equal(r.version, '1.0');
    assert.deepEqual(r.units, expansionModels[id].definition.outputs);
  }
});

test('combined input-domain corners retain finite plots and physical bounds', () => {
  for (const [id, { definition: d, solve: run }] of Object.entries(expansionModels)) {
    let cases = [{}];
    for (const [key, f] of Object.entries(d.inputs)) {
      const endpoints =
        f.type === 'enum'
          ? f.options
          : f.type === 'integer-list'
            ? [
                Array(id === 'criticalpath' ? 6 : 1)
                  .fill(f.minItem)
                  .join(','),
                Array(f.maxItems).fill(f.maxItem).join(','),
              ]
            : [f.min, f.max];
      cases = cases.flatMap((input) => endpoints.map((value) => ({ ...input, [key]: value })));
    }
    for (const input of cases) {
      if (validate(d, input).message) continue;
      const r = run(input);
      for (const value of Object.values(r.summary))
        assert.ok(value === null || Number.isFinite(value), `${id}: ${JSON.stringify(input)}`);
      for (const p of r.series)
        for (const value of Object.values(p))
          assert.ok(value === null || Number.isFinite(value), `${id}: nonfinite corner trace`);
      if (id === 'solarpv') assert.ok(r.summary.fill > 0 && r.summary.fill < 100);
      if (id === 'batterydischarge')
        assert.ok(r.summary.soc >= 0 && r.summary.soc <= 100 && r.summary.energy >= 0);
      if (id === 'consecutive')
        for (const p of r.series) {
          near(p.y + p.reference + p.other, input.initial, 1e-10);
          assert.ok(Math.min(p.y, p.reference, p.other) > -1e-10);
        }
      if (id === 'weibull' || id === 'systemreliability')
        assert.ok(r.summary.reliability >= 0 && r.summary.reliability <= 100);
    }
  }
});

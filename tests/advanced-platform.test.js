import { snapUnitBoundary } from '../frontend/public/unit-controls.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { solveTruss, triangle } from '../backend/truss.js';
import { models } from '../backend/waves.js';
import { convert, describeUnit } from '../backend/physical-units.js';
import { validate } from '../backend/contract.js';
import { analyzeParameters, fitParameters, parseData } from '../backend/numerical-tools.js';
import { identifyARX } from '../backend/identification.js';
import { labManifest } from '../backend/lab-manifest.js';
import { openapi } from '../backend/openapi.js';
import { parameterSpace, applyParameters } from '../backend/parameter-space.js';
import { algorithms } from '../backend/algorithms.js';
import { POST } from '../api/waves.js';

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${actual} ≠ ${expected}`,
  );
const defaults = (id) =>
  Object.fromEntries(
    Object.entries(models[id].definition.inputs).map(([key, f]) => [key, f.initial]),
  );
test('single-bar FEM agrees with PL/EA, reaction balance and strain energy', () => {
  const input = JSON.stringify({
      nodes: [
        [0, 0],
        [2, 0],
      ],
      bars: [[0, 1, 1000, 200]],
      supports: [
        [0, true, true],
        [1, false, true],
      ],
      loads: [[1, 100, 0]],
    }),
    r = solveTruss(input);
  near(r.displacement[2], 0.001);
  near(r.reactions[0], -100000);
  near(r.members[0].stress, 100);
  near(r.summary.energy, 50);
  near(r.residual, 0);
});
test('truss global equilibrium and energy scale under arbitrary load multipliers', () => {
  fc.assert(
    fc.property(fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }), (scale) => {
      const base = solveTruss(triangle),
        r = solveTruss(triangle, scale),
        loads = JSON.parse(triangle).loads;
      near(r.summary.energy, base.summary.energy * scale ** 2);
      near(r.members[0].force, base.members[0].force * scale);
      for (let axis = 0; axis < 2; axis++) {
        const reaction = r.reactions.filter((_, i) => i % 2 === axis).reduce((s, v) => s + v, 0),
          force = loads.reduce((s, l) => s + l[axis + 1] * 1000 * scale, 0);
        near(reaction + force, 0, 1e-7);
      }
      const model = JSON.parse(triangle);
      const memberEnergy = r.members.reduce((sum, member, i) => {
        const [a, b, area, E] = model.bars[i],
          length = Math.hypot(
            model.nodes[b][0] - model.nodes[a][0],
            model.nodes[b][1] - model.nodes[a][1],
          );
        return sum + ((member.force * 1000) ** 2 * length) / (2 * area * 1e-6 * E * 1e9);
      }, 0);
      near(r.summary.energy, memberEnergy);
    }),
    { numRuns: 100, seed: 42 },
  );
});
test('truss rejects mechanisms, bad topology and non-finite geometry', () => {
  const base = JSON.parse(triangle);
  for (const change of [
    { supports: [] },
    { bars: [[0, 4, 1000, 200]] },
    { bars: [[0, 0, 1, 200]] },
    {
      nodes: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    },
    { bars: [[0, 1, -1, 200]] },
  ])
    assert.throws(() => solveTruss(JSON.stringify({ ...base, ...change })));
});
test('material reference cases and conservation checks are independent of UI metadata', () => {
  near(models.leverrule.solve(defaults('leverrule')).summary.beta, 1 / 3);
  const fick = models.fickdiffusion.solve(defaults('fickdiffusion'));
  near(fick.summary.penetration, 60);
  near(fick.series[0].y, 1, 1e-6);
  near(
    models.fracturetoughness.solve(defaults('fracturetoughness')).summary.intensity,
    100 * 1.12 * Math.sqrt(Math.PI * 0.005),
  );
  near(models.goodman.solve(defaults('goodman')).summary.factor, 1.5);
  near(models.larsonmiller.solve(defaults('larsonmiller')).summary.logLife, 20000 / 873.15 - 20);
  near(models.hallpetch.solve(defaults('hallpetch')).summary.strength, 170);
  near(
    models.stressconcentration.solve({ ...defaults('stressconcentration'), major: 10, radius: 10 })
      .summary.factor,
    3,
  );
  near(models.bearinglife.solve(defaults('bearinglife')).summary.hours, 300);
  const modes = models.modal2dof.solve(defaults('modal2dof')).summary;
  near(modes.first, Math.sqrt((1000 * (3 - Math.sqrt(5))) / 2) / (2 * Math.PI));
  near(modes.second, Math.sqrt((1000 * (3 + Math.sqrt(5))) / 2) / (2 * Math.PI));
  const stack = models.tolerancestack.solve(defaults('tolerancestack')).summary;
  near(stack.nominal, 60);
  near(stack.worst, 0.23);
  near(stack.sigma, Math.sqrt((0.1 ** 2 + 0.05 ** 2 + 0.08 ** 2) / 3));
});
test('Paris integration has the logarithmic m=2 limit and Δσ power scaling', () => {
  const input = { ...defaults('pariscrack'), exponent: 2 },
    r = models.pariscrack.solve(input);
  near(
    r.summary.cycles,
    Math.log(input.final / input.initial) /
      (input.coefficient * (input.factor * input.range) ** 2 * Math.PI),
  );
  near(
    models.pariscrack.solve({ ...input, range: input.range * 2 }).summary.cycles,
    r.summary.cycles / 4,
  );
});
test('ARX exact identification recovers an independently generated noiseless record', () => {
  let y = 0;
  const data = Array.from({ length: 60 }, (_, i) => {
    const u = i % 7 < 3 ? 1 : -1,
      row = { u, y };
    y = 0.7 * y + 0.3 * u;
    return row;
  });
  const r = identifyARX(data);
  near(r.summary.a, 0.7);
  near(r.summary.b, 0.3);
  near(r.summary.rmse, 0);
  assert.throws(() => identifyARX(Array.from({ length: 10 }, () => ({ u: 0, y: 0 }))));
});
test('Kalman covariance remains positive and seeded estimation improves this noisy reference', () => {
  const result = models.kalmanfilter.solve(defaults('kalmanfilter'));
  assert.ok(result.summary.sigma > 0);
  assert.ok(result.summary.filtered < result.summary.raw);
  assert.deepEqual(result, models.kalmanfilter.solve(defaults('kalmanfilter')));
});
test('FOPDT IMC tuning matches reference gains and has bounded finite response', () => {
  const r = models.pidautotune.solve(defaults('pidautotune'));
  near(r.summary.kp, 13 / 9);
  near(r.summary.ki, 4 / 9);
  near(r.summary.kd, 1 / 3);
  assert.ok(r.series.every((p) => Number.isFinite(p.y) && Math.abs(p.other) <= 2));
  assert.ok(Math.abs(r.series.at(-1).y - 1) < 0.01);
});
test('dimensional analysis composes units and rejects incompatible quantities at the API boundary', async () => {
  near(convert(1, 'kN/m²', 'Pa'), 1000);
  near(convert(1, 'N m', 'J'), 1);
  assert.equal(describeUnit('m/s²').dimension, '0,1,-2,0,0');
  assert.throws(() => convert(1, 'kg', 'm'));
  fc.assert(
    fc.property(fc.double({ min: -1e5, max: 1e5, noNaN: true, noDefaultInfinity: true }), (v) =>
      near(convert(convert(v, 'kN', 'lbf'), 'lbf', 'kN'), v),
    ),
    { seed: 7 },
  );
  const good = validate(models.divider.definition, {
    voltage: { value: 12000, unit: 'mV' },
    upper: 10,
    lower: 10,
    load: 10,
  });
  assert.equal(good.values.voltage, 12);
  const bad = await POST(
    new Request('http://localhost/api/waves', {
      method: 'POST',
      body: JSON.stringify({
        model: 'divider',
        input: { voltage: { value: 12, unit: 'm' }, upper: 10, lower: 10, load: 10 },
      }),
    }),
  );
  assert.equal(bad.status, 422);
});
test('sweep, sensitivity and uncertainty preserve a known linear mapping', () => {
  const evaluate = ({ a }) => ({ summary: { value: 3 * a }, series: [] }),
    bounds = { a: [1, 3] };
  const sweep = analyzeParameters(evaluate, { a: 2 }, bounds, 'value', {
    mode: 'sweep',
    samples: 5,
  });
  near(sweep.series[2].y, 6);
  const tornado = analyzeParameters(evaluate, { a: 2 }, bounds, 'value', { mode: 'sensitivity' });
  near(tornado.tornado[0].derivative, 3);
  const mc = analyzeParameters(evaluate, { a: 2 }, bounds, 'value', {
    mode: 'montecarlo',
    samples: 1000,
    seed: 42,
  });
  assert.equal(mc.accepted, 1000);
  assert.equal(mc.rejected, 0);
  assert.ok(mc.mean > 5.8 && mc.mean < 6.2);
  assert.deepEqual(
    mc,
    analyzeParameters(evaluate, { a: 2 }, bounds, 'value', {
      mode: 'montecarlo',
      samples: 1000,
      seed: 42,
    }),
  );
  const invalid = analyzeParameters(
    ({ a }) => {
      if (a < 2) throw new Error('invalid');
      return evaluate({ a });
    },
    { a: 2 },
    bounds,
    'value',
    { mode: 'montecarlo', samples: 100, seed: 42 },
  );
  assert.ok(invalid.rejected > 0);
  assert.equal(invalid.accepted + invalid.rejected, 100);
});
test('bounded fitting recovers noiseless slope and offset from uploaded CSV', () => {
  const evaluate = ({ a, b }) => ({
      summary: {},
      series: Array.from({ length: 21 }, (_, x) => ({ x, y: a * x + b })),
    }),
    data = parseData('x,y\n0,1\n2,5\n4,9\n8,17\n12,25\n20,41');
  const fit = fitParameters(evaluate, data, { a: 1, b: 0 }, { a: [0, 5], b: [-5, 5] });
  near(fit.input.a, 2, 1e-5);
  near(fit.input.b, 1, 1e-5);
  assert.ok(fit.rmse < 1e-5);
  assert.throws(() => parseData('x,y\n0,=1+1'));
  assert.throws(() =>
    fitParameters(evaluate, [...data, { x: 30, y: 1 }], { a: 1, b: 0 }, { a: [0, 5] }),
  );
});
test('OpenAPI schemas cover every manifest model and quantity contract', () => {
  assert.equal(Object.keys(openapi.components.schemas).length, labManifest.length + 1);
  for (const entry of labManifest) assert.ok(openapi.components.schemas[entry.id]);
  assert.equal(openapi.components.schemas.divider.properties.voltage.oneOf.length, 2);
});

test('parameter adapters preserve integer lists and circuit component meaning', () => {
  const d = algorithms.prefixrange,
    base = d.defaults,
    space = parameterSpace(d, base);
  assert.ok(Object.keys(space.fields).some((key) => key.startsWith('list:')));
  assert.ok(
    Object.values(space.fields)
      .filter((field) => field.integer)
      .every((field) => Number.isFinite(field.min) && Number.isFinite(field.max)),
  );
  const circuit = models.circuitbuilder,
    initial = defaults('circuitbuilder'),
    candidate = { ...parameterSpace(circuit.definition, initial).values, 'circuit:1': 2000 },
    input = applyParameters(circuit.definition, initial, candidate);
  near(circuit.solve(input).summary.peak, 10);
  assert.match(input.netlist, /R R1 1 2 2000/);
});
test('PID zero-delay response starts at the initial state and advances at the reported sample time', () => {
  const result = models.pidautotune.solve({ ...defaults('pidautotune'), delay: 0 });
  near(result.series[0].x, 0);
  near(result.series[0].y, 0);
  assert.ok(result.series[1].x > 0 && result.series[1].y > 0);
});

test('unit rounding does not collapse physically distinct small coefficients', () => {
  assert.equal(snapUnitBoundary(1e-12, 1e-16, 1e-8), 1e-12);
  assert.equal(snapUnitBoundary(1 + Number.EPSILON, 0, 1), 1);
  assert.throws(() => convert(1, 'toString', 'toString'));
  assert.throws(() => convert(1e308, 'GPa', 'Pa'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  engineeringReleaseModels as labs,
  newEngineeringModels,
} from '../backend/engineering-release.js';
import { catalog } from '../backend/catalog.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
import { studyVisual, millerPolygon } from '../frontend/public/study-visuals.js';
import { phaseFraction } from '../backend/material-upgrades.js';
import { laminateQ } from '../backend/metallurgy.js';
import { beamSpans } from '../backend/structural-engine.js';
import { saturation, steamPT, rankine, wallModes } from '../backend/thermal-engine.js';
import { finState } from '../backend/heat-flow.js';
import { consolidationDegree, reinforced } from '../backend/civil-systems.js';
import {
  C,
  add,
  sub,
  mul,
  abs,
  conj,
  transformer,
  induction,
  piLine,
  faultSequences,
} from '../backend/ac-engine.js';
import { relayCurve } from '../backend/electrical-machines.js';
import {
  diodeState,
  mosCurrent,
  inverterOutput,
  transistorBias,
} from '../backend/semiconductors.js';
const defaults = (id) =>
  Object.fromEntries(Object.entries(labs[id].definition.inputs).map(([k, f]) => [k, f.initial]));
const solve = (id, changes = {}) => {
  const m = labs[id],
    a = { ...defaults(id), ...changes },
    v = validate(m.definition, a);
  assert.ok(v.values, `${id}: ${v.message}`);
  return m.solve(v.values);
};
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}, tolerance ${tolerance}`,
  );
function finite(v) {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `non-finite ${v}`);
  else if (v && typeof v === 'object') Object.values(v).forEach(finite);
}
test('the release covers 90 requested topics with 83 new and seven reused routes', () => {
  assert.equal(Object.keys(newEngineeringModels).length, 83);
  assert.equal(Object.keys(labs).length, 90);
  for (const id of Object.keys(labs))
    assert.equal(catalog.filter((x) => x.id === id).length, 1, id);
  assert.equal(catalog.length, 380);
});
for (const [id, m] of Object.entries(labs))
  test(`${id}: finite worker result, complete teaching content, native diagram and HTTP agreement`, async () => {
    const d = m.definition,
      a = defaults(id);
    assert.equal(d.execution, 'worker');
    for (const key of ['description', 'predict', 'example', 'equation', 'limits'])
      assert.ok(d[key].length > 20, `${id}: ${key}`);
    assert.equal(d.prediction[0].length, 3);
    const r = solve(id);
    finite(r);
    assert.ok(r.series.length >= 2);
    assert.deepEqual(Object.keys(r.summary).sort(), Object.keys(d.metrics).sort());
    assert.deepEqual(r, solve(id));
    if (r.visualization?.type === 'engineering-study')
      for (const index of [0, Math.floor(r.series.length / 2), r.series.length - 1]) {
        const svg = studyVisual(r.visualization, index);
        assert.ok(svg.drawing.length > 100);
        assert.doesNotMatch(svg.drawing, /NaN|undefined|\[object Object\]/);
      }
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: a }),
      }),
    );
    assert.equal(response.status, 200, id);
    const remote = await response.json();
    assert.deepEqual(remote.summary, r.summary);
    assert.deepEqual(remote.series, JSON.parse(JSON.stringify(r.series)));
  });
test('every single control endpoint or enum either yields finite output or a field-specific domain error', () => {
  for (const [id, m] of Object.entries(labs))
    for (const [key, f] of Object.entries(m.definition.inputs))
      for (const value of f.type === 'number'
        ? [f.min, f.max]
        : f.type === 'enum'
          ? f.options
          : []) {
        const v = validate(m.definition, { ...defaults(id), [key]: value });
        if (v.values) {
          try {
            finite(m.solve(v.values));
          } catch (e) {
            throw Error(`${id}.${key}=${value}: ${e.message}`);
          }
        } else {
          assert.ok(v.message);
          assert.ok(Object.hasOwn(m.definition.inputs, v.key));
        }
      }
});
test('binary envelope has pure-end limits, normalized fractions and composition conservation', () => {
  for (const T of [800, 950, 1100, 1300, 1500, 1600])
    for (const C of [0, 0.1, 0.4, 0.8, 1]) {
      const r = phaseFraction(T, C, 60);
      near(r.solid + r.liquid, 1);
      assert.ok(r.solid >= 0 && r.liquid >= 0);
      if (r.solidComposition !== null && r.liquidComposition !== null)
        near(r.solid * r.solidComposition + r.liquid * r.liquidComposition, C);
    }
  near(solve('leverrule').summary.beta, 1 / 3);
  near(solve('leverrule', { mode: 'diagram', temperature: 800 }).summary.alpha, 1);
  near(solve('leverrule', { mode: 'diagram', temperature: 1600 }).summary.beta, 1);
});
test('eutectic energy arrest, iron-carbon phases and constituents remain distinct', () => {
  const r = solve('eutectic', { composition: 61.9 });
  near(r.summary.primary, 0);
  near(r.summary.eutectic, 1);
  near(r.summary.arrest, 25);
  const steel = solve('ironcarbon', { carbon: 0.76, temperature: 727 });
  near(steel.summary.pearlite, 1);
  near(steel.summary.ferrite + steel.summary.austenite + steel.summary.cementite, 1);
  near(steel.summary.ferrite * 0.022 + steel.summary.cementite * 6.67, 0.76);
});
test('isothermal TTT start matches its supplied incubation and a rapid quench suppresses diffusion', () => {
  near(solve('tttcct', { mode: 'isothermal', hold: 550 }).summary.start, 10, 0.07);
  assert.ok(
    solve('tttcct', { rate: 100 }).summary.fraction <
      solve('tttcct', { rate: 0.1 }).summary.fraction,
  );
});
test('carburizing profile hits its inverse-erf criterion and follows time and Arrhenius scaling', () => {
  const a = solve('carburizing'),
    b = solve('carburizing', { hours: 16 });
  near(b.summary.depth, 2 * a.summary.depth);
  assert.ok(
    solve('carburizing', { temperature: 1000 }).summary.diffusivity > a.summary.diffusivity,
  );
});
test('Hollomon stress, dislocation square-root scaling and Considere necking agree', () => {
  near(solve('workhardening').summary.stress, 800 * 0.1 ** 0.2);
  const a = solve('workhardening', { mode: 'dislocation' }).summary.stress,
    b = solve('workhardening', { mode: 'dislocation', density: 4e14 }).summary.stress;
  near(b, 2 * a);
  near(
    solve('workhardening', { strain: 0.2 }).summary.tangent,
    solve('workhardening', { strain: 0.2 }).summary.stress,
  );
});
test('Charpy shelves and Avrami half-time are preserved, with the singular zero-time rate explicit', () => {
  near(solve('charpy', { temperature: -20 }).summary.energy, 80);
  near(solve('avrami', { time: 100 }).summary.fraction, 0.5);
  assert.equal(solve('avrami', { time: 0, exponent: 0.5 }).summary.rate, null);
  near(solve('avrami', { time: 0, exponent: 2 }).summary.rate, 0);
});
test('packing follows unit-cell volume and selected plane area; Schmid factor is bounded', () => {
  near(solve('crystalpacking').summary.packing, (4 * ((4 * Math.PI) / 3)) / (2 * Math.SQRT2) ** 3);
  near(solve('crystalpacking', { structure: 'bcc' }).summary.packing, (Math.PI * Math.sqrt(3)) / 8);
  near(solve('schmid').summary.factor, 1 / Math.sqrt(6));
  const a = { ...defaults('schmid'), u: 1, v: 1, w: 0 };
  assert.ok(validate(labs.schmid.definition, a).message);
});
test('laminate assembly has symmetric matrices, zero symmetric coupling, correct uniaxial compliance and layup-reversal parity', () => {
  const r = solve('laminate', { angles: '0,0' }),
    h = 0.25;
  near(r.summary.strain, 100 / (135000 * h));
  near(r.generalized[1], -0.3 * r.generalized[0]);
  near(r.summary.coupling, 0, 1e-10);
  const a = solve('laminate', { angles: '0,45,90' }),
    b = solve('laminate', { angles: '90,45,0' });
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      near(a.matrices.A[i][j], b.matrices.A[i][j], 1e-8);
      near(a.matrices.D[i][j], b.matrices.D[i][j], 1e-8);
      near(a.matrices.B[i][j], -b.matrices.B[i][j], 1e-8);
      near(a.matrices.A[i][j], a.matrices.A[j][i]);
    }
  const Q = laminateQ(100, 10, 5, 0.25, 90);
  near(Q[0][0], 10 / (1 - (0.25 * 0.25 * 10) / 100));
});
test('mixed-potential branches balance current and area ratio changes anode attack', () => {
  near(solve('corrosion', { ia: 0.0001, ic: 0.0001, ratio: 1 }).summary.potential, -0.2);
  assert.ok(
    solve('corrosion', { ratio: 10 }).summary.current >
      solve('corrosion', { ratio: 1 }).summary.current,
  );
});
test('relaxation models retain the correct equilibrium modulus and thermal shock reaches its strength at critical jump', () => {
  const a = solve('relaxation', { model: 'maxwell', time: 10 });
  near(a.summary.residual, 0);
  near(a.summary.stress, a.summary.initial / Math.E);
  const r = solve('thermalshock');
  near(solve('thermalshock', { jump: r.summary.critical }).summary.utilization, 1);
});
test('existing material laws preserve their independent scale references after diagram upgrades', () => {
  near(solve('fickdiffusion').summary.penetration, 60);
  near(solve('hallpetch').summary.strength, 170);
  near(solve('fracturetoughness').summary.intensity, 1.12 * 100 * Math.sqrt(Math.PI * 0.005));
  near(solve('goodman').summary.factor, 1.5);
  near(solve('larsonmiller').summary.logLife, 20000 / 873.15 - 20);
  const a = solve('pariscrack'),
    b = solve('pariscrack', { range: 200 });
  near(b.summary.cycles, a.summary.cycles / 8, 1e-5);
});
test('propped cantilever energy/reaction and equal-span support moments match closed-form references', () => {
  const p = solve('proppedbeam');
  near(p.summary.prop, 15);
  near(p.summary.energy, 10, 1e-7);
  const b = solve('threemoment', { spans: 'two' });
  near(b.supportMoments[1], -20);
  assert.deepEqual(b.reactions, [15, 50, 15]);
  near(b.summary.energy, 20, 1e-7);
});
test('moment distribution and three-moment compatibility agree for unequal load/span property cases', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 1, max: 8, noNaN: true }),
      fc.double({ min: 0.4, max: 2, noNaN: true }),
      fc.double({ min: 0, max: 100, noNaN: true }),
      fc.double({ min: 0, max: 2, noNaN: true }),
      (L, r, w, s) => {
        const a = beamSpans([L, L * r], [w, w * s], 16000),
          b = beamSpans([L, L * r], [w, w * s], 16000, 'distribution');
        near(a.moments[1], b.moments[1], 1e-7);
        near(
          a.reactions.reduce((x, y) => x + y),
          w * L + w * s * L * r,
          1e-7,
        );
      },
    ),
    { numRuns: 50 },
  );
});
test('moving-load maximum checks axle events and one-axle midpoint has PL/4', () => {
  const r = solve('movingload', { section: 0.5, second: 0, front: 5 });
  near(r.summary.moment, 250);
  near(r.summary.peak, 250);
  near(r.summary.position, 5);
});
test('joint equilibrium and virtual-work member contributions match the symmetric truss reference', () => {
  const r = solve('trussjoints');
  near(r.forces[0], 100 / 3);
  near(r.forces[1], (-100 * Math.sqrt(13)) / 6);
  const v = solve('trussvirtual');
  near(v.summary.virtual, -1.524226849473108, 1e-10);
  near(v.summary.difference, 0);
});
test('portal frame condenses to the independent lateral-stiffness expression', () => {
  const a = defaults('portalsway'),
    expected =
      (24 * a.column) / a.height ** 3 -
      (72 * a.column ** 2) / (a.height ** 4 * ((4 * a.column) / a.height + (6 * a.beam) / a.span));
  near(solve('portalsway').summary.stiffness, expected);
});
test('unsymmetric pure bending has both tension and compression, zero moment has no unique neutral axis, and rectangular kern is middle-third', () => {
  const u = solve('unsymmetric');
  assert.ok(u.summary.maximum > 0 && u.summary.minimum < 0);
  assert.equal(solve('unsymmetric', { Mx: 0, My: 0 }).summary.angle, null);
  const k = solve('sectionkern', { ex: 0, ey: 50 });
  near(k.summary.minimum, 0);
  near(k.summary.kern, 1);
});
test('I-section shear peaks at neutral axis and vanishes on free top/bottom faces', () => {
  const r = solve('beamshear'),
    Aflange = 200 * 15,
    Q = Aflange * (150 - 7.5) + 10 * 135 * 67.5,
    expected = (100000 * Q) / (138352500 * 10);
  near(r.summary.peak, expected);
  near(r.series[0].y, 0);
  near(r.series.at(-1).y, 0);
});
test('pressure vessels satisfy free-surface traction, thin membrane ratio and hydrostatic closed-cylinder limit', () => {
  near(solve('thinvessel').summary.hoop, 2 * solve('thinvessel').summary.axial);
  const a = solve('lame');
  near(a.summary.hoop, 26);
  near(a.series[0].reference, -10);
  near(a.series.at(-1).reference, 0);
  const b = solve('lame', { inside: 10, outside: 10 });
  near(b.summary.hoop, -10);
  near(b.summary.axial, -10);
  near(b.summary.mises, 0);
});
test('strain rosettes reconstruct both gauge layouts and hydrostatic failure measures vanish', () => {
  for (const layout of ['rectangular', 'delta']) {
    const r = solve('strainrosette', { layout, first: 100, second: 100, third: 100 });
    near(r.summary.major, 100);
    near(r.summary.minor, 100);
    assert.equal(r.summary.angle, null);
  }
  const f = solve('failurecriteria', { first: 200, second: 200, third: 200 });
  near(f.summary.mises, 0);
  near(f.summary.tresca, 0);
  near(f.summary.rankine, 2);
});
test('Castigliano energy derivative equals its conjugate deflection and zero eccentricity gives zero column deflection', () => {
  const h = 1e-4,
    r = solve('castigliano'),
    plus = solve('castigliano', { force: 10 + h }),
    minus = solve('castigliano', { force: 10 - h });
  near((plus.summary.energy - minus.summary.energy) / (2 * h), r.summary.deflection, 1e-7);
  near(solve('eccentriccolumn', { eccentricity: 0 }).summary.deflection, 0);
});
test('closed-cell torsion torque balance and circular-hole traction-free boundary hold', () => {
  const r = solve('closedtorsion');
  near(2 * 200 * 100 * r.summary.flow, 1000 * 1000);
  near(r.summary.constant, 8e6);
  const h = solve('kirschhole');
  for (const p of h.series) {
    near(p.reference, 0);
    near(p.third, 0);
  }
  near(Math.max(...h.series.map((p) => p.y)), 300);
});
test('Otto/Diesel ideal efficiencies and Brayton reversible baseline match independent textbook forms', () => {
  near(solve('otto').summary.efficiency, 1 - 8 ** -0.4);
  const gamma = 1.4,
    r = 16,
    rho = 2;
  near(
    solve('dieseldual', { mode: 'diesel' }).summary.efficiency,
    1 - (rho ** gamma - 1) / (gamma * (rho - 1) * r ** (gamma - 1)),
  );
  near(
    solve('brayton', { compressor: 1, turbine: 1, regenerator: 0 }).summary.efficiency,
    1 - 8 ** (-2 / 7),
  );
});
test('IAPWS published region verification points and saturation values match', () => {
  const liquid = steamPT(3, 300);
  near(liquid.h, 115.331273, 0.00001);
  near(liquid.s, 0.392294792, 1e-8);
  const steam = steamPT(0.0035, 700);
  near(steam.h, 3335.68375, 0.0001);
  near(steam.s, 10.1749996, 1e-6);
  const sat = saturation(0.01);
  near(sat.t, 318.957548, 0.000001);
  near(sat.f.h, 191.812295, 0.000001);
  near(sat.g.h, 2583.886937, 0.000001);
});
test('Rankine closes first-law energy and separates wet quality from single-phase state', () => {
  for (const reheat of ['yes', 'no']) {
    const a = { ...defaults('rankine'), reheat },
      r = rankine(a);
    near(r.heat - r.rejected, r.net, 1e-8);
    near(r.efficiency, r.net / r.heat);
    for (const s of r.states) assert.ok(s.quality === null || (s.quality >= 0 && s.quality <= 1));
  }
  assert.ok(rankine({ ...defaults('rankine'), reheat: 'no' }).quality < 1);
});
test('psychrometric zero bypass reaches saturated apparatus dew point and exergy obeys Gouy-Stodola balance', () => {
  near(solve('psychrometric', { bypass: 0 }).summary.outlet, 10, 1e-12);
  const r = solve('exergy');
  near(r.summary.entropy, 1 / 6);
  near(r.summary.destruction, 298.15 / 6);
  near(r.summary.inlet - r.summary.outlet, r.summary.destruction);
});
test('fin insulated-tip formula and long-fin limit are overflow-safe', () => {
  const a = { ...defaults('fin'), tip: 'adiabatic' },
    r = finState(a, 0),
    expected = a.conductivity * r.Ac * r.m * (a.base - a.ambient) * Math.tanh(r.m * a.length);
  near(r.heat, expected);
  const long = solve('fin', { length: 0.5, conductivity: 1, h: 500, thickness: 0.001 });
  finite(long);
  assert.ok(long.summary.efficiency > 0 && long.summary.efficiency <= 1);
});
test('plane-wall eigenvalues and an independent explicit finite-volume transient agree', () => {
  const modes = wallModes(1);
  near(modes[0].z, 0.860333589019, 1e-11);
  for (const { z } of modes) near(z * Math.tan(z), 1, 1e-8);
  const N = 50,
    dx = 1 / N,
    dt = (dx * dx) / 4,
    steps = Math.round(0.2 / dt);
  let u = Array(N + 1).fill(1);
  for (let t = 0; t < steps; t++) {
    const next = [...u];
    next[0] = u[0] + ((2 * dt) / (dx * dx)) * (u[1] - u[0]);
    for (let j = 1; j < N; j++)
      next[j] = u[j] + (dt / (dx * dx)) * (u[j - 1] - 2 * u[j] + u[j + 1]);
    next[N] = u[N] + ((2 * dt) / (dx * dx)) * (u[N - 1] - u[N] - dx * u[N]);
    u = next;
  }
  const r = solve('heisler');
  near((r.summary.center - 20) / 180, u[0], 0.00015);
  near((r.summary.surface - 20) / 180, u[N], 0.00015);
});
test('radiation black-body limit, tube laminar Nu and boundary-layer square-root growth hold', () => {
  const r = solve('radiation', { emissivity1: 1, emissivity2: 1 });
  near(r.summary.heat, 5.670374419e-8 * (600 ** 4 - 300 ** 4));
  near(solve('convection', { mode: 'laminar', velocity: 0.01 }).summary.nusselt, 3.66);
  const b = solve('boundarylayer'),
    c = solve('boundarylayer', { length: 0.5 });
  near(b.summary.thickness, Math.SQRT2 * c.summary.thickness);
});
test('Hardy Cross equals the parallel quadratic resistance solution and pump head/power balances', () => {
  const r = solve('hardycross');
  near(r.summary.upper, (20 * Math.SQRT2) / (1 + Math.SQRT2), 1e-7);
  near(r.summary.upper + r.summary.lower, 20);
  near(r.summary.residual, 0, 1e-9);
  const p = solve('pumpcurve');
  near(p.summary.flow, Math.sqrt(600));
  near(p.summary.head, 40 - 0.02 * p.summary.flow ** 2);
  assert.equal(solve('pumpcurve', { static: 100 }).summary.flow, null);
});
test('Couette/Poiseuille satisfies no-slip, flux and shear; draining volume and half-head time are exact', () => {
  const c = solve('couette', { speed: 0 });
  near(c.series[0].y, 0);
  near(c.series.at(-1).y, 0);
  near(c.summary.flow, (100 * 0.002 ** 3) / (12 * 0.01));
  const t = solve('tankdraining');
  near(t.summary.half / t.summary.time, 1 - 1 / Math.SQRT2);
  near(t.series.at(-1).y, 0);
});
test('LMTD equal-terminal limit, arrangement change and heat-sink nonlinear energy closure hold', () => {
  const r = solve('lmtd');
  near(r.summary.difference, 60);
  near(r.summary.area, 8 / 3);
  assert.ok(solve('lmtd', { mode: 'parallel' }).summary.area > r.summary.area);
  const h = solve('heatsink');
  near(h.summary.convection + h.summary.radiation, 50, 1e-10);
  near(solve('heatsink', { emissivity: 0 }).summary.sink, 50);
});
test('soil phase masses, Terzaghi zero-friction limit and early-time consolidation are correct', () => {
  const r = solve('soilphases');
  near(r.summary.water, (0.8 * 0.7) / 2.65);
  near(r.summary.porosity, 0.7 / 1.7);
  const b = solve('bearingcapacity', { friction: 0, depth: 0 });
  near(b.summary.ultimate, 5.7 * 20);
  const c = solve('consolidation'),
    single = solve('consolidation', { drainage: 'single' });
  near(single.summary.t90, 4 * c.summary.t90);
  near(consolidationDegree(1e-7), 2 * Math.sqrt(1e-7 / Math.PI), 1e-12);
  near(consolidationDegree(0.848085), 0.9, 1e-6);
});
test('Darcy flow count ratio, Rankine pressure resultants and channel momentum conservation agree', () => {
  near(solve('darcyflownet').summary.flow, 2e-5);
  near(solve('retainingwall', { surcharge: 0 }).summary.active, 48);
  const a = defaults('openchannel'),
    r = solve('openchannel'),
    y = r.summary.normal,
    A = a.width * y,
    R = A / (a.width + 2 * y);
  near((A * R ** (2 / 3) * Math.sqrt(a.slope)) / a.roughness, a.flow);
  const q = a.flow / a.width,
    m = (y) => (y * y) / 2 + (q * q) / (9.80665 * y);
  near(m(a.depth), m(r.summary.conjugate), 1e-10);
});
test('unit-hydrograph convolution conserves every storm block and Greenshields capacity is at kj/2', () => {
  for (const rain of ['10', '5,15,10,0', '0,0,0', '100,0,1']) {
    const r = solve('runoff', { rain });
    near(r.summary.volume, r.summary.integral, 1e-7);
  }
  const r = solve('greenshields', { density: 75 });
  near(r.summary.flow, r.summary.capacity);
  near(r.summary.speed, 45);
});
test('Webster reference, oversaturation handling and metric road-design conversions are explicit', () => {
  near(solve('webster').summary.delay, 24.728531831287413);
  assert.equal(solve('webster', { flow: 1200 }).summary.delay, null);
  const r = solve('roadcurve');
  near(r.summary.radius, 80 ** 2 / (127 * 0.22));
  assert.ok(solve('roadcurve', { grade: -0.08 }).summary.sight > r.summary.sight);
});
test('RC balance uses actual over-reinforced steel stress instead of forcing yield', () => {
  const a = defaults('rcflexure'),
    r = reinforced(a);
  near(r.fs, a.yield);
  const over = reinforced({ ...a, steel: 10000 });
  assert.ok(over.fs < a.yield);
  near(0.85 * a.concrete * a.width * over.block, 10000 * over.fs, 1e-6);
  const balanced = reinforced({ ...a, steel: r.Ab });
  near(balanced.strain, a.yield / 200000, 1e-12);
});
test('transformer equivalent circuit conserves power and approaches the ideal turns ratio', () => {
  const a = defaults('transformer'),
    r = transformer(a),
    input = mul(C(a.voltage), conj(r.I1)).re;
  near(input, r.output + r.core + r.copper, 1e-7);
  const ideal = transformer({ ...a, r1: 0, x1: 0, r2: 0, x2: 0, core: 1e30, magnetizing: 1e30 });
  near(ideal.secondary, 230);
  near(ideal.efficiency, 1);
  near(solve('transformertests').summary.resistance, 500 / 8.7 ** 2);
});
test('DC motor and induction-machine conversions close their mechanical/electrical balances', () => {
  const d = solve('dcmotor');
  near(d.summary.current, 11);
  near(d.summary.power, 1090);
  near(d.summary.efficiency, 1090 / 1320);
  const a = { ...defaults('inductionmotor'), poles: 4 },
    r = induction(a);
  near(r.input - r.statorloss, r.gap, 1e-7);
  near(r.gap - r.rotorloss, r.mechanical);
  near(r.torque * ((r.speed * 2 * Math.PI) / 60), r.mechanical);
});
test('synchronous power-angle sine, BLDC phase current sum and stepper RMS are correct', () => {
  near(solve('synchronous', { delta: 30 }).summary.real, 96.6 / 2);
  const r = solve('commutation');
  for (const p of r.series) near(p.y + p.reference + p.third, 0);
  near(solve('commutation', { mode: 'half' }).summary.rms, 2 * Math.sqrt(0.75));
});
test('per-unit conversions preserve physical network reactance and pi line closes ABCD and real power', () => {
  const a = defaults('perunit'),
    r = solve('perunit');
  near(r.summary.impedance, 21.78);
  near(r.summary.fault * r.summary.reactance, a.base / (Math.sqrt(3) * a.voltage));
  const line = piLine(defaults('transmissionpi')),
    det = sub(mul(line.A, line.D), mul(line.B, line.C));
  near(det.re, 1);
  near(det.im, 0);
  near(line.input - 100, line.loss);
  near(piLine(defaults('transmissionpi'), 0).ferranti, 0);
});
test('power-factor bank connection changes phase capacitance by three and two-bus voltages obey complex-power equations', () => {
  const d = solve('powerfactor'),
    s = solve('powerfactor', { connection: 'star' });
  near(s.summary.capacitance, 3 * d.summary.capacitance);
  near(solve('powerfactor', { initial: 0.95, target: 0.95 }).summary.reactive, 0);
  const a = defaults('twobus'),
    r = solve('twobus'),
    Q = a.power * Math.tan(Math.acos(a.factor));
  for (const V of [r.summary.upper, r.summary.lower])
    near(a.source ** 2 * V * V, (V * V + a.reactance * Q) ** 2 + (a.reactance * a.power) ** 2);
  near(solve('twobus', { factor: 1 }).summary.maximum, 1 / 0.6);
  assert.equal(solve('twobus', { power: 3 }).summary.upper, null);
});
test('all fault sequence interconnections meet their physical phase boundary conditions', () => {
  for (const type of ['ground', 'line', 'double', 'three']) {
    const a = { ...defaults('symmetrical'), type, fault: 0.1 },
      r = faultSequences(a),
      [Ia, Ib, Ic] = r.phases,
      [Va, Vb, Vc] = r.voltages,
      Zf = C(0, a.fault);
    if (type === 'ground') {
      near(abs(Ib), 0);
      near(abs(Ic), 0);
      near(abs(sub(Va, mul(Zf, Ia))), 0);
    } else if (type === 'line') {
      near(abs(Ia), 0);
      near(abs(add(Ib, Ic)), 0);
      near(abs(sub(sub(Vb, Vc), mul(Zf, Ib))), 0);
    } else if (type === 'double') {
      near(abs(Ia), 0);
      near(abs(sub(Vb, Vc)), 0);
      near(abs(sub(Vb, mul(Zf, add(Ib, Ic)))), 0);
    } else {
      for (let i = 0; i < 3; i++) near(abs(sub(r.voltages[i], mul(Zf, r.phases[i]))), 0);
    }
  }
});
test('relay multiplier meets the requested interval and pickup has no finite inverse time', () => {
  const a = defaults('relaycoordination'),
    r = solve('relaycoordination');
  near(r.summary.required * relayCurve(a.fault / a.backup, a.kind) - r.summary.primary, a.interval);
  assert.equal(relayCurve(1, 'standard'), null);
  near(relayCurve(2, 'very'), 13.5);
});
test('diode implicit current and resistor drop agree, depletion grows in reverse bias, Fermi carriers obey mass action', () => {
  const a = defaults('pnjunction'),
    r = diodeState(a);
  near(
    r.current,
    r.Is * Math.expm1(r.junction / (a.ideality * 8.617333262e-5 * a.temperature)),
    1e-12,
  );
  near(a.bias - r.junction, r.current * a.resistance);
  assert.ok(
    solve('pnjunction', { bias: -1 }).summary.depletion >
      solve('pnjunction', { bias: 0 }).summary.depletion,
  );
  const f = solve('fermilevel', { donors: 1e16, acceptors: 1e16 });
  near(f.summary.electrons, 1e10);
  near(f.summary.holes, 1e10);
  near(f.summary.fermi, 0);
});
test('BJT divider current balance survives saturation and MOS equations are continuous at pinch-off', () => {
  for (const change of [{}, { upper: 10, lower: 100, collector: 10, beta: 300 }]) {
    const a = { ...defaults('bjtbias'), ...change },
      r = transistorBias(a),
      Vb = r.emitter + 0.7;
    near((a.supply - Vb) / (a.upper * 1000) - Vb / (a.lower * 1000), r.base, 1e-12);
    if (change.beta) assert.equal(r.region, 'Saturation');
  }
  near(mosCurrent(3, 2, 1, 1, 0), 2);
  near(mosCurrent(3, 2 - 1e-8, 1, 1, 0), mosCurrent(3, 2 + 1e-8, 1, 1, 0), 1e-8);
});
test('matched CMOS transfer is reflection-symmetric with positive noise margins and differential current steers within its tail', () => {
  const a = defaults('cmosinverter');
  for (const Vin of [0.3, 1, 1.65, 2.3, 3])
    near(inverterOutput(a, Vin) + inverterOutput(a, a.supply - Vin), a.supply, 1e-8);
  const r = solve('cmosinverter');
  near(r.summary.switching, 1.65);
  assert.ok(r.summary.low > 0 && r.summary.high > 0);
  near(r.summary.low, r.summary.high, 1e-8);
  near(solve('differentialamp', { input: 0 }).summary.first, 0.5);
});
test('Sallen-Key equal-component reference, exact 555 thresholds, zener KCL and Schmitt memory hold', () => {
  const s = solve('sallenkey');
  near(s.summary.cutoff, 1 / (2 * Math.PI * 1e4 * 1e-8));
  near(s.summary.quality, 1 / (3 - 1.586));
  const a = solve('timer555'),
    m = solve('timer555', { mode: 'mono' });
  near(a.summary.high, Math.log(2) * 30000 * 1e-6);
  near(m.summary.high, Math.log(3) * 10000 * 1e-6);
  assert.equal(m.summary.frequency, null);
  const z = solve('zener');
  near((12 - z.summary.output) / 470, z.summary.current / 1000 + z.summary.output / 1000);
  const r = solve('schmitt');
  near(r.summary.upper, 3);
  near(r.summary.lower, 2);
  near(r.summary.switches, 4);
  assert.equal(solve('schmitt', { amplitude: 0.1 }).summary.switches, 0);
});
test('bounded text inputs reject executable strings, malformed trusses and impossible domains before solving', async () => {
  for (const [id, change] of [
    ['laminate', { angles: '<img onerror=alert(1)>' }],
    ['runoff', { rain: '1,,2' }],
    ['trussjoints', { geometry: '{}' }],
    ['schmid', { u: 1, v: 1, w: 1 }],
    ['lame', { outer: 50 }],
    ['cmosinverter', { input: 5 }],
    ['transformertests', { ocpower: 2000 }],
    ['sallenkey', { gain: 2.8, c1: 100, c2: 1 }],
  ]) {
    const a = { ...defaults(id), ...change },
      v = validate(labs[id].definition, a);
    assert.ok(v.message, id);
    const res = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: a }),
      }),
    );
    assert.equal(res.status, 422, id);
  }
});
test('curated contrasting presets are valid, finite and preserve their declared physics', () => {
  for (const [id, m] of Object.entries(labs))
    for (const [name, change] of Object.entries(m.definition.presets ?? {})) {
      const checked = validate(m.definition, { ...defaults(id), ...change });
      assert.ok(checked.values, `${id}: ${name}: ${checked.message}`);
      finite(m.solve(checked.values));
    }
});
test('carry-over converges across multiple interior joints, not only a single balance', () => {
  for (const L of [
    [4, 4, 3],
    [2, 4, 3, 5],
  ]) {
    const w = L.map((_, i) => 10 + 3 * i),
      a = beamSpans(L, w, 16000),
      b = beamSpans(L, w, 16000, 'distribution');
    assert.ok(b.iterations.length > 2);
    a.moments.forEach((M, i) => near(M, b.moments[i], 1e-8));
    near(b.iterations.at(-1).residual, 0, 1e-9);
  }
});
test('Miller plane polygon lies on its indexed plane and clips to the actual cube', () => {
  const cube = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
  for (const normal of [
    [1, 1, 1],
    [1, 0, 0],
    [-1, 2, 1],
    [0, -2, -3],
  ]) {
    const polygon = millerPolygon(normal, cube);
    assert.ok(polygon.length >= 3);
    for (const p of polygon) {
      near(
        p.reduce((s, v, i) => s + v * normal[i], 0),
        1,
      );
      assert.ok(p.every((v) => Math.abs(v) <= 1 + 1e-10));
    }
  }
});

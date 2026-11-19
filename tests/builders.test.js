import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { builderModels as models } from '../backend/builder-labs.js';
import {
  solveSpice,
  spiceExample,
  junction,
  transistorCurrents,
  parseSpice,
} from '../backend/spice-transient.js';
import { solveContinuum, femExample, refineMesh, parseMesh } from '../backend/fem-continuum.js';
import {
  solveControlGraph,
  controlGraphExample,
  compileControl,
} from '../backend/control-graph.js';
import {
  solveMechanism,
  mechanismExample,
  parseMechanism,
  mechanismConstraints,
} from '../backend/multibody-builder.js';
import { traceDsa, dsaExample, benchmarkDsa } from '../backend/custom-dsa.js';
import { builderVisual, builderThumbnail } from '../frontend/public/builder-visuals.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
const defaults = (id) =>
  Object.fromEntries(Object.entries(models[id].definition.inputs).map(([k, f]) => [k, f.initial]));
const near = (a, b, t = 1e-8) => assert.ok(Math.abs(a - b) <= t, `${a} ≈ ${b} (${t})`);
const json = JSON.stringify;
for (const [id, m] of Object.entries(models))
  test(`${id}: registry, worker, teaching, API and all presets agree`, async () => {
    const d = m.definition,
      input = defaults(id),
      r = m.solve(input);
    assert.equal(d.execution, 'worker');
    assert.ok(d.editor);
    assert.ok(d.limits.length);
    const check = validate(d, input);
    assert.ok(check.values, check.message);
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: json({ model: id, input }),
      }),
    );
    assert.equal(response.status, 200);
    const remote = await response.json();
    assert.deepEqual(remote.summary, r.summary);
    assert.deepEqual(remote.series, r.series);
    for (const changes of Object.values(d.presets ?? {})) {
      const p = { ...input, ...changes };
      assert.ok(validate(d, p).values);
      assert.doesNotMatch(json(m.solve(p)), /NaN|Infinity/);
    }
    const svg = builderVisual(r.visualization, 0);
    assert.ok(svg.drawing.length > 100);
    assert.doesNotMatch(svg.drawing, /NaN|Infinity|undefined/);
    assert.ok(builderThumbnail(id).length > 50);
    assert.equal(validate(d, { ...input, project: '{bad' }).key, 'project');
  });
test('RC trapezoidal integration converges quadratically to its independent exponential', () => {
  const p = JSON.parse(spiceExample);
  p.components[0].wave = 'dc';
  const expected = 5 * (1 - Math.exp(-1));
  const error = (n) =>
    Math.abs(solveSpice(json(p), { duration: 0.001, steps: n }).summary.final - expected);
  const a = error(20),
    b = error(40);
  assert.ok(a / b > 3.9 && a / b < 4.1);
});
test('RL current follows its analytical step response and KCL', () => {
  const p = {
    components: [
      { id: 'V', type: 'V', a: 1, b: 0, value: 5 },
      { id: 'R', type: 'R', a: 1, b: 2, value: 10 },
      { id: 'L', type: 'L', a: 2, b: 0, value: 0.01 },
    ],
    probe: 2,
  };
  const r = solveSpice(json(p), { duration: 0.001, steps: 100 });
  near(r.table.rows.find((x) => x[0] === 'L')[1], 0.5 * (1 - Math.exp(-1)), 2e-6);
  near(r.table.rows.find((x) => x[0] === 'R')[1], r.table.rows.find((x) => x[0] === 'L')[1], 1e-9);
});
test('lossless LC trapezoidal updates conserve quadratic stored energy', () => {
  const p = models.spicetransient.definition.presets['Lossless LC energy check'];
  const r = solveSpice(p.project, p);
  for (const f of r.visualization.frames)
    near(0.5e-6 * f.voltages[0] ** 2 + 0.005 * f.currents[1] ** 2, 0.5e-6, 1e-14);
});
test('diode operating point matches an independent bisection root', () => {
  const p = {
    components: [
      { id: 'V', type: 'V', a: 1, b: 0, value: 5 },
      { id: 'R', type: 'R', a: 1, b: 2, value: 1000 },
      { id: 'D', type: 'D', a: 2, b: 0, Is: 1e-12 },
    ],
    probe: 2,
  };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if ((5 - m) / 1000 > 1e-12 * Math.expm1(m / 0.025851999786)) lo = m;
    else hi = m;
  }
  near(solveSpice(json(p), { initial: 'operating', steps: 20 }).summary.final, (lo + hi) / 2, 1e-7);
  const z = junction(40 * 0.025851999786),
    w = junction(40 * 0.025851999786 + 1e-10);
  near((w.i - z.i) / 1e-10 / z.g, 1, 1e-5);
});
test('BJT and MOS terminal currents conserve charge and complementary devices mirror', () => {
  for (const type of ['NPN', 'NMOS']) {
    const c = { type, beta: type === 'NPN' ? 100 : 0.002 },
      v = [2, 0, type === 'NPN' ? 0.65 : 3];
    const a = transistorCurrents(c, v),
      b = transistorCurrents(
        { ...c, type: type === 'NPN' ? 'PNP' : 'PMOS' },
        v.map((x) => -x),
      );
    near(
      a.reduce((s, x) => s + x, 0),
      0,
      1e-15,
    );
    a.forEach((x, i) => near(x, -b[i], 1e-15));
  }
  near(transistorCurrents({ type: 'NMOS' }, [2, 0, 0])[0], 0);
});
test('floating nets and incompatible initial capacitor sources are rejected', () => {
  assert.throws(
    () =>
      solveSpice(json({ components: [{ id: 'R', type: 'R', a: 1, b: 2, value: 100 }], probe: 1 })),
    /Singular/,
  );
  assert.throws(
    () =>
      solveSpice(
        json({
          components: [
            { id: 'V', type: 'V', a: 1, b: 0, value: 5 },
            { id: 'C', type: 'C', a: 1, b: 0, value: 1e-6, initial: 0 },
          ],
          probe: 1,
        }),
      ),
    /Singular|Newton/,
  );
  assert.throws(
    () => parseSpice(json({ ...JSON.parse(spiceExample), positions: { 1: ['bad', 0] } })),
    /Layout/,
  );
});
test('CST uniform traction patch matches stress, strain, energy and force balance', () => {
  const r = solveContinuum(femExample);
  near(r.summary.stress, 0.2);
  near(r.summary.energy, 0.0005);
  r.visualization.stress.forEach(([x, y, t]) => {
    near(x, 200000, 1e-7);
    near(y, 0, 1e-7);
    near(t, 0, 1e-7);
  });
  near(r.visualization.displacement[2], 1e-6, 1e-15);
  near(r.visualization.displacement[5], -0.3 * 0.5e-6, 1e-15);
  r.visualization.forceBalance.forEach((v) => near(v, 0, 1e-9));
});
test('triangle orientation leaves the physical elastic solution unchanged', () => {
  const p = JSON.parse(femExample);
  p.triangles = p.triangles.map((t) => t.toReversed());
  near(solveContinuum(json(p)).summary.energy, solveContinuum(femExample).summary.energy, 1e-15);
});
test('a uniform stress contour does not exaggerate floating-point differences', () => {
  const r = solveContinuum(femExample),
    v = builderVisual(r.visualization);
  const colors = [...v.drawing.matchAll(/fill="(rgb\([^"]+\))" fill-opacity/g)].map((m) => m[1]);
  assert.equal(new Set(colors).size, 1);
});
test('shared-edge refinement produces a conforming mesh and interpolates boundary data', () => {
  const p = refineMesh(femExample);
  assert.equal(p.nodes.length, 9);
  assert.equal(p.triangles.length, 8);
  assert.deepEqual(p.loads, JSON.parse(femExample).loads);
  const r = solveContinuum(json(p), { analysis: 'heat' });
  p.nodes.forEach(([x], i) => near(r.visualization.nodal[i], 20 + 80 * x, 1e-10));
  for (const flux of r.visualization.flux) {
    near(flux[0], -45 * 80, 1e-8);
    near(flux[1], 0, 1e-8);
  }
  near(r.summary.balance, 0, 1e-9);
});
test('modal frequencies scale with sqrt(E/rho), with small eigen residuals', () => {
  const a = solveContinuum(femExample, { analysis: 'modal' }),
    b = solveContinuum(femExample, { analysis: 'modal', E: 8e11 });
  near(b.summary.frequency / a.summary.frequency, 2, 1e-10);
  assert.ok(a.summary.residual < 1e-9);
});
test('single free CST coordinate matches a hand-derived generalized eigenvalue', () => {
  const project = {
    nodes: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    triangles: [[0, 1, 2]],
    supports: [
      [0, 0, 0],
      [1, null, 0],
      [2, 0, 0],
    ],
    loads: [],
  };
  const E = 2e11,
    nu = 0.3,
    density = 7800,
    r = solveContinuum(json(project), { analysis: 'modal', E, nu, density });
  near(r.summary.frequency, Math.sqrt((3 * E) / (density * (1 - nu * nu))) / (2 * Math.PI), 1e-8);
});
test('degenerate triangles and unrestrained elastic bodies fail explicitly', () => {
  const p = JSON.parse(femExample);
  p.nodes[2] = [0.5, 0];
  assert.throws(() => parseMesh(json(p)), /degenerate|area/i);
  const free = JSON.parse(femExample);
  free.supports = [];
  assert.throws(() => solveContinuum(json(free)), /Singular/);
});
test('compiled unity feedback matches its independent first-order step response', () => {
  const r = solveControlGraph(controlGraphExample);
  for (const p of r.series) near(p.y, (2 / 3) * (1 - Math.exp(-3 * p.x)), 1e-9);
});
test('second-order and direct-feedthrough transfer functions match closed forms', () => {
  for (const [num, den, exact] of [
    [[1], [1, 2, 1], (t) => 1 - (1 + t) * Math.exp(-t)],
    [[1, 0], [1, 1], (t) => Math.exp(-t)],
  ]) {
    const p = {
      blocks: [
        { id: 'r', type: 'constant', value: 1 },
        { id: 'g', type: 'transfer', num, den },
      ],
      wires: [['r', 'g', 0]],
      output: 'g',
    };
    for (const point of solveControlGraph(json(p), { duration: 2, steps: 800 }).series)
      near(point.y, exact(point.x), 1e-10);
  }
});
test('memoryless nonlinear blocks and integrators evaluate their own input ports', () => {
  for (const [type, fields, expected] of [
    ['deadzone', { width: 0.3 }, 0.7],
    ['relay', { level: 2 }, 2],
    ['product', {}, 1],
  ]) {
    const p = {
      blocks: [
        { id: 'r', type: 'constant', value: 1 },
        { id: 'out', type, ...fields },
      ],
      wires: [['r', 'out', 0], ...(type === 'product' ? [['r', 'out', 1]] : [])],
      output: 'out',
    };
    near(solveControlGraph(json(p), { steps: 20 }).summary.final, expected);
  }
  const p = {
    blocks: [
      { id: 'r', type: 'sine', value: 1, frequency: 1 },
      { id: 'out', type: 'integrator', initial: [2] },
    ],
    wires: [['r', 'out', 0]],
    output: 'out',
  };
  for (const point of solveControlGraph(json(p), { duration: 1, steps: 800 }).series)
    near(point.y, 2 + (1 - Math.cos(2 * Math.PI * point.x)) / (2 * Math.PI), 1e-10);
});
test('nonlinear actuator limiting stays bounded and converges under halved steps', () => {
  const p = models.controlbuilder.definition.presets['Actuator saturation'].project;
  const a = solveControlGraph(p, { steps: 800 }),
    b = solveControlGraph(p, { steps: 1600 });
  near(a.summary.final, b.summary.final, 1e-8);
  assert.ok(a.summary.final < 0.3 && a.summary.final > 0.299);
});
test('direct feedthrough loops, missing ports and improper transfer functions are rejected', () => {
  const p = JSON.parse(controlGraphExample);
  p.blocks.find((b) => b.id === 'plant').num = [1, 1];
  assert.throws(() => compileControl(json(p)), /algebraic/i);
  p.blocks.find((b) => b.id === 'plant').num = [1, 1, 1];
  assert.throws(() => compileControl(json(p)), /proper/);
  const q = JSON.parse(controlGraphExample);
  q.wires.pop();
  assert.throws(() => compileControl(json(q)), /port|input/i);
});
test('pendulum respects the pin and converges in energy as timestep shrinks', () => {
  const a = solveMechanism(mechanismExample, { steps: 400 }),
    b = solveMechanism(mechanismExample, { steps: 800 });
  assert.ok(b.summary.residual < 1.1e-9);
  assert.ok(b.summary.drift < a.summary.drift * 0.6);
  const p = parseMechanism(mechanismExample);
  for (const f of b.visualization.frames)
    mechanismConstraints(p, f.q, f.t).forEach((v) => near(v, 0, 1.1e-9));
});
test('driven four-bar follows the prescribed crank angle while closing all joints', () => {
  const preset = models.mechanismbuilder.definition.presets['Driven four-bar'],
    r = solveMechanism(preset.project, preset),
    p = parseMechanism(preset.project);
  assert.equal(r.summary.dofs, 0);
  for (const f of r.visualization.frames) {
    near(f.q[2], ((60 + 30 * f.t) * Math.PI) / 180, 1e-8);
    mechanismConstraints(p, f.q, f.t).forEach((v) => near(v, 0, 1.1e-9));
  }
});
test('slider, welded and distance constraints satisfy independent motion cases', () => {
  const body = {
    id: 'body',
    x: 0,
    y: 0,
    angle: 0,
    mass: 2,
    inertia: 1,
    length: 1,
    force: [2, 0, 0],
  };
  const joint = {
    id: 'joint',
    type: 'prismatic',
    a: 'ground',
    b: 'body',
    anchorA: [0, 0],
    anchorB: [0, 0],
    axis: 0,
    angle: 0,
  };
  const project = { bodies: [body], joints: [joint], probe: { body: 'body', point: [0, 0] } };
  const r = solveMechanism(json(project), { gravity: 0, duration: 1, steps: 100 });
  near(r.series.at(-1).y, 0.5, 1e-8);
  near(r.series.at(-1).reference, 0);
  project.joints[0] = { ...joint, type: 'weld' };
  near(solveMechanism(json(project), { gravity: 0, duration: 1, steps: 100 }).series.at(-1).y, 0);
  project.bodies[0].x = 1;
  project.joints[0] = { ...joint, type: 'distance', length: 1 };
  near(
    solveMechanism(json(project), { gravity: 0, duration: 1, steps: 100 }).series.at(-1).y,
    1,
    1e-8,
  );
});
test('free rigid body preserves translation without gravity or damping', () => {
  const p = JSON.parse(mechanismExample);
  p.joints = [];
  p.bodies[0].velocity = [1, 2, 0];
  const r = solveMechanism(json(p), { duration: 1, steps: 100, gravity: 0 });
  near(r.series.at(-1).y - r.series[0].y, 1, 1e-10);
  near(r.series.at(-1).reference - r.series[0].reference, 2, 1e-10);
  near(r.summary.drift, 0, 1e-10);
});
test('arbitrary graph algorithms agree on shortest distances beyond the old six-node graph', () => {
  const a = traceDsa(dsaExample, 'dijkstra'),
    b = traceDsa(dsaExample, 'bellman');
  assert.deepEqual(a.result.distance, [0, 3, 1, 4, 6, 7, 9, 10]);
  assert.deepEqual(a.result.distance, b.result.distance);
  for (const kind of ['bfs', 'dfs'])
    assert.equal(traceDsa(dsaExample, kind).result.order.length, 8);
  const p = JSON.parse(dsaExample);
  p.nodes.push('isolated');
  p.directed = false;
  const r = traceDsa(json(p), 'kruskal');
  assert.equal(r.result.forest.length, 7);
  assert.equal(r.result.weight, 11);
});
test('negative edges require Bellman–Ford and reachable negative cycles are reported', () => {
  const p = {
    nodes: ['a', 'b', 'c'],
    edges: [
      [0, 1, 1],
      [1, 2, -3],
      [2, 1, 1],
    ],
    start: 0,
    directed: true,
  };
  assert.throws(() => traceDsa(json(p), 'dijkstra'), /nonnegative/);
  assert.equal(traceDsa(json(p), 'bellman').result.negativeCycle, true);
});
test('all custom sort implementations match native sorting for duplicates and negative values', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 128 }),
      (array) => {
        for (const algo of ['insertion', 'merge', 'quick'])
          assert.deepEqual(
            traceDsa(json({ array }), algo, { capture: false }).result.array,
            array.toSorted((a, b) => a - b),
          );
      },
    ),
    { numRuns: 80, seed: 42 },
  );
  const r = traceDsa(json({ array: Array.from({ length: 128 }, (_, i) => 128 - i) }), 'insertion');
  assert.equal(r.frames.length, 12000);
  assert.equal(r.frames.at(-1).line, 4);
  assert.equal(r.result.array[0], 1);
});
test('benchmark returns finite measured ranges and deterministic operation counts', () => {
  const a = benchmarkDsa('merge', { repeats: 3 }),
    b = benchmarkDsa('merge', { repeats: 3 });
  assert.deepEqual(
    a.rows.map((r) => r.operations),
    b.rows.map((r) => r.operations),
  );
  for (const r of a.rows) {
    assert.ok(r.minimum >= 0 && r.maximum >= r.milliseconds && r.milliseconds >= r.minimum);
    assert.ok(Number.isFinite(r.milliseconds));
  }
  assert.throws(() => benchmarkDsa('merge', { repeats: 100 }), /repeats/);
});

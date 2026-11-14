import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { models } from '../backend/numeric-models.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
import { labManifest } from '../backend/lab-manifest.js';
import { mathVisual } from '../frontend/public/math-visuals.js';
import { eigenSymmetric, matvec, dot } from '../backend/math-core.js';
import { rk45, barycentric } from '../backend/mathematics-numerical.js';
import {
  neuralLossGradient,
  mixtureEM,
  trainSVM,
  dataset,
  convolution,
  kmeans,
} from '../backend/ml-engine.js';
const additions = Object.fromEntries(
  Object.entries(models).filter(([, m]) =>
    ['mathematics', 'machinelearning'].includes(m.definition.discipline),
  ),
);
const defaults = (id) =>
  Object.fromEntries(Object.entries(models[id].definition.inputs).map(([k, f]) => [k, f.initial]));
const solve = (id, v = {}) => models[id].solve({ ...defaults(id), ...v });
const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}, tolerance ${tol}`);
function finiteTree(value, path = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), path);
  else if (Array.isArray(value)) value.forEach((v, i) => finiteTree(v, `${path}[${i}]`));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) finiteTree(v, `${path}.${k}`);
}
test('all requested labs are unique manifest entries in their six subject groups', () => {
  assert.equal(Object.keys(additions).length, 66);
  const math = Object.values(additions).filter((m) => m.definition.discipline === 'mathematics');
  assert.equal(math.length, 52);
  const counts = {};
  for (const m of math) counts[m.definition.topic] = (counts[m.definition.topic] ?? 0) + 1;
  assert.deepEqual(Object.values(counts), [14, 8, 10, 12, 8]);
  assert.equal(labManifest.length, 241);
  for (const id of Object.keys(additions))
    assert.equal(labManifest.filter((m) => m.id === id).length, 1);
});
for (const [id, m] of Object.entries(additions))
  test(`${id}: finite defaults, worker metadata, teaching notes and HTTP parity`, async () => {
    const input = defaults(id),
      d = m.definition;
    assert.ok(validate(d, input).values);
    assert.equal(d.execution, 'worker');
    for (const key of ['description', 'predict', 'example', 'equation', 'limits'])
      assert.ok(d[key].length > 15, `${id} ${key}`);
    assert.equal(d.prediction[0].length, 3);
    const r = solve(id);
    finiteTree(r);
    assert.ok(r.series.length);
    assert.deepEqual(Object.keys(r.summary).sort(), Object.keys(d.metrics).sort());
    assert.deepEqual(r, solve(id), 'seeded solver must be reproducible');
    if (r.visualization) {
      for (const index of [0, Math.floor(r.series.length / 2), r.series.length - 1]) {
        const v = mathVisual(r.visualization, index);
        assert.ok(v.drawing.length > 100);
        assert.doesNotMatch(v.drawing, /NaN|Infinity|undefined|\[object Object\]/);
      }
    }
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: id, input }),
      }),
    );
    assert.equal(response.status, 200);
    const api = await response.json();
    assert.deepEqual(api.summary, r.summary);
    assert.deepEqual(api.series, r.series);
  });
test('calculus: epsilon certification, derivatives, four quadrature rules and Taylor bound have independent references', () => {
  near(solve('mathlimits').summary.worst, 0.3225);
  assert.equal(solve('mathlimits', { delta: 1 }).summary.certified, 0);
  near(solve('mathderivative', { x: 2, h: 0.25 }).summary.secant, 4.25);
  near(solve('mathrules').summary.derivative, 2 * Math.cos(1));
  for (const [method, value] of [
    ['left', 0.125],
    ['right', 0.625],
    ['midpoint', 0.3125],
    ['trapezoid', 0.375],
  ])
    near(solve('mathriemann', { n: 2, method }).summary.estimate, value);
  near(solve('mathftc', { x: 2 }).summary.area, 2 / 3);
  for (const x of [-3, -1, 0, 1, 3])
    for (const order of [0, 1, 4, 10, 16]) {
      const r = solve('mathtaylor', { x, order }).summary;
      assert.ok(r.error <= r.bound + 1e-12);
    }
});
test('calculus: series endpoints, rates, constraint extrema, volume, ellipse and vector theorems', () => {
  near(solve('mathpowerseries', { x: 1 }).summary.radius, 1);
  assert.equal(solve('mathpowerseries', { x: 1 }).summary.limit, null);
  assert.equal(solve('mathseriestests', { family: 'pseries', power: 1 }).summary.converges, 0);
  near(solve('mathrelatedrates').summary.dependentRate, -0.15);
  near(solve('mathlagrange').summary.maximum, Math.sqrt(5));
  near(solve('mathgradient').summary.norm, Math.sqrt(8));
  near(solve('mathdoubleintegral').summary.exact, 16 / 3);
  near(solve('matharclength', { a: 2, b: 2 }).summary.reference, 4 * Math.PI, 1e-10);
  near(solve('matharclength', { a: 2, b: 2 }).summary.curvature, 0.5);
  near(solve('mathdivcurl').summary.flux, 2 * Math.PI);
  near(solve('mathdivcurl', { expansion: 0 }).summary.divergence, 0);
});
test('linear algebra: geometric and factorization reference cases', () => {
  near(solve('mathtransform', { matrix: '[[2,0],[0,-3]]' }).summary.determinant, -6);
  near(solve('mathgaussian').summary.residual, 0);
  const inconsistent = solve('mathgaussian', { matrix: '[[1,0,0,1],[0,1,0,2],[0,0,0,3]]' });
  assert.equal(inconsistent.summary.consistent, 0);
  assert.equal(inconsistent.summary.residual, null);
  assert.equal(
    solve('mathgaussian', { matrix: '[[1,0,0,1],[0,1,0,2],[0,0,0,0]]' }).summary.unique,
    0,
  );
  for (const A of ['[[2,0],[0,3]]', '[[2,1],[1,2]]']) {
    const r = solve('matheigen', { matrix: A }),
      a = JSON.parse(A);
    for (const v of r.visualization.eigenvectors) {
      const Av = matvec(a, v);
      near(v[0] * Av[1] - v[1] * Av[0], 0);
    }
  }
  assert.equal(solve('matheigen', { matrix: '[[0,-1],[1,0]]' }).summary.lambda1, null);
  near(solve('mathgramschmidt').summary.error, 0);
  near(solve('mathprojection').summary.coefficient, 0.8);
  near(solve('mathprojection').summary.orthogonality, 0);
  const svd = solve('mathsvd', { matrix: '[[3,0],[0,2]]' });
  near(svd.summary.sigma1, 3);
  near(svd.summary.error, 2);
  near(solve('mathsvd', { rank: 2 }).summary.error, 0);
  near(solve('mathlu', { pivot: 'no' }).summary.growth, 9999);
  near(solve('mathlu').summary.residual, 0);
  near(solve('mathpoweriteration').summary.estimate, (5 + Math.sqrt(5)) / 2);
});
test('ODEs: analytic trajectories, conserved quantities, extinction, poles and stiff instability', () => {
  near(solve('mathdirection').summary.final, 1 + 2 * Math.exp(-2), 1e-10);
  near(solve('mathintegrating', { a: 0, b: 2, initial: 1, horizon: 3 }).summary.final, 7);
  near(solve('mathphase').summary.distance, Math.exp(-2), 1e-8);
  const lv = solve('mathpredator', { prey: 1, predator: 1 });
  near(lv.summary.prey, 1);
  near(lv.summary.drift, 0);
  const h = solve('mathharvesting', { harvest: 2 });
  assert.equal(h.summary.upper, null);
  near(h.summary.final, 0);
  const v = solve('mathvanderpol', { mu: 0, x: 1, v: 0, horizon: 4 });
  near(v.summary.final, Math.cos(4), 1e-8);
  const lorenz = solve('mathlorenz', { perturbation: 1e-8, horizon: 2 });
  assert.ok(lorenz.summary.separation < 1e-5);
  near(solve('mathlaplace', { zeta: 1, omega: 2, horizon: 1 }).summary.final, 1 - 3 * Math.exp(-2));
  assert.ok(solve('mathstiff').summary.explicit > 1000);
  assert.ok(solve('mathstiff').summary.implicit < 0.001);
  const a = solve('mathwave', { time: 0 }),
    b = solve('mathwave', { time: 3 });
  near(a.summary.energy, b.summary.energy);
  near(a.series[0].y, 0);
  near(a.series.at(-1).y, 0);
});
test('probability: moments, Bayes, mass, coverage, power, regression and stationary laws', () => {
  const clt = solve('mathclt').summary;
  assert.ok(Math.abs(clt.mean) < 0.12);
  assert.ok(Math.abs(clt.variance - 1) < 0.15);
  near(solve('mathlln').summary.truth, 0.5);
  near(solve('mathbayes').summary.ppv, 0.0095 / 0.059);
  const d = solve('mathdistributions');
  near(
    d.series.reduce((s, p) => s + p.y, 0),
    1,
  );
  near(d.summary.mean, 3);
  near(
    solve('mathconfidence', { sigma: 1, size: 25 }).summary.width,
    (2 * 1.95996398454) / 5,
    1e-6,
  );
  near(solve('mathpower', { effect: 0 }).summary.power, 0.05, 2e-7);
  const r = solve('mathregression', { data: '[[0,1],[1,3],[2,5]]' }).summary;
  near(r.slope, 2);
  near(r.intercept, 1);
  near(r.r2, 1);
  near(solve('mathmarkov').summary.stationary, 0.4);
  assert.equal(solve('mathmarkov', { p: 0, q: 0 }).summary.stationary, null);
  near(solve('mathbrownian').summary.theory, 1);
  const boot = solve('mathbootstrap', { data: '5,5,5' }).summary;
  near(boot.lower, 5);
  near(boot.upper, 5);
  near(boot.se, 0);
  near(solve('mathmle', { data: '1,2,3' }).summary.estimate, 0.5);
  near(solve('mathmle', { family: 'normal', data: '1,2,3' }).summary.variance, 2 / 3);
  const poisson = solve('mathpoissonprocess');
  near(poisson.summary.expected, 30);
  assert.ok(poisson.series.every((r, i, a) => !i || r.y >= a[i - 1].y));
});
test('numerical methods: residuals, exact quadrature, refinement, instability, interpolation and adaptive accuracy', () => {
  const j = solve('mathjacobi');
  assert.ok(j.summary.jacobi < 1e-9);
  assert.ok(j.summary.seidel < 1e-12);
  near(solve('mathquadrature', { function: 'poly', panels: 1 }).summary.exact, 0.2);
  near(solve('mathquadrature', { function: 'poly', panels: 1 }).summary.simpson, 1 / 120);
  const coarse = solve('mathheat', { cells: 10, steps: 15 }),
    fine = solve('mathheat', { cells: 20, steps: 60 });
  near(coarse.summary.time, fine.summary.time);
  assert.ok(fine.summary.error < coarse.summary.error / 3);
  assert.ok(solve('mathheat', { ratio: 1, steps: 200 }).warnings.length);
  assert.ok(solve('mathpoisson', { iterations: 300 }).summary.residual < 1e-8);
  const runge = solve('mathrunge');
  assert.ok(runge.summary.uniform > runge.summary.chebyshev * 10);
  near(barycentric([-1, 0, 1], [1, 0, 1], 0.25), 0.0625);
  assert.ok(solve('mathconjugate', { iterations: 2 }).summary.cg < 1e-10);
  near(solve('mathroundoff', { exponent: -18 }).summary.direct, 0);
  const r = rk45((t, y) => -4 * y, 1, 4, { rtol: 1e-8, atol: 1e-11, initialStep: 1 });
  assert.ok(r.rejected > 0);
  near(r.rows.at(-1).y, Math.exp(-16), 1e-10);
  assert.ok(r.rows.some((v) => v.h !== r.rows[1].h));
});
test('ML reference behavior: convex optimization, sparsity, nonlinear capacity, PCA and filtering', () => {
  assert.ok(solve('mlgradient').summary.loss < 1e-7);
  assert.equal(solve('mlregularization').summary.zeros, 2);
  const lr = solve('mllogistic');
  assert.ok(lr.summary.loss < 0.1);
  assert.ok(lr.summary.test > 0.95);
  assert.equal(solve('mlkmeans').summary.empty, 0);
  near(solve('mlknn', { neighbors: 1 }).summary.train, 1);
  const pca = solve('mlpca').summary;
  near(pca.error, (pca.lambda2 * 79) / 80);
  assert.ok(pca.explained > 0.8);
  const svm = solve('mlsvm');
  assert.ok(svm.summary.violation < 0.01);
  assert.ok(svm.summary.test > 0.9);
  near(solve('mltree').summary.gain, 0.5);
  const b = solve('mlbiasvariance').summary;
  near(b.test, b.bias + b.variance + b.noise);
  assert.ok(solve('mlperceptron', { shape: 'linear' }).summary.accuracy === 1);
  assert.ok(solve('mlperceptron').summary.accuracy < 1);
  const network = solve('mlbackprop').summary;
  assert.equal(network.accuracy, 1);
  assert.ok(network.gradient < 1e-8);
  const roc = solve('mlroc').summary;
  assert.ok(roc.auc > 0.8 && roc.auc < 0.95);
  const em = solve('mlgmm').summary;
  assert.ok(em.mean2 - em.mean1 > 2);
  near(solve('mlconvolution').summary.maximum, 4);
  assert.deepEqual(
    convolution(
      Array.from({ length: 4 }, () => Array(4).fill(1)),
      [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
    ),
    [
      [9, 9],
      [9, 9],
    ],
  );
});
test('backprop gradients agree in every coordinate, not just the displayed diagnostic', () => {
  const data = dataset('xor', 8, 12, 0.1),
    w = Array.from({ length: 13 }, (_, i) => Math.sin(i) / 3),
    r = neuralLossGradient(w, data);
  for (let i = 0; i < w.length; i++) {
    const a = [...w],
      b = [...w];
    a[i] += 1e-5;
    b[i] -= 1e-5;
    near(
      r.gradient[i],
      (neuralLossGradient(a, data).loss - neuralLossGradient(b, data).loss) / 2e-5,
      1e-9,
    );
  }
});
test('iterative ML objectives, SVM dual feasibility, and eigenpair properties hold across seeded data', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 10000 }), (seed) => {
      const data = dataset('linear', 40, seed, 0.4),
        km = kmeans(
          data.map((p) => p.x),
          3,
          12,
          seed,
        ),
        em = mixtureEM(
          data.map((p) => p.x[0]),
          20,
        ),
        svm = trainSVM(data, 1, 1, 'linear');
      for (let i = 1; i < km.history.length; i++)
        assert.ok(km.history[i].y <= km.history[i - 1].y + 1e-9);
      for (let i = 1; i < em.history.length; i++)
        assert.ok(em.history[i].y >= em.history[i - 1].y - 1e-8);
      assert.ok(svm.a.every((v) => v >= -1e-9 && v <= 1 + 1e-9));
      near(
        dot(
          svm.a,
          data.map((p) => 2 * p.label - 1),
        ),
        0,
        1e-8,
      );
      const A = [
          [2, seed % 5],
          [seed % 5, 3],
        ],
        e = eigenSymmetric(A);
      for (let j = 0; j < 2; j++) {
        const v = e.vectors.map((r) => r[j]),
          Av = matvec(A, v);
        near(Av[0], e.values[j] * v[0]);
        near(Av[1], e.values[j] * v[1]);
      }
    }),
    { numRuns: 15, seed: 42 },
  );
});
test('malformed matrices and datasets are rejected before solving or HTML interpolation', () => {
  for (const [id, field, payload] of [
    ['mathtransform', 'matrix', '[[1,2],[3,"<img src=x onerror=alert(1)>"]]'],
    ['mathgaussian', 'matrix', '[[1,2],[3,4]]'],
    ['mathregression', 'data', '[[1,2],[1,3],[1,4]]'],
    ['mathbootstrap', 'data', '1,,3'],
    ['mathmle', 'data', '0,1,2'],
  ])
    assert.ok(validate(models[id].definition, { ...defaults(id), [field]: payload }).message, id);
  assert.ok(validate(models.mathlu.definition, { ...defaults('mathlu'), epsilon: 1 }).message);
});

test('individual control bounds and enum alternatives produce finite outputs; finite-time poles are rejected', () => {
  for (const [id, m] of Object.entries(additions))
    for (const [key, field] of Object.entries(m.definition.inputs)) {
      const alternatives =
        field.type === 'number'
          ? [field.min, field.max]
          : field.type === 'enum'
            ? field.options
            : [];
      for (const value of alternatives) {
        const input = { ...defaults(id), [key]: value },
          checked = validate(m.definition, input);
        assert.ok(checked.values, `${id}:${key}=${value}: ${checked.message}`);
        finiteTree(m.solve(checked.values), `${id}:${key}=${value}`);
      }
    }
  const pole = validate(models.mathdirection.definition, {
    ...defaults('mathdirection'),
    equation: 'logistic',
    initial: -1,
    horizon: 2,
  });
  assert.equal(pole.key, 'horizon');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  explorationReleaseModels as labs,
  newExplorationModels,
} from '../backend/exploration-release.js';
import { catalog } from '../backend/catalog.js';
import { disciplines } from '../backend/disciplines.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
import { fft, trajectory, seq } from '../backend/exploration-kit.js';
import { fresnel, chargeField } from '../backend/optics-electromagnetics.js';
import { butterworth2, frequencyResponse, firKernel } from '../backend/dsp-studies.js';
import { polynomialRoots, mpcPlan } from '../backend/control-studies.js';
import { pt100, typeT, allanDeviation } from '../backend/instrumentation-studies.js';
import {
  keplerE,
  orbitalPoint,
  normalShock,
  obliqueShock,
} from '../backend/flight-orbital-studies.js';
import { flashState, distillation } from '../backend/process-studies.js';
import { simplex, erlangC, lineData, jobData } from '../backend/operations-studies.js';
import { hhRates } from '../backend/biomedical-studies.js';
import {
  segmentClear,
  rrt,
  trajectoryProfile,
  quaternionZYX,
} from '../backend/robotics-studies.js';
import { raisedCosine, ofdmBlock } from '../backend/communication-studies.js';
import { explorationVisual } from '../frontend/public/exploration-visuals.js';
import { explorationThumbnail } from '../frontend/public/exploration-art.js';
const defaults = (id) =>
  Object.fromEntries(Object.entries(labs[id].definition.inputs).map(([k, f]) => [k, f.initial]));
const solve = (id, changes = {}) => {
  const m = labs[id],
    check = validate(m.definition, { ...defaults(id), ...changes });
  assert.ok(check.values, `${id}: ${check.message}`);
  return m.solve(check.values);
};
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}, tolerance ${tolerance}`,
  );
function finite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}
test('86 requested topics use 84 new routes and two existing routes, with five new discipline entries', () => {
  assert.equal(Object.keys(newExplorationModels).length, 84);
  assert.equal(Object.keys(labs).length, 86);
  assert.equal(catalog.length, 464);
  assert.equal(Object.keys(disciplines).length, 26);
  for (const id of Object.keys(labs))
    assert.equal(catalog.filter((l) => l.id === id).length, 1, id);
  assert.equal(catalog.find((l) => l.id === 'tolerancestack').groups[0], 'manufacturing');
});
for (const [id, model] of Object.entries(labs))
  test(`${id}: worker controls, native diagram, teaching and HTTP agree`, async () => {
    const d = model.definition,
      r = solve(id);
    finite(r);
    assert.equal(d.execution, 'worker');
    assert.deepEqual(Object.keys(r.summary).sort(), Object.keys(d.metrics).sort());
    assert.ok(r.series.length >= 2);
    for (const key of ['description', 'predict', 'equation', 'example', 'limits'])
      assert.ok(d[key].length > 20, `${id}.${key}`);
    assert.equal(d.prediction[0].length, 3);
    assert.deepEqual(r, solve(id), 'deterministic seeded replay');
    for (const index of [0, Math.floor(r.series.length / 2), r.series.length - 1]) {
      const svg = explorationVisual(r.visualization, index);
      assert.ok(svg.drawing.length > 100);
      assert.doesNotMatch(svg.drawing, /NaN|Infinity|undefined|\[object Object\]/);
      assert.doesNotMatch(svg.drawing, /<script|onload=/i);
    }
    if (newExplorationModels[id]) assert.ok(explorationThumbnail(id).length > 100);
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: defaults(id) }),
      }),
    );
    assert.equal(response.status, 200, id);
    const remote = await response.json();
    assert.deepEqual(remote.summary, JSON.parse(JSON.stringify(r.summary)));
    assert.deepEqual(remote.series, JSON.parse(JSON.stringify(r.series)));
    for (const changes of Object.values(d.presets ?? {})) finite(solve(id, changes));
  });
test('every individual control endpoint or enum is finite or rejected by its own validation hook', () => {
  for (const [id, m] of Object.entries(labs))
    for (const [key, f] of Object.entries(m.definition.inputs))
      for (const value of f.type === 'number'
        ? [f.min, f.max]
        : f.type === 'enum'
          ? f.options
          : []) {
        const check = validate(m.definition, { ...defaults(id), [key]: value });
        if (check.values) {
          try {
            finite(m.solve(check.values));
          } catch (e) {
            throw Error(`${id}.${key}=${value}: ${e.message}`);
          }
        } else assert.ok(m.definition.inputs[check.key], `${id}: field-specific error`);
      }
});
test('Snell, normal Fresnel, Brewster and TIR reference values', () => {
  near(solve('snell').summary.angle, 48.59037789072914);
  near(solve('snell').summary.critical, 41.810314895778596);
  near(fresnel(1, 1.5, 0).rs, 0.04);
  near(fresnel(1, 1.5, 0).rp, 0.04);
  near(fresnel(1, 1.5, (Math.atan(1.5) * 180) / Math.PI).rp, 0);
  assert.equal(fresnel(1.5, 1, 60).transmitted, null);
  near(fresnel(1.5, 1, 60).rs, 1);
});
test('lens real/virtual/focal cases, diffraction center and absent first minimum', () => {
  near(solve('thinlens').summary.image, 15);
  near(solve('thinlens').summary.magnification, -0.5);
  near(solve('thinlens', { object: 5 }).summary.image, -10);
  assert.equal(solve('thinlens', { object: 10 }).summary.image, null);
  near(solve('diffraction').summary.fringe, 27.5);
  near(solve('diffraction').series.find((p) => p.x === 0).y, 1);
  assert.equal(solve('diffraction', { width: 0.5, wavelength: 750 }).summary.first, null);
});
test('electrostatic superposition equals the potential gradient and respects charge scaling', () => {
  const charges = [
      [1, -0.5, 0],
      [-1, 0.5, 0],
    ],
    f = chargeField(charges, 0, 0.5),
    h = 1e-5;
  near(f.potential, 0);
  near(
    f.ex,
    -(chargeField(charges, h, 0.5).potential - chargeField(charges, -h, 0.5).potential) / (2 * h),
    1e-6,
  );
  near(f.ey, 0);
  assert.equal(chargeField(charges, -0.5, 0), null);
  near(solve('currentloop').summary.center, 0.3141592653589793);
});
test('Faraday derivative, matched/shorted line and WR90 cutoff', () => {
  const r = solve('faraday');
  near(r.summary.emf, 0.5026548245743669);
  near(r.summary.power, r.summary.emf ** 2 / 20);
  const matched = solve('linereflection', { resistance: 50, reactance: 0 });
  near(matched.summary.magnitude, 0);
  near(matched.summary.vswr, 1);
  near(matched.summary.power, 100);
  assert.equal(solve('linereflection', { resistance: 0 }).summary.vswr, null);
  near(solve('waveguide').summary.cutoff, 6.557140376202975, 1e-8);
  assert.equal(solve('waveguide', { frequency: 1 }).summary.guide, null);
});
test('FFT matches independent direct DFT, inverse and Parseval energy', () => {
  const x = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.7) + 0.2 * Math.cos(i * 1.3)),
    X = fft(x),
    back = fft(
      X.map((v) => v.re),
      X.map((v) => v.im),
      true,
    );
  for (let k = 0; k < x.length; k++) {
    let re = 0,
      im = 0;
    for (let n = 0; n < x.length; n++) {
      re += x[n] * Math.cos((2 * Math.PI * k * n) / x.length);
      im -= x[n] * Math.sin((2 * Math.PI * k * n) / x.length);
    }
    near(X[k].re, re, 1e-10);
    near(X[k].im, im, 1e-10);
    near(back[k].re, x[k]);
  }
  near(
    X.reduce((s, v) => s + v.re ** 2 + v.im ** 2, 0) / x.length,
    x.reduce((s, v) => s + v * v, 0),
  );
  assert.throws(() => fft([1, 2, 3]));
});
test('Fourier midpoint, first square harmonic and bin-centered FFT amplitude', () => {
  const s = solve('fourierseries', { harmonics: 1 });
  near(s.series.find((v) => v.x === 0.25).y, 4 / Math.PI);
  near(s.series.find((v) => v.x === 0).y, 0);
  const f = solve('fftspectrum', { frequency: 17, window: 'rectangular' });
  near(f.summary.peak, 17);
  near(f.summary.amplitude, 1);
  near(f.summary.enbw, 1);
});
test('windowed FIR symmetry, impulse delay and Butterworth prewarped cutoff', () => {
  const h = firKernel(31, 40, 256, 'blackman');
  near(
    h.reduce((s, v) => s + v, 0),
    1,
  );
  h.forEach((v, i) => near(v, h[h.length - 1 - i]));
  near(solve('firwindow').summary.delay, 15);
  const { b, a } = butterworth2(40, 256),
    H = frequencyResponse(b, a, (2 * Math.PI * 40) / 256);
  near(Math.hypot(H.re, H.im), Math.SQRT1_2);
  near(solve('iirbutterworth').summary.cutoff, -3.010299956639812);
  assert.ok(solve('iirbutterworth').summary.radius < 1);
});
test('Laplace and z-plane stability are not inferred from finite frequency samples', () => {
  near(solve('laplacepz').summary.dc, 0.6);
  assert.equal(solve('laplacepz', { real: 1 }).summary.stable, 0);
  assert.equal(solve('zstability', { radius: 1 }).summary.stable, 0);
  assert.equal(solve('zstability', { radius: 0.9 }).summary.stable, 1);
  near(solve('correlationdelay', { noise: 0, delay: -20 }).summary.estimate, -20);
  near(solve('spectrogram', { window: '64' }).summary.frequency, 8);
  near(solve('spectrogram', { window: '64' }).summary.time, 0.125);
});
test('cubic roots satisfy Vieta and the Routh imaginary-axis benchmark', () => {
  const r = polynomialRoots([1, 3, 2, 6]);
  near(
    r.reduce((s, z) => s + z.re, 0),
    -3,
    1e-8,
  );
  for (const z of r) {
    const re = z.re,
      im = z.im;
    near(re ** 3 - 3 * re * im * im + 3 * (re * re - im * im) + 2 * re + 6, 0, 1e-7);
    near(3 * re * re * im - im ** 3 + 6 * re * im + 2 * im, 0, 1e-7);
  }
  assert.ok(r.some((z) => Math.abs(z.re + 3) < 1e-8));
  assert.ok(r.some((z) => Math.abs(z.im - Math.SQRT2) < 1e-8));
  near(solve('rootlocus3', { gain: 6 }).summary.abscissa, 0, 1e-8);
});
test('gain margin, pole matching, CARE residual and observer error decay benchmarks', () => {
  near(solve('loopmargins').summary.gain, 9.542425094393248);
  const p = solve('poleplacement');
  near(p.summary.k1, 2);
  near(p.summary.k2, 3);
  assert.ok(Math.abs(p.summary.settling) < 0.001);
  const l = solve('lqrtuning');
  near(l.summary.k1, 1);
  near(l.summary.k2, Math.sqrt(3));
  near(l.summary.cost, Math.sqrt(3));
  assert.ok(l.summary.residual < 1e-12);
  const o = solve('luenberger');
  near(o.summary.l1, 5);
  near(o.summary.l2, 6);
  assert.ok(o.summary.error < 1e-6);
  near(solve('zieglernichols').summary.ultimate, 8);
});
test('MPC constrained optimum matches independent dense grid for a two-step horizon', () => {
  const r = mpcPlan(0, 1, 2, 0.5, 0.4, 6000);
  let best = Infinity,
    bestU = null;
  for (let i = -40; i <= 40; i++)
    for (let j = -40; j <= 40; j++) {
      const u = i / 100,
        v = j / 100,
        cost = (u - 1) ** 2 + (u + v - 1) ** 2 + 0.5 * (u * u + v * v);
      if (cost < best) {
        best = cost;
        bestU = [u, v];
      }
    }
  near(r.u[0], bestU[0], 0.011);
  near(r.u[1], bestU[1], 0.011);
  assert.ok(r.residual < 1e-10);
  const s = solve('constrainedmpc');
  assert.ok(s.summary.peak <= 0.2 + 1e-12);
  assert.ok(Math.abs(s.summary.final - 1) < 1e-7);
});
test('PWM endpoint steady states, quantizer step and bridge small-signal sensitivities', () => {
  near(solve('pwmfilter', { duty: 0 }).summary.ripple, 0);
  near(solve('pwmfilter', { duty: 100 }).summary.mean, 3.3);
  near(solve('pwmfilter', { duty: 100 }).summary.ripple, 0, 1e-12);
  near(solve('adcquantization').summary.step, 19.53125);
  near(solve('strainbridge', { mode: 'full' }).summary.output, 10, 1e-8);
  near(solve('strainbridge', { mode: 'half' }).summary.output, 5, 1e-8);
  near(solve('strainbridge', { strain: 0 }).summary.output, 0);
});
test('temperature standards and inverse compensation reference points', () => {
  near(pt100(100), 138.5055, 1e-6);
  near(typeT(100), 4.2785186, 2e-6);
  near(typeT(0), 0);
  for (const sensor of ['type-t', 'pt100'])
    for (const T of [0, 100, 400])
      near(
        solve('temperaturelinearization', { sensor, temperature: T }).summary.corrected,
        T,
        1e-7,
      );
});
test('debounce stability, serial framing, timer representability and constant Allan series', () => {
  near(solve('debouncetimeline', { bounce: 0, debounce: 8, latency: 1 }).summary.service, 9, 0.051);
  near(solve('serialtiming', { bus: 'UART' }).summary.duration, 100);
  near(solve('serialtiming', { bus: 'SPI' }).summary.bits, 8);
  near(solve('serialtiming', { bus: 'I2C' }).summary.bits, 18);
  near(solve('timeroverflow').summary.tick, 4);
  near(solve('timeroverflow').summary.reload, 2499);
  assert.equal(
    solve('timeroverflow', { bits: '8', prescaler: '1', target: 10 }).summary.reload,
    null,
  );
  near(allanDeviation(Array(100).fill(7), 4), 0);
});
test('Merchant force equilibrium, Taylor optima and manufacturing scaling', () => {
  const m = solve('merchantcircle').summary;
  near(m.phi, 36.717474411461005);
  near(m.power, (m.cutting * 100) / 60);
  const t = solve('toollife').summary;
  assert.ok(t.economic < t.productive);
  near(solve('sheetbend').summary.allowance, 5.340707511102648);
  const roll = solve('rollingforce').summary;
  near(roll.contact, Math.sqrt(450));
  assert.equal(roll.bite, 1);
  near(solve('weldrosenthal').summary.heat, 600);
  const a = solve('moldingcooling', { thickness: 2 }).summary,
    b = solve('moldingcooling', { thickness: 4 }).summary;
  near(b.cooling, 4 * a.cooling);
  near(solve('additivebuild').summary.layers, 250);
});
test('Kepler equation closes, orbit energy and angular momentum conserve', () => {
  for (const e of [0, 0.3, 0.8])
    for (const M of [0, 0.1, 2, 6, 10]) near(keplerE(M, e) - e * Math.sin(keplerE(M, e)), M, 1e-10);
  const a = 12000,
    e = 0.3,
    points = seq(0, 2 * Math.PI, 100).map((M) => orbitalPoint(a, e, 0, 0, 0, M));
  near(Math.min(...points.map((v) => v.r)), 8400);
  near(Math.max(...points.map((v) => v.r)), 15600);
  const h = 1e-5,
    n = Math.sqrt(398600.4418 / a ** 3),
    p = orbitalPoint(a, e, 0, 0, 0, 1),
    u = orbitalPoint(a, e, 0, 0, 0, 1 + h),
    d = orbitalPoint(a, e, 0, 0, 0, 1 - h),
    vx = ((u.x - d.x) / (2 * h)) * n,
    vy = ((u.y - d.y) / (2 * h)) * n;
  near((vx * vx + vy * vy) / 2 - 398600.4418 / p.r, -398600.4418 / (2 * a), 1e-7);
  near(p.x * vy - p.y * vx, Math.sqrt(398600.4418 * a * (1 - e * e)), 1e-5);
});
test('zero Hohmann, vector plane change, normal and detached shocks, CG and Breguet references', () => {
  near(solve('hohmann', { initial: 300, final: 300 }).summary.total, 0);
  near(
    solve('planechange', { speed: 7.5, final: 7.5, angle: 20 }).summary.combined,
    2.6047226650039548,
  );
  const n = normalShock(2);
  near(n.pressure, 4.5);
  near(n.mach, 1 / Math.sqrt(3));
  assert.equal(obliqueShock(2, (40 * Math.PI) / 180).attached, false);
  const w = obliqueShock(2, (10 * Math.PI) / 180);
  near(w.beta, 39.3139318448, 1e-7);
  near(w.pressure, 1.7065786, 1e-6);
  near(solve('longitudinalstability').summary.neutral, 0.5524);
  near(solve('breguet').summary.endurance, 7.192051811294522, 1e-8);
  assert.ok(solve('thinairfoil').summary.capped <= 1.4);
});
test('batch linearization identifies all three synthetic orders and equilibrium reference is exact', () => {
  for (const [order, expected] of [
    ['zero', 0],
    ['first', 1],
    ['second', 2],
  ]) {
    const r = solve('batchorder', { order });
    near(r.summary.estimated, expected);
    near(r.summary.fit, 1, 1e-10);
  }
  near(solve('vantHoff', { temperature: 400 }).summary.constant, 2);
  near(solve('vantHoff', { enthalpy: 0 }).summary.constant, 2);
});
test('flash component balance, phase limits and finite distillation staging', () => {
  const f = flashState(0.5, 2, 0.5);
  near(f.fraction, 0.5);
  near(f.x, 1 / 3);
  near(f.y, 2 / 3);
  assert.equal(flashState(0.5, 0.5, 0.2).phase, 'Liquid only');
  assert.equal(flashState(0.5, 3, 2).phase, 'Vapor only');
  const d = distillation(2.5, 0.4, 0.95, 0.05, 3);
  assert.ok(d.stages > 5 && d.stages < 20);
  near(solve('mccabethiele').summary.distillate, 7 / 18);
  near(solve('binaryflash').summary.balance, 0);
  const r = solve('tanksrtd', { tanks: 3 }).summary;
  near(r.variance, 400 / 3);
  near(r.area, 1, 1e-5);
  assert.ok(solve('absorptionntu').summary.height > 0);
  near(
    solve('ergunbed').summary.drop,
    solve('ergunbed').summary.viscous + solve('ergunbed').summary.inertial,
  );
});
test('simplex equals independent corner optimum, detects unbounded and stores real pivots', () => {
  const r = simplex(
    [
      [1, 1],
      [2, 1],
      [1, 0],
    ],
    [8, 12, 5],
    [3, 2],
  );
  near(r.objective, 20);
  near(r.solution[0], 4);
  near(r.solution[1], 4);
  assert.ok(r.frames.length > 1);
  assert.equal(simplex([[1, 0]], [1], [1, 1]).status, 'unbounded');
  near(solve('graphicalLP').summary.objective, 20);
  near(solve('simplextableau').summary.objective, 20);
});
test('Erlang C reduces to M/M/1 and obeys the multiple-server reference', () => {
  const one = erlangC(3, 5, 1);
  near(one.wait, 0.3);
  near(one.length, 0.9);
  const two = solve('mmcqueue').summary;
  near(two.utilization, 75);
  near(two.wait, 9.642857142857142);
  near(two.probability, 64.28571428571429);
  near(solve('newsvendor').summary.fractile, 5 / 9);
  near(solve('linebalance').summary.takt, 63);
  assert.throws(() => lineData({ ...defaults('linebalance'), precedence: '0>1,1>0' }));
  assert.throws(() => jobData({ ...defaults('jobshopschedule'), jobs: '[[[4,2]]]' }));
});
test('line and job schedules conserve task work and never overlap on a lane', () => {
  for (const id of ['linebalance', 'jobshopschedule']) {
    const jobs = solve(id).visualization.jobs;
    for (let i = 0; i < jobs.length; i++)
      for (let j = i + 1; j < jobs.length; j++)
        if (jobs[i].lane === jobs[j].lane)
          assert.ok(jobs[i].end <= jobs[j].start || jobs[j].end <= jobs[i].start);
    assert.ok(jobs.every((j) => j.end > j.start));
  }
  const f = solve('exponentialsmoothing', { values: '100,105,110,120', alpha: 0.3 });
  near(f.series[1].reference, 100);
  near(f.series[2].reference, 101.5);
  near(f.summary.next, 108.835);
});
test('Hodgkin–Huxley removable singularities remain finite and injected current triggers spikes', () => {
  finite(hhRates(-40));
  finite(hhRates(-55));
  near(hhRates(-40).am, 1);
  near(hhRates(-55).an, 0.1);
  assert.equal(solve('hodgkinhuxley', { current: 0 }).summary.spikes, 0);
  assert.ok(solve('hodgkinhuxley').summary.spikes >= 1);
  near(solve('ecgsynthetic', { rate: 60, jitter: 0 }).summary.sdnn, 0);
  near(solve('ecgsynthetic', { rate: 60, jitter: 0 }).summary.rmssd, 0);
});
test('Windkessel mean-flow pressure, compartment mass balance and one-compartment exact solution', () => {
  const w = solve('windkessel').summary;
  near(w.flow, 5.25);
  near(w.mean, 87.5, 0.15);
  const p = solve('pharmacokinetics', { configuration: 'one' });
  near(p.summary.final, 10 * Math.exp(-2.4), 1e-8);
  near(p.summary.balance, 0, 1e-9);
  near(solve('pharmacokinetics').summary.balance, 0, 1e-9);
  const a = solve('bloodpoiseuille', { radius: 1 }).summary,
    b = solve('bloodpoiseuille', { radius: 2 }).summary;
  near(b.flow, 16 * a.flow);
  near(solve('pulseoximetry', { pulse: 0.001 }).summary.estimated, 95, 0.001);
  const s = solve('sirmodel').summary;
  near(s.basic, 3);
  assert.ok(s.balance < 1e-12);
});
test('trajectory limits/end states and quaternion norm hold over varied inputs', () => {
  fc.assert(
    fc.property(
      fc.double({ min: 0.1, max: 5, noNaN: true }),
      fc.double({ min: 0.1, max: 2, noNaN: true }),
      fc.double({ min: 0.1, max: 4, noNaN: true }),
      (d, v, a) => {
        const T = trajectoryProfile(d, v, a, 0).total;
        near(trajectoryProfile(d, v, a, T).position, d);
        near(trajectoryProfile(d, v, a, T).velocity, 0);
        for (const t of seq(0, T, 30)) {
          const s = trajectoryProfile(d, v, a, t);
          assert.ok(s.velocity <= v + 1e-8);
          assert.ok(Math.abs(s.acceleration) <= a + 1e-8);
        }
      },
    ),
    { numRuns: 60 },
  );
  fc.assert(
    fc.property(
      fc.double({ min: -3, max: 3, noNaN: true }),
      fc.double({ min: -1.57, max: 1.57, noNaN: true }),
      fc.double({ min: -3, max: 3, noNaN: true }),
      (r, p, y) => near(Math.hypot(...quaternionZYX(r, p, y)), 1),
    ),
    { numRuns: 60 },
  );
  near(solve('armjacobian', { first: 1, second: 1, elbow: 90 }).summary.determinant, 1);
  assert.equal(solve('armjacobian', { elbow: 0 }).summary.condition, null);
  assert.equal(solve('rotations', { pitch: 90 }).summary.condition, null);
  for (const profile of ['trapezoid', 'quintic']) {
    const r = solve('trajectoryplanning', { profile });
    near(r.series.at(-1).y, 2);
    assert.ok(r.summary.velocity <= 1 + 1e-8);
    assert.ok(r.summary.acceleration <= 2 + 1e-7);
  }
});
test('RRT path edges clear obstacles, parent ordering is valid and failure remains explicit', () => {
  assert.equal(segmentClear([0, 0], [10, 0], [[5, 0, 1]]), false);
  assert.equal(segmentClear([0, 2], [10, 2], [[5, 0, 1]]), true);
  const obstacles = [
      [5, 5, 1.4],
      [3, 7, 0.8],
      [7, 3, 0.8],
    ],
    r = rrt([1, 1], [9, 9], obstacles, 42, 700, 0.5);
  assert.ok(r.path.length > 0);
  r.parents.forEach((p, i) => assert.ok(p < i));
  for (let i = 1; i < r.path.length; i++)
    assert.ok(segmentClear(r.path[i - 1], r.path[i], obstacles, 0.1));
  assert.deepEqual(rrt([1, 1], [9, 9], obstacles, 42, 700, 0.5), r);
  assert.equal(rrt([1, 1], [9, 9], obstacles, 42, 1, 0.1).path.length, 0);
  assert.deepEqual(rrt([1, 1], [1, 1], obstacles, 42, 700, 0.5).path, [[1, 1]]);
  const grid = solve('occupancygrid').summary;
  near(grid.observed + grid.unknown, 1600);
  assert.ok(grid.occupied > 0);
});
test('vehicle energy, load, tire symmetry and braking square law benchmarks', () => {
  const b = solve('brakingtransfer', { reaction: 0 }),
    c = solve('brakingtransfer', { reaction: 0, speed: 50 });
  near(b.summary.braking, 4 * c.summary.braking);
  near(b.summary.frontload + b.summary.rearload, 1500 * 9.80665);
  near(solve('tireslip', { slip: 0 }).summary.force, 0);
  near(
    solve('tireslip', { slip: 10 }).summary.force,
    -solve('tireslip', { slip: -10 }).summary.force,
  );
  near(solve('understeer', { front: 50, cf: 70, cr: 70 }).summary.gradient, 0);
  const ev = solve('evrange', { stops: 0 }),
    regen = solve('evrange', { stops: 0, regeneration: 0 });
  near(ev.summary.consumption, regen.summary.consumption);
  assert.ok(
    solve('evrange', { regeneration: 0.6 }).summary.consumption <
      solve('evrange', { regeneration: 0 }).summary.consumption,
  );
  const q = solve('quartercar');
  assert.ok(q.summary.acceleration > 0 && q.summary.acceleration < 100);
  assert.ok(solve('powertrain').summary.rpm > 800);
});
test('Nyquist pulse zeros, singular limits, BER reference and OFDM cyclic convolution', () => {
  for (const alpha of [0, 0.25, 0.5, 1]) {
    near(raisedCosine(0, alpha), 1);
    for (let i = 1; i < 5; i++) near(raisedCosine(i, alpha), 0, 1e-12);
    if (alpha > 0)
      near(raisedCosine(1 / (2 * alpha), alpha), raisedCosine(1 / (2 * alpha) + 1e-6, alpha), 2e-6);
  }
  near(solve('biterror', { ebno: 0 }).summary.ber, 0.07864960352514258, 1e-7);
  near(
    solve('biterror', { scheme: 'BPSK' }).summary.ber,
    solve('biterror', { scheme: 'QPSK' }).summary.ber,
  );
  assert.ok(solve('biterror', { ebno: 18 }).summary.ber > 0);
  for (const delay of [1, 6, 20]) assert.ok(ofdmBlock(42, delay, delay, 0.5).error < 1e-12);
  assert.ok(ofdmBlock(42, 0, 10, 0.5).error > 0.01);
  assert.ok(solve('eyediagram', { echo: 0 }).summary.error < 1e-12);
  near(solve('raisedcosine').summary.bandwidth, 67.5);
  near(solve('antennapattern', { kind: 'short-dipole' }).summary.peak, 90);
});
test('integration order agrees with exact harmonic oscillator without energy drift', () => {
  const r = trajectory((_t, [x, v]) => [v, -x], [1, 0], 2 * Math.PI, 1000, 1).at(-1).state;
  near(r[0], 1, 1e-9);
  near(r[1], 0, 1e-9);
});

test('plane-change diagram preserves speed ratios and shows no burn arrow for identical velocities', () => {
  const unchanged = explorationVisual(
    solve('planechange', { speed: 7.5, final: 7.5, angle: 0 }).visualization,
  ).drawing;
  assert.doesNotMatch(unchanged, /stroke="var\(--load\)"/);
  const changed = explorationVisual(
    solve('planechange', { speed: 4, final: 8, angle: 60 }).visualization,
  ).drawing;
  const length = (color) => {
    const regex = new RegExp(
      `d="M([-\\d.e+]+) ([-\\d.e+]+)L([-\\d.e+]+) ([-\\d.e+]+)"[^>]*stroke="var\\(--${color}\\)"`,
    );
    const m = changed.match(regex);
    assert.ok(m);
    return Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2]));
  };
  near(length('result') / length('curve'), 2);
});

test('mixed traces retain physical units, logarithmic plots declare their scales, and a zero field has no direction', () => {
  for (const [id, key, unit] of [
    ['faraday', 'reference', 'Wb'],
    ['laplacepz', 'reference', '°'],
    ['loopmargins', 'reference', '°'],
    ['poleplacement', 'reference', 'm/s'],
    ['lqrtuning', 'reference', 'm/s²'],
    ['luenberger', 'reference', 'm/s'],
    ['trajectoryplanning', 'third', 'm/s²'],
  ])
    assert.equal(labs[id].definition.outputs.series[key], unit);
  assert.equal(labs.loopmargins.definition.plot.xScale, 'log');
  assert.equal(labs.biterror.definition.plot.yScale, 'log');
  assert.equal(solve('pointcharges', { q1: 0, q2: 0 }).summary.direction, null);
  near(solve('debouncetimeline').summary.accepted, 14, 0.051);
  for (const [id, m] of Object.entries(labs)) {
    const check = validate(m.definition, { ...defaults(id), ...m.definition.exampleInputs });
    assert.ok(check.values, `${id}: valid worked reference`);
    assert.deepEqual(m.definition.presets['Worked reference'], m.definition.exampleInputs);
  }
});

import { check, number, identifier, jsonProject, zeros, solve, maxabs } from './builder-core.js';
export const spiceExample = JSON.stringify({
  components: [
    { id: 'V1', type: 'V', a: 1, b: 0, value: 5, wave: 'step', delay: 0.001 },
    { id: 'R1', type: 'R', a: 1, b: 2, value: 1000 },
    { id: 'C1', type: 'C', a: 2, b: 0, value: 0.000001, initial: 0 },
  ],
  probe: 2,
});
export function parseSpice(source) {
  const p = jsonProject(source);
  check(
    Array.isArray(p.components) && p.components.length > 0 && p.components.length <= 40,
    'Use 1…40 components.',
  );
  const names = new Set(),
    nodes = new Set([0]);
  for (const c of p.components) {
    check(
      c && identifier(c.id) && !names.has(c.id),
      'Components need unique letter-led IDs, at most 20 characters.',
    );
    names.add(c.id);
    check(
      ['R', 'C', 'L', 'V', 'I', 'D', 'NPN', 'PNP', 'NMOS', 'PMOS'].includes(c.type),
      `${c.id}: unsupported component type.`,
    );
    for (const key of [
      'a',
      'b',
      ...(['NPN', 'PNP', 'NMOS', 'PMOS'].includes(c.type) ? ['gate'] : []),
    ]) {
      number(c[key], 0, 12, `${c.id} ${key}`);
      check(Number.isInteger(c[key]), 'Node numbers must be integers.');
      nodes.add(c[key]);
    }
    check(c.a !== c.b, `${c.id}: terminal nodes must differ.`);
    if (['R', 'C', 'L', 'V', 'I'].includes(c.type)) {
      const limits = {
        R: [0.01, 1e9],
        C: [1e-12, 1],
        L: [1e-9, 100],
        V: [-100, 100],
        I: [-10, 10],
      }[c.type];
      number(c.value, ...limits, `${c.id} value`);
    }
    if (c.initial !== undefined) number(c.initial, -100, 100, 'Initial condition');
    if (['V', 'I'].includes(c.type)) {
      check(
        c.wave === undefined || ['dc', 'step', 'sine', 'pulse'].includes(c.wave),
        'Use dc, step, sine or pulse sources.',
      );
      for (const key of ['frequency', 'delay', 'duty', 'offset'])
        if (c[key] !== undefined)
          number(
            c[key],
            key === 'offset' ? -100 : 0,
            key === 'frequency' ? 1e5 : key === 'duty' ? 1 : 100,
            key,
          );
    }
    if (['D', 'NPN', 'PNP'].includes(c.type)) {
      if (c.Is !== undefined) number(c.Is, 1e-18, 1e-6, 'Saturation current');
      if (c.ideality !== undefined) number(c.ideality, 1, 2, 'Ideality');
      if (c.beta !== undefined) number(c.beta, 1, 500, 'Forward beta');
    }
    if (['NMOS', 'PMOS'].includes(c.type)) {
      if (c.threshold !== undefined) number(c.threshold, 0.1, 10, 'Threshold magnitude');
      if (c.beta !== undefined) number(c.beta, 1e-6, 1, 'MOS beta A/V²');
      if (c.lambda !== undefined) number(c.lambda, 0, 0.2, 'Channel modulation');
    }
  }
  const unknown = [...nodes].filter((n) => n !== 0).sort((a, b) => a - b);
  check(unknown.length > 0, 'Add at least one non-ground node.');
  check(Number.isInteger(p.probe) && nodes.has(p.probe), 'Choose a probe node that exists.');
  return { ...p, unknown };
}
export function sourceValue(c, t) {
  const wave = c.wave ?? 'dc',
    offset = c.offset ?? 0,
    delay = c.delay ?? 0;
  if (wave === 'dc') return c.value;
  if (wave === 'step') return offset + (t >= delay ? c.value : 0);
  if (t < delay) return offset;
  const f = c.frequency ?? 100;
  if (wave === 'sine') return offset + c.value * Math.sin(2 * Math.PI * f * (t - delay));
  return offset + (((t - delay) * f) % 1 < (c.duty ?? 0.5) ? c.value : 0);
}
// Linear continuation beyond |v/VT|=40 avoids overflow while retaining a C1 diode law.
export function junction(v, Is = 1e-12, n = 1) {
  const vt = 0.025851999786 * n,
    z = v / vt;
  if (z > 40) {
    const e = Math.exp(40);
    return { i: Is * (e * (1 + z - 40) - 1), g: (Is * e) / vt };
  }
  return { i: Is * Math.expm1(z), g: (Is * Math.exp(z)) / vt };
}
export function transistorCurrents(c, v) {
  const sign = ['PNP', 'PMOS'].includes(c.type) ? -1 : 1,
    vc = sign * v[0],
    ve = sign * v[1],
    vg = sign * v[2];
  if (['NPN', 'PNP'].includes(c.type)) {
    const be = junction(vg - ve, c.Is ?? 1e-14),
      bc = junction(vg - vc, c.Is ?? 1e-14),
      af = (c.beta ?? 100) / ((c.beta ?? 100) + 1),
      ar = 0.5,
      ic = af * be.i - bc.i,
      ie = -be.i + ar * bc.i;
    return [sign * ic, sign * ie, sign * (-ic - ie)];
  }
  const reverse = vc < ve,
    drain = reverse ? ve : vc,
    source = reverse ? vc : ve,
    u = vg - source - (c.threshold ?? 1),
    ds = drain - source,
    beta = c.beta ?? 0.002,
    lambda = c.lambda ?? 0.02,
    channel =
      u <= 0 ? 0 : beta * (ds < u ? u * ds - 0.5 * ds * ds : 0.5 * u * u) * (1 + lambda * ds),
    i = sign * (reverse ? -channel : channel);
  return [i, -i, 0];
}
export function solveSpice(source, { duration = 0.01, steps = 500, initial = 'zero' } = {}) {
  const p = parseSpice(source);
  number(duration, 1e-6, 2, 'Duration');
  number(steps, 20, 4000, 'Steps');
  check(Number.isInteger(steps), 'Steps must be an integer.');
  check(['zero', 'operating'].includes(initial), 'Initial mode must be zero or operating.');
  const components = p.components,
    nodes = p.unknown,
    branches = components.filter((c) => ['V', 'L', 'C'].includes(c.type)),
    n = nodes.length + branches.length,
    dt = duration / steps,
    at = (node) => nodes.indexOf(node),
    branch = (c) => nodes.length + branches.indexOf(c),
    mem = new Map();
  for (const c of components)
    if (c.type === 'C' || c.type === 'L')
      mem.set(c.id, { v: 0, i: c.type === 'L' ? (c.initial ?? 0) : 0 });
  let x = Array(n).fill(0),
    maxIterations = 0,
    maxResidual = 0,
    halves = 0;
  const history = [],
    wave = [];
  function equations(state, t, h, mode, sourceScale = 1) {
    const F = Array(n).fill(0),
      J = zeros(n),
      voltage = (node) => (node === 0 ? 0 : state[at(node)]);
    const addI = (a, b, current, conductance = 0) => {
      const i = at(a),
        j = at(b);
      if (i >= 0) {
        F[i] += current;
        J[i][i] += conductance;
        if (j >= 0) J[i][j] -= conductance;
      }
      if (j >= 0) {
        F[j] -= current;
        J[j][j] += conductance;
        if (i >= 0) J[j][i] -= conductance;
      }
    };
    for (const c of components) {
      const a = at(c.a),
        b = at(c.b),
        v = voltage(c.a) - voltage(c.b),
        old = mem.get(c.id);
      if (c.type === 'R') addI(c.a, c.b, v / c.value, 1 / c.value);
      else if (c.type === 'I') addI(c.a, c.b, sourceScale * sourceValue(c, t));
      else if (['V', 'L', 'C'].includes(c.type)) {
        const k = branch(c),
          i = state[k];
        if (a >= 0) {
          F[a] += i;
          J[a][k] += 1;
        }
        if (b >= 0) {
          F[b] -= i;
          J[b][k] -= 1;
        }
        if (c.type === 'C' && mode === 'op') {
          F[k] = i;
          J[k][k] = 1;
        } else if (c.type === 'L' && mode === 'start') {
          F[k] = i - (c.initial ?? 0);
          J[k][k] = 1;
        } else {
          F[k] = v;
          if (a >= 0) J[k][a] = 1;
          if (b >= 0) J[k][b] = -1;
          if (c.type === 'V') F[k] -= sourceScale * sourceValue(c, t);
          else if (c.type === 'C') {
            if (mode === 'start') F[k] -= c.initial ?? 0;
            else {
              const resistance = h / (2 * c.value);
              F[k] -= resistance * i + old.v + resistance * old.i;
              J[k][k] = -resistance;
            }
          } else if (mode !== 'op') {
            const resistance = (2 * c.value) / h;
            F[k] += -resistance * (i - old.i) + old.v;
            J[k][k] = -resistance;
          }
        }
      } else if (c.type === 'D') {
        const r = junction(v, c.Is ?? 1e-12, c.ideality ?? 1);
        addI(c.a, c.b, r.i, r.g);
      } else {
        const terminals = [c.a, c.b, c.gate],
          voltages = terminals.map(voltage),
          currents = transistorCurrents(c, voltages);
        currents.forEach((I, r) => {
          const row = at(terminals[r]);
          if (row < 0) return;
          F[row] += I;
          for (let col = 0; col < 3; col++) {
            const j = at(terminals[col]);
            if (j < 0) continue;
            const plus = [...voltages],
              minus = [...voltages],
              epsilon = 1e-6;
            plus[col] += epsilon;
            minus[col] -= epsilon;
            J[row][j] +=
              (transistorCurrents(c, plus)[r] - transistorCurrents(c, minus)[r]) / (2 * epsilon);
          }
        });
      }
    }
    return { F, J };
  }
  function newton(guess, t, h, mode, sourceScale = 1) {
    let y = [...guess];
    for (let iteration = 0; iteration < 70; iteration++) {
      const { F, J } = equations(y, t, h, mode, sourceScale),
        res = maxabs(F);
      if (res < 1e-9) {
        solve(J, Array(n).fill(0));
        return { x: y, iterations: iteration, residual: res };
      }
      const delta = solve(
        J,
        F.map((v) => -v),
      );
      let factor = 1;
      const voltageStep = maxabs(delta.slice(0, nodes.length));
      if (voltageStep > 2) factor = 2 / voltageStep;
      let accepted = false;
      for (let k = 0; k < 20; k++) {
        const candidate = y.map((v, i) => v + factor * delta[i]),
          r = maxabs(equations(candidate, t, h, mode, sourceScale).F);
        if (r < res || r < 1e-9) {
          y = candidate;
          accepted = true;
          break;
        }
        factor *= 0.5;
      }
      check(
        accepted,
        'Newton line search stalled. Reduce the timestep, check diode polarity or remove incompatible ideal sources.',
      );
    }
    throw Error(
      'Newton did not converge in 70 iterations; reduce the timestep or simplify the circuit.',
    );
  }
  function save(t, iterations, residual) {
    const voltage = (node) => (node === 0 ? 0 : x[at(node)]);
    const currents = components.map((c) =>
      c.type === 'R'
        ? (voltage(c.a) - voltage(c.b)) / c.value
        : c.type === 'V' || c.type === 'L'
          ? x[branch(c)]
          : c.type === 'I'
            ? sourceValue(c, t)
            : c.type === 'C'
              ? mem.get(c.id).i
              : c.type === 'D'
                ? junction(voltage(c.a) - voltage(c.b), c.Is ?? 1e-12, c.ideality ?? 1).i
                : transistorCurrents(c, [voltage(c.a), voltage(c.b), voltage(c.gate)])[0],
    );
    history.push({ t, voltages: nodes.map(voltage), currents, iterations, residual });
    wave.push({
      x: t,
      y: voltage(p.probe),
      reference: components.find((c) => c.type === 'V')
        ? sourceValue(
            components.find((c) => c.type === 'V'),
            t,
          )
        : 0,
    });
  }
  if (initial === 'operating') {
    for (let k = 0; k <= 10; k++) x = newton(x, 0, dt, 'op', k / 10).x;
    for (const c of components)
      if (mem.has(c.id))
        mem.set(c.id, {
          v: (c.a === 0 ? 0 : x[at(c.a)]) - (c.b === 0 ? 0 : x[at(c.b)]),
          i: x[branch(c)],
        });
  } else {
    const init = newton(x, 0, Math.min(dt * 1e-6, 1e-10), 'start');
    x = init.x;
    for (const c of components)
      if (mem.has(c.id))
        mem.set(c.id, {
          v:
            c.type === 'C'
              ? (c.initial ?? 0)
              : (c.a === 0 ? 0 : x[at(c.a)]) - (c.b === 0 ? 0 : x[at(c.b)]),
          i: x[branch(c)],
        });
  }
  save(0, 0, 0);
  function advance(t, h, depth = 0) {
    let r;
    try {
      r = newton(x, t, h, 'trap');
    } catch (e) {
      if (depth >= 7) throw Error(`t=${t.toPrecision(6)} s: ${e.message}`);
      halves++;
      advance(t - h / 2, h / 2, depth + 1);
      advance(t, h / 2, depth + 1);
      return;
    }
    x = r.x;
    maxIterations = Math.max(maxIterations, r.iterations);
    maxResidual = Math.max(maxResidual, r.residual);
    for (const c of components)
      if (mem.has(c.id)) {
        const v = (c.a === 0 ? 0 : x[at(c.a)]) - (c.b === 0 ? 0 : x[at(c.b)]),
          old = mem.get(c.id);
        mem.set(c.id, {
          v,
          i: c.type === 'C' ? ((2 * c.value) / h) * (v - old.v) - old.i : x[branch(c)],
        });
      }
  }
  for (let k = 1; k <= steps; k++) {
    advance(k * dt, dt);
    save(k * dt, maxIterations, maxResidual);
  }
  const stride = Math.max(1, Math.ceil(history.length / 600)),
    frames = history.filter((_, i) => i % stride === 0 || i === history.length - 1),
    series = frames.map((f) => wave[history.indexOf(f)]);
  return {
    summary: {
      final: series.at(-1).y,
      peak: Math.max(...series.map((v) => v.y)),
      iterations: maxIterations,
      residual: maxResidual,
      subdivisions: halves,
    },
    series,
    visualization: { type: 'builder', kind: 'spice', project: p, nodes, frames },
    table: {
      caption: 'Final branch currents (a → b; transistor collector/drain current)',
      headers: ['Component', 'Current (A)'],
      rows: components.map((c, i) => [c.id, frames.at(-1).currents[i]]),
    },
    warnings: [
      'SPICE-lite: fixed requested steps with failure-only bisection, not local-error-controlled integration. Trapezoidal ringing near ideal switching requires a timestep study.',
    ],
  };
}

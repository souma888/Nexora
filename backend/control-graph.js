import { check, number, identifier, jsonProject } from './builder-core.js';
import { rk4Step } from './math-core.js';
export const controlGraphExample = JSON.stringify({
  blocks: [
    { id: 'r', type: 'step', value: 1, time: 0, x: 40, y: 80 },
    { id: 'error', type: 'sum', signs: [1, -1], x: 200, y: 80 },
    { id: 'gain', type: 'gain', value: 2, x: 360, y: 80 },
    { id: 'limit', type: 'saturation', min: -2, max: 2, x: 520, y: 80 },
    { id: 'plant', type: 'transfer', num: [1], den: [1, 1], x: 360, y: 230 },
  ],
  wires: [
    ['r', 'error', 0],
    ['plant', 'error', 1],
    ['error', 'gain', 0],
    ['gain', 'limit', 0],
    ['limit', 'plant', 0],
  ],
  output: 'plant',
  reference: 'r',
});
export function compileControl(source) {
  const p = jsonProject(source);
  check(
    Array.isArray(p.blocks) &&
      p.blocks.length > 0 &&
      p.blocks.length <= 30 &&
      Array.isArray(p.wires) &&
      p.wires.length <= 80,
    'Use 1…30 blocks and at most 80 wires.',
  );
  const ids = new Set(),
    blocks = p.blocks.map((raw) => {
      const b = { ...raw };
      check(identifier(b.id) && !ids.has(b.id), 'Blocks need unique letter-led IDs.');
      ids.add(b.id);
      check(
        [
          'constant',
          'step',
          'sine',
          'sum',
          'gain',
          'transfer',
          'integrator',
          'saturation',
          'deadzone',
          'relay',
          'product',
        ].includes(b.type),
        `${b.id}: unsupported block type.`,
      );
      b.ports = ['constant', 'step', 'sine'].includes(b.type)
        ? 0
        : b.type === 'sum'
          ? (b.signs ?? [1, -1]).length
          : b.type === 'product'
            ? 2
            : 1;
      b.direct = !['constant', 'step', 'sine', 'integrator', 'transfer'].includes(b.type);
      b.order = b.type === 'integrator' ? 1 : 0;
      if (['constant', 'step', 'gain', 'sine'].includes(b.type))
        number(b.value, -100, 100, `${b.id} value`);
      if (b.type === 'sine') number(b.frequency ?? 1, 0.001, 100, 'Sine frequency');
      if (b.type === 'step') number(b.time ?? 0, 0, 100, 'Step time');
      if (b.type === 'sum') {
        check(
          Array.isArray(b.signs) &&
            b.signs.length >= 1 &&
            b.signs.length <= 8 &&
            b.signs.every((v) => v === 1 || v === -1),
          'Sum signs must contain 1…8 entries of +1 or −1.',
        );
      }
      if (b.type === 'transfer') {
        check(
          Array.isArray(b.den) &&
            b.den.length >= 2 &&
            b.den.length <= 5 &&
            Array.isArray(b.num) &&
            b.num.length > 0 &&
            b.num.length <= b.den.length,
          'Use proper transfer functions of order 1…4.',
        );
        [...b.num, ...b.den].forEach((v) => number(v, -1e4, 1e4, 'Polynomial coefficient'));
        check(Math.abs(b.den[0]) > 1e-12, 'Leading denominator coefficient cannot be zero.');
        b.order = b.den.length - 1;
        const leading = b.den[0];
        b.den = b.den.map((v) => v / leading);
        b.num = [...Array(b.den.length - b.num.length).fill(0), ...b.num.map((v) => v / leading)];
        b.direct = b.num[0] !== 0;
      }
      if (b.type === 'saturation') {
        number(b.min, -1000, 1000, 'Saturation lower bound');
        number(b.max, -1000, 1000, 'Saturation upper bound');
        check(b.max > b.min, 'Saturation max must exceed min.');
      }
      if (b.type === 'deadzone') number(b.width ?? 0.1, 0, 100, 'Dead-zone half-width');
      if (b.type === 'relay') number(b.level ?? 1, 0.001, 100, 'Relay output magnitude');
      if (b.initial !== undefined) {
        check(
          Array.isArray(b.initial) && b.initial.length === b.order,
          'Initial state length must equal block order.',
        );
        b.initial.forEach((v) => number(v, -1000, 1000, 'Initial state'));
      }
      if (b.x !== undefined) number(b.x, -1000, 3000, 'Block x');
      if (b.y !== undefined) number(b.y, -1000, 3000, 'Block y');
      return b;
    });
  const byId = new Map(blocks.map((b) => [b.id, b])),
    inputs = new Map(blocks.map((b) => [b.id, Array(b.ports).fill(null)]));
  for (const w of p.wires) {
    check(
      Array.isArray(w) &&
        w.length === 3 &&
        byId.has(w[0]) &&
        byId.has(w[1]) &&
        Number.isInteger(w[2]),
      'Wires are [fromID,toID,inputPort].',
    );
    const ports = inputs.get(w[1]);
    check(
      w[2] >= 0 && w[2] < ports.length && ports[w[2]] === null,
      'Wire port is missing, out of range or connected twice.',
    );
    ports[w[2]] = w[0];
  }
  for (const [id, ports] of inputs)
    check(
      ports.every((v) => v !== null),
      `${id}: connect every input port.`,
    );
  check(byId.has(p.output), 'Choose an existing output block.');
  if (p.reference !== undefined)
    check(byId.has(p.reference), 'Reference must identify an existing block.');
  const order = [],
    remaining = new Set(blocks.map((b) => b.id));
  while (remaining.size) {
    const ready = blocks.filter(
      (b) =>
        remaining.has(b.id) && (!b.direct || inputs.get(b.id).every((id) => !remaining.has(id))),
    );
    check(
      ready.length > 0,
      'Direct-feedthrough algebraic loop: insert an integrator or strictly proper transfer function.',
    );
    ready.forEach((b) => {
      order.push(b);
      remaining.delete(b.id);
    });
  }
  let states = 0;
  blocks.forEach((b) => {
    b.offset = states;
    states += b.order;
  });
  check(states <= 48, 'Keep the total dynamic order at or below 48.');
  return { project: p, blocks, inputs, order, states, byId };
}
export function controlEvaluation(compiled, t, state) {
  const output = {};
  for (const b of compiled.order) {
    const u = compiled.inputs.get(b.id).map((id) => output[id]);
    let y = 0;
    switch (b.type) {
      case 'constant':
        y = b.value;
        break;
      case 'step':
        y = t >= (b.time ?? 0) ? b.value : 0;
        break;
      case 'sine':
        y = b.value * Math.sin(2 * Math.PI * (b.frequency ?? 1) * t);
        break;
      case 'sum':
        y = u.reduce((s, v, i) => s + v * b.signs[i], 0);
        break;
      case 'gain':
        y = b.value * u[0];
        break;
      case 'integrator':
        y = state[b.offset];
        break;
      case 'transfer': {
        const D = b.num[0];
        y = D * (u[0] ?? 0);
        for (let j = 0; j < b.order; j++)
          y += (b.num[b.order - j] - D * b.den[b.order - j]) * state[b.offset + j];
        break;
      }
      case 'saturation':
        y = Math.max(b.min, Math.min(b.max, u[0]));
        break;
      case 'deadzone':
        y = Math.sign(u[0]) * Math.max(0, Math.abs(u[0]) - (b.width ?? 0.1));
        break;
      case 'relay':
        y = u[0] >= 0 ? (b.level ?? 1) : -(b.level ?? 1);
        break;
      case 'product':
        y = u[0] * u[1];
        break;
    }
    check(
      Number.isFinite(y) && Math.abs(y) <= 1e8,
      `${b.id}: output left the bounded numerical range. Check feedback signs, coefficients or timestep.`,
    );
    output[b.id] = y;
  }
  const derivative = Array(compiled.states).fill(0);
  for (const b of compiled.blocks) {
    if (b.type === 'integrator') derivative[b.offset] = output[compiled.inputs.get(b.id)[0]];
    if (b.type === 'transfer') {
      for (let j = 0; j < b.order - 1; j++) derivative[b.offset + j] = state[b.offset + j + 1];
      let rate = output[compiled.inputs.get(b.id)[0]];
      for (let j = 0; j < b.order; j++) rate -= b.den[b.order - j] * state[b.offset + j];
      derivative[b.offset + b.order - 1] = rate;
    }
  }
  return { output, derivative };
}
export function solveControlGraph(source, { duration = 8, steps = 1600 } = {}) {
  const c = compileControl(source);
  number(duration, 0.01, 100, 'Duration');
  number(steps, 20, 10000, 'Steps');
  check(Number.isInteger(steps), 'Steps must be integral.');
  let state = Array(c.states).fill(0);
  for (const b of c.blocks)
    for (let j = 0; j < b.order; j++) state[b.offset + j] = b.initial?.[j] ?? 0;
  const series = [],
    frames = [],
    h = duration / steps,
    stride = Math.max(1, Math.ceil(steps / 500));
  for (let k = 0; k <= steps; k++) {
    const t = k * h;
    if (k % stride === 0 || k === steps) {
      const e = controlEvaluation(c, t, state);
      series.push({
        x: t,
        y: e.output[c.project.output],
        reference: c.project.reference ? e.output[c.project.reference] : 0,
      });
      frames.push({ t, signals: e.output });
    }
    if (k < steps)
      state = rk4Step((time, y) => controlEvaluation(c, time, y).derivative, t, state, h);
  }
  const error = Math.sqrt(series.reduce((s, v) => s + (v.y - v.reference) ** 2, 0) / series.length);
  return {
    summary: {
      final: series.at(-1).y,
      peak: Math.max(...series.map((v) => v.y)),
      error,
      states: c.states,
    },
    series,
    visualization: { type: 'builder', kind: 'control', project: c.project, frames },
    table: {
      caption: 'Final block signals',
      headers: ['Block', 'Output'],
      rows: Object.entries(frames.at(-1).signals),
    },
    warnings: c.blocks.some((b) => b.type === 'relay')
      ? [
          'Relay switching is step-size dependent. Compare a smaller step before interpreting chattering.',
        ]
      : [],
  };
}

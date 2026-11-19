import { engineering, result } from './engineering-kit.js';
export {
  p,
  integer,
  textInput,
  seq,
  rad,
  bisect,
  clamp,
  domain,
  requireValue,
} from './engineering-kit.js';
import { choice as enumField } from './engineering-kit.js';
export const choice = (label, values, initial) =>
  enumField(label, Object.fromEntries(values.map((v) => [v, v])), initial);
export { random, normal, rk4Step, normalCDF, numbers } from './math-core.js';
export { C, add, sub, mul, div, abs, polar, angle } from './ac-engine.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F> & {discipline:string}} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
export const exploration = (config, solve) => engineering(config, solve);
export const teaching = (description, predict, answers, explain, example, equation, limits) => ({
  description,
  predict,
  answers,
  explain,
  example,
  equation,
  limits,
});
export function output(summary, series, kind, geometry = {}, rows = [], warnings = []) {
  const r = result(summary, series, kind, geometry, rows, warnings);
  Object.assign(r.visualization, geometry, { type: 'exploration' });
  if (Object.hasOwn(geometry, 'points') && geometry.points !== series)
    Object.assign(r.visualization, { trace: series });
  if (['orbit', 'induction', 'membrane', 'trajectory', 'quarter-car'].includes(kind))
    r.visualization.frames = series;
  if (!rows.length) delete r.table;
  return r;
}
export const logspace = (low, high, n = 160) =>
  Array.from({ length: n + 1 }, (_, i) => low * (high / low) ** (i / n));
export const sinc = (x) => (Math.abs(x) < 1e-10 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
export const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
export function trajectory(f, initial, end, steps = 2000, stride = 5) {
  // RK4 with a fixed, explicit bound keeps browser work finite and reproducible.
  let y = [...initial];
  const h = end / steps,
    rows = [{ t: 0, state: [...y] }];
  const step = (t, y) => {
    const k1 = f(t, y),
      k2 = f(
        t + h / 2,
        y.map((v, i) => v + (h * k1[i]) / 2),
      ),
      k3 = f(
        t + h / 2,
        y.map((v, i) => v + (h * k2[i]) / 2),
      ),
      k4 = f(
        t + h,
        y.map((v, i) => v + h * k3[i]),
      );
    return y.map((v, i) => v + (h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) / 6);
  };
  for (let i = 0; i < steps; i++) {
    y = step(i * h, y);
    if (y.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e12))
      throw Error(
        'Trajectory exceeded this model’s numerical range. Reduce the horizon or forcing.',
      );
    if ((i + 1) % stride === 0 || i === steps - 1) rows.push({ t: (i + 1) * h, state: [...y] });
  }
  return rows;
}
/** In-place radix-2 Cooley–Tukey FFT; inverse uses the conjugate convention. */
export function fft(real, imaginary = Array(real.length).fill(0), inverse = false) {
  const n = real.length;
  if (n < 2 || n & (n - 1)) throw Error('FFT length must be a power of two.');
  const re = [...real],
    im = [...imaginary];
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len *= 2)
    for (let i = 0; i < n; i += len)
      for (let j = 0; j < len / 2; j++) {
        const a = ((inverse ? 2 : -2) * Math.PI * j) / len,
          c = Math.cos(a),
          s = Math.sin(a),
          u = i + j,
          v = u + len / 2,
          tr = c * re[v] - s * im[v],
          ti = s * re[v] + c * im[v];
        re[v] = re[u] - tr;
        im[v] = im[u] - ti;
        re[u] += tr;
        im[u] += ti;
      }
  return re.map((r, i) => ({ re: r / (inverse ? n : 1), im: im[i] / (inverse ? n : 1) }));
}
export const windowValue = (kind, i, n) =>
  kind === 'rectangular'
    ? 1
    : kind === 'hann'
      ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
      : 0.42 -
        0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
        0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

import { study } from './study-kit.js';
export { p, integer, choice, textInput, samples, table } from './study-kit.js';
export { solveLinear } from './linear.js';
export const rad = (x) => (x * Math.PI) / 180;
export const finite = (x) => (Number.isFinite(x) ? x : null);
export const seq = (a, b, n = 120) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function bisect(f, a, b, iterations = 70) {
  let fa = f(a);
  if (fa === 0) return a;
  if (f(b) === 0) return b;
  if (fa * f(b) > 0) throw Error('The requested state is not bracketed in the model domain.');
  for (let i = 0; i < iterations; i++) {
    const m = (a + b) / 2,
      fm = f(m);
    if (fm === 0) return m;
    if (fm * fa > 0) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}
export const erf = (x) => {
  const a = Math.abs(x),
    t = 1 / (1 + 0.3275911 * a);
  return (
    Math.sign(x) *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-a * a))
  );
};
export const erfinv = (x) => bisect((z) => erf(z) - x, -8, 8);
export const integrate = (f, a, b, n = 400) => {
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + ((b - a) * i) / n);
  return (s * (b - a)) / (3 * n);
};
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F> & {discipline:string}} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
export const engineering = (config, solve) => study(config, solve);
export const lesson = (description, predict, answers, explain, example, equation, limits) => ({
  description,
  predict,
  answers,
  explain,
  example,
  equation,
  limits,
});
export const domain = (key, check) => (input) => {
  try {
    check(input);
  } catch (e) {
    return { key, message: e.message };
  }
};
export const requireValue = (condition, message) => {
  if (!condition) throw Error(message);
};
// Diagrams use solver data. Curve points are normalized by the renderer, never by the solver.
export const diagram = (kind, values = {}, frames = []) => ({
  type: 'engineering-study',
  kind,
  ...values,
  ...(frames.length ? { frames } : {}),
});
export function result(summary, series, kind, values = {}, rows = [], warnings = []) {
  const frames = ['commutation', 'timer', 'schmitt', 'draining-tank'].includes(kind) ? series : [];
  return {
    summary,
    series,
    visualization: diagram(kind, { ...values, points: series }, frames),
    table: { caption: 'Calculated state and checks', headers: ['Quantity', 'Value'], rows },
    warnings,
  };
}

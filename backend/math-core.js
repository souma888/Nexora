import { lab, p, integer, choice, textInput, samples, table } from './lab-kit.js';
export { p, integer, choice, textInput, samples, table };
export { random, normal } from './numerical-tools.js';
export const sum = (a) => a.reduce((s, v) => s + v, 0);
export const mean = (a) => sum(a) / a.length;
export const variance = (a, sample = false) => {
  const m = mean(a);
  return sum(a.map((v) => (v - m) ** 2)) / (a.length - (sample ? 1 : 0));
};
export const dot = (a, b) => sum(a.map((v, i) => v * b[i]));
export const norm = (a) => Math.hypot(...a);
export const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
export const multiply = (A, B) => A.map((row) => transpose(B).map((col) => dot(row, col)));
export const matvec = (A, x) => A.map((row) => dot(row, x));
export const linspace = (a, b, n = 100) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const finite = (x) => (Number.isFinite(x) ? x : null);
export function numbers(source, min = 1, max = 200) {
  const a = String(source)
    .split(',')
    .map((v) => (v.trim() ? Number(v) : NaN));
  if (a.length < min || a.length > max || a.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e6))
    throw new Error(`Use ${min}–${max} finite comma-separated numbers, magnitude ≤10⁶.`);
  return a;
}
export function matrix(source, rows = 2, cols = rows) {
  const A = JSON.parse(source);
  if (
    !Array.isArray(A) ||
    A.length !== rows ||
    A.some(
      (r) =>
        !Array.isArray(r) ||
        r.length !== cols ||
        r.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e4),
    )
  )
    throw new Error(`Use a ${rows}×${cols} numeric JSON matrix, magnitude ≤10000.`);
  return A;
}
export const errorFor = (key, fn) => (input) => {
  try {
    fn(input);
  } catch (e) {
    return { key, message: e.message };
  }
};
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
export function mathLab(config, solve) {
  const { text, ml = false, ...rest } = config;
  return lab(
    {
      execution: 'worker',
      discipline: ml ? 'machinelearning' : 'mathematics',
      ...rest,
      text: [
        text.description,
        text.predict,
        text.answers,
        text.explain,
        text.example,
        text.equation,
        text.limits,
      ],
    },
    solve,
  );
}
export function histogram(values, bins = 24, range) {
  let [low, high] = range ?? [Math.min(...values), Math.max(...values)];
  if (low === high) {
    low -= 0.5;
    high += 0.5;
  }
  const counts = Array(bins).fill(0);
  for (const v of values) {
    const i = Math.floor(((v - low) / (high - low)) * bins);
    if (i >= 0 && i < bins) counts[i]++;
    else if (v === high) counts[bins - 1]++;
  }
  return counts.map((y, i) => ({ x: low + ((i + 0.5) * (high - low)) / bins, y }));
}
export function rk4Step(f, t, y, h) {
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
}
export function integrate(f, initial, end, steps = 1200) {
  let y = [...initial];
  const h = end / steps,
    rows = [{ t: 0, state: [...y] }];
  for (let i = 0; i < steps; i++) {
    y = rk4Step(f, i * h, y, h);
    if (y.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e10))
      throw new Error(
        'Trajectory left the bounded integration domain. Shorten the horizon or change the parameters.',
      );
    rows.push({ t: (i + 1) * h, state: [...y] });
  }
  return rows;
}
/** Symmetric Jacobi eigensolver for small real matrices; eigenvectors are columns. */
export function eigenSymmetric(A, tolerance = 1e-12) {
  const n = A.length,
    B = A.map((r) => [...r]),
    V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
  let iterations = 0;
  for (; iterations < 100 * n * n; iterations++) {
    let p = 0,
      q = 1,
      largest = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(B[i][j]) > largest) {
          largest = Math.abs(B[i][j]);
          p = i;
          q = j;
        }
    if (largest <= tolerance * Math.max(1, ...B.map((r, i) => Math.abs(r[i])))) break;
    const angle = 0.5 * Math.atan2(2 * B[p][q], B[q][q] - B[p][p]),
      c = Math.cos(angle),
      s = Math.sin(angle),
      app = B[p][p],
      aqq = B[q][q],
      apq = B[p][q];
    for (let k = 0; k < n; k++)
      if (k !== p && k !== q) {
        const a = B[k][p],
          b = B[k][q];
        B[k][p] = B[p][k] = c * a - s * b;
        B[k][q] = B[q][k] = s * a + c * b;
      }
    B[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    B[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    B[p][q] = B[q][p] = 0;
    for (let k = 0; k < n; k++) {
      const a = V[k][p],
        b = V[k][q];
      V[k][p] = c * a - s * b;
      V[k][q] = s * a + c * b;
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => B[b][b] - B[a][a]);
  return {
    values: order.map((i) => B[i][i]),
    vectors: V.map((row) => order.map((i) => row[i])),
    iterations,
  };
}
export function lu(A, pivot = true) {
  const n = A.length,
    U = A.map((r) => [...r]),
    L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j))),
    permutation = Array.from({ length: n }, (_, i) => i),
    frames = [];
  let swaps = 0;
  for (let k = 0; k < n; k++) {
    let p = k;
    if (pivot) for (let i = k + 1; i < n; i++) if (Math.abs(U[i][k]) > Math.abs(U[p][k])) p = i;
    if (Math.abs(U[p][k]) < 1e-14)
      throw new Error('Zero or near-zero pivot. The matrix is singular, or pivoting is required.');
    if (p !== k) {
      [U[k], U[p]] = [U[p], U[k]];
      [permutation[k], permutation[p]] = [permutation[p], permutation[k]];
      for (let j = 0; j < k; j++) [L[k][j], L[p][j]] = [L[p][j], L[k][j]];
      swaps++;
    }
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j];
    }
    frames.push({ label: `Pivot ${k + 1}`, matrix: U.map((r) => [...r]) });
  }
  return { L, U, permutation, swaps, frames };
}
export function normalCDF(x) {
  if (x === 0) return 0.5;
  const z = Math.abs(x),
    t = 1 / (1 + 0.2316419 * z),
    d = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI),
    tail =
      d *
      t *
      (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - tail : tail;
}
export function normalQuantile(p) {
  let a = -9,
    b = 9;
  for (let i = 0; i < 70; i++) {
    const m = (a + b) / 2;
    if (normalCDF(m) < p) a = m;
    else b = m;
  }
  return (a + b) / 2;
}
export const normalDensity = (x) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
export const sigmoid = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
export const softThreshold = (x, t) => Math.sign(x) * Math.max(0, Math.abs(x) - t);
export const vectors = (points, extra = {}) => ({
  type: 'math-space',
  kind: 'plane',
  points,
  ...extra,
});
export const gridVisual = (grid, extra = {}) => ({
  type: 'math-space',
  kind: 'heatmap',
  grid,
  ...extra,
});
export const traceVisual = (points, extra = {}) => ({
  type: 'math-space',
  kind: 'trajectory',
  points,
  ...extra,
});

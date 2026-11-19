import { solveLinear } from './linear.js';
import { SolverInputError } from './solver-error.js';
export const zeros = (n, m = n) => Array.from({ length: n }, () => Array(m).fill(0));
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.hypot(...a);
export const maxabs = (a) => Math.max(0, ...a.map(Math.abs));
export const check = (condition, message) => {
  if (!condition) throw new SolverInputError(message);
};
export const number = (value, min, max, label) => {
  check(
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${label}: use a finite number from ${min} to ${max}.`,
  );
  return value;
};
export const index = (value, n, label) => {
  check(Number.isInteger(value) && value >= 0 && value < n, `${label}: use an index 0…${n - 1}.`);
  return value;
};
export const identifier = (value) =>
  typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,19}$/.test(value);
export function jsonProject(source, max = 64000) {
  check(
    typeof source === 'string' && source.length <= max,
    `Project JSON must be at most ${max} characters.`,
  );
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    throw new SolverInputError('Project must be valid JSON.');
  }
  check(data && typeof data === 'object' && !Array.isArray(data), 'Project must be a JSON object.');
  if (data.positions !== undefined) {
    check(
      data.positions &&
        typeof data.positions === 'object' &&
        !Array.isArray(data.positions) &&
        Object.keys(data.positions).length <= 80,
      'Layout positions must be a bounded node-to-coordinate object.',
    );
    for (const [key, point] of Object.entries(data.positions)) {
      check(
        /^\d{1,2}$/.test(key) && Array.isArray(point) && point.length === 2,
        'Layout positions use numeric node IDs and [x,y] coordinates.',
      );
      point.forEach((v) => number(v, -1000, 1000, 'Layout coordinate'));
    }
  }
  return data;
}
export function solve(A, b) {
  try {
    return solveLinear(A, b);
  } catch (e) {
    if (e instanceof TypeError) throw e;
    throw new SolverInputError(
      'Singular or ill-conditioned system: check disconnected components, incompatible constraints or missing restraints.',
    );
  }
}
export function dirichlet(K, f, fixed) {
  const n = f.length,
    free = Array.from({ length: n }, (_, i) => i).filter((i) => !fixed.has(i)),
    u = Array(n).fill(0);
  for (const [i, v] of fixed) u[i] = v;
  if (free.length) {
    const rhs = free.map((i) => f[i] - [...fixed].reduce((s, [j, v]) => s + K[i][j] * v, 0)),
      solution = solve(
        free.map((i) => free.map((j) => K[i][j])),
        rhs,
      );
    free.forEach((i, k) => (u[i] = solution[k]));
  }
  const reactions = K.map((r, i) => dot(r, u) - f[i]);
  return { u, free, reactions, residual: maxabs(free.map((i) => reactions[i])) };
}
/** Cyclic Jacobi rotations: bounded small dense symmetric eigenproblems. */
export function eigenSymmetric(matrix) {
  const n = matrix.length,
    A = matrix.map((r) => [...r]),
    V = zeros(n);
  V.forEach((r, i) => (r[i] = 1));
  const scale = Math.max(1, ...A.flat().map(Math.abs));
  let off = Infinity,
    sweeps = 0;
  for (; sweeps < 50; sweeps++) {
    off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const a = A[p][q];
        off = Math.max(off, Math.abs(a));
        if (Math.abs(a) <= 1e-12 * scale) continue;
        const theta = 0.5 * Math.atan2(2 * a, A[q][q] - A[p][p]),
          c = Math.cos(theta),
          s = Math.sin(theta),
          ap = A[p][p],
          aq = A[q][q];
        for (let k = 0; k < n; k++)
          if (k !== p && k !== q) {
            const x = A[k][p],
              y = A[k][q];
            A[k][p] = A[p][k] = c * x - s * y;
            A[k][q] = A[q][k] = s * x + c * y;
          }
        A[p][p] = c * c * ap - 2 * s * c * a + s * s * aq;
        A[q][q] = s * s * ap + 2 * s * c * a + c * c * aq;
        A[p][q] = A[q][p] = 0;
        for (let k = 0; k < n; k++) {
          const x = V[k][p],
            y = V[k][q];
          V[k][p] = c * x - s * y;
          V[k][q] = s * x + c * y;
        }
      }
    if (off < 1e-10 * scale) break;
  }
  check(off < 1e-8 * scale, 'Eigenvalue iteration did not converge; improve the mesh quality.');
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => A[i][i] - A[j][j]);
  return {
    values: order.map((i) => A[i][i]),
    vectors: order.map((i) => V.map((r) => r[i])),
    sweeps,
    relativeResidual: off / scale,
  };
}

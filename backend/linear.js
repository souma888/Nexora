/** Dense Gaussian elimination with scaled partial pivoting for bounded teaching models. */
// @ts-check
/** @param {number[][]} matrix @param {number[]} rhs @returns {number[]} */
export function solveLinear(matrix, rhs) {
  const n = rhs.length;
  if (!n || matrix.length !== n || matrix.some((row) => row.length !== n))
    throw new Error('A square system is required.');
  if (![...matrix.flat(), ...rhs].every(Number.isFinite))
    throw new Error('System coefficients must be finite.');
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  const scales = matrix.map((row) => Math.max(...row.map(Math.abs)));
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++)
      if (Math.abs(a[i][k]) / (scales[i] || 1) > Math.abs(a[pivot][k]) / (scales[pivot] || 1))
        pivot = i;
    if (!scales[pivot] || Math.abs(a[pivot][k]) / scales[pivot] < 1e-12)
      throw new Error(
        'Singular or ill-conditioned circuit: check floating nodes and conflicting ideal voltage sources.',
      );
    [a[k], a[pivot]] = [a[pivot], a[k]];
    [scales[k], scales[pivot]] = [scales[pivot], scales[k]];
    for (let i = k + 1; i < n; i++) {
      const factor = a[i][k] / a[k][k];
      a[i][k] = 0;
      for (let j = k + 1; j <= n; j++) a[i][j] -= factor * a[k][j];
    }
  }
  const x = Array.from({ length: n }, () => 0);
  for (let i = n - 1; i >= 0; i--)
    x[i] = (a[i][n] - a[i].slice(i + 1, n).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) / a[i][i];
  if (!x.every(Number.isFinite)) throw new Error('The system has no finite solution.');
  return x;
}

import {
  mathLab,
  p,
  integer,
  choice,
  textInput,
  samples,
  table,
  matrix,
  errorFor,
  matvec,
  dot,
  norm,
  transpose,
  multiply,
  eigenSymmetric,
  lu,
  vectors,
  traceVisual,
} from './math-core.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial),
  topic = 'Linear Algebra';
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) => mathLab({ topic, ...config }, solve);
const mat = (label, initial, n = 2, cols = n) =>
  textInput(label, JSON.stringify(initial), 500, `${n}×${cols} JSON array of real numbers.`);
const matrixCheck = (input) => matrix(input.matrix);
export function rowReduce(source) {
  const A = source.map((r) => [...r]),
    rows = A.length,
    cols = A[0].length,
    frames = [{ label: 'Initial augmented matrix', matrix: A.map((r) => [...r]) }],
    pivots = [];
  let r = 0;
  const scale = Math.max(1, ...A.flat().map(Math.abs)),
    eps = 1e-11 * scale;
  for (let c = 0; c < cols - 1 && r < rows; c++) {
    let p = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < eps) continue;
    if (p !== r) {
      [A[r], A[p]] = [A[p], A[r]];
      frames.push({ label: `Swap rows ${r + 1} and ${p + 1}`, matrix: A.map((row) => [...row]) });
    }
    const pivot = A[r][c];
    A[r] = A[r].map((v) => v / pivot);
    frames.push({ label: `Normalize row ${r + 1}`, matrix: A.map((row) => [...row]) });
    for (let i = 0; i < rows; i++)
      if (i !== r) {
        const factor = A[i][c];
        A[i] = A[i].map((v, j) => v - factor * A[r][j]);
      }
    pivots.push(c);
    frames.push({ label: `Eliminate column ${c + 1}`, matrix: A.map((row) => [...row]) });
    r++;
  }
  const inconsistent = A.some(
    (row) => row.slice(0, -1).every((v) => Math.abs(v) < eps) && Math.abs(row.at(-1)) > eps,
  );
  return { matrix: A, pivots, rank: pivots.length, inconsistent, frames };
}
export function gramSchmidt(A) {
  const columns = transpose(A),
    Q = [],
    frames = [];
  for (let j = 0; j < columns.length; j++) {
    let v = [...columns[j]];
    for (const q of Q) {
      const projection = dot(v, q);
      v = v.map((x, i) => x - projection * q[i]);
    }
    const length = norm(v);
    if (length > 1e-10 * Math.max(1, norm(columns[j]))) Q.push(v.map((x) => x / length));
    frames.push({ label: `After vector ${j + 1}`, vectors: Q.map((q) => [...q]) });
  }
  return { Q, frames };
}
export const linearMathModels = {
  mathtransform: make(
    {
      id: 'mathtransform',
      title: 'Matrix as a 2D Linear Transformation',
      inputs: {
        matrix: mat('Transformation A', [
          [1, 1],
          [0, 1],
        ]),
        x: real('Vector x', -3, 3, 1),
        y: real('Vector y', -3, 3, 1),
      },
      validateValues: errorFor('matrix', matrixCheck),
      metrics: {
        determinant: ['Signed area scale det(A)', '1'],
        length: ['Transformed-vector length', '1'],
        area: ['Unit-square area after transformation', '1'],
      },
      plot: {
        x: 'Unit-circle parameter',
        y: 'Transformed coordinate',
        xUnit: 'rad',
        yUnit: '',
        traces: { y: 'Transformed x', reference: 'Transformed y' },
      },
      text: {
        description:
          'Transform a vector, a unit square and a reference circle with an editable real matrix.',
        predict: 'What does a negative determinant do to orientation?',
        answers: ['Reverses it', 'Preserves it', 'Forces a rotation by 90°'],
        explain:
          'The determinant is signed area scaling. Its magnitude controls area and its sign controls orientation.',
        example: 'A=[[1,1],[0,1]] maps (1,1) to (2,1) and preserves area.',
        equation: 'y=Ax; area(AΩ)=|det A| area(Ω).',
        limits:
          'Linear maps in R² only; no translation. Singular matrices collapse area and are allowed.',
      },
    },
    ({ matrix: source, x, y }) => {
      const A = matrix(source),
        out = matvec(A, [x, y]),
        det = A[0][0] * A[1][1] - A[0][1] * A[1][0],
        circle = samples(0, 2 * Math.PI, (t) => {
          const p = matvec(A, [Math.cos(t), Math.sin(t)]);
          return { y: p[0], reference: p[1] };
        });
      return {
        summary: { determinant: det, length: norm(out), area: Math.abs(det) },
        series: circle,
        visualization: { type: 'math-space', kind: 'transform', matrix: A, vector: [x, y] },
        table: table(
          'Vector image',
          ['Coordinate', 'Input', 'Output'],
          [
            ['x', x, out[0]],
            ['y', y, out[1]],
          ],
        ),
      };
    },
  ),
  mathgaussian: make(
    {
      id: 'mathgaussian',
      title: 'Gaussian Elimination and Row Reduction',
      inputs: {
        matrix: mat(
          'Augmented matrix [A | b]',
          [
            [2, 1, -1, 8],
            [-3, -1, 2, -11],
            [-2, 1, 2, -3],
          ],
          3,
          4,
        ),
      },
      validateValues: errorFor('matrix', ({ matrix: source }) => matrix(source, 3, 4)),
      metrics: {
        rank: ['Coefficient rank', '1'],
        consistent: ['Consistent system (1=yes)', '1'],
        unique: ['Unique solution (1=yes)', '1'],
        residual: ['Solution residual norm', '1'],
      },
      plot: { x: 'Row-operation frame', y: 'Largest matrix entry', xUnit: '', yUnit: '' },
      text: {
        description:
          'Scrub partial-pivoted row operations and distinguish unique, underdetermined and inconsistent systems.',
        predict: 'What does a row [0,0,0 | nonzero] mean?',
        answers: [
          'The system is inconsistent',
          'There are infinitely many solutions',
          'The solution is zero',
        ],
        explain: 'That row asserts 0 equals a nonzero number.',
        example: 'The default system has the solution (2,3,−1).',
        equation:
          'Elementary row operations preserve the solution set; pivot columns determine rank.',
        limits:
          'Three equations and three unknowns, floating-point rank tolerance 10⁻¹¹ times input scale. Near-singular classification is tolerance-dependent; a residual is shown only for a unique solution.',
      },
    },
    ({ matrix: source }) => {
      const A = matrix(source, 3, 4),
        r = rowReduce(A),
        unique = !r.inconsistent && r.rank === 3,
        solution = unique ? r.matrix.map((row) => row[3]) : null;
      return {
        summary: {
          rank: r.rank,
          consistent: +!r.inconsistent,
          unique: +unique,
          residual: solution ? norm(A.map((row) => dot(row.slice(0, 3), solution) - row[3])) : null,
        },
        series: r.frames.map((frame, x) => ({
          x,
          y: Math.max(...frame.matrix.flat().map(Math.abs)),
        })),
        visualization: { type: 'math-space', kind: 'matrix-steps', frames: r.frames },
        table: table(
          unique ? 'Unique solution' : 'Final row-reduced augmented matrix',
          unique ? ['Variable', 'Value'] : ['x', 'y', 'z', 'b'],
          unique ? solution.map((v, i) => [`x${i + 1}`, v]) : r.matrix,
        ),
        warnings: r.inconsistent
          ? ['No solution: coefficient and augmented ranks differ.']
          : !unique
            ? ['Free variables remain: this system has infinitely many solutions.']
            : [],
      };
    },
  ),
  matheigen: make(
    {
      id: 'matheigen',
      title: 'Eigenvalues and Eigenvectors Geometry',
      inputs: {
        matrix: mat('Real matrix A', [
          [2, 1],
          [1, 2],
        ]),
      },
      validateValues: errorFor('matrix', matrixCheck),
      metrics: {
        trace: ['Trace', '1'],
        determinant: ['Determinant', '1'],
        lambda1: ['First real eigenvalue', '1'],
        lambda2: ['Second real eigenvalue', '1'],
        imaginary: ['Imaginary magnitude for a complex pair', '1'],
      },
      plot: {
        x: 'Unit-vector angle',
        y: 'Parallelism residual det(v,Av)',
        xUnit: 'rad',
        yUnit: '',
      },
      text: {
        description:
          'Find directions that a real matrix stretches without turning, and recognize when no real eigendirections exist.',
        predict: 'Can a real 2×2 matrix have no real eigenvectors?',
        answers: ['Yes, for a nonreal conjugate pair', 'No', 'Only if it is singular'],
        explain:
          'A planar rotation other than 0° or 180° has complex eigenvalues and no real eigenline.',
        example: '[[2,1],[1,2]] has eigenvalues 3 and 1, along (1,1) and (1,−1).',
        equation: 'λ²−tr(A)λ+det(A)=0; Av=λv.',
        limits:
          'Real 2×2 matrices. Repeated eigenvalues need not have two independent eigenvectors; complex eigenvalues are reported by their imaginary magnitude.',
      },
    },
    ({ matrix: source }) => {
      const A = matrix(source),
        tr = A[0][0] + A[1][1],
        det = A[0][0] * A[1][1] - A[0][1] * A[1][0],
        disc = tr * tr - 4 * det,
        values = disc >= 0 ? [(tr + Math.sqrt(disc)) / 2, (tr - Math.sqrt(disc)) / 2] : [],
        ev = values.map((l) => {
          const r0 = [A[0][0] - l, A[0][1]],
            r1 = [A[1][0], A[1][1] - l],
            r = norm(r0) > norm(r1) ? r0 : r1;
          let v = [-r[1], r[0]];
          if (norm(v) < 1e-12) v = [1, 0];
          return v.map((x) => x / norm(v));
        });
      return {
        summary: {
          trace: tr,
          determinant: det,
          lambda1: values[0] ?? null,
          lambda2: values[1] ?? null,
          imaginary: disc < 0 ? Math.sqrt(-disc) / 2 : 0,
        },
        series: samples(0, 2 * Math.PI, (x) => {
          const v = [Math.cos(x), Math.sin(x)],
            w = matvec(A, v);
          return { y: v[0] * w[1] - v[1] * w[0] };
        }),
        visualization: {
          type: 'math-space',
          kind: 'transform',
          matrix: A,
          vector: ev[0] ?? [1, 0],
          eigenvectors: ev,
        },
        warnings:
          disc < 0 ? ['No real eigendirections. The complex pair has real part trace/2.'] : [],
      };
    },
  ),
  mathgramschmidt: make(
    {
      id: 'mathgramschmidt',
      title: 'Gram–Schmidt Orthogonalization',
      inputs: {
        matrix: mat(
          'Input vectors as matrix columns',
          [
            [1, 1, 0],
            [1, 0, 1],
            [0, 1, 1],
          ],
          3,
        ),
      },
      validateValues: errorFor('matrix', ({ matrix: source }) => matrix(source, 3)),
      metrics: { rank: ['Independent vectors', '1'], error: ['Maximum |QᵀQ−I|', '1'] },
      plot: { x: 'Input vector number', y: 'Basis size', xUnit: '', yUnit: '', step: true },
      text: {
        description:
          'Subtract projections one vector at a time with modified Gram–Schmidt and inspect orthogonality.',
        predict: 'What remains after projecting a dependent vector off the existing span?',
        answers: ['Approximately zero', 'A new unit vector', 'The original vector'],
        explain: 'A dependent vector contributes no new direction and is omitted from the basis.',
        example: 'The first two default columns give q₁=(1,1,0)/√2 and q₂=(1,−1,2)/√6.',
        equation: 'v←aⱼ−Σ(qᵢᵀv)qᵢ; qⱼ=v/||v||.',
        limits:
          'Three vectors in R³. The graphic shows their xy projection; the table retains all three coordinates. Near-dependence uses a numerical tolerance; no reorthogonalization pass.',
      },
    },
    ({ matrix: source }) => {
      const A = matrix(source, 3),
        r = gramSchmidt(A),
        error = r.Q.length
          ? Math.max(...r.Q.flatMap((q, i) => r.Q.map((p, j) => Math.abs(dot(q, p) - +(i === j)))))
          : 0;
      return {
        summary: { rank: r.Q.length, error },
        series: r.frames.map((f, i) => ({ x: i + 1, y: f.vectors.length })),
        visualization: vectors(
          r.Q.map((v) => v.slice(0, 2)),
          { fromOrigin: true, caption: 'xy projection of orthonormal vectors in R³' },
        ),
        table: table(
          'Orthonormal basis columns',
          ['Vector', 'x', 'y', 'z'],
          r.Q.map((q, i) => [i + 1, ...q]),
        ),
        warnings:
          r.Q.length < 3 ? ['Dependent or numerically negligible columns were skipped.'] : [],
      };
    },
  ),
  mathprojection: make(
    {
      id: 'mathprojection',
      title: 'Orthogonal Projection and Least-Squares Geometry',
      inputs: {
        ax: real('Basis vector ax', -3, 3, 2),
        ay: real('Basis vector ay', -3, 3, 1),
        bx: real('Target vector bx', -3, 3, 1),
        by: real('Target vector by', -3, 3, 2),
      },
      validateValues: ({ ax, ay }) =>
        Math.hypot(ax, ay) < 1e-8
          ? { key: 'ax', message: 'The basis vector must be nonzero.' }
          : undefined,
      metrics: {
        coefficient: ['Least-squares scalar c', '1'],
        residual: ['Residual length', '1'],
        orthogonality: ['a·(b−ca)', '1'],
      },
      plot: { x: 'Candidate coefficient c', y: 'Squared residual', xUnit: '', yUnit: '' },
      text: {
        description: 'Project a target onto a line and see least squares as the shortest residual.',
        predict: 'At the minimum, how is the residual related to the line?',
        answers: ['It is perpendicular', 'It is parallel', 'It must vanish'],
        explain: 'The normal equation forces aᵀ(b−ca)=0, even when the target is not on the line.',
        example: 'a=(2,1),b=(1,2) gives c=4/5, projection (1.6,0.8), residual (−0.6,1.2).',
        equation: 'c=(aᵀb)/(aᵀa); p=ca; minimize ||b−ca||².',
        limits:
          'Projection onto one nonzero line in R², through the origin. General rank-deficient design matrices need a pseudoinverse.',
      },
    },
    ({ ax, ay, bx, by }) => {
      const a = [ax, ay],
        b = [bx, by],
        c = dot(a, b) / dot(a, a),
        projection = a.map((v) => c * v),
        residual = b.map((v, i) => v - projection[i]);
      return {
        summary: { coefficient: c, residual: norm(residual), orthogonality: dot(a, residual) },
        series: samples(c - 2, c + 2, (x) => ({ y: sumSquares(b.map((v, i) => v - x * a[i])) })),
        visualization: vectors([b, projection], {
          fromOrigin: true,
          labels: ['Target b', 'Projection'],
          segments: [[...projection, ...b]],
        }),
      };
    },
  ),
  mathsvd: make(
    {
      id: 'mathsvd',
      title: 'SVD Low-Rank Approximation',
      inputs: {
        matrix: mat('Matrix A', [
          [3, 1],
          [0, 2],
        ]),
        rank: integer('Retained rank', 0, 2, 1),
      },
      validateValues: errorFor('matrix', matrixCheck),
      metrics: {
        sigma1: ['Largest singular value', '1'],
        sigma2: ['Second singular value', '1'],
        error: ['Frobenius approximation error', '1'],
        energy: ['Retained squared-norm fraction', '1'],
      },
      plot: { x: 'Retained rank', y: 'Frobenius error', xUnit: '', yUnit: '', step: true },
      text: {
        description:
          'Remove singular directions from a small matrix and compare approximation error with discarded singular energy.',
        predict: 'Which rank-one approximation minimizes Frobenius error?',
        answers: [
          'Keep the largest singular component',
          'Keep the smallest component',
          'Keep an arbitrary column',
        ],
        explain: 'The truncated SVD discards the least squared singular energy.',
        example: 'For diag(3,2), rank one keeps 3 and has Frobenius error 2.',
        equation: 'A=UΣVᵀ; Aᵣ=Σᵢ₌₁ʳσᵢuᵢvᵢᵀ; ||A−Aᵣ||F²=Σᵢ₊ᵣσᵢ².',
        limits:
          'Real 2×2 matrices, computed from the symmetric eigensystem of AᵀA. Small singular values lose relative precision; this is not a large-matrix production SVD.',
      },
    },
    ({ matrix: source, rank }) => {
      const A = matrix(source),
        e = eigenSymmetric(multiply(transpose(A), A)),
        s = e.values.map((v) => Math.sqrt(Math.max(0, v))),
        B = [
          [0, 0],
          [0, 0],
        ];
      for (let k = 0; k < rank; k++) {
        const v = e.vectors.map((row) => row[k]),
          Av = matvec(A, v);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) B[i][j] += Av[i] * v[j];
      }
      const total = s[0] ** 2 + s[1] ** 2;
      return {
        summary: {
          sigma1: s[0],
          sigma2: s[1],
          error: Math.hypot(...A.flatMap((row, i) => row.map((v, j) => v - B[i][j]))),
          energy: total ? 1 - s.slice(rank).reduce((a, v) => a + v * v, 0) / total : 1,
        },
        series: [0, 1, 2].map((x) => ({ x, y: Math.hypot(...s.slice(x)) })),
        visualization: {
          type: 'math-space',
          kind: 'matrices',
          matrices: [
            { label: 'Original A', matrix: A },
            { label: `Rank ${rank}`, matrix: B },
          ],
        },
        table: table(
          'Singular values',
          ['Index', 'σ', 'σ²'],
          s.map((v, i) => [i + 1, v, v * v]),
        ),
      };
    },
  ),
  mathlu: make(
    {
      id: 'mathlu',
      title: 'LU Decomposition and Pivoting Stability',
      inputs: {
        epsilon: real('Leading entry ε', 1e-12, 0.9, 0.0001),
        pivot: choice(
          'Elimination strategy',
          { yes: 'Partial pivoting', no: 'No pivoting' },
          'yes',
        ),
      },
      metrics: {
        growth: ['Largest U entry / largest A entry', '1'],
        residual: ['Factorization residual ||PA−LU||F', '1'],
        swaps: ['Row swaps', '1'],
      },
      plot: { x: 'Pivot stage', y: 'Largest U entry', xUnit: '', yUnit: '' },
      text: {
        description:
          'Use a small leading pivot to expose element growth, then enable row pivoting.',
        predict: 'Does a nonzero tiny pivot guarantee numerically stable elimination?',
        answers: ['No', 'Yes', 'Only for 2×2 matrices'],
        explain:
          'Division by a tiny pivot creates large multipliers and cancellation; swapping rows avoids this example’s growth.',
        example: 'For [[ε,1],[1,1]], unpivoted U₂₂=1−1/ε. At ε=10⁻⁴ its magnitude is 9999.',
        equation:
          'PA=LU with unit-diagonal L; partial pivoting selects the largest available column entry.',
        limits:
          'A deliberately ill-scaled 2×2 family using binary64 arithmetic. Element growth is a warning indicator, not a complete condition-number estimate.',
      },
    },
    ({ epsilon, pivot }) => {
      const A = [
          [epsilon, 1],
          [1, 1],
        ],
        r = lu(A, pivot === 'yes'),
        PA = r.permutation.map((i) => A[i]),
        LU = multiply(r.L, r.U);
      return {
        summary: {
          growth: Math.max(...r.U.flat().map(Math.abs)),
          residual: Math.hypot(...PA.flatMap((row, i) => row.map((v, j) => v - LU[i][j]))),
          swaps: r.swaps,
        },
        series: r.frames.map((f, x) => ({
          x: x + 1,
          y: Math.max(...f.matrix.flat().map(Math.abs)),
        })),
        visualization: {
          type: 'math-space',
          kind: 'matrices',
          matrices: [
            { label: 'L', matrix: r.L },
            { label: 'U', matrix: r.U },
          ],
        },
      };
    },
  ),
  mathpoweriteration: make(
    {
      id: 'mathpoweriteration',
      title: 'Power Iteration and Dominant Eigenvalue',
      inputs: {
        matrix: mat('Matrix A', [
          [3, 1],
          [1, 2],
        ]),
        x: real('Initial vector x', -2, 2, 1),
        y: real('Initial vector y', -2, 2, 0.2),
        iterations: integer('Iterations', 2, 80, 20),
      },
      validateValues: errorFor('matrix', (v) => {
        matrixCheck(v);
        if (Math.hypot(v.x, v.y) < 1e-10) throw new Error('Initial vector must be nonzero.');
      }),
      metrics: {
        estimate: ['Final Rayleigh quotient', '1'],
        residual: ['Eigenpair residual norm', '1'],
      },
      plot: {
        x: 'Iteration',
        y: 'Value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Rayleigh quotient', reference: 'Residual' },
      },
      text: {
        description:
          'Normalize repeated matrix-vector products and monitor the residual instead of trusting a settled scalar alone.',
        predict: 'What can prevent convergence to a unique dominant eigenvector?',
        answers: [
          'Equal dominant eigenvalue magnitudes',
          'A larger iteration count',
          'Normalization',
        ],
        explain:
          'Power iteration needs a nonzero starting component along a unique largest-magnitude eigendirection.',
        example: 'The default matrix has largest eigenvalue (5+√5)/2≈3.618034.',
        equation: 'qₖ₊₁=Aqₖ/||Aqₖ||; λₖ=qₖᵀAqₖ; rₖ=||Aqₖ−λₖqₖ||.',
        limits:
          'Real 2×2 matrices. Complex or equal-magnitude dominant eigenvalues can cycle; a starting vector in a nullspace cannot discover another eigendirection.',
      },
    },
    ({ matrix: source, x, y, iterations }) => {
      const A = matrix(source);
      let q = [x / Math.hypot(x, y), y / Math.hypot(x, y)],
        estimate = 0,
        residual = 0,
        stopped = false;
      const series = [],
        points = [];
      for (let i = 0; i < iterations; i++) {
        const z = matvec(A, q),
          n = norm(z);
        if (n < 1e-14) {
          stopped = true;
          estimate = 0;
          residual = n;
          series.push({ x: i + 1, y: 0, reference: n });
          break;
        }
        q = z.map((v) => v / n);
        const w = matvec(A, q);
        estimate = dot(q, w);
        residual = norm(w.map((v, j) => v - estimate * q[j]));
        series.push({ x: i + 1, y: estimate, reference: residual });
        points.push([...q]);
      }
      return {
        summary: { estimate, residual },
        series,
        visualization: traceVisual(points, { fromOrigin: true, circle: 1 }),
        warnings: stopped
          ? [
              'The iterate reached the nullspace; no claim about a nonzero dominant eigenvalue is made.',
            ]
          : residual > 1e-5
            ? ['The eigenpair residual is still appreciable. Inspect convergence or cycling.']
            : [],
      };
    },
  ),
};
const sumSquares = (a) => dot(a, a);

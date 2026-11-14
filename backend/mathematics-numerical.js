import {
  mathLab,
  p,
  integer,
  choice,
  samples,
  linspace,
  dot,
  norm,
  matvec,
  traceVisual,
  gridVisual,
  finite,
} from './math-core.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial);
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) => mathLab({ topic: 'Numerical Methods', ...config }, solve);
/** Dormand–Prince 5(4), with weighted local error control and bounded attempts. */
export function rk45(f, y0, end, { rtol = 1e-6, atol = 1e-9, initialStep = 0.1 } = {}) {
  const A = [
      [],
      [1 / 5],
      [3 / 40, 9 / 40],
      [44 / 45, -56 / 15, 32 / 9],
      [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
      [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
      [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
    ],
    C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
    B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
    E = [
      35 / 384 - 5179 / 57600,
      0,
      500 / 1113 - 7571 / 16695,
      125 / 192 - 393 / 640,
      -2187 / 6784 + 92097 / 339200,
      11 / 84 - 187 / 2100,
      -1 / 40,
    ];
  let t = 0,
    y = y0,
    h = Math.min(initialStep, end),
    rejected = 0,
    attempts = 0;
  const rows = [{ t, y, h: 0, error: 0 }];
  while (t < end && attempts++ < 20000) {
    h = Math.min(h, end - t);
    if (h < 1e-13) throw new Error('Adaptive step underflow; relax the tolerance.');
    const k = [];
    for (let i = 0; i < 7; i++) k.push(f(t + C[i] * h, y + h * dot(A[i], k)));
    const next = y + h * dot(B, k),
      error = Math.abs(h * dot(E, k)),
      scaled = error / (atol + rtol * Math.max(Math.abs(y), Math.abs(next)));
    if (!Number.isFinite(next) || !Number.isFinite(scaled))
      throw new Error('Non-finite adaptive trajectory.');
    if (scaled <= 1) {
      t += h;
      y = next;
      rows.push({ t, y, h, error });
    } else rejected++;
    h *= Math.max(0.2, Math.min(5, scaled === 0 ? 5 : 0.9 * scaled ** -0.2));
  }
  if (t < end) throw new Error('Adaptive attempt limit exceeded.');
  return { rows, rejected, attempts };
}
export function barycentric(nodes, values, x) {
  const hit = nodes.findIndex((v) => Math.abs(x - v) < 1e-14);
  if (hit >= 0) return values[hit];
  const weights = nodes.map(
      (v, i) => 1 / nodes.reduce((a, w, j) => (i === j ? a : a * (v - w)), 1),
    ),
    terms = nodes.map((v, i) => weights[i] / (x - v));
  return dot(terms, values) / terms.reduce((a, b) => a + b, 0);
}
export const numericalMathModels = {
  mathjacobi: make(
    {
      id: 'mathjacobi',
      title: 'Jacobi vs. Gauss–Seidel Convergence',
      inputs: {
        coupling: real('Off-diagonal coupling', 0, 0.95, 0.6),
        iterations: integer('Iterations', 2, 100, 30),
      },
      metrics: {
        jacobi: ['Jacobi residual norm', '1'],
        seidel: ['Gauss–Seidel residual norm', '1'],
        radius: ['Jacobi spectral radius', '1'],
      },
      plot: {
        x: 'Iteration',
        y: 'Residual norm',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Jacobi', reference: 'Gauss–Seidel' },
      },
      text: {
        description:
          'Update a symmetric, strictly diagonally dominant system simultaneously or in place and compare residuals.',
        predict: 'Which method immediately reuses values from the current sweep?',
        answers: ['Gauss–Seidel', 'Jacobi', 'Neither'],
        explain:
          'Jacobi uses the previous vector throughout; Gauss–Seidel uses freshly updated coordinates.',
        example: 'With zero coupling, both methods solve the diagonal system in one sweep.',
        equation: 'A=tridiag(−c,2,−c), b=(1,0,1)ᵀ; r=b−Ax.',
        limits:
          'A three-variable SPD family with 0≤c≤0.95. Faster convergence here does not imply Gauss–Seidel dominates on every matrix.',
      },
    },
    ({ coupling: c, iterations }) => {
      const A = [
          [2, -c, 0],
          [-c, 2, -c],
          [0, -c, 2],
        ],
        b = [1, 0, 1],
        res = (x) => norm(matvec(A, x).map((v, i) => v - b[i]));
      let a = [0, 0, 0],
        g = [0, 0, 0];
      const series = [{ x: 0, y: res(a), reference: res(g) }],
        frames = [];
      for (let k = 1; k <= iterations; k++) {
        a = a.map((v, i) => (b[i] - dot(A[i], a) + 2 * v) / 2);
        for (let i = 0; i < 3; i++) g[i] = (b[i] - dot(A[i], g) + 2 * g[i]) / 2;
        series.push({ x: k, y: res(a), reference: res(g) });
        frames.push({ label: `Sweep ${k}: Jacobi / Gauss–Seidel`, matrix: [a.slice(), g.slice()] });
      }
      return {
        summary: { jacobi: res(a), seidel: res(g), radius: c / Math.sqrt(2) },
        series,
        visualization: { type: 'math-space', kind: 'matrix-steps', frames },
      };
    },
  ),
  mathquadrature: make(
    {
      id: 'mathquadrature',
      title: 'Numerical Integration: Simpson vs. Gauss–Legendre',
      inputs: {
        function: choice('Integrand', { exp: 'exp(x)', sin: 'sin(πx)', poly: 'x⁴' }, 'exp'),
        panels: integer('Panel pairs', 1, 40, 4),
      },
      metrics: {
        exact: ['Exact integral on [0,1]', '1'],
        simpson: ['Composite Simpson absolute error', '1'],
        gauss: ['Composite two-point Gauss error', '1'],
      },
      plot: {
        x: 'Panel pairs',
        y: 'Absolute integration error',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Simpson', reference: 'Two-point Gauss–Legendre' },
      },
      text: {
        description:
          'Compare equal-cost composite formulas using analytic integrals and increasing refinement.',
        predict: 'Is two-point Gauss–Legendre exact for cubics on each panel?',
        answers: ['Yes', 'No, only linear functions', 'Only with equal nodes'],
        explain:
          'An n-point Gauss rule integrates degree 2n−1 exactly with its optimal nodes and weights.',
        example:
          'For x⁴ on [0,1], the exact integral is 0.2; neither displayed rule is exact at finite refinement.',
        equation: 'Simpson: h(f₀+4f₁+f₂)/3; Gauss₂ on [a,b]: (b−a)[f(m−d/√3)+f(m+d/√3)]/2.',
        limits:
          'Smooth fixed functions on [0,1]. Each panel pair uses 2n Simpson subintervals versus n Gauss panels; endpoint reuse affects actual function-call cost.',
      },
    },
    ({ function: kind, panels }) => {
      const f =
          kind === 'exp' ? Math.exp : kind === 'sin' ? (x) => Math.sin(Math.PI * x) : (x) => x ** 4,
        exact = kind === 'exp' ? Math.E - 1 : kind === 'sin' ? 2 / Math.PI : 0.2,
        calc = (n) => {
          let s = 0,
            g = 0;
          for (let i = 0; i < n; i++) {
            const a = i / n,
              b = (i + 1) / n,
              m = (a + b) / 2,
              d = (b - a) / 2;
            s += ((b - a) / 6) * (f(a) + 4 * f(m) + f(b));
            g += d * (f(m - d / Math.sqrt(3)) + f(m + d / Math.sqrt(3)));
          }
          return [Math.abs(s - exact), Math.abs(g - exact)];
        },
        e = calc(panels);
      return {
        summary: { exact, simpson: e[0], gauss: e[1] },
        series: Array.from({ length: panels }, (_, i) => {
          const e = calc(i + 1);
          return { x: i + 1, y: e[0], reference: e[1] };
        }),
      };
    },
  ),
  mathheat: make(
    {
      id: 'mathheat',
      title: 'Finite-Difference Heat Equation: Stability Limit',
      inputs: {
        cells: integer('Spatial intervals', 8, 40, 20),
        ratio: real('Diffusion number r = αΔt/Δx²', 0.05, 1.2, 0.4),
        steps: integer('Time steps', 1, 300, 60),
      },
      metrics: {
        time: ['Elapsed nondimensional time', '1'],
        error: ['Maximum error vs smooth exact mode', '1'],
        stable: ['Within FTCS stability bound (1=yes)', '1'],
        amplification: ['Highest-mode amplification magnitude', '1'],
      },
      plot: {
        x: 'Position',
        y: 'Temperature',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Finite differences', reference: 'Exact smooth mode' },
      },
      text: {
        description:
          'Expose the FTCS stability limit by evolving a sine profile with a tiny high-frequency perturbation.',
        predict: 'What does r>1/2 permit?',
        answers: [
          'Growth of high-frequency grid errors',
          'Guaranteed faster convergence',
          'An implicit stable step',
        ],
        explain: 'FTCS Fourier amplification is 1−4r sin²(kΔx/2), whose magnitude can exceed one.',
        example:
          'For r=0.4 the highest-frequency amplification is about −0.6; for r=0.8 it is about −2.2.',
        equation: 'uⱼⁿ⁺¹=uⱼⁿ+r(uⱼ₋₁ⁿ−2uⱼⁿ+uⱼ₊₁ⁿ); u(0,t)=u(1,t)=0.',
        limits:
          'α=1 in nondimensional coordinates, initial sin(πx)+10⁻⁸sin((N−1)πx). The exact comparator omits the tiny perturbation. Integration stops if |u| exceeds 10⁶ and reports the actual elapsed time.',
      },
    },
    ({ cells: N, ratio: r, steps }) => {
      let u = linspace(0, 1, N).map(
          (x) => Math.sin(Math.PI * x) + 1e-8 * Math.sin((N - 1) * Math.PI * x),
        ),
        done = 0,
        stopped = false;
      const frames = [];
      for (let n = 0; n < steps; n++) {
        const next = u.map((v, i) =>
          i === 0 || i === N ? 0 : v + r * (u[i - 1] - 2 * v + u[i + 1]),
        );
        if (next.some((v) => Math.abs(v) > 1e6)) {
          stopped = true;
          break;
        }
        u = next;
        done++;
        if (n % 5 === 0) frames.push({ label: `Step ${done}`, matrix: [u.slice()] });
      }
      const t = (done * r) / N ** 2,
        series = u.map((y, i) => ({
          x: i / N,
          y,
          reference: Math.exp(-(Math.PI ** 2) * t) * Math.sin((Math.PI * i) / N),
        }));
      return {
        summary: {
          time: t,
          error: Math.max(...series.map((v) => Math.abs(v.y - v.reference))),
          stable: +(r <= 0.5),
          amplification: Math.abs(1 - 4 * r * Math.cos(Math.PI / (2 * N)) ** 2),
        },
        series,
        visualization: gridVisual([u], {
          caption: `Temperature at actual time ${t.toPrecision(4)}`,
        }),
        warnings: stopped
          ? ['Unstable evolution exceeded the display domain; the plot shows the last finite step.']
          : r > 0.5
            ? ['FTCS is outside its stability interval, even if early steps still look smooth.']
            : [],
      };
    },
  ),
  mathpoisson: make(
    {
      id: 'mathpoisson',
      title: 'Laplace/Poisson Relaxation on a 2D Grid',
      inputs: {
        cells: integer('Intervals per direction', 6, 24, 12),
        iterations: integer('Relaxation sweeps', 1, 400, 100),
        omega: real('SOR relaxation ω', 0.2, 1.95, 1.4),
      },
      metrics: {
        residual: ['Maximum discrete PDE residual', '1'],
        error: ['Maximum error vs exact continuum field', '1'],
        sweeps: ['Sweeps completed', '1'],
      },
      plot: { x: 'Sweep', y: 'Maximum PDE residual', xUnit: '', yUnit: '' },
      text: {
        description:
          'Solve a manufactured Poisson problem by successive over-relaxation and inspect the grid and residual history.',
        predict: 'Does a small algebraic residual remove spatial discretization error?',
        answers: ['No', 'Yes', 'Only when ω=1'],
        explain:
          'Iteration solves the discrete equations; those still approximate the continuum PDE.',
        example: 'For −Δu=2π²sin(πx)sin(πy), zero boundary values give exact u=sin(πx)sin(πy).',
        equation: 'uᵢⱼ ← (1−ω)uᵢⱼ+ω(uᵢ₋₁ⱼ+uᵢ₊₁ⱼ+uᵢⱼ₋₁+uᵢⱼ₊₁+h²fᵢⱼ)/4.',
        limits:
          'Unit-square uniform grid, zero Dirichlet boundary, positive Poisson operator. 0<ω<2 converges for this SPD problem; iteration and spatial errors are reported separately.',
      },
    },
    ({ cells: N, iterations, omega }) => {
      const h = 1 / N,
        u = Array.from({ length: N + 1 }, () => Array(N + 1).fill(0)),
        exact = (i, j) => Math.sin((Math.PI * i) / N) * Math.sin((Math.PI * j) / N),
        f = (i, j) => 2 * Math.PI ** 2 * exact(i, j),
        res = () => {
          let m = 0;
          for (let i = 1; i < N; i++)
            for (let j = 1; j < N; j++)
              m = Math.max(
                m,
                Math.abs(
                  (4 * u[i][j] - u[i - 1][j] - u[i + 1][j] - u[i][j - 1] - u[i][j + 1]) / h ** 2 -
                    f(i, j),
                ),
              );
          return m;
        },
        series = [{ x: 0, y: res() }];
      for (let n = 1; n <= iterations; n++) {
        for (let i = 1; i < N; i++)
          for (let j = 1; j < N; j++)
            u[i][j] =
              (1 - omega) * u[i][j] +
              (omega * (u[i - 1][j] + u[i + 1][j] + u[i][j - 1] + u[i][j + 1] + h * h * f(i, j))) /
                4;
        series.push({ x: n, y: res() });
      }
      return {
        summary: {
          residual: res(),
          error: Math.max(...u.flatMap((row, i) => row.map((v, j) => Math.abs(v - exact(i, j))))),
          sweeps: iterations,
        },
        series,
        visualization: gridVisual(u, { caption: 'Poisson solution; horizontal x, vertical y' }),
      };
    },
  ),
  mathrunge: make(
    {
      id: 'mathrunge',
      title: 'Runge Phenomenon and Chebyshev Nodes',
      inputs: { degree: integer('Polynomial degree', 2, 28, 12) },
      metrics: {
        uniform: ['Uniform-node maximum sampled error', '1'],
        chebyshev: ['Chebyshev-node maximum sampled error', '1'],
      },
      plot: {
        x: 'x',
        y: 'Interpolated value',
        xUnit: '',
        yUnit: '',
        traces: {
          y: 'Uniform nodes',
          reference: 'Chebyshev–Lobatto nodes',
          other: 'Runge function',
        },
      },
      text: {
        description:
          'Fit the same Runge function with barycentric interpolation on two node distributions.',
        predict: 'Does increasing degree on equally spaced nodes always reduce maximum error?',
        answers: ['No', 'Yes', 'Only for symmetric functions'],
        explain: 'Equally spaced interpolation can oscillate severely near interval endpoints.',
        example: 'f(x)=1/(1+25x²) is smooth on [−1,1] yet exhibits the Runge phenomenon.',
        equation: 'p(x)=Σ wᵢfᵢ/(x−xᵢ) ÷ Σ wᵢ/(x−xᵢ); Chebyshev nodes xᵢ=cos(iπ/n).',
        limits:
          'Degree ≤28, binary64 barycentric evaluation. Maximum error is sampled at 601 points, not a rigorous supremum bound; exact node hits use the known data value.',
      },
    },
    ({ degree: n }) => {
      const f = (x) => 1 / (1 + 25 * x * x),
        a = linspace(-1, 1, n),
        b = linspace(0, Math.PI, n).map(Math.cos),
        av = a.map(f),
        bv = b.map(f),
        series = samples(
          -1,
          1,
          (x) => ({ y: barycentric(a, av, x), reference: barycentric(b, bv, x), other: f(x) }),
          600,
        );
      return {
        summary: {
          uniform: Math.max(...series.map((r) => Math.abs(r.y - r.other))),
          chebyshev: Math.max(...series.map((r) => Math.abs(r.reference - r.other))),
        },
        series,
        visualization: vectorsForNodes(a, av, b, bv),
      };
    },
  ),
  mathconjugate: make(
    {
      id: 'mathconjugate',
      title: 'Conjugate Gradient vs. Steepest Descent',
      inputs: {
        condition: real('Diagonal condition number κ', 1, 100, 20),
        x: real('Initial x', -3, 3, 2),
        y: real('Initial y', -3, 3, 2),
        iterations: integer('Iterations', 2, 50, 20),
      },
      metrics: {
        cg: ['CG residual norm', '1'],
        descent: ['Steepest-descent residual norm', '1'],
        condition: ['Condition number', '1'],
      },
      plot: {
        x: 'Iteration',
        y: 'Residual norm',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Conjugate gradient', reference: 'Steepest descent' },
      },
      text: {
        description:
          'Solve a two-dimensional SPD quadratic with exact line searches and compare zig-zagging with conjugate directions.',
        predict: 'In exact arithmetic, how many CG steps suffice for a 2×2 SPD system?',
        answers: ['At most two', 'Always one', 'At least the condition number'],
        explain:
          'CG minimizes over expanding Krylov spaces and terminates within the matrix dimension in exact arithmetic.',
        example: 'A=diag(1,20), b=0, starting at (2,2), produces steepest-descent zig-zags.',
        equation: 'αCG=(rᵀr)/(pᵀAp), β=(rnewᵀrnew)/(rᵀr); αSD=(rᵀr)/(rᵀAr).',
        limits:
          'Two-dimensional SPD diagonal family, finite precision, zero right-hand side. Residual tolerance 10⁻¹² stops converged updates; plotted repeated zeros are held converged states.',
      },
    },
    ({ condition: k, x, y, iterations }) => {
      const A = [
          [1, 0],
          [0, k],
        ],
        cg = [x, y],
        sd = [x, y];
      let r = matvec(A, cg).map((v) => -v),
        d = [...r],
        rr = dot(r, r);
      const series = [{ x: 0, y: Math.sqrt(rr), reference: norm(matvec(A, sd)) }],
        points = [cg.slice()],
        other = [sd.slice()];
      for (let n = 1; n <= iterations; n++) {
        if (rr > 1e-24) {
          const Ad = matvec(A, d),
            a = rr / dot(d, Ad);
          for (let j = 0; j < 2; j++) {
            cg[j] += a * d[j];
            r[j] -= a * Ad[j];
          }
          const next = dot(r, r),
            b = next / rr;
          d = r.map((v, j) => v + b * d[j]);
          rr = next;
        }
        const g = matvec(A, sd),
          gg = dot(g, g);
        if (gg > 1e-24) {
          const a = gg / dot(g, matvec(A, g));
          for (let j = 0; j < 2; j++) sd[j] -= a * g[j];
        }
        series.push({ x: n, y: norm(matvec(A, cg)), reference: norm(matvec(A, sd)) });
        points.push(cg.slice());
        other.push(sd.slice());
      }
      return {
        summary: { cg: norm(matvec(A, cg)), descent: norm(matvec(A, sd)), condition: k },
        series,
        visualization: traceVisual(points, {
          lines: [other],
          caption: 'Blue: CG; green: steepest descent; optimum at origin',
        }),
      };
    },
  ),
  mathroundoff: make(
    {
      id: 'mathroundoff',
      title: 'Floating-Point Roundoff and Catastrophic Cancellation',
      inputs: { exponent: real('log₁₀(x)', -18, -1, -12) },
      metrics: {
        direct: ['Direct sqrt(1+x)−1', '1'],
        stable: ['Rationalized evaluation', '1'],
        relative: ['Direct relative error vs stable form', '1'],
      },
      plot: { x: 'log₁₀(x)', y: 'Relative error', xUnit: '', yUnit: '' },
      text: {
        description:
          'Subtract nearly equal numbers, then use an algebraically equivalent form to preserve small increments.',
        predict: 'Why can sqrt(1+x)−1 become exactly zero for positive x?',
        answers: [
          '1+x or its square root rounds to one',
          'x becomes negative',
          'The mathematical answer is zero',
        ],
        explain: 'Binary64 rounding loses the tiny increment before subtraction.',
        example:
          'At x=10⁻¹⁸, direct evaluation is zero while x/(sqrt(1+x)+1) is approximately 5×10⁻¹⁹.',
        equation: 'sqrt(1+x)−1 = x/(sqrt(1+x)+1).',
        limits:
          'IEEE-754 JavaScript binary64. The stable expression is a high-quality floating-point reference here, not arbitrary-precision ground truth; no correctly rounded guarantee is claimed.',
      },
    },
    ({ exponent }) => {
      const x = 10 ** exponent,
        a = Math.sqrt(1 + x) - 1,
        b = x / (Math.sqrt(1 + x) + 1);
      return {
        summary: { direct: a, stable: b, relative: Math.abs(a - b) / b },
        series: samples(-18, -1, (e) => {
          const x = 10 ** e,
            s = x / (Math.sqrt(1 + x) + 1);
          return { y: Math.abs(Math.sqrt(1 + x) - 1 - s) / s };
        }),
      };
    },
  ),
  mathrk45: make(
    {
      id: 'mathrk45',
      title: 'Adaptive Step-Size Runge–Kutta (RK45)',
      inputs: {
        rate: real('Decay rate k', 0.1, 20, 4),
        tolerance: real('log₁₀(relative tolerance)', -9, -2, -5),
        horizon: real('Time horizon', 1, 10, 4),
        initialstep: real('Initial step', 0.01, 2, 1),
      },
      metrics: {
        accepted: ['Accepted steps', '1'],
        rejected: ['Rejected attempts', '1'],
        error: ['Endpoint absolute error', '1'],
        evaluations: ['Derivative evaluations', '1'],
      },
      plot: {
        x: 'Accepted-step time',
        y: 'Response / step size',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'RK45 solution', reference: 'Exact exp(−kt)', other: 'Accepted step size' },
      },
      text: {
        description:
          'Use an embedded Dormand–Prince pair to accept or reject steps and adapt the next trial size.',
        predict: 'What happens after a trial exceeds its local error tolerance?',
        answers: [
          'Reject it and retry with a smaller step',
          'Keep it and hide the error',
          'Reduce the solution value',
        ],
        explain: 'A rejected trial does not advance time or change the accepted state.',
        example: 'For y′=−4y,y(0)=1, the exact response is e⁻⁴ᵗ.',
        equation:
          'Embedded orders 5 and 4 estimate error; scale=atol+rtol max(|yₙ|,|yₙ₊₁|), hnew≈0.9h error⁻¹⁄⁵.',
        limits:
          'Scalar exponential test problem, rtol=10^input and atol=rtol×10⁻³. Local tolerances do not guarantee a global error bound. Safety factors, step limits and an attempt cap prevent unbounded work.',
      },
    },
    ({ rate, tolerance, horizon, initialstep }) => {
      const tol = 10 ** tolerance,
        r = rk45((_t, y) => -rate * y, 1, horizon, {
          rtol: tol,
          atol: tol * 0.001,
          initialStep: initialstep,
        });
      return {
        summary: {
          accepted: r.rows.length - 1,
          rejected: r.rejected,
          error: Math.abs(r.rows.at(-1).y - Math.exp(-rate * horizon)),
          evaluations: r.attempts * 7,
        },
        series: r.rows.map((v) => ({
          x: v.t,
          y: finite(v.y),
          reference: Math.exp(-rate * v.t),
          other: v.h,
        })),
      };
    },
  ),
};
const vectorsForNodes = (a, av, b, bv) => ({
  type: 'math-space',
  kind: 'plane',
  points: a.map((x, i) => [x, av[i]]),
  markers: b.map((x, i) => [x, bv[i]]),
  caption: 'Blue: equally spaced nodes; green: Chebyshev–Lobatto nodes',
});

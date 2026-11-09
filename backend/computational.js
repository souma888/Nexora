import { lab, p, integer, choice, samples, table } from './lab-kit.js';
const functionAt = (kind, x) => kind === 'cubic' ? x ** 3 - x - 2 : Math.cos(x) - x;
export function poissonSolution(n) {
  const h = 1 / n, c = Array(n - 1).fill(0), d = Array(n - 1).fill(0);
  for (let i = 0; i < n - 1; i++) { const denominator = 2 + (i ? c[i - 1] : 0); c[i] = i < n - 2 ? -1 / denominator : 0; d[i] = (h * h * Math.PI ** 2 * Math.sin(Math.PI * (i + 1) * h) + (i ? d[i - 1] : 0)) / denominator; }
  const u = Array(n + 1).fill(0);
  for (let i = n - 2; i >= 0; i--) u[i + 1] = d[i] - c[i] * u[i + 2];
  return u;
}
export const computationalModels = {
  roots: lab({ id: 'roots', title: 'Root Finding: Bisection & Newton', discipline: 'computational', lab: 'CE01', topic: 'Numerical methods',
    inputs: { function: choice('Equation', { cubic: 'x³ − x − 2 = 0', cosine: 'cos(x) − x = 0' }, 'cubic'), method: choice('Root-finding method', { bisection: 'Bisection', newton: 'Newton–Raphson' }, 'bisection'), lower: p('Plot / bracket lower bound', '', -3, 2, 1), upper: p('Plot / bracket upper bound', '', -2, 3, 2), initial: p('Newton initial guess', '', -3, 3, 1.5), iterations: integer('Maximum iterations', 1, 30, 24), tolerance: p('Residual tolerance', '', 0.000001, 0.01, 0.000001) },
    rules: [{ type: 'less', left: 'lower', right: 'upper', field: 'upper', message: 'Upper bound must exceed lower bound.' }, { type: 'root-bracket', field: 'lower', when: { key: 'method', is: 'bisection' }, message: 'Bisection needs opposite signs (or a root) at the two bracket endpoints.' }],
    metrics: { root: ['Latest root estimate', ''], residual: ['Absolute residual', ''], iterations: ['Iterations performed', ''] }, plot: { x: 'x', xUnit: '', y: 'f(x)', yUnit: '', traces: { y: 'Equation', reference: 'Zero' } },
    text: ['Inspect every iterate, bracket, and residual instead of trusting an unexplained root.', 'Why does bisection require a sign-changing bracket?', ['It preserves a contained root for a continuous function', 'It guarantees a zero derivative', 'It removes rounding error'], 'Each midpoint retains the subinterval whose endpoints bracket a sign change.',
      'The positive root of x³−x−2 is about 1.5213797068. Newton from 1.5 converges quickly; bisection from [1,2] reduces the bracket each iteration.',
      'Bisection: m=(a+b)/2, retain a sign-changing half. Newton: xnext=x−f(x)/f′(x). Stop when |f(x)| ≤ tolerance or the iteration budget is exhausted.',
      'Two fixed continuous teaching functions. Newton can fail or leave the plotted domain; a tiny derivative stops it with a warning. A small residual is the stated stopping criterion, not a universal error bound.'] },
    input => {
      const { function: kind, method, lower, upper, initial, iterations, tolerance } = input, f = x => functionAt(kind, x), rows = [], warnings = [];
      let a = lower, b = upper, x = method === 'newton' ? initial : f(a) === 0 ? a : f(b) === 0 ? b : (a + b) / 2;
      for (let i = 0; i < iterations; i++) {
        const fx = f(x); rows.push([i + 1, x, fx, a, b]); if (Math.abs(fx) <= tolerance) break;
        if (i === iterations - 1) break;
        if (method === 'bisection') { if (f(a) * fx <= 0) b = x; else a = x; x = (a + b) / 2; }
        else { const derivative = kind === 'cubic' ? 3 * x * x - 1 : -Math.sin(x) - 1; if (Math.abs(derivative) < 1e-10) { warnings.push('Newton stopped: derivative is too small for a reliable step.'); break; } const next = x - fx / derivative; if (!Number.isFinite(next) || Math.abs(next) > 1e6) { warnings.push('Newton stopped: the next iterate diverged beyond the numerical guard.'); break; } x = next; }
      }
      const residual = Math.abs(f(x)); if (residual > tolerance) warnings.push('The residual tolerance has not been reached. Increase the budget or choose a better bracket / initial guess.');
      if (x < lower || x > upper) warnings.push('The latest iterate lies outside the plotted interval. Its value is still listed in the iteration table.');
      return { summary: { root: x, residual, iterations: rows.length }, series: samples(lower, upper, t => ({ y: f(t), reference: 0 })), table: table('Complete root-finding iteration trace', ['Iteration', 'Estimate x', 'f(x)', 'Lower', 'Upper'], rows), warnings, visualization: { type: 'root', lower, upper, root: x, residual, detail: `${method} · ${residual <= tolerance ? 'residual target reached' : 'not converged'}` } };
    }),
  integration: lab({ id: 'integration', title: 'Euler vs. Runge–Kutta', discipline: 'computational', lab: 'CE02', topic: 'Numerical integration',
    inputs: { rate: p('Decay coefficient k', '1/s', 0.1, 4, 1), initial: p('Initial value', '', 0.1, 5, 1), step: p('Integration step', 's', 0.01, 1, 0.25), duration: p('Simulation duration', 's', 1, 10, 4) },
    metrics: { euler: ['Euler final absolute error', ''], rk4: ['RK4 final absolute error', ''], steps: ['Time steps', ''] }, plot: { x: 'Time', xUnit: 's', y: 'State y', yUnit: '', traces: { y: 'Forward Euler', reference: 'Exact', other: 'RK4' } },
    text: ['Compare accuracy and stability for the same differential equation and time step.', 'Is RK4 automatically stable for any time step?', ['No', 'Yes', 'Only if the plot is green'], 'Explicit RK4 has a finite stability region; a sufficiently large kΔt can still produce divergence.',
      'For y′=−y, y(0)=1, Δt=0.25 s and t=4 s, exact y=e⁻⁴. Euler undershoots; RK4 closely follows the exact curve.',
      'Euler: ynext=yn+h f(t,y). RK4 uses weights (k1+2k2+2k3+k4)/6. For linear decay its amplification is 1−z+z²/2−z³/6+z⁴/24, z=kh.',
      'Scalar linear decay with a shortened final step if needed. Forward Euler requires kh<2 for asymptotic stability; RK4’s negative-real-axis bound is about 2.785. Unstable cases remain visible.'] },
    ({ rate: k, initial, step, duration }) => {
      const series = [{ x: 0, y: initial, reference: initial, other: initial }]; let t = 0, euler = initial, rk = initial;
      while (t < duration - 1e-12) { const h = Math.min(step, duration - t), z = k * h; euler *= 1 - z; rk *= 1 - z + z ** 2 / 2 - z ** 3 / 6 + z ** 4 / 24; t = Math.min(duration, t + h); series.push({ x: t, y: euler, reference: initial * Math.exp(-k * t), other: rk }); }
      const exact = initial * Math.exp(-k * duration), stride = Math.max(1, Math.ceil(series.length / 50));
      return { summary: { euler: Math.abs(euler - exact), rk4: Math.abs(rk - exact), steps: series.length - 1 }, series, warnings: k * step >= 2 ? [`kΔt=${(k * step).toFixed(3)}: Euler is on or outside its asymptotic stability boundary.${k * step > 2.785 ? ' RK4 is outside its stability interval too.' : ''}`] : [], table: table('Sampled steps (full grid remains available in the plot inspector)', ['Time (s)', 'Euler', 'Exact', 'RK4'], series.filter((_, i) => i % stride === 0 || i === series.length - 1).map(p => [p.x, p.y, p.reference, p.other])) };
    }),
  interpolation: lab({ id: 'interpolation', title: 'Interpolation & Extrapolation', discipline: 'computational', lab: 'CE03', topic: 'Approximation',
    inputs: { y0: p('Value at x=0', '', -10, 10, 0), y1: p('Value at x=1', '', -10, 10, 1), y2: p('Value at x=2', '', -10, 10, 0), y3: p('Value at x=3', '', -10, 10, 2), query: p('Evaluation x', '', -0.5, 3.5, 1.5), method: choice('Interpolant', { linear: 'Piecewise linear', cubic: 'Lagrange cubic' }, 'cubic') },
    metrics: { value: ['Interpolated value', ''], slope: ['Local slope', ''], discrepancy: ['Cubic − linear at query', ''] }, plot: { x: 'x', xUnit: '', y: 'Interpolated value', yUnit: '', traces: { y: 'Selected interpolant', reference: 'Alternative interpolant', sample: 'Data nodes' } },
    text: ['Move four data ordinates and compare a local linear fit with a global cubic.', 'Must a cubic interpolant stay between adjacent data values?', ['No', 'Yes', 'Only outside the data range'], 'A global polynomial can overshoot even while matching every node exactly.',
      'For ordinates [0,1,0,2] at x=[0,1,2,3], the cubic gives 0.4375 at x=1.5; piecewise linear gives 0.5.',
      'Lagrange p(x)=Σ yi Πj≠i (x−xj)/(xi−xj). Piecewise linear uses the bracketing segment; beyond the domain it extends the nearest end segment.',
      'Four fixed, distinct x nodes. Evaluation outside [0,3] is extrapolation and is flagged. The slope is a centered numerical derivative; at linear knots it averages adjacent slopes.'] },
    ({ y0, y1, y2, y3, query, method }) => {
      const values = [y0, y1, y2, y3], linear = x => { const i = Math.max(0, Math.min(2, Math.floor(x))); return values[i] + (x - i) * (values[i + 1] - values[i]); };
      const cubic = x => values.reduce((sum, v, i) => sum + v * values.reduce((product, _, j) => i === j ? product : product * (x - j) / (i - j), 1), 0);
      const fn = method === 'cubic' ? cubic : linear, alternate = method === 'cubic' ? linear : cubic;
      return { summary: { value: fn(query), slope: (fn(query + 1e-5) - fn(query - 1e-5)) / 2e-5, discrepancy: cubic(query) - linear(query) }, series: samples(-0.5, 3.5, x => ({ y: fn(x), reference: alternate(x), ...(Math.abs(x - Math.round(x)) < 1e-10 && x >= 0 && x <= 3 ? { sample: values[Math.round(x)] } : {}) })), warnings: query < 0 || query > 3 ? ['The evaluation point is outside the data interval: this is extrapolation.'] : [], table: table('Prescribed interpolation nodes', ['x', 'y'], values.map((v, i) => [i, v])), visualization: { type: 'interpolation', values, query, value: fn(query), detail: `${method} · data interval [0, 3]` } };
    }),
  montecarlo: lab({ id: 'montecarlo', title: 'Monte Carlo Area & π', discipline: 'computational', lab: 'CE04', topic: 'Sampling & uncertainty',
    inputs: { count: integer('Sample count', 100, 5000, 1000), seed: integer('Random seed', 1, 2147483647, 42) },
    metrics: { estimate: ['Estimated π', ''], error: ['Absolute error', ''], standardError: ['Estimated standard error', ''], inside: ['Points inside quarter circle', ''] }, plot: { x: 'Samples', xUnit: '', y: 'Estimated π', yUnit: '', traces: { y: 'Running estimate', reference: 'π' } },
    text: ['Estimate a quarter-circle area with reproducible pseudorandom samples and a running error.', 'Does doubling the sample count guarantee half the error?', ['No', 'Yes', 'Only with the same seed'], 'Monte Carlo uncertainty typically scales as N⁻½, and individual runs can improve or worsen.',
      'Sample (x,y) uniformly in [0,1]². The fraction with x²+y²≤1 estimates π/4. The same seed and count reproduce the same point cloud.',
      'πhat=4M/N; estimated SE=4√[phat(1−phat)/N], phat=M/N. The cloud displays the first 400 samples; the estimate uses all N.',
      'Deterministic xorshift32 pseudorandom generator for teaching, not cryptography. Standard error is a plug-in estimate, not a guaranteed error bound or a confidence interval.'] },
    ({ count, seed }) => {
      let state = seed >>> 0, inside = 0; const points = [], series = [], stride = Math.max(1, Math.ceil(count / 500));
      const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
      for (let n = 1; n <= count; n++) { const x = random(), y = random(), hit = x * x + y * y <= 1; if (hit) inside++; if (points.length < 400) points.push({ x, y, inside: hit }); if (n === 1 || n % stride === 0 || n === count) series.push({ x: n, y: 4 * inside / n, reference: Math.PI }); }
      const estimate = 4 * inside / count, proportion = inside / count;
      return { summary: { estimate, error: Math.abs(estimate - Math.PI), standardError: 4 * Math.sqrt(proportion * (1 - proportion) / count), inside }, series, visualization: { type: 'montecarlo', points, detail: `First ${points.length} of ${count} seeded samples · green is inside` } };
    }),
  mesh: lab({ id: 'mesh', title: 'Mesh Convergence Study', discipline: 'computational', lab: 'CE05', topic: 'Discretization error',
    inputs: { intervals: integer('Uniform mesh intervals', 4, 80, 12) },
    metrics: { error: ['Maximum nodal error', ''], order: ['Observed order from N to 2N', ''], spacing: ['Mesh spacing', ''] }, plot: { x: 'Position x', xUnit: '', y: 'Solution u', yUnit: '', traces: { y: 'Finite difference', reference: 'Exact sin(πx)' } },
    text: ['Solve a boundary-value problem on successively finer meshes and measure error reduction.', 'For a second-order scheme, halving h should reduce asymptotic error by about what factor?', ['Four', 'Two', 'Eight'], 'An O(h²) error scales by (1/2)² when the mesh spacing halves.',
      'For u″=−π²sin(πx), u(0)=u(1)=0, the exact solution is sin(πx). Centered differences approach second-order convergence.',
      '−ui−1+2ui−ui+1=h²π²sin(πxi). A Thomas tridiagonal solve gives nodal values. p=log2(errorN/error2N).',
      'Uniform one-dimensional grid with exact Dirichlet conditions and a smooth manufactured solution. Maximum error is measured at nodes; this is not a general finite-element mesh estimator.'] },
    ({ intervals: n }) => {
      const error = count => Math.max(...poissonSolution(count).map((v, i) => Math.abs(v - Math.sin(Math.PI * i / count))));
      const values = poissonSolution(n), e = error(n), refined = error(2 * n);
      return { summary: { error: e, order: Math.log2(e / refined), spacing: 1 / n }, series: values.map((y, i) => ({ x: i / n, y, reference: Math.sin(Math.PI * i / n) })), table: table('Coarse / selected / refined grid errors', ['Intervals', 'Spacing', 'Max nodal error'], [Math.max(2, Math.floor(n / 2)), n, 2 * n].map(count => [count, 1 / count, error(count)])), visualization: { type: 'mesh', count: n, values, detail: `${n} intervals · ${n + 1} nodes · fixed zero boundaries` } };
    }),
};

computationalModels.roots.definition.presets = { 'Cosine root bracket': { function: 'cosine', lower: 0, upper: 1, initial: 0.5 }, 'Newton on cubic': { method: 'newton' }, 'Newton zero-derivative warning': { method: 'newton', initial: 1 / Math.sqrt(3) } };
computationalModels.integration.definition.presets = { 'Unstable explicit methods': { rate: 4, step: 1 } };
computationalModels.interpolation.definition.presets = { 'Extrapolation warning': { query: 3.5 } };

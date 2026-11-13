/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  roots: [
    'Inspect every iterate, bracket, and residual instead of trusting an unexplained root.',
    'Why does bisection require a sign-changing bracket?',
    [
      'It preserves a contained root for a continuous function',
      'It guarantees a zero derivative',
      'It removes rounding error',
    ],
    'Each midpoint retains the subinterval whose endpoints bracket a sign change.',
    'The positive root of x³−x−2 is about 1.5213797068. Newton from 1.5 converges ' +
      'quickly; bisection from [1,2] reduces the bracket each iteration.',
    'Bisection: m=(a+b)/2, retain a sign-changing half. Newton: xnext=x−f(x)/f′(x). ' +
      'Stop when |f(x)| ≤ tolerance or the iteration budget is exhausted.',
    'Two fixed continuous teaching functions. Newton can fail or leave the plotted ' +
      'domain; a tiny derivative stops it with a warning. A small residual is the ' +
      'stated stopping criterion, not a universal error bound.',
  ],
  integration: [
    'Compare accuracy and stability for the same differential equation and time step.',
    'Is RK4 automatically stable for any time step?',
    ['No', 'Yes', 'Only if the plot is green'],
    'Explicit RK4 has a finite stability region; a sufficiently large kΔt can still produce divergence.',
    'For y′=−y, y(0)=1, Δt=0.25 s and t=4 s, exact y=e⁻⁴. Euler undershoots; RK4 ' +
      'closely follows the exact curve.',
    'Euler: ynext=yn+h f(t,y). RK4 uses weights (k1+2k2+2k3+k4)/6. For linear decay ' +
      'its amplification is 1−z+z²/2−z³/6+z⁴/24, z=kh.',
    'Scalar linear decay with a shortened final step if needed. Forward Euler ' +
      'requires kh<2 for asymptotic stability; RK4’s negative-real-axis bound is about ' +
      '2.785. Unstable cases remain visible.',
  ],
  interpolation: [
    'Move four data ordinates and compare a local linear fit with a global cubic.',
    'Must a cubic interpolant stay between adjacent data values?',
    ['No', 'Yes', 'Only outside the data range'],
    'A global polynomial can overshoot even while matching every node exactly.',
    'For ordinates [0,1,0,2] at x=[0,1,2,3], the cubic gives 0.4375 at x=1.5; piecewise linear gives 0.5.',
    'Lagrange p(x)=Σ yi Πj≠i (x−xj)/(xi−xj). Piecewise linear uses the bracketing ' +
      'segment; beyond the domain it extends the nearest end segment.',
    'Four fixed, distinct x nodes. Evaluation outside [0,3] is extrapolation and is ' +
      'flagged. The slope is a centered numerical derivative; at linear knots it ' +
      'averages adjacent slopes.',
  ],
  montecarlo: [
    'Estimate a quarter-circle area with reproducible pseudorandom samples and a running error.',
    'Does doubling the sample count guarantee half the error?',
    ['No', 'Yes', 'Only with the same seed'],
    'Monte Carlo uncertainty typically scales as N⁻½, and individual runs can improve or worsen.',
    'Sample (x,y) uniformly in [0,1]². The fraction with x²+y²≤1 estimates π/4. The ' +
      'same seed and count reproduce the same point cloud.',
    'πhat=4M/N; estimated SE=4√[phat(1−phat)/N], phat=M/N. The cloud displays the ' +
      'first 400 samples; the estimate uses all N.',
    'Deterministic xorshift32 pseudorandom generator for teaching, not cryptography. ' +
      'Standard error is a plug-in estimate, not a guaranteed error bound or a ' +
      'confidence interval.',
  ],
  mesh: [
    'Solve a boundary-value problem on successively finer meshes and measure error reduction.',
    'For a second-order scheme, halving h should reduce asymptotic error by about what factor?',
    ['Four', 'Two', 'Eight'],
    'An O(h²) error scales by (1/2)² when the mesh spacing halves.',
    'For u″=−π²sin(πx), u(0)=u(1)=0, the exact solution is sin(πx). Centered ' +
      'differences approach second-order convergence.',
    '−ui−1+2ui−ui+1=h²π²sin(πxi). A Thomas tridiagonal solve gives nodal values. p=log2(errorN/error2N).',
    'Uniform one-dimensional grid with exact Dirichlet conditions and a smooth ' +
      'manufactured solution. Maximum error is measured at nodes; this is not a general ' +
      'finite-element mesh estimator.',
  ],
};

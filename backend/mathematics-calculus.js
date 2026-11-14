import {
  mathLab,
  p,
  integer,
  choice,
  samples,
  linspace,
  sum,
  vectors,
  gridVisual,
} from './math-core.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial);
export const functions = {
  quadratic: { f: (x) => x * x, d: (x) => 2 * x, second: () => 2 },
  sine: { f: Math.sin, d: Math.cos, second: (x) => -Math.sin(x) },
  exponential: { f: Math.exp, d: Math.exp, second: Math.exp },
  cubic: { f: (x) => x * x * x - x, d: (x) => 3 * x * x - 1, second: (x) => 6 * x },
};
const functionField = () =>
  choice(
    'Function',
    { quadratic: 'x²', sine: 'sin(x)', exponential: 'exp(x)', cubic: 'x³ − x' },
    'quadratic',
  );
const topic = 'Calculus & Real Analysis';
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) => mathLab({ topic, ...config }, solve);
export function quadrature(f, a, b, n, method) {
  const h = (b - a) / n;
  return (
    sum(
      Array.from({ length: n }, (_, i) =>
        method === 'trapezoid'
          ? (f(a + i * h) + f(a + (i + 1) * h)) / 2
          : f(a + (i + (method === 'left' ? 0 : method === 'right' ? 1 : 0.5)) * h),
      ),
    ) * h
  );
}
export const calculusModels = {
  mathlimits: make(
    {
      id: 'mathlimits',
      title: 'Limits and ε–δ Visualizer',
      inputs: {
        a: real('Limit point a', -2, 2, 1),
        epsilon: real('Vertical tolerance ε', 0.01, 2, 0.5),
        delta: real('Horizontal radius δ', 0.001, 2, 0.15),
      },
      metrics: {
        limit: ['Limit a²', '1'],
        worst: ['Supremum of |x²−a²| in the δ-window', '1'],
        certified: ['ε–δ condition certified (1=yes)', '1'],
        suggested: ['A sufficient δ for this ε', '1'],
      },
      plot: { x: 'x', y: 'f(x)', xUnit: '', yUnit: '', traces: { y: 'x²', reference: 'Limit a²' } },
      text: {
        description:
          'Choose an ε-band and a δ-window around a quadratic limit; test the entire window analytically.',
        predict: 'Does a successful sampled plot alone prove an ε–δ condition?',
        answers: ['No; the full neighborhood needs a bound', 'Yes', 'Only with 100 samples'],
        explain:
          'For x² the exact supremum is δ(2|a|+δ), so certification does not depend on plot resolution.',
        example: 'At a=1, ε=0.5 and δ=0.15, the supremum is 0.3225 < 0.5.',
        equation: '0<|x−a|<δ ⇒ |x²−a²| ≤ δ(2|a|+δ). Sufficient δ=√(a²+ε)−|a|.',
        limits:
          'Finite quadratic example, not an arbitrary-function theorem prover. Equality of the supremum and ε is permitted because the neighborhood endpoints are excluded.',
      },
    },
    ({ a, epsilon, delta }) => {
      const worst = delta * (2 * Math.abs(a) + delta);
      return {
        summary: {
          limit: a * a,
          worst,
          certified: +(worst <= epsilon),
          suggested: epsilon / (Math.sqrt(a * a + epsilon) + Math.abs(a)),
        },
        series: samples(a - 2, a + 2, (x) => ({ y: x * x, reference: a * a })),
        visualization: { type: 'math-space', kind: 'epsilon', a, epsilon, delta, limit: a * a },
      };
    },
  ),
  mathderivative: make(
    {
      id: 'mathderivative',
      title: 'Secant to Tangent: The Derivative',
      inputs: {
        function: functionField(),
        x: real('Base point x', -2, 2, 1),
        h: real('Secant increment h', 1e-8, 1, 0.5),
      },
      metrics: {
        secant: ['Secant slope', '1'],
        tangent: ['Exact derivative', '1'],
        error: ['Absolute slope error', '1'],
      },
      plot: {
        x: 'x',
        y: 'Function and lines',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Function', reference: 'Tangent', other: 'Secant' },
      },
      text: {
        description: 'Move two points together and compare the secant with the exact tangent.',
        predict: 'For x², what is the secant-slope error when h is halved?',
        answers: ['It halves', 'It quarters', 'It stays fixed'],
        explain: 'The forward secant of x² is 2x+h, so its error is exactly h.',
        example: 'At x=1,h=0.5, x² has secant slope 2.5 and tangent slope 2.',
        equation: 'msec=[f(x+h)−f(x)]/h; mtan=f′(x).',
        limits:
          'Four smooth built-in functions. At very small h, subtractive cancellation can dominate convergence.',
      },
    },
    ({ function: kind, x, h }) => {
      const f = functions[kind],
        secant = (f.f(x + h) - f.f(x)) / h,
        tangent = f.d(x);
      return {
        summary: { secant, tangent, error: Math.abs(secant - tangent) },
        series: samples(x - 1.5, x + 1.5, (t) => ({
          y: f.f(t),
          reference: f.f(x) + tangent * (t - x),
          other: f.f(x) + secant * (t - x),
        })),
        visualization: vectors(
          [
            [x, f.f(x)],
            [x + h, f.f(x + h)],
          ],
          { labels: ['Base point', 'Secant point'] },
        ),
      };
    },
  ),
  mathrules: make(
    {
      id: 'mathrules',
      title: 'Chain, Product and Quotient Rule Explorer',
      inputs: {
        rule: choice(
          'Differentiation rule',
          { chain: 'sin(a x²)', product: 'sin(a x) exp(b x)', quotient: 'sin(a x)/(2+x²)' },
          'chain',
        ),
        a: real('Coefficient a', 0.1, 3, 1),
        b: real('Coefficient b', -1, 1, 1),
        x: real('Evaluation point', -2, 2, 1),
      },
      metrics: {
        value: ['Function value', '1'],
        derivative: ['Analytical derivative', '1'],
        check: ['Central-difference check', '1'],
      },
      plot: {
        x: 'x',
        y: 'Value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Function', reference: 'Derivative' },
      },
      text: {
        description:
          'Inspect each composed function and its analytical derivative, with an independent finite-difference check.',
        predict: 'For sin(a x²), which factor comes from the inner derivative?',
        answers: ['2ax', 'cos(ax²)', 'exp(x)'],
        explain: 'The chain rule multiplies cos(ax²) by the inner derivative 2ax.',
        example: 'For sin(x²) at x=1, f′=2 cos(1)≈1.0806046.',
        equation: '(f∘g)′=(f′∘g)g′; (fg)′=f′g+fg′; (f/g)′=(f′g−fg′)/g².',
        limits:
          'Built-in examples only; the quotient denominator 2+x² stays positive. The finite difference is a numerical check, not a symbolic proof.',
      },
    },
    ({ rule, a, b, x }) => {
      const f = (t) =>
          rule === 'chain'
            ? Math.sin(a * t * t)
            : rule === 'product'
              ? Math.sin(a * t) * Math.exp(b * t)
              : Math.sin(a * t) / (2 + t * t),
        d = (t) =>
          rule === 'chain'
            ? 2 * a * t * Math.cos(a * t * t)
            : rule === 'product'
              ? Math.exp(b * t) * (a * Math.cos(a * t) + b * Math.sin(a * t))
              : (a * Math.cos(a * t) * (2 + t * t) - 2 * t * Math.sin(a * t)) / (2 + t * t) ** 2;
      return {
        summary: { value: f(x), derivative: d(x), check: (f(x + 1e-5) - f(x - 1e-5)) / 2e-5 },
        series: samples(-2, 2, (x) => ({ y: f(x), reference: d(x) })),
      };
    },
  ),
  mathriemann: make(
    {
      id: 'mathriemann',
      title: 'Riemann Sum Convergence',
      inputs: {
        n: integer('Subintervals', 2, 128, 12),
        method: choice(
          'Quadrature rule',
          { left: 'Left', right: 'Right', midpoint: 'Midpoint', trapezoid: 'Trapezoid' },
          'midpoint',
        ),
      },
      metrics: {
        estimate: ['Approximate integral', '1'],
        exact: ['Exact integral', '1'],
        error: ['Absolute error', '1'],
      },
      plot: {
        x: 'Subinterval count',
        y: 'Integral estimate',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Selected rule', reference: 'Exact 1/3' },
      },
      text: {
        description:
          'Compare four rectangle/trapezoid constructions for the area under x² on [0,1].',
        predict: 'How fast does midpoint error decrease asymptotically?',
        answers: ['As 1/n²', 'As 1/n', 'It does not decrease'],
        explain:
          'Midpoint and trapezoid rules are second order for this smooth integrand; endpoint rectangles are first order.',
        example: 'With n=2, midpoint gives 0.3125; the exact integral is 1/3.',
        equation: 'Σ f(ξi)Δx; trapezoid uses [f(xi)+f(xi+1)]Δx/2.',
        limits:
          'Fixed smooth convex integrand x² on [0,1]. The geometry and signed error depend on the rule; this does not establish convergence for arbitrary integrands.',
      },
    },
    ({ n, method }) => {
      const estimate = quadrature((x) => x * x, 0, 1, n, method);
      return {
        summary: { estimate, exact: 1 / 3, error: Math.abs(estimate - 1 / 3) },
        series: linspace(1, n, n - 1).map((x) => ({
          x,
          y: quadrature((t) => t * t, 0, 1, x, method),
          reference: 1 / 3,
        })),
        visualization: { type: 'math-space', kind: 'riemann', n, method },
      };
    },
  ),
  mathftc: make(
    {
      id: 'mathftc',
      title: 'Fundamental Theorem of Calculus',
      inputs: {
        x: real('Upper integration limit x', -3, 3, 1),
        h: real('Difference-check increment', 0.0001, 0.2, 0.01),
      },
      metrics: {
        area: ['Signed accumulated area A(x)', '1'],
        derivative: ['A′(x)=f(x)', '1'],
        check: ['Numerical derivative of A', '1'],
      },
      plot: {
        x: 'Upper limit',
        y: 'Value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'A(x)', reference: 'f(x)' },
      },
      text: {
        description:
          'Connect signed accumulated area with the original integrand as the upper limit moves.',
        predict: 'Can accumulated area decrease while x increases?',
        answers: ['Yes, where f(x)<0', 'No', 'Only if x<0'],
        explain: 'The derivative of signed accumulated area equals f(x), including its sign.',
        example: 'For f(t)=t²−1, A(1)=−2/3 and A′(1)=0.',
        equation: 'A(x)=∫₀ˣ(t²−1)dt=x³/3−x; A′(x)=x²−1.',
        limits:
          'Continuous polynomial integrand. Area is signed; it is not the unsigned geometric area.',
      },
    },
    ({ x, h }) => {
      const A = (t) => t ** 3 / 3 - t;
      return {
        summary: { area: A(x), derivative: x * x - 1, check: (A(x + h) - A(x - h)) / (2 * h) },
        series: samples(-3, 3, (x) => ({ y: A(x), reference: x * x - 1 })),
        visualization: { type: 'math-space', kind: 'area', upper: x },
      };
    },
  ),
  mathtaylor: make(
    {
      id: 'mathtaylor',
      title: 'Taylor Series and Remainder Bound',
      inputs: { x: real('Evaluation x', -3, 3, 1), order: integer('Polynomial order', 0, 16, 4) },
      metrics: {
        approximation: ['Taylor approximation to exp(x)', '1'],
        error: ['Actual absolute error', '1'],
        bound: ['Lagrange remainder bound', '1'],
      },
      plot: {
        x: 'x',
        y: 'Value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Taylor polynomial', reference: 'exp(x)' },
      },
      text: {
        description:
          'Increase the Maclaurin order and compare the actual error with a guaranteed remainder bound.',
        predict: 'Is the Lagrange bound generally equal to the error?',
        answers: ['No, it is an upper bound', 'Always', 'Only for negative x'],
        explain: 'The bound uses the maximum derivative over the interval and can be conservative.',
        example: 'At x=1 and order 4, P₄=2.7083333; error≈0.0099485 and bound=e/120≈0.0226523.',
        equation: 'Pₙ(x)=Σₖ₌₀ⁿ xᵏ/k!; |Rₙ|≤exp(max(0,x)) |x|ⁿ⁺¹/(n+1)!.',
        limits:
          'Maclaurin expansion of exp(x), order ≤16 and |x|≤3. Floating-point rounding remains at high order.',
      },
    },
    ({ x, order }) => {
      const poly = (x) => {
        let term = 1,
          s = 1;
        for (let k = 1; k <= order; k++) {
          term *= x / k;
          s += term;
        }
        return s;
      };
      let fact = 1;
      for (let k = 2; k <= order + 1; k++) fact *= k;
      return {
        summary: {
          approximation: poly(x),
          error: Math.abs(poly(x) - Math.exp(x)),
          bound: (Math.exp(Math.max(0, x)) * Math.abs(x) ** (order + 1)) / fact,
        },
        series: samples(-3, 3, (x) => ({ y: poly(x), reference: Math.exp(x) })),
      };
    },
  ),
  mathpowerseries: make(
    {
      id: 'mathpowerseries',
      title: 'Power Series Radius of Convergence',
      inputs: {
        scale: real('Coefficient scale a', 0.2, 3, 1),
        x: real('Evaluation x', -3, 3, 0.5),
        terms: integer('Terms', 2, 40, 12),
      },
      metrics: {
        radius: ['Radius R', '1'],
        partial: ['Partial sum', '1'],
        ratio: ['Absolute term ratio |ax|', '1'],
        limit: ['Infinite sum inside radius', '1'],
      },
      plot: { x: 'Term index', y: 'Partial sum', xUnit: '', yUnit: '' },
      text: {
        description:
          'Explore the geometric power series and distinguish finite partial sums from convergence.',
        predict: 'Does a finite-looking partial sum at |ax|>1 establish convergence?',
        answers: ['No', 'Yes', 'Only for positive x'],
        explain:
          'The terms fail to tend to zero outside |ax|<1. Both boundary series diverge here.',
        example: 'For a=1,x=0.5 the radius is 1 and the infinite sum is 2.',
        equation: 'Σₖ₌₀∞(ax)ᵏ=1/(1−ax) for |ax|<1; R=1/|a|.',
        limits:
          'Geometric coefficients only. Boundary behavior is explicitly divergent for this family; other power series can behave differently at endpoints.',
      },
    },
    ({ scale, x, terms }) => {
      let s = 0;
      const series = Array.from({ length: terms }, (_, i) => {
        s += (scale * x) ** i;
        return { x: i, y: s };
      });
      return {
        summary: {
          radius: 1 / scale,
          partial: s,
          ratio: Math.abs(scale * x),
          limit: Math.abs(scale * x) < 1 ? 1 / (1 - scale * x) : null,
        },
        series,
        warnings:
          Math.abs(scale * x) >= 1
            ? ['The infinite series diverges; the displayed finite partial sum is not a limit.']
            : [],
      };
    },
  ),
  mathseriestests: make(
    {
      id: 'mathseriestests',
      title: 'Series Convergence Tests',
      inputs: {
        family: choice(
          'Positive-term family',
          { geometric: 'qⁿ', pseries: '1/nᵖ', factorial: 'qⁿ/n!' },
          'pseries',
        ),
        q: real('q', 0.1, 2, 0.7),
        power: real('p', 0.2, 4, 2),
        terms: integer('Displayed terms', 10, 100, 40),
      },
      metrics: {
        partial: ['Displayed partial sum', '1'],
        ratio: ['Last consecutive-term ratio', '1'],
        root: ['Last nth-root value', '1'],
        converges: ['Analytical convergence classification', '1'],
      },
      plot: {
        x: 'n',
        y: 'Value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Term', reference: 'Consecutive ratio', other: 'nth root' },
      },
      text: {
        description:
          'Compare ratio, root and integral-test evidence without mistaking a finite numerical pattern for a proof.',
        predict: 'For 1/nᵖ, does a ratio-test limit of 1 decide convergence?',
        answers: ['No; the integral test decides by p', 'Yes, it converges', 'Yes, it diverges'],
        explain:
          'The ratio and root limits equal 1 for every p-series. The integral converges exactly when p>1.',
        example: 'Σ1/n² converges although its ratio tends to 1; Σ1/n diverges.',
        equation:
          'Ratio/root limits <1 imply absolute convergence, >1 imply divergence. ∫₁∞x⁻ᵖdx converges iff p>1.',
        limits:
          'Three known positive-term families. Classification uses the exact family criterion, not the last displayed ratio; no arbitrary-sequence test engine.',
      },
    },
    ({ family, q, power, terms }) => {
      let s = 0,
        prev = 1,
        term = 1;
      const series = [];
      for (let n = 1; n <= terms; n++) {
        term =
          family === 'geometric' ? q ** n : family === 'pseries' ? n ** -power : (term * q) / n;
        s += term;
        series.push({ x: n, y: term, reference: term / prev, other: term ** (1 / n) });
        prev = term;
      }
      return {
        summary: {
          partial: s,
          ratio: series.at(-1).reference,
          root: series.at(-1).other,
          converges: +(family === 'factorial' || (family === 'geometric' ? q < 1 : power > 1)),
        },
        series,
      };
    },
  ),
  mathrelatedrates: make(
    {
      id: 'mathrelatedrates',
      title: 'Related Rates: Ladder, Cone and Shadow',
      inputs: {
        case: choice(
          'Geometry',
          {
            ladder: 'Sliding ladder',
            cone: 'Filling similar cone',
            shadow: 'Person and lamp shadow',
          },
          'ladder',
        ),
        position: real('Distance x / water height / person distance', 0.1, 4, 3),
        rate: real('Driving rate dx/dt or dh/dt', -0.5, 0.5, 0.2),
      },
      metrics: {
        height: ['Dependent length', '1'],
        dependentRate: ['Dependent rate', '1'],
        factor: ['Local rate multiplier', '1'],
      },
      plot: { x: 'Driving distance', y: 'Dependent rate', xUnit: '', yUnit: '' },
      text: {
        description:
          'Differentiate geometric constraints and inspect how an instantaneous rate depends on the current configuration.',
        predict: 'Why does the top of a sliding ladder move faster near the floor?',
        answers: [
          'The rate contains x/y, which grows as y shrinks',
          'Gravity is included',
          'The ladder gets longer',
        ],
        explain:
          'A fixed-length constraint gives dy/dt=−(x/y)dx/dt; this kinematic model contains no dynamics.',
        example: 'For a 5-unit ladder, x=3,y=4 and dx/dt=0.2 give dy/dt=−0.15.',
        equation: 'Ladder: x²+y²=25. Cone: r=h/2, dV/dt=πh² ḣ/4. Shadow: s=hp x/(H−hp), H=6,hp=2.',
        limits:
          'Fixed geometries and dimensionless consistent length/time units. Cone input rate is water-height rate; output is volume rate. No gravity, friction or flow dynamics.',
      },
    },
    ({ case: kind, position: x, rate }) => {
      const dependent = (x) =>
          kind === 'ladder'
            ? Math.sqrt(25 - x * x)
            : kind === 'cone'
              ? (Math.PI * x ** 3) / 12
              : x / 2,
        factor = (x) =>
          kind === 'ladder'
            ? -x / Math.sqrt(25 - x * x)
            : kind === 'cone'
              ? (Math.PI * x * x) / 4
              : 0.5;
      return {
        summary: { height: dependent(x), dependentRate: factor(x) * rate, factor: factor(x) },
        series: samples(0.1, 4, (x) => ({ y: factor(x) * rate })),
        visualization: vectors(
          kind === 'ladder'
            ? [
                [x, 0],
                [0, dependent(x)],
              ]
            : [
                [0, 0],
                [x, dependent(x)],
              ],
          { labels: ['Constraint origin', 'Configuration'] },
        ),
      };
    },
  ),
  mathlagrange: make(
    {
      id: 'mathlagrange',
      title: 'Lagrange Multipliers: Constrained Optimum',
      inputs: {
        a: real('Objective x-weight a', -3, 3, 1),
        b: real('Objective y-weight b', -3, 3, 2),
        radius: real('Constraint circle radius', 0.1, 3, 1),
      },
      validateValues: ({ a, b }) =>
        a === 0 && b === 0
          ? { key: 'a', message: 'Choose a nonzero objective gradient.' }
          : undefined,
      metrics: {
        maximum: ['Maximum ax+by', '1'],
        minimum: ['Minimum ax+by', '1'],
        lambda: ['Multiplier at maximum', '1'],
      },
      plot: { x: 'Constraint angle θ', y: 'Objective', xUnit: 'rad', yUnit: '' },
      text: {
        description:
          'Find extrema of a linear objective on a circle and inspect parallel constraint/objective gradients.',
        predict: 'At a smooth constrained optimum, how are the gradients related?',
        answers: ['They are parallel', 'They are always perpendicular', 'One must be zero'],
        explain:
          'At an extremum the objective gradient has no component along the constraint tangent.',
        example: 'Maximize x+2y on the unit circle: maximum √5 at (1/√5,2/√5).',
        equation: '∇f=λ∇g, g=x²+y²−R²; xmax=Ra/√(a²+b²), ymax=Rb/√(a²+b²).',
        limits:
          'Nonzero linear objective on a compact circle. These closed-form global extrema do not imply that every Lagrange stationary point in a general problem is a maximum.',
      },
    },
    ({ a, b, radius: R }) => {
      const n = Math.hypot(a, b);
      return {
        summary: { maximum: R * n, minimum: -R * n, lambda: n / (2 * R) },
        series: samples(0, 2 * Math.PI, (x) => ({ y: R * (a * Math.cos(x) + b * Math.sin(x)) })),
        visualization: vectors(
          [
            [(R * a) / n, (R * b) / n],
            [(-R * a) / n, (-R * b) / n],
          ],
          { circle: R, vectors: [[0, 0, a, b]], labels: ['Maximum', 'Minimum'] },
        ),
      };
    },
  ),
  mathgradient: make(
    {
      id: 'mathgradient',
      title: 'Gradient, Level Curves and Directional Derivative',
      inputs: {
        x: real('Point x', -2, 2, 1),
        y: real('Point y', -2, 2, 0.5),
        angle: real('Direction angle θ', -180, 180, 45),
        anisotropy: real('Quadratic y-weight c', 0.2, 4, 2),
      },
      metrics: {
        value: ['f(x,y)', '1'],
        norm: ['Gradient magnitude', '1'],
        directional: ['Directional derivative', '1'],
      },
      plot: { x: 'Direction angle', y: 'Directional derivative', xUnit: 'deg', yUnit: '' },
      text: {
        description:
          'Rotate a unit direction through a quadratic surface and compare its slope with the gradient.',
        predict: 'Which unit direction gives the steepest increase?',
        answers: ['The gradient direction', 'The level-curve tangent', 'The negative gradient'],
        explain:
          'The directional derivative is a dot product, maximized when the unit direction aligns with ∇f.',
        example: 'For f=x²+2y² at (1,0.5), ∇f=(2,2); at 45° the directional derivative is 2√2.',
        equation: '∇f=(2x,2cy), Du f=∇f·(cosθ,sinθ).',
        limits:
          'Smooth positive-definite quadratic surface; direction vectors are normalized by construction. Surface units are mathematical, not physical terrain.',
      },
    },
    ({ x, y, angle, anisotropy: c }) => {
      const g = [2 * x, 2 * c * y],
        d = (a) => g[0] * Math.cos(a) + g[1] * Math.sin(a),
        grid = linspace(-2, 2, 20).map((yy) =>
          linspace(-2, 2, 20).map((xx) => xx * xx + c * yy * yy),
        );
      return {
        summary: {
          value: x * x + c * y * y,
          norm: Math.hypot(...g),
          directional: d((angle * Math.PI) / 180),
        },
        series: samples(-180, 180, (a) => ({ y: d((a * Math.PI) / 180) })),
        visualization: gridVisual(grid, {
          bounds: [-2, 2, -2, 2],
          arrows: [[x, y, ...g]],
          points: [[x, y]],
          caption: 'Quadratic level map and gradient arrow',
        }),
      };
    },
  ),
  mathdoubleintegral: make(
    {
      id: 'mathdoubleintegral',
      title: 'Double Integral: Volume Under a Surface',
      inputs: {
        width: real('Rectangle width', 0.2, 3, 2),
        height: real('Rectangle height', 0.2, 3, 1),
        n: integer('Midpoint cells per direction', 2, 40, 8),
      },
      metrics: {
        estimate: ['Midpoint volume', '1'],
        exact: ['Exact volume', '1'],
        error: ['Absolute error', '1'],
      },
      plot: {
        x: 'Cells per direction',
        y: 'Volume',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Midpoint estimate', reference: 'Exact volume' },
      },
      text: {
        description: 'Build volume columns under z=1+x²+y² over a rectangular domain.',
        predict: 'If the cell width halves in both directions, how many cells are needed?',
        answers: ['Four times as many', 'Twice as many', 'The same number'],
        explain:
          'There are two independent spatial directions, so the grid count grows quadratically.',
        example: 'On [0,2]×[0,1], the exact volume is 16/3.',
        equation: 'V=∫₀ᴴ∫₀ᵂ(1+x²+y²)dxdy=WH(1+W²/3+H²/3).',
        limits:
          'Rectangular domain, smooth positive surface and composite midpoint quadrature. No irregular region or singular integrand.',
      },
    },
    ({ width: W, height: H, n }) => {
      const exact = W * H * (1 + (W * W) / 3 + (H * H) / 3),
        estimate = (k) => W * H * (1 + (W * W + H * H) * (1 / 3 - 1 / (12 * k * k)));
      return {
        summary: { estimate: estimate(n), exact, error: Math.abs(estimate(n) - exact) },
        series: Array.from({ length: n }, (_, i) => ({
          x: i + 1,
          y: estimate(i + 1),
          reference: exact,
        })),
        visualization: gridVisual(
          Array.from({ length: n }, (_, j) =>
            Array.from(
              { length: n },
              (_, i) => 1 + (((i + 0.5) * W) / n) ** 2 + (((j + 0.5) * H) / n) ** 2,
            ),
          ),
          { caption: 'Midpoint column heights', bounds: [0, W, 0, H] },
        ),
      };
    },
  ),
  matharclength: make(
    {
      id: 'matharclength',
      title: 'Arc Length and Curvature of Parametric Curves',
      inputs: {
        a: real('Ellipse horizontal radius', 0.2, 3, 2),
        b: real('Ellipse vertical radius', 0.2, 3, 1),
        angle: real('Inspection parameter θ', 0, 360, 45),
        segments: integer('Polygon segments', 8, 160, 48),
      },
      metrics: {
        length: ['Polygonal full arc length', '1'],
        reference: ['High-resolution Simpson arc length', '1'],
        curvature: ['Curvature at selected θ', '1'],
      },
      plot: { x: 'θ', y: 'Curvature', xUnit: 'rad', yUnit: '' },
      text: {
        description:
          'Compare a polygonal ellipse with an independently integrated arc length and local curvature.',
        predict: 'For a circle of radius R, what is its curvature?',
        answers: ['1/R', 'R', '1/R²'],
        explain: 'Curvature is the rate of turning per unit arc length.',
        example: 'For a=b=2, full length is 4π and curvature is 0.5 everywhere.',
        equation: 'L=∫√(a²sin²t+b²cos²t)dt; κ=ab/(a²sin²t+b²cos²t)³ᐟ².',
        limits:
          'Regular nondegenerate ellipses. Simpson integration uses 2000 subintervals as a numerical reference; polygon length is a lower approximation.',
      },
    },
    ({ a, b, angle, segments: n }) => {
      const speed = (t) => Math.hypot(a * Math.sin(t), b * Math.cos(t)),
        curvature = (t) => (a * b) / speed(t) ** 3,
        h = (2 * Math.PI) / 2000,
        reference =
          (h / 3) *
          sum(
            Array.from(
              { length: 2001 },
              (_, i) => (i === 0 || i === 2000 ? 1 : i % 2 ? 4 : 2) * speed(i * h),
            ),
          ),
        points = linspace(0, 2 * Math.PI, n).map((t) => [a * Math.cos(t), b * Math.sin(t)]);
      return {
        summary: {
          length: sum(
            points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1])),
          ),
          reference,
          curvature: curvature((angle * Math.PI) / 180),
        },
        series: samples(0, 2 * Math.PI, (x) => ({ y: curvature(x) })),
        visualization: {
          type: 'math-space',
          kind: 'trajectory',
          points,
          marker: [a * Math.cos((angle * Math.PI) / 180), b * Math.sin((angle * Math.PI) / 180)],
        },
      };
    },
  ),
  mathdivcurl: make(
    {
      id: 'mathdivcurl',
      title: 'Divergence and Curl of Vector Fields',
      inputs: {
        expansion: real('Radial expansion a', -2, 2, 1),
        rotation: real('Rotation coefficient b', -2, 2, 1),
        radius: real('Test-circle radius', 0.2, 2, 1),
      },
      metrics: {
        divergence: ['Divergence', '1'],
        curl: ['Out-of-plane curl', '1'],
        flux: ['Outward circle flux', '1'],
        circulation: ['Counterclockwise circulation', '1'],
      },
      plot: {
        x: 'Circle angle',
        y: 'Boundary component',
        xUnit: 'rad',
        yUnit: '',
        traces: { y: 'Normal component', reference: 'Tangential component' },
      },
      text: {
        description:
          'Separate radial sources/sinks from circulation in a planar linear vector field.',
        predict: 'Does rigid rotation alone have nonzero divergence?',
        answers: ['No', 'Yes, always positive', 'Yes, always negative'],
        explain: 'Rotation redistributes direction without creating local outward flux.',
        example:
          'F=(x−y,x+y) has divergence 2 and curl 2; unit-circle flux and circulation both equal 2π.',
        equation: 'F=(ax−by,bx+ay); div F=2a; curlz F=2b; flux=2πaR²; circulation=2πbR².',
        limits:
          'Two-dimensional linear field. Curl is its z-component; circle orientation is counterclockwise and the normal points outward.',
      },
    },
    ({ expansion: a, rotation: b, radius: R }) => ({
      summary: {
        divergence: 2 * a,
        curl: 2 * b,
        flux: 2 * Math.PI * a * R * R,
        circulation: 2 * Math.PI * b * R * R,
      },
      series: samples(0, 2 * Math.PI, () => ({ y: a * R, reference: b * R })),
      visualization: {
        type: 'math-space',
        kind: 'field',
        arrows: linspace(-2, 2, 8).flatMap((x) =>
          linspace(-2, 2, 8).map((y) => [x, y, a * x - b * y, b * x + a * y]),
        ),
        circle: R,
      },
    }),
  ),
};

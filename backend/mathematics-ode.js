import {
  mathLab,
  p,
  choice,
  textInput,
  matrix,
  errorFor,
  samples,
  integrate,
  matvec,
  norm,
  traceVisual,
  vectors,
  finite,
} from './math-core.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial);
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) =>
  mathLab({ topic: 'Differential Equations & Dynamical Systems', ...config }, solve);
const time = real('Time horizon', 1, 20, 8);
const trajectory = (rows, extra = {}) =>
  traceVisual(
    rows.map(({ state }) => state.slice(0, 2)),
    extra,
  );
export const odeMathModels = {
  mathdirection: make(
    {
      id: 'mathdirection',
      title: 'Slope (Direction) Fields',
      inputs: {
        equation: choice(
          'Differential equation',
          { linear: 'y′ = x − y', logistic: 'y′ = y(1 − y)' },
          'linear',
        ),
        initial: real('Initial y at x = 0', -2, 2, 1),
        horizon: real('Right endpoint', 0.5, 3, 2),
      },
      validateValues: (v) =>
        v.equation === 'logistic' &&
        v.initial < 0 &&
        v.horizon >= Math.log((1 - v.initial) / -v.initial)
          ? {
              key: 'horizon',
              message:
                'This negative logistic initial value has a finite-time pole inside the requested interval. Shorten the right endpoint.',
            }
          : undefined,
      metrics: { final: ['Final y', '1'], slope: ['Final slope', '1'] },
      plot: { x: 'x', y: 'y', xUnit: '', yUnit: '' },
      text: {
        description:
          'Compare local direction arrows with a fourth-order Runge–Kutta solution through the chosen initial point.',
        predict: 'Does a direction field determine one solution without an initial condition?',
        answers: ['No, it describes a family of solutions', 'Yes', 'Only for positive slopes'],
        explain:
          'An initial point selects an integral curve where local existence and uniqueness apply.',
        example: 'For y′=x−y and y(0)=1, y=x−1+2e⁻ˣ.',
        equation: 'dy/dx=f(x,y); RK4 approximates the selected integral curve.',
        limits:
          'Two smooth scalar examples on a finite interval. Logistic solutions from negative initial values may have a pole; trajectories beyond magnitude 10¹⁰ are rejected.',
      },
    },
    ({ equation, initial, horizon }) => {
      const f = (x, y) => (equation === 'linear' ? x - y : y * (1 - y)),
        rows = integrate((x, [y]) => [f(x, y)], [initial], horizon, 600),
        last = rows.at(-1),
        points = rows.map((r) => [r.t, r.state[0]]),
        arrows = [];
      for (let x = 0; x <= horizon; x += horizon / 12)
        for (let y = -2; y <= 3; y += 0.5) {
          const d = f(x, y),
            s = 0.1 / Math.hypot(1, d);
          arrows.push([x, y, x + s, y + s * d]);
        }
      return {
        summary: { final: last.state[0], slope: f(horizon, last.state[0]) },
        series: rows.map((r) => ({ x: r.t, y: r.state[0] })),
        visualization: vectors(points, { lines: [points], arrows }),
      };
    },
  ),
  mathintegrating: make(
    {
      id: 'mathintegrating',
      title: 'First-Order Linear ODE: Integrating Factor',
      inputs: {
        a: real('Decay coefficient a', 0, 3, 1),
        b: real('Forcing b', -3, 3, 2),
        initial: real('Initial y', -3, 3, 0),
        horizon: time,
      },
      metrics: {
        final: ['Final response', '1'],
        equilibrium: ['Equilibrium (a > 0)', '1'],
        factor: ['Integrating factor at endpoint', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Response',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Exact solution', reference: 'Equilibrium' },
      },
      text: {
        description:
          'Multiply a linear equation by eᵃᵗ and see the transient approach its forced equilibrium.',
        predict: 'If a=0 and b is nonzero, is there a finite equilibrium?',
        answers: ['No, the solution ramps', 'Yes, b/a', 'Yes, zero'],
        explain: 'With a=0 the equation reduces to y′=b.',
        example: 'y′+y=2, y(0)=0 gives y=2(1−e⁻ᵗ).',
        equation: '(eᵃᵗy)′=beᵃᵗ; y=y₀e⁻ᵃᵗ+(b/a)(1−e⁻ᵃᵗ).',
        limits:
          'Constant coefficients and forcing; the a=0 limit is evaluated separately. Time is in seconds, coefficients use compatible reciprocal-time units.',
      },
    },
    ({ a, b, initial, horizon }) => {
      const y = (t) =>
        a ? initial * Math.exp(-a * t) + (b * -Math.expm1(-a * t)) / a : initial + b * t;
      return {
        summary: {
          final: y(horizon),
          equilibrium: a ? b / a : null,
          factor: Math.exp(a * horizon),
        },
        series: samples(0, horizon, (t) => ({ y: y(t), reference: a ? b / a : null })),
      };
    },
  ),
  mathphase: make(
    {
      id: 'mathphase',
      title: 'Phase Portraits of Linear Systems',
      inputs: {
        matrix: textInput(
          'System matrix A',
          '[[-0.5,-2],[2,-0.5]]',
          400,
          'Real 2×2 JSON matrix; entries bounded by 4.',
        ),
        x: real('Initial x', -2, 2, 1),
        y: real('Initial y', -2, 2, 0),
        horizon: real('Time horizon', 1, 5, 4),
      },
      validateValues: errorFor('matrix', (v) => {
        if (
          matrix(v.matrix)
            .flat()
            .some((x) => Math.abs(x) > 4)
        )
          throw new Error('Keep matrix entries between −4 and 4 for this finite portrait.');
      }),
      metrics: {
        trace: ['Trace', '1/s'],
        determinant: ['Determinant', '1/s²'],
        discriminant: ['Eigenvalue discriminant', '1/s²'],
        distance: ['Final distance from origin', '1'],
      },
      plot: {
        x: 'Time',
        y: 'State',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'x(t)', reference: 'y(t)' },
      },
      text: {
        description:
          'Explore nodes, saddles, spirals and centers with an editable linear system and a phase-plane trajectory.',
        predict: 'What does a negative determinant imply?',
        answers: ['A saddle with opposite-sign real eigenvalues', 'A stable node', 'A center'],
        explain:
          'The eigenvalue product is the determinant, so a negative product gives one positive and one negative real eigenvalue.',
        example: 'A=[[-0.5,−2],[2,−0.5]] spirals inward with eigenvalues −0.5±2i.',
        equation: 'z′=Az; λ²−tr(A)λ+det(A)=0.',
        limits:
          'Finite-horizon RK4 with 1200 uniform steps. A bounded picture is not a proof of asymptotic stability; zero real parts and defective matrices need separate interpretation.',
      },
    },
    ({ matrix: source, x, y, horizon }) => {
      const A = matrix(source),
        rows = integrate((_t, z) => matvec(A, z), [x, y], horizon),
        tr = A[0][0] + A[1][1],
        det = A[0][0] * A[1][1] - A[0][1] * A[1][0],
        disc = tr * tr - 4 * det;
      const classification =
        det < 0
          ? 'Saddle'
          : det === 0
            ? 'Zero eigenvalue / degenerate'
            : disc < 0
              ? tr < 0
                ? 'Stable spiral'
                : tr > 0
                  ? 'Unstable spiral'
                  : 'Center'
              : tr < 0
                ? 'Stable real eigenvalues'
                : tr > 0
                  ? 'Unstable real eigenvalues'
                  : 'Degenerate';
      return {
        summary: {
          trace: tr,
          determinant: det,
          discriminant: disc,
          distance: norm(rows.at(-1).state),
        },
        series: rows.map((r) => ({ x: r.t, y: r.state[0], reference: r.state[1] })),
        visualization: trajectory(rows, { caption: classification }),
        warnings: [classification],
      };
    },
  ),
  mathpredator: make(
    {
      id: 'mathpredator',
      title: 'Lotka–Volterra Predator–Prey',
      inputs: {
        alpha: real('Prey growth α', 0.2, 2, 1),
        beta: real('Predation β', 0.2, 2, 1),
        gamma: real('Predator loss γ', 0.2, 2, 1),
        delta: real('Predator conversion δ', 0.2, 2, 1),
        prey: real('Initial prey', 0.2, 3, 1.5),
        predator: real('Initial predators', 0.2, 3, 1),
        horizon: time,
      },
      metrics: {
        prey: ['Final prey density', '1'],
        predator: ['Final predator density', '1'],
        drift: ['Maximum invariant drift', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Population density',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Prey', reference: 'Predators' },
      },
      text: {
        description:
          'Follow coupled population cycles and use the conserved quantity to monitor integration error.',
        predict: 'Where is the positive coexistence equilibrium?',
        answers: ['(γ/δ, α/β)', '(α/β, γ/δ)', 'At the origin only'],
        explain: 'Both growth rates vanish at those positive densities.',
        example: 'At α=β=γ=δ=1, (1,1) is an equilibrium; (1.5,1) produces an orbit around it.',
        equation: 'x′=αx−βxy; y′=δxy−γy; H=δx−γln x+βy−αln y.',
        limits:
          'Deterministic continuous densities without carrying capacity or demographic noise. RK4 is not positivity-preserving for arbitrary steps; this bounded parameter range uses 4000 steps.',
      },
    },
    ({ alpha, beta, gamma, delta, prey, predator, horizon }) => {
      const rows = integrate(
          (_t, [x, y]) => [x * (alpha - beta * y), y * (delta * x - gamma)],
          [prey, predator],
          horizon,
          4000,
        ),
        H = (state) =>
          delta * state[0] -
          gamma * Math.log(state[0]) +
          beta * state[1] -
          alpha * Math.log(state[1]),
        h0 = H([prey, predator]);
      return {
        summary: {
          prey: rows.at(-1).state[0],
          predator: rows.at(-1).state[1],
          drift: Math.max(...rows.map((r) => Math.abs(H(r.state) - h0))),
        },
        series: rows
          .filter((_r, i) => i % 5 === 0)
          .map((r) => ({ x: r.t, y: r.state[0], reference: r.state[1] })),
        visualization: trajectory(
          rows.filter((_r, i) => i % 5 === 0),
          { markers: [[gamma / delta, alpha / beta]] },
        ),
      };
    },
  ),
  mathharvesting: make(
    {
      id: 'mathharvesting',
      title: 'Logistic Growth, Harvesting and Bifurcation',
      inputs: {
        rate: real('Growth rate r', 0.1, 2, 1),
        capacity: real('Carrying capacity K', 1, 10, 4),
        harvest: real('Constant harvest H', 0, 6, 0.5),
        initial: real('Initial population', 0.1, 10, 3),
        horizon: real('Time horizon', 1, 40, 20),
      },
      metrics: {
        critical: ['Critical harvest rK/4', '1/s'],
        lower: ['Unstable positive equilibrium', '1'],
        upper: ['Stable positive equilibrium', '1'],
        final: ['Final population', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Population',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Population', reference: 'Stable equilibrium', other: 'Unstable equilibrium' },
      },
      text: {
        description:
          'Increase a constant harvest through a saddle-node threshold and inspect finite-time extinction.',
        predict: 'What happens to the two positive equilibria above H=rK/4?',
        answers: ['They disappear', 'They move farther apart', 'They exchange stability'],
        explain: 'The equilibrium quadratic has a negative discriminant above the threshold.',
        example: 'r=1,K=4,H=0.5 gives equilibria 2±√2.',
        equation: 'N′=rN(1−N/K)−H; N±=K(1±√(1−4H/(rK)))/2.',
        limits:
          'Population is held at zero after the first extinction event, rather than integrating to negative populations. Constant harvesting ceases at extinction. Euler substeps of at most 0.002 s are used.',
      },
    },
    ({ rate, capacity, harvest, initial, horizon }) => {
      const d = 1 - (4 * harvest) / (rate * capacity),
        lower = d >= 0 ? (capacity * (1 - Math.sqrt(d))) / 2 : null,
        upper = d >= 0 ? (capacity * (1 + Math.sqrt(d))) / 2 : null,
        steps = Math.ceil(horizon / 0.002),
        stride = Math.ceil(steps / 500),
        series = [];
      let n = initial;
      for (let i = 0; i <= steps; i++) {
        if (i % stride === 0 || i === steps)
          series.push({ x: (i * horizon) / steps, y: n, reference: upper, other: lower });
        if (i < steps)
          n = Math.max(0, n + (horizon / steps) * (rate * n * (1 - n / capacity) - harvest));
      }
      return {
        summary: { critical: (rate * capacity) / 4, lower, upper, final: n },
        series,
        warnings: n === 0 ? ['Population reached the absorbing extinction boundary.'] : [],
      };
    },
  ),
  mathvanderpol: make(
    {
      id: 'mathvanderpol',
      title: 'Van der Pol Limit Cycle',
      inputs: {
        mu: real('Nonlinearity μ', 0, 5, 1),
        x: real('Initial displacement', -3, 3, 0.2),
        v: real('Initial velocity', -3, 3, 0),
        horizon: real('Time horizon', 2, 40, 20),
      },
      metrics: {
        final: ['Final displacement', '1'],
        velocity: ['Final velocity', '1'],
        amplitude: ['Maximum observed |x|', '1'],
      },
      plot: {
        x: 'Time',
        y: 'State',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Displacement', reference: 'Velocity' },
      },
      text: {
        description:
          'Watch amplitude-dependent damping form a self-sustained oscillation in the phase plane.',
        predict: 'For μ>0, is damping near the origin dissipative?',
        answers: [
          'No, it supplies energy',
          'Yes, it always removes energy',
          'It is zero everywhere',
        ],
        explain:
          'The velocity coefficient μ(1−x²) is positive when |x|<1, pumping energy into small oscillations.',
        example: 'At μ=0, x″+x=0 and the phase orbits are circles.',
        equation: 'x′=v; v′=μ(1−x²)v−x.',
        limits:
          'Finite-time RK4 at step ≤0.005. Maximum observed amplitude is not an exact limit-cycle amplitude or a proven asymptotic result.',
      },
    },
    ({ mu, x, v, horizon }) => {
      const rows = integrate(
          (_t, [a, b]) => [b, mu * (1 - a * a) * b - a],
          [x, v],
          horizon,
          Math.ceil(horizon / 0.005),
        ),
        thin = rows.filter((_r, i) => i % 10 === 0),
        last = rows.at(-1).state;
      return {
        summary: {
          final: last[0],
          velocity: last[1],
          amplitude: Math.max(...rows.map((r) => Math.abs(r.state[0]))),
        },
        series: thin.map((r) => ({ x: r.t, y: r.state[0], reference: r.state[1] })),
        visualization: trajectory(thin),
      };
    },
  ),
  mathlorenz: make(
    {
      id: 'mathlorenz',
      title: 'Lorenz Attractor and Sensitive Dependence',
      inputs: {
        sigma: real('σ', 5, 15, 10),
        rho: real('ρ', 5, 35, 28),
        beta: real('β', 1, 4, 8 / 3),
        perturbation: real('Initial x perturbation', 1e-8, 0.01, 0.0001),
        horizon: real('Time horizon', 2, 30, 20),
      },
      metrics: {
        separation: ['Final trajectory separation', '1'],
        maximum: ['Maximum observed separation', '1'],
        steps: ['RK4 steps per trajectory', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Separation',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Euclidean separation' },
      },
      text: {
        description:
          'Integrate neighboring initial states and compare their separation with an x–z projection of the attractor.',
        predict: 'Does a numerical divergence alone prove mathematical chaos?',
        answers: ['No', 'Yes', 'Only if the curve looks irregular'],
        explain:
          'Finite-step trajectories also reflect numerical error; chaotic dynamics require stronger analysis such as Lyapunov exponents.',
        example: 'The classical parameters are σ=10,ρ=28,β=8/3.',
        equation: 'x′=σ(y−x); y′=x(ρ−z)−y; z′=xy−βz.',
        limits:
          'RK4 with step ≤0.005 and finite horizon. The diagram projects three dimensions onto x–z and cannot resolve crossings in 3D; no Lyapunov exponent is inferred.',
      },
    },
    ({ sigma, rho, beta, perturbation, horizon }) => {
      const f = (_t, [x, y, z]) => [sigma * (y - x), x * (rho - z) - y, x * y - beta * z],
        steps = Math.ceil(horizon / 0.005),
        a = integrate(f, [1, 1, 1], horizon, steps),
        b = integrate(f, [1 + perturbation, 1, 1], horizon, steps),
        series = a
          .filter((_r, i) => i % 10 === 0)
          .map((r) => {
            const i = Math.round((r.t * steps) / horizon);
            return { x: r.t, y: norm(r.state.map((v, j) => v - b[i].state[j])) };
          });
      return {
        summary: {
          separation: norm(a.at(-1).state.map((v, j) => v - b.at(-1).state[j])),
          maximum: Math.max(...series.map((r) => r.y)),
          steps,
        },
        series,
        visualization: traceVisual(
          a.filter((_r, i) => i % 5 === 0).map((r) => [r.state[0], r.state[2]]),
          {
            lines: [b.filter((_r, i) => i % 5 === 0).map((r) => [r.state[0], r.state[2]])],
            caption: 'x–z projection; blue: original, green: perturbed',
          },
        ),
      };
    },
  ),
  mathlaplace: make(
    {
      id: 'mathlaplace',
      title: 'Laplace Transform Solution of ODEs',
      inputs: {
        omega: real('Natural frequency ω', 0.5, 5, 2),
        zeta: real('Damping ratio ζ', 0, 2, 0.3),
        horizon: real('Time horizon', 1, 15, 8),
      },
      metrics: {
        dc: ['Steady-state unit-step value', '1'],
        real: ['Pole real part / slow real pole', '1/s'],
        imaginary: ['Pole imaginary magnitude', '1/s'],
        final: ['Response at endpoint', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Unit-step response',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Response', reference: 'Input step' },
      },
      text: {
        description:
          'Connect poles and partial-fraction regimes with exact inverse-transform step responses.',
        predict: 'What happens to the complex poles as ζ reaches one?',
        answers: [
          'They coalesce into a repeated real pole',
          'They cross into the right half-plane',
          'They vanish',
        ],
        explain: 'The characteristic roots are −ζω±ω√(ζ²−1).',
        example: 'At ζ=1 and ω=2, y=1−e⁻²ᵗ(1+2t).',
        equation: 'Y(s)=ω²/[s(s²+2ζωs+ω²)], with y(0)=y′(0)=0.',
        limits:
          'A second-order constant-coefficient system with unit DC gain and zero initial conditions. The undamped case oscillates forever, so its steady-state limit does not exist.',
      },
    },
    ({ omega, zeta, horizon }) => {
      const y = (t) => {
        if (Math.abs(zeta - 1) < 1e-9) return 1 - Math.exp(-omega * t) * (1 + omega * t);
        if (zeta < 1) {
          const d = omega * Math.sqrt(1 - zeta * zeta);
          return (
            1 -
            Math.exp(-zeta * omega * t) * (Math.cos(d * t) + ((zeta * omega) / d) * Math.sin(d * t))
          );
        }
        const d = Math.sqrt(zeta * zeta - 1),
          a = -omega / (zeta + d),
          b = -omega * (zeta + d);
        return 1 + (b * Math.exp(a * t) - a * Math.exp(b * t)) / (a - b);
      };
      return {
        summary: {
          dc: zeta ? 1 : null,
          real: zeta <= 1 ? -zeta * omega : -omega / (zeta + Math.sqrt(zeta * zeta - 1)),
          imaginary: zeta < 1 ? omega * Math.sqrt(1 - zeta * zeta) : 0,
          final: y(horizon),
        },
        series: samples(0, horizon, (t) => ({ y: y(t), reference: 1 })),
        warnings: zeta === 0 ? ['Undamped response has no final-value limit.'] : [],
      };
    },
  ),
  mathstiff: make(
    {
      id: 'mathstiff',
      title: 'Stiff ODE: Explicit vs. Implicit Euler',
      inputs: {
        lambda: real('Stiffness λ', 1, 200, 50),
        step: real('Step size h', 0.005, 0.2, 0.05),
        horizon: real('Time horizon', 1, 5, 2),
      },
      metrics: {
        stability: ['λh (explicit stability needs <2)', '1'],
        explicit: ['Final explicit absolute error', '1'],
        implicit: ['Final implicit absolute error', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Response',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Explicit Euler', reference: 'Implicit Euler', other: 'Exact cos(t)' },
      },
      text: {
        description:
          'Compare an explicit stability restriction with an A-stable backward step on the same forced stiff equation.',
        predict: 'Does implicit Euler remove time-discretization error?',
        answers: ['No, stability does not imply accuracy', 'Yes', 'Only for stiff problems'],
        explain:
          'Backward Euler remains first order even though it damps stiff modes for any positive step.',
        example: 'At λ=50,h=0.05, λh=2.5 exceeds the explicit stability interval.',
        equation: 'y′=−λ(y−cos t)−sin t, y(0)=1; backward yₙ₊₁=(yₙ+hλcos tₙ₊₁−h sin tₙ₊₁)/(1+hλ).',
        limits:
          'The exact solution is cos(t). Explicit values above magnitude 10⁸ are omitted with a warning; this is a divergence cutoff, not a clipped solution. The final step is shortened to hit the endpoint.',
      },
    },
    ({ lambda, step, horizon }) => {
      let t = 0,
        a = 1,
        b = 1,
        stopped = false;
      const series = [{ x: 0, y: 1, reference: 1, other: 1 }];
      while (t < horizon - 1e-12) {
        const h = Math.min(step, horizon - t),
          next = t + h;
        if (!stopped) {
          a += h * (-lambda * (a - Math.cos(t)) - Math.sin(t));
          if (!Number.isFinite(a) || Math.abs(a) > 1e8) stopped = true;
        }
        b = (b + h * lambda * Math.cos(next) - h * Math.sin(next)) / (1 + h * lambda);
        t = next;
        series.push({ x: t, y: stopped ? null : finite(a), reference: b, other: Math.cos(t) });
      }
      return {
        summary: {
          stability: lambda * step,
          explicit: stopped ? null : Math.abs(a - Math.cos(horizon)),
          implicit: Math.abs(b - Math.cos(horizon)),
        },
        series,
        warnings: stopped
          ? ['Explicit integration diverged beyond the display domain.']
          : lambda * step >= 2
            ? ['The nominal explicit step is outside its strict decay stability interval.']
            : [],
      };
    },
  ),
  mathwave: make(
    {
      id: 'mathwave',
      title: 'Wave Equation: String Modes by Separation of Variables',
      inputs: {
        length: p('String length L', 'm', 0.5, 5, 2),
        speed: p('Wave speed c', 'm/s', 0.2, 3, 1),
        first: p('First-mode amplitude', 'm', -2, 2, 1),
        second: p('Second-mode amplitude', 'm', -2, 2, 0.4),
        time: p('Snapshot time', 's', 0, 10, 0),
      },
      metrics: {
        frequency: ['Fundamental frequency', 'Hz'],
        energy: ['Conserved energy (unit linear density)', 'J'],
        peak: ['Maximum sampled displacement', 'm'],
      },
      plot: {
        x: 'Position',
        y: 'Displacement',
        xUnit: 'm',
        yUnit: 'm',
        traces: { y: 'Combined modes', reference: 'First mode', other: 'Second mode' },
      },
      text: {
        description:
          'Superpose two fixed-end string modes and move through their standing-wave motion.',
        predict: 'Can the two modes have different frequencies?',
        answers: ['Yes, ωₙ=nπc/L', 'No', 'Only with damping'],
        explain:
          'Each spatial eigenfunction has its own natural frequency while the linear PDE allows superposition.',
        example: 'For L=2,c=1, the fundamental frequency is 0.25 Hz.',
        equation: 'u(x,t)=A₁sin(πx/L)cos(πct/L)+A₂sin(2πx/L)cos(2πct/L).',
        limits:
          'Ideal taut string, small transverse displacement, fixed ends, zero initial velocity, no damping or dispersion. Energy assumes unit mass per length; amplitudes are illustrative rather than a small-slope validity check.',
      },
    },
    ({ length, speed, first, second, time }) => {
      const series = samples(0, length, (x) => {
        const a =
            first * Math.sin((Math.PI * x) / length) * Math.cos((Math.PI * speed * time) / length),
          b =
            second *
            Math.sin((2 * Math.PI * x) / length) *
            Math.cos((2 * Math.PI * speed * time) / length);
        return { y: a + b, reference: a, other: b };
      });
      return {
        summary: {
          frequency: speed / (2 * length),
          energy:
            ((speed * speed * Math.PI ** 2) / (4 * length)) * (first * first + 4 * second * second),
          peak: Math.max(...series.map((r) => Math.abs(r.y))),
        },
        series,
        visualization: traceVisual(
          series.map((r) => [r.x, r.y]),
          { caption: `String shape at t=${time} s; fixed ends` },
        ),
      };
    },
  ),
};

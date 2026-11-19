import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  logspace,
  teaching,
  output,
  trajectory,
  bisect,
  C,
  add,
  sub,
  mul,
  div,
  abs,
  polar,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'control', topic: 'Control design & estimation', ...config }, solve);
/** Polynomial roots by simultaneous Durand–Kerner, descending real coefficients. */
export function polynomialRoots(coefficients) {
  const n = coefficients.length - 1,
    scale = coefficients[0],
    a = coefficients.map((v) => v / scale),
    r = 1 + Math.max(...a.slice(1).map(Math.abs));
  let roots = Array.from({ length: n }, (_, i) => polar(r, (2 * Math.PI * (i + 0.17)) / n));
  for (let k = 0; k < 300; k++) {
    let change = 0;
    const next = roots.map((z, i) => {
      let value = C(a[0]);
      for (const c of a.slice(1)) value = add(mul(value, z), C(c));
      let denominator = C(1);
      roots.forEach((w, j) => {
        if (i !== j) denominator = mul(denominator, sub(z, w));
      });
      if (abs(denominator) < 1e-25) return z;
      const d = div(value, denominator);
      change = Math.max(change, abs(d));
      return sub(z, d);
    });
    roots = next;
    if (change < 1e-11) break;
  }
  return roots;
}
export const doubleIntegratorGains = (q1, q2, r) => [
  Math.sqrt(q1 / r),
  Math.sqrt((q2 + 2 * Math.sqrt(q1 * r)) / r),
];
export function mpcPlan(x, target, horizon, penalty, bound, iterations = 500) {
  const u = Array(horizon).fill(0),
    step = 0.9 / (2 * (horizon * horizon + penalty));
  let residual = 0;
  for (let k = 0; k < iterations; k++) {
    let state = x;
    const errors = u.map((v) => {
        state += v;
        return state - target;
      }),
      gradient = Array(horizon);
    let sum = 0;
    for (let j = horizon - 1; j >= 0; j--) {
      sum += errors[j];
      gradient[j] = 2 * (sum + penalty * u[j]);
    }
    residual = 0;
    for (let j = 0; j < horizon; j++) {
      const next = Math.max(-bound, Math.min(bound, u[j] - step * gradient[j]));
      residual = Math.max(residual, Math.abs(next - u[j]));
      u[j] = next;
    }
  }
  return { u, residual };
}
export const controlStudyModels = {
  rootlocus3: make(
    {
      id: 'rootlocus3',
      title: 'Root Locus of a Third-Order System',
      inputs: {
        first: p('First real pole magnitude a', 's⁻¹', 0.2, 6, 1),
        second: p('Second real pole magnitude b', 's⁻¹', 0.2, 8, 2),
        gain: p('Unity-feedback loop gain K', 's⁻³', 0.001, 100, 3),
      },
      metrics: {
        abscissa: ['Rightmost closed-loop real part', 's⁻¹'],
        critical: ['Routh stability gain limit', 's⁻³'],
        stable: ['Strictly stable', 'boolean'],
      },
      plot: {
        x: 'Loop gain K',
        xUnit: 's⁻³',
        y: 'Pole real part',
        yUnit: 's⁻¹',
        traces: { y: 'Largest real part', reference: 'Smallest real part' },
      },
      text: teaching(
        'Solve all three roots of the unity-feedback characteristic polynomial while sweeping positive loop gain.',
        'Does arbitrarily large proportional gain preserve stability?',
        ['No, a conjugate pair crosses right', 'Yes', 'Only the zero pole moves'],
        'The cubic Routh condition is K<ab(a+b).',
        'For a=1,b=2 the boundary is K=6, with poles −3 and ±j√2.',
        's³+(a+b)s²+ab s+K=0; stable for 0<K<ab(a+b).',
        'Plant G=K/[s(s+a)(s+b)], unity negative feedback, positive gain. Numerically solved roots are shown; no unmodeled delay or saturation.',
      ),
    },
    (a) => {
      const limit = a.first * a.second * (a.first + a.second),
        roots = (k) => polynomialRoots([1, a.first + a.second, a.first * a.second, k]),
        r = roots(a.gain),
        s = seq(0.001, Math.max(limit * 2, a.gain), 180).map((x) => {
          const p = roots(x);
          return {
            x,
            y: Math.max(...p.map((v) => v.re)),
            reference: Math.min(...p.map((v) => v.re)),
          };
        });
      return output(
        { abscissa: Math.max(...r.map((v) => v.re)), critical: limit, stable: +(a.gain < limit) },
        s,
        'root-locus',
        {
          branches: seq(0.001, Math.max(limit * 2, a.gain), 180).map((k) =>
            roots(k).map((v) => [v.re, v.im]),
          ),
          poles: r.map((v) => [v.re, v.im]),
        },
      );
    },
  ),
  loopmargins: make(
    {
      id: 'loopmargins',
      title: 'Gain and Phase Margin from Loop Bode Plot',
      inputs: {
        gain: p('Integrator gain', 's⁻¹', 0.05, 30, 2),
        first: p('First corner frequency', 'rad/s', 0.2, 10, 1),
        second: p('Second corner frequency', 'rad/s', 0.2, 20, 5),
      },
      metrics: {
        gain: ['Gain margin', 'dB'],
        phase: ['Phase margin', '°'],
        crossover: ['Gain crossover', 'rad/s'],
      },
      plot: {
        xScale: 'log',
        traceUnits: { reference: '°' },
        x: 'Angular frequency',
        xUnit: 'rad/s',
        y: 'Loop magnitude',
        yUnit: 'dB',
        traces: { y: 'Magnitude (dB)', reference: 'Unwrapped phase (degrees)' },
      },
      text: teaching(
        'Locate gain and phase crossovers by solving the loop response rather than choosing the closest plotted sample.',
        'Does a negative gain margin predict stable unity feedback here?',
        ['No', 'Yes', 'Only at low frequency'],
        'For this minimum-phase three-pole loop, the −180° crossover lies above unity magnitude when the gain margin is negative.',
        'For a=1,b=5,K=2, phase crossover is √5 rad/s and gain margin is 20log10(6/2)=9.5424 dB.',
        'L(s)=K/[s(1+s/a)(1+s/b)]; ωpc=√ab; GM=(a+b)/K; PM=90°−atan(ωgc/a)−atan(ωgc/b).',
        'Continuous minimum-phase loop, no delay and one gain/phase crossover. Magnitude and phase use different units explicitly labeled; frequency axis uses logarithmically spaced samples.',
      ),
    },
    (a) => {
      const magnitude = (w) =>
          a.gain / (w * Math.hypot(1, w / a.first) * Math.hypot(1, w / a.second)),
        gc = bisect((w) => magnitude(w) - 1, 1e-8, 1e5),
        phase = (w) =>
          -90 -
          (Math.atan(w / a.first) * 180) / Math.PI -
          (Math.atan(w / a.second) * 180) / Math.PI;
      return output(
        {
          gain: 20 * Math.log10((a.first + a.second) / a.gain),
          phase: 180 + phase(gc),
          crossover: gc,
        },
        logspace(0.01, 1000).map((x) => ({
          x,
          y: 20 * Math.log10(magnitude(x)),
          reference: phase(x),
        })),
        'bode',
        { crossovers: [gc, Math.sqrt(a.first * a.second)] },
      );
    },
  ),
  poleplacement: make(
    {
      id: 'poleplacement',
      title: 'State-Space Pole Placement',
      inputs: {
        first: p('Desired pole magnitude p₁', 's⁻¹', 0.2, 5, 1),
        second: p('Desired pole magnitude p₂', 's⁻¹', 0.2, 6, 2),
        position: p('Initial position', 'm', -2, 2, 1),
        velocity: p('Initial velocity', 'm/s', -2, 2, 0),
      },
      metrics: {
        k1: ['Position feedback k₁', 's⁻²'],
        k2: ['Velocity feedback k₂', 's⁻¹'],
        settling: ['Last sampled position', 'm'],
      },
      plot: {
        traceUnits: { reference: 'm/s' },
        x: 'Time',
        xUnit: 's',
        y: 'Position',
        yUnit: 'm',
        traces: { y: 'Position', reference: 'Velocity (m/s), separate units' },
      },
      text: teaching(
        'Place both poles of a controllable double integrator and integrate the closed-loop state equations.',
        'What happens to effort when both desired pole magnitudes grow?',
        ['Feedback gains increase', 'Feedback disappears', 'One state becomes uncontrollable'],
        'Matching (s+p₁)(s+p₂) increases both position and velocity gains.',
        'Desired poles −1 and −2 give K=[2,3] for A=[[0,1],[0,0]], B=[0,1]ᵀ.',
        'u=−Kx; k₁=p₁p₂, k₂=p₁+p₂; ẋ=[v,−k₁x−k₂v].',
        'Full noiseless state feedback, normalized unit mass and unlimited actuator. RK4 step ≤0.005 s; the model is a regulator around zero, not arbitrary tracking.',
      ),
    },
    (a) => {
      const k1 = a.first * a.second,
        k2 = a.first + a.second,
        rows = trajectory(
          (_t, [x, v]) => [v, -k1 * x - k2 * v],
          [a.position, a.velocity],
          10,
          4000,
          10,
        ),
        s = rows.map((r) => ({ x: r.t, y: r.state[0], reference: r.state[1] }));
      return output({ k1, k2, settling: s.at(-1).y }, s, 'feedback-state', {
        gains: [k1, k2],
        effort: rows.map((r) => -k1 * r.state[0] - k2 * r.state[1]),
      });
    },
  ),
  lqrtuning: make(
    {
      id: 'lqrtuning',
      title: 'LQR Weight Tuning',
      inputs: {
        position: p('Position cost q₁', '1', 0.01, 100, 1),
        velocity: p('Velocity cost q₂', '1', 0.01, 100, 1),
        effort: p('Control cost r', '1', 0.01, 100, 1),
      },
      metrics: {
        k1: ['Optimal position gain', '1'],
        k2: ['Optimal velocity gain', '1'],
        cost: ['Infinite-horizon optimal cost from x₀=[1,0]', '1'],
        residual: ['Maximum CARE residual', '1'],
      },
      plot: {
        traceUnits: { reference: 'm/s²' },
        x: 'Time',
        xUnit: 's',
        y: 'Position',
        yUnit: 'm',
        traces: { y: 'Position', reference: 'Control (m/s²), separate units' },
      },
      text: teaching(
        'Solve the continuous algebraic Riccati equation for a double integrator and inspect cost versus control effort.',
        'What does increasing r penalize more strongly?',
        ['Actuator effort', 'Position error alone', 'Measurement noise'],
        'LQR balances state deviation against the quadratic control cost.',
        'Q=I and R=1 yield K=[1,√3], P11=√3 and J*=√3 for x₀=[1,0].',
        'Continuous algebraic Riccati equation: AᵀP+PA−PBR⁻¹BᵀP+Q=0; K=[√(q₁/r), √((q₂+2√q₁r)/r)].',
        'Continuous-time unit-mass double integrator, positive diagonal Q and positive scalar R. Infinite-horizon unconstrained regulator; not constrained MPC.',
      ),
    },
    (a) => {
      const [k1, k2] = doubleIntegratorGains(a.position, a.velocity, a.effort),
        p12 = Math.sqrt(a.position * a.effort),
        p22 = a.effort * k2,
        p11 = (p12 * p22) / a.effort,
        residual = Math.max(
          Math.abs(a.position - (p12 * p12) / a.effort),
          Math.abs(p11 - (p12 * p22) / a.effort),
          Math.abs(2 * p12 + a.velocity - (p22 * p22) / a.effort),
        ),
        rows = trajectory((_t, [x, v]) => [v, -k1 * x - k2 * v], [1, 0], 12, 6000, 15);
      return output(
        { k1, k2, cost: p11, residual },
        rows.map((r) => ({ x: r.t, y: r.state[0], reference: -k1 * r.state[0] - k2 * r.state[1] })),
        'feedback-state',
        {
          gains: [k1, k2],
          riccati: [
            [p11, p12],
            [p12, p22],
          ],
        },
      );
    },
  ),
  luenberger: make(
    {
      id: 'luenberger',
      title: 'Luenberger Observer Convergence',
      inputs: {
        first: p('Observer pole magnitude p₁', 's⁻¹', 0.2, 8, 2),
        second: p('Observer pole magnitude p₂', 's⁻¹', 0.2, 10, 3),
        position: p('Initial position estimation error', 'm', -2, 2, 1),
        velocity: p('Initial velocity estimation error', 'm/s', -2, 2, 1),
      },
      metrics: {
        l1: ['Position innovation gain', 's⁻¹'],
        l2: ['Velocity innovation gain', 's⁻²'],
        error: ['Final estimation error norm', '1'],
      },
      plot: {
        traceUnits: { reference: 'm/s' },
        x: 'Time',
        xUnit: 's',
        y: 'Position estimation error',
        yUnit: 'm',
        traces: { y: 'Position error', reference: 'Velocity error (m/s)' },
      },
      text: teaching(
        'Reconstruct double-integrator velocity from measured position using an explicit observer error system.',
        'Can faster observer poles amplify measurement noise?',
        ['Yes', 'No', 'Only if the plant is unstable'],
        'Large innovation gains make convergence faster but also feed measurement errors into the estimate.',
        'Observer poles −2,−3 imply L=[5,6]ᵀ when C=[1,0].',
        'ė=(A−LC)e; ė₁=e₂−l₁e₁, ė₂=−l₂e₁; l₁=p₁+p₂, l₂=p₁p₂.',
        'Noiseless measurement convergence study, known input and exact plant. Faster-pole noise tradeoff is discussed but noise is not injected into this deterministic error trajectory.',
      ),
    },
    (a) => {
      const l1 = a.first + a.second,
        l2 = a.first * a.second,
        rows = trajectory(
          (_t, [x, v]) => [v - l1 * x, -l2 * x],
          [a.position, a.velocity],
          10,
          4000,
          10,
        );
      return output(
        { l1, l2, error: Math.hypot(...rows.at(-1).state) },
        rows.map((r) => ({ x: r.t, y: r.state[0], reference: r.state[1] })),
        'observer',
        { gains: [l1, l2] },
      );
    },
  ),
  zieglernichols: make(
    {
      id: 'zieglernichols',
      title: 'Ziegler–Nichols Ultimate-Gain Tuning',
      inputs: {
        tau: p('Each plant lag time constant', 's', 0.2, 3, 1),
        gain: p('Plant static gain', '1', 0.2, 3, 1),
        controller: choice('Classic tuning table', ['P', 'PI', 'PID'], 'PID'),
      },
      metrics: {
        ultimate: ['Ultimate proportional gain Ku', '1'],
        period: ['Ultimate oscillation period Pu', 's'],
        kp: ['Controller proportional gain', '1'],
        ki: ['Integral gain', 's⁻¹'],
        kd: ['Derivative gain', 's'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Unit-step output',
        yUnit: '1',
        traces: { y: 'Closed-loop output', reference: 'Setpoint' },
      },
      text: teaching(
        'Find the exact ultimate oscillation of a three-equal-lag plant and apply the classic P, PI or PID table.',
        'Does classic Ziegler–Nichols guarantee a gentle, robust transient?',
        ['No, it can be aggressive', 'Yes', 'It removes all overshoot'],
        'The empirical ultimate-cycle tuning often needs detuning and actuator-aware verification.',
        'For G=1/(s+1)³, Ku=8 and Pu=2π/√3≈3.6276 s.',
        'Ku=8/g; Pu=2πτ/√3; PID: Kp=.6Ku, Ti=.5Pu, Td=.125Pu.',
        'Stable equal-lag process g/(τs+1)³ with unity feedback. Derivative acts on measured output to avoid setpoint kick; no saturation, sensor delay or robustness guarantee.',
      ),
    },
    (a) => {
      const Ku = 8 / a.gain,
        Pu = (2 * Math.PI * a.tau) / Math.sqrt(3),
        kp = (a.controller === 'P' ? 0.5 : a.controller === 'PI' ? 0.45 : 0.6) * Ku,
        ki = a.controller === 'P' ? 0 : kp / (a.controller === 'PI' ? Pu / 1.2 : Pu / 2),
        kd = a.controller === 'PID' ? (kp * Pu) / 8 : 0,
        rows = trajectory(
          (_t, [x1, x2, y, I]) => {
            const yd = (x2 - y) / a.tau,
              u = kp * (1 - y) + ki * I - kd * yd;
            return [(a.gain * u - x1) / a.tau, (x1 - x2) / a.tau, yd, 1 - y];
          },
          [0, 0, 0, 0],
          20 * a.tau,
          5000,
          10,
        );
      return output(
        { ultimate: Ku, period: Pu, kp, ki, kd },
        rows.map((r) => ({ x: r.t, y: r.state[2], reference: 1 })),
        'feedback-state',
        { gains: [kp, ki, kd] },
      );
    },
  ),
  constrainedmpc: make(
    {
      id: 'constrainedmpc',
      title: 'Model Predictive Control with a Constrained Horizon',
      inputs: {
        horizon: integer('Prediction steps', 2, 20, 8),
        penalty: p('Move cost λ', '1', 0.05, 10, 0.5),
        bound: p('Maximum move magnitude', '1', 0.02, 1, 0.2),
        target: p('Target state', '1', -2, 2, 1),
      },
      metrics: {
        final: ['State after 30 moves', '1'],
        peak: ['Peak control move magnitude', '1'],
        residual: ['Largest final projected-step residual', '1'],
      },
      plot: {
        x: 'Sample index',
        xUnit: '1',
        y: 'State',
        yUnit: '1',
        traces: {
          y: 'Receding-horizon state',
          reference: 'Target',
          third: 'Applied move (separate units)',
        },
      },
      text: teaching(
        'Solve a finite-horizon box-constrained quadratic program at each sample and apply only its first move.',
        'Why recompute the control sequence after one move?',
        [
          'To use the newly observed state',
          'To ignore constraints',
          'To make the horizon infinite',
        ],
        'Receding-horizon feedback updates the optimizer with current state information.',
        'With |u|≤0.2 and target one from zero, at least five moves are needed to reach the target.',
        'xₖ₊₁=xₖ+uₖ; min Σ(xₖ₊ⱼ−r)²+λΣu²; |u|≤umax.',
        'Scalar discrete integrator, perfect state knowledge, 30 applied moves. Projected gradient solves the condensed convex box QP; residual is a numerical convergence indicator. No state constraints, disturbances or terminal stability guarantee.',
      ),
    },
    (a) => {
      let x = 0,
        residual = 0,
        peak = 0;
      const s = [{ x: 0, y: 0, reference: a.target, third: 0 }],
        plans = [];
      for (let k = 0; k < 30; k++) {
        const plan = mpcPlan(x, a.target, a.horizon, a.penalty, a.bound, 1500);
        residual = Math.max(residual, plan.residual);
        const u = plan.u[0];
        plans.push(plan.u);
        x += u;
        peak = Math.max(peak, Math.abs(u));
        s.push({ x: k + 1, y: x, reference: a.target, third: u });
      }
      return output({ final: x, peak, residual }, s, 'mpc', { plans, bound: a.bound });
    },
  ),
};

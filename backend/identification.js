import { lab, p, integer, textInput, table } from './lab-kit.js';
import { random, normal, parseData } from './numerical-tools.js';
import { solveLinear } from './linear.js';

export function identifyARX(data) {
  const rows = data.slice(1).map((p, i) => ({ x: [data[i].y, data[i].u], y: p.y }));
  const H = [0, 1].map((i) => [0, 1].map((j) => rows.reduce((s, r) => s + r.x[i] * r.x[j], 0)));
  const rhs = [0, 1].map((i) => rows.reduce((s, r) => s + r.x[i] * r.y, 0));
  const scale = Math.max(...H.flat().map(Math.abs), 1);
  if (Math.abs(H[0][0] * H[1][1] - H[0][1] ** 2) / scale ** 2 < 1e-9)
    throw new Error('Insufficient excitation: y and u regressors are rank deficient.');
  const [a, b] = solveLinear(H, rhs);
  const series = data.map((p, i) => ({
    x: i,
    y: i ? a * data[i - 1].y + b * data[i - 1].u : p.y,
    reference: p.y,
  }));
  return {
    summary: {
      a,
      b,
      rmse: Math.sqrt(
        series.slice(1).reduce((s, p) => s + (p.y - p.reference) ** 2, 0) / rows.length,
      ),
    },
    series,
  };
}
export const identificationModels = {
  systemidentification: lab(
    {
      id: 'systemidentification',
      title: 'System Identification: ARX',
      discipline: 'control',
      inputs: {
        a: p('True pole a', '1', 0.01, 0.99, 0.8),
        b: p('True input coefficient b', '1', 0.01, 2, 0.2),
        noise: p('Output process-noise σ', '1', 0, 0.5, 0.02),
        seed: integer('Random seed', 1, 99999, 42),
        data: textInput(
          'Uploaded u,y CSV or generated',
          'generated',
          12000,
          'Header u,y, 4–512 equally spaced rows. y[k]=a y[k−1]+b u[k−1]+ε. Use the CSV upload in Analysis to inspect other model traces.',
        ),
      },
      validateValues({ data }) {
        if (data === 'generated') return;
        try {
          identifyARX(parseData(data, ['u', 'y']));
        } catch (e) {
          return { key: 'data', message: e.message };
        }
      },
      metrics: {
        a: ['Identified pole a', '1'],
        b: ['Identified input coefficient b', '1'],
        rmse: ['One-step prediction RMSE', '1'],
      },
      plot: {
        x: 'Sample',
        xUnit: 'samples',
        y: 'Output',
        yUnit: '1',
        traces: { y: 'One-step prediction', reference: 'Measured' },
      },
      text: [
        'Identify a discrete first-order model from an excited input/output record.',
        'What does a constant input make harder?',
        ['Separating the two coefficients', 'Reading the sample index', 'Nothing'],
        'Persistent excitation is needed for identifiable regressors.',
        'With no noise and a=0.8,b=0.2, a PRBS record recovers both coefficients to floating-point precision.',
        'y[k]=a y[k−1]+b u[k−1]+ε; θ=(XᵀX)⁻¹Xᵀy.',
        'First-order ARX, uniform samples, one-step prediction; no intercept or delay search. Measurement noise on y can bias ordinary least squares. No stability constraint on uploaded fits.',
      ],
    },
    ({ a, b, noise, seed, data }) => {
      if (data !== 'generated') return identifyARX(parseData(data, ['u', 'y']));
      const rng = random(seed),
        rows = [];
      let y = 0,
        u = 1;
      for (let i = 0; i < 160; i++) {
        if (i % 5 === 0) u = rng() > 0.5 ? 1 : -1;
        rows.push({ u, y });
        y = a * y + b * u + noise * normal(rng);
      }
      return identifyARX(rows);
    },
  ),
  kalmanfilter: lab(
    {
      id: 'kalmanfilter',
      title: 'Kalman Filter: Position & Velocity',
      discipline: 'control',
      inputs: {
        noise: p('Measurement noise σ', 'm', 0.01, 5, 1),
        acceleration: p('Assumed acceleration noise σ', 'm/s²', 0.001, 3, 0.2),
        speed: p('True initial speed', 'm/s', 0, 5, 1),
        seed: integer('Random seed', 1, 99999, 42),
      },
      metrics: {
        filtered: ['Filtered position RMSE', 'm'],
        raw: ['Measurement RMSE', 'm'],
        sigma: ['Final position uncertainty σ', 'm'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Position',
        yUnit: 'm',
        traces: { y: 'Filtered', reference: 'True', other: 'Measured' },
      },
      text: [
        'Estimate position and velocity from noisy position observations.',
        'If measurement noise rises, should the filter trust observations more?',
        ['No, less', 'Yes, more', 'It must ignore the model'],
        'Larger R reduces Kalman gain for otherwise fixed covariance.',
        'The state is [position,velocity], Δt=0.1 s, initial covariance diag(10,10). Change the seed to test robustness.',
        'x⁻=Fx; P⁻=FPFᵀ+Q; K=P⁻Hᵀ/(HP⁻Hᵀ+R); x=x⁻+K(z−Hx⁻).',
        'Constant-velocity model with independent discrete white acceleration, known noise variances and Gaussian assumptions. A single seeded record does not establish filter consistency.',
      ],
    },
    ({ noise, acceleration, speed, seed }) => {
      const rng = random(seed),
        dt = 0.1,
        R = noise ** 2,
        q = acceleration ** 2;
      let truth = 0,
        v = speed,
        x = 0,
        vhat = 0,
        P00 = 10,
        P01 = 0,
        P11 = 10,
        raw = 0,
        filtered = 0;
      const series = [];
      for (let i = 0; i <= 200; i++) {
        const a = 0.1 * normal(rng);
        truth += v * dt + 0.5 * a * dt * dt;
        v += a * dt;
        const z = truth + noise * normal(rng);
        x += vhat * dt;
        const A = P00 + 2 * dt * P01 + dt * dt * P11 + (q * dt ** 4) / 4,
          B = P01 + dt * P11 + (q * dt ** 3) / 2,
          C = P11 + q * dt * dt,
          S = A + R,
          k0 = A / S,
          k1 = B / S,
          e = z - x;
        x += k0 * e;
        vhat += k1 * e;
        P00 = (1 - k0) * A;
        P01 = (1 - k0) * B;
        P11 = C - k1 * B;
        raw += (z - truth) ** 2;
        filtered += (x - truth) ** 2;
        series.push({ x: (i + 1) * dt, y: x, reference: truth, other: z });
      }
      return {
        summary: {
          filtered: Math.sqrt(filtered / series.length),
          raw: Math.sqrt(raw / series.length),
          sigma: Math.sqrt(Math.max(0, P00)),
        },
        series,
      };
    },
  ),
  pidautotune: lab(
    {
      id: 'pidautotune',
      title: 'PID Auto-tuning: FOPDT Model',
      discipline: 'control',
      inputs: {
        gain: p('Plant gain K', '1', 0.1, 10, 1),
        tau: p('Plant time constant τ', 's', 0.2, 20, 3),
        delay: p('Transport delay θ', 's', 0, 10, 0.5),
        lambda: p('Closed-loop tuning time λ', 's', 0.2, 20, 2),
        limit: p('Actuator magnitude limit', '1', 0.2, 10, 2),
      },
      metrics: {
        kp: ['Proportional gain Kp', '1'],
        ki: ['Integral gain Ki', '1/s'],
        kd: ['Derivative gain Kd', 's'],
        iae: ['Integral absolute error', 's'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Normalized response',
        yUnit: '1',
        traces: { y: 'Plant response', reference: 'Setpoint', other: 'Actuator' },
      },
      text: [
        'Tune a filtered PID from a supplied first-order-plus-delay plant and test the closed loop.',
        'What does increasing λ generally do?',
        ['Makes tuning less aggressive', 'Increases gain indefinitely', 'Removes delay'],
        'The IMC gain falls as the desired closed-loop time increases.',
        'K=1, τ=3 s, θ=0.5 s, λ=2 s give Kp=1.4444, Ti=3.25 s, Td=0.23077 s.',
        'Kp=(τ+θ/2)/[K(λ+θ/2)]; Ti=τ+θ/2; Td=τθ/(2τ+θ).',
        'IMC-style FOPDT tuning, derivative on measurement with Ti-independent filter Tf=max(Td/10,Δt), conditional integration and saturated actuator. Initial tuning is not a stability or safety guarantee. Delay is rounded to a sample.',
      ],
    },
    ({ gain, tau, delay, lambda, limit }) => {
      const kp = (tau + delay / 2) / (gain * (lambda + delay / 2)),
        Ti = tau + delay / 2,
        Td = (tau * delay) / (2 * tau + delay),
        ki = kp / Ti,
        kd = kp * Td;
      const end = 10 * (tau + delay + lambda),
        dt = Math.min(tau / 100, lambda / 100, end / 1500),
        steps = Math.ceil(end / dt),
        lag = Math.round(delay / dt),
        history = [];
      let y = 0,
        integral = 0,
        old = 0,
        derivative = 0,
        iae = 0;
      const series = [];
      for (let i = 0; i <= steps; i++) {
        const error = 1 - y;
        derivative += (y - old - derivative * dt) / (Math.max(Td / 10, dt) + dt);
        old = y;
        const raw = kp * error + integral - kd * derivative,
          u = Math.max(-limit, Math.min(limit, raw));
        if (Math.abs(raw) <= limit || error * (raw - u) < 0) integral += ki * error * dt;
        history.push(u);
        if (i % Math.max(1, Math.floor(steps / 400)) === 0 || i === steps)
          series.push({ x: i * dt, y, reference: 1, other: u });
        if (i === steps) break;
        const delayed = i - lag >= 0 ? history[i - lag] : 0;
        iae += Math.abs(error) * dt;
        y = y * Math.exp(-dt / tau) + gain * delayed * (1 - Math.exp(-dt / tau));
      }
      return { summary: { kp, ki, kd, iae }, series };
    },
  ),
  tolerancestack: lab(
    {
      id: 'tolerancestack',
      title: 'Tolerance Stack-up: Worst Case & Monte Carlo',
      discipline: 'mechanical',
      inputs: {
        stack: textInput(
          'Signed nominal and ± tolerance pairs',
          '[[50,0.1],[30,0.05],[-20,0.08]]',
          1000,
          'JSON array of [signed nominal mm, positive half-tolerance mm], up to 20 parts. Independent uniform dimensional deviations.',
        ),
        seed: integer('Random seed', 1, 99999, 42),
      },
      validateValues({ stack }) {
        try {
          parseStack(stack);
        } catch (e) {
          return { key: 'stack', message: e.message };
        }
      },
      metrics: {
        nominal: ['Nominal closing dimension', 'mm'],
        worst: ['Worst-case half-width', 'mm'],
        rss: ['RSS half-width (tolerance convention)', 'mm'],
        sigma: ['Uniform-stack standard deviation', 'mm'],
        sampleSigma: ['Monte Carlo standard deviation', 'mm'],
      },
      plot: { x: 'Closing dimension', xUnit: 'mm', y: 'Count', yUnit: 'samples' },
      text: [
        'Compare hard tolerance limits with statistical predictions and 2000 seeded builds.',
        'Is an RSS interval a hard guarantee?',
        ['No', 'Yes', 'Only for three parts'],
        'Independent random deviations may lie outside RSS even when all parts meet tolerance.',
        'The default nominal stack is 60 mm; worst-case half-width is 0.23 mm, RSS≈0.13748 mm, uniform σ≈0.07937 mm.',
        'Worst=ΣTi; RSS=√ΣTi²; σuniform=√(ΣTi²/3).',
        'Independent centered uniform deviations, no correlation or process bias. RSS here uses tolerance half-widths, not a confidence interval. Monte Carlo is an estimate, not a guarantee.',
      ],
    },
    ({ stack, seed }) => {
      const parts = parseStack(stack),
        rng = random(seed),
        nominal = parts.reduce((s, p) => s + p[0], 0),
        worst = parts.reduce((s, p) => s + p[1], 0),
        rss = Math.hypot(...parts.map((p) => p[1]));
      const values = Array.from({ length: 2000 }, () =>
          parts.reduce((s, p) => s + p[0] + (2 * rng() - 1) * p[1], 0),
        ),
        mean = values.reduce((s, v) => s + v, 0) / values.length,
        bins = Array(30).fill(0);
      values.forEach(
        (v) => bins[Math.min(29, Math.floor(((v - nominal + worst) / (2 * worst)) * 30))]++,
      );
      return {
        summary: {
          nominal,
          worst,
          rss,
          sigma: rss / Math.sqrt(3),
          sampleSigma: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length),
        },
        series: bins.map((y, i) => ({ x: nominal - worst + ((i + 0.5) * 2 * worst) / 30, y })),
        table: table('Inputs', ['Nominal (mm)', '± tolerance (mm)'], parts),
      };
    },
  ),
};
function parseStack(source) {
  const parts = JSON.parse(source);
  if (
    !Array.isArray(parts) ||
    !parts.length ||
    parts.length > 20 ||
    parts.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 1e6 ||
        p[1] <= 0 ||
        p[1] > 1000,
    )
  )
    throw new Error(
      'Use 1–20 [nominal,positive tolerance] pairs; nominal ±1e6 mm, tolerance ≤1000 mm.',
    );
  return parts;
}

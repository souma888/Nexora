import { experiment, parameter as p, samples } from './experiment.js';

const response = (wn, zeta, t) => {
  if (Math.abs(zeta - 1) < 1e-7) return 1 - Math.exp(-wn * t) * (1 + wn * t);
  if (zeta < 1) {
    const d = Math.sqrt(1 - zeta ** 2);
    return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wn * d * t) + zeta / d * Math.sin(wn * d * t));
  }
  const d = Math.sqrt(zeta ** 2 - 1);
  const a = -wn * (zeta - d), b = -wn * (zeta + d);
  return 1 + (b * Math.exp(a * t) - a * Math.exp(b * t)) / (a - b);
};
const input = {
  gain: p('Proportional gain', '', 0, 10, 2),
  tau: p('Plant time constant', 's', 0.5, 5, 1),
  reference: p('Setpoint', '', 0.1, 5, 1),
};
function lab(id, title, inputs, text, solve, plot = {}) {
  return experiment(id, {
    title, discipline: 'control', lab: id,
    description: text[0], predict: text[1],
    prediction: [text[2], text[3], text[4]],
    example: text[5], equation: text[6], limits: text[7],
    inputs, metrics: plot.metrics ?? { final: 'Value at end of view', peak: 'Peak in view', error: 'Final tracking error' },
    plot: { title: plot.title ?? 'System response', x: plot.x ?? 'Time', y: plot.y ?? 'Output', traces: plot.traces ?? { y: 'Output', reference: 'Setpoint' } },
    outputs: {
      summary: plot.units ?? { final: plot.yUnit ?? '', peak: plot.yUnit ?? '', error: plot.yUnit ?? '' },
      series: { x: plot.xUnit ?? 's', y: plot.yUnit ?? '', reference: plot.yUnit ?? '', sample: plot.yUnit ?? '', locus: plot.yUnit ?? '' },
    },
  }, solve);
}
const summarize = (series, target = 1) => ({
  series,
  summary: { final: series.at(-1).y, peak: Math.max(...series.map(point => point.y)), error: target - series.at(-1).y },
});

// Fourth-order Runge–Kutta at 2 ms; output is sampled every 20 ms.
function integrate(initial, derivative, duration = 12) {
  let state = [...initial];
  const series = [];
  const h = 0.002;
  const plus = (base, rate, scale) => base.map((value, i) => value + scale * rate[i]);
  for (let n = 0; n <= Math.round(duration / h); n++) {
    if (n % 10 === 0) series.push({ x: n * h, state: [...state] });
    if (n === Math.round(duration / h)) break;
    const k1 = derivative(state, n * h);
    const k2 = derivative(plus(state, k1, h / 2), n * h + h / 2);
    const k3 = derivative(plus(state, k2, h / 2), n * h + h / 2);
    const k4 = derivative(plus(state, k3, h), n * h + h);
    state = state.map((value, i) => value + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
  }
  return series;
}
const clamp = (u, limit) => Math.max(-limit, Math.min(limit, u));

export const controlModels = {
  firstorder: lab('firstorder', 'First-Order Step Response',
    { tau: input.tau, gain: p('Static gain', '', 0.1, 5, 1) },
    ['Explore how a pole sets the rise of a first-order system.', 'After one time constant, how much of the final change has occurred?',
      ['About 37%', 'About 63%', 'About 95%'], 1, 'The completed fraction is 1 − exp(−1).',
      'For gain 1 and τ = 1 s, the output is 0.6321 at 1 s and approaches 1.',
      'G(s) = K/(τs + 1). For a unit step, y(t) = K[1 − exp(−t/τ)].',
      'Zero initial condition, stable linear plant, unit input step. The plot spans five time constants.'],
    ({ tau, gain }) => summarize(samples(0, 5 * tau, x => ({ y: gain * -Math.expm1(-x / tau), reference: gain })), gain)),
  secondorder: lab('secondorder', 'Second-Order Step Response',
    { frequency: p('Natural frequency', 'rad/s', 0.5, 5, 2), damping: p('Damping ratio', '', 0, 2, 0.3) },
    ['Compare underdamped, critical, and overdamped transients.', 'What happens to overshoot as damping rises toward one?',
      ['It grows', 'It disappears', 'It stays fixed'], 1, 'Critical and overdamped unit-gain systems approach the target without overshooting.',
      'At ωn = 2 rad/s and ζ = 0.3, the first peak is approximately 1.372.',
      'G(s) = ωn²/(s² + 2ζωn s + ωn²). The closed-form step solution covers all three damping regimes.',
      'Unit step from rest. The view spans 12/ωn seconds. At zero damping the oscillation never settles.'],
    ({ frequency, damping }) => summarize(samples(0, 12 / frequency, x => ({ y: response(frequency, damping, x), reference: 1 })))),
  pid: lab('pid', 'PID Tuning',
    { kp: p('Proportional Kp', '', 0, 10, 3), ki: p('Integral Ki', '1/s', 0, 5, 1), kd: p('Derivative Kd', 's', 0, 5, 1) },
    ['Tune a PID controller around a second-order plant and inspect overshoot and residual error.', 'Which term removes a constant tracking offset in a stable loop?',
      ['Proportional', 'Integral', 'Derivative'], 1, 'The integral state accumulates error and drives a constant offset toward zero.',
      'Setting all gains to zero leaves the plant at rest. Kp = 3, Ki = 1, Kd = 1 produces a closed-loop response toward one.',
      'y″ + y′ + y = u. e = 1 − y, I′ = e, u = Kp e + Ki I − Kd y′.',
      'Derivative acts on measurement to avoid setpoint kick. This linear model has no actuator limit. RK4 uses a 2 ms step over 12 s.'],
    ({ kp, ki, kd }) => summarize(integrate([0, 0, 0], ([y, v, integral]) =>
      [v, kp * (1 - y) + ki * integral - kd * v - v - y, 1 - y]).map(({ x, state }) => ({ x, y: state[0], reference: 1 })))),
  motor: lab('motor', 'DC Motor Speed Control',
    { gain: p('Speed feedback gain', 'V/(rad/s)', 0, 100, 20), target: p('Target speed', 'rad/s', 0.1, 5, 1) },
    ['Control a DC motor using coupled electrical and rotational dynamics.', 'Will proportional speed feedback always reach the target exactly?',
      ['Yes', 'No, it can retain an offset', 'Only at zero gain'], 1, 'Proportional control needs an error to supply the steady voltage required by losses.',
      'With gain 20 and target 1 rad/s, the steady speed is about 0.6664 rad/s for the stated motor.',
      'L i′ = u − R i − Kω, Jω′ = K i − bω, u = Kp(r − ω).',
      'Fixed motor values are R = 1 Ω, L = 0.5 H, J = 0.01 kg·m², b = 0.1 N·m·s and K = 0.01. No load torque or voltage saturation.'],
    ({ gain, target }) => summarize(integrate([0, 0], ([current, speed]) =>
      [(gain * (target - speed) - current - 0.01 * speed) / 0.5, (0.01 * current - 0.1 * speed) / 0.01])
      .map(({ x, state }) => ({ x, y: state[1], reference: target })), target),
    { yUnit: 'rad/s' }),
  cruise: lab('cruise', 'Cruise Control',
    { gain: p('Controller gain', 'N/(m/s)', 10, 500, 100), target: p('Target speed', 'm/s', 1, 40, 20), mass: p('Vehicle mass', 'kg', 500, 2000, 1000) },
    ['Balance propulsion against linear drag with proportional speed feedback.', 'If vehicle mass doubles, what happens to the steady-state speed?',
      ['It halves', 'It stays the same', 'It doubles'], 1, 'Mass changes the transient time constant, while steady speed depends on gain and drag.',
      'At Kp = 100 N/(m/s), drag b = 50 N/(m/s), and a 20 m/s target, steady speed is 13.333 m/s.',
      'm v′ + bv = Kp(r − v). v∞ = Kp r/(b + Kp), τ = m/(b + Kp).',
      'Linear drag b = 50. This model excludes gear shifts, hills, rolling resistance, and force saturation.'],
    ({ gain, target, mass }) => {
      const tau = mass / (gain + 50), final = gain * target / (gain + 50);
      return summarize(samples(0, 6 * tau, x => ({ y: final * -Math.expm1(-x / tau), reference: target })), target);
    }, { yUnit: 'm/s' }),
  tank: lab('tank', 'Tank Level Feedback',
    { gain: p('Inflow feedback gain', 'm²/s', 0, 5, 1), area: p('Tank cross section', 'm²', 0.5, 5, 1), target: p('Target level', 'm', 0.1, 3, 1) },
    ['Adjust a tank’s inflow using feedback while water drains through a linear outlet.', 'Does a larger tank area change the equilibrium level?',
      ['Yes, it raises it', 'No, only the speed changes', 'Yes, it lowers it'], 1, 'The area multiplies the derivative but does not appear in the equilibrium balance.',
      'At gain 1 and outlet coefficient 0.5, a 1 m target gives a 0.667 m equilibrium.',
      'A h′ = Kp(r − h) − ch, c = 0.5 m²/s. h∞ = Kp r/(Kp + c).',
      'Linear outlet, initially empty tank. Inflow is nonnegative during this monotonic step. Overflow is excluded.'],
    ({ gain, area, target }) => {
      const tau = area / (gain + 0.5), final = gain * target / (gain + 0.5);
      return summarize(samples(0, 6 * tau, x => ({ y: final * -Math.expm1(-x / tau), reference: target })), target);
    }, { yUnit: 'm' }),
  thermal: lab('thermal', 'PI Temperature Regulation',
    { kp: p('Proportional Kp', '1/s', 0, 8, 2), ki: p('Integral Ki', '1/s²', 0, 2, 0.5), loss: p('Heat-loss coefficient', '1/s', 0.1, 2, 0.5) },
    ['Regulate a normalized temperature rise with proportional and integral feedback.', 'Which gain can remove a steady temperature error?',
      ['Integral gain', 'Heat-loss coefficient', 'Plot duration'], 0, 'Integral control increases heater effort until the steady error vanishes in a stable loop.',
      'For Kp = 2, Ki = 0.5, and loss = 0.5, the normalized temperature approaches one.',
      'T′ = u − aT, u = Kp(1 − T) + Ki I, I′ = 1 − T.',
      'Temperature is a normalized rise above ambient. Constant thermal capacity is absorbed into the coefficients. No heater saturation.'],
    ({ kp, ki, loss }) => summarize(integrate([0, 0], ([y, integral]) =>
      [kp * (1 - y) + ki * integral - loss * y, 1 - y], 20).map(({ x, state }) => ({ x, y: state[0], reference: 1 })))),
  pendulum: lab('pendulum', 'Inverted Pendulum Stabilization',
    { kp: p('Angle feedback gain', '1/s²', 0, 40, 20), kd: p('Rate feedback gain', '1/s', 0, 15, 8), initial: p('Initial angle', '°', 0.1, 5, 3) },
    ['Stabilize the upright equilibrium of a linearized pendulum with PD feedback.', 'For this 1 m model, what must Kp exceed for a stable restoring term?',
      ['0', '9.81', '90'], 1, 'The gravitational instability contributes +9.81θ. The controller must overcome it.',
      'Kp = 20 and Kd = 8 stabilize a small 3° perturbation in the linearized model.',
      'θ″ = 9.81θ − Kpθ − Kdθ′. The feedback is expressed as angular acceleration.',
      'Fixed length 1 m, no cart dynamics, no saturation, and a small-angle linearization. Large plotted angles indicate departure from the model’s valid region.'],
    ({ kp, kd, initial }) => summarize(integrate([initial, 0], ([angle, rate]) =>
      [rate, (9.81 - kp) * angle - kd * rate], 4).map(({ x, state }) => ({ x, y: state[0], reference: 0 })), 0),
    { yUnit: '°' }),
  windup: lab('windup', 'Integrator Windup',
    { ki: p('Integral gain', '1/s', 0.1, 4, 1), limit: p('Actuator limit', '', 0.5, 2, 1), antiwindup: { ...p('Conditional integration (0 off, 1 on)', '', 0, 1, 1), integer: true } },
    ['Compare a saturated PI loop with and without conditional integration after a setpoint change.', 'Why can a saturated controller recover slowly?',
      ['Its integral keeps growing', 'Its time axis stops', 'Its plant gain becomes zero'], 0, 'The accumulated integral can keep the actuator saturated even after the error reverses.',
      'The target starts at 3 and drops to 0.5 at 5 s. An actuator limited to 1 cannot achieve the initial target.',
      'y′ = sat[2(r − y) + Ki I] − y. Freeze I when saturation and the error push in the same direction.',
      'Normalized first-order plant with symmetric actuator bounds. Conditional integration is one simple antiwindup method. The reference changes at 5 s.'],
    ({ ki, limit, antiwindup }) => {
      const target = t => t < 5 ? 3 : 0.5;
      return summarize(integrate([0, 0], ([y, integral], t) => {
        const error = target(t) - y, raw = 2 * error + ki * integral, u = clamp(raw, limit);
        const freeze = antiwindup === 1 && (raw - u) * error > 0;
        return [u - y, freeze ? 0 : error];
      }, 15).map(({ x, state }) => ({ x, y: state[0], reference: target(x) })), 0.5);
    }),
  bode: lab('bode', 'First-Order Bode Magnitude',
    { tau: input.tau, gain: p('Static gain', '', 0.1, 5, 1) },
    ['Inspect a logarithmic frequency sweep and locate the first-order break frequency.', 'What is the gain reduction at the break frequency?',
      ['3.01 dB', '10 dB', '20 dB'], 0, 'The magnitude is 1/√2 of the DC gain at ω = 1/τ.',
      'With K = 1 and τ = 1 s, the magnitude at 1 rad/s is −3.0103 dB and the phase is −45°.',
      '|G(jω)|dB = 20 log₁₀K − 10 log₁₀[1 + (ωτ)²]. The horizontal coordinate is log₁₀ω.',
      'Positive K and τ, ideal continuous-time first-order system. Frequency ticks represent log10(rad/s).'],
    ({ tau, gain }) => ({
      summary: { corner: 1 / tau, atCorner: 20 * Math.log10(gain) - 10 * Math.log10(2), phase: -45 },
      series: samples(-2 - Math.log10(tau), 2 - Math.log10(tau), x => ({ y: 20 * Math.log10(gain) - 10 * Math.log10(1 + (10 ** x * tau) ** 2) })),
    }), { x: 'log₁₀ angular frequency', xUnit: '', y: 'Magnitude', yUnit: 'dB', traces: { y: 'Magnitude' }, metrics: { corner: 'Corner frequency', atCorner: 'Magnitude at corner', phase: 'Phase at corner' }, units: { corner: 'rad/s', atCorner: 'dB', phase: '°' } }),
  lead: lab('lead', 'Lead Compensator',
    { ratio: p('Pole-to-zero frequency ratio', '', 1.1, 20, 5), zero: p('Zero frequency', 'rad/s', 0.1, 10, 1) },
    ['Find the positive phase boost supplied by a lead network.', 'What kind of phase does a lead network add?',
      ['Positive', 'Negative', 'Always zero'], 0, 'Its zero acts before its higher-frequency pole, creating a band of positive phase.',
      'A pole-to-zero ratio of 5 gives a maximum phase lead of about 41.81°.',
      'C(s) = (1 + s/z)/(1 + s/p), p = αz. Phase = atan(ω/z) − atan(ω/p). Peak occurs at √(zp).',
      'DC-normalized ideal compensator. This lab plots phase, not a full closed-loop response. Horizontal ticks are log10(rad/s).'],
    ({ ratio, zero }) => ({
      summary: { phase: Math.asin((ratio - 1) / (ratio + 1)) * 180 / Math.PI, frequency: zero * Math.sqrt(ratio), highGain: ratio },
      series: samples(Math.log10(zero) - 2, Math.log10(zero * ratio) + 2, x => ({ y: (Math.atan(10 ** x / zero) - Math.atan(10 ** x / (zero * ratio))) * 180 / Math.PI })),
    }), { x: 'log₁₀ angular frequency', xUnit: '', y: 'Phase lead', yUnit: '°', traces: { y: 'Phase' }, metrics: { phase: 'Maximum phase lead', frequency: 'Frequency at peak', highGain: 'High-frequency gain' }, units: { phase: '°', frequency: 'rad/s', highGain: '' } }),
  lag: lab('lag', 'Lag Compensator',
    { ratio: p('Zero-to-pole frequency ratio', '', 1.1, 20, 5), pole: p('Pole frequency', 'rad/s', 0.1, 10, 1) },
    ['Inspect the phase cost and high-frequency attenuation of a lag network.', 'What is the high-frequency gain for a DC-normalized lag network?',
      ['Greater than one', 'Less than one', 'Exactly one'], 1, 'The lower-frequency pole attenuates the signal before the zero becomes effective.',
      'With zero-to-pole ratio 5, high-frequency gain is 0.2 and the largest phase lag is about −41.81°.',
      'C(s) = (1 + s/z)/(1 + s/p), z = βp. Phase = atan(ω/z) − atan(ω/p).',
      'Ideal DC-normalized network. Phase is negative. This lab does not infer closed-loop stability from the compensator alone.'],
    ({ ratio, pole }) => ({
      summary: { phase: -Math.asin((ratio - 1) / (ratio + 1)) * 180 / Math.PI, frequency: pole * Math.sqrt(ratio), highGain: 1 / ratio },
      series: samples(Math.log10(pole) - 2, Math.log10(pole * ratio) + 2, x => ({ y: (Math.atan(10 ** x / (pole * ratio)) - Math.atan(10 ** x / pole)) * 180 / Math.PI })),
    }), { x: 'log₁₀ angular frequency', xUnit: '', y: 'Phase lag', yUnit: '°', traces: { y: 'Phase' }, metrics: { phase: 'Maximum phase lag', frequency: 'Frequency at peak', highGain: 'High-frequency gain' }, units: { phase: '°', frequency: 'rad/s', highGain: '' } }),
  poles: lab('poles', 'Closed-Loop Pole Locus',
    { gain: p('Feedback gain K', '', 0, 20, 4), pole: p('Open-loop pole magnitude a', '1/s', 0.5, 5, 2) },
    ['Track the closed-loop poles of K/[s(s+a)] as feedback gain changes.', 'Where do the real poles meet before becoming a complex pair?',
      ['At −a/2', 'At +a', 'At zero'], 0, 'The roots of s² + as + K coincide when the discriminant a² − 4K vanishes.',
      'For a = 2 and K = 4, the closed-loop poles are −1 ± j√3.',
      's = [−a ± √(a² − 4K)]/2. Negative real parts imply stable modes; K = 0 leaves a pole at the origin.',
      'Two-pole unity-feedback example. The plotted path sweeps K from 0 to 20; dots mark the selected pair.'],
    ({ gain, pole }) => {
      const roots = k => {
        const d = pole ** 2 - 4 * k;
        return d >= 0 ? [[(-pole + Math.sqrt(d)) / 2, 0], [(-pole - Math.sqrt(d)) / 2, 0]]
          : [[-pole / 2, Math.sqrt(-d) / 2], [-pole / 2, -Math.sqrt(-d) / 2]];
      };
      const selected = roots(gain);
      const series = [];
      for (const branch of [0, 1]) {
        const ks = branch ? Array.from({ length: 121 }, (_, i) => 20 * (1 - i / 120)) : Array.from({ length: 121 }, (_, i) => 20 * i / 120);
        for (const k of ks) { const [x, y] = roots(k)[branch]; series.push({ x, y, locus: y }); }
      }
      for (const [x, y] of selected) series.push({ x, y, sample: y });
      series.sort((a, b) => a.x - b.x || a.y - b.y);
      return { summary: { real: selected[0][0], imaginary: selected[0][1], frequency: Math.sqrt(gain) }, series };
    }, { x: 'Real part', xUnit: '1/s', y: 'Imaginary part', yUnit: '1/s', traces: { locus: 'Gain sweep', sample: 'Selected poles' }, metrics: { real: 'Rightmost pole real part', imaginary: 'Pole imaginary magnitude', frequency: 'Natural frequency' }, units: { real: '1/s', imaginary: '1/s', frequency: 'rad/s' } }),
  nyquist: lab('nyquist', 'First-Order Nyquist Plot',
    { gain: p('Loop gain', '', 0.1, 5, 2), tau: input.tau },
    ['Trace the complex frequency response of a stable first-order loop.', 'Which half-plane contains the positive-frequency branch?',
      ['Upper', 'Lower', 'Both equally'], 1, 'The first-order denominator contributes a negative imaginary part at positive frequency.',
      'For K = 2, τ = 1, the response at ω = 1 is 1 − j.',
      'G(jω) = K(1 − jωτ)/[1 + (ωτ)²]. Positive and negative frequencies trace a circle centered at K/2.',
      'Only this stable first-order loop is shown. Unity negative feedback is stable for positive K. The plot includes the limiting point at the origin.'],
    ({ gain, tau }) => ({
      summary: { dc: gain, real: gain / 2, frequency: 1 / tau },
      series: samples(0, gain, x => ({ y: -Math.sqrt(Math.max(0, x * (gain - x))), reference: Math.sqrt(Math.max(0, x * (gain - x))) })),
    }), { x: 'Real part', xUnit: '', y: 'Imaginary part', traces: { y: 'Positive frequencies', reference: 'Negative frequencies' }, metrics: { dc: 'DC loop gain', real: 'Real part at 1/τ', frequency: 'Frequency at bottom of circle' }, units: { dc: '', real: '', frequency: 'rad/s' } }),
  digital: lab('digital', 'Discrete-Time Feedback',
    { gain: p('Discrete feedback gain', '', 0, 3, 0.8), memory: p('Plant pole a', '', 0, 0.95, 0.8) },
    ['See convergence, alternating transients, or divergence in a sampled feedback loop.', 'What condition makes the closed-loop mode stable?',
      ['|a − K| < 1', 'K > 10', 'a = K + 2'], 0, 'The homogeneous response is multiplied by a − K each sample.',
      'For a = 0.8 and K = 0.8 the pole is zero and the next output jumps to 0.8, retaining a 0.2 tracking error.',
      'y[n+1] = a y[n] + K(1 − y[n]). The pole is a − K and the equilibrium is K/(1 − a + K).',
      'Discrete scalar plant from rest over 30 updates. Divergent modes are intentionally visible. Each straight segment joins discrete samples.'],
    ({ gain, memory }) => {
      let y = 0;
      const series = [];
      for (let n = 0; n <= 30; n++) { series.push({ x: n, y, reference: 1 }); y = memory * y + gain * (1 - y); }
      return summarize(series);
    }, { x: 'Sample index', xUnit: '' }),
};

Object.values(controlModels).forEach(({ definition }, index) => {
  definition.lab = `CS${String(index + 1).padStart(2, '0')}`;
});

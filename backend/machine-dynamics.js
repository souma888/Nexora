import { study, p, integer, table, samples, systemVisual } from './study-kit.js';
export function freeResponse(t, omega, zeta, x0, v0) {
  if (Math.abs(zeta - 1) < 1e-9) return (x0 + (v0 + omega * x0) * t) * Math.exp(-omega * t);
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return (
      Math.exp(-zeta * omega * t) *
      (x0 * Math.cos(wd * t) + ((v0 + zeta * omega * x0) / wd) * Math.sin(wd * t))
    );
  }
  const q = zeta + Math.sqrt(zeta * zeta - 1),
    a = -omega / q,
    b = -omega * q,
    A = (v0 - b * x0) / (a - b);
  return A * Math.exp(a * t) + (x0 - A) * Math.exp(b * t);
}
export const responseDenominator = (ratio, zeta) => Math.hypot(1 - ratio * ratio, 2 * zeta * ratio);
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  csub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  cdiv = (a, b) => {
    const d = b[0] ** 2 + b[1] ** 2;
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
export function absorberResponse(m1, m2, k1, k2, c1, c2, omega, force) {
  const a = [k1 + k2 - m1 * omega ** 2, omega * (c1 + c2)],
    d = [k2 - m2 * omega ** 2, omega * c2],
    b = [-k2, -omega * c2],
    det = csub(cmul(a, d), cmul(b, b)),
    x = cdiv([force * d[0], force * d[1]], det),
    y = cdiv([-force * b[0], -force * b[1]], det);
  return { primary: Math.hypot(...x), absorber: Math.hypot(...y), phase: Math.atan2(x[1], x[0]) };
}
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  study({ discipline: 'mechanical', topic: 'Vibration & rotor dynamics', ...config }, solve);
const mass = p('Supported mass', 'kg', 0.1, 1000, 10),
  stiffness = p('Stiffness', 'N/m', 10, 1e6, 10000),
  damping = p('Damping ratio ζ', '', 0, 1, 0.05);
export const machineDynamicsModels = {
  dampedfree: make(
    {
      id: 'dampedfree',
      title: 'Damped Free Vibration and Logarithmic Decrement',
      inputs: {
        mass,
        stiffness,
        damping: p('Damping ratio ζ', '', 0, 2, 0.1),
        displacement: p('Initial displacement', 'mm', -20, 20, 5),
        velocity: p('Initial velocity', 'mm/s', -100, 100, 0),
        cycles: integer('Undamped periods in view', 1, 10, 5),
      },
      metrics: {
        frequency: ['Undamped natural frequency', 'Hz'],
        damped: ['Damped frequency (underdamped only)', 'Hz'],
        decrement: ['Logarithmic decrement (underdamped)', '1'],
        final: ['Final displacement', 'mm'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Displacement', yUnit: 'mm' },
      text: {
        description:
          'Compare underdamped oscillation, critical decay and overdamped relaxation using exact initial-condition solutions.',
        predict:
          'Is logarithmic decrement defined from repeated oscillation peaks at critical damping?',
        answers: [
          'No, the response has no repeated oscillation peaks',
          'Yes, it is infinite by measurement',
          'Only for negative displacement',
        ],
        explain:
          'The peak-ratio formula applies to an underdamped oscillation; monotone regimes require another identification method.',
        example:
          'At ζ=0.1, δ=2πζ/√(1−ζ²)≈0.6315, so successive same-sign peak amplitudes have ratio e^δ≈1.88.',
        equation: 'm x″+c x′+kx=0; ωn=√(k/m), c=2ζmωn, ωd=ωn√(1−ζ²), δ=2πζ/√(1−ζ²).',
        limits:
          'Linear viscous damping, one degree of freedom, no forcing. Exact branches handle ζ=0, ζ=1 and ζ>1. The plot uses 100 samples per undamped period; δ is null outside ζ<1.',
      },
    },
    ({ mass, stiffness, damping: z, displacement: x0, velocity: v0, cycles }) => {
      const w = Math.sqrt(stiffness / mass),
        end = (cycles * 2 * Math.PI) / w,
        series = samples(0, end, (t) => ({ y: freeResponse(t, w, z, x0, v0) }), 100 * cycles);
      return {
        summary: {
          frequency: w / (2 * Math.PI),
          damped: z < 1 ? (w * Math.sqrt(1 - z * z)) / (2 * Math.PI) : null,
          decrement: z < 1 ? (2 * Math.PI * z) / Math.sqrt(1 - z * z) : null,
          final: series.at(-1).y,
        },
        series,
        visualization: systemVisual(
          'spring',
          { mass },
          series.map((r) => ({ time: r.x, displacement: r.y, phase: w * r.x })),
        ),
      };
    },
  ),
  forcedvibration: make(
    {
      id: 'forcedvibration',
      title: 'Forced Vibration and Resonance Magnification',
      inputs: {
        mass,
        stiffness,
        damping,
        force: p('Harmonic force amplitude', 'N', 1, 1000, 100),
        ratio: p('Excitation / natural frequency r', '', 0, 3, 0.8),
      },
      metrics: {
        frequency: ['Natural frequency', 'Hz'],
        amplitude: ['Selected steady-state amplitude', 'mm'],
        magnification: ['Dynamic magnification', '1'],
        phase: ['Displacement lag', 'deg'],
      },
      plot: {
        x: 'Frequency ratio r',
        xUnit: '',
        y: 'Response amplitude',
        yUnit: 'mm',
        traces: { y: 'Dynamic amplitude', reference: 'Static deflection' },
      },
      text: {
        description:
          'Sweep a force-excited oscillator through resonance and separate amplitude magnification from phase lag.',
        predict: 'Is the displacement-amplitude peak always exactly at the natural frequency?',
        answers: [
          'No, damping shifts it to √(1−2ζ²) when such a peak exists',
          'Yes',
          'Only for very large damping',
        ],
        explain:
          'Differentiating the response denominator gives rpeak=√(1−2ζ²); for ζ≥1/√2 the maximum occurs at zero frequency.',
        example: 'At r=1 and ζ=0.05, dynamic magnification is 1/(2ζ)=10.',
        equation: 'X=(F0/k)/√[(1−r²)²+(2ζr)²]; φ=atan2(2ζr,1−r²).',
        limits:
          'Steady harmonic response, linear spring and viscous damping; startup transient omitted. At ζ=0,r=1 there is no finite steady amplitude, reported as null with a warning rather than a clipped peak.',
      },
    },
    ({ mass, stiffness, damping: z, force, ratio: r }) => {
      const d = responseDenominator(r, z),
        base = (1000 * force) / stiffness,
        series = samples(0, 3, (x) => {
          const q = responseDenominator(x, z);
          return { y: q ? base / q : null, reference: base };
        });
      return {
        summary: {
          frequency: Math.sqrt(stiffness / mass) / (2 * Math.PI),
          amplitude: d ? base / d : null,
          magnification: d ? 1 / d : null,
          phase: d ? (Math.atan2(2 * z * r, 1 - r * r) * 180) / Math.PI : null,
        },
        series,
        visualization: systemVisual(
          'spring',
          { mass, amplitude: d ? base / d : 0, force },
          series.map((v) => ({
            ratio: v.x,
            displacement: v.y,
            phase: Math.atan2(2 * z * v.x, 1 - v.x * v.x),
          })),
        ),
        warnings: !d ? ['Undamped resonance has no finite steady-state amplitude.'] : [],
      };
    },
  ),
  baseexcitation: make(
    {
      id: 'baseexcitation',
      title: 'Base Excitation and Transmissibility',
      inputs: {
        mass,
        stiffness,
        damping,
        frequency: p('Base excitation frequency', 'Hz', 0, 100, 10),
        base: p('Base displacement amplitude', 'mm', 0.1, 10, 1),
      },
      metrics: {
        ratio: ['Frequency ratio r', '1'],
        transmissibility: ['Absolute-motion transmissibility', '1'],
        absolute: ['Absolute mass-motion amplitude', 'mm'],
        relative: ['Relative mass/base motion amplitude', 'mm'],
      },
      plot: { x: 'Frequency ratio r', xUnit: '', y: 'Absolute-motion transmissibility', yUnit: '' },
      text: {
        description:
          'Move the support of an oscillator and compare absolute mass motion with the relative deformation of its spring/damper.',
        predict: 'For this linear model, where does displacement isolation begin?',
        answers: ['Above r=√2', 'Above r=1 for every damping ratio', 'At zero frequency'],
        explain: 'The numerator equals the denominator when r²=2, independent of viscous damping.',
        example:
          'At r=0, the mass follows its base: absolute transmissibility is one and relative motion is zero.',
        equation: 'X/Y=√[1+(2ζr)²]/√[(1−r²)²+(2ζr)²]; Z/Y=r²/√[(1−r²)²+(2ζr)²].',
        limits:
          'Steady harmonic base motion of a linear single-DOF oscillator. Displacement isolation is not a claim of low relative stroke or low stress. Undamped resonance is undefined and shown as null.',
      },
    },
    ({ mass, stiffness, damping: z, frequency, base }) => {
      const w = Math.sqrt(stiffness / mass),
        r = (2 * Math.PI * frequency) / w,
        d = responseDenominator(r, z),
        T = d ? Math.hypot(1, 2 * z * r) / d : null,
        series = samples(0, 4, (x) => {
          const q = responseDenominator(x, z);
          return { y: q ? Math.hypot(1, 2 * z * x) / q : null };
        });
      return {
        summary: {
          ratio: r,
          transmissibility: T,
          absolute: T === null ? null : base * T,
          relative: d ? (base * r * r) / d : null,
        },
        series,
        visualization: systemVisual(
          'spring',
          { mass, base },
          series.map((v) => ({
            ratio: v.x,
            displacement: v.y === null ? null : base * v.y,
            phase: v.x * Math.PI,
          })),
        ),
        warnings: !d ? ['Undamped base-excitation resonance is singular.'] : [],
      };
    },
  ),
  tunedmass: make(
    {
      id: 'tunedmass',
      title: 'Tuned Mass Damper',
      inputs: {
        mass,
        stiffness,
        massratio: p('Absorber / primary mass ratio', '', 0.01, 0.3, 0.05),
        tuning: p('Absorber / primary natural frequency', '', 0.5, 1.5, 1),
        primarydamping: p('Primary damping ratio', '', 0.001, 0.3, 0.02),
        absorberdamping: p('Absorber damping ratio', '', 0.001, 0.5, 0.05),
        force: p('Force amplitude on primary', 'N', 1, 1000, 100),
        ratio: p('Operating frequency ratio', '', 0, 2.5, 1),
      },
      metrics: {
        primary: ['Primary amplitude with absorber', 'mm'],
        absorber: ['Absorber amplitude', 'mm'],
        bare: ['Primary amplitude without absorber', 'mm'],
        mass2: ['Absorber mass', 'kg'],
      },
      plot: {
        x: 'Frequency / primary natural frequency',
        xUnit: '',
        y: 'Primary amplitude',
        yUnit: 'mm',
        traces: { y: 'With tuned mass damper', reference: 'Without absorber' },
      },
      text: {
        description:
          'Solve the complex two-mass dynamic stiffness equations and see a resonance split into two coupled peaks.',
        predict: 'Does a tuned absorber reduce primary response at every frequency?',
        answers: ['No, it redistributes the resonance response', 'Yes', 'Only if its mass is zero'],
        explain:
          'Adding a second mass creates two coupled modes and can amplify response away from its tuning region.',
        example:
          'A 5% mass-ratio absorber tuned near the primary mode produces a dip near the original natural frequency and two surrounding peaks.',
        equation: '[K−ω²M+iωC]X=[F0,0]ᵀ; k2=m2ω2², c2=2ζ2m2ω2.',
        limits:
          'Linear two-DOF harmonic steady state; viscous ground damping on the primary and coupling damping to the absorber. Both damping ratios stay positive. No optimal-tuning guarantee, stroke stop, fatigue or nonlinear mounting.',
      },
    },
    ({
      mass: m1,
      stiffness: k1,
      massratio: mu,
      tuning,
      primarydamping: z1,
      absorberdamping: z2,
      force,
      ratio: r,
    }) => {
      const w = Math.sqrt(k1 / m1),
        m2 = mu * m1,
        w2 = tuning * w,
        k2 = m2 * w2 * w2,
        c1 = 2 * z1 * m1 * w,
        c2 = 2 * z2 * m2 * w2,
        response = (x) => absorberResponse(m1, m2, k1, k2, c1, c2, x * w, force),
        v = response(r),
        bare = (x) => force / k1 / responseDenominator(x, z1),
        series = samples(0, 2.5, (x) => ({
          y: 1000 * response(x).primary,
          reference: 1000 * bare(x),
        }));
      return {
        summary: {
          primary: 1000 * v.primary,
          absorber: 1000 * v.absorber,
          bare: 1000 * bare(r),
          mass2: m2,
        },
        series,
        visualization: systemVisual(
          'absorber',
          { mass1: m1, mass2: m2 },
          series.map((row) => ({
            ratio: row.x,
            primary: row.y,
            absorber: 1000 * response(row.x).absorber,
          })),
        ),
        table: table(
          'Dynamic-stiffness parameters',
          ['m1 kg', 'm2 kg', 'k1 N/m', 'k2 N/m', 'c1 Ns/m', 'c2 Ns/m'],
          [[m1, m2, k1, k2, c1, c2]],
        ),
      };
    },
  ),
  rotatingunbalance: make(
    {
      id: 'rotatingunbalance',
      title: 'Rotating Unbalance',
      inputs: {
        mass,
        stiffness,
        damping,
        unbalance: p('Eccentric mass', 'g', 1, 200, 20),
        radius: p('Eccentric radius', 'mm', 1, 100, 10),
        speed: p('Rotational speed', 'rpm', 0, 6000, 500),
      },
      metrics: {
        force: ['Centrifugal force amplitude', 'N'],
        amplitude: ['Supported mass amplitude', 'mm'],
        critical: ['Undamped critical speed', 'rpm'],
        ratio: ['Speed ratio', '1'],
      },
      plot: {
        x: 'Rotational speed',
        xUnit: 'rpm',
        y: 'Steady displacement amplitude',
        yUnit: 'mm',
      },
      text: {
        description:
          'Connect a rotating mass’s ω² force with the supported system’s resonance and high-speed displacement limit.',
        predict: 'What is the high-speed displacement limit for fixed unbalance me?',
        answers: ['me/M', 'Zero for every system', 'It grows without bound as ω²'],
        explain:
          'At high speed inertia dominates stiffness, canceling the ω² in the unbalance force.',
        example: 'An eccentric 20 g mass at 10 mm has unbalance 200 g·mm = 0.0002 kg·m.',
        equation: 'F=meω²; X=(me/M) r²/√[(1−r²)²+(2ζr)²].',
        limits:
          'A single linear translational mode driven by one rotating unbalance. Supported mass includes the rotating assembly. Steady response only; undamped critical speed is singular and omitted.',
      },
    },
    ({ mass: M, stiffness: k, damping: z, unbalance: m, radius: e, speed }) => {
      const w = Math.sqrt(k / M),
        omega = (speed * 2 * Math.PI) / 60,
        U = m * e * 1e-6,
        r = omega / w,
        amp = (x) => {
          const d = responseDenominator(x, z);
          return d ? (((1000 * U) / M) * x * x) / d : null;
        },
        series = samples(0, (3 * w * 60) / (2 * Math.PI), (rpm) => ({
          y: amp((rpm * 2 * Math.PI) / 60 / w),
        }));
      return {
        summary: {
          force: U * omega * omega,
          amplitude: amp(r),
          critical: (w * 60) / (2 * Math.PI),
          ratio: r,
        },
        series,
        visualization: systemVisual(
          'rotor',
          { eccentricity: e },
          series.map((v) => ({
            speed: v.x,
            displacement: v.y,
            phase: (v.x / series.at(-1).x) * 2 * Math.PI,
          })),
        ),
        warnings: amp(r) === null ? ['Undamped critical-speed response is singular.'] : [],
      };
    },
  ),
  jeffcott: make(
    {
      id: 'jeffcott',
      title: 'Jeffcott Rotor Critical Speed',
      inputs: {
        mass,
        stiffness,
        damping,
        eccentricity: p('Disk mass-center eccentricity', 'mm', 0.01, 2, 0.1),
        speed: p('Rotor speed', 'rpm', 0, 6000, 500),
      },
      metrics: {
        critical: ['Critical speed', 'rpm'],
        sag: ['Static gravity sag', 'mm'],
        whirl: ['Synchronous whirl radius', 'mm'],
        phase: ['Whirl lag from unbalance', 'deg'],
      },
      plot: { x: 'Speed ratio', xUnit: '', y: 'Whirl radius', yUnit: 'mm' },
      text: {
        description:
          'Model a central disk on a massless flexible shaft and connect static sag, critical speed and synchronous whirl.',
        predict:
          'Does crossing critical speed make the disk mass center’s orbit exactly the shaft’s geometric-center orbit?',
        answers: ['No, eccentricity distinguishes the centers', 'Yes', 'Only at zero damping'],
        explain:
          'The displacement is the shaft geometric-center response to the disk’s eccentric centrifugal forcing.',
        example: 'The critical-speed relation ωn=√(g/static sag) agrees with √(k/m).',
        equation: 'ωn=√(k/m); δstatic=mg/k; R=e r²/√[(1−r²)²+(2ζr)²].',
        limits:
          'Isotropic Jeffcott rotor, central rigid disk, massless shaft, synchronous linear whirl, no gyroscopic splitting, bearing cross-coupling or instability analysis. Gravity sag is reported separately from whirl; undamped resonance is undefined.',
      },
    },
    ({ mass, stiffness, damping: z, eccentricity: e, speed }) => {
      const w = Math.sqrt(stiffness / mass),
        r = (speed * 2 * Math.PI) / 60 / w,
        amp = (x) => {
          const d = responseDenominator(x, z);
          return d ? (e * x * x) / d : null;
        },
        d = responseDenominator(r, z),
        series = samples(0, 3, (x) => ({ y: amp(x) }));
      return {
        summary: {
          critical: (w * 60) / (2 * Math.PI),
          sag: (1000 * mass * 9.80665) / stiffness,
          whirl: amp(r),
          phase: d ? (Math.atan2(2 * z * r, 1 - r * r) * 180) / Math.PI : null,
        },
        series,
        visualization: systemVisual(
          'rotor',
          { eccentricity: e },
          series.map((v) => ({
            ratio: v.x,
            displacement: v.y,
            phase: Math.atan2(2 * z * v.x, 1 - v.x * v.x),
          })),
        ),
        warnings: !d ? ['Undamped Jeffcott critical speed is singular.'] : [],
      };
    },
  ),
};

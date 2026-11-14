import { lab, p, choice, samples, table } from './lab-kit.js';

const teaching = (description, example, equation, limits) => [
  description,
  'Does doubling the first input always double the result?',
  ['Only if the governing relationship is linear', 'Always', 'Never'],
  'Use the equation and compare two saved runs; thresholds and powers can break proportionality.',
  example,
  equation,
  limits,
];
const questions = {
  leverrule: [
    'Moving the overall composition toward Cβ does what to the beta fraction?',
    ['Increases it', 'Decreases it', 'Leaves it fixed'],
    'The beta fraction is the distance from Cα divided by the tie-line length.',
  ],
  fickdiffusion: [
    'If diffusion time quadruples at fixed D, how does √Dt change?',
    ['It doubles', 'It quadruples', 'It halves'],
    'Diffusion length grows with the square root of elapsed time.',
  ],
  pariscrack: [
    'At m=3, doubling the stress range does what to life between fixed crack sizes?',
    ['Divides life by eight', 'Doubles life', 'Divides life by two'],
    'The integrated cycle count scales as Δσ⁻³ when m=3.',
  ],
  fracturetoughness: [
    'If crack length quadruples at fixed stress, how does KI change?',
    ['It doubles', 'It quadruples', 'It stays fixed'],
    'Stress intensity scales with the square root of crack length.',
  ],
  goodman: [
    'Increasing tensile mean stress leaves how much allowable alternating stress?',
    ['Less', 'More', 'The same'],
    'The tensile mean-stress term consumes part of the Goodman fatigue allowance.',
  ],
  larsonmiller: [
    'At a fixed calibrated P, increasing temperature changes rupture life how?',
    ['It decreases', 'It increases', 'It stays fixed'],
    'log₁₀ life = P/T − C, using absolute temperature.',
  ],
  hallpetch: [
    'Reducing grain size to one quarter changes the grain-boundary contribution how?',
    ['It doubles', 'It quadruples', 'It halves'],
    'k/√d doubles; the friction stress σ₀ is unchanged.',
  ],
  stressconcentration: [
    'Reducing tip radius to one quarter changes Kt−1 how?',
    ['It doubles', 'It halves', 'It stays fixed'],
    'The notch increment 2√(a/ρ) doubles.',
  ],
  bearinglife: [
    'For a ball bearing, doubling load changes basic L10 life how?',
    ['Divides it by eight', 'Divides it by two', 'Doubles it'],
    'Ball-bearing rating life scales with load to the negative third power.',
  ],
  modal2dof: [
    'Multiplying every spring stiffness by four changes both natural frequencies how?',
    ['Doubles them', 'Quadruples them', 'Halves them'],
    'All eigenvalues ω² scale by four, so each natural frequency doubles.',
  ],
};
const make = (id, title, discipline, inputs, metrics, plot, text, solve, validateValues) => {
  if (questions[id]) [text[1], text[2], text[3]] = questions[id];
  return lab({ id, title, discipline, inputs, metrics, plot, text, validateValues }, solve);
};
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  return (
    Math.sign(x) *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x))
  );
};
export const advancedMaterialModels = {
  leverrule: make(
    'leverrule',
    'Phase Fractions: Lever Rule',
    'materials',
    {
      alpha: p('Alpha composition', '%', 0, 99, 20),
      beta: p('Beta composition', '%', 1, 100, 80),
      composition: p('Overall composition', '%', 0, 100, 40),
    },
    { alpha: ['Alpha mass fraction', '1'], beta: ['Beta mass fraction', '1'] },
    {
      x: 'Composition',
      xUnit: '%',
      y: 'Mass fraction',
      yUnit: '1',
      traces: { y: 'Beta', reference: 'Alpha' },
    },
    teaching(
      'Compute two-phase fractions along a supplied equilibrium tie line.',
      'At Cα=20%, Cβ=80%, C₀=40%: wβ=1/3, wα=2/3.',
      'wβ=(C₀−Cα)/(Cβ−Cα); wα=1−wβ.',
      'A supplied tie line, not a calculated thermodynamic phase diagram. Compositions use the same mass basis; no kinetics.',
    ),
    ({ alpha, beta, composition }) => ({
      visualization: { type: 'phase-tie', alpha, beta, composition },
      summary: {
        alpha: (beta - composition) / (beta - alpha),
        beta: (composition - alpha) / (beta - alpha),
      },
      series: samples(alpha, beta, (x) => ({
        y: (x - alpha) / (beta - alpha),
        reference: (beta - x) / (beta - alpha),
      })),
    }),
    ({ alpha, beta, composition }) =>
      alpha >= beta || composition < alpha || composition > beta
        ? {
            key: 'composition',
            message: 'Require Cα < Cβ and overall composition inside the tie line.',
          }
        : undefined,
  ),
  fickdiffusion: make(
    'fickdiffusion',
    'Fick Diffusion: Semi-infinite Solid',
    'materials',
    {
      diffusivity: p('Diffusivity', 'm²/s', 1e-18, 1e-8, 1e-12),
      time: p('Elapsed time', 's', 1, 1e7, 3600),
      surface: p('Surface concentration', '%', 0, 100, 1),
      initial: p('Initial concentration', '%', 0, 100, 0.2),
      depth: p('Plot depth', 'µm', 0.1, 100000, 300),
    },
    {
      penetration: ['Diffusion length √Dt', 'µm'],
      surfaceGradient: ['Surface concentration gradient', '%/m'],
    },
    { x: 'Depth', xUnit: 'µm', y: 'Concentration', yUnit: '%' },
    teaching(
      'Watch a constant surface concentration diffuse into a thick solid.',
      'D=10⁻¹² m²/s and t=3600 s give √Dt=60 µm.',
      'C=Cs+(C₀−Cs) erf(x/(2√Dt)).',
      'Constant D, semi-infinite geometry and fixed surface concentration. Error-function approximation has about 1.5×10⁻⁷ absolute error; no reaction or concentration-dependent D.',
    ),
    ({ diffusivity, time, surface, initial, depth }) => ({
      summary: {
        penetration: Math.sqrt(diffusivity * time) * 1e6,
        surfaceGradient: (initial - surface) / Math.sqrt(Math.PI * diffusivity * time),
      },
      series: samples(0, depth, (x) => ({
        y: surface + (initial - surface) * erf((x * 1e-6) / (2 * Math.sqrt(diffusivity * time))),
      })),
    }),
  ),
  pariscrack: make(
    'pariscrack',
    'Paris-law Crack Growth',
    'materials',
    {
      initial: p('Initial crack', 'mm', 0.01, 100, 1),
      final: p('Target crack', 'mm', 0.02, 200, 10),
      range: p('Stress range Δσ', 'MPa', 1, 500, 100),
      factor: p('Geometry Y', '1', 0.5, 3, 1.12),
      coefficient: p('Paris C', '(m/cycle)/(MPa√m)^m', 1e-16, 1e-8, 1e-12),
      exponent: p('Paris exponent m', '1', 2, 5, 3),
    },
    {
      cycles: ['Cycles to target', 'cycles'],
      initialK: ['Initial ΔK', 'MPa√m'],
      finalK: ['Final ΔK', 'MPa√m'],
    },
    { x: 'Crack length', xUnit: 'mm', y: 'Cycles elapsed', yUnit: 'cycles' },
    teaching(
      'Integrate fatigue crack growth between two specified crack sizes.',
      'For m=3, integrate a⁻³ᐟ² exactly; doubling Δσ cuts life by eight.',
      'da/dN=C(YΔσ√(πa))ᵐ; N=∫ da/[C(YΔσ√πa)ᵐ].',
      'Paris region only; no threshold, overload retardation, variable-amplitude loading or final-fracture criterion. C units depend on m; use MPa and metres.',
    ),
    ({ initial, final, range, factor, coefficient, exponent }) => {
      const a = initial / 1000,
        q = 1 - exponent / 2,
        k = coefficient * (factor * range * Math.sqrt(Math.PI)) ** exponent;
      const life = (b) => (Math.abs(q) < 1e-10 ? Math.log(b / a) / k : (b ** q - a ** q) / (q * k));
      return {
        summary: {
          cycles: life(final / 1000),
          initialK: factor * range * Math.sqrt(Math.PI * a),
          finalK: factor * range * Math.sqrt((Math.PI * final) / 1000),
        },
        series: samples(initial, final, (x) => ({ y: life(x / 1000) })),
      };
    },
    ({ initial, final }) =>
      final <= initial
        ? { key: 'final', message: 'Target crack must exceed the initial crack.' }
        : undefined,
  ),
  fracturetoughness: make(
    'fracturetoughness',
    'Fracture Toughness & Critical Crack',
    'materials',
    {
      stress: p('Tensile stress', 'MPa', 1, 1500, 100),
      crack: p('Crack length a', 'mm', 0.01, 100, 5),
      factor: p('Geometry Y', '1', 0.5, 3, 1.12),
      toughness: p('Plane-strain toughness KIC', 'MPa√m', 1, 300, 50),
      yield: p('Yield strength', 'MPa', 10, 2000, 350),
    },
    {
      intensity: ['Stress intensity KI', 'MPa√m'],
      critical: ['Critical crack length', 'mm'],
      margin: ['KIC / KI', '1'],
      thickness: ['Minimum plane-strain dimension estimate', 'mm'],
    },
    {
      x: 'Crack length',
      xUnit: 'mm',
      y: 'Stress intensity',
      yUnit: 'MPa√m',
      traces: { y: 'KI', reference: 'KIC' },
    },
    teaching(
      'Compare mode-I crack intensity with a supplied toughness.',
      'σ=100 MPa, a=5 mm, Y=1.12 give KI≈14.04 MPa√m.',
      'KI=Yσ√πa; ac=(KIC/Yσ)²/π; Bmin=2.5(KIC/σy)².',
      'LEFM, small-scale yielding and fixed geometry factor. Thickness estimate alone does not establish specimen validity; no design certification.',
    ),
    ({ stress, crack, factor, toughness, yield: sy }) => ({
      summary: {
        intensity: factor * stress * Math.sqrt((Math.PI * crack) / 1000),
        critical: (1000 * (toughness / (factor * stress)) ** 2) / Math.PI,
        margin: toughness / (factor * stress * Math.sqrt((Math.PI * crack) / 1000)),
        thickness: 2500 * (toughness / sy) ** 2,
      },
      series: samples(0, crack * 2, (x) => ({
        y: factor * stress * Math.sqrt((Math.PI * x) / 1000),
        reference: toughness,
      })),
    }),
  ),
  goodman: make(
    'goodman',
    'Goodman Fatigue Diagram',
    'materials',
    {
      mean: p('Mean stress', 'MPa', -500, 500, 100),
      amplitude: p('Alternating stress', 'MPa', 0, 500, 100),
      endurance: p('Corrected endurance strength', 'MPa', 10, 800, 200),
      ultimate: p('Ultimate strength', 'MPa', 20, 2000, 600),
      yield: p('Yield strength', 'MPa', 10, 1800, 400),
    },
    {
      utilization: ['Goodman utilization', '1'],
      factor: ['Fatigue factor', '1'],
      yieldFactor: ['Yield factor', '1'],
    },
    { x: 'Mean tensile stress', xUnit: 'MPa', y: 'Allowable alternating stress', yUnit: 'MPa' },
    teaching(
      'Separate mean-stress fatigue effects from first-cycle yielding.',
      'σm=100 MPa, σa=100 MPa, Se=200 MPa and Sut=600 MPa give utilization 2/3.',
      'u=σa/Se+max(σm,0)/Sut; nf=1/u; ny=Sy/(|σm|+σa).',
      'Conservative zero benefit for compression, corrected Se supplied by user. No notch, multiaxial or finite-life calculation. Null means an unbounded factor at zero demand.',
    ),
    ({ mean, amplitude, endurance, ultimate, yield: sy }) => {
      const u = amplitude / endurance + Math.max(mean, 0) / ultimate;
      return {
        summary: {
          utilization: u,
          factor: u ? 1 / u : null,
          yieldFactor: Math.abs(mean) + amplitude ? sy / (Math.abs(mean) + amplitude) : null,
        },
        series: samples(0, ultimate, (x) => ({ y: endurance * (1 - x / ultimate) })),
      };
    },
    ({ yield: sy, ultimate }) =>
      sy > ultimate
        ? { key: 'yield', message: 'Yield strength cannot exceed ultimate strength.' }
        : undefined,
  ),
  larsonmiller: make(
    'larsonmiller',
    'Larson–Miller Creep Life',
    'materials',
    {
      temperature: p('Temperature', '°C', 300, 1200, 600),
      parameter: p('Larson–Miller parameter P', 'K', 10000, 50000, 20000),
      constant: p('Material constant C', '1', 10, 30, 20),
    },
    { logLife: ['log₁₀ rupture life (hours)', '1'], life: ['Predicted rupture life', 'h'] },
    { x: 'Temperature', xUnit: '°C', y: 'log₁₀ life (hours)', yUnit: '1' },
    teaching(
      'Estimate rupture life from a supplied constant-stress Larson–Miller parameter.',
      'P=20000 K, C=20 and T=600°C give log₁₀(t/h)≈2.905.',
      'P=T(K)[C+log₁₀(t/h)].',
      'The supplied P must correspond to the same alloy, stress and calibration. Extrapolation can be very inaccurate; no damage accumulation.',
    ),
    ({ temperature, parameter, constant }) => ({
      summary: {
        logLife: parameter / (temperature + 273.15) - constant,
        life: 10 ** (parameter / (temperature + 273.15) - constant),
      },
      series: samples(300, 1200, (x) => ({ y: parameter / (x + 273.15) - constant })),
    }),
  ),
  hallpetch: make(
    'hallpetch',
    'Hall–Petch Grain Strengthening',
    'materials',
    {
      grain: p('Mean grain size', 'µm', 1, 1000, 25),
      friction: p('Friction stress σ₀', 'MPa', 0, 500, 70),
      coefficient: p('Hall–Petch k', 'MPa√m', 0.01, 2, 0.5),
    },
    {
      strength: ['Predicted yield strength', 'MPa'],
      increment: ['Grain-boundary contribution', 'MPa'],
    },
    { x: 'Grain size', xUnit: 'µm', y: 'Yield strength', yUnit: 'MPa' },
    teaching(
      'Explore the inverse square-root grain-size relationship.',
      'σ₀=70 MPa, k=0.5 MPa√m and d=25 µm give σy=170 MPa.',
      'σy=σ₀+k/√d (d in metres).',
      'Empirical material-specific coefficients, conventional polycrystalline grains. No inverse Hall–Petch nanoscale regime, texture or temperature dependence.',
    ),
    ({ grain, friction, coefficient }) => ({
      summary: {
        strength: friction + coefficient / Math.sqrt(grain * 1e-6),
        increment: coefficient / Math.sqrt(grain * 1e-6),
      },
      series: samples(1, Math.max(100, grain * 2), (x) => ({
        y: friction + coefficient / Math.sqrt(x * 1e-6),
      })),
    }),
  ),
  stressconcentration: make(
    'stressconcentration',
    'Elliptical Hole Stress Concentration',
    'mechanical',
    {
      major: p('Hole semi-major axis a', 'mm', 0.1, 100, 10),
      radius: p('Tip radius ρ', 'mm', 0.01, 100, 2),
      stress: p('Remote tensile stress', 'MPa', 0, 500, 30),
    },
    { factor: ['Elastic concentration Kt', '1'], peak: ['Peak elastic stress', 'MPa'] },
    { x: 'Tip radius', xUnit: 'mm', y: 'Elastic concentration', yUnit: '1' },
    teaching(
      'See how notch sharpness raises local elastic stress.',
      'a=ρ gives a circular hole and Kt=3.',
      'Kt=1+2√(a/ρ); σmax=Kt σ∞.',
      'Inglis infinite plate, major axis perpendicular to load. No finite-width correction, plastic redistribution or fatigue notch sensitivity.',
    ),
    ({ major, radius, stress }) => ({
      summary: {
        factor: 1 + 2 * Math.sqrt(major / radius),
        peak: stress * (1 + 2 * Math.sqrt(major / radius)),
      },
      series: samples(0.01, Math.max(major, radius * 2), (x) => ({
        y: 1 + 2 * Math.sqrt(major / x),
      })),
    }),
  ),
  bearinglife: make(
    'bearinglife',
    'Bearing L10 Rating Life',
    'mechanical',
    {
      capacity: p('Dynamic rating C', 'kN', 0.1, 1000, 30),
      load: p('Equivalent dynamic load P', 'kN', 0.1, 1000, 10),
      speed: p('Speed', 'rpm', 1, 50000, 1500),
      kind: choice('Bearing type', { ball: 'Ball', roller: 'Roller' }, 'ball'),
    },
    { revolutions: ['L10', 'million rev'], hours: ['L10 operating life', 'h'] },
    { x: 'Equivalent load', xUnit: 'kN', y: 'L10', yUnit: 'million rev' },
    teaching(
      'Relate bearing load and speed to basic rating life.',
      'A ball bearing with C/P=3 has L10=27 million revolutions, or 300 h at 1500 rpm.',
      'L10=(C/P)^p; L10h=10⁶L10/(60n); p=3 ball, 10/3 roller.',
      'Basic 90% reliability rating, constant equivalent load and proper lubrication. No contamination, misalignment or static-load rating check.',
    ),
    ({ capacity, load, speed, kind }) => {
      const exponent = kind === 'ball' ? 3 : 10 / 3,
        L = (capacity / load) ** exponent;
      return {
        summary: { revolutions: L, hours: (1e6 * L) / (60 * speed) },
        series: samples(Math.max(0.1, load / 2), load * 2, (x) => ({
          y: (capacity / x) ** exponent,
        })),
      };
    },
  ),
  modal2dof: make(
    'modal2dof',
    'Two-degree-of-freedom Modal Analysis',
    'mechanical',
    {
      mass1: p('Mass 1', 'kg', 0.1, 1000, 1),
      mass2: p('Mass 2', 'kg', 0.1, 1000, 1),
      spring1: p('Ground spring 1', 'N/m', 1, 1e6, 1000),
      coupling: p('Coupling spring', 'N/m', 1, 1e6, 1000),
      spring2: p('Ground spring 2', 'N/m', 0, 1e6, 0),
    },
    { first: ['First natural frequency', 'Hz'], second: ['Second natural frequency', 'Hz'] },
    {
      x: 'Mass index',
      xUnit: '1',
      y: 'Relative mode displacement',
      yUnit: '1',
      traces: { y: 'Mode 1', reference: 'Mode 2' },
    },
    teaching(
      'Solve a generalized eigenproblem for two masses and three springs.',
      'm₁=m₂=1 kg, k₁=kc=1000 N/m, k₂=0 give f₁≈3.111 Hz and f₂≈8.143 Hz.',
      'Kφ=ω²Mφ; eigenvalues of M⁻¹ᐟ²KM⁻¹ᐟ².',
      'Linear springs, positive masses, no damping or external forcing. Modes are normalized to their maximum absolute displacement.',
    ),
    ({ mass1, mass2, spring1, coupling, spring2 }) => {
      const a = (spring1 + coupling) / mass1,
        d = (spring2 + coupling) / mass2,
        b = -coupling / Math.sqrt(mass1 * mass2),
        r = Math.hypot(a - d, 2 * b),
        v = [(a + d - r) / 2, (a + d + r) / 2];
      const modes = v.map((l) => {
        const u = [b / Math.sqrt(mass1), (l - a) / Math.sqrt(mass2)],
          s = Math.max(...u.map(Math.abs));
        return u.map((x) => x / s);
      });
      return {
        summary: {
          first: Math.sqrt(v[0]) / (2 * Math.PI),
          second: Math.sqrt(v[1]) / (2 * Math.PI),
        },
        series: [
          { x: 1, y: modes[0][0], reference: modes[1][0] },
          { x: 2, y: modes[0][1], reference: modes[1][1] },
        ],
        table: table(
          'Normalized mode shapes',
          ['Mass', 'Mode 1', 'Mode 2'],
          [
            [1, modes[0][0], modes[1][0]],
            [2, modes[0][1], modes[1][1]],
          ],
        ),
      };
    },
  ),
};

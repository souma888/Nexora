import {
  engineering,
  p,
  choice,
  integer,
  textInput,
  seq,
  rad,
  clamp,
  erf,
  erfinv,
  lesson,
  domain,
  requireValue,
  result,
  solveLinear,
} from './engineering-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'materials', topic: 'Metallurgy & transformations', ...config }, solve);
export function transformed(T, nose, width, noseTime) {
  return noseTime * Math.exp(((T - nose) / width) ** 2);
}
export function laminateQ(E1, E2, G, nu, angle) {
  const d = 1 - (nu * nu * E2) / E1,
    Q11 = E1 / d,
    Q22 = E2 / d,
    Q12 = (nu * E2) / d,
    Q66 = G,
    m = Math.cos(rad(angle)),
    n = Math.sin(rad(angle)),
    m2 = m * m,
    n2 = n * n;
  return [
    [
      Q11 * m2 * m2 + 2 * (Q12 + 2 * Q66) * m2 * n2 + Q22 * n2 * n2,
      (Q11 + Q22 - 4 * Q66) * m2 * n2 + Q12 * (m2 * m2 + n2 * n2),
      (Q11 - Q12 - 2 * Q66) * m * m2 * n - (Q22 - Q12 - 2 * Q66) * m * n * n2,
    ],
    [
      (Q11 + Q22 - 4 * Q66) * m2 * n2 + Q12 * (m2 * m2 + n2 * n2),
      Q11 * n2 * n2 + 2 * (Q12 + 2 * Q66) * m2 * n2 + Q22 * m2 * m2,
      (Q11 - Q12 - 2 * Q66) * m * n * n2 - (Q22 - Q12 - 2 * Q66) * m * m2 * n,
    ],
    [
      (Q11 - Q12 - 2 * Q66) * m * m2 * n - (Q22 - Q12 - 2 * Q66) * m * n * n2,
      (Q11 - Q12 - 2 * Q66) * m * n * n2 - (Q22 - Q12 - 2 * Q66) * m * m2 * n,
      (Q11 + Q22 - 2 * Q12 - 2 * Q66) * m2 * n2 + Q66 * (m2 * m2 + n2 * n2),
    ],
  ];
}
export function parseAngles(source) {
  const a = String(source)
    .split(',')
    .map((s) => (s.trim() ? Number(s) : NaN));
  requireValue(
    a.length >= 1 && a.length <= 16 && a.every((v) => Number.isFinite(v) && Math.abs(v) <= 90),
    'Use 1–16 comma-separated ply angles between −90° and 90°.',
  );
  return a;
}
export const metallurgyModels = {
  eutectic: make(
    {
      id: 'eutectic',
      title: 'Eutectic Cooling Curve and Microstructure',
      inputs: {
        composition: p('Tin composition', 'wt%', 20, 95, 40),
        extraction: p('Specific heat extraction', 'kJ/(kg·s)', 0.1, 20, 2),
        latent: p('Assumed latent heat', 'kJ/kg', 10, 100, 50),
        capacity: p('Specific heat', 'kJ/(kg·K)', 0.1, 1, 0.2),
      },
      metrics: {
        liquidus: ['Liquidus temperature', '°C'],
        primary: ['Primary phase mass fraction', '1'],
        eutectic: ['Eutectic constituent fraction', '1'],
        arrest: ['Eutectic arrest duration', 's'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Temperature', yUnit: '°C' },
      text: lesson(
        'Follow a Pb–Sn-inspired equilibrium cooling path through primary solidification and an isothermal eutectic arrest.',
        'Which composition maximizes the eutectic arrest?',
        ['The eutectic composition', 'Pure lead', 'Every composition equally'],
        'At the eutectic, all liquid remains available for the invariant transformation.',
        'At 61.9 wt% Sn with L=50 kJ/kg and extraction 2 kJ/(kg·s), the arrest lasts 25 s.',
        'fe=1−fp; fp=(Ce−C0)/(Ce−Cα) or (C0−Ce)/(Cβ−Ce); Δtarrest=Lfe/q̇.',
        'Illustrative linear liquidus branches: Te=183°C, Ce=61.9%, Cα=18.3%, Cβ=97.8%, pure-end melting points 327/232°C. Constant cp, uniform temperature and equal latent heat per mass of solid formed. Mass fractions are not area fractions; no undercooling or segregation.',
      ),
    },
    ({ composition: c, extraction: q, latent: L, capacity: cp }) => {
      const ce = 61.9,
        te = 183,
        fp = c < ce ? (ce - c) / (ce - 18.3) : (c - ce) / (97.8 - ce),
        tl = c < ce ? 327 + ((183 - 327) * c) / ce : 183 + ((232 - 183) * (c - ce)) / (100 - ce),
        t1 = (cp * 30) / q,
        t2 = t1 + (cp * (tl - te) + L * fp) / q,
        arrest = (L * (1 - fp)) / q,
        t3 = t2 + arrest,
        end = t3 + (cp * 40) / q;
      const series = seq(0, end, 240).map((x) => ({
        x,
        y:
          x < t1
            ? tl + 30 - (q * x) / cp
            : x < t2
              ? tl - ((tl - te) * (x - t1)) / (t2 - t1)
              : x < t3
                ? te
                : te - (q * (x - t3)) / cp,
      }));
      return result(
        { liquidus: tl, primary: fp, eutectic: 1 - fp, arrest },
        series,
        'microstructure',
        {
          fractions: [fp, 1 - fp],
          labels: ['Primary solid', 'Eutectic constituent'],
          temperature: te,
        },
        [
          ['Eutectic temperature °C', te],
          ['Specific latent heat kJ/kg', L],
        ],
      );
    },
  ),
  ironcarbon: make(
    {
      id: 'ironcarbon',
      title: 'Iron–Carbon Diagram Phase Fractions',
      inputs: {
        carbon: p('Carbon', 'wt%', 0.02, 1.5, 0.4),
        temperature: p('Equilibrium temperature', '°C', 20, 900, 600),
      },
      metrics: {
        ferrite: ['Ferrite mass fraction', '1'],
        austenite: ['Austenite mass fraction', '1'],
        cementite: ['Cementite mass fraction', '1'],
        pearlite: ['Pearlite constituent below A1', '1'],
      },
      plot: {
        x: 'Carbon',
        xUnit: 'wt%',
        y: 'Mass fraction',
        yUnit: '1',
        traces: { y: 'Ferrite', reference: 'Austenite', third: 'Cementite' },
      },
      text: lesson(
        'Distinguish phases from microstructural constituents in a bounded Fe–Fe₃C equilibrium diagram.',
        'Is pearlite a single phase?',
        ['No, it contains ferrite and cementite', 'Yes, it is austenite', 'Yes, it is pure iron'],
        'The lever rule gives phases; the eutectoid reaction gives the pearlite constituent.',
        'At 0.40% C just below 727°C, pearlite ≈(0.40−0.022)/(0.76−0.022)=0.5122.',
        'wβ=(C0−Cα)/(Cβ−Cα); A3≈910−203√Cγ; Acm≈727+420(Cγ−0.76)/1.35.',
        'Restricted to 0.02–1.5 wt% carbon and 20–900°C; metastable cementite, approximate A3/Acm boundaries and a linear ferrite-solubility interpolation. Not a full thermodynamic database. At 727°C the lower-temperature limiting state is used. No martensite or cooling-rate prediction.',
      ),
    },
    ({ carbon: c, temperature: T }) => {
      const calc = (C) => {
          if (T <= 727) {
            const ca = 0.0008 + (0.022 - 0.0008) * clamp(T / 727),
              fc = clamp((C - ca) / (6.67 - ca));
            return [1 - fc, 0, fc];
          }
          const cg = T <= 910 ? ((910 - T) / 203) ** 2 : 0,
            ca = 0.022 * clamp((910 - T) / 183),
            cm = 0.76 + ((T - 727) * 1.35) / 420;
          if (C < cg) {
            const fg = clamp((C - ca) / (cg - ca));
            return [1 - fg, fg, 0];
          }
          if (C > cm) {
            const fc = clamp((C - cm) / (6.67 - cm));
            return [0, 1 - fc, fc];
          }
          return [0, 1, 0];
        },
        f = calc(c),
        pearlite =
          T <= 727
            ? c <= 0.76
              ? clamp((c - 0.022) / (0.76 - 0.022))
              : (6.67 - c) / (6.67 - 0.76)
            : 0;
      return result(
        { ferrite: f[0], austenite: f[1], cementite: f[2], pearlite },
        seq(0.02, 1.5).map((x) => {
          const a = calc(x);
          return { x, y: a[0], reference: a[1], third: a[2] };
        }),
        'microstructure',
        { fractions: f, labels: ['Ferrite α', 'Austenite γ', 'Cementite'], temperature: T },
        [
          ['Eutectoid carbon wt%', 0.76],
          ['Eutectoid temperature °C', 727],
        ],
      );
    },
  ),
  tttcct: make(
    {
      id: 'tttcct',
      title: 'TTT/CCT Diagram and Cooling Paths',
      inputs: {
        mode: choice(
          'Thermal path',
          { isothermal: 'Isothermal hold', cooling: 'Continuous linear cooling' },
          'cooling',
        ),
        hold: p('Hold temperature', '°C', 350, 700, 550),
        rate: p('Cooling rate', 'K/s', 0.1, 100, 5),
        nose: p('TTT nose time (start)', 's', 1, 100, 10),
        width: p('C-curve temperature width', 'K', 40, 150, 90),
      },
      metrics: {
        start: ['Transformation start time', 's'],
        fraction: ['Final diffusional fraction', '1'],
        martensite: ['Remaining austenite transformed to martensite', '1'],
        sum: ['Start additivity integral', '1'],
      },
      plot: {
        x: 'log₁₀ elapsed time in seconds',
        xUnit: '1',
        y: 'Temperature',
        yUnit: '°C',
        traces: {
          y: 'Thermal path',
          reference: 'TTT start: upper branch',
          third: 'TTT start: lower branch',
        },
      },
      text: lesson(
        'Compare an analytic illustrative TTT C-curve with a cooling path using Scheil incubation additivity.',
        'What does a faster quench generally leave below Ms?',
        [
          'More untransformed austenite available for martensite',
          'More diffusional transformation',
          'The same fractions at every rate',
        ],
        'The cooling path spends less time accumulating diffusional incubation.',
        'At a 550°C hold, the illustrative start occurs at the chosen nose time.',
        'tstart(T)=tn exp[((T−550)/w)²]; I=∫dt/tstart(T); start at I=1; X=1−exp[−ln(100)(max(I−1,0)/4)²]; Xm=(1−X)(1−e^(−0.011(Ms−T))).',
        'Illustrative calibrated-shape model, not a steel-grade prediction. Scheil incubation plus an explicitly assumed post-start Avrami clock; Ms=300°C. Isothermal horizon 10tn; cooling starts 800°C and ends 20°C. A null start means no diffusional start during the selected path.',
      ),
    },
    ({ mode, hold, rate, nose, width }) => {
      const end = mode === 'isothermal' ? nose * 10 : 780 / rate,
        n = 1600,
        dt = end / n;
      let I = 0,
        start = null,
        X = 0;
      const series = [];
      for (let i = 0; i <= n; i++) {
        const x = i * dt,
          T = mode === 'isothermal' ? hold : 800 - rate * x;
        if (i && T >= 350 && T <= 700) {
          const prevT = mode === 'isothermal' ? T : T + (rate * dt) / 2;
          I += dt / transformed(prevT, 550, width, nose);
        }
        if (I >= 1 && start === null) start = x;
        X = 1 - Math.exp(-Math.log(100) * (Math.max(I - 1, 0) / 4) ** 2);
        if (i % 8 === 0 && i > 0) {
          const offset = x >= nose ? width * Math.sqrt(Math.log(x / nose)) : null;
          series.push({
            x: Math.log10(x),
            y: T,
            reference: offset !== null && 550 + offset <= 700 ? 550 + offset : null,
            third: offset !== null && 550 - offset >= 350 ? 550 - offset : null,
          });
        }
      }
      const finalT = mode === 'isothermal' ? hold : 20,
        m = (1 - X) * (1 - Math.exp(-0.011 * Math.max(300 - finalT, 0)));
      return result(
        { start, fraction: X, martensite: m, sum: I },
        series,
        'microstructure',
        {
          fractions: [X, m, 1 - X - m],
          labels: ['Diffusional product', 'Martensite', 'Retained austenite'],
        },
        [
          ['TTT start at nose s', nose],
          ['Post-start 99% clock increment', 4],
        ],
        [
          'Illustrative TTT shape and assumed kinetics; do not use for heat-treatment qualification.',
        ],
      );
    },
  ),
  carburizing: make(
    {
      id: 'carburizing',
      title: 'Carburizing Depth from Arrhenius Diffusion',
      inputs: {
        temperature: p('Furnace temperature', '°C', 700, 1100, 925),
        hours: p('Hold time', 'h', 0.1, 100, 4),
        D0: p('Diffusion prefactor', 'm²/s', 1e-7, 1e-3, 2e-5),
        activation: p('Activation energy', 'kJ/mol', 80, 220, 148),
        surface: p('Surface carbon', 'wt%', 0.6, 1.4, 1),
        initial: p('Initial carbon', 'wt%', 0.05, 0.5, 0.2),
        target: p('Case-depth criterion', 'wt%', 0.1, 1, 0.4),
      },
      validateValues: domain('target', (a) =>
        requireValue(
          a.initial < a.target && a.target < a.surface,
          'Require initial < target < surface concentration.',
        ),
      ),
      metrics: {
        diffusivity: ['Arrhenius diffusivity', 'm²/s'],
        depth: ['Depth at target concentration', 'mm'],
        length: ['Diffusion length √Dt', 'mm'],
      },
      plot: { x: 'Depth', xUnit: 'mm', y: 'Carbon', yUnit: 'wt%' },
      text: lesson(
        'Compute a constant-surface carburizing profile with temperature-dependent carbon diffusivity and an explicit case-depth criterion.',
        'Quadrupling hold time changes the case depth how?',
        ['Doubles it', 'Quadruples it', 'Does not change it'],
        'The inverse error-function factor is constant, so depth scales as √t.',
        'At D=10⁻¹² m²/s and t=3600 s, √Dt is 0.06 mm.',
        'D=D0 exp(−Q/RT); C=Cs+(Ci−Cs)erf(x/2√Dt); xcase=2√Dt erf⁻¹[(Cs−Ctarget)/(Cs−Ci)].',
        'Semi-infinite homogeneous austenite, constant surface concentration and constant D during an isothermal hold. Prefactor and activation energy are user-supplied calibration, not a universal steel database. Excludes carbon-potential transients, concentration-dependent D and hardness prediction.',
      ),
    },
    (a) => {
      const D = a.D0 * Math.exp((-a.activation * 1000) / (8.314462618 * (a.temperature + 273.15))),
        l = Math.sqrt(D * a.hours * 3600),
        depth = 2 * l * erfinv((a.surface - a.target) / (a.surface - a.initial)) * 1000,
        series = seq(0, Math.max(4 * l * 1000, depth * 1.2)).map((x) => ({
          x,
          y: a.surface + (a.initial - a.surface) * erf(x / 1000 / (2 * l)),
        }));
      return result(
        { diffusivity: D, depth, length: l * 1000 },
        series,
        'diffusion',
        { depth, temperature: a.temperature },
        [
          ['Surface carbon wt%', a.surface],
          ['Target carbon wt%', a.target],
        ],
      );
    },
  ),
  workhardening: make(
    {
      id: 'workhardening',
      title: 'Work Hardening and Dislocation Strengthening',
      inputs: {
        mode: choice(
          'Constitutive relationship',
          { hollomon: 'Hollomon true stress', dislocation: 'Taylor dislocation strengthening' },
          'hollomon',
        ),
        K: p('Strength coefficient K', 'MPa', 100, 2000, 800),
        n: p('Strain-hardening exponent', '1', 0.05, 0.6, 0.2),
        strain: p('True plastic strain', '1', 0.001, 1, 0.1),
        shear: p('Shear modulus', 'GPa', 10, 100, 80),
        burgers: p('Burgers vector', 'nm', 0.1, 0.4, 0.248),
        density: p('Dislocation density', 'm⁻²', 1e10, 1e16, 1e14),
        alpha: p('Taylor interaction factor', '1', 0.1, 0.7, 0.3),
        taylor: p('Polycrystal factor M', '1', 1, 4, 3.06),
      },
      metrics: {
        stress: ['Flow stress / strengthening increment', 'MPa'],
        tangent: ['Hollomon tangent', 'MPa'],
        necking: ['Considère uniform plastic strain estimate', '1'],
      },
      plot: { x: 'True plastic strain', xUnit: '1', y: 'Stress', yUnit: 'MPa' },
      text: lesson(
        'Inspect Hollomon plastic hardening alongside the Taylor dislocation-strengthening contribution.',
        'In the Hollomon model, when does the simple Considère criterion predict diffuse necking?',
        ['At true strain n', 'At strain K', 'Only at fracture'],
        'dσ/dε=σ yields ε=n for the pure power law.',
        'K=800 MPa, n=0.2 and εp=0.1 give approximately 504.77 MPa.',
        'σ=Kεpⁿ; dσ/dεp=nKεp^(n−1); Δσ=MαGb√ρ.',
        'True plastic strain only; Hollomon extrapolation excludes elastic strain, yield offset, rate and temperature. Necking criterion neglects elasticity. Taylor output is an increment, not total flow stress. Dislocation mode uses a normalized density path ρ(x)=ρselected·x/εselected, not a calibrated evolution law.',
      ),
    },
    (a) => {
      const strengthening = (r) =>
          a.taylor * a.alpha * a.shear * 1000 * a.burgers * 1e-9 * Math.sqrt(r),
        stress = a.mode === 'hollomon' ? a.K * a.strain ** a.n : strengthening(a.density);
      return result(
        { stress, tangent: a.n * a.K * a.strain ** (a.n - 1), necking: a.n },
        seq(0.001, 1).map((x) => ({
          x,
          y: a.mode === 'hollomon' ? a.K * x ** a.n : strengthening((a.density * x) / a.strain),
        })),
        'dislocations',
        { strain: a.strain, density: a.density },
        [
          ['Selected true plastic strain', a.strain],
          ['Dislocation contribution MPa', strengthening(a.density)],
        ],
      );
    },
  ),
  charpy: make(
    {
      id: 'charpy',
      title: 'Ductile–Brittle Transition: Charpy Energy',
      inputs: {
        temperature: p('Test temperature', '°C', -150, 200, 20),
        transition: p('Transition midpoint', '°C', -100, 100, -20),
        width: p('Transition width', 'K', 5, 100, 25),
        lower: p('Lower shelf energy', 'J', 1, 50, 10),
        upper: p('Upper shelf energy', 'J', 60, 300, 150),
        criterion: p('Energy criterion', 'J', 10, 150, 27),
      },
      validateValues: domain('criterion', (a) =>
        requireValue(
          a.criterion > a.lower && a.criterion < a.upper,
          'Energy criterion must lie strictly between the shelf energies.',
        ),
      ),
      metrics: {
        energy: ['Predicted Charpy energy', 'J'],
        transition: ['Criterion crossing temperature', '°C'],
        fraction: ['Normalized shelf transition', '1'],
      },
      plot: { x: 'Temperature', xUnit: '°C', y: 'Absorbed energy', yUnit: 'J' },
      text: lesson(
        'Fit an explicitly empirical smooth transition between lower- and upper-shelf impact energies.',
        'Increasing the midpoint temperature shifts the transition which way?',
        ['Toward warmer tests', 'Toward colder tests', 'It changes neither crossing'],
        'The curve translates with its midpoint temperature.',
        'At T=T0 the model gives the mean of the two shelf energies.',
        'E=EL+(EU−EL)[1+tanh((T−T0)/w)]/2; Tcriterion=T0+w atanh[2(Ec−EL)/(EU−EL)−1].',
        'Empirical tanh fit for a chosen material, specimen geometry and test procedure; not a fracture-toughness conversion. User-supplied shelves and width require measured calibration. Energy scatter, size effects and irradiation are not modeled.',
      ),
    },
    (a) => {
      const f = (T) => (1 + Math.tanh((T - a.transition) / a.width)) / 2,
        E = (T) => a.lower + (a.upper - a.lower) * f(T),
        cross =
          a.transition +
          a.width * Math.atanh((2 * (a.criterion - a.lower)) / (a.upper - a.lower) - 1);
      return result(
        { energy: E(a.temperature), transition: cross, fraction: f(a.temperature) },
        seq(-200, 250).map((x) => ({ x, y: E(x) })),
        'transition',
        { temperature: a.temperature, threshold: cross },
        [
          ['Lower shelf J', a.lower],
          ['Upper shelf J', a.upper],
        ],
      );
    },
  ),
  avrami: make(
    {
      id: 'avrami',
      title: 'Avrami Transformation Kinetics',
      inputs: {
        half: p('Half-transformation time', 's', 1, 10000, 100),
        exponent: p('Avrami exponent n', '1', 0.5, 4, 2),
        time: p('Elapsed time', 's', 0, 10000, 150),
      },
      metrics: {
        fraction: ['Transformed fraction', '1'],
        rate: ['Instantaneous transformation rate', 's⁻¹'],
        t90: ['Time to 90% transformation', 's'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Transformed fraction', yUnit: '1' },
      text: lesson(
        'Parameterize isothermal JMAK kinetics by a measurable half-time rather than a unit-ambiguous rate constant.',
        'What is the transformed fraction at the chosen half-time?',
        ['One half', 'One', 'It depends on n'],
        'The prefactor ln 2 enforces X(t½)=0.5.',
        'With n=2 and t½=100 s, t90≈182.26 s.',
        'X=1−exp[−ln2(t/t½)ⁿ]; dX/dt=(1−X)ln2·n(t/t½)^(n−1)/t½.',
        'Isothermal, homogeneous statistical nucleation/growth abstraction. n need not uniquely identify a mechanism. For n<1 the mathematical rate at t=0 diverges and is shown undefined; no continuous-cooling extrapolation.',
      ),
    },
    (a) => {
      const X = (t) => -Math.expm1(-Math.log(2) * (t / a.half) ** a.exponent),
        rate =
          a.time === 0
            ? a.exponent < 1
              ? null
              : a.exponent === 1
                ? Math.log(2) / a.half
                : 0
            : ((1 - X(a.time)) * Math.log(2) * a.exponent * (a.time / a.half) ** (a.exponent - 1)) /
              a.half;
      return result(
        {
          fraction: X(a.time),
          rate,
          t90: a.half * (Math.log(10) / Math.log(2)) ** (1 / a.exponent),
        },
        seq(0, Math.max(a.half * 3, a.time)).map((x) => ({ x, y: X(x) })),
        'microstructure',
        { fractions: [X(a.time), 1 - X(a.time)], labels: ['Transformed', 'Parent phase'] },
        [
          ['Half-time s', a.half],
          ['Avrami exponent', a.exponent],
        ],
      );
    },
  ),
  crystalpacking: make(
    {
      id: 'crystalpacking',
      title: 'FCC/BCC/HCP Packing and Planar Density',
      inputs: {
        structure: choice(
          'Crystal structure',
          {
            fcc: 'FCC — (111) plane',
            bcc: 'BCC — (110) plane',
            hcp: 'Ideal HCP — (0001) basal plane',
          },
          'fcc',
        ),
        radius: p('Atomic hard-sphere radius', 'nm', 0.08, 0.25, 0.125),
      },
      metrics: {
        packing: ['Atomic packing factor', '1'],
        lattice: ['Conventional a parameter', 'nm'],
        density: ['Selected-plane atom density', 'nm⁻²'],
        coordination: ['Coordination number', '1'],
      },
      plot: { x: 'Atomic radius', xUnit: 'nm', y: 'Planar density', yUnit: 'nm⁻²' },
      text: lesson(
        'Connect hard-sphere contact geometry, unit-cell packing and a specifically named dense crystal plane.',
        'Which ideal structures share the highest hard-sphere packing fraction?',
        ['FCC and HCP', 'Only BCC', 'All three equally'],
        'Both close-packed stackings occupy π/(3√2) of space.',
        'For FCC r=0.125 nm, a=2√2r≈0.35355 nm and (111) planar density≈18.475 nm⁻².',
        'FCC a=2√2r, PD111=4/(√3a²); BCC a=4r/√3, PD110=√2/a²; HCP a=2r, PD0001=2/(√3a²).',
        'Identical touching rigid spheres, ideal HCP c/a=√(8/3), no alloying or temperature effects. Planar densities refer only to the displayed crystallographic planes; they are not universal values for every plane.',
      ),
    },
    (a) => {
      const calc = (r) => {
          const lattice =
            (a.structure === 'fcc'
              ? 2 * Math.SQRT2
              : a.structure === 'bcc'
                ? 4 / Math.sqrt(3)
                : 2) * r;
          return {
            lattice,
            density:
              a.structure === 'bcc'
                ? Math.SQRT2 / lattice ** 2
                : a.structure === 'fcc'
                  ? 4 / (Math.sqrt(3) * lattice ** 2)
                  : 2 / (Math.sqrt(3) * lattice ** 2),
          };
        },
        v = calc(a.radius);
      return result(
        {
          ...v,
          packing:
            a.structure === 'bcc' ? (Math.PI * Math.sqrt(3)) / 8 : Math.PI / (3 * Math.SQRT2),
          coordination: a.structure === 'bcc' ? 8 : 12,
        },
        seq(0.08, 0.25).map((x) => ({ x, y: calc(x).density })),
        'crystal',
        { structure: a.structure, radius: a.radius },
        [
          ['Ideal HCP c/a', Math.sqrt(8 / 3)],
          [
            'Selected plane',
            a.structure === 'fcc' ? '(111)' : a.structure === 'bcc' ? '(110)' : '(0001)',
          ],
        ],
      );
    },
  ),
  schmid: make(
    {
      id: 'schmid',
      title: 'Miller Indices and Schmid’s Law',
      inputs: {
        h: integer('Plane h', -3, 3, 1),
        k: integer('Plane k', -3, 3, 1),
        l: integer('Plane l', -3, 3, 1),
        u: integer('Slip direction u', -3, 3, 1),
        v: integer('Slip direction v', -3, 3, -1),
        w: integer('Slip direction w', -3, 3, 0),
        x: p('Tensile-axis x', '1', -1, 1, 1),
        y: p('Tensile-axis y', '1', -1, 1, 0),
        z: p('Tensile-axis z', '1', -1, 1, 0),
        stress: p('Applied tensile stress', 'MPa', 0, 1000, 100),
        critical: p('Critical resolved shear stress', 'MPa', 1, 200, 20),
      },
      validateValues: domain('u', (a) => {
        requireValue(
          Math.hypot(a.h, a.k, a.l) > 0 &&
            Math.hypot(a.u, a.v, a.w) > 0 &&
            Math.hypot(a.x, a.y, a.z) > 0,
          'Plane normal, slip direction and load axis must be nonzero.',
        );
        requireValue(
          a.h * a.u + a.k * a.v + a.l * a.w === 0,
          'Slip direction [uvw] must lie in plane (hkl): hu+kv+lw=0.',
        );
      }),
      metrics: {
        factor: ['Absolute Schmid factor', '1'],
        resolved: ['Resolved shear magnitude', 'MPa'],
        yield: ['Predicted tensile slip onset', 'MPa'],
      },
      plot: { x: 'Tensile-axis rotation in xy', xUnit: 'deg', y: 'Schmid factor', yUnit: '1' },
      text: lesson(
        'Build a cubic crystal plane from Miller indices and resolve a tensile axis onto an in-plane slip direction.',
        'What is the maximum possible Schmid factor for perpendicular plane normal and slip direction?',
        ['0.5', '1', '2'],
        'Both directional cosines reach 1/√2 at the optimum orientation.',
        'For (111)[1 −1 0] loaded along [100], m=1/√6≈0.40825.',
        'm=|â·n̂||â·ŝ|; τ=σm; σslip=τCRSS/m; n·s=0.',
        'Cubic orthonormal axes, one user-selected slip system, uniaxial loading and Schmid behavior only. Miller intercepts are relative to lattice a; a zero index means an infinite intercept. No BCC non-Schmid effects, polycrystal texture or multi-slip hardening.',
      ),
    },
    (a) => {
      const n = [a.h, a.k, a.l],
        s = [a.u, a.v, a.w],
        axis = [a.x, a.y, a.z],
        dot = (u, v) => u.reduce((sum, vv, i) => sum + vv * v[i], 0),
        m = (t) =>
          Math.abs(dot(t, n) * dot(t, s)) /
          (Math.hypot(...t) ** 2 * Math.hypot(...n) * Math.hypot(...s)),
        factor = m(axis);
      return result(
        { factor, resolved: a.stress * factor, yield: factor > 1e-12 ? a.critical / factor : null },
        seq(0, 180).map((x) => ({ x, y: m([Math.cos(rad(x)), Math.sin(rad(x)), 0]) })),
        'crystal-plane',
        { normal: n, slip: s, axis },
        [
          ['Plane intercept x/a', a.h ? 1 / a.h : '∞'],
          ['Plane intercept y/a', a.k ? 1 / a.k : '∞'],
          ['Plane intercept z/a', a.l ? 1 / a.l : '∞'],
        ],
      );
    },
  ),
  laminate: make(
    {
      id: 'laminate',
      title: 'Classical Lamination Theory: ABD Coupling',
      topic: 'Composite mechanics',
      inputs: {
        angles: textInput(
          'Ply angles, bottom to top',
          '0,90,90,0',
          100,
          'Equal-thickness orthotropic plies; 1–16 angles in degrees.',
        ),
        thickness: p('Each ply thickness', 'mm', 0.05, 2, 0.125),
        E1: p('Longitudinal modulus', 'GPa', 10, 250, 135),
        E2: p('Transverse modulus', 'GPa', 1, 30, 10),
        G: p('In-plane shear modulus', 'GPa', 0.5, 20, 5),
        nu: p('Major Poisson ratio', '1', 0.05, 0.4, 0.3),
        Nx: p('Membrane force Nx', 'N/mm', -1000, 1000, 100),
        Mx: p('Moment resultant Mx', 'N', -100, 100, 0),
      },
      validateValues: domain('angles', (a) => {
        parseAngles(a.angles);
        requireValue(
          1 - (a.nu * a.nu * a.E2) / a.E1 > 0,
          'Orthotropic plane-stress compliance must be positive definite.',
        );
      }),
      metrics: {
        strain: ['Midplane εx', '1'],
        curvature: ['Curvature κx', 'mm⁻¹'],
        coupling: ['Maximum absolute Bij', 'N'],
        thickness: ['Total laminate thickness', 'mm'],
      },
      plot: { x: 'Through-thickness z', xUnit: 'mm', y: 'Global σx', yUnit: 'MPa' },
      text: lesson(
        'Transform each lamina stiffness, assemble A/B/D and solve the coupled six-component membrane–bending equilibrium.',
        'What happens to B for a symmetric layup?',
        ['It vanishes to roundoff', 'It equals D', 'It becomes singular in every case'],
        'Stiffness contributions at +z and −z cancel in the odd first moment.',
        'The symmetric [0/90/90/0] layup has B≈0; nonzero Nx produces no curvature when M=0.',
        'Aij=ΣQ̄ijΔz; Bij=½ΣQ̄ijΔ(z²); Dij=⅓ΣQ̄ijΔ(z³); [A B;B D]{ε0,κ}={N,M}.',
        'Linear plane-stress orthotropic equal-thickness plies, perfect bonding, small strain, engineering shear γxy and κxy. Top z positive; angles measured from global x. No transverse shear, thermal loading, damage or failure criterion.',
      ),
    },
    (a) => {
      const angles = parseAngles(a.angles),
        h = angles.length * a.thickness,
        A = Array.from({ length: 3 }, () => Array(3).fill(0)),
        B = A.map((r) => [...r]),
        D = A.map((r) => [...r]),
        plies = angles.map((angle, k) => {
          const low = -h / 2 + k * a.thickness,
            high = low + a.thickness,
            Q = laminateQ(a.E1 * 1000, a.E2 * 1000, a.G * 1000, a.nu, angle);
          for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
              A[i][j] += Q[i][j] * (high - low);
              B[i][j] += (Q[i][j] * (high ** 2 - low ** 2)) / 2;
              D[i][j] += (Q[i][j] * (high ** 3 - low ** 3)) / 3;
            }
          return { low, high, Q, angle };
        }),
        K = Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 6 }, (_, j) =>
            i < 3 ? (j < 3 ? A[i][j] : B[i][j - 3]) : j < 3 ? B[i - 3][j] : D[i - 3][j - 3],
          ),
        ),
        u = solveLinear(K, [a.Nx, 0, 0, a.Mx, 0, 0]),
        series = plies.flatMap((v) =>
          [v.low, v.high].map((z) => ({
            x: z,
            y: v.Q[0].reduce((s, q, j) => s + q * (u[j] + z * u[j + 3]), 0),
          })),
        );
      return {
        ...result(
          {
            strain: u[0],
            curvature: u[3],
            coupling: Math.max(...B.flat().map(Math.abs)),
            thickness: h,
          },
          series,
          'laminate',
          { angles },
          K.map((r, i) => [`ABD row ${i + 1}`, r.map((x) => x.toPrecision(6)).join(', ')]),
        ),
        matrices: { A, B, D },
        generalized: u,
      };
    },
  ),
  corrosion: make(
    {
      id: 'corrosion',
      title: 'Galvanic Corrosion and Tafel Kinetics',
      topic: 'Electrochemistry',
      inputs: {
        anode: p('Anode equilibrium potential', 'V', -1.2, 0, -0.6),
        cathode: p('Cathode equilibrium potential', 'V', 0.05, 1, 0.2),
        ia: p('Anode exchange current density', 'A/m²', 0.000001, 0.1, 0.0001),
        ic: p('Cathode exchange current density', 'A/m²', 0.000001, 0.1, 0.001),
        ba: p('Anodic Tafel slope', 'V/decade', 0.03, 0.2, 0.12),
        bc: p('Cathodic Tafel slope magnitude', 'V/decade', 0.03, 0.2, 0.12),
        ratio: p('Cathode/anode area ratio', '1', 0.1, 100, 1),
        molar: p('Dissolving metal molar mass', 'g/mol', 20, 100, 55.845),
        electrons: integer('Dissolution valence', 1, 4, 2),
        density: p('Metal density', 'g/cm³', 2, 12, 7.87),
      },
      metrics: {
        potential: ['Mixed potential', 'V'],
        current: ['Anode corrosion current density', 'A/m²'],
        penetration: ['Uniform penetration rate', 'mm/year'],
      },
      plot: {
        x: 'Potential',
        xUnit: 'V',
        y: 'log₁₀ current density',
        yUnit: 'log₁₀(A/m²)',
        traces: { y: 'Anodic branch', reference: 'Area-scaled cathodic branch' },
      },
      text: lesson(
        'Intersect anodic and cathodic activation-controlled Tafel branches with an explicit area ratio and Faraday mass balance.',
        'Increasing the cathode/anode area ratio generally changes the anode attack rate how?',
        ['Increases it', 'Decreases it', 'Makes it identically zero'],
        'A small anode must supply the cathodic current from a larger area.',
        'Equal slopes and exchange currents with equal areas put the mixed potential halfway between the two equilibrium potentials.',
        'log ia=log i0a+(E−Ea)/ba; log(ic Ac/Aa)=log(i0c Ac/Aa)−(E−Ec)/bc; penetration=iM/(nFρ).',
        'Ideal activation-only Tafel extrapolation, no passivation, diffusion limiting current, electrolyte resistance or protective films. Potentials share one reference. Uniform loss is an equivalent thickness, not a pitting prediction. Both exchange parameters require calibration.',
      ),
    },
    (a) => {
      const E =
          (Math.log10((a.ic * a.ratio) / a.ia) + a.anode / a.ba + a.cathode / a.bc) /
          (1 / a.ba + 1 / a.bc),
        current = a.ia * 10 ** ((E - a.anode) / a.ba),
        penetration =
          ((current * (a.molar / 1000)) / (a.electrons * 96485.33212 * (a.density * 1000))) *
          365.25 *
          86400 *
          1000;
      return result(
        { potential: E, current, penetration },
        seq(a.anode, a.cathode).map((x) => ({
          x,
          y: Math.log10(a.ia) + (x - a.anode) / a.ba,
          reference: Math.log10(a.ic * a.ratio) - (x - a.cathode) / a.bc,
        })),
        'corrosion',
        { potential: E, current, ratio: a.ratio },
        [
          ['Faraday constant C/mol', 96485.33212],
          ['Current balance A/m²', current - a.ic * a.ratio * 10 ** (-(E - a.cathode) / a.bc)],
        ],
      );
    },
  ),
  relaxation: make(
    {
      id: 'relaxation',
      title: 'Maxwell and Standard-Linear-Solid Stress Relaxation',
      topic: 'Viscoelasticity',
      inputs: {
        model: choice(
          'Network',
          {
            maxwell: 'Maxwell series spring–dashpot',
            sls: 'SLS: Maxwell branch parallel to equilibrium spring',
          },
          'sls',
        ),
        equilibrium: p('Equilibrium spring E∞', 'MPa', 1, 1000, 100),
        branch: p('Maxwell branch modulus E1', 'MPa', 1, 2000, 300),
        viscosity: p('Dashpot viscosity η', 'MPa·s', 10, 100000, 3000),
        strain: p('Step strain', '1', 0.001, 0.1, 0.01),
        time: p('Inspect time', 's', 0, 1000, 20),
      },
      metrics: {
        stress: ['Relaxation stress', 'MPa'],
        initial: ['Initial stress', 'MPa'],
        residual: ['Long-time stress', 'MPa'],
        tau: ['Relaxation time', 's'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Stress',
        yUnit: 'MPa',
        traces: { y: 'Relaxation stress', reference: 'Equilibrium stress' },
      },
      text: lesson(
        'Apply a held strain step to two physically distinct linear viscoelastic networks.',
        'Which model retains a nonzero stress after a long held strain?',
        ['SLS with an equilibrium spring', 'A Maxwell element alone', 'Neither ever relaxes'],
        'The equilibrium spring carries load after the Maxwell branch has relaxed.',
        'E∞=100 MPa, E1=300 MPa and ε0=0.01 give σ(0+)=4 MPa and σ(∞)=1 MPa for SLS.',
        'τ=η/E1; σMaxwell=ε0E1e^(−t/τ); σSLS=ε0(E∞+E1e^(−t/τ)).',
        'Ideal instantaneous step strain, small-strain linear viscoelasticity and constant temperature. The SLS topology is explicitly a Maxwell arm in parallel with E∞. No nonlinear creep, damage or multiple relaxation spectrum.',
      ),
    },
    (a) => {
      const tau = a.viscosity / a.branch,
        E = a.model === 'sls' ? a.equilibrium : 0,
        stress = (t) => a.strain * (E + a.branch * Math.exp(-t / tau));
      return result(
        { stress: stress(a.time), initial: stress(0), residual: a.strain * E, tau },
        seq(0, Math.max(5 * tau, a.time)).map((x) => ({
          x,
          y: stress(x),
          reference: a.strain * E,
        })),
        'rheology',
        { model: a.model, strain: a.strain },
        [
          ['Network', a.model],
          ['Held strain', a.strain],
        ],
      );
    },
  ),
  thermalshock: make(
    {
      id: 'thermalshock',
      title: 'Ceramic Thermal Shock Resistance',
      inputs: {
        strength: p('Tensile fracture strength', 'MPa', 10, 1000, 200),
        modulus: p('Young modulus', 'GPa', 20, 500, 300),
        poisson: p('Poisson ratio', '1', 0.1, 0.4, 0.22),
        expansion: p('Thermal expansion coefficient', 'µm/(m·K)', 1, 20, 7),
        conductivity: p('Thermal conductivity', 'W/(m·K)', 1, 300, 25),
        jump: p('Surface-to-interior temperature difference', 'K', 0, 1000, 100),
        constraint: p('Effective thermal constraint factor', '1', 0.05, 1, 1),
      },
      metrics: {
        stress: ['Estimated thermal tensile stress', 'MPa'],
        critical: ['Critical temperature difference', 'K'],
        Rprime: ['Conductivity-weighted resistance R′', 'W/m'],
        utilization: ['Thermal stress / strength', '1'],
      },
      plot: { x: 'Temperature difference', xUnit: 'K', y: 'Thermal tensile stress', yUnit: 'MPa' },
      text: lesson(
        'Compare brittle strength with a bounded thermal-stress estimate and the conventional R and R′ thermal-shock parameters.',
        'At fixed strength, a smaller expansion coefficient changes critical ΔT how?',
        ['Increases it', 'Decreases it', 'Leaves it fixed'],
        'Thermal stress is proportional to αΔT.',
        'σf=200 MPa, ν=0.22, E=300 GPa and α=7×10⁻⁶/K give R≈74.286 K at full constraint.',
        'σth=χEαΔT/(1−ν); R=σf(1−ν)/(Eα); ΔTcrit=R/χ; R′=kR.',
        'Screening estimate for a uniform isotropic brittle solid. Constraint factor χ is supplied, not inferred from a transient temperature field. R′ is not a complete crack-propagation or heat-transfer solution. Size, flaws, temperature-dependent properties and quench geometry require separate analysis.',
      ),
    },
    (a) => {
      const slope = (a.constraint * a.modulus * 1000 * a.expansion * 1e-6) / (1 - a.poisson),
        R = (a.strength * (1 - a.poisson)) / (a.modulus * 1000 * a.expansion * 1e-6);
      return result(
        {
          stress: slope * a.jump,
          critical: R / a.constraint,
          Rprime: a.conductivity * R,
          utilization: (slope * a.jump) / a.strength,
        },
        seq(0, 1000).map((x) => ({ x, y: slope * x })),
        'thermal-wall',
        { hot: a.jump, cold: 0 },
        [
          ['Unmodified R (K)', R],
          ['Constraint χ', a.constraint],
        ],
      );
    },
  ),
};

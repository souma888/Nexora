import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  teaching,
  output,
  bisect,
  domain,
  requireValue,
  mean,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'chemical', topic: 'Separation & reaction engineering', ...config }, solve);
export const equilibriumY = (x, alpha) => (alpha * x) / (1 + (alpha - 1) * x);
export function flashState(z, K1, K2) {
  const f = (v) => (z * (K1 - 1)) / (1 + v * (K1 - 1)) + ((1 - z) * (K2 - 1)) / (1 + v * (K2 - 1));
  if (f(0) <= 0) return { fraction: 0, x: z, y: null, phase: 'Liquid only' };
  if (f(1) >= 0) return { fraction: 1, x: null, y: z, phase: 'Vapor only' };
  const fraction = bisect(f, 0, 1),
    x = z / (1 + fraction * (K1 - 1));
  return { fraction, x, y: K1 * x, phase: 'Two phase' };
}
export function distillation(alpha, feed, distillate, bottoms, reflux) {
  const qY = (reflux / (reflux + 1)) * feed + distillate / (reflux + 1),
    rect = (x) => (reflux / (reflux + 1)) * x + distillate / (reflux + 1),
    slope = (qY - bottoms) / (feed - bottoms),
    strip = (x) => bottoms + slope * (x - bottoms),
    stairs = [[distillate, distillate]];
  let y = distillate,
    count = 0;
  while (count < 120) {
    const x = y / (alpha - (alpha - 1) * y);
    stairs.push([x, y]);
    count++;
    if (x <= bottoms) break;
    const next = x >= feed ? rect(x) : strip(x);
    stairs.push([x, next]);
    if (Math.abs(next - y) < 1e-10) break;
    y = next;
  }
  return { stages: stairs.at(-1)[0] <= bottoms ? count : null, stairs, qY, slope };
}
export const processModels = {
  batchorder: make(
    {
      id: 'batchorder',
      title: 'Batch Reactor Kinetics and Reaction Order',
      inputs: {
        order: choice('Synthetic kinetic order', ['zero', 'first', 'second'], 'first'),
        initial: p('Initial concentration', 'mol/L', 0.5, 5, 2),
        rate: p('Rate constant in order-specific units', '1', 0.01, 0.3, 0.1),
        duration: p('Observation duration', 's', 1, 20, 10),
      },
      metrics: {
        final: ['Final concentration', 'mol/L'],
        estimated: ['Best linearized order (0, 1 or 2)', '1'],
        fit: ['Selected linearized fit R²', '1'],
      },
      plot: { x: 'Batch time', xUnit: 's', y: 'Concentration', yUnit: 'mol/L' },
      text: teaching(
        'Generate ideal batch data and compare the three integrated-rate-law linearizations to identify kinetic order.',
        'Which transformation is linear for a second-order batch reaction?',
        ['1/C versus time', 'C versus time', 'ln C versus time'],
        'Integrating dC/dt=−kC² yields 1/C−1/C₀=kt.',
        'For first-order k=.1 s⁻¹, C₀=2 mol/L, C(10)=2e⁻¹=.735759 mol/L.',
        'Zero: C=C₀−kt; first: ln C=ln C₀−kt; second: 1/C=1/C₀+kt.',
        'Isothermal constant-volume single irreversible reactant, noiseless synthetic measurements. Rate-constant units depend on selected order. Zero-order concentration stops at depletion; depleted points are excluded from logarithmic fits.',
      ),
    },
    (a) => {
      const n = { zero: 0, first: 1, second: 2 }[a.order],
        f = (t) =>
          n === 0
            ? Math.max(0, a.initial - a.rate * t)
            : n === 1
              ? a.initial * Math.exp(-a.rate * t)
              : a.initial / (1 + a.rate * a.initial * t),
        s = seq(0, a.duration, 100).map((x) => ({ x, y: f(x) })),
        data = s.filter((v) => v.y > 1e-8),
        mx = mean(data.map((v) => v.x)),
        fits = [(v) => v, (v) => Math.log(v), (v) => 1 / v].map((transform, order) => {
          const ys = data.map((v) => transform(v.y)),
            my = mean(ys),
            sxx = data.reduce((s, v) => s + (v.x - mx) ** 2, 0),
            sxy = data.reduce((s, v, i) => s + (v.x - mx) * (ys[i] - my), 0),
            syy = ys.reduce((s, v) => s + (v - my) ** 2, 0);
          return { order, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
        }),
        best = fits.reduce((x, y) => (x.r2 > y.r2 ? x : y));
      return output(
        { final: f(a.duration), estimated: best.order, fit: best.r2 },
        s,
        'reactor',
        { ...a },
        fits.map((v) => [`Order ${v.order} linearization R²`, v.r2]),
      );
    },
  ),
  vantHoff: make(
    {
      id: 'vantHoff',
      title: 'Equilibrium Constant and Temperature',
      inputs: {
        reference: p('Equilibrium constant at Tref', '1', 0.01, 100, 2),
        temperature: p('Selected temperature', 'K', 280, 900, 500),
        referenceT: p('Reference temperature', 'K', 280, 600, 400),
        enthalpy: p('Reaction enthalpy', 'kJ/mol', -100, 100, 40),
      },
      metrics: {
        constant: ['Equilibrium constant at selected T', '1'],
        conversion: ['A ⇌ B equilibrium B fraction', '1'],
        slope: ['d lnK / dT at selected T', 'K⁻¹'],
      },
      plot: { x: 'Temperature', xUnit: 'K', y: 'Equilibrium constant', yUnit: '1' },
      text: teaching(
        'Apply the integrated van ’t Hoff relation and inspect how endothermic and exothermic equilibria shift.',
        'Does heating increase K for an endothermic reaction?',
        ['Yes', 'No', 'Only if K starts above one'],
        'A positive reaction enthalpy gives a positive derivative of ln K with temperature.',
        'ΔH=0 gives K independent of temperature; K(Tref) equals the specified reference value.',
        'ln[K(T)/Kref]=−ΔH/R(1/T−1/Tref); for ideal A⇌B, xB=K/(1+K).',
        'Constant standard reaction enthalpy and ideal one-to-one isomerization. No heat-capacity correction, pressure effects, activity coefficients or general multicomponent equilibrium calculation.',
      ),
    },
    (a) => {
      const k = (T) =>
          a.reference * Math.exp(((-a.enthalpy * 1000) / 8.314462618) * (1 / T - 1 / a.referenceT)),
        constant = k(a.temperature);
      return output(
        {
          constant,
          conversion: constant / (1 + constant),
          slope: (a.enthalpy * 1000) / (8.314462618 * a.temperature ** 2),
        },
        seq(280, 900, 200).map((x) => ({ x, y: k(x) })),
        'equilibrium',
        { ...a },
      );
    },
  ),
  mccabethiele: make(
    {
      id: 'mccabethiele',
      title: 'McCabe–Thiele Distillation Staging',
      inputs: {
        alpha: p('Constant relative volatility', '1', 1.2, 5, 2.5),
        feed: p('Saturated-liquid feed composition zF', '1', 0.1, 0.8, 0.4),
        distillate: p('Distillate light fraction xD', '1', 0.6, 0.99, 0.95),
        bottoms: p('Bottoms light fraction xB', '1', 0.01, 0.3, 0.05),
        reflux: p('Reflux ratio R', '1', 0.5, 10, 3),
      },
      validateValues: domain('reflux', (a) => {
        requireValue(a.bottoms < a.feed && a.feed < a.distillate, 'Require xB < zF < xD.');
        const y = equilibriumY(a.feed, a.alpha),
          rmin = (a.distillate - y) / (y - a.feed);
        requireValue(
          a.reflux > Math.max(0, rmin),
          'Reflux is at or below the feed-pinch minimum for these compositions.',
        );
      }),
      metrics: {
        stages: ['Ideal stages including partial reboiler', '1'],
        minimum: ['Feed-pinch minimum reflux', '1'],
        distillate: ['Distillate/feed molar ratio', '1'],
      },
      plot: {
        x: 'Liquid light-component fraction',
        xUnit: '1',
        y: 'Vapor light-component fraction',
        yUnit: '1',
        traces: { y: 'Equilibrium', reference: 'Rectifying line', third: 'Stripping line' },
      },
      text: teaching(
        'Step horizontally to binary equilibrium and vertically to the appropriate operating line, switching at the saturated-liquid feed.',
        'Does the stage count diverge near minimum reflux?',
        ['Yes', 'No', 'It becomes zero'],
        'The operating and equilibrium curves pinch and each stage makes vanishing composition progress.',
        'For xF=.4, xD=.95, xB=.05, material balance gives D/F=(.4−.05)/(.95−.05)=.388889.',
        'y*=αx/[1+(α−1)x]; yR=Rx/(R+1)+xD/(R+1); D/F=(zF−xB)/(xD−xB).',
        'Constant relative volatility, constant molar overflow, saturated-liquid feed q=1, total condenser not counted and partial reboiler counted. Staging capped at 120; null indicates the cap/pinch. No tray efficiencies or energy balances.',
      ),
    },
    (a) => {
      const r = distillation(a.alpha, a.feed, a.distillate, a.bottoms, a.reflux),
        yf = equilibriumY(a.feed, a.alpha);
      return output(
        {
          stages: r.stages,
          minimum: Math.max(0, (a.distillate - yf) / (yf - a.feed)),
          distillate: (a.feed - a.bottoms) / (a.distillate - a.bottoms),
        },
        seq(0, 1, 200).map((x) => ({
          x,
          y: equilibriumY(x, a.alpha),
          reference:
            x >= a.feed && x <= a.distillate
              ? (a.reflux / (a.reflux + 1)) * x + a.distillate / (a.reflux + 1)
              : null,
          third: x >= a.bottoms && x <= a.feed ? a.bottoms + r.slope * (x - a.bottoms) : null,
        })),
        'distillation',
        { stairs: r.stairs },
      );
    },
  ),
  binaryflash: make(
    {
      id: 'binaryflash',
      title: 'Binary Flash and Raoult’s Law',
      inputs: {
        temperature: p('Flash temperature', '°C', 60, 120, 95),
        pressure: p('Absolute pressure', 'kPa', 50, 200, 101.325),
        feed: p('Feed benzene mole fraction', '1', 0.05, 0.95, 0.5),
      },
      metrics: {
        vapor: ['Vaporized feed fraction', '1'],
        liquid: ['Liquid benzene fraction, if present', '1'],
        gas: ['Vapor benzene fraction, if present', '1'],
        balance: ['Benzene material-balance residual', '1'],
      },
      plot: { x: 'Temperature', xUnit: '°C', y: 'Vapor fraction', yUnit: '1' },
      text: teaching(
        'Solve the binary Rachford–Rice equation from temperature-dependent benzene/toluene vapor pressures and detect single-phase states.',
        'Must every feed split into liquid and vapor?',
        ['No', 'Yes', 'Only equimolar feeds do'],
        'Bubble/dew inequalities determine whether a two-phase root exists.',
        'At phase split, z=V y+(1−V)x and yi=Ki xi with Ki=Psat/P.',
        'Σ zi(Ki−1)/[1+V(Ki−1)]=0; log10 Psat(mmHg)=A−B/(T°C+C).',
        'Ideal liquid Raoult law and ideal vapor; benzene/toluene Antoine coefficients used only over 60…120°C. No enthalpy balance or nonideal activity correction. Absent-phase composition is null.',
      ),
    },
    (a) => {
      const k = (T) => [
          (10 ** (6.90565 - 1211.033 / (T + 220.79)) * 0.133322368) / a.pressure,
          (10 ** (6.95464 - 1344.8 / (T + 219.48)) * 0.133322368) / a.pressure,
        ],
        r = flashState(a.feed, ...k(a.temperature)),
        balance = (1 - r.fraction) * (r.x ?? 0) + r.fraction * (r.y ?? 0) - a.feed;
      return output(
        { vapor: r.fraction, liquid: r.x, gas: r.y, balance },
        seq(60, 120).map((x) => ({ x, y: flashState(a.feed, ...k(x)).fraction })),
        'flash',
        { ...r, ...a },
        [['Phase state', r.phase]],
      );
    },
  ),
  absorptionntu: make(
    {
      id: 'absorptionntu',
      title: 'Gas Absorption Column: NTU and HTU',
      inputs: {
        inlet: p('Inlet solute gas ratio Yin', 'mol/mol inert', 0.02, 0.3, 0.1),
        outlet: p('Outlet solute gas ratio Yout', 'mol/mol inert', 0.001, 0.1, 0.01),
        solvent: p('Entering liquid solute ratio Xin', 'mol/mol solvent', 0, 0.01, 0),
        slope: p('Equilibrium slope m', '1', 0.2, 3, 1),
        ratio: p('Liquid/gas carrier flow L/G', '1', 0.5, 5, 2),
        htu: p('Overall gas HTU', 'm', 0.1, 3, 0.6),
      },
      validateValues: domain('ratio', (a) => {
        requireValue(a.inlet > a.outlet, 'Gas inlet ratio must exceed outlet ratio.');
        requireValue(a.outlet > a.slope * a.solvent, 'Lean-end driving force must be positive.');
        requireValue(
          a.inlet > a.slope * (a.solvent + (a.inlet - a.outlet) / a.ratio),
          'Rich-end driving force must be positive; increase L/G.',
        );
      }),
      metrics: {
        ntu: ['Overall gas transfer units', '1'],
        height: ['Required packed height', 'm'],
        rich: ['Leaving liquid solute ratio', 'mol/mol solvent'],
      },
      plot: {
        x: 'Gas solute ratio Y',
        xUnit: 'mol/mol inert',
        y: 'Local driving force Y−Y*',
        yUnit: '1',
      },
      text: teaching(
        'Integrate the gas-side driving-force reciprocal along the operating line for countercurrent dilute absorption.',
        'What happens as the equilibrium pinch is approached?',
        ['Required NTU grows without bound', 'NTU becomes zero', 'The column height is unchanged'],
        'A vanishing concentration driving force requires unbounded contacting height.',
        'For m=1, L/G=2, Xin=0, Yin=.1 and Yout=.01: NTU=2ln(5.5)=3.40950; at HTU=.6 m, height=2.04570 m.',
        'X=Xin+(Y−Yout)/(L/G); NOG=∫dY/[Y−mX(Y)]; Z=HOG NOG.',
        'Constant carrier flow rates and HTU, dilute linear equilibrium in solute-free ratios. No flooding, pressure-drop coupling, varying properties or solvent heat effects.',
      ),
    },
    (a) => {
      const A = 1 - a.slope / a.ratio,
        B = a.slope * (a.outlet / a.ratio - a.solvent),
        f = (y) => A * y + B,
        ntu =
          Math.abs(A) < 1e-10 ? (a.inlet - a.outlet) / B : Math.log(f(a.inlet) / f(a.outlet)) / A;
      return output(
        { ntu, height: ntu * a.htu, rich: a.solvent + (a.inlet - a.outlet) / a.ratio },
        seq(a.outlet, a.inlet).map((x) => ({ x, y: f(x) })),
        'packed-column',
        { ...a },
      );
    },
  ),
  ergunbed: make(
    {
      id: 'ergunbed',
      title: 'Packed-Bed Pressure Drop by Ergun',
      inputs: {
        diameter: p('Particle diameter', 'mm', 0.2, 10, 3),
        porosity: p('Bed void fraction', '1', 0.25, 0.65, 0.4),
        density: p('Fluid density', 'kg/m³', 1, 1200, 1000),
        viscosity: p('Dynamic viscosity', 'mPa·s', 0.01, 10, 1),
        velocity: p('Superficial velocity', 'm/s', 0.001, 1, 0.05),
        length: p('Bed length', 'm', 0.1, 10, 1),
      },
      metrics: {
        drop: ['Total bed pressure drop', 'kPa'],
        viscous: ['Viscous contribution', 'kPa'],
        inertial: ['Inertial contribution', 'kPa'],
        reynolds: ['Particle Reynolds number', '1'],
      },
      plot: {
        x: 'Superficial velocity',
        xUnit: 'm/s',
        y: 'Pressure gradient',
        yUnit: 'kPa/m',
        traces: { y: 'Total', reference: 'Viscous term', third: 'Inertial term' },
      },
      text: teaching(
        'Separate the viscous and inertial resistance terms of a fixed granular bed.',
        'At high superficial velocity, which Ergun term grows faster?',
        ['The inertial quadratic term', 'The viscous linear term', 'Both are constant'],
        'The first term is proportional to velocity and the second to velocity squared.',
        'Doubling bed length doubles pressure drop at fixed properties and velocity.',
        'ΔP/L=150μ(1−ε)²u/(ε³dp²)+1.75ρ(1−ε)u²/(ε³dp).',
        'Incompressible fixed bed of approximately spherical particles with uniform porosity. No fluidization, gas density change, wall correction or particle-size distribution.',
      ),
    },
    (a) => {
      const d = a.diameter / 1000,
        mu = a.viscosity / 1000,
        A = (150 * mu * (1 - a.porosity) ** 2) / (a.porosity ** 3 * d * d),
        B = (1.75 * a.density * (1 - a.porosity)) / (a.porosity ** 3 * d);
      return output(
        {
          drop: ((A * a.velocity + B * a.velocity ** 2) * a.length) / 1000,
          viscous: (A * a.velocity * a.length) / 1000,
          inertial: (B * a.velocity ** 2 * a.length) / 1000,
          reynolds: (a.density * a.velocity * d) / mu,
        },
        seq(0, Math.max(0.1, a.velocity * 1.5)).map((x) => ({
          x,
          y: (A * x + B * x * x) / 1000,
          reference: (A * x) / 1000,
          third: (B * x * x) / 1000,
        })),
        'packed-column',
        { ...a },
      );
    },
  ),
  tanksrtd: make(
    {
      id: 'tanksrtd',
      title: 'Residence Time Distribution and Tanks-in-Series',
      inputs: {
        tanks: integer('Equal ideal stirred tanks', 1, 12, 3),
        mean: p('Mean total residence time', 's', 1, 100, 20),
      },
      metrics: {
        mean: ['Analytical mean residence time', 's'],
        variance: ['Analytical RTD variance', 's²'],
        area: ['Sampled E(t) integral', '1'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Impulse residence-time density E(t)', yUnit: 's⁻¹' },
      text: teaching(
        'Compare the gamma-distributed pulse response of a cascade of equal CSTRs as it approaches plug flow.',
        'What happens to RTD variance when N grows at fixed total mean?',
        ['It decreases as 1/N', 'It increases as N', 'It remains constant'],
        'Many small stirred stages reduce backmixing and narrow the residence distribution.',
        'N=1 gives E(t)=exp(−t/τ)/τ, mean τ and variance τ².',
        'E(t)=(N/τ)ᴺtᴺ⁻¹exp(−Nt/τ)/(N−1)!; variance=τ²/N.',
        'Noninteracting ideal equal-volume CSTRs at constant flow, no dead zones or bypass. Density is plotted to 8 mean times; finite sampled area is reported to reveal truncation/discretization.',
      ),
    },
    (a) => {
      const factorial = Array.from({ length: a.tanks - 1 }, (_, i) => i + 1).reduce(
          (s, v) => s * v,
          1,
        ),
        f = (t) =>
          ((a.tanks / a.mean) ** a.tanks * t ** (a.tanks - 1) * Math.exp((-a.tanks * t) / a.mean)) /
          factorial,
        s = seq(0, 8 * a.mean, 800).map((x) => ({ x, y: f(x) })),
        area = s.slice(1).reduce((sum, v, i) => sum + ((v.y + s[i].y) * (v.x - s[i].x)) / 2, 0);
      return output(
        { mean: a.mean, variance: (a.mean * a.mean) / a.tanks, area },
        s,
        'reactor-cascade',
        { tanks: a.tanks },
      );
    },
  ),
};

import {
  engineering,
  p,
  choice,
  seq,
  bisect,
  lesson,
  domain,
  requireValue,
  result,
} from './engineering-kit.js';
import { wallModes, wallTheta, hardyLoop } from './thermal-engine.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'thermofluids', topic: 'Heat transfer', ...config }, solve);
const SIGMA = 5.670374419e-8;
export function finState(a, x) {
  const Ac = a.width * a.thickness,
    P = 2 * (a.width + a.thickness),
    m = Math.sqrt((a.h * P) / (a.conductivity * Ac)),
    beta = a.tip === 'convective' ? a.h / (m * a.conductivity) : 0,
    r = (1 - beta) / (1 + beta),
    e = Math.exp(-2 * m * a.length),
    ratio = (Math.exp(-m * x) + r * Math.exp(-m * (2 * a.length - x))) / (1 + r * e),
    heat = (a.conductivity * Ac * m * (a.base - a.ambient) * (1 - r * e)) / (1 + r * e);
  return { ratio, heat, m, Ac, P };
}
export const heatFlowModels = {
  fin: make(
    {
      id: 'fin',
      title: 'Fin Heat Transfer and Efficiency',
      inputs: {
        length: p('Straight fin length', 'm', 0.01, 0.5, 0.1),
        width: p('Fin width', 'm', 0.01, 0.2, 0.05),
        thickness: p('Fin thickness', 'm', 0.001, 0.01, 0.002),
        conductivity: p('Thermal conductivity', 'W/(m·K)', 1, 400, 200),
        h: p('Convection coefficient', 'W/(m²·K)', 5, 500, 25),
        base: p('Base temperature', '°C', 40, 200, 100),
        ambient: p('Ambient temperature', '°C', 0, 35, 20),
        tip: choice(
          'Tip condition',
          { adiabatic: 'Insulated tip', convective: 'Convecting tip' },
          'convective',
        ),
      },
      metrics: {
        heat: ['Fin heat removal', 'W'],
        efficiency: ['Fin efficiency', '1'],
        effectiveness: ['Fin effectiveness', '1'],
        tip: ['Tip temperature', '°C'],
      },
      plot: { x: 'Distance from base', xUnit: 'm', y: 'Temperature', yUnit: '°C' },
      text: lesson(
        'Solve a constant-area straight fin with a real insulated or convective tip boundary, using overflow-safe exponentials.',
        'Increasing fin length indefinitely keeps increasing heat removal linearly?',
        [
          'No, it approaches a limiting value',
          'Yes, without a limit',
          'Heat removal becomes negative',
        ],
        'A very long fin adds surface near ambient with little extra temperature driving force.',
        'For an insulated fin, q=kAc mθb tanh(mL).',
        'm²=hP/(kAc); θ/θb=[e^(−mx)+r e^(−m(2L−x))]/[1+r e^(−2mL)], r=(1−β)/(1+β); β=htip/(mk).',
        'One-dimensional steady conduction, constant k and h, rectangular cross-section, uniform base temperature and no radiation/contact resistance. Fin efficiency uses lateral area plus exposed tip only for the convective-tip case.',
      ),
    },
    (a) => {
      const r = finState(a, 0),
        area = r.P * a.length + (a.tip === 'convective' ? r.Ac : 0),
        tip = a.ambient + (a.base - a.ambient) * finState(a, a.length).ratio;
      return result(
        {
          heat: r.heat,
          efficiency: r.heat / (a.h * area * (a.base - a.ambient)),
          effectiveness: r.heat / (a.h * r.Ac * (a.base - a.ambient)),
          tip,
        },
        seq(0, a.length).map((x) => ({
          x,
          y: a.ambient + (a.base - a.ambient) * finState(a, x).ratio,
        })),
        'fin',
        { ...a },
        [
          ['Fin parameter mL', r.m * a.length],
          ['Exposed area m²', area],
        ],
      );
    },
  ),
  heisler: make(
    {
      id: 'heisler',
      title: 'Transient Plane-Wall Conduction and Heisler Approximation',
      inputs: {
        biot: p('Biot number hL/k', '1', 0.01, 100, 1),
        fourier: p('Fourier number αt/L²', '1', 0.02, 2, 0.2),
        half: p('Wall half-thickness L', 'mm', 1, 100, 10),
        diffusivity: p('Thermal diffusivity', 'mm²/s', 0.1, 100, 10),
        initial: p('Uniform initial temperature', '°C', 50, 500, 200),
        ambient: p('Surrounding temperature', '°C', 0, 40, 20),
      },
      metrics: {
        center: ['Center temperature, 40-term series', '°C'],
        surface: ['Surface temperature', '°C'],
        average: ['Volume-average temperature', '°C'],
        time: ['Elapsed time', 's'],
      },
      plot: {
        x: 'Normalized half-wall coordinate x/L',
        xUnit: '1',
        y: 'Temperature',
        yUnit: '°C',
        traces: { y: '40-term solution', reference: 'One-term Heisler approximation' },
      },
      text: lesson(
        'Solve the convectively cooled plane-wall eigenvalue problem and compare its series with the usual one-term chart approximation.',
        'At small Bi, what happens to the wall temperature profile?',
        [
          'It becomes nearly uniform',
          'Its surface stays permanently at ambient',
          'The center instantly reaches ambient',
        ],
        'Low internal resistance makes lumped-capacitance behavior plausible.',
        'At Bi=1 the first eigenvalue satisfies ζtanζ=1 and is approximately 0.860334.',
        'ζn tanζn=Bi; θ*=Σ[4sinζn/(2ζn+sin2ζn)] exp(−ζn²Fo) cos(ζn x/L).',
        'Infinite plane wall of thickness 2L, identical convection on both faces, constant properties, initially uniform temperature. 40 terms; Fo≥0.02 keeps truncation controlled. The one-term Heisler approximation is normally used for Fo≥0.2 and is explicitly flagged below that. No cylinder/sphere substitution.',
      ),
    },
    (a) => {
      const modes = wallModes(a.biot),
        T = (q) => a.ambient + (a.initial - a.ambient) * q,
        average = modes.reduce(
          (s, { z, A }) => s + (A * Math.exp(-z * z * a.fourier) * Math.sin(z)) / z,
          0,
        ),
        series = seq(0, 1).map((x) => ({
          x,
          y: T(wallTheta(modes, a.fourier, x)),
          reference: T(wallTheta(modes.slice(0, 1), a.fourier, x)),
        }));
      return result(
        {
          center: T(wallTheta(modes, a.fourier)),
          surface: T(wallTheta(modes, a.fourier, 1)),
          average: T(average),
          time: (a.fourier * a.half * a.half) / a.diffusivity,
        },
        series,
        'thermal-wall',
        { hot: a.initial, cold: a.ambient, profile: series },
        [
          ['First eigenvalue', modes[0].z],
          ['First coefficient', modes[0].A],
        ],
        a.fourier < 0.2
          ? ['Fo<0.2: do not treat the one-term approximation as the converged series.']
          : [],
      );
    },
  ),
  radiation: make(
    {
      id: 'radiation',
      title: 'Radiation Exchange and View Factors',
      inputs: {
        first: p('Surface 1 temperature', 'K', 300, 1200, 600),
        second: p('Surface 2 temperature', 'K', 250, 800, 300),
        area1: p('Surface 1 area', 'm²', 0.1, 10, 1),
        area2: p('Surface 2 area', 'm²', 0.1, 10, 1),
        view: p('View factor F12', '1', 0.05, 1, 1),
        emissivity1: p('Surface 1 emissivity', '1', 0.05, 1, 0.8),
        emissivity2: p('Surface 2 emissivity', '1', 0.05, 1, 0.8),
      },
      validateValues: domain('view', (a) =>
        requireValue(a.area1 * a.view <= a.area2, 'Reciprocity requires F21=A1 F12/A2 ≤1.'),
      ),
      metrics: {
        heat: ['Net heat 1→2', 'W'],
        reverse: ['Reciprocal view factor F21', '1'],
        resistance: ['Radiation-network resistance', 'm⁻²'],
        black: ['Black-surface exchange limit', 'W'],
      },
      plot: { x: 'Surface 1 temperature', xUnit: 'K', y: 'Net radiative heat', yUnit: 'W' },
      text: lesson(
        'Solve a diffuse-gray two-surface enclosure using surface and space resistances and reciprocal view factors.',
        'Can F12 and F21 be chosen independently?',
        ['No, A1F12=A2F21', 'Yes, always', 'Only if both are zero'],
        'Reciprocity fixes the reverse geometric coupling.',
        'For equal 1 m² black surfaces at 600/300 K with F12=1, Q=σ(600⁴−300⁴)≈6889.5 W.',
        'Q=σ(T1⁴−T2⁴)/[(1−ε1)/(A1ε1)+1/(A1F12)+(1−ε2)/(A2ε2)].',
        'Closed two-surface diffuse-gray enclosure. Any remaining factors are self-view F11=1−F12 and F22=1−F21; such geometry can require concave surfaces. This is not two finite plates radiating independently to an unmodeled room. No conduction, convection or wavelength dependence.',
      ),
    },
    (a) => {
      const R =
          (1 - a.emissivity1) / (a.area1 * a.emissivity1) +
          1 / (a.area1 * a.view) +
          (1 - a.emissivity2) / (a.area2 * a.emissivity2),
        Q = (T) => (SIGMA * (T ** 4 - a.second ** 4)) / R;
      return result(
        {
          heat: Q(a.first),
          reverse: (a.area1 * a.view) / a.area2,
          resistance: R,
          black: SIGMA * a.area1 * a.view * (a.first ** 4 - a.second ** 4),
        },
        seq(250, 1200).map((x) => ({ x, y: Q(x) })),
        'radiation',
        { first: a.first, second: a.second, view: a.view },
        [
          ['F11', 1 - a.view],
          ['F22', 1 - (a.area1 * a.view) / a.area2],
        ],
      );
    },
  ),
  convection: make(
    {
      id: 'convection',
      title: 'Convection Correlations: Nu, Re and Pr',
      inputs: {
        mode: choice(
          'Correlation',
          {
            laminar: 'Fully developed laminar tube, constant wall T',
            turbulent: 'Dittus–Boelter turbulent tube',
            plate: 'Average laminar isothermal flat plate',
          },
          'turbulent',
        ),
        velocity: p('Mean/free-stream velocity', 'm/s', 0.01, 10, 2),
        length: p('Tube diameter / plate length', 'm', 0.005, 1, 0.05),
        density: p('Fluid density', 'kg/m³', 0.5, 1200, 998),
        viscosity: p('Dynamic viscosity', 'Pa·s', 0.00001, 0.01, 0.001),
        conductivity: p('Fluid conductivity', 'W/(m·K)', 0.02, 1, 0.6),
        capacity: p('Specific heat', 'J/(kg·K)', 500, 4500, 4180),
        heating: choice(
          'Tube fluid is',
          { yes: 'Being heated (n=0.4)', no: 'Being cooled (n=0.3)' },
          'yes',
        ),
      },
      validateValues: domain('velocity', (a) => {
        const Re = (a.density * a.velocity * a.length) / a.viscosity,
          Pr = (a.capacity * a.viscosity) / a.conductivity;
        requireValue(
          a.mode === 'laminar'
            ? Re < 2300
            : a.mode === 'turbulent'
              ? Re >= 10000 && Re <= 1e6 && Pr >= 0.7 && Pr <= 160
              : Re <= 5e5 && Pr >= 0.6 && Pr <= 50,
          'Selected correlation is outside its Reynolds/Prandtl validity range; see model notes.',
        );
      }),
      metrics: {
        reynolds: ['Reynolds number', '1'],
        prandtl: ['Prandtl number', '1'],
        nusselt: ['Nusselt number', '1'],
        coefficient: ['Heat-transfer coefficient', 'W/(m²·K)'],
      },
      plot: { x: 'Reynolds number', xUnit: '1', y: 'Nusselt number', yUnit: '1' },
      text: lesson(
        'Calculate Re and Pr from fluid properties, then apply a named correlation within its stated domain.',
        'Does a Nusselt correlation remain valid at every Reynolds number?',
        [
          'No, its regime assumptions matter',
          'Yes, it is a universal identity',
          'Only Pr changes its validity',
        ],
        'The nondimensional definitions are general; the empirical closure is conditional.',
        'Fully developed laminar flow in a circular tube at constant wall temperature gives Nu=3.66.',
        'Re=ρVL/μ; Pr=cpμ/k; Nu=hL/k; NuDB=0.023Re⁰·⁸Prⁿ; Nuplate=0.664Re¹ᐟ²Pr¹ᐟ³.',
        'Circular tube: laminar Re<2300, thermally/hydrodynamically fully developed; turbulent 10⁴≤Re≤10⁶, 0.7≤Pr≤160 and Lpipe/D≥10 assumed. Plate: ReL≤5×10⁵, 0.6≤Pr≤50, average isothermal correlation. No transition blending or property variation.',
      ),
    },
    (a) => {
      const Re = (a.density * a.velocity * a.length) / a.viscosity,
        Pr = (a.capacity * a.viscosity) / a.conductivity,
        f = (r) =>
          a.mode === 'laminar'
            ? 3.66
            : a.mode === 'plate'
              ? 0.664 * Math.sqrt(r) * Pr ** (1 / 3)
              : 0.023 * r ** 0.8 * Pr ** (a.heating === 'yes' ? 0.4 : 0.3),
        lo = a.mode === 'turbulent' ? 1e4 : 1,
        hi = a.mode === 'laminar' ? 2299 : a.mode === 'plate' ? 5e5 : 1e6,
        Nu = f(Re);
      return result(
        { reynolds: Re, prandtl: Pr, nusselt: Nu, coefficient: (Nu * a.conductivity) / a.length },
        seq(Math.log10(lo), Math.log10(hi)).map((x) => ({ x: 10 ** x, y: f(10 ** x) })),
        'boundary-layer',
        { reynolds: Re },
        [['Chosen correlation', a.mode]],
      );
    },
  ),
  boundarylayer: make(
    {
      id: 'boundarylayer',
      title: 'Flat-Plate Boundary Layer Growth',
      inputs: {
        regime: choice(
          'Idealized regime',
          { laminar: 'Blasius laminar', turbulent: 'Turbulent from leading-edge idealization' },
          'laminar',
        ),
        velocity: p('Free-stream speed', 'm/s', 0.1, 30, 2),
        length: p('Plate length', 'm', 0.05, 3, 1),
        kinematic: p('Kinematic viscosity', 'm²/s', 0.000001, 0.0001, 0.000015),
        density: p('Fluid density', 'kg/m³', 0.5, 1000, 1.2),
      },
      validateValues: domain('regime', (a) => {
        const R = (a.velocity * a.length) / a.kinematic;
        requireValue(
          a.regime === 'laminar' ? R <= 5e5 : R >= 5e5 && R <= 1e7,
          'Use laminar ReL≤5×10⁵ or the turbulent idealization for 5×10⁵≤ReL≤10⁷.',
        );
      }),
      metrics: {
        reynolds: ['Trailing-edge Reynolds number', '1'],
        thickness: ['Trailing-edge δ99 estimate', 'mm'],
        drag: ['Drag per unit plate width', 'N/m'],
        coefficient: ['Average skin-friction coefficient', '1'],
      },
      plot: { x: 'Distance along plate', xUnit: 'm', y: 'Boundary-layer thickness', yUnit: 'mm' },
      text: lesson(
        'Compare laminar square-root growth with a named turbulent power-law idealization over a smooth plate.',
        'In the laminar solution, doubling x changes δ by what factor?',
        ['√2', '2', 'One half'],
        'δ=5√(νx/U).',
        'U=2 m/s, ν=1.5×10⁻⁵ m²/s and L=1 m give ReL≈133333 and δ≈13.69 mm.',
        'δlam≈5x/√Rex, C̄f=1.328/√ReL; δturb≈0.37x/Rex¹ᐟ⁵, C̄f=0.074/ReL¹ᐟ⁵.',
        'Incompressible zero-pressure-gradient flow, smooth flat plate, constant properties. Turbulent correlation assumes turbulence from the leading edge and does not locate transition; its small-x extrapolation is illustrative. Thickness is an approximate 99% scale, not a computed velocity-field CFD solution.',
      ),
    },
    (a) => {
      const Re = (a.velocity * a.length) / a.kinematic,
        delta = (x) =>
          x === 0
            ? 0
            : a.regime === 'laminar'
              ? 5 * Math.sqrt((a.kinematic * x) / a.velocity)
              : (0.37 * x) / ((a.velocity * x) / a.kinematic) ** 0.2,
        C = a.regime === 'laminar' ? 1.328 / Math.sqrt(Re) : 0.074 / Re ** 0.2;
      return result(
        {
          reynolds: Re,
          thickness: delta(a.length) * 1000,
          drag: C * 0.5 * a.density * a.velocity ** 2 * a.length,
          coefficient: C,
        },
        seq(0, a.length).map((x) => ({ x, y: delta(x) * 1000 })),
        'boundary-layer',
        { length: a.length, thickness: delta(a.length), regime: a.regime },
        [['Dynamic pressure Pa', 0.5 * a.density * a.velocity ** 2]],
      );
    },
  ),
  hardycross: make(
    {
      id: 'hardycross',
      title: 'Pipe Network by Hardy Cross',
      topic: 'Fluid networks & motion',
      inputs: {
        flow: p('Total inlet flow', 'L/s', 1, 100, 20),
        r1: p('Upper inlet resistance R1', 'm/(m³/s)²', 100, 100000, 10000),
        r2: p('Upper outlet resistance R2', 'm/(m³/s)²', 100, 100000, 10000),
        r3: p('Lower inlet resistance R3', 'm/(m³/s)²', 100, 100000, 20000),
        r4: p('Lower outlet resistance R4', 'm/(m³/s)²', 100, 100000, 20000),
        initial: p('Initial upper-branch share', '1', 0.05, 0.95, 0.5),
      },
      metrics: {
        upper: ['Upper path flow', 'L/s'],
        lower: ['Lower path flow', 'L/s'],
        head: ['Common network head loss', 'm'],
        residual: ['Final loop head residual', 'm'],
      },
      plot: { x: 'Correction iteration', xUnit: '1', y: 'Loop head residual', yUnit: 'm' },
      text: lesson(
        'Iteratively balance the loop formed by two parallel two-pipe paths while preserving junction continuity exactly.',
        'For two paths with resistance ratio 1:4, how do the positive branch flows compare?',
        ['Flow ratio 2:1', 'Flow ratio 4:1', 'Flow ratio 1:4'],
        'Equal loss RQ² gives Q proportional to 1/√R.',
        'Equal path resistances split a 20 L/s inlet into 10 L/s per path.',
        'hi=RiQi|Qi|; ΔQ=−Σloop hi / Σloop 2Ri|Qi|; opposite path flows receive opposite corrections.',
        'One fixed four-pipe loop, constant quadratic resistance coefficients and incompressible steady flow. No automatic roughness/friction-factor update, pumps or arbitrary network editor. Residual and correction history are shown; head losses are SI with Q in m³/s.',
      ),
    },
    (a) => {
      const r = hardyLoop(a.flow / 1000, [a.r1, a.r2, a.r3, a.r4], a.initial);
      return {
        ...result(
          { upper: r.upper * 1000, lower: r.lower * 1000, head: r.head, residual: r.rows.at(-1).y },
          r.rows.map(({ x, y }) => ({ x, y })),
          'pipe-loop',
          { upper: r.upper * 1000, lower: r.lower * 1000 },
          [
            ['Junction continuity residual L/s', (r.upper + r.lower) * 1000 - a.flow],
            ['Iteration count', r.rows.length],
          ],
        ),
        iterations: r.rows,
      };
    },
  ),
  pumpcurve: make(
    {
      id: 'pumpcurve',
      title: 'Pump and System Curve Operating Point',
      topic: 'Fluid networks & motion',
      inputs: {
        shutoff: p('Pump shutoff head', 'm', 10, 100, 40),
        pump: p('Pump curve quadratic coefficient', 'm/(L/s)²', 0.001, 0.2, 0.02),
        static: p('Static system head', 'm', 0, 120, 10),
        system: p('System loss coefficient', 'm/(L/s)²', 0.001, 0.2, 0.03),
        efficiency: p('Pump hydraulic efficiency', '1', 0.3, 0.9, 0.75),
      },
      metrics: {
        flow: ['Forward operating flow', 'L/s'],
        head: ['Operating head', 'm'],
        power: ['Pump shaft power', 'kW'],
      },
      plot: {
        x: 'Flow',
        xUnit: 'L/s',
        y: 'Head',
        yUnit: 'm',
        traces: { y: 'Pump', reference: 'System' },
      },
      text: lesson(
        'Find the positive-flow intersection between a descending centrifugal pump curve and a rising system curve.',
        'If static head exceeds shutoff head, is there a forward operating point in this model?',
        ['No', 'Yes, at negative head', 'Yes, at every flow'],
        'The pump cannot overcome the static lift at any nonnegative discharge.',
        'H0=40 m, Hstatic=10 m and a+b=0.05 give Q=√600≈24.495 L/s.',
        'Hp=H0−aQ²; Hs=Hstatic+bQ²; Qop=√[(H0−Hstatic)/(a+b)]; Pshaft=ρgQHop/η.',
        'Single-speed fitted quadratic pump, constant efficiency and water density 1000 kg/m³. Null flow/head/power indicates no forward intersection. No cavitation/NPSH, stability dynamics, minimum-flow or manufacturer operating envelope check.',
      ),
    },
    (a) => {
      const flow =
          a.static <= a.shutoff ? Math.sqrt((a.shutoff - a.static) / (a.pump + a.system)) : null,
        head = flow === null ? null : a.static + a.system * flow ** 2,
        end = Math.sqrt(a.shutoff / a.pump);
      return result(
        {
          flow,
          head,
          power: flow === null ? null : (9.80665 * flow * head) / (1000 * a.efficiency),
        },
        seq(0, end).map((x) => ({
          x,
          y: a.shutoff - a.pump * x * x,
          reference: a.static + a.system * x * x,
        })),
        'pump',
        { flow, head },
        [['Water density kg/m³', 1000]],
        flow === null ? ['Static head exceeds pump shutoff head: no forward operating point.'] : [],
      );
    },
  ),
  cylinderflow: make(
    {
      id: 'cylinderflow',
      title: 'Flow Around a Cylinder: Reynolds Regimes',
      topic: 'Fluid networks & motion',
      inputs: {
        reynolds: p('Reynolds number', '1', 1, 1000000, 10000),
        diameter: p('Cylinder diameter', 'm', 0.01, 1, 0.1),
        kinematic: p('Fluid kinematic viscosity', 'm²/s', 0.000001, 0.0001, 0.000015),
        density: p('Fluid density', 'kg/m³', 0.5, 1200, 1.2),
      },
      metrics: {
        speed: ['Consistent free-stream speed', 'm/s'],
        drag: ['Estimated drag per unit span', 'N/m'],
        coefficient: ['Illustrative drag coefficient', '1'],
        frequency: ['Shedding frequency (when correlation applies)', 'Hz'],
      },
      plot: {
        x: 'log₁₀ Reynolds number',
        xUnit: '1',
        y: 'Illustrative drag coefficient',
        yUnit: '1',
      },
      text: lesson(
        'Classify cylinder wake regimes and connect an explicitly approximate drag envelope with a bounded Strouhal correlation.',
        'Does a regime diagram resolve the unsteady wake velocity field?',
        [
          'No, it classifies an assumed flow state',
          'Yes, it is a Navier–Stokes solver',
          'Only when the chart is green',
        ],
        'Reynolds number and empirical closures describe scales, not a spatially solved field.',
        'For Re=10000, ν=1.5×10⁻⁵ m²/s and D=0.1 m, U=1.5 m/s.',
        'Re=UD/ν; D′=½ρU²DCd; St≈0.198(1−19.7/Re), f=StU/D for 47<Re≤2×10⁵.',
        'Regime explorer, not CFD. Cd is a deliberately illustrative envelope: 1+10Re⁻²ᐟ³ up to 2×10⁵, log-linear fall to 0.3 at 5×10⁵, then 0.3. Drag crisis depends strongly on roughness and turbulence, so this curve is not a force-design correlation. Shedding frequency is null outside the stated subcritical range.',
      ),
    },
    (a) => {
      const Cd = (Re) =>
          Re <= 2e5
            ? 1 + 10 / Re ** (2 / 3)
            : Re >= 5e5
              ? 0.3
              : 1 +
                10 / 2e5 ** (2 / 3) +
                (Math.log(Re / 2e5) / Math.log(2.5)) * (0.3 - (1 + 10 / 2e5 ** (2 / 3))),
        U = (a.reynolds * a.kinematic) / a.diameter,
        coefficient = Cd(a.reynolds),
        regime =
          a.reynolds < 47
            ? 'Steady separated/low-Re wake'
            : a.reynolds < 180
              ? 'Laminar vortex street'
              : a.reynolds < 2e5
                ? 'Subcritical unsteady wake'
                : 'Drag-crisis / supercritical envelope';
      return result(
        {
          speed: U,
          drag: 0.5 * a.density * U * U * a.diameter * coefficient,
          coefficient,
          frequency:
            a.reynolds > 47 && a.reynolds <= 2e5
              ? (0.198 * (1 - 19.7 / a.reynolds) * U) / a.diameter
              : null,
        },
        seq(0, 6).map((x) => ({ x, y: Cd(10 ** x) })),
        'cylinder-flow',
        { reynolds: a.reynolds, regime },
        [['Wake classification', regime]],
        [
          'Drag envelope is illustrative; no resolved velocity field or calibrated drag-crisis prediction.',
        ],
      );
    },
  ),
  couette: make(
    {
      id: 'couette',
      title: 'Couette and Poiseuille Velocity Profiles',
      topic: 'Fluid networks & motion',
      inputs: {
        gap: p('Plate gap', 'mm', 0.1, 20, 2),
        speed: p('Upper plate speed', 'm/s', -2, 2, 0.5),
        gradient: p('Driving −dp/dx', 'Pa/m', -1000, 1000, 100),
        viscosity: p('Dynamic viscosity', 'Pa·s', 0.001, 1, 0.01),
      },
      metrics: {
        flow: ['Volume flow per unit width', 'm²/s'],
        bottom: ['Fluid shear τxy at lower wall', 'Pa'],
        top: ['Fluid shear τxy at upper wall', 'Pa'],
      },
      plot: { x: 'Gap position', xUnit: 'mm', y: 'Streamwise velocity', yUnit: 'm/s' },
      text: lesson(
        'Superpose a moving-wall Couette profile and pressure-driven plane Poiseuille flow, including reverse flow.',
        'Can a sufficiently adverse pressure gradient reverse part of the profile?',
        [
          'Yes',
          'No, wall motion guarantees every point moves forward',
          'Only if viscosity is zero',
        ],
        'The parabolic and linear contributions can oppose each other.',
        'For U=0 the maximum velocity is GH²/(8μ) and flow per width is GH³/(12μ).',
        'u(y)=Uy/H+G y(H−y)/(2μ); Q/b=UH/2+GH³/(12μ); τxy=μU/H+G(H−2y)/2.',
        'Steady incompressible Newtonian laminar flow between infinite parallel plates, no slip and fully developed profile. G=−dp/dx is signed. Wall stresses shown are tensor τxy in one global coordinate convention, not both outward wall-traction signs. No entrance or turbulence model.',
      ),
    },
    (a) => {
      const H = a.gap / 1000,
        G = a.gradient,
        mu = a.viscosity,
        U = a.speed;
      return result(
        {
          flow: (U * H) / 2 + (G * H ** 3) / (12 * mu),
          bottom: (mu * U) / H + (G * H) / 2,
          top: (mu * U) / H - (G * H) / 2,
        },
        seq(0, a.gap).map((x) => {
          const y = x / 1000;
          return { x, y: (U * y) / H + (G * y * (H - y)) / (2 * mu) };
        }),
        'channel',
        { gap: a.gap, speed: U, gradient: G },
        [
          ['Lower-wall velocity m/s', 0],
          ['Upper-wall velocity m/s', U],
        ],
      );
    },
  ),
  tankdraining: make(
    {
      id: 'tankdraining',
      title: 'Tank Draining: Torricelli and Emptying Time',
      topic: 'Fluid networks & motion',
      inputs: {
        area: p('Tank cross-sectional area', 'm²', 0.1, 20, 1),
        orifice: p('Outlet area', 'cm²', 0.1, 100, 5),
        initial: p('Initial head above outlet', 'm', 0.1, 10, 2),
        coefficient: p('Discharge coefficient', '1', 0.4, 1, 0.62),
      },
      validateValues: domain('orifice', (a) =>
        requireValue(
          (a.orifice * 1e-4) / a.area <= 0.01,
          'Small-outlet approximation requires outlet area ≤1% of tank area.',
        ),
      ),
      metrics: {
        time: ['Complete emptying time', 's'],
        initial: ['Initial discharge', 'L/s'],
        half: ['Time to half the initial head', 's'],
      },
      plot: { x: 'Elapsed time', xUnit: 's', y: 'Water head', yUnit: 'm' },
      text: lesson(
        'Integrate the falling-head mass balance rather than assuming a constant outlet velocity.',
        'Does half the initial head occur halfway through emptying time?',
        ['No, at (1−1/√2) of the emptying time', 'Yes', 'Only when Cd is one'],
        'Head is quadratic in the remaining drainage time.',
        'For A=1 m², a=5 cm², Cd=0.62 and h0=2 m, emptying time is about 2060.19 s.',
        'A dh/dt=−Cd a√(2gh); te=2A√h0/(Cd a√(2g)); h=h0(1−t/te)² for 0≤t≤te.',
        'Large open tank, constant tank area, small bottom outlet, equal atmospheric pressure, quasi-steady inviscid head balance with a constant fitted Cd. No pipe losses, pressurization, vortex ingestion or changing outlet submergence.',
      ),
    },
    (a) => {
      const outlet = a.orifice * 1e-4,
        t = (2 * a.area * Math.sqrt(a.initial)) / (a.coefficient * outlet * Math.sqrt(2 * 9.80665));
      return result(
        {
          time: t,
          initial: a.coefficient * outlet * Math.sqrt(2 * 9.80665 * a.initial) * 1000,
          half: t * (1 - 1 / Math.SQRT2),
        },
        seq(0, t).map((x) => ({ x, y: a.initial * (1 - x / t) ** 2 })),
        'draining-tank',
        { initial: a.initial, time: t },
        [
          ['Initial liquid volume m³', a.area * a.initial],
          ['Average discharge L/s', ((a.area * a.initial) / t) * 1000],
        ],
      );
    },
  ),
  lmtd: make(
    {
      id: 'lmtd',
      title: 'Parallel vs. Counterflow LMTD Sizing',
      inputs: {
        mode: choice(
          'Flow arrangement',
          { counter: 'Counterflow', parallel: 'Parallel flow' },
          'counter',
        ),
        hotin: p('Hot inlet', '°C', 60, 200, 120),
        hotout: p('Hot outlet', '°C', 30, 150, 80),
        coldin: p('Cold inlet', '°C', 0, 60, 20),
        coldout: p('Cold outlet', '°C', 20, 130, 60),
        capacity: p('Hot heat-capacity rate', 'kW/K', 0.1, 20, 2),
        U: p('Overall U', 'W/(m²·K)', 50, 2000, 500),
      },
      validateValues: domain('coldout', (a) => {
        requireValue(
          a.hotin > a.hotout && a.coldout > a.coldin,
          'Hot stream must cool and cold stream must warm.',
        );
        const d1 = a.mode === 'counter' ? a.hotin - a.coldout : a.hotin - a.coldin,
          d2 = a.mode === 'counter' ? a.hotout - a.coldin : a.hotout - a.coldout;
        requireValue(
          d1 > 0 && d2 > 0,
          'Both terminal temperature differences must be positive for the selected arrangement.',
        );
      }),
      metrics: {
        heat: ['Transferred heat', 'kW'],
        difference: ['Log-mean temperature difference', 'K'],
        area: ['Required area', 'm²'],
        coldcapacity: ['Required cold capacity rate', 'kW/K'],
      },
      plot: {
        x: 'Fraction of cumulative heat transfer from hot inlet',
        xUnit: '1',
        y: 'Temperature',
        yUnit: '°C',
        traces: { y: 'Hot stream', reference: 'Cold stream at same station' },
      },
      text: lesson(
        'Size a no-phase-change exchanger from consistent terminal temperatures and infer the cold capacity rate from energy balance.',
        'When both terminal differences are equal, what is LMTD?',
        ['That common difference', 'Zero', 'Undefined physically'],
        'The logarithmic mean has a well-defined equal-difference limit.',
        'Hot 120→80°C and counterflow cold 20→60°C give ΔTlm=60 K. At Ch=2 kW/K and U=500 W/(m² K), A=2.6667 m².',
        'Q=Ch(Thi−Tho)=Cc(Tco−Tci); ΔTlm=(ΔT1−ΔT2)/ln(ΔT1/ΔT2); A=Q/(UΔTlm).',
        'Single-pass parallel/counterflow, constant U and heat-capacity rates, no heat loss or phase change. Area is based on the stated U reference area. Counterflow cold profile is drawn against the hot-flow coordinate; it therefore runs cold outlet to inlet.',
      ),
    },
    (a) => {
      const d1 = a.mode === 'counter' ? a.hotin - a.coldout : a.hotin - a.coldin,
        d2 = a.mode === 'counter' ? a.hotout - a.coldin : a.hotout - a.coldout,
        lm = Math.abs(d1 - d2) < 1e-8 ? d1 : (d1 - d2) / Math.log(d1 / d2),
        Q = a.capacity * (a.hotin - a.hotout);
      return result(
        {
          heat: Q,
          difference: lm,
          area: (Q * 1000) / (a.U * lm),
          coldcapacity: Q / (a.coldout - a.coldin),
        },
        seq(0, 1).map((x) => ({
          x,
          y: a.hotin + x * (a.hotout - a.hotin),
          reference:
            a.mode === 'counter'
              ? a.coldout + x * (a.coldin - a.coldout)
              : a.coldin + x * (a.coldout - a.coldin),
        })),
        'heat-exchanger',
        { mode: a.mode, ...a },
        [
          ['Terminal difference 1 K', d1],
          ['Terminal difference 2 K', d2],
        ],
      );
    },
  ),
  heatsink: make(
    {
      id: 'heatsink',
      title: 'Thermal Resistance Network: Electronics Cooling',
      inputs: {
        power: p('Device dissipation', 'W', 0, 300, 50),
        ambient: p('Ambient temperature', '°C', 0, 60, 25),
        junction: p('Junction-to-case resistance', 'K/W', 0.05, 2, 0.4),
        contact: p('Contact/spreading resistance', 'K/W', 0.01, 1, 0.2),
        h: p('Convection coefficient', 'W/(m²·K)', 5, 100, 20),
        area: p('Effective external area', 'm²', 0.01, 1, 0.1),
        emissivity: p('External emissivity', '1', 0, 1, 0.8),
      },
      metrics: {
        junction: ['Junction temperature', '°C'],
        sink: ['Sink surface temperature', '°C'],
        convection: ['Convection heat branch', 'W'],
        radiation: ['Radiation heat branch', 'W'],
      },
      plot: { x: 'Position in thermal network', xUnit: '1', y: 'Temperature', yUnit: '°C' },
      text: lesson(
        'Solve a nonlinear sink-to-ambient balance with parallel convection/radiation and series contact and junction resistances.',
        'Adding a radiation branch at the same sink temperature changes heat-removal capacity how?',
        ['Increases it', 'Decreases it', 'Disconnects convection'],
        'Parallel paths add their heat rates.',
        'With emissivity zero, Q=50 W and hA=2 W/K give a sink rise of 25 K.',
        'Q=hA(Ts−Ta)+εσA(Ts⁴−Ta⁴); Tcase=Ts+QRcontact; Tj=Tcase+QRjc.',
        'Steady uniform effective sink temperature, supplied effective area including any fin efficiency, constant material/contact resistances, diffuse radiation to an isothermal large environment. No spatial chip hot spots, airflow solution or temperature-dependent property model.',
      ),
    },
    (a) => {
      const Ta = a.ambient + 273.15,
        f = (T) =>
          a.h * a.area * (T - Ta) + a.emissivity * SIGMA * a.area * (T ** 4 - Ta ** 4) - a.power,
        Ts = a.power === 0 ? Ta : bisect(f, Ta, Ta + a.power / (a.h * a.area)),
        conv = a.h * a.area * (Ts - Ta),
        radiation = a.emissivity * SIGMA * a.area * (Ts ** 4 - Ta ** 4),
        sink = Ts - 273.15,
        caseT = sink + a.power * a.contact,
        junction = caseT + a.power * a.junction;
      return result(
        { junction, sink, convection: conv, radiation },
        [junction, caseT, sink, a.ambient].map((y, x) => ({ x, y })),
        'thermal-network',
        {
          temperatures: [junction, caseT, sink, a.ambient],
          labels: ['Junction', 'Case', 'Sink', 'Ambient'],
        },
        [['Energy residual W', conv + radiation - a.power]],
        junction > 250
          ? [
              'Predicted junction temperature exceeds 250°C; constant-property electronics assumptions are unlikely to apply.',
            ]
          : [],
      );
    },
  ),
};

import { lab, p, choice, samples, table } from './lab-kit.js';
export function consecutiveState(c0, k1, k2, t) {
  const a = c0 * Math.exp(-k1 * t),
    difference = k2 - k1,
    b =
      Math.abs(difference) < 1e-8 * Math.max(k1, k2)
        ? c0 * k1 * t * Math.exp(-k1 * t)
        : (c0 * k1 * Math.exp(-k1 * t) * -Math.expm1(-difference * t)) / difference;
  return { a, b, c: c0 - a - b };
}
export const chemicalModels = {
  reactorconversion: lab(
    {
      id: 'reactorconversion',
      title: 'CSTR vs. Plug-Flow Conversion',
      discipline: 'chemical',
      lab: 'CH01',
      topic: 'Reaction engineering',
      inputs: {
        reactor: choice(
          'Ideal reactor',
          { cstr: 'Continuous stirred tank', pfr: 'Plug-flow reactor' },
          'cstr',
        ),
        rate: p('First-order rate constant', '1/min', 0.01, 2, 0.2),
        residence: p('Residence time', 'min', 0.1, 20, 5),
        feed: p('Feed concentration', 'mol/L', 0.1, 10, 1),
        flow: p('Volumetric flow', 'L/min', 0.1, 100, 2),
      },
      metrics: {
        conversion: ['Selected-reactor conversion', '%'],
        outlet: ['Outlet concentration', 'mol/L'],
        volume: ['Required reactor volume', 'L'],
      },
      plot: {
        x: 'Residence time',
        xUnit: 'min',
        y: 'Conversion',
        yUnit: '%',
        traces: { y: 'Selected reactor', reference: 'Other ideal reactor' },
      },
      text: [
        'Compare mixing and plug flow for the same irreversible first-order reaction.',
        'At the same positive kτ, which ideal reactor gives greater conversion?',
        ['Plug flow', 'A single stirred tank', 'They are always equal'],
        'For first-order kinetics, 1−exp(−kτ) exceeds kτ/(1+kτ).',
        'At k=0.2 min⁻¹ and τ=5 min, CSTR conversion is 50% and PFR conversion is 63.212%. With 2 L/min flow, either residence time requires 10 L.',
        'For A→products with −rA=kCA: XCSTR=kτ/(1+kτ), XPFR=1−exp(−kτ); CA,out=CA0(1−X), V=Qτ.',
        'Steady, isothermal, constant-density liquid, ideal mixing or ideal plug flow, single irreversible first-order reaction. No heat release, pressure drop, catalyst deactivation or residence-time dispersion. The plot varies residence time, not axial distance inside a CSTR.',
      ],
    },
    ({ reactor, rate: k, residence: t, feed: c0, flow: q }) => {
      const conversion = (time, cstr) =>
          cstr ? (k * time) / (1 + k * time) : -Math.expm1(-k * time),
        selected = reactor === 'cstr',
        x = conversion(t, selected);
      return {
        summary: { conversion: 100 * x, outlet: c0 * (1 - x), volume: q * t },
        series: samples(0, 2 * t, (time) => ({
          y: 100 * conversion(time, selected),
          reference: 100 * conversion(time, !selected),
        })),
        visualization: {
          type: 'engineering-extension',
          kind: 'reactor',
          reactor,
          rate: k,
          feed: c0,
          flow: q,
        },
        table: table(
          'Equal-residence-time reactor comparison',
          ['Reactor', 'Conversion (%)', 'Outlet concentration (mol/L)', 'Volume (L)'],
          [
            ['CSTR', 100 * conversion(t, true), c0 * (1 - conversion(t, true)), q * t],
            ['PFR', 100 * conversion(t, false), c0 * (1 - conversion(t, false)), q * t],
          ],
        ),
      };
    },
  ),
  arrhenius: lab(
    {
      id: 'arrhenius',
      title: 'Arrhenius Temperature Sensitivity',
      discipline: 'chemical',
      lab: 'CH02',
      topic: 'Chemical kinetics',
      inputs: {
        reference: p('Rate constant at reference temperature', '1/min', 0.001, 2, 0.1),
        activation: p('Activation energy', 'kJ/mol', 10, 150, 50),
        referenceTemperature: p('Reference absolute temperature', 'K', 250, 400, 300),
        temperature: p('Selected absolute temperature', 'K', 250, 450, 330),
      },
      metrics: {
        rate: ['Selected rate constant', '1/min'],
        multiplier: ['Rate / reference rate', ''],
        half: ['First-order half-life', 'min'],
      },
      plot: {
        x: 'Inverse absolute temperature (1000/T)',
        xUnit: '1000/K',
        y: 'Natural log of k/kref',
        yUnit: '',
      },
      text: [
        'Connect activation energy to rate changes using an explicitly labeled inverse-temperature plot.',
        'For positive activation energy, does increasing temperature increase k?',
        ['Yes', 'No', 'Only below the reference temperature'],
        'The Arrhenius exponent becomes less negative as absolute temperature rises.',
        'At kref=0.1 min⁻¹, Tref=300 K, Ea=50 kJ/mol and T=330 K, k is approximately 0.619 min⁻¹, about 6.19 times the reference rate.',
        'k(T)=kref exp[−Ea/R(1/T−1/Tref)], R=8.314462618 J/(mol·K). For first-order decay, t½=ln2/k. The plotted logarithm uses natural log.',
        'A single constant activation energy over 250–450 K, fixed mechanism and no transport limitation. This is sensitivity analysis, not evidence that an actual material or reaction remains stable over that range. Temperature is absolute kelvin.',
      ],
    },
    ({ reference: k0, activation: ea, referenceTemperature: t0, temperature: t }) => {
      const logratio = (temp) => ((-ea * 1000) / 8.314462618) * (1 / temp - 1 / t0),
        multiplier = Math.exp(logratio(t)),
        rate = k0 * multiplier;
      return {
        summary: { rate, multiplier, half: Math.LN2 / rate },
        series: samples(1000 / 450, 1000 / 250, (x) => ({ y: logratio(1000 / x) })),
        visualization: {
          type: 'engineering-extension',
          kind: 'arrhenius',
          reference: k0,
          activation: ea,
          referenceTemperature: t0,
        },
      };
    },
  ),
  consecutive: lab(
    {
      id: 'consecutive',
      title: 'Consecutive Batch Reactions A → B → C',
      discipline: 'chemical',
      lab: 'CH03',
      topic: 'Reaction engineering',
      inputs: {
        initial: p('Initial A concentration', 'mol/L', 0.1, 10, 1),
        first: p('Rate constant A to B', '1/min', 0.01, 2, 0.2),
        second: p('Rate constant B to C', '1/min', 0.01, 2, 0.1),
        duration: p('Reaction time in view', 'min', 1, 30, 20),
      },
      metrics: {
        intermediate: ['B concentration at end', 'mol/L'],
        peak: ['Peak B within the view', 'mol/L'],
        peakTime: ['Time of peak B within the view', 'min'],
      },
      plot: {
        x: 'Batch reaction time',
        xUnit: 'min',
        y: 'Concentration',
        yUnit: 'mol/L',
        traces: { y: 'Reactant A', reference: 'Intermediate B', other: 'Product C' },
      },
      text: [
        'Follow an intermediate that is both formed and consumed while total species concentration stays conserved.',
        'Can B increase forever in this closed consecutive reaction?',
        ['No, it is eventually consumed', 'Yes', 'Only when both rate constants are equal'],
        'After A is depleted, B continues to convert to C.',
        'For CA0=1, k1=0.2 and k2=0.1 min⁻¹, B peaks at ln(2)/0.1≈6.9315 min with concentration 0.5 mol/L.',
        'CA=CA0 exp(−k1t); CB=CA0 k1[exp(−k1t)−exp(−k2t)]/(k2−k1); CC=CA0−CA−CB. At k1=k2=k, CB=CA0 kt exp(−kt).',
        'Well-mixed isothermal constant-volume batch, irreversible first-order steps with unit molar stoichiometry and zero initial B/C. The equal-rate limit is handled explicitly. Peak metrics are bounded to the viewing interval.',
      ],
    },
    ({ initial: c0, first: k1, second: k2, duration }) => {
      const peakTime = Math.min(
          duration,
          Math.abs(k2 - k1) < 1e-8 * Math.max(k1, k2) ? 1 / k1 : Math.log(k2 / k1) / (k2 - k1),
        ),
        at = consecutiveState(c0, k1, k2, duration),
        series = samples(0, duration, (t) => {
          const s = consecutiveState(c0, k1, k2, t);
          return { y: s.a, reference: s.b, other: s.c };
        });
      return {
        summary: { intermediate: at.b, peak: consecutiveState(c0, k1, k2, peakTime).b, peakTime },
        series,
        visualization: { type: 'engineering-extension', kind: 'reactionchain', initial: c0 },
        table: {
          ...table(
            'Closed-batch concentration balance',
            ['Time (min)', 'A (mol/L)', 'B (mol/L)', 'C (mol/L)', 'Total (mol/L)'],
            series.map((p) => [p.x, p.y, p.reference, p.other, p.y + p.reference + p.other]),
          ),
          followProbe: true,
        },
      };
    },
  ),
  mixingtank: lab(
    {
      id: 'mixingtank',
      title: 'Well-Mixed Tank: Tracer Step & Washout',
      discipline: 'chemical',
      lab: 'CH04',
      topic: 'Process dynamics',
      inputs: {
        volume: p('Constant liquid volume', 'L', 1, 1000, 100),
        flow: p('Equal inlet and outlet flow', 'L/min', 0.1, 100, 10),
        initial: p('Initial tank concentration', 'mol/L', 0, 10, 0),
        feed: p('New inlet concentration', 'mol/L', 0, 10, 1),
        duration: p('Viewing duration', 'min', 1, 100, 30),
      },
      metrics: {
        tau: ['Mixing time constant V/Q', 'min'],
        final: ['Tank concentration at end', 'mol/L'],
        amount: ['Solute in tank at end', 'mol'],
      },
      plot: {
        x: 'Elapsed time',
        xUnit: 'min',
        y: 'Concentration',
        yUnit: 'mol/L',
        traces: { y: 'Tank / outlet concentration', reference: 'Inlet concentration' },
      },
      text: [
        'Track a tracer concentration step through a constant-volume perfectly mixed tank.',
        'After one V/Q, what fraction of a zero-to-one concentration step has appeared?',
        ['About 63.2%', 'About 36.8%', '100%'],
        'The remaining difference from the inlet decays as exp(−t/(V/Q)).',
        'For V=100 L, Q=10 L/min and a step from 0 to 1 mol/L, τ=10 min and C(10 min)=1−e⁻¹≈0.63212 mol/L.',
        'V dC/dt=Q(Cin−C). C(t)=Cin+(C0−Cin)exp(−Qt/V). Accumulated outlet moles=VC0+QCin t−VC(t).',
        'Equal constant inflow/outflow, fixed volume, instantaneous uniform mixing, conserved nonreacting solute and a constant new inlet concentration. No transport delay, segregation or density change. The same balance covers washout when Cin=0.',
      ],
    },
    ({ volume: v, flow: q, initial: c0, feed: cin, duration }) => {
      const at = (t) => cin + (c0 - cin) * Math.exp((-q * t) / v),
        series = samples(0, duration, (t) => ({ y: at(t), reference: cin }));
      return {
        summary: { tau: v / q, final: at(duration), amount: v * at(duration) },
        series,
        visualization: {
          type: 'engineering-extension',
          kind: 'mixing',
          volume: v,
          flow: q,
          initial: c0,
          feed: cin,
        },
        table: table(
          'Integral tracer balance over the selected view',
          ['Quantity', 'Moles'],
          [
            ['Initially in tank', v * c0],
            ['Entered', q * cin * duration],
            ['Left in outlet', v * c0 + q * cin * duration - v * at(duration)],
            ['Remaining in tank', v * at(duration)],
          ],
        ),
      };
    },
  ),
  langmuir: lab(
    {
      id: 'langmuir',
      title: 'Langmuir Adsorption & Surface Coverage',
      discipline: 'chemical',
      lab: 'CH05',
      topic: 'Separation processes',
      inputs: {
        capacity: p('Monolayer capacity qmax', 'mg/g', 1, 100, 20),
        affinity: p('Affinity constant K', 'L/mg', 0.01, 10, 0.5),
        concentration: p('Equilibrium dissolved concentration', 'mg/L', 0, 100, 2),
        mass: p('Adsorbent mass', 'g', 1, 100, 10),
      },
      metrics: {
        loading: ['Adsorbed loading', 'mg/g'],
        coverage: ['Fractional coverage', '%'],
        half: ['Half-saturation concentration', 'mg/L'],
        adsorbed: ['Adsorbed mass', 'mg'],
      },
      plot: {
        x: 'Equilibrium concentration',
        xUnit: 'mg/L',
        y: 'Adsorbed loading',
        yUnit: 'mg/g',
        traces: { y: 'Langmuir isotherm', reference: 'Monolayer capacity' },
      },
      text: [
        'Relate equilibrium concentration, finite surface sites and adsorbed loading.',
        'At C=1/K, what fraction of the sites are occupied?',
        ['One half', 'All sites', 'One quarter'],
        'KC=1 gives θ=KC/(1+KC)=1/2.',
        'qmax=20 mg/g, K=0.5 L/mg and C=2 mg/L give θ=0.5 and q=10 mg/g. Ten grams of adsorbent hold 100 mg.',
        'θ=KC/(1+KC), q=qmaxθ, madsorbed=q·madsorbent. Half saturation occurs at C=1/K.',
        'Single-solute equilibrium on identical independent monolayer sites at fixed temperature. Dissolved equilibrium concentration is prescribed by a reservoir; a closed-batch liquid mass balance, adsorption kinetics and competing species are not modeled.',
      ],
    },
    ({ capacity: qmax, affinity: k, concentration: c, mass }) => {
      const coverage = (x) => (k * x) / (1 + k * x);
      return {
        summary: {
          loading: qmax * coverage(c),
          coverage: 100 * coverage(c),
          half: 1 / k,
          adsorbed: mass * qmax * coverage(c),
        },
        series: samples(0, Math.max(10, 2 * c), (x) => ({
          y: qmax * coverage(x),
          reference: qmax,
        })),
        visualization: {
          type: 'engineering-extension',
          kind: 'adsorption',
          capacity: qmax,
          affinity: k,
        },
      };
    },
  ),
  osmosis: lab(
    {
      id: 'osmosis',
      title: 'Osmotic Pressure & Membrane Water Flux',
      discipline: 'chemical',
      lab: 'CH06',
      topic: 'Membrane separation',
      inputs: {
        pressure: p('Applied feed-side pressure difference', 'bar', 0, 80, 40),
        feed: p('Feed solute concentration', 'mol/L', 0, 1, 0.5),
        permeate: p('Permeate solute concentration', 'mol/L', 0, 0.1, 0),
        temperature: p('Absolute temperature', 'K', 273, 333, 298.15),
        factor: p('Van ’t Hoff particle factor', '', 1, 2, 2),
        permeability: p('Water permeability', 'L/(m²·h·bar)', 0.1, 5, 1.5),
        area: p('Membrane area', 'm²', 1, 100, 10),
      },
      metrics: {
        osmotic: ['Osmotic pressure difference', 'bar'],
        flux: ['Signed water flux', 'L/(m²·h)'],
        flow: ['Signed water flow', 'L/h'],
      },
      plot: {
        x: 'Applied pressure difference',
        xUnit: 'bar',
        y: 'Signed water flux',
        yUnit: 'L/(m²·h)',
        traces: { y: 'Water flux', reference: 'Zero-flux threshold' },
      },
      text: [
        'Compare applied hydraulic pressure with a dilute-solution osmotic pressure difference.',
        'What is the net water flux when ΔP equals Δπ?',
        ['Zero', 'Maximum forward flux', 'Maximum reverse flux'],
        'The ideal linear driving force ΔP−Δπ vanishes.',
        'For 0.5 mol/L feed, zero permeate concentration, i=2 and T=298.15 K, Δπ≈24.79 bar. At 40 bar and Lp=1.5, forward flux is about 22.82 L/(m²·h).',
        'Δπ=iRT(Cfeed−Cpermeate), R=0.08314462618 L·bar/(mol·K). Jv=Lp(ΔP−Δπ), Qwater=Jv A. Positive flux is feed to permeate.',
        'Dilute ideal solution, prescribed uniform concentrations, fixed membrane permeability and no concentration polarization or pressure loss. Negative flux is deliberately retained as the opposite direction. This does not predict solute rejection, fouling or a real plant recovery ratio.',
      ],
    },
    ({ pressure, feed, permeate, temperature, factor, permeability: lp, area }) => {
      const osmotic = factor * 0.08314462618 * temperature * (feed - permeate),
        flux = lp * (pressure - osmotic);
      return {
        summary: { osmotic, flux, flow: flux * area },
        series: samples(0, 80, (x) => ({ y: lp * (x - osmotic), reference: 0 })),
        visualization: {
          type: 'engineering-extension',
          kind: 'membrane',
          osmotic,
          permeability: lp,
          feed,
          permeate,
        },
        warnings:
          flux < 0
            ? [
                'Net driving pressure is negative. The signed model predicts water flow opposite to the feed-to-permeate direction.',
              ]
            : [],
      };
    },
  ),
};
chemicalModels.reactorconversion.definition.presets = {
  'Plug-flow comparison': { reactor: 'pfr' },
};
chemicalModels.arrhenius.definition.presets = { 'Reference temperature': { temperature: 300 } };
chemicalModels.consecutive.definition.presets = {
  'Equal rate constants': { first: 0.2, second: 0.2 },
};
chemicalModels.mixingtank.definition.presets = {
  Washout: { initial: 1, feed: 0 },
  'No concentration step': { initial: 1, feed: 1 },
};
chemicalModels.langmuir.definition.presets = { 'Clean reservoir': { concentration: 0 } };
chemicalModels.osmosis.definition.presets = { 'Osmosis reverses the sign': { pressure: 0 } };

import { content } from './content/chemical-process.js';
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
      text: content['reactorconversion'],
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
      text: content['arrhenius'],
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
      text: content['consecutive'],
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
      text: content['mixingtank'],
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
      text: content['langmuir'],
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
      text: content['osmosis'],
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

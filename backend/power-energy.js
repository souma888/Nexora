import { content } from './content/power-energy.js';
import { lab, p, choice, samples, table } from './lab-kit.js';
export function pvOperatingPoint({ current, voc, shape, irradiance }) {
  const a = voc * shape,
    denominator = Math.expm1(voc / a),
    light = irradiance / 1000,
    open = a * Math.log1p(light * denominator),
    isc = current * light;
  const at = (v) => current * (light - Math.expm1(v / a) / denominator);
  let lo = 0,
    hi = open;
  for (let n = 0; n < 70; n++) {
    const mid = (lo + hi) / 2,
      derivative = at(mid) - (mid * current * Math.exp(mid / a)) / (a * denominator);
    if (derivative > 0) lo = mid;
    else hi = mid;
  }
  const voltage = (lo + hi) / 2,
    amps = at(voltage);
  return { open, isc, voltage, amps, power: voltage * amps, at };
}
function converter(input, boost) {
  const { voltage: vin, duty: d, resistance: r, inductance, frequency } = input,
    l = inductance / 1000,
    f = frequency * 1000,
    vo = boost ? vin / (1 - d) : vin * d,
    io = vo / r,
    average = boost ? io / (1 - d) : io,
    ripple = (boost ? vin * d : vin * d * (1 - d)) / (l * f);
  const series = samples(
    0,
    2 / f,
    (t) => {
      const phase = (t * f) % 1;
      return {
        y: average - ripple / 2 + (phase < d ? phase / d : (1 - phase) / (1 - d)) * ripple,
        reference: average,
      };
    },
    400,
  ).map((point) => ({ ...point, x: point.x * 1e6 }));
  return {
    summary: { output: vo, current: io, ripple },
    series,
    visualization: {
      type: 'engineering-extension',
      kind: 'converter',
      boost,
      vin,
      vo,
      duty: d,
      current: average,
    },
    warnings:
      average - ripple / 2 <= 0
        ? [
            'The continuous-conduction solution reaches zero or negative inductor current. A diode converter enters discontinuous conduction; the displayed CCM gain and ripple are then conditional, not a valid diode-converter operating point.',
          ]
        : [],
    table: table(
      'Ideal CCM operating quantities',
      ['Quantity', 'Value', 'Unit'],
      [
        ['Output voltage', vo, 'V'],
        ['Output current', io, 'A'],
        ['Mean inductor current', average, 'A'],
        ['Minimum inductor current', average - ripple / 2, 'A'],
        ['Maximum inductor current', average + ripple / 2, 'A'],
        ['Ideal input power', vo * io, 'W'],
      ],
    ),
  };
}
const switchInputs = {
  voltage: p('Input voltage', 'V', 5, 100, 24),
  duty: p('Switch duty ratio', '', 0.05, 0.85, 0.5),
  resistance: p('Load resistance', 'Ω', 1, 100, 10),
  inductance: p('Inductance', 'mH', 0.1, 20, 2),
  frequency: p('Switching frequency', 'kHz', 1, 100, 20),
};
const switchMetrics = {
  output: ['Ideal output voltage', 'V'],
  current: ['Output current', 'A'],
  ripple: ['Inductor peak-to-peak ripple', 'A'],
};
const switchPlot = {
  x: 'Time',
  xUnit: 'µs',
  y: 'Inductor current',
  yUnit: 'A',
  traces: { y: 'Triangular inductor current', reference: 'Mean inductor current' },
};
export const energyModels = {
  solarpv: lab(
    {
      id: 'solarpv',
      title: 'Ideal Solar PV I–V & Maximum Power',
      discipline: 'energy',
      lab: 'EN01',
      topic: 'Photovoltaics',
      inputs: {
        current: p('Reference short-circuit current', 'A', 0.5, 15, 5),
        voc: p('Reference open-circuit voltage', 'V', 5, 60, 20),
        shape: p('Diode voltage scale / reference Voc', '', 0.02, 0.12, 0.05),
        irradiance: p('Irradiance', 'W/m²', 200, 1200, 1000),
      },
      metrics: {
        voltage: ['Maximum-power voltage', 'V'],
        amps: ['Maximum-power current', 'A'],
        power: ['Maximum power', 'W'],
        fill: ['Fill factor', '%'],
      },
      plot: { x: 'Terminal voltage', xUnit: 'V', y: 'Output power', yUnit: 'W' },
      text: content['solarpv'],
    },
    (input) => {
      const point = pvOperatingPoint(input),
        series = samples(0, point.open, (v) => ({ y: v * Math.max(0, point.at(v)) }));
      return {
        summary: {
          voltage: point.voltage,
          amps: point.amps,
          power: point.power,
          fill: (100 * point.power) / (point.isc * point.open),
        },
        series,
        visualization: {
          type: 'engineering-extension',
          kind: 'solar',
          iv: series.map((p) => ({ voltage: p.x, current: Math.max(0, point.at(p.x)) })),
          voc: point.open,
          isc: point.isc,
          vmp: point.voltage,
        },
        table: table(
          'Ideal diode voltage, current and power',
          ['Voltage (V)', 'Current (A)', 'Power (W)'],
          series.map((p) => [p.x, Math.max(0, point.at(p.x)), p.y]),
        ),
      };
    },
  ),
  windpower: lab(
    {
      id: 'windpower',
      title: 'Wind Turbine Power & Betz Limit',
      discipline: 'energy',
      lab: 'EN02',
      topic: 'Wind energy',
      inputs: {
        radius: p('Rotor radius', 'm', 1, 50, 5),
        speed: p('Wind speed', 'm/s', 0, 25, 10),
        density: p('Air density', 'kg/m³', 0.8, 1.4, 1.225),
        coefficient: p('Power coefficient Cp', '', 0, 16 / 27, 0.4),
        efficiency: p('Generator efficiency', '', 0, 1, 0.9),
      },
      metrics: {
        available: ['Kinetic wind power through rotor', 'kW'],
        shaft: ['Extracted shaft power', 'kW'],
        electric: ['Electrical output', 'kW'],
      },
      plot: {
        x: 'Wind speed',
        xUnit: 'm/s',
        y: 'Power',
        yUnit: 'kW',
        traces: { y: 'Electrical output', reference: 'Betz upper bound', other: 'Shaft power' },
      },
      text: content['windpower'],
    },
    ({ radius: r, speed, density: rho, coefficient: cp, efficiency: eta }) => {
      const available = (v) => (0.5 * rho * Math.PI * r * r * v ** 3) / 1000;
      return {
        summary: {
          available: available(speed),
          shaft: cp * available(speed),
          electric: eta * cp * available(speed),
        },
        series: samples(0, 25, (x) => ({
          y: eta * cp * available(x),
          reference: (16 / 27) * available(x),
          other: cp * available(x),
        })),
        visualization: {
          type: 'engineering-extension',
          kind: 'wind',
          radius: r,
          speed,
          cp,
          efficiency: eta,
        },
      };
    },
  ),
  batterydischarge: lab(
    {
      id: 'batterydischarge',
      title: 'Battery SOC & Loaded Discharge',
      discipline: 'energy',
      lab: 'EN03',
      topic: 'Energy storage',
      inputs: {
        capacity: p('Usable charge capacity', 'Ah', 0.5, 50, 5),
        current: p('Constant discharge current', 'A', 0, 20, 2),
        initial: p('Initial state of charge', '%', 10, 100, 100),
        empty: p('Empty-cell open-circuit voltage', 'V', 2.5, 3.2, 3),
        full: p('Full-cell open-circuit voltage', 'V', 3.5, 4.3, 4.2),
        resistance: p('Internal resistance', 'Ω', 0, 0.1, 0.05),
        duration: p('Viewing duration', 'h', 0.1, 10, 2),
      },
      metrics: {
        soc: ['State of charge at end', '%'],
        runtime: ['Time to empty at selected current', 'h'],
        energy: ['Delivered energy in view', 'Wh'],
      },
      plot: {
        x: 'Elapsed time',
        xUnit: 'h',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'Load-port voltage', reference: 'Open-circuit cell voltage' },
      },
      text: content['batterydischarge'],
    },
    ({ capacity: q, current: i, initial, empty, full, resistance: r, duration }) => {
      const s = initial / 100,
        runtime = i > 0 ? (q * s) / i : null,
        used = Math.min(i * duration, q * s),
        span = full - empty,
        energy = (empty + span * s - i * r) * used - (span * used * used) / (2 * q);
      return {
        summary: { soc: 100 * Math.max(0, s - (i * duration) / q), runtime, energy },
        series: samples(0, duration, (t) => {
          const soc = Math.max(0, s - (i * t) / q),
            ocv = empty + span * soc;
          return { y: i > 0 && soc <= 0 ? 0 : ocv - i * r, reference: ocv };
        }),
        visualization: {
          type: 'engineering-extension',
          kind: 'battery',
          capacity: q,
          current: i,
          initial: s,
          empty,
          full,
          resistance: r,
        },
        warnings:
          runtime !== null && duration >= runtime
            ? [
                'The selected view reaches empty SOC. The ideal protection switch disconnects the load at that instant.',
              ]
            : [],
      };
    },
  ),
  buckconverter: lab(
    {
      id: 'buckconverter',
      title: 'Buck Converter: Duty & Inductor Ripple',
      discipline: 'energy',
      lab: 'EN04',
      topic: 'Power electronics',
      inputs: switchInputs,
      metrics: switchMetrics,
      plot: switchPlot,
      text: content['buckconverter'],
    },
    (input) => converter(input, false),
  ),
  boostconverter: lab(
    {
      id: 'boostconverter',
      title: 'Boost Converter: Gain & Current Stress',
      discipline: 'energy',
      lab: 'EN05',
      topic: 'Power electronics',
      inputs: { ...switchInputs, voltage: p('Input voltage', 'V', 5, 50, 12) },
      metrics: switchMetrics,
      plot: switchPlot,
      text: content['boostconverter'],
    },
    (input) => converter(input, true),
  ),
  threephase: lab(
    {
      id: 'threephase',
      title: 'Balanced Three-Phase Power',
      discipline: 'energy',
      lab: 'EN06',
      topic: 'AC power systems',
      inputs: {
        voltage: p('Line-to-line RMS voltage', 'V', 100, 1000, 400),
        current: p('Line RMS current', 'A', 0, 100, 10),
        factor: p('Displacement power factor', '', 0.1, 1, 0.8),
        kind: choice(
          'Current phase',
          { lagging: 'Lagging / inductive', leading: 'Leading / capacitive' },
          'lagging',
        ),
        frequency: p('Supply frequency', 'Hz', 40, 70, 50),
      },
      metrics: {
        active: ['Total active power', 'kW'],
        reactive: ['Total reactive power', 'kvar'],
        apparent: ['Total apparent power', 'kVA'],
      },
      plot: {
        x: 'Time',
        xUnit: 'ms',
        y: 'Instantaneous phase power',
        yUnit: 'kW',
        traces: { y: 'Phase A', reference: 'Phase B', other: 'Phase C' },
      },
      text: content['threephase'],
    },
    ({ voltage: v, current: i, factor: pf, kind, frequency: f }) => {
      const phi = Math.acos(pf) * (kind === 'lagging' ? 1 : -1),
        s = (Math.sqrt(3) * v * i) / 1000,
        phase = v / Math.sqrt(3),
        power = (t, k) =>
          (2 *
            phase *
            i *
            Math.cos(2 * Math.PI * f * t - (k * 2 * Math.PI) / 3) *
            Math.cos(2 * Math.PI * f * t - (k * 2 * Math.PI) / 3 - phi)) /
          1000;
      return {
        summary: { active: s * pf, reactive: s * Math.sin(phi), apparent: s },
        series: samples(0, 2 / f, (t) => ({
          y: power(t, 0),
          reference: power(t, 1),
          other: power(t, 2),
        })).map((p) => ({ ...p, x: p.x * 1000 })),
        visualization: {
          type: 'engineering-extension',
          kind: 'phasor',
          phi,
          voltage: v,
          current: i,
          power: s * pf,
        },
        table: table(
          'Balanced wye-equivalent phases',
          [
            'Phase',
            'Voltage RMS (V)',
            'Current RMS (A)',
            'Voltage angle (degrees)',
            'Current angle (degrees)',
          ],
          ['A', 'B', 'C'].map((name, k) => [
            name,
            phase,
            i,
            -120 * k,
            -120 * k - (phi * 180) / Math.PI,
          ]),
        ),
      };
    },
  ),
};
energyModels.solarpv.definition.presets = { 'Half irradiance': { irradiance: 500 } };
energyModels.windpower.definition.presets = {
  'Betz ideal, lossless generator': { coefficient: 16 / 27, efficiency: 1 },
  'Calm air': { speed: 0 },
};
energyModels.batterydischarge.definition.presets = {
  'Open circuit': { current: 0 },
  'View past cutoff': { duration: 4 },
};
energyModels.buckconverter.definition.presets = {
  'Discontinuous-conduction warning': { resistance: 100, inductance: 0.1, frequency: 1 },
};
energyModels.boostconverter.definition.presets = { 'High duty': { duty: 0.75 } };
energyModels.threephase.definition.presets = {
  'Unity power factor': { factor: 1 },
  'Leading current': { kind: 'leading' },
};

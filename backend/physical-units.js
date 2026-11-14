const group = (dimension, scales) =>
  Object.fromEntries(Object.entries(scales).map(([unit, scale]) => [unit, { dimension, scale }]));
/** Canonical physical magnitudes. A conversion never changes a solver's declared contract units. */
export const units = {
  ...group('length', { m: 1, mm: 1e-3, cm: 1e-2, km: 1000, ft: 0.3048, in: 0.0254 }),
  ...group('area', { 'm²': 1, 'cm²': 1e-4, 'mm²': 1e-6, 'in²': 0.0254 ** 2 }),
  ...group('force', { N: 1, kN: 1000, lbf: 4.4482216152605 }),
  ...group('pressure', {
    Pa: 1,
    kPa: 1000,
    MPa: 1e6,
    GPa: 1e9,
    bar: 1e5,
    psi: 6894.757293168,
    ksi: 6894757.293168,
  }),
  ...group('time', { s: 1, ms: 1e-3, µs: 1e-6, min: 60, h: 3600 }),
  ...group('power', { W: 1, kW: 1000, MW: 1e6 }),
  ...group('energy', { J: 1, kJ: 1000, Wh: 3600, kWh: 3.6e6 }),
  ...group('voltage', { V: 1, mV: 1e-3, kV: 1000 }),
  ...group('current', { A: 1, mA: 1e-3 }),
  ...group('resistance', { Ω: 1, kΩ: 1000, MΩ: 1e6 }),
  ...group('capacitance', { F: 1, µF: 1e-6, nF: 1e-9 }),
  ...group('inductance', { H: 1, mH: 1e-3, µH: 1e-6 }),
  ...group('frequency', { Hz: 1, kHz: 1000, MHz: 1e6 }),
  K: { dimension: 'temperature', scale: 1 },
  '°C': { dimension: 'temperature', scale: 1, offset: 273.15 },
};
export function convert(value, from, to) {
  const a = describeUnit(from),
    b = describeUnit(to);
  if (!Number.isFinite(value) || !a || !b || a.dimension !== b.dimension)
    throw new Error(`Cannot convert ${from} to ${to}.`);
  const converted = (value * a.scale + (a.offset ?? 0) - (b.offset ?? 0)) / b.scale;
  if (!Number.isFinite(converted)) throw new Error('Unit conversion overflow.');
  return converted;
}
export const compatibleUnits = (unit) =>
  describeUnit(unit)
    ? Object.keys(units).filter(
        (key) => describeUnit(key).dimension === describeUnit(unit).dimension,
      )
    : [];

const dimensions = {
  length: [0, 1, 0, 0, 0],
  area: [0, 2, 0, 0, 0],
  force: [1, 1, -2, 0, 0],
  pressure: [1, -1, -2, 0, 0],
  time: [0, 0, 1, 0, 0],
  power: [1, 2, -3, 0, 0],
  energy: [1, 2, -2, 0, 0],
  voltage: [1, 2, -3, -1, 0],
  current: [0, 0, 0, 1, 0],
  resistance: [1, 2, -3, -2, 0],
  capacitance: [-1, -2, 4, 2, 0],
  inductance: [1, 2, -2, -2, 0],
  frequency: [0, 0, -1, 0, 0],
  temperature: [0, 0, 0, 0, 1],
  mass: [1, 0, 0, 0, 0],
  dimensionless: [0, 0, 0, 0, 0],
};
Object.assign(
  units,
  group('mass', { kg: 1, g: 0.001 }),
  group('dimensionless', { 1: 1, '%': 0.01 }),
  group('frequency', { rpm: 1 / 60 }),
  group('length', { µm: 1e-6 }),
);
for (const unit of Object.values(units)) unit.dimension = dimensions[unit.dimension].join(',');
const powers = { '²': '^2', '³': '^3', '⁴': '^4', '⁻': '-', '¹': '1' };
/** Parse products/quotients of registered units; affine temperatures are standalone only. */
export function describeUnit(source) {
  if (typeof source !== 'string' || source.length > 100) return null;
  if (Object.hasOwn(units, source)) return units[source];
  const normalized = source
    .replace(/[²³⁴⁻¹]/g, (c) => powers[c])
    .replace(/·|\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = normalized.split('/');
  if (parts.length > 2) return null;
  const vector = [0, 0, 0, 0, 0];
  let scale = 1;
  for (let i = 0; i < parts.length; i++) {
    const tokens = parts[i]
      .trim()
      .replace(/^\((.*)\)$/, '$1')
      .split(' ');
    for (const token of tokens) {
      const match = token.match(/^([^\^]+?)(?:\^(-?\d+))?$/);
      if (!match) return null;
      const unit = Object.hasOwn(units, match[1]) ? units[match[1]] : null;
      if (!unit || unit.offset) return null;
      const exponent = Number(match[2] ?? 1) * (i ? -1 : 1);
      if (Math.abs(exponent) > 8) return null;
      const d = unit.dimension.split(',').map(Number);
      d.forEach((v, j) => {
        vector[j] += v * exponent;
      });
      scale *= unit.scale ** exponent;
    }
  }
  return { dimension: vector.join(','), scale };
}

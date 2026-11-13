type Unit = { dimension: string; scale: number; offset?: number };
const group = (dimension: string, scales: Record<string, number>): Record<string, Unit> =>
  Object.fromEntries(Object.entries(scales).map(([unit, scale]) => [unit, { dimension, scale }]));
/** Canonical physical magnitudes. A conversion never changes a solver's declared contract units. */
export const units: Record<string, Unit> = {
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
export function convert(value: number, from: string, to: string): number {
  const a = units[from],
    b = units[to];
  if (!Number.isFinite(value) || !a || !b || a.dimension !== b.dimension)
    throw new Error(`Cannot convert ${from} to ${to}.`);
  return (value * a.scale + (a.offset ?? 0) - (b.offset ?? 0)) / b.scale;
}
export const compatibleUnits = (unit: string) =>
  units[unit]
    ? Object.keys(units).filter((key) => units[key].dimension === units[unit].dimension)
    : [];

import { solve as steamSolvePT, r1, r2, r4_P_Tsat } from '@neutrium/thermo.eos.iapws97/dist/PT.js';
import { bisect, requireValue } from './engineering-kit.js';
export function saturation(p) {
  const t = r4_P_Tsat(p),
    f = r1(p, t),
    g = r2(p, t);
  return { t, f, g };
}
export function steamPT(p, t) {
  const a = steamSolvePT(p, t);
  return { p, t, h: a.h, s: a.s, v: a.v, quality: null };
}
export function steamPH(p, h) {
  const { t, f, g } = saturation(p);
  if (h >= f.h && h <= g.h) {
    const x = (h - f.h) / (g.h - f.h);
    return { p, t, h, s: f.s + x * (g.s - f.s), v: f.v + x * (g.v - f.v), quality: x };
  }
  const liquid = h < f.h,
    T = bisect(
      (T) => (liquid ? r1(p, T) : r2(p, T)).h - h,
      liquid ? 273.15 : t,
      liquid ? t : 1073.15,
      45,
    );
  return steamPT(p, T);
}
export function steamPS(p, s) {
  const { t, f, g } = saturation(p);
  if (s >= f.s && s <= g.s) {
    const x = (s - f.s) / (g.s - f.s);
    return steamPH(p, f.h + x * (g.h - f.h));
  }
  const liquid = s < f.s,
    T = bisect(
      (T) => (liquid ? r1(p, T) : r2(p, T)).s - s,
      liquid ? 273.15 : t,
      liquid ? t : 1073.15,
      45,
    );
  return steamPT(p, T);
}
export function rankine(a) {
  requireValue(a.condenser < a.boiler, 'Condenser pressure must be below boiler pressure.');
  requireValue(
    a.superheat + 273.15 > saturation(a.boiler).t,
    'Boiler outlet must be superheated at the chosen pressure.',
  );
  if (a.reheat === 'yes')
    requireValue(
      a.reheatPressure > a.condenser &&
        a.reheatPressure < a.boiler &&
        a.reheatTemp + 273.15 > saturation(a.reheatPressure).t,
      'Reheat pressure must lie between condenser and boiler; reheat temperature must exceed its saturation temperature.',
    );
  const sat = saturation(a.condenser),
    one = { p: a.condenser, t: sat.t, h: sat.f.h, s: sat.f.s, v: sat.f.v, quality: 0 },
    pump = (sat.f.v * (a.boiler - a.condenser) * 1000) / a.pump,
    two = steamPH(a.boiler, one.h + pump),
    three = steamPT(a.boiler, a.superheat + 273.15),
    expand = (from, p) => steamPH(p, from.h - a.turbine * (from.h - steamPS(p, from.s).h));
  let states = [one, two, three],
    turbine,
    heat,
    out;
  if (a.reheat === 'yes') {
    const four = expand(three, a.reheatPressure),
      five = steamPT(a.reheatPressure, a.reheatTemp + 273.15);
    requireValue(five.h >= four.h, 'Chosen reheat temperature would cool the first-stage exhaust.');
    out = expand(five, a.condenser);
    turbine = three.h - four.h + five.h - out.h;
    heat = three.h - two.h + five.h - four.h;
    states.push(four, five, out);
  } else {
    out = expand(three, a.condenser);
    turbine = three.h - out.h;
    heat = three.h - two.h;
    states.push(out);
  }
  requireValue(
    heat > 0 && turbine > pump,
    'Chosen states do not form a positive-work heat engine.',
  );
  return {
    states,
    net: turbine - pump,
    heat,
    rejected: out.h - one.h,
    efficiency: (turbine - pump) / heat,
    quality: out.quality,
    pump,
    turbine,
  };
}
// Buck saturation pressure over liquid water; inputs in °C, output kPa.
export const saturationPressure = (T) =>
  0.61121 * Math.exp(((18.678 - T / 234.5) * T) / (257.14 + T));
export function wallModes(Bi, n = 40) {
  return Array.from({ length: n }, (_, i) => {
    const z = bisect((z) => z * Math.tan(z) - Bi, i * Math.PI + 1e-10, (i + 0.5) * Math.PI - 1e-10);
    return { z, A: (4 * Math.sin(z)) / (2 * z + Math.sin(2 * z)) };
  });
}
export function wallTheta(modes, Fo, x = 0) {
  return modes.reduce((s, { z, A }) => s + A * Math.exp(-z * z * Fo) * Math.cos(z * x), 0);
}
export function hardyLoop(total, R, fraction = 0.5) {
  let upper = total * fraction,
    lower = total - upper;
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const residual =
      (R[0] + R[1]) * upper * Math.abs(upper) - (R[2] + R[3]) * lower * Math.abs(lower);
    rows.push({ x: i, y: residual, upper, lower });
    if (Math.abs(residual) < 1e-10) break;
    const correction =
      -residual / (2 * ((R[0] + R[1]) * Math.abs(upper) + (R[2] + R[3]) * Math.abs(lower)));
    upper += correction;
    lower -= correction;
  }
  return { upper, lower, rows, head: (R[0] + R[1]) * upper * upper };
}

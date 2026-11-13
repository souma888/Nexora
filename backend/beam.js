import { number } from './contract.js';

const cases = {
  point: 'Simply supported · Center point load',
  uniform: 'Simply supported · Uniform load',
  cantilever: 'Cantilever · Tip point load',
};

export const definition = {
  id: 'beam',
  version: '1.1',
  inputs: {
    case: { label: 'Load case', type: 'enum', options: Object.keys(cases) },
    span: number('Span', 'm', 0.25, 30),
    load: { ...number('Load', 'kN', 0.01, 500), unitByCase: { uniform: 'kN/m' } },
    modulus: number('Elastic modulus', 'GPa', 1, 500),
    inertia: number('Second moment of area', 'cm⁴', 1, 1000000),
  },
  outputs: {
    summary: {
      reactionA: 'kN',
      reactionB: 'kN',
      moment: 'kN·m',
      deflection: 'mm',
      deflectionAt: 'm',
    },
    series: { x: 'm', shear: 'kN', moment: 'kN·m', deflection: 'mm', slope: 'mrad' },
  },
};

/** @param {{case:'point'|'uniform'|'cantilever',span:number,load:number,modulus:number,inertia:number}} input */
export function solveBeam(input) {
  const { case: model, span: L, load, modulus, inertia } = input;
  const EI = modulus * 1e9 * inertia * 1e-8;
  const P = load * 1000;
  const uniform = model === 'uniform';
  const fixed = model === 'cantilever';
  const reactionA = fixed ? P : uniform ? (P * L) / 2 : P / 2;
  const reactionB = fixed ? null : reactionA;
  const positions = Array.from({ length: 81 }, (_, index) => L * (index / 80));
  // Include both limits at the point-load discontinuity.
  if (model === 'point') positions.splice(40, 0, L / 2);

  const series = positions.map((x, index) => {
    const z = Math.min(x, L - x);
    let shear, moment, deflection, slope;
    if (fixed) {
      shear = P;
      moment = -P * (L - x);
      deflection = (-P * x ** 2 * (3 * L - x)) / (6 * EI);
      slope = (-P * x * (2 * L - x)) / (2 * EI);
    } else if (uniform) {
      shear = reactionA - P * x;
      moment = (P * x * (L - x)) / 2;
      deflection = (-P * x * (L - x) * (L ** 2 + L * x - x ** 2)) / (24 * EI);
      slope = (-P * (L ** 3 - 6 * L * x ** 2 + 4 * x ** 3)) / (24 * EI);
    } else {
      shear = index <= 40 ? reactionA : -reactionA;
      moment = (P * z) / 2;
      deflection = (-P * z * (3 * L ** 2 - 4 * z ** 2)) / (48 * EI);
      slope = (Math.sign(x - L / 2) * P * (3 * L ** 2 - 12 * z ** 2)) / (48 * EI);
    }
    return {
      x,
      shear: shear / 1000,
      moment: moment / 1000,
      deflection: deflection * 1000,
      slope: slope * 1000,
    };
  });

  const peak = (key) => series.reduce((a, b) => (Math.abs(a[key]) >= Math.abs(b[key]) ? a : b));
  const displacement = peak('deflection');
  return {
    series,
    summary: {
      reactionA: reactionA / 1000,
      reactionB: reactionB === null ? null : reactionB / 1000,
      moment: peak('moment').moment,
      deflection: displacement.deflection,
      deflectionAt: displacement.x,
    },
  };
}

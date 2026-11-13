import { energyModels } from '../backend/power-energy.js';
import { lab, p } from '../backend/lab-kit.js';
// These fail the type check if the public solver boundary ever degrades to any.
const settings = { voltage: 24, duty: 0.5, resistance: 10, inductance: 2, frequency: 20 };
// @ts-expect-error Duty must be numeric.
energyModels.buckconverter.solve({ ...settings, duty: 'bad' });
// @ts-expect-error Required input voltage is missing.
energyModels.buckconverter.solve({ duty: 0.5, resistance: 10, inductance: 2, frequency: 20 });
lab(
  {
    id: 'type-proof',
    inputs: { x: p('x', 'm', 0, 10, 1) },
    metrics: { value: ['Value', 'm'] },
    text: ['', '', [], '', '', '', ''],
  },
  // @ts-expect-error Summary values must be numeric or null, never strings.
  ({ x }) => ({ summary: { value: String(x) } }),
);

import { solveBeam } from '../backend/beam.js';
const beam = { case: 'point' as const, span: 6, load: 24, modulus: 200, inertia: 8000 };
// @ts-expect-error Dedicated beam inputs also reject textual numbers.
solveBeam({ ...beam, span: '6' });

import { solveLinear } from '../backend/linear.js';
// @ts-expect-error Linear systems require numerical coefficients.
solveLinear([['not a coefficient']], [1]);

import { metallurgyModels } from './metallurgy.js';
import { structuralModels } from './structures.js';
import { cycleModels } from './thermodynamic-cycles.js';
import { heatFlowModels } from './heat-flow.js';
import { civilSystemsModels } from './civil-systems.js';
import { electricalMachineModels } from './electrical-machines.js';
import { semiconductorModels } from './semiconductors.js';
import { advancedMaterialModels } from './advanced-materials.js';
import './material-upgrades.js';
export const newEngineeringModels = {
  ...metallurgyModels,
  ...structuralModels,
  ...cycleModels,
  ...heatFlowModels,
  ...civilSystemsModels,
  ...electricalMachineModels,
  ...semiconductorModels,
};
export const upgradedMaterialIds = [
  'leverrule',
  'fickdiffusion',
  'hallpetch',
  'fracturetoughness',
  'pariscrack',
  'goodman',
  'larsonmiller',
];
export const engineeringReleaseModels = {
  ...newEngineeringModels,
  ...Object.fromEntries(upgradedMaterialIds.map((id) => [id, advancedMaterialModels[id]])),
};
// Curated contrasting setups, expressed only in each lab's canonical inputs.
const presets = {
  leverrule: {
    'Supplied reference tie line': { mode: 'tie', alpha: 20, beta: 80, composition: 40 },
    'All solid': { mode: 'diagram', temperature: 800 },
    'Two-phase envelope': { mode: 'diagram', temperature: 1100 },
    'All liquid': { mode: 'diagram', temperature: 1600 },
  },
  eutectic: {
    'Eutectic alloy': { composition: 61.9 },
    'Primary alpha': { composition: 30 },
    'Primary beta': { composition: 85 },
  },
  ironcarbon: {
    Hypoeutectoid: { carbon: 0.4, temperature: 600 },
    Eutectoid: { carbon: 0.76, temperature: 727 },
    Hypereutectoid: { carbon: 1.2, temperature: 600 },
  },
  tttcct: {
    'Isothermal nose': { mode: 'isothermal', hold: 550 },
    'Slow cooling': { mode: 'cooling', rate: 0.5 },
    'Rapid quench': { mode: 'cooling', rate: 100 },
  },
  carburizing: { 'Four hours': { hours: 4 }, 'Fourfold time': { hours: 16 } },
  workhardening: {
    'Power-law hardening': { mode: 'hollomon' },
    'Dislocation increment': { mode: 'dislocation' },
  },
  laminate: {
    'Symmetric cross-ply': { angles: '0,90,90,0' },
    'Unsymmetric angle-ply': { angles: '0,45,90' },
    'Unidirectional reference': { angles: '0,0' },
  },
  relaxation: {
    'Maxwell liquid-like limit': { model: 'maxwell' },
    'SLS retained modulus': { model: 'sls' },
  },
  threemoment: {
    'Equal two spans': { spans: 'two', ratio: 1, loadRatio: 1 },
    'Three unequal spans': {
      spans: 'three',
      ratio: 1.25,
      loadRatio: 0.7,
      thirdRatio: 0.75,
      thirdLoad: 1.4,
    },
  },
  momentdistribution: {
    'Equal two spans': { spans: 'two', ratio: 1, loadRatio: 1 },
    'Carry-over across two joints': {
      spans: 'three',
      ratio: 1.25,
      loadRatio: 0.7,
      thirdRatio: 0.75,
      thirdLoad: 1.4,
    },
  },
  lame: {
    'Internal pressure': { inside: 10, outside: 0 },
    'Hydrostatic closed cylinder': { inside: 10, outside: 10, ends: 'closed' },
  },
  failurecriteria: {
    'Uniaxial tension': { first: 200, second: 0, third: 0 },
    'Pure shear principal state': { first: 100, second: -100, third: 0 },
    'Hydrostatic tension': { first: 100, second: 100, third: 100 },
  },
  dieseldual: { Diesel: { mode: 'diesel' }, 'Dual heat addition': { mode: 'dual', rise: 1.5 } },
  rankine: {
    'Superheat only': { reheat: 'no' },
    'One reheat stage': { reheat: 'yes' },
    'Reversible stage benchmark': { reheat: 'no', pump: 1, turbine: 1 },
  },
  fin: { 'Insulated tip': { tip: 'adiabatic' }, 'Convective tip': { tip: 'convective' } },
  heisler: {
    'Heisler reference': { biot: 1, fourier: 0.2 },
    'Small Bi nearly lumped': { biot: 0.01, fourier: 0.2 },
    'Early-time comparison': { biot: 1, fourier: 0.02 },
  },
  pumpcurve: { 'Operating intersection': { static: 10 }, 'Beyond shutoff head': { static: 100 } },
  couette: {
    'Pure pressure-driven': { speed: 0, gradient: 100 },
    'Pure moving wall': { speed: 0.5, gradient: 0 },
    'Opposing pressure gradient': { speed: 0.5, gradient: -1000 },
  },
  consolidation: {
    'Double drainage': { drainage: 'double' },
    'Single drainage': { drainage: 'single' },
  },
  rcflexure: { 'Under-reinforced': { steel: 2000 }, 'Over-reinforced': { steel: 10000 } },
  transformer: { 'Lagging load': { kind: 'lag' }, 'Leading load': { kind: 'lead' } },
  inductionmotor: { 'Normal motoring': { slip: 0.04 }, 'Locked rotor': { slip: 1 } },
  commutation: {
    'Six-step BLDC': { mode: 'bldc' },
    'Full step': { mode: 'full' },
    'Half step': { mode: 'half' },
  },
  twobus: { 'High/low voltage roots': { power: 0.8 }, 'Above loadability limit': { power: 3 } },
  symmetrical: {
    'Single line to ground': { type: 'ground' },
    'Line to line': { type: 'line' },
    'Double line to ground': { type: 'double' },
    'Three phase': { type: 'three' },
  },
  pnjunction: { 'Forward biased': { bias: 0.7 }, 'Reverse biased': { bias: -1 } },
  bjtbias: {
    'Forward-active reference': { upper: 100, lower: 20, collector: 2, beta: 100 },
    'Saturated switch': { upper: 10, lower: 100, collector: 10, beta: 300 },
  },
  cmosinverter: {
    'Matched inverter': { nbeta: 1, pbeta: 1 },
    'Stronger NMOS': { nbeta: 2, pbeta: 1 },
  },
  sallenkey: {
    'Unity-gain equal components': { gain: 1 },
    'Butterworth equal components': { gain: 3 - Math.SQRT2 },
  },
  timer555: { 'Astable oscillator': { mode: 'astable' }, 'One-shot pulse': { mode: 'mono' } },
  schmitt: {
    'Cross both thresholds': { amplitude: 2 },
    'Hold inside band': { amplitude: 0.1, initial: 'high' },
  },
};
for (const [id, cases] of Object.entries(presets))
  engineeringReleaseModels[id].definition.presets = cases;

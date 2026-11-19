import { opticsModels } from './optics-electromagnetics.js';
import { dspModels } from './dsp-studies.js';
import { controlStudyModels } from './control-studies.js';
import { instrumentationModels } from './instrumentation-studies.js';
import { manufacturingModels } from './manufacturing-studies.js';
import { flightOrbitalModels } from './flight-orbital-studies.js';
import { processModels } from './process-studies.js';
import { operationsModels } from './operations-studies.js';
import { biomedicalModels } from './biomedical-studies.js';
import { roboticsStudyModels } from './robotics-studies.js';
import { vehicleModels } from './vehicle-studies.js';
import { communicationStudyModels } from './communication-studies.js';
import { identificationModels } from './identification.js';
export const newExplorationModels = {
  ...opticsModels,
  ...dspModels,
  ...controlStudyModels,
  ...instrumentationModels,
  ...manufacturingModels,
  ...flightOrbitalModels,
  ...processModels,
  ...operationsModels,
  ...biomedicalModels,
  ...roboticsStudyModels,
  ...vehicleModels,
  ...communicationStudyModels,
};
// Retain existing saved-run IDs for the two already implemented subjects.
for (const [id, discipline, topic] of [
  ['kalmanfilter', 'control', 'Control design & estimation'],
  ['tolerancestack', 'manufacturing', 'Manufacturing processes'],
]) {
  const model = identificationModels[id];
  model.definition.execution = 'worker';
  model.definition.discipline = discipline;
  model.definition.topic = topic;
  const solve = model.solve;
  model.solve = (input) => {
    const r = solve(input);
    return {
      ...r,
      visualization: {
        type: 'exploration',
        kind: id === 'kalmanfilter' ? 'tracking-filter' : 'tolerance',
        points: r.series,
      },
    };
  };
}
export const explorationReleaseModels = {
  ...newExplorationModels,
  kalmanfilter: identificationModels.kalmanfilter,
  tolerancestack: identificationModels.tolerancestack,
};
const presets = {
  snell: {
    'Glass to air, TIR': { n1: 1.5, n2: 1, incidence: 60 },
    'Air to glass': { n1: 1, n2: 1.5, incidence: 45 },
  },
  thinlens: {
    'Real inverted image': { focal: 10, object: 30 },
    'Virtual upright image': { focal: 10, object: 5 },
    'At focus': { focal: 10, object: 10 },
    'Diverging lens': { focal: -10, object: 30 },
  },
  fftspectrum: {
    'Bin-centered rectangle': { frequency: 17, window: 'rectangular' },
    'Leaking rectangle': { frequency: 17.3, window: 'rectangular' },
    'Hann window': { frequency: 17.3, window: 'hann' },
  },
  rootlocus3: {
    'Stable gain': { first: 1, second: 2, gain: 3 },
    'Stability boundary': { first: 1, second: 2, gain: 6 },
    'Unstable pair': { first: 1, second: 2, gain: 12 },
  },
  constrainedmpc: { 'Tight actuator': { bound: 0.05 }, 'Loose actuator': { bound: 1 } },
  serialtiming: {
    'UART 8N1': { bus: 'UART' },
    'SPI mode 3': { bus: 'SPI', polarity: 'mode3' },
    'I²C write': { bus: 'I2C' },
  },
  shockrelations: {
    'Normal shock': { kind: 'normal', mach: 2 },
    'Weak attached': { kind: 'weak', mach: 2, turn: 10 },
    'Detached request': { kind: 'weak', mach: 2, turn: 40 },
  },
  binaryflash: {
    'All liquid': { temperature: 60 },
    'Two phases': { temperature: 95 },
    'All vapor': { temperature: 120 },
  },
  hodgkinhuxley: {
    'Subthreshold pulse': { current: 1, duration: 2 },
    'Spiking pulse': { current: 10, duration: 15 },
  },
  ofdm: {
    'Protected FFT block': { prefix: 8, delay: 6 },
    'Prefix too short': { prefix: 2, delay: 10 },
    'No echo': { prefix: 0, echo: 0 },
  },
  rotations: {
    Identity: { roll: 0, pitch: 0, yaw: 0 },
    'Gimbal lock': { roll: 20, pitch: 90, yaw: 30 },
  },
  evrange: { 'No regeneration': { regeneration: 0 }, 'Regenerative stops': { regeneration: 0.6 } },
};
for (const [id, values] of Object.entries(presets))
  newExplorationModels[id].definition.presets = {
    ...newExplorationModels[id].definition.presets,
    ...values,
  };

// Run the stated numerical reference, which need not be the first interactive setup.
const referenceInputs = {
  fresnel: { incidence: (Math.atan(1.5) * 180) / Math.PI },
  fourierseries: { harmonics: 1 },
  fftspectrum: { frequency: 17, window: 'rectangular' },
  correlationdelay: { noise: 0 },
  rootlocus3: { gain: 6 },
  pwmfilter: { duty: 50 },
  adcquantization: { amplitude: 1 },
  temperaturelinearization: { sensor: 'pt100', temperature: 100 },
  sensorallan: { walk: 0 },
  keplerorbit: { axis: 7000, eccentricity: 0 },
  hohmann: { initial: 300, final: 300 },
  shockrelations: { kind: 'normal', mach: 2 },
  vantHoff: { enthalpy: 0 },
  tanksrtd: { tanks: 1 },
  ecgsynthetic: { rate: 60, jitter: 0 },
  pharmacokinetics: { configuration: 'one' },
  pulseoximetry: { pulse: 0.001 },
  armjacobian: { first: 1, second: 1, elbow: 90 },
  potentialnavigation: { obstacles: '[]' },
  rotations: { roll: 0, pitch: 0, yaw: 0 },
  understeer: { front: 50, cf: 70, cr: 70 },
  powertrain: { radius: 0.3 },
  eyediagram: { echo: 0 },
  biterror: { ebno: 0, scheme: 'BPSK' },
  antennapattern: { elements: 2, spacing: 0.5, steer: 0, kind: 'array' },
};
for (const [id, model] of Object.entries(explorationReleaseModels)) {
  const defaults = Object.fromEntries(
    Object.entries(model.definition.inputs).map(([key, field]) => [key, field.initial]),
  );
  const exampleInputs = { ...defaults, ...referenceInputs[id] };
  model.definition.exampleInputs = exampleInputs;
  model.definition.presets = { 'Worked reference': exampleInputs, ...model.definition.presets };
}

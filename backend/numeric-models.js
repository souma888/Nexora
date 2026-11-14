import { customModels } from './custom-labs.js';
import { calculusModels } from './mathematics-calculus.js';
import { linearMathModels } from './mathematics-linear.js';
import { odeMathModels } from './mathematics-ode.js';
import { statisticsMathModels } from './mathematics-statistics.js';
import { numericalMathModels } from './mathematics-numerical.js';
import { machineLearningModels } from './machine-learning.js';
import { trussModels } from './truss.js';
import { advancedMaterialModels } from './advanced-materials.js';
import { identificationModels } from './identification.js';
import { circuitModels } from './circuit-builder.js';
import { cosine, experiment, parameter, samples } from './experiment.js';
import { mechanicalModels } from './mechanical-experiments.js';
import { systemModels } from './system-experiments.js';
import { controlModels } from './control-experiments.js';
import { thermofluidModels } from './thermofluids.js';
import { digitalModels } from './digital.js';
import { roboticModels } from './robotics.js';
import { computationalModels } from './computational.js';
import { materialScienceModels } from './material-science.js';
import { computerModels } from './computer-engineering.js';
import { communicationModels } from './communications.js';
import { energyModels } from './power-energy.js';
import { aerospaceModels } from './aerospace.js';
import { chemicalModels } from './chemical-process.js';
import { industrialModels } from './industrial.js';

export const models = {
  ...calculusModels,
  ...linearMathModels,
  ...odeMathModels,
  ...statisticsMathModels,
  ...numericalMathModels,
  ...machineLearningModels,
  ...customModels,
  ...trussModels,
  ...advancedMaterialModels,
  ...identificationModels,
  ...circuitModels,
  divider: experiment(
    'divider',
    {
      title: 'Loaded Voltage Divider',
      discipline: 'electrical',
      lab: '04',
      description: 'Explore how a load resistor changes a divider’s output voltage.',
      predict: 'What happens to the output voltage when you decrease the load resistance?',
      example:
        'A 12 V source and two 10 kΩ resistors give 6 V unloaded. Connecting a 10 kΩ load reduces the lower leg to 5 kΩ and the output to 4 V.',
      equation: 'Rₚ = R₂Rₗ/(R₂ + Rₗ). Loaded Vₒ = VᵢRₚ/(R₁ + Rₚ). Unloaded Vₒ = VᵢR₂/(R₁ + R₂).',
      limits:
        'R₁ is the upper resistor. R₂ and the load share the output node and ground. The source and resistors are ideal.',
      inputs: {
        voltage: parameter('Supply voltage', 'V', 0, 48, 12),
        upper: parameter('Upper resistance R₁', 'kΩ', 0.1, 1000, 10),
        lower: parameter('Lower resistance R₂', 'kΩ', 0.1, 1000, 10),
        load: parameter('Load resistance Rₗ', 'kΩ', 0.1, 1000, 10),
      },
      metrics: { loaded: 'Loaded output', unloaded: 'Unloaded output', current: 'Load current' },
      plot: {
        title: 'Divider transfer',
        x: 'Supply voltage',
        y: 'Output voltage',
        traces: { y: 'Loaded', reference: 'Unloaded' },
      },
      outputs: {
        summary: { loaded: 'V', unloaded: 'V', current: 'mA' },
        series: { x: 'V', y: 'V', reference: 'V' },
      },
    },
    ({ voltage, upper, lower, load }) => {
      const parallel = (lower * load) / (lower + load);
      const ratio = parallel / (upper + parallel);
      const ideal = lower / (upper + lower);
      return {
        summary: {
          loaded: voltage * ratio,
          unloaded: voltage * ideal,
          current: (voltage * ratio) / load,
        },
        series: samples(
          0,
          Math.max(voltage, 1),
          (x) => ({ y: x * ratio, reference: x * ideal }),
          48,
        ),
      };
    },
  ),
  rc: experiment(
    'rc',
    {
      title: 'RC Charging',
      discipline: 'electrical',
      lab: '05',
      description: 'Watch an initially discharged capacitor respond to a voltage step.',
      predict:
        'If you double the capacitance, which changes: the final voltage, the charging time, or both?',
      example:
        'A 5 V step, 10 kΩ resistor, and 100 µF capacitor give a 1 s time constant. After 1 s, the capacitor reaches about 3.16 V.',
      equation: 'τ = RC. v꜀(t) = Vₛ(1 − exp(−t/τ)). The 10–90% rise time is τ·ln(9).',
      limits:
        'The capacitor starts at 0 V. The source steps instantly at t = 0. The model excludes leakage and parasitic resistance.',
      inputs: {
        voltage: parameter('Step voltage', 'V', 0, 48, 5),
        resistance: parameter('Series resistance', 'kΩ', 0.1, 1000, 10),
        capacitance: parameter('Capacitance', 'µF', 0.1, 10000, 100),
      },
      metrics: { tau: 'Time constant', atTau: 'Voltage at one τ', rise: '10–90% rise time' },
      plot: {
        title: 'Capacitor step response',
        x: 'Time',
        y: 'Voltage',
        traces: { y: 'Capacitor', reference: 'Supply' },
      },
      outputs: {
        summary: { tau: 'ms', atTau: 'V', rise: 'ms' },
        series: { x: 'ms', y: 'V', reference: 'V' },
      },
    },
    ({ voltage, resistance, capacitance }) => {
      const tau = resistance * capacitance; // kΩ × µF = ms
      return {
        summary: {
          tau,
          atTau: voltage * -Math.expm1(-1),
          rise: voltage === 0 ? null : tau * Math.log(9),
        },
        series: samples(0, 5 * tau, (x) => ({
          y: voltage * -Math.expm1(-x / tau),
          reference: voltage,
        })),
      };
    },
  ),
  rectifier: experiment(
    'rectifier',
    {
      title: 'Diode Half-Wave Rectifier',
      discipline: 'electronics',
      lab: '06',
      description: 'See which parts of a sine wave pass through a series diode.',
      predict: 'What will reach the output if the input peak is below the diode’s forward drop?',
      example:
        'With a 5 V input peak and a 0.7 V forward drop, the output peaks at 4.3 V. The entire negative half-cycle gives 0 V.',
      equation: 'vᵢ(t) = A·sin(2πft). vₒ(t) = max(0, vᵢ(t) − Vꜰ).',
      limits:
        'The diode points from the source toward a resistive load. The constant-drop model excludes reverse leakage, breakdown, and smoothing capacitors.',
      inputs: {
        amplitude: parameter('Input peak', 'V', 0, 24, 5),
        frequency: parameter('Input frequency', 'Hz', 1, 1000, 50),
        drop: parameter('Forward drop', 'V', 0, 5, 0.7),
      },
      metrics: { peak: 'Output peak', period: 'Period', conduction: 'Conducting fraction' },
      plot: {
        title: 'Rectified waveform',
        x: 'Time',
        y: 'Voltage',
        traces: { y: 'Rectified output', reference: 'Input sine' },
      },
      outputs: {
        summary: { peak: 'V', period: 'ms', conduction: '%' },
        series: { x: 'ms', y: 'V', reference: 'V' },
      },
    },
    ({ amplitude, frequency, drop }) => {
      const period = 1000 / frequency;
      return {
        summary: {
          peak: Math.max(0, amplitude - drop),
          period,
          conduction: amplitude > drop ? (100 * Math.acos(drop / amplitude)) / Math.PI : 0,
        },
        series: samples(0, 2 * period, (x) => {
          const reference = amplitude * Math.sin((2 * Math.PI * x) / period);
          return { reference, y: Math.max(0, reference - drop) };
        }),
      };
    },
  ),
  opamp: experiment(
    'opamp',
    {
      title: 'Inverting Op-Amp',
      discipline: 'electronics',
      lab: '07',
      description: 'Adjust feedback gain and see where the output clips at its limits.',
      predict: 'If you double the feedback resistance, will the output always double?',
      example:
        'With Rᵢ = 10 kΩ and Rꜰ = 100 kΩ, the gain is −10. A +1 V input asks for −10 V, so an output limit of ±5 V clips it at −5 V.',
      equation:
        'Aᵥ = −Rꜰ/Rᵢ. vₒ = clamp(Aᵥvᵢ, −Vₗᵢₘ, +Vₗᵢₘ). Clipping begins when |vᵢ| exceeds Vₗᵢₘ/|Aᵥ|.',
      limits:
        'This is a static, ideal model with symmetric output limits. It excludes bandwidth, slew rate, input offsets, and output loading.',
      inputs: {
        voltage: parameter('Input voltage', 'V', -24, 24, 1),
        inputResistance: parameter('Input resistance Rᵢ', 'kΩ', 0.1, 1000, 10),
        feedback: parameter('Feedback resistance Rꜰ', 'kΩ', 0.1, 1000, 100),
        limit: parameter('Output limit magnitude', 'V', 0.1, 48, 5),
      },
      metrics: {
        gain: 'Linear gain',
        output: 'Output at selected input',
        threshold: 'Clipping threshold',
      },
      plot: {
        title: 'Amplifier transfer',
        x: 'Input voltage',
        y: 'Output voltage',
        traces: { y: 'Limited output' },
      },
      outputs: {
        summary: { gain: 'V/V', output: 'V', threshold: 'V' },
        series: { x: 'V', y: 'V' },
      },
    },
    ({ voltage, inputResistance, feedback, limit }) => {
      const gain = -feedback / inputResistance;
      const threshold = limit / -gain;
      const sweep = Math.min(24, Math.max(1.5 * threshold, Math.abs(voltage)));
      const corners = threshold < sweep ? [-threshold, 0, threshold] : [0];
      const output = (x) => Math.max(-limit, Math.min(limit, gain * x));
      return {
        summary: { gain, output: output(voltage), threshold },
        series: [-sweep, ...corners, sweep].map((x) => ({ x, y: output(x) })),
      };
    },
  ),
  sampling: experiment(
    'sampling',
    {
      title: 'Sampling & Aliasing',
      discipline: 'signals',
      lab: '08',
      description: 'Compare an input cosine, its samples, and a cosine that fits the same samples.',
      predict: 'How will the apparent frequency change if you sample an 8 Hz tone at 12 Hz?',
      example:
        'At 12 samples per second, an 8 Hz cosine produces the same samples as a 4 Hz cosine. A sample rate above 16 Hz keeps this 8 Hz tone below Nyquist.',
      equation:
        'x[n] = cos(2πfn/fₛ). The folded frequency is |f − fₛ·round(f/fₛ)|, between 0 and fₛ/2.',
      limits:
        'The source is one zero-phase, unit-amplitude cosine. The alias curve is a matching candidate, and the chart covers one second.',
      inputs: {
        frequency: parameter('Tone frequency', 'Hz', 0, 20, 8),
        rate: parameter('Sample rate', 'Hz', 2, 60, 12),
      },
      metrics: {
        nyquist: 'Nyquist frequency',
        alias: 'Folded frequency',
        count: 'Samples in view',
      },
      plot: {
        title: 'Input and sampled signal',
        x: 'Time',
        y: 'Amplitude',
        traces: { y: 'Input cosine', reference: 'Folded cosine', sample: 'Samples' },
      },
      outputs: {
        summary: { nyquist: 'Hz', alias: 'Hz', count: '' },
        series: { x: 's', y: '', reference: '', sample: '' },
      },
    },
    ({ frequency, rate }) => {
      const alias = Math.abs(frequency - rate * Math.round(frequency / rate));
      const evaluate = (x) => ({ y: cosine(frequency, x), reference: cosine(alias, x) });
      const points = new Map(samples(0, 1, evaluate).map((point) => [point.x, point]));
      const count = Math.floor(rate) + 1;
      for (let i = 0; i < count; i++) {
        const x = i / rate;
        const point = evaluate(x);
        points.set(x, { x, ...point, sample: point.y });
      }
      return {
        summary: { nyquist: rate / 2, alias, count },
        series: [...points.values()].sort((a, b) => a.x - b.x),
      };
    },
  ),
  average: experiment(
    'average',
    {
      title: 'Moving Average Filter',
      discipline: 'signals',
      lab: '09',
      description: 'See how averaging recent samples smooths a step and adds delay.',
      predict:
        'How will a wider averaging window affect the number of samples needed to reach the final value?',
      example:
        'For a unit step and a four-sample window, the output after the step is 0.25, 0.5, 0.75, then 1. The group delay is 1.5 samples.',
      equation: 'y[n] = (1/N)·Σ x[n − k] for k = 0 to N − 1. Group delay is (N − 1)/2 samples.',
      limits:
        'The filter is causal and all samples before the step are zero. The dotted input and solid output show discrete values joined for readability.',
      inputs: {
        amplitude: parameter('Step height', '', 0, 10, 1),
        window: { ...parameter('Averaging window', 'samples', 1, 20, 4), integer: true },
      },
      metrics: { first: 'First output', final: 'Final output', delay: 'Group delay' },
      plot: {
        title: 'Discrete step response',
        x: 'Sample index',
        y: 'Amplitude',
        traces: { y: 'Filtered output', reference: 'Input step' },
      },
      outputs: {
        summary: { first: '', final: '', delay: 'samples' },
        series: { x: '', y: '', reference: '' },
      },
    },
    ({ amplitude, window }) => ({
      summary: { first: amplitude / window, final: amplitude, delay: (window - 1) / 2 },
      series: samples(
        -3,
        window + 3,
        (x) => ({
          y: (amplitude * Math.min(window, Math.max(0, x + 1))) / window,
          reference: x < 0 ? 0 : amplitude,
        }),
        window + 6,
      ),
    }),
  ),
  ...mechanicalModels,
  ...systemModels,
  ...controlModels,
  ...thermofluidModels,
  ...digitalModels,
  ...roboticModels,
  ...computationalModels,
  ...materialScienceModels,
  ...computerModels,
  ...communicationModels,
  ...energyModels,
  ...aerospaceModels,
  ...chemicalModels,
  ...industrialModels,
};

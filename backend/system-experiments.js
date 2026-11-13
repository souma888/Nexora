import { cosine, experiment, parameter, samples } from './experiment.js';

export const systemModels = {
  rl: experiment(
    'rl',
    {
      title: 'RL Step Response',
      discipline: 'electrical',
      lab: '14',
      description: 'Watch current build in a series resistor and inductor after a voltage step.',
      predict: 'If you double the inductance, what changes?',
      prediction: [
        ['The final current doubles', 'The time constant doubles', 'Both double'],
        1,
        'Inductance changes L/R, while the final current remains V/R.',
      ],
      example:
        'A 12 V step across 6 Ω and 60 mH gives a 10 ms time constant and a 2 A final current. At 10 ms the current is about 1.264 A.',
      equation: 'τ = L/R and i(t) = (V/R)[1 − exp(−t/τ)].',
      limits:
        'The inductor begins with zero current. The source, resistor, and inductor are ideal. The model excludes saturation and parasitic capacitance.',
      inputs: {
        voltage: parameter('Step voltage', 'V', 0, 48, 12),
        resistance: parameter('Series resistance', 'Ω', 0.1, 1000, 6),
        inductance: parameter('Inductance', 'mH', 0.01, 10000, 60),
      },
      metrics: { tau: 'Time constant', final: 'Final current', atTau: 'Current at one τ' },
      plot: {
        title: 'Inductor current',
        x: 'Time',
        y: 'Current',
        traces: { y: 'Current', reference: 'Final current' },
      },
      outputs: {
        summary: { tau: 'ms', final: 'A', atTau: 'A' },
        series: { x: 'ms', y: 'A', reference: 'A' },
      },
    },
    ({ voltage, resistance, inductance }) => {
      const tau = inductance / resistance;
      const final = voltage / resistance;
      const current = (x) => final * -Math.expm1(-x / tau);
      return {
        summary: { tau, final, atTau: current(tau) },
        series: samples(0, 5 * tau, (x) => ({ y: current(x), reference: final })),
      };
    },
  ),
  resonance: experiment(
    'resonance',
    {
      title: 'Series RLC Resonance',
      discipline: 'electrical',
      lab: '15',
      description:
        'Sweep frequency and see how resistance changes the height and width of a resonance.',
      predict: 'What does a larger series resistance do to the current peak?',
      prediction: [
        ['Makes it higher and narrower', 'Makes it lower and wider', 'Shifts its frequency up'],
        1,
        'At resonance current is V/R, and the half-power bandwidth is proportional to R.',
      ],
      example:
        'A 100 mH inductor and 10 µF capacitor resonate near 159.15 Hz. With 20 Ω and a 10 V peak source, the current peaks at 0.5 A.',
      equation:
        'f₀ = 1/(2π√LC). |I| = V/√[R² + (2πfL − 1/(2πfC))²]. Half-power bandwidth Δf = R/(2πL).',
      limits:
        'Steady-state sinusoidal drive with ideal series components. Voltage and current use peak magnitudes. The plot zooms around resonance and may not include both half-power frequencies at low Q.',
      inputs: {
        voltage: parameter('Source peak voltage', 'V', 0, 48, 10),
        resistance: parameter('Series resistance', 'Ω', 0.1, 1000, 20),
        inductance: parameter('Inductance', 'mH', 0.1, 1000, 100),
        capacitance: parameter('Capacitance', 'µF', 0.01, 1000, 10),
      },
      metrics: {
        resonance: 'Resonant frequency',
        peak: 'Peak current',
        bandwidth: 'Half-power bandwidth',
      },
      plot: {
        title: 'Frequency sweep',
        x: 'Frequency',
        y: 'Current',
        traces: { y: 'Current amplitude', reference: 'Half-power level' },
      },
      outputs: {
        summary: { resonance: 'Hz', peak: 'A', bandwidth: 'Hz' },
        series: { x: 'Hz', y: 'A', reference: 'A' },
      },
    },
    ({ voltage, resistance, inductance, capacitance }) => {
      const L = inductance / 1000;
      const C = capacitance / 1e6;
      const resonance = 1 / (2 * Math.PI * Math.sqrt(L * C));
      const bandwidth = resistance / (2 * Math.PI * L);
      const peak = voltage / resistance;
      const halfSpan = Math.min(0.8 * resonance, 4 * bandwidth);
      return {
        summary: { resonance, peak, bandwidth },
        series: samples(resonance - halfSpan, resonance + halfSpan, (x) => {
          const omega = 2 * Math.PI * x;
          return {
            y: voltage / Math.hypot(resistance, omega * L - 1 / (omega * C)),
            reference: peak / Math.SQRT2,
          };
        }),
      };
    },
  ),
  lowpass: experiment(
    'lowpass',
    {
      title: 'RC Low-Pass Filter',
      discipline: 'electronics',
      lab: '16',
      description: 'Compare attenuation and phase lag above and below an RC filter’s cutoff.',
      predict: 'If you double the capacitance, what happens to the cutoff frequency?',
      prediction: [
        ['It doubles', 'It halves', 'It stays fixed'],
        1,
        'Cutoff is inversely proportional to capacitance for fixed resistance.',
      ],
      example:
        'At 1 kΩ and 100 nF, cutoff is about 1.59 kHz. At cutoff the gain is about 0.707 and the output lags by 45°.',
      equation: 'fc = 1/(2πRC). For r = f/fc, |H| = 1/√(1 + r²), and phase = −arctan(r).',
      limits:
        'Output is measured across the capacitor with no load. The model assumes ideal parts and steady-state sine waves. The plot uses frequency normalized by cutoff.',
      inputs: {
        resistance: parameter('Series resistance', 'kΩ', 0.01, 1000, 1),
        capacitance: parameter('Capacitance', 'nF', 0.1, 100000, 100),
        frequency: parameter('Probe frequency', 'Hz', 0, 1000000, 1591.55),
      },
      metrics: {
        cutoff: 'Cutoff frequency',
        gain: 'Gain at probe frequency',
        phase: 'Phase at probe frequency',
      },
      plot: {
        title: 'Low-pass magnitude response',
        x: 'Normalized frequency f/fc',
        y: 'Gain',
        traces: { y: 'Voltage gain', reference: '−3 dB level', sample: 'Probe' },
      },
      outputs: {
        summary: { cutoff: 'Hz', gain: 'V/V', phase: '°' },
        series: { x: '', y: 'V/V', reference: 'V/V', sample: 'V/V' },
      },
    },
    ({ resistance, capacitance, frequency }) => {
      const cutoff = 1e6 / (2 * Math.PI * resistance * capacitance);
      const gain = (ratio) => 1 / Math.hypot(1, ratio);
      const probe = frequency / cutoff;
      const evaluate = (x) => ({ y: gain(x), reference: 1 / Math.SQRT2 });
      const series = samples(0, 5, evaluate);
      if (probe <= 5) {
        series.push({ x: probe, ...evaluate(probe), sample: gain(probe) });
        series.sort((a, b) => a.x - b.x);
      }
      return {
        summary: { cutoff, gain: gain(probe), phase: (-Math.atan(probe) * 180) / Math.PI },
        series,
      };
    },
  ),
  bridge: experiment(
    'bridge',
    {
      title: 'Full-Wave Bridge Rectifier',
      discipline: 'electronics',
      lab: '17',
      description: 'Compare the input sine with the output of a four-diode bridge.',
      predict: 'How often does an ideal bridge produce a pulse compared with the input sine?',
      prediction: [
        ['Once per input cycle', 'Twice per input cycle', 'Once every two input cycles'],
        1,
        'The bridge redirects both half-cycles through the load in the same direction.',
      ],
      example:
        'A 5 V, 50 Hz sine with two 0.7 V conducting diode drops gives a 3.6 V output peak and 100 Hz ripple.',
      equation:
        'vₒ(t) = max(0, |A sin(2πft)| − 2Vf). When conducting, the output repeats every half input cycle.',
      limits:
        'This constant-drop bridge drives a resistive load. The model excludes source resistance, a filter capacitor, and diode recovery.',
      inputs: {
        amplitude: parameter('Input peak', 'V', 0, 48, 5),
        frequency: parameter('Input frequency', 'Hz', 1, 1000, 50),
        drop: parameter('Drop per diode', 'V', 0, 5, 0.7),
      },
      metrics: { peak: 'Output peak', ripple: 'Ripple frequency', average: 'Average output' },
      plot: {
        title: 'Bridge output waveform',
        x: 'Time',
        y: 'Voltage',
        traces: { y: 'Rectified output', reference: 'Input sine' },
      },
      outputs: {
        summary: { peak: 'V', ripple: 'Hz', average: 'V' },
        series: { x: 'ms', y: 'V', reference: 'V' },
      },
    },
    ({ amplitude, frequency, drop }) => {
      const loss = 2 * drop;
      const peak = Math.max(0, amplitude - loss);
      const angle = peak ? Math.acos(loss / amplitude) : 0;
      const average = (2 * (amplitude * Math.sin(angle) - loss * angle)) / Math.PI;
      const period = 1000 / frequency;
      return {
        summary: { peak, ripple: peak ? 2 * frequency : null, average },
        series: samples(0, 2 * period, (x) => {
          const reference = amplitude * Math.sin((2 * Math.PI * x) / period);
          return { reference, y: Math.max(0, Math.abs(reference) - loss) };
        }),
      };
    },
  ),
  convolution: experiment(
    'convolution',
    {
      title: 'Rectangular Pulse Convolution',
      discipline: 'signals',
      lab: '18',
      description: 'Watch two pulse widths shape a triangle or trapezoid through convolution.',
      predict: 'What shape do two equal-width unit-height pulses produce?',
      prediction: [
        ['A triangle', 'A rectangle', 'A trapezoid with a flat top'],
        0,
        'The overlap grows until both pulses line up, then shrinks. Equal widths leave no interval with constant full overlap.',
      ],
      example:
        'Two unit-height pulses, each 2 s wide, produce a triangular output from 0 to 4 s with a peak of 2 at t = 2 s.',
      equation:
        'For pulses on [0, a] and [0, b], the convolution is A·B times the length of [0, a] ∩ [t − b, t].',
      limits:
        'Both pulses begin at t = 0, have constant nonnegative heights, and vanish outside their support. Pulse amplitudes are normalized.',
      inputs: {
        widthA: parameter('First pulse width', 's', 0.05, 10, 2),
        widthB: parameter('Second pulse width', 's', 0.05, 10, 2),
        heightA: parameter('First pulse height', '', 0, 10, 1),
        heightB: parameter('Second pulse height', '', 0, 10, 1),
      },
      metrics: {
        peak: 'Peak overlap integral',
        duration: 'Support width',
        area: 'Output integral',
      },
      plot: {
        title: 'Pulse convolution output',
        x: 'Time',
        y: 'Overlap integral',
        traces: { y: 'Convolution' },
      },
      outputs: { summary: { peak: 's', duration: 's', area: 's²' }, series: { x: 's', y: 's' } },
    },
    ({ widthA, widthB, heightA, heightB }) => {
      const short = Math.min(widthA, widthB);
      const long = Math.max(widthA, widthB);
      const duration = short + long;
      const peak = short * heightA * heightB;
      const margin = duration / 8;
      return {
        summary: { peak, duration, area: widthA * widthB * heightA * heightB },
        series: [
          { x: -margin, y: 0 },
          { x: 0, y: 0 },
          { x: short, y: peak },
          { x: long, y: peak },
          { x: duration, y: 0 },
          { x: duration + margin, y: 0 },
        ],
      };
    },
  ),
  beats: experiment(
    'beats',
    {
      title: 'Signal Superposition & Beats',
      discipline: 'signals',
      lab: '19',
      description: 'Add two tones and see how their frequency difference sets the beat rate.',
      predict: 'What happens to the beats if the two frequencies become equal?',
      prediction: [
        ['They get faster', 'They disappear', 'They stay the same'],
        1,
        'Equal-frequency, in-phase tones sum to one tone with constant amplitude.',
      ],
      example:
        'An 8 Hz and a 10 Hz tone of equal amplitude produce 2 beats per second, with a carrier frequency of 9 Hz.',
      equation:
        'cos(2πf₁t) + cos(2πf₂t) = 2 cos[π(f₁ − f₂)t] cos[π(f₁ + f₂)t]. The beat frequency is |f₁ − f₂|.',
      limits:
        'The tones have the same amplitude and zero initial phase. The reference trace shows the upper amplitude envelope. Widely separated tones still sum correctly but may not sound like a slow beat.',
      inputs: {
        first: parameter('First tone', 'Hz', 0.1, 20, 8),
        second: parameter('Second tone', 'Hz', 0.1, 20, 10),
        amplitude: parameter('Amplitude per tone', '', 0.1, 10, 1),
        duration: parameter('Time window', 's', 0.25, 3, 1),
      },
      metrics: { beat: 'Beat frequency', carrier: 'Carrier frequency', peak: 'Maximum amplitude' },
      plot: {
        title: 'Summed waveform and envelope',
        x: 'Time',
        y: 'Amplitude',
        traces: { y: 'Sum of tones', reference: 'Upper envelope' },
      },
      outputs: {
        summary: { beat: 'Hz', carrier: 'Hz', peak: '' },
        series: { x: 's', y: '', reference: '' },
      },
    },
    ({ first, second, amplitude, duration }) => {
      const beat = Math.abs(first - second);
      const count = Math.max(240, Math.ceil(Math.max(first, second) * duration * 24));
      return {
        summary: { beat, carrier: (first + second) / 2, peak: 2 * amplitude },
        series: samples(
          0,
          duration,
          (x) => ({
            y: amplitude * (cosine(first, x) + cosine(second, x)),
            reference: 2 * amplitude * Math.abs(cosine(beat / 2, x)),
          }),
          count,
        ),
      };
    },
  ),
};

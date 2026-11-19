import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  teaching,
  output,
  sinc,
  fft,
  random,
  C,
  add,
  mul,
  div,
  abs,
  polar,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'communications', topic: 'Digital links & antennas', ...config }, solve);
export function raisedCosine(t, alpha) {
  if (Math.abs(t) < 1e-12) return 1;
  if (alpha > 0 && Math.abs(Math.abs(2 * alpha * t) - 1) < 1e-7)
    return (Math.PI / 4) * sinc(1 / (2 * alpha));
  return (sinc(t) * Math.cos(Math.PI * alpha * t)) / (1 - (2 * alpha * t) ** 2);
}
export function ofdmBlock(seed, prefix, delay, echo) {
  const rng = random(seed),
    N = 64,
    symbol = () => C((rng() < 0.5 ? -1 : 1) / Math.SQRT2, (rng() < 0.5 ? -1 : 1) / Math.SQRT2),
    previous = Array.from({ length: N }, symbol),
    current = Array.from({ length: N }, symbol),
    prevTime = fft(
      previous.map((v) => v.re),
      previous.map((v) => v.im),
      true,
    ),
    time = fft(
      current.map((v) => v.re),
      current.map((v) => v.im),
      true,
    ),
    block = (t) => [...t.slice(N - prefix), ...t],
    stream = [...block(prevTime), ...block(time)],
    start = N + prefix + prefix,
    received = Array.from({ length: N }, (_, n) =>
      add(stream[start + n], mul(C(echo), stream[start + n - delay] ?? C())),
    ),
    Y = fft(
      received.map((v) => v.re),
      received.map((v) => v.im),
    ),
    equalized = Y.map((v, k) => div(v, add(C(1), polar(echo, (-2 * Math.PI * k * delay) / N)))),
    error = Math.sqrt(
      equalized.reduce(
        (s, v, k) => s + (v.re - current[k].re) ** 2 + (v.im - current[k].im) ** 2,
        0,
      ) / N,
    ),
    power = time.map((v) => abs(v) ** 2);
  return {
    current,
    time,
    received,
    equalized,
    error,
    papr: 10 * Math.log10(Math.max(...power) / (power.reduce((s, v) => s + v, 0) / N)),
  };
}
export const communicationStudyModels = {
  eyediagram: make(
    {
      id: 'eyediagram',
      title: 'Eye Diagram and Inter-Symbol Interference',
      inputs: {
        rolloff: p('Raised-cosine roll-off', '1', 0, 1, 0.35),
        echo: p('One-symbol delayed echo coefficient', '1', -0.7, 0.7, 0.3),
        seed: integer('Symbol seed', 1, 9999, 42),
      },
      metrics: {
        opening: ['Sampled vertical eye opening', '1'],
        error: ['Symbol-center RMS error', '1'],
        symbols: ['Analyzed interior symbols', '1'],
      },
      plot: { x: 'Symbol time', xUnit: 'symbols', y: 'Received amplitude', yUnit: '1' },
      text: teaching(
        'Overlay actual two-symbol segments of a raised-cosine-shaped binary stream after a delayed-echo channel.',
        'Can a delayed channel echo close an otherwise Nyquist eye?',
        ['Yes', 'No', 'Only if the signal is complex'],
        'The delayed symbol contributes to the current decision sample and creates deterministic inter-symbol interference.',
        'With zero echo, raised-cosine samples at integer symbol times recover ±1 to numerical precision.',
        'x(t)=Σak hRC(t−k); y(t)=x(t)+c x(t−T); eye opening=min(y|a=+1)−max(y|a=−1).',
        'Seeded equiprobable BPSK symbols, 16 samples/symbol, pulse support ±6 symbols and no noise/jitter. Eye opening is measured at ideal symbol-center timing, not an optimized receiver decision instant.',
      ),
    },
    (a) => {
      const rng = random(a.seed),
        symbols = Array.from({ length: 80 }, () => (rng() < 0.5 ? -1 : 1)),
        f = (t) =>
          symbols.reduce(
            (s, v, k) => (Math.abs(t - k) <= 6 ? s + v * raisedCosine(t - k, a.rolloff) : s),
            0,
          ),
        y = (t) => f(t) + a.echo * f(t - 1),
        centers = Array.from({ length: 64 }, (_, i) => ({ i: i + 8, y: y(i + 8) })),
        positive = centers.filter((v) => symbols[v.i] > 0).map((v) => v.y),
        negative = centers.filter((v) => symbols[v.i] < 0).map((v) => v.y),
        eyes = centers.slice(0, 48).map((v) => seq(-1, 1, 64).map((t) => [t, y(v.i + t)]));
      return output(
        {
          opening: Math.min(...positive) - Math.max(...negative),
          error: Math.sqrt(
            centers.reduce((s, v) => s + (v.y - symbols[v.i]) ** 2, 0) / centers.length,
          ),
          symbols: centers.length,
        },
        seq(8, 20, 384).map((x) => ({ x, y: y(x) })),
        'eye',
        { eyes },
      );
    },
  ),
  raisedcosine: make(
    {
      id: 'raisedcosine',
      title: 'Raised-Cosine Pulse Shaping',
      inputs: {
        rolloff: p('Roll-off factor α', '1', 0, 1, 0.35),
        rate: p('Symbol rate', 'ksymbol/s', 1, 1000, 100),
      },
      metrics: {
        bandwidth: ['One-sided baseband bandwidth', 'kHz'],
        nyquist: ['Pulse at one symbol offset', '1'],
        center: ['Pulse at zero', '1'],
      },
      plot: { x: 'Normalized symbol time t/T', xUnit: '1', y: 'Raised-cosine pulse', yUnit: '1' },
      text: teaching(
        'Explore a Nyquist pulse in time and frequency, handling the removable singularities at t=±T/(2α).',
        'Does a larger roll-off require more bandwidth?',
        ['Yes', 'No', 'Only at α=0'],
        'Excess bandwidth trades spectral compactness for a faster-decaying time-domain pulse.',
        'α=.35 at Rs=100 ksymbol/s has one-sided bandwidth (1+.35)Rs/2=67.5 kHz.',
        'h(t)=sinc(t/T)cos(παt/T)/[1−(2αt/T)²]; B=(1+α)Rs/2.',
        'Ideal full raised-cosine pulse, not root-raised-cosine TX/RX splitting. Pulse is dimensionless and unit-amplitude at zero; spectral diagram is the analytic raised-cosine shape.',
      ),
    },
    (a) => {
      const spectrum = seq(0, (1 + a.rolloff) / 2 + 0.1, 200).map((x) => ({
        x,
        y:
          x <= (1 - a.rolloff) / 2
            ? 1
            : a.rolloff === 0 || x >= (1 + a.rolloff) / 2
              ? 0
              : 0.5 * (1 + Math.cos((Math.PI / a.rolloff) * (x - (1 - a.rolloff) / 2))),
      }));
      return output(
        {
          bandwidth: ((1 + a.rolloff) * a.rate) / 2,
          nyquist: raisedCosine(1, a.rolloff),
          center: raisedCosine(0, a.rolloff),
        },
        seq(-6, 6, 1200).map((x) => ({ x, y: raisedCosine(x, a.rolloff) })),
        'pulse-spectrum',
        { spectrum },
      );
    },
  ),
  biterror: make(
    {
      id: 'biterror',
      title: 'BER versus Eb/N₀: BPSK, QPSK and 16-QAM',
      inputs: {
        ebno: p('Bit-energy / noise-density ratio', 'dB', 0, 18, 8),
        scheme: choice('Gray coherent modulation', ['BPSK', 'QPSK', '16-QAM'], 'BPSK'),
      },
      metrics: {
        ber: ['Theoretical / approximate bit error probability', '1'],
        bits: ['Bits per symbol', '1'],
        esno: ['Symbol-energy / noise-density ratio', 'dB'],
      },
      plot: {
        yScale: 'log',
        x: 'Eb/N₀',
        xUnit: 'dB',
        y: 'Bit-error probability',
        yUnit: '1',
        traces: { y: 'BPSK / Gray QPSK', reference: 'Gray 16-QAM approximation' },
      },
      text: teaching(
        'Compare coherent AWGN bit-error curves with equal energy per information bit and distinguish Eb/N₀ from Es/N₀.',
        'Do ideal Gray QPSK and BPSK have the same BER versus Eb/N₀?',
        ['Yes', 'No', 'Only at zero noise'],
        'QPSK consists of two independent orthogonal BPSK bit channels.',
        'At 0 dB, coherent BPSK BER is Q(√2)≈0.0786496.',
        'Pb,BPSK=Pb,QPSK=Q(√(2γb)); Pb,16QAM≈.75Q(√(.8γb)); Es/N₀=k Eb/N₀.',
        'Uncoded equiprobable Gray mapping, coherent perfect synchronization and AWGN. 16-QAM uses a nearest-neighbor approximation, less accurate at low SNR. No fading, coding or Monte Carlo error bars. Tail probabilities use a direct erfc approximation.',
      ),
    },
    (a) => {
      const Q = (x) => {
          const z = x / Math.SQRT2,
            t = 1 / (1 + 0.3275911 * z);
          return (
            0.5 *
            Math.exp(-z * z) *
            (0.254829592 * t -
              0.284496736 * t ** 2 +
              1.421413741 * t ** 3 -
              1.453152027 * t ** 4 +
              1.061405429 * t ** 5)
          );
        },
        f = (dB, qam) => {
          const g = 10 ** (dB / 10);
          return qam ? 0.75 * Q(Math.sqrt(0.8 * g)) : Q(Math.sqrt(2 * g));
        },
        bits = a.scheme === '16-QAM' ? 4 : a.scheme === 'QPSK' ? 2 : 1;
      return output(
        { ber: f(a.ebno, bits === 4), bits, esno: a.ebno + 10 * Math.log10(bits) },
        seq(0, 18, 180).map((x) => ({ x, y: f(x, false), reference: f(x, true) })),
        'ber',
        { scheme: a.scheme },
      );
    },
  ),
  ofdm: make(
    {
      id: 'ofdm',
      title: 'OFDM Subcarriers and Cyclic Prefix',
      inputs: {
        prefix: integer('Cyclic-prefix samples', 0, 24, 8),
        delay: integer('Echo delay', 1, 20, 6),
        echo: p('Delayed path amplitude', '1', 0, 0.8, 0.5),
        seed: integer('QPSK symbol seed', 1, 9999, 42),
      },
      metrics: {
        evm: ['One-tap-equalized RMS EVM', '%'],
        efficiency: ['Useful-sample efficiency', '%'],
        papr: ['Sampled waveform PAPR', 'dB'],
        protected: ['Prefix covers channel memory', 'boolean'],
      },
      plot: {
        x: 'Sample index',
        xUnit: '1',
        y: 'Current useful OFDM waveform',
        yUnit: '1',
        traces: { y: 'Real part', reference: 'Imaginary part' },
      },
      text: teaching(
        'Generate two actual 64-carrier QPSK blocks with IFFT, pass them through a two-tap channel and FFT/equalize the current block.',
        'Does a prefix shorter than channel memory guarantee circular convolution?',
        ['No', 'Yes', 'Only with QPSK'],
        'The previous block then contaminates the current FFT window and diagonal one-tap equalization is insufficient.',
        'A CP of eight samples covers an echo delayed by six; without noise the equalized EVM is near machine precision.',
        'x=IFFT(X); y[n]=x[n]+a x[n−d]; Yk=HkXk only when Ncp≥d; Hk=1+a e⁻ʲ²πᵏᵈ/ᴺ.',
        '64 active QPSK carriers, two consecutive seeded blocks, noiseless two-tap static channel and known exact channel equalizer. PAPR is measured at native sample rate, without oversampling; no synchronization or coding.',
      ),
    },
    (a) => {
      const r = ofdmBlock(a.seed, a.prefix, a.delay, a.echo);
      return output(
        {
          evm: r.error * 100,
          efficiency: 6400 / (64 + a.prefix),
          papr: r.papr,
          protected: +(a.prefix >= a.delay || a.echo === 0),
        },
        r.time.map((v, x) => ({ x, y: v.re, reference: v.im })),
        'constellation',
        { points: r.equalized.map((v) => [v.re, v.im]), ideal: r.current.map((v) => [v.re, v.im]) },
      );
    },
  ),
  antennapattern: make(
    {
      id: 'antennapattern',
      title: 'Dipole and Linear-Array Radiation Patterns',
      inputs: {
        kind: choice('Radiator', ['short-dipole', 'half-wave', 'array'], 'array'),
        elements: integer('Array elements', 2, 16, 6),
        spacing: p('Element separation', 'λ', 0.1, 1.5, 0.5),
        steer: p('Array steering from broadside', '°', -60, 60, 0),
      },
      metrics: {
        peak: ['Peak sampled direction from array axis', '°'],
        front: ['Normalized broadside power', '1'],
        lobes: ['Local power maxima on 0…180°', '1'],
      },
      plot: {
        x: 'Polar angle from radiator / array axis',
        xUnit: '°',
        y: 'Normalized power',
        yUnit: '1',
      },
      text: teaching(
        'Compare short-dipole and half-wave element patterns with a uniformly excited steered isotropic linear array.',
        'Can spacing larger than half a wavelength introduce grating lobes?',
        ['Yes', 'No', 'Only with one element'],
        'Multiple directions can then satisfy the same interelement phase condition.',
        'A two-element broadside array at d=.5λ has its maximum at θ=90° and a null along its axis.',
        'Pshort∝sin²θ; Ehalf∝cos[(π/2)cosθ]/sinθ; AF=Σexp[jn2πd(cosθ−cosθ₀)].',
        'Normalized far-field power, ideal thin dipoles or an isotropic-element uniform linear array. Array steering input is measured from broadside, θ₀=90°−steer. No mutual coupling, feed impedance, absolute gain or ground plane.',
      ),
    },
    (a) => {
      const raw = (theta) => {
          const t = (theta * Math.PI) / 180;
          if (a.kind === 'short-dipole') return Math.sin(t) ** 2;
          if (a.kind === 'half-wave')
            return Math.abs(Math.sin(t)) < 1e-10
              ? 0
              : (Math.cos((Math.PI / 2) * Math.cos(t)) / Math.sin(t)) ** 2;
          let sum = C();
          for (let n = 0; n < a.elements; n++)
            sum = add(
              sum,
              polar(
                1,
                n *
                  2 *
                  Math.PI *
                  a.spacing *
                  (Math.cos(t) - Math.cos(((90 - a.steer) * Math.PI) / 180)),
              ),
            );
          return abs(sum) ** 2 / a.elements ** 2;
        },
        s = seq(0, 180, 720).map((x) => ({ x, y: raw(x) })),
        max = Math.max(...s.map((v) => v.y));
      s.forEach((v) => (v.y /= max));
      let lobes = 0;
      for (let i = 1; i < s.length - 1; i++)
        if (s[i].y > s[i - 1].y && s[i].y >= s[i + 1].y && s[i].y > 0.001) lobes++;
      return output(
        { peak: s.reduce((x, y) => (x.y > y.y ? x : y)).x, front: raw(90) / max, lobes },
        s,
        'polar-pattern',
        { points: s },
      );
    },
  ),
};

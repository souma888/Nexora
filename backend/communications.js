import { lab, p, integer, list, parseList, samples, table } from './lab-kit.js';
const tau = 2 * Math.PI;
const wave = (duration, maxFrequency, fn) =>
  samples(0, duration, fn, Math.max(600, Math.ceil(24 * duration * maxFrequency)));
export const communicationModels = {
  amradio: lab(
    {
      id: 'amradio',
      title: 'Amplitude Modulation & Envelope',
      discipline: 'communications',
      lab: 'RF01',
      topic: 'Analog modulation',
      inputs: {
        amplitude: p('Carrier peak', 'V', 0.1, 10, 2),
        carrier: p('Carrier frequency', 'Hz', 5, 40, 20),
        message: p('Message frequency', 'Hz', 1, 5, 2),
        index: p('Modulation index', '', 0, 1.5, 0.5),
        resistance: p('Load resistance', 'Ω', 1, 1000, 50),
      },
      rules: [
        {
          type: 'less',
          left: 'message',
          right: 'carrier',
          field: 'message',
          message: 'The message frequency must be below the carrier frequency.',
        },
      ],
      metrics: {
        minimum: ['Minimum signed envelope', 'V'],
        power: ['Average signal power', 'W'],
        efficiency: ['Sideband power fraction', '%'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Voltage',
        yUnit: 'V',
        traces: {
          y: 'AM signal',
          reference: 'Positive signed envelope',
          other: 'Negative signed envelope',
        },
      },
      text: [
        'Follow a carrier as its envelope follows a sinusoidal message, including overmodulation.',
        'What happens above modulation index one?',
        ['The envelope crosses zero', 'Carrier frequency doubles', 'All sidebands disappear'],
        'A negative signed envelope causes carrier phase reversals, so a simple envelope detector distorts the message.',
        'With carrier peak 2 V, m=0.5 and R=50 Ω, the envelope ranges 1–3 V and average signal power is 0.045 W.',
        's(t)=Ac[1+m cos(2πfmt)]cos(2πfct). P=Ac²(1+m²/2)/(2R); sideband fraction=(m²/2)/(1+m²/2).',
        'Single-tone conventional AM, ideal resistive load, no noise, amplifier limits or detector dynamics. Low display frequencies keep individual carrier cycles visible; RF scaling preserves the normalized relationships.',
      ],
    },
    ({ amplitude: a, carrier: fc, message: fm, index: m, resistance: r }) => ({
      summary: {
        minimum: a * (1 - m),
        power: (a * a * (1 + (m * m) / 2)) / (2 * r),
        efficiency: (100 * m * m) / (2 + m * m),
      },
      series: wave(3 / fm, fc, (t) => {
        const e = a * (1 + m * Math.cos(tau * fm * t));
        return { y: e * Math.cos(tau * fc * t), reference: e, other: -e };
      }),
      visualization: {
        type: 'engineering-extension',
        kind: 'modulator',
        mode: 'AM',
        carrier: fc,
        message: fm,
        index: m,
      },
      warnings:
        m > 1
          ? [
              'Overmodulated: the signed envelope crosses zero. Ideal envelope detection no longer recovers the original message.',
            ]
          : [],
    }),
  ),
  fmradio: lab(
    {
      id: 'fmradio',
      title: 'Frequency Modulation & Deviation',
      discipline: 'communications',
      lab: 'RF02',
      topic: 'Analog modulation',
      inputs: {
        amplitude: p('Carrier peak', 'V', 0.1, 10, 2),
        carrier: p('Center frequency', 'Hz', 20, 60, 30),
        message: p('Message frequency', 'Hz', 1, 5, 2),
        deviation: p('Peak frequency deviation', 'Hz', 0, 15, 4),
      },
      metrics: {
        beta: ['FM modulation index', ''],
        bandwidth: ['Carson bandwidth estimate', 'Hz'],
        minimum: ['Minimum instantaneous frequency', 'Hz'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'FM signal', reference: 'Unmodulated carrier' },
      },
      text: [
        'Compare phase accumulation, frequency deviation and occupied-bandwidth estimation.',
        'Does ideal FM change the carrier amplitude?',
        ['No', 'Yes, proportionally to deviation', 'Only when the message is slow'],
        'Ideal FM changes phase rate while keeping the carrier envelope constant.',
        'At fm=2 Hz and deviation 4 Hz, β=2 and Carson’s rule estimates 12 Hz; a 30 Hz center varies from 26 to 34 Hz.',
        's(t)=Ac cos[2πfct+β sin(2πfmt)], β=Δf/fm. fi(t)=fc+Δf cos(2πfmt). Carson B≈2(Δf+fm).',
        'Sinusoidal ideal FM with constant amplitude and positive instantaneous frequency over the accepted domain. Carson’s rule is an approximate bandwidth estimate, not a hard spectral cutoff. No demodulator or channel noise.',
      ],
    },
    ({ amplitude: a, carrier: fc, message: fm, deviation: df }) => ({
      summary: { beta: df / fm, bandwidth: 2 * (df + fm), minimum: fc - df },
      series: wave(3 / fm, fc + df, (t) => ({
        y: a * Math.cos(tau * fc * t + (df / fm) * Math.sin(tau * fm * t)),
        reference: a * Math.cos(tau * fc * t),
      })),
      visualization: {
        type: 'engineering-extension',
        kind: 'modulator',
        mode: 'FM',
        carrier: fc,
        message: fm,
        index: df / fm,
      },
    }),
  ),
  bpsk: lab(
    {
      id: 'bpsk',
      title: 'BPSK Symbol & Carrier Trace',
      discipline: 'communications',
      lab: 'RF03',
      topic: 'Digital communication',
      inputs: {
        bits: list('Bit sequence', '0,1,1,0,1,0', 0, 1, 16),
        amplitude: p('Carrier peak', 'V', 0.1, 5, 1),
        rate: p('Bit rate', 'bit/s', 10, 100, 20),
        cycles: integer('Carrier cycles per bit', 2, 8, 3),
      },
      metrics: {
        carrier: ['Carrier frequency', 'Hz'],
        energy: ['Energy per bit (1 Ω)', 'mJ'],
        ones: ['One bits in sequence', ''],
      },
      plot: {
        x: 'Time',
        xUnit: 'ms',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'BPSK carrier', reference: 'Bipolar symbol', other: 'Reference carrier' },
      },
      text: [
        'Map bits to opposite carrier phases and inspect transitions at symbol boundaries.',
        'What phase change separates the two BPSK symbols?',
        ['180°', '90°', '360°'],
        'Multiplying the carrier by −1 shifts its phase by π radians.',
        'At 1 V peak and 20 bit/s into 1 Ω, Eb=25 mJ. Three carrier cycles per bit give fc=60 Hz.',
        'Bit 0 maps to +Ac and bit 1 to −Ac. s(t)=a[k]cos(2πfct), fc=Ncycles Rb; Eb=Ac²/(2R Rb).',
        'Ideal rectangular symbols, coherent reference, R=1 Ω and an integer number of carrier cycles per bit. No pulse shaping, synchronization error, channel noise or BER prediction. The final endpoint retains the last bit.',
      ],
    },
    ({ bits, amplitude: a, rate, cycles }) => {
      const b = parseList(bits),
        duration = b.length / rate,
        fc = cycles * rate;
      return {
        summary: {
          carrier: fc,
          energy: (1000 * a * a) / (2 * rate),
          ones: b.filter(Boolean).length,
        },
        series: wave(duration, fc, (t) => {
          const k = Math.min(b.length - 1, Math.floor(t * rate)),
            symbol = b[k] ? -a : a;
          return {
            y: symbol * Math.cos(tau * fc * t),
            reference: symbol,
            other: a * Math.cos(tau * fc * t),
          };
        }).map((p) => ({ ...p, x: p.x * 1000 })),
        visualization: {
          type: 'engineering-extension',
          kind: 'symbols',
          bits: b,
          rate,
          mode: 'BPSK',
        },
        table: table(
          'Coherent BPSK mapping',
          ['Bit index', 'Bit', 'Phase (degrees)'],
          b.map((bit, i) => [i, bit, bit ? 180 : 0]),
        ),
      };
    },
  ),
  qpsk: lab(
    {
      id: 'qpsk',
      title: 'Gray QPSK Constellation & I/Q',
      discipline: 'communications',
      lab: 'RF04',
      topic: 'Digital communication',
      inputs: {
        symbols: list('Dibits as integers (0=00, 1=01, 2=10, 3=11)', '0,1,3,2,0,3', 0, 3, 16),
        amplitude: p('Complex symbol magnitude', 'V', 0.1, 5, 1),
        rate: p('Symbol rate', 'symbol/s', 10, 100, 20),
      },
      metrics: {
        bitrate: ['Bit rate', 'bit/s'],
        energy: ['Complex-envelope symbol energy (1 Ω)', 'mJ'],
        phase: ['Last symbol phase', '°'],
      },
      plot: {
        x: 'Symbol position',
        xUnit: '',
        y: 'Baseband component',
        yUnit: 'V',
        step: true,
        traces: { y: 'In-phase I', reference: 'Quadrature Q' },
      },
      text: [
        'Inspect a Gray-coded four-point constellation and its piecewise-constant I/Q components.',
        'How many bits does one QPSK symbol carry?',
        ['Two', 'One', 'Four'],
        'Four distinguishable states encode log₂4=2 bits per symbol.',
        'Magnitude 1 gives I,Q=±1/√2. Dibits 00,01,11,10 go around the circle at 45°,135°,225°,315°; 20 symbols/s carries 40 bit/s.',
        '00→(+,+), 01→(−,+), 11→(−,−), 10→(+,−). I²+Q²=A², Rb=2Rs, Es=A²/Rs for the stated 1 Ω complex-envelope convention.',
        'Normalized complex baseband only; no passband factor-of-two ambiguity is hidden in the energy convention. No pulse shaping or noise. Gray labels describe adjacent points, not ordinary binary angle order.',
      ],
    },
    ({ symbols, amplitude: a, rate }) => {
      const values = parseList(symbols),
        map = [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ],
        coords = values.map((v) => map[v].map((c) => (c * a) / Math.SQRT2));
      return {
        summary: {
          bitrate: 2 * rate,
          energy: (1000 * a * a) / rate,
          phase: [45, 135, 315, 225][values.at(-1)],
        },
        series: Array.from({ length: values.length + 1 }, (_, i) => ({
          x: i,
          y: coords[Math.min(i, values.length - 1)][0],
          reference: coords[Math.min(i, values.length - 1)][1],
        })),
        visualization: {
          type: 'engineering-extension',
          kind: 'constellation',
          values,
          coords,
          amplitude: a,
        },
        table: table(
          'Gray QPSK symbol coordinates',
          ['Index', 'Dibit', 'I (V)', 'Q (V)', 'Phase (degrees)'],
          values.map((v, i) => [
            i,
            v.toString(2).padStart(2, '0'),
            ...coords[i],
            [45, 135, 315, 225][v],
          ]),
        ),
      };
    },
  ),
  radiolink: lab(
    {
      id: 'radiolink',
      title: 'Free-Space RF Link Budget',
      discipline: 'communications',
      lab: 'RF05',
      topic: 'RF propagation',
      inputs: {
        power: p('Transmitter power', 'dBm', -30, 40, 20),
        frequency: p('RF frequency', 'MHz', 100, 6000, 2400),
        distance: p('Link distance', 'km', 0.01, 100, 1),
        gain: p('Gain of each antenna', 'dBi', 0, 30, 2),
        loss: p('Other system losses', 'dB', 0, 20, 2),
        sensitivity: p('Receiver sensitivity', 'dBm', -120, -30, -90),
      },
      metrics: {
        received: ['Received power', 'dBm'],
        pathloss: ['Free-space path loss', 'dB'],
        margin: ['Link margin', 'dB'],
      },
      plot: {
        x: 'Distance',
        xUnit: 'km',
        y: 'Received power',
        yUnit: 'dBm',
        traces: { y: 'Free-space received power', reference: 'Receiver sensitivity' },
      },
      text: [
        'Balance transmitted power, antenna gains, free-space spreading and a receiver threshold.',
        'What does doubling free-space distance do to received power?',
        ['Reduces it by about 6.02 dB', 'Reduces it by 3 dB', 'Leaves it unchanged'],
        'Power density spreads over area proportional to distance squared.',
        'At 2.4 GHz and 1 km, FSPL≈100.052 dB. With 20 dBm transmit, two 2 dBi antennas and 2 dB other loss, Pr≈−78.052 dBm; margin above −90 dBm is 11.948 dB.',
        'FSPL=20log₁₀(4πdf/c), c=299792458 m/s. Pr(dBm)=Pt+Gt+Gr−FSPL−L; margin=Pr−sensitivity.',
        'Ideal line-of-sight free space and far-field antennas with prescribed gains. No terrain, fading, obstruction, polarization mismatch, interference or regulatory analysis. Threshold margin alone does not predict reliability.',
      ],
    },
    ({ power, frequency, distance, gain, loss, sensitivity }) => {
      const fspl = (d) => 20 * Math.log10((4 * Math.PI * d * 1000 * frequency * 1e6) / 299792458),
        received = (d) => power + 2 * gain - loss - fspl(d);
      return {
        summary: {
          received: received(distance),
          pathloss: fspl(distance),
          margin: received(distance) - sensitivity,
        },
        series: samples(0.01, Math.max(0.02, 2 * distance), (x) => ({
          y: received(x),
          reference: sensitivity,
        })),
        visualization: {
          type: 'engineering-extension',
          kind: 'radiolink',
          distance,
          frequency,
          power,
          received: received(distance),
        },
        warnings:
          received(distance) < sensitivity
            ? ['The ideal received power is below the selected sensitivity threshold.']
            : [],
      };
    },
  ),
  shannon: lab(
    {
      id: 'shannon',
      title: 'AWGN Channel Capacity',
      discipline: 'communications',
      lab: 'RF06',
      topic: 'Information theory',
      inputs: {
        bandwidth: p('Channel bandwidth', 'kHz', 1, 10000, 100),
        snr: p('Signal-to-noise ratio', 'dB', -20, 40, 10),
      },
      metrics: {
        capacity: ['Shannon capacity', 'Mbit/s'],
        efficiency: ['Spectral efficiency', 'bit/s/Hz'],
        linear: ['Linear SNR', ''],
      },
      plot: { x: 'Signal-to-noise ratio', xUnit: 'dB', y: 'Channel capacity', yUnit: 'Mbit/s' },
      text: [
        'Explore the bandwidth and signal-to-noise limit of an ideal band-limited Gaussian channel.',
        'At fixed SNR, what does doubling bandwidth do to capacity?',
        ['Doubles it', 'Squares it', 'Leaves it fixed'],
        'C=B log₂(1+S/N) is linear in B when the total SNR is held constant.',
        'At B=100 kHz and SNR=10 dB (=10 linear), C=100000 log₂11≈0.345943 Mbit/s.',
        'C=B log₂(1+10^(SNRdB/10)). Spectral efficiency C/B=log₂(1+S/N).',
        'An information-theoretic upper bound for an AWGN channel, not an achievable rate for a chosen modem or finite code. Bandwidth sweeps assume SNR is separately held fixed, rather than fixing transmitter power and noise density.',
      ],
    },
    ({ bandwidth: b, snr }) => {
      const efficiency = Math.log2(1 + 10 ** (snr / 10));
      return {
        summary: { capacity: (b * efficiency) / 1000, efficiency, linear: 10 ** (snr / 10) },
        series: samples(-20, 40, (x) => ({ y: (b * Math.log2(1 + 10 ** (x / 10))) / 1000 })),
        visualization: {
          type: 'engineering-extension',
          kind: 'channel',
          bandwidth: b,
          snr,
          capacity: (b * efficiency) / 1000,
        },
      };
    },
  ),
};
communicationModels.amradio.definition.presets = {
  'Unmodulated carrier': { index: 0 },
  'Overmodulated envelope': { index: 1.25 },
};
communicationModels.fmradio.definition.presets = { 'No frequency deviation': { deviation: 0 } };
communicationModels.bpsk.definition.presets = {
  'Alternating bits': { bits: '0,1,0,1,0,1' },
  'Constant phase': { bits: '0,0,0,0' },
};
communicationModels.qpsk.definition.presets = {
  'All constellation points': { symbols: '0,1,3,2' },
};
communicationModels.radiolink.definition.presets = { 'Below sensitivity': { distance: 20 } };
communicationModels.shannon.definition.presets = { '0 dB reference': { snr: 0 } };

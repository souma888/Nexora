import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  teaching,
  output,
  random,
  normal,
  mean,
  rms,
  bisect,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'embedded', topic: 'Embedded timing & measurement', ...config }, solve);
export const pt100 = (T) => 100 * (1 + 3.9083e-3 * T - 5.775e-7 * T * T);
export function typeT(T) {
  const c = [
    0, 0.038748106364, 3.329222788e-5, 2.0618243404e-7, -2.1882256846e-9, 1.0996880928e-11,
    -3.0815758772e-14, 4.547913529e-17, -2.7512901673e-20,
  ];
  return c.reduceRight((s, v) => s * T + v, 0);
}
export function allanDeviation(samples, m) {
  let sum = 0,
    count = 0;
  const prefix = [0];
  samples.forEach((v) => prefix.push(prefix.at(-1) + v));
  for (let i = 0; i + 2 * m <= samples.length; i++) {
    const d = (prefix[i + 2 * m] - 2 * prefix[i + m] + prefix[i]) / m;
    sum += d * d;
    count++;
  }
  return Math.sqrt(sum / (2 * count));
}
export const instrumentationModels = {
  pwmfilter: make(
    {
      id: 'pwmfilter',
      title: 'PWM Duty, Resolution and Filtering',
      inputs: {
        duty: p('Duty cycle', '%', 0, 100, 40),
        bits: integer('Timer resolution', 2, 12, 8),
        frequency: p('PWM frequency', 'Hz', 100, 10000, 1000),
        cutoff: p('RC cutoff', 'Hz', 5, 500, 50),
        supply: p('Logic supply', 'V', 1.8, 12, 3.3),
      },
      metrics: {
        duty: ['Quantized duty', '%'],
        mean: ['Steady mean output', 'V'],
        ripple: ['Steady-state peak-to-peak ripple', 'V'],
      },
      plot: {
        x: 'Time',
        xUnit: 'ms',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'RC output', reference: 'PWM source' },
      },
      text: teaching(
        'Quantize a PWM duty command and solve the RC filter exactly over high and low intervals.',
        'Does more timer resolution necessarily increase PWM frequency?',
        ['No, at fixed clock it usually reduces it', 'Yes', 'It removes output ripple'],
        'A longer count period trades carrier frequency for duty resolution.',
        'At 3.3 V and 50% duty, a unity-DC-gain RC filter averages 1.65 V.',
        'Dq=round(D·2ᵇ)/2ᵇ; τ=1/(2πfc); Vmax=V(1−e^(−DT/τ))/(1−e^(−T/τ)).',
        'Ideal switched voltage source and unloaded first-order RC at periodic steady state. The carrier frequency is independently prescribed, so clock budgeting is handled in the timer lab.',
      ),
    },
    (a) => {
      const d = Math.round((a.duty / 100) * 2 ** a.bits) / 2 ** a.bits,
        T = 1 / a.frequency,
        tau = 1 / (2 * Math.PI * a.cutoff),
        hi = d === 0 ? 0 : (a.supply * -Math.expm1((-d * T) / tau)) / -Math.expm1(-T / tau),
        lo = hi * Math.exp((-(1 - d) * T) / tau);
      return output(
        { duty: d * 100, mean: a.supply * d, ripple: hi - lo },
        seq(0, 5 * T, 600).map((t) => {
          const phase = t % T;
          return {
            x: t * 1000,
            y:
              phase < d * T
                ? a.supply + (lo - a.supply) * Math.exp(-phase / tau)
                : hi * Math.exp(-(phase - d * T) / tau),
            reference: phase < d * T ? a.supply : 0,
          };
        }),
        'pwm',
        { duty: d, high: hi, low: lo },
      );
    },
  ),
  adcquantization: make(
    {
      id: 'adcquantization',
      title: 'ADC Quantization and SQNR',
      inputs: {
        bits: integer('ADC bits', 2, 16, 8),
        amplitude: p('Sine amplitude / full-scale peak', '1', 0.01, 1.4, 0.9),
        offset: p('DC offset / full-scale peak', '1', -0.5, 0.5, 0),
        reference: p('Bipolar full-scale magnitude', 'V', 1, 5, 2.5),
      },
      metrics: {
        step: ['Quantization step', 'mV'],
        sqnr: ['Measured signal-to-error ratio', 'dB'],
        ideal: ['Full-scale sine ideal SQNR', 'dB'],
        clipped: ['Clipped samples', '%'],
      },
      plot: {
        x: 'Sample index',
        xUnit: '1',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'Quantized signal', reference: 'Input sine' },
      },
      text: teaching(
        'Quantize a coherent sampled sinusoid with a bipolar mid-rise ADC, including saturation and measured error.',
        'Does the 6.02b+1.76 dB rule still apply to clipped inputs?',
        ['No', 'Yes', 'Only at DC'],
        'The rule assumes an unclipped full-scale sinusoid and approximately uniform quantization error.',
        'An ideal 8-bit converter has a full-scale sine SQNR near 49.92 dB.',
        'Δ=2Vref/2ᵇ; code=clip(floor((x+Vref)/Δ)); xq=−Vref+(code+.5)Δ; SQNR=20log10(rms(signal)/rms(error)).',
        'Ideal bipolar uniform mid-rise quantizer, 512 samples and seven coherent sine cycles. Reported measured ratio includes clipping and DC-offset effects; no analog noise, aperture jitter or nonlinearity.',
      ),
    },
    (a) => {
      const levels = 2 ** a.bits,
        step = (2 * a.reference) / levels;
      let clipped = 0;
      const s = Array.from({ length: 512 }, (_, i) => {
        const signal = a.reference * a.amplitude * Math.sin((2 * Math.PI * 7 * i) / 512),
          x = signal + a.reference * a.offset;
        if (x >= a.reference || x < -a.reference) clipped++;
        const code = Math.max(0, Math.min(levels - 1, Math.floor((x + a.reference) / step)));
        return { x: i, y: -a.reference + (code + 0.5) * step, reference: x };
      });
      return output(
        {
          step: step * 1000,
          sqnr:
            20 *
            Math.log10(
              (a.reference * a.amplitude) / Math.SQRT2 / rms(s.map((v) => v.y - v.reference)),
            ),
          ideal: 6.020599913 * a.bits + 1.760912591,
          clipped: (100 * clipped) / s.length,
        },
        s,
        'quantizer',
        { bits: a.bits, step },
      );
    },
  ),
  strainbridge: make(
    {
      id: 'strainbridge',
      title: 'Strain-Gauge Wheatstone Bridge',
      inputs: {
        strain: p('Axial strain', 'µε', -3000, 3000, 1000),
        factor: p('Gauge factor', '1', 1, 4, 2),
        supply: p('Excitation voltage', 'V', 1, 12, 5),
        mode: choice('Active gauge arrangement', ['quarter', 'half', 'full'], 'quarter'),
        resistance: p('Unstrained gauge resistance', 'Ω', 120, 1000, 350),
      },
      metrics: {
        output: ['Differential bridge output', 'mV'],
        linear: ['Small-strain approximation', 'mV'],
        change: ['Active resistance change', 'Ω'],
      },
      plot: {
        x: 'Applied strain',
        xUnit: 'µε',
        y: 'Bridge output',
        yUnit: 'mV',
        traces: { y: 'Exact bridge', reference: 'Linear approximation' },
      },
      text: teaching(
        'Evaluate exact resistor-divider outputs for quarter, opposed half and full strain-gauge bridges.',
        'How does a full active bridge compare with a quarter bridge at small strain?',
        ['About four times the sensitivity', 'One quarter the sensitivity', 'The same sensitivity'],
        'Four suitably signed active arms contribute constructively to bridge imbalance.',
        'GF=2, ε=1000 µε and 5 V excitation give approximately 2.5 mV in a quarter bridge.',
        'Vo/Vs=R₂/(R₁+R₂)−R₄/(R₃+R₄); ΔR/R=GFε.',
        'Left lower arm is tensile. Half bridge also has an equal compressive left upper arm; full bridge uses the opposite signs in the right branch. No lead resistance, transverse strain, thermal compensation or amplifier model.',
      ),
    },
    (a) => {
      const mult = { quarter: 1, half: 2, full: 4 }[a.mode],
        calc = (e) => {
          const d = a.factor * e * 1e-6,
            R = a.resistance,
            r1 = a.mode === 'quarter' ? R : R * (1 - d),
            r2 = R * (1 + d),
            r3 = a.mode === 'full' ? R * (1 + d) : R,
            r4 = a.mode === 'full' ? R * (1 - d) : R;
          return 1000 * a.supply * (r2 / (r1 + r2) - r4 / (r3 + r4));
        };
      return output(
        {
          output: calc(a.strain),
          linear: ((a.supply * a.factor * a.strain * 1e-6 * mult) / 4) * 1000,
          change: a.resistance * a.factor * a.strain * 1e-6,
        },
        seq(-3000, 3000).map((x) => ({
          x,
          y: calc(x),
          reference: ((a.supply * a.factor * x * 1e-6 * mult) / 4) * 1000,
        })),
        'bridge',
        { ...a },
      );
    },
  ),
  temperaturelinearization: make(
    {
      id: 'temperaturelinearization',
      title: 'Thermocouple and RTD Linearization',
      inputs: {
        temperature: p('Hot junction / RTD temperature', '°C', 0, 400, 200),
        cold: p('Thermocouple cold junction', '°C', 0, 50, 25),
        sensor: choice('Sensor', ['type-t', 'pt100'], 'type-t'),
      },
      metrics: {
        signal: ['Measured signal (mV for T, Ω for Pt100)', 'sensor units'],
        naive: ['Linear calibration estimate', '°C'],
        corrected: ['Nonlinear compensated estimate', '°C'],
        error: ['Linear estimate error', '°C'],
      },
      plot: {
        x: 'Temperature',
        xUnit: '°C',
        y: 'Sensor output',
        yUnit: 'sensor units',
        traces: { y: 'Nonlinear response', reference: 'Linear calibration' },
      },
      text: teaching(
        'Compare polynomial thermocouple compensation and Callendar–Van Dusen RTD inversion against a linear calibration.',
        'Can a thermocouple report absolute hot temperature without knowing its cold junction?',
        ['No', 'Yes', 'Only for copper leads'],
        'The measured EMF is the difference E(Thot)−E(Tcold); cold-junction EMF must be added before inversion.',
        'A Pt100 at 100°C gives 138.5055 Ω using A=.0039083 and B=−5.775×10⁻⁷.',
        'Type-T: E=ΣcᵢTⁱ; Emeas=Ehot−Ecold. Pt100: R=100(1+AT+BT²).',
        'NIST ITS-90 Type-T polynomial for 0…400°C, EMF in mV; Pt100 CVD positive-temperature branch. Ideal sensors, no self-heating, contact error, lead resistance or measurement noise.',
      ),
    },
    (a) => {
      const thermo = a.sensor === 'type-t',
        f = thermo ? typeT : pt100,
        signal = thermo ? f(a.temperature) - f(a.cold) : f(a.temperature),
        naive = thermo ? signal / 0.038748106364 + a.cold : (signal / 100 - 1) / 0.0039083,
        corrected = bisect((T) => f(T) - (thermo ? signal + f(a.cold) : signal), 0, 400);
      return output(
        { signal, naive, corrected, error: naive - a.temperature },
        seq(0, 400).map((x) => ({
          x,
          y: thermo ? f(x) - f(a.cold) : f(x),
          reference: thermo ? 0.038748106364 * (x - a.cold) : 100 * (1 + 0.0039083 * x),
        })),
        'sensor',
        { ...a },
      );
    },
  ),
  debouncetimeline: make(
    {
      id: 'debouncetimeline',
      title: 'Switch Debounce and Interrupt Latency',
      inputs: {
        bounce: p('Bounce duration', 'ms', 0, 20, 6),
        debounce: p('Required stable time', 'ms', 0.5, 30, 8),
        latency: p('Interrupt service latency', 'ms', 0, 10, 1),
      },
      metrics: {
        accepted: ['Debounced edge time', 'ms'],
        service: ['ISR service time', 'ms'],
        edges: ['Raw rising edges', '1'],
      },
      plot: {
        x: 'Time after contact',
        xUnit: 'ms',
        y: 'Logic state',
        yUnit: '1',
        traces: { y: 'Raw switch', reference: 'Debounced state', third: 'ISR delivered' },
      },
      text: teaching(
        'Generate a bouncing contact and accept it only after an uninterrupted stable interval, then apply interrupt latency.',
        'Does interrupt masking itself guarantee a stable switch state?',
        ['No', 'Yes', 'Only at low voltage'],
        'Debounce and interrupt service latency are separate timing mechanisms.',
        'If the last raw transition is at 6 ms and the stable interval is 8 ms, the accepted edge is at 14 ms.',
        'Accept a raw state only after t−tlast_change≥Tdebounce; ISR time=taccepted+Tlatency.',
        'Deterministic alternating contact transitions at 0, .16B, .32B, .48B, .64B and .8B, final closure at B. Sample resolution 0.05 ms; no analog Schmitt or metastability model.',
      ),
    },
    (a) => {
      const edges =
          a.bounce === 0 ? [0] : [0, 0.16, 0.32, 0.48, 0.64, 0.8, 1].map((x) => x * a.bounce),
        end = Math.max(50, a.bounce + a.debounce + a.latency + 5);
      let state = 0,
        last = 0,
        accepted = 0,
        time = null,
        rawPrev = 0;
      const s = seq(0, end, Math.ceil(end / 0.05)).map((x) => {
        let raw = 0;
        if (x >= a.bounce) raw = 1;
        else raw = edges.filter((t) => t <= x).length % 2;
        if (raw !== rawPrev) {
          last = x;
          rawPrev = raw;
        }
        if (raw !== state && x - last + 1e-9 >= a.debounce) {
          state = raw;
          if (state && time === null) {
            time = x;
            accepted = x;
          }
        }
        return { x, y: raw, reference: state, third: +(time !== null && x >= time + a.latency) };
      });
      return output(
        {
          accepted: time,
          service: time === null ? null : accepted + a.latency,
          edges: a.bounce === 0 ? 1 : 4,
        },
        s,
        'logic-timing',
        {
          lanes: [
            { label: 'Contact', points: s.map((p) => [p.x, p.y]) },
            { label: 'Debounced', points: s.map((p) => [p.x, p.reference]) },
            { label: 'ISR', points: s.map((p) => [p.x, p.third]) },
          ],
        },
      );
    },
  ),
  serialtiming: make(
    {
      id: 'serialtiming',
      title: 'UART, SPI and I²C Timing Diagrams',
      inputs: {
        bus: choice('Serial protocol', ['UART', 'SPI', 'I2C'], 'UART'),
        byte: integer('Data byte', 0, 255, 165),
        rate: p('Bit / clock rate', 'kbit/s', 1, 1000, 100),
        address: integer('I²C 7-bit address', 0, 127, 72),
        polarity: choice('SPI clock idle / sampling mode', ['mode0', 'mode3'], 'mode0'),
      },
      metrics: {
        duration: ['Transaction duration', 'µs'],
        bits: ['Clocked bit slots', '1'],
        payload: ['Payload efficiency', '%'],
      },
      plot: {
        x: 'Time',
        xUnit: 'µs',
        y: 'Logic level',
        yUnit: '1',
        traces: { y: 'Data / MOSI', reference: 'Clock, where present' },
      },
      text: teaching(
        'Build protocol-specific bit timelines, including UART framing, SPI clock phase and I²C address/ACK slots.',
        'Which protocol requires a pulled-up open-drain data line with ACK slots?',
        ['I²C', 'UART', 'SPI'],
        'I²C combines start/stop conditions, a 7-bit address plus R/W and receiver ACK bits.',
        'UART 8N1 sends 10 bits per data byte; at 100 kbit/s the frame takes 100 µs.',
        'UART: start+8 LSB-first data+stop; SPI: 8 MSB-first clocks; I²C: address/RW+ACK+data+ACK.',
        'UART 8N1, SPI mode 0 or 3 with active-low CS, I²C single-byte write to an always-ACK receiver. Start/stop timing uses half-bit illustrative slots; no clock stretching, bus capacitance or setup-time compliance analysis.',
      ),
    },
    (a) => {
      const bit = 1000 / a.rate,
        data = Array.from({ length: 8 }, (_, i) => (a.byte >> (a.bus === 'UART' ? i : 7 - i)) & 1),
        bits =
          a.bus === 'UART'
            ? [0, ...data, 1]
            : a.bus === 'SPI'
              ? data
              : [
                  ...Array.from({ length: 7 }, (_, i) => (a.address >> (6 - i)) & 1),
                  0,
                  0,
                  ...data,
                  0,
                ],
        slots = bits.length + (a.bus === 'I2C' ? 2 : 0),
        lanes = [],
        s = seq(0, slots * bit, slots * 20).map((x) => {
          const t = x / bit,
            shift = a.bus === 'I2C' ? 1 : a.bus === 'SPI' && a.polarity === 'mode3' ? 0.5 : 0,
            k = Math.max(0, Math.min(bits.length - 1, Math.floor(t - shift)));
          let y =
              a.bus === 'I2C'
                ? t < 0.5
                  ? 1
                  : t < 1
                    ? 0
                    : t >= slots - 0.5
                      ? 1
                      : bits[Math.max(0, k)]
                : bits[k],
            clock =
              a.bus === 'UART'
                ? 1
                : a.bus === 'I2C'
                  ? t < 1 || t >= slots - 1
                    ? 1
                    : +(t % 1 >= 0.25 && t % 1 < 0.75)
                  : a.polarity === 'mode3'
                    ? +(t % 1 < 0.5)
                    : +(t % 1 >= 0.5);
          return { x, y, reference: clock };
        });
      lanes.push({
        label: a.bus === 'SPI' ? 'MOSI' : a.bus === 'I2C' ? 'SDA' : 'TX',
        points: s.map((p) => [p.x, p.y]),
      });
      if (a.bus !== 'UART')
        lanes.push({
          label: a.bus === 'SPI' ? 'SCLK' : 'SCL',
          points: s.map((p) => [p.x, p.reference]),
        });
      if (a.bus === 'SPI')
        lanes.push({
          label: 'CS (active low)',
          points: [
            [0, 1],
            [0, 0],
            [slots * bit, 0],
            [slots * bit, 1],
          ],
        });
      return output(
        { duration: slots * bit, bits: bits.length, payload: 800 / slots },
        s,
        'logic-timing',
        { lanes },
      );
    },
  ),
  sensorallan: make(
    {
      id: 'sensorallan',
      title: 'Sensor Noise, Averaging and Allan Deviation',
      inputs: {
        white: p('White noise standard deviation', '1', 0.01, 2, 0.5),
        walk: p('Random-walk increment deviation', '1', 0, 0.1, 0.01),
        averaging: choice('Averaging block length', ['1', '4', '16', '64'], '16'),
        seed: integer('Reproducible noise seed', 1, 9999, 42),
      },
      metrics: {
        raw: ['Raw sample deviation', '1'],
        averaged: ['Block-average deviation', '1'],
        best: ['Minimum sampled Allan-deviation time', 'samples'],
      },
      plot: {
        x: 'Averaging factor τ',
        xUnit: 'samples',
        y: 'Overlapping Allan deviation',
        yUnit: '1',
        traces: { y: 'Observed deviation', reference: 'White-noise prediction' },
      },
      text: teaching(
        'Generate seeded white noise plus random-walk drift, then compare block averages and overlapping Allan deviation.',
        'Will indefinite averaging always improve a drifting sensor?',
        ['No, random walk eventually dominates', 'Yes', 'Only odd block sizes work'],
        'Independent white noise averages down, while accumulated drift grows over long intervals.',
        'Pure white noise with σ=0.5 has Allan deviation near 0.5/√m at averaging factor m.',
        'σA²(m)=1/[2(N−2m+1)] Σ(ȳᵢ₊ₘ−ȳᵢ)²; white σA≈σ/√m.',
        '4096 unit-spaced samples, seeded Gaussian draws. Random walk is synthetic integrated noise, not a calibrated physical sensor. Standard deviations are population statistics of this finite realization.',
      ),
    },
    (a) => {
      const rng = random(a.seed),
        data = [];
      let drift = 0;
      for (let i = 0; i < 4096; i++) {
        drift += a.walk * normal(rng);
        data.push(drift + a.white * normal(rng));
      }
      const m = Number(a.averaging),
        averages = Array.from({ length: data.length / m }, (_, i) =>
          mean(data.slice(i * m, (i + 1) * m)),
        ),
        std = (x) => rms(x.map((v) => v - mean(x))),
        s = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512].map((x) => ({
          x,
          y: allanDeviation(data, x),
          reference: a.white / Math.sqrt(x),
        })),
        best = s.reduce((x, y) => (x.y < y.y ? x : y));
      return output({ raw: std(data), averaged: std(averages), best: best.x }, s, 'noise', {
        samples: data.filter((_, i) => i % 8 === 0),
      });
    },
  ),
  timeroverflow: make(
    {
      id: 'timeroverflow',
      title: 'Timer Prescaler and Overflow Calculator',
      inputs: {
        clock: p('Peripheral clock', 'MHz', 1, 200, 16),
        prescaler: choice('Clock divisor', ['1', '8', '64', '256', '1024'], '64'),
        bits: choice('Counter width', ['8', '16', '32'], '16'),
        target: p('Requested periodic interval', 'ms', 0.001, 5000, 10),
      },
      metrics: {
        tick: ['Timer tick', 'µs'],
        maximum: ['Full-width overflow period', 'ms'],
        reload: ['Required reload / TOP count', 'counts'],
        actual: ['Achievable interval', 'ms'],
        error: ['Relative timing error', '%'],
      },
      plot: { x: 'Elapsed time', xUnit: 'ms', y: 'Counter value', yUnit: 'counts' },
      text: teaching(
        'Calculate a representable TOP value from clock, divisor and desired interval, including out-of-range targets.',
        'Can every requested interval fit an 8-bit timer at divisor one?',
        ['No', 'Yes', 'Only with a faster clock'],
        'The maximum period is constrained by the finite counter range.',
        '16 MHz divided by 64 gives a 4 µs tick; 10 ms needs 2500 ticks, TOP=2499.',
        'Ttick=P/fclk; ticks=round(Tdesired/Ttick); TOP=ticks−1; Tmax=2ᵇTtick.',
        'Ideal up-counter with inclusive TOP and integer divider, no interrupt latency. Targets outside [1,2ᵇ] ticks return null reload/actual and a warning rather than silently clipping.',
      ),
    },
    (a) => {
      const tick = Number(a.prescaler) / a.clock,
        max = 2 ** Number(a.bits),
        ticks = Math.round((a.target * 1000) / tick),
        ok = ticks >= 1 && ticks <= max,
        actual = ok ? (ticks * tick) / 1000 : null;
      return output(
        {
          tick,
          maximum: (max * tick) / 1000,
          reload: ok ? ticks - 1 : null,
          actual,
          error: ok ? (100 * (actual - a.target)) / a.target : null,
        },
        seq(0, (actual ?? a.target) * 3, 300).map((x) => ({
          x,
          y: Math.floor((x * 1000) / tick) % (ok ? ticks : max),
        })),
        'timer-counter',
        { ...a, ticks: ok ? ticks : null },
        [],
        ok
          ? []
          : [
              'Requested interval does not fit this timer/divisor. Choose another divisor or counter width.',
            ],
      );
    },
  ),
};

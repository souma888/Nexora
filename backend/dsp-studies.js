import {
  exploration as lab,
  p,
  integer,
  choice,
  seq,
  teaching,
  output,
  fft,
  windowValue,
  sinc,
  rms,
  C,
  add,
  mul,
  div,
  abs,
  polar,
  angle,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'signals', topic: 'Digital signal processing', ...config }, solve);
export function frequencyResponse(b, a, w) {
  let top = C(),
    bottom = C();
  b.forEach((v, k) => (top = add(top, polar(v, -w * k))));
  a.forEach((v, k) => (bottom = add(bottom, polar(v, -w * k))));
  return div(top, bottom);
}
export function butterworth2(cutoff, fs) {
  const k = Math.tan((Math.PI * cutoff) / fs),
    d = 1 + Math.SQRT2 * k + k * k;
  return {
    b: [(k * k) / d, (2 * k * k) / d, (k * k) / d],
    a: [1, (2 * (k * k - 1)) / d, (1 - Math.SQRT2 * k + k * k) / d],
  };
}
export function firKernel(taps, cutoff, fs, window) {
  const m = (taps - 1) / 2,
    h = Array.from(
      { length: taps },
      (_, i) =>
        ((2 * cutoff) / fs) * sinc(((2 * cutoff) / fs) * (i - m)) * windowValue(window, i, taps),
    ),
    s = h.reduce((x, y) => x + y, 0);
  return h.map((x) => x / s);
}
export const dspModels = {
  fourierseries: make(
    {
      id: 'fourierseries',
      title: 'Fourier Series Synthesis and Gibbs Phenomenon',
      inputs: {
        harmonics: integer('Retained harmonics', 1, 80, 15),
        shape: choice('Periodic target', ['square', 'sawtooth', 'triangle'], 'square'),
      },
      metrics: {
        error: ['Sampled RMS reconstruction error', '1'],
        overshoot: ['Peak above target maximum', '%'],
        terms: ['Nonzero sinusoidal terms', '1'],
      },
      plot: {
        x: 'Phase / period',
        xUnit: '1',
        y: 'Amplitude',
        yUnit: '1',
        traces: { y: 'Partial sum', reference: 'Periodic target' },
      },
      text: teaching(
        'Build a discontinuous or continuous waveform from its actual Fourier coefficients.',
        'Does adding harmonics remove the limiting Gibbs peak at a jump?',
        ['No, it narrows the affected region', 'Yes, immediately', 'Only for a square wave'],
        'The overshoot approaches roughly 8.95% of the jump while its width shrinks.',
        'A square wave’s first term is (4/π)sin(2πt); its value at the jump is the midpoint, zero.',
        'Square: Σodd 4 sin(2πnt)/(πn); sawtooth: Σ 2(−1)ⁿ⁺¹sin(2πnt)/(πn).',
        'Unit-period targets; coefficients use symmetric midpoint values at discontinuities. The overshoot metric is relative to amplitude one, not jump height.',
      ),
    },
    (a) => {
      const target = (t) =>
        a.shape === 'square'
          ? Math.abs(Math.sin(2 * Math.PI * t)) < 1e-10
            ? 0
            : Math.sign(Math.sin(2 * Math.PI * t))
          : a.shape === 'sawtooth'
            ? 2 * (t - Math.floor(t + 0.5))
            : (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * t));
      let terms = 0;
      const coeff = [];
      for (let n = 1; n <= a.harmonics; n++) {
        if (a.shape !== 'sawtooth' && n % 2 === 0) continue;
        terms++;
        coeff.push([
          n,
          a.shape === 'square'
            ? 4 / (Math.PI * n)
            : a.shape === 'sawtooth'
              ? (2 * (-1) ** (n + 1)) / (Math.PI * n)
              : (8 * (-1) ** ((n - 1) / 2)) / (Math.PI * Math.PI * n * n),
        ]);
      }
      const s = seq(-0.5, 0.5, 2000).map((x) => ({
        x,
        y: coeff.reduce((s, [n, c]) => s + c * Math.sin(2 * Math.PI * n * x), 0),
        reference: target(x),
      }));
      return output(
        {
          error: rms(s.map((v) => v.y - v.reference)),
          overshoot: 100 * Math.max(0, ...s.map((v) => v.y - 1)),
          terms,
        },
        s,
        'harmonics',
        { coefficients: coeff },
      );
    },
  ),
  fftspectrum: make(
    {
      id: 'fftspectrum',
      title: 'FFT Spectrum, Leakage and Windowing',
      inputs: {
        frequency: p('Tone frequency', 'Hz', 1, 120, 17.3),
        samples: choice('FFT samples', ['128', '256', '512'], '256'),
        rate: p('Sampling rate', 'Hz', 256, 1024, 256),
        window: choice('Analysis window', ['rectangular', 'hann', 'blackman'], 'hann'),
      },
      metrics: {
        peak: ['Largest-bin frequency', 'Hz'],
        spacing: ['Bin spacing', 'Hz'],
        amplitude: ['Coherent-gain corrected peak amplitude', '1'],
        enbw: ['Equivalent noise bandwidth', 'bins'],
      },
      plot: { x: 'Frequency', xUnit: 'Hz', y: 'Amplitude', yUnit: '1' },
      text: teaching(
        'Compute a radix-2 FFT of a sampled sinusoid and observe leakage and coherent-gain correction.',
        'Does zero bin-centering guarantee the peak-bin amplitude equals one?',
        ['No, scalloping remains', 'Yes for any window', 'Only above Nyquist'],
        'A non-bin-centered tone spreads energy across bins; window gain correction does not remove scalloping.',
        'For fs=256 Hz and N=256, bins are 1 Hz apart. A 17 Hz rectangular-window tone occupies one positive-frequency bin.',
        'X[k]=Σx[n]w[n]e^(−j2πkn/N); A[k]=2|X[k]|/Σw, except DC/Nyquist.',
        'One real unit-amplitude tone, no additive noise, no interpolation. Windows are symmetric N−1 forms; ENBW=NΣw²/(Σw)².',
      ),
    },
    (a) => {
      const N = Number(a.samples),
        w = Array.from({ length: N }, (_, i) => windowValue(a.window, i, N)),
        gain = w.reduce((s, v) => s + v, 0),
        x = w.map((v, i) => v * Math.sin((2 * Math.PI * a.frequency * i) / a.rate)),
        X = fft(x),
        s = X.slice(0, N / 2 + 1).map((v, k) => ({
          x: (k * a.rate) / N,
          y: ((k === 0 || k === N / 2 ? 1 : 2) * abs(v)) / gain,
        })),
        peak = s.reduce((x, y) => (x.y > y.y ? x : y));
      return output(
        {
          peak: peak.x,
          spacing: a.rate / N,
          amplitude: peak.y,
          enbw: (N * w.reduce((s, v) => s + v * v, 0)) / gain ** 2,
        },
        s,
        'spectrum',
        { samples: x, window: w },
      );
    },
  ),
  laplacepz: make(
    {
      id: 'laplacepz',
      title: 'Laplace Pole–Zero and Frequency Response',
      inputs: {
        real: p('Pole-pair real part', 's⁻¹', -5, 2, -1),
        imaginary: p('Pole-pair imaginary part', 'rad/s', 0.1, 10, 2),
        zero: p('Real zero location', 's⁻¹', -10, 10, -3),
        gain: p('Numerator gain', '1', 0.1, 10, 1),
      },
      metrics: {
        dc: ['Signed DC gain', '1'],
        resonance: ['Sampled peak frequency', 'rad/s'],
        stable: ['Asymptotically stable', 'boolean'],
      },
      plot: {
        traceUnits: { reference: '°' },
        x: 'Frequency',
        xUnit: 'rad/s',
        y: 'Magnitude',
        yUnit: 'dB',
        traces: { y: 'Magnitude (dB)', reference: 'Phase (degrees), separate units' },
      },
      text: teaching(
        'Move a conjugate pole pair and a real zero, and evaluate H(jω) directly.',
        'Can a frequency-response curve alone prove causal stability?',
        ['No, poles must also be inspected', 'Yes, if finite', 'Only at DC'],
        'An unstable causal transfer function can still have finite algebraic H(jω) values.',
        'Poles −1±2j and zero −3 give DC gain 3/5 at K=1.',
        'H(s)=K(s−z)/[(s−σ)²+ωd²]; stable iff σ<0.',
        'Continuous-time proper rational SISO model. dB floors at −240 dB avoid log zero; phase is principal angle. No hidden pole-zero cancellation stability inference.',
      ),
    },
    (a) => {
      const response = (w) =>
          div(
            mul(C(a.gain), C(-a.zero, w)),
            C(a.real * a.real + a.imaginary * a.imaginary - w * w, -2 * a.real * w),
          ),
        s = seq(0, 20, 400).map((x) => ({
          x,
          y: 20 * Math.log10(Math.max(abs(response(x)), 1e-12)),
          reference: angle(response(x)),
        })),
        peak = s.reduce((x, y) => (x.y > y.y ? x : y));
      return output(
        {
          dc: (-a.gain * a.zero) / (a.real * a.real + a.imaginary * a.imaginary),
          resonance: peak.x,
          stable: +(a.real < 0),
        },
        s,
        'pole-map',
        {
          poles: [
            [a.real, a.imaginary],
            [a.real, -a.imaginary],
          ],
          zeros: [[a.zero, 0]],
          discrete: false,
        },
      );
    },
  ),
  firwindow: make(
    {
      id: 'firwindow',
      title: 'FIR Filter Design by the Window Method',
      inputs: {
        taps: choice('Odd tap count', ['15', '31', '63', '127'], '31'),
        cutoff: p('Cutoff frequency', 'Hz', 5, 100, 40),
        rate: p('Sample rate', 'Hz', 256, 1024, 256),
        window: choice('Design window', ['rectangular', 'hann', 'blackman'], 'blackman'),
      },
      metrics: {
        dc: ['DC gain', '1'],
        delay: ['Linear-phase group delay', 'samples'],
        cutoffGain: ['Amplitude at nominal cutoff', '1'],
      },
      plot: { x: 'Frequency', xUnit: 'Hz', y: 'Magnitude', yUnit: 'dB' },
      text: teaching(
        'Form and normalize a finite windowed-sinc low-pass impulse response, then evaluate its discrete frequency response.',
        'What does increasing tap count mainly improve?',
        ['A narrower transition band', 'Zero latency', 'An infinite stopband attenuation'],
        'More coefficients improve frequency selectivity at the cost of delay and computation.',
        'A symmetric 31-tap filter has group delay (31−1)/2=15 samples.',
        'h[n]=2fc/fs·sinc[2fc(n−M)/fs]w[n]; H(eʲω)=Σh[n]e⁻ʲωⁿ.',
        'Odd-length symmetric type-I low-pass FIR. DC normalization is applied after windowing; cutoff is the ideal discontinuity and is approximately −6 dB, not the IIR −3 dB definition.',
      ),
    },
    (a) => {
      const h = firKernel(Number(a.taps), a.cutoff, a.rate, a.window);
      return output(
        {
          dc: h.reduce((s, v) => s + v, 0),
          delay: (h.length - 1) / 2,
          cutoffGain: abs(frequencyResponse(h, [1], (2 * Math.PI * a.cutoff) / a.rate)),
        },
        seq(0, a.rate / 2, 400).map((x) => ({
          x,
          y:
            20 *
            Math.log10(Math.max(1e-8, abs(frequencyResponse(h, [1], (2 * Math.PI * x) / a.rate)))),
        })),
        'filter-taps',
        { coefficients: h },
      );
    },
  ),
  iirbutterworth: make(
    {
      id: 'iirbutterworth',
      title: 'IIR Butterworth and the Bilinear Transform',
      inputs: {
        cutoff: p('Digital −3 dB cutoff', 'Hz', 5, 100, 40),
        rate: p('Sample rate', 'Hz', 256, 1024, 256),
      },
      metrics: {
        cutoff: ['Magnitude at specified cutoff', 'dB'],
        radius: ['Conjugate-pole radius', '1'],
        dc: ['DC gain', '1'],
      },
      plot: {
        x: 'Digital frequency',
        xUnit: 'Hz',
        y: 'Magnitude',
        yUnit: 'dB',
        traces: { y: 'Prewarped bilinear design', reference: 'Unwarped analog template' },
      },
      text: teaching(
        'Design an actual second-order digital Butterworth biquad with cutoff prewarping.',
        'Why prewarp the analog cutoff before the bilinear transform?',
        [
          'To compensate nonlinear frequency mapping',
          'To introduce aliasing',
          'To move stable poles outside the unit circle',
        ],
        'The tangent mapping preserves the chosen cutoff while compressing high analog frequencies.',
        'At the specified digital cutoff the design has |H|=1/√2 and −3.0103 dB.',
        'K=tan(πfc/fs); b=[K²,2K²,K²]/D; a=[1,2(K²−1)/D,(1−√2K+K²)/D].',
        'Fixed second order low-pass, double precision. The comparison is an unwarped analog Butterworth magnitude evaluated at digital frequency, not another digital realization.',
      ),
    },
    (a) => {
      const { b, a: den } = butterworth2(a.cutoff, a.rate);
      return output(
        {
          cutoff:
            20 * Math.log10(abs(frequencyResponse(b, den, (2 * Math.PI * a.cutoff) / a.rate))),
          radius: Math.sqrt(den[2]),
          dc: abs(frequencyResponse(b, den, 0)),
        },
        seq(0, a.rate / 2, 400).map((x) => ({
          x,
          y:
            20 *
            Math.log10(Math.max(1e-12, abs(frequencyResponse(b, den, (2 * Math.PI * x) / a.rate)))),
          reference: 20 * Math.log10(1 / Math.sqrt(1 + (x / a.cutoff) ** 4)),
        })),
        'filter-taps',
        { coefficients: b, denominator: den },
        b.map((v, i) => [`b${i} / a${i}`, `${v} / ${den[i]}`]),
      );
    },
  ),
  zstability: make(
    {
      id: 'zstability',
      title: 'Z-Transform Pole–Zero and Stability',
      inputs: {
        radius: p('Conjugate-pole radius', '1', 0, 1.2, 0.85),
        angle: p('Pole angle', '°', 10, 170, 60),
        zero: p('Real zero', '1', -1.5, 1.5, -1),
        samples: integer('Impulse-response samples', 20, 150, 60),
      },
      metrics: {
        stable: ['Causal BIBO stable', 'boolean'],
        peak: ['Peak impulse magnitude', '1'],
        last: ['Last impulse sample', '1'],
      },
      plot: { x: 'Sample index', xUnit: '1', y: 'Impulse response', yUnit: '1' },
      text: teaching(
        'Relate causal z-plane poles to an explicitly iterated impulse response.',
        'Are poles on the unit circle BIBO stable for this causal filter?',
        ['No', 'Yes', 'Only when complex'],
        'Without exact cancellation, marginal undamped poles fail absolute summability.',
        'A radius below one produces a decaying envelope; at radius one oscillations persist.',
        'H(z)=(1−z₀z⁻¹)/(1−2r cosθ z⁻¹+r²z⁻²); h[n]=2r cosθ h[n−1]−r²h[n−2]+δ[n]−z₀δ[n−1].',
        'Causal initial-rest second-order filter; exact cancellations are not used to reclassify internal pole stability. Principal frequency angle is 0…π.',
      ),
    },
    (a) => {
      const c = 2 * a.radius * Math.cos((a.angle * Math.PI) / 180),
        h = [];
      for (let n = 0; n < a.samples; n++)
        h.push(
          c * (h[n - 1] ?? 0) -
            a.radius * a.radius * (h[n - 2] ?? 0) +
            (n === 0 ? 1 : n === 1 ? -a.zero : 0),
        );
      return output(
        { stable: +(a.radius < 1), peak: Math.max(...h.map(Math.abs)), last: h.at(-1) },
        h.map((y, x) => ({ x, y })),
        'pole-map',
        {
          poles: [
            [
              a.radius * Math.cos((a.angle * Math.PI) / 180),
              a.radius * Math.sin((a.angle * Math.PI) / 180),
            ],
            [
              a.radius * Math.cos((a.angle * Math.PI) / 180),
              -a.radius * Math.sin((a.angle * Math.PI) / 180),
            ],
          ],
          zeros: [[a.zero, 0]],
          discrete: true,
        },
      );
    },
  ),
  correlationdelay: make(
    {
      id: 'correlationdelay',
      title: 'Correlation and Time-Delay Estimation',
      inputs: {
        delay: integer('True integer delay', -30, 30, 12),
        noise: p('Deterministic interference amplitude', '1', 0, 1, 0.1),
        width: p('Pulse width', 'samples', 2, 12, 5),
      },
      metrics: {
        estimate: ['Estimated signed delay', 'samples'],
        error: ['Delay estimation error', 'samples'],
        peak: ['Normalized correlation peak', '1'],
      },
      plot: {
        x: 'Candidate delay',
        xUnit: 'samples',
        y: 'Normalized cross-correlation',
        yUnit: '1',
      },
      text: teaching(
        'Shift a nonperiodic Gaussian pulse and recover signed delay by normalized cross-correlation.',
        'Does periodic data uniquely determine an arbitrary delay?',
        ['No, peaks repeat', 'Yes, always', 'Only with more amplitude'],
        'A nonperiodic pulse avoids ambiguity from repeated waveform periods.',
        'For y[n]=x[n−12] without noise, the correlation peak is at lag +12.',
        'Rxy[k]=Σx[n]y[n+k]/√(Σx²Σy²), using only overlapping samples.',
        'Finite noncircular records; candidate lags −40…40. Noise is a reproducible two-tone interference, not random white noise; overlap is normalized independently for each lag.',
      ),
    },
    (a) => {
      const x = Array.from({ length: 160 }, (_, i) => Math.exp(-0.5 * ((i - 70) / a.width) ** 2)),
        y = x.map(
          (_, i) =>
            Math.exp(-0.5 * ((i - 70 - a.delay) / a.width) ** 2) +
            (a.noise * (Math.sin(i * 1.71) + Math.cos(i * 2.23))) / 2,
        ),
        s = Array.from({ length: 81 }, (_, i) => {
          const k = i - 40;
          let sum = 0,
            xx = 0,
            yy = 0;
          for (let n = 0; n < x.length; n++) {
            if (n + k < 0 || n + k >= y.length) continue;
            sum += x[n] * y[n + k];
            xx += x[n] ** 2;
            yy += y[n + k] ** 2;
          }
          return { x: k, y: sum / Math.sqrt(xx * yy) };
        }),
        peak = s.reduce((x, y) => (x.y > y.y ? x : y));
      return output({ estimate: peak.x, error: peak.x - a.delay, peak: peak.y }, s, 'correlation', {
        first: x,
        second: y,
      });
    },
  ),
  spectrogram: make(
    {
      id: 'spectrogram',
      title: 'Spectrogram and Time–Frequency Tradeoff',
      inputs: {
        start: p('Chirp starting frequency', 'Hz', 10, 100, 20),
        end: p('Chirp ending frequency', 'Hz', 20, 220, 180),
        window: choice('STFT length', ['32', '64', '128', '256'], '64'),
      },
      metrics: {
        time: ['Window duration', 's'],
        frequency: ['FFT bin spacing', 'Hz'],
        frames: ['Overlapping frames', '1'],
      },
      plot: {
        x: 'Time at frame center',
        xUnit: 's',
        y: 'Peak-bin frequency',
        yUnit: 'Hz',
        traces: { y: 'STFT peak', reference: 'Instantaneous chirp frequency' },
      },
      text: teaching(
        'Compute a Hann-window short-time Fourier transform of a linear chirp and inspect its actual heat map.',
        'What happens to frequency-bin spacing when window length grows?',
        ['It decreases while time localization worsens', 'It increases', 'It is unchanged'],
        'Longer observations resolve nearby frequencies but combine a wider time interval.',
        'At fs=512 Hz, a 64-sample window spans 0.125 s and has 8 Hz bin spacing.',
        'STFT(m,k)=Σx[n+mH]w[n]e^(−j2πkn/N); Δf=fs/N; H=N/4.',
        'One-second synthetic linear chirp, fs=512 Hz, no zero padding. Plot follows the strongest bin; the image shows log power clipped to a 60 dB range.',
      ),
    },
    (a) => {
      const N = Number(a.window),
        fs = 512,
        signal = Array.from({ length: 512 }, (_, i) => {
          const t = i / fs;
          return Math.sin(2 * Math.PI * (a.start * t + 0.5 * (a.end - a.start) * t * t));
        }),
        cells = [],
        s = [];
      for (let start = 0; start + N <= 512; start += N / 4) {
        const X = fft(
            signal.slice(start, start + N).map((x, i) => x * windowValue('hann', i, N)),
          ).slice(0, N / 2 + 1),
          power = X.map((v) => abs(v) ** 2),
          max = Math.max(...power),
          k = power.indexOf(max),
          t = (start + (N - 1) / 2) / fs;
        cells.push(power.map((v) => Math.max(-60, 10 * Math.log10(Math.max(v / max, 1e-12)))));
        s.push({ x: t, y: (k * fs) / N, reference: a.start + (a.end - a.start) * t });
      }
      return output({ time: N / fs, frequency: fs / N, frames: s.length }, s, 'spectrogram', {
        cells,
        maximum: fs / 2,
      });
    },
  ),
};

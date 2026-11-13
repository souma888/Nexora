/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  amradio: [
    'Follow a carrier as its envelope follows a sinusoidal message, including overmodulation.',
    'What happens above modulation index one?',
    ['The envelope crosses zero', 'Carrier frequency doubles', 'All sidebands disappear'],
    'A negative signed envelope causes carrier phase reversals, so a simple envelope ' +
      'detector distorts the message.',
    'With carrier peak 2 V, m=0.5 and R=50 Ω, the envelope ranges 1–3 V and average ' +
      'signal power is 0.045 W.',
    's(t)=Ac[1+m cos(2πfmt)]cos(2πfct). P=Ac²(1+m²/2)/(2R); sideband fraction=(m²/2)/(1+m²/2).',
    'Single-tone conventional AM, ideal resistive load, no noise, amplifier limits or ' +
      'detector dynamics. Low display frequencies keep individual carrier cycles ' +
      'visible; RF scaling preserves the normalized relationships.',
  ],
  fmradio: [
    'Compare phase accumulation, frequency deviation and occupied-bandwidth estimation.',
    'Does ideal FM change the carrier amplitude?',
    ['No', 'Yes, proportionally to deviation', 'Only when the message is slow'],
    'Ideal FM changes phase rate while keeping the carrier envelope constant.',
    'At fm=2 Hz and deviation 4 Hz, β=2 and Carson’s rule estimates 12 Hz; a 30 Hz ' +
      'center varies from 26 to 34 Hz.',
    's(t)=Ac cos[2πfct+β sin(2πfmt)], β=Δf/fm. fi(t)=fc+Δf cos(2πfmt). Carson B≈2(Δf+fm).',
    'Sinusoidal ideal FM with constant amplitude and positive instantaneous frequency ' +
      'over the accepted domain. Carson’s rule is an approximate bandwidth estimate, ' +
      'not a hard spectral cutoff. No demodulator or channel noise.',
  ],
  bpsk: [
    'Map bits to opposite carrier phases and inspect transitions at symbol boundaries.',
    'What phase change separates the two BPSK symbols?',
    ['180°', '90°', '360°'],
    'Multiplying the carrier by −1 shifts its phase by π radians.',
    'At 1 V peak and 20 bit/s into 1 Ω, Eb=25 mJ. Three carrier cycles per bit give fc=60 Hz.',
    'Bit 0 maps to +Ac and bit 1 to −Ac. s(t)=a[k]cos(2πfct), fc=Ncycles Rb; Eb=Ac²/(2R Rb).',
    'Ideal rectangular symbols, coherent reference, R=1 Ω and an integer number of ' +
      'carrier cycles per bit. No pulse shaping, synchronization error, channel noise ' +
      'or BER prediction. The final endpoint retains the last bit.',
  ],
  qpsk: [
    'Inspect a Gray-coded four-point constellation and its piecewise-constant I/Q components.',
    'How many bits does one QPSK symbol carry?',
    ['Two', 'One', 'Four'],
    'Four distinguishable states encode log₂4=2 bits per symbol.',
    'Magnitude 1 gives I,Q=±1/√2. Dibits 00,01,11,10 go around the circle at ' +
      '45°,135°,225°,315°; 20 symbols/s carries 40 bit/s.',
    '00→(+,+), 01→(−,+), 11→(−,−), 10→(+,−). I²+Q²=A², Rb=2Rs, Es=A²/Rs for the ' +
      'stated 1 Ω complex-envelope convention.',
    'Normalized complex baseband only; no passband factor-of-two ambiguity is hidden ' +
      'in the energy convention. No pulse shaping or noise. Gray labels describe ' +
      'adjacent points, not ordinary binary angle order.',
  ],
  radiolink: [
    'Balance transmitted power, antenna gains, free-space spreading and a receiver threshold.',
    'What does doubling free-space distance do to received power?',
    ['Reduces it by about 6.02 dB', 'Reduces it by 3 dB', 'Leaves it unchanged'],
    'Power density spreads over area proportional to distance squared.',
    'At 2.4 GHz and 1 km, FSPL≈100.052 dB. With 20 dBm transmit, two 2 dBi antennas ' +
      'and 2 dB other loss, Pr≈−78.052 dBm; margin above −90 dBm is 11.948 dB.',
    'FSPL=20log₁₀(4πdf/c), c=299792458 m/s. Pr(dBm)=Pt+Gt+Gr−FSPL−L; margin=Pr−sensitivity.',
    'Ideal line-of-sight free space and far-field antennas with prescribed gains. No ' +
      'terrain, fading, obstruction, polarization mismatch, interference or regulatory ' +
      'analysis. Threshold margin alone does not predict reliability.',
  ],
  shannon: [
    'Explore the bandwidth and signal-to-noise limit of an ideal band-limited Gaussian channel.',
    'At fixed SNR, what does doubling bandwidth do to capacity?',
    ['Doubles it', 'Squares it', 'Leaves it fixed'],
    'C=B log₂(1+S/N) is linear in B when the total SNR is held constant.',
    'At B=100 kHz and SNR=10 dB (=10 linear), C=100000 log₂11≈0.345943 Mbit/s.',
    'C=B log₂(1+10^(SNRdB/10)). Spectral efficiency C/B=log₂(1+S/N).',
    'An information-theoretic upper bound for an AWGN channel, not an achievable rate ' +
      'for a chosen modem or finite code. Bandwidth sweeps assume SNR is separately ' +
      'held fixed, rather than fixing transmitter power and noise density.',
  ],
};

import {
  engineering,
  p,
  choice,
  seq,
  bisect,
  lesson,
  domain,
  requireValue,
  result,
} from './engineering-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'electronics', topic: 'Semiconductors & devices', ...config }, solve);
const KB = 8.617333262e-5;
export const siliconNi = (T) =>
  1e10 * (T / 300) ** 1.5 * Math.exp((-1.12 / (2 * KB)) * (1 / T - 1 / 300));
export function diodeState(a, V = a.bias) {
  const vt = KB * a.temperature,
    Is =
      a.saturation *
      (a.temperature / 300) ** 3 *
      Math.exp((-1.12 / KB) * (1 / a.temperature - 1 / 300)),
    f = (v) => Is * Math.expm1(v / (a.ideality * vt)) - (V - v) / a.resistance,
    v = V === 0 ? 0 : bisect(f, Math.min(0, V), Math.max(0, V)),
    I = (V - v) / a.resistance,
    ni = siliconNi(a.temperature),
    built = vt * Math.log((a.acceptors * a.donors) / (ni * ni)),
    W =
      built > v
        ? Math.sqrt(
            ((2 * 11.7 * 8.8541878128e-14) / 1.602176634e-19) *
              (1 / a.acceptors + 1 / a.donors) *
              (built - v),
          ) * 1e4
        : null;
  return { current: I, junction: v, built, depletion: W, Is };
}
export function mosCurrent(gate, drain, threshold, beta, lambda = 0.02) {
  const u = gate - threshold;
  if (u <= 0) return 0;
  return beta * (drain < u ? u * drain - (drain * drain) / 2 : (u * u) / 2) * (1 + lambda * drain);
}
export function inverterOutput(a, Vin) {
  if (Vin <= 0) return a.supply;
  if (Vin >= a.supply) return 0;
  return bisect(
    (v) =>
      mosCurrent(Vin, v, a.nthreshold, a.nbeta) -
      mosCurrent(a.supply - Vin, a.supply - v, a.pthreshold, a.pbeta),
    0,
    a.supply,
  );
}
export function transistorBias(a) {
  const Rb = ((a.upper * a.lower) / (a.upper + a.lower)) * 1000,
    Vth = (a.supply * a.lower) / (a.upper + a.lower),
    Re = a.emitter * 1000,
    Rc = a.collector * 1000;
  if (Vth <= 0.7) return { base: 0, collector: 0, emitter: 0, vce: a.supply, region: 'Cutoff' };
  let Ib = (Vth - 0.7) / (Rb + (a.beta + 1) * Re),
    Ic = a.beta * Ib,
    Ve = (a.beta + 1) * Ib * Re,
    Vce = a.supply - Ic * Rc - Ve,
    region = 'Forward active';
  if (Vce < 0.2) {
    Ve = (Vth - 0.7 + (Rb * (a.supply - 0.2)) / Rc) / (1 + Rb / Re + Rb / Rc);
    Ic = (a.supply - Ve - 0.2) / Rc;
    Ib = (Vth - Ve - 0.7) / Rb;
    Vce = 0.2;
    region = 'Saturation';
  }
  return { base: Ib, collector: Ic, emitter: Ve, vce: Vce, region };
}
export const semiconductorModels = {
  pnjunction: make(
    {
      id: 'pnjunction',
      title: 'PN Junction I–V and Depletion Width',
      inputs: {
        bias: p('Applied terminal voltage', 'V', -5, 0.9, 0.7),
        temperature: p('Junction temperature', 'K', 250, 400, 300),
        saturation: p('Saturation current at 300 K', 'A', 1e-14, 1e-9, 1e-12),
        ideality: p('Ideality factor', '1', 1, 2, 1),
        resistance: p('External series resistance', 'Ω', 10, 1000, 100),
        acceptors: p('P-side acceptor density', 'cm⁻³', 1e14, 1e18, 1e16),
        donors: p('N-side donor density', 'cm⁻³', 1e14, 1e18, 1e16),
      },
      metrics: {
        current: ['Terminal diode current', 'mA'],
        junction: ['Junction voltage after series drop', 'V'],
        built: ['Built-in depletion potential', 'V'],
        depletion: ['Depletion width, if depletion approximation applies', 'µm'],
      },
      plot: { x: 'Terminal bias', xUnit: 'V', y: 'Diode current', yUnit: 'mA' },
      text: lesson(
        'Solve a diode plus external resistor implicitly and compare its junction voltage with an abrupt-junction depletion approximation.',
        'Is terminal voltage identical to junction voltage when series resistance carries current?',
        ['No, the resistor has an IR drop', 'Yes, always', 'Only reverse bias has a drop'],
        'The nonlinear current and resistor must satisfy the same series circuit.',
        'Equal 10¹⁶ cm⁻³ dopings at 300 K with ni=10¹⁰ cm⁻³ give Vbi≈0.7143 V.',
        'I=Is(T)[exp(Vj/nVT)−1]=(Va−Vj)/Rs; W=√[2εSi/q·(1/NA+1/ND)(Vbi−Vj)].',
        'Abrupt silicon junction, εr=11.7, fixed Eg=1.12 eV, ni(300 K)=10¹⁰ cm⁻³ and nondegenerate doping. Is(300 K) is an independent calibrated transport parameter, not computed from doping. No avalanche, high-level injection or capacitance dynamics. Width is null if forward bias invalidates depletion-only theory.',
      ),
    },
    (a) => {
      const r = diodeState(a);
      return result(
        { current: r.current * 1000, junction: r.junction, built: r.built, depletion: r.depletion },
        seq(-1, 0.9, 160).map((x) => ({ x, y: diodeState(a, x).current * 1000 })),
        'junction',
        { ...r, ...a },
        [['Temperature-adjusted Is A', r.Is]],
        r.depletion === null
          ? [
              'Forward junction voltage reaches/exceeds the built-in potential; depletion-only width is undefined.',
            ]
          : [],
      );
    },
  ),
  fermilevel: make(
    {
      id: 'fermilevel',
      title: 'Band Diagram and Fermi Level vs. Doping',
      inputs: {
        donors: p('Donor density ND', 'cm⁻³', 1e12, 1e18, 1e16),
        acceptors: p('Acceptor density NA', 'cm⁻³', 1e12, 1e18, 1e14),
        temperature: p('Temperature', 'K', 250, 400, 300),
      },
      metrics: {
        electrons: ['Electron density n', 'cm⁻³'],
        holes: ['Hole density p', 'cm⁻³'],
        fermi: ['Fermi level relative to intrinsic Ei', 'eV'],
        intrinsic: ['Intrinsic carrier density', 'cm⁻³'],
      },
      plot: {
        x: 'log₁₀ donor density',
        xUnit: '1',
        y: 'Energy relative to Ei',
        yUnit: 'eV',
        traces: {
          y: 'Ef',
          reference: 'Ec (midgap idealization)',
          third: 'Ev (midgap idealization)',
        },
      },
      text: lesson(
        'Use charge neutrality and mass action with compensated doping to place the equilibrium Fermi level in a silicon band diagram.',
        'At exactly compensated donors and acceptors, which carrier densities result?',
        ['n=p=ni', 'Both zero', 'n=ND and p=NA'],
        'Charge neutrality gives n−p=0 and np=ni².',
        'At 300 K with ND−NA≈10¹⁶ cm⁻³, Ef−Ei is approximately 0.357 eV.',
        'n−p=ND−NA; np=ni²; Ef−Ei=kBT ln(n/ni); majority density uses the stable positive quadratic root.',
        'Uniform equilibrium bulk silicon, fully ionized dopants and Maxwell–Boltzmann carrier statistics. Eg fixed at 1.12 eV and Ei placed at midgap as an explicit equal-density-of-states idealization. No spatial band bending, degeneracy, freeze-out or bandgap narrowing.',
      ),
    },
    (a) => {
      const ni = siliconNi(a.temperature),
        calc = (D) => {
          const net = D - a.acceptors,
            major = (Math.abs(net) + Math.hypot(net, 2 * ni)) / 2;
          return net >= 0 ? [major, (ni * ni) / major] : [(ni * ni) / major, major];
        },
        [n, h] = calc(a.donors),
        energy = (D) => KB * a.temperature * Math.log(calc(D)[0] / ni);
      return result(
        { electrons: n, holes: h, fermi: energy(a.donors), intrinsic: ni },
        seq(12, 18).map((x) => ({ x, y: energy(10 ** x), reference: 0.56, third: -0.56 })),
        'bands',
        { fermi: energy(a.donors), gap: 1.12, donors: a.donors, acceptors: a.acceptors },
        [
          ['Charge-neutrality residual cm⁻³', n - h - (a.donors - a.acceptors)],
          ['Mass-action ratio np/ni²', (n * h) / (ni * ni)],
        ],
      );
    },
  ),
  bjtbias: make(
    {
      id: 'bjtbias',
      title: 'BJT Common-Emitter Bias and Load Line',
      inputs: {
        supply: p('Collector supply VCC', 'V', 5, 20, 12),
        upper: p('Upper divider resistor', 'kΩ', 10, 300, 100),
        lower: p('Lower divider resistor', 'kΩ', 2, 100, 20),
        collector: p('Collector resistor', 'kΩ', 0.5, 10, 2),
        emitter: p('Emitter resistor', 'kΩ', 0.1, 3, 1),
        beta: p('Forward-active current gain β', '1', 30, 300, 100),
      },
      metrics: {
        current: ['Collector operating current', 'mA'],
        voltage: ['Collector–emitter voltage', 'V'],
        base: ['Base current', 'µA'],
        emitter: ['Emitter voltage', 'V'],
      },
      plot: {
        x: 'Collector–emitter voltage',
        xUnit: 'V',
        y: 'Active-region DC load line collector current',
        yUnit: 'mA',
      },
      text: lesson(
        'Load the bias divider with base current and solve cutoff, forward-active or saturated operation instead of blindly applying Ic=βIb.',
        'Does the unloaded divider voltage alone determine the base voltage?',
        [
          'No, base current loads the divider',
          'Yes, β never matters',
          'Only the collector resistor matters',
        ],
        'The divider has a finite Thevenin resistance.',
        '100 kΩ/20 kΩ from 12 V gives Vth=2 V and Rth≈16.667 kΩ before base loading.',
        'Ib=(Vth−VBE)/(Rth+(β+1)RE); VCE=VCC−IcRC−IeRE; saturation separately enforces VBE=0.7 V and VCE=0.2 V.',
        'Piecewise constant-junction model with VBE=0.7 V, saturation VCE=0.2 V and supplied active β. No Early effect, temperature drift or small-signal frequency behavior. The plotted active-region load line extrapolation is not a saturated-region transistor I–V model.',
      ),
    },
    (a) => {
      const r = transistorBias(a);
      return result(
        { current: r.collector * 1000, voltage: r.vce, base: r.base * 1e6, emitter: r.emitter },
        seq(0, a.supply).map((x) => ({
          x,
          y: (a.supply - x) / (a.collector + (1 + 1 / a.beta) * a.emitter),
        })),
        'bjt',
        { ...a, ...r },
        [
          ['Operating region', r.region],
          ['Base node voltage V', r.emitter + (r.region === 'Cutoff' ? 0 : 0.7)],
        ],
      );
    },
  ),
  mosfet: make(
    {
      id: 'mosfet',
      title: 'MOSFET Output and Transfer Characteristics',
      inputs: {
        mode: choice(
          'Characteristic',
          {
            output: 'Output: sweep VDS at selected VGS',
            transfer: 'Transfer: sweep VGS at selected VDS',
          },
          'output',
        ),
        gate: p('Selected gate–source voltage', 'V', 0, 5, 3),
        drain: p('Selected drain–source voltage', 'V', 0, 10, 4),
        threshold: p('Threshold voltage', 'V', 0.5, 3, 1),
        beta: p('β=μCoxW/L', 'mA/V²', 0.1, 10, 1),
        lambda: p('Channel-length modulation λ', 'V⁻¹', 0, 0.1, 0.02),
      },
      metrics: {
        current: ['Selected drain current', 'mA'],
        overdrive: ['Gate overdrive', 'V'],
        gm: ['Selected transconductance', 'mS'],
      },
      plot: { x: 'VDS or VGS, selected sweep', xUnit: 'V', y: 'Drain current', yUnit: 'mA' },
      text: lesson(
        'Inspect long-channel cutoff, triode and saturation regions with an explicitly defined β and a continuous modulation factor.',
        'At the ideal triode/saturation boundary, what relation holds?',
        ['VDS=VGS−VT', 'VDS=VT always', 'VGS=0'],
        'The channel reaches pinch-off when drain voltage equals gate overdrive.',
        'With β=1 mA/V², VGS=3 V, VT=1 V and λ=0, saturation current is 2 mA.',
        'Triode Id=β[(VGS−VT)VDS−VDS²/2]; saturation Id=β(VGS−VT)²/2; both multiplied here by (1+λVDS).',
        'Long-channel square-law NMOS with positive VDS, no body effect, subthreshold current, mobility reduction or velocity saturation. The same empirical modulation multiplier in both regions keeps the boundary continuous. This is not a foundry compact model.',
      ),
    },
    (a) => {
      const u = a.gate - a.threshold,
        gm = u <= 0 ? 0 : a.beta * Math.min(a.drain, u) * (1 + a.lambda * a.drain),
        f = (g, d) => mosCurrent(g, d, a.threshold, a.beta, a.lambda);
      return result(
        { current: f(a.gate, a.drain), overdrive: u, gm },
        seq(0, a.mode === 'output' ? 10 : 5).map((x) => ({
          x,
          y: a.mode === 'output' ? f(a.gate, x) : f(x, a.drain),
        })),
        'mosfet',
        { ...a, region: u <= 0 ? 'Cutoff' : a.drain < u ? 'Triode' : 'Saturation' },
        [['Operating region', u <= 0 ? 'Cutoff' : a.drain < u ? 'Triode' : 'Saturation']],
      );
    },
  ),
  cmosinverter: make(
    {
      id: 'cmosinverter',
      title: 'CMOS Inverter VTC and Noise Margins',
      inputs: {
        supply: p('Supply voltage VDD', 'V', 2.5, 5, 3.3),
        nthreshold: p('NMOS threshold', 'V', 0.4, 1.2, 0.7),
        pthreshold: p('PMOS |threshold|', 'V', 0.4, 1.2, 0.7),
        nbeta: p('NMOS β', 'mA/V²', 0.25, 4, 1),
        pbeta: p('PMOS β', 'mA/V²', 0.25, 4, 1),
        input: p('Selected input voltage', 'V', 0, 5, 1.65),
      },
      validateValues: domain('input', (a) =>
        requireValue(
          a.input <= a.supply && a.nthreshold + a.pthreshold < a.supply,
          'Require input ≤VDD and VTN+|VTP|<VDD.',
        ),
      ),
      metrics: {
        output: ['Selected output voltage', 'V'],
        switching: ['Unity-voltage switching point', 'V'],
        low: ['Low noise margin', 'V'],
        high: ['High noise margin', 'V'],
      },
      plot: {
        x: 'Input voltage',
        xUnit: 'V',
        y: 'Output voltage',
        yUnit: 'V',
        traces: { y: 'CMOS transfer', reference: 'Vin=Vout reference' },
      },
      text: lesson(
        'Balance complementary transistor currents numerically, then locate unity negative-slope points for static noise margins.',
        'A symmetric CMOS model places its switching point where?',
        ['Near VDD/2', 'At zero', 'At twice VDD'],
        'Interchanging matched NMOS/PMOS at half supply leaves the current balance unchanged.',
        'With matched β and thresholds at VDD=3.3 V, the unity-voltage point is 1.65 V.',
        'Idn(Vin,Vout)=Idp(VDD−Vin,VDD−Vout); VIL and VIH satisfy dVout/dVin=−1; NML=VIL−VOL, NMH=VOH−VIH.',
        'Static long-channel square-law complementary model, λ=0.02 V⁻¹ for a unique current-balanced transition, ideal rails VOL=0 and VOH=VDD. Derivative roots are numerical; undefined margins indicate no resolved unity-slope crossings. No dynamic power, capacitive delay, body effect or process-corner noise qualification.',
      ),
    },
    (a) => {
      const f = (v) => inverterOutput(a, v),
        h = a.supply * 1e-5,
        slope = (v) =>
          (f(Math.min(a.supply, v + h)) - f(Math.max(0, v - h))) /
          (Math.min(a.supply, v + h) - Math.max(0, v - h)),
        grid = seq(0, a.supply, 200),
        roots = [];
      for (let i = 1; i < grid.length; i++)
        if ((slope(grid[i - 1]) + 1) * (slope(grid[i]) + 1) < 0)
          roots.push(bisect((v) => slope(v) + 1, grid[i - 1], grid[i], 40));
      const switching = bisect((v) => f(v) - v, 0, a.supply);
      return result(
        {
          output: f(a.input),
          switching,
          low: roots.length >= 2 ? roots[0] : null,
          high: roots.length >= 2 ? a.supply - roots.at(-1) : null,
        },
        grid.map((x) => ({ x, y: f(x), reference: x })),
        'cmos',
        { input: a.input, output: f(a.input), supply: a.supply },
        [
          ['VIL V', roots[0] ?? 'Undefined'],
          ['VIH V', roots.at(-1) ?? 'Undefined'],
        ],
      );
    },
  ),
  differentialamp: make(
    {
      id: 'differentialamp',
      title: 'Differential Amplifier and CMRR',
      inputs: {
        tail: p('Tail current', 'mA', 0.2, 2, 1),
        collector: p('Each collector resistor', 'kΩ', 1, 10, 5),
        tailresistance: p('Tail-source small-signal resistance', 'kΩ', 10, 1000, 100),
        temperature: p('Device temperature', 'K', 270, 350, 300),
        input: p('Differential input Vb1−Vb2', 'mV', -100, 100, 10),
        supply: p('Collector supply', 'V', 5, 20, 12),
      },
      validateValues: domain('collector', (a) =>
        requireValue(
          a.tail * a.collector < a.supply - 1,
          'Maintain at least 1 V collector compliance even when all tail current steers into one branch.',
        ),
      ),
      metrics: {
        difference: ['Collector output Vc2−Vc1', 'V'],
        gain: ['Balanced differential-output gain', 'V/V'],
        cmrr: ['Single-ended CMRR estimate', 'dB'],
        first: ['Branch 1 collector current', 'mA'],
      },
      plot: {
        x: 'Differential input',
        xUnit: 'mV',
        y: 'Collector differential output',
        yUnit: 'V',
      },
      text: lesson(
        'Use the bipolar differential-pair tanh law and distinguish differential output gain from single-ended common-mode rejection.',
        'Can differential output keep growing linearly for a very large input?',
        [
          'No, the tail current steers to one side',
          'Yes, without bound',
          'Only negative inputs saturate',
        ],
        'The pair has a finite total collector current.',
        'Itail=1 mA at 300 K gives gm per transistor≈19.34 mS; with Rc=5 kΩ differential gain≈96.70 V/V.',
        'I1,2=Itail[1±tanh(vd/2VT)]/2; Vod=Rc Itail tanh(vd/2VT); Ad,se=gmRc/2; Acm,se≈Rc/(2Rtail+2/gm).',
        'Matched active BJTs, ideal DC tail current and supplied finite small-signal tail resistance, negligible base current and Early effect. Perfectly differential common-mode output cancels ideally; the finite displayed CMRR is explicitly single-ended. Compliance check is a simple collector headroom screen, not full common-mode range analysis.',
      ),
    },
    (a) => {
      const VT = KB * a.temperature,
        I = a.tail / 1000,
        R = a.collector * 1000,
        gm = I / (2 * VT),
        f = (v) => R * I * Math.tanh(v / 1000 / (2 * VT)),
        Ad = (gm * R) / 2,
        Ac = R / (2 * a.tailresistance * 1000 + 2 / gm);
      return result(
        {
          difference: f(a.input),
          gain: gm * R,
          cmrr: 20 * Math.log10(Ad / Ac),
          first: (a.tail / 2) * (1 + Math.tanh(a.input / 1000 / (2 * VT))),
        },
        seq(-100, 100).map((x) => ({ x, y: f(x) })),
        'differential',
        { tail: a.tail, input: a.input },
        [
          ['Single-ended gain magnitude V/V', Ad],
          ['Single-ended common-mode gain magnitude V/V', Ac],
        ],
      );
    },
  ),
  sallenkey: make(
    {
      id: 'sallenkey',
      title: 'Sallen–Key Active Low-Pass Filter',
      topic: 'Analog circuits',
      inputs: {
        r1: p('R1', 'kΩ', 1, 100, 10),
        r2: p('R2', 'kΩ', 1, 100, 10),
        c1: p('Feedback capacitor C1', 'nF', 1, 100, 10),
        c2: p('Grounded capacitor C2', 'nF', 1, 100, 10),
        gain: p('Non-inverting op-amp gain K', '1', 1, 2.8, 1.586),
        frequency: p('Inspection frequency', 'Hz', 10, 100000, 1000),
      },
      validateValues: domain('gain', (a) =>
        requireValue(
          a.c2 * (a.r1 + a.r2) + a.c1 * a.r1 * (1 - a.gain) > 0,
          'Damping denominator must be positive; reduce gain or adjust R/C ratios.',
        ),
      ),
      metrics: {
        cutoff: ['Undamped natural frequency f0', 'Hz'],
        quality: ['Quality factor Q', '1'],
        gain: ['Inspection magnitude', 'dB'],
        phase: ['Inspection phase', 'deg'],
      },
      plot: { x: 'log₁₀ frequency', xUnit: '1', y: 'Magnitude', yUnit: 'dB' },
      text: lesson(
        'Derive the pole frequency and damping of a clearly defined Sallen–Key topology and reject unstable ideal parameter choices.',
        'With equal R and C, what gain gives Butterworth Q≈1/√2?',
        ['K≈1.586', 'K=3', 'K=0'],
        'Q=1/(3−K) for equal components.',
        'R1=R2=10 kΩ and C1=C2=10 nF give f0≈1591.55 Hz.',
        'ω0=1/√(R1R2C1C2); Q=√(R1R2C1C2)/[C2(R1+R2)+C1R1(1−K)]; H=K/[1−r²+jr/Q].',
        'Ideal op-amp, no output loading. R1 from source to node A, R2 from A to op-amp + node B; C1 connects A to output, C2 connects B to ground. Positive damping enforced. f0 is not generally the −3 dB frequency; op-amp bandwidth, slew rate and tolerances excluded.',
      ),
    },
    (a) => {
      const r1 = a.r1 * 1000,
        r2 = a.r2 * 1000,
        c1 = a.c1 * 1e-9,
        c2 = a.c2 * 1e-9,
        w0 = 1 / Math.sqrt(r1 * r2 * c1 * c2),
        Q = Math.sqrt(r1 * r2 * c1 * c2) / (c2 * (r1 + r2) + c1 * r1 * (1 - a.gain)),
        f = (hz) => {
          const r = (2 * Math.PI * hz) / w0;
          return {
            mag: 20 * Math.log10(a.gain / Math.hypot(1 - r * r, r / Q)),
            phase: (-Math.atan2(r / Q, 1 - r * r) * 180) / Math.PI,
          };
        };
      return result(
        {
          cutoff: w0 / (2 * Math.PI),
          quality: Q,
          gain: f(a.frequency).mag,
          phase: f(a.frequency).phase,
        },
        seq(1, 6, 200).map((x) => ({ x, y: f(10 ** x).mag })),
        'filter',
        { r1: a.r1, r2: a.r2, c1: a.c1, c2: a.c2, gain: a.gain },
        [
          ['DC gain V/V', a.gain],
          ['DC magnitude dB', 20 * Math.log10(a.gain)],
        ],
      );
    },
  ),
  timer555: make(
    {
      id: 'timer555',
      title: '555 Timer: Astable and Monostable',
      topic: 'Analog circuits',
      inputs: {
        mode: choice(
          'Timing mode',
          { astable: 'Free-running astable', mono: 'Triggered monostable' },
          'astable',
        ),
        supply: p('Supply voltage', 'V', 5, 15, 5),
        ra: p('RA / monostable R', 'kΩ', 1, 100, 10),
        rb: p('Astable RB', 'kΩ', 1, 100, 20),
        capacitance: p('Timing capacitor', 'µF', 0.01, 100, 1),
      },
      metrics: {
        frequency: ['Astable frequency', 'Hz'],
        high: ['High pulse time', 's'],
        low: ['Astable low time', 's'],
        duty: ['Astable high duty fraction', '1'],
      },
      plot: {
        x: 'Time since steady-cycle start / trigger',
        xUnit: 's',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'Ideal output', reference: 'Timing capacitor' },
      },
      text: lesson(
        'Follow the timing capacitor between exact one-third/two-thirds supply thresholds in two classic timer connections.',
        'For a conventional astable with positive RA, is high duty below 50% possible without extra circuitry?',
        ['No', 'Yes, for any RB', 'Only at higher supply voltage'],
        'Charging includes RA+RB while discharging uses RB alone.',
        'RA=10 kΩ, RB=20 kΩ and C=1 µF give tH≈20.794 ms, tL≈13.863 ms and f≈28.854 Hz.',
        'Astable tH=ln2(RA+RB)C, tL=ln2 RB C; monostable tH=ln3 RC.',
        'Ideal threshold comparator/latch and zero discharge-switch resistance, output exactly at rails, no propagation delay/leakage. Astable waveform starts at the steady-cycle lower threshold; monostable starts with capacitor zero at trigger and resets it to zero after the pulse. Frequency/duty are undefined for one-shot mode.',
      ),
    },
    (a) => {
      const C = a.capacitance * 1e-6,
        RA = a.ra * 1000,
        RB = a.rb * 1000,
        high = a.mode === 'astable' ? Math.log(2) * (RA + RB) * C : Math.log(3) * RA * C,
        low = Math.log(2) * RB * C,
        period = high + low,
        end = a.mode === 'astable' ? 2 * period : 2 * high;
      return result(
        {
          frequency: a.mode === 'astable' ? 1 / period : null,
          high,
          low: a.mode === 'astable' ? low : null,
          duty: a.mode === 'astable' ? high / period : null,
        },
        seq(0, end, 400).map((x) => {
          if (a.mode === 'mono')
            return {
              x,
              y: x < high ? a.supply : 0,
              reference: x < high ? a.supply * (1 - Math.exp(-x / (RA * C))) : 0,
            };
          const t = x % period;
          return {
            x,
            y: t < high ? a.supply : 0,
            reference:
              t < high
                ? a.supply - ((2 * a.supply) / 3) * Math.exp(-t / ((RA + RB) * C))
                : ((2 * a.supply) / 3) * Math.exp(-(t - high) / (RB * C)),
          };
        }),
        'timer',
        { supply: a.supply, high, low, mode: a.mode },
        [
          ['Lower threshold V', a.supply / 3],
          ['Upper threshold V', (2 * a.supply) / 3],
        ],
      );
    },
  ),
  zener: make(
    {
      id: 'zener',
      title: 'Zener Regulator and Load Line',
      topic: 'Analog circuits',
      inputs: {
        supply: p('Source voltage', 'V', 3, 24, 12),
        series: p('Series resistor', 'Ω', 100, 2000, 470),
        load: p('Load resistance', 'Ω', 100, 10000, 1000),
        zener: p('Breakdown intercept voltage', 'V', 3, 12, 5.1),
        dynamic: p('Zener dynamic resistance', 'Ω', 1, 50, 10),
        knee: p('Minimum useful breakdown current', 'mA', 0.1, 5, 1),
      },
      metrics: {
        output: ['Regulated/load voltage', 'V'],
        current: ['Zener current', 'mA'],
        power: ['Zener dissipation', 'W'],
        load: ['Load current', 'mA'],
      },
      plot: { x: 'Source voltage', xUnit: 'V', y: 'Output voltage', yUnit: 'V' },
      text: lesson(
        'Intersect the source/load network with a piecewise off/breakdown zener model and flag insufficient knee current.',
        'Can a zener maintain its rated breakdown voltage at every load?',
        [
          'No, it needs available breakdown current',
          'Yes, it is an ideal voltage source',
          'Only if its power is zero',
        ],
        'A heavy load can consume the entire series current and remove regulation.',
        'With a nonconducting zener, output is simply Vs RL/(Rs+RL).',
        'Off: V=Vs RL/(Rs+RL). On: V=(Vs/Rs+Vz/rz)/(1/Rs+1/RL+1/rz); Iz=(V−Vz)/rz.',
        'Reverse-breakdown operation only, linearized intercept Vz and positive dynamic resistance. Knee current is a qualification flag, not an abrupt extra branch. No temperature coefficient, forward conduction, transient surge or automatic power-rating selection.',
      ),
    },
    (a) => {
      const f = (Vs) => {
          const off = (Vs * a.load) / (a.series + a.load);
          if (off <= a.zener) return { V: off, I: 0 };
          const V =
            (Vs / a.series + a.zener / a.dynamic) / (1 / a.series + 1 / a.load + 1 / a.dynamic);
          return { V, I: (V - a.zener) / a.dynamic };
        },
        r = f(a.supply);
      return result(
        { output: r.V, current: r.I * 1000, power: r.V * r.I, load: (r.V / a.load) * 1000 },
        seq(3, 24).map((x) => ({ x, y: f(x).V })),
        'zener',
        { ...a, output: r.V },
        [['Series current mA', ((a.supply - r.V) / a.series) * 1000]],
        r.I * 1000 < a.knee
          ? [
              'Zener current is below the supplied knee criterion; useful breakdown regulation is not established.',
            ]
          : [],
      );
    },
  ),
  schmitt: make(
    {
      id: 'schmitt',
      title: 'Schmitt Trigger Hysteresis',
      topic: 'Analog circuits',
      inputs: {
        high: p('Comparator high output rail', 'V', 3, 12, 5),
        low: p('Comparator low output rail', 'V', -5, 1, 0),
        reference: p('Reference voltage', 'V', 0, 5, 2.5),
        feedback: p('Output-to-plus feedback resistor', 'kΩ', 10, 100, 40),
        refresistor: p('Plus-to-reference resistor', 'kΩ', 1, 50, 10),
        amplitude: p('Input sine amplitude about reference', 'V', 0.1, 5, 2),
        frequency: p('Input frequency', 'Hz', 0.5, 20, 2),
        initial: choice('Initial latch state', { high: 'High output', low: 'Low output' }, 'high'),
      },
      validateValues: domain('reference', (a) =>
        requireValue(
          a.high > a.reference && a.reference > a.low,
          'Require low rail < reference < high rail.',
        ),
      ),
      metrics: {
        upper: ['Rising-input switching threshold', 'V'],
        lower: ['Falling-input switching threshold', 'V'],
        band: ['Hysteresis width', 'V'],
        switches: ['Switches during two input cycles', '1'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'Inverting input', reference: 'Latched output' },
      },
      text: lesson(
        'Carry the comparator’s state through a time-ordered input sequence, using separate rising and falling thresholds.',
        'If input remains between the two thresholds, what determines output?',
        ['Its previous state', 'Only the instantaneous input', 'A unique linear gain'],
        'Positive feedback creates memory inside the hysteresis band.',
        'With rails 0/5 V, reference 2.5 V and β=0.2, thresholds are 2 V and 3 V.',
        'β=Rref/(Rfeedback+Rref); VTH=βVOH+(1−β)Vref; VTL=βVOL+(1−β)Vref.',
        'Ideal inverting comparator, infinite input impedance and fixed output rails. Output state changes at sampled threshold crossings (400 intervals/two cycles); this is a stateful demonstration, not propagation-delay or op-amp slew simulation. Signals are assumed within a suitable comparator input common-mode range.',
      ),
    },
    (a) => {
      const beta = a.refresistor / (a.refresistor + a.feedback),
        upper = beta * a.high + (1 - beta) * a.reference,
        lower = beta * a.low + (1 - beta) * a.reference;
      let high = a.initial === 'high',
        switches = 0;
      const series = seq(0, 2 / a.frequency, 400).map((x) => {
        const input = a.reference + a.amplitude * Math.sin(2 * Math.PI * a.frequency * x),
          old = high;
        if (high && input >= upper) high = false;
        else if (!high && input <= lower) high = true;
        if (old !== high) switches++;
        return { x, y: input, reference: high ? a.high : a.low };
      });
      return result(
        { upper, lower, band: upper - lower, switches },
        series,
        'schmitt',
        { upper, lower, reference: a.reference },
        [
          ['Feedback fraction β', beta],
          ['Initial latch state', a.initial],
        ],
      );
    },
  ),
};

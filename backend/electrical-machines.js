import {
  engineering,
  p,
  integer,
  choice,
  seq,
  rad,
  lesson,
  domain,
  requireValue,
  result,
} from './engineering-kit.js';
import {
  C,
  sub,
  mul,
  div,
  abs,
  conj,
  polar,
  angle,
  transformer,
  induction,
  piLine,
  faultSequences,
} from './ac-engine.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'electrical', topic: 'Electrical machines', ...config }, solve);
const machineInputs = {
  voltage: p('Line voltage, star-connected', 'V', 200, 690, 400),
  frequency: p('Supply frequency', 'Hz', 40, 60, 50),
  poles: choice('Pole count', { 2: '2 poles', 4: '4 poles', 6: '6 poles', 8: '8 poles' }, '4'),
  r1: p('Stator resistance per phase', 'Ω', 0.1, 2, 0.5),
  x1: p('Stator leakage reactance', 'Ω', 0.2, 3, 0.8),
  xm: p('Magnetizing reactance', 'Ω', 10, 100, 30),
  r2: p('Referred rotor resistance', 'Ω', 0.1, 2, 0.3),
  x2: p('Referred rotor leakage reactance', 'Ω', 0.2, 3, 0.8),
  slip: p('Motoring slip', '1', 0.001, 1, 0.04),
};
export const relayCurve = (M, kind) =>
  M <= 1
    ? null
    : kind === 'standard'
      ? 0.14 / (M ** 0.02 - 1)
      : kind === 'very'
        ? 13.5 / (M - 1)
        : 80 / (M * M - 1);
export const electricalMachineModels = {
  transformer: make(
    {
      id: 'transformer',
      title: 'Transformer Equivalent Circuit and Regulation',
      inputs: {
        voltage: p('Primary RMS voltage', 'V', 100, 11000, 2300),
        ratio: p('Turns ratio N1/N2', '1', 1, 50, 10),
        rating: p('Nominal load apparent power', 'kVA', 1, 100, 20),
        factor: p('Load power factor magnitude', '1', 0.5, 1, 0.8),
        kind: choice('Load power factor', { lag: 'Lagging', lead: 'Leading' }, 'lag'),
        r1: p('Primary resistance', 'Ω', 0.01, 10, 1),
        x1: p('Primary leakage reactance', 'Ω', 0.01, 20, 2),
        r2: p('Referred secondary resistance', 'Ω', 0.01, 10, 1),
        x2: p('Referred secondary reactance', 'Ω', 0.01, 20, 2),
        core: p('Core-loss resistance Rc', 'Ω', 1000, 100000, 20000),
        magnetizing: p('Magnetizing reactance Xm', 'Ω', 500, 50000, 5000),
      },
      metrics: {
        secondary: ['Loaded secondary RMS voltage', 'V'],
        regulation: ['Voltage regulation', '%'],
        efficiency: ['Loaded efficiency', '1'],
        current: ['Primary RMS current', 'A'],
      },
      plot: {
        x: 'Nominal load multiplier',
        xUnit: '1',
        y: 'Secondary RMS voltage',
        yUnit: 'V',
        traces: { y: 'Loaded output', reference: 'No-load output' },
      },
      text: lesson(
        'Solve the complete referred T-equivalent circuit with the shunt branch at the internal induced-voltage node.',
        'Can a leading load produce negative voltage regulation?',
        ['Yes', 'No, regulation is always a loss percentage', 'Only if winding resistance is zero'],
        'The capacitive reactive drop can raise the loaded voltage above the no-load reference.',
        'An ideal 10:1 transformer supplied at 2300 V produces 230 V unloaded.',
        'E=V1/[1+Z1(Ym+1/(Z2′+ZL′))]; I2′=E/(Z2′+ZL′); V2=I2′ZL′/a; η=Pout/(Pout+Pcore+Pcu).',
        'Single-phase sinusoidal steady-state linear equivalent circuit; all impedances except the ideal turns ratio are primary-referred. Load is a constant impedance calibrated from nominal V1²/S, not a constant-power load. No saturation, harmonics or thermal rating calculation.',
      ),
    },
    (a) => {
      const r = transformer(a);
      return result(
        {
          secondary: r.secondary,
          regulation: r.regulation,
          efficiency: r.efficiency,
          current: r.current,
        },
        seq(0.01, 1.5).map((x) => ({ x, y: transformer(a, x).secondary, reference: r.noload })),
        'transformer',
        { ratio: a.ratio, voltage: a.voltage, secondary: r.secondary },
        [
          ['Output power W', r.output],
          ['Core loss W', r.core],
          ['Copper loss W', r.copper],
          ['Internal voltage angle deg', angle(r.E)],
        ],
      );
    },
  ),
  transformertests: make(
    {
      id: 'transformertests',
      title: 'Transformer Open- and Short-Circuit Tests',
      inputs: {
        ocvoltage: p('Open-circuit voltage', 'V', 100, 11000, 2300),
        occurrent: p('Open-circuit current', 'A', 0.1, 10, 0.5),
        ocpower: p('Open-circuit real power', 'W', 10, 2000, 300),
        scvoltage: p('Short-circuit voltage', 'V', 10, 1000, 120),
        sccurrent: p('Short-circuit current', 'A', 1, 100, 8.7),
        scpower: p('Short-circuit real power', 'W', 10, 5000, 500),
      },
      validateValues: domain('ocpower', (a) =>
        requireValue(
          a.ocpower < a.ocvoltage * a.occurrent && a.scpower < a.scvoltage * a.sccurrent,
          'Each measured real power must be strictly less than its measured V·I apparent power.',
        ),
      ),
      metrics: {
        core: ['Core-loss resistance Rc', 'Ω'],
        magnetizing: ['Magnetizing reactance Xm', 'Ω'],
        resistance: ['Equivalent series resistance', 'Ω'],
        reactance: ['Equivalent leakage reactance', 'Ω'],
      },
      plot: {
        x: 'Equivalent circuit branch',
        xUnit: '1',
        y: 'Resistance / reactance magnitude',
        yUnit: 'Ω',
      },
      text: lesson(
        'Infer approximate shunt and series equivalent parameters from physically valid RMS test measurements.',
        'Which test primarily estimates copper resistance and leakage reactance?',
        ['Short-circuit test', 'Open-circuit test', 'Neither contains phase information'],
        'The small SC voltage makes excitation losses comparatively small.',
        'Voc=2300 V, Ioc=0.5 A and Poc=300 W give Rc≈17633 Ω and Xm≈4765 Ω.',
        'Ic=Poc/Voc; Im=√(Ioc²−Ic²); Rc=Voc²/Poc; Xm=Voc/Im; Req=Psc/Isc²; Xeq=√[(Vsc/Isc)²−Req²].',
        'Both tests must already be referred to the same winding side. Open-circuit copper loss and short-circuit core loss are neglected; no automatic turns-ratio conversion or winding-resistance split. RMS sinusoidal single-phase or consistently per-phase values only.',
      ),
    },
    (a) => {
      const core = a.ocvoltage ** 2 / a.ocpower,
        magnetizing = a.ocvoltage / Math.sqrt(a.occurrent ** 2 - (a.ocpower / a.ocvoltage) ** 2),
        resistance = a.scpower / a.sccurrent ** 2,
        reactance = Math.sqrt((a.scvoltage / a.sccurrent) ** 2 - resistance ** 2);
      return result(
        { core, magnetizing, resistance, reactance },
        [core, magnetizing, resistance, reactance].map((y, x) => ({ x, y })),
        'transformer',
        { test: true },
        [
          ['OC power factor', a.ocpower / (a.ocvoltage * a.occurrent)],
          ['SC power factor', a.scpower / (a.scvoltage * a.sccurrent)],
        ],
      );
    },
  ),
  dcmotor: make(
    {
      id: 'dcmotor',
      title: 'DC Motor Torque–Speed and Efficiency',
      inputs: {
        voltage: p('Armature terminal voltage', 'V', 24, 240, 120),
        resistance: p('Armature resistance', 'Ω', 0.1, 5, 1),
        constant: p('SI motor constant k', 'N·m/A', 0.2, 2, 1),
        idle: p('Equivalent no-load current', 'A', 0.1, 5, 1),
        torque: p('Shaft load torque', 'N·m', 0, 50, 10),
      },
      validateValues: domain('torque', (a) =>
        requireValue(
          a.torque / a.constant + a.idle < a.voltage / a.resistance,
          'Selected torque requires current at or beyond stall; reduce torque/resistance or increase voltage.',
        ),
      ),
      metrics: {
        speed: ['Steady speed', 'rpm'],
        current: ['Armature current', 'A'],
        efficiency: ['Shaft efficiency', '1'],
        power: ['Shaft mechanical power', 'W'],
      },
      plot: { x: 'Speed', xUnit: 'rpm', y: 'Available shaft torque', yUnit: 'N·m' },
      text: lesson(
        'Balance back-EMF, copper loss and a constant equivalent rotational-loss torque for a fixed-flux DC motor.',
        'At fixed voltage, increasing load torque changes speed how?',
        ['Reduces it', 'Always increases it', 'Has no effect with nonzero resistance'],
        'Extra armature current raises the resistive drop and reduces back-EMF.',
        'V=120 V, R=1 Ω, k=1 and I0=1 A with 10 N·m load give I=11 A and ω=109 rad/s.',
        'V=IR+kω; Tshaft=k(I−I0); Pcu=I²R; Prot=kI0ω; η=Tshaftω/(VI).',
        'Fixed field/flux, common SI torque and back-EMF constant, linear armature resistance and constant no-load loss torque. Field supply losses, brush voltage drop, commutation limits, saturation and thermal transients are excluded.',
      ),
    },
    (a) => {
      const I = a.torque / a.constant + a.idle,
        w = (a.voltage - I * a.resistance) / a.constant,
        power = a.torque * w,
        wn = (a.voltage - a.idle * a.resistance) / a.constant;
      return result(
        { speed: (w * 60) / (2 * Math.PI), current: I, efficiency: power / (a.voltage * I), power },
        seq(0, wn).map((x) => ({
          x: (x * 60) / (2 * Math.PI),
          y: a.constant * ((a.voltage - a.constant * x) / a.resistance - a.idle),
        })),
        'motor',
        { speed: w, torque: a.torque },
        [
          ['Copper loss W', I * I * a.resistance],
          ['Rotational loss W', a.constant * a.idle * w],
          ['Input power W', a.voltage * I],
        ],
      );
    },
  ),
  inductionmotor: make(
    {
      id: 'inductionmotor',
      title: 'Induction Motor Torque–Slip Curve',
      inputs: machineInputs,
      metrics: {
        torque: ['Electromagnetic torque', 'N·m'],
        speed: ['Rotor speed', 'rpm'],
        power: ['Converted mechanical power', 'W'],
        efficiency: ['Converted power / input (before mechanical loss)', '1'],
      },
      plot: { x: 'Motoring slip', xUnit: '1', y: 'Electromagnetic torque', yUnit: 'N·m' },
      text: lesson(
        'Form the exact per-phase Thevenin source seen by the referred rotor and recover air-gap and copper power.',
        'Doubling stator voltage with the same impedances changes torque how?',
        ['Multiplies it by four', 'Doubles it', 'Leaves it unchanged'],
        'Rotor current scales with voltage and torque scales with its square.',
        'At s=1, converted mechanical power is zero even though starting electromagnetic torque is finite.',
        'Vth=Vφ jXm/(Z1+jXm); Zth=Z1∥jXm; T=3|Vth|²(R2′/s)/[ωs|Zth+R2′/s+jX2′|²].',
        'Balanced star-connected three-phase motoring, fixed frequency and linear parameters. Magnetizing branch is lossless; rotor/stator copper included, but core/mechanical/stray losses excluded from the displayed conversion efficiency. Positive slip only; no generating or startup dynamics.',
      ),
    },
    (a) => {
      const v = { ...a, poles: Number(a.poles) },
        r = induction(v);
      return result(
        {
          torque: r.torque,
          speed: r.speed,
          power: r.mechanical,
          efficiency: r.mechanical / r.input,
        },
        seq(0.001, 1, 240).map((x) => ({ x, y: induction(v, x).torque })),
        'motor',
        { slip: a.slip, speed: r.speed },
        [
          ['Air-gap power W', r.gap],
          ['Rotor copper loss W', r.rotorloss],
          ['Stator copper loss W', r.statorloss],
          ['Input real power W', r.input],
        ],
      );
    },
  ),
  synchronous: make(
    {
      id: 'synchronous',
      title: 'Synchronous Generator Phasor and Power Angle',
      inputs: {
        voltage: p('Terminal phase RMS voltage', 'V', 100, 15000, 230),
        excitation: p('Internal phase RMS EMF', 'V', 100, 18000, 280),
        reactance: p('Synchronous reactance per phase', 'Ω', 0.1, 30, 2),
        delta: p('Internal EMF lead angle δ', 'deg', 0, 89, 25),
      },
      metrics: {
        real: ['Three-phase active export', 'kW'],
        reactive: ['Three-phase reactive export', 'kvar'],
        current: ['Phase RMS current', 'A'],
        maximum: ['Ideal steady power-angle maximum', 'kW'],
      },
      plot: { x: 'Power angle δ', xUnit: 'deg', y: 'Three-phase active export', yUnit: 'kW' },
      text: lesson(
        'Construct generator phasors from E=V+jXsI and relate rotor load angle to three-phase power transfer.',
        'At which angle is the ideal cylindrical-rotor power-angle maximum?',
        ['90°', '0°', '180°'],
        'dP/dδ is proportional to cosδ.',
        'Vφ=230 V, Eφ=280 V and Xs=2 Ω give Pmax=96.6 kW.',
        'I=(E∠δ−V)/(jXs); P=3VE sinδ/Xs; Q=3(VE cosδ−V²)/Xs.',
        'Balanced cylindrical rotor, negligible armature resistance, fixed infinite-bus terminal voltage, no saliency or saturation. δ<90° selected on the stable rising branch; the maximum is an ideal static limit, not a transient stability assessment.',
      ),
    },
    (a) => {
      const E = polar(a.excitation, rad(a.delta)),
        I = div(sub(E, C(a.voltage)), C(0, a.reactance)),
        S = mul(C(3 * a.voltage), conj(I)),
        maximum = (3 * a.voltage * a.excitation) / a.reactance / 1000;
      return result(
        { real: S.re / 1000, reactive: S.im / 1000, current: abs(I), maximum },
        seq(0, 180).map((x) => ({ x, y: maximum * Math.sin(rad(x)) })),
        'phasor',
        { phasors: [C(a.voltage), E, mul(C(0, a.reactance), I)], labels: ['V', 'E', 'jXs I'] },
        [
          ['Current phase angle deg', angle(I)],
          [
            'Generator power factor',
            abs(I) ? S.re / (3 * a.voltage * abs(I)) : 'Undefined at zero current',
          ],
        ],
      );
    },
  ),
  commutation: make(
    {
      id: 'commutation',
      title: 'BLDC and Stepper Commutation Waveforms',
      inputs: {
        mode: choice(
          'Commutation',
          {
            bldc: 'BLDC six-step 120° conduction',
            full: 'Stepper two-phase-on full step',
            half: 'Stepper eight-state half step',
          },
          'bldc',
        ),
        current: p('Phase current magnitude', 'A', 0.1, 10, 2),
        speed: p('BLDC mechanical speed', 'rpm', 100, 3000, 600),
        pairs: integer('BLDC pole pairs', 1, 8, 4),
      },
      metrics: {
        frequency: ['BLDC electrical frequency', 'Hz'],
        states: ['Commutation states', '1'],
        rms: ['Phase-A RMS current', 'A'],
      },
      plot: {
        x: 'Electrical angle / command state',
        xUnit: '1',
        y: 'Phase current',
        yUnit: 'A',
        traces: { y: 'Phase A', reference: 'Phase B', third: 'Phase C (BLDC only)' },
        step: true,
      },
      text: lesson(
        'Inspect deterministic switching sequences and phase currents for two distinct actuator types.',
        'Does a half-step sequence with unchanged phase current have constant vector magnitude?',
        [
          'No, one- and two-phase states differ',
          'Yes, by definition',
          'Only when phase current is zero',
        ],
        'The vector alternates between I and √2I unless current amplitudes are compensated.',
        'A 600 rpm BLDC motor with four pole pairs has electrical frequency 40 Hz.',
        'fe=p·rpm/60; six-step phases conduct ±I for 120° with 60° off intervals; stepper torque-vector angle=atan2(Ib,Ia).',
        'Ideal commanded phase currents, no PWM/current-regulator, inductance, back-EMF voltage dynamics or mechanical motion solve. Stepper angle is an electrical stator-vector command, not guaranteed rotor position. Full-step sequence uses two phases on; half step is not normalized microstepping.',
      ),
    },
    (a) => {
      const wrap = (x) => ((x % 360) + 360) % 360,
        I = (t) => {
          t = wrap(t);
          return t >= 30 && t < 150 ? a.current : t >= 210 && t < 330 ? -a.current : 0;
        },
        full = [
          [1, 1],
          [-1, 1],
          [-1, -1],
          [1, -1],
        ],
        half = [
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1],
          [0, -1],
          [1, -1],
        ],
        states = a.mode === 'bldc' ? 6 : a.mode === 'full' ? 4 : 8,
        series =
          a.mode === 'bldc'
            ? seq(0, 360, 240).map((x) => ({
                x,
                y: I(x),
                reference: I(x - 120),
                third: I(x + 120),
              }))
            : (a.mode === 'full' ? full : half).map(([x, y], i) => ({
                x: i,
                y: x * a.current,
                reference: y * a.current,
                third: 0,
              }));
      return result(
        {
          frequency: (a.pairs * a.speed) / 60,
          states,
          rms:
            a.mode === 'bldc'
              ? a.current * Math.sqrt(2 / 3)
              : a.mode === 'full'
                ? a.current
                : a.current * Math.sqrt(6 / 8),
        },
        series,
        'commutation',
        { mode: a.mode, current: a.current },
        [
          ['BLDC conduction angle per sign deg', 120],
          [
            'Stepper sequence',
            a.mode === 'bldc' ? 'Not selected' : JSON.stringify(a.mode === 'full' ? full : half),
          ],
        ],
      );
    },
  ),
  perunit: make(
    {
      id: 'perunit',
      title: 'Per-Unit System and Three-Phase Fault Level',
      topic: 'Power systems',
      inputs: {
        base: p('System base', 'MVA', 10, 100, 50),
        voltage: p('Bus voltage base', 'kV', 11, 400, 33),
        source: p('Source positive-sequence reactance on system base', 'pu', 0.02, 0.5, 0.1),
        transformer: p('Transformer reactance on own base', 'pu', 0.03, 0.3, 0.08),
        rating: p('Transformer own power base', 'MVA', 10, 100, 25),
        ratedvoltage: p('Transformer winding voltage base', 'kV', 11, 400, 33),
        line: p('Line reactance', 'Ω', 0, 30, 2),
      },
      metrics: {
        impedance: ['System impedance base', 'Ω'],
        reactance: ['Total positive-sequence reactance', 'pu'],
        fault: ['Bolted three-phase current', 'kA'],
        level: ['Fault apparent power', 'MVA'],
      },
      plot: { x: 'Line reactance', xUnit: 'Ω', y: 'Three-phase fault level', yUnit: 'MVA' },
      text: lesson(
        'Convert transformer and line reactances to one consistent three-phase base before calculating a bolted fault.',
        'Doubling MVA base with physical impedances unchanged changes physical fault current?',
        [
          'No, if every pu conversion is consistent',
          'Yes, it always doubles',
          'Yes, it always halves',
        ],
        'Per-unit scaling changes numerical representation, not the network.',
        'On 50 MVA and 33 kV bases, Zbase=21.78 Ω and Ibase≈0.874773 kA.',
        'Zb=VLL,b²/S3φ,b; Xt,new=Xt,old(Snew/Sold)(Vold/Vnew)²; If,pu=1/Xtotal; Sfault=Sbase/Xtotal.',
        'Balanced bolted three-phase fault, 1 pu prefault Thevenin voltage, series reactances and negligible resistance. Source reactance is already on the selected system base. No motor contributions, dc offset, grounding or breaker interrupting-duty standard.',
      ),
    },
    (a) => {
      const Z = (a.voltage * a.voltage) / a.base,
        xt = ((a.transformer * a.base) / a.rating) * (a.ratedvoltage / a.voltage) ** 2,
        X = a.source + xt + a.line / Z,
        Ib = a.base / (Math.sqrt(3) * a.voltage);
      return result(
        { impedance: Z, reactance: X, fault: Ib / X, level: a.base / X },
        seq(0, 30).map((x) => ({ x, y: a.base / (a.source + xt + x / Z) })),
        'impedance',
        { parts: [a.source, xt, a.line / Z] },
        [
          ['Converted transformer X pu', xt],
          ['System current base kA', Ib],
        ],
      );
    },
  ),
  transmissionpi: make(
    {
      id: 'transmissionpi',
      title: 'Transmission Line π-Model and Ferranti Effect',
      topic: 'Power systems',
      inputs: {
        length: p('Line length', 'km', 20, 300, 200),
        voltage: p('Nominal line-to-line RMS voltage', 'kV', 66, 400, 220),
        resistance: p('Series resistance per phase per km', 'Ω/km', 0.01, 0.2, 0.05),
        reactance: p('Series reactance per phase per km', 'Ω/km', 0.1, 0.5, 0.3),
        susceptance: p('Total shunt susceptance per phase per km', 'µS/km', 1, 6, 4),
        real: p('Receiving active power', 'MW', 0, 300, 100),
        reactive: p('Receiving reactive power', 'Mvar', -100, 200, 30),
      },
      metrics: {
        sending: ['Required sending voltage under specified load', 'kV'],
        noload: ['No-load receiving voltage at nominal sending voltage', 'kV'],
        ferranti: ['No-load voltage rise', '%'],
        loss: ['Loaded series copper loss', 'MW'],
      },
      plot: {
        x: 'Line length',
        xUnit: 'km',
        y: 'Line-to-line RMS voltage',
        yUnit: 'kV',
        traces: {
          y: 'No-load receiving, fixed sending',
          reference: 'Loaded sending, fixed receiving',
        },
      },
      text: lesson(
        'Use complex nominal-π ABCD parameters for two clearly separated loaded and open-circuit operating conditions.',
        'Why can the receiving voltage rise at no load?',
        [
          'Charging current interacts with line inductance',
          'Copper losses create energy',
          'The open circuit consumes real load power',
        ],
        'The shunt-capacitance/series-inductance network can make |A|<1, so |Vr|=|Vs/A| exceeds |Vs|.',
        'With zero shunt susceptance and no load, receiving and sending voltage magnitudes are equal.',
        'A=D=1+YZ/2; B=Z; C=Y(1+YZ/4); Vs=AVr+BIr; Is=CVr+DIr.',
        'Balanced nominal-π medium-line approximation; B input is total line shunt susceptance per phase, split equally at ends. Loaded case fixes receiving voltage at nominal and computes sending requirement; no-load case fixes sending voltage at nominal. These are different operating conditions, not an iterative constant-power load-flow solve.',
      ),
    },
    (a) => {
      const r = piLine(a);
      return result(
        { sending: r.sending, noload: r.noload, ferranti: r.ferranti, loss: r.loss },
        seq(20, 300).map((x) => {
          const v = piLine(a, x);
          return { x, y: v.noload, reference: v.sending };
        }),
        'transmission',
        { length: a.length },
        [
          ['Loaded sending real power MW', r.input],
          ['Real power balance residual MW', r.input - a.real - r.loss],
          ['ABCD determinant real', sub(mul(r.A, r.D), mul(r.B, r.C)).re],
        ],
      );
    },
  ),
  powerfactor: make(
    {
      id: 'powerfactor',
      title: 'Power Factor Correction and Capacitor Sizing',
      topic: 'Power systems',
      inputs: {
        power: p('Three-phase active load', 'kW', 10, 1000, 100),
        initial: p('Initial lagging power factor', '1', 0.5, 0.99, 0.7),
        target: p('Target lagging power factor', '1', 0.6, 1, 0.95),
        voltage: p('Line-to-line RMS voltage', 'V', 200, 11000, 400),
        frequency: p('Frequency', 'Hz', 50, 60, 50),
        connection: choice('Capacitor bank connection', { delta: 'Delta', star: 'Star' }, 'delta'),
      },
      validateValues: domain('target', (a) =>
        requireValue(
          a.target >= a.initial,
          'Target must be at least the initial lagging power factor.',
        ),
      ),
      metrics: {
        reactive: ['Capacitor-bank reactive rating', 'kvar'],
        capacitance: ['Capacitance per phase', 'µF'],
        before: ['Original line current', 'A'],
        after: ['Corrected line current', 'A'],
      },
      plot: {
        x: 'Target power factor',
        xUnit: '1',
        y: 'Required bank reactive rating',
        yUnit: 'kvar',
      },
      text: lesson(
        'Size a balanced shunt capacitor bank from reactive-power balance, distinguishing delta and star phase voltages.',
        'For the same kvar and line voltage, star phase capacitance is how large relative to delta?',
        ['Three times', 'One third', 'The same'],
        'Each star branch sees VLL/√3, so capacitance must triple.',
        '100 kW corrected from PF 0.7 to 0.95 needs about 69.15 kvar.',
        'Qc=P[tan acos(PFi)−tan acos(PFt)]; Cφ=Qc/[3ωVφ²]; Iline=P/(√3VLL PF).',
        'Balanced sinusoidal constant-kW lagging load, ideal lossless capacitors, fixed voltage and frequency. No leading correction, harmonics/resonance, switching transients, discharge resistance or capacitor voltage-rating selection.',
      ),
    },
    (a) => {
      const Q = (pf) => a.power * (Math.tan(Math.acos(a.initial)) - Math.tan(Math.acos(pf))),
        reactive = Q(a.target),
        V = a.connection === 'delta' ? a.voltage : a.voltage / Math.sqrt(3);
      return result(
        {
          reactive,
          capacitance: ((reactive * 1000) / (3 * 2 * Math.PI * a.frequency * V * V)) * 1e6,
          before: (a.power * 1000) / (Math.sqrt(3) * a.voltage * a.initial),
          after: (a.power * 1000) / (Math.sqrt(3) * a.voltage * a.target),
        },
        seq(a.initial, 1).map((x) => ({ x, y: Q(x) })),
        'power-triangle',
        {
          real: a.power,
          before: a.power * Math.tan(Math.acos(a.initial)),
          after: a.power * Math.tan(Math.acos(a.target)),
        },
        [['Capacitor branch voltage V', V]],
      );
    },
  ),
  twobus: make(
    {
      id: 'twobus',
      title: 'Two-Bus Power Transfer and P–V Curve',
      topic: 'Power systems',
      inputs: {
        source: p('Infinite-bus voltage', 'pu', 0.95, 1.1, 1),
        reactance: p('Line reactance', 'pu', 0.1, 1, 0.3),
        factor: p('Constant load power factor', '1', 0.7, 1, 0.95),
        kind: choice('Load vars', { lag: 'Lagging Q>0', lead: 'Leading Q<0' }, 'lag'),
        power: p('Selected constant-power demand', 'pu', 0, 3, 0.8),
      },
      metrics: {
        upper: ['High-voltage solution', 'pu'],
        lower: ['Low-voltage solution', 'pu'],
        maximum: ['Static saddle-node load limit', 'pu'],
        angle: ['Receiving voltage lag angle', 'deg'],
      },
      plot: {
        x: 'Active load demand',
        xUnit: 'pu',
        y: 'Receiving-bus voltage',
        yUnit: 'pu',
        traces: { y: 'High-voltage branch', reference: 'Low-voltage branch' },
      },
      text: lesson(
        'Solve the exact lossless two-bus constant-power quadratic and expose both P–V branches and their fold.',
        'What happens to the two solutions at the static loadability limit?',
        ['They merge', 'They swap source voltage', 'One becomes infinite'],
        'The quadratic discriminant vanishes at the fold.',
        'For unity PF, E=1 pu and X=0.3 pu, Pmax=1/(2X)=1.66667 pu.',
        'z=V²; z²+(2XQ−E²)z+X²(P²+Q²)=0; Q=P tanφ; Pmax=E²(√(1+tan²φ)−tanφ)/(2X).',
        'Single lossless series reactance, fixed infinite-bus voltage, constant power-factor load and no shunt support. Null voltages indicate no positive real steady solution. The lower branch is mathematical; no dynamic load model or complete voltage-stability/security assessment is implied.',
      ),
    },
    (a) => {
      const t = Math.tan(Math.acos(a.factor)) * (a.kind === 'lag' ? 1 : -1),
        E = a.source,
        X = a.reactance,
        maximum = (E * E * (Math.sqrt(1 + t * t) - t)) / (2 * X),
        f = (P) => {
          const Q = P * t,
            d = E ** 4 - 4 * E * E * X * Q - 4 * X * X * P * P;
          if (d < -1e-10) return [null, null, null];
          const high = (E * E - 2 * X * Q + Math.sqrt(Math.max(0, d))) / 2,
            low = (E * E - 2 * X * Q - Math.sqrt(Math.max(0, d))) / 2;
          return [
            Math.sqrt(Math.max(0, high)),
            Math.sqrt(Math.max(0, low)),
            (Math.atan2(X * P, high + X * Q) * 180) / Math.PI,
          ];
        },
        r = f(a.power);
      return result(
        { upper: r[0], lower: r[1], maximum, angle: r[2] },
        seq(0, maximum, 160).map((x) => {
          const v = f(x);
          return { x, y: v[0], reference: v[1] };
        }),
        'pv-collapse',
        { power: a.power, maximum },
        [['Selected reactive demand pu', a.power * t]],
        a.power > maximum
          ? ['No real steady receiving-bus voltage exists at this load in the ideal two-bus model.']
          : [],
      );
    },
  ),
  symmetrical: make(
    {
      id: 'symmetrical',
      title: 'Symmetrical Components and Unbalanced Faults',
      topic: 'Power systems',
      inputs: {
        type: choice(
          'Fault at bus',
          {
            ground: 'A-to-ground',
            line: 'B-to-C through fault impedance',
            double: 'B/C connected together to ground',
            three: 'Balanced three-phase',
          },
          'ground',
        ),
        positive: p('Positive sequence reactance', 'pu', 0.05, 1, 0.2),
        negative: p('Negative sequence reactance', 'pu', 0.05, 1, 0.2),
        zero: p('Zero sequence reactance', 'pu', 0.05, 2, 0.5),
        fault: p('Fault reactance', 'pu', 0, 0.5, 0),
      },
      metrics: {
        a: ['Phase-A fault current magnitude', 'pu'],
        b: ['Phase-B fault current magnitude', 'pu'],
        c: ['Phase-C fault current magnitude', 'pu'],
        neutral: ['Neutral/residual current magnitude', 'pu'],
      },
      plot: {
        x: 'Electrical phase angle',
        xUnit: 'deg',
        y: 'Instantaneous current, RMS-normalized',
        yUnit: 'pu',
        traces: { y: 'Phase A', reference: 'Phase B', third: 'Phase C' },
      },
      text: lesson(
        'Interconnect positive-, negative- and zero-sequence networks for four fault types and transform the currents back to phases.',
        'Which sequence is absent from an ideal line-to-line fault without ground?',
        ['Zero sequence', 'Negative sequence', 'Positive sequence'],
        'Ia+Ib+Ic=0 excludes ground-return current.',
        'With X1=X2=0.2, X0=0.5 and bolted A-ground fault, Ia=3/(0.2+0.2+0.5)=3.3333 pu.',
        'Ia=I0+I1+I2; Ib=I0+a²I1+aI2; Ic=I0+aI1+a²I2; a=e^(j120°). SLG: I1=I2=I0=E/(Z1+Z2+Z0+3Zf).',
        'Prefault positive-sequence source 1 pu, no prefault load current, pure sequence/fault reactances and RMS phasors. DLG fault impedance is the common connection to ground; LL impedance lies between the two phases. No dc offset, arc resistance, grounding topology derivation or protection setting recommendation.',
      ),
    },
    (a) => {
      const r = faultSequences(a);
      return {
        ...result(
          {
            a: abs(r.phases[0]),
            b: abs(r.phases[1]),
            c: abs(r.phases[2]),
            neutral: 3 * abs(r.sequences[0]),
          },
          seq(0, 360, 240).map((x) => ({
            x,
            y: Math.SQRT2 * mul(r.phases[0], polar(1, rad(x))).re,
            reference: Math.SQRT2 * mul(r.phases[1], polar(1, rad(x))).re,
            third: Math.SQRT2 * mul(r.phases[2], polar(1, rad(x))).re,
          })),
          'phasor',
          { phasors: r.phases, labels: ['Ia', 'Ib', 'Ic'] },
          r.sequences.map((v, i) => [
            `I${i}: magnitude / phase deg`,
            `${abs(v).toFixed(6)} / ${angle(v).toFixed(3)}`,
          ]),
        ),
        sequenceCurrents: r.sequences,
        phaseCurrents: r.phases,
        phaseVoltages: r.voltages,
      };
    },
  ),
  relaycoordination: make(
    {
      id: 'relaycoordination',
      title: 'Inverse-Time Overcurrent Relay Coordination',
      topic: 'Power systems',
      inputs: {
        kind: choice(
          'IEC curve',
          { standard: 'Standard inverse', very: 'Very inverse', extreme: 'Extremely inverse' },
          'standard',
        ),
        primary: p('Primary pickup, referred primary amperes', 'A', 100, 1000, 400),
        backup: p('Backup pickup, referred primary amperes', 'A', 200, 1500, 600),
        primarytime: p('Primary time multiplier', '1', 0.05, 0.5, 0.1),
        backuptime: p('Backup time multiplier', '1', 0.1, 1, 0.3),
        fault: p('Fault current at both relays', 'A', 200, 20000, 4000),
        interval: p('Required grading interval', 's', 0.1, 0.6, 0.3),
      },
      metrics: {
        primary: ['Primary relay operating time', 's'],
        backup: ['Backup relay operating time', 's'],
        margin: ['Backup minus primary time', 's'],
        required: ['Backup multiplier for selected grading interval', '1'],
      },
      plot: {
        x: 'Fault current',
        xUnit: 'A',
        y: 'Relay operating time',
        yUnit: 's',
        traces: { y: 'Primary relay', reference: 'Backup relay' },
      },
      text: lesson(
        'Compare two relays on one referred current basis and calculate the backup time multiplier needed at the selected fault.',
        'Is one grading-point comparison enough to establish coordination over all faults?',
        ['No, the full fault-current range matters', 'Yes, always', 'Only pickup current matters'],
        'Different pickups and curves can change the time margin with current.',
        'The standard-inverse curve uses t=0.14 TMS/(M^0.02−1), with M>1.',
        'Standard: k=.14, α=.02; very inverse: k=13.5, α=1; extreme: t=80TMS/(M²−1). Required TMSbackup=(tprimary+Δt)/f(Mbackup).',
        'IEC-style ideal curve equations, common curve family and equal referred fault current at both relays. All pickups are primary amperes, so no CT-ratio mixing. Null time means below/equal pickup. Breaker clearing time, CT saturation, tolerances, directional logic and varying fault contributions are excluded.',
      ),
    },
    (a) => {
      const cp = relayCurve(a.fault / a.primary, a.kind),
        cb = relayCurve(a.fault / a.backup, a.kind),
        tp = cp === null ? null : a.primarytime * cp,
        tb = cb === null ? null : a.backuptime * cb;
      return result(
        {
          primary: tp,
          backup: tb,
          margin: tp === null || tb === null ? null : tb - tp,
          required: tp === null || cb === null ? null : (tp + a.interval) / cb,
        },
        seq(100, 20000, 240).map((x) => {
          const p = relayCurve(x / a.primary, a.kind),
            b = relayCurve(x / a.backup, a.kind);
          return {
            x,
            y: p === null ? null : p * a.primarytime,
            reference: b === null ? null : b * a.backuptime,
          };
        }),
        'relay',
        { primary: a.primary, backup: a.backup, fault: a.fault },
        [['Requested grading interval s', a.interval]],
        tp === null || tb === null
          ? ['At least one relay is below pickup; finite inverse-time coordination is undefined.']
          : tb - tp < a.interval
            ? ['Selected grading interval is not achieved at this fault current.']
            : [],
      );
    },
  ),
};

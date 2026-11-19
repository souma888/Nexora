import {
  exploration as lab,
  p,
  choice,
  integer,
  seq,
  teaching,
  output,
  trajectory,
  random,
  normal,
  mean,
  rms,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'biomedical', topic: 'Physiological system models', ...config }, solve);
const vtrap = (x, k) => (Math.abs(x / k) < 1e-7 ? k * (1 + x / (2 * k)) : x / -Math.expm1(-x / k));
export function hhRates(V) {
  return {
    am: 0.1 * vtrap(V + 40, 10),
    bm: 4 * Math.exp(-(V + 65) / 18),
    ah: 0.07 * Math.exp(-(V + 65) / 20),
    bh: 1 / (1 + Math.exp(-(V + 35) / 10)),
    an: 0.01 * vtrap(V + 55, 10),
    bn: 0.125 * Math.exp(-(V + 65) / 80),
  };
}
export const biomedicalModels = {
  hodgkinhuxley: make(
    {
      id: 'hodgkinhuxley',
      title: 'Hodgkin–Huxley Action Potential',
      inputs: {
        current: p('Injected pulse current density', 'µA/cm²', 0, 30, 10),
        duration: p('Pulse duration', 'ms', 1, 30, 15),
        sodium: p('Sodium maximum conductance', 'mS/cm²', 60, 180, 120),
        potassium: p('Potassium maximum conductance', 'mS/cm²', 18, 54, 36),
      },
      metrics: {
        peak: ['Peak membrane voltage', 'mV'],
        spikes: ['Upward zero-mV crossings', '1'],
        rest: ['Final membrane voltage', 'mV'],
      },
      plot: { x: 'Time', xUnit: 'ms', y: 'Membrane potential', yUnit: 'mV' },
      text: teaching(
        'Integrate the four Hodgkin–Huxley membrane and gating equations with a finite injected-current pulse.',
        'Does every positive current pulse cause a full action potential?',
        ['No, excitation has a threshold', 'Yes', 'Only if sodium conductance is zero'],
        'Voltage-dependent sodium activation competes with potassium activation and sodium inactivation.',
        'The classic squid-axon parameters are Cm=1 µF/cm², gNa=120, gK=36 and gL=.3 mS/cm².',
        'Cm V̇=I−gNa m³h(V−50)−gK n⁴(V+77)−gL(V+54.387); gatė=α(1−gate)−β gate.',
        'Classic 6.3°C squid giant-axon single-compartment model, not a human-cell calibration. RK4 dt=.01 ms with removable rate singularities handled by expm1. Educational physiology; no clinical interpretation.',
      ),
    },
    (a) => {
      const r = hhRates(-65),
        initial = [-65, r.am / (r.am + r.bm), r.ah / (r.ah + r.bh), r.an / (r.an + r.bn)],
        rows = trajectory(
          (t, [V, m, h, n]) => {
            const r = hhRates(V),
              I = t >= 5 && t < 5 + a.duration ? a.current : 0;
            return [
              I -
                a.sodium * m ** 3 * h * (V - 50) -
                a.potassium * n ** 4 * (V + 77) -
                0.3 * (V + 54.387),
              r.am * (1 - m) - r.bm * m,
              r.ah * (1 - h) - r.bh * h,
              r.an * (1 - n) - r.bn * n,
            ];
          },
          initial,
          60,
          6000,
          5,
        );
      let spikes = 0;
      rows.slice(1).forEach((r, i) => {
        if (rows[i].state[0] < 0 && r.state[0] >= 0) spikes++;
      });
      return output(
        { peak: Math.max(...rows.map((v) => v.state[0])), spikes, rest: rows.at(-1).state[0] },
        rows.map((r) => ({ x: r.t, y: r.state[0] })),
        'membrane',
        { gates: rows.map((r) => [r.t, ...r.state.slice(1)]) },
      );
    },
  ),
  ecgsynthetic: make(
    {
      id: 'ecgsynthetic',
      title: 'ECG Waveform Synthesis and Heart-Rate Variability',
      inputs: {
        rate: p('Nominal heart rate', 'beats/min', 40, 160, 72),
        jitter: p('RR variation standard deviation', 'ms', 0, 100, 20),
        seed: integer('Reproducible RR seed', 1, 999, 42),
      },
      metrics: {
        rate: ['Realized mean RR heart rate', 'beats/min'],
        sdnn: ['Sample SDNN over synthetic intervals', 'ms'],
        rmssd: ['Successive RR-difference RMS', 'ms'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Synthetic ECG amplitude', yUnit: 'mV' },
      text: teaching(
        'Place P–QRS–T Gaussian components around seeded R peaks and calculate interval-based HRV from the generated beat times.',
        'Can this short synthetic trace diagnose an arrhythmia?',
        ['No', 'Yes', 'Only if SDNN is large'],
        'HRV statistics depend on record length, preprocessing and physiology; generated morphology is illustrative.',
        'A constant 60 beats/min rhythm has RR=1000 ms, SDNN=0 and RMSSD=0.',
        'ECG(t)=ΣbeatsΣwaves Aⱼ exp[−(t−tR−μⱼ)²/(2σⱼ²)]; RMSSD=√mean[(RRᵢ₊₁−RRᵢ)²].',
        'Synthetic Gaussian morphology, 20 intervals, seeded clipped Gaussian RR jitter and 500 Hz rendering. No electrode physics, disease model or validated ECGSYN implementation; statistics are illustrative, not diagnostic.',
      ),
    },
    (a) => {
      const rng = random(a.seed),
        rr = Array.from({ length: 20 }, () =>
          Math.max(0.25, 60 / a.rate + (a.jitter / 1000) * normal(rng)),
        ),
        beats = [0.5];
      rr.forEach((v) => beats.push(beats.at(-1) + v));
      const scale = 60 / a.rate,
        waves = [
          [-0.2, 0.035, 0.12],
          [-0.045, 0.012, -0.15],
          [0, 0.012, 1],
          [0.04, 0.015, -0.25],
          [0.25, 0.07, 0.3],
        ],
        end = beats.at(-1) + 0.5,
        s = seq(0, end, Math.ceil(end * 500)).map((x) => ({
          x,
          y: beats.reduce(
            (sum, t) =>
              sum +
              waves.reduce(
                (v, [mu, sigma, A]) =>
                  v + A * Math.exp(-0.5 * ((x - t - mu * scale) / (sigma * scale)) ** 2),
                0,
              ),
            0,
          ),
        })),
        m = mean(rr);
      return output(
        {
          rate: 60 / m,
          sdnn: Math.sqrt(rr.reduce((s, v) => s + (v - m) ** 2, 0) / (rr.length - 1)) * 1000,
          rmssd: rms(rr.slice(1).map((v, i) => v - rr[i])) * 1000,
        },
        s,
        'ecg',
        { beats },
      );
    },
  ),
  windkessel: make(
    {
      id: 'windkessel',
      title: 'Windkessel Model of Blood Pressure',
      inputs: {
        rate: p('Heart rate', 'beats/min', 40, 140, 75),
        stroke: p('Stroke volume', 'mL', 30, 120, 70),
        resistance: p('Peripheral resistance', 'mmHg·s/mL', 0.5, 2, 1),
        compliance: p('Arterial compliance', 'mL/mmHg', 0.5, 3, 1.5),
      },
      metrics: {
        systolic: ['Final-cycle maximum pressure', 'mmHg'],
        diastolic: ['Final-cycle minimum pressure', 'mmHg'],
        mean: ['Final-cycle mean pressure', 'mmHg'],
        flow: ['Mean cardiac output', 'L/min'],
      },
      plot: {
        x: 'Time in final two beats',
        xUnit: 's',
        y: 'Arterial pressure above venous reference',
        yUnit: 'mmHg',
      },
      text: teaching(
        'Integrate the two-element arterial reservoir under a pulsatile ejection waveform and inspect resistance/compliance effects.',
        'Does lower arterial compliance usually increase pulse pressure?',
        ['Yes', 'No', 'It changes only heart rate'],
        'A stiffer reservoir stores the same stroke volume with a larger pressure rise.',
        'Mean pressure above venous reference approaches R·SV·HR/60; R=1, SV=70 and HR=75 give 87.5 mmHg.',
        'C Ṗ=Qin−P/R; Qin=(πSV/(2Ts))sin(πt/Ts) during systole.',
        'Lumped two-element Windkessel, systole=35% of cycle, zero venous reference and ideal prescribed flow. Twenty-four beat settling with initial mean pressure; no valves, wave reflection or patient-specific calibration.',
      ),
    },
    (a) => {
      const T = 60 / a.rate,
        Ts = 0.35 * T,
        meanP = (a.resistance * a.stroke) / T,
        steps = 24000,
        rows = trajectory(
          (t, [P]) => {
            const phase = t % T,
              Q =
                phase < Ts
                  ? ((Math.PI * a.stroke) / (2 * Ts)) * Math.sin((Math.PI * phase) / Ts)
                  : 0;
            return [(Q - P / a.resistance) / a.compliance];
          },
          [meanP],
          24 * T,
          steps,
          10,
        ),
        cycle = rows.filter((r) => r.t >= 23 * T),
        show = rows.filter((r) => r.t >= 22 * T);
      return output(
        {
          systolic: Math.max(...cycle.map((r) => r.state[0])),
          diastolic: Math.min(...cycle.map((r) => r.state[0])),
          mean: mean(cycle.map((r) => r.state[0])),
          flow: (a.stroke * a.rate) / 1000,
        },
        show.map((r) => ({ x: r.t - 22 * T, y: r.state[0] })),
        'reservoir',
        { ...a },
      );
    },
  ),
  pharmacokinetics: make(
    {
      id: 'pharmacokinetics',
      title: 'Pharmacokinetics: One- and Two-Compartment Models',
      inputs: {
        configuration: choice('IV bolus model', ['one', 'two'], 'two'),
        dose: p('Single initial dose', 'mg', 10, 500, 100),
        central: p('Central distribution volume', 'L', 2, 50, 10),
        peripheral: p('Peripheral volume', 'L', 2, 100, 20),
        clearance: p('Central clearance', 'L/h', 0.1, 10, 1),
        exchange: p('Intercompartmental clearance', 'L/h', 0.1, 10, 2),
      },
      metrics: {
        initial: ['Initial central concentration', 'mg/L'],
        final: ['Central concentration at 24 h', 'mg/L'],
        eliminated: ['Eliminated mass by 24 h', 'mg'],
        balance: ['Mass-balance residual', 'mg'],
      },
      plot: {
        x: 'Time',
        xUnit: 'h',
        y: 'Concentration',
        yUnit: 'mg/L',
        traces: { y: 'Central compartment', reference: 'Peripheral compartment' },
      },
      text: teaching(
        'Track compartment drug amounts under linear clearance and reversible exchange following an idealized IV bolus.',
        'Is the peripheral compartment itself an elimination pathway here?',
        ['No, only central clearance eliminates mass', 'Yes', 'Only in the one-compartment model'],
        'Exchange redistributes drug; the modeled clearance removes central drug into a separate cumulative sink.',
        'A one-compartment dose 100 mg into 10 L starts at 10 mg/L and decays as exp(−CL·t/V).',
        'Ȧc=−CL·Cc−Q(Cc−Cp); Ȧp=Q(Cc−Cp); Ȧelim=CL·Cc; C=A/V.',
        'Linear well-mixed compartments, one instantaneous IV dose and constant clearances. Educational kinetic model only; no absorption, binding, metabolism saturation or dosing recommendations.',
      ),
    },
    (a) => {
      const rows = trajectory(
          (_t, [Ac, Ap]) => {
            const Cc = Ac / a.central,
              Cp = Ap / a.peripheral,
              flux = a.configuration === 'two' ? a.exchange * (Cc - Cp) : 0;
            return [-a.clearance * Cc - flux, flux, a.clearance * Cc];
          },
          [a.dose, 0, 0],
          24,
          6000,
          15,
        ),
        last = rows.at(-1).state;
      return output(
        {
          initial: a.dose / a.central,
          final: last[0] / a.central,
          eliminated: last[2],
          balance: last.reduce((s, v) => s + v, 0) - a.dose,
        },
        rows.map((r) => ({
          x: r.t,
          y: r.state[0] / a.central,
          reference: r.state[1] / a.peripheral,
        })),
        'compartments',
        { ...a },
      );
    },
  ),
  bloodpoiseuille: make(
    {
      id: 'bloodpoiseuille',
      title: 'Poiseuille Blood Flow and Vessel Resistance',
      inputs: {
        radius: p('Vessel radius', 'mm', 0.2, 5, 1),
        length: p('Vessel length', 'cm', 1, 100, 10),
        viscosity: p('Dynamic viscosity', 'mPa·s', 2, 6, 3.5),
        pressure: p('Pressure difference', 'mmHg', 1, 100, 10),
        density: p('Fluid density', 'kg/m³', 1000, 1100, 1060),
      },
      metrics: {
        flow: ['Ideal volumetric flow', 'mL/min'],
        resistance: ['Hydraulic resistance', 'mmHg·min/mL'],
        reynolds: ['Reynolds number', '1'],
        shear: ['Wall shear stress', 'Pa'],
      },
      plot: { x: 'Radius', xUnit: 'mm', y: 'Flow rate', yUnit: 'mL/min' },
      text: teaching(
        'Explore the fourth-power radius dependence of a Newtonian cylindrical-vessel flow model and check its Reynolds number.',
        'Does halving radius increase hydraulic resistance sixteenfold?',
        ['Yes', 'No, only twofold', 'No, fourfold'],
        'Laminar circular-tube resistance scales as r⁻⁴ at fixed viscosity and length.',
        'At unchanged pressure difference, doubling radius multiplies ideal Poiseuille flow by sixteen.',
        'Q=πr⁴ΔP/(8μL); R=ΔP/Q; Re=2ρrU/μ; τw=ΔP r/(2L).',
        'Steady fully developed incompressible Newtonian flow in a rigid circular tube. Real blood is non-Newtonian in small vessels and flow is pulsatile; high Re results are flagged outside laminar assumptions.',
      ),
    },
    (a) => {
      const r = a.radius / 1000,
        L = a.length / 100,
        mu = a.viscosity / 1000,
        dp = a.pressure * 133.322387415,
        flow = (radius) => ((Math.PI * (radius / 1000) ** 4 * dp) / (8 * mu * L)) * 6e7,
        Q = flow(a.radius),
        U = Q / 6e7 / (Math.PI * r * r),
        Re = (2 * a.density * r * U) / mu;
      return output(
        { flow: Q, resistance: a.pressure / Q, reynolds: Re, shear: (dp * r) / (2 * L) },
        seq(0.2, 5).map((x) => ({ x, y: flow(x) })),
        'vessel',
        { ...a },
        [],
        Re > 2000
          ? [
              'Reynolds number exceeds the nominal laminar-pipe range; the displayed Poiseuille result is an extrapolation.',
            ]
          : [],
      );
    },
  ),
  pulseoximetry: make(
    {
      id: 'pulseoximetry',
      title: 'Pulse Oximetry and Beer–Lambert Ratios',
      inputs: {
        saturation: p('Synthetic oxygenated fraction', '%', 50, 100, 95),
        pulse: p('Pulsatile optical-depth amplitude', '1', 0.001, 0.1, 0.02),
        tissue: p('Static tissue optical depth', '1', 0.2, 3, 1),
      },
      metrics: {
        ratio: ['Red/IR AC-to-DC ratio', '1'],
        estimated: ['Recovered model saturation', '%'],
        error: ['Finite-pulse calibration error', 'percentage points'],
      },
      plot: {
        x: 'Pulse phase',
        xUnit: 'cycles',
        y: 'Normalized transmitted intensity',
        yUnit: '1',
        traces: { y: 'Red', reference: 'Infrared' },
      },
      text: teaching(
        'Build two wavelength-dependent Beer–Lambert signals and recover the oxygenated fraction with a stated toy absorption calibration.',
        'Does static tissue attenuation cancel from each ideal AC/DC ratio?',
        ['Yes', 'No', 'Only at zero saturation'],
        'Multiplicative static attenuation affects AC and DC equally in this idealized model.',
        'In the small-pulse limit, R=(1.2−S)/(.8+.2S), so S=(1.2−.8R)/(1+.2R).',
        'Iλ=exp[−Atissue−ελ(S)(1+a sin2πt)]; R=(AC/DC)red/(AC/DC)IR.',
        'Illustrative two-species extinction coefficients: red HbO₂=.2,Hb=1.2; IR HbO₂=1,Hb=.8. These are synthetic unitless calibration values, not clinical wavelengths or a validated device calibration. No scattering or venous artifact model.',
      ),
    },
    (a) => {
      const S = a.saturation / 100,
        er = 1.2 - S,
        ei = 0.8 + 0.2 * S,
        s = seq(0, 3, 600).map((x) => ({
          x,
          y: Math.exp(-a.tissue - er * (1 + a.pulse * Math.sin(2 * Math.PI * x))),
          reference: Math.exp(-a.tissue - ei * (1 + a.pulse * Math.sin(2 * Math.PI * x))),
        })),
        acdc = (key) =>
          (Math.max(...s.map((v) => v[key])) - Math.min(...s.map((v) => v[key]))) /
          (2 * mean(s.map((v) => v[key]))),
        ratio = acdc('y') / acdc('reference'),
        estimated = (100 * (1.2 - 0.8 * ratio)) / (1 + 0.2 * ratio);
      return output({ ratio, estimated, error: estimated - a.saturation }, s, 'optical-sensor', {
        ...a,
      });
    },
  ),
  sirmodel: make(
    {
      id: 'sirmodel',
      title: 'SIR Epidemic Model and R₀',
      inputs: {
        beta: p('Transmission rate β', 'day⁻¹', 0.05, 1, 0.3),
        gamma: p('Recovery rate γ', 'day⁻¹', 0.02, 0.5, 0.1),
        infected: p('Initially infected fraction', '%', 0.1, 10, 1),
        immune: p('Initially recovered / immune fraction', '%', 0, 70, 0),
      },
      metrics: {
        basic: ['Basic reproduction number R₀', '1'],
        effective: ['Initial effective reproduction number', '1'],
        peak: ['Peak infected population fraction', '%'],
        balance: ['Maximum population conservation error', '1'],
      },
      plot: {
        x: 'Time',
        xUnit: 'days',
        y: 'Population fraction',
        yUnit: '%',
        traces: { y: 'Infectious', reference: 'Susceptible', third: 'Recovered' },
      },
      text: teaching(
        'Integrate a closed-population epidemic and distinguish basic reproduction number from its susceptible-adjusted effective value.',
        'Can infections initially decline even when R₀ exceeds one?',
        ['Yes, if susceptible fraction is small enough', 'No', 'Only if recovery is zero'],
        'Initial growth depends on βS₀−γ, equivalently R₀S₀>1.',
        'β=.3/day and γ=.1/day give R₀=3; a fully susceptible infectious period averages 10 days.',
        'Ṡ=−βSI; İ=βSI−γI; Ṙ=γI; R₀=β/γ; S+I+R=1.',
        'Homogeneous deterministic closed population, permanent recovery immunity, no births, age structure, interventions or reporting model. Educational dynamics, not a public-health forecast.',
      ),
    },
    (a) => {
      const I = a.infected / 100,
        R = a.immune / 100,
        S = 1 - I - R,
        rows = trajectory(
          (_t, [s, i]) => [-a.beta * s * i, a.beta * s * i - a.gamma * i, a.gamma * i],
          [S, I, R],
          240,
          12000,
          20,
        );
      return output(
        {
          basic: a.beta / a.gamma,
          effective: (a.beta / a.gamma) * S,
          peak: 100 * Math.max(...rows.map((r) => r.state[1])),
          balance: Math.max(...rows.map((r) => Math.abs(r.state.reduce((s, v) => s + v, 0) - 1))),
        },
        rows.map((r) => ({
          x: r.t,
          y: 100 * r.state[1],
          reference: 100 * r.state[0],
          third: 100 * r.state[2],
        })),
        'sir',
        { initial: [S, I, R] },
      );
    },
  ),
};

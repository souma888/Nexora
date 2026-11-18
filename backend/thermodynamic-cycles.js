import {
  engineering,
  p,
  choice,
  seq,
  lesson,
  domain,
  requireValue,
  result,
} from './engineering-kit.js';
import { rankine, saturationPressure } from './thermal-engine.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'thermofluids', topic: 'Thermodynamic cycles', ...config }, solve);
const air = {
  temperature: p('Intake temperature', 'K', 270, 400, 300),
  pressure: p('Intake pressure', 'kPa', 80, 200, 100),
  gamma: p('Specific heat ratio', '1', 1.25, 1.4, 1.4),
};
export function gasPath(states, gamma) {
  return states.flatMap((v, i) => {
    const next = states[(i + 1) % states.length];
    return seq(0, 1, 24).map((f) => {
      const V = v.v + (next.v - v.v) * f;
      let P;
      if (v.process === 'isentropic') P = v.p * (v.v / V) ** gamma;
      else if (v.process === 'volume') P = v.p + (next.p - v.p) * f;
      else P = v.p;
      return { x: V, y: P };
    });
  });
}
export const cycleModels = {
  otto: make(
    {
      id: 'otto',
      title: 'Otto Cycle: Air-Standard Engine',
      inputs: {
        ...air,
        ratio: p('Compression ratio', '1', 4, 18, 8),
        peak: p('Peak temperature', 'K', 1200, 2600, 2000),
      },
      validateValues: domain('peak', (a) =>
        requireValue(
          a.peak > a.temperature * a.ratio ** (a.gamma - 1),
          'Peak temperature must exceed the compressed temperature.',
        ),
      ),
      metrics: {
        efficiency: ['Thermal efficiency', '1'],
        work: ['Net specific work', 'kJ/kg'],
        heat: ['Heat input', 'kJ/kg'],
        mep: ['Mean effective pressure', 'kPa'],
      },
      plot: { x: 'Specific volume', xUnit: 'm³/kg', y: 'Pressure', yUnit: 'kPa' },
      text: lesson(
        'Trace four air-standard states with isentropic compression/expansion and constant-volume heat transfer.',
        'Increasing compression ratio at constant γ changes ideal efficiency how?',
        ['Raises it', 'Lowers it', 'Leaves it unchanged'],
        'η=1−r^(1−γ) rises monotonically with r.',
        'r=8 and γ=1.4 give η≈0.564725.',
        'T2=T1r^(γ−1); T4=T3/r^(γ−1); η=1−r^(1−γ); wnet=cv[(T3−T2)−(T4−T1)].',
        'Closed cold-air-standard cycle, ideal gas R=0.287 kJ/(kg·K), constant heat capacities and internally reversible compression/expansion. No combustion chemistry, pumping loop, friction, heat loss or finite burning duration.',
      ),
    },
    (a) => {
      const R = 0.287,
        cv = R / (a.gamma - 1),
        v1 = (R * a.temperature) / a.pressure,
        v2 = v1 / a.ratio,
        T2 = a.temperature * a.ratio ** (a.gamma - 1),
        T4 = a.peak / a.ratio ** (a.gamma - 1),
        heat = cv * (a.peak - T2),
        rejected = cv * (T4 - a.temperature),
        work = heat - rejected,
        states = [
          { v: v1, p: a.pressure, T: a.temperature, process: 'isentropic' },
          { v: v2, p: (R * T2) / v2, T: T2, process: 'volume' },
          { v: v2, p: (R * a.peak) / v2, T: a.peak, process: 'isentropic' },
          { v: v1, p: (R * T4) / v1, T: T4, process: 'volume' },
        ];
      return {
        ...result(
          { efficiency: work / heat, work, heat, mep: work / (v1 - v2) },
          gasPath(states, a.gamma),
          'cycle',
          { states },
          states.map((s, i) => [
            `State ${i + 1} T K / p kPa`,
            `${s.T.toFixed(3)} / ${s.p.toFixed(3)}`,
          ]),
        ),
        states,
      };
    },
  ),
  dieseldual: make(
    {
      id: 'dieseldual',
      title: 'Diesel and Dual Combustion Cycles',
      inputs: {
        ...air,
        mode: choice(
          'Heat-addition model',
          { diesel: 'Diesel: constant pressure', dual: 'Dual: volume then pressure' },
          'dual',
        ),
        ratio: p('Compression ratio', '1', 8, 24, 16),
        cutoff: p('Cutoff volume ratio ρ', '1', 1.1, 3, 2),
        rise: p('Constant-volume pressure ratio α (dual)', '1', 1, 3, 1.5),
      },
      metrics: {
        efficiency: ['Thermal efficiency', '1'],
        work: ['Net specific work', 'kJ/kg'],
        heat: ['Heat added', 'kJ/kg'],
        peak: ['Peak ideal-gas temperature', 'K'],
      },
      plot: { x: 'Specific volume', xUnit: 'm³/kg', y: 'Pressure', yUnit: 'kPa' },
      text: lesson(
        'Compare Diesel heat addition with a dual constant-volume/constant-pressure path under identical intake conditions.',
        'Setting the dual pressure ratio α to one recovers which cycle?',
        ['Diesel', 'Otto with no expansion', 'Carnot'],
        'The constant-volume heat-addition step then vanishes.',
        'For r=16, ρ=2 and γ=1.4, Diesel efficiency is approximately 0.6136.',
        'qCV=cv(T3−T2); qCP=cp(T4−T3); T5=T4(ρ/r)^(γ−1); qout=cv(T5−T1).',
        'Ideal gas R=0.287 kJ/(kg·K), constant γ, cold-air standard, no real fuel/combustion losses. Peak temperatures outside realistic air-property ranges are flagged; this is an ideal comparative model, not an engine rating.',
      ),
    },
    (a) => {
      const R = 0.287,
        cv = R / (a.gamma - 1),
        cp = cv * a.gamma,
        alpha = a.mode === 'diesel' ? 1 : a.rise,
        v1 = (R * a.temperature) / a.pressure,
        v2 = v1 / a.ratio,
        T2 = a.temperature * a.ratio ** (a.gamma - 1),
        T3 = alpha * T2,
        T4 = a.cutoff * T3,
        T5 = T4 * (a.cutoff / a.ratio) ** (a.gamma - 1),
        heat = cv * (T3 - T2) + cp * (T4 - T3),
        work = heat - cv * (T5 - a.temperature),
        states = [
          { v: v1, p: a.pressure, T: a.temperature, process: 'isentropic' },
          { v: v2, p: (R * T2) / v2, T: T2, process: 'volume' },
          { v: v2, p: (R * T3) / v2, T: T3, process: 'pressure' },
          { v: v2 * a.cutoff, p: (R * T3) / v2, T: T4, process: 'isentropic' },
          { v: v1, p: (R * T5) / v1, T: T5, process: 'volume' },
        ];
      return {
        ...result(
          { efficiency: work / heat, work, heat, peak: T4 },
          gasPath(states, a.gamma),
          'cycle',
          { states },
          states.map((s, i) => [`State ${i + 1} temperature K`, s.T]),
          T4 > 2500
            ? [
                'Peak temperature exceeds 2500 K; constant air heat capacities are a strong simplification.',
              ]
            : [],
        ),
        states,
      };
    },
  ),
  brayton: make(
    {
      id: 'brayton',
      title: 'Brayton Cycle with Regeneration',
      inputs: {
        inlet: p('Compressor inlet', 'K', 270, 350, 300),
        peak: p('Turbine inlet', 'K', 900, 1700, 1400),
        ratio: p('Compressor pressure ratio', '1', 2, 40, 8),
        compressor: p('Compressor isentropic efficiency', '1', 0.65, 1, 0.85),
        turbine: p('Turbine isentropic efficiency', '1', 0.65, 1, 0.9),
        regenerator: p('Regenerator effectiveness', '1', 0, 0.95, 0.7),
      },
      validateValues: domain('peak', (a) => {
        const r = a.ratio ** (2 / 7),
          T2 = a.inlet * (1 + (r - 1) / a.compressor),
          T4 = a.peak * (1 - a.turbine * (1 - 1 / r));
        requireValue(
          a.peak > T2 && a.peak - T4 > T2 - a.inlet,
          'Selected conditions must produce positive net work and positive heat input.',
        );
      }),
      metrics: {
        efficiency: ['Thermal efficiency', '1'],
        work: ['Net specific work', 'kJ/kg'],
        recovered: ['Regenerator heat recovery', 'kJ/kg'],
        backwork: ['Compressor/turbine work ratio', '1'],
      },
      plot: { x: 'State index', xUnit: '1', y: 'Temperature', yUnit: 'K' },
      text: lesson(
        'Balance compressor and turbine work, then recover exhaust heat only when the exhaust is hotter than the compressor discharge.',
        'Can a regenerator recover heat when T4≤T2?',
        ['No, it is bypassed', 'Yes, with no external energy', 'Only at effectiveness one'],
        'Passive heat recovery cannot heat the colder exhaust into a hotter compressor discharge.',
        'With unit component efficiencies and no regenerator, η=1−rp^(−2/7) for γ=1.4.',
        'T2=T1[1+(rp^((γ−1)/γ)−1)/ηc]; T4=T3[1−ηt(1−rp^−((γ−1)/γ))]; T5=T2+ε max(T4−T2,0).',
        'Constant cp=1.0045 kJ/(kg·K), γ=1.4 ideal gas, equal mass flow, no pressure drop or mechanical losses. Regenerator effectiveness uses equal heat-capacity rates; no recuperator sizing or turbine cooling.',
      ),
    },
    (a) => {
      const r = a.ratio ** (2 / 7),
        T2 = a.inlet * (1 + (r - 1) / a.compressor),
        T4 = a.peak * (1 - a.turbine * (1 - 1 / r)),
        recovered = 1.0045 * a.regenerator * Math.max(T4 - T2, 0),
        wc = 1.0045 * (T2 - a.inlet),
        wt = 1.0045 * (a.peak - T4),
        heat = 1.0045 * (a.peak - T2) - recovered;
      return result(
        { efficiency: (wt - wc) / heat, work: wt - wc, recovered, backwork: wc / wt },
        [a.inlet, T2, T2 + recovered / 1.0045, a.peak, T4, T4 - recovered / 1.0045].map((y, x) => ({
          x: x + 1,
          y,
        })),
        'cycle',
        {
          labels: [
            'Inlet',
            'Compressor',
            'Recovered heat',
            'Turbine inlet',
            'Exhaust',
            'After recovery',
          ],
        },
        [
          ['Compressor work kJ/kg', wc],
          ['Turbine work kJ/kg', wt],
          ['External heat kJ/kg', heat],
        ],
        T4 <= T2
          ? ['Regenerator is bypassed because exhaust is not hotter than compressor discharge.']
          : [],
      );
    },
  ),
  rankine: make(
    {
      id: 'rankine',
      title: 'Rankine Cycle with Superheat and Reheat',
      inputs: {
        boiler: p('Boiler pressure', 'MPa', 2, 15, 8),
        condenser: p('Condenser absolute pressure', 'MPa', 0.005, 0.1, 0.01),
        superheat: p('Main steam temperature', '°C', 400, 600, 480),
        turbine: p('Each turbine-stage efficiency', '1', 0.7, 1, 0.85),
        pump: p('Pump efficiency', '1', 0.6, 1, 0.8),
        reheat: choice(
          'Reheat',
          { no: 'Simple superheated Rankine', yes: 'One reheat stage' },
          'yes',
        ),
        reheatPressure: p('Reheat pressure', 'MPa', 0.2, 5, 1),
        reheatTemp: p('Reheat temperature', '°C', 350, 600, 480),
      },
      validateValues: domain('boiler', (a) => {
        rankine(a);
      }),
      metrics: {
        efficiency: ['Thermal efficiency', '1'],
        work: ['Net specific work', 'kJ/kg'],
        heat: ['External heat input', 'kJ/kg'],
        quality: ['Turbine-exit vapor quality (if wet)', '1'],
      },
      plot: { x: 'Specific entropy', xUnit: 'kJ/(kg·K)', y: 'Temperature', yUnit: 'K' },
      text: lesson(
        'Calculate real water/steam states with IAPWS-IF97, a liquid pump approximation, finite turbine efficiencies and optional reheat.',
        'At a fixed condenser pressure, does reheat usually improve the final exhaust dryness?',
        [
          'Yes, for conventional reheat states',
          'No, it always adds moisture',
          'It fixes quality exactly at one',
        ],
        'Additional heat before the low-pressure expansion raises its inlet entropy.',
        'Saturated water at 0.01 MPa has Tsat≈318.958 K, hf≈191.812 and hg≈2583.887 kJ/kg.',
        'wp=vf(Pb−Pc)/ηp; ht,out=hin−ηt(hin−his); wet states use h=hf+xhfg and s=sf+xsfg; η=(wt−wp)/qin.',
        'IAPWS-IF97 regions 1/2 and saturation mixing, Pb≤15 MPa. No pressure losses, extractions or condenser subcooling. Pump uses constant inlet vf. The T–s plot connects calculated state points schematically; it is not an interpolated physical heat-transfer path. Undefined quality means a single-phase outlet.',
      ),
    },
    (a) => {
      const r = rankine(a);
      return {
        ...result(
          { efficiency: r.efficiency, work: r.net, heat: r.heat, quality: r.quality },
          [...r.states, r.states[0]].map((s) => ({ x: s.s, y: s.t })),
          'steam-cycle',
          { states: r.states },
          r.states.map((s, i) => [
            `State ${i + 1}: p MPa, T K, h kJ/kg, s kJ/(kg K)`,
            `${s.p.toFixed(4)}, ${s.t.toFixed(3)}, ${s.h.toFixed(3)}, ${s.s.toFixed(5)}`,
          ]),
        ),
        states: r.states,
        balance: { pump: r.pump, turbine: r.turbine, rejected: r.rejected },
      };
    },
  ),
  psychrometric: make(
    {
      id: 'psychrometric',
      title: 'Psychrometrics: Cooling and Dehumidification',
      topic: 'Moist air & exergy',
      inputs: {
        inlet: p('Inlet dry-bulb temperature', '°C', 20, 45, 30),
        humidity: p('Inlet relative humidity', '%', 30, 95, 60),
        coil: p('Coil apparatus dew point', '°C', 0, 18, 10),
        bypass: p('Bypass factor', '1', 0, 0.9, 0.2),
        pressure: p('Atmospheric pressure', 'kPa', 80, 105, 101.325),
        flow: p('Dry-air mass flow', 'kg/s', 0.1, 10, 1),
      },
      validateValues: domain('coil', (a) =>
        requireValue(
          saturationPressure(a.coil) < (a.humidity / 100) * saturationPressure(a.inlet),
          'For dehumidification the coil apparatus dew point must be below the inlet dew point.',
        ),
      ),
      metrics: {
        outlet: ['Outlet dry-bulb temperature', '°C'],
        water: ['Condensate rate', 'kg/s'],
        cooling: ['Coil cooling duty including condensate enthalpy', 'kW'],
        ratio: ['Outlet humidity ratio', 'kg/kg dry air'],
      },
      plot: { x: 'Dry-bulb temperature', xUnit: '°C', y: 'Humidity ratio', yUnit: 'kg/kg dry air' },
      text: lesson(
        'Mix bypassed inlet air with saturated apparatus-dew-point air using dry-air mass and enthalpy balance.',
        'Reducing the bypass factor does what to the outlet state?',
        [
          'Moves it toward saturated coil-ADP air',
          'Moves it toward the inlet',
          'Raises both inlet humidity and temperature',
        ],
        'A smaller fraction avoids contact with the coil.',
        'At bypass factor zero the outlet equals saturated air at the chosen apparatus dew point.',
        'w=0.621945 pv/(p−pv); h=1.006T+w(2501+1.86T); hout=BF hin+(1−BF)hADP; Q=mda(hin−hout)−mcond·4.186TADP.',
        'Ideal moist air, Buck saturation pressure over liquid water from 0–45°C, no frosting, fixed bypass factor and condensate leaving at ADP. Enthalpies are referenced to liquid water at 0°C; cooling duty includes liquid condensate energy.',
      ),
    },
    (a) => {
      const ratio = (pv) => (0.621945 * pv) / (a.pressure - pv),
        wi = ratio((a.humidity / 100) * saturationPressure(a.inlet)),
        wa = ratio(saturationPressure(a.coil)),
        h = (T, w) => 1.006 * T + w * (2501 + 1.86 * T),
        hi = h(a.inlet, wi),
        ha = h(a.coil, wa),
        wo = a.bypass * wi + (1 - a.bypass) * wa,
        ho = a.bypass * hi + (1 - a.bypass) * ha,
        T = (ho - 2501 * wo) / (1.006 + 1.86 * wo),
        water = a.flow * (wi - wo),
        cooling = a.flow * (hi - ho) - water * 4.186 * a.coil;
      return result(
        { outlet: T, water, cooling, ratio: wo },
        seq(0, 1).map((f) => {
          const w = f * wi + (1 - f) * wa,
            hh = f * hi + (1 - f) * ha;
          return { x: (hh - 2501 * w) / (1.006 + 1.86 * w), y: w };
        }),
        'psychrometric',
        { inlet: a.inlet, outlet: T, wi, wo },
        [
          ['Inlet humidity ratio kg/kg', wi],
          ['Outlet enthalpy kJ/kg dry air', ho],
          ['Moist-air enthalpy decrease kW', a.flow * (hi - ho)],
        ],
      );
    },
  ),
  exergy: make(
    {
      id: 'exergy',
      title: 'Entropy Generation and Exergy Destruction',
      topic: 'Moist air & exergy',
      inputs: {
        hot: p('Hot reservoir', 'K', 400, 1200, 600),
        cold: p('Cold reservoir', 'K', 280, 600, 300),
        ambient: p('Environment T0', 'K', 270, 330, 298.15),
        heat: p('Steady heat transfer', 'kW', 0, 1000, 100),
      },
      validateValues: domain('cold', (a) =>
        requireValue(
          a.hot > a.cold,
          'Heat-transfer direction requires hot temperature > cold temperature.',
        ),
      ),
      metrics: {
        entropy: ['Entropy generation rate', 'kW/K'],
        destruction: ['Exergy destruction rate', 'kW'],
        inlet: ['Hot-side heat exergy rate', 'kW'],
        outlet: ['Cold-side heat exergy rate', 'kW'],
      },
      plot: { x: 'Receiving temperature', xUnit: 'K', y: 'Exergy destruction', yUnit: 'kW' },
      text: lesson(
        'Close entropy and exergy balances for heat conducted between two fixed-temperature reservoirs.',
        'What happens to entropy generation as the reservoir temperatures approach each other?',
        ['It approaches zero at fixed heat rate', 'It diverges', 'It becomes negative'],
        'The difference between reciprocal absolute temperatures vanishes.',
        '100 kW from 600 K to 300 K generates 1/6 kW/K and destroys 49.6917 kW at T0=298.15 K.',
        'Ṡgen=Q̇(1/Tc−1/Th); Ẋdest=T0 Ṡgen; ẊQ=Q̇(1−T0/T).',
        'Steady transfer with no work, storage or mass flow, isothermal reservoirs and constant environment. Maintaining a finite heat rate with vanishing temperature difference would require unbounded conductance. Heat exergy is signed and can be negative below ambient.',
      ),
    },
    (a) => {
      const entropy = a.heat * (1 / a.cold - 1 / a.hot),
        destruction = a.ambient * entropy;
      return result(
        {
          entropy,
          destruction,
          inlet: a.heat * (1 - a.ambient / a.hot),
          outlet: a.heat * (1 - a.ambient / a.cold),
        },
        seq(280, a.hot).map((x) => ({ x, y: a.ambient * a.heat * (1 / x - 1 / a.hot) })),
        'thermal-wall',
        { hot: a.hot, cold: a.cold, heat: a.heat },
        [
          [
            'Exergy balance residual kW',
            a.heat * (1 - a.ambient / a.hot) - a.heat * (1 - a.ambient / a.cold) - destruction,
          ],
        ],
      );
    },
  ),
};

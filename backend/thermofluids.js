import { lab, p, choice, samples, table } from './lab-kit.js';
const area = (diameter) => (Math.PI * (diameter / 1000) ** 2) / 4;
const g = 9.81,
  rho = 1000;
const temperatures = {
  hot: p('Hot-side temperature', '°C', 20, 300, 100),
  cold: p('Cold-side temperature', '°C', -10, 100, 20),
};
/** @type {import("./schema.js").Rule} */
const hotRule = {
  type: 'less',
  left: 'cold',
  right: 'hot',
  field: 'cold',
  message: 'Cold-side temperature must be below hot-side temperature.',
};
export function effectiveness(ntu, ratio, arrangement) {
  return arrangement === 'parallel'
    ? -Math.expm1(-ntu * (1 + ratio)) / (1 + ratio)
    : Math.abs(ratio - 1) < 1e-9
      ? ntu / (1 + ntu)
      : -Math.expm1(-ntu * (1 - ratio)) / (1 - ratio * Math.exp(-ntu * (1 - ratio)));
}
export const thermofluidModels = {
  bernoulli: lab(
    {
      id: 'bernoulli',
      title: 'Bernoulli Energy Balance',
      discipline: 'thermofluids',
      lab: 'TF01',
      topic: 'Fluid mechanics',
      inputs: {
        pressure: p('Inlet gauge pressure', 'kPa', 0, 500, 150),
        flow: p('Volume flow', 'L/s', 0.1, 20, 5),
        inlet: p('Inlet diameter', 'mm', 30, 200, 100),
        outlet: p('Outlet diameter', 'mm', 20, 200, 50),
        rise: p('Elevation rise', 'm', -5, 10, 2),
      },
      metrics: {
        outlet: ['Outlet gauge pressure', 'kPa'],
        velocity: ['Outlet speed', 'm/s'],
        head: ['Total inlet head', 'm'],
      },
      plot: {
        x: 'Distance fraction',
        xUnit: '',
        y: 'Gauge pressure',
        yUnit: 'kPa',
        traces: { y: 'Static pressure' },
      },
      text: [
        'Trade pressure, velocity, and elevation along an ideal water streamline.',
        'At fixed flow, what does a smaller outlet do to its speed?',
        ['It increases speed', 'It reduces speed', 'It fixes speed at zero'],
        'Continuity gives v = Q/A; area decreases with the square of diameter.',
        'At 5 L/s, a 100 mm inlet has speed 0.6366 m/s; a 50 mm outlet has speed 2.5465 m/s. With a 2 m rise, 150 kPa falls to about 127.34 kPa.',
        'p/(ρg) + v²/(2g) + z = constant; v = Q/A. Pressure is gauge, elevation rises from inlet to outlet.',
        'Steady incompressible water, ρ=1000 kg/m³, no friction, pump or turbine. A cavitation warning uses 101.325 kPa atmospheric and approximately 2.34 kPa vapor pressure at 20°C.',
      ],
    },
    ({ pressure, flow, inlet, outlet, rise }) => {
      const q = flow / 1000,
        v1 = q / area(inlet),
        v2 = q / area(outlet),
        p2 = pressure + (rho * (v1 ** 2 - v2 ** 2)) / 2000 - (rho * g * rise) / 1000;
      return {
        summary: {
          outlet: p2,
          velocity: v2,
          head: (pressure * 1000) / (rho * g) + v1 ** 2 / (2 * g),
        },
        series: samples(0, 1, (x) => ({
          y:
            pressure +
            (rho * (v1 ** 2 - (q / area(inlet + x * (outlet - inlet))) ** 2)) / 2000 -
            (rho * g * rise * x) / 1000,
        })),
        visualization: {
          type: 'flow',
          inlet,
          outlet,
          left: `${pressure.toFixed(1)} kPa`,
          right: `${p2.toFixed(2)} kPa`,
          detail: `Q ${flow} L/s · rise ${rise} m`,
        },
        warnings:
          p2 + 101.325 < 2.34
            ? [
                'Predicted absolute pressure is below the assumed vapor pressure. Single-phase Bernoulli flow is no longer a valid description.',
              ]
            : [],
        table: table(
          'Inlet / outlet energy terms',
          ['Station', 'Speed (m/s)', 'Pressure head (m)', 'Elevation (m)'],
          [
            ['Inlet', v1, (pressure * 1000) / (rho * g), 0],
            ['Outlet', v2, (p2 * 1000) / (rho * g), rise],
          ],
        ),
      };
    },
  ),
  venturi: lab(
    {
      id: 'venturi',
      title: 'Venturi Flow Meter',
      discipline: 'thermofluids',
      lab: 'TF02',
      topic: 'Fluid mechanics',
      inputs: {
        inlet: p('Pipe diameter', 'mm', 30, 200, 100),
        throat: p('Throat diameter', 'mm', 10, 150, 50),
        drop: p('Measured pressure difference', 'kPa', 0.1, 100, 10),
        coefficient: p('Discharge coefficient', '', 0.6, 1, 0.98),
      },
      rules: [
        {
          type: 'less',
          left: 'throat',
          right: 'inlet',
          field: 'throat',
          message: 'The throat diameter must be smaller than the pipe diameter.',
        },
      ],
      metrics: {
        flow: ['Measured volume flow', 'L/s'],
        velocity: ['Throat speed', 'm/s'],
        ideal: ['Ideal volume flow', 'L/s'],
      },
      plot: {
        x: 'Pressure difference',
        xUnit: 'kPa',
        y: 'Volume flow',
        yUnit: 'L/s',
        traces: { y: 'With discharge coefficient', reference: 'Ideal' },
      },
      text: [
        'Infer water flow from the pressure decrease through a Venturi throat.',
        'If pressure difference quadruples, what happens to flow?',
        ['It doubles', 'It quadruples', 'It halves'],
        'The inferred flow is proportional to the square root of the pressure difference.',
        'For 100/50 mm diameters, Δp=10 kPa and Cd=0.98, flow is approximately 8.8876 L/s.',
        'Q = Cd At √[2Δp/(ρ(1−β⁴))], β=Dt/D. The reference curve uses Cd=1.',
        'Horizontal, incompressible water at ρ=1000 kg/m³. Cd is prescribed; this lab does not model its Reynolds-number dependence or instrument uncertainty.',
      ],
    },
    ({ inlet, throat, drop, coefficient }) => {
      const ideal = (d) =>
          area(throat) * Math.sqrt((2 * d * 1000) / (rho * (1 - (throat / inlet) ** 4))) * 1000,
        flow = coefficient * ideal(drop);
      return {
        summary: { flow, ideal: ideal(drop), velocity: flow / 1000 / area(throat) },
        series: samples(0, 2 * drop, (x) => ({ y: coefficient * ideal(x), reference: ideal(x) })),
        visualization: {
          type: 'flow',
          inlet,
          outlet: throat,
          left: `D ${inlet} mm`,
          right: `Dt ${throat} mm`,
          detail: `Δp ${drop} kPa · Cd ${coefficient}`,
        },
      };
    },
  ),
  pipeloss: lab(
    {
      id: 'pipeloss',
      title: 'Pipe Pressure Loss',
      discipline: 'thermofluids',
      lab: 'TF03',
      topic: 'Internal flow',
      inputs: {
        length: p('Pipe length', 'm', 1, 500, 20),
        diameter: p('Inside diameter', 'mm', 10, 500, 50),
        flow: p('Volume flow', 'L/s', 0.1, 20, 2),
        roughness: p('Absolute roughness', 'mm', 0, 1, 0.045),
        viscosity: p('Dynamic viscosity', 'mPa·s', 0.1, 20, 1),
      },
      metrics: {
        loss: ['Pressure loss', 'kPa'],
        reynolds: ['Reynolds number', ''],
        friction: ['Darcy friction factor', ''],
        power: ['Hydraulic pumping power', 'W'],
      },
      plot: { x: 'Pipe distance', xUnit: 'm', y: 'Accumulated pressure loss', yUnit: 'kPa' },
      text: [
        'Connect Reynolds number, roughness, friction factor, and pumping demand.',
        'In laminar flow, does roughness enter the friction-factor formula?',
        ['No', 'Yes, linearly', 'Only at zero velocity'],
        'The fully developed laminar Darcy factor is 64/Re.',
        'At 2 L/s through a 50 mm, 20 m pipe with water viscosity 1 mPa·s, Re≈50,930. Haaland predicts a pressure loss near 4.8 kPa.',
        'Δp = f(L/D)ρv²/2. Laminar f=64/Re; turbulent 1/√f=−1.8 log10[(ε/(3.7D))^1.11+6.9/Re]. Power = Δp Q.',
        'Steady fully developed water flow. Minor losses and elevation are excluded. Between Re=2300 and 4000 the factors are blended for continuity and flagged as uncertain.',
      ],
    },
    ({ length, diameter, flow, roughness, viscosity }) => {
      const d = diameter / 1000,
        q = flow / 1000,
        v = q / area(diameter),
        re = (rho * v * d) / (viscosity / 1000);
      const turbulent = (r) =>
        (-1.8 * Math.log10((roughness / 1000 / d / 3.7) ** 1.11 + 6.9 / r)) ** -2;
      const f =
        re <= 2300
          ? 64 / re
          : re >= 4000
            ? turbulent(re)
            : ((64 / 2300) * (4000 - re)) / 1700 + (turbulent(4000) * (re - 2300)) / 1700;
      const loss = (((f * length) / d) * rho * v ** 2) / 2000;
      return {
        summary: { loss, reynolds: re, friction: f, power: loss * 1000 * q },
        series: samples(0, length, (x) => ({ y: (loss * x) / length })),
        warnings:
          re > 2300 && re < 4000
            ? [
                'Transitional flow: the interpolated friction factor is illustrative and should not be used for design.',
              ]
            : [],
        visualization: {
          type: 'flow',
          inlet: diameter,
          outlet: diameter,
          left: 'Inlet',
          right: `Loss ${loss.toFixed(2)} kPa`,
          detail: `Re ${Math.round(re)} · ${re < 2300 ? 'laminar' : re > 4000 ? 'turbulent' : 'transitional'}`,
        },
      };
    },
  ),
  wall: lab(
    {
      id: 'wall',
      title: 'Composite Wall Conduction',
      discipline: 'thermofluids',
      lab: 'TF04',
      topic: 'Heat transfer',
      inputs: {
        first: p('Layer 1 thickness', 'm', 0.01, 0.3, 0.1),
        second: p('Layer 2 thickness', 'm', 0.01, 0.3, 0.05),
        k1: p('Layer 1 conductivity', 'W/(m·K)', 0.1, 10, 1),
        k2: p('Layer 2 conductivity', 'W/(m·K)', 0.02, 5, 0.5),
        ...temperatures,
      },
      rules: [hotRule],
      metrics: {
        flux: ['Heat flux', 'W/m²'],
        interface: ['Interface temperature', '°C'],
        resistance: ['Thermal resistance per area', 'm²·K/W'],
      },
      plot: { x: 'Wall depth', xUnit: 'm', y: 'Temperature', yUnit: '°C' },
      text: [
        'Follow the temperature drop across two thermal resistances in series.',
        'Which layer takes the larger temperature drop?',
        ['The layer with larger L/k', 'Always the thicker layer', 'Always the hotter layer'],
        'The same heat flux passes through both layers; each drop equals q″ L/k.',
        'For L1=0.1 m, k1=1, L2=0.05 m, k2=0.5 and 100/20°C boundaries, q″=400 W/m² and the interface is 60°C.',
        'R″ = L1/k1 + L2/k2; q″=(Th−Tc)/R″; Ti=Th−q″L1/k1.',
        'One-dimensional steady conduction, constant conductivity, perfect contact, and no internal generation. Boundary temperatures are prescribed; convection/contact resistances are excluded.',
      ],
    },
    ({ first, second, k1, k2, hot, cold }) => {
      const resistance = first / k1 + second / k2,
        flux = (hot - cold) / resistance,
        boundary = hot - (flux * first) / k1;
      return {
        summary: { flux, interface: boundary, resistance },
        series: samples(0, first + second, (x) => ({
          y: x <= first ? hot - (flux * x) / k1 : boundary - (flux * (x - first)) / k2,
        })),
        visualization: {
          type: 'layers',
          labels: [`k₁ ${k1}`, `k₂ ${k2}`],
          values: [hot, boundary, cold],
          detail: `${flux.toFixed(2)} W/m² →`,
        },
        table: table(
          'Boundary temperatures',
          ['Location', 'Depth (m)', 'Temperature (°C)'],
          [
            ['Hot face', 0, hot],
            ['Interface', first, boundary],
            ['Cold face', first + second, cold],
          ],
        ),
      };
    },
  ),
  cooling: lab(
    {
      id: 'cooling',
      title: 'Lumped Transient Cooling',
      discipline: 'thermofluids',
      lab: 'TF05',
      topic: 'Heat transfer',
      inputs: {
        mass: p('Body mass', 'kg', 0.1, 10, 1),
        capacity: p('Specific heat', 'J/(kg·K)', 100, 2000, 900),
        h: p('Convection coefficient', 'W/(m²·K)', 1, 200, 20),
        area: p('Exposed area', 'm²', 0.01, 1, 0.1),
        conductivity: p('Body conductivity', 'W/(m·K)', 10, 400, 200),
        initial: p('Initial temperature', '°C', 20, 300, 100),
        ambient: p('Ambient temperature', '°C', 0, 60, 20),
      },
      rules: [
        {
          type: 'less',
          left: 'ambient',
          right: 'initial',
          field: 'ambient',
          message:
            'Ambient temperature must be below the initial temperature for this cooling experiment.',
        },
      ],
      metrics: {
        tau: ['Thermal time constant', 's'],
        biot: ['Estimated Biot number', ''],
        final: ['Temperature at five time constants', '°C'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Temperature',
        yUnit: '°C',
        traces: { y: 'Body', reference: 'Ambient' },
      },
      text: [
        'Cool a uniform-temperature solid and check whether the lumped assumption is plausible.',
        'After one time constant, what fraction of the initial excess remains?',
        ['About 37%', 'About 63%', 'None'],
        'The temperature excess decays as exp(−t/τ).',
        'A 1 kg body with cp=900 J/(kg·K), h=20 and A=0.1 m² has τ=450 s. At 450 s, 100°C in 20°C air falls to 49.43°C.',
        'T(t)=T∞+(Ti−T∞)exp(−t/τ); τ=mcp/(hA). Bi=hLc/k, Lc=m/(ρA).',
        'Constant properties, uniform convection, no radiation. Density is fixed at 2700 kg/m³ for the Biot estimate. Bi≥0.1 triggers a warning: internal gradients may invalidate lumped cooling.',
      ],
    },
    ({ mass, capacity, h, area, conductivity, initial, ambient }) => {
      const tau = (mass * capacity) / (h * area),
        biot = (h * mass) / (2700 * area * conductivity);
      const series = samples(0, 5 * tau, (x) => ({
        y: ambient + (initial - ambient) * Math.exp(-x / tau),
        reference: ambient,
      }));
      return {
        summary: { tau, biot, final: series.at(-1).y },
        series,
        visualization: {
          type: 'thermal',
          hot: initial,
          cold: ambient,
          detail: `τ ${tau.toFixed(1)} s · Bi ${biot.toFixed(4)}`,
        },
        warnings:
          biot >= 0.1
            ? [
                'Biot number is at least 0.1. The uniform-temperature assumption may be inaccurate for this configuration.',
              ]
            : [],
      };
    },
  ),
  exchanger: lab(
    {
      id: 'exchanger',
      title: 'Heat Exchanger Effectiveness',
      discipline: 'thermofluids',
      lab: 'TF06',
      topic: 'Heat transfer',
      inputs: {
        hot: p('Hot inlet', '°C', 40, 200, 80),
        cold: p('Cold inlet', '°C', 0, 80, 20),
        hotCapacity: p('Hot heat-capacity rate', 'W/K', 100, 5000, 1000),
        coldCapacity: p('Cold heat-capacity rate', 'W/K', 100, 5000, 500),
        conductance: p('Overall UA', 'W/K', 50, 5000, 1000),
        arrangement: choice(
          'Flow arrangement',
          { counter: 'Counterflow', parallel: 'Parallel flow' },
          'counter',
        ),
      },
      rules: [hotRule],
      metrics: {
        effectiveness: ['Effectiveness', '%'],
        heat: ['Heat transfer rate', 'kW'],
        hotOutlet: ['Hot outlet', '°C'],
        coldOutlet: ['Cold outlet', '°C'],
      },
      plot: {
        x: 'Hot-stream distance fraction',
        xUnit: '',
        y: 'Fluid temperature',
        yUnit: '°C',
        traces: { y: 'Hot stream', reference: 'Cold stream' },
      },
      text: [
        'Compare parallel and counterflow using ε–NTU and resolved temperature profiles.',
        'Can a counterflow cold outlet be hotter than the hot outlet?',
        ['Yes', 'Never', 'Only if heat flows backward'],
        'Opposite flow directions allow this while maintaining a positive local temperature difference.',
        'With 80/20°C inlets, Ch=1000, Cc=500 W/K and UA=1000 W/K, counterflow gives ε≈77.46%, Q≈23.24 kW, and outlets near 56.76/66.48°C.',
        'NTU=UA/Cmin; Cr=Cmin/Cmax; Q=ε Cmin(Thi−Tci). Outlet changes are Q/Ch and Q/Cc. Counterflow ε=(1−e^(−NTU(1−Cr)))/(1−Cr e^(−NTU(1−Cr))).',
        'Steady two-stream exchanger with constant UA and heat capacities, no loss to ambient or phase change. Cr=1 uses ε=NTU/(1+NTU). Cold flow runs right-to-left in counterflow.',
      ],
    },
    ({ hot, cold, hotCapacity: ch, coldCapacity: cc, conductance: ua, arrangement }) => {
      const cmin = Math.min(ch, cc),
        e = effectiveness(ua / cmin, cmin / Math.max(ch, cc), arrangement),
        q = e * cmin * (hot - cold),
        ho = hot - q / ch,
        co = cold + q / cc;
      const counter = arrangement === 'counter',
        k = counter ? ua * (1 / cc - 1 / ch) : -ua * (1 / cc + 1 / ch);
      const series = samples(0, 1, (x) => {
        let difference, integral;
        if (Math.abs(k) < 1e-10) {
          difference = hot - co;
          integral = difference * x;
        } else if (k > 0) {
          const end = ho - cold;
          difference = end * Math.exp(k * (x - 1));
          integral = (end * (Math.exp(k * (x - 1)) - Math.exp(-k))) / k;
        } else {
          const start = counter ? hot - co : hot - cold;
          difference = start * Math.exp(k * x);
          integral = (start * Math.expm1(k * x)) / k;
        }
        const temperature = hot - (ua / ch) * integral;
        return { y: temperature, reference: temperature - difference };
      });
      return {
        summary: { effectiveness: e * 100, heat: q / 1000, hotOutlet: ho, coldOutlet: co },
        series,
        visualization: { type: 'exchanger', hot, cold, hotOutlet: ho, coldOutlet: co, counter },
        table: table(
          'Stream energy balance',
          ['Stream', 'Inlet (°C)', 'Outlet (°C)', 'Capacity rate (W/K)'],
          [
            ['Hot', hot, ho, ch],
            ['Cold', cold, co, cc],
          ],
        ),
      };
    },
  ),
  gasprocess: lab(
    {
      id: 'gasprocess',
      title: 'Ideal-Gas Expansion',
      discipline: 'thermofluids',
      lab: 'TF07',
      topic: 'Thermodynamics',
      inputs: {
        process: choice(
          'Process',
          { isothermal: 'Isothermal', isobaric: 'Isobaric', adiabatic: 'Reversible adiabatic' },
          'isothermal',
        ),
        moles: p('Amount of gas', 'mol', 0.1, 5, 1),
        temperature: p('Initial temperature', 'K', 250, 1000, 300),
        volume: p('Initial volume', 'L', 1, 20, 10),
        ratio: p('Expansion volume ratio', '', 1, 5, 2),
        gamma: p('Heat-capacity ratio γ', '', 1.2, 1.67, 1.4),
      },
      metrics: {
        work: ['Work done by gas', 'J'],
        heat: ['Heat supplied', 'J'],
        finalTemperature: ['Final temperature', 'K'],
        pressure: ['Final pressure', 'kPa'],
      },
      plot: { x: 'Volume', xUnit: 'L', y: 'Pressure', yUnit: 'kPa' },
      text: [
        'Compare pressure–volume paths and first-law energy transfers for an ideal gas.',
        'During a reversible adiabatic expansion, what happens to temperature?',
        ['It falls', 'It stays fixed', 'It rises'],
        'The gas does work without receiving heat, reducing internal energy.',
        'One mole at 300 K expanding isothermally from 10 L to 20 L does nRT ln 2≈1728.94 J of work; heat supplied equals that work.',
        'pV=nRT. Isothermal: W=nRT ln(Vf/Vi). Isobaric: W=pi(Vf−Vi). Adiabatic: pV^γ=constant. ΔU=nR(Tf−Ti)/(γ−1), Q=ΔU+W.',
        'Quasi-static expansion of a calorically perfect ideal gas. Work by the gas and heat into it are positive. R=8.314462618 J/(mol·K); phase change and irreversibility are excluded.',
      ],
    },
    ({ process, moles: n, temperature: t, volume: v, ratio, gamma }) => {
      const r = 8.314462618,
        initialPressure = (n * r * t) / v,
        exponent = process === 'isothermal' ? 1 : process === 'isobaric' ? 0 : gamma;
      const pressure = initialPressure / ratio ** exponent,
        finalTemperature = t * ratio ** (1 - exponent),
        work =
          process === 'isothermal'
            ? n * r * t * Math.log(ratio)
            : process === 'isobaric'
              ? n * r * t * (ratio - 1)
              : (n * r * (t - finalTemperature)) / (gamma - 1);
      const heat = (n * r * (finalTemperature - t)) / (gamma - 1) + work;
      return {
        summary: { work, heat, finalTemperature, pressure },
        series: samples(v, v * (ratio === 1 ? 1.001 : ratio), (x) => ({
          y: initialPressure * (v / x) ** exponent,
        })),
        visualization: {
          type: 'piston',
          ratio,
          temperature: finalTemperature,
          detail: `${process} · W ${work.toFixed(1)} J`,
        },
        table: table(
          'First-law audit',
          ['Quantity', 'Value (J)'],
          [
            ['Heat into gas Q', heat],
            ['Work by gas W', work],
            ['Internal-energy change ΔU', heat - work],
          ],
        ),
      };
    },
  ),
  carnot: lab(
    {
      id: 'carnot',
      title: 'Carnot Heat Engine',
      discipline: 'thermofluids',
      lab: 'TF08',
      topic: 'Energy systems',
      inputs: {
        hot: p('Hot reservoir', 'K', 400, 1200, 600),
        cold: p('Cold reservoir', 'K', 200, 500, 300),
        heat: p('Heat supplied per cycle', 'J', 100, 10000, 1000),
      },
      rules: [hotRule],
      metrics: {
        efficiency: ['Reversible efficiency', '%'],
        work: ['Work per cycle', 'J'],
        rejected: ['Rejected heat', 'J'],
      },
      plot: { x: 'Cold / hot temperature ratio', xUnit: '', y: 'Efficiency', yUnit: '%' },
      text: [
        'Balance heat and work at the reversible upper limit for a heat engine.',
        'Can a heat engine convert all supplied heat to work between finite positive reservoirs?',
        ['No', 'Yes, at any temperature', 'Only with more heat input'],
        'Carnot efficiency is 1−Tc/Th; rejected heat remains positive for Tc>0.',
        'A reversible engine between 600 and 300 K is 50% efficient. From 1000 J in, it produces 500 J work and rejects 500 J.',
        'η=1−Tc/Th; W=η Qh; Qc=Qh−W. Reservoir temperatures must be absolute kelvin.',
        'Reversible cyclic limit with fixed reservoirs. No real cycle, power rating or entropy generation is simulated. Actual engines have lower efficiency.',
      ],
    },
    ({ hot, cold, heat }) => ({
      summary: {
        efficiency: (1 - cold / hot) * 100,
        work: heat * (1 - cold / hot),
        rejected: (heat * cold) / hot,
      },
      series: samples(0.1, 0.99, (x) => ({ y: (1 - x) * 100 })),
      visualization: {
        type: 'energy',
        hot,
        cold,
        supplied: heat,
        work: heat * (1 - cold / hot),
        rejected: (heat * cold) / hot,
        unit: 'J',
        label: 'Heat engine',
      },
    }),
  ),
  refrigerator: lab(
    {
      id: 'refrigerator',
      title: 'Refrigeration COP',
      discipline: 'thermofluids',
      lab: 'TF09',
      topic: 'Energy systems',
      inputs: {
        cold: p('Cold reservoir', 'K', 250, 300, 270),
        hot: p('Hot reservoir', 'K', 305, 360, 310),
        load: p('Cooling load', 'W', 500, 5000, 2000),
      },
      metrics: {
        cop: ['Reversible cooling COP', ''],
        power: ['Minimum work rate', 'W'],
        rejected: ['Heat rejected', 'W'],
      },
      plot: { x: 'Temperature lift', xUnit: 'K', y: 'Cooling COP', yUnit: '' },
      text: [
        'Estimate the reversible work needed to move heat from cold to hot.',
        'How does increasing temperature lift affect reversible cooling COP?',
        ['It decreases COP', 'It increases COP', 'It leaves COP unchanged'],
        'COP=Tc/(Th−Tc), so a greater lift requires more work per unit of cooling.',
        'At Tc=270 K and Th=310 K, COP=6.75. A 2000 W cooling load needs at least 296.30 W work and rejects 2296.30 W.',
        'COP_R=Tc/(Th−Tc); Wdot=Qcdot/COP; Qhdot=Qcdot+Wdot.',
        'Reversible reservoir model, not a refrigerant property cycle. Compressor losses, superheat, pressure drop and finite heat-transfer approaches reduce real COP.',
      ],
    },
    ({ cold, hot, load }) => {
      const cop = cold / (hot - cold),
        power = load / cop;
      return {
        summary: { cop, power, rejected: load + power },
        series: samples(1, 80, (x) => ({ y: cold / x })),
        visualization: {
          type: 'energy',
          hot,
          cold,
          supplied: load,
          work: power,
          rejected: load + power,
          unit: 'W',
          label: 'Refrigerator',
          reverse: true,
        },
      };
    },
  ),
};

thermofluidModels.cooling.definition.presets = {
  'High Biot number: inspect model warning': { mass: 10, h: 200, area: 0.01, conductivity: 10 },
};
thermofluidModels.pipeloss.definition.presets = {
  'Laminar example': { diameter: 100, flow: 0.1, viscosity: 10 },
};
thermofluidModels.exchanger.definition.presets = {
  'Equal heat-capacity rates': { hotCapacity: 1000, coldCapacity: 1000 },
  'Parallel-flow comparison': { arrangement: 'parallel' },
};

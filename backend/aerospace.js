import { lab, p, samples, table, radians, degrees } from './lab-kit.js';
export const standardAtmosphere = (h) => {
  const temperature = 288.15 - 0.0065 * h,
    pressure = 101325 * (temperature / 288.15) ** (9.80665 / (287.05287 * 0.0065));
  return { temperature, pressure, density: pressure / (287.05287 * temperature) };
};
export const isentropic = (mach, gamma) => {
  const t = 1 / (1 + ((gamma - 1) * mach * mach) / 2);
  return {
    temperature: t,
    pressure: t ** (gamma / (gamma - 1)),
    density: t ** (1 / (gamma - 1)),
    area: (2 / (gamma + 1) / t) ** ((gamma + 1) / (2 * (gamma - 1))) / mach,
  };
};
export const aerospaceModels = {
  ballistic: lab(
    {
      id: 'ballistic',
      title: 'Ballistic Flight & Launch Geometry',
      discipline: 'aerospace',
      lab: 'AE01',
      topic: 'Flight mechanics',
      inputs: {
        speed: p('Launch speed', 'm/s', 1, 200, 50),
        angle: p('Launch elevation', '°', 5, 85, 45),
        height: p('Launch height', 'm', 0, 100, 0),
        gravity: p('Gravity', 'm/s²', 1, 20, 9.80665),
      },
      metrics: {
        range: ['Horizontal range', 'm'],
        apex: ['Peak altitude', 'm'],
        time: ['Flight time', 's'],
      },
      plot: { x: 'Horizontal distance', xUnit: 'm', y: 'Altitude', yUnit: 'm' },
      text: [
        'Resolve the launch velocity and follow an exact constant-gravity flight path to the ground.',
        'On level ground without drag, which angle maximizes range?',
        ['45°', '30°', '90°'],
        'For equal launch and landing heights, range is v² sin(2θ)/g.',
        'At 50 m/s and 45° from ground level with g=9.80665 m/s², range is about 254.929 m and flight time 7.2105 s.',
        'vx=v cosθ, vy=v sinθ. x=vx t; y=h+vy t−gt²/2. T=[vy+√(vy²+2gh)]/g; ymax=h+vy²/(2g).',
        'Point mass, constant gravity, flat ground, no air drag, lift, wind, Earth curvature or propulsion after launch. Angles are measured above horizontal. The final point is the ground crossing, not a fixed arbitrary viewing time.',
      ],
    },
    ({ speed: v, angle, height: h, gravity: g }) => {
      const vx = v * Math.cos(radians(angle)),
        vy = v * Math.sin(radians(angle)),
        time = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
      return {
        summary: { range: vx * time, apex: h + (vy * vy) / (2 * g), time },
        series: samples(
          0,
          time,
          (t) => ({ y: Math.max(0, h + vy * t - (g * t * t) / 2) }),
          320,
        ).map((point) => ({ ...point, x: point.x * vx })),
        visualization: {
          type: 'engineering-extension',
          kind: 'trajectory',
          vx,
          vy,
          height: h,
          gravity: g,
          time,
        },
        table: table(
          'Exact ballistic landmarks',
          ['Event', 'Time (s)', 'Horizontal distance (m)', 'Altitude (m)'],
          [
            ['Launch', 0, 0, h],
            ['Apex', vy / g, (vx * vy) / g, h + (vy * vy) / (2 * g)],
            ['Landing', time, vx * time, 0],
          ],
        ),
      };
    },
  ),
  dragpolar: lab(
    {
      id: 'dragpolar',
      title: 'Aircraft Drag Polar & Level Flight',
      discipline: 'aerospace',
      lab: 'AE02',
      topic: 'Aerodynamics',
      inputs: {
        weight: p('Aircraft weight', 'N', 1000, 100000, 10000),
        area: p('Wing reference area', 'm²', 5, 100, 16),
        density: p('Air density', 'kg/m³', 0.3, 1.4, 1.225),
        speed: p('Level-flight speed', 'm/s', 20, 180, 50),
        zero: p('Zero-lift drag coefficient', '', 0.01, 0.08, 0.025),
        induced: p('Induced-drag factor k', '', 0.02, 0.15, 0.05),
        maximum: p('Maximum usable lift coefficient', '', 0.8, 2.5, 1.5),
      },
      metrics: {
        lift: ['Required lift coefficient CL', ''],
        drag: ['Required thrust / drag', 'N'],
        ratio: ['Lift-to-drag ratio', ''],
      },
      plot: {
        x: 'Level-flight speed',
        xUnit: 'm/s',
        y: 'Drag force',
        yUnit: 'N',
        traces: { y: 'Total drag', reference: 'Parasite drag', other: 'Induced drag' },
      },
      text: [
        'Separate parasite and induced drag while enforcing lift equal to weight.',
        'As speed rises, what happens to induced drag in level flight?',
        ['It decreases', 'It increases with speed squared', 'It stays constant'],
        'The required lift coefficient falls as 1/v², so induced drag falls as 1/v².',
        'For W=10000 N, S=16 m², ρ=1.225 kg/m³ and v=50 m/s, CL≈0.40816. With CD0=0.025 and k=0.05, drag is 612.5+204.082≈816.582 N.',
        'q=ρv²/2; CL=W/(qS); CD=CD0+kCL²; D=qS CD. Parasite D0=qS CD0; induced Di=kW²/(qS).',
        'Steady level flight with a parabolic drag polar, fixed configuration and prescribed density. The curve is a conditional mathematical continuation where CL exceeds CLmax; a warning identifies an infeasible selected speed. No compressibility, stall dynamics or engine model.',
      ],
    },
    ({ weight: w, area: s, density: rho, speed, zero: c0, induced: k, maximum }) => {
      const forces = (v) => {
          const qs = 0.5 * rho * v * v * s;
          return { cl: w / qs, parasite: qs * c0, induced: (k * w * w) / qs };
        },
        at = forces(speed),
        series = samples(20, 180, (x) => {
          const f = forces(x);
          return { y: f.parasite + f.induced, reference: f.parasite, other: f.induced };
        });
      return {
        summary: {
          lift: at.cl,
          drag: at.parasite + at.induced,
          ratio: w / (at.parasite + at.induced),
        },
        series,
        visualization: {
          type: 'engineering-extension',
          kind: 'wing',
          weight: w,
          speed,
          area: s,
          density: rho,
          zero: c0,
          induced: k,
        },
        warnings:
          at.cl > maximum
            ? [
                'The selected level-flight speed requires CL above CLmax. The assumed unstalled level-flight operating point is not feasible.',
              ]
            : [],
        table: table(
          'Selected level-flight balance',
          ['Quantity', 'Value'],
          [
            ['Lift equals weight (N)', w],
            ['Parasite drag (N)', at.parasite],
            ['Induced drag (N)', at.induced],
            ['Minimum-drag speed (m/s)', Math.sqrt(((2 * w) / (rho * s)) * Math.sqrt(k / c0))],
          ],
        ),
      };
    },
  ),
  bankturn: lab(
    {
      id: 'bankturn',
      title: 'Coordinated Banked Turn',
      discipline: 'aerospace',
      lab: 'AE03',
      topic: 'Flight mechanics',
      inputs: {
        speed: p('True airspeed', 'm/s', 20, 200, 50),
        bank: p('Bank angle', '°', 5, 75, 30),
        stall: p('Unbanked stall speed', 'm/s', 10, 80, 25),
      },
      metrics: {
        radius: ['Turn radius', 'm'],
        load: ['Load factor', 'g'],
        rate: ['Heading rate', '°/s'],
      },
      plot: {
        x: 'Time through one turn',
        xUnit: 's',
        y: 'Horizontal position',
        yUnit: 'm',
        traces: { y: 'x coordinate', reference: 'y coordinate' },
      },
      text: [
        'Balance vertical lift and horizontal centripetal force in a constant-altitude turn.',
        'What happens to load factor as bank increases?',
        ['It increases', 'It decreases', 'It remains one'],
        'Maintaining altitude requires L cosφ=W, giving n=1/cosφ.',
        'At 50 m/s and 30° bank, load factor is 1.1547 g and turn radius is approximately 441.55 m.',
        'n=secφ, R=v²/(g tanφ), ω=g tanφ/v; banked stall speed=Vs,0√n. Coordinates x=R sin(ωt), y=R[1−cos(ωt)].',
        'Coordinated, still-air, constant-speed and constant-altitude turn at Earth gravity g=9.80665 m/s². Positive bank magnitude is used. No roll transient, wind, sideslip, power limit or structural certification; a stall-speed warning is explicit.',
      ],
    },
    ({ speed: v, bank, stall }) => {
      const phi = radians(bank),
        load = 1 / Math.cos(phi),
        omega = (9.80665 * Math.tan(phi)) / v,
        radius = v / omega,
        duration = (2 * Math.PI) / omega;
      return {
        summary: { radius, load, rate: degrees(omega) },
        series: samples(
          0,
          duration,
          (t) => ({
            y: radius * Math.sin(omega * t),
            reference: radius * (1 - Math.cos(omega * t)),
          }),
          320,
        ),
        visualization: {
          type: 'engineering-extension',
          kind: 'turn',
          radius,
          omega,
          bank,
          speed: v,
        },
        warnings:
          v < stall * Math.sqrt(load)
            ? [
                'Airspeed is below the model’s banked stall speed. The ideal level turn is not a feasible unstalled operating point.',
              ]
            : [],
        table: table(
          'Coordinated-turn checks',
          ['Quantity', 'Value', 'Unit'],
          [
            ['Load factor', load, 'g'],
            ['Banked stall speed', stall * Math.sqrt(load), 'm/s'],
            ['Full-circle time', duration, 's'],
          ],
        ),
      };
    },
  ),
  rocketequation: lab(
    {
      id: 'rocketequation',
      title: 'Ideal Rocket Equation & Mass Ratio',
      discipline: 'aerospace',
      lab: 'AE04',
      topic: 'Space propulsion',
      inputs: {
        initial: p('Initial wet mass', 'kg', 100, 10000, 1000),
        final: p('Final dry-plus-payload mass', 'kg', 10, 5000, 500),
        impulse: p('Specific impulse', 's', 100, 450, 300),
      },
      rules: [
        {
          type: 'less',
          left: 'final',
          right: 'initial',
          field: 'final',
          message: 'Final mass must be smaller than initial mass.',
        },
      ],
      metrics: {
        delta: ['Ideal velocity increment', 'm/s'],
        exhaust: ['Effective exhaust speed', 'm/s'],
        fraction: ['Propellant mass fraction', '%'],
      },
      plot: {
        x: 'Initial mass expelled',
        xUnit: '%',
        y: 'Accumulated ideal delta-v',
        yUnit: 'm/s',
      },
      text: [
        'Follow ideal velocity gain as a rocket expels a finite fraction of its initial mass.',
        'Does delta-v grow linearly with mass ratio?',
        ['No, it grows logarithmically', 'Yes', 'It is independent of mass ratio'],
        'Momentum conservation integrates to ve ln(m0/mf).',
        'For m0=1000 kg, mf=500 kg and Isp=300 s, ve=2941.995 m/s and Δv≈2039.236 m/s.',
        'Δv=ve ln(m0/mf), ve=g0 Isp, g0=9.80665 m/s². At expelled fraction f, m=m0(1−f) and Δv=−ve ln(1−f).',
        'Single ideal stage, constant effective exhaust speed, no gravity or aerodynamic losses, no launch trajectory, no staging or burn-rate model. Delta-v is a velocity budget, not altitude or achieved orbital speed.',
      ],
    },
    ({ initial: m0, final: mf, impulse }) => {
      const exhaust = 9.80665 * impulse,
        fraction = 1 - mf / m0,
        delta = exhaust * Math.log(m0 / mf);
      return {
        summary: { delta, exhaust, fraction: 100 * fraction },
        series: samples(0, 100 * fraction, (x) => ({ y: -exhaust * Math.log1p(-x / 100) })),
        visualization: {
          type: 'engineering-extension',
          kind: 'rocket',
          initial: m0,
          final: mf,
          exhaust,
        },
        table: table(
          'Single-stage ideal mass budget',
          ['Quantity', 'Value', 'Unit'],
          [
            ['Initial mass', m0, 'kg'],
            ['Final mass', mf, 'kg'],
            ['Propellant expelled', m0 - mf, 'kg'],
            ['Mass ratio', m0 / mf, ''],
            ['Delta-v', delta, 'm/s'],
          ],
        ),
      };
    },
  ),
  atmosphere: lab(
    {
      id: 'atmosphere',
      title: 'Standard Troposphere & Air Density',
      discipline: 'aerospace',
      lab: 'AE05',
      topic: 'Atmospheric flight',
      inputs: { altitude: p('Geopotential altitude', 'm', 0, 11000, 5000) },
      metrics: {
        temperature: ['Static temperature', '°C'],
        pressure: ['Static pressure', 'kPa'],
        density: ['Air density', 'kg/m³'],
      },
      plot: { x: 'Geopotential altitude', xUnit: 'm', y: 'Static pressure', yUnit: 'kPa' },
      text: [
        'Explore the lapse-rate layer of a dry standard atmosphere and its pressure-density relationship.',
        'Does standard air density increase with altitude here?',
        ['No, it decreases', 'Yes', 'It stays constant'],
        'Hydrostatic pressure falls with altitude; density follows p/(RT).',
        'At sea level the model gives 15°C, 101.325 kPa and about 1.225 kg/m³. At 11 km temperature is −56.5°C.',
        'T=T0−Lh, p=p0(T/T0)^[g0/(RL)], ρ=p/(RT). T0=288.15 K, p0=101325 Pa, L=0.0065 K/m, R=287.05287 J/(kg·K).',
        'Dry standard-atmosphere troposphere from 0 to 11 km geopotential altitude only. No weather, humidity, temperature offset, tropopause-above-11-km model or geometric-altitude correction.',
      ],
    },
    ({ altitude }) => {
      const at = standardAtmosphere(altitude),
        series = samples(0, 11000, (x) => ({ y: standardAtmosphere(x).pressure / 1000 }));
      return {
        summary: {
          temperature: at.temperature - 273.15,
          pressure: at.pressure / 1000,
          density: at.density,
        },
        series,
        visualization: { type: 'engineering-extension', kind: 'atmosphere' },
        table: table(
          'Standard troposphere reference stations',
          ['Altitude (m)', 'Temperature (°C)', 'Pressure (kPa)', 'Density (kg/m³)'],
          Array.from({ length: 12 }, (_, i) => {
            const h = i * 1000,
              v = standardAtmosphere(h);
            return [h, v.temperature - 273.15, v.pressure / 1000, v.density];
          }),
        ),
      };
    },
  ),
  isentropicflow: lab(
    {
      id: 'isentropicflow',
      title: 'Mach Number & Isentropic Nozzle Relations',
      discipline: 'aerospace',
      lab: 'AE06',
      topic: 'Compressible flow',
      inputs: {
        mach: p('Selected Mach number', '', 0.1, 3, 1),
        gamma: p('Specific-heat ratio γ', '', 1.1, 1.67, 1.4),
        temperature: p('Stagnation temperature', 'K', 200, 1500, 300),
        pressure: p('Stagnation pressure', 'kPa', 50, 1000, 100),
      },
      metrics: {
        temperature: ['Static temperature', 'K'],
        pressure: ['Static pressure', 'kPa'],
        area: ['Area ratio A/A*', ''],
      },
      plot: {
        x: 'Mach number',
        xUnit: '',
        y: 'Static / stagnation ratio',
        yUnit: '',
        traces: { y: 'Pressure ratio', reference: 'Temperature ratio', other: 'Density ratio' },
      },
      text: [
        'Compare static-to-stagnation ratios and the choked area relation across subsonic and supersonic states.',
        'Where is A/A* minimized?',
        ['At Mach one', 'At Mach zero', 'At the largest Mach number'],
        'The starred area is the sonic throat, where the isentropic area–Mach relation has its minimum.',
        'At M=1, γ=1.4, T0=300 K and p0=100 kPa, static T=250 K, p≈52.8282 kPa and A/A*=1.',
        'T/T0=[1+(γ−1)M²/2]⁻¹; p/p0=(T/T0)^[γ/(γ−1)]; ρ/ρ0=(T/T0)^[1/(γ−1)]; A/A*=(1/M){2[1+(γ−1)M²/2]/(γ+1)}^[(γ+1)/(2(γ−1))].',
        'Calorically perfect gas, constant γ, reversible adiabatic flow. No shocks, viscosity, heat addition or variable gas properties. An area ratio above one permits two branches; specifying Mach selects a state, not a unique complete nozzle solution.',
      ],
    },
    ({ mach, gamma, temperature, pressure }) => {
      const at = isentropic(mach, gamma);
      return {
        summary: {
          temperature: temperature * at.temperature,
          pressure: pressure * at.pressure,
          area: at.area,
        },
        series: samples(0.1, 3, (x) => {
          const r = isentropic(x, gamma);
          return { y: r.pressure, reference: r.temperature, other: r.density };
        }),
        visualization: {
          type: 'engineering-extension',
          kind: 'nozzle',
          gamma,
          temperature,
          pressure,
        },
        table: table(
          'Selected isentropic state',
          ['Quantity', 'Value'],
          [
            ['Mach number', mach],
            ['Temperature ratio', at.temperature],
            ['Pressure ratio', at.pressure],
            ['Density ratio', at.density],
            ['A/A*', at.area],
          ],
        ),
      };
    },
  ),
};
aerospaceModels.ballistic.definition.presets = {
  'Raised launch': { height: 50 },
  'Low-gravity launch': { gravity: 1.62 },
};
aerospaceModels.dragpolar.definition.presets = {
  'Stall-limit warning': { weight: 100000, speed: 20 },
};
aerospaceModels.bankturn.definition.presets = {
  'Steep bank': { bank: 60 },
  'Stall-limit warning': { speed: 20, bank: 60, stall: 25 },
};
aerospaceModels.rocketequation.definition.presets = {
  'Mass ratio ten': { initial: 1000, final: 100 },
};
aerospaceModels.atmosphere.definition.presets = {
  'Sea level': { altitude: 0 },
  'Troposphere ceiling': { altitude: 11000 },
};
aerospaceModels.isentropicflow.definition.presets = { 'Supersonic branch': { mach: 2 } };

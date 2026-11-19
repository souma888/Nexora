import {
  exploration as lab,
  p,
  integer,
  seq,
  teaching,
  output,
  trajectory,
  domain,
  requireValue,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'automotive', topic: 'Vehicle dynamics & energy', ...config }, solve);
export const magicFormula = (slip, B, C, D, E) =>
  D * Math.sin(C * Math.atan(B * slip - E * (B * slip - Math.atan(B * slip))));
export const vehicleModels = {
  quartercar: make(
    {
      id: 'quartercar',
      title: 'Quarter-Car Suspension Ride',
      inputs: {
        sprung: p('Sprung quarter-car mass', 'kg', 150, 600, 300),
        unsprung: p('Unsprung mass', 'kg', 20, 80, 40),
        spring: p('Suspension spring rate', 'kN/m', 10, 50, 20),
        damper: p('Suspension damping', 'kN·s/m', 0.3, 4, 1.5),
        tire: p('Tire vertical stiffness', 'kN/m', 100, 400, 180),
        bump: p('Road bump height', 'mm', 5, 60, 30),
        speed: p('Vehicle speed', 'm/s', 2, 25, 10),
      },
      metrics: {
        acceleration: ['Peak sprung acceleration', 'm/s²'],
        travel: ['Peak suspension displacement', 'mm'],
        load: ['Minimum total tire normal force', 'N'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Vertical displacement',
        yUnit: 'mm',
        traces: { y: 'Sprung mass', reference: 'Unsprung mass', third: 'Road' },
      },
      text: teaching(
        'Integrate a coupled sprung/unsprung quarter-car over a smooth one-meter bump and inspect ride, travel and contact load.',
        'Does a softer suspension always reduce every response measure?',
        ['No, ride and travel trade off', 'Yes', 'It eliminates wheel hop'],
        'Body isolation, suspension stroke and tire contact compete at different frequencies.',
        'The approximate uncoupled body frequency is √(ks/ms)/(2π); 20 kN/m and 300 kg give about 1.30 Hz.',
        'ms z̈s=−ks(zs−zu)−c(żs−żu); mu z̈u=ks(zs−zu)+c(żs−żu)−kt(zu−zr).',
        'Linear quarter-car deviations from static equilibrium, no bump stops or unilateral tire constraint. A negative reconstructed tire load flags where the linear contact assumption fails. Smooth raised-cosine road bump, RK4 dt=.00025 s.',
      ),
    },
    (a) => {
      const ks = a.spring * 1000,
        kt = a.tire * 1000,
        c = a.damper * 1000,
        duration = 1 / a.speed,
        road = (t) =>
          t >= 0.2 && t <= 0.2 + duration
            ? (a.bump / 2000) * (1 - Math.cos((2 * Math.PI * (t - 0.2)) / duration))
            : 0,
        f = (t, [zs, vs, zu, vu]) => [
          vs,
          (-ks * (zs - zu) - c * (vs - vu)) / a.sprung,
          vu,
          (ks * (zs - zu) + c * (vs - vu) - kt * (zu - road(t))) / a.unsprung,
        ],
        rows = trajectory(f, [0, 0, 0, 0], 5, 20000, 20),
        load = Math.min(
          ...rows.map((r) => (a.sprung + a.unsprung) * 9.80665 + kt * (road(r.t) - r.state[2])),
        );
      return output(
        {
          acceleration: Math.max(
            ...rows.map((r) =>
              Math.abs(f(r.t, [r.state[0], r.state[1], r.state[2], r.state[3]])[1]),
            ),
          ),
          travel: 1000 * Math.max(...rows.map((r) => Math.abs(r.state[0] - r.state[2]))),
          load,
        },
        rows.map((r) => ({
          x: r.t,
          y: r.state[0] * 1000,
          reference: r.state[2] * 1000,
          third: road(r.t) * 1000,
        })),
        'quarter-car',
        { ...a },
        [],
        load < 0
          ? [
              'The linear solution predicts loss of tire contact. A unilateral-contact model is required beyond that point.',
            ]
          : [],
      );
    },
  ),
  brakingtransfer: make(
    {
      id: 'brakingtransfer',
      title: 'Braking Distance and Weight Transfer',
      inputs: {
        speed: p('Initial speed', 'km/h', 10, 160, 100),
        friction: p('Road friction coefficient', '1', 0.1, 1.2, 0.8),
        reaction: p('Driver reaction time', 's', 0, 2.5, 1),
        mass: p('Vehicle mass', 'kg', 600, 2500, 1500),
        height: p('CG height', 'm', 0.2, 1, 0.55),
        wheelbase: p('Wheelbase', 'm', 2, 3.5, 2.7),
        front: p('Static front weight fraction', '%', 35, 65, 55),
      },
      validateValues: domain('height', (a) =>
        requireValue(
          a.front / 100 + (a.friction * a.height) / a.wheelbase < 1,
          'This combination lifts the rear axle; reduce friction or CG height.',
        ),
      ),
      metrics: {
        braking: ['Friction-limited braking distance', 'm'],
        stopping: ['Reaction plus braking distance', 'm'],
        frontload: ['Dynamic front normal load', 'N'],
        rearload: ['Dynamic rear normal load', 'N'],
      },
      plot: {
        x: 'Speed',
        xUnit: 'km/h',
        y: 'Stopping distance',
        yUnit: 'm',
        traces: { y: 'Total stopping', reference: 'Braking alone' },
      },
      text: teaching(
        'Separate reaction distance from ideal tire-limited deceleration and calculate axle normal-load transfer.',
        'Does doubling speed approximately quadruple braking distance?',
        ['Yes', 'No, it doubles', 'Only with zero reaction time'],
        'Kinetic energy and constant-deceleration braking distance scale as speed squared.',
        '100 km/h at μ=.8 gives braking distance about 49.18 m, before reaction distance.',
        'a=μg; dbrake=v²/(2μg); ΔN=mah/L; Nfront=mgf+ΔN.',
        'Level road, constant μ, ideal brake-force distribution/ABS and no aerodynamic drag or fade. Rear lift is rejected. Reaction distance is v·treaction; no claim of a road-design safety standard.',
      ),
    },
    (a) => {
      const v = a.speed / 3.6,
        g = 9.80665,
        front = a.mass * g * (a.front / 100 + (a.friction * a.height) / a.wheelbase);
      return output(
        {
          braking: (v * v) / (2 * a.friction * g),
          stopping: v * a.reaction + (v * v) / (2 * a.friction * g),
          frontload: front,
          rearload: a.mass * g - front,
        },
        seq(0, 160).map((x) => ({
          x,
          y: (x / 3.6) * a.reaction + (x / 3.6) ** 2 / (2 * a.friction * g),
          reference: (x / 3.6) ** 2 / (2 * a.friction * g),
        })),
        'vehicle-loads',
        { ...a, frontload: front },
      );
    },
  ),
  tireslip: make(
    {
      id: 'tireslip',
      title: 'Tire Slip and the Magic Formula',
      inputs: {
        slip: p('Longitudinal slip ratio', '%', -30, 30, 10),
        stiffness: p('Stiffness factor B', '1', 5, 20, 10),
        shape: p('Shape factor C', '1', 1.1, 2, 1.65),
        curvature: p('Curvature factor E', '1', 0, 1, 0.97),
        friction: p('Peak friction μ', '1', 0.2, 1.2, 0.9),
        load: p('Normal tire load', 'N', 1000, 8000, 4000),
      },
      metrics: {
        force: ['Signed longitudinal force', 'N'],
        peak: ['Sampled peak-force slip', '%'],
        slope: ['Small-slip stiffness', 'N per unit slip'],
      },
      plot: { x: 'Longitudinal slip', xUnit: '%', y: 'Tire force', yUnit: 'N' },
      text: teaching(
        'Evaluate the empirical Pacejka-style pure-longitudinal Magic Formula with editable shape coefficients.',
        'Does force continue growing linearly at large slip?',
        ['No', 'Yes', 'Only for braking'],
        'The nonlinear curve saturates and can fall beyond its peak.',
        'The tangent at zero slip is BCD, where D=μFz.',
        'Fx=D sin[C atan(Bκ−E(Bκ−atanBκ))]; D=μFz.',
        'Illustrative uncalibrated pure-slip coefficients, constant normal load and no combined lateral force, temperature, load sensitivity or relaxation dynamics. Positive slip denotes driving, negative braking.',
      ),
    },
    (a) => {
      const D = a.friction * a.load,
        f = (x) => magicFormula(x / 100, a.stiffness, a.shape, D, a.curvature),
        s = seq(-30, 30, 600).map((x) => ({ x, y: f(x) })),
        peak = s.filter((v) => v.x >= 0).reduce((x, y) => (x.y > y.y ? x : y));
      return output(
        { force: f(a.slip), peak: peak.x, slope: a.stiffness * a.shape * D },
        s,
        'tire',
        { ...a },
      );
    },
  ),
  understeer: make(
    {
      id: 'understeer',
      title: 'Understeer Gradient in the Bicycle Model',
      inputs: {
        mass: p('Vehicle mass', 'kg', 700, 2500, 1500),
        wheelbase: p('Wheelbase', 'm', 2, 3.5, 2.7),
        front: p('Static front weight fraction', '%', 35, 65, 55),
        cf: p('Front axle cornering stiffness', 'kN/rad', 30, 150, 70),
        cr: p('Rear axle cornering stiffness', 'kN/rad', 30, 150, 80),
        radius: p('Turn radius', 'm', 30, 200, 80),
        speed: p('Speed', 'km/h', 10, 120, 60),
      },
      metrics: {
        gradient: ['Understeer gradient', '°/g'],
        steer: ['Linear steady steering angle', '°'],
        critical: ['Oversteer critical speed, if present', 'km/h'],
        acceleration: ['Lateral acceleration', 'g'],
      },
      plot: { x: 'Speed', xUnit: 'km/h', y: 'Required road-wheel steering', yUnit: '°' },
      text: teaching(
        'Compute the steady-state linear bicycle steering balance and identify understeer, neutral steer or oversteer.',
        'Does a negative understeer gradient imply a finite linear-model critical speed?',
        ['Yes', 'No', 'Only if both stiffnesses are zero'],
        'The yaw-rate denominator L+K v²/g can vanish for K<0.',
        'Equal front/rear load fractions and equal axle stiffnesses yield K=0 and δ=L/R independent of speed.',
        'K=Wf/Cf−Wr/Cr; δ=L/R+K v²/(gR); vcrit=√(−gL/K), K<0.',
        'Small-slip steady bicycle model, axle stiffnesses in N/rad. Tire saturation and transient yaw stability are not simulated; high lateral acceleration is flagged as outside the useful linear range.',
      ),
    },
    (a) => {
      const g = 9.80665,
        K = a.mass * g * (a.front / 100 / (a.cf * 1000) - (1 - a.front / 100) / (a.cr * 1000)),
        v = a.speed / 3.6,
        delta = (x) =>
          ((a.wheelbase / a.radius + (K * (x / 3.6) ** 2) / (g * a.radius)) * 180) / Math.PI,
        ay = (v * v) / (g * a.radius);
      return output(
        {
          gradient: (K * 180) / Math.PI,
          steer: delta(a.speed),
          critical: K < 0 ? Math.sqrt((-g * a.wheelbase) / K) * 3.6 : null,
          acceleration: ay,
        },
        seq(0, 120).map((x) => ({ x, y: delta(x) })),
        'bicycle',
        { ...a },
        [],
        ay > 0.4
          ? [
              'Lateral acceleration exceeds 0.4 g; constant cornering stiffness may no longer be credible.',
            ]
          : [],
      );
    },
  ),
  powertrain: make(
    {
      id: 'powertrain',
      title: 'Powertrain Gear Ratios and Tractive Effort',
      inputs: {
        torque: p('Flat engine torque', 'N·m', 50, 500, 200),
        power: p('Engine maximum power', 'kW', 30, 300, 100),
        final: p('Final drive ratio', '1', 2, 5, 3.5),
        radius: p('Tire rolling radius', 'm', 0.25, 0.4, 0.31),
        efficiency: p('Driveline efficiency', '1', 0.7, 1, 0.9),
        speed: p('Selected road speed', 'km/h', 10, 160, 60),
        gear: p('Selected gear ratio', '1', 0.6, 4, 2),
      },
      metrics: {
        rpm: ['Engine speed in selected gear', 'rpm'],
        force: ['Power-capped wheel force', 'N'],
        wheel: ['Delivered wheel torque', 'N·m'],
      },
      plot: {
        x: 'Road speed',
        xUnit: 'km/h',
        y: 'Tractive effort',
        yUnit: 'N',
        traces: { y: 'Selected gear', reference: '3.5:1 low gear', third: '1:1 direct gear' },
      },
      text: teaching(
        'Transform a flat-torque, power-limited engine envelope through selectable gearing into road force.',
        'Does a lower gear multiply force without increasing available power?',
        ['Yes', 'No', 'Only at zero efficiency'],
        'Gearing trades angular speed for torque while losses reduce transmitted power.',
        '200 N·m through total ratio seven at η=.9 and tire radius .3 m gives 4200 N before the power cap.',
        'ωengine=v·g·fd/r; Tengine=min(Tflat,Pmax/ω); Fwheel=ηTengine g fd/r.',
        'Illustrative flat-torque/power-cap engine envelope, rpm validity 800…6500, no clutch launch, tire traction limit, drag or shift optimization. Invalid-rpm curve points are null.',
      ),
    },
    (a) => {
      const state = (speed, gear) => {
          const omega = ((speed / 3.6) * gear * a.final) / a.radius,
            rpm = (omega * 60) / (2 * Math.PI),
            torque = Math.min(a.torque, (a.power * 1000) / omega);
          return {
            rpm,
            force:
              rpm >= 800 && rpm <= 6500
                ? (a.efficiency * torque * gear * a.final) / a.radius
                : null,
          };
        },
        r = state(a.speed, a.gear);
      return output(
        { rpm: r.rpm, force: r.force, wheel: r.force === null ? null : r.force * a.radius },
        seq(1, 180, 358).map((x) => ({
          x,
          y: state(x, a.gear).force,
          reference: state(x, 3.5).force,
          third: state(x, 1).force,
        })),
        'gears',
        { ...a },
      );
    },
  ),
  evrange: make(
    {
      id: 'evrange',
      title: 'EV Range and Regenerative Braking',
      inputs: {
        mass: p('Vehicle mass', 'kg', 800, 2500, 1700),
        battery: p('Usable battery energy', 'kWh', 20, 120, 60),
        speed: p('Cruise speed', 'km/h', 20, 140, 80),
        drag: p('Drag area CdA', 'm²', 0.3, 1, 0.6),
        rolling: p('Rolling resistance coefficient', '1', 0.005, 0.02, 0.01),
        auxiliary: p('Auxiliary load', 'kW', 0, 5, 1),
        stops: integer('Full-speed stops per 100 km', 0, 30, 5),
        regeneration: p('Kinetic-to-battery recovery fraction', '1', 0, 0.8, 0.6),
      },
      metrics: {
        consumption: ['Energy consumption', 'Wh/km'],
        range: ['Ideal usable-energy range', 'km'],
        recovery: ['Recovered energy per 100 km', 'kWh'],
      },
      plot: {
        x: 'Cruise speed',
        xUnit: 'km/h',
        y: 'Energy consumption',
        yUnit: 'Wh/km',
        traces: { y: 'With specified regeneration', reference: 'No regeneration' },
      },
      text: teaching(
        'Budget road-load, auxiliary and stop–start energy, counting acceleration demand before crediting regenerative braking.',
        'Does regenerative braking recover energy spent overcoming drag?',
        ['No', 'Yes', 'Only at high speed'],
        'Regeneration recovers part of the vehicle’s kinetic energy; drag and rolling work have already dissipated.',
        'At fixed speed, aerodynamic force is ½ρCdA v² and its Wh/km contribution rises with v².',
        'ecruise=(Crrmg+½ρCdA v²)/(3.6ηdrive)+1000Paux/Vkmh; estops=N(½mv²/3600)(1/ηdrive−ηregen)/100.',
        'Level still-air cruise at ρ=1.225 kg/m³, ηdrive=.9 and identical full-speed stops. No brake power cap, battery temperature/SOC limits, route grade or drive-cycle speed integration. Usable battery is supplied directly.',
      ),
    },
    (a) => {
      const calc = (speed, regen) => {
          const v = speed / 3.6,
            kinetic = (0.5 * a.mass * v * v) / 3600,
            base =
              (a.rolling * a.mass * 9.80665 + 0.5 * 1.225 * a.drag * v * v) / (3.6 * 0.9) +
              (1000 * a.auxiliary) / speed;
          return base + (a.stops * kinetic * (1 / 0.9 - regen)) / 100;
        },
        consumption = calc(a.speed, a.regeneration),
        recovery = ((a.stops * 0.5 * a.mass * (a.speed / 3.6) ** 2) / 3.6e6) * a.regeneration;
      return output(
        { consumption, range: (a.battery * 1000) / consumption, recovery },
        seq(20, 140).map((x) => ({ x, y: calc(x, a.regeneration), reference: calc(x, 0) })),
        'ev',
        { ...a },
      );
    },
  ),
};

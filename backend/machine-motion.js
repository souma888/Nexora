import {
  study,
  p,
  integer,
  choice,
  textInput,
  table,
  samples,
  systemVisual,
  checkInput,
  jsonNumbers,
} from './study-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  study({ discipline: 'mechanical', topic: 'Mechanisms & dynamics', ...config }, solve);
export function camLaw(profile, u) {
  if (profile === 'harmonic')
    return {
      s: (1 - Math.cos(Math.PI * u)) / 2,
      d: (Math.PI * Math.sin(Math.PI * u)) / 2,
      dd: (Math.PI ** 2 * Math.cos(Math.PI * u)) / 2,
      ddd: (-(Math.PI ** 3) * Math.sin(Math.PI * u)) / 2,
    };
  if (profile === 'cycloidal')
    return {
      s: u - Math.sin(2 * Math.PI * u) / (2 * Math.PI),
      d: 1 - Math.cos(2 * Math.PI * u),
      dd: 2 * Math.PI * Math.sin(2 * Math.PI * u),
      ddd: 4 * Math.PI ** 2 * Math.cos(2 * Math.PI * u),
    };
  return {
    s: 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5,
    d: 30 * u * u - 60 * u ** 3 + 30 * u ** 4,
    dd: 60 * u - 180 * u * u + 120 * u ** 3,
    ddd: 60 - 360 * u + 360 * u * u,
  };
}
export function sliderState(theta, r, l, omega) {
  const s = Math.sin(theta),
    c = Math.cos(theta),
    q = Math.sqrt(l * l - r * r * s * s);
  return {
    displacement: r * (1 - c) + l - q,
    velocity: omega * (r * s + (r * r * s * c) / q),
    acceleration:
      omega *
      omega *
      (r * c + (r * r * Math.cos(2 * theta)) / q + (r ** 4 * s * s * c * c) / q ** 3),
    pin: [r * c, r * s],
    piston: r * c + q,
    obliquity: Math.asin((r * s) / l),
  };
}
export const machineMotionModels = {
  camfollower: make(
    {
      id: 'camfollower',
      title: 'Cam–Follower Motion Profiles',
      inputs: {
        profile: choice(
          'Rise/return law',
          { harmonic: 'Simple harmonic', cycloidal: 'Cycloidal', polynomial: '3–4–5 polynomial' },
          'cycloidal',
        ),
        lift: p('Follower lift', 'mm', 1, 50, 20),
        rise: p('Rise / return angle', 'deg', 30, 120, 90),
        speed: p('Cam speed', 'rpm', 10, 1000, 120),
      },
      metrics: {
        velocity: ['Maximum sampled |velocity|', 'mm/s'],
        acceleration: ['Maximum sampled |acceleration|', 'mm/s²'],
        jerk: ['Maximum sampled |jerk| (SHM jumps excluded as undefined)', 'mm/s³'],
      },
      plot: { x: 'Cam angle', xUnit: 'deg', y: 'Follower displacement', yUnit: 'mm' },
      text: {
        description:
          'Compare complete rise–dwell–return–dwell cycles using analytical displacement derivatives and consistent angular-speed conversion.',
        predict:
          'Does a smooth-looking displacement curve guarantee finite jerk at a dwell transition?',
        answers: ['No, acceleration continuity must also be checked', 'Yes', 'Only for low speed'],
        explain:
          'Simple harmonic rise joins a dwell with a jump in acceleration, creating an ideal impulsive jerk at the junction.',
        example:
          'A 90° rise at 120 rpm takes 0.125 s. Cycloidal motion has zero velocity and acceleration at both ends of the rise.',
        equation: 'u=θ/β; v=hωs′(u)/β, a=hω²s″(u)/β², j=hω³s‴(u)/β³. Return uses h(1−s).',
        limits:
          'Rigid radial translating follower with prescribed motion, not a force/contact or pressure-angle solution. Rise begins at 0°, return at 180°, each lasts β. Jerk at SHM/dwell acceleration jumps is undefined, so its global peak is null; other maxima are sampled at 0.5°.',
      },
    },
    ({ profile, lift: h, rise, speed }) => {
      const beta = (rise * Math.PI) / 180,
        w = (speed * 2 * Math.PI) / 60,
        frames = Array.from({ length: 721 }, (_, i) => {
          const angle = i / 2,
            t = (angle * Math.PI) / 180;
          let law = { s: 0, d: 0, dd: 0, ddd: 0 };
          if (t <= beta) law = camLaw(profile, t / beta);
          else if (t < Math.PI) law.s = 1;
          else if (t <= Math.PI + beta) {
            const a = camLaw(profile, (t - Math.PI) / beta);
            law = { s: 1 - a.s, d: -a.d, dd: -a.dd, ddd: -a.ddd };
          }
          return {
            angle,
            displacement: h * law.s,
            velocity: ((h * w) / beta) * law.d,
            acceleration: ((h * w * w) / beta ** 2) * law.dd,
            jerk: ((h * w ** 3) / beta ** 3) * law.ddd,
            phase: t,
          };
        });
      return {
        summary: {
          velocity: Math.max(...frames.map((f) => Math.abs(f.velocity))),
          acceleration: Math.max(...frames.map((f) => Math.abs(f.acceleration))),
          jerk: profile === 'harmonic' ? null : Math.max(...frames.map((f) => Math.abs(f.jerk))),
        },
        series: frames.map((f) => ({ x: f.angle, y: f.displacement })),
        visualization: systemVisual('cam', { lift: h }, frames),
        table: table(
          'Kinematic samples',
          ['Angle deg', 'Lift mm', 'Velocity mm/s', 'Acceleration mm/s²', 'Interior jerk mm/s³'],
          frames
            .filter((_, i) => i % 10 === 0)
            .map((f) => [f.angle, f.displacement, f.velocity, f.acceleration, f.jerk]),
        ),
        warnings:
          profile === 'harmonic'
            ? [
                'SHM-to-dwell acceleration jumps give ideal impulsive jerk; no finite global peak jerk is claimed.',
              ]
            : [],
      };
    },
  ),
  slidercrank: make(
    {
      id: 'slidercrank',
      initialProbe: 'angle',
      title: 'Slider–Crank Kinematics and Piston Motion',
      inputs: {
        radius: p('Crank radius', 'mm', 5, 100, 50),
        rod: p('Connecting rod length', 'mm', 20, 500, 150),
        speed: p('Crank speed', 'rpm', 10, 3000, 600),
        angle: p('Inspection crank angle', 'deg', 0, 360, 60),
      },
      validateValues: checkInput('rod', (v) => {
        if (v.rod <= v.radius) throw Error('Connecting rod length must exceed crank radius.');
      }),
      metrics: {
        stroke: ['Piston stroke', 'mm'],
        displacement: ['Selected travel from TDC', 'mm'],
        velocity: ['Selected piston velocity', 'mm/s'],
        acceleration: ['Selected piston acceleration', 'mm/s²'],
        obliquity: ['Selected rod obliquity', 'deg'],
      },
      plot: { x: 'Crank angle', xUnit: 'deg', y: 'Travel from top dead center', yUnit: 'mm' },
      text: {
        description:
          'Use the exact connecting-rod closure to inspect piston travel and differentiate it without the long-rod approximation.',
        predict: 'Is piston velocity exactly sinusoidal when rod length is finite?',
        answers: [
          'No, rod obliquity adds higher-harmonic motion',
          'Yes',
          'Only at high crank speed',
        ],
        explain:
          'The square-root closure depends on sin²θ and changes the waveform from a pure sinusoid.',
        example: 'With r=50 mm the stroke is exactly 100 mm, regardless of a valid rod length.',
        equation: 'q=√(l²−r²sin²θ); x=r(1−cosθ)+l−q; v=ω dx/dθ; a=ω² d²x/dθ².',
        limits:
          'Rigid centered slider crank, constant input angular speed, l>r, no offset, compliance, inertia forces, friction or gas pressure. Positive displacement is measured from TDC toward BDC; the diagram uses the actual crank/rod geometry.',
      },
    },
    ({ radius: r, rod: l, speed, angle }) => {
      const w = (speed * 2 * Math.PI) / 60,
        selected = sliderState((angle * Math.PI) / 180, r, l, w),
        frames = Array.from({ length: 361 }, (_, i) => ({
          angle: i,
          phase: (i * Math.PI) / 180,
          ...sliderState((i * Math.PI) / 180, r, l, w),
        }));
      return {
        summary: {
          stroke: 2 * r,
          displacement: selected.displacement,
          velocity: selected.velocity,
          acceleration: selected.acceleration,
          obliquity: (selected.obliquity * 180) / Math.PI,
        },
        series: frames.map((f) => ({ x: f.angle, y: f.displacement })),
        visualization: systemVisual('slider', { radius: r, rod: l }, frames),
        table: table(
          'Exact crank samples',
          ['Angle deg', 'Travel mm', 'Velocity mm/s', 'Acceleration mm/s²'],
          frames
            .filter((_, i) => i % 10 === 0)
            .map((f) => [f.angle, f.displacement, f.velocity, f.acceleration]),
        ),
      };
    },
  ),
  flywheel: make(
    {
      id: 'flywheel',
      title: 'Flywheel Energy and Speed Fluctuation',
      inputs: {
        inertia: p('Flywheel inertia', 'kg·m²', 0.1, 100, 5),
        speed: p('Nominal RMS angular speed', 'rpm', 30, 3000, 300),
        torque: p('Alternating torque amplitude', 'N·m', 1, 500, 50),
        harmonic: integer('Torque cycles per shaft revolution', 1, 6, 2),
        target: p('Target approximate speed-fluctuation coefficient', '', 0.005, 0.2, 0.05),
      },
      validateValues: checkInput('inertia', (v) => {
        const w = (v.speed * 2 * Math.PI) / 60;
        if (v.inertia * w * w <= (2 * v.torque) / v.harmonic)
          throw Error(
            'Nominal kinetic energy must exceed the cyclic energy amplitude; otherwise this rotating solution reaches zero speed.',
          );
      }),
      metrics: {
        energy: ['Peak-to-peak energy fluctuation', 'J'],
        minimum: ['Minimum speed', 'rpm'],
        maximum: ['Maximum speed', 'rpm'],
        coefficient: ['Exact (ωmax−ωmin)/ωnom', '1'],
        required: ['Approximate inertia for target coefficient', 'kg·m²'],
      },
      plot: { x: 'Shaft angle', xUnit: 'deg', y: 'Shaft speed', yUnit: 'rpm' },
      text: {
        description:
          'Integrate a zero-mean cyclic torque into energy storage and recover the speed from kinetic energy.',
        predict: 'Does the small-fluctuation inertia formula remain exact for large speed swings?',
        answers: [
          'No, it linearizes the kinetic-energy relationship',
          'Yes',
          'Only for zero inertia',
        ],
        explain:
          'The exact response follows ω², while ΔE≈Iωmean²Cs assumes a small relative fluctuation.',
        example:
          'Torque amplitude 50 N·m at harmonic 2 gives peak-to-peak energy fluctuation 2×50/2=50 J.',
        equation:
          'T−Tload=A sin(nθ); E=E0−A cos(nθ)/n; ω=√[ωnom²−2A cos(nθ)/(nI)]; Iapprox=ΔE/(Csωnom²).',
        limits:
          'Prescribed net torque versus angle, no friction/loss, positive kinetic energy throughout. The nominal speed is the energy-based RMS angular speed over angle, not an exact time-average or arithmetic mean of extrema. The inertia target uses the standard small-fluctuation approximation.',
      },
    },
    ({ inertia: I, speed, torque: A, harmonic: n, target }) => {
      const w = (speed * 2 * Math.PI) / 60,
        min = Math.sqrt(w * w - (2 * A) / (n * I)),
        max = Math.sqrt(w * w + (2 * A) / (n * I)),
        frames = samples(0, 360, (deg) => ({
          y:
            (Math.sqrt(w * w - (2 * A * Math.cos((n * deg * Math.PI) / 180)) / (n * I)) * 60) /
            (2 * Math.PI),
        }));
      return {
        summary: {
          energy: (2 * A) / n,
          minimum: (min * 60) / (2 * Math.PI),
          maximum: (max * 60) / (2 * Math.PI),
          coefficient: (max - min) / w,
          required: (2 * A) / n / (target * w * w),
        },
        series: frames,
        visualization: systemVisual(
          'rotor',
          { speed },
          frames.map((f) => ({ phase: (f.x * Math.PI) / 180, speed: f.y })),
        ),
        table: table(
          'Energy-speed extrema',
          ['Minimum rad/s', 'Maximum rad/s', 'ΔE J', 'Target Cs'],
          [[min, max, (2 * A) / n, target]],
        ),
      };
    },
  ),
  clutchbrake: make(
    {
      id: 'clutchbrake',
      title: 'Friction Clutch and Brake Torque',
      inputs: {
        law: choice(
          'Contact-pressure assumption',
          { wear: 'Uniform wear', pressure: 'Uniform pressure' },
          'wear',
        ),
        inner: p('Inner friction radius', 'mm', 10, 150, 50),
        outer: p('Outer friction radius', 'mm', 30, 250, 100),
        force: p('Axial clamping force', 'N', 100, 10000, 2000),
        friction: p('Friction coefficient', '', 0.05, 0.6, 0.3),
        surfaces: integer('Active friction interfaces', 1, 8, 2),
        inertia: p('Braked rotational inertia', 'kg·m²', 0.1, 100, 2),
        speed: p('Initial rotational speed', 'rpm', 0, 3000, 600),
      },
      validateValues: checkInput('outer', (v) => {
        if (v.outer <= v.inner) throw Error('Outer friction radius must exceed inner radius.');
      }),
      metrics: {
        radius: ['Effective friction radius', 'mm'],
        torque: ['Friction torque capacity', 'N·m'],
        energy: ['Initial rotational energy', 'J'],
        time: ['Ideal constant-torque stopping time', 's'],
      },
      plot: { x: 'Axial force', xUnit: 'N', y: 'Torque capacity', yUnit: 'N·m' },
      text: {
        description:
          'Compare uniform-pressure and uniform-wear annular friction radii, then apply the resulting torque to an ideal braking stop.',
        predict: 'Which assumption uses arithmetic mean radius (Ro+Ri)/2?',
        answers: ['Uniform wear', 'Uniform pressure', 'Both for every radius ratio'],
        explain:
          'Uniform wear implies p·r is constant; integrating the annular traction gives the mean-radius expression.',
        example:
          'Ri=50 mm,Ro=100 mm gives uniform-wear effective radius 75 mm; two interfaces at μ=0.3,W=2000 N carry 90 N·m.',
        equation: 'T=nμWReff; Rwear=(Ro+Ri)/2; Rpressure=(2/3)(Ro³−Ri³)/(Ro²−Ri²); tstop=Iω0/T.',
        limits:
          'Constant dry-friction coefficient, constant axial force, annular flat interfaces and ideal constant braking torque. No thermal fade, centrifugal pressure change, transient engagement, cone amplification or wear evolution; energy is not a temperature prediction.',
      },
    },
    ({ law, inner, outer, force, friction, surfaces, inertia, speed }) => {
      const radius =
          law === 'wear'
            ? (inner + outer) / 2
            : ((2 / 3) * (outer ** 3 - inner ** 3)) / (outer ** 2 - inner ** 2),
        torque = (surfaces * friction * force * radius) / 1000,
        w = (speed * 2 * Math.PI) / 60;
      return {
        summary: { radius, torque, energy: 0.5 * inertia * w * w, time: (inertia * w) / torque },
        series: samples(0, 2 * force, (x) => ({ y: (torque * x) / force })),
        visualization: systemVisual('clutch', { inner, outer, torque, surfaces }),
        table: table(
          'Friction assumptions',
          ['Law', 'Effective radius mm', 'Interfaces', 'Torque Nm'],
          [[law, radius, surfaces, torque]],
        ),
      };
    },
  ),
  helicalspring: make(
    {
      id: 'helicalspring',
      title: 'Helical Spring Rate and Shear Stress',
      inputs: {
        wire: p('Wire diameter', 'mm', 2, 20, 8),
        diameter: p('Mean coil diameter', 'mm', 12, 150, 64),
        turns: p('Active coils', '', 2, 20, 8),
        modulus: p('Shear modulus', 'GPa', 20, 100, 79),
        load: p('Axial compressive load', 'N', 0, 3000, 1000),
      },
      validateValues: checkInput('diameter', (v) => {
        if (v.diameter / v.wire <= 3)
          throw Error('Use mean coil / wire diameter ratio greater than 3.');
      }),
      metrics: {
        rate: ['Spring rate', 'N/mm'],
        deflection: ['Elastic deflection', 'mm'],
        stress: ['Wahl-corrected wire shear stress', 'MPa'],
        index: ['Spring index C', '1'],
        solid: ['Approximate solid height, closed/ground ends', 'mm'],
      },
      plot: { x: 'Axial force', xUnit: 'N', y: 'Elastic deflection', yUnit: 'mm' },
      text: {
        description:
          'Calculate a close-coiled compression spring’s rate and combine curvature/direct-shear effects with a Wahl factor.',
        predict: 'At fixed mean coil diameter, what happens to stiffness if wire diameter doubles?',
        answers: ['It increases sixteenfold', 'It doubles', 'It halves'],
        explain: 'The close-coiled elastic rate scales with wire diameter to the fourth power.',
        example: 'For G=79 GPa,d=8 mm,D=64 mm,n=8, the rate is about 19.287 N/mm.',
        equation: 'k=Gd⁴/(8D³n); C=D/d; Kw=(4C−1)/(4C−4)+0.615/C; τ=Kw·8FD/(πd³).',
        limits:
          'Linear close-coiled circular wire, compression, active coil count supplied, no buckling, surge, fatigue, end seating or yield check. Solid height assumes total coils n+2 and closed/ground ends; free length is not specified, so coil-bind clearance cannot be checked.',
      },
    },
    ({ wire: d, diameter: D, turns: n, modulus, load: F }) => {
      const C = D / d,
        G = 1000 * modulus,
        rate = (G * d ** 4) / (8 * D ** 3 * n),
        K = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
      return {
        summary: {
          rate,
          deflection: F / rate,
          stress: (K * 8 * F * D) / (Math.PI * d ** 3),
          index: C,
          solid: (n + 2) * d,
        },
        series: samples(0, Math.max(2 * F, 100), (x) => ({ y: x / rate })),
        visualization: systemVisual('spring', { amplitude: F / rate, mass: 0 }),
        warnings:
          C > 12
            ? [
                'Spring index exceeds 12; manufacturing and stability assumptions deserve separate review.',
              ]
            : [],
      };
    },
  ),
  shaftcombined: make(
    {
      id: 'shaftcombined',
      title: 'Shaft Under Combined Bending and Torsion',
      inputs: {
        diameter: p('Solid circular shaft diameter', 'mm', 5, 150, 30),
        bending: p('Bending moment', 'N·m', 0, 2000, 200),
        torque: p('Torque', 'N·m', 0, 2000, 300),
        yield: p('Illustrative yield stress', 'MPa', 100, 1000, 350),
      },
      metrics: {
        bending: ['Outer-fiber bending stress', 'MPa'],
        shear: ['Torsional shear stress', 'MPa'],
        equivalent: ['Von Mises equivalent stress', 'MPa'],
        factor: ['Yield / von Mises (undefined unloaded)', '1'],
      },
      plot: { x: 'Shaft diameter', xUnit: 'mm', y: 'Von Mises stress', yUnit: 'MPa' },
      text: {
        description:
          'Combine nominal elastic outer-fiber bending stress and torsional shear with the von Mises criterion.',
        predict: 'Does doubling diameter reduce both nominal component stresses by eight?',
        answers: ['Yes', 'No, by two', 'Only torsional stress changes'],
        explain: 'Both 32M/(πd³) and 16T/(πd³) have cubic diameter dependence.',
        example: 'Pure torsion gives σVM=√3τ; pure bending gives σVM=|σb|.',
        equation:
          'σb=32M/(πd³), τ=16T/(πd³); σVM=√(σb²+3τ²). Moments are converted from N·m to N·mm.',
        limits:
          'Solid uniform circular shaft, nominal static elastic stresses at the most tensile bending fiber. No keyways, stress concentration, rotating-fatigue analysis, axial force, deflection or critical-speed assessment. Zero load has zero equivalent stress and undefined yield ratio.',
      },
    },
    ({ diameter: d, bending: M, torque: T, yield: yieldStress }) => {
      const b = (x) => (32000 * M) / (Math.PI * x ** 3),
        t = (x) => (16000 * T) / (Math.PI * x ** 3),
        vm = (x) => Math.hypot(b(x), Math.sqrt(3) * t(x)),
        stress = vm(d);
      return {
        summary: {
          bending: b(d),
          shear: t(d),
          equivalent: stress,
          factor: stress ? yieldStress / stress : null,
        },
        series: samples(Math.max(5, d / 2), Math.min(150, 1.5 * d), (x) => ({ y: vm(x) })),
        visualization: systemVisual('shaft', { bending: M, torque: T, diameter: d }),
      };
    },
  ),
  hertzcontact: make(
    {
      id: 'hertzcontact',
      title: 'Hertzian Sphere Contact Stress',
      inputs: {
        geometry: choice(
          'Contact pair',
          { plane: 'Sphere on an elastic plane', sphere: 'Two external spheres' },
          'plane',
        ),
        radius1: p('Sphere 1 radius', 'mm', 5, 200, 25),
        radius2: p('Sphere 2 radius', 'mm', 5, 200, 25),
        modulus1: p('Elastic modulus 1', 'GPa', 10, 400, 210),
        modulus2: p('Elastic modulus 2', 'GPa', 10, 400, 210),
        poisson: p('Poisson ratio (both bodies)', '', 0.1, 0.49, 0.3),
        force: p('Normal contact force', 'N', 1, 10000, 100),
      },
      metrics: {
        radius: ['Contact patch radius a', 'mm'],
        pressure: ['Maximum Hertz pressure p0', 'MPa'],
        approach: ['Elastic mutual approach', 'µm'],
        modulus: ['Reduced elastic modulus', 'GPa'],
      },
      plot: { x: 'Radius coordinate / a', xUnit: '', y: 'Pressure', yUnit: 'MPa' },
      text: {
        description:
          'Calculate a small circular elastic contact patch and the semi-ellipsoidal normal-pressure distribution.',
        predict: 'How does patch radius scale when normal load increases eightfold?',
        answers: ['It doubles', 'It increases eightfold', 'It halves'],
        explain: 'Hertz sphere contact radius is proportional to the cube root of load.',
        example:
          'For a steel sphere on an identical elastic half-space, reduced modulus is E/[2(1−ν²)].',
        equation:
          '1/E*=(1−ν1²)/E1+(1−ν2²)/E2; 1/R*=1/R1+1/R2; a=(3FR*/4E*)^(1/3); p0=3F/(2πa²); δ=a²/R*.',
        limits:
          'Frictionless nonconformal sphere contact, small strains, elastic isotropic half-spaces and a circular patch. Plane means infinite geometric radius, not infinite stiffness. Common Poisson ratio is supplied for both bodies. Large a/R* is flagged; no plasticity, adhesion, roughness or subsurface-life prediction.',
      },
    },
    ({ geometry, radius1, radius2, modulus1, modulus2, poisson: nu, force: F }) => {
      const R = 1 / (1000 / radius1 + (geometry === 'sphere' ? 1000 / radius2 : 0)),
        E = 1 / ((1 - nu * nu) / (modulus1 * 1e9) + (1 - nu * nu) / (modulus2 * 1e9)),
        a = Math.cbrt((3 * F * R) / (4 * E)),
        p0 = (3 * F) / (2 * Math.PI * a * a);
      return {
        summary: {
          radius: 1000 * a,
          pressure: p0 / 1e6,
          approach: ((a * a) / R) * 1e6,
          modulus: E / 1e9,
        },
        series: samples(-1, 1, (x) => ({ y: (p0 / 1e6) * Math.sqrt(Math.max(0, 1 - x * x)) })),
        visualization: systemVisual('contact', {
          radius1,
          radius2,
          geometry,
          patch: 1000 * a,
          force: F,
        }),
        warnings:
          a / R > 0.1
            ? [
                'Patch radius exceeds 10% of reduced curvature radius; small-contact Hertz assumptions are questionable.',
              ]
            : [],
      };
    },
  ),
  rotorbalance: make(
    {
      id: 'rotorbalance',
      title: 'Dynamic Balancing of Rotors',
      inputs: {
        unbalances: textInput(
          'Unbalances [[mass g,radius mm,angle deg,z mm],…]',
          '[[20,40,0,20],[15,50,120,80],[10,30,250,50]]',
          1800,
        ),
        spacing: p('Correction-plane spacing', 'mm', 20, 500, 100),
        radius: p('Correction mass radius in both planes', 'mm', 10, 150, 50),
        speed: p('Rotational speed', 'rpm', 0, 6000, 1000),
      },
      validateValues: checkInput('unbalances', (v) => {
        const a = jsonNumbers(v.unbalances, 1, 8, 4, 4, -1000, 1000);
        if (a.some((r) => r[0] <= 0 || r[1] <= 0))
          throw Error(
            'Mass and radius must be positive; angle and axial coordinate may be signed.',
          );
      }),
      metrics: {
        massA: ['Correction mass in plane z=0', 'g'],
        angleA: ['Correction phase A', 'deg'],
        massB: ['Correction mass in plane z=L', 'g'],
        angleB: ['Correction phase B', 'deg'],
        force: ['Residual synchronous force after correction', 'N'],
        couple: ['Residual synchronous couple after correction', 'N·m'],
      },
      plot: {
        x: 'Vector component',
        xUnit: '',
        y: 'Correction unbalance',
        yUnit: 'g·mm',
        traces: { y: 'Plane A', reference: 'Plane B' },
      },
      text: {
        description:
          'Resolve measured unbalance vectors and their axial moments, then solve for corrections in two separate planes.',
        predict:
          'Can one correction plane generally cancel both static unbalance and an independent unbalance couple?',
        answers: ['No, two independent planes are needed', 'Yes', 'Only at low speed'],
        explain:
          'Force balance and moment balance are independent vector conditions for a rigid rotor.',
        example:
          'A single unbalance placed at z=0 requires only an opposite vector in plane A; plane B correction is zero.',
        equation:
          'U=Σmr e^(iθ), C=Σzmr e^(iθ); UB=−C/L; UA=−U−UB; correction mass=|Uplane|/Rcorrection.',
        limits:
          'Rigid rotor, two-plane linear balancing with known mass-radius-phase data. Angles indicate where mass is added, not removed. No flexible-rotor modes, influence-coefficient measurements, trial-weight uncertainty or speed-dependent phase model.',
      },
    },
    ({ unbalances, spacing: L, radius: R, speed }) => {
      const a = jsonNumbers(unbalances, 1, 8, 4, 4, -1000, 1000),
        U = [0, 0],
        C = [0, 0];
      for (const [m, r, angle, z] of a) {
        const theta = (angle * Math.PI) / 180;
        for (let j = 0; j < 2; j++) {
          const u = m * r * (j ? Math.sin(theta) : Math.cos(theta));
          U[j] += u;
          C[j] += z * u;
        }
      }
      const B = C.map((v) => -v / L),
        A = U.map((v, j) => -v - B[j]),
        phase = (v) =>
          Math.hypot(...v) === 0 ? null : ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360,
        w = (speed * 2 * Math.PI) / 60,
        resF = Math.hypot(...U.map((v, j) => v + A[j] + B[j])) * 1e-6 * w * w,
        resC = Math.hypot(...C.map((v, j) => v + L * B[j])) * 1e-9 * w * w;
      return {
        summary: {
          massA: Math.hypot(...A) / R,
          angleA: phase(A),
          massB: Math.hypot(...B) / R,
          angleB: phase(B),
          force: resF,
          couple: resC,
        },
        series: [
          { x: 0, y: A[0], reference: B[0] },
          { x: 1, y: A[1], reference: B[1] },
        ],
        visualization: systemVisual('balance', { unbalances: a, A, B, spacing: L }),
        table: table(
          'Vector balance',
          ['Vector', 'Real g·mm', 'Imaginary g·mm'],
          [
            ['Original sum', ...U],
            ['Plane A', ...A],
            ['Plane B', ...B],
          ],
        ),
      };
    },
  ),
  rollingincline: make(
    {
      id: 'rollingincline',
      title: 'Rolling Without Slipping on an Incline',
      inputs: {
        body: choice(
          'Rolling body',
          {
            sphere: 'Solid sphere, I/(mR²)=2/5',
            cylinder: 'Solid cylinder, I/(mR²)=1/2',
            hoop: 'Thin hoop, I/(mR²)=1',
          },
          'cylinder',
        ),
        angle: p('Incline angle', 'deg', 1, 60, 20),
        friction: p('Available static friction coefficient', '', 0, 1, 0.4),
        time: p('Elapsed time from rest', 's', 0.1, 5, 2),
        radius: p('Body radius', 'mm', 10, 200, 50),
      },
      metrics: {
        acceleration: ['Valid no-slip acceleration', 'm/s²'],
        required: ['Minimum static friction coefficient', '1'],
        distance: ['Valid distance along slope', 'm'],
        speed: ['Valid center speed', 'm/s'],
        angular: ['Valid angular speed', 'rad/s'],
      },
      plot: { x: 'Time', xUnit: 's', y: 'Distance along incline', yUnit: 'm' },
      text: {
        description:
          'Share gravitational work between translation and rotation and check whether static friction can enforce the no-slip constraint.',
        predict: 'Does static friction dissipate energy in ideal rolling on a fixed plane?',
        answers: [
          'No, the contact point is instantaneously at rest',
          'Yes, always',
          'Only for a hoop',
        ],
        explain:
          'Ideal static contact does no slip work; it supplies the torque that accelerates rotation.',
        example: 'A solid cylinder has a=(2/3)g sinθ and requires μs≥tanθ/3.',
        equation: 'a=g sinθ/(1+β), β=I/(mR²); μrequired=β tanθ/(1+β); v=Rω.',
        limits:
          'Rigid circular body, initially at rest, fixed straight incline, no rolling resistance or air drag. If available static friction is insufficient, no-slip trajectory outputs are null; a sliding/kinetic-friction solution is deliberately not invented. The slope has no finite end in this model.',
      },
    },
    ({ body, angle, friction, time, radius }) => {
      const beta = body === 'sphere' ? 0.4 : body === 'hoop' ? 1 : 0.5,
        theta = (angle * Math.PI) / 180,
        a = (9.80665 * Math.sin(theta)) / (1 + beta),
        required = (beta * Math.tan(theta)) / (1 + beta),
        valid = friction >= required,
        series = samples(0, time, (t) => ({ y: valid ? 0.5 * a * t * t : null }));
      return {
        summary: {
          acceleration: valid ? a : null,
          required,
          distance: valid ? 0.5 * a * time * time : null,
          speed: valid ? a * time : null,
          angular: valid ? (a * time) / (radius / 1000) : null,
        },
        series,
        visualization: systemVisual(
          'incline',
          { angle, radius, valid },
          series.map((f) => ({
            time: f.x,
            distance: f.y,
            phase: valid ? (0.5 * a * f.x * f.x) / (radius / 1000) : 0,
          })),
        ),
        warnings: valid
          ? []
          : [
              'Static friction is insufficient for no-slip rolling. Trajectory and speed are undefined under this model.',
            ],
      };
    },
  ),
  collision: make(
    {
      id: 'collision',
      title: 'Collisions and Coefficient of Restitution',
      inputs: {
        mass1: p('Left body mass', 'kg', 0.1, 100, 2),
        mass2: p('Right body mass', 'kg', 0.1, 100, 3),
        velocity1: p('Initial left-body velocity', 'm/s', -10, 10, 4),
        velocity2: p('Initial right-body velocity', 'm/s', -10, 10, 0),
        restitution: p('Coefficient of restitution e', '', 0, 1, 0.6),
      },
      metrics: {
        velocity1: ['Left body post-contact velocity', 'm/s'],
        velocity2: ['Right body post-contact velocity', 'm/s'],
        momentum: ['Momentum residual after−before', 'kg·m/s'],
        loss: ['Kinetic energy dissipated', 'J'],
        collision: ['Approaching/contact impulse applied (1=yes)', '1'],
      },
      plot: {
        x: 'Time relative to contact',
        xUnit: 's',
        y: 'Signed body velocity',
        yUnit: 'm/s',
        traces: { y: 'Left body', reference: 'Right body' },
        step: true,
      },
      text: {
        description:
          'Solve a direct central impact from momentum conservation and restitution, or recognize when the bodies are not approaching.',
        predict: 'Does e=0 mean both bodies stop in the laboratory frame?',
        answers: ['No, they share the center-of-mass velocity', 'Yes', 'Only with unequal masses'],
        explain:
          'Zero restitution removes relative separation speed, while total momentum determines their common speed.',
        example: 'For m1=2,m2=3,u1=4,u2=0,e=0.6, post-impact velocities are 0.16 and 2.56 m/s.',
        equation: 'm1v1+m2v2=m1u1+m2u2; v2−v1=e(u1−u2); ΔKE=½[m1m2/(m1+m2)](1−e²)(u1−u2)².',
        limits:
          'One-dimensional instantaneous central impact, no external impulse, rotation or deformation history. The left/right ordering requires u1>u2 to approach; otherwise velocities are unchanged and no impact is applied. Restitution is supplied, not predicted from material properties.',
      },
    },
    ({ mass1: m1, mass2: m2, velocity1: u1, velocity2: u2, restitution: e }) => {
      const approaching = u1 > u2,
        p = m1 * u1 + m2 * u2,
        v1 = approaching ? (p - m2 * e * (u1 - u2)) / (m1 + m2) : u1,
        v2 = approaching ? (p + m1 * e * (u1 - u2)) / (m1 + m2) : u2,
        loss = approaching ? ((0.5 * m1 * m2) / (m1 + m2)) * (1 - e * e) * (u1 - u2) ** 2 : 0,
        series = samples(-0.5, 0.5, (t) => ({ y: t < 0 ? u1 : v1, reference: t < 0 ? u2 : v2 }));
      return {
        summary: {
          velocity1: v1,
          velocity2: v2,
          momentum: m1 * v1 + m2 * v2 - p,
          loss,
          collision: +approaching,
        },
        series,
        visualization: systemVisual(
          'collision',
          { mass1: m1, mass2: m2 },
          series.map((f) => ({
            time: f.x,
            left: f.x * (f.x < 0 ? u1 : v1),
            right: f.x * (f.x < 0 ? u2 : v2),
            velocity1: f.y,
            velocity2: f.reference,
          })),
        ),
        warnings: approaching
          ? []
          : [
              'Bodies are not approaching in the stated left/right ordering; no collision impulse is applied.',
            ],
      };
    },
  ),
};

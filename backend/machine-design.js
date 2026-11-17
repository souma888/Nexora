import {
  study,
  p,
  integer,
  choice,
  table,
  samples,
  systemVisual,
  checkInput,
} from './study-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  study({ discipline: 'mechanical', topic: 'Machine design', ...config }, solve);
const teeth1 = integer('Pinion / sun teeth', 12, 100, 20),
  teeth2 = integer('Driven gear / planet teeth', 12, 120, 40);
export const machineDesignModels = {
  spurgear: make(
    {
      id: 'spurgear',
      title: 'Spur Gear Geometry and Contact Ratio',
      inputs: {
        module: p('Module', 'mm', 0.5, 20, 3),
        teeth1,
        teeth2,
        pressure: p('Pressure angle', 'deg', 14.5, 25, 20),
      },
      metrics: {
        center: ['Standard center distance', 'mm'],
        contact: ['Transverse contact ratio', '1'],
        basepitch: ['Base pitch', 'mm'],
        ratio: ['Driven / driver tooth ratio', '1'],
      },
      plot: { x: 'Pinion tooth count', xUnit: '', y: 'Contact ratio', yUnit: '' },
      text: {
        description:
          'Construct standard full-depth involute pitch, base and addendum circles and calculate the nominal path of contact.',
        predict: 'What does a nominal contact ratio below one imply?',
        answers: [
          'A gap between successive tooth-pair contacts',
          'Guaranteed continuous contact',
          'Twice the load capacity',
        ],
        explain:
          'A path of contact shorter than one base pitch cannot sustain continuous ideal engagement.',
        example: 'With module 3 mm and 20/40 teeth, standard center distance is 90 mm.',
        equation: 'r=mz/2, rb=r cosα, ra=r+m; εα=[√(ra1²−rb1²)+√(ra2²−rb2²)−a sinα]/(πm cosα).',
        limits:
          'Unshifted external 20-degree-style full-depth proportions, with selectable pressure angle and addendum m. No backlash, profile modification, elastic deflection or helical overlap. A rack-generation undercut estimate zmin=2/sin²α is flagged; nominal contact ratio is not a complete interference or strength check.',
      },
    },
    ({ module: m, teeth1: z1, teeth2: z2, pressure }) => {
      const alpha = (pressure * Math.PI) / 180,
        calc = (z) => {
          const a = (m * (z + z2)) / 2,
            r1 = (m * z) / 2,
            r2 = (m * z2) / 2;
          return (
            (Math.sqrt((r1 + m) ** 2 - (r1 * Math.cos(alpha)) ** 2) +
              Math.sqrt((r2 + m) ** 2 - (r2 * Math.cos(alpha)) ** 2) -
              a * Math.sin(alpha)) /
            (Math.PI * m * Math.cos(alpha))
          );
        },
        contact = calc(z1),
        min = 2 / Math.sin(alpha) ** 2;
      return {
        summary: {
          center: (m * (z1 + z2)) / 2,
          contact,
          basepitch: Math.PI * m * Math.cos(alpha),
          ratio: z2 / z1,
        },
        series: Array.from({ length: 89 }, (_, i) => ({ x: i + 12, y: calc(i + 12) })),
        visualization: systemVisual('gears', { teeth1: z1, teeth2: z2, pressure, module: m }),
        table: table(
          'Nominal circles',
          ['Gear', 'Pitch diameter mm', 'Base diameter mm', 'Addendum diameter mm'],
          [
            [1, m * z1, m * z1 * Math.cos(alpha), m * (z1 + 2)],
            [2, m * z2, m * z2 * Math.cos(alpha), m * (z2 + 2)],
          ],
        ),
        warnings:
          z1 < min || z2 < min
            ? [
                'At least one gear is below the ideal rack-generated undercut threshold; use the nominal contact ratio cautiously.',
              ]
            : contact < 1
              ? ['Nominal contact ratio is below one.']
              : [],
      };
    },
  ),
  geartrains: make(
    {
      id: 'geartrains',
      title: 'Gear Trains and Planetary Ratios',
      inputs: {
        mode: choice(
          'Train',
          {
            simple: 'One external pair',
            compound: 'Two external pairs on compound shafts',
            planet: 'Sun drives, ring fixed, carrier output',
          },
          'planet',
        ),
        teeth1,
        teeth2,
        third: integer('Second driver teeth (compound)', 12, 100, 20),
        fourth: integer('Second driven teeth (compound)', 12, 120, 60),
        speed: p('Input shaft / sun speed', 'rpm', -3000, 3000, 600),
      },
      metrics: {
        output: ['Output speed', 'rpm'],
        ratio: ['Input/output speed ratio', '1'],
        ring: ['Planetary ring teeth', '1'],
        residual: ['Willis relation residual', 'rpm'],
      },
      plot: { x: 'Input speed', xUnit: 'rpm', y: 'Output speed', yUnit: 'rpm' },
      text: {
        description:
          'Compare signed external-pair speed ratios with a compatible sun–planet–ring train and the relative-speed Willis relation.',
        predict:
          'With the ring fixed and the sun driven, is carrier rotation in the sun’s direction?',
        answers: ['Yes', 'No', 'Only if planet teeth equal sun teeth'],
        explain: 'ωc=Nsωs/(Ns+Nr) is positive for a positive sun speed.',
        example: 'Ns=20,Np=40 gives Nr=100; at sun speed 600 rpm the carrier turns at 100 rpm.',
        equation:
          'External pair ω2/ω1=−N1/N2. Compound pairs multiply. Willis: Ns(ωs−ωc)+Nr(ωr−ωc)=0, Nr=Ns+2Np.',
        limits:
          'Rigid ideal gears with a common module, no losses or tooth-strength check. The planetary case uses a single representative planet and fixed ring; it does not check multi-planet spacing or packaging. A zero input/output ratio is reported from geometry even at zero speed.',
      },
    },
    ({ mode, teeth1: a, teeth2: b, third: c, fourth: d, speed }) => {
      const ring = a + 2 * b,
        factor =
          mode === 'simple' ? -a / b : mode === 'compound' ? ((a / b) * c) / d : a / (a + ring),
        output = speed * factor;
      return {
        summary: {
          output,
          ratio: 1 / factor,
          ring,
          residual: mode === 'planet' ? a * (speed - output) + ring * (0 - output) : 0,
        },
        series: samples(-3000, 3000, (x) => ({ y: x * factor })),
        visualization: systemVisual(mode === 'planet' ? 'planet' : 'gears', {
          teeth1: a,
          teeth2: b,
          ring,
          speed,
          output,
        }),
        table: table(
          'Train relationship',
          ['Configuration', 'Input rpm', 'Output rpm', 'Signed speed factor'],
          [[mode, speed, output, factor]],
        ),
      };
    },
  ),
  lewisgear: make(
    {
      id: 'lewisgear',
      title: 'Lewis Gear Tooth Bending Stress',
      inputs: {
        module: p('Module', 'mm', 1, 12, 3),
        teeth: integer('Pinion teeth', 17, 100, 20),
        width: p('Face width', 'mm', 5, 100, 30),
        torque: p('Transmitted torque', 'N·m', 1, 1000, 100),
        factor: p('Combined application factor', '', 1, 3, 1.3),
        allowable: p('Illustrative allowable bending stress', 'MPa', 50, 1000, 200),
      },
      metrics: {
        force: ['Tangential pitch force', 'N'],
        form: ['Lewis form factor Y', '1'],
        stress: ['Nominal factored tooth-root stress', 'MPa'],
        margin: ['Allowable / predicted stress', '1'],
      },
      plot: { x: 'Transmitted torque', xUnit: 'N·m', y: 'Nominal bending stress', yUnit: 'MPa' },
      text: {
        description:
          'Convert shaft torque to tangential tooth load and inspect the full-depth 20° Lewis cantilever estimate.',
        predict: 'At fixed geometry, what happens to Lewis stress if face width doubles?',
        answers: ['It halves', 'It doubles', 'It is unchanged'],
        explain:
          'The effective tooth-root section grows in proportion to face width in this simplified formula.',
        example: 'm=3 mm,z=20,b=30 mm,T=100 N·m gives Ft≈3333 N before application factors.',
        equation: 'Ft=2T/dp; Y≈0.484−2.87/z; σ=Ka Ft/(b m Y), using N and mm for MPa.',
        limits:
          'Approximate unshifted 20° full-depth Lewis form factor Y=πy. Application factor is supplied, not inferred from speed. This excludes AGMA/ISO load-distribution, rim, fatigue, reliability and dynamic-factor procedures; the displayed margin is an illustrative nominal comparison.',
      },
    },
    ({ module: m, teeth: z, width: b, torque: T, factor: Ka, allowable }) => {
      const form = 0.484 - 2.87 / z,
        force = (2000 * T) / (m * z),
        stress = (Ka * force) / (b * m * form);
      return {
        summary: { force, form, stress, margin: allowable / stress },
        series: samples(0, 2 * T, (x) => ({ y: (stress * x) / T })),
        visualization: systemVisual('gears', { teeth1: z, teeth2: 2 * z, force }),
        table: table(
          'Lewis quantities',
          ['Pitch diameter mm', 'Tangential force N', 'Y', 'Factored stress MPa'],
          [[m * z, force, form, stress]],
        ),
      };
    },
  ),
  beltdrive: make(
    {
      id: 'beltdrive',
      title: 'Belt Drive and Capstan Tension',
      inputs: {
        friction: p('Belt/pulley friction coefficient', '', 0.05, 0.8, 0.3),
        wrap: p('Wrap angle', 'deg', 60, 300, 180),
        pretension: p('Mean total operating belt tension', 'N', 50, 3000, 500),
        radius: p('Pulley radius', 'mm', 20, 300, 100),
        speed: p('Belt speed', 'm/s', 0, 30, 10),
        density: p('Belt mass per length', 'kg/m', 0.01, 2, 0.2),
      },
      metrics: {
        tight: ['Limiting tight-side total tension', 'N'],
        slack: ['Limiting slack-side total tension', 'N'],
        torque: ['Limiting transmitted torque', 'N·m'],
        power: ['Limiting transmitted power', 'W'],
        centrifugal: ['Centrifugal tension', 'N'],
      },
      plot: { x: 'Wrap angle', xUnit: 'deg', y: 'Limiting torque', yUnit: 'N·m' },
      text: {
        description:
          'Apply the capstan ratio to effective tensions and account for centrifugal tension within a fixed mean total belt tension.',
        predict: 'Does increasing belt speed always increase transmissible power?',
        answers: [
          'No, centrifugal tension can consume the available effective tension',
          'Yes',
          'Only with zero wrap',
        ],
        explain:
          'At fixed mean total tension, the available friction-producing part is T0−μbelt v².',
        example:
          'At zero speed and wrap π rad, the limiting effective tight/slack tension ratio is e^(μπ).',
        equation:
          '(T1−Tc)/(T2−Tc)=e^(μθ); Tc=ρlinear v²; ΔT=2(T0−Tc)tanh(μθ/2); torque=ΔT R; power=ΔT v.',
        limits:
          'Ideal flexible flat belt at impending slip, common side speed, fixed mean total operating tension. No groove wedge, bending loss, creep or belt-strength model. When Tc≥T0 no positive effective tension remains, so capacity is set to zero and flagged.',
      },
    },
    ({ friction: mu, wrap, pretension: T0, radius: R, speed: v, density }) => {
      const Tc = density * v * v,
        effective = Math.max(0, T0 - Tc),
        delta = (angle) => 2 * effective * Math.tanh((mu * angle * Math.PI) / 360),
        d = delta(wrap);
      return {
        summary: {
          tight: T0 + d / 2,
          slack: T0 - d / 2,
          torque: (d * R) / 1000,
          power: d * v,
          centrifugal: Tc,
        },
        series: samples(60, 300, (x) => ({ y: (delta(x) * R) / 1000 })),
        visualization: systemVisual('belt', { tight: T0 + d / 2, slack: T0 - d / 2, radius: R }),
        warnings:
          Tc >= T0
            ? [
                'Centrifugal tension meets or exceeds the specified mean total tension; the positive-tension capstan model has no usable capacity.',
              ]
            : [],
      };
    },
  ),
  boltpreload: make(
    {
      id: 'boltpreload',
      title: 'Bolted Joint Preload and Joint Stiffness',
      inputs: {
        bolt: p('Bolt axial stiffness', 'kN/mm', 10, 1000, 200),
        members: p('Clamped-member stiffness', 'kN/mm', 10, 2000, 600),
        preload: p('Initial preload', 'kN', 1, 100, 20),
        external: p('External separating load', 'kN', 0, 150, 30),
        area: p('Bolt tensile stress area', 'mm²', 10, 500, 84.3),
      },
      metrics: {
        fraction: ['External load fraction carried by bolt C', '1'],
        separation: ['Joint separation load', 'kN'],
        boltforce: ['Bolt tensile force', 'kN'],
        clamp: ['Remaining clamping force', 'kN'],
        stress: ['Nominal bolt tensile stress', 'MPa'],
      },
      plot: {
        x: 'External separating load',
        xUnit: 'kN',
        y: 'Axial force',
        yUnit: 'kN',
        traces: { y: 'Bolt force', reference: 'Remaining clamp' },
      },
      text: {
        description:
          'Share an external tensile load between the bolt and compressed members until contact is lost, then switch to the separated-joint force balance.',
        predict: 'After the joint separates, can member clamping force become negative?',
        answers: [
          'No, contact force becomes zero',
          'Yes, it becomes tensile contact',
          'Only with a high preload',
        ],
        explain:
          'The linear clamped-contact relation stops at separation; beyond it the bolt carries the external load.',
        example: 'kb=200,km=600 kN/mm gives C=0.25; preload 20 kN gives separation at 26.667 kN.',
        equation:
          'C=kb/(kb+km); Fb=Fi+CP, Fclamp=Fi−(1−C)P until Psep=Fi/(1−C); afterward Fb=P,Fclamp=0.',
        limits:
          'One bolt, centered axial load, linear stiffness, initial preload maintained until separation. No prying, joint embedding, torque-to-preload scatter, fatigue or yielding. Tensile stress uses the supplied stress area.',
      },
    },
    ({ bolt: kb, members: km, preload: Fi, external: P, area }) => {
      const C = kb / (kb + km),
        sep = Fi / (1 - C),
        response = (x) => ({
          y: x <= sep ? Fi + C * x : x,
          reference: Math.max(0, Fi - (1 - C) * x),
        }),
        r = response(P);
      return {
        summary: {
          fraction: C,
          separation: sep,
          boltforce: r.y,
          clamp: r.reference,
          stress: (1000 * r.y) / area,
        },
        series: samples(0, Math.max(2 * P, 1.5 * sep), response),
        visualization: systemVisual('bolt', {
          preload: Fi,
          external: P,
          boltforce: r.y,
          clamp: r.reference,
        }),
        warnings:
          P > sep ? ['The joint has separated; the bolt carries the full external load.'] : [],
      };
    },
  ),
  journalbearing: make(
    {
      id: 'journalbearing',
      title: 'Journal Bearing: Petroff Friction and Sommerfeld Number',
      inputs: {
        viscosity: p('Dynamic viscosity', 'Pa·s', 0.001, 0.2, 0.03),
        speed: p('Journal speed', 'rpm', 10, 10000, 1500),
        radius: p('Journal radius', 'mm', 5, 100, 25),
        clearance: p('Radial clearance', 'mm', 0.01, 0.3, 0.05),
        length: p('Bearing length', 'mm', 10, 200, 50),
        load: p('Radial load', 'N', 10, 10000, 1000),
      },
      validateValues: checkInput('clearance', (v) => {
        if (v.clearance / v.radius > 0.02)
          throw Error('Keep radial clearance / radius ≤0.02 for the thin-film approximation.');
      }),
      metrics: {
        pressure: ['Projected bearing pressure', 'MPa'],
        sommerfeld: ['Sommerfeld number S', '1'],
        friction: ['Petroff friction coefficient', '1'],
        torque: ['Viscous friction torque', 'N·m'],
        heat: ['Frictional heat generation', 'W'],
      },
      plot: { x: 'Journal speed', xUnit: 'rpm', y: 'Petroff friction torque', yUnit: 'N·m' },
      text: {
        description:
          'Estimate concentric thin-film viscous friction and calculate a clearly defined dimensionless Sommerfeld number.',
        predict:
          'Does Sommerfeld number alone determine minimum film thickness without a bearing solution or chart?',
        answers: ['No', 'Yes', 'Only at zero load'],
        explain:
          'Geometry and a hydrodynamic solution or correlation are needed to map the group to eccentricity and film thickness.',
        example: 'μ=0.03 Pa·s,n=25 rev/s,R/c=500,p=0.4 MPa gives S=0.46875.',
        equation:
          'p=W/(LD); S=(μn/p)(R/c)²; Petroff f=2π²(μn/p)(R/c); torque=fWR; heat=torque·2πn.',
        limits:
          'Petroff is a crude low-load, nearly concentric, isoviscous thin-film estimate. The chosen S convention uses radius/radial-clearance and speed in rev/s. No Reynolds-equation pressure field, finite-length correction, thermal viscosity change, eccentricity or minimum-film prediction is claimed.',
      },
    },
    ({ viscosity: mu, speed, radius, clearance, length, load: W }) => {
      const R = radius / 1000,
        c = clearance / 1000,
        L = length / 1000,
        n = speed / 60,
        pressure = W / (L * 2 * R),
        S = ((mu * n) / pressure) * (R / c) ** 2,
        f = ((2 * Math.PI ** 2 * mu * n) / pressure) * (R / c),
        torque = f * W * R;
      return {
        summary: {
          pressure: pressure / 1e6,
          sommerfeld: S,
          friction: f,
          torque,
          heat: torque * 2 * Math.PI * n,
        },
        series: samples(0, 2 * speed, (x) => ({ y: (torque * x) / speed })),
        visualization: systemVisual('bearing', { radius, clearance, load: W, speed }),
        table: table(
          'Unit conversions used',
          ['Radius m', 'Radial clearance m', 'Length m', 'Speed rev/s', 'Pressure Pa'],
          [[R, c, L, n, pressure]],
        ),
      };
    },
  ),
};

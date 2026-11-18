import {
  engineering,
  p,
  choice,
  textInput,
  integer,
  seq,
  rad,
  lesson,
  domain,
  requireValue,
  result,
  solveLinear,
  integrate,
} from './engineering-kit.js';
import { beamSpans, jointTruss, sectionParts } from './structural-engine.js';
import { solveTruss, triangle } from './truss.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  engineering({ discipline: 'civil', topic: 'Solid mechanics & structures', ...config }, solve);
const beamInputs = {
  length: p('Span length', 'm', 1, 12, 4),
  load: p('Uniform load', 'kN/m', 0, 100, 10),
  modulus: p('Young modulus', 'GPa', 10, 220, 200),
  inertia: p('Second moment of area', 'cm⁴', 100, 50000, 8000),
};
const beamMetrics = {
  moment: ['Largest absolute bending moment', 'kN·m'],
  deflection: ['Largest absolute deflection', 'mm'],
  energy: ['Bending strain energy', 'J'],
};
const beamPlot = { x: 'Position', xUnit: 'm', y: 'Sagging-positive bending moment', yUnit: 'kN·m' };
const spanFields = {
  ...beamInputs,
  spans: choice('Continuous spans', { two: 'Two spans', three: 'Three spans' }, 'three'),
  ratio: p('Second span / first span', '1', 0.4, 2, 1),
  loadRatio: p('Second load / first load', '1', 0, 2, 1),
  thirdRatio: {
    ...p('Third span / first span', '1', 0.4, 2, 0.75),
    visibleWhen: { key: 'spans', is: 'three' },
  },
  thirdLoad: {
    ...p('Third load / first load', '1', 0, 2, 0.5),
    visibleWhen: { key: 'spans', is: 'three' },
  },
};
function spanResult(a, method) {
  const lengths = [a.length, a.length * a.ratio],
    loads = [a.load, a.load * a.loadRatio];
  if (a.spans === 'three') {
    lengths.push(a.length * a.thirdRatio);
    loads.push(a.load * a.thirdLoad);
  }
  const r = beamSpans(lengths, loads, a.modulus * a.inertia * 0.01, method);
  return {
    ...result(
      {
        moment: Math.max(...r.series.map((v) => Math.abs(v.y))),
        deflection: Math.max(...r.series.map((v) => Math.abs(v.deflection))),
        energy: r.energy,
      },
      r.series,
      'beam',
      { supports: lengths.reduce((positions, L) => [...positions, positions.at(-1) + L], [0]) },
      [
        ...r.reactions.map((v, i) => [`Support ${i} reaction kN`, v]),
        ...r.iterations.map((v) => [
          `Distribution sweep ${v.sweep}: max joint imbalance kN·m`,
          v.residual,
        ]),
      ],
    ),
    supportMoments: r.moments,
    reactions: r.reactions,
    iterations: r.iterations,
  };
}
export const structuralModels = {
  proppedbeam: make(
    {
      id: 'proppedbeam',
      title: 'Propped Cantilever: Compatibility and Reactions',
      inputs: beamInputs,
      metrics: { ...beamMetrics, prop: ['Prop reaction', 'kN'] },
      plot: beamPlot,
      text: lesson(
        'Resolve a uniformly loaded cantilever with a simple prop at its free end by enforcing zero prop displacement.',
        'Compared with removing the prop, what happens to the fixed-end moment magnitude?',
        ['It decreases', 'It increases fourfold', 'It stays unchanged'],
        'The upward prop reaction cancels part of the cantilever load moment.',
        'w=10 kN/m and L=4 m give RB=15 kN, RA=25 kN and Mfixed=−20 kN·m.',
        'RB=3wL/8; RA=5wL/8; M0=−wL²/8; EI v″=M0+RAx−wx²/2.',
        'Prismatic Euler–Bernoulli beam, constant EI, uniform downward load, perfectly fixed left end and nonsettling bilateral right prop. Deflection is algebraic upward-positive here; sagging bending is positive. No shear deformation or support uplift check.',
      ),
    },
    (a) => {
      const L = a.length,
        w = a.load,
        EI = a.modulus * a.inertia * 0.01,
        R = (5 * w * L) / 8,
        M0 = (-w * L * L) / 8,
        series = seq(0, L).map((x) => ({
          x,
          y: M0 + R * x - (w * x * x) / 2,
          deflection: (((M0 * x * x) / 2 + (R * x ** 3) / 6 - (w * x ** 4) / 24) / EI) * 1000,
        }));
      return result(
        {
          moment: Math.abs(M0),
          deflection: Math.max(...series.map((v) => Math.abs(v.deflection))),
          energy: integrate((x) => (M0 + R * x - (w * x * x) / 2) ** 2 / (2 * EI), 0, L) * 1000,
          prop: (3 * w * L) / 8,
        },
        series,
        'beam',
        { supports: [0, L], fixed: true },
        [
          ['Left reaction kN', R],
          ['Fixed moment kN·m', M0],
        ],
      );
    },
  ),
  threemoment: make(
    {
      id: 'threemoment',
      title: 'Continuous Beam by Three-Moment Equation',
      inputs: spanFields,
      metrics: beamMetrics,
      plot: beamPlot,
      text: lesson(
        'Solve interior support moments of a two- or three-span continuous beam, then recover reactions, deflections and energy.',
        'Equal uniform loads on equal spans produce what interior moment?',
        ['−wL²/8', 'Zero', '+wL²/2'],
        'Compatibility couples the adjacent spans and produces hogging at their common support.',
        'For two 4 m spans with 10 kN/m, the middle moment is −20 kN·m and reactions are 15,50,15 kN.',
        'Li Mi−1+2(Li+Li+1)Mi+Li+1 Mi+1=−(wiLi³+wi+1Li+1³)/4.',
        'Two or three prismatic spans with one common constant EI, pinned outer supports, uniform load per span and zero support settlement. Three-moment compatibility includes flexure only; deflections are upward-positive. Reported peak deflection is the maximum of the plotted samples.',
      ),
    },
    (a) => spanResult(a, 'three'),
  ),
  momentdistribution: make(
    {
      id: 'momentdistribution',
      title: 'Moment Distribution: Hardy Cross for Beams',
      inputs: spanFields,
      metrics: beamMetrics,
      plot: beamPlot,
      text: lesson(
        'Release the exterior pins, distribute the interior joint imbalance by member stiffness and recover the continuous-beam state.',
        'For a near end with the far end hinged, which rotational stiffness applies?',
        ['3EI/L', '4EI/L', 'EI/L²'],
        'A released far end rotates, reducing the near-end stiffness from 4EI/L to 3EI/L.',
        'Equal 4 m spans at 10 kN/m converge to −20 kN·m at the interior support, matching three-moment compatibility.',
        'ΔMij=−(ΣMj)kij/Σk; k=4EI/L (far fixed) or 3EI/L (far pinned); carry-over=½ or zero.',
        'Two or three prismatic spans, pinned exterior supports, no settlement or joint translation. Member end moments use clockwise sign during distribution; plots convert to sagging-positive section moments. The table exposes every sweep residual; peak deflection is sampled.',
      ),
    },
    (a) => spanResult(a, 'distribution'),
  ),
  movingload: make(
    {
      id: 'movingload',
      title: 'Moving Loads and Influence Lines',
      inputs: {
        length: p('Simply supported span', 'm', 2, 30, 10),
        section: p('Section position / span', '1', 0.05, 0.95, 0.4),
        front: p('Front axle position', 'm', 0, 40, 6),
        spacing: p('Axle spacing', 'm', 0.5, 10, 3),
        first: p('Front axle load', 'kN', 1, 300, 100),
        second: p('Trailing axle load', 'kN', 0, 300, 80),
      },
      metrics: {
        moment: ['Moment at chosen section', 'kN·m'],
        peak: ['Exact peak over this two-axle passage', 'kN·m'],
        position: ['Front axle position at peak', 'm'],
      },
      plot: { x: 'Front axle position', xUnit: 'm', y: 'Section moment', yUnit: 'kN·m' },
      text: lesson(
        'Move two axles across a simply supported span and evaluate a chosen section’s moment influence line.',
        'Where can the exact maximum of this piecewise-linear passage occur?',
        [
          'At an axle entering, leaving or crossing the section',
          'Only at the span midpoint',
          'Only halfway between breakpoints',
        ],
        'The response is linear between those event positions.',
        'A single 100 kN axle over the midpoint of a 10 m span gives a maximum moment of 250 kN·m.',
        'IM(z)=z(L−a)/L for z≤a, a(L−z)/L for z≥a; M(s)=ΣPj IM(s−dj).',
        'Vertical point axles, quasi-static linear response and no impact or lateral distribution. Loads outside the span contribute zero. The exact peak checks event breakpoints; the display curve is sampled.',
      ),
    },
    (a) => {
      const L = a.length,
        c = L * a.section,
        I = (z) => (z < 0 || z > L ? 0 : z <= c ? (z * (L - c)) / L : (c * (L - z)) / L),
        M = (s) => a.first * I(s) + a.second * I(s - a.spacing),
        events = [0, c, L, a.spacing, c + a.spacing, L + a.spacing],
        best = events.reduce((b, x) => (M(x) > M(b) ? x : b), 0),
        series = seq(0, L + a.spacing).map((x) => ({ x, y: M(x) }));
      return result(
        { moment: M(a.front), peak: M(best), position: best },
        series,
        'beam',
        {
          supports: [0, L],
          loads: [
            [a.front, a.first],
            [a.front - a.spacing, a.second],
          ],
          section: c,
        },
        [
          ['Influence ordinate at section m', (c * (L - c)) / L],
          ['Selected section m', c],
        ],
      );
    },
  ),
  trussjoints: make(
    {
      id: 'trussjoints',
      title: 'Truss Member Forces: Method of Joints',
      inputs: {
        geometry: textInput(
          'Truss JSON',
          triangle,
          4000,
          'Same node/bar/support/load format as the FEM lab; simple statically determinate trusses only.',
        ),
      },
      validateValues: domain('geometry', (a) => {
        solveTruss(a.geometry);
        jointTruss(a.geometry);
      }),
      metrics: {
        tension: ['Largest tensile member force', 'kN'],
        compression: ['Largest compressive magnitude', 'kN'],
        joints: ['Joint-equilibrium steps', '1'],
      },
      plot: { x: 'Member index', xUnit: '1', y: 'Axial member force', yUnit: 'kN' },
      text: lesson(
        'First solve three support reactions from whole-truss equilibrium, then resolve joints with one or two unknown members.',
        'What does a negative axial member force mean here?',
        ['Compression', 'Tension', 'A failed numerical calculation'],
        'Every unknown is initially assumed to pull away from its joint; a negative solution reverses that direction.',
        'The default triangular truss under 100 kN has diagonal forces −60.093 kN and bottom-chord tension 33.333 kN.',
        'ΣFx=ΣFy=ΣM=0 for reactions; ΣNj cosθj+Fx=0 and ΣNj sinθj+Fy=0 at each resolved joint.',
        'Simple stable planar pin-jointed determinate trusses with three independent reactions. A determinate topology that cannot be peeled by one/two-unknown joints is rejected and can instead use the FEM lab. Bar E and area are retained for format compatibility; they do not affect determinate force equilibrium.',
      ),
    },
    (a) => {
      const r = jointTruss(a.geometry),
        v = solveTruss(a.geometry);
      return {
        ...result(
          {
            tension: Math.max(0, ...r.forces),
            compression: Math.max(0, ...r.forces.map((x) => -x)),
            joints: r.steps.length,
          },
          r.forces.map((y, x) => ({ x, y })),
          'truss',
          {},
          r.steps.map((s, i) => [
            `Step ${i + 1}: joint ${s.joint}`,
            s.forces.map((f) => (f === null ? '?' : f.toFixed(4))).join(', '),
          ]),
        ),
        visualization: v.visualization,
        forces: r.forces,
        reactions: r.reactions,
        steps: r.steps,
      };
    },
  ),
  trussvirtual: make(
    {
      id: 'trussvirtual',
      title: 'Truss Deflection by Virtual Work',
      inputs: {
        geometry: textInput(
          'Truss JSON',
          triangle,
          4000,
          'Node positions m; member area mm² and E GPa; joint loads kN.',
        ),
        node: integer('Displacement node (zero-based)', 0, 11, 2),
        direction: choice(
          'Unit-load direction',
          { vertical: 'Vertical upward', horizontal: 'Horizontal right' },
          'vertical',
        ),
      },
      validateValues: domain('node', (a) => {
        const real = solveTruss(a.geometry);
        requireValue(
          a.node < real.nodes.length,
          'Selected displacement node is outside the model.',
        );
      }),
      metrics: {
        virtual: ['Virtual-work displacement', 'mm'],
        direct: ['Direct FEM displacement', 'mm'],
        difference: ['Virtual/direct difference', 'mm'],
      },
      plot: { x: 'Member index', xUnit: '1', y: 'Virtual-work contribution', yUnit: 'mm' },
      text: lesson(
        'Solve the real and a unit-load truss, then sum each member’s contribution to one selected nodal displacement.',
        'If every member area doubles under the same real loads, what happens to deflection?',
        ['It halves', 'It doubles', 'It is unchanged'],
        'The member flexibility L/EA halves.',
        'The default triangle has identical direct-stiffness and virtual-work vertical displacements; the sign is negative under a downward load.',
        'δ=ΣNm nm Lm/(Em Am) for a 1 kN virtual load; δ is measured in the chosen positive unit-load direction.',
        'Small axial deformation, linear elasticity and zero support displacements. Supports and topology are inherited from the FEM model. A restrained selected DOF gives zero; a unit load there is balanced by the support, not an artificial displacement.',
      ),
    },
    (a) => {
      const real = solveTruss(a.geometry),
        model = JSON.parse(a.geometry),
        d = a.direction === 'horizontal' ? 0 : 1;
      model.loads = [[a.node, d === 0 ? 1 : 0, d === 1 ? 1 : 0]];
      const virtual = solveTruss(JSON.stringify(model)),
        parts = real.members.map((m, i) => {
          const [j, k, A, E] = real.bars[i],
            L = Math.hypot(
              real.nodes[j][0] - real.nodes[k][0],
              real.nodes[j][1] - real.nodes[k][1],
            );
          return ((m.force * virtual.members[i].force * L) / (E * A)) * 1000;
        }),
        sum = parts.reduce((s, v) => s + v, 0),
        direct = real.displacement[2 * a.node + d] * 1000;
      return {
        ...result(
          { virtual: sum, direct, difference: sum - direct },
          parts.map((y, x) => ({ x, y })),
          'truss',
          {},
          parts.map((v, i) => [`Member ${i} contribution mm`, v]),
        ),
        visualization: real.visualization,
      };
    },
  ),
  portalsway: make(
    {
      id: 'portalsway',
      title: 'Portal Frame Sway by Slope–Deflection',
      inputs: {
        height: p('Column height', 'm', 1, 8, 3),
        span: p('Beam span', 'm', 2, 12, 4),
        column: p('Each column EI', 'kN·m²', 1000, 100000, 16000),
        beam: p('Beam EI', 'kN·m²', 1000, 100000, 16000),
        force: p('Horizontal roof load', 'kN', 0, 200, 20),
      },
      metrics: {
        sway: ['Roof sway', 'mm'],
        left: ['Left roof joint rotation', 'rad'],
        right: ['Right roof joint rotation', 'rad'],
        stiffness: ['Frame lateral stiffness', 'kN/m'],
      },
      plot: { x: 'Height', xUnit: 'm', y: 'Column horizontal displacement', yUnit: 'mm' },
      text: lesson(
        'Solve the two joint rotations and shared roof sway of a fixed-base, single-bay rigid portal frame.',
        'Making the roof beam very stiff does what to lateral frame stiffness?',
        ['Raises it toward 24EIc/H³', 'Makes it zero', 'Removes column bending'],
        'A stiff beam restrains column-top rotations, approaching two fixed–fixed sidesway columns.',
        'With EIbeam→0, each column approaches a cantilever and total stiffness approaches 6EIc/H³.',
        '[4EIc/H+4EIb/L,2EIb/L,−6EIc/H²; …; −6EIc/H²,−6EIc/H²,24EIc/H³]{θL,θR,Δ}={0,0,P}.',
        'Equal-height equal-EI columns, fixed bases, rigid joints, no beam axial extension, no column axial shortening, no vertical load or P–Δ. Joint rotations use clockwise column-tangent convention. Linear Euler–Bernoulli bending only.',
      ),
    },
    (a) => {
      const H = a.height,
        L = a.span,
        C = a.column,
        B = a.beam,
        K = [
          [(4 * C) / H + (4 * B) / L, (2 * B) / L, (-6 * C) / H ** 2],
          [(2 * B) / L, (4 * C) / H + (4 * B) / L, (-6 * C) / H ** 2],
          [(-6 * C) / H ** 2, (-6 * C) / H ** 2, (24 * C) / H ** 3],
        ],
        u = solveLinear(K, [0, 0, a.force]),
        unit = solveLinear(K, [0, 0, 1]),
        series = seq(0, H).map((x) => {
          const s = x / H;
          return { x, y: ((3 * s * s - 2 * s ** 3) * u[2] + H * (s ** 3 - s * s) * u[0]) * 1000 };
        });
      return result(
        { sway: u[2] * 1000, left: u[0], right: u[1], stiffness: 1 / unit[2] },
        series,
        'portal',
        { height: H, span: L, sway: u[2] },
        [
          ['Left column shear kN', ((12 * C) / H ** 3) * u[2] - ((6 * C) / H ** 2) * u[0]],
          ['Right column shear kN', ((12 * C) / H ** 3) * u[2] - ((6 * C) / H ** 2) * u[1]],
        ],
      );
    },
  ),
  unsymmetric: make(
    {
      id: 'unsymmetric',
      title: 'Unsymmetric Bending and Neutral Axis',
      inputs: {
        width: p('L-section width', 'mm', 40, 250, 100),
        height: p('L-section height', 'mm', 40, 300, 150),
        thickness: p('Leg thickness', 'mm', 4, 30, 10),
        Mx: p('Moment about x', 'kN·m', -10, 10, 1),
        My: p('Moment about y', 'kN·m', -10, 10, 0),
      },
      validateValues: domain('thickness', (a) =>
        requireValue(
          a.thickness < Math.min(a.width, a.height) / 2,
          'Leg thickness must be below half both outer dimensions.',
        ),
      ),
      metrics: {
        maximum: ['Maximum vertex normal stress', 'MPa'],
        minimum: ['Minimum vertex normal stress', 'MPa'],
        angle: ['Neutral-axis angle from x', 'deg'],
        product: ['Centroidal Ixy', 'mm⁴'],
      },
      plot: { x: 'Boundary vertex index', xUnit: '1', y: 'Longitudinal stress', yUnit: 'MPa' },
      text: lesson(
        'Calculate centroid and the complete area-inertia tensor of an L-section before resolving biaxial bending stress.',
        'Can a moment about x alone tilt the neutral axis in an L-section?',
        [
          'Yes, because Ixy is nonzero',
          'No, it is always horizontal',
          'Only if axial force is applied',
        ],
        'Product inertia couples the two stress-gradient coefficients.',
        'For a symmetric-axis rectangle Ixy=0, the equation reduces to σ=Mx y/Ixx+My x/Iyy.',
        '[Ixx Ixy;Ixy Iyy]{a,b}={Mx,My}; σ=a(y−yc)+b(x−xc); neutral line ay+bx=0.',
        'Prismatic thin/deep L-section built from two nonoverlapping rectangles; linear elasticity, no warping or shear-lag. Moment signs are defined by Mx=∫σy dA and My=∫σx dA. Zero resultant bending makes the neutral-axis angle undefined.',
      ),
    },
    (a) => {
      const b = a.width,
        h = a.height,
        t = a.thickness,
        parts = [
          [t, h, t / 2, h / 2],
          [b - t, t, (b + t) / 2, t / 2],
        ],
        A = parts.reduce((s, [w, d]) => s + w * d, 0),
        xc = parts.reduce((s, [w, d, x]) => s + w * d * x, 0) / A,
        yc = parts.reduce((s, [w, d, , y]) => s + w * d * y, 0) / A,
        Ixx = parts.reduce((s, [w, d, , y]) => s + (w * d ** 3) / 12 + w * d * (y - yc) ** 2, 0),
        Iyy = parts.reduce((s, [w, d, x]) => s + (d * w ** 3) / 12 + w * d * (x - xc) ** 2, 0),
        Ixy = parts.reduce((s, [w, d, x, y]) => s + w * d * (x - xc) * (y - yc), 0),
        [aa, bb] = solveLinear(
          [
            [Ixx, Ixy],
            [Ixy, Iyy],
          ],
          [a.Mx * 1e6, a.My * 1e6],
        ),
        vertices = [
          [0, 0],
          [b, 0],
          [b, t],
          [t, t],
          [t, h],
          [0, h],
        ],
        stresses = vertices.map(([x, y]) => aa * (y - yc) + bb * (x - xc));
      return result(
        {
          maximum: Math.max(...stresses),
          minimum: Math.min(...stresses),
          angle: Math.hypot(aa, bb) > 0 ? (Math.atan2(-bb, aa) * 180) / Math.PI : null,
          product: Ixy,
        },
        stresses.map((y, x) => ({ x, y })),
        'section',
        { vertices, xc, yc, stresses },
        [
          ['Area mm²', A],
          ['Ixx mm⁴', Ixx],
          ['Iyy mm⁴', Iyy],
          ['Centroid x mm', xc],
          ['Centroid y mm', yc],
        ],
      );
    },
  ),
  sectionkern: make(
    {
      id: 'sectionkern',
      title: 'Combined Axial/Bending Stress and Section Kern',
      inputs: {
        width: p('Rectangular width', 'mm', 50, 500, 200),
        height: p('Rectangular depth', 'mm', 50, 800, 300),
        force: p('Compressive force', 'kN', 0, 3000, 300),
        ex: p('Load eccentricity x', 'mm', -200, 200, 20),
        ey: p('Load eccentricity y', 'mm', -300, 300, 30),
      },
      metrics: {
        maximum: ['Maximum compressive-positive stress', 'MPa'],
        minimum: ['Minimum compressive-positive stress', 'MPa'],
        kern: ['Kern utilization', '1'],
      },
      plot: { x: 'Depth coordinate', xUnit: 'mm', y: 'Stress at x=+b/2', yUnit: 'MPa' },
      text: lesson(
        'Combine uniform compression and biaxial bending over a rectangular section and test the no-tension kern.',
        'For uniaxial eccentricity in depth, what is the no-tension limit?',
        ['|ey|≤h/6', '|ey|≤h/2', 'Any eccentricity is safe'],
        'The minimum edge stress vanishes at the middle-third boundary.',
        'A 200×300 mm section under 300 kN has mean stress 5 MPa; ey=50 mm alone makes one edge stress zero.',
        'σ=N/A[1+12ex x/b²+12ey y/h²]; kern: 6|ex|/b+6|ey|/h≤1.',
        'Compression-positive convention, linear uncracked elastic rectangle, full contact and small deflection. A negative minimum indicates predicted tension; it does not automatically redistribute compression or model cracked concrete/contact lift-off.',
      ),
    },
    (a) => {
      const mean = (a.force * 1000) / (a.width * a.height),
        f = (x, y) => mean * (1 + (12 * a.ex * x) / a.width ** 2 + (12 * a.ey * y) / a.height ** 2),
        vertices = [
          [-a.width / 2, -a.height / 2],
          [a.width / 2, -a.height / 2],
          [a.width / 2, a.height / 2],
          [-a.width / 2, a.height / 2],
        ],
        stresses = vertices.map(([x, y]) => f(x, y));
      return result(
        {
          maximum: Math.max(...stresses),
          minimum: Math.min(...stresses),
          kern: (6 * Math.abs(a.ex)) / a.width + (6 * Math.abs(a.ey)) / a.height,
        },
        seq(-a.height / 2, a.height / 2).map((x) => ({ x, y: f(a.width / 2, x) })),
        'section',
        { vertices, xc: 0, yc: 0, stresses },
        [
          ['Mean compression MPa', mean],
          ['Mx kN·m', (a.force * a.ey) / 1000],
          ['My kN·m', (a.force * a.ex) / 1000],
        ],
      );
    },
  ),
  beamshear: make(
    {
      id: 'beamshear',
      title: 'Beam Shear Stress: I and T Sections',
      inputs: {
        shape: choice('Cross-section', { I: 'Symmetric I section', T: 'T section' }, 'I'),
        width: p('Flange width', 'mm', 80, 400, 200),
        height: p('Overall depth', 'mm', 100, 600, 300),
        flange: p('Flange thickness', 'mm', 5, 40, 15),
        web: p('Web thickness', 'mm', 4, 30, 10),
        force: p('Vertical shear force', 'kN', 0, 500, 100),
      },
      validateValues: domain('flange', (a) =>
        requireValue(
          2 * a.flange < a.height && a.web < a.width,
          'Require 2·flange thickness < depth and web thickness < width.',
        ),
      ),
      metrics: {
        peak: ['Peak absolute shear stress', 'MPa'],
        centroid: ['Centroid from bottom', 'mm'],
        inertia: ['Centroidal second moment', 'mm⁴'],
      },
      plot: { x: 'Height from bottom', xUnit: 'mm', y: 'Shear stress', yUnit: 'MPa' },
      text: lesson(
        'Integrate the first moment of area above a cut and use the actual local flange or web width.',
        'Why can shear stress jump across a flange–web junction?',
        [
          'The local resisting width changes',
          'The shear force disappears',
          'The centroid moves during loading',
        ],
        'Q is continuous while b(y) changes abruptly.',
        'For a rectangular section, the same VQ/Ib construction gives τmax=1.5V/A.',
        'τ(y)=VQ(y)/(I b(y)); Q=∫above(y)(z−yc)dA.',
        'Thin/prismatic I and T rectangles with uniform shear over the local width, Euler–Bernoulli/Jourawski approximation. Flange transverse shear flow, fillets and shear-center/torsion effects are excluded. At a width discontinuity, the smaller adjacent width is used for the reported one-sided peak.',
      ),
    },
    (a) => {
      const s = sectionParts(a.shape, a.width, a.height, a.flange, a.web),
        levels = [
          ...seq(0, a.height, 240),
          s.centroid,
          a.height - a.flange,
          ...(a.shape === 'I' ? [a.flange] : []),
        ].sort((x, y) => x - y),
        series = levels.map((x) => {
          const c = s.at(x);
          return { x, y: c.width ? (a.force * 1000 * c.Q) / (s.I * c.width) : 0 };
        });
      return result(
        { peak: Math.max(...series.map((v) => Math.abs(v.y))), centroid: s.centroid, inertia: s.I },
        series,
        'crosssection',
        { shape: a.shape, ...a },
        [
          ['Area mm²', s.A],
          ['Applied shear kN', a.force],
        ],
      );
    },
  ),
  thinvessel: make(
    {
      id: 'thinvessel',
      title: 'Thin-Walled Pressure Vessel',
      inputs: {
        pressure: p('Internal gauge pressure', 'MPa', 0, 30, 2),
        radius: p('Mean cylinder radius', 'mm', 100, 2000, 500),
        thickness: p('Wall thickness', 'mm', 2, 80, 10),
        modulus: p('Young modulus', 'GPa', 20, 220, 200),
        poisson: p('Poisson ratio', '1', 0.1, 0.45, 0.3),
      },
      validateValues: domain('thickness', (a) =>
        requireValue(
          a.radius / a.thickness >= 10,
          'Thin-wall model requires radius/thickness ≥10; use the Lamé lab otherwise.',
        ),
      ),
      metrics: {
        hoop: ['Hoop membrane stress', 'MPa'],
        axial: ['Closed-end axial stress', 'MPa'],
        mises: ['Membrane von Mises stress', 'MPa'],
        expansion: ['Radial expansion', 'mm'],
      },
      plot: {
        x: 'Gauge pressure',
        xUnit: 'MPa',
        y: 'Membrane stress',
        yUnit: 'MPa',
        traces: { y: 'Hoop', reference: 'Axial' },
      },
      text: lesson(
        'Use hoop and axial force balance for a closed-end thin cylinder and recover elastic radial expansion.',
        'How do hoop and axial membrane stresses compare?',
        ['Hoop is twice axial', 'They are equal', 'Axial is twice hoop'],
        'The axial end-cap balance has twice the resisting wall area per radius relation.',
        'p=2 MPa, r=500 mm and t=10 mm give σθ=100 MPa and σz=50 MPa.',
        'σθ=pr/t; σz=pr/(2t); εθ=(σθ−νσz)/E; Δr=rεθ.',
        'Uniform thin cylindrical wall, closed ends, small strain and gauge pressure; radial stress is neglected. r/t≥10 is a screening bound, not a pressure-vessel code qualification. End discontinuities, welds and buckling are excluded.',
      ),
    },
    (a) => {
      const hoop = (a.pressure * a.radius) / a.thickness,
        axial = hoop / 2;
      return result(
        {
          hoop,
          axial,
          mises: Math.sqrt(hoop ** 2 + axial ** 2 - hoop * axial),
          expansion: (a.radius * (hoop - a.poisson * axial)) / (a.modulus * 1000),
        },
        seq(0, 30).map((x) => ({
          x,
          y: (x * a.radius) / a.thickness,
          reference: (x * a.radius) / a.thickness / 2,
        })),
        'cylinder',
        {
          inner: a.radius - a.thickness / 2,
          outer: a.radius + a.thickness / 2,
          pressure: a.pressure,
        },
        [['Radius/thickness', a.radius / a.thickness]],
      );
    },
  ),
  lame: make(
    {
      id: 'lame',
      title: 'Thick-Walled Cylinder: Lamé Stress',
      inputs: {
        inner: p('Inner radius', 'mm', 10, 500, 100),
        outer: p('Outer radius', 'mm', 20, 1000, 150),
        inside: p('Internal pressure', 'MPa', 0, 100, 10),
        outside: p('External pressure', 'MPa', 0, 100, 0),
        ends: choice(
          'Axial condition',
          { closed: 'Closed pressure-loaded ends', open: 'Open ends, no axial stress' },
          'closed',
        ),
      },
      validateValues: domain('outer', (a) =>
        requireValue(a.outer > a.inner, 'Outer radius must exceed inner radius.'),
      ),
      metrics: {
        hoop: ['Inner-surface hoop stress', 'MPa'],
        radial: ['Inner-surface radial stress', 'MPa'],
        axial: ['Uniform axial stress', 'MPa'],
        mises: ['Inner-surface von Mises stress', 'MPa'],
      },
      plot: {
        x: 'Radius',
        xUnit: 'mm',
        y: 'Stress',
        yUnit: 'MPa',
        traces: { y: 'Hoop', reference: 'Radial', third: 'Axial' },
      },
      text: lesson(
        'Resolve radial and hoop stresses across a thick elastic cylinder using both pressure boundary conditions.',
        'What radial stress must appear at the inner surface?',
        ['−Internal pressure', 'Zero for any wall', 'Twice the hoop stress'],
        'Traction at a pressure-loaded surface is compressive.',
        'ri=100, ro=150 mm, pi=10 MPa, po=0 gives σθ(ri)=26 MPa and closed-end σz=8 MPa.',
        'A=(pi ri²−po ro²)/(ro²−ri²), B=(pi−po)ri²ro²/(ro²−ri²); σr=A−B/r²; σθ=A+B/r².',
        'Long isotropic elastic cylinder, axisymmetric pressure, tension-positive stress. Closed-end axial stress is A; open-end axial stress is zero. No autofrettage, thermal stress, plasticity, buckling or end effects.',
      ),
    },
    (a) => {
      const A =
          (a.inside * a.inner ** 2 - a.outside * a.outer ** 2) / (a.outer ** 2 - a.inner ** 2),
        B = ((a.inside - a.outside) * a.inner ** 2 * a.outer ** 2) / (a.outer ** 2 - a.inner ** 2),
        hoop = A + B / a.inner ** 2,
        radial = -a.inside,
        axial = a.ends === 'closed' ? A : 0;
      return result(
        {
          hoop,
          radial,
          axial,
          mises: Math.sqrt(
            ((hoop - radial) ** 2 + (radial - axial) ** 2 + (axial - hoop) ** 2) / 2,
          ),
        },
        seq(a.inner, a.outer).map((x) => ({
          x,
          y: A + B / x ** 2,
          reference: A - B / x ** 2,
          third: axial,
        })),
        'cylinder',
        { inner: a.inner, outer: a.outer, pressure: a.inside },
        [['Outer radial boundary MPa', A - B / a.outer ** 2]],
      );
    },
  ),
  strainrosette: make(
    {
      id: 'strainrosette',
      title: 'Strain Rosette to Principal Strains',
      inputs: {
        layout: choice(
          'Gauge layout',
          { rectangular: '0° / 45° / 90°', delta: '0° / 60° / 120°' },
          'rectangular',
        ),
        first: p('Gauge A strain', 'µε', -3000, 3000, 500),
        second: p('Gauge B strain', 'µε', -3000, 3000, 300),
        third: p('Gauge C strain', 'µε', -3000, 3000, -100),
      },
      metrics: {
        major: ['Major principal strain', 'µε'],
        minor: ['Minor principal strain', 'µε'],
        angle: ['Major principal direction', 'deg'],
        shear: ['Engineering shear γxy', 'µε'],
      },
      plot: { x: 'Gauge orientation', xUnit: 'deg', y: 'Normal strain', yUnit: 'µε' },
      text: lesson(
        'Invert three gauge readings for the in-plane strain tensor and rotate it to principal directions.',
        'Does a strain rosette directly determine stress without material information?',
        [
          'No, it first determines strain',
          'Yes, stress equals strain',
          'Only the 45° gauge gives stress',
        ],
        'Constitutive properties and plane-stress/strain assumptions are needed to infer stresses.',
        'Rectangular readings 500,300,−100 µε give εx=500, εy=−100 and γxy=200 µε.',
        'εθ=εx cos²θ+εy sin²θ+γxy sinθ cosθ; ε1,2=(εx+εy)/2±½√[(εx−εy)²+γxy²].',
        'Three perfectly bonded coplanar gauges, small engineering strains and known gauge angles. Angle is measured counterclockwise from gauge A; equal principal strains have no unique direction. No thermal compensation or out-of-plane strain reconstruction.',
      ),
    },
    (a) => {
      const angles = a.layout === 'rectangular' ? [0, 45, 90] : [0, 60, 120],
        K = angles.map((t) => [
          Math.cos(rad(t)) ** 2,
          Math.sin(rad(t)) ** 2,
          Math.sin(rad(t)) * Math.cos(rad(t)),
        ]),
        [ex, ey, g] = solveLinear(K, [a.first, a.second, a.third]),
        R = Math.hypot(ex - ey, g) / 2;
      return result(
        {
          major: (ex + ey) / 2 + R,
          minor: (ex + ey) / 2 - R,
          angle: R > 1e-10 ? (Math.atan2(g, ex - ey) * 90) / Math.PI : null,
          shear: g,
        },
        seq(0, 180).map((x) => ({
          x,
          y:
            ex * Math.cos(rad(x)) ** 2 +
            ey * Math.sin(rad(x)) ** 2 +
            g * Math.sin(rad(x)) * Math.cos(rad(x)),
        })),
        'rosette',
        { angles, readings: [a.first, a.second, a.third] },
        [
          ['εx µε', ex],
          ['εy µε', ey],
          ['Tensor shear εxy µε', g / 2],
        ],
      );
    },
  ),
  failurecriteria: make(
    {
      id: 'failurecriteria',
      title: 'Failure Criteria: Tresca, von Mises and Rankine',
      inputs: {
        first: p('Principal stress σ1', 'MPa', -600, 600, 200),
        second: p('Principal stress σ2', 'MPa', -600, 600, 0),
        third: p('Principal stress σ3', 'MPa', -600, 600, 0),
        yield: p('Ductile uniaxial yield strength', 'MPa', 50, 1200, 250),
        tensile: p('Brittle tensile strength', 'MPa', 10, 600, 100),
        compressive: p('Brittle compressive strength', 'MPa', 50, 2000, 500),
      },
      metrics: {
        mises: ['Von Mises equivalent stress', 'MPa'],
        tresca: ['Tresca equivalent stress', 'MPa'],
        rankine: ['Rankine strength utilization', '1'],
      },
      plot: {
        x: 'Stress load multiplier',
        xUnit: '1',
        y: 'Strength utilization',
        yUnit: '1',
        traces: { y: 'Von Mises', reference: 'Tresca', third: 'Rankine' },
      },
      text: lesson(
        'Compare distortion-energy and maximum-shear yielding with a separate brittle maximum-normal-stress criterion.',
        'Can a purely hydrostatic stress make von Mises or Tresca predict yielding?',
        ['No, both depend on stress differences', 'Yes, at any pressure', 'Only Tresca does'],
        'Hydrostatic stress has zero deviatoric stress and zero principal stress differences.',
        'Pure uniaxial tension 200 MPa gives σVM=σTresca=200 MPa.',
        'σVM=√[½Σ(σi−σj)²]; σTresca=maxσ−minσ; UMaxNormal=max(maxσ/St,−minσ/Sc,0).',
        'User supplies principal stresses. Ductile criteria compare with Sy; Rankine uses independent tensile/compressive brittle strengths. These are onset screens, not fatigue, fracture, pressure-sensitive plasticity or safety-code decisions.',
      ),
    },
    (a) => {
      const s = [a.first, a.second, a.third],
        mises = Math.sqrt(((s[0] - s[1]) ** 2 + (s[1] - s[2]) ** 2 + (s[2] - s[0]) ** 2) / 2),
        tresca = Math.max(...s) - Math.min(...s),
        rankine = Math.max(0, Math.max(...s) / a.tensile, -Math.min(...s) / a.compressive);
      return result(
        { mises, tresca, rankine },
        seq(0, 2).map((x) => ({
          x,
          y: (x * mises) / a.yield,
          reference: (x * tresca) / a.yield,
          third: x * rankine,
        })),
        'stress',
        { principal: s },
        [
          ['Mises utilization', mises / a.yield],
          ['Tresca utilization', tresca / a.yield],
        ],
      );
    },
  ),
  castigliano: make(
    {
      id: 'castigliano',
      title: 'Castigliano Deflection and Strain Energy',
      inputs: {
        length: p('Cantilever length', 'm', 0.5, 8, 3),
        EI: p('Flexural rigidity EI', 'kN·m²', 100, 100000, 16000),
        EA: p('Axial rigidity EA', 'kN', 10000, 10000000, 200000),
        force: p('Transverse tip force', 'kN', -100, 100, 10),
        moment: p('Tip moment, adds to force bending', 'kN·m', -100, 100, 0),
        axial: p('Axial tip force', 'kN', -500, 500, 0),
      },
      metrics: {
        energy: ['Total strain energy', 'J'],
        deflection: ['Tip displacement along transverse load convention', 'mm'],
        rotation: ['Tip rotation', 'rad'],
        axial: ['Axial elongation', 'mm'],
      },
      plot: { x: 'Beam coordinate', xUnit: 'm', y: 'Bending moment', yUnit: 'kN·m' },
      text: lesson(
        'Integrate bending and axial strain energy and differentiate it with respect to independent tip loads.',
        'Is displacement equal to the derivative of energy with respect to its conjugate load?',
        [
          'Yes, for this linear elastic system',
          'Only for zero axial load',
          'No, it is the energy itself',
        ],
        'Castigliano’s theorem connects generalized load derivatives to displacements.',
        'With P=10 kN, L=3 m, EI=16000 kN·m² and no other loads, δ=5.625 mm.',
        'U=∫[P(L−x)+M]²/(2EI)dx+N²L/(2EA); δP=PL³/(3EI)+ML²/(2EI); θ=PL²/(2EI)+ML/EI.',
        'Prismatic small-deflection Euler–Bernoulli cantilever; independent end loads, no shear energy or geometric nonlinearity. The bending moment here is oriented to add positive P and M; work/deflection directions follow their conjugate loads.',
      ),
    },
    (a) => {
      const L = a.length,
        P = a.force,
        M = a.moment,
        U =
          ((P * P * L ** 3) / 3 + P * M * L * L + M * M * L) / (2 * a.EI) +
          (a.axial ** 2 * L) / (2 * a.EA);
      return result(
        {
          energy: U * 1000,
          deflection: ((P * L ** 3) / (3 * a.EI) + (M * L * L) / (2 * a.EI)) * 1000,
          rotation: (P * L * L) / (2 * a.EI) + (M * L) / a.EI,
          axial: ((a.axial * L) / a.EA) * 1000,
        },
        seq(0, L).map((x) => ({ x, y: P * (L - x) + M })),
        'beam',
        { supports: [0, L], fixed: true },
        [['Bending energy J', (U - (a.axial ** 2 * L) / (2 * a.EA)) * 1000]],
      );
    },
  ),
  eccentriccolumn: make(
    {
      id: 'eccentriccolumn',
      title: 'Eccentric Column: Secant Formula',
      inputs: {
        length: p('Pinned column length', 'm', 1, 10, 3),
        area: p('Area', 'mm²', 100, 30000, 4000),
        inertia: p('Second moment', 'cm⁴', 100, 50000, 8000),
        extreme: p('Extreme-fiber distance', 'mm', 10, 200, 100),
        modulus: p('Young modulus', 'GPa', 20, 220, 200),
        force: p('Compressive force', 'kN', 1, 2000, 100),
        eccentricity: p('End-load eccentricity', 'mm', 0, 100, 10),
      },
      validateValues: domain('force', (a) =>
        requireValue(
          a.force * 1000 <
            (Math.PI ** 2 * a.modulus * 1000 * a.inertia * 10000) / (a.length * 1000) ** 2,
          'Secant formula requires load strictly below the pinned Euler critical load.',
        ),
      ),
      metrics: {
        critical: ['Pinned Euler critical load', 'kN'],
        stress: ['Maximum compressive stress', 'MPa'],
        deflection: ['Maximum lateral displacement', 'mm'],
        ratio: ['Load / Euler load', '1'],
      },
      plot: { x: 'Column position', xUnit: 'm', y: 'Lateral deflection', yUnit: 'mm' },
      text: lesson(
        'Include elastic P–Δ amplification for an initially straight pin-ended column loaded through equal eccentricities.',
        'What happens as P approaches the ideal Euler load from below?',
        ['The secant amplification diverges', 'It tends to zero', 'It stays exactly linear'],
        'cos(kL/2) approaches zero.',
        'At zero eccentricity the pre-buckling deflection is zero, while the Euler critical load remains finite.',
        'k=√(P/EI); y(x)=e[cos(k(x−L/2))/cos(kL/2)−1]; σmax=P/A[1+ec/r² sec(kL/2)].',
        'Perfect straight column, pinned ends, equal end eccentricities in one plane, linear elastic material and small slopes. P<Pcr enforced. No imperfection sensitivity, yield-limited design, local buckling or post-buckling solution.',
      ),
    },
    (a) => {
      const L = a.length * 1000,
        EI = a.modulus * 1000 * a.inertia * 10000,
        P = a.force * 1000,
        k = Math.sqrt(P / EI),
        c = Math.cos((k * L) / 2),
        critical = (Math.PI ** 2 * EI) / L ** 2 / 1000,
        deflection = a.eccentricity * (1 / c - 1);
      return result(
        {
          critical,
          stress:
            (P / a.area) * (1 + (a.eccentricity * a.extreme * a.area) / (a.inertia * 10000) / c),
          deflection,
          ratio: a.force / critical,
        },
        seq(0, a.length).map((x) => ({
          x,
          y: a.eccentricity * (Math.cos(k * (x * 1000 - L / 2)) / c - 1),
        })),
        'column',
        { length: a.length, eccentricity: a.eccentricity, deflection },
        [['Radius of gyration mm', Math.sqrt((a.inertia * 10000) / a.area)]],
      );
    },
  ),
  closedtorsion: make(
    {
      id: 'closedtorsion',
      title: 'Thin-Walled Closed-Section Torsion',
      inputs: {
        width: p('Median-line width', 'mm', 50, 500, 200),
        height: p('Median-line height', 'mm', 50, 500, 100),
        thickness: p('Uniform wall thickness', 'mm', 1, 10, 3),
        torque: p('Applied torque', 'N·m', 0, 20000, 1000),
        shear: p('Shear modulus', 'GPa', 10, 90, 80),
        length: p('Tube length', 'm', 0.1, 10, 1),
      },
      validateValues: domain('thickness', (a) =>
        requireValue(
          a.thickness <= Math.min(a.width, a.height) / 10,
          'Require t ≤ 0.1 times the smaller median-line dimension.',
        ),
      ),
      metrics: {
        flow: ['Bredt shear flow', 'N/mm'],
        stress: ['Wall shear stress', 'MPa'],
        twist: ['Total twist', 'deg'],
        constant: ['Thin-wall torsion constant J', 'mm⁴'],
      },
      plot: { x: 'Torque', xUnit: 'N·m', y: 'Twist per metre', yUnit: 'deg/m' },
      text: lesson(
        'Use Bredt–Batho equilibrium and closed-cell compatibility for a single rectangular thin-walled tube.',
        'For fixed median-line geometry, doubling thickness changes twist how?',
        ['Halves it', 'Doubles it', 'Leaves it unchanged'],
        'J is proportional to thickness for this uniform thin-wall cell.',
        'bm=200 mm, hm=100 mm and t=3 mm give J=8×10⁶ mm⁴.',
        'q=T/(2Am); τ=q/t; J=4Am²/∮ds/t; θ=TL/(GJ).',
        'Single closed rectangular cell with constant thickness, median-line dimensions, small twist and free warping. Thin-wall approximation excludes corner details, multicell compatibility and open-section torsion.',
      ),
    },
    (a) => {
      const A = a.width * a.height,
        perimeter = 2 * (a.width + a.height),
        J = (4 * A * A * a.thickness) / perimeter,
        T = a.torque * 1000,
        flow = T / (2 * A),
        slope = (((1000 * 1000) / (a.shear * 1000 * J)) * 180) / Math.PI;
      return result(
        { flow, stress: flow / a.thickness, twist: a.torque * slope * a.length, constant: J },
        seq(0, 20000).map((x) => ({ x, y: x * slope })),
        'tube',
        { width: a.width, height: a.height, thickness: a.thickness },
        [
          ['Enclosed median area mm²', A],
          ['Median perimeter mm', perimeter],
        ],
      );
    },
  ),
  kirschhole: make(
    {
      id: 'kirschhole',
      title: 'Stress Concentration at a Circular Hole',
      inputs: {
        stress: p('Remote uniaxial tension', 'MPa', 0, 300, 100),
        radius: p('Hole radius', 'mm', 1, 50, 10),
        inspection: p('Inspection radius / hole radius', '1', 1, 5, 1),
      },
      metrics: {
        factor: ['Hole-edge elastic Kt', '1'],
        peak: ['Peak hole-edge hoop stress', 'MPa'],
        minimum: ['Minimum hole-edge hoop stress', 'MPa'],
      },
      plot: {
        x: 'Polar angle from loading axis',
        xUnit: 'deg',
        y: 'Stress',
        yUnit: 'MPa',
        traces: { y: 'Hoop σθ', reference: 'Radial σr', third: 'Shear τrθ' },
      },
      text: lesson(
        'Inspect Kirsch’s elastic stress field around a circular hole in an infinite plate under uniaxial tension.',
        'Where does the hole-edge tensile stress reach 3σ∞?',
        ['At 90° to the loading axis', 'At 0° on the loading axis', 'At every angle'],
        'σθ(a,θ)=σ∞(1−2cos2θ).',
        'With 100 MPa remote tension, the hole-edge hoop stress is 300 MPa at 90° and −100 MPa at 0°.',
        'σr=σ∞/2(1−a²/r²)+σ∞/2(1−4a²/r²+3a⁴/r⁴)cos2θ; σθ=σ∞/2(1+a²/r²)−σ∞/2(1+3a⁴/r⁴)cos2θ.',
        'Infinite isotropic thin plate, traction-free circular hole and tension-positive plane stress. No finite-width correction, plastic redistribution, crack-tip singularity or fatigue-notch sensitivity. Hole radius scales the geometry but not the ideal edge Kt.',
      ),
    },
    (a) => {
      const q = 1 / a.inspection ** 2,
        s = a.stress,
        series = seq(0, 360, 240).map((x) => ({
          x,
          y: (s / 2) * (1 + q) - (s / 2) * (1 + 3 * q * q) * Math.cos(2 * rad(x)),
          reference: (s / 2) * (1 - q) + (s / 2) * (1 - 4 * q + 3 * q * q) * Math.cos(2 * rad(x)),
          third: (-s / 2) * (1 + 2 * q - 3 * q * q) * Math.sin(2 * rad(x)),
        }));
      return result(
        { factor: 3, peak: 3 * s, minimum: -s },
        series,
        'hole',
        { radius: a.radius, inspection: a.inspection, stress: s },
        [
          ['Boundary radial traction at r=a', 0],
          ['Boundary shear traction at r=a', 0],
        ],
      );
    },
  ),
};
for (const id of ['proppedbeam', 'threemoment', 'momentdistribution']) {
  structuralModels[id].definition.outputs.series.deflection = 'mm';
  if (id !== 'proppedbeam') structuralModels[id].definition.outputs.series.shear = 'kN';
}

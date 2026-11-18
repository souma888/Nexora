import {
  engineering,
  p,
  choice,
  integer,
  textInput,
  seq,
  rad,
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
  engineering({ discipline: 'civil', topic: 'Geotechnical engineering', ...config }, solve);
export const consolidationDegree = (Tv) =>
  Tv === 0
    ? 0
    : Tv < 0.01
      ? 2 * Math.sqrt(Tv / Math.PI)
      : 1 -
        Array.from(
          { length: 100 },
          (_, m) =>
            (8 / (Math.PI ** 2 * (2 * m + 1) ** 2)) *
            Math.exp((-((2 * m + 1) ** 2) * Math.PI ** 2 * Tv) / 4),
        ).reduce((s, v) => s + v, 0);
export function rainDepths(source) {
  const a = String(source)
    .split(',')
    .map((s) => (s.trim() ? Number(s) : NaN));
  requireValue(
    a.length >= 1 && a.length <= 12 && a.every((v) => Number.isFinite(v) && v >= 0 && v <= 100),
    'Use 1–12 nonnegative rainfall depths in mm, each ≤100.',
  );
  return a;
}
export function reinforced(a) {
  const beta = Math.max(0.65, 0.85 - (0.05 * Math.max(a.concrete - 28, 0)) / 7),
    Es = 200000,
    ecu = 0.003,
    c = bisect(
      (c) =>
        0.85 * a.concrete * a.width * beta * c -
        a.steel * Math.min(a.yield, (Es * ecu * (a.depth - c)) / c),
      1e-7,
      a.depth,
    ),
    strain = (ecu * (a.depth - c)) / c,
    fs = Math.min(a.yield, Es * strain),
    block = beta * c,
    balance = (a.depth * ecu) / (ecu + a.yield / Es),
    Ab = (0.85 * a.concrete * a.width * beta * balance) / a.yield;
  return {
    c,
    strain,
    fs,
    block,
    beta,
    balance,
    Ab,
    moment: (a.steel * fs * (a.depth - block / 2)) / 1e6,
  };
}
export const civilSystemsModels = {
  soilphases: make(
    {
      id: 'soilphases',
      title: 'Soil Phase Relations and Void Ratio',
      inputs: {
        specific: p('Particle specific gravity Gs', '1', 2.4, 2.9, 2.65),
        void: p('Void ratio e', '1', 0.2, 2, 0.7),
        saturation: p('Degree of saturation', '1', 0, 1, 0.8),
      },
      metrics: {
        porosity: ['Porosity', '1'],
        water: ['Gravimetric water content', '1'],
        dry: ['Dry unit weight', 'kN/m³'],
        bulk: ['Bulk unit weight', 'kN/m³'],
      },
      plot: { x: 'Degree of saturation', xUnit: '1', y: 'Bulk unit weight', yUnit: 'kN/m³' },
      text: lesson(
        'Close the solid–water–air volume and mass balances using a unit solid volume.',
        'Can porosity exceed void ratio for positive e?',
        ['No, n=e/(1+e)<e', 'Yes, always', 'They are the same variable'],
        'Porosity uses total volume; void ratio uses solid volume.',
        'Gs=2.65, e=0.7 and Sr=0.8 give w≈0.21132 and n≈0.41176.',
        'n=e/(1+e); w=Sr e/Gs; γd=Gsγw/(1+e); γ=(Gs+Sr e)γw/(1+e).',
        'Ideal phase-volume bookkeeping with incompressible solids/water and negligible air mass. γw=9.80665 kN/m³. No suction, swelling, compaction law or drainage kinetics.',
      ),
    },
    (a) => {
      const n = a.void / (1 + a.void);
      return result(
        {
          porosity: n,
          water: (a.saturation * a.void) / a.specific,
          dry: (a.specific * 9.80665) / (1 + a.void),
          bulk: ((a.specific + a.saturation * a.void) * 9.80665) / (1 + a.void),
        },
        seq(0, 1).map((x) => ({ x, y: ((a.specific + x * a.void) * 9.80665) / (1 + a.void) })),
        'soil-phases',
        {
          fractions: [1 - n, n * a.saturation, n * (1 - a.saturation)],
          labels: ['Solids', 'Water', 'Air'],
        },
        [
          ['Saturated unit weight kN/m³', ((a.specific + a.void) * 9.80665) / (1 + a.void)],
          ['Air-filled porosity', n * (1 - a.saturation)],
        ],
      );
    },
  ),
  mohrcoulomb: make(
    {
      id: 'mohrcoulomb',
      title: 'Mohr–Coulomb Failure Envelope',
      inputs: {
        major: p('Major compressive effective stress', 'kPa', 10, 1000, 300),
        minor: p('Minor compressive effective stress', 'kPa', 0, 500, 100),
        cohesion: p('Effective cohesion', 'kPa', 0, 100, 10),
        friction: p('Effective friction angle', 'deg', 0, 45, 30),
      },
      validateValues: domain('minor', (a) =>
        requireValue(
          a.major >= a.minor,
          'Major effective stress must be at least the minor effective stress.',
        ),
      ),
      metrics: {
        radius: ['Mohr circle radius', 'kPa'],
        distance: ['Strength-line distance from center', 'kPa'],
        margin: ['Tangency reserve (distance−radius)', 'kPa'],
        factor: ['Radial strength factor', '1'],
      },
      plot: {
        x: 'Effective normal compression',
        xUnit: 'kPa',
        y: 'Shear stress',
        yUnit: 'kPa',
        traces: {
          y: 'Positive failure envelope',
          reference: 'Mohr upper arc',
          third: 'Mohr lower arc',
        },
      },
      text: lesson(
        'Compare a compression-positive effective-stress Mohr circle with a cohesive-frictional failure envelope.',
        'Does cohesion alone make strength increase with normal compression?',
        ['No, friction produces that slope', 'Yes, cohesion is the slope', 'Only if φ=0'],
        'The envelope slope is tanφ and its intercept is c.',
        'For c=0 and φ=30°, tangency occurs at σ1/σ3=(1+sinφ)/(1−sinφ)=3.',
        'τf=c+σ′n tanφ; C=(σ1+σ3)/2; R=(σ1−σ3)/2; d=c cosφ+C sinφ.',
        'Effective stresses, linear envelope, nonnegative compressive principal stresses and no tensile cutoff. The displayed radial factor d/R holds the circle center fixed; it is not a universal slope-stability safety factor. Hydrostatic R=0 gives an undefined ratio.',
      ),
    },
    (a) => {
      const C = (a.major + a.minor) / 2,
        R = (a.major - a.minor) / 2,
        d = a.cohesion * Math.cos(rad(a.friction)) + C * Math.sin(rad(a.friction));
      return result(
        { radius: R, distance: d, margin: d - R, factor: R ? d / R : null },
        seq(0, Math.max(a.major * 1.2, 1), 240).map((x) => ({
          x,
          y: a.cohesion + x * Math.tan(rad(a.friction)),
          reference: Math.abs(x - C) <= R ? Math.sqrt(Math.max(0, R * R - (x - C) ** 2)) : null,
          third: Math.abs(x - C) <= R ? -Math.sqrt(Math.max(0, R * R - (x - C) ** 2)) : null,
        })),
        'mohr',
        { center: C, radius: R, cohesion: a.cohesion, friction: a.friction },
        [
          [
            'Failure prediction',
            d < R ? 'Circle crosses strength line' : 'Circle is inside strength envelope',
          ],
        ],
      );
    },
  ),
  bearingcapacity: make(
    {
      id: 'bearingcapacity',
      title: 'Terzaghi Bearing Capacity',
      inputs: {
        shape: choice(
          'Footing shape',
          { strip: 'Strip', square: 'Square', circle: 'Circular' },
          'strip',
        ),
        width: p('Footing width / diameter', 'm', 0.5, 5, 2),
        depth: p('Embedment depth', 'm', 0, 3, 1),
        cohesion: p('Soil cohesion', 'kPa', 0, 100, 20),
        friction: p('Friction angle', 'deg', 0, 45, 30),
        weight: p('Effective soil unit weight', 'kN/m³', 8, 22, 18),
        safety: p('Factor on net ultimate capacity', '1', 2, 5, 3),
      },
      metrics: {
        ultimate: ['Gross ultimate capacity', 'kPa'],
        allowable: ['Gross allowable via net factor', 'kPa'],
        Nc: ['Terzaghi Nc', '1'],
        Nq: ['Terzaghi Nq', '1'],
      },
      plot: { x: 'Footing width', xUnit: 'm', y: 'Gross ultimate capacity', yUnit: 'kPa' },
      text: lesson(
        'Evaluate Terzaghi’s shallow-footing superposition using its original Nc/Nq form and an explicit interpolated Nγ table.',
        'At φ=0, does the unit-weight Nγ term remain?',
        ['No, Nγ=0', 'Yes, it dominates', 'It becomes infinite'],
        'The cohesion-only Terzaghi limit has Nc≈5.7, Nq=1 and Nγ=0.',
        'For a strip footing at φ=30°, Nq≈22.46, Nc≈37.16 and the chosen table gives Nγ=19.13.',
        'qult=sc cNc+qNq+sγγBNγ; Nq=exp[(3π/2−φ)tanφ]/[2cos²(π/4+φ/2)]; Nc=(Nq−1)cotφ.',
        'General shear, horizontal centrally loaded rough base, level homogeneous soil, vertical load and shallow embedment. Nγ linearly interpolated at 5° from a stated Terzaghi table; alternative factor conventions differ. Input γ and q=γD must already represent the intended groundwater condition. No inclination, seismic, layered-soil or settlement design check.',
      ),
    },
    (a) => {
      const phi = rad(a.friction),
        Nq =
          Math.exp((1.5 * Math.PI - phi) * Math.tan(phi)) /
          (2 * Math.cos(Math.PI / 4 + phi / 2) ** 2),
        Nc = a.friction === 0 ? 5.7 : (Nq - 1) / Math.tan(phi),
        vals = [0, 0.14, 0.56, 1.52, 3.64, 8.34, 19.13, 45.41, 115.31, 325.34],
        i = Math.min(8, Math.floor(a.friction / 5)),
        Ng = vals[i] + ((vals[i + 1] - vals[i]) * (a.friction - i * 5)) / 5,
        sc = a.shape === 'strip' ? 1 : 1.3,
        sg = a.shape === 'strip' ? 0.5 : a.shape === 'square' ? 0.4 : 0.3,
        q = a.weight * a.depth,
        f = (B) => sc * a.cohesion * Nc + q * Nq + sg * a.weight * B * Ng,
        ultimate = f(a.width);
      return result(
        { ultimate, allowable: q + (ultimate - q) / a.safety, Nc, Nq },
        seq(0.5, 5).map((x) => ({ x, y: f(x) })),
        'footing',
        { width: a.width, depth: a.depth },
        [
          ['Nγ (interpolated)', Ng],
          ['Effective overburden kPa', q],
          ['Net ultimate kPa', ultimate - q],
        ],
      );
    },
  ),
  consolidation: make(
    {
      id: 'consolidation',
      title: 'One-Dimensional Consolidation and Settlement',
      inputs: {
        height: p('Compressible layer thickness', 'm', 1, 20, 5),
        drainage: choice(
          'Drainage boundary',
          { double: 'Top and bottom drainage', single: 'One drainage face' },
          'double',
        ),
        coefficient: p('Consolidation coefficient cv', 'm²/year', 0.1, 20, 2),
        time: p('Elapsed time', 'year', 0.01, 30, 1),
        void: p('Initial void ratio', '1', 0.3, 2, 0.8),
        compression: p('Compression index Cc', '1', 0.05, 1, 0.3),
        initial: p('Initial vertical effective stress', 'kPa', 20, 500, 100),
        increment: p('Applied vertical stress increment', 'kPa', 1, 500, 100),
      },
      metrics: {
        ultimate: ['Primary consolidation settlement', 'mm'],
        current: ['Settlement at selected time', 'mm'],
        degree: ['Average consolidation degree', '1'],
        t90: ['Time to 90% primary consolidation', 'year'],
      },
      plot: { x: 'Elapsed time', xUnit: 'year', y: 'Settlement', yUnit: 'mm' },
      text: lesson(
        'Combine normally consolidated logarithmic compressibility with Terzaghi’s average degree-of-consolidation series.',
        'Changing double drainage to single drainage changes time to the same U by what factor?',
        ['Four', 'Two', 'One half'],
        'The drainage path doubles and characteristic time scales with its square.',
        'For H=5 m, e0=0.8, Cc=0.3 and σ′ doubling, final settlement is about 250.858 mm.',
        'S∞=HCc/(1+e0)log10[(σ′0+Δσ)/σ′0]; Tv=cvt/Hdr²; U=1−Σ8e^[−(2m+1)²π²Tv/4]/[π²(2m+1)²].',
        'Normally consolidated saturated homogeneous layer, instantaneous uniform load increment, constant cv, one-dimensional drainage and small-strain theory. 100 terms, exact U(0)=0; no secondary creep, stress-dependent cv or overconsolidation/recompression branch.',
      ),
    },
    (a) => {
      const H = a.drainage === 'double' ? a.height / 2 : a.height,
        S =
          ((a.height * a.compression) / (1 + a.void)) *
          Math.log10((a.initial + a.increment) / a.initial) *
          1000,
        U = (t) => consolidationDegree((a.coefficient * t) / (H * H)),
        t90 = (bisect((x) => consolidationDegree(x) - 0.9, 0.01, 2) * H * H) / a.coefficient;
      return result(
        { ultimate: S, current: S * U(a.time), degree: U(a.time), t90 },
        seq(0, Math.max(a.time, 2 * t90)).map((x) => ({ x, y: S * U(x) })),
        'soil-layer',
        { settlement: S * U(a.time), height: a.height },
        [
          ['Drainage path m', H],
          ['Fourier time Tv', (a.coefficient * a.time) / (H * H)],
        ],
      );
    },
  ),
  darcyflownet: make(
    {
      id: 'darcyflownet',
      title: 'Darcy Seepage and Rectangular Flow Nets',
      inputs: {
        conductivity: p('Hydraulic conductivity', 'm/s', 1e-7, 0.001, 1e-5),
        head: p('Boundary head difference', 'm', 0.1, 20, 5),
        channels: integer('Flow channels Nf', 1, 10, 4),
        drops: integer('Potential drops Nd', 2, 20, 10),
        cell: p('Square-cell side', 'm', 0.1, 2, 0.5),
        porosity: p('Effective porosity', '1', 0.1, 0.6, 0.3),
      },
      metrics: {
        flow: ['Seepage per unit out-of-plane width', 'm²/s'],
        gradient: ['Hydraulic gradient', '1'],
        velocity: ['Pore-water seepage speed', 'm/s'],
        drop: ['Head per potential drop', 'm'],
      },
      plot: { x: 'Distance from upstream boundary', xUnit: 'm', y: 'Hydraulic head', yUnit: 'm' },
      text: lesson(
        'Connect Darcy’s law with the channel/drop ratio of an exact homogeneous rectangular flow net.',
        'Doubling Nd while cell size and Nf remain fixed changes flow how?',
        ['Halves it', 'Doubles it', 'Leaves it unchanged'],
        'The flow length doubles while the aquifer thickness stays fixed.',
        'k=10⁻⁵ m/s, ΔH=5 m and Nf/Nd=4/10 give Q/b=2×10⁻⁵ m²/s.',
        'L=Nd a, D=Nf a; Q/b=kΔH D/L=kΔH Nf/Nd; vs=ki/ne.',
        'Homogeneous isotropic saturated rectangular aquifer, constant heads left/right and impermeable top/bottom. Equal square cells are an exact linear-head Laplace solution here. This does not generate curvilinear nets around sheet piles or dams, or calculate boiling/piping safety.',
      ),
    },
    (a) => {
      const L = a.drops * a.cell,
        i = a.head / L;
      return result(
        {
          flow: (a.conductivity * a.head * a.channels) / a.drops,
          gradient: i,
          velocity: (a.conductivity * i) / a.porosity,
          drop: a.head / a.drops,
        },
        seq(0, L).map((x) => ({ x, y: a.head * (1 - x / L) })),
        'flow-net',
        { channels: a.channels, drops: a.drops, head: a.head },
        [
          ['Flow length m', L],
          ['Aquifer thickness m', a.channels * a.cell],
        ],
      );
    },
  ),
  retainingwall: make(
    {
      id: 'retainingwall',
      title: 'Rankine Earth Pressure and Retaining Wall Stability',
      inputs: {
        height: p('Retained soil height', 'm', 1, 8, 4),
        friction: p('Soil friction angle', 'deg', 20, 40, 30),
        weight: p('Soil unit weight', 'kN/m³', 15, 22, 18),
        surcharge: p('Uniform surcharge', 'kPa', 0, 50, 10),
        wallweight: p('Wall vertical weight per length', 'kN/m', 20, 500, 150),
        base: p('Footing base width', 'm', 1, 6, 3),
        basefriction: p('Base friction coefficient', '1', 0.2, 0.7, 0.5),
        embedment: p('Passive toe embedment', 'm', 0, 2, 0),
      },
      metrics: {
        active: ['Active resultant per wall length', 'kN/m'],
        sliding: ['Sliding force ratio', '1'],
        overturning: ['Overturning moment ratio', '1'],
        minimum: ['Minimum full-contact base pressure', 'kPa'],
      },
      plot: {
        x: 'Depth below retained surface',
        xUnit: 'm',
        y: 'Active lateral pressure',
        yUnit: 'kPa',
      },
      text: lesson(
        'Integrate active soil and surcharge pressure, optionally include ideal toe passive resistance, and check simplified rigid-wall balances.',
        'Increasing retained height changes the soil-only active force how?',
        ['With height squared', 'Linearly only', 'It is independent of height'],
        'The triangular pressure has height proportional to H and width H.',
        'At φ=30°, Ka=1/3 and Kp=3. A 4 m wall with γ=18 kN/m³ and no surcharge has Pa=48 kN/m.',
        'Ka=(1−sinφ)/(1+sinφ), Kp=1/Ka; Pa=½KaγH²+KaqH; qbase=W/B(1±6e/B).',
        'Level cohesionless dry backfill, smooth vertical wall, sufficient displacement for Rankine active/passive states. Weight acts at base midpoint. No water, seismic load, wall flexibility or footing bearing-capacity check. Full passive resistance is an ideal limit; it may not be available. Negative qmin flags loss of full contact and is not redistributed.',
      ),
    },
    (a) => {
      const Ka = (1 - Math.sin(rad(a.friction))) / (1 + Math.sin(rad(a.friction))),
        Kp = 1 / Ka,
        Psoil = 0.5 * Ka * a.weight * a.height ** 2,
        Pq = Ka * a.surcharge * a.height,
        Pa = Psoil + Pq,
        Ma = (Psoil * a.height) / 3 + (Pq * a.height) / 2,
        Pp = 0.5 * Kp * a.weight * a.embedment ** 2,
        Mp = (Pp * a.embedment) / 3,
        e = (Ma - Mp) / a.wallweight,
        qmin = (a.wallweight / a.base) * (1 - (6 * Math.abs(e)) / a.base);
      return result(
        {
          active: Pa,
          sliding: (a.basefriction * a.wallweight + Pp) / Pa,
          overturning: ((a.wallweight * a.base) / 2 + Mp) / Ma,
          minimum: qmin,
        },
        seq(0, a.height).map((x) => ({ x, y: Ka * (a.weight * x + a.surcharge) })),
        'retaining-wall',
        { height: a.height, base: a.base, pressure: Pa },
        [
          ['Ka', Ka],
          ['Kp', Kp],
          ['Toe passive force kN/m', Pp],
          ['Base eccentricity m', e],
        ],
        qmin < 0
          ? [
              'Negative full-contact base pressure: lift-off/cracking invalidates that contact distribution.',
            ]
          : [],
      );
    },
  ),
  openchannel: make(
    {
      id: 'openchannel',
      title: 'Manning Flow and Hydraulic Jump',
      topic: 'Water resources',
      inputs: {
        flow: p('Discharge', 'm³/s', 0.1, 50, 5),
        width: p('Rectangular channel width', 'm', 0.5, 10, 3),
        depth: p('Approach flow depth', 'm', 0.05, 3, 0.3),
        roughness: p('Manning n', 's/m¹ᐟ³', 0.01, 0.06, 0.015),
        slope: p('Bed slope', '1', 0.0001, 0.02, 0.001),
      },
      metrics: {
        normal: ['Manning normal depth', 'm'],
        critical: ['Critical depth', 'm'],
        froude: ['Approach Froude number', '1'],
        conjugate: ['Conjugate jump depth, if supercritical', 'm'],
      },
      plot: { x: 'Flow depth', xUnit: 'm', y: 'Specific energy', yUnit: 'm' },
      text: lesson(
        'Solve normal depth numerically, locate critical depth and apply momentum conservation to a supercritical hydraulic jump.',
        'Does an ideal hydraulic jump conserve specific energy?',
        ['No, it dissipates energy', 'Yes, exactly', 'Only in a wide channel'],
        'Momentum balance gives conjugate depths while turbulence dissipates mechanical energy.',
        'For Fr1=2, y2/y1=(√33−1)/2≈2.3723.',
        'Q=(1/n)AR²ᐟ³S¹ᐟ²; Fr=Q/(by√gy); yc=(Q²/(gb²))¹ᐟ³; y2/y1=½(√(1+8Fr1²)−1).',
        'Steady rectangular prismatic channel, hydrostatic depth distributions and SI Manning n. Normal flow assumes uniform reach; jump equation assumes negligible bed-force change over a short horizontal jump. Null conjugate depth means approach flow is not supercritical.',
      ),
    },
    (a) => {
      const Q = a.flow,
        b = a.width,
        g = 9.80665,
        manning = (y) =>
          (b * y * ((b * y) / (b + 2 * y)) ** (2 / 3) * Math.sqrt(a.slope)) / a.roughness,
        normal = bisect((y) => manning(y) - Q, 1e-7, 100),
        critical = ((Q * Q) / (g * b * b)) ** (1 / 3),
        Fr = Q / (b * a.depth * Math.sqrt(g * a.depth)),
        conjugate = Fr > 1 ? (a.depth / 2) * (Math.sqrt(1 + 8 * Fr * Fr) - 1) : null;
      return result(
        { normal, critical, froude: Fr, conjugate },
        seq(Math.max(0.01, critical / 10), Math.max(critical * 4, a.depth * 2)).map((x) => ({
          x,
          y: x + (Q * Q) / (2 * g * b * b * x * x),
        })),
        'hydraulic-jump',
        { first: a.depth, second: conjugate, normal },
        [
          [
            'Jump energy loss m',
            conjugate === null
              ? 'No supercritical jump'
              : (conjugate - a.depth) ** 3 / (4 * a.depth * conjugate),
          ],
        ],
      );
    },
  ),
  runoff: make(
    {
      id: 'runoff',
      title: 'Rational Runoff and Unit Hydrograph',
      topic: 'Water resources',
      inputs: {
        rain: textInput(
          'Block rainfall depths',
          '5,15,10,0',
          100,
          '1–12 block depths in mm, each 0–100.',
        ),
        duration: p('Rain block duration', 'min', 5, 60, 15),
        area: p('Catchment area', 'km²', 0.1, 20, 1),
        coefficient: p('Constant runoff coefficient', '1', 0.1, 0.95, 0.6),
        peak: p('Unit-hydrograph time to peak', 'min', 10, 180, 30),
      },
      validateValues: domain('rain', (a) => {
        rainDepths(a.rain);
      }),
      metrics: {
        rational: ['Rational peak estimate', 'm³/s'],
        peak: ['Routed hydrograph peak', 'm³/s'],
        volume: ['Direct-runoff volume', 'm³'],
        integral: ['Integrated hydrograph volume', 'm³'],
      },
      plot: { x: 'Time from storm start', xUnit: 'min', y: 'Direct runoff', yUnit: 'm³/s' },
      text: lesson(
        'Compare a Rational-method steady peak estimate with a mass-conserving triangular unit-hydrograph convolution.',
        'Does increasing unit-hydrograph duration change runoff volume at fixed excess rainfall?',
        ['No, it spreads the same volume', 'Yes, it creates more runoff', 'It removes all runoff'],
        'The unit hydrograph is normalized to one millimetre of catchment runoff.',
        'A 10 mm excess depth on 1 km² produces exactly 10000 m³ of direct runoff.',
        'QR=0.278 C i A; Q(t)=Σ(CPk) UH(t−tk); triangular UH area=1000A m³ per mm.',
        'Constant runoff fraction, linear time-invariant triangular UH with base duration 3tp. Rain blocks are represented by midpoint impulses; shorter blocks improve temporal representation. Rational estimate assumes storm duration exceeds time of concentration and is a separate peak screen. No infiltration dynamics or base flow.',
      ),
    },
    (a) => {
      const rain = rainDepths(a.rain),
        base = 3 * a.peak,
        unitPeak = (2 * 1000 * a.area) / (base * 60),
        start = rain.map((_, i) => (i + 0.5) * a.duration),
        end = start.at(-1) + base,
        times = [
          ...new Set([...seq(0, end, 200), ...start.flatMap((t) => [t, t + a.peak, t + base])]),
        ].sort((x, y) => x - y),
        UH = (t) =>
          t < 0 || t > base
            ? 0
            : t <= a.peak
              ? (unitPeak * t) / a.peak
              : (unitPeak * (base - t)) / (base - a.peak),
        series = times.map((x) => ({
          x,
          y: rain.reduce((s, v, i) => s + a.coefficient * v * UH(x - start[i]), 0),
        })),
        volume = rain.reduce((s, v) => s + v, 0) * a.coefficient * a.area * 1000,
        integral = series
          .slice(1)
          .reduce((s, v, i) => s + ((v.y + series[i].y) / 2) * (v.x - series[i].x) * 60, 0);
      return result(
        {
          rational: ((0.278 * a.coefficient * Math.max(...rain) * 60) / a.duration) * a.area,
          peak: Math.max(...series.map((v) => v.y)),
          volume,
          integral,
        },
        series,
        'hydrograph',
        { rain, unitPeak },
        [
          ['Unit hydrograph peak per mm m³/s', unitPeak],
          ['Unit hydrograph base min', base],
        ],
      );
    },
  ),
  greenshields: make(
    {
      id: 'greenshields',
      title: 'Traffic Flow: Greenshields Fundamental Diagram',
      topic: 'Transport engineering',
      inputs: {
        free: p('Free-flow speed', 'km/h', 40, 120, 90),
        jam: p('Jam density', 'veh/km', 80, 200, 150),
        density: p('Upstream density', 'veh/km', 0, 200, 30),
        downstream: p('Downstream density', 'veh/km', 0, 200, 120),
      },
      validateValues: domain('density', (a) =>
        requireValue(
          a.density <= a.jam && a.downstream <= a.jam,
          'Traffic densities must not exceed the selected jam density.',
        ),
      ),
      metrics: {
        speed: ['Upstream mean speed', 'km/h'],
        flow: ['Upstream traffic flow', 'veh/h'],
        capacity: ['Greenshields maximum flow', 'veh/h'],
        shock: ['Shock propagation speed', 'km/h'],
      },
      plot: { x: 'Traffic density', xUnit: 'veh/km', y: 'Traffic flow', yUnit: 'veh/h' },
      text: lesson(
        'Inspect a parabolic flow–density model and use conservation to estimate the speed of a density discontinuity.',
        'Where does Greenshields predict maximum flow?',
        ['At half jam density', 'At jam density', 'At zero density'],
        'q=uf k(1−k/kj) has its vertex at kj/2.',
        'uf=90 km/h and kj=150 veh/km give capacity 3375 veh/h at 75 veh/km.',
        'u=uf(1−k/kj); q=ku; wshock=(q2−q1)/(k2−k1).',
        'Single homogeneous lane, equilibrium space-mean speed and ideal linear speed–density relationship. Shock speed is a kinematic boundary speed, not a vehicle speed; equal states give no uniquely defined discontinuity speed. Real traffic may require calibrated multi-regime models.',
      ),
    },
    (a) => {
      const q = (k) => a.free * k * (1 - k / a.jam),
        shock =
          a.downstream === a.density
            ? null
            : (q(a.downstream) - q(a.density)) / (a.downstream - a.density);
      return result(
        {
          speed: a.free * (1 - a.density / a.jam),
          flow: q(a.density),
          capacity: (a.free * a.jam) / 4,
          shock,
        },
        seq(0, a.jam).map((x) => ({ x, y: q(x) })),
        'traffic',
        { density: a.density, jam: a.jam },
        [
          ['Capacity density veh/km', a.jam / 2],
          ['Downstream flow veh/h', q(a.downstream)],
        ],
      );
    },
  ),
  webster: make(
    {
      id: 'webster',
      title: 'Signalized Intersection Delay: Webster',
      topic: 'Transport engineering',
      inputs: {
        flow: p('Approach demand', 'veh/h', 10, 1800, 600),
        cross: p('Other critical flow', 'veh/h', 10, 1200, 400),
        saturation: p('Each critical saturation flow', 'veh/h', 1500, 2200, 1800),
        cycle: p('Chosen cycle', 's', 30, 180, 90),
        green: p('Approach effective green', 's', 10, 120, 40),
        lost: p('Total cycle lost time', 's', 4, 20, 10),
      },
      validateValues: domain('green', (a) =>
        requireValue(
          a.green + a.lost < a.cycle,
          'Effective approach green plus cycle lost time must be less than cycle length.',
        ),
      ),
      metrics: {
        delay: ['Webster mean delay, undersaturated only', 's/veh'],
        utilization: ['Degree of saturation x', '1'],
        capacity: ['Approach capacity', 'veh/h'],
        optimal: ['Webster optimal cycle, if Y<1', 's'],
      },
      plot: { x: 'Approach demand', xUnit: 'veh/h', y: 'Webster delay', yUnit: 's/veh' },
      text: lesson(
        'Separate an undersaturated approach-delay estimate from Webster’s intersection-wide optimal-cycle approximation.',
        'What happens to the random-delay term as x approaches one from below?',
        ['It diverges', 'It goes to zero', 'It becomes independent of demand'],
        'The x²/[2q(1−x)] term signals the limit of the steady undersaturated approximation.',
        'At g/C=0.5 and q/c=0.5, the uniform delay term is C/6.',
        'd=C(1−λ)²/[2(1−λx)]+x²/[2q(1−x)]−0.65(C/q²)¹ᐟ³x^(2+5λ); C0=(1.5L+5)/(1−Y).',
        'Webster isolated fixed-time signal, random arrivals and undersaturation x<1; q in vehicles per second inside the delay formula. Total critical flow ratio Y includes the supplied crossing approach. Null delay/optimal cycle means its respective stability condition fails. No progression, pedestrian minimums or oversaturated queue evolution.',
      ),
    },
    (a) => {
      const lambda = a.green / a.cycle,
        capacity = a.saturation * lambda,
        X = a.flow / capacity,
        Y = (a.flow + a.cross) / a.saturation,
        f = (flow) => {
          const q = flow / 3600,
            x = flow / capacity;
          if (x >= 1) return null;
          return (
            (a.cycle * (1 - lambda) ** 2) / (2 * (1 - lambda * x)) +
            (x * x) / (2 * q * (1 - x)) -
            0.65 * (a.cycle / (q * q)) ** (1 / 3) * x ** (2 + 5 * lambda)
          );
        };
      return result(
        {
          delay: f(a.flow),
          utilization: X,
          capacity,
          optimal: Y < 1 ? (1.5 * a.lost + 5) / (1 - Y) : null,
        },
        seq(10, capacity * 0.99).map((x) => ({ x, y: f(x) })),
        'signal',
        { green: a.green, cycle: a.cycle },
        [['Sum critical flow ratios Y', Y]],
        X >= 1
          ? ['Approach is oversaturated; Webster steady undersaturated delay is undefined.']
          : [],
      );
    },
  ),
  roadcurve: make(
    {
      id: 'roadcurve',
      title: 'Horizontal Curve and Stopping Sight Distance',
      topic: 'Transport engineering',
      inputs: {
        speed: p('Design speed', 'km/h', 30, 120, 80),
        radius: p('Actual horizontal radius', 'm', 50, 1000, 300),
        superelevation: p('Superelevation e', '1', 0.02, 0.12, 0.07),
        side: p('Available side-friction factor', '1', 0.08, 0.2, 0.15),
        reaction: p('Perception/reaction time', 's', 1.5, 3, 2.5),
        braking: p('Longitudinal braking friction', '1', 0.3, 0.5, 0.35),
        grade: p('Longitudinal grade, positive uphill', '1', -0.08, 0.08, 0),
      },
      metrics: {
        radius: ['Minimum equilibrium curve radius', 'm'],
        sight: ['Stopping sight distance', 'm'],
        friction: ['Required signed side-friction factor', '1'],
        utilization: ['Absolute side-friction demand / supplied factor', '1'],
      },
      plot: { x: 'Vehicle speed', xUnit: 'km/h', y: 'Stopping sight distance', yUnit: 'm' },
      text: lesson(
        'Compare lateral curve equilibrium with reaction-plus-braking sight distance under an explicit signed grade.',
        'A downhill grade changes the braking distance how?',
        ['Increases it', 'Decreases it', 'Has no effect'],
        'A negative grade reduces the available net deceleration.',
        'At 80 km/h, e=0.07 and f=0.15, Rmin≈229.06 m.',
        'Rmin=V²/[127(e+f)]; SSD=0.278Vtr+V²/[254(fbrake+G)]; freq=V²/(127R)−e.',
        'Metric point-mass equilibrium and constant longitudinal deceleration. Friction, reaction time and superelevation are supplied assumptions, not a jurisdiction-specific highway design standard. No combined tire-friction ellipse, vertical curve, wet-surface calibration or sight obstruction geometry.',
      ),
    },
    (a) => {
      const f = (V) => 0.278 * V * a.reaction + (V * V) / (254 * (a.braking + a.grade)),
        friction = (a.speed * a.speed) / (127 * a.radius) - a.superelevation;
      return result(
        {
          radius: (a.speed * a.speed) / (127 * (a.superelevation + a.side)),
          sight: f(a.speed),
          friction,
          utilization: Math.abs(friction) / a.side,
        },
        seq(30, 120).map((x) => ({ x, y: f(x) })),
        'road-curve',
        { radius: a.radius, speed: a.speed },
        [
          ['Actual radius m', a.radius],
          ['Grade sign', a.grade >= 0 ? 'Uphill' : 'Downhill'],
        ],
      );
    },
  ),
  rcflexure: make(
    {
      id: 'rcflexure',
      title: 'Reinforced-Concrete Beam Flexure',
      topic: 'Concrete structures',
      inputs: {
        width: p('Rectangular width b', 'mm', 150, 600, 300),
        depth: p('Effective depth d', 'mm', 200, 1000, 500),
        steel: p('Tension steel area As', 'mm²', 100, 15000, 2000),
        yield: p('Steel yield stress', 'MPa', 250, 600, 500),
        concrete: p('Concrete compressive strength', 'MPa', 20, 60, 30),
      },
      metrics: {
        moment: ['Nominal flexural resistance', 'kN·m'],
        strain: ['Tension steel strain at concrete crushing', '1'],
        stress: ['Actual steel stress at crushing', 'MPa'],
        balanced: ['Balanced steel area', 'mm²'],
      },
      plot: { x: 'Steel area', xUnit: 'mm²', y: 'Nominal flexural resistance', yUnit: 'kN·m' },
      text: lesson(
        'Enforce strain compatibility and internal force balance so over-reinforced steel is not incorrectly assumed to yield.',
        'At an over-reinforced section’s concrete crushing limit, has the tension steel necessarily yielded?',
        ['No', 'Yes, by definition', 'Steel carries no force'],
        'The neutral axis can be deep enough to keep εs below fy/Es.',
        'At balance, εcu=0.003 and εs=fy/200000 define cb=d·0.003/(0.003+fy/200000).',
        'C=0.85f′c bβ1c=Asfs; εs=0.003(d−c)/c; fs=min(fy,Esεs); Mn=Asfs(d−β1c/2).',
        'Singly reinforced rectangle, no compression steel or axial force, concrete tension neglected, plane sections, εcu=0.003 and Es=200 GPa. Whitney-style β1 decreases from 0.85 above 28 MPa to a 0.65 floor. Outputs are nominal resistance, with no code strength reduction, detailing, shear or serviceability checks.',
      ),
    },
    (a) => {
      const r = reinforced(a);
      return result(
        { moment: r.moment, strain: r.strain, stress: r.fs, balanced: r.Ab },
        seq(100, 15000, 100).map((x) => ({ x, y: reinforced({ ...a, steel: x }).moment })),
        'concrete',
        { ...a, c: r.c, block: r.block, strain: r.strain },
        [
          ['Neutral axis c mm', r.c],
          ['Equivalent block a mm', r.block],
          ['β1', r.beta],
          [
            'Classification',
            a.steel < r.Ab
              ? 'Under-reinforced (steel yields first)'
              : a.steel > r.Ab
                ? 'Over-reinforced (concrete crushes before steel yield)'
                : 'Balanced',
          ],
        ],
      );
    },
  ),
};

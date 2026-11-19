import {
  exploration as lab,
  p,
  choice,
  seq,
  rad,
  teaching,
  output,
  domain,
  requireValue,
  bisect,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'aerospace', topic: 'Flight & orbital mechanics', ...config }, solve);
export const EARTH_MU = 398600.4418;
export function keplerE(M, e) {
  let E = M;
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}
export function orbitalPoint(a, e, i, raan, argument, M) {
  const E = keplerE(M, e),
    x = a * (Math.cos(E) - e),
    y = a * Math.sqrt(1 - e * e) * Math.sin(E),
    cO = Math.cos(raan),
    sO = Math.sin(raan),
    cw = Math.cos(argument),
    sw = Math.sin(argument),
    ci = Math.cos(i),
    si = Math.sin(i);
  return {
    x: (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y,
    y: (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y,
    z: sw * si * x + cw * si * y,
    r: a * (1 - e * Math.cos(E)),
    E,
  };
}
export function normalShock(M, g = 1.4) {
  const p = 1 + ((2 * g) / (g + 1)) * (M * M - 1),
    density = ((g + 1) * M * M) / ((g - 1) * M * M + 2),
    down = Math.sqrt((1 + ((g - 1) * M * M) / 2) / (g * M * M - (g - 1) / 2));
  return { pressure: p, density, temperature: p / density, mach: down };
}
export function obliqueShock(M, theta, g = 1.4, branch = 'weak') {
  const betaMin = Math.asin(1 / M),
    deflect = (b) =>
      Math.atan(
        ((2 / Math.tan(b)) * (M * M * Math.sin(b) ** 2 - 1)) / (M * M * (g + Math.cos(2 * b)) + 2),
      ),
    grid = seq(betaMin, Math.PI / 2, 1200),
    peak = grid.reduce((a, b) => (deflect(a) > deflect(b) ? a : b)),
    max = deflect(peak);
  if (theta > max + 1e-10)
    return {
      attached: false,
      maximum: (max * 180) / Math.PI,
      beta: null,
      pressure: null,
      density: null,
      temperature: null,
      mach: null,
    };
  const beta =
      theta < 1e-12
        ? branch === 'weak'
          ? betaMin
          : Math.PI / 2
        : bisect(
            (b) => deflect(b) - theta,
            ...(branch === 'weak' ? [betaMin, peak] : [peak, Math.PI / 2]),
          ),
    r = normalShock(M * Math.sin(beta), g);
  return {
    ...r,
    mach: r.mach / Math.sin(beta - theta),
    beta: (beta * 180) / Math.PI,
    maximum: (max * 180) / Math.PI,
    attached: true,
  };
}
export const flightOrbitalModels = {
  keplerorbit: make(
    {
      id: 'keplerorbit',
      title: 'Kepler Orbit Elements and Propagation',
      inputs: {
        axis: p('Semi-major axis', 'km', 7000, 40000, 12000),
        eccentricity: p('Eccentricity', '1', 0, 0.8, 0.3),
        inclination: p('Inclination', '°', 0, 180, 30),
        raan: p('Longitude of ascending node', '°', 0, 360, 40),
        argument: p('Argument of periapsis', '°', 0, 360, 20),
        anomaly: p('Initial mean anomaly', '°', 0, 360, 0),
      },
      validateValues: domain('eccentricity', (a) =>
        requireValue(
          a.axis * (1 - a.eccentricity) > 6371,
          'Periapsis must remain above the 6371 km Earth model.',
        ),
      ),
      metrics: {
        period: ['Kepler orbital period', 'min'],
        periapsis: ['Periapsis altitude', 'km'],
        apoapsis: ['Apoapsis altitude', 'km'],
        energy: ['Specific orbital energy', 'km²/s²'],
      },
      plot: { x: 'Elapsed time', xUnit: 'min', y: 'Geocentric radius', yUnit: 'km' },
      text: teaching(
        'Propagate all six elliptic orbit elements using Kepler’s equation and rotate the orbital plane into inertial coordinates.',
        'Does the satellite move faster near periapsis?',
        ['Yes', 'No', 'Only in circular orbits'],
        'Conservation of angular momentum makes angular motion faster at smaller radius.',
        'A circular 7000 km orbit has period about 97.14 min and energy −28.47 km²/s².',
        'M=M₀+nt; M=E−e sinE; r=a(1−e cosE); n=√(μ/a³); ε=−μ/(2a).',
        'Two-body Earth model μ=398600.4418 km³/s² and radius 6371 km. No J2, drag, lunar effects, maneuvers or collision propagation. Diagram uses an orthographic projection and labels inertial coordinates.',
      ),
    },
    (a) => {
      const period = 2 * Math.PI * Math.sqrt(a.axis ** 3 / EARTH_MU),
        points = seq(0, period, 360).map((t) => ({
          t,
          ...orbitalPoint(
            a.axis,
            a.eccentricity,
            rad(a.inclination),
            rad(a.raan),
            rad(a.argument),
            rad(a.anomaly) + (2 * Math.PI * t) / period,
          ),
        }));
      return output(
        {
          period: period / 60,
          periapsis: a.axis * (1 - a.eccentricity) - 6371,
          apoapsis: a.axis * (1 + a.eccentricity) - 6371,
          energy: -EARTH_MU / (2 * a.axis),
        },
        points.map((v) => ({ x: v.t / 60, y: v.r })),
        'orbit',
        { points, axis: a.axis },
      );
    },
  ),
  hohmann: make(
    {
      id: 'hohmann',
      title: 'Hohmann Transfer and Delta-v',
      inputs: {
        initial: p('Initial circular altitude', 'km', 200, 30000, 300),
        final: p('Target circular altitude', 'km', 200, 40000, 35786),
      },
      metrics: {
        first: ['Signed first tangential impulse', 'km/s'],
        second: ['Signed second tangential impulse', 'km/s'],
        total: ['Total impulse magnitude', 'km/s'],
        time: ['Transfer flight time', 'h'],
      },
      plot: { x: 'Transfer true anomaly', xUnit: '°', y: 'Radius', yUnit: 'km' },
      text: teaching(
        'Calculate both signed burns and half-period coast for an ideal coplanar circular-to-circular transfer.',
        'Are inward-transfer impulses prograde?',
        ['No, both are retrograde', 'Yes', 'Only the first is prograde'],
        'An inward ellipse requires reducing speed at departure and again when circularizing at the lower radius.',
        'Identical initial and final radii yield zero delta-v; the defined coast remains half a circular period.',
        'aₜ=(r₁+r₂)/2; Δv₁=√(μ/r₁)[√(2r₂/(r₁+r₂))−1]; Δv₂=√(μ/r₂)[1−√(2r₁/(r₁+r₂))].',
        'Impulsive coplanar two-body transfer between circular Earth orbits; no launch, plane change, finite burn or rendezvous phasing. Signed burns are tangential, total uses absolute magnitudes.',
      ),
    },
    (a) => {
      const r1 = 6371 + a.initial,
        r2 = 6371 + a.final,
        axis = (r1 + r2) / 2,
        e = Math.abs(r2 - r1) / (r1 + r2),
        first = Math.sqrt(EARTH_MU / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1),
        second = Math.sqrt(EARTH_MU / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2))),
        points = seq(0, 180, 180).map((x) => ({
          x,
          y: (axis * (1 - e * e)) / (1 + (r2 >= r1 ? 1 : -1) * e * Math.cos(rad(x))),
        }));
      return output(
        {
          first,
          second,
          total: Math.abs(first) + Math.abs(second),
          time: (Math.PI * Math.sqrt(axis ** 3 / EARTH_MU)) / 3600,
        },
        points,
        'transfer',
        { r1, r2, axis },
      );
    },
  ),
  planechange: make(
    {
      id: 'planechange',
      title: 'Plane Change and Delta-v Budget',
      inputs: {
        speed: p('Initial orbital speed', 'km/s', 0.5, 12, 7.5),
        final: p('Final speed at burn', 'km/s', 0.5, 12, 7.5),
        angle: p('Plane-change angle', '°', 0, 120, 20),
        exhaust: p('Specific impulse', 's', 100, 900, 320),
      },
      metrics: {
        combined: ['Combined velocity-change magnitude', 'km/s'],
        separate: ['Speed change then plane change at final speed', 'km/s'],
        propellant: ['Ideal propellant mass fraction', '%'],
      },
      plot: {
        x: 'Plane-change angle',
        xUnit: '°',
        y: 'Impulse magnitude',
        yUnit: 'km/s',
        traces: { y: 'Combined burn', reference: 'Separate burns at same point' },
      },
      text: teaching(
        'Compare a vector-combined speed/plane change with separate impulses and convert delta-v into propellant fraction.',
        'Is a plane change cheaper at lower speed?',
        ['Yes', 'No', 'Only for zero angle'],
        'For equal speeds, the cost is 2v sin(Δi/2).',
        'At v=7.5 km/s, a 20° pure plane change costs 2.6047 km/s.',
        'Δv=√(v₁²+v₂²−2v₁v₂cosΔi); mf/m0=exp[−Δv/(g₀Isp)].',
        'Instantaneous maneuver at a node with velocity-vector separation equal to the requested angle. The separate comparison performs speed change first and plane change at v₂. No full orbit-transfer optimization.',
      ),
    },
    (a) => {
      const calc = (x) =>
          Math.sqrt((a.speed - a.final) ** 2 + 4 * a.speed * a.final * Math.sin(rad(x) / 2) ** 2),
        dv = calc(a.angle);
      return output(
        {
          combined: dv,
          separate: Math.abs(a.final - a.speed) + 2 * a.final * Math.sin(rad(a.angle) / 2),
          propellant: 100 * -Math.expm1((-dv * 1000) / (9.80665 * a.exhaust)),
        },
        seq(0, 120).map((x) => ({
          x,
          y: calc(x),
          reference: Math.abs(a.final - a.speed) + 2 * a.final * Math.sin(rad(x) / 2),
        })),
        'velocity-vectors',
        { ...a },
      );
    },
  ),
  thinairfoil: make(
    {
      id: 'thinairfoil',
      title: 'Thin-Airfoil Lift Slope and Stall Envelope',
      inputs: {
        angle: p('Angle of attack', '°', -15, 20, 5),
        zero: p('Zero-lift angle', '°', -5, 2, -2),
        aspect: p('Wing aspect ratio', '1', 3, 15, 8),
        efficiency: p('Span efficiency', '1', 0.5, 1, 0.8),
        maximum: p('Illustrative CL cap', '1', 0.7, 2, 1.4),
      },
      metrics: {
        slope: ['Finite-wing lift slope', 'rad⁻¹'],
        linear: ['Linear theory CL', '1'],
        capped: ['Illustrative capped CL', '1'],
        stall: ['Positive cap onset', '°'],
      },
      plot: {
        x: 'Angle of attack',
        xUnit: '°',
        y: 'Lift coefficient',
        yUnit: '1',
        traces: { y: 'Finite-wing linear theory', reference: 'Illustrative capped envelope' },
      },
      text: teaching(
        'Compare 2D thin-airfoil slope with lifting-line correction and a clearly separated stall limit.',
        'Does thin-airfoil theory predict separated post-stall flow?',
        ['No', 'Yes', 'Only for symmetric airfoils'],
        'Potential-flow theory is a pre-stall approximation; the cap is a teaching envelope, not a stall solver.',
        'At AR=8 and e=.8, a=2π/[1+2/(eAR)]≈4.787 rad⁻¹.',
        'a=a₀/[1+a₀/(πeAR)], a₀=2π; CL=a(α−αL0).',
        'Incompressible small-angle attached flow. The capped curve uses a supplied CL limit and has no calibrated post-stall decay, Reynolds dependence or hysteresis.',
      ),
    },
    (a) => {
      const slope = (2 * Math.PI) / (1 + 2 / (a.efficiency * a.aspect)),
        linear = slope * rad(a.angle - a.zero),
        cap = (v) => Math.max(-a.maximum, Math.min(a.maximum, v));
      return output(
        {
          slope,
          linear,
          capped: cap(linear),
          stall: a.zero + ((a.maximum / slope) * 180) / Math.PI,
        },
        seq(-15, 20).map((x) => ({
          x,
          y: slope * rad(x - a.zero),
          reference: cap(slope * rad(x - a.zero)),
        })),
        'airfoil',
        { ...a },
      );
    },
  ),
  shockrelations: make(
    {
      id: 'shockrelations',
      title: 'Normal and Oblique Shock Relations',
      inputs: {
        mach: p('Upstream Mach number', '1', 1.1, 8, 2),
        gamma: p('Specific heat ratio', '1', 1.1, 1.67, 1.4),
        turn: p('Wedge deflection', '°', 0, 40, 10),
        kind: choice('Shock solution', ['normal', 'weak', 'strong'], 'weak'),
      },
      metrics: {
        downstream: ['Downstream Mach number', '1'],
        pressure: ['Pressure ratio p₂/p₁', '1'],
        temperature: ['Temperature ratio T₂/T₁', '1'],
        angle: ['Shock angle β, if attached', '°'],
        maximum: ['Maximum attached deflection', '°'],
      },
      plot: {
        x: 'Wedge deflection',
        xUnit: '°',
        y: 'Shock angle',
        yUnit: '°',
        traces: { y: 'Weak branch', reference: 'Strong branch' },
      },
      text: teaching(
        'Solve the θ–β–M relation on both attached branches and apply normal-shock balances to the normal velocity component.',
        'Does every wedge angle admit an attached oblique shock?',
        ['No', 'Yes', 'Only if M exceeds one'],
        'Above a Mach-dependent maximum turning angle the attached branches disappear.',
        'For a normal shock at M=2, γ=1.4: p₂/p₁=4.5 and M₂≈0.57735.',
        'tanθ=2cotβ(M₁²sin²β−1)/[M₁²(γ+cos2β)+2]; use Mn₁=M₁sinβ.',
        'Calorically perfect ideal gas, inviscid adiabatic shock. Detached oblique requests return null state with a warning; the model does not substitute a normal shock or predict bow-shock geometry.',
      ),
    },
    (a) => {
      const r =
          a.kind === 'normal'
            ? {
                ...normalShock(a.mach, a.gamma),
                beta: 90,
                maximum: obliqueShock(a.mach, 0, a.gamma).maximum,
                attached: true,
              }
            : obliqueShock(a.mach, rad(a.turn), a.gamma, a.kind),
        s = seq(0, 40, 100).map((x) => {
          const w = obliqueShock(a.mach, rad(x), a.gamma, 'weak'),
            v = obliqueShock(a.mach, rad(x), a.gamma, 'strong');
          return { x, y: w.attached ? w.beta : null, reference: v.attached ? v.beta : null };
        });
      return output(
        {
          downstream: r.attached ? r.mach : null,
          pressure: r.attached ? r.pressure : null,
          temperature: r.attached ? r.temperature : null,
          angle: r.attached ? r.beta : null,
          maximum: r.maximum,
        },
        s,
        'shock',
        { ...a, ...r },
        [],
        r.attached
          ? []
          : [
              'This wedge angle exceeds the attached-shock limit; a detached-flow solution is required.',
            ],
      );
    },
  ),
  longitudinalstability: make(
    {
      id: 'longitudinalstability',
      title: 'Static Longitudinal Stability and CG Margin',
      inputs: {
        wing: p('Wing aerodynamic center x/c', '1', 0.1, 0.4, 0.25),
        tail: p('Horizontal tail volume coefficient', '1', 0.1, 1.5, 0.6),
        efficiency: p('Tail dynamic-pressure ratio', '1', 0.5, 1, 0.9),
        downwash: p('Downwash gradient dε/dα', '1', 0, 0.7, 0.3),
        ratio: p('Tail/wing lift-slope ratio', '1', 0.3, 1.2, 0.8),
        cg: p('Center of gravity x/c', '1', 0, 0.8, 0.3),
      },
      metrics: {
        neutral: ['Neutral point x/c', '1'],
        margin: ['Static margin', '% MAC'],
        slope: ['Cmα / wing lift slope', '1'],
        stable: ['Static longitudinal stability', 'boolean'],
      },
      plot: { x: 'CG position x/c', xUnit: '1', y: 'Static margin', yUnit: '% MAC' },
      text: teaching(
        'Estimate the neutral point from tail volume and downwash, then inspect how CG location changes static stability.',
        'Is a CG ahead of the neutral point statically stable?',
        ['Yes', 'No', 'Only with zero tail volume'],
        'A positive static margin produces a restoring pitching-moment slope.',
        'xAC=.25, VH=.6, η=.9, at/aw=.8 and downwash=.3 give xNP=.5524.',
        'xNP=xAC+ηVH(at/aw)(1−dε/dα); SM=xNP−xCG; Cmα=−aW·SM.',
        'Linear stick-fixed wing–tail approximation with no fuselage correction, propwash or compressibility. Static stability is not dynamic damping, trim feasibility or certification compliance.',
      ),
    },
    (a) => {
      const neutral = a.wing + a.efficiency * a.tail * a.ratio * (1 - a.downwash),
        margin = neutral - a.cg;
      return output(
        { neutral, margin: margin * 100, slope: -margin, stable: +(margin > 0) },
        seq(0, 0.8).map((x) => ({ x, y: (neutral - x) * 100 })),
        'aircraft-cg',
        { ...a, neutral },
      );
    },
  ),
  breguet: make(
    {
      id: 'breguet',
      title: 'Breguet Range and Endurance',
      inputs: {
        speed: p('Constant cruise speed', 'm/s', 50, 300, 200),
        ratio: p('Lift-to-drag ratio', '1', 5, 30, 15),
        consumption: p('Jet weight-specific fuel consumption', 'h⁻¹', 0.2, 1.5, 0.6),
        initial: p('Initial aircraft mass', 'kg', 1000, 100000, 20000),
        final: p('Final aircraft mass', 'kg', 500, 90000, 15000),
      },
      validateValues: domain('final', (a) =>
        requireValue(a.final < a.initial, 'Final mass must be below initial mass.'),
      ),
      metrics: {
        range: ['Ideal still-air range', 'km'],
        endurance: ['Ideal endurance', 'h'],
        fuel: ['Fuel mass consumed', 'kg'],
      },
      plot: { x: 'Remaining mass', xUnit: 'kg', y: 'Accumulated range', yUnit: 'km' },
      text: teaching(
        'Integrate the ideal constant-speed jet cruise fuel balance and relate logarithmic mass ratio to range and endurance.',
        'Does doubling fuel fraction double range exactly?',
        ['No, the relation is logarithmic', 'Yes', 'Range is independent of fuel'],
        'Weight decreases throughout cruise, so fuel expenditure and distance do not scale linearly.',
        'V=200 m/s, L/D=15, c=.6 h⁻¹ and mass ratio 4/3 yield about 5178.3 km and 7.192 h.',
        'E=(L/D)/c·ln(mi/mf); R=V E, with consistent time units.',
        'Jet Breguet form with weight-flow TSFC c in h⁻¹, constant speed, L/D and consumption. No reserves, climb, wind, fuel-volume constraints or propeller-specific BSFC conversion.',
      ),
    },
    (a) => {
      const endurance = (a.ratio / a.consumption) * Math.log(a.initial / a.final);
      return output(
        { range: a.speed * 3.6 * endurance, endurance, fuel: a.initial - a.final },
        seq(a.final, a.initial).map((x) => ({
          x,
          y: ((a.speed * 3.6 * a.ratio) / a.consumption) * Math.log(a.initial / x),
        })),
        'fuel-range',
        { ...a },
      );
    },
  ),
};

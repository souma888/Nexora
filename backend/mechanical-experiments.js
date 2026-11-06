import { cosine, experiment, parameter, samples } from './experiment.js';

export const mechanicalModels = {
  buckling: experiment('buckling', {
    title: 'Euler Column Buckling', discipline: 'civil', lab: '10',
    description: 'Explore how length, end restraint, and section stiffness affect the elastic buckling load.',
    predict: 'What happens to the critical load if the effective length doubles?',
    prediction: [['It halves', 'It drops to one quarter', 'It stays fixed'], 1, 'The critical load scales with the inverse square of effective length.'],
    example: 'For a 2 m pin-ended column with E = 200 GPa and I = 100 cm⁴, Euler’s equation gives about 493.5 kN.',
    equation: 'Pcr = π²EI/(KL)². Use K = 1 for pinned ends, 0.5 for fixed ends, or 2 for a fixed-free column.',
    limits: 'Use the smaller bending-axis I for an ideal straight, slender column in axial compression. The model excludes yielding, imperfections, and eccentricity.',
    inputs: {
      length: parameter('Column length', 'm', 0.25, 20, 2),
      modulus: parameter('Elastic modulus', 'GPa', 1, 500, 200),
      inertia: parameter('Second moment of area', 'cm⁴', 1, 100000, 100),
      factor: parameter('Effective length factor K', '', 0.5, 2, 1),
    },
    metrics: { critical: 'Critical load', effective: 'Effective length', rigidity: 'Flexural rigidity' },
    plot: { title: 'Critical load versus length', x: 'Column length', y: 'Critical load', traces: { y: 'Euler load', sample: 'Selected length' } },
    outputs: { summary: { critical: 'kN', effective: 'm', rigidity: 'kN·m²' }, series: { x: 'm', y: 'kN', sample: 'kN' } },
  }, ({ length, modulus, inertia, factor }) => {
    const rigidity = modulus * inertia * 0.01;
    const critical = x => Math.PI ** 2 * rigidity / (factor * x) ** 2;
    const series = samples(length / 2, 1.5 * length, x => ({ y: critical(x) }), 80);
    series[40] = { x: length, y: critical(length), sample: critical(length) };
    return { summary: { critical: critical(length), effective: factor * length, rigidity }, series };
  }),
  hydrostatic: experiment('hydrostatic', {
    title: 'Hydrostatic Gate Loading', discipline: 'civil', lab: '11',
    description: 'Find the pressure distribution, resultant force, and center of pressure on a rectangular gate.',
    predict: 'With the top at the surface, where does the resultant act?',
    prediction: [['Halfway down', 'Two-thirds down', 'At the bottom'], 1, 'Pressure increases linearly from zero, so the triangular distribution has its centroid two-thirds down.'],
    example: 'A 3 m wide gate extends 2 m below the water surface. Water at 1,000 kg/m³ produces 58.86 kN, acting 1.333 m below the surface.',
    equation: 'p = ρgz. F = ρg·bH(d + H/2). The center of pressure is at z = d + H/2 + H²/[12(d + H/2)].',
    limits: 'Depth z is positive downward from the free surface, d is the top depth, and H is gate height. The fluid is static, has uniform density, and acts on one side with atmospheric pressure subtracted.',
    inputs: {
      width: parameter('Gate width', 'm', 0.1, 20, 3),
      height: parameter('Gate height', 'm', 0.1, 20, 2),
      depth: parameter('Depth of top edge', 'm', 0, 30, 0),
      density: parameter('Fluid density', 'kg/m³', 500, 2000, 1000),
    },
    metrics: { force: 'Resultant force', center: 'Center of pressure depth', bottom: 'Bottom pressure' },
    plot: { title: 'Pressure distribution', x: 'Depth below surface', y: 'Gauge pressure', traces: { y: 'Hydrostatic pressure' } },
    outputs: { summary: { force: 'kN', center: 'm', bottom: 'kPa' }, series: { x: 'm', y: 'kPa' } },
  }, ({ width, height, depth, density }) => {
    const pressure = x => density * 9.81 * x / 1000;
    const centroid = depth + height / 2;
    const bottom = depth + height;
    return {
      summary: { force: pressure(centroid) * width * height, center: centroid + height ** 2 / (12 * centroid), bottom: pressure(bottom) },
      series: [{ x: depth, y: pressure(depth) }, { x: bottom, y: pressure(bottom) }],
    };
  }),
  torsion: experiment('torsion', {
    title: 'Circular Shaft Torsion', discipline: 'mechanical', lab: '12',
    description: 'See how a solid shaft twists and how the outer shear stress changes with diameter.',
    predict: 'At the same torque, what happens to twist if the shaft diameter doubles?',
    prediction: [['It halves', 'It drops to one sixteenth', 'It drops to one eighth'], 1, 'Twist is inversely proportional to the polar second moment, which grows with the fourth power of diameter.'],
    example: 'A 40 mm solid shaft, 1 m long with G = 80 GPa, twists about 0.57° under 0.2 kN·m and develops about 15.9 MPa of outer shear stress.',
    equation: 'J = πd⁴/32. Outer shear stress is τ = T(d/2)/J. The angle at distance x is θ = Tx/(GJ).',
    limits: 'The shaft is solid, circular, prismatic, and elastic, with constant signed torque. Stress concentrations and yielding are outside this model.',
    inputs: {
      torque: parameter('Applied torque', 'kN·m', -20, 20, 0.2),
      diameter: parameter('Shaft diameter', 'mm', 5, 300, 40),
      length: parameter('Shaft length', 'm', 0.05, 10, 1),
      modulus: parameter('Shear modulus', 'GPa', 1, 200, 80),
    },
    metrics: { stress: 'Outer shear stress', twist: 'End twist', polar: 'Polar second moment' },
    plot: { title: 'Twist along the shaft', x: 'Distance from fixed end', y: 'Twist', traces: { y: 'Angle of twist' } },
    outputs: { summary: { stress: 'MPa', twist: '°', polar: 'mm⁴' }, series: { x: 'm', y: '°' } },
  }, ({ torque, diameter, length, modulus }) => {
    const d = diameter / 1000;
    const polar = Math.PI * d ** 4 / 32;
    const stress = torque * 1000 * (d / 2) / polar / 1e6;
    const twist = torque * 1000 * length / (modulus * 1e9 * polar) * 180 / Math.PI;
    return {
      summary: { stress, twist, polar: polar * 1e12 },
      series: [{ x: 0, y: 0 }, { x: length, y: twist }],
    };
  }),
  oscillator: experiment('oscillator', {
    title: 'Mass–Spring Oscillation', discipline: 'mechanical', lab: '13',
    description: 'Release a mass on a spring and compare the period, frequency, and initial energy.',
    predict: 'What happens to the period if the mass quadruples with the same spring?',
    prediction: [['It halves', 'It doubles', 'It quadruples'], 1, 'Period is proportional to the square root of mass at fixed stiffness.'],
    example: 'A 1 kg mass on a 100 N/m spring has a period of about 0.628 s. A release from 50 mm stores 0.125 J of spring energy.',
    equation: 'ω = √(k/m), f = ω/(2π), T = 1/f, x(t) = x₀ cos(ωt), and E = kx₀²/2.',
    limits: 'The spring is linear and the mass is released from rest. Displacement is measured from equilibrium, with no damping or forcing.',
    inputs: {
      mass: parameter('Moving mass', 'kg', 0.05, 100, 1),
      stiffness: parameter('Spring stiffness', 'N/m', 1, 10000, 100),
      displacement: parameter('Release displacement', 'mm', -500, 500, 50),
    },
    metrics: { period: 'Period', frequency: 'Natural frequency', energy: 'Mechanical energy' },
    plot: { title: 'Free oscillation', x: 'Time', y: 'Displacement', traces: { y: 'Mass displacement' } },
    outputs: { summary: { period: 's', frequency: 'Hz', energy: 'J' }, series: { x: 's', y: 'mm' } },
  }, ({ mass, stiffness, displacement }) => {
    const frequency = Math.sqrt(stiffness / mass) / (2 * Math.PI);
    const period = 1 / frequency;
    return {
      summary: { period, frequency, energy: stiffness * (displacement / 1000) ** 2 / 2 },
      series: samples(0, 3 * period, x => ({ y: displacement * cosine(frequency, x) })),
    };
  }),
};

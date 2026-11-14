import { solveLinear } from './linear.js';
import { lab, p, textInput, table } from './lab-kit.js';

export const triangle = JSON.stringify({
  nodes: [
    [0, 0],
    [4, 0],
    [2, 3],
  ],
  bars: [
    [0, 1, 1000, 200],
    [0, 2, 1000, 200],
    [1, 2, 1000, 200],
  ],
  supports: [
    [0, true, true],
    [1, false, true],
  ],
  loads: [[2, 0, -100]],
});

/** Small-displacement, pin-jointed 2D finite elements. SI assembly; display mm, MPa, kN. */
export function solveTruss(source, loadScale = 1) {
  const model = JSON.parse(source);
  const { nodes, bars, supports, loads } = model;
  if (
    !Array.isArray(nodes) ||
    nodes.length < 2 ||
    nodes.length > 12 ||
    !Array.isArray(bars) ||
    !bars.length ||
    bars.length > 24 ||
    !Array.isArray(supports) ||
    supports.length > 12 ||
    !Array.isArray(loads) ||
    loads.length > 24 ||
    !Number.isFinite(loadScale)
  )
    throw new Error('Use 2–12 nodes, 1–24 bars, supports and loads.');
  const index = (i) => Number.isInteger(i) && i >= 0 && i < nodes.length;
  const finite = (a) => a.every((v) => typeof v === 'number' && Number.isFinite(v));
  if (
    nodes.some(
      (a) =>
        !Array.isArray(a) || a.length !== 2 || !finite(a) || a.some((v) => Math.abs(v) > 10000),
    )
  )
    throw new Error('Each node needs finite x,y coordinates in metres (±10000).');
  const size = nodes.length * 2;
  const K = Array.from({ length: size }, () => Array(size).fill(0));
  const force = Array(size).fill(0),
    fixed = new Set(),
    seen = new Set();
  for (const support of supports) {
    if (
      !Array.isArray(support) ||
      support.length !== 3 ||
      !index(support[0]) ||
      typeof support[1] !== 'boolean' ||
      typeof support[2] !== 'boolean'
    )
      throw new Error('Supports are [node, fixX, fixY] with boolean restraints.');
    if (support[1]) fixed.add(2 * support[0]);
    if (support[2]) fixed.add(2 * support[0] + 1);
  }
  for (const load of loads) {
    if (
      !Array.isArray(load) ||
      load.length !== 3 ||
      !finite(load) ||
      !index(load[0]) ||
      load.slice(1).some((v) => Math.abs(v) > 1e6)
    )
      throw new Error('Loads are [node, Fx, Fy] in kN (±1000000).');
    force[2 * load[0]] += load[1] * 1000 * loadScale;
    force[2 * load[0] + 1] += load[2] * 1000 * loadScale;
  }
  const elements = bars.map((bar) => {
    if (!Array.isArray(bar) || bar.length !== 4 || !finite(bar))
      throw new Error('Bars are [nodeA,nodeB,area_mm²,E_GPa].');
    const [a, b, area, E] = bar,
      key = [a, b].sort((x, y) => x - y).join(':');
    if (
      !index(a) ||
      !index(b) ||
      a === b ||
      seen.has(key) ||
      area <= 0 ||
      area > 1e8 ||
      E <= 0 ||
      E > 2000
    )
      throw new Error('Bars need distinct valid nodes, positive area/modulus and no duplicates.');
    seen.add(key);
    const dx = nodes[b][0] - nodes[a][0],
      dy = nodes[b][1] - nodes[a][1],
      length = Math.hypot(dx, dy);
    if (length < 1e-6) throw new Error('Bar length must exceed 1 µm.');
    const vector = [-dx / length, -dy / length, dx / length, dy / length];
    const dofs = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1],
      stiffness = (area * 1e-6 * E * 1e9) / length;
    dofs.forEach((i, r) =>
      dofs.forEach((j, c) => {
        K[i][j] += stiffness * vector[r] * vector[c];
      }),
    );
    return { a, b, area, E, length, vector, dofs, stiffness };
  });
  const free = Array.from({ length: size }, (_, i) => i).filter((i) => !fixed.has(i));
  if (!free.length) throw new Error('Leave at least one free degree of freedom.');
  let solved;
  try {
    solved = solveLinear(
      free.map((i) => free.map((j) => K[i][j])),
      free.map((i) => force[i]),
    );
  } catch {
    throw new Error(
      'The truss is unstable or poorly conditioned. Check connectivity, supports and geometry.',
    );
  }
  const displacement = Array(size).fill(0);
  free.forEach((i, j) => {
    displacement[i] = solved[j];
  });
  const internal = K.map((row) => row.reduce((sum, v, j) => sum + v * displacement[j], 0));
  const reactions = internal.map((v, i) => v - force[i]);
  const members = elements.map((e) => {
    const extension = e.dofs.reduce((sum, i, j) => sum + displacement[i] * e.vector[j], 0);
    return {
      a: e.a,
      b: e.b,
      force: (e.stiffness * extension) / 1000,
      stress: (e.E * 1000 * extension) / e.length,
    };
  });
  const residual =
    Math.max(...free.map((i) => Math.abs(reactions[i]))) / Math.max(1, ...force.map(Math.abs));
  return {
    nodes,
    bars,
    displacement,
    reactions,
    members,
    residual,
    visualization: {
      type: 'truss',
      nodes,
      bars,
      members,
      displacement,
      supports,
      loads,
      loadScale,
    },
    summary: {
      peakDisplacement:
        Math.max(...nodes.map((_, i) => Math.hypot(displacement[2 * i], displacement[2 * i + 1]))) *
        1000,
      peakStress: Math.max(...members.map((m) => Math.abs(m.stress))),
      energy: displacement.reduce((sum, v, i) => sum + (v * force[i]) / 2, 0),
      residual,
    },
    series: nodes.map((_, x) => ({
      x,
      y: displacement[2 * x + 1] * 1000,
      reference: displacement[2 * x] * 1000,
    })),
    table: table(
      'Member forces: positive tension, negative compression',
      ['A', 'B', 'Force (kN)', 'Stress (MPa)'],
      members.map((m) => [m.a, m.b, m.force, m.stress]),
    ),
  };
}

export const trussModels = {
  trussfem: lab(
    {
      id: 'trussfem',
      title: 'Build a Truss: Finite Elements',
      discipline: 'civil',
      topic: 'Finite element analysis',
      inputs: {
        geometry: textInput(
          'Truss JSON',
          triangle,
          4000,
          'Zero-based nodes [x,y] m; bars [A,B,area mm²,E GPa]; supports [node,fixX,fixY]; loads [node,Fx,Fy] kN.',
        ),
        loadScale: p('Load multiplier', '1', -10, 10, 1),
      },
      validateValues({ geometry }) {
        try {
          solveTruss(geometry);
        } catch (e) {
          return { key: 'geometry', message: e.message };
        }
      },
      metrics: {
        peakDisplacement: ['Peak nodal displacement', 'mm'],
        peakStress: ['Peak absolute axial stress', 'MPa'],
        energy: ['Strain energy', 'J'],
        residual: ['Relative free-DOF equilibrium residual', '1'],
      },
      plot: {
        x: 'Node',
        xUnit: '1',
        y: 'Nodal displacement',
        yUnit: 'mm',
        traces: { y: 'Vertical', reference: 'Horizontal' },
      },
      text: [
        'Assemble and solve your own pin-jointed truss using the direct stiffness method.',
        'If every load doubles, what happens to displacement?',
        ['It doubles', 'It halves', 'It stays fixed'],
        'Linear elastic stiffness is independent of load.',
        'The default symmetric triangular truss carries 100 kN downward. Each diagonal carries approximately −60.093 kN; the bottom chord carries 33.333 kN.',
        'K = Σ Bᵀ(EA/L)B; Kff uf = Ff; R = Ku − F; U = ½uᵀF.',
        '2D pin joints, axial deformation, zero support displacement, small strain and linear elasticity. No buckling, yielding, bending or safety design. Node/bar limits keep the browser solve bounded.',
      ],
    },
    ({ geometry, loadScale }) => solveTruss(geometry, loadScale),
  ),
};

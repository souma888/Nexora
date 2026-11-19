import {
  check,
  number,
  index,
  jsonProject,
  zeros,
  dirichlet,
  dot,
  maxabs,
  eigenSymmetric,
} from './builder-core.js';
export const femExample = JSON.stringify({
  nodes: [
    [0, 0],
    [1, 0],
    [1, 0.5],
    [0, 0.5],
  ],
  triangles: [
    [0, 1, 2],
    [0, 2, 3],
  ],
  supports: [
    [0, 0, 0],
    [3, 0, null],
  ],
  loads: [
    [1, 500, 0],
    [2, 500, 0],
  ],
  thermal: {
    fixed: [
      [0, 20],
      [3, 20],
      [1, 100],
      [2, 100],
    ],
    loads: [],
    source: 0,
  },
});
export function parseMesh(source) {
  const p = jsonProject(source);
  check(
    Array.isArray(p.nodes) && p.nodes.length >= 3 && p.nodes.length <= 80,
    'Use 3…80 mesh nodes.',
  );
  check(
    Array.isArray(p.triangles) && p.triangles.length > 0 && p.triangles.length <= 160,
    'Use 1…160 triangular elements.',
  );
  p.nodes.forEach((v) => {
    check(Array.isArray(v) && v.length === 2, 'Nodes are [x,y] in metres.');
    v.forEach((x) => number(x, -10, 10, 'Node coordinate'));
  });
  const used = new Set(),
    seen = new Set(),
    edges = new Map();
  p.triangles.forEach((t) => {
    check(Array.isArray(t) && t.length === 3, 'Triangles contain three node indices.');
    t.forEach((i) => {
      index(i, p.nodes.length, 'Triangle node');
      used.add(i);
    });
    const key = [...t].sort((a, b) => a - b).join(',');
    check(new Set(t).size === 3 && !seen.has(key), 'No repeated-node or duplicate triangles.');
    seen.add(key);
    const [a, b, c] = t.map((i) => p.nodes[i]),
      det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    check(
      Math.abs(det) > 1e-10,
      'Triangle area is too small; remove coincident or collinear nodes.',
    );
    for (let i = 0; i < 3; i++) {
      const key = [t[i], t[(i + 1) % 3]].sort((a, b) => a - b).join(',');
      edges.set(key, (edges.get(key) ?? 0) + 1);
      check(edges.get(key) <= 2, 'Non-manifold mesh: an edge belongs to more than two triangles.');
    }
  });
  check(used.size === p.nodes.length, 'Every node must belong to an element.');
  const supports = p.supports ?? [],
    loads = p.loads ?? [];
  check(
    Array.isArray(supports) && supports.length <= 80 && Array.isArray(loads) && loads.length <= 160,
    'Invalid supports or loads.',
  );
  const restrained = new Set();
  for (const r of supports) {
    check(
      Array.isArray(r) && r.length === 3,
      'Supports are [node,ux or null,uy or null] in metres.',
    );
    index(r[0], p.nodes.length, 'Support node');
    for (let i = 1; i < 3; i++)
      if (r[i] !== null) {
        number(r[i], -1, 1, 'Prescribed displacement');
        const key = 2 * r[0] + i - 1;
        check(!restrained.has(key), 'A displacement DOF is prescribed more than once.');
        restrained.add(key);
      }
  }
  for (const r of loads) {
    check(Array.isArray(r) && r.length === 3, 'Loads are [node,Fx,Fy] in newtons.');
    index(r[0], p.nodes.length, 'Load node');
    r.slice(1).forEach((v) => number(v, -1e7, 1e7, 'Nodal load'));
  }
  const thermal = p.thermal ?? { fixed: [], loads: [], source: 0 };
  check(
    Array.isArray(thermal.fixed) &&
      Array.isArray(thermal.loads) &&
      thermal.fixed.length <= 80 &&
      thermal.loads.length <= 160,
    'Thermal data needs fixed and loads arrays.',
  );
  const fixedT = new Set();
  for (const r of thermal.fixed) {
    check(Array.isArray(r) && r.length === 2, 'Fixed temperatures are [node,°C].');
    index(r[0], p.nodes.length, 'Temperature node');
    number(r[1], -200, 2000, 'Temperature');
    check(!fixedT.has(r[0]), 'A temperature is prescribed more than once.');
    fixedT.add(r[0]);
  }
  for (const r of thermal.loads) {
    check(Array.isArray(r) && r.length === 2, 'Heat inputs are [node,watts].');
    index(r[0], p.nodes.length, 'Heat node');
    number(r[1], -1e7, 1e7, 'Heat load');
  }
  number(thermal.source ?? 0, -1e9, 1e9, 'Volumetric heat source');
  return { ...p, supports, loads, thermal };
}
export function triangleGeometry(nodes, t) {
  const [a, b, c] = t.map((i) => nodes[i]),
    det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  return {
    area: Math.abs(det) / 2,
    gradients: [
      [(b[1] - c[1]) / det, (c[0] - b[0]) / det],
      [(c[1] - a[1]) / det, (a[0] - c[0]) / det],
      [(a[1] - b[1]) / det, (b[0] - a[0]) / det],
    ],
  };
}
export function assembleContinuum(
  mesh,
  { E = 2e11, nu = 0.3, thickness = 0.01, density = 7800, conductivity = 45 } = {},
) {
  number(E, 1e5, 1e12, 'Young modulus');
  number(nu, -0.9, 0.49, 'Poisson ratio');
  number(thickness, 1e-5, 1, 'Thickness');
  number(density, 0.1, 30000, 'Density');
  number(conductivity, 0.01, 1000, 'Conductivity');
  const n = mesh.nodes.length,
    K = zeros(2 * n),
    H = zeros(n),
    mass = Array(2 * n).fill(0),
    force = Array(2 * n).fill(0),
    heat = Array(n).fill(0),
    D = [
      [1, nu, 0],
      [nu, 1, 0],
      [0, 0, (1 - nu) / 2],
    ].map((r) => r.map((v) => (v * E) / (1 - nu * nu))),
    elements = [];
  for (const t of mesh.triangles) {
    const { area, gradients } = triangleGeometry(mesh.nodes, t),
      B = zeros(3, 6),
      dofs = t.flatMap((i) => [2 * i, 2 * i + 1]);
    gradients.forEach(([x, y], i) => {
      B[0][2 * i] = x;
      B[1][2 * i + 1] = y;
      B[2][2 * i] = y;
      B[2][2 * i + 1] = x;
    });
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        let k = 0;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) k += B[a][i] * D[a][b] * B[b][j];
        K[dofs[i]][dofs[j]] += k * thickness * area;
      }
    for (let i = 0; i < 3; i++) {
      mass[2 * t[i]] += (density * thickness * area) / 3;
      mass[2 * t[i] + 1] += (density * thickness * area) / 3;
      heat[t[i]] += ((mesh.thermal.source ?? 0) * thickness * area) / 3;
      for (let j = 0; j < 3; j++)
        H[t[i]][t[j]] += conductivity * thickness * area * dot(gradients[i], gradients[j]);
    }
    elements.push({ nodes: t, area, gradients, B, dofs });
  }
  mesh.loads.forEach(([i, x, y]) => {
    force[2 * i] += x;
    force[2 * i + 1] += y;
  });
  mesh.thermal.loads.forEach(([i, q]) => (heat[i] += q));
  return { K, H, mass, force, heat, D, elements };
}
export function solveContinuum(source, options = {}) {
  const mesh = parseMesh(source),
    a = {
      analysis: 'stress',
      mode: 1,
      E: 2e11,
      nu: 0.3,
      thickness: 0.01,
      density: 7800,
      conductivity: 45,
      ...options,
    },
    A = assembleContinuum(mesh, a),
    fixed = new Map();
  mesh.supports.forEach(([i, x, y]) => {
    if (x !== null) fixed.set(2 * i, x);
    if (y !== null) fixed.set(2 * i + 1, y);
  });
  if (a.analysis === 'heat') {
    check(mesh.thermal.fixed.length > 0, 'Prescribe at least one temperature.');
    const r = dirichlet(A.H, A.heat, new Map(mesh.thermal.fixed)),
      flux = A.elements.map((e) => {
        const gradient = [0, 0];
        e.nodes.forEach((i, j) => {
          gradient[0] += r.u[i] * e.gradients[j][0];
          gradient[1] += r.u[i] * e.gradients[j][1];
        });
        return gradient.map((v) => -a.conductivity * v);
      }),
      balance = r.reactions.reduce((s, v) => s + v, 0) + A.heat.reduce((s, v) => s + v, 0);
    return {
      summary: {
        maximum: Math.max(...r.u),
        minimum: Math.min(...r.u),
        residual: r.residual,
        balance,
      },
      series: r.u.map((y, x) => ({ x, y })),
      visualization: {
        type: 'builder',
        kind: 'fem',
        mesh,
        analysis: 'heat',
        values: A.elements.map((e) => e.nodes.reduce((s, i) => s + r.u[i], 0) / 3),
        nodal: r.u,
        flux,
        units: '°C',
      },
      table: {
        caption: 'Temperature and heat reaction',
        headers: ['Node', 'Temperature (°C)', 'Heat reaction (W)'],
        rows: r.u.map((v, i) => [i, v, r.reactions[i]]),
      },
    };
  }
  check(['stress', 'modal'].includes(a.analysis), 'Choose stress, heat or modal analysis.');
  if (a.analysis === 'modal') {
    check(
      mesh.nodes.length <= 48,
      'Modal analysis is bounded to 48 nodes. Refine less or use static analysis.',
    );
    const free = Array.from({ length: A.mass.length }, (_, i) => i).filter((i) => !fixed.has(i));
    check(free.length > 0, 'Leave a free displacement DOF.');
    const reduced = free.map((i) => free.map((j) => A.K[i][j] / Math.sqrt(A.mass[i] * A.mass[j]))),
      eigen = eigenSymmetric(reduced),
      scale = Math.max(1, ...eigen.values.map(Math.abs)),
      frequencies = eigen.values
        .slice(0, Math.min(8, free.length))
        .map((v) => (v < scale * 1e-10 ? 0 : Math.sqrt(v) / (2 * Math.PI))),
      selected = Math.min(Math.max(1, a.mode), frequencies.length) - 1,
      shape = Array(A.mass.length).fill(0);
    free.forEach((i, k) => (shape[i] = eigen.vectors[selected][k] / Math.sqrt(A.mass[i])));
    const amplitude = maxabs(shape) || 1;
    for (let i = 0; i < shape.length; i++) shape[i] /= amplitude;
    const f = frequencies[selected],
      series = Array.from({ length: 121 }, (_, i) => ({
        x: i / 60,
        y: Math.sin((2 * Math.PI * i) / 60),
      })),
      residual =
        maxabs(
          reduced.map(
            (r, i) =>
              dot(r, eigen.vectors[selected]) - eigen.values[selected] * eigen.vectors[selected][i],
          ),
        ) / Math.max(1, maxabs(reduced.flat()));
    return {
      summary: {
        frequency: f,
        rigid: frequencies.filter((v) => v === 0).length,
        residual,
        modes: frequencies.length,
      },
      series,
      visualization: {
        type: 'builder',
        kind: 'fem',
        mesh,
        analysis: 'modal',
        displacement: shape,
        values: A.elements.map((e) =>
          Math.max(...e.nodes.map((i) => Math.hypot(shape[2 * i], shape[2 * i + 1]))),
        ),
        units: 'normalized mode',
        frames: series,
      },
      table: {
        caption: 'Lumped-mass CST natural frequencies',
        headers: ['Mode', 'Frequency (Hz)'],
        rows: frequencies.map((v, i) => [i + 1, v]),
      },
      warnings: frequencies.some((v) => v === 0)
        ? ['Zero frequencies represent unresolved rigid-body modes; add supports to restrain them.']
        : [],
    };
  }
  const r = dirichlet(A.K, A.force, fixed),
    stress = A.elements.map((e) => {
      const strain = e.B.map((row) =>
        dot(
          row,
          e.dofs.map((i) => r.u[i]),
        ),
      );
      return A.D.map((row) => dot(row, strain));
    }),
    vm = stress.map(([x, y, t]) => Math.sqrt(x * x - x * y + y * y + 3 * t * t) / 1e6),
    energy =
      0.5 *
      dot(
        r.u,
        A.K.map((row) => dot(row, r.u)),
      ),
    forceBalance = [0, 1].map((axis) =>
      A.force.reduce((s, v, i) => (i % 2 === axis ? s + v + r.reactions[i] : s), 0),
    );
  return {
    summary: {
      displacement:
        Math.max(...mesh.nodes.map((_, i) => Math.hypot(r.u[2 * i], r.u[2 * i + 1]))) * 1000,
      stress: Math.max(...vm),
      energy,
      residual: r.residual,
    },
    series: vm.map((y, x) => ({ x, y })),
    visualization: {
      type: 'builder',
      kind: 'fem',
      mesh,
      analysis: 'stress',
      displacement: r.u,
      values: vm,
      stress,
      units: 'von Mises MPa',
      forceBalance,
    },
    table: {
      caption: 'Constant element stresses',
      headers: ['Element', 'σx (MPa)', 'σy (MPa)', 'τxy (MPa)', 'von Mises (MPa)'],
      rows: stress.map((s, i) => [i, ...s.map((v) => v / 1e6), vm[i]]),
    },
  };
}
export function refineMesh(source) {
  const p = parseMesh(source);
  check(
    p.nodes.length <= 24 && p.triangles.length <= 40,
    'Refinement would exceed the bounded mesh size.',
  );
  const nodes = p.nodes.map((v) => [...v]),
    map = new Map(),
    supports = new Map(p.supports.map((r) => [r[0], r])),
    temperatures = new Map(p.thermal.fixed),
    newSupports = [...p.supports],
    newT = [...p.thermal.fixed];
  const middle = (a, b) => {
    const key = [a, b].sort((x, y) => x - y).join(',');
    if (map.has(key)) return map.get(key);
    const i = nodes.length;
    nodes.push([(nodes[a][0] + nodes[b][0]) / 2, (nodes[a][1] + nodes[b][1]) / 2]);
    map.set(key, i);
    const sa = supports.get(a),
      sb = supports.get(b);
    if (sa && sb) {
      const x = sa[1] !== null && sb[1] !== null ? (sa[1] + sb[1]) / 2 : null,
        y = sa[2] !== null && sb[2] !== null ? (sa[2] + sb[2]) / 2 : null;
      if (x !== null || y !== null) newSupports.push([i, x, y]);
    }
    if (temperatures.has(a) && temperatures.has(b))
      newT.push([i, (temperatures.get(a) + temperatures.get(b)) / 2]);
    return i;
  };
  const triangles = p.triangles.flatMap(([a, b, c]) => {
    const ab = middle(a, b),
      bc = middle(b, c),
      ca = middle(c, a);
    return [
      [a, ab, ca],
      [ab, b, bc],
      [ca, bc, c],
      [ab, bc, ca],
    ];
  });
  const refined = {
    ...p,
    nodes,
    triangles,
    supports: newSupports,
    thermal: { ...p.thermal, fixed: newT },
  };
  parseMesh(JSON.stringify(refined));
  return refined;
}

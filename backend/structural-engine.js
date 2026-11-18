import { solveLinear, seq, integrate, requireValue } from './engineering-kit.js';
export function beamSpans(lengths, loads, EI, method = 'three') {
  const n = lengths.length;
  let moments = Array(n + 1).fill(0),
    iterations = [];
  if (method === 'distribution') {
    const ends = lengths.map((L, i) => [(-loads[i] * L * L) / 12, (loads[i] * L * L) / 12]);
    ends[0][1] -= ends[0][0] / 2;
    ends[0][0] = 0;
    ends[n - 1][0] -= ends[n - 1][1] / 2;
    ends[n - 1][1] = 0;
    for (let sweep = 0; sweep < 100; sweep++) {
      let max = 0;
      for (let j = 1; j < n; j++) {
        const imbalance = ends[j - 1][1] + ends[j][0],
          ka = ((j === 1 ? 3 : 4) * EI) / lengths[j - 1],
          kb = ((j === n - 1 ? 3 : 4) * EI) / lengths[j],
          a = (-imbalance * ka) / (ka + kb),
          b = (-imbalance * kb) / (ka + kb);
        max = Math.max(max, Math.abs(imbalance));
        ends[j - 1][1] += a;
        ends[j][0] += b;
        if (j > 1) ends[j - 1][0] += a / 2;
        if (j < n - 1) ends[j][1] += b / 2;
      }
      iterations.push({ sweep: sweep + 1, residual: max, moments: ends.map((v) => [...v]) });
      if (max < 1e-10) break;
    }
    for (let j = 1; j < n; j++) moments[j] = (ends[j][0] - ends[j - 1][1]) / 2;
  } else {
    const K = Array.from({ length: n - 1 }, (_, i) =>
        Array.from({ length: n - 1 }, (_, j) =>
          i === j
            ? 2 * (lengths[i] + lengths[i + 1])
            : j === i - 1
              ? lengths[i]
              : j === i + 1
                ? lengths[i + 1]
                : 0,
        ),
      ),
      f = Array.from(
        { length: n - 1 },
        (_, i) => -(loads[i] * lengths[i] ** 3 + loads[i + 1] * lengths[i + 1] ** 3) / 4,
      );
    moments = [0, ...solveLinear(K, f), 0];
  }
  let origin = 0,
    energy = 0;
  const reactions = Array(n + 1).fill(0),
    series = [];
  lengths.forEach((L, i) => {
    const w = loads[i],
      M0 = moments[i],
      M1 = moments[i + 1],
      R = (M1 - M0) / L + (w * L) / 2,
      M = (x) => M0 + R * x - (w * x * x) / 2,
      C = -((M0 * L * L) / 2 + (R * L ** 3) / 6 - (w * L ** 4) / 24) / L;
    reactions[i] += R;
    reactions[i + 1] += w * L - R;
    for (const x of seq(0, L, 80))
      series.push({
        x: origin + x,
        y: M(x),
        shear: R - w * x,
        deflection: (((M0 * x * x) / 2 + (R * x ** 3) / 6 - (w * x ** 4) / 24 + C * x) / EI) * 1000,
      });
    energy += integrate((x) => M(x) ** 2 / (2 * EI), 0, L) * 1000;
    origin += L;
  });
  return { moments, reactions, series, energy, iterations };
}
export function jointTruss(model) {
  const { nodes, bars, supports, loads } = JSON.parse(model),
    n = nodes.length;
  requireValue(
    supports.flatMap(([j, x, y]) => [...(x ? [[j, 1, 0]] : []), ...(y ? [[j, 0, 1]] : [])])
      .length === 3,
    'Method of joints requires three independent planar support reactions.',
  );
  requireValue(
    bars.length === 2 * n - 3,
    'Use a statically determinate simple planar truss: members = 2·nodes−3.',
  );
  const supportsD = supports.flatMap(([j, x, y]) => [
      ...(x ? [[j, 1, 0]] : []),
      ...(y ? [[j, 0, 1]] : []),
    ]),
    F = nodes.map(() => [0, 0]);
  loads.forEach(([j, x, y]) => {
    F[j][0] += x;
    F[j][1] += y;
  });
  const total = F.reduce(
      (s, f, j) => [s[0] + f[0], s[1] + f[1], s[2] + nodes[j][0] * f[1] - nodes[j][1] * f[0]],
      [0, 0, 0],
    ),
    reactions = solveLinear(
      [
        supportsD.map((v) => v[1]),
        supportsD.map((v) => v[2]),
        supportsD.map(([j, x, y]) => nodes[j][0] * y - nodes[j][1] * x),
      ],
      total.map((v) => -v),
    );
  supportsD.forEach(([j, x, y], i) => {
    F[j][0] += x * reactions[i];
    F[j][1] += y * reactions[i];
  });
  const forces = Array(bars.length).fill(null),
    steps = [];
  for (let pass = 0; pass < n * 2 && forces.some((v) => v === null); pass++) {
    let progress = false;
    nodes.forEach((node, j) => {
      const unknown = [],
        net = [...F[j]];
      bars.forEach(([a, b], k) => {
        if (a !== j && b !== j) return;
        const other = nodes[a === j ? b : a],
          L = Math.hypot(other[0] - node[0], other[1] - node[1]),
          d = [(other[0] - node[0]) / L, (other[1] - node[1]) / L];
        if (forces[k] === null) unknown.push({ k, d });
        else {
          net[0] += forces[k] * d[0];
          net[1] += forces[k] * d[1];
        }
      });
      if (!unknown.length || unknown.length > 2) return;
      let values;
      if (unknown.length === 2) {
        const [a, b] = unknown;
        if (Math.abs(a.d[0] * b.d[1] - a.d[1] * b.d[0]) < 1e-10) return;
        values = solveLinear(
          [
            [a.d[0], b.d[0]],
            [a.d[1], b.d[1]],
          ],
          net.map((v) => -v),
        );
      } else {
        const d = unknown[0].d;
        values = [-net[0] * d[0] - net[1] * d[1]];
        requireValue(
          Math.hypot(net[0] + values[0] * d[0], net[1] + values[0] * d[1]) < 1e-6,
          'Joint equilibrium is incompatible with the supplied supports or loads.',
        );
      }
      unknown.forEach((v, k) => {
        forces[v.k] = values[k];
      });
      progress = true;
      steps.push({ joint: j, forces: [...forces] });
    });
    requireValue(
      progress || forces.every((v) => v !== null),
      'This topology cannot be resolved by the simple method of joints; use the FEM truss lab.',
    );
  }
  return { forces, reactions, steps };
}
export function sectionParts(kind, b, h, t, tw) {
  const rectangles =
      kind === 'I'
        ? [
            [b, t, h - t / 2],
            [tw, h - 2 * t, h / 2],
            [b, t, t / 2],
          ]
        : [
            [b, t, h - t / 2],
            [tw, h - t, (h - t) / 2],
          ],
    A = rectangles.reduce((s, [w, d]) => s + w * d, 0),
    centroid = rectangles.reduce((s, [w, d, y]) => s + w * d * y, 0) / A,
    I = rectangles.reduce((s, [w, d, y]) => s + (w * d ** 3) / 12 + w * d * (y - centroid) ** 2, 0);
  const at = (y) => {
    let Q = 0,
      width = 0;
    for (const [w, d, c] of rectangles) {
      const lo = c - d / 2,
        hi = c + d / 2,
        cut = Math.max(lo, y);
      if (cut < hi) Q += w * (hi - cut) * ((hi + cut) / 2 - centroid);
      if (y >= lo - 1e-8 && y <= hi + 1e-8) width = width ? Math.min(width, w) : w;
    }
    return { Q, width };
  };
  return { A, centroid, I, at, rectangles };
}

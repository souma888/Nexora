import {
  random,
  normal,
  dot,
  mean,
  sigmoid,
  softThreshold,
  eigenSymmetric,
  variance,
} from './math-core.js';
/** Small reproducible two-dimensional datasets; labels are 0/1. */
export function dataset(kind = 'linear', count = 60, seed = 42, noise = 0.25) {
  const rng = random(seed);
  return Array.from({ length: count }, (_, i) => {
    const label = i % 2;
    let x, y;
    if (kind === 'xor') {
      x = (i % 4 < 2 ? -1 : 1) + noise * normal(rng);
      y = (i % 2 ? -1 : 1) + noise * normal(rng);
      return { x: [x, y], label: +(x * y > 0) };
    }
    if (kind === 'rings') {
      const angle = rng() * 2 * Math.PI,
        r = (label ? 1.7 : 0.6) + noise * normal(rng);
      x = r * Math.cos(angle);
      y = r * Math.sin(angle);
    } else {
      x = (label ? 1 : -1) + noise * normal(rng);
      y = (label ? 0.7 : -0.7) + noise * normal(rng);
    }
    return { x: [x, y], label };
  });
}
export const boundaryGrid = (predict, extent = 3, size = 30) =>
  Array.from({ length: size }, (_, j) =>
    Array.from({ length: size }, (_, i) =>
      predict([-extent + (2 * extent * i) / (size - 1), -extent + (2 * extent * j) / (size - 1)]),
    ),
  );
export const accuracy = (data, predict) => mean(data.map((p) => +(predict(p.x) === p.label)));
export function logisticTrain(data, rate = 0.1, steps = 300, penalty = 0.01) {
  const w = [0, 0, 0],
    history = [];
  for (let k = 0; k <= steps; k++) {
    const gradient = [0, 0, 0];
    let loss = 0;
    for (const { x, label } of data) {
      const a = [...x, 1],
        z = dot(w, a),
        v = sigmoid(z);
      loss += Math.max(z, 0) - z * label + Math.log1p(Math.exp(-Math.abs(z)));
      for (let j = 0; j < 3; j++) gradient[j] += ((v - label) * a[j]) / data.length;
    }
    loss = loss / data.length + (penalty * (w[0] ** 2 + w[1] ** 2)) / 2;
    history.push({ x: k, y: loss });
    if (k < steps)
      for (let j = 0; j < 3; j++) w[j] -= rate * (gradient[j] + (j < 2 ? penalty * w[j] : 0));
  }
  return { w, history, predict: (x) => sigmoid(dot(w, [...x, 1])) };
}
export function kmeans(data, K, iterations = 15, seed = 42) {
  const rng = random(seed),
    centers = [],
    frames = [],
    history = [];
  centers.push([...data[Math.floor(rng() * data.length)]]);
  while (centers.length < K) {
    const dist = data.map((x) =>
        Math.min(
          ...centers.map((c) =>
            dot(
              x.map((v, j) => v - c[j]),
              x.map((v, j) => v - c[j]),
            ),
          ),
        ),
      ),
      total = dist.reduce((a, b) => a + b, 0);
    let draw = rng() * total,
      index = 0;
    while (index < dist.length - 1 && draw > dist[index]) draw -= dist[index++];
    centers.push([...data[index]]);
  }
  const assign = () =>
    data.map((x) => {
      let best = 0,
        d = Infinity;
      centers.forEach((c, j) => {
        const v = (x[0] - c[0]) ** 2 + (x[1] - c[1]) ** 2;
        if (v < d) {
          d = v;
          best = j;
        }
      });
      return best;
    });
  let labels = assign();
  for (let k = 0; k <= iterations; k++) {
    const sse = data.reduce(
      (s, x, i) => s + (x[0] - centers[labels[i]][0]) ** 2 + (x[1] - centers[labels[i]][1]) ** 2,
      0,
    );
    history.push({ x: k, y: sse });
    frames.push({ centers: centers.map((c) => [...c]), labels: [...labels] });
    if (k === iterations) break;
    for (let j = 0; j < K; j++) {
      const a = data.filter((_, i) => labels[i] === j);
      if (a.length) centers[j] = [mean(a.map((p) => p[0])), mean(a.map((p) => p[1]))];
    }
    labels = assign();
  }
  return { centers, labels, history, frames };
}
export function knn(data, x, K) {
  const near = data
    .map((p, i) => ({ i, d: (p.x[0] - x[0]) ** 2 + (p.x[1] - x[1]) ** 2, label: p.label }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, K);
  return near.reduce((s, p) => s + p.label, 0) / near.length;
}
export function regularizationPath(X, y, lambdas, lasso = false) {
  return lambdas.map((lambda) => {
    const w = [0, 0];
    let converged = false;
    for (let n = 0; n < 2000; n++) {
      const previous = [...w];
      for (let j = 0; j < 2; j++) {
        let rho = 0,
          z = 0;
        for (let i = 0; i < X.length; i++) {
          rho += (X[i][j] * (y[i] - X[i][1 - j] * w[1 - j])) / X.length;
          z += X[i][j] ** 2 / X.length;
        }
        w[j] = lasso ? softThreshold(rho, lambda) / z : rho / (z + lambda);
      }
      if (Math.max(...w.map((v, j) => Math.abs(v - previous[j]))) < 1e-9) {
        converged = true;
        break;
      }
    }
    return { lambda, w, converged };
  });
}
/** Deterministic simplified SMO for a soft-margin binary SVM, labels ±1. */
export function trainSVM(data, C = 1, gamma = 1, kernel = 'rbf', maxSweeps = 400) {
  const n = data.length,
    y = data.map((p) => 2 * p.label - 1),
    K = data.map((p) =>
      data.map((q) =>
        kernel === 'linear'
          ? dot(p.x, q.x)
          : Math.exp(-gamma * ((p.x[0] - q.x[0]) ** 2 + (p.x[1] - q.x[1]) ** 2)),
      ),
    ),
    a = Array(n).fill(0);
  let b = 0,
    passes = 0,
    sweeps = 0;
  const decision = (i) => b + a.reduce((s, v, j) => s + v * y[j] * K[j][i], 0);
  while (passes < 8 && sweeps++ < maxSweeps) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const Ei = decision(i) - y[i];
      if (!((y[i] * Ei < -0.001 && a[i] < C - 1e-9) || (y[i] * Ei > 0.001 && a[i] > 1e-9)))
        continue;
      let updated = false;
      // Quantize only the pair-selection heuristic, not kernel values or updates.
      // Near-equal scores otherwise swap order across JS engines after tiny libm differences.
      const pairScore = (j) => Math.round(Math.abs(Ei - (decision(j) - y[j])) * 1e10);
      const candidates = Array.from({ length: n }, (_, j) => j)
        .filter((j) => j !== i)
        .sort((j, k) => pairScore(k) - pairScore(j) || j - k);
      for (const j of candidates) {
        const Ej = decision(j) - y[j],
          ai = a[i],
          aj = a[j],
          L = y[i] !== y[j] ? Math.max(0, aj - ai) : Math.max(0, ai + aj - C),
          H = y[i] !== y[j] ? Math.min(C, C + aj - ai) : Math.min(C, ai + aj),
          eta = 2 * K[i][j] - K[i][i] - K[j][j];
        if (H - L < 1e-12 || eta >= -1e-12) continue;
        const next = Math.max(L, Math.min(H, aj - (y[j] * (Ei - Ej)) / eta));
        if (Math.abs(next - aj) < 1e-8) continue;
        a[j] = next;
        a[i] = ai + y[i] * y[j] * (aj - next);
        const b1 = b - Ei - y[i] * (a[i] - ai) * K[i][i] - y[j] * (a[j] - aj) * K[i][j],
          b2 = b - Ej - y[i] * (a[i] - ai) * K[i][j] - y[j] * (a[j] - aj) * K[j][j];
        b =
          a[i] > 1e-9 && a[i] < C - 1e-9 ? b1 : a[j] > 1e-9 && a[j] < C - 1e-9 ? b2 : (b1 + b2) / 2;
        changed++;
        updated = true;
        break;
      }
      if (!updated) continue;
    }
    passes = changed ? 0 : passes + 1;
  }
  const predict = (x) =>
      b +
      a.reduce(
        (s, v, i) =>
          s +
          v *
            y[i] *
            (kernel === 'linear'
              ? dot(data[i].x, x)
              : Math.exp(-gamma * ((data[i].x[0] - x[0]) ** 2 + (data[i].x[1] - x[1]) ** 2))),
        0,
      ),
    violation = Math.max(
      ...data.map((p, i) => {
        const margin = y[i] * predict(p.x);
        return a[i] < 1e-7
          ? Math.max(0, 1 - margin)
          : a[i] > C - 1e-7
            ? Math.max(0, margin - 1)
            : Math.abs(margin - 1);
      }),
    );
  return { a, b, predict, violation, sweeps };
}
export function pca(points) {
  const m = [mean(points.map((p) => p[0])), mean(points.map((p) => p[1]))],
    centered = points.map((p) => p.map((v, j) => v - m[j])),
    cov = [
      [0, 0],
      [0, 0],
    ];
  for (const x of centered)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) cov[i][j] += (x[i] * x[j]) / (points.length - 1);
  return { ...eigenSymmetric(cov), centered, mean: m, cov };
}
export function neuralLossGradient(weights, data) {
  const H = (weights.length - 1) / 4,
    g = Array(weights.length).fill(0);
  let loss = 0;
  for (const { x, label } of data) {
    const h = Array.from({ length: H }, (_, j) =>
        Math.tanh(weights[3 * j] * x[0] + weights[3 * j + 1] * x[1] + weights[3 * j + 2]),
      ),
      z = weights.at(-1) + h.reduce((s, v, j) => s + v * weights[3 * H + j], 0),
      d = sigmoid(z) - label;
    loss += Math.max(z, 0) - z * label + Math.log1p(Math.exp(-Math.abs(z)));
    g[g.length - 1] += d;
    for (let j = 0; j < H; j++) {
      g[3 * H + j] += d * h[j];
      const e = d * weights[3 * H + j] * (1 - h[j] * h[j]);
      g[3 * j] += e * x[0];
      g[3 * j + 1] += e * x[1];
      g[3 * j + 2] += e;
    }
  }
  return { loss: loss / data.length, gradient: g.map((v) => v / data.length) };
}
export function neuralPredict(weights, x) {
  const H = (weights.length - 1) / 4;
  return sigmoid(
    weights.at(-1) +
      Array.from(
        { length: H },
        (_, j) =>
          weights[3 * H + j] *
          Math.tanh(weights[3 * j] * x[0] + weights[3 * j + 1] * x[1] + weights[3 * j + 2]),
      ).reduce((a, b) => a + b, 0),
  );
}
export function mixtureEM(values, steps = 40) {
  let mu = [
      mean(values) - Math.sqrt(variance(values)) * 0.6,
      mean(values) + Math.sqrt(variance(values)) * 0.6,
    ],
    v = [variance(values), variance(values)],
    pi = [0.5, 0.5];
  const history = [],
    frames = [];
  let responsibilities = [];
  const evaluate = () => {
    let ll = 0;
    responsibilities = values.map((x) => {
      const logs = mu.map(
          (m, j) =>
            Math.log(pi[j]) - 0.5 * Math.log(2 * Math.PI * v[j]) - (x - m) ** 2 / (2 * v[j]),
        ),
        max = Math.max(...logs),
        terms = logs.map((z) => Math.exp(z - max)),
        den = terms[0] + terms[1];
      ll += max + Math.log(den);
      return terms.map((z) => z / den);
    });
    return ll;
  };
  for (let k = 0; k <= steps; k++) {
    history.push({ x: k, y: evaluate() });
    frames.push({ mu: [...mu], variance: [...v], weights: [...pi] });
    if (k === steps) break;
    for (let j = 0; j < 2; j++) {
      const mass = responsibilities.reduce((s, r) => s + r[j], 0);
      mu[j] = values.reduce((s, x, i) => s + responsibilities[i][j] * x, 0) / mass;
      v[j] = Math.max(
        0.0025,
        values.reduce((s, x, i) => s + responsibilities[i][j] * (x - mu[j]) ** 2, 0) / mass,
      );
      pi[j] = mass / values.length;
    }
  }
  return { mu, variance: v, weights: pi, history, frames, responsibilities };
}
export function convolution(image, kernel, stride = 1, padding = 'valid') {
  const offset = padding === 'same' ? 1 : 0,
    n = Math.floor((image.length + 2 * offset - 3) / stride) + 1;
  return Array.from({ length: n }, (_, j) =>
    Array.from({ length: n }, (_, i) => {
      let s = 0;
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 3; x++)
          s += (image[j * stride + y - offset]?.[i * stride + x - offset] ?? 0) * kernel[y][x];
      return s;
    }),
  );
}

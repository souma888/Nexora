import { solveLinear } from './linear.js';

/** Reproducible PRNG, independent from UI order. */
export function random(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
}
export const normal = (rng) => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());

/** Bounded CSV reader with RFC-style quoted cells; only finite numeric columns accepted. */
export function parseData(source, columns = ['x', 'y']) {
  if (typeof source !== 'string' || source.length > 200000)
    throw new Error('CSV must be under 200 kB.');
  const rows = [],
    row = [];
  let cell = '',
    quoted = false;
  for (let i = 0; i <= source.length; i++) {
    const c = source[i] ?? '\n';
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell.trim());
      cell = '';
      if (c !== ',') {
        if (row.some(Boolean)) rows.push([...row]);
        row.length = 0;
        if (c === '\r' && source[i + 1] === '\n') i++;
      }
    } else cell += c;
    if (rows.length > 513) throw new Error('Use at most 512 data rows.');
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  const header = rows.shift()?.map((s) => s.toLowerCase());
  const positions = columns.map((s) => header?.indexOf(s) ?? -1);
  if (positions.some((i) => i < 0))
    throw new Error(`CSV header must include ${columns.join(',')}. Use canonical lab units.`);
  const data = rows.map((r) =>
    Object.fromEntries(
      columns.map((key, i) => [key, r[positions[i]]?.trim() ? Number(r[positions[i]]) : NaN]),
    ),
  );
  if (data.length < 4 || data.some((r) => Object.values(r).some((v) => !Number.isFinite(v))))
    throw new Error('Use 4–512 rows with finite numeric values.');
  return data;
}

/** Linear interpolation refuses extrapolation and non-monotone abscissae. */
export function interpolate(series, x, trace = 'y') {
  if (
    !series?.length ||
    series.some(
      (p, i) =>
        !Number.isFinite(p.x) || !Number.isFinite(p[trace]) || (i > 0 && p.x <= series[i - 1].x),
    )
  )
    throw new Error('Fitting requires a strictly increasing x-axis and a finite selected trace.');
  if (x < series[0].x || x > series.at(-1).x)
    throw new Error('Data x values exceed the model plot domain; extrapolation is disabled.');
  let lo = 0,
    hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].x < x) lo = mid;
    else hi = mid;
  }
  if (lo === hi) return series[lo][trace];
  const a = series[lo],
    b = series[hi];
  return a[trace] + ((b[trace] - a[trace]) * (x - a.x)) / (b.x - a.x);
}

/** Bounded damped Gauss–Newton / Levenberg–Marquardt, scaled parameter coordinates. */
export function fitParameters(evaluate, data, initial, bounds, trace = 'y', iterations = 60) {
  const keys = Object.keys(bounds);
  if (!keys.length || keys.length > 3) throw new Error('Fit 1–3 continuous parameters.');
  const ranges = keys.map((k) => bounds[k][1] - bounds[k][0]);
  if (ranges.some((r) => !Number.isFinite(r) || r <= 0))
    throw new Error('Fit bounds must have positive finite width.');
  const input = (z) => ({
    ...initial,
    ...Object.fromEntries(keys.map((k, i) => [k, bounds[k][0] + z[i] * ranges[i]])),
  });
  const residual = (z) => {
    const result = evaluate(input(z));
    return data.map((p) => interpolate(result.series, p.x, trace) - p.y);
  };
  let z = keys.map((k, i) => (Number(initial[k]) - bounds[k][0]) / ranges[i]),
    r = residual(z),
    loss = r.reduce((s, v) => s + v * v, 0),
    lambda = 1e-3,
    converged = false,
    used = 0;
  for (; used < Math.min(100, iterations); used++) {
    const J = keys.map((_, j) => {
      const plus = [...z],
        minus = [...z];
      plus[j] = Math.min(1, z[j] + 1e-5);
      minus[j] = Math.max(0, z[j] - 1e-5);
      const a = residual(plus),
        b = residual(minus);
      return a.map((v, i) => (v - b[i]) / (plus[j] - minus[j]));
    });
    const H = keys.map((_, i) => keys.map((_, j) => J[i].reduce((s, v, k) => s + v * J[j][k], 0)));
    if (H.some((row, i) => row[i] < 1e-24))
      throw new Error('A selected parameter has no observable effect on this trace.');
    const gradient = J.map((col) => col.reduce((s, v, i) => s + v * r[i], 0));
    if (Math.max(...gradient.map(Math.abs)) < 1e-10) {
      converged = true;
      break;
    }
    const delta = solveLinear(
      H.map((row, i) => row.map((v, j) => v + (i === j ? lambda * Math.max(H[i][i], 1e-12) : 0))),
      gradient.map((v) => -v),
    );
    const next = z.map((v, i) => Math.max(0, Math.min(1, v + delta[i])));
    let nr;
    try {
      nr = residual(next);
    } catch {
      lambda *= 10;
      continue;
    }
    const nextLoss = nr.reduce((s, v) => s + v * v, 0);
    if (nextLoss < loss) {
      const improvement = loss - nextLoss;
      z = next;
      r = nr;
      loss = nextLoss;
      lambda = Math.max(1e-12, lambda / 3);
      if (improvement < 1e-10 * Math.max(1, loss)) {
        converged = true;
        break;
      }
    } else lambda *= 10;
  }
  const mean = data.reduce((s, p) => s + p.y, 0) / data.length,
    variance = data.reduce((s, p) => s + (p.y - mean) ** 2, 0);
  return {
    input: input(z),
    rmse: Math.sqrt(loss / data.length),
    r2: variance ? 1 - loss / variance : null,
    converged,
    iterations: used,
    residuals: data.map((p, i) => ({ x: p.x, y: r[i] })),
    series: evaluate(input(z)).series,
    warning:
      'Local fit only: correlated parameters, noise and model mismatch may prevent unique identification. Validate against independent data.',
  };
}

export function analyzeParameters(evaluate, input, bounds, metric, options = {}) {
  const {
    mode = 'sweep',
    samples = 100,
    seed = 1,
    distribution = 'uniform',
    integerKeys = [],
  } = options;
  const keys = Object.keys(bounds);
  if (
    !keys.length ||
    keys.length > 12 ||
    !Number.isInteger(samples) ||
    samples < 2 ||
    samples > 1000
  )
    throw new Error('Select 1–12 parameters and 2–1000 samples.');
  for (const key of keys)
    if (
      bounds[key].length !== 2 ||
      !bounds[key].every(Number.isFinite) ||
      bounds[key][0] >= bounds[key][1]
    )
      throw new Error('Parameter bounds must be finite and increasing.');
  const value = (candidate) => {
    const n = evaluate(candidate).summary[metric];
    if (typeof n !== 'number' || !Number.isFinite(n))
      throw new Error('The metric is undefined for this input.');
    return n;
  };
  const baseline = value(input),
    rng = random(seed);
  if (mode === 'sensitivity')
    return {
      baseline,
      tornado: keys
        .map((key) => {
          const [low, high] = bounds[key],
            a = value({ ...input, [key]: low }),
            b = value({ ...input, [key]: high });
          return {
            key,
            low: a,
            high: b,
            span: Math.abs(b - a),
            derivative: (b - a) / (high - low),
          };
        })
        .sort((a, b) => b.span - a.span),
    };
  if (mode === 'sweep') {
    const key = keys[0],
      [low, high] = bounds[key];
    return {
      baseline,
      series: Array.from({ length: samples }, (_, i) => {
        const raw = low + ((high - low) * i) / (samples - 1),
          x = integerKeys.includes(key) ? Math.round(raw) : raw;
        return { x, y: value({ ...input, [key]: x }) };
      }),
    };
  }
  if (mode !== 'montecarlo') throw new Error('Unknown analysis mode.');
  const values = [];
  let rejected = 0;
  for (let i = 0; i < samples; i++) {
    const candidate = { ...input };
    let outside = false;
    for (const key of keys) {
      const [low, high] = bounds[key];
      const raw =
        distribution === 'normal'
          ? (low + high) / 2 + ((high - low) / 6) * normal(rng)
          : low + (high - low) * rng();
      const x = integerKeys.includes(key)
        ? distribution === 'normal'
          ? Math.round(raw)
          : Math.floor(low + rng() * (high - low + 1))
        : raw;
      if (x < low || x > high) outside = true;
      candidate[key] = x;
    }
    try {
      if (outside) throw new Error('Outside bounds');
      values.push(value(candidate));
    } catch {
      rejected++;
    }
  }
  if (!values.length) throw new Error('All samples were rejected. Narrow the input ranges.');
  values.sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const quantile = (p) => {
    const j = (values.length - 1) * p,
      i = Math.floor(j);
    return values[i] + (values[Math.ceil(j)] - values[i]) * (j - i);
  };
  return {
    baseline,
    accepted: values.length,
    rejected,
    mean,
    standardDeviation: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length),
    p05: quantile(0.05),
    p50: quantile(0.5),
    p95: quantile(0.95),
    series: values.map((y, i) => ({ x: i / (values.length - 1 || 1), y })),
    note: 'Quantiles describe accepted samples only. Normal input uses midpoint ±3σ bounds; rejected draws are counted, not silently clipped.',
  };
}

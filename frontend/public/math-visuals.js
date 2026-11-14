import { escapeHtml } from '../../backend/html.js';
const colors = ['var(--curve)', 'var(--result)', 'var(--load)', 'var(--brand)'];
const number = (v) =>
  Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 0.001)
    ? v.toExponential(2)
    : Number(v.toFixed(3)).toString();
const label = (x, y, s, anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:12px;fill:var(--muted)">${escapeHtml(String(s))}</text>`;
const line = (a, b, color = 'var(--muted)', extra = '') =>
  `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="1.5" ${extra}/>`;
const curve = (points, color = 'var(--curve)') =>
  `<polyline points="${points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
const dot = (p, r = 3, color = 'var(--curve)', extra = '') =>
  `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${color}" ${extra}/>`;
function axes(points, bounds) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  let [xmin, xmax, ymin, ymax] = bounds ?? [
    Math.min(0, ...xs),
    Math.max(0, ...xs),
    Math.min(0, ...ys),
    Math.max(0, ...ys),
  ];
  if (xmin === xmax) {
    xmin -= 1;
    xmax += 1;
  }
  if (ymin === ymax) {
    ymin -= 1;
    ymax += 1;
  }
  const dx = (xmax - xmin) * 0.08,
    dy = (ymax - ymin) * 0.1;
  xmin -= dx;
  xmax += dx;
  ymin -= dy;
  ymax += dy;
  const project = ([x, y]) => [
    48 + (424 * (x - xmin)) / (xmax - xmin),
    270 - (220 * (y - ymin)) / (ymax - ymin),
  ];
  let drawing = '';
  for (let i = 0; i <= 4; i++) {
    const x = xmin + ((xmax - xmin) * i) / 4,
      y = ymin + ((ymax - ymin) * i) / 4;
    drawing +=
      line(project([x, ymin]), project([x, ymax]), 'var(--grid)') +
      line(project([xmin, y]), project([xmax, y]), 'var(--grid)') +
      label(project([x, 0])[0], 290, number(x)) +
      label(40, project([0, y])[1] + 4, number(y), 'end');
  }
  drawing +=
    line(project([xmin, 0]), project([xmax, 0])) + line(project([0, ymin]), project([0, ymax]));
  return { project, drawing };
}
function matrices(items) {
  const width = 460 / items.length;
  return items
    .map((item, k) => {
      const A = item.matrix,
        x0 = 30 + k * width,
        cellW = Math.min(95, (width - 20) / A[0].length),
        cellH = Math.min(44, 180 / A.length);
      return (
        label(x0 + width / 2, 48, item.label) +
        A.map((row, i) =>
          row
            .map(
              (v, j) =>
                `<rect x="${x0 + j * cellW}" y="${75 + i * cellH}" width="${cellW}" height="${cellH}" fill="var(--surface-2)" stroke="var(--border)"/>` +
                label(x0 + (j + 0.5) * cellW, 75 + (i + 0.6) * cellH, number(v)),
            )
            .join(''),
        ).join('')
      );
    })
    .join('');
}
function heatmap(grid, extra = {}) {
  const n = grid.length,
    m = grid[0].length,
    size = Math.min(400 / m, 220 / n),
    x0 = (520 - size * m) / 2,
    y0 = 50,
    lo = Math.min(...grid.flat()),
    hi = Math.max(...grid.flat()),
    signed = lo < 0,
    peak = Math.max(Math.abs(lo), Math.abs(hi)),
    unit = (v) => (signed ? Math.abs(v) / (peak || 1) : (v - lo) / (hi - lo || 1));
  let drawing = grid
    .map((row, j) =>
      row
        .map(
          (v, i) =>
            `<rect x="${x0 + i * size}" y="${y0 + (n - 1 - j) * size}" width="${size + 0.1}" height="${size + 0.1}" fill="${signed && v < 0 ? 'var(--brand)' : 'var(--result)'}" opacity="${0.08 + 0.8 * unit(v)}"><title>${escapeHtml(`Row ${j + 1}, column ${i + 1}: ${number(v)}`)}</title></rect>`,
        )
        .join(''),
    )
    .join('');
  if (extra.points) {
    const e = extra.extent ?? (extra.bounds ? Math.max(...extra.bounds.map(Math.abs)) : 3),
      project = ([x, y]) => [
        x0 + ((x + e) / (2 * e)) * size * (m - 1) + size / 2,
        y0 + ((e - y) / (2 * e)) * size * (n - 1) + size / 2,
      ];
    drawing += extra.points
      .filter((p) => Math.abs(p[0]) <= e && Math.abs(p[1]) <= e)
      .map((p) =>
        dot(
          project(p),
          3.7,
          p[2] ? 'var(--result)' : 'var(--curve)',
          'stroke="var(--plot-bg)" stroke-width="1"',
        ),
      )
      .join('');
    drawing += (extra.support ?? [])
      .filter((p) => Math.abs(p[0]) <= e && Math.abs(p[1]) <= e)
      .map((p) => dot(project(p), 6, 'none', 'stroke="var(--text)"'))
      .join('');
    drawing += (extra.arrows ?? [])
      .map(([x, y, dx, dy]) => {
        const length = Math.hypot(dx, dy),
          factor = length ? Math.min(1, (e * 0.6) / length) : 0;
        return line(
          project([x, y]),
          project([x + dx * factor, y + dy * factor]),
          'var(--load)',
          'marker-end="url(#model-arrow)"',
        );
      })
      .join('');
    drawing +=
      label(x0, y0 + size * n + 18, `−${e}`) +
      label(x0 + size * m, y0 + size * n + 18, e) +
      label(
        260,
        315,
        extra.extent
          ? 'Feature x₁; vertical axis x₂'
          : 'Horizontal x; vertical y; color indicates surface height',
      );
  } else
    drawing += label(
      260,
      305,
      `Range ${number(lo)} … ${number(hi)}${signed ? ' · crimson: negative, green: positive' : ''}`,
    );
  return drawing;
}
export function mathVisual(v, index = 0) {
  let drawing = '',
    caption = v.caption ?? 'Explore the model geometry alongside the numerical plot.';
  const frame = v.frames?.[Math.min(index, v.frames.length - 1)];
  if (v.kind === 'matrices' || v.kind === 'matrix-steps')
    drawing = matrices(
      v.matrices ?? [{ label: frame?.label ?? 'Matrix', matrix: frame?.matrix ?? [[0]] }],
    );
  else if (v.kind === 'heatmap') drawing = heatmap(v.grid, v);
  else if (v.kind === 'image-filter') {
    drawing =
      `<g transform="translate(0 45) scale(.5)">${heatmap(v.input)}</g><g transform="translate(260 45) scale(.5)">${heatmap(v.grid)}</g>` +
      label(130, 55, '8×8 input') +
      label(390, 55, 'Filtered output') +
      label(260, 255, '3×3 stencil · weights in the table below');
    caption += ' Filter weights and response values are listed below.';
  } else if (v.kind === 'clusters') {
    const points = v.points,
      a = axes(points);
    drawing =
      a.drawing +
      points.map((p, i) => dot(a.project(p), 4, colors[(frame?.labels[i] ?? 0) % 4])).join('') +
      (frame?.centers ?? [])
        .map(
          (p, i) =>
            dot(a.project(p), 8, 'var(--plot-bg)', `stroke="${colors[i % 4]}" stroke-width="3"`) +
            label(a.project(p)[0], a.project(p)[1] - 13, `μ${i + 1}`),
        )
        .join('');
  } else if (v.kind === 'mixture') {
    const s = frame ?? v.frames.at(-1),
      low = Math.min(...v.values) - 1,
      high = Math.max(...v.values) + 1,
      rows = Array.from({ length: 151 }, (_, i) => {
        const x = low + ((high - low) * i) / 150;
        return [
          x,
          ...s.mu.map(
            (m, j) =>
              (s.weights[j] / Math.sqrt(2 * Math.PI * s.variance[j])) *
              Math.exp(-((x - m) ** 2) / (2 * s.variance[j])),
          ),
        ];
      }),
      a = axes(
        rows.flatMap(([x, y, z]) => [
          [x, y],
          [x, z],
          [x, y + z],
        ]),
      );
    drawing =
      a.drawing +
      curve(rows.map(([x, y]) => a.project([x, y]))) +
      curve(
        rows.map(([x, , z]) => a.project([x, z])),
        'var(--result)',
      ) +
      curve(
        rows.map(([x, y, z]) => a.project([x, y + z])),
        'var(--load)',
      ) +
      v.values
        .map((x) => {
          const [px, py] = a.project([x, 0]);
          return line([px, py], [px, py - 5], 'var(--muted)');
        })
        .join('');
    caption += ' Blue/green: weighted components; amber: total density.';
  } else if (v.kind === 'epsilon') {
    const { a, delta, epsilon, limit } = v,
      points = Array.from({ length: 161 }, (_, i) => {
        const x = a - 2 + i / 40;
        return [x, x * x];
      }),
      ax = axes(points),
      P = ax.project,
      tl = P([a - delta, limit + epsilon]),
      br = P([a + delta, limit - epsilon]);
    drawing =
      ax.drawing +
      `<rect x="${tl[0]}" y="50" width="${br[0] - tl[0]}" height="220" fill="var(--curve)" opacity=".12"/><rect x="48" y="${tl[1]}" width="424" height="${br[1] - tl[1]}" fill="var(--result)" opacity=".12"/>` +
      curve(points.map(P)) +
      dot(P([a, limit]), 5, 'var(--plot-bg)', 'stroke="var(--load)" stroke-width="2"');
    caption =
      'Blue vertical window: δ. Green horizontal band: ε. The hollow point marks the excluded limit point.';
  } else if (v.kind === 'riemann' || v.kind === 'area') {
    const riemann = v.kind === 'riemann',
      lo = riemann ? 0 : Math.min(0, v.upper),
      hi = riemann ? 1 : Math.max(0, v.upper),
      left = riemann ? 0 : -3,
      right = riemann ? 1 : 3,
      f = (x) => (riemann ? x * x : x * x - 1),
      points = Array.from({ length: 181 }, (_, i) => {
        const x = left + ((right - left) * i) / 180;
        return [x, f(x)];
      }),
      ax = axes([...points, [0, 0]]),
      P = ax.project;
    drawing = ax.drawing;
    if (riemann) {
      for (let i = 0; i < v.n; i++) {
        const a = i / v.n,
          b = (i + 1) / v.n,
          c = v.method === 'left' ? a : v.method === 'right' ? b : (a + b) / 2,
          y = v.method === 'trapezoid' ? f(a) : f(c),
          z = v.method === 'trapezoid' ? f(b) : y;
        drawing += `<polygon points="${[
          [a, 0],
          [a, y],
          [b, z],
          [b, 0],
        ]
          .map(P)
          .map((p) => p.join(','))
          .join(
            ' ',
          )}" fill="var(--result)" fill-opacity=".18" stroke="var(--result)" stroke-width=".7"/>`;
      }
    } else {
      const area = Array.from({ length: 81 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / 80;
        return [x, f(x)];
      });
      drawing += `<polygon points="${[[lo, 0], ...area, [hi, 0]]
        .map(P)
        .map((p) => p.join(','))
        .join(' ')}" fill="var(--result)" opacity=".2"/>`;
    }
    drawing += curve(points.map(P));
    caption = riemann
      ? `${v.n} ${v.method} panels under x²; geometry matches the chosen quadrature rule.`
      : 'Shaded area is signed, with integration oriented from 0 to the selected upper limit.';
  } else if (v.kind === 'transform') {
    const A = v.matrix,
      apply = ([x, y]) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y],
      square = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
      mapped = square.map(apply),
      circle = Array.from({ length: 121 }, (_, i) => [
        Math.cos((i * Math.PI) / 60),
        Math.sin((i * Math.PI) / 60),
      ]),
      c2 = circle.map(apply),
      target = apply(v.vector),
      ax = axes([...square, ...mapped, ...circle, ...c2, v.vector, target]),
      P = ax.project;
    drawing =
      ax.drawing +
      curve(square.map(P), 'var(--muted)') +
      curve(mapped.map(P), 'var(--result)') +
      curve(c2.map(P)) +
      line(P([0, 0]), P(v.vector), 'var(--load)', 'marker-end="url(#model-arrow)"') +
      line(P([0, 0]), P(target), 'var(--result)', 'marker-end="url(#model-arrow)"');
    caption =
      'Gray: original unit square. Green: transformed square and vector. Blue: transformed unit circle.';
    if (v.eigenvectors?.length) {
      drawing += v.eigenvectors
        .map(
          (e, i) =>
            line(P(e.map((x) => -x)), P(e), colors[i % colors.length], 'stroke-dasharray="4 3"') +
            label(P(e)[0], P(e)[1] - 10, `v${i + 1}`),
        )
        .join('');
      caption += ' Dashed eigendirections map onto themselves; repeated directions can coincide.';
    }
  } else {
    const points = v.points ?? [],
      lines = v.lines ?? [],
      markers = v.markers ?? (v.marker ? [v.marker] : []),
      arrows = v.arrows ?? [],
      field = v.kind === 'field',
      all = [
        ...points,
        ...lines.flat(),
        ...markers,
        ...arrows.flatMap((a) => [
          [a[0], a[1]],
          field ? [a[0] + a[2] * 0.12, a[1] + a[3] * 0.12] : [a[2], a[3]],
        ]),
      ];
    if (!all.length) all.push([-1, -1], [1, 1]);
    const ax = axes(all),
      P = ax.project;
    drawing = ax.drawing;
    if (v.fromOrigin)
      drawing += points
        .map((point) =>
          line(P([0, 0]), P(point), 'var(--result)', 'marker-end="url(#model-arrow)"'),
        )
        .join('');
    if (v.circle) {
      const circle = Array.from({ length: 121 }, (_, i) => [
        v.circle * Math.cos((i * Math.PI) / 60),
        v.circle * Math.sin((i * Math.PI) / 60),
      ]);
      drawing += curve(circle.map(P), 'var(--muted)');
    }
    if (v.kind === 'trajectory') drawing += curve(points.map(P));
    else
      drawing += points
        .filter((_, i) => i % Math.max(1, Math.floor(points.length / 200)) === 0)
        .map((p) => dot(P(p), 3))
        .join('');
    drawing +=
      lines.map((a, i) => curve(a.map(P), colors[(i + 1) % 4])).join('') +
      markers.map((p) => dot(P(p), 5, 'var(--load)')).join('') +
      arrows
        .map((a) =>
          line(
            P(a),
            P(field ? [a[0] + a[2] * 0.12, a[1] + a[3] * 0.12] : [a[2], a[3]]),
            'var(--result)',
            'marker-end="url(#model-arrow)"',
          ),
        )
        .join('');
  }
  return { drawing, height: 325, caption };
}

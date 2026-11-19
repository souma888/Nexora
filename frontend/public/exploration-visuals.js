import { escapeHtml } from '../../backend/html.js';
const palette = ['var(--curve)', 'var(--result)', 'var(--load)', 'var(--muted)'];
const format = (x) =>
  typeof x === 'number' ? Number(x.toPrecision(4)).toString() : String(x ?? '—');
const text = (x, y, value, color = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${color};font-size:12px">${escapeHtml(format(value))}</text>`;
const path = (d, color = palette[0], width = 2, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const line = (a, b, c, d, color = palette[0], width = 2) =>
  path(`M${a} ${b}L${c} ${d}`, color, width);
const circle = (x, y, r, color = palette[0], fill = 'var(--surface-1)') =>
  `<circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" fill="${fill}" stroke-width="2"/>`;
const box = (x, y, w, h, color = 'var(--border)', fill = 'var(--surface-2)') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" stroke="${color}" fill="${fill}"/>`;
const arrow = (x, y, a, b, color = palette[0]) => {
  const angle = Math.atan2(b - y, a - x);
  return (
    line(x, y, a, b, color) +
    line(a, b, a - 7 * Math.cos(angle - 0.4), b - 7 * Math.sin(angle - 0.4), color) +
    line(a, b, a - 7 * Math.cos(angle + 0.4), b - 7 * Math.sin(angle + 0.4), color)
  );
};
function curve(points, keys = ['y', 'reference'], bounds = [58, 30, 405, 180], fixed) {
  const [x, y, w, h] = bounds,
    finite = points.filter((p) => Number.isFinite(p.x)),
    xs = finite.map((p) => p.x),
    ys = finite.flatMap((p) => keys.map((k) => p[k])).filter(Number.isFinite),
    lo = fixed?.[0] ?? Math.min(...xs),
    hi = fixed?.[1] ?? Math.max(...xs),
    low = fixed?.[2] ?? Math.min(0, ...ys),
    high = fixed?.[3] ?? Math.max(...ys),
    X = (v) => x + ((v - lo) / (hi - lo || 1)) * w,
    Y = (v) => y + h - ((v - low) / (high - low || 1)) * h;
  let drawing =
    line(x, y + h, x + w, y + h, 'var(--border)') + line(x, y, x, y + h, 'var(--border)');
  keys.forEach((key, index) => {
    let d = '',
      active = false;
    for (const p of finite) {
      if (!Number.isFinite(p[key])) {
        active = false;
        continue;
      }
      d += `${active ? 'L' : 'M'}${X(p.x)} ${Y(p[key])}`;
      active = true;
    }
    drawing += path(d, palette[index]);
  });
  drawing +=
    text(x, y + h + 20, lo, 'var(--muted)') +
    text(x + w, y + h + 20, hi, 'var(--muted)') +
    text(x - 8, y + 8, high, 'var(--muted)', 'end') +
    text(x - 8, y + h, low, 'var(--muted)', 'end');
  return { drawing, X, Y };
}
function plane(points, edges = [], bounds = 2) {
  const X = (x) => 260 + (x / bounds) * 180,
    Y = (y) => 135 - (y / bounds) * 100;
  let drawing = line(50, 135, 470, 135, 'var(--border)') + line(260, 25, 260, 245, 'var(--border)');
  edges.forEach(
    ([a, b], i) => (drawing += line(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), palette[i % 3])),
  );
  points.forEach(
    (p, i) => (drawing += circle(X(p[0]), Y(p[1]), 4, palette[i % 3], palette[i % 3])),
  );
  return { drawing, X, Y };
}
export function explorationVisual(v, index = 0) {
  const points = v.trace ?? v.points ?? [],
    selected = points[Math.min(index, Math.max(0, points.length - 1))] ?? {};
  let drawing = '',
    caption = '',
    height = 330;
  if (v.kind === 'refraction' || v.kind === 'polarization') {
    const t = (v.incidence * Math.PI) / 180,
      r =
        v.transmitted === undefined
          ? Math.asin(Math.min(1, (v.n1 * Math.sin(t)) / v.n2))
          : (v.transmitted * Math.PI) / 180;
    drawing =
      box(30, 140, 460, 110, 'var(--border)', 'var(--surface-2)') +
      line(30, 140, 490, 140, 'var(--muted)') +
      path('M260 25V250', 'var(--muted)', 1, 'stroke-dasharray="5 5"') +
      arrow(260 - 110 * Math.sin(t), 140 - 110 * Math.cos(t), 260, 140, palette[2]) +
      arrow(260, 140, 260 + 110 * Math.sin(t), 140 - 110 * Math.cos(t), palette[0]);
    if (!v.tir && Number.isFinite(r))
      drawing += arrow(260, 140, 260 + 100 * Math.sin(r), 140 + 100 * Math.cos(r), palette[1]);
    drawing +=
      text(65, 55, `n₁ = ${format(v.n1)}`) +
      text(65, 220, `n₂ = ${format(v.n2)}`) +
      text(420, 55, `θᵢ ${format(v.incidence)}°`);
    caption = v.tir
      ? 'Total internal reflection · no propagating transmitted ray'
      : v.kind === 'polarization'
        ? 's: E perpendicular to incidence plane · p: E in plane'
        : 'Angles measured from the dashed interface normal';
  } else if (v.kind === 'lens') {
    const max = Math.max(v.object, Math.min(Math.abs(v.image ?? 0), 150), Math.abs(v.focal), 10),
      scale = 190 / max,
      lens = 260,
      ox = lens - v.object * scale,
      oy = 130 - v.height * 8,
      focus = lens + v.focal * scale;
    drawing =
      line(30, 130, 490, 130, 'var(--muted)') +
      path('M260 25Q245 130 260 235Q275 130 260 25', palette[0]) +
      arrow(ox, 130, ox, oy, palette[2]) +
      circle(focus, 130, 3, palette[1]) +
      text(focus, 155, 'F');
    drawing +=
      line(ox, oy, lens, oy, palette[2]) +
      line(lens, oy, 480, oy + ((130 - oy) * (480 - lens)) / (focus - lens), palette[2]) +
      line(ox, oy, lens, 130, palette[1]);
    const slope = (130 - oy) / (lens - ox);
    drawing += line(lens, 130, 480, 130 + slope * (480 - lens), palette[1]);
    if (v.image !== null && Math.abs(v.image) < 150) {
      const ix = lens + v.image * scale,
        iy = 130 + (v.height * 8 * v.image) / v.object;
      drawing += arrow(ix, 130, ix, iy, palette[0]);
      if (v.image < 0)
        drawing += path(
          `M${lens} ${oy}L${ix} ${iy}M${lens} 130L${ix} ${iy}`,
          palette[0],
          1,
          'stroke-dasharray="5 4"',
        );
    }
    caption =
      v.image === null
        ? 'Object at focal plane · image at infinity'
        : `Object → lens → ${v.image > 0 ? 'real inverted' : 'virtual upright'} image · diagram clipped at ±150 cm`;
  } else if (v.kind === 'field') {
    const X = (x) => 260 + x * 100,
      Y = (y) => 135 - y * 65;
    for (const f of v.vectors) {
      const n = Math.hypot(f.ex, f.ey);
      if (n > 1e-12)
        drawing += arrow(
          X(f.x) - (7 * f.ex) / n,
          Y(f.y) + (7 * f.ey) / n,
          X(f.x) + (7 * f.ex) / n,
          Y(f.y) - (7 * f.ey) / n,
          'var(--muted)',
        );
    }
    for (const [q, x, y] of v.charges)
      drawing +=
        circle(X(x), Y(y), 13, q >= 0 ? palette[2] : palette[0]) +
        text(X(x), Y(y) + 4, q >= 0 ? '+' : '−');
    drawing += circle(X(v.probe[0]), Y(v.probe[1]), 6, palette[1]);
    caption = 'Direction-normalized electric-field arrows · green ring is the probe';
  } else if (v.kind === 'loop' || v.kind === 'induction') {
    const phase = v.kind === 'induction' ? 2 * Math.PI * v.frequency * (selected.x ?? 0) : 0.6,
      rx = v.kind === 'induction' ? Math.max(8, 75 * Math.abs(Math.cos(phase))) : 40;
    drawing =
      `<ellipse cx="260" cy="135" rx="${rx}" ry="85" fill="none" stroke="var(--curve)" stroke-width="3"/>` +
      arrow(85, 135, 435, 135, palette[1]) +
      text(440, 122, 'B / loop axis', 'var(--result)') +
      arrow(260, 50, 275, 65, palette[2]);
    caption =
      v.kind === 'loop'
        ? `${v.turns} turns · signed current ${format(v.current)} A · on-axis field`
        : `Linked flux and EMF are 90° apart · rotation at ${format(v.frequency)} Hz`;
  } else if (v.kind === 'waveguide') {
    for (let i = 0; i < 26; i++)
      for (let j = 0; j < 12; j++) {
        const basis = v.mode === 'TM' ? Math.sin : Math.cos;
        const f = basis((v.m * Math.PI * (i + 0.5)) / 26) * basis((v.n * Math.PI * (j + 0.5)) / 12);
        drawing += `<rect x="${65 + i * 15}" y="${40 + j * 15}" width="15" height="15" fill="${f >= 0 ? palette[0] : palette[2]}" opacity="${0.12 + 0.65 * Math.abs(f)}"/>`;
      }
    drawing +=
      box(65, 40, 390, 180, 'var(--muted)', 'none') +
      text(260, 245, `${v.mode}${v.m}${v.n} · a=${format(v.width)} mm · b=${format(v.height)} mm`);
    caption = `Longitudinal ${v.mode === 'TE' ? 'Hz' : 'Ez'} field across the guide · blue/amber indicate sign`;
  } else if (v.kind === 'slits') {
    drawing = box(120, 30, 8, 205, 'var(--muted)');
    for (let i = 0; i < Math.min(v.slits, 20); i++) {
      const y = 48 + (i * 170) / (v.slits - 1);
      drawing += line(118, y, 131, y, 'var(--plot-bg)', 5);
      for (let k = 1; k <= 4; k++)
        drawing += path(
          `M${130 + k * 23} ${y - 25}Q${155 + k * 23} ${y} ${130 + k * 23} ${y + 25}`,
          palette[0],
          1,
        );
    }
    drawing += line(390, 25, 390, 245, palette[1], 4) + text(425, 135, 'Screen');
    caption = `${v.slits} coherent slits · spacing ${format(v.spacing)} µm · wavelength ${format(v.wavelength)} nm`;
  } else if (v.kind === 'pole-map' || v.kind === 'root-locus') {
    const all = v.kind === 'root-locus' ? v.branches.flat() : [...v.poles, ...v.zeros],
      extent = Math.max(1.2, ...all.flat().map(Math.abs)),
      P = plane([], [], extent);
    drawing = P.drawing;
    if (v.discrete)
      drawing += `<ellipse cx="260" cy="135" rx="${180 / extent}" ry="${100 / extent}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
    if (v.branches)
      for (const branch of v.branches)
        for (const [x, y] of branch) drawing += circle(P.X(x), P.Y(y), 1.1, palette[0], palette[0]);
    for (const [x, y] of v.poles) {
      const X = P.X(x),
        Y = P.Y(y);
      drawing += path(`M${X - 5} ${Y - 5}l10 10m-10 0 10-10`, palette[2]);
    }
    for (const [x, y] of v.zeros ?? []) drawing += circle(P.X(x), P.Y(y), 5, palette[1]);
    drawing += text(455, 153, 'Re') + text(278, 30, 'Im');
    caption = v.discrete
      ? '× poles · ○ zeros · dashed unit circle'
      : '× current poles · dots trace solved root locations';
  } else if (v.kind === 'spectrogram') {
    const cols = v.cells.length,
      rows = v.cells[0].length;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const amplitude = (v.cells[c][r] + 60) / 60;
        drawing += `<rect x="${60 + (c * 400) / cols}" y="${220 - ((r + 1) * 180) / rows}" width="${400 / cols + 0.1}" height="${180 / rows + 0.1}" fill="${palette[0]}" opacity="${0.04 + 0.96 * amplitude}"/>`;
      }
    drawing +=
      text(260, 250, 'Frame time →') +
      text(50, 42, v.maximum, 'var(--muted)', 'end') +
      text(50, 220, 0, 'var(--muted)', 'end');
    caption = 'Actual STFT log-power heat map · bottom 0 Hz · top 256 Hz · 60 dB range';
  } else if (v.kind === 'bode') {
    const logPoints = points.map((p) => ({ ...p, x: Math.log10(p.x) }));
    drawing =
      text(260, 18, 'Loop magnitude / dB') +
      curve(logPoints, ['y'], [65, 32, 390, 72]).drawing +
      text(260, 149, 'Loop phase / degrees') +
      curve(logPoints, ['reference'], [65, 163, 390, 72]).drawing;
    caption =
      'Shared horizontal coordinate log₁₀(ω / rad·s⁻¹) · separate magnitude and phase scales';
  } else if (v.kind === 'filter-taps' || v.kind === 'harmonics') {
    const values = v.coefficients.map((x) => (Array.isArray(x) ? x[1] : x)),
      max = Math.max(...values.map(Math.abs), 1e-10);
    drawing = line(45, 140, 475, 140, 'var(--border)');
    values.forEach(
      (value, i) =>
        (drawing += line(
          50 + (i * 420) / Math.max(1, values.length - 1),
          140,
          50 + (i * 420) / Math.max(1, values.length - 1),
          140 - (value / max) * 100,
          palette[i % 2],
          Math.max(1, Math.min(8, 300 / values.length)),
        )),
    );
    caption =
      v.kind === 'harmonics'
        ? 'Nonzero Fourier sine coefficients · actual retained frequencies'
        : 'Actual normalized numerator coefficients · symmetric FIR or Butterworth biquad';
  } else if (v.kind === 'spectrum' || v.kind === 'noise' || v.kind === 'correlation') {
    const arrays =
      v.kind === 'spectrum'
        ? [v.samples, v.window]
        : v.kind === 'noise'
          ? [v.samples]
          : [v.first, v.second];
    drawing = curve(arrays[0].map((y, x) => ({ x, y, reference: arrays[1]?.[x] }))).drawing;
    caption =
      v.kind === 'spectrum'
        ? 'Windowed samples (blue) · analysis window (green)'
        : v.kind === 'noise'
          ? 'Seeded white noise plus random-walk drift · decimated preview'
          : 'Original pulse (blue) · delayed noisy record (green)';
  } else if (v.kind === 'logic-timing') {
    const rows = v.lanes.length,
      top = 45,
      gap = Math.min(65, 180 / rows),
      end = Math.max(...v.lanes.flatMap((l) => l.points.map((p) => p[0])));
    v.lanes.forEach((lane, i) => {
      const base = top + i * gap;
      drawing += text(85, base + 12, lane.label, 'var(--muted)', 'end');
      let d = '';
      lane.points.forEach(([t, s], k) => {
        const x = 105 + (t / end) * 365,
          y = base + 28 - s * 26;
        d += k ? `H${x}V${y}` : `M${x} ${y}`;
      });
      drawing += path(d, palette[i % 3]);
    });
    caption =
      'Actual logic transitions · horizontal axis is time · levels are vertically separated';
  } else if (v.kind === 'gantt') {
    const lanes = Math.max(...v.jobs.map((j) => j.lane)) + 1,
      end = Math.max(...v.jobs.map((j) => j.end)),
      row = Math.min(44, 180 / lanes);
    for (let i = 0; i < lanes; i++)
      drawing += text(65, 50 + i * row + 18, `Lane ${i}`, 'var(--muted)', 'end');
    v.jobs.forEach((j, i) => {
      const x = 85 + (j.start / end) * 385,
        w = Math.max(1, ((j.end - j.start) / end) * 385),
        y = 45 + j.lane * row;
      drawing += box(x, y, w, row - 8, palette[i % 3]) + text(x + w / 2, y + row / 2, j.label);
    });
    caption = 'Collision-free resource timeline · labels identify tasks / operations';
  } else if (v.kind === 'simplex') {
    const f = v.frames[Math.min(index, v.frames.length - 1)],
      rows = f.tableau,
      cols = rows[0].length,
      cw = 420 / cols;
    rows.forEach((r, i) =>
      r.forEach((value, j) => {
        drawing +=
          box(
            50 + j * cw,
            35 + i * 36,
            cw,
            36,
            f.pivot?.[0] === i && f.pivot?.[1] === j ? palette[2] : 'var(--border)',
          ) + text(50 + (j + 0.5) * cw, 58 + i * 36, format(value));
      }),
    );
    caption = `Actual simplex tableau · basis [${f.basis.join(', ')}] · use the inspection slider to replay pivots`;
  } else if (v.kind === 'planner') {
    const X = (x) => 60 + x * 40,
      Y = (y) => 240 - y * 21;
    drawing = box(60, 30, 400, 210, 'var(--border)', 'none');
    for (const [x, y, r] of v.obstacles)
      drawing += `<ellipse cx="${X(x)}" cy="${Y(y)}" rx="${r * 40}" ry="${r * 21}" fill="var(--surface-2)" stroke="var(--load)"/>`;
    if (v.nodes)
      for (let i = 1; i < v.nodes.length; i++) {
        const p = v.nodes[v.parents[i]],
          q = v.nodes[i];
        drawing += line(X(p[0]), Y(p[1]), X(q[0]), Y(q[1]), 'var(--muted)', 0.6);
      }
    if (v.path.length)
      drawing += path(
        v.path.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(''),
        palette[1],
        3,
      );
    drawing +=
      circle(X(v.start[0]), Y(v.start[1]), 5, palette[0], palette[0]) +
      circle(X(v.goal[0]), Y(v.goal[1]), 6, palette[1]);
    caption =
      'Blue start · green goal / accepted path · amber obstacles · collision checks include robot radius';
  } else if (v.kind === 'occupancy') {
    const N = v.size;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const p = v.probabilities[y * N + x];
        drawing += `<rect x="${60 + x * 10}" y="${230 - (y + 1) * 5}" width="10" height="5" fill="${p > 0.5 ? palette[2] : p < 0.5 ? palette[1] : 'var(--surface-2)'}" opacity="${p === 0.5 ? 1 : 0.15 + 0.8 * Math.abs(2 * p - 1)}"/>`;
      }
    drawing += circle(60 + v.origin[0] * 40, 230 - v.origin[1] * 20, 4, palette[0]);
    caption = 'Amber occupied evidence · green free evidence · dark cells remain unknown';
  } else if (v.kind === 'robot-arm') {
    const max = v.joints.reduce((s, p) => Math.max(s, ...p.map(Math.abs)), 1),
      X = (x) => 130 + (x / max) * 150,
      Y = (y) => 220 - (y / max) * 150;
    v.joints
      .slice(1)
      .forEach(
        (p, i) =>
          (drawing += line(X(v.joints[i][0]), Y(v.joints[i][1]), X(p[0]), Y(p[1]), palette[i], 8)),
      );
    v.joints.forEach((p) => (drawing += circle(X(p[0]), Y(p[1]), 8, palette[2])));
    caption = 'Actual forward geometry · Jacobian maps joint rates to tool velocity';
  } else if (v.kind === 'orientation') {
    const project = (p) => [260 + 100 * (p[0] - 0.55 * p[1]), 140 - 90 * (p[2] - 0.3 * p[1])];
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ].forEach((p, i) => {
      const q = project(p);
      drawing += line(260, 140, ...q, 'var(--muted)', 1);
      const body = v.matrix.map((r) => r[i]),
        b = project(body);
      drawing +=
        arrow(260, 140, ...b, palette[i]) + text(b[0] + 8, b[1], ['x', 'y', 'z'][i], palette[i]);
    });
    caption =
      'Dashed reference omitted for clarity: gray world axes · colored rotated body axes · active ZYX';
  } else if (v.kind === 'orbit') {
    const extent = Math.max(...v.points.map((p) => p.r)),
      X = (x) => 260 + (x / extent) * 110,
      Y = (y, z) => 140 - ((0.5 * y + Math.sqrt(0.75) * z) / extent) * 110;
    drawing =
      circle(260, 140, (6371 / extent) * 110, palette[0], 'var(--surface-2)') +
      path(v.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p.y, p.z)}`).join(''), palette[1]);
    const p = v.points[Math.min(index, v.points.length - 1)];
    drawing += circle(X(p.x), Y(p.y, p.z), 5, palette[2], palette[2]);
    caption =
      'Inertial orbit projection · marker follows propagated mean anomaly · Earth drawn for scale';
  } else if (v.kind === 'distillation') {
    const c = curve(points, ['y', 'reference', 'third'], [65, 30, 390, 205], [0, 1, 0, 1]);
    drawing =
      c.drawing +
      line(c.X(0), c.Y(0), c.X(1), c.Y(1), 'var(--muted)') +
      path(
        v.stairs.map((p, i) => `${i ? 'L' : 'M'}${c.X(p[0])} ${c.Y(p[1])}`).join(''),
        palette[2],
        1.8,
      );
    caption = 'Amber actual stage steps · blue equilibrium · green rectifying · amber stripping';
  } else if (v.kind === 'constellation') {
    const p = plane(v.points, [], 1.6);
    drawing = p.drawing;
    for (const [x, y] of v.ideal) drawing += circle(p.X(x), p.Y(y), 8, 'var(--muted)', 'none');
    caption = 'Equalized received QPSK symbols · gray rings denote ideal constellation locations';
  } else if (v.kind === 'eye') {
    drawing = line(60, 140, 460, 140, 'var(--border)') + line(260, 30, 260, 245, 'var(--muted)');
    v.eyes.forEach(
      (eye) =>
        (drawing += path(
          eye.map(([x, y], i) => `${i ? 'L' : 'M'}${260 + x * 190} ${140 - y * 55}`).join(''),
          palette[0],
          1,
          'opacity=".3"',
        )),
    );
    caption = '48 actual two-symbol waveform overlays · central line is the decision instant';
  } else if (v.kind === 'polar-pattern') {
    for (const r of [30, 60, 90]) drawing += circle(260, 140, r, 'var(--border)', 'none');
    drawing +=
      path(
        v.points
          .map((p, i) => {
            const a = (p.x * Math.PI) / 180,
              r = Math.sqrt(p.y) * 95;
            return `${i ? 'L' : 'M'}${260 + r * Math.sin(a)} ${140 - r * Math.cos(a)}`;
          })
          .join(''),
        palette[1],
        3,
      ) +
      path(
        v.points
          .map((p, i) => {
            const a = (p.x * Math.PI) / 180,
              r = Math.sqrt(p.y) * 95;
            return `${i ? 'L' : 'M'}${260 - r * Math.sin(a)} ${140 - r * Math.cos(a)}`;
          })
          .join(''),
        palette[1],
        3,
      );
    caption = 'Polar field-amplitude radius √P · top is array / dipole axis (θ=0°)';
  } else if (v.kind === 'quarter-car') {
    drawing =
      box(190, 30, 140, 45, palette[0]) +
      text(260, 58, `${v.sprung} kg`) +
      path('M220 75v15l-10 8 20 10-20 10 20 10-10 8v14', palette[1]) +
      path('M300 75v25h-12v20h24v-20h-12v50', palette[2]) +
      box(225, 150, 70, 35, palette[0]) +
      text(260, 173, `${v.unsprung} kg`) +
      path('M260 185v12l-10 8 20 10-10 8v15', palette[1]) +
      line(150, 240, 370, 240, 'var(--muted)', 3);
    caption = 'Coupled sprung mass / damper / suspension / unsprung mass / tire stiffness';
  } else if (v.kind === 'bridge') {
    const diamond = [
      [260, 35],
      [370, 130],
      [260, 225],
      [150, 130],
      [260, 35],
    ];
    drawing = path(diamond.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(''));
    drawing +=
      arrow(90, 55, 90, 205, palette[2]) +
      text(70, 130, `${format(v.supply)} V`) +
      line(150, 130, 210, 130, palette[1]) +
      line(310, 130, 370, 130, palette[1]) +
      text(260, 134, 'ΔV') +
      text(200, 75, 'R₁') +
      text(200, 198, 'R₂') +
      text(330, 75, 'R₃') +
      text(330, 198, 'R₄');
    caption = `${v.mode} bridge · exact branch-divider calculation · GF=${format(v.factor)}`;
  } else if (v.kind === 'merchant') {
    const scale = 140 / Math.max(Math.abs(v.cutting), Math.abs(v.thrust), 1);
    drawing =
      line(70, 180, 440, 180, 'var(--muted)', 4) +
      path('M280 180l65-120 50 120Z', palette[0]) +
      arrow(280, 180, 280 - v.cutting * scale, 180, palette[2]) +
      arrow(280, 180, 280, 180 - v.thrust * scale, palette[1]) +
      line(280, 180, 170, 180 - 110 * Math.tan((v.phi * Math.PI) / 180), palette[0]) +
      text(90, 45, `φ = ${format(v.phi)}°`);
    caption =
      'Force vectors scaled together · blue shear plane and rigid tool · amber cutting / green thrust';
  } else if (v.kind === 'aircraft-cg') {
    drawing =
      path('M60 140Q80 110 430 125l35 15-35 10H80Z', palette[0]) +
      path('M200 135 270 40h20l-30 95m-60 10 70 80h20l-30-80', palette[0]);
    for (const [position, label, color] of [
      [v.wing, 'AC', palette[0]],
      [v.cg, 'CG', palette[2]],
      [v.neutral, 'NP', palette[1]],
    ]) {
      const x = 100 + position * 350;
      drawing +=
        circle(x, 140, 5, color, color) + text(x, 255, `${label} ${format(position)}`, color);
    }
    caption =
      'Positions measured in mean aerodynamic chord fractions · CG ahead of NP is statically stable';
  } else if (['feedback-state', 'observer', 'mpc', 'tracking-filter'].includes(v.kind)) {
    drawing =
      arrow(30, 130, 95, 130, palette[2]) +
      box(95, 95, 140, 70, palette[0]) +
      text(
        165,
        124,
        v.kind === 'observer'
          ? 'Observer'
          : v.kind === 'tracking-filter'
            ? 'Kalman update'
            : 'Controller',
      ) +
      text(
        165,
        147,
        v.gains ? `K = ${v.gains.map(format).join(', ')}` : 'Prediction → correction',
      ) +
      arrow(235, 130, 280, 130) +
      box(280, 95, 130, 70, palette[1]) +
      text(345, 135, 'State / plant') +
      arrow(410, 130, 485, 130, palette[1]) +
      path('M450 130V220H60V130', 'var(--muted)') +
      text(260, 246, 'Measured state / innovation feedback', 'var(--muted)');
    caption =
      v.kind === 'mpc'
        ? `Receding horizon · actuator bound ±${format(v.bound)} · first move applied`
        : 'State equations and numerical trajectory are shown in the main plot';
  } else if (
    [
      'membrane',
      'reservoir',
      'compartments',
      'vessel',
      'optical-sensor',
      'sir',
      'reactor',
      'flash',
      'reactor-cascade',
      'packed-column',
    ].includes(v.kind)
  ) {
    if (v.kind === 'packed-column') {
      drawing = box(205, 35, 110, 200, palette[0]);
      for (let i = 0; i < 30; i++)
        drawing += circle(
          220 + (i % 5) * 19,
          55 + Math.floor(i / 5) * 29,
          7,
          'var(--muted)',
          'none',
        );
      drawing += arrow(150, 230, 150, 45, palette[2]) + arrow(370, 45, 370, 230, palette[1]);
      caption =
        'Countercurrent transport / packed medium · amber gas or flow · green liquid or resistance';
    } else if (v.kind === 'vessel') {
      drawing = path('M70 65h370M70 205h370', palette[0], 4);
      for (let y = 0; y < 7; y++) {
        const r = (y - 3) / 3,
          length = 170 * (1 - r * r);
        drawing += arrow(145, 135 + r * 60, 145 + length, 135 + r * 60, palette[1]);
      }
      caption = 'Parabolic fully developed profile · wall shear from the pressure gradient';
    } else if (v.kind === 'compartments') {
      drawing =
        box(90, 80, 125, 100, palette[0]) +
        text(152, 115, 'Central') +
        text(152, 145, `${format(v.central)} L`) +
        box(310, 80, 125, 100, palette[1]) +
        text(372, 115, 'Peripheral') +
        text(372, 145, `${format(v.peripheral)} L`) +
        arrow(215, 110, 310, 110) +
        arrow(310, 150, 215, 150, palette[1]) +
        arrow(152, 180, 152, 240, palette[2]) +
        text(220, 245, 'Eliminated mass');
      caption =
        'Mass amounts are integrated separately; concentrations use each compartment volume';
      if (v.configuration === 'one') {
        drawing =
          box(195, 70, 130, 110, palette[0]) +
          text(260, 108, 'One central volume') +
          text(260, 143, `${format(v.central)} L`) +
          arrow(260, 180, 260, 235, palette[2]) +
          text(350, 235, 'Eliminated mass');
        caption =
          'One-compartment IV bolus · no peripheral exchange · central clearance removes mass';
      }
    } else if (v.kind === 'membrane') {
      drawing = box(55, 100, 410, 45, palette[0]);
      ['Na⁺', 'K⁺', 'Leak'].forEach(
        (s, i) =>
          (drawing +=
            box(100 + i * 140, 80, 35, 85, palette[i]) +
            text(118 + i * 140, 65, s) +
            arrow(118 + i * 140, 175, 118 + i * 140, 225, palette[i])),
      );
      caption = 'Voltage-dependent conductance channels · classic squid-axon parameter set';
    } else if (v.kind === 'sir') {
      const labels = ['Susceptible', 'Infectious', 'Recovered'];
      labels.forEach(
        (s, i) =>
          (drawing += box(30 + i * 170, 90, 125, 75, palette[i]) + text(92 + i * 170, 132, s)),
      );
      drawing += arrow(155, 128, 200, 128, palette[2]) + arrow(325, 128, 370, 128, palette[1]);
      caption = 'Closed-population S → I → R model · conserved total population';
    } else if (v.kind === 'reactor-cascade') {
      const n = Math.min(v.tanks, 8);
      for (let i = 0; i < n; i++) {
        const x = 45 + (i * 430) / n;
        drawing +=
          box(x, 80, Math.min(75, 350 / n), 110, palette[i % 3]) +
          text(x + Math.min(75, 350 / n) / 2, 140, i + 1);
        if (i < n - 1)
          drawing += arrow(x + Math.min(75, 350 / n), 135, 45 + ((i + 1) * 430) / n, 135);
      }
      caption = `${v.tanks} equal-volume ideal mixed tanks · fixed total residence time`;
    } else {
      drawing =
        box(190, 55, 140, 160, palette[0]) +
        arrow(70, 100, 190, 100, palette[2]) +
        arrow(330, 165, 450, 165, palette[1]) +
        line(260, 70, 260, 165, 'var(--muted)') +
        line(235, 165, 285, 165, palette[0], 4) +
        text(
          260,
          245,
          v.kind === 'flash'
            ? (v.phase ?? 'Equilibrium flash')
            : v.kind === 'optical-sensor'
              ? 'Two-wavelength Beer–Lambert attenuation'
              : v.kind === 'reservoir'
                ? 'Compliant arterial reservoir'
                : 'Well-mixed reaction system',
        );
      caption = 'Lumped model schematic · governing balances are calculated in the solver';
    }
  } else if (
    v.kind === 'bend' ||
    v.kind === 'rolling' ||
    v.kind === 'molding' ||
    v.kind === 'layers' ||
    v.kind === 'welding'
  ) {
    if (v.kind === 'rolling') {
      drawing =
        circle(260, 75, 52, palette[0]) +
        circle(260, 195, 52, palette[0]) +
        path('M60 120h160l80 10h160m-400 25h160l80-10h160', palette[1], 5) +
        arrow(65, 138, 180, 138, palette[2]);
      caption = `Entry ${format(v.initial)} mm → exit ${format(v.final)} mm · projected contact ${format(v.contact)} mm`;
    } else if (v.kind === 'bend') {
      const angle = (v.angle * Math.PI) / 180;
      drawing =
        path(
          `M90 180H240Q260 180 ${260 + 20 * Math.cos(angle)} ${180 - 20 * Math.sin(angle)}L${260 + 130 * Math.cos(angle)} ${180 - 130 * Math.sin(angle)}`,
          palette[0],
          8,
        ) + text(380, 220, `BA ${format(v.thickness)} mm sheet`);
      caption = `Loaded angle ${format(v.angle)}° · estimated recovery ${format(v.springback)}°`;
    } else if (v.kind === 'layers') {
      for (let i = 0; i < 12; i++)
        drawing += box(150 + i * 2, 235 - i * 14, 210, 10, palette[i % 3]);
      drawing += arrow(410, 230, 410, 55, palette[2]) + text(425, 145, `${format(v.height)} mm`);
      caption = `${v.layers} actual layers · displayed stack is schematic, not a toolpath`;
    } else if (v.kind === 'welding') {
      drawing =
        path('M65 160h390v45H65Z', palette[0]) +
        path('M240 40l-25 80h35l25-80Z', palette[2]) +
        path('M230 125q-30 30 0 35t45-20', palette[2], 4) +
        arrow(320, 80, 430, 80, palette[1]) +
        circle(300, 175, 5, palette[1]);
      caption = 'Moving point heat source · green probe offset avoids the Rosenthal singularity';
    } else {
      drawing =
        box(75, 40, 150, 190, palette[0]) +
        box(295, 40, 150, 190, palette[0]) +
        box(225, 40, 70, 190, palette[2]) +
        arrow(260, 130, 150, 130, palette[1]) +
        arrow(260, 130, 370, 130, palette[1]);
      caption = 'Symmetric conduction from polymer wall to two isothermal mold faces';
    }
  } else if (
    [
      'airfoil',
      'shock',
      'transfer',
      'velocity-vectors',
      'vehicle-loads',
      'bicycle',
      'ev',
      'gears',
      'tire',
    ].includes(v.kind)
  ) {
    if (v.kind === 'transfer') {
      const max = Math.max(v.r1, v.r2),
        rx = 180,
        ry = 95 * Math.sqrt(1 - ((v.r2 - v.r1) / (v.r2 + v.r1)) ** 2),
        shift = (rx * (v.r2 - v.r1)) / (v.r2 + v.r1);
      drawing =
        `<ellipse cx="${260 + shift}" cy="140" rx="${rx}" ry="${ry}" fill="none" stroke="var(--result)"/>` +
        circle(260, 140, (6371 / max) * 55, palette[0], 'var(--surface-2)') +
        text(100, 255, `r₁ ${format(v.r1)} km`) +
        text(400, 255, `r₂ ${format(v.r2)} km`);
      caption = 'Impulsive transfer ellipse · endpoint radii set by the chosen circular orbits';
    } else if (v.kind === 'shock') {
      const theta = (v.turn * Math.PI) / 180,
        beta = ((v.beta ?? 50) * Math.PI) / 180;
      drawing =
        line(110, 210, 465, 210, 'var(--muted)') +
        path(
          `M110 210L${110 + 250 * Math.cos(theta)} ${210 - 250 * Math.sin(theta)}L450 210Z`,
          palette[0],
        ) +
        line(110, 210, 110 + 180 * Math.cos(beta), 210 - 180 * Math.sin(beta), palette[2], 3) +
        arrow(25, 130, 130, 130, palette[1]);
      caption = v.attached
        ? 'Attached-shock angle from the numerical θ–β–M solution'
        : 'No attached solution · detached bow-shock shape is not solved';
    } else if (v.kind === 'velocity-vectors') {
      const t = (v.angle * Math.PI) / 180;
      drawing =
        arrow(130, 200, 370, 200, palette[0]) +
        arrow(130, 200, 130 + 200 * Math.cos(t), 200 - 200 * Math.sin(t), palette[1]) +
        arrow(370, 200, 130 + 200 * Math.cos(t), 200 - 200 * Math.sin(t), palette[2]);
      caption =
        'Initial velocity (blue), target velocity (green), required vector difference (amber)';
    } else if (v.kind === 'airfoil') {
      drawing = path('M85 145Q180 85 420 145Q190 165 85 145Z', palette[0], 3);
      for (let y = 60; y <= 220; y += 40) drawing += arrow(25, y, 75, y, 'var(--muted)');
      drawing += arrow(250, 135, 250, 45, palette[1]);
      caption =
        'Attached-flow lift model · empirical cap is explicitly separate from thin-airfoil theory';
    } else {
      drawing =
        path('M90 170V130l50-35h170l70 45h45v30Z', palette[0], 3) +
        circle(155, 175, 25, palette[0]) +
        circle(345, 175, 25, palette[0]) +
        line(65, 203, 455, 203, 'var(--muted)', 3) +
        arrow(155, 220, 155, 150, palette[1]) +
        arrow(345, 220, 345, 150, palette[1]) +
        circle(250, 130, 6, palette[2]);
      caption =
        v.kind === 'ev'
          ? 'Battery → drivetrain → road load · regenerative energy returns only part of stopping energy'
          : v.kind === 'bicycle'
            ? 'Front / rear axle linear cornering model · amber center of gravity'
            : v.kind === 'tire'
              ? 'Pure longitudinal tire force · no combined-slip or thermal calibration'
              : 'Vehicle / drivetrain schematic · normal loads and forces are calculated separately';
    }
  } else {
    drawing = curve(points, ['y', 'reference', 'third']).drawing;
    caption =
      {
        bode: 'Loop magnitude and unwrapped phase · crossover values are solved numerically',
        pwm: 'Exact periodic RC response to quantized PWM',
        quantizer: 'Actual quantized samples and original input',
        sensor: 'Nonlinear calibrated sensor response and linear approximation',
        'timer-counter': 'Representable timer ramp and inclusive TOP reload',
        trajectory: 'Rest-to-rest position, velocity and acceleration',
        equilibrium: 'Temperature-dependent equilibrium constant',
        inventory: 'Expected profit around the critical-fractile optimum',
        forecast: 'Actual observations and forecasts formed before each new observation',
        ecg: 'Synthetic P–QRS–T waveform · not a clinical ECG model',
        'tool-wear': 'Taylor-law machining cost curve',
        'fuel-range': 'Integrated Breguet mass-ratio range',
        'pulse-spectrum': 'Raised-cosine pulse with removable singularities resolved',
        tolerance: 'Actual seeded Monte Carlo stack distribution',
        'standing-wave': 'Incident and reflected traveling-wave voltage envelope',
        ber: 'Analytical coherent AWGN bit-error curves',
      }[v.kind] ?? 'Calculated model response · use the inspection slider and main plot for values';
  }
  const lines = [''];
  for (const word of caption.split(' ')) {
    const last = lines.length - 1;
    if ((lines[last] + ' ' + word).length > 68) lines.push(word);
    else lines[last] += (lines[last] ? ' ' : '') + word;
  }
  return {
    drawing: drawing + lines.map((s, i) => text(260, 280 + i * 16, s, 'var(--muted)')).join(''),
    height,
  };
}

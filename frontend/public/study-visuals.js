import { escapeHtml } from '../../backend/html.js';
const colors = ['var(--result)', 'var(--curve)', 'var(--load)'];
const f = (x) => (typeof x === 'number' ? Number(x.toPrecision(5)).toString() : String(x ?? '—'));
const text = (x, y, s, c = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${c};font-size:13px">${escapeHtml(f(s))}</text>`;
const line = (x, y, a, b, c = 'var(--curve)', w = 2) =>
  `<path d="M${x} ${y}L${a} ${b}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const path = (d, c = 'var(--curve)', w = 2, fill = 'none') =>
  `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}"/>`;
const rect = (x, y, w, h, c = 'var(--curve)', fill = 'var(--surface-2)') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" stroke="${c}" fill="${fill}"/>`;
const circle = (x, y, r, c = 'var(--curve)', fill = 'var(--surface-1)') =>
  `<circle cx="${x}" cy="${y}" r="${r}" stroke="${c}" fill="${fill}" stroke-width="2"/>`;
const arrow = (x, y, a, b, c = 'var(--load)') => {
  const t = Math.atan2(b - y, a - x),
    u = 8;
  return (
    line(x, y, a, b, c) +
    line(a, b, a - u * Math.cos(t - 0.4), b - u * Math.sin(t - 0.4), c) +
    line(a, b, a - u * Math.cos(t + 0.4), b - u * Math.sin(t + 0.4), c)
  );
};
const chart = (points, keys = ['y', 'reference'], bounds = [50, 35, 420, 180]) => {
  if (!points?.length) return '';
  const [x, y, w, h] = bounds,
    xs = points.map((v) => v.x).filter(Number.isFinite),
    ys = points.flatMap((p) => keys.map((k) => p[k])).filter(Number.isFinite),
    lo = Math.min(...xs),
    hi = Math.max(...xs),
    bottom = Math.min(...ys),
    top = Math.max(...ys);
  if (!ys.length) return '';
  let out = line(x, y + h, x + w, y + h, 'var(--border)') + line(x, y, x, y + h, 'var(--border)');
  keys.forEach((key, j) => {
    let d = '',
      active = false;
    for (const p of points) {
      if (!Number.isFinite(p[key])) {
        active = false;
        continue;
      }
      d += `${active ? 'L' : 'M'}${x + ((p.x - lo) / (hi - lo || 1)) * w} ${y + h - ((p[key] - bottom) / (top - bottom || 1)) * h}`;
      active = true;
    }
    out += path(d, ['var(--curve)', 'var(--muted)', 'var(--result)'][j % 3]);
  });
  return (
    out +
    text(x, y + h + 22, lo, 'var(--muted)') +
    text(x + w, y + h + 22, hi, 'var(--muted)') +
    text(x - 8, y + 5, top, 'var(--muted)', 'end') +
    text(x - 8, y + h, bottom, 'var(--muted)', 'end')
  );
};
const spring = (a, b, y) =>
  path(
    `M${a} ${y}L${a + 10} ${y}` +
      Array.from(
        { length: 10 },
        (_, i) => `L${a + 10 + ((b - a - 20) * (i + 1)) / 10} ${y + (i % 2 ? -7 : 7)}`,
      ).join('') +
      `L${b} ${y}`,
  );
const support = (x, y) =>
  path(`M${x} ${y}l-12 20h24Z`, 'var(--result)') +
  line(x - 17, y + 24, x + 17, y + 24, 'var(--muted)');
const coil = (x, y) =>
  path(`M${x} ${y}` + Array.from({ length: 5 }, () => `q-8-15 0-20q8-5 0-10`).join(''));
const normalize = (a) => {
  const n = Math.hypot(...a) || 1;
  return a.map((v) => v / n);
};
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function millerPolygon(normal, cube) {
  const points = [];
  for (let i = 0; i < cube.length; i++)
    for (let j = i + 1; j < cube.length; j++) {
      const a = cube[i],
        b = cube[j];
      if (a.filter((x, k) => x !== b[k]).length !== 1) continue;
      const fa = dot(normal, a) - 1,
        fb = dot(normal, b) - 1;
      if (fa === 0) points.push(a);
      if (fb === 0) points.push(b);
      if (fa * fb < 0) {
        const t = fa / (fa - fb);
        points.push(a.map((x, k) => x + t * (b[k] - x)));
      }
    }
  const unique = points.filter(
    (p, i) => points.findIndex((q) => Math.hypot(...p.map((x, k) => x - q[k])) < 1e-8) === i,
  );
  if (unique.length < 3) return unique;
  const center = [0, 1, 2].map((k) => unique.reduce((s, p) => s + p[k], 0) / unique.length),
    n = normalize(normal),
    u = normalize(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])),
    w = cross(n, u),
    angle = (p) => {
      const v = p.map((x, k) => x - center[k]);
      return Math.atan2(dot(v, w), dot(v, u));
    };
  return unique.sort((a, b) => angle(a) - angle(b));
}
export function studyVisual(v, index = 0) {
  const point = v.points?.[Math.min(index, v.points.length - 1)] ?? {},
    frame = v.frames?.[Math.min(index, v.frames.length - 1)] ?? point;
  let drawing = '',
    caption = '',
    height = 300,
    captionY = 296;
  if (v.kind === 'binary-phase') {
    drawing = chart(v.curves, ['y', 'reference'], [55, 30, 405, 190]);
    const X = (c) => 55 + c * 4.05,
      Y = (T) => 220 - ((T - 800) / 800) * 190;
    // Use a fixed temperature scale for both boundaries and the selected state.
    drawing = line(55, 220, 460, 220, 'var(--border)') + line(55, 30, 55, 220, 'var(--border)');
    for (const [key, c] of [
      ['y', 'var(--result)'],
      ['reference', 'var(--curve)'],
    ])
      drawing += path(v.curves.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${Y(p[key])}`).join(''), c);
    drawing +=
      line(55, Y(v.temperature), 460, Y(v.temperature), 'var(--muted)') +
      circle(X(v.composition), Y(v.temperature), 5, 'var(--load)', 'var(--load)');
    if (v.alpha !== null && v.beta !== null)
      drawing += line(X(v.alpha), Y(v.temperature), X(v.beta), Y(v.temperature), 'var(--load)', 4);
    drawing +=
      text(155, 180, 'Solid', 'var(--result)') +
      text(360, 70, 'Liquid', 'var(--curve)') +
      text(260, 255, `C₀ ${f(v.composition)}% · T ${f(v.temperature)}°C`);
    caption = 'Illustrative equilibrium envelope; horizontal line is the selected temperature.';
  } else if (v.kind === 'microstructure' || v.kind === 'soil-phases') {
    const fractions = v.fractions ?? [],
      sum = fractions.reduce((s, x) => s + x, 0) || 1;
    let offset = 0;
    fractions.forEach((fraction, j) => {
      const w = (380 * fraction) / sum;
      drawing += rect(65 + offset, 35, w, 28, colors[j % 3], colors[j % 3]);
      offset += w;
      drawing += text(
        65,
        100 + j * 27,
        `${v.labels?.[j] ?? 'Phase ' + (j + 1)}: ${f(fraction * 100)}%`,
        colors[j % 3],
        'start',
      );
    });
    for (let k = 0; k < 60; k++) {
      const f = (k + 0.5) / 60;
      let s = 0,
        j = 0;
      while (j < fractions.length - 1 && (s += fractions[j] / sum) < f) j++;
      drawing += rect(
        80 + (k % 20) * 18,
        200 + Math.floor(k / 20) * 17,
        15,
        14,
        colors[j % 3],
        colors[j % 3],
      );
    }
    caption =
      v.kind === 'soil-phases'
        ? 'Volumes normalized to total soil volume.'
        : 'Cells illustrate mass fractions, not measured spatial morphology or volume fractions.';
  } else if (
    [
      'diffusion',
      'transition',
      'creep-life',
      'goodman',
      'pv-collapse',
      'hydrograph',
      'relay',
    ].includes(v.kind)
  ) {
    drawing = chart(v.points);
    caption = {
      diffusion: 'Concentration profile; depth runs into the solid.',
      transition: 'Empirical absorbed-energy transition curve.',
      'creep-life':
        'Supplied constant-stress calibration; temperature uses an absolute scale in the solver.',
      goodman: 'Corrected endurance / tensile strength boundary; inspect the selected run below.',
      'pv-collapse': 'High and low voltage branches merge at the static fold.',
      hydrograph: 'Linear unit-hydrograph convolution; integrated area equals runoff volume.',
      relay: 'Null samples below pickup are deliberately left unconnected.',
    }[v.kind];
    if (v.kind === 'goodman')
      drawing += text(
        260,
        18,
        `Selected mean ${f(v.mean)} MPa · amplitude ${f(v.amplitude)} MPa`,
        'var(--load)',
      );
  } else if (v.kind === 'dislocations' || v.kind === 'grains') {
    const size =
      v.kind === 'grains' ? Math.max(14, Math.min(65, 5 * Math.sqrt(v.grain ?? 10))) : 32;
    for (let y = 35; y < 220; y += size)
      for (let x = 70; x < 455; x += size)
        drawing += rect(x, y, Math.min(size, 455 - x), Math.min(size, 220 - y), 'var(--border)');
    if (v.kind === 'dislocations')
      for (let i = 0; i < 14; i++) {
        const x = 95 + (i % 7) * 48,
          y = 75 + Math.floor(i / 7) * 90;
        drawing +=
          line(x, y - 15, x, y + 15, 'var(--load)') + line(x - 10, y, x + 10, y, 'var(--load)');
      }
    caption =
      v.kind === 'grains'
        ? 'Grain-size schematic; Hall–Petch uses the numerical grain diameter, not the drawing scale.'
        : 'Dislocation symbols illustrate obstacles; positions are not an atomistic simulation.';
  } else if (v.kind === 'crack') {
    drawing =
      rect(100, 40, 320, 180, 'var(--muted)') + arrow(75, 125, 30, 125) + arrow(445, 125, 490, 125);
    const length = Math.max(20, Math.min(150, (v.crack ?? v.initial ?? 1) * 10));
    drawing +=
      path(`M260 ${40}v${length}`, 'var(--brand)', 4) +
      text(300, 90, `a ${f(v.crack ?? v.initial)} mm`, 'var(--load)') +
      text(
        260,
        255,
        v.intensity !== undefined ? `Kᵢ ${f(v.intensity)} MPa√m` : `Life ${f(v.cycles)} cycles`,
      );
    caption =
      'Scaled crack schematic; geometry factor and LEFM/Paris limits are supplied in the model.';
  } else if (v.kind === 'crystal' || v.kind === 'crystal-plane') {
    const project = ([x, y, z]) => [
        260 + 75 * (x - 0.65 * y),
        145 + 55 * (0.45 * x + 0.45 * y - z),
      ],
      cube = [];
    const extents = v.kind === 'crystal-plane' ? [-1, 1] : [0, 1];
    for (const x of extents) for (const y of extents) for (const z of extents) cube.push([x, y, z]);
    cube.forEach((p, i) =>
      cube.forEach((q, j) => {
        if (j <= i || p.filter((x, k) => x !== q[k]).length !== 1) return;
        const [x, y] = project(p),
          [a, b] = project(q);
        drawing += line(x, y, a, b, 'var(--muted)');
      }),
    );
    if (v.kind === 'crystal-plane') {
      const n = normalize(v.normal),
        s = normalize(v.slip),
        load = normalize(v.axis),
        origin = project([0, 0, 0]);
      const plane = millerPolygon(v.normal, cube);
      drawing += path(
        plane.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(' ')}`).join('') + 'Z',
        'var(--result)',
        2,
        'var(--selection)',
      );
      for (const [u, label, color] of [
        [n, 'Plane normal', 'var(--result)'],
        [s, 'Slip direction', 'var(--curve)'],
        [load, 'Load axis', 'var(--load)'],
      ]) {
        const p = project(u);
        drawing += arrow(...origin, ...p, color);
        drawing += text(p[0], p[1] - 10, label, color);
      }
      drawing += text(260, 270, `(${v.normal.join(' ')}) [${v.slip.join(' ')}]`);
      caption = 'Cubic plane h·x+k·y+l·z=1; the supplied slip direction lies parallel to it.';
    } else if (v.structure === 'hcp') {
      drawing = '';
      for (const z of [0, 1])
        for (let i = 0; i < 6; i++) {
          const theta = (i * Math.PI) / 3,
            x = 260 + 80 * Math.cos(theta),
            y = 185 - 110 * z + 30 * Math.sin(theta);
          drawing += circle(x, y, 13, 'var(--result)');
          const next = ((i + 1) * Math.PI) / 3;
          drawing += line(
            x,
            y,
            260 + 80 * Math.cos(next),
            185 - 110 * z + 30 * Math.sin(next),
            'var(--muted)',
          );
          if (z === 0) drawing += line(x, y, x, y - 110, 'var(--muted)');
        }
      for (let i = 0; i < 3; i++)
        drawing += circle(
          260 + 34 * Math.cos((i * 2 * Math.PI) / 3),
          130 + 15 * Math.sin((i * 2 * Math.PI) / 3),
          13,
          'var(--curve)',
        );
      caption = 'Ideal HCP conventional-cell projection; highlighted layers show AB stacking.';
    } else {
      const atoms = [
        ...cube,
        ...(v.structure === 'fcc'
          ? [
              [0.5, 0.5, 0],
              [0.5, 0.5, 1],
              [0.5, 0, 0.5],
              [0.5, 1, 0.5],
              [0, 0.5, 0.5],
              [1, 0.5, 0.5],
            ]
          : [[0.5, 0.5, 0.5]]),
      ];
      for (const p of atoms) {
        const [x, y] = project(p);
        drawing += circle(
          x,
          y,
          10,
          p.every((x) => x === 0 || x === 1) ? 'var(--muted)' : 'var(--result)',
        );
      }
      caption = 'Projected conventional cell; boundary atoms are shared with adjacent cells.';
    }
  } else if (v.kind === 'laminate') {
    const angles = v.angles ?? [],
      step = Math.max(18, 190 / angles.length);
    angles.forEach((angle, i) => {
      const y = 35 + (angles.length - 1 - i) * step;
      drawing +=
        rect(100, y, 320, step, 'var(--border)') +
        text(120, y + step * 0.75, `${i + 1}`, 'var(--muted)') +
        text(260, y + step * 0.75, `${angle}°`, 'var(--result)');
    });
    captionY = Math.max(296, 55 + angles.length * step);
    caption =
      'Ply inputs run bottom to top: the first ply is at negative z. Thickness is scaled for legibility.';
  } else if (v.kind === 'corrosion') {
    drawing =
      path('M90 80V225H430V80', 'var(--muted)') +
      rect(150, 70, 35, 110, 'var(--load)') +
      rect(335, 70, 35, 110, 'var(--result)') +
      line(167, 70, 167, 35) +
      line(167, 35, 352, 35) +
      line(352, 35, 352, 70) +
      arrow(305, 35, 210, 35, 'var(--curve)') +
      text(165, 255, 'Anode dissolves', 'var(--load)') +
      text(355, 255, 'Cathodic reaction', 'var(--result)') +
      text(260, 205, `E mix ${f(v.potential)} V`);
    caption =
      'Conventional external current runs cathode to anode; the electrolyte closes the circuit.';
  } else if (v.kind === 'rheology') {
    drawing =
      line(65, 80, 65, 210, 'var(--muted)') +
      spring(65, 220, 140) +
      rect(220, 120, 70, 40) +
      line(230, 140, 280, 140) +
      line(290, 140, 440, 140) +
      text(260, 100, 'η');
    if (v.model === 'sls')
      drawing +=
        line(85, 140, 85, 210) +
        spring(85, 420, 210) +
        line(420, 210, 420, 140) +
        text(260, 245, 'Equilibrium spring E∞');
    caption =
      'Maxwell branch: series spring and dashpot; SLS adds an equilibrium spring in parallel.';
  } else if (v.kind === 'beam') {
    const end = Math.max(...(v.supports ?? [0, 1])),
      X = (x) => 65 + (390 * x) / end;
    drawing = line(65, 120, 455, 120, 'var(--muted)', 5);
    for (const s of v.supports ?? []) drawing += support(X(s), 125);
    if (v.fixed)
      drawing += path(
        'M65 75V170m-12-85 12-10m-12 35 12-10m-12 35 12-10m-12 35 12-10',
        'var(--muted)',
      );
    const peaks = v.points?.map((p) => Math.abs(p.deflection ?? 0)) ?? [],
      scale = Math.max(...peaks, 1e-12);
    if (peaks.some((x) => x > 0))
      drawing += path(
        v.points
          .map((p, i) => `${i ? 'L' : 'M'}${X(p.x)} ${120 - (45 * p.deflection) / scale}`)
          .join(''),
        'var(--result)',
      );
    for (const [position, load] of v.loads ?? []) {
      if (position >= 0 && position <= end)
        drawing +=
          arrow(X(position), 60, X(position), 115) +
          text(X(position), 45, `${f(load)} kN`, 'var(--load)');
    }
    if (point.x !== undefined)
      drawing +=
        line(X(Math.min(point.x, end)), 175, X(Math.min(point.x, end)), 210, 'var(--curve)') +
        text(260, 245, `x ${f(point.x)} m · M ${f(point.y)} kN·m`);
    caption = peaks.some((x) => x > 0)
      ? 'Deflection is exaggerated; sagging moment is positive.'
      : 'Support/load schematic; section response is plotted in the main chart.';
  } else if (v.kind === 'portal') {
    const shift = Math.min(45, Math.abs(v.sway) * 10000);
    drawing =
      path(
        `M115 220Q115 145 ${115 + shift} 70H${405 + shift}Q405 145 405 220`,
        'var(--result)',
        4,
      ) +
      line(95, 224, 135, 224, 'var(--muted)', 4) +
      line(385, 224, 425, 224, 'var(--muted)', 4) +
      arrow(330 + shift, 70, 450 + shift, 70) +
      text(260, 255, `H ${f(v.height)} m · L ${f(v.span)} m`);
    caption = 'Fixed-base portal; sway is exaggerated for visibility.';
  } else if (v.kind === 'section' || v.kind === 'crosssection' || v.kind === 'concrete') {
    if (v.kind === 'section') {
      const xs = v.vertices.map((p) => p[0]),
        ys = v.vertices.map((p) => p[1]),
        lo = Math.min(...xs),
        bottom = Math.min(...ys),
        s = Math.min(300 / (Math.max(...xs) - lo), 170 / (Math.max(...ys) - bottom));
      drawing = path(
        v.vertices
          .map(([x, y], i) => `${i ? 'L' : 'M'}${100 + (x - lo) * s} ${220 - (y - bottom) * s}`)
          .join('') + 'Z',
        'var(--curve)',
        3,
        'var(--surface-2)',
      );
      drawing +=
        circle(100 + (v.xc - lo) * s, 220 - (v.yc - bottom) * s, 4, 'var(--result)') +
        text(260, 255, 'Centroid and boundary stress inspection');
    } else if (v.kind === 'crosssection') {
      const w = v.width,
        h = v.height,
        t = v.flange,
        tw = v.web,
        s = Math.min(300 / w, 180 / h),
        x = 260 - (w * s) / 2,
        y = 40;
      drawing =
        rect(x, y, w * s, t * s) +
        rect(260 - (tw * s) / 2, y + t * s, tw * s, (h - (v.shape === 'I' ? 2 : 1) * t) * s) +
        (v.shape === 'I' ? rect(x, y + (h - t) * s, w * s, t * s) : '') +
        arrow(445, 80, 445, 190);
      drawing += text(260, 255, `${v.shape} section · V ${f(v.force)} kN`);
    } else {
      const scale = 180 / v.depth,
        c = Math.min(180, v.c * scale),
        a = v.block * scale;
      drawing =
        rect(105, 40, 130, 180) +
        rect(280, 40, 65, a, 'var(--load)', 'var(--load)') +
        line(90, 40 + c, 375, 40 + c, 'var(--muted)') +
        circle(135, 215, 6, 'var(--brand)', 'var(--brand)') +
        circle(205, 215, 6, 'var(--brand)', 'var(--brand)') +
        text(375, 40 + c, `c ${f(v.c)} mm`, 'var(--text)', 'start') +
        text(310, 245, '0.85 f′c block', 'var(--load)');
    }
    caption =
      v.kind === 'concrete'
        ? 'Strain-compatible compression block; steel stress is capped at fy.'
        : 'Cross-section dimensions are scaled; no deformation or failure is inferred from this outline.';
  } else if (v.kind === 'cylinder' || v.kind === 'tube' || v.kind === 'hole') {
    if (v.kind === 'tube') {
      drawing =
        rect(135, 55, 250, 150, 'var(--curve)') +
        rect(143, 63, 234, 134, 'var(--muted)', 'var(--plot-bg)') +
        arrow(150, 45, 350, 45, 'var(--result)') +
        text(260, 245, `${f(v.width)} × ${f(v.height)} mm median line`);
    } else {
      const outer = 85,
        inner = v.kind === 'hole' ? 25 : Math.max(15, (outer * v.inner) / v.outer);
      drawing =
        (v.kind === 'hole'
          ? rect(105, 45, 310, 180, 'var(--muted)', 'var(--surface-2)')
          : circle(260, 135, outer, 'var(--muted)', 'var(--surface-2)')) +
        circle(260, 135, inner, 'var(--curve)', 'var(--plot-bg)');
      if (v.kind === 'hole') drawing += arrow(100, 135, 45, 135) + arrow(420, 135, 475, 135);
      else
        for (let j = 0; j < 8; j++) {
          const a = (j * Math.PI) / 4;
          drawing += arrow(
            260 + (inner - 15) * Math.cos(a),
            135 + (inner - 15) * Math.sin(a),
            260 + (inner - 2) * Math.cos(a),
            135 + (inner - 2) * Math.sin(a),
          );
        }
      drawing += text(
        260,
        255,
        v.kind === 'hole'
          ? `Infinite-plate hole · remote σ ${f(v.stress)} MPa`
          : `ri ${f(v.inner)} mm · ro ${f(v.outer)} mm`,
      );
    }
    caption =
      v.kind === 'hole'
        ? 'Hole size is schematic; Kirsch edge Kt is independent of the radius.'
        : 'Ideal section geometry; the stress field is computed separately.';
  } else if (v.kind === 'column') {
    const max = Math.max(...v.points.map((p) => Math.abs(p.y)), 1e-10);
    drawing =
      path(
        v.points
          .map(
            (p, i) => `${i ? 'L' : 'M'}${260 + (45 * p.y) / max} ${220 - (180 * p.x) / v.length}`,
          )
          .join(''),
        'var(--result)',
        4,
      ) +
      support(260, 220) +
      support(260, 20) +
      arrow(260, 0, 260, 25) +
      text(360, 140, `ymax ${f(v.deflection)} mm`);
    caption = 'Deflection is exaggerated; the secant solution is restricted below Euler buckling.';
  } else if (v.kind === 'rosette') {
    drawing = circle(260, 140, 85, 'var(--border)');
    v.angles.forEach((a, i) => {
      const t = (a * Math.PI) / 180;
      drawing +=
        line(
          260 - 60 * Math.cos(t),
          140 + 60 * Math.sin(t),
          260 + 60 * Math.cos(t),
          140 - 60 * Math.sin(t),
          colors[i],
          6,
        ) + text(260 + 100 * Math.cos(t), 140 - 100 * Math.sin(t), `${a}°`, colors[i]);
    });
    caption = 'Gauge axes in the measurement plane; εxy=γxy/2.';
  } else if (v.kind === 'stress' || v.kind === 'mohr') {
    if (v.kind === 'mohr') {
      drawing = chart(v.points, ['y', 'reference', 'third']);
      caption = 'Compression-positive Mohr circle and positive-shear failure envelope.';
    } else {
      drawing = rect(190, 75, 140, 130, 'var(--muted)');
      [0, 1, 2].forEach((i) => {
        drawing +=
          arrow(345, 105 + i * 40, 440, 105 + i * 40, colors[i]) +
          text(140, 110 + i * 40, `σ${i + 1} ${f(v.principal[i])}`, colors[i]);
      });
      caption =
        'Principal stresses are tension-positive; scalar criteria are compared in the plot.';
    }
  } else if (
    ['thermal-wall', 'fin', 'radiation', 'heat-exchanger', 'thermal-network'].includes(v.kind)
  ) {
    if (v.kind === 'fin') {
      drawing = rect(65, 45, 30, 180, 'var(--load)') + rect(95, 115, 330, 30, 'var(--curve)');
      for (let i = 0; i < 5; i++)
        drawing += arrow(130 + i * 60, 110, 130 + i * 60, 70, 'var(--result)');
      drawing += text(260, 235, `Length ${f(v.length)} m · tip ${v.tip}`);
      caption =
        'One-dimensional fin; the temperature curve is computed from the chosen tip boundary.';
    } else if (v.kind === 'radiation') {
      drawing =
        path('M110 55V220H410V55', 'var(--muted)', 4) +
        arrow(140, 140, 380, 140, 'var(--load)') +
        text(120, 35, `${f(v.first)} K`, 'var(--load)') +
        text(400, 35, `${f(v.second)} K`, 'var(--result)') +
        text(260, 255, `F₁₂ ${f(v.view)}`);
      caption = 'Two-surface closed-enclosure network; self-view factors complete both rows.';
    } else if (v.kind === 'heat-exchanger') {
      drawing =
        rect(100, 85, 320, 85) +
        arrow(70, 105, 450, 105, 'var(--load)') +
        (v.mode === 'counter'
          ? arrow(450, 150, 70, 150, 'var(--result)')
          : arrow(70, 150, 450, 150, 'var(--result)')) +
        text(260, 235, v.mode === 'counter' ? 'Counterflow' : 'Parallel flow');
      caption = 'Flow arrows define the temperature-pair convention used in LMTD.';
    } else if (v.kind === 'thermal-network') {
      v.temperatures.forEach((T, i) => {
        const x = 65 + i * 130;
        drawing +=
          circle(x, 120, 8, colors[i % 3]) + text(x, 85, v.labels[i]) + text(x, 165, `${f(T)}°C`);
        if (i < 3) drawing += spring(x + 10, x + 120, 120);
      });
      caption =
        'Series junction/contact resistances; sink-to-ambient convection and radiation act in parallel.';
    } else {
      drawing = rect(155, 40, 210, 180, 'var(--muted)');
      for (let i = 0; i < 6; i++)
        drawing += line(155 + i * 35, 40, 155 + i * 35, 220, 'var(--border)');
      drawing +=
        arrow(65, 135, 145, 135, 'var(--load)') +
        arrow(375, 135, 455, 135, 'var(--result)') +
        text(100, 95, `${f(v.hot)}°`, 'var(--load)') +
        text(420, 95, `${f(v.cold)}°`, 'var(--result)');
      caption = 'Temperature and boundary assumptions are stated in the governing model.';
    }
  } else if (v.kind === 'cycle' || v.kind === 'steam-cycle' || v.kind === 'psychrometric') {
    drawing =
      chart(v.points) +
      text(
        260,
        18,
        v.kind === 'steam-cycle'
          ? 'IAPWS-IF97 state points'
          : v.kind === 'psychrometric'
            ? 'Moist-air enthalpy mixing path'
            : 'Calculated cycle states',
        'var(--result)',
      );
    caption =
      v.kind === 'steam-cycle'
        ? 'T–s state connections are schematic; state properties and wet mixtures are calculated.'
        : v.kind === 'psychrometric'
          ? 'Line endpoints are inlet air and saturated coil-ADP air.'
          : 'The selected thermodynamic assumptions define the path; inspect each state below.';
  } else if (v.kind === 'boundary-layer' || v.kind === 'channel' || v.kind === 'cylinder-flow') {
    if (v.kind === 'boundary-layer') {
      drawing =
        line(65, 215, 455, 215, 'var(--muted)', 5) +
        path('M65 215Q200 160 455 100', 'var(--curve)') +
        arrow(70, 80, 180, 80, 'var(--load)') +
        text(330, 80, `Re ${f(v.reynolds ?? 'selected')}`);
      caption =
        'Boundary-layer envelope is schematic; the numerical thickness follows the stated correlation.';
    } else if (v.kind === 'channel') {
      drawing =
        line(80, 55, 430, 55, 'var(--muted)', 5) +
        line(80, 220, 430, 220, 'var(--muted)', 5) +
        arrow(220, 35, 430, 35, 'var(--load)') +
        chart(v.points, ['y'], [90, 75, 320, 120]);
      caption =
        'Main plot gives the signed velocity across the gap; upper-wall motion is prescribed.';
    } else {
      drawing = circle(200, 135, 38, 'var(--curve)') + arrow(55, 135, 145, 135, 'var(--load)');
      for (let i = 0; i < 5; i++)
        drawing += path(`M240 ${110 + (i % 2) * 50}q35 -35 65 0t65 0`, 'var(--muted)');
      drawing += text(260, 245, v.regime);
      caption = 'Wake glyph indicates a regime only; it is not a resolved flow-field solution.';
    }
  } else if (
    v.kind === 'pipe-loop' ||
    v.kind === 'pump' ||
    v.kind === 'flow-net' ||
    v.kind === 'draining-tank' ||
    v.kind === 'hydraulic-jump'
  ) {
    if (v.kind === 'pipe-loop') {
      drawing =
        path('M70 140H125V65H395V140H450M125 140V215H395V140', 'var(--curve)', 5) +
        arrow(180, 65, 340, 65, 'var(--result)') +
        arrow(180, 215, 340, 215, 'var(--result)') +
        text(260, 45, `Upper ${f(v.upper)} L/s`) +
        text(260, 245, `Lower ${f(v.lower)} L/s`);
      caption = 'Both paths share inlet/outlet nodes; correction preserves continuity.';
    } else if (v.kind === 'flow-net') {
      const cell = Math.min(350 / v.drops, 170 / v.channels),
        x = 260 - (v.drops * cell) / 2;
      for (let i = 0; i <= v.drops; i++)
        drawing += line(x + i * cell, 40, x + i * cell, 40 + v.channels * cell, 'var(--curve)');
      for (let i = 0; i <= v.channels; i++)
        drawing += line(x, 40 + i * cell, x + v.drops * cell, 40 + i * cell, 'var(--result)');
      caption =
        'Green streamlines and blue equipotentials form square cells in this rectangular aquifer.';
    } else if (v.kind === 'draining-tank') {
      const head = frame.y ?? v.initial;
      drawing =
        path('M130 40V220H390V40', 'var(--muted)', 4) +
        rect(
          134,
          216 - (140 * head) / v.initial,
          252,
          Math.max(1, (140 * head) / v.initial),
          'var(--curve)',
          'var(--selection)',
        ) +
        arrow(390, 218, 460, 235, 'var(--result)') +
        text(260, 255, `Head ${f(head)} m`);
      caption = 'Time replay follows the integrated falling-head solution.';
    } else if (v.kind === 'hydraulic-jump') {
      drawing =
        line(65, 220, 455, 220, 'var(--muted)', 5) +
        path(`M65 180H220Q270 70 320 90H455`, 'var(--curve)', 3) +
        arrow(100, 150, 180, 150, 'var(--load)') +
        text(145, 255, `y₁ ${f(v.first)} m`) +
        text(390, 255, `y₂ ${f(v.second)} m`);
      caption =
        v.second === null
          ? 'No supercritical approach: a hydraulic-jump conjugate depth is undefined.'
          : 'Jump envelope is schematic; conjugate depths follow momentum balance.';
    } else {
      drawing =
        path('M65 140H200M300 140H455', 'var(--curve)', 5) +
        circle(250, 140, 50, 'var(--result)') +
        path('M225 165l60-25-60-25Z', 'var(--result)', 2, 'var(--surface-2)') +
        text(260, 245, `Q ${f(v.flow)} L/s · H ${f(v.head)} m`);
      caption =
        'Operating point requires a nonnegative-flow intersection of the two fitted curves.';
    }
  } else if (v.kind === 'soil-layer' || v.kind === 'footing' || v.kind === 'retaining-wall') {
    drawing = rect(65, 145, 390, 90, 'var(--border)');
    for (let i = 0; i < 8; i++)
      drawing += line(70 + i * 50, 150, 105 + i * 50, 230, 'var(--border)');
    if (v.kind === 'retaining-wall') {
      drawing +=
        path('M200 210V65H230L280 210H320V235H160V210Z', 'var(--muted)', 3, 'var(--surface-2)') +
        arrow(360, 145, 245, 145, 'var(--load)') +
        text(355, 105, `Pa ${f(v.pressure)} kN/m`);
      caption = 'Rigid-wall force schematic; water and seismic forces are excluded.';
    } else if (v.kind === 'footing') {
      drawing +=
        rect(170, 115, 180, 35, 'var(--curve)') +
        rect(225, 45, 70, 70, 'var(--muted)') +
        arrow(260, 15, 260, 105, 'var(--load)') +
        text(260, 265, `B ${f(v.width)} m · Df ${f(v.depth)} m`);
      caption = 'Centered shallow footing; assumed general-shear factors are shown in the table.';
    } else {
      drawing +=
        arrow(130, 80, 130, 135, 'var(--load)') +
        arrow(260, 80, 260, 135, 'var(--load)') +
        arrow(390, 80, 390, 135, 'var(--load)') +
        text(260, 265, `Primary settlement ${f(v.settlement)} mm`);
      caption =
        'Layer compression is schematic; settlement follows 1D drainage and compressibility assumptions.';
    }
  } else if (v.kind === 'traffic' || v.kind === 'signal' || v.kind === 'road-curve') {
    if (v.kind === 'traffic') {
      drawing = rect(65, 100, 390, 70, 'var(--muted)');
      const n = Math.min(18, Math.max(0, Math.round((18 * v.density) / v.jam)));
      for (let i = 0; i < n; i++) drawing += rect(75 + i * 20, 115, 15, 35, 'var(--result)');
      caption = 'Vehicle density glyph; the fundamental diagram is an equilibrium model.';
    } else if (v.kind === 'signal') {
      drawing =
        rect(220, 40, 80, 195, 'var(--muted)') +
        circle(260, 75, 20, 'var(--danger)') +
        circle(260, 135, 20, 'var(--load)') +
        circle(260, 195, 20, 'var(--result)', 'var(--result)') +
        text(380, 145, `${f(v.green)} / ${f(v.cycle)} s`);
      caption =
        'Effective green differs from cycle length; only undersaturated Webster delay is finite.';
    } else {
      drawing =
        path('M100 230Q100 65 420 65', 'var(--muted)', 35) +
        path('M100 230Q100 65 420 65', 'var(--result)', 2) +
        text(300, 220, `R ${f(v.radius)} m`);
      caption =
        'Horizontal alignment schematic; sight-distance formula uses the supplied grade and reaction time.';
    }
  } else if (
    [
      'transformer',
      'motor',
      'commutation',
      'phasor',
      'impedance',
      'transmission',
      'power-triangle',
    ].includes(v.kind)
  ) {
    if (v.kind === 'phasor') {
      const max = Math.max(...v.phasors.map((z) => Math.hypot(z.re, z.im)), 1e-8),
        s = 90 / max;
      drawing = line(80, 140, 450, 140, 'var(--border)') + line(220, 30, 220, 250, 'var(--border)');
      v.phasors.forEach((z, i) => {
        drawing +=
          (Math.hypot(z.re, z.im) > max * 1e-10
            ? arrow(220, 140, 220 + s * z.re, 140 - s * z.im, colors[i % 3])
            : '') +
          text(
            70,
            35 + i * 23,
            `${v.labels[i]} ${f(Math.hypot(z.re, z.im))}`,
            colors[i % 3],
            'start',
          );
      });
      caption =
        'RMS complex phasors share a magnitude scale; their phase angle is counterclockwise.';
    } else if (v.kind === 'transformer') {
      drawing =
        coil(210, 220) +
        coil(300, 220) +
        line(245, 45, 245, 225, 'var(--muted)', 3) +
        line(258, 45, 258, 225, 'var(--muted)', 3) +
        text(150, 260, 'Primary') +
        text(350, 260, 'Secondary');
      caption = v.test
        ? 'OC/SC measurements must share one referred winding basis.'
        : 'T-equivalent includes winding series impedances and a core/magnetizing branch.';
    } else if (v.kind === 'motor' || v.kind === 'commutation') {
      drawing = circle(260, 140, 80, 'var(--muted)') + circle(260, 140, 38, 'var(--result)');
      const stepper = v.kind === 'commutation' && v.mode !== 'bldc',
        poles = stepper ? 4 : 3,
        currents = [frame.y ?? 0, frame.reference ?? 0, frame.third ?? 0];
      for (let j = 0; j < poles; j++) {
        const a = (j * 2 * Math.PI) / poles,
          current = stepper ? currents[j % 2] * (j < 2 ? 1 : -1) : currents[j];
        drawing += rect(
          250 + 65 * Math.cos(a),
          130 + 65 * Math.sin(a),
          20,
          20,
          colors[j % 3],
          v.kind === 'commutation' && Math.abs(current) > 0
            ? current > 0
              ? 'var(--result)'
              : 'var(--load)'
            : 'var(--surface-2)',
        );
      }
      if (v.kind === 'commutation') {
        const x = stepper ? currents[0] : (2 * currents[0] - currents[1] - currents[2]) / 3,
          y = stepper ? currents[1] : (currents[1] - currents[2]) / Math.sqrt(3),
          norm = Math.hypot(x, y) || 1;
        drawing +=
          arrow(260, 140, 260 + (55 * x) / norm, 140 - (55 * y) / norm, 'var(--curve)') +
          text(260, 235, `Iₐ ${f(currents[0])} A · Iᵦ ${f(currents[1])} A`);
      }
      drawing += text(
        260,
        255,
        v.kind === 'commutation'
          ? `${v.mode} · phase currents commanded`
          : `Speed ${f(v.speed)} ${v.slip !== undefined ? 'rpm' : 'rad/s'}`,
      );
      caption =
        v.kind === 'commutation'
          ? 'Arrow is the commanded stator current vector, not a solved mechanical rotor position.'
          : 'Actuator schematic; electrical torque/current assumptions are specified in the model.';
    } else if (v.kind === 'power-triangle') {
      const scale = 170 / Math.max(v.real, v.before, v.after);
      drawing =
        path(`M100 210H${100 + v.real * scale}V${210 - v.before * scale}Z`, 'var(--muted)') +
        path(`M100 210H${100 + v.real * scale}V${210 - v.after * scale}Z`, 'var(--result)', 3) +
        text(260, 255, 'Reactive compensation reduces apparent current demand');
      caption = 'Active power is unchanged; capacitor kvar subtracts from the lagging load kvar.';
    } else {
      drawing =
        rect(70, 115, 100, 45) +
        line(170, 137, 350, 137, 'var(--curve)', 3) +
        rect(350, 115, 100, 45) +
        text(120, 143, 'Source') +
        text(400, 143, v.kind === 'transmission' ? 'Receiving bus' : 'Fault bus') +
        text(
          260,
          100,
          v.kind === 'transmission' ? 'Z series, Y/2 at each end' : 'Common per-unit base',
        );
      caption =
        v.kind === 'transmission'
          ? 'Nominal-π network; loaded and no-load boundary conditions are stated separately.'
          : 'Series positive-sequence reactance model; no dc offset or motor contribution.';
    }
  } else if (
    [
      'junction',
      'bands',
      'bjt',
      'mosfet',
      'cmos',
      'differential',
      'filter',
      'timer',
      'zener',
      'schmitt',
    ].includes(v.kind)
  ) {
    if (v.kind === 'bands') {
      const Y = (E) => 145 - 140 * E;
      drawing =
        line(90, Y(0.56), 430, Y(0.56), 'var(--curve)', 3) +
        line(90, Y(-0.56), 430, Y(-0.56), 'var(--curve)', 3) +
        line(90, Y(0), 430, Y(0), 'var(--muted)') +
        line(90, Y(v.fermi), 430, Y(v.fermi), 'var(--result)', 3) +
        text(450, Y(0.56), 'Ec') +
        text(450, Y(-0.56), 'Ev') +
        text(450, Y(v.fermi), 'Ef', 'var(--result)');
      caption = 'Uniform equilibrium bands; the intrinsic level is assumed at midgap.';
    } else if (v.kind === 'junction') {
      drawing =
        rect(85, 65, 175, 140, 'var(--brand)') +
        rect(260, 65, 175, 140, 'var(--result)') +
        rect(235, 65, 50, 140, 'var(--muted)', 'var(--surface-1)') +
        text(170, 140, 'P') +
        text(350, 140, 'N') +
        text(260, 245, `W ${f(v.depletion)} µm · Vj ${f(v.junction)} V`);
      caption = 'Abrupt-junction depletion schematic; width is not drawn to physical scale.';
    } else if (
      v.kind === 'bjt' ||
      v.kind === 'mosfet' ||
      v.kind === 'differential' ||
      v.kind === 'cmos'
    ) {
      drawing =
        rect(210, 75, 100, 135, 'var(--muted)') +
        line(95, 140, 210, 140) +
        line(260, 40, 260, 75) +
        line(260, 210, 260, 245) +
        arrow(310, 140, 440, 140, 'var(--result)') +
        text(
          260,
          145,
          v.kind === 'cmos'
            ? 'P / N'
            : v.kind === 'differential'
              ? 'Q1 / Q2'
              : v.kind === 'mosfet'
                ? 'G · D · S'
                : 'B · C · E',
        ) +
        text(
          260,
          270,
          v.region ??
            (v.kind === 'cmos'
              ? `Vin ${f(v.input)} → Vout ${f(v.output)} V`
              : 'Matched differential pair'),
        );
      caption =
        'Circuit topology is specified in the equations and notes; operating region comes from the solver.';
    } else if (v.kind === 'filter') {
      drawing =
        line(40, 140, 65, 140) +
        rect(65, 130, 50, 20) +
        line(115, 140, 180, 140) +
        rect(180, 130, 50, 20) +
        line(230, 140, 300, 140) +
        path('M300 100V190L390 145Z', 'var(--curve)', 3) +
        line(390, 145, 460, 145) +
        path('M140 140V55H215M225 55H430V145', 'var(--result)') +
        line(215, 40, 215, 70, 'var(--result)') +
        line(225, 40, 225, 70, 'var(--result)') +
        line(260, 140, 260, 180) +
        line(245, 180, 275, 180) +
        line(245, 190, 275, 190) +
        line(260, 190, 260, 225) +
        line(245, 225, 275, 225, 'var(--muted)') +
        text(90, 115, 'R1') +
        text(205, 115, 'R2') +
        text(220, 30, 'C1', 'var(--result)') +
        text(295, 190, 'C2') +
        text(330, 150, `K ${f(v.gain)}`);
      caption =
        'C1 feeds output back to the resistor junction; C2 grounds the amplifier input node.';
    } else if (v.kind === 'timer') {
      drawing =
        rect(175, 65, 170, 150, 'var(--muted)') +
        text(260, 145, '555') +
        line(75, 140, 175, 140) +
        arrow(345, 140, 455, 140, 'var(--result)') +
        text(260, 245, `${v.mode} · ⅓ / ⅔ supply thresholds`);
      caption = `Selected time ${f(frame.x)} s; output and capacitor voltage are in the main chart.`;
    } else if (v.kind === 'zener') {
      drawing =
        line(65, 75, 455, 75) +
        rect(145, 65, 70, 20) +
        line(300, 75, 300, 220) +
        path('M280 135h40l-20 35ZM280 175h40', 'var(--result)', 3) +
        line(65, 220, 455, 220) +
        text(410, 140, `Vo ${f(v.output)} V`);
      caption =
        'Reverse breakdown branch shares the output node with the load; regulation requires available zener current.';
    } else {
      drawing =
        path('M190 70L350 140L190 210Z', 'var(--curve)', 3) +
        line(70, 115, 190, 115) +
        line(350, 140, 450, 140) +
        path('M400 140V45H140V170H190', 'var(--result)') +
        text(210, 175, '+') +
        text(210, 120, '−') +
        text(260, 250, `Thresholds ${f(v.lower)} / ${f(v.upper)} V`);
      caption =
        'Inverting comparator with positive feedback; output preserves state between thresholds.';
    }
  } else {
    drawing = chart(v.points);
    caption = 'Inspect calculated state, equations and limits below.';
  }
  const lines = [];
  for (const word of caption.split(' ')) {
    if (!lines.length || lines.at(-1).length + word.length + 1 > 68) lines.push(word);
    else lines[lines.length - 1] += ' ' + word;
  }
  drawing += lines.map((s, i) => text(260, captionY + i * 19, s, 'var(--muted)')).join('');
  height = Math.max(height, captionY + 14 + (lines.length - 1) * 19);
  return { drawing, height };
}

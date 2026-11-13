import { computerVisual } from './computer-visuals.js';
import { engineeringVisual } from './engineering-visuals.js';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const f = (value, digits = 3) =>
  typeof value === 'number'
    ? value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e6)
      ? value.toExponential(3)
      : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)
    : (value ?? '—');
const text = (x, y, value, fill = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${fill}">${escape(f(value))}</text>`;
const path = (d, color = 'var(--curve)', width = 2, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const box = (x, y, w, h, color = 'var(--border)') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="var(--surface-2)" stroke="${color}"/>`;
const arrow = (x, y, a, b, color = 'var(--load)') =>
  path(`M${x} ${y}L${a} ${b}`, color, 2, 'marker-end="url(#model-arrow)"');
const wire = (value) => (value ? 'var(--result)' : 'var(--muted)');

export function renderModelVisual(host, definition, data, index) {
  let v = data.visualization;
  if (
    !v &&
    ['pid', 'motor', 'cruise', 'tank', 'thermal', 'pendulum', 'windup', 'digital'].includes(
      definition.id,
    )
  )
    v = { type: 'feedback' };
  host.hidden = !v;
  if (!v) return;
  let drawing = '',
    height = 260;
  const frame = v.frames?.[Math.min(index, v.frames.length - 1)];
  const defs =
    '<defs><marker id="model-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>';
  if (v.type === 'engineering-extension') {
    const result = engineeringVisual(v, data, index, { text, path, box, arrow });
    drawing = result.drawing;
    height = result.height;
  } else if (['word', 'cpu', 'pages', 'predictor'].includes(v.type)) {
    const result = computerVisual(v, frame, { box, path, arrow, text });
    drawing = result.drawing;
    height = result.height;
  } else if (v.type === 'flow') {
    const scale = Math.max(v.inlet, v.outlet),
      a = Math.max(14, (70 * v.inlet) / scale),
      b = Math.max(14, (70 * v.outlet) / scale);
    drawing =
      path(
        `M35 ${125 - a}H150L300 ${125 - b}H485M35 ${125 + a}H150L300 ${125 + b}H485`,
        'var(--curve)',
        3,
      ) +
      arrow(55, 125, 460, 125) +
      text(115, 30, v.left) +
      text(400, 30, v.right) +
      text(260, 230, v.detail, 'var(--muted)');
  } else if (v.type === 'layers') {
    drawing =
      box(110, 55, 150, 130, 'var(--load)') +
      box(260, 55, 150, 130, 'var(--curve)') +
      text(185, 115, v.labels[0]) +
      text(335, 115, v.labels[1]) +
      arrow(145, 155, 375, 155) +
      v.values.map((n, i) => text(110 + i * 150, 40, `${f(n)}°C`)).join('') +
      text(260, 230, v.detail, 'var(--muted)');
  } else if (v.type === 'thermal') {
    drawing =
      box(120, 55, 160, 130, 'var(--load)') +
      text(200, 110, `${f(v.hot)}°C`) +
      text(200, 145, 'Uniform body') +
      [85, 125, 165].map((y) => arrow(300, y, 410, y)).join('') +
      text(400, 45, `${f(v.cold)}°C air`) +
      text(260, 230, v.detail, 'var(--muted)');
  } else if (v.type === 'exchanger') {
    drawing =
      box(75, 65, 370, 115) +
      arrow(95, 95, 425, 95, 'var(--load)') +
      (v.counter
        ? arrow(425, 150, 95, 150, 'var(--curve)')
        : arrow(95, 150, 425, 150, 'var(--curve)')) +
      text(100, 42, `${f(v.hot)}°C`, 'var(--load)') +
      text(425, 42, `${f(v.hotOutlet)}°C`, 'var(--load)') +
      text(95, 210, `${f(v.counter ? v.coldOutlet : v.cold)}°C`, 'var(--curve)') +
      text(425, 210, `${f(v.counter ? v.cold : v.coldOutlet)}°C`, 'var(--curve)') +
      text(
        260,
        245,
        v.counter
          ? 'Counterflow · cold inlet on the right'
          : 'Parallel flow · both inlets on the left',
        'var(--muted)',
      );
  } else if (v.type === 'energy') {
    drawing =
      box(170, 90, 180, 75, 'var(--result)') +
      text(260, 130, v.label) +
      text(260, 25, `Hot reservoir ${f(v.hot)} K`, 'var(--load)') +
      text(260, 245, `Cold reservoir ${f(v.cold)} K`, 'var(--curve)');
    drawing += v.reverse
      ? arrow(260, 90, 260, 40) +
        arrow(260, 215, 260, 165, 'var(--curve)') +
        arrow(470, 127, 350, 127, 'var(--result)')
      : arrow(260, 40, 260, 90) +
        arrow(260, 165, 260, 215, 'var(--curve)') +
        arrow(350, 127, 470, 127, 'var(--result)');
    drawing +=
      text(110, 65, `${f(v.reverse ? v.rejected : v.supplied)} ${v.unit}`, 'var(--load)') +
      text(110, 200, `${f(v.reverse ? v.supplied : v.rejected)} ${v.unit}`, 'var(--curve)') +
      text(425, 105, `${f(v.work)} ${v.unit}`, 'var(--result)');
  } else if (v.type === 'piston') {
    const edge = Math.min(410, 140 + v.ratio * 50);
    drawing =
      path('M65 60V190H455V60', 'var(--muted)', 3) +
      box(70, 65, edge - 70, 120, 'var(--curve)') +
      path(`M${edge} 55V195M${edge} 125H470`, 'var(--result)', 5) +
      text(170, 110, `${f(v.temperature)} K`) +
      text(170, 145, `Vf/Vi ${f(v.ratio)}`) +
      text(260, 235, v.detail, 'var(--muted)');
  } else if (v.type === 'specimen' || v.type === 'expansion') {
    const strain = v.strain ?? 0,
      exaggerated = Math.max(-40, Math.min(75, strain * 3000)),
      end = v.fixed ? 390 : 390 + exaggerated;
    drawing =
      box(110, 85, end - 110, 55, 'var(--result)') +
      path('M110 65V160M390 65V160', 'var(--muted)', 1, 'stroke-dasharray="4 4"') +
      text(260, 45, 'Deformation shown with exaggeration', 'var(--muted)') +
      text(260, 205, v.detail, 'var(--muted)');
    if (v.fixed) drawing += path('M102 70V155M398 70V155', 'var(--text)', 5);
    else drawing += arrow(100, 112, 55, 112) + arrow(end + 10, 112, Math.min(505, end + 55), 112);
    if (v.residual !== undefined)
      drawing += text(260, 240, `Residual strain ${f(v.residual * 100)}%`, 'var(--result)');
  } else if (v.type === 'viscoelastic') {
    drawing =
      path(
        'M90 50H430M90 200H430M150 50v20l-12 10 24 15-24 15 24 15-12 10v65M360 50v55m-22-15v45h44V90m-22 45v65',
        'var(--curve)',
        3,
      ) +
      text(150, 235, `E ${f(v.modulus)} GPa`) +
      text(365, 235, `η ${f(v.viscosity)} GPa·s`) +
      text(260, 25, 'Kelvin–Voigt solid: parallel spring and dashpot', 'var(--muted)');
  } else if (v.type === 'composite') {
    drawing = box(70, 60, 380, 135, 'var(--curve)');
    const n = Math.round(v.fraction * 16);
    drawing +=
      Array.from({ length: n }, (_, i) => path(`M85 ${72 + i * 7}H435`, 'var(--result)', 4)).join(
        '',
      ) +
      arrow(45, 125, 15, 125) +
      arrow(475, 125, 505, 125) +
      text(260, 235, v.detail, 'var(--muted)');
  } else if (v.type === 'root') {
    const r = Math.max(v.lower, Math.min(v.upper, v.root)),
      at = 75 + ((r - v.lower) / (v.upper - v.lower)) * 370;
    drawing =
      path('M75 125H445', 'var(--muted)') +
      [75, 445].map((x) => path(`M${x} 105V145`, 'var(--curve)', 3)).join('') +
      text(75, 175, v.lower) +
      text(445, 175, v.upper) +
      `<circle cx="${at}" cy="125" r="8" fill="var(--result)"/>` +
      text(260, 65, `Latest x ${f(v.root)}`, 'var(--result)') +
      text(260, 220, v.detail, 'var(--muted)');
  } else if (v.type === 'interpolation') {
    drawing =
      path('M65 150H455', 'var(--muted)') +
      v.values
        .map(
          (n, i) =>
            `<circle cx="${80 + i * 115}" cy="125" r="8" fill="var(--curve)"/>${text(80 + i * 115, 170, `(${i}, ${f(n)})`)}`,
        )
        .join('') +
      text(260, 65, `At x=${f(v.query)}: y=${f(v.value)}`, 'var(--result)') +
      text(260, 225, v.detail, 'var(--muted)');
  } else if (v.type === 'montecarlo') {
    drawing =
      path('M145 25V225H345V25Z', 'var(--muted)') +
      path('M145 25A200 200 0 0 1 345 225', 'var(--curve)', 2) +
      v.points
        .map(
          (p) =>
            `<circle cx="${145 + p.x * 200}" cy="${225 - p.y * 200}" r="1.9" fill="${p.inside ? 'var(--result)' : 'var(--muted)'}" opacity=".7"/>`,
        )
        .join('') +
      text(260, 248, v.detail, 'var(--muted)');
  } else if (v.type === 'mesh') {
    drawing =
      path('M45 150H475', 'var(--curve)') +
      Array.from({ length: v.count + 1 }, (_, i) =>
        path(
          `M${45 + (430 * i) / v.count} 141v18`,
          i === 0 || i === v.count ? 'var(--result)' : 'var(--muted)',
        ),
      ).join('') +
      text(45, 190, '0') +
      text(475, 190, '1') +
      text(260, 65, 'Uniform finite-difference mesh') +
      text(260, 235, v.detail, 'var(--muted)');
  } else if (v.type === 'arm') {
    const pose = frame,
      extent = Math.max(v.reach, Math.hypot(...(v.target ?? [0, 0])), 0.1),
      scale = 105 / extent,
      sx = (x) => 260 + scale * x,
      sy = (y) => 135 - scale * y;
    host.dataset.worldScale = scale;
    host.dataset.worldX = 260;
    host.dataset.worldY = 135;
    drawing =
      path('M80 135H440M260 20V250', 'var(--grid)') +
      `<circle cx="260" cy="135" r="${v.reach * scale}" fill="none" stroke="var(--border)" stroke-dasharray="4 4"/><circle cx="260" cy="135" r="${v.inner * scale}" fill="none" stroke="var(--border)"/>`;
    drawing += path(
      v.path.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(''),
      'var(--muted)',
      1,
      'stroke-dasharray="3 3"',
    );
    drawing +=
      path(
        pose.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(''),
        'var(--curve)',
        5,
      ) +
      pose.points
        .map(
          (p, i) =>
            `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="${i === 2 ? 6 : 5}" fill="${i === 2 ? 'var(--result)' : 'var(--surface-1)'}" stroke="var(--curve)" stroke-width="2"/>`,
        )
        .join('');
    if (v.target)
      drawing += `<circle cx="${sx(v.target[0])}" cy="${sy(v.target[1])}" r="9" class="robot-target" fill="var(--surface-2)" stroke="${v.reachable ? 'var(--result)' : 'var(--load)'}" stroke-width="2" stroke-dasharray="3 2"/>`;
    drawing +=
      text(
        260,
        20,
        v.target ? 'Drag target or edit x/y' : 'Joint-space motion preview',
        'var(--muted)',
      ) + text(260, 247, `θ₁ ${f(pose.angles[0])}° · θ₂ ${f(pose.angles[1])}°`);
  } else if (v.type === 'fourbar') {
    const points = v.pose?.points ?? [
        [0, 0],
        [
          v.crank * Math.cos((v.angle * Math.PI) / 180),
          v.crank * Math.sin((v.angle * Math.PI) / 180),
        ],
        [v.ground, 0],
      ],
      xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      scale = Math.min(
        390 / (Math.max(...xs) - Math.min(...xs) || 1),
        140 / (Math.max(...ys) - Math.min(...ys) || 1),
      ),
      sx = (x) => 65 + (x - Math.min(...xs)) * scale,
      sy = (y) => 200 - (y - Math.min(...ys)) * scale;
    drawing =
      (v.pose
        ? path(
            points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join('') + 'Z',
            'var(--curve)',
            4,
          )
        : path(`M${sx(0)} ${sy(0)}L${sx(points[1][0])} ${sy(points[1][1])}`, 'var(--curve)', 4) +
          path(
            `M${sx(0)} ${sy(0)}L${sx(v.ground)} ${sy(0)}`,
            'var(--muted)',
            2,
            'stroke-dasharray="4 4"',
          )) +
      points
        .map(
          (p, i) =>
            `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="6" fill="var(--surface-1)" stroke="var(--result)"/>${text(sx(p[0]), sy(p[1]) - 15, !v.pose && i === 2 ? 'D' : ['O', 'A', 'B', 'D'][i])}`,
        )
        .join('') +
      text(
        260,
        28,
        v.pose
          ? `Selected crank ${f(v.angle)}° · closed linkage`
          : 'No real closure at selected angle',
        'var(--muted)',
      );
  } else if (v.type === 'mobile') {
    const points = [...v.path, ...(v.referencePath ?? []), [0, 0]],
      xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]),
      loX = Math.min(...xs),
      loY = Math.min(...ys),
      rangeX = Math.max(...xs) - loX,
      rangeY = Math.max(...ys) - loY,
      scale = Math.min(400 / (rangeX || 1), 150 / (rangeY || 1)),
      ox = 260 - scale * (loX + rangeX / 2),
      oy = 135 + scale * (loY + rangeY / 2),
      sx = (x) => ox + scale * x,
      sy = (y) => oy - scale * y;
    drawing = path(
      v.path.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(''),
      'var(--curve)',
      2,
    );
    if (v.referencePath)
      drawing += path(
        v.referencePath.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(''),
        'var(--muted)',
        1,
        'stroke-dasharray="4 4"',
      );
    drawing +=
      `<g transform="translate(${sx(frame.position[0])} ${sy(frame.position[1])}) rotate(${(-frame.heading * 180) / Math.PI})">${box(-15, -10, 30, 20, 'var(--result)')}${path('M-10-14H10M-10 14H10', 'var(--text)', 4)}${arrow(0, 0, 28, 0, 'var(--result)')}</g>` +
      text(260, 25, v.detail, 'var(--muted)') +
      text(
        260,
        245,
        `t ${f(frame.time)} s · x ${f(frame.position[0])} m · y ${f(frame.position[1])} m`,
      );
  } else if (v.type === 'gate') {
    const inverted = ['NAND', 'NOR', 'XNOR', 'NOT'].includes(v.gate),
      base =
        v.gate === 'NAND' ? 'AND' : v.gate === 'NOR' ? 'OR' : v.gate === 'XNOR' ? 'XOR' : v.gate;
    const shape =
      base === 'NOT'
        ? 'M190 60L320 125L190 190Z'
        : base === 'AND'
          ? 'M190 65H250A60 60 0 0 1 250 185H190Z'
          : 'M180 65Q235 125 180 185Q285 190 330 125Q285 60 180 65Z';
    const inputX = base === 'OR' || base === 'XOR' ? 198 : 190,
      tip = base === 'AND' ? 310 : base === 'NOT' ? 320 : 330;
    drawing =
      path(shape, 'var(--curve)', 3) +
      (base === 'XOR' ? path('M165 65Q220 125 165 185', 'var(--curve)', 2) : '') +
      path(`M70 ${base === 'NOT' ? 125 : 90}H${inputX}`, wire(v.a), 3) +
      text(75, base === 'NOT' ? 110 : 75, `A ${v.a}`);
    if (base !== 'NOT')
      drawing += path(`M70 160H${inputX}`, wire(v.b), 3) + text(75, 185, `B ${v.b}`);
    if (inverted)
      drawing += `<circle cx="${tip + 8}" cy="125" r="8" fill="var(--plot-bg)" stroke="var(--curve)" stroke-width="2"/>`;
    drawing +=
      path(`M${inverted ? tip + 16 : tip} 125H440`, wire(v.output), 3) +
      text(445, 105, `Y ${v.output}`, wire(v.output)) +
      text(260, 235, v.gate, 'var(--text-accent)');
  } else if (v.type === 'adder') {
    drawing =
      box(160, 50, 210, 150, 'var(--curve)') +
      text(265, 90, 'FULL ADDER') +
      text(265, 130, 'S = A ⊕ B ⊕ Cin') +
      text(265, 170, 'Cout = majority(A,B,Cin)');
    [
      ['A', v.a],
      ['B', v.b],
      ['Cin', v.carry],
    ].forEach(([name, n], i) => {
      drawing += path(`M75 ${80 + i * 45}H160`, wire(n), 3) + text(70, 70 + i * 45, `${name} ${n}`);
    });
    drawing +=
      path('M370 95H460', wire(v.sum), 3) +
      text(445, 80, `S ${v.sum}`, wire(v.sum)) +
      path('M370 160H460', wire(v.outputCarry), 3) +
      text(445, 190, `Cout ${v.outputCarry}`, wire(v.outputCarry)) +
      text(260, 240, `${v.a} + ${v.b} + ${v.carry} = 2 × ${v.outputCarry} + ${v.sum}`);
  } else if (v.type === 'flipflop') {
    drawing =
      box(175, 55, 160, 140, 'var(--curve)') +
      text(255, 40, `${v.kind} flip-flop · clock ${frame.cycle}`) +
      path('M75 95H175', wire(frame.input), 3) +
      text(90, 75, `${v.kind === 'JK' ? 'J' : v.kind} ${frame.input ?? '—'}`) +
      path('M75 160H175', 'var(--muted)') +
      path('M175 150l15 10-15 10', 'var(--curve)') +
      text(105, 190, 'CLK ↑') +
      path('M335 95H440', wire(frame.q), 3) +
      text(430, 75, `Q ${frame.q}`, wire(frame.q)) +
      path('M335 160H440', wire(1 - frame.q), 2) +
      text(435, 190, `¬Q ${1 - frame.q}`);
    if (v.kind === 'JK')
      drawing += text(255, 225, `K before edge: ${frame.k ?? '—'}`, 'var(--muted)');
  } else if (v.type === 'counter') {
    const size = Math.min(52, 400 / v.bits),
      start = 260 - (v.bits * size) / 2;
    drawing =
      text(
        260,
        40,
        `Clock ${frame.cycle} · decimal ${frame.count}${frame.wrapped ? ' · WRAPPED' : ''}`,
        'var(--result)',
      ) +
      [...frame.binary]
        .map(
          (n, i) =>
            box(start + i * size, 90, size - 5, 60, wire(Number(n))) +
            text(start + i * size + (size - 5) / 2, 128, n, wire(Number(n))) +
            text(start + i * size + (size - 5) / 2, 178, `Q${v.bits - i - 1}`, 'var(--muted)'),
        )
        .join('') +
      text(260, 230, `Unsigned ${v.bits}-bit register`, 'var(--muted)');
  } else if (v.type === 'fsm') {
    height = 290;
    const positions = [
        [100, 75],
        [400, 75],
        [100, 215],
        [400, 215],
      ],
      edges = [
        ['M75 60C5-15 5 120 75 90', 0, 0, 0, 30, 50],
        ['M125 75H375', 0, 1, 1, 250, 60],
        ['M425 60C505-15 505 120 425 90', 1, 1, 1, 485, 50],
        ['M383 95L119 195', 1, 2, 0, 260, 130],
        ['M100 190V100', 2, 0, 0, 80, 145],
        ['M125 205H375', 2, 3, 1, 250, 193],
        ['M375 230H125', 3, 2, 0, 250, 252],
        ['M400 190V100', 3, 1, 1, 420, 145],
      ];
    drawing =
      edges
        .map(
          ([d, from, to, bit, x, y]) =>
            path(
              d,
              frame.previous === from && frame.state === to && frame.bit === bit
                ? 'var(--load)'
                : 'var(--muted)',
              2,
              'marker-end="url(#model-arrow)"',
            ) + text(x, y, bit, 'var(--muted)'),
        )
        .join('') +
      positions
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="25" fill="var(--surface-1)" stroke="${frame.state === i ? 'var(--result)' : 'var(--curve)'}" stroke-width="${frame.state === i ? 3 : 1.5}"/>${i === 3 ? `<circle cx="${x}" cy="${y}" r="21" fill="none" stroke="var(--curve)"/>` : ''}${text(x, y + 5, `S${i}`)}`,
        )
        .join('') +
      text(
        260,
        283,
        `Bit ${frame.cycle} · input ${frame.bit ?? '—'} · detect ${frame.output}`,
        'var(--result)',
      );
  } else if (v.type === 'cache') {
    height = Math.max(260, 70 + v.sets * 34);
    const width = 330 / v.ways;
    drawing = text(
      260,
      25,
      `Access ${frame.cycle}: address ${frame.address} → set ${frame.set}, tag ${frame.tag} · ${frame.hit ? 'HIT' : 'MISS'}`,
      frame.hit ? 'var(--result)' : 'var(--load)',
    );
    drawing += frame.cache
      .map(
        (set, i) =>
          text(65, 65 + i * 34, `Set ${i}`, 'var(--muted)') +
          set
            .map(
              (line, j) =>
                box(
                  115 + j * width,
                  42 + i * 34,
                  width - 5,
                  28,
                  i === frame.set && j === frame.way ? 'var(--load)' : 'var(--border)',
                ) +
                text(
                  115 + (j + 0.5) * width,
                  62 + i * 34,
                  line.tag === null ? 'invalid' : `tag ${line.tag}`,
                ),
            )
            .join(''),
      )
      .join('');
  } else if (v.type === 'feedback') {
    drawing =
      text(65, 105, 'r', 'var(--muted)') +
      arrow(75, 125, 120, 125, 'var(--curve)') +
      box(120, 90, 120, 70, 'var(--curve)') +
      text(180, 130, 'Controller') +
      arrow(240, 125, 295, 125, 'var(--load)') +
      box(295, 90, 110, 70, 'var(--result)') +
      text(350, 130, 'Plant') +
      arrow(405, 125, 470, 125, 'var(--result)') +
      text(460, 105, 'y', 'var(--result)') +
      path('M440 125V205H100V140', 'var(--muted)', 2, 'marker-end="url(#model-arrow)"') +
      text(270, 232, 'Negative feedback · measurement returns to error', 'var(--muted)');
  } else if (v.type === 'phase') {
    const series = data.series,
      first = series[0].x,
      last = series.at(-1).x,
      sx = (x) => 65 + (390 * (x - first)) / (last - first),
      sy = (y) => 50 + (150 * -y) / 90;
    drawing =
      path('M65 50V200H455', 'var(--muted)') +
      path(
        series.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.phase)}`).join(''),
        'var(--result)',
        2,
      ) +
      [0, -45, -90].map((n) => text(45, sy(n) + 5, `${n}°`, 'var(--muted)')).join('') +
      text(260, 25, 'Bode phase response') +
      text(260, 235, `log₁₀ω · phase at probe ${f(series[index].phase)}°`, 'var(--muted)') +
      `<circle cx="${sx(series[index].x)}" cy="${sy(series[index].phase)}" r="4" fill="var(--result)"/>`;
  }
  const wide = [
    'adder',
    'fsm',
    'cache',
    'word',
    'cpu',
    'pages',
    'predictor',
    'engineering-extension',
  ].includes(v.type);
  host.innerHTML = `<svg viewBox="0 0 520 ${height}" class="${wide ? 'wide-model' : ''}${v.kind === 'project' ? ' project-model' : ''}" role="img" aria-label="${escape(definition.title)} interactive schematic">${defs}${drawing}</svg>`;
}

export function renderModelTable(host, data) {
  host.hidden = !data.table;
  if (!data.table) return;
  const target = host.querySelector('table');
  target.replaceChildren();
  const caption = document.createElement('caption');
  caption.textContent = data.table.caption;
  target.append(caption);
  const head = document.createElement('thead'),
    tr = document.createElement('tr');
  data.table.headers.forEach((value) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = value;
    tr.append(th);
  });
  head.append(tr);
  target.append(head);
  const body = document.createElement('tbody');
  data.table.rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.dataset.row = String(i);
    if (i === data.table.selected) tr.className = 'selected';
    row.forEach((value, j) => {
      const td = document.createElement(j ? 'td' : 'th');
      if (!j) td.scope = 'row';
      td.textContent = f(value, 6);
      tr.append(td);
    });
    body.append(tr);
  });
  target.append(body);
}

export function highlightModelTable(host, data, index) {
  if (!data.table?.followProbe) return;
  for (const row of host.querySelectorAll('tbody tr'))
    row.classList.toggle('selected', row.dataset.row === String(index));
}

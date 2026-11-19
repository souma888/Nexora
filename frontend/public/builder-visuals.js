import { escapeHtml as escape } from '../../backend/html.js';
const colors = ['var(--curve)', 'var(--result)', 'var(--load)'];
const f = (x) => (typeof x === 'number' ? Number(x.toPrecision(4)).toString() : String(x ?? '—'));
const text = (x, y, value, color = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${color};font-size:12px">${escape(f(value))}</text>`;
const line = (a, b, c, d, color = colors[0], width = 2, extra = '') =>
  `<path d="M${a} ${b}L${c} ${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const circle = (x, y, r, color = colors[0], fill = 'var(--surface-1)') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
export function geometryMap(points, width = 520, height = 300) {
  const xs = points.map((p) => p[0]).filter(Number.isFinite),
    ys = points.map((p) => p[1]).filter(Number.isFinite),
    loX = Math.min(0, ...xs),
    hiX = Math.max(0.1, ...xs),
    loY = Math.min(0, ...ys),
    hiY = Math.max(0.1, ...ys),
    scale = Math.min((width - 100) / (hiX - loX || 1), (height - 90) / (hiY - loY || 1)),
    cx = (loX + hiX) / 2,
    cy = (loY + hiY) / 2;
  return {
    X: (x) => width / 2 + (x - cx) * scale,
    Y: (y) => (height - 25) / 2 - (y - cy) * scale,
    world: (x, y) => [(x - width / 2) / scale + cx, ((height - 25) / 2 - y) / scale + cy],
    scale,
  };
}
export function contourColor(value, lo, hi) {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1))),
    a = t < 0.5 ? [22, 110, 83] : [225, 153, 51],
    b = t < 0.5 ? [225, 153, 51] : [204, 37, 72],
    s = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * s)).join(' ')})`;
}
export function builderVisual(v, index = 0) {
  let drawing = '',
    height = 330;
  const frame = v.frames?.[Math.min(index, v.frames.length - 1)];
  if (v.kind === 'fem') {
    const nodes = v.mesh.nodes,
      displacement = v.displacement ?? Array(nodes.length * 2).fill(0),
      max = Math.max(1e-20, ...displacement.map(Math.abs)),
      span = Math.max(...nodes.map((p) => p[0])) - Math.min(...nodes.map((p) => p[0])),
      factor =
        v.analysis === 'modal'
          ? (Math.sin((2 * Math.PI * index) / 60) * 0.12 * Math.max(span, 0.1)) / max
          : (0.08 * Math.max(span, 0.1)) / max,
      deformed = nodes.map(([x, y], i) => [
        x + factor * displacement[2 * i],
        y + factor * displacement[2 * i + 1],
      ]),
      map = geometryMap([...nodes, ...deformed]),
      rawLo = Math.min(...v.values),
      rawHi = Math.max(...v.values),
      constant = rawHi - rawLo < 1e-10 * Math.max(1, Math.abs(rawHi), Math.abs(rawLo)),
      lo = constant ? Math.min(0, rawLo) : rawLo,
      hi = constant ? Math.max(rawHi, lo + 1e-12) : rawHi;
    v.mesh.triangles.forEach((t, i) => {
      drawing += `<polygon points="${t.map((j) => `${map.X(deformed[j][0])},${map.Y(deformed[j][1])}`).join(' ')}" fill="${contourColor(v.values[i], lo, hi)}" fill-opacity=".7" stroke="var(--border)" stroke-width="1"><title>${escape(`Element ${i}: ${f(v.values[i])} ${v.units}`)}</title></polygon>`;
      if (v.analysis !== 'heat')
        drawing += `<polygon points="${t.map((j) => `${map.X(nodes[j][0])},${map.Y(nodes[j][1])}`).join(' ')}" fill="none" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width=".7"/>`;
    });
    if (v.nodal)
      for (let level = 1; level < 10; level++) {
        const value =
          Math.min(...v.nodal) + ((Math.max(...v.nodal) - Math.min(...v.nodal)) * level) / 10;
        for (const t of v.mesh.triangles) {
          const hits = [];
          for (let i = 0; i < 3; i++) {
            const a = t[i],
              b = t[(i + 1) % 3],
              va = v.nodal[a],
              vb = v.nodal[b];
            if ((va < value && vb >= value) || (vb < value && va >= value)) {
              const r = (value - va) / (vb - va);
              hits.push([
                nodes[a][0] + r * (nodes[b][0] - nodes[a][0]),
                nodes[a][1] + r * (nodes[b][1] - nodes[a][1]),
              ]);
            }
          }
          if (hits.length === 2)
            drawing += line(
              map.X(hits[0][0]),
              map.Y(hits[0][1]),
              map.X(hits[1][0]),
              map.Y(hits[1][1]),
              'var(--text)',
              0.8,
            );
        }
      }
    nodes.forEach(
      (p, i) => (drawing += circle(map.X(deformed[i][0]), map.Y(deformed[i][1]), 3, colors[0])),
    );
    for (let i = 0; i < 20; i++)
      drawing += `<rect x="${110 + i * 15}" y="275" width="15" height="9" fill="${contourColor(lo + ((hi - lo) * i) / 19, lo, hi)}"/>`;
    drawing +=
      text(100, 284, lo, 'var(--muted)', 'end') +
      text(420, 284, hi, 'var(--muted)', 'start') +
      text(
        260,
        310,
        `${v.units} · ${v.analysis === 'heat' ? 'element means + interpolated isolines' : v.analysis === 'modal' ? 'normalized mode; arbitrary amplitude' : 'element stresses; displacement amplified for visibility'}`,
      );
  } else if (v.kind === 'spice') {
    const project = v.project,
      nodes =
        v.nodes ??
        [...new Set(project.components.flatMap((c) => [c.a, c.b, c.gate ?? 0]))].filter(
          (n) => n !== 0,
        ),
      positions = new Map([
        [0, [70, 230]],
        ...nodes.map((n, i) => [n, [90 + (i % 5) * 85, 60 + Math.floor(i / 5) * 80]]),
      ]);
    const layout = [0, ...nodes].map(
        (n) => project.positions?.[n] ?? [5 + 4 * Math.cos(n), 5 + 3 * Math.sin(n)],
      ),
      fit = geometryMap(layout);
    if (project.positions)
      [0, ...nodes].forEach((n, i) => positions.set(n, [fit.X(layout[i][0]), fit.Y(layout[i][1])]));
    for (const c of project.components) {
      const a = positions.get(c.a),
        b = positions.get(c.b);
      if (!a || !b) continue;
      drawing += line(...a, ...b, colors[0]);
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      drawing +=
        `<rect x="${mx - 21}" y="${my - 12}" width="42" height="24" rx="4" fill="var(--surface-2)" stroke="var(--curve)"/>` +
        text(mx, my + 4, c.id);
      if (c.gate !== undefined) {
        const g = positions.get(c.gate);
        drawing += line(...g, mx, my, colors[2], 1.5, 'stroke-dasharray="4 3"');
      }
    }
    for (const [node, p] of positions)
      drawing +=
        circle(...p, 7, node === project.probe ? colors[1] : colors[0]) +
        text(p[0], p[1] - 13, `n${node}`) +
        text(
          p[0],
          p[1] + 24,
          node === 0 ? '0 V' : frame ? `${f(frame.voltages[nodes.indexOf(node)])} V` : '',
        );
    drawing += text(
      260,
      310,
      frame
        ? `t=${f(frame.t)} s · Newton iterations ≤ ${frame.iterations}`
        : 'Graph connectivity, not physical wire placement',
    );
  } else if (v.kind === 'control') {
    const blocks = v.project.blocks,
      positions = new Map(
        blocks.map((b, i) => [
          b.id,
          [b.x ?? 60 + (i % 4) * 170, b.y ?? 60 + Math.floor(i / 4) * 130],
        ]),
      ),
      maxX = Math.max(620, ...[...positions.values()].map((p) => p[0] + 130)),
      maxY = Math.max(300, ...[...positions.values()].map((p) => p[1] + 90));
    height = Math.max(300, (maxY * 520) / maxX + 50);
    const sx = (x) => 20 + (x / maxX) * 480,
      sy = (y) => 15 + (y / maxX) * 480;
    for (const [from, to, port] of v.project.wires) {
      const a = positions.get(from),
        b = positions.get(to);
      drawing += line(
        sx(a[0] + 120),
        sy(a[1] + 25),
        sx(b[0]),
        sy(b[1] + 14 + port * 12),
        'var(--muted)',
        1.5,
      );
    }
    blocks.forEach((b) => {
      const p = positions.get(b.id),
        x = sx(p[0]),
        y = sy(p[1]),
        w = (120 / maxX) * 480,
        h = (60 / maxX) * 480;
      drawing +=
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="var(--surface-2)" stroke="${b.id === v.project.output ? colors[1] : colors[0]}"/>` +
        text(x + w / 2, y + 14, b.id) +
        text(x + w / 2, y + 29, b.type, 'var(--muted)') +
        (frame ? text(x + w / 2, y + h + 15, f(frame.signals[b.id]), colors[1]) : '');
    });
    drawing += text(
      260,
      height - 5,
      frame
        ? `t=${f(frame.t)} s · selected output ${v.project.output}`
        : 'Connect ports with named wires; state breaks feedback dependencies',
    );
  } else if (v.kind === 'mechanism') {
    const p = v.project,
      q = frame?.q ?? p.bodies.flatMap((b) => [b.x, b.y, (b.angle * Math.PI) / 180]),
      world = (id, anchor) => {
        const i = p.bodies.findIndex((b) => b.id === id);
        if (i < 0) return anchor;
        const x = q[3 * i],
          y = q[3 * i + 1],
          a = q[3 * i + 2];
        return [
          x + Math.cos(a) * anchor[0] - Math.sin(a) * anchor[1],
          y + Math.sin(a) * anchor[0] + Math.cos(a) * anchor[1],
        ];
      },
      ends = p.bodies.flatMap((b) => [
        world(b.id, [-(b.length ?? 1) / 2, 0]),
        world(b.id, [(b.length ?? 1) / 2, 0]),
      ]),
      anchors = p.joints.flatMap((j) => [world(j.a, j.anchorA), world(j.b, j.anchorB)]),
      map = geometryMap([...ends, ...anchors]);
    p.bodies.forEach((b, i) => {
      drawing +=
        line(
          map.X(ends[2 * i][0]),
          map.Y(ends[2 * i][1]),
          map.X(ends[2 * i + 1][0]),
          map.Y(ends[2 * i + 1][1]),
          colors[i % 3],
          9,
        ) +
        circle(map.X(q[3 * i]), map.Y(q[3 * i + 1]), 4, 'var(--text)') +
        text(map.X(q[3 * i]), map.Y(q[3 * i + 1]) - 15, b.id);
    });
    p.joints.forEach((j) => {
      const a = world(j.a, j.anchorA);
      drawing += circle(map.X(a[0]), map.Y(a[1]), 7, colors[1], 'var(--surface-1)');
      if (j.a === 'ground' || j.b === 'ground')
        drawing += line(
          map.X(a[0]) - 12,
          map.Y(a[1]) + 12,
          map.X(a[0]) + 12,
          map.Y(a[1]) + 12,
          'var(--muted)',
          3,
        );
    });
    if (frame?.probe)
      drawing += circle(map.X(frame.probe[0]), map.Y(frame.probe[1]), 5, colors[2], colors[2]);
    drawing += text(
      260,
      310,
      frame
        ? `t=${f(frame.t)} s · constraint residual ${f(frame.residual)}`
        : 'Initial assembly · local anchors rotate with their rigid body',
    );
  } else if (v.kind === 'dsa') {
    const f0 = frame ?? v.frames[0];
    if (f0.array) {
      const a = f0.array,
        lo = Math.min(0, ...a),
        hi = Math.max(1, ...a),
        width = 440 / a.length;
      drawing = line(40, 230, 480, 230, 'var(--border)');
      a.forEach((value, i) => {
        const h = ((value - lo) / (hi - lo || 1)) * 170;
        drawing += `<rect x="${40 + i * width}" y="${230 - h}" width="${Math.max(1, width - 2)}" height="${Math.max(1, h)}" fill="${f0.active.includes(i) ? colors[2] : colors[0]}"/>`;
        if (a.length <= 24) drawing += text(40 + (i + 0.5) * width, 250, value);
      });
    } else {
      const n = v.project.nodes.length,
        positions = v.project.nodes.map((_, i) => [
          260 + Math.cos((2 * Math.PI * i) / n) * 190,
          140 + Math.sin((2 * Math.PI * i) / n) * 100,
        ]);
      if (v.project.positions) {
        const raw = v.project.nodes.map(
            (_, i) =>
              v.project.positions[i] ?? [
                5 + 4 * Math.cos((2 * Math.PI * i) / n),
                5 + 3 * Math.sin((2 * Math.PI * i) / n),
              ],
          ),
          fit = geometryMap(raw);
        raw.forEach((p, i) => (positions[i] = [fit.X(p[0]), fit.Y(p[1])]));
      }
      v.project.edges.forEach(([a, b, w]) => {
        const A = positions[a],
          B = positions[b],
          active = f0.edge && f0.edge[0] === a && f0.edge[1] === b,
          accepted = f0.accepted?.some((e) => e[0] === a && e[1] === b);
        drawing += line(
          ...A,
          ...B,
          active ? colors[2] : accepted ? colors[1] : 'var(--border)',
          active ? 3 : 1.5,
        );
        if (n <= 24) drawing += text((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 4, w, 'var(--muted)');
        if (v.project.directed) {
          const dx = B[0] - A[0],
            dy = B[1] - A[1],
            L = Math.hypot(dx, dy) || 1,
            x = B[0] - (dx / L) * 15,
            y = B[1] - (dy / L) * 15;
          drawing +=
            line(
              x,
              y,
              x - (dx / L) * 6 + (dy / L) * 4,
              y - (dy / L) * 6 - (dx / L) * 4,
              'var(--muted)',
            ) +
            line(
              x,
              y,
              x - (dx / L) * 6 - (dy / L) * 4,
              y - (dy / L) * 6 + (dx / L) * 4,
              'var(--muted)',
            );
        }
      });
      positions.forEach(
        (p, i) =>
          (drawing +=
            circle(
              ...p,
              n > 32 ? 7 : 13,
              f0.active?.includes(i) ? colors[2] : f0.visited?.[i] ? colors[1] : colors[0],
            ) +
            text(p[0], p[1] + 4, v.project.nodes[i]) +
            text(p[0], p[1] + 28, f0.distance?.[i] ?? '∞', 'var(--muted)')),
      );
    }
    drawing += text(260, 310, `Step ${index + 1} · ${f0.message}`);
  }
  return { drawing, height };
}
export function builderThumbnail(id) {
  const shapes = {
    spicetransient: 'M50 40h30l8-12 12 24 12-24 12 24 8-12h25m5-20v40m12-40v40m0-20h70',
    fem2d: 'M65 15h170v50H65Zm0 0 85 50 85-50m-85 0v50m-85-50 85 50',
    femmodal: 'M65 15h170v50H65Zm0 0q70-40 170 0M65 65q70-40 170 0',
    femheat: 'M65 15h170v50H65Zm30 0v50m30-50v50m30-50v50m30-50v50m30-50v50',
    controlbuilder: 'M45 40h25m60 0h30m60 0h35m-20 0v30H55V40M70 20h60v40H70Zm90 0h60v40h-60Z',
    mechanismbuilder: 'M65 65 115 15 190 50 235 15M65 65h30m125-50h30',
    dsastudio: 'M65 55 125 15 190 60 240 20M65 55h70m-10-40 115 5',
  };
  return shapes[id]
    ? `<path d="${shapes[id]}" fill="none" stroke="var(--curve)" stroke-width="2"/>`
    : null;
}

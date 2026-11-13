import { escapeHtml as escape } from '../../backend/html.js';
const format = (value) =>
  value === Infinity
    ? '∞'
    : value === -Infinity
      ? '−∞'
      : value === null || value === undefined
        ? '—'
        : String(value);
const color = (item) =>
  item.active
    ? 'var(--load)'
    : item.done
      ? 'var(--result)'
      : item.muted
        ? 'var(--muted)'
        : 'var(--curve)';
const label = (x, y, value, fill = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${fill}">${escape(format(value))}</text>`;

export function renderAdditional(frame, visual, table, caption) {
  const view = frame.view;
  let drawing = '',
    width = 520,
    height = 250;
  if (view.type === 'sequence') {
    const items = view.items;
    width = view.vertical ? 320 : Math.max(520, items.length * 102 + 30);
    height = view.vertical ? Math.max(250, items.length * 65 + 40) : 250;
    if (!items.length) drawing = label(width / 2, 110, 'Empty structure', 'var(--muted)');
    drawing += items
      .map((item, i) => {
        const x = view.vertical ? width / 2 - 42 : 18 + i * 102,
          y = view.vertical ? 20 + (items.length - 1 - i) * 65 : 82;
        const details = String(item.detail ?? '')
          .split(' · ')
          .map((part, line) => label(x + 42, y + 63 + line * 16, part, 'var(--muted)'))
          .join('');
        const box = `<rect x="${x}" y="${y}" width="84" height="46" rx="6" fill="var(--surface-1)" stroke="${color(item)}" stroke-width="2"/>${label(x + 42, y + 28, item.label, color(item))}${details}`;
        return (
          box +
          (view.linked && i < items.length - 1
            ? `<path d="M${x + 86} ${y + 18}h12m-5-4 5 4-5 4${view.double ? `M${x + 98} ${y + 32}h-12m5-4-5 4 5 4` : ''}" fill="none" stroke="var(--muted)"/>`
            : '')
        );
      })
      .join('');
  } else if (view.type === 'tree') {
    const children = new Map(view.nodes.map((n) => [n.id, []])),
      positions = new Map();
    view.edges.forEach(([from, to]) => children.get(from).push(to));
    let cursor = 0,
      maxDepth = 0;
    const place = (id, depth) => {
      const list = children.get(id);
      maxDepth = Math.max(maxDepth, depth);
      if (!list.length) {
        positions.set(id, [55 + cursor++ * 100, 50 + depth * 100]);
        return;
      }
      list.forEach((child) => place(child, depth + 1));
      positions.set(id, [
        (positions.get(list[0])[0] + positions.get(list.at(-1))[0]) / 2,
        50 + depth * 100,
      ]);
    };
    view.roots.forEach((root, i) => {
      if (i) cursor++;
      place(root, 0);
    });
    width = Math.max(520, cursor * 100 + 30);
    height = Math.max(250, 110 + maxDepth * 100);
    const dx = (width - Math.max(100, cursor * 100 + 30)) / 2;
    for (const [id, [x, y]] of positions) positions.set(id, [x + dx, y]);
    drawing = view.edges
      .map(([from, to, edgeLabel]) => {
        const [x, y] = positions.get(from),
          [a, b] = positions.get(to);
        return `<path d="M${x} ${y + 22}L${a} ${b - 22}" stroke="var(--border)" stroke-width="2"/>${edgeLabel === undefined ? '' : label((x + a) / 2 + (a < x ? -9 : 9), (y + b) / 2, edgeLabel, 'var(--muted)')}`;
      })
      .join('');
    drawing += view.nodes
      .map((item) => {
        const [x, y] = positions.get(item.id);
        return `<circle cx="${x}" cy="${y}" r="23" fill="var(--surface-1)" stroke="${color(item)}" stroke-width="2"/>${label(x, y + 5, item.label, color(item))}${label(x, y + 45, item.detail, 'var(--muted)')}`;
      })
      .join('');
    if (!view.nodes.length) drawing = label(width / 2, 110, 'Empty tree', 'var(--muted)');
  } else if (view.type === 'hash') {
    width = Math.max(520, 130 + 95 * Math.max(1, ...view.buckets.map((b) => b.length)));
    height = Math.max(250, view.buckets.length * 58 + 30);
    drawing = view.buckets
      .map(
        (bucket, i) =>
          `${label(45, 43 + i * 58, `h=${i}`, view.active === i ? 'var(--load)' : 'var(--muted)')}${bucket.length ? bucket.map((value, j) => `<rect x="${90 + j * 95}" y="${18 + i * 58}" width="72" height="38" rx="5" fill="var(--surface-1)" stroke="${view.active === i ? 'var(--load)' : 'var(--curve)'}"/>${label(126 + j * 95, 43 + i * 58, value)}${j < bucket.length - 1 ? `<path d="M${164 + j * 95} ${37 + i * 58}h18m-5-4 5 4-5 4" fill="none" stroke="var(--muted)"/>` : ''}`).join('') : label(125, 43 + i * 58, '∅', 'var(--muted)')}`,
      )
      .join('');
  } else if (view.type === 'network') {
    const coordinates = [
      [55, 110],
      [195, 50],
      [195, 185],
      [350, 50],
      [350, 185],
      [500, 110],
    ];
    width = 555;
    height = 245;
    drawing = `<defs><marker id="advanced-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>`;
    drawing += view.edges
      .map((e) => {
        const [x, y] = coordinates[e.from],
          [a, b] = coordinates[e.to],
          length = Math.hypot(a - x, b - y),
          dx = (a - x) / length,
          dy = (b - y) / length;
        const selected = view.selected.includes(`${e.from},${e.to}`),
          stroke = selected ? 'var(--result)' : 'var(--muted)';
        const offset =
            view.directed && view.edges.some((other) => other.from === e.to && other.to === e.from)
              ? 7
              : 0,
          ox = -dy * offset,
          oy = dx * offset;
        return `<path d="M${x + dx * 23 + ox} ${y + dy * 23 + oy}L${a - dx * 25 + ox} ${b - dy * 25 + oy}" stroke="${stroke}" stroke-width="${selected ? 3 : 1.6}" ${view.directed ? 'marker-end="url(#advanced-arrow)"' : ''}/>${label((x + a) / 2 + ox, (y + b) / 2 - 7 + oy, e.weight, stroke)}`;
      })
      .join('');
    drawing += coordinates
      .map(
        ([x, y], i) =>
          `<circle cx="${x}" cy="${y}" r="21" fill="var(--surface-1)" stroke="${view.active.includes(i) ? 'var(--load)' : view.visited.includes(i) ? 'var(--result)' : 'var(--curve)'}" stroke-width="2"/>${label(x, y + 5, i)}${view.groups?.[i] === null || view.groups?.[i] === undefined ? '' : label(x, y + 39, `C${view.groups[i]}`, 'var(--result)')}`,
      )
      .join('');
  } else if (view.type === 'text') {
    width = Math.max(520, 34 * Math.max(view.text.length, view.pattern.length + view.offset) + 40);
    height = 250;
    const chars = (s, y, offset, active, isText) =>
      [...s]
        .map((c, i) => {
          const match = isText && view.matches.some((m) => i >= m && i < m + view.pattern.length);
          const stroke = active.includes(i)
              ? 'var(--load)'
              : match
                ? 'var(--result)'
                : 'var(--curve)',
            x = 20 + (offset + i) * 34;
          return `<rect x="${x}" y="${y}" width="30" height="38" rx="3" fill="var(--surface-1)" stroke="${stroke}"/>${label(x + 15, y + 24, c === ' ' ? '␠' : c, stroke)}${isText ? label(x + 15, y - 10, i, 'var(--muted)') : ''}`;
        })
        .join('');
    drawing =
      label(20, 35, 'TEXT', 'var(--muted)', 'start') +
      chars(view.text, 75, 0, view.active, true) +
      label(20, 155, 'PATTERN', 'var(--muted)', 'start') +
      chars(view.pattern, 175, view.offset, view.patternActive, false);
  } else if (view.type === 'matrix') {
    width = Math.max(520, (view.columnLabels.length + 1) * 42 + 20);
    height = Math.max(250, (view.rowLabels.length + 1) * 38 + 20);
    drawing =
      view.columnLabels.map((v, j) => label(83 + j * 42, 30, v, 'var(--muted)')).join('') +
      view.matrix
        .map(
          (row, i) =>
            label(30, 68 + i * 38, view.rowLabels[i], 'var(--muted)') +
            row
              .map((v, j) => {
                const active = view.cell[0] === i && view.cell[1] === j;
                return `<rect x="${64 + j * 42}" y="${44 + i * 38}" width="39" height="35" rx="3" fill="${active ? 'var(--selection)' : 'var(--surface-1)'}" stroke="${active ? 'var(--load)' : 'var(--border)'}"/>${label(83 + j * 42, 68 + i * 38, v, active ? 'var(--load)' : 'var(--text)')}`;
              })
              .join(''),
        )
        .join('');
  } else if (view.type === 'grid') {
    width = 520;
    height = Math.max(250, Math.ceil(view.items.length / 10) * 46 + 40);
    drawing = view.items
      .map((item, i) => {
        const x = 15 + (i % 10) * 49,
          y = 20 + Math.floor(i / 10) * 46;
        return `<rect x="${x}" y="${y}" width="42" height="36" rx="4" fill="var(--surface-1)" stroke="${color(item)}" opacity="${item.muted && !item.active ? 0.5 : 1}"/>${label(x + 21, y + 24, item.label, color(item))}${item.muted ? `<path d="M${x + 5} ${y + 30}l30-24" stroke="var(--muted)" opacity=".4"/>` : ''}`;
      })
      .join('');
  }
  visual.innerHTML = `<svg class="advanced-diagram" style="min-width:${width}px;height:${height}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(frame.message)}">${drawing}</svg>`;
  const data = frame.stateTable;
  table(
    data.headers,
    data.rows.map((row) => row.map(format)),
    data.caption,
    data.active ?? [],
  );
  caption.textContent = `${data.caption}. Amber highlights the active step; green marks selected or completed state. Use the table for all values and links.`;
}

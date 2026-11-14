export function tornadoPlot(
  rows: { key: string; low: number; high: number }[],
  baseline: number,
  metric: string,
) {
  const figure = document.createElement('figure'),
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const height = 90 + rows.length * 44,
    max = Math.max(
      1e-30,
      ...rows.flatMap((row) => [Math.abs(row.low - baseline), Math.abs(row.high - baseline)]),
    ),
    x = (value: number) => 440 + (245 * value) / max;
  svg.setAttribute('viewBox', `0 0 720 ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${metric} sensitivity tornado: output changes relative to baseline ${baseline}`,
  );
  const add = (tag: string, attributes: Record<string, string>, text?: string) => {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    node.textContent = text ?? '';
    svg.append(node);
    return node;
  };
  for (let i = -2; i <= 2; i++) {
    const value = (max * i) / 2,
      px = x(value);
    add('path', {
      d: `M${px} 25V${height - 35}`,
      stroke: i === 0 ? 'var(--muted)' : 'var(--grid)',
    });
    add(
      'text',
      {
        x: String(px),
        y: String(height - 15),
        'text-anchor': 'middle',
        fill: 'var(--muted)',
        'font-size': '12',
      },
      value.toPrecision(3),
    );
  }
  rows.forEach((row, i) => {
    const y = 35 + i * 44;
    add(
      'text',
      { x: '8', y: String(y + 15), fill: 'var(--text)', 'font-size': '12' },
      row.key.slice(0, 25),
    );
    for (const [j, value] of [row.low, row.high].entries()) {
      const delta = value - baseline;
      const rect = add('rect', {
          x: String(Math.min(x(0), x(delta))),
          y: String(y + j * 13),
          width: String(Math.max(1, Math.abs(x(delta) - x(0)))),
          height: '11',
          fill: j ? 'var(--result)' : 'var(--curve)',
          rx: '2',
        }),
        title = document.createElementNS(svg.namespaceURI, 'title');
      title.textContent = `${row.key}: ${j ? 'high' : 'low'} input bound gives ${value.toPrecision(6)}, Δ=${delta.toPrecision(6)}`;
      rect.append(title);
    }
  });
  const caption = document.createElement('figcaption');
  caption.textContent = `Δ ${metric} from baseline ${baseline.toPrecision(6)}. Blue: low input bound; green: high input bound. Other inputs remain fixed.`;
  figure.append(svg, caption);
  return figure;
}

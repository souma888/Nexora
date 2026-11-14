export type XY = { x: number; y: number | null };
export function analysisPlot(
  curves: { label: string; points: XY[] }[],
  xLabel = 'x',
  yLabel = 'y',
) {
  const host = document.createElement('figure'),
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 720 280');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `${yLabel} against ${xLabel}: ${curves.map((c) => c.label).join(', ')}`,
  );
  const points = curves
    .flatMap((c) => c.points)
    .filter((p) => Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y));
  if (!points.length) {
    host.textContent = 'No finite plot data.';
    return host;
  }
  const xmin = Math.min(...points.map((p) => p.x)),
    xmax = Math.max(...points.map((p) => p.x)),
    ymin = Math.min(...points.map((p) => p.y!)),
    ymax = Math.max(...points.map((p) => p.y!));
  const px = (x: number) => 65 + (625 * (x - xmin)) / (xmax - xmin || 1),
    py = (y: number) => 225 - (195 * (y - ymin)) / (ymax - ymin || 1);
  const add = (tag: string, attributes: Record<string, string>, text?: string) => {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [k, v] of Object.entries(attributes)) node.setAttribute(k, v);
    node.textContent = text ?? '';
    svg.append(node);
    return node;
  };
  for (let i = 0; i <= 4; i++) {
    const y = ymin + ((ymax - ymin) * i) / 4,
      x = xmin + ((xmax - xmin) * i) / 4;
    add('path', { d: `M65 ${py(y)}H690 M${px(x)} 30V225`, stroke: 'var(--grid)', fill: 'none' });
    add(
      'text',
      {
        x: '58',
        y: String(py(y) + 4),
        'text-anchor': 'end',
        fill: 'var(--muted)',
        'font-size': '12',
      },
      y.toPrecision(3),
    );
    add(
      'text',
      {
        x: String(px(x)),
        y: '248',
        'text-anchor': 'middle',
        fill: 'var(--muted)',
        'font-size': '12',
      },
      x.toPrecision(3),
    );
  }
  const colors = ['var(--curve)', 'var(--result)', 'var(--load)'];
  curves.forEach((c, i) => {
    let gap = true;
    const d = c.points
      .map((p) => {
        if (p.y === null || !Number.isFinite(p.y)) {
          gap = true;
          return '';
        }
        const command = gap ? 'M' : 'L';
        gap = false;
        return `${command}${px(p.x)},${py(p.y)}`;
      })
      .join(' ');
    add('path', {
      d,
      stroke: colors[i % colors.length],
      fill: 'none',
      'stroke-width': '2.5',
      ...(i ? { 'stroke-dasharray': '7 3' } : {}),
    });
  });
  const caption = document.createElement('figcaption');
  caption.textContent = `${xLabel} → ${yLabel}. ${curves.map((c) => c.label).join(' / ')}`;
  const probe = document.createElement('input'),
    readout = document.createElement('output');
  probe.type = 'range';
  probe.min = '0';
  probe.max = String(curves[0].points.length - 1);
  probe.value = '0';
  probe.setAttribute('aria-label', 'Inspect analysis plot point');
  const inspect = () => {
    const p = curves[0].points[Number(probe.value)];
    readout.textContent = p
      ? `${xLabel}: ${p.x.toPrecision(5)}; ${yLabel}: ${p.y?.toPrecision(5) ?? 'undefined'}`
      : '';
  };
  probe.oninput = inspect;
  inspect();
  host.append(svg, caption, probe, readout);
  return host;
}

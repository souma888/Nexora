type Sample = { x: number; shear: number; moment: number; deflection: number; slope: number };
const tracks = [
  { key: 'shear', label: 'Shear V', unit: 'kN' },
  { key: 'moment', label: 'Moment M', unit: 'kN·m' },
  { key: 'deflection', label: 'Deflection δ', unit: 'mm' },
  { key: 'slope', label: 'Slope θ', unit: 'mrad' },
] as const;
const svg = document.querySelector<SVGSVGElement>('#plot')!;
const probe = document.querySelector<HTMLInputElement>('#probe')!;
const position = document.querySelector<HTMLOutputElement>('#probe-position')!;
const readout = document.querySelector<HTMLOutputElement>('#probe-values')!;
const tooltip = document.querySelector<HTMLElement>('#plot-tooltip')!;
const format = (n: number) => Math.abs(n) >= 10000 || (n && Math.abs(n) < 0.01)
  ? n.toExponential(1) : Number(n.toFixed(2)).toString();
const left = 58;
let right = 606;
let series: Sample[] = [];
let selected = 40;
const xAt = (x: number) => left + x / series.at(-1)!.x * (right - left);

function inspect(index: number) {
  selected = index;
  probe.value = String(index);
  const sample = series[index];
  const prior = series[index - 1];
  const next = series[index + 1];
  const side = prior?.x === sample.x ? ' (right)' : next?.x === sample.x ? ' (left)' : '';
  const label = `x = ${format(sample.x)} m${side}`;
  position.textContent = label;
  probe.setAttribute('aria-valuetext', label);
  readout.textContent = `${label}  ·  ${tracks.map(({ key, label, unit }) =>
    `${label.split(' ').at(-1)} ${format(sample[key])} ${unit}`).join('  ·  ')}`;
  const line = svg.querySelector('line.crosshair')!;
  line.setAttribute('x1', String(xAt(sample.x)));
  line.setAttribute('x2', String(xAt(sample.x)));
}

export function drawBeamCharts(points: Sample[]) {
  series = points;
  // Keep plot labels at a readable scale without a size jump near 450px.
  const width = Math.max(380, Math.min(640, Math.round(svg.clientWidth)));
  right = width - 34;
  svg.setAttribute('viewBox', `0 0 ${width} 524`);
  const span = series.at(-1)!.x;
  probe.max = String(series.length - 1);
  svg.innerHTML = tracks.map(({ key, label, unit }, index) => {
    const top = index * 124 + 29;
    const bottom = top + 78;
    const values = series.map(point => point[key]);
    const low = Math.min(0, ...values), high = Math.max(0, ...values);
    const yAt = (y: number) => bottom - (y - low) / (high - low || 1) * (bottom - top);
    const peak = series.reduce((best, point) => Math.abs(point[key]) > Math.abs(best[key]) ? point : best);
    const peakX = xAt(peak.x);
    const peakY = yAt(peak[key]);
    const color = key === 'moment' && peak[key] < 0 ? 'var(--hogging)' : 'var(--curve)';
    const curve = series.map(point => `${xAt(point.x)},${yAt(point[key])}`).join(' ');
    const grid = Array.from({ length: 5 }, (_, i) => {
      const x = xAt(span * i / 4);
      return `<path class="plot-grid" d="M${x} ${top}V${bottom}"/>`;
    }).join('');
    const peakLabel = `${format(peak[key])} ${unit} @ ${format(peak.x)} m`;
    return `<g>
      <text class="track-title" x="${left}" y="${top - 11}">${label} · ${unit}</text>
      <text class="track-peak" x="${right}" y="${top - 11}" text-anchor="end">Peak ${peakLabel}</text>
      ${grid}<path class="plot-grid" d="M${left} ${top}H${right} M${left} ${bottom}H${right}"/>
      <path class="plot-zero" d="M${left} ${yAt(0)}H${right}"/>
      <text x="${left - 7}" y="${top + 4}" text-anchor="end">${format(high)}</text>
      <text x="${left - 7}" y="${bottom + 4}" text-anchor="end">${format(low)}</text>
      <polyline class="beam-curve" points="${curve}" fill="none" stroke="${color}" stroke-width="2.3" vector-effect="non-scaling-stroke"/>
      <circle cx="${peakX}" cy="${peakY}" r="4" fill="${color}" stroke="var(--plot-bg)"><title>Peak ${peakLabel}</title></circle>
    </g>`;
  }).join('') + Array.from({ length: 5 }, (_, i) => {
    const x = span * i / 4;
    return `<text x="${xAt(x)}" y="505" text-anchor="middle">${format(x)} m</text>`;
  }).join('') + '<line class="crosshair" y1="29" y2="479"/>';
  inspect(Math.min(selected, series.length - 1));
}

probe.addEventListener('input', () => { if (series.length) inspect(Number(probe.value)); });
svg.addEventListener('pointermove', event => {
  const matrix = svg.getScreenCTM();
  if (!matrix || !series.length) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const span = series.at(-1)!.x;
  const x = (point.x - left) / (right - left) * span;
  const nearest = series.reduce((best, current, i) =>
    Math.abs(current.x - x) < Math.abs(series[best].x - x) ||
    (current.x === series[best].x && x >= current.x) ? i : best, 0);
  inspect(nearest);
  tooltip.textContent = readout.textContent;
  tooltip.hidden = false;
});
svg.addEventListener('pointerleave', () => { tooltip.hidden = true; });

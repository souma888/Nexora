import { setMetric, setupWorkbench } from './workbench.js';

const byId = id => document.getElementById(id);
const form = byId('beam-form');
const plotButtons = document.querySelectorAll('[data-plot]');
const fmt = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });
const format = n => n && Math.abs(n) < 0.001 ? n.toExponential(2) : fmt.format(n || 0);
const quantities = {
  moment: { name: 'Bending moment', symbol: 'M', unit: 'kN·m' },
  shear: { name: 'Shear force', symbol: 'V', unit: 'kN' },
  deflection: { name: 'Deflection', symbol: 'δ', unit: 'mm' },
  slope: { name: 'Slope', symbol: 'θ', unit: 'mrad' },
};
const equations = {
  point: 'Center load P: Rₐ = Rᵦ = P/2, Mmax = PL/4, δmid = −PL³/(48EI).',
  uniform: 'Uniform load w: Rₐ = Rᵦ = wL/2, Mmax = wL²/8, δmid = −5wL⁴/(384EI).',
  cantilever: 'Tip load P: Rₐ = P, internal moment at the fixed end = −PL, δtip = −PL³/(3EI).',
};
let result;
let plotKey = 'moment';

function readInput() {
  const input = Object.fromEntries(new FormData(form));
  for (const key of ['span', 'load', 'modulus', 'inertia']) input[key] = Number(input[key]);
  return input;
}

function diagram(input) {
  const uniform = input.case === 'uniform';
  const fixed = input.case === 'cantilever';
  const right = 480;
  const left = 100;
  const center = (left + right) / 2;
  const arrow = (x, y1, y2, marker) =>
    `<path d="M${x} ${y1}V${y2}" stroke="var(--${marker})" stroke-width="2" marker-end="url(#${marker})"/>`;
  const support = (x, roller = false) => `
    <path d="M${x} 108l-14 21h28z" fill="#27352c" stroke="#9eb0a1"/>
    ${roller ? `<circle cx="${x - 7}" cy="133" r="3" fill="none" stroke="#9eb0a1"/>
    <circle cx="${x + 7}" cy="133" r="3" fill="none" stroke="#9eb0a1"/>` : ''}
    <path d="M${x - 20} ${roller ? 137 : 130}h40" stroke="#9eb0a1"/>`;
  const loadX = fixed ? right : center;
  const loads = uniform
    ? `<path d="M${left} 56H${right}" stroke="var(--red)" stroke-width="2"/>
       ${Array.from({ length: 9 }, (_, i) => arrow(left + (right - left) * i / 8, 56, 96, 'red')).join('')}`
    : arrow(loadX, 53, 96, 'red');
  byId('beam-diagram').innerHTML = `
    <defs>${['red', 'green'].map(color => `<marker id="${color}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M0 0l8 4-8 4z" fill="var(--${color})"/></marker>`).join('')}</defs>
    <text class="load-label" x="${loadX}" y="39" text-anchor="middle">${format(input.load)} ${uniform ? 'kN/m' : 'kN'}</text>
    ${loads}
    <rect x="${left}" y="100" width="${right - left}" height="8" rx="2" fill="#a6baaa"/>
    ${fixed ? `<path d="M100 74v56M89 84l11-10M89 95l11-10M89 106l11-10M89 117l11-10M89 128l11-10" stroke="#a6baaa" fill="none"/>
      <path d="M76 82a20 20 0 0 0 0 35" fill="none" stroke="var(--green)" stroke-width="2" marker-end="url(#green)"/>
      <text class="reaction-label" x="58" y="104" text-anchor="end">Mₐ</text>` : support(left) + support(right, true)}
    ${arrow(left, 167, 143, 'green')}<text class="reaction-label" x="88" y="164" text-anchor="end">Rₐ</text>
    ${fixed ? '' : arrow(right, 167, 143, 'green') + '<text class="reaction-label" x="492" y="164">Rᵦ</text>'}
    <path d="M100 177v18m380-18v18M100 186h380" stroke="#708478" fill="none"/>
    <rect x="232" y="175" width="116" height="21" rx="3" fill="var(--drawing)"/>
    <text x="290" y="190" text-anchor="middle">L = ${format(input.span)} m</text>
    <text x="100" y="218" text-anchor="middle">A</text><text x="480" y="218" text-anchor="middle">B</text>`;
  const supportType = fixed ? 'Cantilever' : 'Simply supported';
  const loadType = uniform ? 'uniform load' : fixed ? 'tip point load' : 'center point load';
  byId('support-type').textContent = supportType;
  byId('beam-diagram').setAttribute('aria-label', `${supportType}, ${loadType}, span ${input.span} metres`);
}

function drawPlot() {
  if (!result) return;
  const { series, input } = result;
  const { name, symbol, unit } = quantities[plotKey];
  const svg = byId('plot');
  const width = svg.clientWidth < 500 ? 410 : 700;
  svg.setAttribute('viewBox', `0 0 ${width} 244`);
  const values = series.map(point => point[plotKey]);
  const peak = series.reduce((a, b) => Math.abs(a[plotKey]) >= Math.abs(b[plotKey]) ? a : b);
  const magnitude = Math.abs(peak[plotKey]);
  const tied = series.filter(point => Math.abs(Math.abs(point[plotKey]) - magnitude) <= magnitude * 1e-12);
  const position = tied.length === series.length ? 'throughout the span'
    : tied.length === 2 && tied[0].x === 0 && tied[1].x === input.span ? 'at both supports'
    : tied.length > 1 ? `first reached at x = ${format(peak.x)} m` : `at x = ${format(peak.x)} m`;
  byId('plot-peak').textContent = `Peak magnitude ${format(magnitude)} ${unit} · ${position}`;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const left = 70, right = width - 24, top = 19, bottom = 200;
  const x = value => left + value / input.span * (right - left);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);
  const baseline = y(0);
  const curve = series.map(point => `${x(point.x).toFixed(2)},${y(point[plotKey]).toFixed(2)}`).join(' ');
  const tick = i => min + (max - min) * i / 4;
  byId('plot-label').textContent = `${symbol}(x) / ${unit}`;
  svg.setAttribute('aria-label', `${name} along the span, in ${unit}. Values range from ${format(min)} to ${format(max)}.`);
  svg.innerHTML = `
    ${Array.from({ length: 5 }, (_, i) => `
      <path d="M${left} ${y(tick(i))}H${right} M${x(input.span * i / 4)} ${top}V${bottom}" stroke="#39463c"/>
      <text x="${left - 8}" y="${y(tick(i)) + 4}" text-anchor="end">${format(tick(i))}</text>
      <text x="${x(input.span * i / 4)}" y="221" text-anchor="middle">${format(input.span * i / 4)}</text>`).join('')}
    <path d="M${left} ${baseline}H${right}" stroke="#718877"/>
    <polygon points="${left},${baseline} ${curve} ${right},${baseline}" fill="#578766" opacity=".23"/>
    <polyline points="${curve}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="${(left + right) / 2}" y="241" text-anchor="middle">Position x (m)</text>`;
}

function renderResults(data) {
  result = data;
  const { summary } = data;
  const metrics = [
    ['reaction-a', summary.reactionA, 'kN'],
    ['reaction-b', summary.reactionB, 'kN'],
    ['peak-moment', summary.moment, 'kN·m'],
    ['peak-deflection', summary.deflection, 'mm'],
  ];
  for (const [id, value, unit] of metrics) setMetric(id, value === null ? '—' : format(value), value === null ? '' : unit);
  byId('equation').textContent = equations[data.input.case];
  drawPlot();
}

function syncSetup() {
  const input = readInput();
  const uniform = input.case === 'uniform';
  byId('load-symbol').textContent = uniform ? 'w' : 'P';
  byId('load-unit').textContent = uniform ? 'kN/m' : 'kN';
  diagram(input);
}

const { analyze, edited } = setupWorkbench({
  form, endpoint: '/api/beam', payload: readInput, render: renderResults,
  onEdit(dirty) { byId('export').disabled = !result || dirty; },
  onReset: syncSetup,
});
form.addEventListener('input', syncSetup);
byId('load-example').addEventListener('click', () => {
  const selected = readInput().case;
  form.reset();
  form.elements.case.value = selected;
  syncSetup();
  edited();
  analyze();
  byId('results').scrollIntoView();
});
for (const button of plotButtons) button.addEventListener('click', () => {
  plotKey = button.dataset.plot;
  for (const option of plotButtons) option.setAttribute('aria-pressed', String(option === button));
  drawPlot();
});
byId('export').addEventListener('click', () => {
  const rows = result.series.map(({ x, shear, moment, deflection, slope }) => [x, shear, moment, deflection, slope].join(','));
  const csv = ['position_m,shear_kN,moment_kNm,deflection_mm,slope_mrad', ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `nexora-beam-${result.input.case}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function syncNavigation() {
  const section = ['#results', '#model'].includes(location.hash) ? location.hash : '#main';
  if (section === '#model') byId('model').open = true;
  for (const link of document.querySelectorAll('.nav-link[href^="#"]')) {
    if (link.hash === section) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', syncNavigation);
document.querySelector('.nav-link[href="#model"]').addEventListener('click', () => { byId('model').open = true; });
window.addEventListener('resize', drawPlot);
syncNavigation();
syncSetup();
analyze();

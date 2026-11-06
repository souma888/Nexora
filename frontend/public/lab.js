import { readFields, setMetric, setupWorkbench } from './workbench.ts';
import { drawBeamCharts } from './beam-charts.ts';
import { definition, solveBeam } from '../../backend/beam.js';
import { validate } from '../../backend/contract.js';

const byId = id => document.getElementById(id);
const form = byId('beam-form');
const spanUnits = byId('span-units');
const loadUnits = byId('load-units');
const exaggeration = byId('exaggeration');
let spanFactor = 1;
let loadFactor = 1;
const fmt = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });
const format = n => n && Math.abs(n) < 0.001 ? n.toExponential(2) : fmt.format(n || 0);
const equations = {
  point: 'Center load P: Rₐ = Rᵦ = P/2, Mmax = PL/4, δmid = −PL³/(48EI).',
  uniform: 'Uniform load w: Rₐ = Rᵦ = wL/2, Mmax = wL²/8, δmid = −5wL⁴/(384EI).',
  cantilever: 'Tip load P: Rₐ = P, internal moment at the fixed end = −PL, δtip = −PL³/(3EI).',
};
let result;

function readInput() {
  const input = readFields(form);
  for (const [key, factor] of [['span', spanFactor], ['load', loadFactor]]) {
    const value = input[key] / factor;
    const { min, max } = definition.inputs[key];
    input[key] = Math.abs(value - min) < 1e-12 ? min : Math.abs(value - max) < 1e-12 ? max : value;
  }
  return input;
}

function diagram({ input, series, summary }) {
  const uniform = input.case === 'uniform';
  const fixed = input.case === 'cantilever';
  const right = 480;
  const left = 100;
  const center = (left + right) / 2;
  const arrow = (x, y1, y2, marker) =>
    `<path d="M${x} ${y1}V${y2}" stroke="var(--${marker})" stroke-width="2" marker-end="url(#beam-${marker}-arrow)"/>`;
  const support = (x, roller = false) => `
    <path d="M${x} 108l-14 21h28z" fill="var(--surface-2)" stroke="var(--muted)"/>
    ${roller ? `<circle cx="${x - 7}" cy="133" r="3" fill="none" stroke="var(--muted)"/>
    <circle cx="${x + 7}" cy="133" r="3" fill="none" stroke="var(--muted)"/>` : ''}
    <path d="M${x - 20} ${roller ? 137 : 130}h40" stroke="var(--muted)"/>`;
  const loadX = fixed ? right : center;
  const displayUnit = loadUnits.value === 'us' ? (uniform ? 'lbf/ft' : 'lbf') : (uniform ? 'kN/m' : 'kN');
  const factor = Number(exaggeration.value);
  const peakPixels = Math.abs(summary.deflection) * (right - left) / (1000 * input.span);
  const actualFactor = Math.min(factor, 40 / peakPixels);
  const shape = series.map(point => [
    left + point.x / input.span * (right - left),
    104 - point.deflection * actualFactor * (right - left) / (1000 * input.span),
  ].join(',')).join(' ');
  byId('exaggeration-value').textContent = actualFactor < factor
    ? `${format(actualFactor)}× (fit)` : `${factor}×`;
  const loads = uniform
    ? `<path d="M${left} 56H${right}" stroke="var(--load)" stroke-width="2"/>
       ${Array.from({ length: 9 }, (_, i) => arrow(left + (right - left) * i / 8, 56, 96, 'load')).join('')}`
    : arrow(loadX, 53, 96, 'load');
  byId('beam-diagram').innerHTML = `
    <defs>${['load', 'result'].map(color => `<marker id="beam-${color}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
    <path d="M0 0l8 4-8 4z" fill="var(--${color})"/></marker>`).join('')}</defs>
    <text class="load-label" x="${loadX}" y="39" text-anchor="middle">${format(input.load * loadFactor)} ${displayUnit}</text>
    ${loads}
    <rect x="${left}" y="100" width="${right - left}" height="8" rx="2" fill="var(--text)"/>
    ${fixed ? `<path d="M100 74v56M89 84l11-10M89 95l11-10M89 106l11-10M89 117l11-10M89 128l11-10" stroke="var(--text)" fill="none"/>
      <path d="M76 82a20 20 0 0 0 0 35" fill="none" stroke="var(--result)" stroke-width="2" marker-end="url(#beam-result-arrow)"/>
      <text class="reaction-label" x="58" y="104" text-anchor="end">Mₐ</text>` : support(left) + support(right, true)}
    ${arrow(left, 167, 143, 'result')}<text class="reaction-label" x="88" y="164" text-anchor="end">Rₐ</text>
    ${fixed ? '' : arrow(right, 167, 143, 'result') + '<text class="reaction-label" x="492" y="164">Rᵦ</text>'}
    <polyline points="${shape}" fill="none" stroke="var(--curve)" stroke-width="2.5" stroke-dasharray="6 4"/>
    <path d="M100 177v18m380-18v18M100 186h380" stroke="var(--muted)" fill="none"/>
    <rect x="232" y="175" width="116" height="21" rx="3" fill="var(--plot-bg)"/>
    <text x="290" y="190" text-anchor="middle">L = ${format(input.span * spanFactor)} ${spanUnits.value}</text>
    <text x="100" y="218" text-anchor="middle">A</text><text x="480" y="218" text-anchor="middle">B</text>`;
  const supportType = fixed ? 'Cantilever' : 'Simply supported';
  const loadType = uniform ? 'uniform load' : fixed ? 'tip point load' : 'center point load';
  byId('support-type').textContent = supportType;
  byId('beam-diagram').setAttribute('aria-label', `${supportType}, ${loadType}, span ${input.span} metres`);
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
  diagram(data);
  drawBeamCharts(data.series);
}

function syncUnits(preserve) {
  const values = preserve ? readInput() : undefined;
  const uniform = form.elements.case.value === 'uniform';
  spanFactor = spanUnits.value === 'ft' ? 1 / 0.3048 : 1;
  loadFactor = loadUnits.value === 'us' ? (uniform ? 224.80894387096 * 0.3048 : 224.80894387096) : 1;
  const loadUnit = loadUnits.value === 'us' ? (uniform ? 'lbf/ft' : 'lbf') : (uniform ? 'kN/m' : 'kN');
  byId('span').nextElementSibling.textContent = spanUnits.value;
  byId('load-symbol').textContent = uniform ? 'w' : 'P';
  byId('load-unit').textContent = loadUnit;
  loadUnits.options[0].textContent = uniform ? 'kN/m' : 'kN';
  loadUnits.options[1].textContent = uniform ? 'lbf/ft' : 'lbf';
  for (const [key, factor] of [['span', spanFactor], ['load', loadFactor]]) {
    const field = byId(key);
    field.min = definition.inputs[key].min * factor;
    field.max = definition.inputs[key].max * factor;
    if (values && field.value !== '') field.value = values[key] * factor;
  }
}

const { analyze, reset } = setupWorkbench({
  form, model: { definition, solve: solveBeam }, validate, payload: readInput, render: renderResults,
  onReset: () => syncUnits(false),
});
for (const control of [spanUnits, loadUnits]) {
  control.addEventListener('change', () => { syncUnits(true); analyze(); });
}
form.addEventListener('input', event => {
  if (event.target.name === 'case') syncUnits(true);
});
exaggeration.addEventListener('input', () => { if (result) diagram(result); });
byId('load-example').addEventListener('click', () => {
  const selected = form.elements.case.value;
  reset();
  form.elements.case.value = selected;
  syncUnits(false);
  analyze();
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
new ResizeObserver(() => {
  if (result) drawBeamCharts(result.series);
}).observe(byId('plot').parentElement);
syncUnits(false);
analyze();
byId('export').disabled = false;

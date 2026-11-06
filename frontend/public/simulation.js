import { readFields, setMetric, setupWorkbench } from './workbench.ts';
import { models } from '../../backend/waves.js';
import { validate } from '../../backend/contract.js';

const byId = id => document.getElementById(id);
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const format = value => value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 100000)
  ? value.toExponential(2) : formatter.format(value || 0);
const disciplines = {
  civil: 'Civil engineering',
  mechanical: 'Mechanical engineering',
  electrical: 'Electrical engineering',
  electronics: 'Electronics',
  signals: 'Signals & systems',
};

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function drawPlot(definition, { series, units }) {
  const plot = byId('wave-plot');
  const width = plot.clientWidth < 420 ? 380 : 480;
  plot.setAttribute('viewBox', `0 0 ${width} 265`);
  const left = 69, right = width - 36, top = 22, bottom = 226;
  const lowX = series[0].x;
  const highX = series.at(-1).x;
  const traces = Object.keys(definition.plot.traces);
  const values = series.flatMap(point => traces.map(trace => point[trace]).filter(Number.isFinite));
  const lowY = Math.min(0, ...values);
  const highY = Math.max(0, ...values);
  const yRange = highY - lowY || 1;
  const xAt = x => left + (x - lowX) / (highX - lowX) * (right - left);
  const yAt = y => bottom - (y - lowY) / yRange * (bottom - top);
  const points = key => series.map(point => `${xAt(point.x).toFixed(2)},${yAt(point[key]).toFixed(2)}`).join(' ');
  const tick = (x, y, value, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor}">${format(value)}</text>`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const xValue = lowX + (highX - lowX) * index / 4;
    const yValue = lowY + yRange * index / 4;
    const x = xAt(xValue), y = yAt(yValue);
    return `<path d="M${left} ${y}H${right} M${x} ${top}V${bottom}" stroke="var(--grid)"/>
      ${tick(left - 8, y + 4, yValue, 'end')}${tick(x, 247, xValue, 'middle')}`;
  }).join('');
  const reference = traces.includes('reference')
    ? `<polyline points="${points('reference')}" fill="none" stroke="var(--muted)" stroke-dasharray="5 4" stroke-width="2"/>` : '';
  const markers = series.filter(point => Number.isFinite(point.sample)).map(point =>
    `<circle cx="${xAt(point.x)}" cy="${yAt(point.sample)}" r="3.6" fill="var(--result)" stroke="var(--plot-bg)"/>`).join('');
  plot.innerHTML = `${grid}<path d="M${left} ${yAt(0)}H${right}" stroke="var(--muted)"/>
    <polyline points="${points('y')}" fill="none" stroke="var(--curve)" stroke-width="2.4" stroke-linejoin="round"/>
    ${reference}${markers}`;
  const axis = (label, unit) => unit ? `${label} (${unit})` : label;
  byId('axis-labels').textContent = `${axis(definition.plot.x, units.series.x)} → ${axis(definition.plot.y, units.series.y)}`;
}

function initialize(definition) {
  const { id, title, discipline, lab, inputs, metrics, plot } = definition;
  document.title = `${title} · Nexora Engineering Lab`;
  byId('title').replaceChildren(title, element('span', '.'));
  byId('discipline').textContent = disciplines[discipline];
  byId('discipline').href = `/#${discipline}`;
  byId('lab-number').textContent = ` / LAB ${lab}`;
  for (const key of ['description', 'example', 'equation', 'limits']) byId(key).textContent = definition[key];
  byId('prediction').textContent = definition.predict;
  byId('plot-title').textContent = plot.title;
  for (const [key, field] of Object.entries(inputs)) {
    const row = element('div');
    const label = element('label', field.label);
    label.htmlFor = key;
    const fieldBox = element('div');
    fieldBox.className = 'field';
    const input = element('input');
    Object.assign(input, {
      id: key, name: key, type: 'number', min: field.min, max: field.max,
      step: field.integer ? '1' : 'any', defaultValue: field.initial, required: true,
    });
    fieldBox.append(input);
    if (field.unit) {
      const unit = element('span', field.unit);
      unit.id = `${key}-unit`;
      input.setAttribute('aria-describedby', unit.id);
      fieldBox.append(unit);
    }
    row.append(label, fieldBox);
    byId('parameters').append(row);
  }
  for (const [key, label] of Object.entries(metrics)) {
    const cell = element('div');
    const value = element('dd', '—');
    value.id = `metric-${key}`;
    cell.append(element('dt', label), value);
    byId('metrics').append(cell);
  }
  for (const [key, name] of Object.entries(plot.traces)) {
    const item = element('span');
    const swatch = element('i');
    swatch.className = { y: 'green', reference: 'reference-trace', sample: 'sample-trace' }[key];
    item.append(swatch, name);
    byId('traces').append(item);
  }
  const form = byId('simulation-form');
  let result;
  const { analyze } = setupWorkbench({
    form, model: models[id], validate, payload: () => readFields(form),
    render(data) {
      result = data;
      for (const [key, value] of Object.entries(data.summary)) {
        setMetric(`metric-${key}`, value === null ? '—' : format(value), value === null ? '' : data.units.summary[key]);
      }
      drawPlot(definition, data);
    },
  });
  new ResizeObserver(() => { if (result) drawPlot(definition, result); }).observe(byId('wave-plot').parentElement);
  byId('load-example').addEventListener('click', () => byId('reset').click());
  byId('loading').hidden = true;
  byId('experiment').hidden = false;
  analyze();
}

const model = new URLSearchParams(location.search).get('lab');
if (Object.hasOwn(models, model)) initialize(models[model].definition);
else byId('loading').textContent = 'Choose a simulation from the experiment catalog.';

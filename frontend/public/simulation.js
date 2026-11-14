import { readFields, setMetric, setupWorkbench } from './workbench.ts';
import { setActiveDiscipline } from './shell.ts';
import { models } from '../../backend/waves.js';
import { validate } from '../../backend/contract.js';
import { disciplines } from '../../backend/disciplines.js';
import { renderModelVisual, renderModelTable, highlightModelTable } from './model-visuals.js';

const byId = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const format = (value) =>
  value !== 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 100000)
    ? value.toExponential(2)
    : formatter.format(value || 0);

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function drawPlot(definition, data) {
  const { series, units } = data;
  const plot = byId('wave-plot');
  const width = plot.clientWidth < 420 ? 380 : 480;
  plot.setAttribute('viewBox', `0 0 ${width} 265`);
  const left = 69,
    right = width - 36,
    top = 22,
    bottom = 226;
  const lowX = Math.min(...series.map((point) => point.x));
  const highX = Math.max(...series.map((point) => point.x));
  const traces = Object.keys(definition.plot.traces);
  const values = series.flatMap((point) =>
    traces.map((trace) => point[trace]).filter(Number.isFinite),
  );
  const lowY = Math.min(0, ...values);
  const highY = Math.max(0, ...values);
  const yRange = highY - lowY || 1;
  const xAt = (x) => left + ((x - lowX) / (highX - lowX || 1)) * (right - left);
  const yAt = (y) => bottom - ((y - lowY) / yRange) * (bottom - top);
  const points = (key) =>
    series
      .flatMap((point, i) => {
        if (!Number.isFinite(point[key])) return [];
        const current = `${xAt(point.x).toFixed(2)},${yAt(point[key]).toFixed(2)}`;
        return definition.plot.step && i && Number.isFinite(series[i - 1][key])
          ? [`${xAt(point.x).toFixed(2)},${yAt(series[i - 1][key]).toFixed(2)}`, current]
          : [current];
      })
      .join(' ');
  const tick = (x, y, value, anchor) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}">${format(value)}</text>`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const xValue = lowX + ((highX - lowX) * index) / 4;
    const yValue = lowY + (yRange * index) / 4;
    const x = xAt(xValue),
      y = yAt(yValue);
    return `<path d="M${left} ${y}H${right} M${x} ${top}V${bottom}" stroke="var(--grid)"/>
      ${tick(left - 8, y + 4, yValue, 'end')}${tick(x, 247, xValue, 'middle')}`;
  }).join('');
  const curves = traces
    .filter((key) => !['sample', 'locus'].includes(key))
    .map((key) => {
      const stroke =
        { y: 'var(--curve)', reference: 'var(--muted)', other: 'var(--result)' }[key] ??
        'var(--curve)';
      const style = `fill="none" stroke="${stroke}" stroke-width="${key === 'y' ? 2.4 : 2}" ${key === 'reference' ? 'stroke-dasharray="5 4"' : ''}`;
      if (series.every((p) => Number.isFinite(p[key])))
        return `<polyline points="${points(key)}" ${style}/>`;
      let pen = false;
      const d = series
        .map((p) => {
          if (!Number.isFinite(p[key])) {
            pen = false;
            return '';
          }
          const part = `${pen ? 'L' : 'M'}${xAt(p.x)} ${yAt(p[key])}`;
          pen = true;
          return part;
        })
        .join('');
      return `<path d="${d}" ${style}/>`;
    })
    .join('');
  const locus = series
    .filter((point) => Number.isFinite(point.locus))
    .map(
      (point) =>
        `<circle cx="${xAt(point.x)}" cy="${yAt(point.locus)}" r="1.7" fill="var(--curve)"/>`,
    )
    .join('');
  const markers = series
    .filter((point) => Number.isFinite(point.sample))
    .map(
      (point) =>
        `<circle cx="${xAt(point.x)}" cy="${yAt(point.sample)}" r="3.6" fill="var(--result)" stroke="var(--plot-bg)"/>`,
    )
    .join('');
  plot.innerHTML = `${grid}<path d="M${left} ${yAt(0)}H${right}" stroke="var(--muted)"/>
    ${curves}${locus}${markers}<path id="wave-crosshair" class="crosshair"/>`;
  const axis = (label, unit) => (unit ? `${label} (${unit})` : label);
  byId('axis-labels').textContent =
    `${axis(definition.plot.x, units.series.x)} → ${axis(definition.plot.y, units.series.y)}`;
  const probe = byId('wave-probe');
  probe.max = series.length - 1;
  if (!Number.isFinite(Number(probe.value))) probe.value = '0';
  const inspect = () => {
    const point = series[Number(probe.value)];
    byId('wave-readout').textContent = [
      `${definition.plot.x} = ${format(point.x)} ${units.series.x}`,
      ...traces
        .filter((key) => Number.isFinite(point[key]))
        .map(
          (key) =>
            `${definition.plot.traces[key]} = ${format(point[key])} ${units.series[key] ?? units.series.y}`,
        ),
    ].join(' · ');
    byId('wave-crosshair').setAttribute('d', `M${xAt(point.x)} ${top}V${bottom}`);
    renderModelVisual(byId('model-visual'), definition, data, Number(probe.value));
    highlightModelTable(byId('model-table'), data, Number(probe.value));
  };
  probe.oninput = inspect;
  plot.onpointermove = (event) => {
    const x =
      ((event.clientX - plot.getBoundingClientRect().left) / plot.getBoundingClientRect().width) *
      width;
    const target = lowX + ((x - left) / (right - left)) * (highX - lowX);
    let closest = 0;
    series.forEach((p, i) => {
      if (Math.abs(p.x - target) < Math.abs(series[closest].x - target)) closest = i;
    });
    probe.value = closest;
    inspect();
  };
  inspect();
}

function initialize(definition) {
  const reveal = () => {
    byId('loading').hidden = true;
    document.body.classList.remove('is-loading');
  };
  const { id, title, discipline, lab, inputs, metrics, plot } = definition;
  document.body.dataset.workbench = discipline;
  document.title = `${title} · Nexora Engineering Lab`;
  byId('title').replaceChildren(title, element('span', '.'));
  byId('discipline').textContent = disciplines[discipline];
  byId('discipline').href = `/#${discipline}`;
  setActiveDiscipline(discipline);
  byId('lab-number').textContent = ` / LAB ${lab}`;
  for (const key of ['description', 'example', 'equation', 'limits'])
    byId(key).textContent = definition[key];
  byId('prediction').textContent = definition.predict;
  byId('plot-title').textContent = plot.title;
  for (const [key, field] of Object.entries(inputs)) {
    const row = element('div');
    if (field.visibleWhen) row.dataset.conditional = key;
    const label = element('label', field.label);
    label.htmlFor = key;
    if (field.type === 'enum') {
      const select = element('select');
      select.id = key;
      select.name = key;
      select.className = 'material-select';
      select.dataset.valueType = 'string';
      field.options.forEach((value) => {
        const option = element('option', field.labels?.[value] ?? value);
        option.value = value;
        option.defaultSelected = value === field.initial;
        select.append(option);
      });
      row.append(label, select);
      byId('parameters').append(row);
      continue;
    }
    if (field.type === 'text') {
      row.className = 'sequence-field';
      const input = element('textarea');
      Object.assign(input, {
        id: key,
        name: key,
        defaultValue: field.initial,
        maxLength: field.maxLength,
        rows: field.maxLength <= 500 ? 3 : 5,
        required: true,
      });
      input.dataset.valueType = 'string';
      row.append(label, input);
      if (field.hint) {
        const hint = element('p', field.hint);
        hint.className = 'field-hint';
        hint.id = `${key}-hint`;
        input.setAttribute('aria-describedby', hint.id);
        row.append(hint);
      }
      byId('parameters').append(row);
      continue;
    }
    if (field.type === 'integer-list') {
      row.className = 'sequence-field';
      const input = element('input');
      Object.assign(input, {
        id: key,
        name: key,
        type: 'text',
        defaultValue: field.initial,
        maxLength: 300,
        required: true,
      });
      input.className = 'sequence-input';
      input.dataset.valueType = 'string';
      const hint = element(
        'p',
        `1–${field.maxItems} comma-separated values (${field.minItem} to ${field.maxItem})`,
      );
      hint.className = 'field-hint';
      hint.id = `${key}-hint`;
      input.setAttribute('aria-describedby', hint.id);
      row.append(label, input, hint);
      byId('parameters').append(row);
      continue;
    }
    const fieldBox = element('div');
    fieldBox.className = 'field';
    const input = element('input');
    Object.assign(input, {
      id: key,
      name: key,
      type: 'number',
      min: field.min,
      max: field.max,
      step: field.integer ? '1' : 'any',
      defaultValue: field.initial,
      required: true,
    });
    fieldBox.append(input);
    if (field.widget === 'bit') {
      fieldBox.classList.add('bit-field');
      input.className = 'bit-input';
      input.dataset.widget = 'bit';
      input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      const button = element('button', String(field.initial));
      button.type = 'button';
      button.className = 'bit-toggle';
      button.id = `toggle-${key}`;
      button.dataset.bit = key;
      button.setAttribute('aria-label', `Toggle ${field.label}`);
      label.htmlFor = button.id;
      button.addEventListener('click', () => {
        input.value = String(1 - Number(input.value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      fieldBox.append(button);
    }
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
    swatch.className = {
      y: 'green',
      reference: 'reference-trace',
      sample: 'sample-trace',
      locus: 'curve-swatch',
      other: 'other-trace',
    }[key];
    item.append(swatch, name);
    byId('traces').append(item);
  }
  const form = byId('simulation-form');
  const updateVisibility = () => {
    for (const row of form.querySelectorAll('[data-conditional]')) {
      const condition = inputs[row.dataset.conditional].visibleWhen;
      row.hidden = form.elements.namedItem(condition.key).value !== condition.is;
    }
  };
  updateVisibility();
  form.addEventListener('input', updateVisibility);
  let result;
  let resetProbe = true,
    playing = false,
    timer;
  const pause = () => {
    playing = false;
    clearTimeout(timer);
    byId('preview-toggle').textContent = 'Play preview';
    byId('preview-toggle').setAttribute('aria-pressed', 'false');
  };
  const syncBits = () => {
    for (const button of form.querySelectorAll('[data-bit]')) {
      const value = form.elements.namedItem(button.dataset.bit).value;
      button.textContent = value;
      button.setAttribute('aria-pressed', String(value === '1'));
    }
  };
  const { applyInputs, analyze } = setupWorkbench({
    form,
    model: models[id],
    validate:
      id === 'trussfem'
        ? (definition, input) => validate({ ...definition, validateValues: undefined }, input)
        : validate,
    payload: () => readFields(form),
    onReset() {
      pause();
      resetProbe = true;
      byId('wave-probe').value = '0';
      syncBits();
      updateVisibility();
      byId('lab-preset').value = 'default';
    },
    onInvalid() {
      void document.fonts.ready.then(reveal);
      pause();
      byId('preview-toggle').disabled = true;
      byId('preview-step').disabled = true;
    },
    render(data) {
      void document.fonts.ready.then(reveal);
      result = data;
      byId('preview-toggle').disabled = false;
      byId('preview-step').disabled = false;
      syncBits();
      updateVisibility();
      if (resetProbe) {
        byId('wave-probe').max = data.series.length - 1;
        byId('wave-probe').value =
          definition.initialProbe === 'end' ? String(data.series.length - 1) : '0';
        resetProbe = false;
      }
      for (const [key, value] of Object.entries(data.summary)) {
        setMetric(
          `metric-${key}`,
          value === null ? '—' : format(value),
          value === null ? '' : data.units.summary[key],
        );
      }
      const warnings = byId('model-warnings');
      warnings.hidden = !data.warnings?.length;
      warnings.textContent = data.warnings?.join(' ') ?? '';
      renderModelTable(byId('model-table'), data);
      drawPlot(definition, data);
      byId('model-actions').hidden = !data.visualization?.frames;
    },
  });
  byId('preview-step').textContent = definition.stepAction ?? 'Next pose';
  const probe = byId('wave-probe');
  const step = () => {
    if (Number(probe.value) >= Number(probe.max)) probe.value = '0';
    else probe.value = String(Number(probe.value) + 1);
    probe.dispatchEvent(new Event('input'));
  };
  byId('preview-step').addEventListener('click', () => {
    pause();
    step();
  });
  const tick = () => {
    if (!playing) return;
    if (Number(probe.value) >= Number(probe.max)) {
      pause();
      return;
    }
    step();
    timer = setTimeout(tick, result.series.length > 100 ? 40 : 450);
  };
  byId('preview-toggle').addEventListener('click', () => {
    if (playing) {
      pause();
      return;
    }
    if (Number(probe.value) >= Number(probe.max)) probe.value = '0';
    playing = true;
    byId('preview-toggle').textContent = 'Pause preview';
    byId('preview-toggle').setAttribute('aria-pressed', 'true');
    tick();
  });
  form.addEventListener('input', pause);
  probe.addEventListener('pointerdown', pause);
  probe.addEventListener('keydown', pause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  if (definition.presets) {
    const select = byId('lab-preset');
    const base = element('option', 'Default / worked example');
    base.value = 'default';
    select.append(base);
    Object.keys(definition.presets).forEach((key) => {
      const option = element('option', key);
      option.value = key;
      select.append(option);
    });
    byId('preset-row').hidden = false;
    select.addEventListener('change', () => {
      pause();
      const chosen = select.value;
      const values = definition.presets[chosen] ?? {};
      resetProbe = true;
      applyInputs(
        Object.fromEntries(
          Object.entries(inputs).map(([key, field]) => [key, values[key] ?? field.initial]),
        ),
      );
      select.value = chosen;
    });
  }
  if (definition.interaction === 'arm-target') {
    const host = byId('model-visual');
    host.dataset.draggable = 'true';
    let dragging = false;
    const move = (event) => {
      if (!dragging) return;
      const svg = host.querySelector('svg'),
        matrix = svg?.getScreenCTM();
      if (!matrix) return;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()),
        scale = Number(host.dataset.worldScale);
      for (const [key, value] of Object.entries({
        x: (p.x - Number(host.dataset.worldX)) / scale,
        y: (Number(host.dataset.worldY) - p.y) / scale,
      })) {
        const input = byId(key);
        input.value = String(
          Math.max(Number(input.min), Math.min(Number(input.max), Number(value.toFixed(3)))),
        );
      }
      byId('x').dispatchEvent(new Event('input', { bubbles: true }));
    };
    host.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.robot-target')) return;
      dragging = true;
      pause();
      host.setPointerCapture(event.pointerId);
      move(event);
    });
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', () => {
      dragging = false;
    });
    host.addEventListener('lostpointercapture', () => {
      dragging = false;
    });
  }
  let plotWidth = 0;
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - plotWidth) < 0.5) return;
    plotWidth = entry.contentRect.width;
    requestAnimationFrame(() => {
      if (result) drawPlot(definition, result);
    });
  }).observe(byId('wave-plot').parentElement);
  byId('load-example').addEventListener('click', () => byId('reset').click());
  byId('experiment').hidden = false;
  {
    const query = new URLSearchParams(location.search);
    for (const [key, field] of Object.entries(inputs)) {
      const raw = query.get(key),
        value = Number(raw);
      if (raw === null) continue;
      if (field.type === 'enum' && field.options.includes(raw))
        form.elements.namedItem(key).value = raw;
      else if (
        field.type !== 'enum' &&
        field.type !== 'integer-list' &&
        raw.trim() &&
        Number.isFinite(value) &&
        value >= field.min &&
        value <= field.max &&
        (!field.integer || Number.isInteger(value))
      )
        form.elements.namedItem(key).value = String(value);
    }
  }
  analyze();
}

const model = new URLSearchParams(location.search).get('lab');
if (Object.hasOwn(models, model)) initialize(models[model].definition);
else byId('loading').textContent = 'Choose a simulation from the experiment catalog.';

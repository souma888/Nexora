import { tornadoPlot } from './tornado-plot.ts';
import { parameterSpace } from '../../backend/parameter-space.js';
import { cancelSurrogate, trainSurrogate } from './surrogate-client.ts';
import { solverClient } from './worker-client.ts';
import { analysisPlot, type XY } from './analysis-plot.ts';
import { parseData } from '../../backend/numerical-tools.js';
import type { Report } from './run-tools.ts';
type Input = Record<string, number | string>;
type Field = {
  type: string;
  unit?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  label?: string;
};
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  n.textContent = text ?? '';
  return n;
};
export function advancedTools(
  form: HTMLFormElement,
  definition: {
    id: string;
    inputs?: Record<string, Field>;
    metrics?: Record<string, string>;
    outputs: { summary: Record<string, string>; series: Record<string, string> };
  },
  load: (input: Input) => void,
) {
  const host = el('details'),
    title = el('summary', 'Analysis studio · sweep, uncertainty & fitting'),
    body = el('div'),
    output = el('div'),
    status = el('p');
  host.className = 'run-tools analysis-studio';
  host.append(title, body);
  status.setAttribute('role', 'status');
  output.className = 'analysis-output';
  const descriptors = parameterSpace(definition).fields as Record<string, Field>;
  const fields = Object.entries(descriptors);
  let current: { input: Input; data: Report } | null = null,
    revision = 0;
  const client = solverClient();
  const parameter = el('select'),
    metric = el('select'),
    trace = el('select');
  parameter.setAttribute('aria-label', 'Analysis parameter');
  metric.setAttribute('aria-label', 'Analysis output metric');
  trace.setAttribute('aria-label', 'Fitting trace');
  for (const [key, field] of fields)
    parameter.add(
      new Option(`${field.label ?? key}${field.unit ? ' (' + field.unit + ')' : ''}`, key),
    );
  for (const [key, unit] of Object.entries(definition.outputs.summary))
    metric.add(new Option(`${definition.metrics?.[key] ?? key} (${unit || '1'})`, key));
  for (const [key, unit] of Object.entries(definition.outputs.series))
    if (key !== 'x') trace.add(new Option(`${key} (${unit || '1'})`, key));
  const ranges = el('div');
  ranges.className = 'analysis-ranges';
  const bounds = new Map<
    string,
    { check: HTMLInputElement; low: HTMLInputElement; high: HTMLInputElement }
  >();
  for (const [key, field] of fields) {
    const row = el('div'),
      label = el('label'),
      check = el('input'),
      low = el('input'),
      high = el('input');
    check.type = 'checkbox';
    check.checked = bounds.size === 0;
    low.type = high.type = 'number';
    low.step = high.step = 'any';
    low.setAttribute('aria-label', `${field.label ?? key} lower bound`);
    high.setAttribute('aria-label', `${field.label ?? key} upper bound`);
    row.className = 'analysis-range';
    label.append(check, `${field.label ?? key} (${field.unit || '1'})`);
    row.append(label, low, high);
    ranges.append(row);
    bounds.set(key, { check, low, high });
  }
  const count = el('input'),
    seed = el('input'),
    distribution = el('select');
  count.type = seed.type = 'number';
  count.value = '100';
  count.min = '2';
  count.max = '1000';
  seed.value = '42';
  seed.min = '1';
  seed.max = '4294967295';
  count.setAttribute('aria-label', 'Analysis sample count');
  seed.setAttribute('aria-label', 'Analysis seed');
  distribution.setAttribute('aria-label', 'Uncertainty distribution');
  distribution.append(
    new Option('Uniform independent inputs', 'uniform'),
    new Option('Normal: bounds = midpoint ±3σ', 'normal'),
  );
  const button = (text: string, action: () => void) => {
    const b = el('button', text);
    b.type = 'button';
    b.className = 'quiet';
    b.onclick = action;
    return b;
  };
  const sampleLabel = el('label', 'Samples'),
    seedLabel = el('label', 'Random seed');
  sampleLabel.append(count);
  seedLabel.append(seed);
  const cancel = button('Cancel calculation', () => {
    revision++;
    client.cancel();
    cancelSurrogate();
    status.textContent = 'Calculation cancelled.';
  });
  const selectedBounds = (single = false) => {
    const result: Record<string, [number, number]> = {};
    for (const [key, row] of bounds)
      if (single ? key === parameter.value : row.check.checked) {
        const field = descriptors[key],
          low = Number(row.low.value),
          high = Number(row.high.value);
        if (
          !row.low.value ||
          !row.high.value ||
          low >= high ||
          low < (field.min ?? -Infinity) ||
          high > (field.max ?? Infinity)
        )
          throw new Error(`${key}: enter increasing bounds inside the parameter limits.`);
        if (field.integer && (!Number.isInteger(low) || !Number.isInteger(high)))
          throw new Error(`${key}: integer parameter bounds must be whole numbers.`);
        result[key] = [low, high];
      }
    return result;
  };
  async function calculate(task: string, mode?: string) {
    if (!current) {
      status.textContent = 'Correct the lab inputs first.';
      return;
    }
    const generation = ++revision;
    client.cancel();
    status.textContent = 'Calculating in a worker…';
    output.replaceChildren();
    try {
      if (task === 'fit' && Object.keys(selectedBounds()).some((key) => descriptors[key].integer))
        throw new Error(
          'Least-squares fitting requires continuous parameters; uncheck integer inputs.',
        );
      const request = {
        bounds: selectedBounds(mode === 'sweep'),
        metric: metric.value,
        mode,
        samples: Number(count.value),
        seed: Number(seed.value),
        distribution: distribution.value,
        trace: trace.value,
        data: task === 'fit' ? parseData(csv.value) : undefined,
      };
      const result = await client.run<{
        series?: XY[];
        tornado?: { key: string; low: number; high: number; span: number }[];
        input?: Input;
        residuals?: XY[];
        [key: string]: unknown;
      }>(definition.id, current.input, task, request);
      if (generation !== revision) return;
      if (result.series)
        output.append(
          analysisPlot(
            [
              {
                label:
                  task === 'fit'
                    ? 'Fitted model'
                    : mode === 'montecarlo'
                      ? 'Accepted output quantiles'
                      : 'Sweep',
                points: result.series,
              },
            ],
            mode === 'montecarlo'
              ? 'Quantile'
              : task === 'fit'
                ? `x (${definition.outputs.series.x ?? ''})`
                : parameter.value,
            task === 'fit' ? trace.value : metric.value,
          ),
        );
      if (result.residuals)
        output.append(
          analysisPlot(
            [{ label: 'Observed residuals', points: result.residuals }],
            'x',
            'Model − observed',
          ),
        );
      if (result.tornado)
        output.append(tornadoPlot(result.tornado, Number(result.baseline), metric.value));
      if (result.tornado) {
        const max = Math.max(...result.tornado.map((r) => r.span), 1e-30);
        for (const row of result.tornado) {
          const label = el(
              'p',
              `${row.key}: ${row.low.toPrecision(5)} → ${row.high.toPrecision(5)}`,
            ),
            bar = el('meter');
          bar.min = 0;
          bar.max = max;
          bar.value = row.span;
          bar.setAttribute('aria-label', `${row.key} output span`);
          label.append(bar);
          output.append(label);
        }
      }
      const table = el('dl');
      for (const [key, value] of Object.entries(result))
        if (!['series', 'tornado', 'residuals'].includes(key))
          table.append(
            el('dt', key),
            el(
              'dd',
              typeof value === 'number'
                ? value.toPrecision(6)
                : typeof value === 'string'
                  ? value
                  : JSON.stringify(value),
            ),
          );
      output.append(table);
      if (result.input) {
        const fitted = result.input;
        output.append(button('Apply fitted parameters', () => load(fitted)));
      }
      status.textContent = 'Calculation complete. Bounds and results use canonical lab units.';
    } catch (e) {
      if (generation === revision)
        status.textContent = e instanceof Error ? e.message : 'Calculation failed.';
    }
  }
  const csv = el('textarea'),
    upload = el('input');
  csv.rows = 5;
  csv.placeholder = 'x,y\n0,0\n1,0.4\n2,0.65\n3,0.8';
  csv.setAttribute('aria-label', 'Observed x,y CSV in canonical lab units');
  upload.type = 'file';
  upload.accept = '.csv,text/csv';
  upload.setAttribute('aria-label', 'Upload observed CSV');
  upload.onchange = async () => {
    const file = upload.files?.[0];
    if (file && file.size <= 200000) csv.value = await file.text();
    else status.textContent = 'CSV must be under 200 kB.';
  };
  const fitNotes = el(
    'p',
    'Fit 1–3 checked continuous parameters using damped least squares. CSV columns x,y must use the plotted canonical units. Choose a trace; fit bounds must contain all observed x values. Validate on an independent record.',
  );
  body.append(
    el(
      'p',
      'Choose input ranges, then examine a sweep, endpoint sensitivity tornado, or seeded Monte Carlo propagation. Failed draws are reported. Integer and list entries use discrete sampling; categorical choices stay fixed.',
    ),
    parameter,
    metric,
    ranges,
    sampleLabel,
    seedLabel,
    distribution,
    button('Run parameter sweep', () => void calculate('analysis', 'sweep')),
    button('Sensitivity tornado', () => void calculate('analysis', 'sensitivity')),
    button('Monte Carlo uncertainty', () => void calculate('analysis', 'montecarlo')),
    fitNotes,
    trace,
    upload,
    csv,
    button('Fit parameters to CSV', () => void calculate('fit')),
    button('Train browser surrogate', () => void train()),
    cancel,
    status,
    output,
  );
  async function train() {
    if (!current) return;
    const generation = ++revision;
    status.textContent = 'Loading TensorFlow.js surrogate worker…';
    try {
      const data = await trainSurrogate(current.data.series ?? []);
      if (generation !== revision) return;
      output.replaceChildren(
        analysisPlot(data.curves, 'x', 'Response'),
        el(
          'p',
          `Held-out RMSE: ${data.rmse.toPrecision(5)}. This neural surrogate learns this single fixed-parameter response curve; changing inputs requires retraining. It is not a physics-informed model.`,
        ),
      );
      status.textContent = 'Surrogate trained with held-out points.';
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : 'Training failed.';
    }
  }
  if (!fields.length) {
    body.replaceChildren(
      el(
        'p',
        'This lab has no numeric parameter adapter. Use its discrete controls; analysis requires a meaningful numerical input.',
      ),
    );
  }
  const workspace = form.closest('#algorithm-lab, #experiment') ?? form.closest('.workbench');
  workspace?.before(host);
  return {
    setCurrent(input: Input, data: Report) {
      current = { input, data };
      const expanded = parameterSpace(definition, input).values as Input;
      for (const [key, row] of bounds) {
        if (row.low.dataset.edited) continue;
        const value = Number(expanded[key]),
          field = descriptors[key],
          delta = Math.abs(value) * 0.2 || Math.min(1, ((field.max ?? 1) - (field.min ?? 0)) * 0.1);
        row.low.value = String(
          field.integer
            ? Math.max(field.min ?? -1000, Math.floor(value - delta))
            : Math.max(field.min ?? -Infinity, value - delta),
        );
        row.high.value = String(
          field.integer
            ? Math.min(field.max ?? 1000, Math.ceil(value + delta))
            : Math.min(field.max ?? Infinity, value + delta),
        );
        row.low.oninput = row.high.oninput = () => {
          row.low.dataset.edited = 'true';
        };
      }
    },
    invalidate() {
      current = null;
      revision++;
      client.cancel();
      cancelSurrogate();
      status.textContent = 'Inputs changed. Run analysis again after live results update.';
      output.replaceChildren();
    },
  };
}

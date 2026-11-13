import { parseRun, csv, type Input, type Run } from '../../backend/run-record.ts';
export type Report = {
  summary?: Record<string, unknown>;
  series?: Record<string, unknown>[];
  frames?: unknown[];
  stats?: Record<string, unknown>;
  result?: Record<string, unknown>;
};
const storageKey = 'nexora-runs-v1';
export function savedRuns(): Run[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 40).flatMap((value) => {
      try {
        if (
          typeof value?.model !== 'string' ||
          !/^\w{1,60}$/.test(value.model) ||
          typeof value.solverVersion !== 'string'
        )
          return [];
        return [parseRun(value, value.model, value.solverVersion)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
function writeRuns(runs: Run[]) {
  localStorage.setItem(storageKey, JSON.stringify(runs));
  window.dispatchEvent(new Event('nexora-runs'));
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
function download(name: string, value: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type })),
    a = el('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function summary(data: Report) {
  return data.summary ?? { ...data.stats, ...data.result, steps: data.frames?.length ?? 0 };
}
export function installRunTools(config: {
  form: HTMLFormElement;
  model: string;
  version: string;
  units: Record<string, string>;
  seriesUnits?: Record<string, string>;
  metrics?: Record<string, string>;
  validate: (input: Input) => Input;
  solve: (input: Input) => Report;
  load: (input: Input) => void;
}) {
  const host = el('details'),
    heading = el('summary', 'Save, compare & export');
  host.className = 'run-tools';
  host.append(heading);
  const body = el('div'),
    label = el('label', 'Run name'),
    name = el('input');
  name.maxLength = 80;
  name.placeholder = 'Name this experiment';
  label.append(name);
  const save = el('button', 'Save run'),
    json = el('button', 'Export JSON'),
    sheet = el('button', 'Export CSV'),
    importLabel = el('label', 'Import run JSON'),
    file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.setAttribute('aria-label', 'Import run JSON');
  importLabel.append(file);
  const picker = el('select');
  picker.setAttribute('aria-label', 'Saved run to restore or compare');
  const restore = el('button', 'Restore saved'),
    compare = el('button', 'Compare with current'),
    remove = el('button', 'Delete saved');
  const status = el('p'),
    comparison = el('div');
  status.setAttribute('role', 'status');
  comparison.className = 'run-comparison';
  comparison.tabIndex = 0;
  comparison.setAttribute('role', 'region');
  comparison.setAttribute('aria-label', 'Run comparison');
  for (const button of [save, json, sheet, restore, compare, remove]) {
    button.type = 'button';
    button.className = 'quiet';
  }
  const library = el('a', 'Open saved-run library');
  library.href = '/#saved-runs';
  body.append(
    label,
    save,
    json,
    sheet,
    importLabel,
    picker,
    restore,
    compare,
    remove,
    library,
    status,
    comparison,
  );
  host.append(body);
  const workspace =
    config.form.closest('#algorithm-lab, #experiment') ?? config.form.closest('.workbench');
  workspace?.before(host);
  let current: { input: Input; data: Report } | null = null;
  const note = (value: string) => {
    status.textContent = value;
  };
  function refresh() {
    const selected = picker.value;
    picker.replaceChildren(new Option('Choose a saved run', ''));
    for (const run of savedRuns().filter(
      (r) => r.model === config.model && r.solverVersion === config.version,
    ))
      picker.add(new Option(run.label || run.createdAt, run.id));
    picker.value = selected;
    const valid = Boolean(picker.value);
    restore.disabled = compare.disabled = remove.disabled = !valid;
  }
  const selected = () => {
    const run = savedRuns().find((r) => r.id === picker.value && r.model === config.model);
    if (!run) throw new Error('Choose a saved run.');
    return parseRun(run, config.model, config.version);
  };
  const action = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      note(error instanceof Error ? error.message : 'Could not complete this action.');
    }
  };
  const snapshot = (): Run => {
    if (!current) throw new Error('Correct the inputs before saving or exporting.');
    return {
      format: 'nexora-run',
      schemaVersion: 1,
      id: crypto.randomUUID(),
      model: config.model,
      solverVersion: config.version,
      label: name.value.trim() || `${config.model} · ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      input: { ...current.input },
    };
  };
  save.onclick = () =>
    action(() => {
      const runs = savedRuns();
      if (runs.length >= 40)
        throw new Error('The local library holds 40 runs. Delete a saved run or export JSON.');
      const run = snapshot();
      try {
        writeRuns([...runs, run]);
      } catch {
        throw new Error('Browser storage is unavailable or full. Export JSON to keep this run.');
      }
      refresh();
      picker.value = run.id;
      refresh();
      note('Saved in this browser. Export JSON for a portable copy.');
    });
  json.onclick = () =>
    action(() => {
      const run = snapshot();
      download(
        `nexora-${config.model}.json`,
        JSON.stringify(
          { ...run, result: { summary: summary(current!.data), units: config.units } },
          null,
          2,
        ),
        'application/json',
      );
      note('Exported run inputs, solver version and computed results.');
    });
  sheet.onclick = () =>
    action(() => {
      snapshot();
      const data = current!.data,
        rows: unknown[][] = [
          ['Nexora model', config.model, 'Solver version', config.version],
          ['Metric', 'Value', 'Unit'],
          ...Object.entries(summary(data)).map(([key, value]) => [
            config.metrics?.[key] ?? key,
            typeof value === 'object' ? JSON.stringify(value) : value,
            config.units[key] ?? '',
          ]),
        ];
      if (data.series?.length) {
        const keys = [...new Set(data.series.flatMap((row) => Object.keys(row)))];
        rows.push(
          [],
          keys.map(
            (key) => key + (config.seriesUnits?.[key] ? ' (' + config.seriesUnits[key] + ')' : ''),
          ),
          ...data.series.map((row) => keys.map((key) => row[key])),
        );
      } else if (data.frames)
        rows.push(
          [],
          ['Step', 'State JSON'],
          ...data.frames.map((frame, i) => [i + 1, JSON.stringify(frame)]),
        );
      download(`nexora-${config.model}.csv`, csv(rows), 'text/csv;charset=utf-8');
      note(
        'Exported canonical model units; text cells are protected against spreadsheet formulas.',
      );
    });
  restore.onclick = () =>
    action(() => {
      const run = selected();
      config.load(config.validate(run.input));
      note(`Restored ${run.label}. Results were recalculated.`);
    });
  compare.onclick = () =>
    action(() => {
      if (!current) throw new Error('Correct the current inputs before comparing.');
      const run = selected(),
        saved = summary(config.solve(config.validate(run.input))),
        now = summary(current.data),
        table = el('table'),
        caption = el(
          'caption',
          `Current versus ${run.label} · solver ${config.version} · model units`,
        );
      table.append(caption);
      const head = el('tr');
      for (const value of ['Metric', 'Current', 'Saved', 'Δ current − saved', 'Unit'])
        head.append(el('th', value));
      table.append(head);
      for (const key of new Set([...Object.keys(now), ...Object.keys(saved)])) {
        const row = el('tr'),
          a = now[key],
          b = saved[key],
          format = (v: unknown) =>
            v === null || v === undefined
              ? '—'
              : typeof v === 'number'
                ? new Intl.NumberFormat('en', { maximumSignificantDigits: 7 }).format(v)
                : JSON.stringify(v);
        for (const value of [
          config.metrics?.[key] ?? key,
          format(a),
          format(b),
          typeof a === 'number' && typeof b === 'number' ? format(a - b) : '—',
          config.units[key] ?? '',
        ])
          row.append(el('td', value));
        table.append(row);
      }
      comparison.replaceChildren(table);
      note('Compared the same model, solver version and canonical units.');
    });
  remove.onclick = () =>
    action(() => {
      const run = selected();
      writeRuns(savedRuns().filter((r) => r.id !== run.id));
      refresh();
      comparison.replaceChildren();
      note('Deleted the selected saved run.');
    });
  picker.onchange = refresh;
  file.onchange = async () => {
    try {
      const item = file.files?.[0];
      if (!item) return;
      if (item.size > 200000) throw new Error('Run files must be smaller than 200 kB.');
      const run = parseRun(JSON.parse(await item.text()), config.model, config.version);
      const input = config.validate(run.input);
      config.load(input);
      name.value = run.label;
      note(
        'Imported and recalculated the inputs. Exported results were not trusted; use Save run to retain this copy.',
      );
    } catch (error) {
      note(error instanceof Error ? error.message : 'Invalid run file.');
    } finally {
      file.value = '';
    }
  };
  refresh();
  window.addEventListener('storage', refresh);
  window.addEventListener('nexora-runs', refresh);
  const shared = new URLSearchParams(location.search).get('saved');
  if (shared) {
    const run = savedRuns().find((r) => r.id === shared && r.model === config.model);
    if (run)
      queueMicrotask(() =>
        action(() => {
          const accepted = parseRun(run, config.model, config.version);
          config.load(config.validate(accepted.input));
          host.open = true;
          note(`Restored ${accepted.label} from this browser’s library.`);
        }),
      );
  }
  return {
    setCurrent(input: Input, data: Report) {
      current = { input: { ...input }, data };
      comparison.replaceChildren();
      save.disabled = json.disabled = sheet.disabled = false;
    },
    invalidate() {
      current = null;
      save.disabled = json.disabled = sheet.disabled = true;
      comparison.replaceChildren();
    },
  };
}

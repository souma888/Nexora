export type Input = Record<string, number | string>;
export type Run = {
  format: 'nexora-run';
  schemaVersion: 1;
  id: string;
  model: string;
  solverVersion: string;
  label: string;
  createdAt: string;
  input: Input;
};
export function parseRun(value: unknown, model: string, version: string): Run {
  if (!value || typeof value !== 'object') throw new Error('Import a Nexora run JSON object.');
  const r = value as Partial<Run>;
  if (r.format !== 'nexora-run' || r.schemaVersion !== 1 || r.model !== model)
    throw new Error('This file belongs to a different lab or unsupported run format.');
  if (r.solverVersion !== version)
    throw new Error(
      'Solver version differs. Recreate the run with this model version before comparing.',
    );
  if (
    !r.input ||
    typeof r.input !== 'object' ||
    Array.isArray(r.input) ||
    Object.keys(r.input).length > 40
  )
    throw new Error('Invalid run inputs.');
  const entries = Object.entries(r.input);
  if (
    entries.some(
      ([key, v]) =>
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype' ||
        !(
          (typeof v === 'number' && Number.isFinite(v)) ||
          (typeof v === 'string' && v.length <= 4000)
        ),
    )
  )
    throw new Error('Run inputs must contain bounded finite numbers or strings.');
  return {
    format: 'nexora-run',
    schemaVersion: 1,
    id: typeof r.id === 'string' && /^[\w-]{1,80}$/.test(r.id) ? r.id : 'imported',
    model,
    solverVersion: version,
    label: typeof r.label === 'string' ? r.label.slice(0, 80) : 'Imported run',
    createdAt:
      typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt))
        ? r.createdAt
        : new Date().toISOString(),
    input: Object.fromEntries(entries),
  };
}
/** Protect text cells from spreadsheet formula execution while preserving numeric negative values. */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export const csv = (rows: unknown[][]) =>
  rows.map((row) => row.map(csvCell).join(',')).join('\r\n');

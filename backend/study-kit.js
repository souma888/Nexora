import { mathLab } from './math-core.js';
export { p, integer, choice, textInput, table, samples, random, normal } from './math-core.js';
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F> & {discipline:string}} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
export const study = (config, solve) => mathLab(config, solve);
export const systemVisual = (kind, values, frames = []) => ({
  type: 'release-system',
  kind,
  ...values,
  ...(frames.length ? { frames } : {}),
});
export function jsonNumbers(
  source,
  rowsMin = 1,
  rowsMax = 8,
  colsMin = 1,
  colsMax = 8,
  min = 0,
  max = 999,
) {
  const a = JSON.parse(source);
  if (
    !Array.isArray(a) ||
    a.length < rowsMin ||
    a.length > rowsMax ||
    a.some(
      (r) =>
        !Array.isArray(r) ||
        r.length < colsMin ||
        r.length > colsMax ||
        r.some((v) => !Number.isFinite(v) || v < min || v > max),
    )
  )
    throw Error(
      `Use ${rowsMin}–${rowsMax} rows, ${colsMin}–${colsMax} finite numeric entries per row (${min}…${max}).`,
    );
  if (a.some((r) => r.length !== a[0].length)) throw Error('Rows must have equal length.');
  return a;
}
export const checkInput = (key, check) => (input) => {
  try {
    check(input);
  } catch (e) {
    return { key, message: e.message };
  }
};
export const indices = (source, max) => {
  if (source === 'none') return [];
  const a = String(source)
    .split(',')
    .map((s) => (s.trim() ? Number(s) : NaN));
  if (a.length > 64 || a.some((x) => !Number.isInteger(x) || x < 0 || x >= max))
    throw Error(`Use “none” or comma-separated indexes 0…${max - 1}.`);
  return [...new Set(a)];
};

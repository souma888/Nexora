import { experiment, parameter } from './experiment.js';
export { parameter as p, samples } from './experiment.js';
export const integer = (label, min, max, initial) => ({
  ...parameter(label, '', min, max, initial),
  integer: true,
});
export const bit = (label, initial = 0) => ({ ...integer(label, 0, 1, initial), widget: 'bit' });
/** @returns {import("./schema.js").EnumField} */
export const choice = (label, options, initial) => ({
  label,
  type: 'enum',
  options: Object.keys(options),
  labels: options,
  initial,
  unit: '',
});
/** @returns {import("./schema.js").ListField} */
export const list = (label, initial, minItem = 0, maxItem = 1, maxItems = 24) => ({
  label,
  type: 'integer-list',
  initial,
  minItem,
  maxItem,
  maxItems,
  unit: '',
});
export const parseList = (value) => value.split(',').map((s) => Number(s.trim()));
export const table = (caption, headers, rows) => ({ caption, headers, rows });
export const radians = (degrees) => (degrees * Math.PI) / 180;
export const degrees = (radians) => (radians * 180) / Math.PI;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** @template {import("./schema.js").Fields} F
 * @template {import("./schema.js").Result} R
 * @param {import("./schema.js").LabConfig<F>} config
 * @param {(input:import("./schema.js").InputValues<F>)=>R} solve
 */
export function lab(config, solve) {
  const { id, title, discipline, inputs, metrics, text, plot = {}, rules = [], ...extra } = config;
  return experiment(
    id,
    {
      title,
      discipline,
      lab: extra.lab ?? id.toUpperCase(),
      inputs,
      rules,
      description: text[0],
      predict: text[1],
      prediction: [text[2], 0, text[3]],
      example: text[4],
      equation: text[5],
      limits: text[6],
      metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value[0]])),
      plot: {
        title: plot.title ?? title,
        x: plot.x ?? 'Time',
        y: plot.y ?? 'Response',
        traces: plot.traces ?? { y: 'Response' },
        step: plot.step ?? false,
      },
      outputs: {
        summary: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value[1]])),
        series: {
          x: plot.xUnit ?? 's',
          ...Object.fromEntries(
            Object.keys(plot.traces ?? { y: '' }).map((key) => [key, plot.yUnit ?? '']),
          ),
        },
      },
      ...extra,
    },
    solve,
  );
}

/** @param {string} label @param {string} initial @param {number} [maxLength]
 * @returns {import('./schema.js').TextField} */
export const textInput = (label, initial, maxLength = 2000) => ({
  label,
  initial,
  maxLength,
  type: 'text',
  unit: '',
});

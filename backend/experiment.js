import { number } from './contract.js';

/** @returns {import("./schema.js").NumberField} */
export const parameter = (label, unit, min, max, initial) => ({
  ...number(label, unit, min, max),
  initial,
});

/** @template {object} T
 * @param {number} start
 * @param {number} end
 * @param {(x:number)=>T} evaluate
 * @param {number} [count]
 * @returns {Array<{x:number} & T & {sample?:number|null}>}
 */
export const samples = (start, end, evaluate, count = 240) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const x = start + ((end - start) * i) / count;
    return { x, ...evaluate(x) };
  });

export const cosine = (frequency, time) => Math.cos(2 * Math.PI * frequency * time);

/** @template {import("./schema.js").Fields} F
 * @template {import("./schema.js").Result} R
 * @param {string} id
 * @param {import("./schema.js").Config<F>} definition
 * @param {(input:import("./schema.js").InputValues<F>)=>R} solve
 */
export function experiment(id, definition, solve) {
  return { definition: { id, version: '1.0', ...definition }, solve };
}

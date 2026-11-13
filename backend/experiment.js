import { number } from './contract.js';

export const parameter = (label, unit, min, max, initial) => ({
  ...number(label, unit, min, max),
  initial,
});

export const samples = (start, end, evaluate, count = 240) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const x = start + ((end - start) * i) / count;
    return { x, ...evaluate(x) };
  });

export const cosine = (frequency, time) => Math.cos(2 * Math.PI * frequency * time);

export function experiment(id, definition, solve) {
  return { definition: { id, version: '1.0', ...definition }, solve };
}

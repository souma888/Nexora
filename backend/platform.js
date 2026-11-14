import { labManifest } from './lab-manifest.js';
import { validate } from './contract.js';
import { runAlgorithm, validateAlgorithm } from './algorithms.js';

export function resolveLab(id) {
  const entry = labManifest.find((entry) => entry.id === id);
  if (!entry) throw new Error('Unknown lab.');
  const definition = entry.model.definition;
  const solve = (raw) => {
    if (entry.engine === 'algorithm') {
      const result = runAlgorithm(id, raw);
      return {
        ...result,
        summary: { ...result.stats, steps: result.frames.length },
        series: result.frames.map((frame, x) => ({
          x,
          y: frame.stats?.comparisons ?? frame.stats?.visits ?? x,
        })),
      };
    }
    const checked = validate(definition, raw);
    if (!checked.values) throw new Error(checked.message);
    return entry.model.solve(checked.values);
  };
  return {
    definition,
    solve,
    validate: (raw) =>
      entry.engine === 'algorithm' ? validateAlgorithm(id, raw) : validate(definition, raw),
  };
}

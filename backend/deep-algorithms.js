import { traceBuilder } from './deep-trace.js';
import { runStructure } from './deep-structures.js';
import { runString } from './deep-strings.js';
import { runOptimization } from './deep-optimization.js';
export function runDeep(id, input, definition) {
  const trace = traceBuilder(id, input, definition),
    runner = ['redblack', 'btree', 'skiplist', 'bloom'].includes(id)
      ? runStructure
      : ['zmatch', 'manacher', 'ahocorasick', 'suffixarray'].includes(id)
        ? runString
        : runOptimization;
  const result = runner(id, input, trace);
  return trace.finish(result);
}

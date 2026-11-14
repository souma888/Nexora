import { parameterSpace, applyParameters } from '../../backend/parameter-space.js';
import { resolveLab } from '../../backend/platform.js';
import { analyzeParameters, fitParameters } from '../../backend/numerical-tools.js';

self.onmessage = async ({ data }) => {
  const { token, model, input, task = 'solve', options = {} } = data;
  try {
    const { solve, definition } = resolveLab(model);
    const space = parameterSpace(definition, input),
      evaluate = (candidate) => solve(applyParameters(definition, input, candidate));
    options.integerKeys = Object.entries(space.fields)
      .filter(([, field]) => field.integer)
      .map(([key]) => key);
    let result;
    if (task === 'solve') result = solve(input);
    else if (task === 'analysis')
      result = analyzeParameters(evaluate, space.values, options.bounds, options.metric, options);
    else if (task === 'fit')
      result = fitParameters(evaluate, options.data, space.values, options.bounds, options.trace);
    else throw new Error('Unknown worker operation.');
    if (task === 'fit') result.input = applyParameters(definition, input, result.input);
    self.postMessage({ token, result });
  } catch (error) {
    self.postMessage({ token, error: error instanceof Error ? error.message : 'Solver failed.' });
  }
};

export const stateTable = (headers, rows, caption = 'Working state') => ({
  headers,
  rows,
  caption,
});
export const sequenceView = (values, active = []) => ({
  type: 'sequence',
  items: values.map((label, i) => ({ label, active: active.includes(i), detail: `index ${i}` })),
});
export const matrixView = (matrix, cell = [-1, -1]) => ({
  type: 'matrix',
  matrix,
  cell,
  rowLabels: matrix.map((_, i) => i),
  columnLabels: matrix[0]?.map((_, i) => i) ?? [],
});
export function traceBuilder(id, input, definition) {
  const frames = [],
    stats = { comparisons: 0, writes: 0, visits: 0 };
  return {
    stats,
    show: (line, message, view, table, state = {}) => {
      if (frames.length >= 4000) throw new Error('Trace frame limit exceeded.');
      frames.push(structuredClone({ line, message, view, stateTable: table, state, stats }));
    },
    finish: (result) => ({ model: id, version: definition.version, input, frames, result, stats }),
  };
}

import { additionalAlgorithms, validateAdditional } from './advanced-definitions.js';
import { dsaMore } from './dsa-more-definitions.js';
import { integer, list, invalid } from './algorithm-input.js';
export { AlgorithmInputError } from './algorithm-input.js';
const array = { values: '38, 12, 27, 8, 43, 19, 5, 31' };
const graph = {
  edges: '0,1,4; 0,2,2; 2,1,1; 1,3,5; 2,3,8; 2,4,10; 3,4,2; 4,5,3; 3,5,6',
  start: 0,
  goal: 5,
};
const define = (
  id,
  title,
  kind,
  description,
  complexity,
  space,
  lines,
  invariant,
  example,
  predict,
  answer,
  defaults = /** @type {Record<string,string|number>} */ (array),
) => ({
  id,
  title,
  kind,
  discipline: 'algorithms',
  version: '1.0',
  description,
  complexity,
  space,
  lines,
  invariant,
  example,
  predict,
  answer,
  defaults,
});

export const algorithms = {
  bubble: define(
    'bubble',
    'Bubble Sort',
    'sort',
    'Watch adjacent exchanges move the largest remaining value into its final position.',
    'O(n²) worst; O(n) best with early exit',
    'O(1) auxiliary',
    [
      'Repeat passes over the unsorted prefix',
      'Compare adjacent values',
      'Swap if the left value is larger',
      'Fix the final value; stop if no swaps occurred',
    ],
    'After each pass, the largest value of the unsorted prefix is in its final position. Equal values never swap, so this implementation is stable.',
    'For [3, 1, 2], the first pass makes [1, 2, 3]. A second comparison confirms that no further swap is needed.',
    'Which input produces the fewest comparisons?',
    ['Already sorted', 'Reverse sorted', 'They are always equal'],
  ),
  insertion: define(
    'insertion',
    'Insertion Sort',
    'sort',
    'Build a sorted prefix by shifting larger values and inserting one key at a time.',
    'O(n²) worst; O(n) best',
    'O(1) auxiliary',
    [
      'Take the next key from the unsorted suffix',
      'Compare the key with the preceding value',
      'Shift larger values one position right',
      'Place the key in the open position',
    ],
    'The prefix before the key is sorted. Shifts preserve the relative order of equal values. The key is held separately while the array has a temporary duplicate.',
    'For [3, 1, 2], insert 1 before 3, then insert 2 between 1 and 3.',
    'What happens when the input is already sorted?',
    ['No shifts are needed', 'Every value shifts', 'The algorithm fails'],
  ),
  selection: define(
    'selection',
    'Selection Sort',
    'sort',
    'Scan the remaining suffix for its minimum and place it at the next boundary.',
    'O(n²) in all cases',
    'O(1) auxiliary',
    [
      'Start the next position of the sorted prefix',
      'Find the minimum in the remaining suffix',
      'Update the candidate minimum',
      'Exchange the candidate with the boundary value',
    ],
    'The sorted prefix contains the smallest values. Long-distance swaps can change the order of equal keys, so this implementation is not stable.',
    '[3, 1, 2] uses three value comparisons and two exchanges to become [1, 2, 3].',
    'Does sorted input remove the suffix scans?',
    ['No', 'Yes', 'Only for odd lengths'],
  ),
  merge: define(
    'merge',
    'Merge Sort',
    'sort',
    'Follow bottom-up merge passes, using a temporary buffer to combine sorted runs.',
    'O(n log n)',
    'O(n) auxiliary',
    [
      'Start runs of width 1; double width each pass',
      'Compare the heads of two sorted runs',
      'Take the smaller head into a buffer',
      'Copy the merged run back to the array',
    ],
    'Each run is sorted before it is merged. Taking the left value on a tie preserves stability. The buffer is displayed while values are collected.',
    '[4, 1, 3, 2] becomes [1, 4, 2, 3] after width-1 merges, then [1, 2, 3, 4].',
    'What extra storage does merging require here?',
    ['A linear buffer', 'No extra storage', 'An n² table'],
  ),
  quick: define(
    'quick',
    'Quick Sort',
    'sort',
    'Partition around the last element and recursively sort the two sides.',
    'O(n log n) average; O(n²) worst',
    'O(log n) average stack; O(n) worst',
    [
      'Choose the last element as pivot',
      'Compare each element with the pivot',
      'Move values ≤ pivot to the left partition',
      'Place pivot at the boundary; recurse on both sides',
    ],
    'Lomuto partition keeps values ≤ pivot on the left. Sorted or equal inputs are worst cases for this fixed pivot choice. It is not stable.',
    'In [3, 1, 2], pivot 2 partitions the array into [1, 2, 3]; the pivot is now in its final position.',
    'Which input is a worst case for the last-element pivot?',
    ['Already sorted', 'Random distinct values', 'All have the same average cost'],
  ),
  heap: define(
    'heap',
    'Heap Sort',
    'sort',
    'Build a max heap, extract its root, and restore the heap after each extraction.',
    'O(n log n); heap construction O(n)',
    'O(1) auxiliary',
    [
      'Build a max heap from the last parent upward',
      'Compare the parent with its children',
      'Exchange with the larger child; continue sifting',
      'Swap the root with the end; shrink the heap',
    ],
    'Within the active heap, each parent is at least as large as its children. The extracted suffix is sorted. This implementation is not stable.',
    '[3, 1, 2] is already a max heap. Extracting 3, then 2, leaves [1, 2, 3].',
    'Where is the maximum in a max heap?',
    ['At index 0', 'At the final index', 'At an arbitrary leaf'],
  ),
  linear: define(
    'linear',
    'Linear Search',
    'search',
    'Inspect values in order until the first match or the end of the array.',
    'O(n) worst; O(1) best',
    'O(1) auxiliary',
    [
      'Start at index 0',
      'Compare the current value with the target',
      'Return the first matching index',
      'If the scan ends, report not found',
    ],
    'All earlier positions have been ruled out. No sorting is required. Indexes are zero-based and the first matching index is returned.',
    'In [8, 3, 5, 3], target 3 is found at index 1 after two comparisons.',
    'Can linear search work on an unsorted array?',
    ['Yes', 'No', 'Only with unique values'],
    { ...array, target: 19 },
  ),
  binary: define(
    'binary',
    'Binary Search',
    'search',
    'Halve a sorted search interval and follow the changing low, mid, and high indexes.',
    'O(log n) search; O(n log n) preprocessing',
    'O(n) sorted copy; O(1) search',
    [
      'Sort a copy; initialize low and high',
      'Compare the middle value with the target',
      'Discard the half that cannot contain the target',
      'Return a match or report an empty interval',
    ],
    'The array is sorted automatically before searching, and returned indexes refer to that sorted copy. With duplicates this version returns any matching index.',
    'In sorted [1, 3, 5, 8], target 5 is found at index 2 in two middle comparisons.',
    'Why can half the interval be discarded?',
    ['The array is ordered', 'The array is small', 'Every target is present'],
    { ...array, target: 19 },
  ),
  bfs: define(
    'bfs',
    'Breadth-First Search',
    'graph',
    'Explore a directed graph one frontier at a time with a FIFO queue.',
    'O(V + E)',
    'O(V) auxiliary',
    [
      'Enqueue the source and mark it discovered',
      'Dequeue the next node',
      'Inspect outgoing edges; enqueue undiscovered neighbors',
      'Recover a source-to-goal path through parents',
    ],
    'Nodes are discovered in nondecreasing edge distance from the source. Edge weights are ignored. The parent path has the fewest edges, not necessarily the lowest weight.',
    'On the default graph, the path 0 → 1 → 3 → 5 uses three edges. Neighbors follow the order in the edge list.',
    'Which frontier structure does BFS use?',
    ['A queue', 'A stack', 'A sorted array'],
    graph,
  ),
  dfs: define(
    'dfs',
    'Depth-First Search',
    'graph',
    'Use a stack to follow a branch before returning to other discovered nodes.',
    'O(V + E)',
    'O(V) auxiliary',
    [
      'Push the source and mark it discovered',
      'Follow the stack top; backtrack when its edges are exhausted',
      'Inspect the next outgoing edge; push an undiscovered neighbor',
      'Recover a parent path if the goal was reached',
    ],
    'Each stack entry remembers its next outgoing edge, matching recursive DFS in edge-list order. A node is marked when entered to prevent revisits. The parent path need not be shortest.',
    'On 0 → 1, 0 → 2, 1 → 3, DFS visits 0, 1, 3, 2 with the listed neighbor order.',
    'Does DFS guarantee a shortest path?',
    ['No', 'Yes', 'Only with six nodes'],
    graph,
  ),
  dijkstra: define(
    'dijkstra',
    'Dijkstra’s Shortest Path',
    'graph',
    'Settle the nearest tentative node and relax outgoing weighted edges.',
    'O(V² + E) with linear minimum selection',
    'O(V) auxiliary',
    [
      'Initialize source distance to 0 and others to ∞',
      'Settle the unvisited node with smallest distance',
      'Relax outgoing edges and update parents',
      'Repeat until no reachable nodes remain; recover path',
    ],
    'With nonnegative edge weights, a settled distance is final. This small-graph implementation scans six nodes instead of using a heap; ties use node number.',
    'Default shortest path: 0 → 2 → 1 → 3 → 4 → 5, total weight 13.',
    'Which edge weights invalidate this guarantee?',
    ['Negative weights', 'Zero weights', 'Positive weights'],
    graph,
  ),
  bellman: define(
    'bellman',
    'Bellman–Ford',
    'graph',
    'Relax every edge in passes, then check for a reachable negative cycle.',
    'O(VE)',
    'O(V) auxiliary',
    [
      'Initialize source distance to 0 and others to ∞',
      'Relax every edge for up to V − 1 passes',
      'Stop early if a full pass changes nothing',
      'Check one extra pass for a reachable negative cycle',
    ],
    'Negative edge weights are allowed. A reachable negative cycle makes shortest walks undefined for affected destinations; this lab reports that condition instead of a path.',
    'Edges 0,1,4; 0,2,5; 1,2,-2 give distance 2 from node 0 to node 2.',
    'What requires an extra cycle check?',
    ['Negative-weight cycles', 'All positive edges', 'Unreachable nodes'],
    graph,
  ),
  astar: define(
    'astar',
    'A* Pathfinding',
    'graph',
    'Guide a shortest-path search using an admissible geometric heuristic.',
    'O(V² + E) with linear frontier selection',
    'O(V) auxiliary',
    [
      'Set source g = 0; compute h from geometry',
      'Choose the open node with smallest f = g + h',
      'Relax neighbors and update g and parents',
      'Stop when the goal is settled or the frontier is empty',
    ],
    'h(v) = c × Euclidean distance to goal; c is the minimum weight/edge-length ratio. This makes h consistent for every nonnegative directed edge. A zero edge can reduce h to zero.',
    'On the default graph, A* finds the same cost-13 path as Dijkstra. Displayed f includes the remaining-cost estimate.',
    'For optimality, the heuristic must avoid what?',
    ['Overestimating the remaining cost', 'Using geometry', 'Returning zero'],
    graph,
  ),
  knapsack: define(
    'knapsack',
    '0/1 Knapsack',
    'dp',
    'Fill a dynamic-programming table and trace which items fit the best-value solution.',
    'O(nC)',
    'O(nC) table',
    [
      'Initialize row 0 and capacity 0 to zero',
      'For each item and capacity, copy the exclude value',
      'If it fits, compare with value + previous-row remainder',
      'Backtrack from the last cell to recover chosen items',
    ],
    'dp[i][c] is the greatest value using the first i items with capacity at most c. Each item can be used once. Ties prefer excluding the current item.',
    'Weights [2, 3, 4], values [3, 4, 5], capacity 5 choose items 0 and 1 for value 7.',
    'Why read the previous row when including an item?',
    ['To use each item at most once', 'To sort the weights', 'To allow unlimited copies'],
    { weights: '2, 3, 4', values: '3, 4, 5', capacity: 5 },
  ),
  gcd: define(
    'gcd',
    'Euclidean GCD',
    'number',
    'Replace the pair by divisor and remainder until the remainder is zero.',
    'O(log min(a,b)) division steps for positive inputs',
    'O(1) auxiliary',
    [
      'Start with nonnegative integers a and b',
      'While b ≠ 0, compute remainder a mod b',
      'Replace (a, b) with (b, remainder)',
      'When b = 0, return a',
    ],
    'gcd(a,b) = gcd(b, a mod b). The nonzero divisor decreases each iteration. One zero input is allowed; gcd(0,0) is excluded.',
    '48 = 2×18 + 12; 18 = 1×12 + 6; 12 = 2×6 + 0, so gcd(48,18) = 6.',
    'What happens to the GCD after a remainder step?',
    ['It stays the same', 'It halves', 'It becomes the remainder'],
    { a: 48, b: 18 },
  ),
  ...additionalAlgorithms,
  ...dsaMore,
};

export const coordinates = [
  [55, 100],
  [195, 45],
  [195, 160],
  [345, 45],
  [345, 160],
  [490, 100],
];

// Discoverable API schema; the pure validator below enforces these same bounds.
for (const definition of Object.values(algorithms)) {
  if (definition.engine === 'extended') continue;
  const integerSchema = (min, max) => ({ type: 'integer', min, max, unit: '' });
  const listSchema = (maxItems, min, max) => ({
    type: 'string',
    format: 'comma-separated-integers',
    minItems: 1,
    maxItems,
    itemMin: min,
    itemMax: max,
    unit: '',
  });
  definition.inputs =
    definition.kind === 'sort' || definition.kind === 'search'
      ? {
          values: listSchema(16, -99, 99),
          ...(definition.kind === 'search' ? { target: integerSchema(-99, 99) } : {}),
        }
      : definition.kind === 'graph'
        ? {
            edges: {
              type: 'string',
              format: 'from,to,weight; from,to,weight',
              maxItems: 24,
              nodeMin: 0,
              nodeMax: 5,
              weightMin: definition.id === 'bellman' ? -9 : 0,
              weightMax: 20,
              directed: true,
              unique: true,
              selfLoops: false,
            },
            start: integerSchema(0, 5),
            goal: integerSchema(0, 5),
          }
        : definition.kind === 'dp'
          ? {
              weights: listSchema(8, 1, 30),
              values: listSchema(8, 0, 99),
              capacity: integerSchema(1, 30),
            }
          : { a: integerSchema(0, 1000000), b: integerSchema(0, 1000000) };
  for (const [key, schema] of Object.entries(definition.inputs))
    schema.initial = definition.defaults[key];
}

export const workedExamples = {
  bubble: { values: '3, 1, 2' },
  insertion: { values: '3, 1, 2' },
  selection: { values: '3, 1, 2' },
  merge: { values: '4, 1, 3, 2' },
  quick: { values: '3, 1, 2' },
  heap: { values: '3, 1, 2' },
  linear: { values: '8, 3, 5, 3', target: 3 },
  binary: { values: '1, 3, 5, 8', target: 5 },
  dfs: { edges: '0,1,1; 0,2,1; 1,3,1', start: 0, goal: 3 },
  bellman: { edges: '0,1,4; 0,2,5; 1,2,-2', start: 0, goal: 2 },
};

export function validateAlgorithm(id, input) {
  if (!Object.hasOwn(algorithms, id)) invalid('model', 'Choose a supported algorithm.');
  if (algorithms[id].engine === 'extended') return validateAdditional(algorithms[id], input);
  const { kind } = algorithms[id];
  if (kind === 'sort' || kind === 'search') {
    const values = list(input?.values, 'values');
    return {
      values,
      ...(kind === 'search' ? { target: integer(input?.target, 'target', -99, 99) } : {}),
    };
  }
  if (kind === 'graph') {
    const edges = input?.edges;
    if (typeof edges !== 'string' || edges.length > 600)
      invalid('edges', 'Use edges in the form from,to,weight; from,to,weight.');
    const parts = edges.trim() ? edges.split(';') : [];
    if (parts.length > 24) invalid('edges', 'Use at most 24 directed edges.');
    const seen = new Set();
    const parsed = parts.map((part) => {
      const cells = part.split(',').map((s) => s.trim());
      if (cells.length !== 3) invalid('edges', 'Each edge needs three integers: from,to,weight.');
      const from = integer(cells[0], 'edges', 0, 5),
        to = integer(cells[1], 'edges', 0, 5);
      const weight = integer(cells[2], 'edges', id === 'bellman' ? -9 : 0, 20);
      if (from === to || seen.has(`${from},${to}`))
        invalid('edges', 'Use distinct directed edges between different nodes.');
      seen.add(`${from},${to}`);
      return { from, to, weight };
    });
    return {
      edges: parsed,
      start: integer(input?.start, 'start', 0, 5),
      goal: integer(input?.goal, 'goal', 0, 5),
    };
  }
  if (kind === 'dp') {
    const weights = list(input?.weights, 'weights', 8, 1, 30),
      values = list(input?.values, 'values', 8, 0, 99);
    if (weights.length !== values.length)
      invalid('values', 'Give each weight one corresponding value.');
    return { weights, values, capacity: integer(input?.capacity, 'capacity', 1, 30) };
  }
  const a = integer(input?.a, 'a', 0, 1000000),
    b = integer(input?.b, 'b', 0, 1000000);
  if (!a && !b) invalid('b', 'At least one input must be nonzero.');
  return { a, b };
}

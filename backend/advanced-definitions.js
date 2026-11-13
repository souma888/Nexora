import { integer, list, invalid } from './algorithm-input.js';

export const nums = (label = 'Array values', min = -99, max = 99, maxItems = 16) => ({
  label,
  type: 'list',
  min,
  max,
  maxItems,
});
export const int = (label, min, max) => ({ label, type: 'integer', min, max });
const text = (label, maxLength = 48, pattern = '^[A-Za-z0-9 ]+$') => ({
  label,
  type: 'text',
  maxLength,
  pattern,
});
const commands = (ops) => ({ label: 'Operations', type: 'commands', commands: ops, maxItems: 24 });
export const edges = (directed, min = 0) => ({
  label: `${directed ? 'Directed' : 'Undirected'} edges (from,to,weight)`,
  type: 'edges',
  directed,
  min,
  max: 20,
  maxItems: 24,
});
const values = '8, 3, 10, 1, 6, 14, 4, 7';
const network = '0,1,4; 0,2,2; 1,2,1; 1,3,5; 2,3,8; 2,4,10; 3,4,2; 4,5,3; 3,5,6';
export const make = (
  id,
  title,
  kind,
  topic,
  defaults,
  inputs,
  description,
  complexity,
  space,
  lines,
  invariant,
  example,
  predict,
  answer,
  presets = {},
) => ({
  id,
  title,
  kind,
  topic,
  discipline: 'algorithms',
  engine: 'extended',
  version: '1.0',
  defaults,
  inputs: Object.fromEntries(
    Object.entries(inputs).map(([key, schema]) => [key, { ...schema, initial: defaults[key] }]),
  ),
  description,
  complexity,
  space,
  lines,
  invariant,
  example,
  predict,
  answer,
  presets,
  help: Object.entries(inputs)
    .map(
      ([_key, s]) =>
        `${s.label}: ${
          s.type === 'commands'
            ? `up to 24 operations, separated by semicolons (${Object.entries(s.commands)
                .map(
                  ([op, n]) =>
                    `${op}${n ? ' ' + Array.from({ length: n }, (_, i) => `arg${i + 1}`).join(' ') : ''}`,
                )
                .join('; ')})`
            : s.type === 'list'
              ? `1–${s.maxItems} comma-separated integers, ${s.min} to ${s.max}`
              : s.type === 'edges'
                ? 'six nodes (0–5); up to 24 distinct edges, separated by semicolons; weights ' +
                  s.min +
                  ' to 20'
                : s.type === 'integer'
                  ? `${s.min}–${s.max}`
                  : s.type === 'words'
                    ? '1–8 lowercase words, each 1–8 letters, separated by commas'
                    : `1–${s.maxLength} ASCII characters`
        }.`,
    )
    .join(' '),
});

export const additionalAlgorithms = {
  stack: make(
    'stack',
    'Stack Operations',
    'structure',
    'Stacks & queues',
    { operations: 'push 8; push 3; peek; pop; push 5' },
    { operations: commands({ push: 1, pop: 0, peek: 0 }) },
    'Trace push, pop, and peek on a last-in, first-out stack.',
    'O(1) per operation',
    'O(n) storage',
    [
      'Start with an empty stack',
      'Read the next operation',
      'Push at the top, or inspect/remove the top',
      'Report the remaining bottom-to-top sequence',
    ],
    'Only the top can be removed. Popping or peeking an empty stack reports underflow without changing state. Values are integers −99 to 99.',
    'push 8; push 3; pop leaves [8]. In the default sequence, the final stack is [8, 5].',
    'Which value leaves first after pushing 8 then 3?',
    ['3', '8', 'Both at once'],
    { Underflow: { operations: 'pop; push 4; pop; peek' } },
  ),
  queue: make(
    'queue',
    'Queue Operations',
    'structure',
    'Stacks & queues',
    { operations: 'enqueue 8; enqueue 3; front; dequeue; enqueue 5' },
    { operations: commands({ enqueue: 1, dequeue: 0, front: 0 }) },
    'Follow front and rear as a FIFO queue receives and serves values.',
    'O(1) enqueue/dequeue with head and tail links',
    'O(n) storage',
    [
      'Start with an empty queue',
      'Read the next operation',
      'Append at the rear or inspect/remove the front',
      'Report the front-to-rear sequence',
    ],
    'The oldest value leaves first. Empty removals report underflow. The trace uses arrays as snapshots; their copying cost is excluded from the linked-queue model.',
    'Enqueue 8, enqueue 3, dequeue, enqueue 5 leaves [3, 5].',
    'Which value is served first?',
    ['The oldest', 'The newest', 'The largest'],
    { Underflow: { operations: 'dequeue; enqueue 4; dequeue; front' } },
  ),
  deque: make(
    'deque',
    'Double-Ended Queue',
    'structure',
    'Stacks & queues',
    { operations: 'pushfront 8; pushback 3; pushfront 5; popback; front' },
    {
      operations: commands({
        pushfront: 1,
        pushback: 1,
        popfront: 0,
        popback: 0,
        front: 0,
        back: 0,
      }),
    },
    'Insert and remove at either end while preserving the order between them.',
    'O(1) per end operation with double links',
    'O(n) storage',
    [
      'Initialize front and back',
      'Choose the requested end',
      'Insert, remove, or inspect at that end',
      'Report the remaining order',
    ],
    'A deque exposes both ends, unlike a stack or FIFO queue. Underflow is an observable event; no value is removed from an empty deque.',
    'pushfront 8; pushback 3; pushfront 5; popback leaves [5, 8].',
    'Which ends support removal?',
    ['Both ends', 'Only the front', 'Only the back'],
  ),
  circularqueue: make(
    'circularqueue',
    'Circular Queue Buffer',
    'structure',
    'Stacks & queues',
    { capacity: 4, operations: 'enqueue 8; enqueue 3; enqueue 5; dequeue; enqueue 9; enqueue 2' },
    {
      capacity: int('Buffer capacity', 1, 8),
      operations: commands({ enqueue: 1, dequeue: 0, front: 0 }),
    },
    'Watch head and tail wrap around a fixed-capacity ring buffer.',
    'O(1) per operation',
    'O(C) fixed storage',
    [
      'Allocate C slots; head=0, size=0',
      'Compute rear=(head+size) mod C',
      'Insert at rear or remove at head; enforce capacity',
      'Show occupied slots and logical FIFO order',
    ],
    'Size distinguishes full from empty even when head and rear coincide. Overflow rejects the incoming value; underflow preserves the buffer.',
    'The default capacity-4 trace wraps rear to slot 0 and finishes with logical order [3, 5, 9, 2].',
    'How do indexes wrap?',
    ['Modulo capacity', 'By clearing the buffer', 'By doubling the index'],
    {
      Overflow: { capacity: 2, operations: 'enqueue 1; enqueue 2; enqueue 3; dequeue; enqueue 4' },
    },
  ),
  linkedlist: make(
    'linkedlist',
    'Singly Linked List',
    'structure',
    'Linked lists',
    { operations: 'append 8; prepend 3; insert 1 5; delete 0; find 8' },
    { operations: commands({ append: 1, prepend: 1, insert: 2, delete: 1, find: 1 }) },
    'Follow next links while inserting, deleting by index, and searching by value.',
    'O(n) indexed access/search; O(1) prepend',
    'O(n) storage',
    [
      'Start with head=null',
      'Walk next links to the requested position',
      'Reconnect links for insert/delete or compare a value',
      'Report values from head to null',
    ],
    'Indexes are zero-based. insert takes index then value; delete takes index. An invalid index is reported as an event and leaves the list unchanged.',
    'append 8; prepend 3; insert 1 5; delete 0 leaves [5, 8].',
    'Can a next link take you backward?',
    ['No', 'Yes', 'Only at the head'],
  ),
  doublylinked: make(
    'doublylinked',
    'Doubly Linked List',
    'structure',
    'Linked lists',
    { operations: 'append 8; append 3; prepend 5; delete 1; reverse; find 3' },
    { operations: commands({ append: 1, prepend: 1, delete: 1, reverse: 0, find: 1 }) },
    'Track both previous and next links, including reversal of the whole list.',
    'O(n) indexed lookup/reverse; O(1) end insertion',
    'O(n) storage',
    [
      'Start with head=tail=null',
      'Locate the affected node',
      'Update both directions, or swap every link on reverse',
      'Check head/tail and list order',
    ],
    'Every neighboring pair has reciprocal links. delete uses a zero-based index. Reversal exchanges previous/next and head/tail. The display exposes both directions.',
    'The default trace builds [5, 8, 3], removes index 1, then reverses to [3, 5].',
    'What must change when reversing the list?',
    ['Both links and head/tail', 'Only the values', 'Only the head'],
  ),
  bst: make(
    'bst',
    'Binary Search Tree',
    'tree',
    'Search trees',
    { values, target: 7 },
    { values: nums('Insertion order'), target: int('Search value', -99, 99) },
    'Build an unbalanced search tree and trace a root-to-key lookup.',
    'O(h) per insert/search; h can be n',
    'O(n) storage',
    [
      'Begin at the root for each key',
      'Compare: smaller left, larger right',
      'Attach a leaf; ignore an existing key',
      'Search and read the in-order traversal',
    ],
    'All keys in a left subtree are smaller than its node; right keys are larger. Duplicate keys are ignored. Sorted insertions can create a chain.',
    'Insert [8, 3, 10, 1, 6, 14, 4, 7]. Search 7 follows 8 → 3 → 6 → 7.',
    'What can sorted insertions do to an unbalanced BST?',
    ['Create a chain', 'Guarantee balance', 'Remove the root'],
    {
      'Sorted keys': { values: '1, 2, 3, 4, 5, 6, 7', target: 7 },
      'Duplicate keys': { values: '5, 3, 5, 3, 7', target: 4 },
    },
  ),
  avl: make(
    'avl',
    'AVL Tree Rotations',
    'tree',
    'Search trees',
    { values: '30, 20, 10, 25, 28, 40, 50', target: 28 },
    { values: nums('Insertion order'), target: int('Search value', -99, 99) },
    'Observe single and double rotations restore height balance after insertion.',
    'O(log n) per insert/search',
    'O(n) storage',
    [
      'Insert as in a binary search tree',
      'Recompute heights; inspect ancestor balance',
      'Rotate at the first unbalanced subtree',
      'Search the balanced tree',
    ],
    'Balance is height(left) − height(right), with empty height 0. Every completed insertion restores |balance| ≤ 1. Rotations preserve in-order key order; duplicates are ignored.',
    '[30, 20, 10] triggers a right rotation, making 20 the root. [30, 10, 20] triggers left-right rotations.',
    'What does a rotation preserve?',
    ['In-order key order', 'Every node’s depth', 'The old root'],
    {
      'Left-right rotation': { values: '30, 10, 20', target: 20 },
      'Right-left rotation': { values: '10, 30, 20', target: 20 },
    },
  ),
  minheap: make(
    'minheap',
    'Min-Heap Priority Queue',
    'tree',
    'Heaps',
    { values: '9, 4, 7, 1, 3, 8', extracts: 3 },
    { values: nums('Values to insert'), extracts: int('Extract-min operations', 0, 16) },
    'Build a min heap by sifting up, then extract roots and sift replacements down.',
    'O(log n) per insertion/extraction',
    'O(n) storage',
    [
      'Append the next key at the final leaf',
      'Sift up while smaller than its parent',
      'Extract the root and sift its replacement down',
      'Report the heap and extraction order',
    ],
    'The array represents a complete binary tree: children are 2i+1 and 2i+2. Every parent is ≤ its children after an operation. Extra extracts report underflow.',
    'Insert [9, 4, 7, 1, 3, 8]; three extracts return [1, 3, 4].',
    'Which value is always at the root?',
    ['The minimum', 'The latest inserted', 'The maximum'],
  ),
  hashchain: make(
    'hashchain',
    'Hash Table: Chaining',
    'structure',
    'Hash tables',
    { values: '10, 17, 24, 5, 12', capacity: 7, target: 24 },
    {
      values: nums('Keys to insert'),
      capacity: int('Bucket count', 3, 13),
      target: int('Search key', -99, 99),
    },
    'Hash integer keys into buckets and follow a collision chain during lookup.',
    'Expected O(1+load); O(n) worst per operation',
    'O(n + m) storage',
    [
      'Allocate m empty buckets',
      'Compute h(k)=((k mod m)+m) mod m',
      'Append a new key to its collision chain',
      'Search the selected chain by equality',
    ],
    'Distinct keys sharing a hash remain in the same bucket. Duplicate insertions are ignored. The simple modulo hash is educational and can cluster badly.',
    '10, 17, and 24 all hash to bucket 3 with seven buckets. Searching 24 compares three keys.',
    'Can different keys share a bucket?',
    ['Yes', 'No', 'Only negative keys'],
  ),
  hashlinear: make(
    'hashlinear',
    'Hash Table: Linear Probing',
    'structure',
    'Hash tables',
    { values: '10, 17, 24, 5, 12', capacity: 7, target: 24 },
    {
      values: nums('Keys to insert'),
      capacity: int('Slot count', 3, 13),
      target: int('Search key', -99, 99),
    },
    'Resolve collisions by probing consecutive slots, including wraparound and a full table.',
    'Expected O(1) at low load; O(m) worst per operation',
    'O(m) storage',
    [
      'Allocate m empty slots',
      'Start at the normalized modulo hash',
      'Probe (h+i) mod m until equal or empty',
      'Reject overflow; search with the same probe sequence',
    ],
    'There is no deletion in this lab, so a search may stop at an empty slot. Full-table probes stop after m checks. Duplicates occupy one slot.',
    'With capacity 7, keys 10,17,24 fill slots 3,4,5; key 5 then probes to slot 6.',
    'What happens after probing the last slot?',
    ['Wrap to slot 0', 'Overwrite slot 0', 'Resize automatically'],
    { 'Full table': { values: '0, 3, 6, 9', capacity: 3, target: 9 } },
  ),
  dsu: make(
    'dsu',
    'Disjoint Set Union',
    'tree',
    'Union–find',
    {
      size: 6,
      operations: 'union 0 1; union 2 3; union 1 3; find 3; connected 0 2; connected 0 5',
    },
    {
      size: int('Number of elements', 2, 10),
      operations: commands({ union: 2, find: 1, connected: 2 }),
    },
    'Join components by rank and flatten parent paths during find operations.',
    'O(α(n)) amortized per operation',
    'O(n) storage',
    [
      'Create one parent root per element',
      'Find roots; compress traversed parent links',
      'Union distinct roots by rank',
      'Answer root or connectivity queries',
    ],
    'Each component is a rooted parent forest. Only roots are linked during union. Equal ranks increase the surviving root’s rank; path compression preserves membership.',
    'union 0 1; union 2 3; union 1 3 connects 0,1,2,3. Element 5 remains separate.',
    'What does path compression change?',
    ['Parent paths, not membership', 'Component membership', 'The number of elements'],
  ),
  trie: make(
    'trie',
    'Trie Prefix Search',
    'tree',
    'Strings & tries',
    { words: 'cat, car, cart, dog', prefix: 'ca' },
    {
      words: { label: 'Words to insert', type: 'words' },
      prefix: text('Prefix to find', 8, '^[a-z]+$'),
    },
    'Share character paths across words and enumerate completions of a prefix.',
    'O(total inserted letters + prefix + output traversal)',
    'O(total inserted letters) storage',
    [
      'Start with an empty root',
      'Follow/create one edge per character',
      'Mark word ends; follow the query prefix',
      'Collect terminal descendants of the prefix',
    ],
    'Only lowercase a–z words are accepted. A terminal marker distinguishes a complete word from an internal prefix. Duplicate words share one terminal node.',
    'cat, car, cart, dog with prefix ca returns car, cart, cat in lexicographic order.',
    'Is every existing prefix a complete word?',
    ['No', 'Yes', 'Only at the root'],
    { 'Missing prefix': { words: 'cat, car, dog', prefix: 'z' } },
  ),
  fenwick: make(
    'fenwick',
    'Fenwick Tree Prefix Sums',
    'tree',
    'Range queries',
    { values: '2, 1, 5, 3, 4, 6', index: 2, delta: 3, query: 4 },
    {
      values: nums(),
      index: int('Update index (zero-based)', 0, 15),
      delta: int('Amount to add', -20, 20),
      query: int('Prefix end (inclusive)', 0, 15),
    },
    'Build a binary indexed tree, update one value, and trace an inclusive prefix sum.',
    'O(n log n) build; O(log n) update/query',
    'O(n) storage',
    [
      'Build one-based tree sums from the input',
      'Add delta at index+1; advance by lowbit',
      'Query from end+1; subtract lowbit',
      'Report visited blocks and the prefix total',
    ],
    'Tree slot i covers [i−lowbit(i)+1, i] in one-based coordinates. The form uses zero-based array indexes. Negative values and updates are allowed.',
    '[2,1,5,3,4,6], add 3 at index 2: prefix through index 4 becomes 18.',
    'Which bit operation selects a block size?',
    ['i & −i', 'i + 1', 'i × 2'],
  ),
  segment: make(
    'segment',
    'Segment Tree Range Sums',
    'tree',
    'Range queries',
    { values: '2, 1, 5, 3, 4, 6', index: 2, value: 8, left: 1, right: 4 },
    {
      values: nums(),
      index: int('Update index (zero-based)', 0, 15),
      value: int('Replacement value', -99, 99),
      left: int('Range start (inclusive)', 0, 15),
      right: int('Range end (inclusive)', 0, 15),
    },
    'Update a leaf, recompute ancestor sums, and combine disjoint query intervals.',
    'O(n) build; O(log n) point update/range sum',
    'O(n) storage',
    [
      'Split intervals until each leaf stores one value',
      'Replace the selected leaf and recompute ancestors',
      'Skip disjoint nodes; take fully covered nodes',
      'Add the selected interval sums',
    ],
    'Every internal sum equals its two children. Query bounds are inclusive and zero-based. Fully covered intervals can be used without descending further.',
    'Replace index 2 by 8 in [2,1,5,3,4,6]. Sum over indexes 1 through 4 is 16.',
    'When can a node answer without visiting its children?',
    ['When fully covered', 'When disjoint', 'Only at the root'],
  ),
  counting: make(
    'counting',
    'Counting Sort',
    'sort-extra',
    'Sorting',
    { values: '4, -2, 2, 4, 1, -2, 0' },
    { values: nums('Array values', -20, 20) },
    'Count signed integer keys, form cumulative counts, and place values stably into output.',
    'O(n + k), k is key range',
    'O(n + k) auxiliary',
    [
      'Count each key using a minimum-value offset',
      'Convert counts to cumulative positions',
      'Scan input right-to-left; place at --position[key]',
      'Read the completed output',
    ],
    'This bounded integer sort avoids pairwise key comparisons. Right-to-left placement preserves equal-key order. Keys are restricted to −20 through 20.',
    '[4,-2,2,4,1,-2,0] becomes [-2,-2,0,1,2,4,4].',
    'Why scan input from right to left during placement?',
    ['To preserve stability', 'To reverse the result', 'To avoid counting'],
  ),
  radix: make(
    'radix',
    'LSD Radix Sort',
    'sort-extra',
    'Sorting',
    { values: '170, 45, 75, 90, 802, 24, 2, 66' },
    { values: nums('Nonnegative values', 0, 999) },
    'Distribute values into stable digit buckets from units to hundreds.',
    'O(d(n + 10))',
    'O(n + 10) auxiliary',
    [
      'Start with the units digit',
      'Append values to buckets 0–9 in input order',
      'Concatenate buckets in digit order',
      'Advance a digit until the largest key is exhausted',
    ],
    'Each pass must be stable so previously ordered lower digits remain ordered. This lab accepts nonnegative integers up to 999; leading digits are zero.',
    '[170,45,75,90,802,24,2,66] sorts to [2,24,45,66,75,90,170,802].',
    'What must every digit pass preserve?',
    ['Relative order within a bucket', 'Original global order', 'Only the largest key'],
  ),
  shell: make(
    'shell',
    'Shell Sort',
    'sort-extra',
    'Sorting',
    { values: '9, 8, 3, 7, 5, 6, 4, 1' },
    { values: nums() },
    'Perform gapped insertion passes and finish with ordinary insertion sort.',
    'O(n²) worst for halving gaps',
    'O(1) auxiliary',
    [
      'Choose gap=floor(n/2)',
      'Insert each key into its gap-separated subsequence',
      'Halve the gap',
      'Finish after the gap-1 pass',
    ],
    'After a gap pass, each gap-spaced subsequence is sorted. The final gap is 1. This halving-gap implementation is not stable.',
    'Eight values use gaps 4, 2, 1. The default result is [1,3,4,5,6,7,8,9].',
    'Which gap guarantees the final array is sorted?',
    ['1', '2', 'The first gap'],
  ),
  topological: make(
    'topological',
    'Topological Sort: Kahn',
    'graph-extra',
    'Directed graphs',
    { edges: '0,1,1; 0,2,1; 1,3,1; 2,3,1; 3,4,1; 4,5,1' },
    { edges: edges(true) },
    'Remove zero-indegree nodes and detect when a directed cycle blocks ordering.',
    'O(V + E)',
    'O(V) auxiliary',
    [
      'Compute every node’s indegree',
      'Queue all zero-indegree nodes in numeric order',
      'Remove a node; decrement outgoing neighbors',
      'If fewer than V nodes are removed, report a cycle',
    ],
    'Every emitted node precedes all its outgoing neighbors. All six nodes participate, including isolated nodes. Edge weights are ignored; multiple valid orders may exist.',
    'The default DAG emits [0,1,2,3,4,5]. Adding 5 → 3 creates a cycle.',
    'What does an empty queue with unprocessed nodes indicate?',
    ['A directed cycle', 'A unique ordering', 'A completed sort'],
    { Cycle: { edges: '0,1,1; 1,2,1; 2,0,1; 3,4,1' } },
  ),
  kruskal: make(
    'kruskal',
    'Kruskal’s Minimum Spanning Forest',
    'graph-extra',
    'Minimum spanning trees',
    { edges: network },
    { edges: edges(false) },
    'Consider edges by weight and reject those joining nodes already in one component.',
    'O(E log E + E α(V))',
    'O(V + E) auxiliary',
    [
      'Sort undirected edges by weight, then endpoints',
      'Find both endpoints’ components',
      'Take the edge only if the roots differ',
      'Report the forest, total weight and component count',
    ],
    'Chosen edges stay acyclic. Disconnected graphs produce a minimum spanning forest, including isolated nodes. Input lists each undirected pair once.',
    'The default six-node graph has a spanning tree with total weight 13.',
    'Why reject an edge whose endpoints already share a root?',
    ['It creates a cycle', 'Its weight is always negative', 'It disconnects the graph'],
  ),
  prim: make(
    'prim',
    'Prim’s Minimum Spanning Forest',
    'graph-extra',
    'Minimum spanning trees',
    { edges: network },
    { edges: edges(false) },
    'Grow each component using the cheapest connection to an unvisited node.',
    'O(V² + E) with linear key selection',
    'O(V + E) auxiliary',
    [
      'Set keys to infinity; start the smallest unvisited root',
      'Choose the unvisited node with minimum key',
      'Relax incident edges to improve neighbor keys',
      'Start another component when no finite keys remain',
    ],
    'Each selected non-root node adds its cheapest edge crossing the current cut. A disconnected input starts a new root; the result is a minimum spanning forest.',
    'The default graph reaches all six nodes and has total tree weight 13, matching Kruskal.',
    'What does a finite key represent?',
    ['A cheapest known crossing edge', 'Distance from the root', 'A node’s degree'],
  ),
  floyd: make(
    'floyd',
    'Floyd–Warshall All-Pairs Paths',
    'graph-extra',
    'Shortest paths',
    { edges: '0,1,3; 0,2,8; 1,2,2; 2,3,1; 3,4,4; 4,5,2; 0,5,20' },
    { edges: edges(true, -9) },
    'Improve a distance matrix by admitting one intermediate vertex at a time.',
    'O(V³)',
    'O(V²) auxiliary',
    [
      'Initialize diagonal zero and direct edge weights',
      'Choose the next intermediate k',
      'Set D[i,j]=min(D[i,j], D[i,k]+D[k,j])',
      'Inspect the final matrix and negative diagonal entries',
    ],
    'After phase k, paths may use intermediate vertices 0…k. Infinity means unreachable. A negative diagonal indicates a negative cycle; finite shortest paths are then not reported as valid.',
    'The default graph gives distance 12 from node 0 to node 5 via 0→1→2→3→4→5.',
    'What reveals a negative cycle?',
    ['A negative diagonal entry', 'An infinite entry', 'Any negative edge'],
  ),
  kmp: make(
    'kmp',
    'Knuth–Morris–Pratt Search',
    'string',
    'String matching',
    { text: 'ABABABCABABABC', pattern: 'ABABC' },
    { text: text('Text'), pattern: text('Pattern', 16) },
    'Build the longest-prefix-suffix table and reuse matched prefixes after a mismatch.',
    'O(n + m)',
    'O(m) auxiliary',
    [
      'Build LPS: longest proper prefix also a suffix',
      'Compare text[i] with pattern[j]',
      'On mismatch, fall back to LPS[j−1] without rewinding i',
      'Record matches, including overlapping matches',
    ],
    'LPS contains proper prefix lengths. Search is case-sensitive and supports spaces. Pattern and text must be nonempty; overlapping matches are included.',
    'ABABABCABABABC contains ABABC at zero-based offsets 2 and 9.',
    'What can KMP reuse after a mismatch?',
    ['An already matched prefix', 'The next unrelated word', 'Only the first character'],
  ),
  rabinkarp: make(
    'rabinkarp',
    'Rabin–Karp Rolling Hash',
    'string',
    'String matching',
    { text: 'ABABABCABABABC', pattern: 'ABABC' },
    { text: text('Text'), pattern: text('Pattern', 16) },
    'Roll a polynomial window hash and verify characters whenever hashes agree.',
    'O(n+m) expected; O(nm) worst',
    'O(1) auxiliary excluding matches',
    [
      'Hash pattern and first window with base 31, modulus 101',
      'Compare window and pattern hashes',
      'Verify every character on a hash hit',
      'Roll: remove old leading code, shift and add new code',
    ],
    'Small modulus 101 deliberately permits collisions; equality is always checked before accepting a match. Matching is case-sensitive and includes overlaps.',
    'The default text/pattern produce offsets [2,9]. A matching hash alone never proves equality.',
    'What must happen after two hashes match?',
    ['Verify the characters', 'Accept immediately', 'Skip the next window'],
  ),
  lcs: make(
    'lcs',
    'Longest Common Subsequence',
    'dp-extra',
    'Dynamic programming',
    { first: 'ABCBDAB', second: 'BDCABA' },
    { first: text('First sequence', 12), second: text('Second sequence', 12) },
    'Fill prefix lengths and backtrack a common subsequence without requiring contiguity.',
    'O(nm)',
    'O(nm) table',
    [
      'Initialize row 0 and column 0 to zero',
      'Equal letters: take diagonal + 1',
      'Otherwise take max(top, left)',
      'Backtrack; ties prefer the upper cell',
    ],
    'dp[i,j] is the LCS length of prefixes of lengths i and j. A subsequence preserves order but can skip letters. Multiple optimal sequences may exist.',
    'ABCBDAB and BDCABA have LCS length 4; BCBA is one valid solution.',
    'Must a subsequence be contiguous?',
    ['No', 'Yes', 'Only when length is four'],
  ),
  editdistance: make(
    'editdistance',
    'Levenshtein Edit Distance',
    'dp-extra',
    'Dynamic programming',
    { first: 'kitten', second: 'sitting' },
    { first: text('Source string', 12), second: text('Target string', 12) },
    'Compare insertion, deletion, and substitution costs, then recover an edit alignment.',
    'O(nm)',
    'O(nm) table',
    [
      'Initialize empty-prefix insertion/deletion costs',
      'Keep equal letters at no cost',
      'Otherwise take 1 + min(delete, insert, substitute)',
      'Backtrack an optimal source-to-target alignment',
    ],
    'All three edit types cost one; matching costs zero. The strings are case-sensitive. The final alignment uses a dash for gaps.',
    'kitten → sitting costs 3: substitute k→s, substitute e→i, and insert g.',
    'What is the cost of keeping an equal character?',
    ['Zero', 'One', 'Two'],
  ),
  coinchange: make(
    'coinchange',
    'Minimum Coin Change',
    'dp-extra',
    'Dynamic programming',
    { coins: '1, 3, 4', amount: 6 },
    { coins: nums('Coin denominations', 1, 20, 8), amount: int('Target amount', 0, 40) },
    'Find the fewest coins with unlimited copies, including cases where greedy choice fails.',
    'O(amount × denominations)',
    'O(amount) auxiliary',
    [
      'Set dp[0]=0; all other amounts to infinity',
      'For each amount, try every denomination that fits',
      'Improve dp[a] from 1+dp[a−coin]',
      'Backtrack coins, or report an unreachable amount',
    ],
    'Each denomination can be reused without limit. Duplicate denominations are removed. Greedy largest-first selection is not generally optimal.',
    'Coins [1,3,4] and amount 6 require two coins [3,3]; greedy [4,1,1] uses three.',
    'Can largest-first greedy always find the minimum?',
    ['No', 'Yes', 'Only when a 1 coin exists'],
    { Unreachable: { coins: '4, 6', amount: 7 } },
  ),
  lis: make(
    'lis',
    'Longest Increasing Subsequence',
    'array-extra',
    'Dynamic programming',
    { values: '10, 9, 2, 5, 3, 7, 18' },
    { values: nums() },
    'Track the best increasing subsequence ending at each index and recover its predecessors.',
    'O(n²)',
    'O(n) auxiliary',
    [
      'Initialize every ending length to 1',
      'Compare each earlier value with the current value',
      'Extend only from a strictly smaller value',
      'Follow predecessor links from the best ending',
    ],
    'Increasing means strictly increasing, so equal values do not extend a sequence. Ties retain the first predecessor found. The result need not be contiguous.',
    '[10,9,2,5,3,7,18] has LIS length 4, such as [2,5,7,18].',
    'Can an equal value extend a strictly increasing subsequence?',
    ['No', 'Yes', 'Only at index zero'],
  ),
  kadane: make(
    'kadane',
    'Kadane’s Maximum Subarray',
    'array-extra',
    'Array algorithms',
    { values: '-2, 1, -3, 4, -1, 2, 1, -5, 4' },
    { values: nums() },
    'Choose between extending the current run and starting again to find a maximum-sum interval.',
    'O(n)',
    'O(1) auxiliary',
    [
      'Start with the first value as current and best',
      'Choose max(value, current + value)',
      'Update the best interval on strict improvement',
      'Report a nonempty contiguous maximum subarray',
    ],
    'The current sum is optimal among nonempty subarrays ending here. All-negative input returns its largest element. Ties preserve the earlier discovered interval.',
    'The default interval [4,−1,2,1], indexes 3–6, sums to 6.',
    'What should all-negative input return?',
    ['Its largest element', 'An empty array with zero sum', 'The whole array'],
    { 'All negative': { values: '-8, -3, -6, -2, -5' } },
  ),
  sieve: make(
    'sieve',
    'Sieve of Eratosthenes',
    'number-extra',
    'Number theory',
    { limit: 50 },
    { limit: int('Upper bound (inclusive)', 2, 100) },
    'Mark composite multiples from p² and read the surviving primes.',
    'O(N log log N)',
    'O(N) auxiliary',
    [
      'Mark 0 and 1 nonprime; all larger candidates true',
      'Choose an unmarked p with p² ≤ N',
      'Mark multiples p², p²+p, … as composite',
      'Read all unmarked integers from 2 through N',
    ],
    'Multiples below p² already have a smaller prime factor. The bound is inclusive. A marked number is composite; 0 and 1 are neither prime nor composite.',
    'Through 30 there are ten primes: 2,3,5,7,11,13,17,19,23,29.',
    'Where can marking for prime p begin?',
    ['p²', 'p itself', 'Always at 2'],
  ),
};

additionalAlgorithms.avl.workedExample = { values: '30, 20, 10', target: 20 };
additionalAlgorithms.sieve.workedExample = { limit: 30 };

export function validateAdditional(definition, raw) {
  const result = {};
  for (const [key, schema] of Object.entries(definition.inputs)) {
    const value = raw?.[key];
    if (schema.type === 'integer') result[key] = integer(value, key, schema.min, schema.max);
    else if (schema.type === 'list')
      result[key] = list(value, key, schema.maxItems, schema.min, schema.max);
    else if (schema.type === 'text') {
      if (
        typeof value !== 'string' ||
        !value.length ||
        value.length > schema.maxLength ||
        !new RegExp(schema.pattern).test(value)
      )
        invalid(
          key,
          `${schema.label}: use 1–${schema.maxLength} ${schema.pattern === '^[a-z]+$' ? 'lowercase letters' : 'ASCII letters, digits or spaces'}.`,
        );
      result[key] = value;
    } else if (schema.type === 'words') {
      if (typeof value !== 'string' || value.length > 100)
        invalid(key, 'Use 1–8 comma-separated lowercase words.');
      const words = value.split(',').map((w) => w.trim());
      if (words.length > 8 || words.some((w) => !/^[a-z]{1,8}$/.test(w)))
        invalid(key, 'Use 1–8 lowercase words, each 1–8 letters.');
      result[key] = words;
    } else if (schema.type === 'commands') {
      if (typeof value !== 'string' || value.length > 700 || !value.trim())
        invalid(key, 'Enter 1–24 operations separated by semicolons.');
      const parts = value.split(';');
      if (parts.length > 24) invalid(key, 'Use at most 24 operations.');
      result[key] = parts.map((part) => {
        const [op, ...args] = part.trim().toLowerCase().split(/\s+/);
        if (!Object.hasOwn(schema.commands, op) || args.length !== schema.commands[op])
          invalid(
            key,
            `Unsupported operation or argument count: ${part.trim()}. See the input guide.`,
          );
        return { op, args: args.map((arg) => integer(arg, key, -99, 99)) };
      });
    } else if (schema.type === 'edges') {
      if (typeof value !== 'string' || value.length > 600)
        invalid(key, 'Enter from,to,weight edges separated by semicolons.');
      const parts = value.trim() ? value.split(';') : [],
        seen = new Set();
      if (parts.length > schema.maxItems) invalid(key, 'Use at most 24 edges.');
      result[key] = parts.map((part) => {
        const cells = part.split(',');
        if (cells.length !== 3) invalid(key, 'Each edge needs from,to,weight.');
        const from = integer(cells[0], key, 0, 5),
          to = integer(cells[1], key, 0, 5),
          weight = integer(cells[2], key, schema.min, schema.max);
        const pair = schema.directed ? `${from},${to}` : [from, to].sort((a, b) => a - b).join(',');
        if (from === to || seen.has(pair))
          invalid(key, 'Use distinct pairs of different nodes; list each undirected edge once.');
        seen.add(pair);
        return { from, to, weight };
      });
    }
  }
  if (
    definition.id === 'dsu' &&
    result.operations.some((c) => c.args.some((v) => v < 0 || v >= result.size))
  )
    invalid('operations', `Element indexes must be 0–${result.size - 1}.`);
  for (const key of ['index', 'query', 'left', 'right'])
    if (key in result && result[key] >= result.values.length)
      invalid(key, `${key} must be smaller than the array length (${result.values.length}).`);
  if ('left' in result && result.left > result.right)
    invalid('right', 'Range end must be at least the start.');
  for (const rule of definition.constraints ?? []) {
    if (rule.type === 'length-bound' && result[rule.key] > result[rule.array].length)
      invalid(rule.key, `${rule.key} must not exceed the array length.`);
    if (rule.type === 'minimum-length' && result[rule.key].length < rule.minimum)
      invalid(rule.key, `Enter at least ${rule.minimum} values.`);
  }
  return result;
}

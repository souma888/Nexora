import { invalid, integer, list } from './algorithm-input.js';
const nums = (label = 'Keys') => ({ label, type: 'list', min: -99, max: 99, maxItems: 24 });
const int = (label, min, max) => ({ label, type: 'integer', min, max });
const text = (label, maxLength = 120) => ({
  label,
  type: 'text',
  maxLength,
  hint: 'Bounded numeric JSON or ASCII text; see the model notes for the accepted domain.',
  multiline: maxLength > 100,
});
const make = (
  id,
  title,
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
) => ({
  id,
  title,
  topic,
  defaults,
  inputs: Object.fromEntries(
    Object.entries(inputs).map(([k, s]) => [k, { ...s, initial: defaults[k] }]),
  ),
  discipline: 'algorithms',
  engine: 'extended',
  runner: 'deep',
  kind: 'deep',
  version: '1.0',
  description,
  complexity,
  space,
  lines,
  invariant,
  example,
  predict,
  answer,
  presets: {},
  help: 'Lists use commas; matrices and point sets use numeric JSON. See the model notes for size and domain limits. Indexes are zero-based; step through the trace to inspect changes.',
});
export const deepAlgorithms = {
  redblack: make(
    'redblack',
    'Red–Black Tree Insertion and Recoloring',
    'Balanced search trees',
    { values: '41,38,31,12,19,8' },
    { values: nums() },
    'Insert distinct keys into a red–black tree and trace recoloring, rotations and the resulting black height.',
    'O(log n) per insertion',
    'O(n) tree nodes. Full replay snapshots require additional storage.',
    [
      'Insert a red BST leaf',
      'Repair a red parent using uncle recoloring or rotations',
      'Recolor the root black',
      'Verify black-height and red-parent invariants',
    ],
    'Duplicate keys are ignored. Null leaves are black; every root-to-null path has the same black height. The displayed black height excludes the root and includes its null leaf. Up to 24 keys; snapshots include transient repair states.',
    '41,38,31 causes a right rotation; final root is 38.',
    'What must happen if a red node has a red parent and red uncle?',
    [
      'Recolor the parent and uncle black and repair upward',
      'Always rotate twice',
      'Delete the inserted key',
    ],
  ),
  btree: make(
    'btree',
    'B-Tree Insert and Split',
    'Balanced search trees',
    { values: '10,20,5,6,12,30,7,17', degree: 2 },
    { values: nums(), degree: int('Minimum degree t', 2, 4) },
    'Split full nodes before descent and promote their medians while keeping all leaves at one depth.',
    'O(t logₜ n) key comparisons per insertion',
    'O(n) keys and node storage. Full replay snapshots require additional storage.',
    [
      'Split a full root if necessary',
      'Choose a child by key interval',
      'Split a full child before descent',
      'Insert into a nonfull leaf',
    ],
    'Minimum degree t gives t−1 to 2t−1 keys in nonroot nodes. Distinct keys only; duplicates are ignored. Node labels list their sorted keys.',
    'At t=2, inserting 10,20,5 fills a leaf; inserting 6 splits the root around 10.',
    'What changes the height of a B-tree during insertion?',
    ['Splitting the root', 'Every leaf insertion', 'Recoloring a node'],
  ),
  skiplist: make(
    'skiplist',
    'Skip List Search',
    'Probabilistic structures',
    { values: '3,6,7,9,12,19,21,25,26', target: 19, seed: 42 },
    { values: nums(), target: int('Search key', -99, 99), seed: int('Promotion seed', 1, 99999) },
    'Build seeded geometric tower heights and search by moving right without overshooting, then dropping a level.',
    'Expected O(log n) search; O(n) worst case',
    'O(n) expected tower storage (six-level cap here). Full replay snapshots require additional storage.',
    [
      'Build sorted towers with promotion probability 1/2',
      'Start at the highest head',
      'Move right while the next key is below target',
      'Drop a level and test equality',
    ],
    'Build cost includes sorting and linking towers. Search follows forward pointers, with a maximum of six levels for the bounded input here; duplicate keys are deduplicated. Expected logarithmic search assumes an uncapped geometric tower model; a particular seed does not guarantee it.',
    'Searching 19 in the default keys ends at its sorted index 5.',
    'Why does a search move down a level?',
    [
      'The next right key would overshoot or is absent',
      'The key was deleted',
      'A rotation is required',
    ],
  ),
  bloom: make(
    'bloom',
    'Bloom Filter False Positives',
    'Probabilistic structures',
    { words: 'alpha,beta,gamma,delta', query: 'theta', bits: 32, hashes: 3 },
    {
      words: text('Inserted words', 120),
      query: text('Query word', 16),
      bits: int('Filter bits m', 8, 128),
      hashes: int('Hash functions k', 1, 8),
    },
    'Set deterministic hashed bit positions and distinguish definitely absent from possibly present.',
    'O(k) per insert or query',
    'O(m) filter bits plus O(k) hash positions. Full replay snapshots require additional storage.',
    [
      'Hash each inserted word k times',
      'Set the referenced bits',
      'Hash the query and inspect all its bits',
      'Compare the answer with actual set membership',
    ],
    'Lowercase words only, 1–12 distinct inserted words. A seeded 32-bit mixer supplies deterministic hash functions, not cryptographic hashes. Formula (1−e^(−kn/m))^k is approximate and assumes uniform independent hashes; empirical negatives use a fixed 500-word probe set.',
    'With all query bits set, the answer is possibly present, never a proof of membership.',
    'Can an unmodified Bloom filter reject an inserted item?',
    ['No, inserted items have no false negatives', 'Yes, always', 'Only when k=1'],
  ),
  zmatch: make(
    'zmatch',
    'Z-Algorithm String Matching',
    'String algorithms',
    { text: 'abacaba', pattern: 'aba' },
    { text: text('Text', 80), pattern: text('Pattern', 24) },
    'Build a Z-box on pattern + separator + text and report overlapping matches.',
    'O(n+m) time',
    'O(n+m) joined string and Z-array. Full replay snapshots require additional storage.',
    [
      'Join pattern, a reserved separator, and text',
      'Reuse values within the current Z-box',
      'Extend matches beyond its right edge',
      'Report positions where Z reaches the pattern length',
    ],
    'ASCII letters/digits/spaces only. The reserved separator is generated internally and cannot appear in input. Up to 80 text and 24 pattern characters.',
    'aba occurs at indexes 0 and 4 in abacaba.',
    'What can a Z-box reuse?',
    [
      'Previously matched prefix lengths inside its interval',
      'A sorted suffix array',
      'The pattern frequency only',
    ],
  ),
  manacher: make(
    'manacher',
    'Manacher’s Longest Palindromic Substring',
    'String algorithms',
    { text: 'babad' },
    { text: text('Text', 80) },
    'Use mirrored radii in a separator-expanded string to find odd and even palindromes in linear time.',
    'O(n) time and space',
    'O(n) expanded characters and radii. Full replay snapshots require additional storage.',
    [
      'Insert internal separators between characters',
      'Initialize a radius from the mirror within the current right boundary',
      'Expand equal characters',
      'Update the center/right boundary and longest interval',
    ],
    'ASCII letters/digits/spaces; internal separators cannot appear in input. Ties choose the earliest starting palindrome. An empty substring is not used as a successful result.',
    'babad has longest length 3; this lab chooses bab at index 0.',
    'Why are separators inserted?',
    [
      'To handle even and odd palindromes uniformly',
      'To sort the string',
      'To prevent overlapping matches',
    ],
  ),
  ahocorasick: make(
    'ahocorasick',
    'Aho–Corasick Multi-Pattern Matching',
    'String algorithms',
    { text: 'ushers', patterns: 'he,she,his,hers' },
    { text: text('Text', 80), patterns: text('Patterns, comma-separated', 120) },
    'Build a trie, breadth-first failure links and inherited outputs, then scan for all overlapping pattern matches.',
    'O(total pattern length + text length + reported matches)',
    'O(total pattern length + outputs) trie/failure storage. Full replay snapshots require additional storage.',
    [
      'Insert patterns into a trie',
      'Build failure links breadth first',
      'Follow failure links on a missing transition',
      'Emit terminal and inherited outputs',
    ],
    'Lowercase a–z only; 1–8 distinct patterns, each at most 12 characters. Tables expose failure targets and outputs; duplicate patterns are deduplicated.',
    'ushers reports she at 1, he at 2 and hers at 2.',
    'Why inherit outputs through failure links?',
    [
      'A suffix may itself be a complete pattern',
      'To remove duplicate characters',
      'To make every trie node terminal',
    ],
  ),
  suffixarray: make(
    'suffixarray',
    'Suffix Array and LCP',
    'String algorithms',
    { text: 'banana' },
    { text: text('Text', 64) },
    'Sort suffixes by prefix doubling and compute adjacent longest common prefixes with Kasai’s scan.',
    'O(n log² n) here using comparison sort; O(n) Kasai scan',
    'O(n) ranks, suffix order and LCP. Full replay snapshots require additional storage.',
    [
      'Rank single characters',
      'Sort by rank pairs at doubling lengths',
      'Assign new equivalence ranks',
      'Build LCP using the inverse suffix order',
    ],
    'ASCII letters/digits/spaces; length at most 64. LCP[0]=0. Comparison sorting makes this teaching implementation O(n log² n), not a linear-time suffix-array construction.',
    'banana gives SA=[5,3,1,0,4,2] and LCP=[0,1,3,0,0,2].',
    'What does LCP[i] compare?',
    ['Suffixes SA[i−1] and SA[i]', 'Characters at i and i+1', 'The whole text with itself'],
  ),
  convexhull: make(
    'convexhull',
    'Convex Hull: Graham Scan and Monotone Chain',
    'Computational geometry',
    { points: '[[0,0],[3,0],[3,3],[0,3],[1,1],[2,1]]', method: 0 },
    { points: text('Points [[x,y],…]', 1200), method: int('Method: 0 Andrew, 1 Graham', 0, 1) },
    'Compare orientation-based hull scans and discard interior collinear points.',
    'O(n log n) time',
    'O(n) sorted points and hull chains. Full replay snapshots require additional storage.',
    [
      'Deduplicate and order points',
      'Use cross products to classify turns',
      'Pop while the chain is not a strict left turn',
      'Join chains into a counterclockwise hull',
    ],
    '2–24 integer points with coordinates −100 to 100. Duplicate points are removed; collinear hulls retain only the two extreme endpoints. No floating orientation predicate is required in this bounded integer domain.',
    'A square with interior points has the four square corners as its hull.',
    'What does a zero cross product mean?',
    ['Three points are collinear', 'A clockwise turn', 'A guaranteed interior point'],
  ),
  closestpair: make(
    'closestpair',
    'Closest Pair of Points: Divide and Conquer',
    'Computational geometry',
    { points: '[[0,0],[5,4],[2,2],[2,3],[9,1]]' },
    { points: text('Points [[x,y],…]', 1200) },
    'Split points by x, solve each half and check a y-ordered strip for a cross-boundary improvement.',
    'O(n log² n) here: each merge sorts its strip',
    'O(n) peak auxiliary arrays and recursion. Full replay snapshots require additional storage.',
    [
      'Sort by x and divide',
      'Solve each half recursively',
      'Keep points within current distance of the split',
      'Compare strip neighbors while their y gap can improve the distance',
    ],
    '2–24 integer points, coordinates −100 to 100. Duplicate points are valid and yield distance zero. Strip sorting at each level is intentionally stated in the complexity.',
    'The default closest pair is (2,2),(2,3), distance 1.',
    'Which cross-boundary pairs need checking?',
    [
      'Those in the narrow strip near the split',
      'Every pair in the plane',
      'Only pairs sharing an x coordinate',
    ],
  ),
  maxflow: make(
    'maxflow',
    'Maximum Flow: Augmenting Paths and Dinic',
    'Graph optimization',
    {
      matrix:
        '[[0,16,13,0,0,0],[0,0,10,12,0,0],[0,4,0,0,14,0],[0,0,9,0,0,20],[0,0,0,7,0,4],[0,0,0,0,0,0]]',
      method: 1,
    },
    {
      matrix: text('Capacity matrix (source 0, sink n−1)', 1500),
      method: int('Method: 0 BFS augmenting paths, 1 Dinic', 0, 1),
    },
    'Augment through residual arcs, including reverse flow, and certify the final value with a minimum cut.',
    'Edmonds–Karp O(VE²); Dinic O(V²E)',
    'O(V+E) residual adjacency plus displayed V² matrix. Full replay snapshots require additional storage.',
    [
      'Build residual forward and reverse edges',
      'Find an augmenting path or level graph',
      'Push bottleneck flow and update reverse capacity',
      'Find source-reachable residual vertices for the minimum cut',
    ],
    '2–8 nodes, integer capacities 0–99, diagonal zero; antiparallel edges are supported independently. The Ford–Fulkerson variant uses BFS (Edmonds–Karp) rather than arbitrary DFS paths.',
    'The classical six-node default network has max flow and min cut 23.',
    'Why add reverse residual capacity?',
    ['To undo an earlier routing choice', 'To double every capacity', 'To avoid a source node'],
  ),
  hopcroftkarp: make(
    'hopcroftkarp',
    'Bipartite Matching: Hopcroft–Karp',
    'Graph optimization',
    { matrix: '[[1,1,0],[0,1,1],[1,0,0]]' },
    { matrix: text('Left-to-right adjacency matrix', 1200) },
    'Build shortest alternating layers, augment disjoint paths and construct a minimum vertex cover certificate.',
    'O(E√V) core algorithm',
    'O(V+E) graph, mates and layers. Full replay snapshots require additional storage.',
    [
      'BFS unmatched left vertices into alternating layers',
      'DFS only along layered augmenting paths',
      'Flip matched and unmatched edges',
      'Repeat until no augmenting path remains',
    ],
    'Binary rectangular matrix, 1–8 vertices per side. Each vertex is matched at most once. The final minimum vertex cover is derived from alternating reachability and has size equal to the matching.',
    'The default graph has a perfect matching of size 3.',
    'What alternates along an augmenting path?',
    ['Unmatched and matched edges', 'Only matched edges', 'Only zero-capacity edges'],
  ),
  hungarian: make(
    'hungarian',
    'Hungarian Assignment',
    'Graph optimization',
    { matrix: '[[4,1,3],[2,0,5],[3,2,2]]' },
    { matrix: text('Square cost matrix', 1200) },
    'Maintain row/column potentials and augment the assignment through minimum reduced-cost slack.',
    'O(n³) time',
    'O(n²) input costs; O(n) working potentials/slacks. Full replay snapshots require additional storage.',
    [
      'Start with zero potentials and an empty matching',
      'Grow an alternating tree using reduced costs',
      'Shift potentials by the smallest slack',
      'Augment and report primal/dual costs',
    ],
    'Square 1–8 cost matrix with integer entries 0–999. Every worker and job is used exactly once. This is minimum-cost complete assignment, without forbidden edges or rectangular padding.',
    'The default optimum costs 5 with assignment [1,0,2].',
    'What does a zero reduced-cost edge permit?',
    ['A potential-tight assignment edge', 'A negative total cost', 'Skipping a worker'],
  ),
  bridges: make(
    'bridges',
    'Bridges and Articulation Points',
    'Graph structure',
    { matrix: '[[0,1,1,0,0],[1,0,1,0,0],[1,1,0,1,0],[0,0,1,0,1],[0,0,0,1,0]]' },
    { matrix: text('Symmetric binary adjacency matrix', 1500) },
    'Use DFS discovery and low-link times to find cut edges and cut vertices across disconnected components.',
    'O(V+E) time',
    'O(V²) input adjacency; O(V) DFS state. Full replay snapshots require additional storage.',
    [
      'Start a DFS in every unvisited component',
      'Track discovery and low-link times',
      'Test low[child] > discovery[parent] for a bridge',
      'Apply root and nonroot articulation rules',
    ],
    'Simple undirected graph with 2–8 nodes; no self loops or parallel edges. The special root rule uses its number of DFS children, not the nonroot inequality.',
    'The default has bridges (2,3),(3,4) and articulation vertices 2,3.',
    'Why is the DFS root handled separately?',
    [
      'It is a cut vertex only when it has multiple DFS children',
      'It is always a cut vertex',
      'It has no neighbors',
    ],
  ),
  lca: make(
    'lca',
    'Lowest Common Ancestor with Binary Lifting',
    'Trees & range queries',
    { parents: '0,0,0,1,1,2,2', u: 3, v: 4 },
    {
      parents: nums('Parent of each node; root 0 is its own parent'),
      u: int('Query u', 0, 23),
      v: int('Query v', 0, 23),
    },
    'Precompute ancestor powers, equalize depths and lift both query nodes without passing their common ancestor.',
    'O(n log n) preprocessing; O(log n) query',
    'O(n log n) ancestor table. Full replay snapshots require additional storage.',
    [
      'Validate a single tree rooted at 0',
      'Build up[v][j], the 2ʲ-th ancestor',
      'Lift the deeper query to equal depth',
      'Lift both together, then return their parent',
    ],
    '2–24 nodes; each parent index must be smaller than its child index, root parent is zero. This explicit input convention guarantees acyclicity and connectivity.',
    'For parents [0,0,0,1,1,2,2], LCA(3,4)=1.',
    'Why store ancestors at powers of two?',
    [
      'A depth difference can be decomposed into binary jumps',
      'To avoid preprocessing',
      'Because every node has two children',
    ],
  ),
  sparsetable: make(
    'sparsetable',
    'Sparse Table Range-Minimum Queries',
    'Trees & range queries',
    { values: '4,2,7,1,3,5', left: 1, right: 4 },
    {
      values: nums('Array values'),
      left: int('Inclusive left', 0, 23),
      right: int('Inclusive right', 0, 23),
    },
    'Precompute power-of-two minima and answer a static inclusive query using two possibly overlapping blocks.',
    'O(n log n) build; O(1) query',
    'O(n log n) precomputed minima. Full replay snapshots require additional storage.',
    [
      'Initialize length-one intervals',
      'Combine adjacent half intervals',
      'Choose k=floor(log₂(range length))',
      'Take min of the two length-2ᵏ blocks',
    ],
    '1–24 integers, immutable during a query. Overlap is valid because min is idempotent; the same formula would be wrong for sums.',
    'For [4,2,7,1,3,5], range [1,4] has minimum 1.',
    'Why may the query blocks overlap?',
    [
      'Repeating a value does not change a minimum',
      'Overlap is never possible',
      'It works for every operation',
    ],
  ),
  bitmasktsp: make(
    'bitmasktsp',
    'Bitmask DP: Traveling Salesman',
    'Subset dynamic programming',
    { matrix: '[[0,10,15,20],[10,0,35,25],[15,35,0,30],[20,25,30,0]]' },
    { matrix: text('Directed complete distance matrix', 1200) },
    'Extend subset-and-last-city states, reconstruct the optimal tour and return to city zero.',
    'O(n²2ⁿ) time; O(n2ⁿ) DP storage',
    'O(n2ⁿ) costs and predecessors. Full replay snapshots require additional storage.',
    [
      'Set dp[{0}][0]=0',
      'Extend each reachable subset to an unvisited city',
      'Record improving predecessor states',
      'Close the tour to zero and reconstruct',
    ],
    '2–9 cities, nonnegative integer costs 0–999, zero diagonal. Directed and asymmetric costs are allowed; all off-diagonal arcs exist, including zero-cost arcs.',
    'The four-city default has optimal closed-tour cost 80.',
    'Why must the state include both subset and last city?',
    [
      'The next edge cost depends on the last city',
      'Subsets cannot be stored as bits',
      'It avoids exponential complexity',
    ],
  ),
  intervals: make(
    'intervals',
    'Greedy Interval Scheduling',
    'Greedy algorithms',
    { intervals: '[[0,3],[1,2],[2,4],[3,5],[4,6],[5,7]]' },
    { intervals: text('Intervals [[start,end],…]', 1200) },
    'Choose intervals by earliest finish time and use an exchange argument to explain maximum cardinality.',
    'O(n log n) time',
    'O(n) sorted interval records. Full replay snapshots require additional storage.',
    [
      'Sort by finish time, then start and original index',
      'Select the earliest finishing compatible interval',
      'Discard conflicting intervals',
      'Continue from the selected finish time',
    ],
    '1–24 intervals with integer endpoints −100 to 100 and start<end. Intervals are half open [start,end), so touching endpoints are compatible. Maximizes count, not total weight or occupied duration.',
    'The default can select [1,2),[2,4),[4,6), for count 3.',
    'Does earliest-finish greedy solve weighted interval scheduling?',
    ['No, weights require a different optimization', 'Yes, always', 'Only if intervals touch'],
  ),
};
export function parseDeepJSON(raw, key, mode) {
  let a;
  try {
    a = JSON.parse(raw);
  } catch {
    invalid(key, 'Use a numeric JSON array.');
  }
  if (!Array.isArray(a)) invalid(key, 'Use a numeric JSON array.');
  const points = mode === 'points' || mode === 'intervals';
  if (
    a.length < (mode === 'intervals' || mode === 'assignment' || mode === 'matching' ? 1 : 2) ||
    a.length > (points ? 24 : mode === 'tsp' ? 9 : 8) ||
    a.some(
      (r) =>
        !Array.isArray(r) ||
        r.length < (points ? 2 : 1) ||
        r.length > (points ? 2 : mode === 'tsp' ? 9 : 8) ||
        r.some(
          (v) =>
            !Number.isInteger(v) ||
            v < (points ? -100 : 0) ||
            v > (points ? 100 : mode === 'assignment' || mode === 'tsp' ? 999 : 99),
        ),
    )
  )
    invalid(key, 'Array size or integer domain is outside the documented bounds.');
  if (points) {
    if (a.some((r) => r.length !== 2) || (mode === 'intervals' && a.some(([s, e]) => s >= e)))
      invalid(key, 'Use [x,y] pairs, or intervals with start < end.');
    return a;
  }
  const cols = a[0].length;
  if (a.some((r) => r.length !== cols) || (mode !== 'matching' && cols !== a.length))
    invalid(key, 'Use a rectangular matching matrix or square graph/cost matrix.');
  if (['graph', 'undirected', 'tsp'].includes(mode) && a.some((r, i) => r[i] !== 0))
    invalid(key, 'Graph diagonals must be zero.');
  if (mode === 'matching' || mode === 'undirected') {
    if (a.flat().some((v) => v !== 0 && v !== 1)) invalid(key, 'Use binary adjacency entries.');
  }
  if (mode === 'undirected' && a.some((r, i) => r.some((v, j) => v !== a[j][i])))
    invalid(key, 'Undirected adjacency must be symmetric.');
  return a;
}
export function validateDeep(definition, raw) {
  const out = {};
  for (const [k, f] of Object.entries(definition.inputs)) {
    const value = raw?.[k];
    if (f.type === 'integer') out[k] = integer(value, k, f.min, f.max);
    else if (f.type === 'list') out[k] = list(value, k, f.maxItems, f.min, f.max);
    else {
      if (typeof value !== 'string' || !value.length || value.length > f.maxLength)
        invalid(k, `${f.label}: use 1–${f.maxLength} characters.`);
      out[k] = value;
    }
  }
  const id = definition.id;
  if ('matrix' in out)
    out.matrix = parseDeepJSON(
      out.matrix,
      'matrix',
      id === 'hungarian'
        ? 'assignment'
        : id === 'hopcroftkarp'
          ? 'matching'
          : id === 'bridges'
            ? 'undirected'
            : id === 'bitmasktsp'
              ? 'tsp'
              : 'graph',
    );
  if ('points' in out) out.points = parseDeepJSON(out.points, 'points', 'points');
  if (id === 'intervals') out.intervals = parseDeepJSON(out.intervals, 'intervals', 'intervals');
  if (['zmatch', 'manacher', 'suffixarray'].includes(id))
    for (const k of ['text', 'pattern'].filter((k) => k in out))
      if (!/^[A-Za-z0-9 ]+$/.test(out[k])) invalid(k, 'Use ASCII letters, digits or spaces.');
  if (['ahocorasick', 'bloom'].includes(id)) {
    const key = id === 'bloom' ? 'words' : 'patterns',
      words = out[key].split(',').map((x) => x.trim());
    if (words.length > (id === 'bloom' ? 12 : 8) || words.some((w) => !/^[a-z]{1,12}$/.test(w)))
      invalid(key, 'Use bounded comma-separated lowercase words, each 1–12 letters.');
    out[key] = [...new Set(words)];
    if (
      (id === 'bloom' && !/^[a-z]{1,16}$/.test(out.query)) ||
      (id === 'ahocorasick' && !/^[a-z]+$/.test(out.text))
    )
      invalid(id === 'bloom' ? 'query' : 'text', 'Use lowercase a–z only.');
  }
  if (id === 'lca') {
    if (
      out.parents.length < 2 ||
      out.parents[0] !== 0 ||
      out.parents.some((p, i) => i > 0 && (p < 0 || p >= i))
    )
      invalid('parents', 'Root parent is zero; every other parent must precede its child.');
    if (out.u >= out.parents.length || out.v >= out.parents.length)
      invalid('u', 'Query vertices must exist.');
  }
  if (id === 'sparsetable' && (out.left > out.right || out.right >= out.values.length))
    invalid('right', 'Use 0 ≤ left ≤ right < array length.');
  return out;
}

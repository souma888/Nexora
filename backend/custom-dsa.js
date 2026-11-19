import { check, number, index, jsonProject } from './builder-core.js';
import { random } from './numerical-tools.js';
export const dsaExample = JSON.stringify({
  nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  edges: [
    [0, 1, 4],
    [0, 2, 1],
    [2, 1, 2],
    [1, 3, 1],
    [2, 4, 5],
    [3, 5, 3],
    [4, 5, 1],
    [5, 6, 2],
    [6, 7, 1],
  ],
  directed: true,
  start: 0,
  array: [38, 12, 27, 8, 43, 19, 5, 31],
});
export const studioCode = {
  bfs: [
    'Initialize queue with start; mark discovered',
    'Remove first queued vertex',
    'For each outgoing edge',
    'If undiscovered, mark and enqueue',
    'Record reachable order',
  ],
  dfs: [
    'Initialize explicit stack with start',
    'Pop a vertex; skip if already visited',
    'Mark visited and record vertex',
    'Push outgoing neighbors in reverse order',
    'Record reachable order',
  ],
  dijkstra: [
    'Initialize distances to infinity; start=0',
    'Select the unsettled vertex with least distance',
    'Settle it; scan outgoing edges',
    'Relax a shorter path and record predecessor',
    'Stop when no finite unsettled distance remains',
  ],
  bellman: [
    'Initialize distances; start=0',
    'Repeat at most V−1 passes',
    'Scan every directed edge',
    'Relax a shorter reachable path',
    'Check for a reachable negative-weight cycle',
  ],
  kruskal: [
    'Create one disjoint set per vertex',
    'Sort undirected edges by weight',
    'Inspect the next lightest edge',
    'If endpoints are in different sets, union and accept',
    'Return a minimum spanning forest',
  ],
  insertion: [
    'Hold the next array key',
    'Compare the previous element with the key',
    'Shift larger elements one position right',
    'Write the key into its insertion slot',
    'Return the sorted array',
  ],
  merge: [
    'Split into runs of width 1,2,4,…',
    'Compare the heads of two adjacent runs',
    'Copy the smaller value into a temporary run',
    'Write merged values back to the array',
    'Return the sorted array',
  ],
  quick: [
    'Choose the middle element as pivot',
    'Compare left/right values with pivot',
    'Swap out-of-place values and advance indexes',
    'Recurse on the two resulting partitions',
    'Return the sorted array',
  ],
};
export function parseDsa(source, algorithm) {
  const p = jsonProject(source);
  check(Object.hasOwn(studioCode, algorithm), 'Choose a supported studio algorithm.');
  if (['insertion', 'merge', 'quick'].includes(algorithm)) {
    check(
      Array.isArray(p.array) && p.array.length >= 1 && p.array.length <= 128,
      'Use 1…128 finite array values.',
    );
    p.array.forEach((v) => number(v, -1e6, 1e6, 'Array entry'));
    return p;
  }
  check(
    Array.isArray(p.nodes) && p.nodes.length >= 1 && p.nodes.length <= 64,
    'Use 1…64 vertex labels.',
  );
  check(
    p.nodes.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 16) &&
      new Set(p.nodes).size === p.nodes.length,
    'Vertex labels must be unique strings of 1…16 characters.',
  );
  check(Array.isArray(p.edges) && p.edges.length <= 256, 'Use at most 256 edges [from,to,weight].');
  check(typeof p.directed === 'boolean', 'directed must be true or false.');
  p.edges.forEach((e) => {
    check(Array.isArray(e) && e.length === 3, 'Edges are [from,to,weight].');
    index(e[0], p.nodes.length, 'Edge start');
    index(e[1], p.nodes.length, 'Edge end');
    number(e[2], -1e4, 1e4, 'Edge weight');
    if (algorithm === 'dijkstra')
      check(
        e[2] >= 0,
        'Dijkstra needs nonnegative edge weights; use Bellman–Ford for negative edges.',
      );
  });
  index(p.start, p.nodes.length, 'Start vertex');
  if (algorithm === 'kruskal') check(!p.directed, 'Kruskal requires an undirected graph.');
  return p;
}
export function traceDsa(source, algorithm, { capture = true } = {}) {
  const p = parseDsa(source, algorithm),
    frames = [],
    stats = { comparisons: 0, writes: 0, visits: 0 };
  let result = {},
    truncated = false;
  const push = (line, message, state) => {
    if (!capture) return;
    if (frames.length >= 12000) {
      truncated = true;
      if (line === 4)
        frames[frames.length - 1] = structuredClone({ line, message, stats, ...state });
      return;
    }
    frames.push(structuredClone({ line, message, stats, ...state }));
  };
  if (['insertion', 'merge', 'quick'].includes(algorithm)) {
    const a = [...p.array],
      emit = (line, message, active = []) => {
        if (capture) push(line, message, { array: [...a], active });
      };
    const compare = (i, j, pivot) => {
        stats.comparisons++;
        emit(1, `Compare ${a[i]} with ${pivot ?? a[j]}`, [i, ...(j >= 0 ? [j] : [])]);
        return a[i] - (pivot ?? a[j]);
      },
      swap = (i, j) => {
        if (i === j) return;
        [a[i], a[j]] = [a[j], a[i]];
        stats.writes += 2;
        emit(2, `Swap indexes ${i} and ${j}`, [i, j]);
      };
    emit(0, 'Initial editable array');
    if (algorithm === 'insertion')
      for (let i = 1; i < a.length; i++) {
        const key = a[i];
        let j = i - 1;
        emit(0, `Hold ${key}`, [i]);
        while (j >= 0) {
          if (compare(j, -1, key) <= 0) break;
          a[j + 1] = a[j];
          stats.writes++;
          emit(2, 'Shift larger value', [j, j + 1]);
          j--;
        }
        a[j + 1] = key;
        stats.writes++;
        emit(3, 'Insert held key', [j + 1]);
      }
    if (algorithm === 'merge')
      for (let width = 1; width < a.length; width *= 2)
        for (let l = 0; l < a.length; l += 2 * width) {
          const mid = Math.min(l + width, a.length),
            end = Math.min(l + 2 * width, a.length),
            buffer = [];
          let i = l,
            j = mid;
          emit(0, `Merge runs of width ${width}`);
          while (i < mid || j < end) {
            if (j >= end || (i < mid && compare(i, j) <= 0)) buffer.push(a[i++]);
            else buffer.push(a[j++]);
          }
          buffer.forEach((v, k) => {
            a[l + k] = v;
            stats.writes++;
            emit(3, 'Write merged value', [l + k]);
          });
        }
    if (algorithm === 'quick') {
      const partition = (lo, hi) => {
        if (lo >= hi) return;
        const pivot = a[Math.floor((lo + hi) / 2)];
        let i = lo,
          j = hi;
        emit(0, `Pivot ${pivot}`);
        while (i <= j) {
          while (i <= hi && compare(i, -1, pivot) < 0) i++;
          while (j >= lo && compare(j, -1, pivot) > 0) j--;
          if (i <= j) {
            swap(i, j);
            i++;
            j--;
          }
        }
        partition(lo, j);
        partition(i, hi);
      };
      partition(0, a.length - 1);
    }
    emit(4, 'Sorted array');
    result = { array: a };
  } else {
    const n = p.nodes.length,
      edges = p.directed
        ? p.edges
        : p.edges.flatMap(([a, b, w]) => [
            [a, b, w],
            [b, a, w],
          ]),
      adj = Array.from({ length: n }, () => []);
    edges.forEach(([a, b, w]) => adj[a].push([b, w]));
    const distance = Array(n).fill(null),
      parent = Array(n).fill(null),
      visited = Array(n).fill(false),
      order = [],
      accepted = [];
    distance[p.start] = 0;
    const emit = (line, message, active = [], edge = null) => {
      if (!capture) return;
      push(line, message, {
        nodes: p.nodes,
        edges: p.edges,
        directed: p.directed,
        distance: [...distance],
        parent: [...parent],
        visited: [...visited],
        order: [...order],
        accepted: accepted.map((e) => [...e]),
        active,
        edge,
      });
    };
    emit(0, 'Initialize graph state');
    if (algorithm === 'bfs' || algorithm === 'dfs') {
      const frontier = [p.start],
        discovered = new Set([p.start]);
      while (frontier.length) {
        const u = algorithm === 'bfs' ? frontier.shift() : frontier.pop();
        if (visited[u]) continue;
        visited[u] = true;
        stats.visits++;
        order.push(u);
        emit(algorithm === 'bfs' ? 1 : 2, `Visit ${p.nodes[u]}`, [u]);
        const neighbors = algorithm === 'dfs' ? [...adj[u]].reverse() : adj[u];
        for (const [v] of neighbors) {
          stats.comparisons++;
          emit(2, `Inspect ${p.nodes[u]} → ${p.nodes[v]}`, [u, v], [u, v]);
          if (algorithm === 'bfs' ? !discovered.has(v) : !visited[v]) {
            if (!discovered.has(v)) {
              discovered.add(v);
              parent[v] = u;
              distance[v] = distance[u] + 1;
            }
            frontier.push(v);
            stats.writes++;
            emit(3, 'Add to frontier', [v]);
          }
        }
      }
    }
    if (algorithm === 'dijkstra') {
      while (true) {
        let u = -1;
        for (let i = 0; i < n; i++) {
          stats.comparisons++;
          if (!visited[i] && distance[i] !== null && (u < 0 || distance[i] < distance[u])) u = i;
        }
        if (u < 0) break;
        visited[u] = true;
        stats.visits++;
        order.push(u);
        emit(2, `Settle ${p.nodes[u]}`, [u]);
        for (const [v, w] of adj[u]) {
          stats.comparisons++;
          if (distance[v] === null || distance[u] + w < distance[v]) {
            distance[v] = distance[u] + w;
            parent[v] = u;
            stats.writes++;
            emit(3, 'Relax shorter path', [u, v], [u, v]);
          }
        }
      }
    }
    let negative = false;
    if (algorithm === 'bellman') {
      for (let k = 0; k < n - 1; k++) {
        let changed = false;
        emit(1, `Pass ${k + 1}`);
        for (const [u, v, w] of edges) {
          stats.comparisons++;
          if (distance[u] !== null && (distance[v] === null || distance[u] + w < distance[v])) {
            distance[v] = distance[u] + w;
            parent[v] = u;
            stats.writes++;
            changed = true;
            emit(3, 'Relax edge', [u, v], [u, v]);
          }
        }
        if (!changed) break;
      }
      negative = edges.some(
        ([u, v, w]) =>
          distance[u] !== null && (distance[v] === null || distance[u] + w < distance[v]),
      );
      if (negative) emit(4, 'Reachable negative cycle: finite shortest paths are not defined');
    }
    if (algorithm === 'kruskal') {
      const roots = Array.from({ length: n }, (_, i) => i),
        rank = Array(n).fill(0),
        find = (i) => {
          while (roots[i] !== i) {
            stats.comparisons++;
            const parent = roots[i];
            if (roots[i] !== roots[parent]) {
              roots[i] = roots[parent];
              stats.writes++;
            }
            i = roots[i];
          }
          return i;
        };
      const sorted = p.edges
        .map((e, i) => ({ e, i }))
        .sort((a, b) => {
          stats.comparisons++;
          return a.e[2] - b.e[2] || a.i - b.i;
        });
      for (const {
        e: [u, v, w],
      } of sorted) {
        stats.comparisons++;
        emit(2, 'Inspect next lightest edge', [u, v], [u, v]);
        const a = find(u),
          b = find(v);
        if (a !== b) {
          if (rank[a] < rank[b]) roots[a] = b;
          else {
            roots[b] = a;
            if (rank[a] === rank[b]) rank[a]++;
          }
          accepted.push([u, v, w]);
          stats.writes++;
          emit(3, 'Union components and accept edge', [u, v], [u, v]);
        }
      }
    }
    emit(4, 'Final graph state');
    result = {
      distance,
      parent,
      order,
      negativeCycle: negative,
      forest: accepted,
      weight: accepted.reduce((s, e) => s + e[2], 0),
    };
  }
  return { frames, stats, result, truncated };
}
export function solveDsaStudio(source, algorithm = 'dijkstra') {
  const p = parseDsa(source, algorithm),
    r = traceDsa(source, algorithm),
    series = r.frames.map((f, x) => ({ x, y: f.stats.comparisons, reference: f.stats.writes }));
  return {
    summary: {
      comparisons: r.stats.comparisons,
      writes: r.stats.writes,
      visits: r.stats.visits,
      frames: r.frames.length,
    },
    series,
    visualization: {
      type: 'builder',
      kind: 'dsa',
      project: p,
      algorithm,
      code: studioCode[algorithm],
      frames: r.frames,
    },
    table: {
      caption: 'Final result',
      headers: ['Quantity', 'Value'],
      rows: Object.entries(r.result).map(([k, v]) => [k, JSON.stringify(v)]),
    },
    warnings: r.truncated
      ? [
          'Replay reached its 12000-frame budget; results and counters remain complete. Use a smaller input for every intermediate state.',
        ]
      : r.result.negativeCycle
        ? ['A reachable negative cycle prevents finite shortest-path interpretation.']
        : [],
  };
}
/** Measured timings stay outside the deterministic solver/API result. */
export function benchmarkDsa(algorithm, { seed = 42, repeats = 7 } = {}) {
  number(seed, 1, 999999, 'Benchmark seed');
  number(repeats, 3, 15, 'Benchmark repeats');
  check(
    Number.isInteger(seed) && Number.isInteger(repeats),
    'Benchmark seed and repeats must be integers.',
  );
  check(Object.hasOwn(studioCode, algorithm), 'Unsupported benchmark algorithm.');
  const array = ['insertion', 'merge', 'quick'].includes(algorithm),
    sizes = array ? [8, 16, 32, 64, 128] : [4, 8, 16, 32, 64],
    rng = random(seed),
    rows = [];
  for (const n of sizes) {
    const project = array
        ? { array: Array.from({ length: n }, () => Math.floor(rng() * 10000)) }
        : {
            nodes: Array.from({ length: n }, (_, i) => `V${i}`),
            edges: Array.from({ length: Math.min(256, 3 * n) }, () => [
              Math.floor(rng() * n),
              Math.floor(rng() * n),
              1 + Math.floor(rng() * 20),
            ]),
            directed: algorithm !== 'kruskal',
            start: 0,
          },
      source = JSON.stringify(project);
    traceDsa(source, algorithm, { capture: false });
    const elapsed = [];
    let counts;
    for (let k = 0; k < repeats; k++) {
      let loops = 1,
        start = performance.now(),
        duration = 0;
      do {
        const t = performance.now();
        for (let j = 0; j < loops; j++)
          counts = traceDsa(source, algorithm, { capture: false }).stats;
        duration = performance.now() - t;
        if (duration < 5) loops *= 2;
      } while (duration < 5 && loops < 16384 && performance.now() - start < 500);
      elapsed.push(duration / (duration < 5 ? Math.max(1, loops / 2) : loops));
    }
    elapsed.sort((a, b) => a - b);
    rows.push({
      n,
      milliseconds: elapsed[Math.floor(elapsed.length / 2)],
      minimum: elapsed[0],
      maximum: elapsed.at(-1),
      operations: counts.comparisons + counts.writes + counts.visits,
    });
  }
  return {
    algorithm,
    seed,
    repeats,
    rows,
    note: 'Median wall time per run after warm-up, no replay capture. Includes input validation and allocation; finite sizes, JIT, timer resolution and system load cannot establish an asymptotic complexity theorem.',
  };
}

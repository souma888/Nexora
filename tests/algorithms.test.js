import assert from 'node:assert/strict';
import test from 'node:test';
import { algorithms, runAlgorithm } from '../backend/algorithms.js';
import { GET, POST } from '../api/algorithms.js';
const solve = (id, overrides = {}) => runAlgorithm(id, { ...algorithms[id].defaults, ...overrides });
const call = body => POST(new Request('http://localhost/api/algorithms', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

for (const id of ['bubble', 'insertion', 'selection', 'merge', 'quick', 'heap']) {
  test(`${id} sorts signed values, duplicate keys, singletons, and reverse order`, () => {
    for (const values of ['3,-2,3,0,-2,7', '1', '8,7,6,5,4,3,2,1', '2,2,2,2', '0,-1']) {
      const trace = solve(id, { values });
      assert.deepEqual(trace.result.array, values.split(',').map(Number).sort((a, b) => a - b));
      assert.deepEqual(trace.frames.at(-1).array, trace.result.array);
      assert.deepEqual(trace.frames[0].array, values.split(',').map(Number));
      assert.ok(trace.frames.length < 1000);
    }
  });
}
test('sorting counter benchmarks are independent of trace frame count', () => {
  assert.equal(solve('selection', { values: '3,1,2' }).stats.comparisons, 3);
  assert.equal(solve('selection', { values: '3,1,2' }).stats.writes, 4);
  assert.equal(solve('bubble', { values: '1,2,3,4' }).stats.comparisons, 3);
  assert.equal(solve('insertion', { values: '1,2,3,4' }).stats.comparisons, 3);
});
test('linear and binary searches handle absent, duplicate and endpoint targets', () => {
  assert.equal(solve('linear', { values: '8,3,5,3', target: 3 }).result.index, 1);
  assert.equal(solve('binary', { values: '8,1,5,3', target: 5 }).result.index, 2);
  for (const id of ['linear', 'binary']) for (const target of [-4, 0, 7, 9]) {
    const result = solve(id, { values: '7,0,-4,0', target }).result;
    if (target === 9) assert.equal(result.index, -1); else assert.equal(result.array[result.index], target);
  }
});
test('BFS returns minimum edge count while DFS follows stack order without revisiting cycles', () => {
  const bfs = solve('bfs'); assert.deepEqual(bfs.result.path, [0, 1, 3, 5]); assert.equal(bfs.result.distance, 3);
  const dfs = solve('dfs', { edges: '0,1,1; 0,2,1; 1,3,1; 3,0,1', goal: 3 });
  assert.deepEqual(dfs.result.visited, [0, 1, 3, 2]); assert.deepEqual(dfs.result.path, [0, 1, 3]);
  const crossEdge = solve('dfs', { edges: '0,1,1; 0,2,1; 1,2,1', goal: 2 });
  assert.deepEqual(crossEdge.result.path, [0, 1, 2]);
});
test('Dijkstra, Bellman–Ford and A* find independent cost-13 default path', () => {
  for (const id of ['dijkstra', 'bellman', 'astar']) {
    const result = solve(id).result;
    assert.equal(result.distance, 13); assert.deepEqual(result.path, [0, 2, 1, 3, 4, 5]);
  }
});
test('A* heuristic remains consistent on each directed edge, including zero-weight edges', () => {
  for (const edges of [algorithms.astar.defaults.edges, '0,1,0; 1,5,3; 0,5,5']) {
    const trace = solve('astar', { edges }), { heuristic, edges: parsed } = trace.frames[0];
    for (const e of parsed) assert.ok(heuristic[e.from] <= e.weight + heuristic[e.to] + 1e-12);
    assert.equal(trace.result.distance, solve('dijkstra', { edges }).result.distance);
  }
});
test('all graph labs handle empty graphs, unreachable goals, and source equals goal', () => {
  for (const id of ['bfs', 'dfs', 'dijkstra', 'bellman', 'astar']) {
    assert.equal(solve(id, { edges: '' }).result.distance, Infinity);
    assert.deepEqual(solve(id, { edges: '' }).result.path, []);
    assert.deepEqual(solve(id, { edges: '', start: 2, goal: 2 }).result.path, [2]);
  }
});
test('Bellman–Ford supports negative edges and distinguishes reachable negative cycles', () => {
  assert.equal(solve('bellman', { edges: '0,1,4; 0,2,5; 1,2,-2', goal: 2 }).result.distance, 2);
  assert.equal(solve('bellman', { edges: '0,1,1; 1,2,-3; 2,1,1' }).result.negativeCycle, true);
  assert.equal(solve('bellman', { edges: '0,5,2; 1,2,-3; 2,1,1' }).result.negativeCycle, false);
});
test('knapsack matches brute-force subsets and never reuses an item', () => {
  const weights = [2, 3, 4], values = [3, 4, 5];
  for (let capacity = 1; capacity <= 12; capacity++) {
    let best = 0;
    for (let mask = 0; mask < 8; mask++) {
      const w = weights.reduce((sum, v, i) => sum + ((mask >> i & 1) ? v : 0), 0);
      const v = values.reduce((sum, v, i) => sum + ((mask >> i & 1) ? v : 0), 0);
      if (w <= capacity) best = Math.max(best, v);
    }
    const result = solve('knapsack', { capacity }).result;
    assert.equal(result.value, best); assert.ok(result.weight <= capacity);
  }
  assert.equal(solve('knapsack').result.value, 7);
});
test('Euclid gives known GCDs and records valid division identities', () => {
  for (const [a, b, gcd] of [[48, 18, 6], [55, 34, 1], [24, 0, 24], [0, 18, 18], [999999, 333333, 333333]]) {
    const trace = solve('gcd', { a, b }); assert.equal(trace.result.gcd, gcd);
    for (const row of trace.frames.at(-1).divisions) assert.equal(row.a, row.quotient * row.b + row.remainder);
  }
});
test('algorithm API discovers 15 models, returns traces, and rejects malformed or invalid input', async () => {
  assert.equal((await GET().json()).models.length, 15);
  for (const [model, definition] of Object.entries(algorithms)) {
    const response = await call({ model, input: definition.defaults }); assert.equal(response.status, 200);
    const json = await response.json(); assert.equal(json.model, model); assert.equal(json.version, '1.0'); assert.ok(json.frames.length);
  }
  for (const [body, status, field] of [
    ['{', 400, null], [{ model: 'missing' }, 422, 'model'],
    [{ model: 'bubble', input: { values: '1,,2' } }, 422, 'values'],
    [{ model: 'bubble', input: { values: '1,2.5' } }, 422, 'values'],
    [{ model: 'dijkstra', input: { ...algorithms.dijkstra.defaults, edges: '0,1,-1' } }, 422, 'edges'],
    [{ model: 'astar', input: { ...algorithms.astar.defaults, edges: '0,1,2; 0,1,3' } }, 422, 'edges'],
    [{ model: 'knapsack', input: { weights: '1,2', values: '3', capacity: 2 } }, 422, 'values'],
    [{ model: 'gcd', input: { a: 0, b: 0 } }, 422, 'b'],
  ]) { const response = await call(body); assert.equal(response.status, status); assert.equal((await response.json()).field, field); }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { algorithms, runAlgorithm } from '../backend/algorithms.js';
const solve = (id, input = {}) => runAlgorithm(id, { ...algorithms[id].defaults, ...input });
for (const id of ['counting', 'radix', 'shell'])
  test(`${id} sorts independently generated values including extremes and duplicates`, () => {
    for (const values of id === 'radix'
      ? ['0', '999,0,10,100,1,999', '5,4,3,2,1']
      : id === 'counting'
        ? ['0', '20,-20,0,20,-20', '5,4,3,2,1']
        : ['0', '99,-99,0,99,-99', '5,4,3,2,1']) {
      const r = solve(id, { values });
      assert.deepEqual(
        r.result.array,
        values
          .split(',')
          .map(Number)
          .sort((a, b) => a - b),
      );
      assert.deepEqual(r.frames[0].state.array, values.split(',').map(Number));
    }
  });
test('Kahn ordering respects every edge, includes isolated nodes and detects cycles', () => {
  const r = solve('topological');
  assert.equal(r.result.acyclic, true);
  assert.equal(r.result.order.length, 6);
  for (const e of r.input.edges)
    assert.ok(r.result.order.indexOf(e.from) < r.result.order.indexOf(e.to));
  assert.equal(solve('topological', { edges: '0,1,1; 1,0,1' }).result.acyclic, false);
  assert.deepEqual(solve('topological', { edges: '' }).result.order, [0, 1, 2, 3, 4, 5]);
});
test('Kruskal and Prim match exhaustive spanning-tree enumeration on the default graph', () => {
  const trace = solve('kruskal'),
    edges = trace.input.edges;
  let best = Infinity;
  for (let mask = 0; mask < 1 << edges.length; mask++) {
    const chosen = edges.filter((_, i) => (mask >> i) & 1);
    if (chosen.length !== 5) continue;
    const reached = new Set([0]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of chosen)
        if (reached.has(e.from) !== reached.has(e.to)) {
          reached.add(e.from);
          reached.add(e.to);
          changed = true;
        }
    }
    if (reached.size === 6)
      best = Math.min(
        best,
        chosen.reduce((s, e) => s + e.weight, 0),
      );
  }
  assert.equal(best, 13);
  for (const id of ['kruskal', 'prim']) {
    const r = solve(id).result;
    assert.equal(r.weight, best);
    assert.equal(r.components, 1);
    assert.equal(r.selected.length, 5);
  }
});
test('minimum spanning forests include disconnected and isolated components', () => {
  for (const id of ['kruskal', 'prim']) {
    const r = solve(id, { edges: '0,1,1; 1,2,2; 0,2,5; 3,4,4' }).result;
    assert.equal(r.weight, 7);
    assert.equal(r.components, 3);
    assert.equal(r.selected.length, 3);
    assert.equal(solve(id, { edges: '' }).result.components, 6);
    assert.equal(solve(id, { edges: '0,1,0; 1,2,0' }).result.weight, 0);
  }
});
test('Floyd distances match exhaustive simple paths and flag negative cycles', () => {
  const trace = solve('floyd'),
    edges = trace.input.edges;
  for (let source = 0; source < 6; source++) {
    const distance = Array(6).fill(Infinity);
    distance[source] = 0;
    const walk = (u, sum, seen) => {
      distance[u] = Math.min(distance[u], sum);
      for (const e of edges.filter((e) => e.from === u))
        if (!seen.has(e.to)) walk(e.to, sum + e.weight, new Set([...seen, e.to]));
    };
    walk(source, 0, new Set([source]));
    assert.deepEqual(trace.result.matrix[source], distance);
  }
  assert.equal(solve('floyd', { edges: '0,1,-2; 1,2,1' }).result.matrix[0][2], -1);
  assert.equal(solve('floyd', { edges: '0,1,-2; 1,0,1' }).result.negativeCycle, true);
});
for (const id of ['kmp', 'rabinkarp'])
  test(`${id} agrees with naive matching including overlaps and a longer pattern`, () => {
    for (const [text, pattern] of [
      ['AAAAA', 'AAA'],
      ['ABABABCABABABC', 'ABABC'],
      ['abc', 'abcdef'],
      ['a b a b', 'a b'],
      ['abABab', 'ab'],
      ['abc', 'z'],
    ]) {
      const expected = [];
      for (let i = 0; i <= text.length - pattern.length; i++)
        if (text.slice(i, i + pattern.length) === pattern) expected.push(i);
      assert.deepEqual(solve(id, { text, pattern }).result.matches, expected);
    }
  });
test('Rabin–Karp verifies a deliberately colliding hash before reporting a match', () => {
  const seen = new Map();
  let pair;
  for (let a = 65; a <= 90 && !pair; a++)
    for (let b = 65; b <= 90 && !pair; b++) {
      const word = String.fromCharCode(a, b),
        h = (a * 31 + b) % 101;
      if (seen.has(h)) pair = [seen.get(h), word];
      else seen.set(h, word);
    }
  assert.ok(pair);
  const r = solve('rabinkarp', { text: pair[0], pattern: pair[1] });
  assert.deepEqual(r.result.matches, []);
  assert.ok(r.frames.some((f) => /collision/.test(f.message)));
});
test('LCS length matches exhaustive subsequences and returned letters occur in order', () => {
  const subsequence = (a, b) => {
    let i = 0;
    for (const c of b) if (a[i] === c) i++;
    return i === a.length;
  };
  for (const [first, second] of [
    ['ABCBDAB', 'BDCABA'],
    ['AAAA', 'AA'],
    ['ABC', 'XYZ'],
    ['ABAC', 'BACA'],
  ]) {
    let best = 0;
    for (let mask = 0; mask < 1 << first.length; mask++) {
      const s = [...first].filter((_, i) => (mask >> i) & 1).join('');
      if (subsequence(s, second)) best = Math.max(best, s.length);
    }
    const r = solve('lcs', { first, second }).result;
    assert.equal(r.length, best);
    assert.ok(subsequence(r.sequence, first) && subsequence(r.sequence, second));
  }
});
test('edit distance alignment reproduces the inputs and has the claimed unit edit cost', () => {
  for (const [first, second, expected] of [
    ['kitten', 'sitting', 3],
    ['abc', 'abc', 0],
    ['a', 'xyz', 3],
    ['ab', 'ba', 2],
  ]) {
    const r = solve('editdistance', { first, second }).result;
    assert.equal(r.distance, expected);
    assert.equal(r.alignment[0].replaceAll('−', ''), first);
    assert.equal(r.alignment[1].replaceAll('−', ''), second);
    assert.equal([...r.alignment[0]].filter((c, i) => c !== r.alignment[1][i]).length, expected);
  }
});
test('unbounded coin DP matches independent breadth-first reachable-amount search', () => {
  for (const [coins, amount] of [
    ['1,3,4', 6],
    ['4,6', 7],
    ['2,5,7', 27],
    ['3', 0],
    ['7,7', 14],
  ]) {
    const c = coins.split(',').map(Number),
      queue = [[0, 0]],
      seen = new Set([0]);
    let best = null;
    while (queue.length) {
      const [a, n] = queue.shift();
      if (a === amount) {
        best = n;
        break;
      }
      for (const v of c)
        if (a + v <= amount && !seen.has(a + v)) {
          seen.add(a + v);
          queue.push([a + v, n + 1]);
        }
    }
    const r = solve('coinchange', { coins, amount }).result;
    assert.equal(r.minimum, best);
    if (best !== null)
      assert.equal(
        r.coins.reduce((s, v) => s + v, 0),
        amount,
      );
  }
});
test('LIS matches exhaustive strictly increasing subsequences, including duplicates', () => {
  for (const values of ['10,9,2,5,3,7,18', '2,2,2', '5,4,3,2,1', '-3,-1,-2,0']) {
    const a = values.split(',').map(Number);
    let best = 0;
    for (let mask = 1; mask < 1 << a.length; mask++) {
      const s = a.filter((_, i) => (mask >> i) & 1);
      if (s.every((v, i) => !i || s[i - 1] < v)) best = Math.max(best, s.length);
    }
    const r = solve('lis', { values }).result;
    assert.equal(r.length, best);
    assert.ok(r.sequence.every((v, i) => !i || r.sequence[i - 1] < v));
    assert.deepEqual(
      r.sequence,
      r.indexes.map((i) => a[i]),
    );
  }
});
test('Kadane matches exhaustive nonempty intervals and handles all-negative arrays', () => {
  for (const values of ['-2,1,-3,4,-1,2,1,-5,4', '-8,-3,-6,-2,-5', '0,0,0', '5', '-1,3,-1,3,-10']) {
    const a = values.split(',').map(Number);
    let best = -Infinity;
    for (let i = 0; i < a.length; i++) {
      let sum = 0;
      for (let j = i; j < a.length; j++) {
        sum += a[j];
        best = Math.max(best, sum);
      }
    }
    const r = solve('kadane', { values }).result;
    assert.equal(r.sum, best);
    assert.equal(
      r.values.reduce((s, v) => s + v, 0),
      best,
    );
  }
});
test('sieve agrees with independent trial division at inclusive bounds', () => {
  for (const limit of [2, 3, 4, 30, 49, 50, 97, 100]) {
    const expected = [];
    for (let n = 2; n <= limit; n++) {
      let p = true;
      for (let d = 2; d * d <= n; d++) if (n % d === 0) p = false;
      if (p) expected.push(n);
    }
    assert.deepEqual(solve('sieve', { limit }).result.primes, expected);
  }
});

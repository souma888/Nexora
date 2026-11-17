import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { deepAlgorithms } from '../backend/deep-algorithm-definitions.js';
import { runAlgorithm, validateAlgorithm } from '../backend/algorithms.js';
import { POST } from '../api/algorithms.js';
const solve = (id, input = {}) =>
  runAlgorithm(id, { ...deepAlgorithms[id].defaults, ...input }).result;
const trace = (id, input = {}) => runAlgorithm(id, { ...deepAlgorithms[id].defaults, ...input });
const permutations = (a) =>
  a.length
    ? a.flatMap((v, i) => permutations(a.filter((_, j) => i !== j)).map((r) => [v, ...r]))
    : [[]];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const finite = (value) => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
test('maximum documented TSP and lifting dimensions remain accepted', () => {
  const A = Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => +(i !== j))),
    tsp = solve('bitmasktsp', { matrix: JSON.stringify(A) });
  assert.equal(tsp.cost, 9);
  assert.equal(tsp.tour.length, 10);
  assert.equal(new Set(tsp.tour).size, 9);
  assert.equal(solve('lca', { parents: Array(24).fill(0).join(','), u: 23, v: 22 }).ancestor, 0);
});
for (const [id, d] of Object.entries(deepAlgorithms))
  test(`${id}: executable trace, immutable snapshots, teaching metadata and HTTP parity`, async () => {
    const r = trace(id);
    assert.ok(r.frames.length);
    finite(r);
    for (const k of ['description', 'invariant', 'example', 'predict', 'complexity'])
      assert.ok(d[k]);
    assert.equal(d.answer.length, 3);
    const snapshot = JSON.stringify(r.frames[0]);
    if (r.frames.length > 1) {
      r.frames.at(-1).stats.visits += 100;
      assert.equal(JSON.stringify(r.frames[0]), snapshot);
    }
    const api = await POST(
      new Request('http://localhost/api/algorithms', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: d.defaults }),
      }),
    );
    assert.equal(api.status, 200);
    assert.deepEqual((await api.json()).result, solve(id));
  });
function rbInvariant(result) {
  const nodes = new Map(result.nodes.map((n) => [n.id, n])),
    children = new Map(result.nodes.map((n) => [n.id, []]));
  for (const [a, b] of result.edges) children.get(a).push(b);
  function visit(id, lo = -Infinity, hi = Infinity) {
    if (id === null) return 1;
    const n = nodes.get(id);
    assert.ok(n.id > lo && n.id < hi);
    const a = children.get(id),
      l = a.find((k) => k < id) ?? null,
      r = a.find((k) => k > id) ?? null;
    assert.ok(a.length <= 2);
    if (n.red) for (const c of a) assert.equal(nodes.get(c).red, false);
    const L = visit(l, lo, id),
      R = visit(r, id, hi);
    assert.equal(L, R);
    return L + +!n.red;
  }
  assert.equal(nodes.get(result.root).red, false);
  assert.equal(visit(result.root), result.blackHeight);
}
test('red–black insertion satisfies independently reconstructed BST, red-parent and black-height invariants', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: -99, max: 99 }), { minLength: 1, maxLength: 24 }),
      (a) => {
        const r = solve('redblack', { values: a.join(',') });
        rbInvariant(r);
        assert.equal(r.nodes.length, new Set(a).size);
      },
    ),
    { numRuns: 80, seed: 67 },
  );
  assert.equal(solve('redblack', { values: '41,38,31' }).root, 38);
});
test('B-tree occupancy, key ranges, arity and equal leaf depth hold across degrees and split patterns', () => {
  for (const degree of [2, 3, 4])
    for (const a of [
      Array.from({ length: 24 }, (_, i) => i),
      Array.from({ length: 24 }, (_, i) => 23 - i),
      [5, 1, 5, 3, 2, 4],
    ]) {
      const r = solve('btree', { degree, values: a.join(',') }),
        leaves = [],
        keys = [];
      function visit(n, depth, lo = -Infinity, hi = Infinity, isRoot = false) {
        assert.ok(n.keys.length <= 2 * degree - 1);
        if (!isRoot) assert.ok(n.keys.length >= degree - 1);
        n.keys.forEach((k, i) => {
          assert.ok(k > lo && k < hi);
          if (i) assert.ok(k > n.keys[i - 1]);
          keys.push(k);
        });
        if (!n.children.length) leaves.push(depth);
        else {
          assert.equal(n.children.length, n.keys.length + 1);
          n.children.forEach((c, i) =>
            visit(c, depth + 1, i ? n.keys[i - 1] : lo, i < n.keys.length ? n.keys[i] : hi),
          );
        }
      }
      visit(r.tree, 0, -Infinity, Infinity, true);
      assert.equal(new Set(leaves).size, 1);
      assert.deepEqual(
        keys.sort((a, b) => a - b),
        [...new Set(a)].sort((a, b) => a - b),
      );
    }
});
test('skip-list search matches set membership and Bloom filters have no false negatives', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const target of [-99, 3, 19, 99]) {
      const r = solve('skiplist', { target, seed });
      assert.equal(r.found, r.values.includes(target));
      assert.ok(r.heights.every((h) => h >= 1 && h <= 6));
    }
  }
  for (const bits of [8, 32, 128])
    for (const hashes of [1, 3, 8])
      for (const query of ['alpha', 'beta', 'gamma', 'delta'])
        assert.equal(solve('bloom', { bits, hashes, query }).possibly, true);
  const r = solve('bloom', {
    words: 'alpha,beta,gamma,delta,one,two,three,four',
    bits: 8,
    hashes: 8,
    query: 'absent',
  });
  assert.equal(r.present, false);
  assert.equal(r.possibly, true);
});
test('Z matches naive overlapping search; Manacher matches exhaustive palindromes; suffix/LCP match direct suffix sorting', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 1, maxLength: 25 }),
      (a) => {
        const text = a.join(''),
          pattern = text.slice(0, Math.min(3, text.length)),
          matches = [];
        for (let i = 0; i <= text.length - pattern.length; i++)
          if (text.slice(i, i + pattern.length) === pattern) matches.push(i);
        assert.deepEqual(solve('zmatch', { text, pattern }).matches, matches);
        let best = '',
          start = 0;
        for (let i = 0; i < text.length; i++)
          for (let j = i + 1; j <= text.length; j++) {
            const sub = text.slice(i, j);
            if (sub === [...sub].reverse().join('') && sub.length > best.length) {
              best = sub;
              start = i;
            }
          }
        const m = solve('manacher', { text });
        assert.equal(m.palindrome, best);
        assert.equal(m.start, start);
        const sa = Array.from({ length: text.length }, (_, i) => i).sort((i, j) =>
            text.slice(i) < text.slice(j) ? -1 : 1,
          ),
          r = solve('suffixarray', { text });
        assert.deepEqual(r.suffixArray, sa);
        for (let i = 1; i < sa.length; i++) {
          let n = 0;
          while (
            sa[i] + n < text.length &&
            sa[i - 1] + n < text.length &&
            text[sa[i] + n] === text[sa[i - 1] + n]
          )
            n++;
          assert.equal(r.lcp[i], n);
        }
      },
    ),
    { numRuns: 60, seed: 71 },
  );
});
test('Aho–Corasick reports all inherited, overlapping and duplicate-deduplicated patterns', () => {
  for (const text of ['ushers', 'aaaaaa', 'ababab', 'z']) {
    const patterns = ['a', 'aa', 'aba', 'ba', 'he', 'she', 'hers'],
      r = solve('ahocorasick', { text, patterns: patterns.join(',') }),
      expected = [];
    for (const p of patterns)
      for (let i = 0; i <= text.length - p.length; i++)
        if (text.slice(i, i + p.length) === p) expected.push(`${p}@${i}`);
    assert.deepEqual(r.matches.map((m) => m.pattern + '@' + m.start).sort(), expected.sort());
  }
  assert.equal(solve('ahocorasick', { text: 'aaa', patterns: 'a,a' }).matches.length, 3);
});
test('both hull scans enclose all integer points; closest pair agrees with every pair including duplicates', () => {
  fc.assert(
    fc.property(
      fc.array(fc.tuple(fc.integer({ min: -10, max: 10 }), fc.integer({ min: -10, max: 10 })), {
        minLength: 2,
        maxLength: 20,
      }),
      (points) => {
        const a = solve('convexhull', { points: JSON.stringify(points), method: 0 }),
          b = solve('convexhull', { points: JSON.stringify(points), method: 1 });
        assert.deepEqual(
          a.hull.map((p) => p.join(',')).sort(),
          b.hull.map((p) => p.join(',')).sort(),
        );
        near(a.area, b.area);
        if (a.hull.length >= 3)
          for (let i = 0; i < a.hull.length; i++) {
            const u = a.hull[i],
              v = a.hull[(i + 1) % a.hull.length];
            for (const p of points)
              assert.ok((v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]) >= 0);
          }
        let best = Infinity;
        for (let i = 0; i < points.length; i++)
          for (let j = i + 1; j < points.length; j++)
            best = Math.min(
              best,
              Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]),
            );
        near(solve('closestpair', { points: JSON.stringify(points) }).distance, best);
      },
    ),
    { numRuns: 60, seed: 75 },
  );
});
const matrixArb = fc
  .integer({ min: 2, max: 5 })
  .chain((n) =>
    fc
      .array(fc.integer({ min: 0, max: 6 }), { minLength: n * n, maxLength: n * n })
      .map((a) =>
        Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => (i === j ? 0 : a[i * n + j])),
        ),
      ),
  );
test('both max-flow implementations equal exhaustive minimum cuts and obey arc capacities and conservation', () => {
  fc.assert(
    fc.property(matrixArb, (A) => {
      const n = A.length;
      let cut = Infinity;
      for (let mask = 0; mask < 1 << (n - 2); mask++) {
        const S = new Set([
          0,
          ...Array.from({ length: n - 2 }, (_, i) => i + 1).filter((_, i) => mask & (1 << i)),
        ]);
        let capacity = 0;
        for (const u of S) for (let v = 0; v < n; v++) if (!S.has(v)) capacity += A[u][v];
        cut = Math.min(cut, capacity);
      }
      for (const method of [0, 1]) {
        const r = solve('maxflow', { matrix: JSON.stringify(A), method });
        assert.equal(r.flow, cut);
        assert.equal(r.cutCapacity, cut);
        const balance = Array(n).fill(0);
        for (const e of r.arcs) {
          assert.ok(e.flow >= 0 && e.flow <= e.capacity);
          balance[e.from] -= e.flow;
          balance[e.to] += e.flow;
        }
        near(balance[0], -cut);
        assert.equal(balance[n - 1], cut);
        assert.ok(balance.slice(1, -1).every((v) => v === 0));
      }
    }),
    { numRuns: 40, seed: 77 },
  );
  assert.equal(solve('maxflow').flow, 23);
});
test('matching equals exhaustive search and its cover hits every edge; assignment equals permutation minimum and dual optimum', () => {
  fc.assert(
    fc.property(matrixArb, (A) => {
      const binary = A.map((row) => row.map((v) => +(v % 2))),
        n = A.length;
      let size = 0;
      function match(u, used, count) {
        if (u === n) {
          size = Math.max(size, count);
          return;
        }
        match(u + 1, used, count);
        for (let v = 0; v < n; v++)
          if (binary[u][v] && !used.has(v)) match(u + 1, new Set([...used, v]), count + 1);
      }
      match(0, new Set(), 0);
      const r = solve('hopcroftkarp', { matrix: JSON.stringify(binary) });
      assert.equal(r.size, size);
      assert.equal(r.coverLeft.length + r.coverRight.length, size);
      for (let u = 0; u < n; u++)
        for (let v = 0; v < n; v++)
          if (binary[u][v]) assert.ok(r.coverLeft.includes(u) || r.coverRight.includes(v));
      const min = Math.min(
          ...permutations(Array.from({ length: n }, (_, i) => i)).map((p) =>
            p.reduce((s, j, i) => s + A[i][j], 0),
          ),
        ),
        h = solve('hungarian', { matrix: JSON.stringify(A) });
      assert.equal(h.cost, min);
      assert.equal(h.dual, min);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          assert.ok(h.rowPotentials[i] + h.columnPotentials[j] <= A[i][j]);
    }),
    { numRuns: 30, seed: 78 },
  );
});
function components(A, skip = -1, edge = []) {
  const seen = new Set();
  let count = 0;
  for (let i = 0; i < A.length; i++)
    if (i !== skip && !seen.has(i)) {
      count++;
      const q = [i];
      seen.add(i);
      for (let h = 0; h < q.length; h++)
        for (let j = 0; j < A.length; j++)
          if (
            j !== skip &&
            A[q[h]][j] &&
            !seen.has(j) &&
            !(edge.includes(q[h]) && edge.includes(j))
          ) {
            seen.add(j);
            q.push(j);
          }
    }
  return count;
}
test('bridges and cut vertices agree with independent removal/connectivity tests, including disconnected graphs', () => {
  fc.assert(
    fc.property(matrixArb, (M) => {
      const A = M.map((row, i) =>
          row.map((v, j) => (i === j ? 0 : +(M[Math.min(i, j)][Math.max(i, j)] % 2 === 1))),
        ),
        base = components(A),
        r = solve('bridges', { matrix: JSON.stringify(A) }),
        cuts = A.flatMap((_, i) => (components(A, i) > base ? [i] : [])),
        bridges = [];
      for (let i = 0; i < A.length; i++)
        for (let j = i + 1; j < A.length; j++)
          if (A[i][j] && components(A, -1, [i, j]) > base) bridges.push(`${i},${j}`);
      assert.deepEqual(r.articulation, cuts);
      assert.deepEqual(
        r.bridges.map((e) => e.sort((a, b) => a - b).join(',')).sort(),
        bridges.sort(),
      );
    }),
    { numRuns: 40, seed: 80 },
  );
});
test('binary lifting, static RMQ, subset TSP and interval scheduling match independent brute-force references', () => {
  const parents = [0, 0, 0, 1, 1, 2, 5, 5];
  for (let u = 0; u < parents.length; u++)
    for (let v = 0; v < parents.length; v++) {
      const ancestors = new Set();
      let p = u;
      while (!ancestors.has(p)) {
        ancestors.add(p);
        p = parents[p];
      }
      p = v;
      while (!ancestors.has(p)) p = parents[p];
      assert.equal(solve('lca', { parents: parents.join(','), u, v }).ancestor, p);
    }
  const a = [4, -3, 7, 1, 8, -9, 2];
  for (let left = 0; left < a.length; left++)
    for (let right = left; right < a.length; right++)
      assert.equal(
        solve('sparsetable', { values: a.join(','), left, right }).minimum,
        Math.min(...a.slice(left, right + 1)),
      );
  fc.assert(
    fc.property(matrixArb, (A) => {
      const n = A.length,
        min = Math.min(
          ...permutations(Array.from({ length: n - 1 }, (_, i) => i + 1)).map((p) =>
            [0, ...p, 0].slice(1).reduce((s, v, i) => s + A[[0, ...p, 0][i]][v], 0),
          ),
        );
      assert.equal(solve('bitmasktsp', { matrix: JSON.stringify(A) }).cost, min);
    }),
    { numRuns: 25, seed: 83 },
  );
  const intervals = [
    [0, 3],
    [1, 2],
    [2, 4],
    [3, 5],
    [4, 6],
    [5, 7],
  ];
  let max = 0;
  for (let mask = 0; mask < 1 << intervals.length; mask++) {
    const a = intervals.filter((_, i) => mask & (1 << i)).sort((a, b) => a[0] - b[0]);
    if (a.every((v, i) => !i || a[i - 1][1] <= v[0])) max = Math.max(max, a.length);
  }
  assert.equal(solve('intervals').count, max);
  assert.equal(solve('bitmasktsp').cost, 80);
});
test('deep validators reject malformed and out-of-domain graphs, trees, strings and queries with field errors', () => {
  for (const [id, input, field] of [
    ['maxflow', { matrix: '[[0,-1],[0,0]]' }, 'matrix'],
    ['hopcroftkarp', { matrix: '[[2]]' }, 'matrix'],
    ['hungarian', { matrix: '[[1,2]]' }, 'matrix'],
    ['lca', { parents: '0,2,1' }, 'parents'],
    ['sparsetable', { left: 5, right: 1 }, 'right'],
    ['convexhull', { points: '[[0,"<svg>"] , [1,2]]' }, 'points'],
    ['intervals', { intervals: '[[2,1]]' }, 'intervals'],
    ['zmatch', { pattern: '#' }, 'pattern'],
  ])
    assert.throws(
      () => validateAlgorithm(id, { ...deepAlgorithms[id].defaults, ...input }),
      (e) => e.field === field,
    );
});

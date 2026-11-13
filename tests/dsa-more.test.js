import assert from 'node:assert/strict';
import test from 'node:test';
import { algorithms, runAlgorithm } from '../backend/algorithms.js';
import { dsaMore } from '../backend/dsa-more-definitions.js';
import { POST } from '../api/algorithms.js';
const solve = (id, input = {}) => runAlgorithm(id, { ...algorithms[id].defaults, ...input });

test('two pointers returns distinct original entries and agrees with exhaustive pairs', () => {
  for (const a of [[4, 4, 1], [-8, -2, 0, 2, 7], [1], [1, 2, 3]])
    for (let target = -10; target <= 10; target++) {
      const { pair } = solve('twopointers', { values: a.join(','), target }).result;
      const exists = a.some((v, i) => a.some((w, j) => i !== j && v + w === target));
      assert.equal(Boolean(pair), exists);
      if (pair) {
        assert.notEqual(...pair.indexes);
        assert.deepEqual(
          pair.values,
          pair.indexes.map((i) => a[i]),
        );
        assert.equal(pair.values[0] + pair.values[1], target);
      }
    }
});
test('fixed windows support negative totals, endpoint sizes and earliest ties', () => {
  for (const a of [
    [-8, -3, -6, -2],
    [2, 1, 5, 1, 3, 2],
    [4, 4, 4],
  ])
    for (let k = 1; k <= a.length; k++) {
      const totals = Array.from({ length: a.length - k + 1 }, (_, i) =>
          a.slice(i, i + k).reduce((s, v) => s + v, 0),
        ),
        best = Math.max(...totals);
      const r = solve('slidingwindow', { values: a.join(','), k }).result;
      assert.equal(r.sum, best);
      assert.equal(r.left, totals.indexOf(best));
      assert.equal(r.right, r.left + k - 1);
    }
});
test('exclusive prefixes answer every inclusive range by direct summation', () => {
  const a = [3, -2, 5, 1, 4];
  for (let left = 0; left < a.length; left++)
    for (let right = left; right < a.length; right++) {
      const r = solve('prefixrange', { left, right }).result;
      assert.equal(
        r.sum,
        a.slice(left, right + 1).reduce((s, v) => s + v, 0),
      );
      assert.equal(r.prefix.length, a.length + 1);
    }
});
test('quickselect ranks duplicates and signed values without requiring sorted output', () => {
  for (const a of [[9, 3, 7, 1, 8, 2], [4, 4, 4], [-5, 2, -5, 0, 8], [1], [5, 4, 3, 2, 1]])
    for (let k = 1; k <= a.length; k++)
      assert.equal(
        solve('quickselect', { values: a.join(','), k }).result.value,
        [...a].sort((x, y) => x - y)[k - 1],
      );
});
test('monotonic stack finds the first strictly greater neighbor, matching a quadratic oracle', () => {
  for (const a of [[4, 5, 2, 10, 8], [3, 3, 3], [-4, -1, -3, 0], [9, 5, 1], [1]]) {
    const r = solve('nextgreater', { values: a.join(',') }).result;
    const indexes = a.map((v, i) => a.findIndex((w, j) => j > i && w > v));
    assert.deepEqual(r.nextIndex, indexes);
    assert.deepEqual(
      r.next,
      indexes.map((i) => (i < 0 ? null : a[i])),
    );
  }
});
test('Huffman has known weighted cost, prefix-free codes and a defined singleton code', () => {
  const r = solve('huffman').result;
  assert.equal(r.cost, 224);
  assert.equal(r.average, 2.24);
  for (const weights of ['5,9,12,13,16,45', '1,1,1,1', '7']) {
    const r = solve('huffman', { weights }).result;
    r.codes.forEach((code, i) =>
      r.codes.forEach((other, j) => {
        if (i !== j) assert.ok(!other.startsWith(code));
      }),
    );
    if (r.codes.length > 1)
      assert.equal(
        r.cost,
        r.nodes.filter((n) => n.left !== null).reduce((s, n) => s + n.weight, 0),
      );
    else {
      assert.deepEqual(r.codes, ['0']);
      assert.equal(r.cost, 7);
    }
  }
});
test('Tarjan partition equals mutual reachability including completed-component edges', () => {
  for (const edges of [
    algorithms.tarjan.defaults.edges,
    '',
    '0,1,1; 2,1,1; 2,3,1; 3,2,1; 4,5,1; 5,4,1',
    '0,1,1; 1,2,1; 2,0,1; 3,1,1',
  ]) {
    const trace = solve('tarjan', { edges }),
      r = trace.result,
      reach = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => i === j));
    trace.input.edges.forEach((e) => (reach[e.from][e.to] = true));
    for (let k = 0; k < 6; k++)
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++) reach[i][j] ||= reach[i][k] && reach[k][j];
    assert.deepEqual(
      r.components.flat().sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5],
    );
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++)
        assert.equal(r.groups[i] === r.groups[j], reach[i][j] && reach[j][i]);
    assert.ok(trace.frames[0].state.index.every((v) => v === null));
  }
});
test('0/1 subset table agrees with exhaustive subsets and never reuses an entry', () => {
  for (const a of [
    [3, 5, 7, 9, 11],
    [0, 0, 4],
    [2, 2, 6],
  ])
    for (let target = 0; target <= 15; target++) {
      const exists = Array.from({ length: 2 ** a.length }, (_, mask) =>
          a.reduce((s, v, i) => s + ((mask >> i) & 1 ? v : 0), 0),
        ).includes(target),
        r = solve('subsetsum', { values: a.join(','), target }).result;
      assert.equal(r.reachable, exists);
      assert.equal(new Set(r.indexes).size, r.indexes.length);
      if (r.reachable)
        assert.equal(
          r.values.reduce((s, v) => s + v, 0),
          target,
        );
    }
});
test('matrix-chain costs equal exhaustive parenthesizations, including one matrix', () => {
  const cost = (d, i, j) =>
    i === j
      ? 0
      : Math.min(
          ...Array.from({ length: j - i }, (_, offset) => {
            const k = i + offset;
            return cost(d, i, k) + cost(d, k + 1, j) + d[i] * d[k + 1] * d[j + 1];
          }),
        );
  for (const d of [
    [40, 20, 30, 10, 30],
    [2, 3],
    [5, 2, 4, 3],
    [3, 3, 3, 3, 3],
  ])
    assert.equal(
      solve('matrixchain', { dimensions: d.join(',') }).result.cost,
      cost(d, 0, d.length - 2),
    );
  assert.equal(solve('matrixchain').result.cost, 26000);
});
test('N-Queens traces actual backtracking and ends with nonattacking boards for N=4..6', () => {
  for (let size = 4; size <= 6; size++) {
    const trace = solve('nqueens', { size }),
      r = trace.result;
    assert.equal(r.solved, true);
    assert.equal(new Set(r.columns).size, size);
    r.columns.forEach((c, i) =>
      r.columns.forEach((d, j) => {
        if (i !== j) assert.notEqual(Math.abs(c - d), Math.abs(i - j));
      }),
    );
    assert.ok(trace.frames[0].state.columns.every((v) => v === null));
    if (size === 4) assert.ok(trace.frames.some((f) => f.message.startsWith('Backtrack:')));
  }
  assert.deepEqual(solve('nqueens').result.columns, [1, 3, 0, 2]);
});
test('ten DSA definitions expose executable presets, bounded traces and field validation', async () => {
  assert.equal(Object.keys(dsaMore).length, 10);
  for (const [id, d] of Object.entries(dsaMore)) {
    for (const preset of [{}, ...Object.values(d.presets)]) {
      const r = solve(id, preset);
      assert.ok(r.frames.length > 1);
      assert.ok(r.frames.every((f) => f.line >= 0 && f.line < d.lines.length));
    }
    const r = await POST(
      new Request('http://localhost/api/algorithms', {
        method: 'POST',
        body: JSON.stringify({ model: id, input: d.defaults }),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).result.text, solve(id).result.text);
  }
  assert.ok(
    Buffer.byteLength(
      JSON.stringify(solve('subsetsum', { values: '1,2,3,4,5,6,7,8', target: 40 })),
    ) < 3_000_000,
  );
  for (const [model, input, field] of [
    ['quickselect', { values: '1', k: 2 }, 'k'],
    ['slidingwindow', { values: '1', k: 2 }, 'k'],
    ['matrixchain', { dimensions: '3' }, 'dimensions'],
    ['prefixrange', { left: 4, right: 2 }, 'right'],
    ['nqueens', { size: 7 }, 'size'],
    ['huffman', { weights: '0,3' }, 'weights'],
  ]) {
    const response = await POST(
      new Request('http://localhost/api/algorithms', {
        method: 'POST',
        body: JSON.stringify({ model, input: { ...algorithms[model].defaults, ...input } }),
      }),
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).field, field);
  }
});

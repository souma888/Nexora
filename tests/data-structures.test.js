import assert from 'node:assert/strict';
import test from 'node:test';
import { algorithms, runAlgorithm } from '../backend/algorithms.js';
import { additionalAlgorithms } from '../backend/advanced-definitions.js';
import { POST } from '../api/algorithms.js';
const solve = (id, input = {}) => runAlgorithm(id, { ...algorithms[id].defaults, ...input });

test('stack, queue and deque obey their removal order and preserve underflow', () => {
  assert.deepEqual(solve('stack').result.values, [8, 5]);
  assert.deepEqual(solve('queue').result.values, [3, 5]);
  assert.deepEqual(solve('deque').result.values, [5, 8]);
  for (const [id, operations] of [
    ['stack', 'pop; push 1; push 2; pop; pop; pop'],
    ['queue', 'dequeue; enqueue 1; enqueue 2; dequeue; dequeue; dequeue'],
    ['deque', 'popback; pushfront 1; pushback 2; popfront; popback; front'],
  ]) {
    const r = solve(id, { operations }).result;
    assert.deepEqual(r.values, []);
    assert.match(r.events[0][1], /Underflow/);
  }
});
test('circular buffer wraps and rejects overflow without losing queued values', () => {
  const r = solve('circularqueue').result;
  assert.deepEqual(r.values, [3, 5, 9, 2]);
  assert.deepEqual(r.slots, [2, 3, 5, 9]);
  assert.equal(r.head, 1);
  const one = solve('circularqueue', {
    capacity: 1,
    operations: 'enqueue 1; enqueue 2; dequeue; enqueue 3; front',
  }).result;
  assert.deepEqual(one.values, [3]);
  assert.match(one.events[1][1], /Overflow/);
});
test('singly linked list reconnects head, middle and tail with stable node identities', () => {
  assert.deepEqual(solve('linkedlist').result.values, [5, 8]);
  const trace = solve('linkedlist', {
    operations: 'append 1; append 2; insert 1 3; delete 0; delete 1; insert -1 9; find 3',
  });
  assert.deepEqual(trace.result.values, [3]);
  assert.equal(trace.result.head, trace.result.tail);
  for (const frame of trace.frames) {
    const { nodes, head, tail } = frame.state;
    assert.equal(nodes[0]?.id ?? null, head);
    assert.equal(nodes.at(-1)?.id ?? null, tail);
    nodes.forEach((n, i) => assert.equal(n.next, nodes[i + 1]?.id ?? null));
  }
});
test('double links remain reciprocal through deletion and reversal', () => {
  assert.deepEqual(solve('doublylinked').result.values, [3, 5]);
  const trace = solve('doublylinked', {
    operations:
      'reverse; append 1; prepend 2; append 3; reverse; delete 1; reverse; delete 1; delete 0; reverse',
  });
  assert.deepEqual(trace.result.values, []);
  for (const frame of trace.frames)
    frame.state.nodes.forEach((n, i, nodes) => {
      assert.equal(n.prev, nodes[i - 1]?.id ?? null);
      assert.equal(n.next, nodes[i + 1]?.id ?? null);
    });
});
test('BST and AVL preserve key ordering and duplicate policy', () => {
  for (const id of ['bst', 'avl']) {
    const r = solve(id, { values: '5, 3, 7, 5, 3, -2, 9', target: -2 }).result;
    assert.deepEqual(r.inorder, [-2, 3, 5, 7, 9]);
    assert.equal(r.nodes.length, 5);
    assert.equal(r.found, true);
    assert.equal(solve(id, { target: 99 }).result.found, false);
    const walk = (at, lower, upper) => {
      if (at === null) return;
      const n = r.nodes[at];
      assert.ok(lower < n.value && n.value < upper);
      for (const c of [n.left, n.right]) if (c !== null) assert.equal(r.nodes[c].parent, at);
      walk(n.left, lower, n.value);
      walk(n.right, n.value, upper);
    };
    walk(r.root, -Infinity, Infinity);
  }
});
test('AVL balances LL, RR, LR, RL and long sorted insertions', () => {
  for (const values of [
    '30,20,10',
    '10,20,30',
    '30,10,20',
    '10,30,20',
    Array.from({ length: 16 }, (_, i) => i).join(','),
    Array.from({ length: 16 }, (_, i) => 15 - i).join(','),
  ]) {
    const trace = solve('avl', { values });
    const r = trace.result;
    const check = (at) => {
      if (at === null) return 0;
      const a = check(r.nodes[at].left),
        b = check(r.nodes[at].right);
      assert.ok(Math.abs(a - b) <= 1);
      return 1 + Math.max(a, b);
    };
    assert.equal(check(r.root), r.height);
    assert.deepEqual(trace.frames[0].state.nodes, []);
    if (r.nodes.length === 3) assert.equal(r.nodes[r.root].value, 20);
    assert.ok(trace.frames.some((f) => /After rotation/.test(f.message)));
  }
});
test('min heap extracts sorted minima, retains heap invariant and handles exhausted input', () => {
  assert.deepEqual(solve('minheap').result.extracted, [1, 3, 4]);
  for (const values of ['5,5,-3,9,0,1', '1', '9,8,7,6,5,4,3,2,1']) {
    const r = solve('minheap', { values, extracts: 16 }).result;
    assert.deepEqual(
      r.extracted,
      values
        .split(',')
        .map(Number)
        .sort((a, b) => a - b),
    );
    assert.deepEqual(r.heap, []);
    const partial = solve('minheap', { values, extracts: 2 }).result.heap;
    partial.forEach((v, i) => {
      if (i) assert.ok(partial[Math.floor((i - 1) / 2)] <= v);
    });
  }
});
test('chaining and linear probing find negative/duplicate keys and never overwrite on overflow', () => {
  for (const id of ['hashchain', 'hashlinear']) {
    const r = solve(id, { values: '-1, 6, 13, -1', target: -1 }).result;
    assert.equal(r.found, true);
    assert.equal(solve(id, { values: '1,2,3', target: 99 }).result.found, false);
  }
  const r = solve('hashlinear', { values: '0,3,6,9', capacity: 3, target: 9 }).result;
  assert.deepEqual(r.slots, [0, 3, 6]);
  assert.deepEqual(r.rejected, [9]);
  assert.equal(r.found, false);
  const c = solve('hashchain', { values: '-1,6,13,-1', target: 13 }).result;
  assert.deepEqual(c.buckets[6], [-1, 6, 13]);
});
test('union by rank and compression preserve connected components', () => {
  const r = solve('dsu').result;
  assert.equal(r.components, 3);
  assert.deepEqual(r.answers.slice(-2), [true, false]);
  for (const i of [0, 1, 2, 3]) assert.equal(r.roots[i], r.roots[0]);
  const trace = solve('dsu', {
    size: 4,
    operations: 'union 0 1; union 2 3; union 1 3; union 0 2; find 0; connected 0 3',
  });
  assert.equal(trace.result.components, 1);
  assert.equal(trace.result.answers.at(-1), true);
  for (const frame of trace.frames)
    frame.state.parent.forEach((_, i, parent) => {
      let at = i;
      const seen = new Set();
      while (parent[at] !== at) {
        assert.ok(!seen.has(at));
        seen.add(at);
        at = parent[at];
      }
    });
});
test('trie terminal markers distinguish words from prefixes and enumerate lexicographically', () => {
  assert.deepEqual(solve('trie').result.matches, ['car', 'cart', 'cat']);
  assert.deepEqual(solve('trie', { words: 'a, ab, abc, a, bee', prefix: 'a' }).result.matches, [
    'a',
    'ab',
    'abc',
  ]);
  assert.deepEqual(solve('trie', { prefix: 'z' }).result.matches, []);
});
test('Fenwick internal blocks and prefix query match direct sums after signed updates', () => {
  for (let n = 1; n <= 16; n++)
    for (const index of [0, n - 1]) {
      const values = Array.from({ length: n }, (_, i) => (i % 5) - 2);
      const r = solve('fenwick', {
        values: values.join(','),
        index,
        delta: -3,
        query: n - 1,
      }).result;
      values[index] -= 3;
      assert.equal(
        r.sum,
        values.reduce((s, v) => s + v, 0),
      );
      for (let i = 1; i <= n; i++)
        assert.equal(
          r.tree[i],
          values.slice(i - (i & -i), i).reduce((s, v) => s + v, 0),
        );
    }
});
test('segment tree inclusive queries match direct sums and internal nodes equal child sums', () => {
  for (let left = 0; left < 6; left++)
    for (let right = left; right < 6; right++) {
      const r = solve('segment', { left, right }).result;
      assert.equal(
        r.sum,
        r.values.slice(left, right + 1).reduce((s, v) => s + v, 0),
      );
      r.nodes.forEach((n) =>
        assert.equal(
          n.sum,
          n.left === null ? r.values[n.lo] : r.nodes[n.left].sum + r.nodes[n.right].sum,
        ),
      );
    }
  assert.equal(
    solve('segment', { values: '5', index: 0, value: -2, left: 0, right: 0 }).result.sum,
    -2,
  );
});
test('all 30 additions expose schemas and executable presets; API rejects invalid domains', async () => {
  assert.equal(Object.keys(additionalAlgorithms).length, 30);
  for (const [id, d] of Object.entries(additionalAlgorithms)) {
    assert.ok(d.inputs);
    assert.ok(d.lines.length === 4);
    for (const preset of Object.values(d.presets)) assert.ok(solve(id, preset).frames.length > 1);
  }
  for (const [model, input, field] of [
    ['stack', { operations: 'push 1; unknown' }, 'operations'],
    ['stack', { operations: 'push 1 2' }, 'operations'],
    ['dsu', { size: 3, operations: 'union 0 3' }, 'operations'],
    ['trie', { words: 'cat, Dog', prefix: 'ca' }, 'words'],
    ['fenwick', { values: '1', index: 1, delta: 2, query: 0 }, 'index'],
    ['segment', { ...algorithms.segment.defaults, left: 4, right: 1 }, 'right'],
    ['circularqueue', { capacity: 0, operations: 'enqueue 1' }, 'capacity'],
    ['radix', { values: '-1,2' }, 'values'],
    ['kmp', { text: 'abc', pattern: '' }, 'pattern'],
    ['prim', { edges: '0,1,1; 1,0,2' }, 'edges'],
  ]) {
    const response = await POST(
      new Request('http://localhost/api/algorithms', {
        method: 'POST',
        body: JSON.stringify({ model, input }),
      }),
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).field, field);
  }
});

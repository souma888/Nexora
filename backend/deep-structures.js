import { random } from './numerical-tools.js';
import { sequenceView, matrixView, stateTable } from './deep-trace.js';
export function redBlackProperties(root) {
  const walk = (n, lo = -Infinity, hi = Infinity) => {
    if (!n) return { height: 1, valid: true, size: 0 };
    const a = walk(n.left, lo, n.key),
      b = walk(n.right, n.key, hi);
    return {
      height: a.height + (n.red ? 0 : 1),
      size: 1 + a.size + b.size,
      valid:
        a.valid &&
        b.valid &&
        n.key > lo &&
        n.key < hi &&
        a.height === b.height &&
        (!n.red || (!n.left?.red && !n.right?.red)),
    };
  };
  const r = walk(root);
  return { ...r, valid: r.valid && !root?.red };
}
export function runStructure(id, input, { show, stats }) {
  if (id === 'redblack') {
    let root = null;
    const view = () => {
        const nodes = [],
          edges = [];
        const visit = (n) => {
          if (!n) return;
          nodes.push({ id: n.key, label: n.key, red: n.red, detail: n.red ? 'red' : 'black' });
          for (const c of [n.left, n.right])
            if (c) {
              edges.push([n.key, c.key]);
              visit(c);
            }
        };
        visit(root);
        return { type: 'tree', nodes, edges, roots: root ? [root.key] : [] };
      },
      emit = (line, message) =>
        show(
          line,
          message,
          view(),
          stateTable(
            ['Key', 'Color', 'Parent'],
            view().nodes.map((n) => {
              let p = root;
              while (p && p.key !== n.id) p = n.id < p.key ? p.left : p.right;
              return [n.label, n.red ? 'Red' : 'Black', p?.parent?.key ?? 'root'];
            }),
            'Red–black tree',
          ),
        );
    const rotate = (x, left) => {
      const y = left ? x.right : x.left;
      if (left) {
        x.right = y.left;
        if (y.left) y.left.parent = x;
      } else {
        x.left = y.right;
        if (y.right) y.right.parent = x;
      }
      y.parent = x.parent;
      if (!x.parent) root = y;
      else if (x === x.parent.left) x.parent.left = y;
      else x.parent.right = y;
      if (left) y.left = x;
      else y.right = x;
      x.parent = y;
      stats.writes += 6;
      emit(1, `${left ? 'Left' : 'Right'} rotation at ${x.key}.`);
    };
    emit(0, 'Empty tree; null leaves count as black.');
    for (const key of input.values) {
      let parent = null,
        node = root;
      while (node) {
        stats.comparisons++;
        parent = node;
        if (key === node.key) break;
        node = key < node.key ? node.left : node.right;
      }
      if (node) {
        emit(0, `Ignore duplicate ${key}.`);
        continue;
      }
      let z = { key, red: true, parent, left: null, right: null };
      if (!parent) root = z;
      else if (key < parent.key) parent.left = z;
      else parent.right = z;
      stats.writes++;
      emit(0, `Insert red leaf ${key}.`);
      while (z.parent?.red) {
        const p = z.parent,
          g = p.parent,
          left = p === g.left,
          u = left ? g.right : g.left;
        if (u?.red) {
          p.red = false;
          u.red = false;
          g.red = true;
          z = g;
          stats.writes += 3;
          emit(1, 'Red uncle: recolor both children and move the repair upward.');
        } else {
          if (left && z === p.right) {
            z = p;
            rotate(z, true);
          } else if (!left && z === p.left) {
            z = p;
            rotate(z, false);
          }
          const pp = z.parent,
            gg = pp.parent;
          pp.red = false;
          gg.red = true;
          rotate(gg, pp === gg.right);
        }
      }
      root.red = false;
      emit(2, `Root is black after inserting ${key}.`);
      const properties = redBlackProperties(root);
      if (!properties.valid) throw Error('Red–black invariant failed.');
      emit(3, `Verified black height ${properties.height}.`);
    }
    const properties = redBlackProperties(root);
    return {
      root: root?.key ?? null,
      blackHeight: properties.height,
      valid: properties.valid,
      nodes: view().nodes,
      edges: view().edges,
      text: `${properties.size} distinct keys; black height ${properties.height}; all red–black invariants hold.`,
    };
  }
  if (id === 'btree') {
    const t = input.degree;
    let next = 0,
      root = { id: next++, keys: [], children: [] };
    const view = () => {
        const nodes = [],
          edges = [];
        function visit(n) {
          nodes.push({
            id: n.id,
            label: n.keys.length ? n.keys.join(' · ') : '∅',
            block: true,
            detail: n.children.length ? 'internal' : 'leaf',
          });
          for (const c of n.children) {
            edges.push([n.id, c.id]);
            visit(c);
          }
        }
        visit(root);
        return { type: 'tree', nodes, edges, roots: [root.id] };
      },
      emit = (line, message) =>
        show(
          line,
          message,
          view(),
          stateTable(
            ['Node', 'Keys', 'Children'],
            view().nodes.map((n) => [
              n.id,
              n.label,
              view()
                .edges.filter((e) => e[0] === n.id)
                .map((e) => e[1])
                .join(','),
            ]),
            'B-tree nodes',
          ),
        );
    const split = (parent, i) => {
      const child = parent.children[i],
        right = {
          id: next++,
          keys: child.keys.splice(t),
          children: child.children.length ? child.children.splice(t) : [],
        },
        median = child.keys.pop();
      parent.keys.splice(i, 0, median);
      parent.children.splice(i + 1, 0, right);
      stats.writes += 3;
      emit(2, `Split node ${child.id}; promote median ${median}.`);
    };
    const insert = (n, key) => {
      let i = 0;
      while (i < n.keys.length && key > n.keys[i]) {
        i++;
        stats.comparisons++;
      }
      if (n.children.length) {
        if (n.children[i].keys.length === 2 * t - 1) {
          split(n, i);
          if (key > n.keys[i]) i++;
        }
        insert(n.children[i], key);
      } else {
        n.keys.splice(i, 0, key);
        stats.writes++;
        emit(3, `Insert ${key} into nonfull leaf ${n.id}.`);
      }
    };
    const used = new Set();
    emit(0, 'Start with an empty root leaf.');
    for (const key of input.values) {
      if (used.has(key)) {
        emit(0, `Ignore duplicate ${key}.`);
        continue;
      }
      used.add(key);
      if (root.keys.length === 2 * t - 1) {
        root = { id: next++, keys: [], children: [root] };
        split(root, 0);
      }
      insert(root, key);
    }
    const heights = [];
    function depth(n, d) {
      if (!n.children.length) heights.push(d);
      else n.children.forEach((c) => depth(c, d + 1));
    }
    depth(root, 0);
    return {
      tree: root,
      height: Math.max(...heights),
      keys: [...used].sort((a, b) => a - b),
      text: `${used.size} keys; height ${Math.max(...heights)}; all leaves share one depth.`,
    };
  }
  if (id === 'skiplist') {
    const values = [...new Set(input.values)].sort((a, b) => a - b),
      rng = random(input.seed),
      heights = values.map(() => {
        let h = 1;
        while (h < 6 && rng() < 0.5) h++;
        return h;
      }),
      top = Math.max(...heights);
    let i = -1;
    const emit = (level, message) => {
      const matrix = Array.from({ length: top }, (_, r) =>
        values.map((v, j) => (heights[j] >= top - r ? v : '·')),
      );
      show(
        2,
        message,
        matrixView(matrix, [top - 1 - level, i]),
        stateTable(
          ['Key', 'Tower height'],
          values.map((v, j) => [v, heights[j]]),
          'Skip-list towers',
        ),
        { index: i, level },
      );
    };
    emit(top - 1, 'Begin at the top sentinel, before every key.');
    for (let level = top - 1; level >= 0; level--) {
      let next = i + 1;
      while (next < values.length) {
        if (heights[next] <= level) {
          next++;
          continue;
        }
        stats.comparisons++;
        if (values[next] >= input.target) break;
        i = next;
        stats.visits++;
        emit(level, `Move right to ${values[i]} on level ${level}.`);
        next = i + 1;
      }
      emit(level, `Drop below level ${level} without overshooting.`);
    }
    const index = values.indexOf(input.target),
      found = index >= 0;
    show(
      3,
      found ? `Found ${input.target}.` : 'Target is absent.',
      sequenceView(values, found ? [index] : []),
      stateTable(
        ['Key', 'Tower height'],
        values.map((v, j) => [v, heights[j]]),
      ),
    );
    return {
      found,
      index,
      values,
      heights,
      text: found ? `Found at sorted index ${index}.` : 'Target is absent.',
    };
  }
  if (id === 'bloom') {
    const bits = Array(input.bits).fill(0),
      positions = (word) =>
        Array.from({ length: input.hashes }, (_, k) => bloomHash(word, k) % input.bits),
      emit = (message, pos = []) =>
        show(
          1,
          message,
          {
            type: 'grid',
            items: bits.map((v, i) => ({ label: v, active: pos.includes(i), done: !!v })),
          },
          stateTable(
            ['Index', 'Bit'],
            bits.map((v, i) => [i, v]),
            'Bloom bit array',
          ),
        );
    emit('Initially all bits are clear.');
    for (const word of input.words) {
      const pos = positions(word);
      for (const j of pos) {
        bits[j] = 1;
        stats.writes++;
      }
      emit(`Insert ${word}: set positions ${pos.join(', ')}.`, pos);
    }
    const queryPositions = positions(input.query),
      possibly = queryPositions.every((i) => bits[i]),
      present = input.words.includes(input.query);
    let fp = 0,
      probes = 0;
    for (let i = 0; i < 500; i++) {
      const word = 'probe' + i;
      if (input.words.includes(word)) continue;
      probes++;
      fp += +positions(word).every((j) => bits[j]);
    }
    emit(
      `${input.query}: ${possibly ? 'possibly present' : 'definitely absent'}; actual membership ${present}.`,
      queryPositions,
    );
    const approximate =
      (1 - Math.exp((-input.hashes * input.words.length) / input.bits)) ** input.hashes;
    return {
      bits,
      positions: queryPositions,
      possibly,
      present,
      falsePositive: possibly && !present,
      empirical: fp / probes,
      approximate,
      text: `Query: ${possibly ? 'possibly present' : 'definitely absent'}. Actual membership: ${present}. Empirical false-positive fraction ${fp / probes}; independent-hash approximation ${approximate.toFixed(4)}.`,
    };
  }
  throw Error(`Unknown structure ${id}`);
}
export function bloomHash(word, seed = 0) {
  let h = (2166136261 ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

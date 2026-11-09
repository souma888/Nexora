import { algorithms, coordinates, validateAlgorithm } from './algorithm-definitions.js';
import { runAdditional } from './advanced-algorithms.js';
export { algorithms, validateAlgorithm } from './algorithm-definitions.js';

// Frames are independent snapshots: scrubbing never mutates an earlier state.
export function runAlgorithm(id, raw) {
  const input = validateAlgorithm(id, raw), definition = algorithms[id];
  if (definition.engine === 'extended') return runAdditional(id, input, definition);
  const frames = [], stats = { comparisons: 0, writes: 0, visits: 0 };
  const frame = (line, message, state = {}) => frames.push(structuredClone({ line, message, ...state, stats }));
  let result;
  if (definition.kind === 'sort' || definition.kind === 'search') {
    const a = [...input.values];
    const emit = (line, message, active = [], extra = {}) => frame(line, message, { array: a, active, ...extra });
    const compare = (i, j) => { stats.comparisons++; emit(1, `Compare indexes ${i} and ${j}: ${a[i]} and ${a[j]}.`, [i, j]); };
    const swap = (i, j, line = 2) => {
      if (i === j) return;
      [a[i], a[j]] = [a[j], a[i]]; stats.writes += 2;
      emit(line, `Exchange indexes ${i} and ${j}.`, [i, j]);
    };
    emit(0, id === 'binary' ? 'Original input. Next, sort a copy before searching.' : 'Initial array. Indexes start at zero.');
    if (id === 'bubble') {
      for (let end = a.length - 1; end > 0; end--) {
        let changed = false;
        for (let j = 0; j < end; j++) { compare(j, j + 1); if (a[j] > a[j + 1]) { swap(j, j + 1); changed = true; } }
        emit(3, `Index ${end} is fixed.${changed ? '' : ' No swaps: the array is sorted.'}`, [], { boundary: end });
        if (!changed) break;
      }
    } else if (id === 'insertion') {
      for (let i = 1; i < a.length; i++) {
        const key = a[i]; let j = i - 1;
        emit(0, `Hold key ${key} from index ${i}.`, [i], { key });
        while (j >= 0) {
          stats.comparisons++; emit(1, `Compare ${a[j]} with held key ${key}.`, [j], { key });
          if (a[j] <= key) break;
          a[j + 1] = a[j]; stats.writes++; emit(2, `Shift ${a[j]} right. Key ${key} stays in temporary storage.`, [j, j + 1], { key }); j--;
        }
        a[j + 1] = key; stats.writes++; emit(3, `Insert ${key} at index ${j + 1}.`, [j + 1], { boundary: i + 1 });
      }
    } else if (id === 'selection') {
      for (let i = 0; i < a.length - 1; i++) {
        let min = i; emit(0, `Find the minimum from index ${i} onward.`, [i]);
        for (let j = i + 1; j < a.length; j++) { compare(min, j); if (a[j] < a[min]) { min = j; emit(2, `New candidate minimum ${a[min]}.`, [min]); } }
        swap(i, min, 3); emit(3, `Index ${i} is fixed.`, [i], { boundary: i + 1 });
      }
    } else if (id === 'merge') {
      for (let width = 1; width < a.length; width *= 2) {
        emit(0, `Merge runs of width ${width}.`);
        for (let low = 0; low < a.length; low += 2 * width) {
          const mid = Math.min(low + width, a.length), end = Math.min(low + 2 * width, a.length);
          let l = low, r = mid; const buffer = [];
          while (l < mid || r < end) {
            if (l < mid && r < end) compare(l, r);
            buffer.push(r >= end || (l < mid && a[l] <= a[r]) ? a[l++] : a[r++]); stats.writes++;
            emit(2, `Collect merged run: [${buffer.join(', ')}].`, [], { buffer });
          }
          buffer.forEach((value, j) => { a[low + j] = value; stats.writes++; });
          emit(3, `Copy merged run into indexes ${low}–${end - 1}.`, Array.from({ length: end - low }, (_, j) => low + j));
        }
      }
    } else if (id === 'quick') {
      const sort = (lo, hi) => {
        if (lo >= hi) return;
        const pivot = a[hi]; let i = lo;
        emit(0, `Pivot ${pivot} at index ${hi}; partition indexes ${lo}–${hi}.`, [hi], { pivot: hi });
        for (let j = lo; j < hi; j++) {
          compare(j, hi);
          if (a[j] <= pivot) { swap(i, j); i++; }
        }
        swap(i, hi, 3); emit(3, `Pivot ${pivot} is fixed at index ${i}.`, [i]);
        sort(lo, i - 1); sort(i + 1, hi);
      }; sort(0, a.length - 1);
    } else if (id === 'heap') {
      const sift = (root, size) => {
        while (root * 2 + 1 < size) {
          let max = root;
          for (const child of [2 * root + 1, 2 * root + 2]) if (child < size) { compare(max, child); if (a[child] > a[max]) max = child; }
          if (max === root) return;
          swap(root, max); root = max;
        }
      };
      for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) { emit(0, `Sift subtree rooted at ${i}.`, [i]); sift(i, a.length); }
      for (let end = a.length - 1; end > 0; end--) { swap(0, end, 3); emit(3, `Extract maximum to index ${end}; active heap has ${end} values.`, [end], { boundary: end }); sift(0, end); }
    } else if (id === 'linear' || id === 'binary') {
      let found = -1;
      if (id === 'binary') {
        a.sort((x, y) => x - y); emit(0, 'Sorted copy ready. Search comparisons below exclude sorting cost.');
        let low = 0, high = a.length - 1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2); stats.comparisons++;
          emit(1, `low=${low}, mid=${mid}, high=${high}: compare ${a[mid]} with ${input.target}.`, [mid], { low, high });
          if (a[mid] === input.target) { found = mid; break; }
          if (a[mid] < input.target) low = mid + 1; else high = mid - 1;
          emit(2, `Remaining interval: ${low}–${high}.`, [], { low, high });
        }
      } else {
        for (let i = 0; i < a.length; i++) { stats.comparisons++; emit(1, `Compare index ${i}: ${a[i]} with ${input.target}.`, [i]); if (a[i] === input.target) { found = i; break; } }
      }
      result = { index: found, array: a, text: found < 0 ? `Target ${input.target} was not found.` : `Target ${input.target} found at ${id === 'binary' ? 'sorted ' : ''}index ${found}.` };
      emit(found < 0 || id === 'binary' ? 3 : 2, result.text, found < 0 ? [] : [found]);
    }
    if (!result) { result = { array: a, text: `Sorted: ${a.join(', ')}.` }; emit(3, result.text); }
  } else if (definition.kind === 'graph') {
    const { edges, start, goal } = input;
    const distance = Array(6).fill(Infinity), parent = Array(6).fill(null), visited = [], frontier = [];
    distance[start] = 0;
    const heuristicScale = edges.length ? Math.min(...edges.map(e => e.weight / Math.hypot(coordinates[e.from][0] - coordinates[e.to][0], coordinates[e.from][1] - coordinates[e.to][1]))) : 0;
    const heuristic = coordinates.map(([x, y]) => Math.max(0, heuristicScale) * Math.hypot(x - coordinates[goal][0], y - coordinates[goal][1]));
    const emit = (line, message, extra = {}) => frame(line, message, { edges, distance, parent, visited, frontier, start, goal, ...(id === 'astar' ? { heuristic } : {}), ...extra });
    emit(0, `Source ${start} has distance zero; all other distances start at infinity.`);
    let negativeCycle = false;
    if (id === 'bfs') {
      const seen = new Set([start]); frontier.push(start);
      while (frontier.length) {
        const u = frontier.shift(); visited.push(u); stats.visits++;
        emit(1, `Dequeue node ${u}.`, { current: u });
        const outgoing = edges.filter(e => e.from === u);
        for (const e of outgoing) {
          stats.comparisons++;
          if (!seen.has(e.to)) { seen.add(e.to); frontier.push(e.to); parent[e.to] = u; distance[e.to] = distance[u] + 1; stats.writes++; }
          emit(2, `Inspect ${u} → ${e.to}; frontier [${frontier.join(', ')}]. Weights are ignored.`, { current: u, edge: [u, e.to] });
        }
      }
    } else if (id === 'dfs') {
      const seen = new Set([start]);
      const entry = u => ({ node: u, next: 0, outgoing: edges.filter(e => e.from === u) });
      const stack = [entry(start)]; frontier.push(start); visited.push(start); stats.visits++;
      emit(1, `Enter node ${start}. The stack records the active branch.`, { current: start });
      while (stack.length) {
        const top = stack.at(-1);
        if (top.next === top.outgoing.length) {
          stack.pop(); frontier.pop();
          emit(1, `Finish node ${top.node}; backtrack${stack.length ? ` to ${stack.at(-1).node}` : ' to an empty stack'}.`, { current: stack.at(-1)?.node });
          continue;
        }
        const e = top.outgoing[top.next++]; stats.comparisons++;
        if (seen.has(e.to)) { emit(2, `Inspect ${e.from} → ${e.to}: already discovered.`, { current: top.node, edge: [e.from, e.to] }); continue; }
        seen.add(e.to); parent[e.to] = e.from; distance[e.to] = distance[e.from] + 1; stats.writes++;
        stack.push(entry(e.to)); frontier.push(e.to); visited.push(e.to); stats.visits++;
        emit(2, `Follow ${e.from} → ${e.to}; enter the next depth before considering siblings.`, { current: e.to, edge: [e.from, e.to] });
      }
    } else if (id === 'bellman') {
      for (let pass = 1; pass < 6; pass++) {
        let changed = false;
        for (const e of edges) {
          stats.comparisons++;
          const better = distance[e.from] + e.weight < distance[e.to];
          if (better) { distance[e.to] = distance[e.from] + e.weight; parent[e.to] = e.from; stats.writes++; changed = true; }
          emit(1, `Pass ${pass}: ${e.from} → ${e.to}${better ? ` improves distance to ${distance[e.to]}` : ' makes no improvement'}.`, { edge: [e.from, e.to] });
        }
        if (!changed) { emit(2, 'No change this pass; distances have converged.'); break; }
      }
      for (const e of edges) {
        stats.comparisons++;
        if (distance[e.from] + e.weight < distance[e.to]) { negativeCycle = true; emit(3, 'A reachable negative cycle permits an unbounded decrease.', { edge: [e.from, e.to] }); break; }
      }
    } else {
      const settled = new Set();
      while (true) {
        frontier.splice(0, frontier.length, ...distance.map((d, i) => Number.isFinite(d) && !settled.has(i) ? i : -1).filter(i => i >= 0));
        if (!frontier.length) break;
        let u = frontier[0];
        const score = v => distance[v] + (id === 'astar' ? heuristic[v] : 0);
        for (const v of frontier.slice(1)) { stats.comparisons++; if (score(v) < score(u)) u = v; }
        settled.add(u); visited.push(u); frontier.splice(frontier.indexOf(u), 1); stats.visits++;
        emit(1, `Settle node ${u}, g=${distance[u]}${id === 'astar' ? `, f=${score(u).toFixed(3)}` : ''}.`, { current: u });
        if (id === 'astar' && u === goal) break;
        for (const e of edges.filter(e => e.from === u)) {
          stats.comparisons++;
          const better = !settled.has(e.to) && distance[u] + e.weight < distance[e.to];
          if (better) { distance[e.to] = distance[u] + e.weight; parent[e.to] = u; stats.writes++; if (!frontier.includes(e.to)) frontier.push(e.to); }
          emit(2, `${u} → ${e.to}: ${better ? `set distance ${distance[e.to]}` : 'no improvement'}.`, { current: u, edge: [u, e.to] });
        }
      }
    }
    const path = [];
    if (!negativeCycle && Number.isFinite(distance[goal])) {
      let node = goal;
      for (let i = 0; i < 6 && node !== null; i++) { path.unshift(node); node = parent[node]; }
    }
    result = { distance: negativeCycle ? null : distance[goal], path, negativeCycle, visited,
      text: negativeCycle ? 'Reachable negative cycle: finite shortest paths are not reported.' : !path.length ? `Node ${goal} is unreachable from ${start}.` : `Path ${path.join(' → ')}; ${id === 'bfs' || id === 'dfs' ? 'edge count' : 'cost'} ${distance[goal]}.` };
    emit(3, result.text, { path });
  } else if (id === 'knapsack') {
    const { weights, values, capacity } = input;
    const table = Array.from({ length: weights.length + 1 }, () => Array(capacity + 1).fill(0));
    frame(0, 'Row 0 represents using no items; every value is zero.', { table, weights, values, capacity });
    for (let i = 1; i <= weights.length; i++) for (let c = 1; c <= capacity; c++) {
      const exclude = table[i - 1][c], include = weights[i - 1] <= c ? values[i - 1] + table[i - 1][c - weights[i - 1]] : null;
      if (include !== null) stats.comparisons++;
      table[i][c] = Math.max(exclude, include ?? 0); stats.writes++;
      frame(include === null ? 1 : 2, `Item ${i - 1}, capacity ${c}: exclude=${exclude}${include === null ? '; item does not fit' : `, include=${include}`}. Best=${table[i][c]}.`, { table, weights, values, capacity, cell: [i, c] });
    }
    const chosen = []; let c = capacity;
    for (let i = weights.length; i > 0; i--) if (table[i][c] !== table[i - 1][c]) { chosen.unshift(i - 1); c -= weights[i - 1]; }
    result = { value: table[weights.length][capacity], chosen, weight: capacity - c, text: `Best value ${table[weights.length][capacity]}; items [${chosen.join(', ')}], total weight ${capacity - c}/${capacity}.` };
    frame(3, result.text, { table, weights, values, capacity, chosen });
  } else {
    let { a, b } = input; const divisions = [];
    frame(0, `Start with (${a}, ${b}).`, { a, b, divisions });
    while (b !== 0) {
      const remainder = a % b, quotient = Math.floor(a / b); stats.comparisons++;
      divisions.push({ a, b, quotient, remainder });
      frame(1, `${a} = ${quotient} × ${b} + ${remainder}.`, { a, b, divisions });
      [a, b] = [b, remainder]; stats.writes += 2;
      frame(2, `Replace the pair by (${a}, ${b}).`, { a, b, divisions });
    }
    result = { gcd: a, text: `GCD = ${a}, using ${divisions.length} remainder steps.` };
    frame(3, result.text, { a, b, divisions });
  }
  return { model: id, version: definition.version, input, frames, result, stats };
}

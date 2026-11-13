import { runDataStructure } from './data-structures.js';

const tab = (headers, rows, caption, active = []) => ({ headers, rows, caption, active });
const sequence = (a, active = [], chosen = []) => ({
  type: 'sequence',
  items: a.map((label, i) => ({
    label: label ?? '·',
    detail: `index ${i}`,
    active: active.includes(i),
    done: chosen.includes(i),
  })),
});
const network = (edges, active = [], selected = [], visited = [], directed = true) => ({
  type: 'network',
  edges,
  active,
  selected,
  visited,
  directed,
});

export function runAdditional(id, input, definition) {
  const frames = [],
    stats = { comparisons: 0, writes: 0, visits: 0 };
  const show = (line, message, view, table, state = {}) =>
    frames.push(structuredClone({ line, message, view, stateTable: table, state, stats }));
  let result;
  if (['structure', 'tree'].includes(definition.kind))
    result = runDataStructure(id, input, { show, stats });
  else if (['counting', 'radix', 'shell'].includes(id)) {
    const a = [...input.values];
    const emit = (
      line,
      message,
      active = [],
      rows = a.map((v, i) => [i, v]),
      headers = ['Index', 'Value'],
      extra = {},
    ) =>
      show(line, message, sequence(a, active), tab(headers, rows, 'Sort state'), {
        array: a,
        ...extra,
      });
    emit(0, 'Initial array.');
    if (id === 'counting') {
      const min = Math.min(...a),
        max = Math.max(...a),
        count = Array(max - min + 1).fill(0),
        output = Array(a.length).fill(null);
      const rows = () => count.map((v, i) => [i + min, v]);
      for (let i = 0; i < a.length; i++) {
        count[a[i] - min]++;
        stats.writes++;
        emit(0, `Count key ${a[i]}.`, [i], rows(), ['Key', 'Frequency'], { count, output });
      }
      for (let i = 1; i < count.length; i++) {
        count[i] += count[i - 1];
        stats.writes++;
        emit(
          1,
          `Cumulative end position for ${i + min}: ${count[i]}.`,
          [],
          rows(),
          ['Key', 'Cumulative end'],
          { count, output },
        );
      }
      for (let i = a.length - 1; i >= 0; i--) {
        const pos = --count[a[i] - min];
        output[pos] = a[i];
        stats.writes += 2;
        show(
          2,
          `Place input[${i}]=${a[i]} at output[${pos}].`,
          sequence(output, [pos]),
          tab(
            ['Key', 'Next output boundary'],
            rows(),
            'Decrement cumulative position before placement',
          ),
          { array: a, output, count },
        );
      }
      a.splice(0, a.length, ...output);
    } else if (id === 'radix') {
      for (let place = 1; place <= Math.max(1, ...a); place *= 10) {
        const buckets = Array.from({ length: 10 }, () => []);
        for (let i = 0; i < a.length; i++) {
          const digit = Math.floor(a[i] / place) % 10;
          buckets[digit].push(a[i]);
          stats.writes++;
          emit(
            1,
            `${a[i]} has digit ${digit} at place ${place}.`,
            [i],
            buckets.map((b, d) => [d, b.join(', ') || '∅']),
            ['Digit', 'Stable bucket'],
            { buckets, place },
          );
        }
        a.splice(0, a.length, ...buckets.flat());
        stats.writes += a.length;
        emit(
          2,
          `Concatenate buckets after place ${place}.`,
          [],
          a.map((v, i) => [i, v]),
          ['Index', 'Value'],
          { place },
        );
      }
    } else {
      for (let gap = Math.floor(a.length / 2); gap > 0; gap = Math.floor(gap / 2)) {
        emit(0, `Start gap ${gap}.`);
        for (let i = gap; i < a.length; i++) {
          const key = a[i];
          let j = i;
          while (j >= gap) {
            stats.comparisons++;
            emit(
              1,
              `Gap ${gap}: compare ${a[j - gap]} with held key ${key}.`,
              [j - gap, j],
              undefined,
              undefined,
              { gap, key },
            );
            if (a[j - gap] <= key) break;
            a[j] = a[j - gap];
            stats.writes++;
            j -= gap;
          }
          a[j] = key;
          stats.writes++;
          emit(1, `Insert held key ${key} at index ${j}.`, [j], undefined, undefined, { gap });
        }
        emit(2, `Gap ${gap} pass complete.`);
      }
    }
    result = { array: a, text: `Sorted: ${a.join(', ')}.` };
    emit(3, result.text);
  } else if (definition.kind === 'graph-extra') {
    const { edges } = input;
    const selected = [],
      visited = [],
      edgeKey = (e) => `${e.from},${e.to}`;
    const adjacency = Array.from({ length: 6 }, () => []);
    for (const e of edges) {
      adjacency[e.from].push({ edge: e, neighbor: e.to });
      if (!definition.inputs.edges.directed) adjacency[e.to].push({ edge: e, neighbor: e.from });
    }
    const graph = (active) =>
      network(edges, active, selected, visited, definition.inputs.edges.directed);
    if (id === 'topological') {
      const indegree = Array(6).fill(0),
        order = [],
        queue = [];
      edges.forEach((e) => indegree[e.to]++);
      const emit = (line, message, active = []) =>
        show(
          line,
          message,
          graph(active),
          tab(
            ['Node', 'Remaining indegree', 'State'],
            indegree.map((v, i) => [
              i,
              v,
              order.includes(i) ? 'emitted' : queue.includes(i) ? 'queued' : 'waiting',
            ]),
            `Order [${order.join(', ')}]; queue [${queue.join(', ')}]`,
          ),
          { indegree, queue, order },
        );
      emit(0, 'Count incoming edges at every node.');
      indegree.forEach((v, i) => {
        if (!v) queue.push(i);
      });
      emit(1, `Initial zero-indegree queue: [${queue.join(', ')}].`);
      while (queue.length) {
        const u = queue.shift();
        order.push(u);
        visited.push(u);
        stats.visits++;
        emit(2, `Emit node ${u}.`, [u]);
        for (const { edge: e } of adjacency[u]) {
          indegree[e.to]--;
          stats.writes++;
          if (!indegree[e.to]) queue.push(e.to);
          emit(2, `Remove ${u} → ${e.to}; indegree becomes ${indegree[e.to]}.`, [e.to]);
        }
      }
      result = {
        order,
        acyclic: order.length === 6,
        text:
          order.length === 6
            ? `Topological order: [${order.join(', ')}].`
            : `Directed cycle: only [${order.join(', ')}] could be emitted; no full topological order exists.`,
      };
      emit(3, result.text);
    } else if (id === 'kruskal' || id === 'prim') {
      let total = 0,
        components = 0;
      const parent = Array.from({ length: 6 }, (_, i) => i),
        rank = Array(6).fill(0),
        key = Array(6).fill(Infinity),
        from = Array(6).fill(null);
      const find = (a) => {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      };
      const emit = (line, message, active = []) =>
        show(
          line,
          message,
          graph(active),
          id === 'kruskal'
            ? tab(
                ['Node', 'Component root', 'Rank'],
                parent.map((_, i) => [i, find(i), rank[i]]),
                `Chosen weight ${total}`,
              )
            : tab(
                ['Node', 'Key', 'Parent', 'State'],
                key.map((v, i) => [
                  i,
                  v,
                  from[i] ?? 'root',
                  visited.includes(i) ? 'chosen' : 'outside',
                ]),
                `Chosen weight ${total}`,
              ),
          { selected, total, parent, key, from, visited },
        );
      emit(0, 'No edges have been selected.');
      if (id === 'kruskal') {
        for (const e of [...edges].sort(
          (a, b) => a.weight - b.weight || a.from - b.from || a.to - b.to,
        )) {
          stats.comparisons++;
          let a = find(e.from),
            b = find(e.to);
          emit(1, `Consider ${e.from}—${e.to}, weight ${e.weight}.`, [e.from, e.to]);
          if (a === b) {
            emit(2, 'Reject: both endpoints already share a component.');
            continue;
          }
          if (rank[a] > rank[b]) [a, b] = [b, a];
          parent[a] = b;
          if (rank[a] === rank[b]) rank[b]++;
          selected.push(edgeKey(e));
          total += e.weight;
          stats.writes++;
          emit(2, 'Accept the edge and merge components.', [e.from, e.to]);
        }
        components = new Set(parent.map((_, i) => find(i))).size;
      } else {
        const chosenNodes = new Set(),
          parentEdge = Array(6).fill(null);
        for (let pass = 0; pass < 6; pass++) {
          let u = -1;
          for (let i = 0; i < 6; i++)
            if (!chosenNodes.has(i)) {
              stats.comparisons++;
              if (u < 0 || key[i] < key[u]) u = i;
            }
          if (!Number.isFinite(key[u])) {
            key[u] = 0;
            components++;
            emit(0, `Start component ${components} at node ${u}.`, [u]);
          }
          visited.push(u);
          chosenNodes.add(u);
          stats.visits++;
          if (from[u] !== null) {
            selected.push(edgeKey(parentEdge[u]));
            total += key[u];
          }
          emit(1, `Choose node ${u} with key ${key[u]}.`, [u]);
          for (const { edge: e, neighbor: v } of adjacency[u]) {
            stats.comparisons++;
            if (!chosenNodes.has(v) && e.weight < key[v]) {
              key[v] = e.weight;
              from[v] = u;
              parentEdge[v] = e;
              stats.writes++;
              emit(2, `Improve node ${v}'s crossing edge to weight ${e.weight}.`, [u, v]);
            }
          }
        }
      }
      result = {
        weight: total,
        components,
        selected,
        text: `Minimum spanning ${components === 1 ? 'tree' : 'forest'}: weight ${total}, ${components} component${components === 1 ? '' : 's'}, ${selected.length} edges.`,
      };
      emit(3, result.text);
    } else {
      const matrix = Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => (i === j ? 0 : Infinity)),
      );
      edges.forEach((e) => {
        matrix[e.from][e.to] = e.weight;
      });
      const emit = (line, message, k = -1, cell = []) =>
        show(
          line,
          message,
          graph(k < 0 ? [] : [k]),
          tab(
            ['From / to', 0, 1, 2, 3, 4, 5],
            matrix.map((row, i) => [i, ...row]),
            'All-pairs distance matrix; ∞ is unreachable',
            cell.length ? [cell[0], cell[1] + 1] : [],
          ),
          { matrix, intermediate: k },
        );
      emit(0, 'Initialize direct edges and zero-length self paths.');
      for (let k = 0; k < 6; k++) {
        emit(1, `Allow node ${k} as an intermediate.`, k);
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            stats.comparisons++;
            if (matrix[i][k] + matrix[k][j] < matrix[i][j]) {
              matrix[i][j] = matrix[i][k] + matrix[k][j];
              stats.writes++;
              emit(2, `Improve D[${i},${j}] through ${k} to ${matrix[i][j]}.`, k, [i, j]);
            }
          }
      }
      const negativeCycle = matrix.some((row, i) => row[i] < 0);
      result = {
        matrix,
        negativeCycle,
        text: negativeCycle
          ? 'Negative cycle detected: finite shortest-path entries are not certified.'
          : `All-pairs paths complete; distance 0 → 5 = ${Number.isFinite(matrix[0][5]) ? matrix[0][5] : '∞ (unreachable)'}.`,
      };
      emit(3, result.text);
    }
  } else if (id === 'kmp' || id === 'rabinkarp') {
    const { text, pattern } = input,
      matches = [],
      lps = Array(pattern.length).fill(0);
    const emit = (line, message, offset = 0, active = [], patternActive = [], extra = {}) =>
      show(
        line,
        message,
        { type: 'text', text, pattern, offset, active, patternActive, matches },
        tab(
          id === 'kmp' ? ['Pattern index', 'Character', 'LPS'] : ['Property', 'Value'],
          id === 'kmp' ? [...pattern].map((c, i) => [i, c, lps[i]]) : Object.entries(extra),
          id === 'kmp' ? 'Prefix table; zero-based character indexes' : 'Rolling-hash state',
        ),
        { matches, lps, ...extra },
      );
    emit(0, 'Prepare the pattern and text.');
    if (id === 'kmp') {
      for (let i = 1, j = 0; i < pattern.length;) {
        stats.comparisons++;
        if (pattern[i] === pattern[j]) {
          lps[i] = ++j;
          stats.writes++;
          emit(0, `LPS[${i}]=${j}.`, 0, [], [i, j - 1]);
          i++;
        } else if (j) {
          j = lps[j - 1];
          emit(0, `Prefix mismatch: fall back to length ${j}.`, 0, [], [i, j]);
        } else {
          lps[i] = 0;
          emit(0, `LPS[${i}]=0.`, 0, [], [i]);
          i++;
        }
      }
      for (let i = 0, j = 0; i < text.length;) {
        stats.comparisons++;
        emit(1, `Compare text[${i}] with pattern[${j}].`, i - j, [i], [j]);
        if (text[i] === pattern[j]) {
          i++;
          j++;
          if (j === pattern.length) {
            matches.push(i - j);
            emit(3, `Match at offset ${i - j}.`, i - j);
            j = lps[j - 1];
          }
        } else if (j) {
          j = lps[j - 1];
          emit(2, `Reuse matched prefix of length ${j}; text index stays ${i}.`, i - j, [i], [j]);
        } else i++;
      }
    } else if (pattern.length <= text.length) {
      const base = 31,
        modulus = 101,
        hash = (s) => [...s].reduce((h, c) => (h * base + c.charCodeAt(0)) % modulus, 0);
      const target = hash(pattern);
      let rolling = hash(text.slice(0, pattern.length)),
        power = 1;
      for (let i = 1; i < pattern.length; i++) power = (power * base) % modulus;
      for (let offset = 0; offset <= text.length - pattern.length; offset++) {
        stats.comparisons++;
        emit(1, `Window ${offset}: hash ${rolling}, target ${target}.`, offset, [], [], {
          windowHash: rolling,
          patternHash: target,
        });
        if (rolling === target) {
          let equal = true;
          for (let j = 0; j < pattern.length; j++) {
            stats.comparisons++;
            emit(2, `Hash hit: verify character ${j}.`, offset, [offset + j], [j], {
              windowHash: rolling,
              patternHash: target,
            });
            if (text[offset + j] !== pattern[j]) {
              equal = false;
              emit(2, 'Hash collision: characters differ; reject this window.', offset);
              break;
            }
          }
          if (equal) {
            matches.push(offset);
            emit(2, `Verified match at offset ${offset}.`, offset);
          }
        }
        if (offset + pattern.length < text.length) {
          rolling =
            ((rolling - text.charCodeAt(offset) * power) * base +
              text.charCodeAt(offset + pattern.length)) %
            modulus;
          rolling = (rolling + modulus) % modulus;
          stats.writes++;
          emit(3, `Roll to window ${offset + 1}.`, offset + 1, [], [], {
            windowHash: rolling,
            patternHash: target,
          });
        }
      }
    }
    result = {
      matches,
      ...(id === 'kmp' ? { lps } : {}),
      text: `Match offsets: [${matches.join(', ')}]${matches.length ? '.' : ' (not found).'}`,
    };
    emit(3, result.text);
  } else if (id === 'lcs' || id === 'editdistance') {
    const { first, second } = input,
      matrix = Array.from({ length: first.length + 1 }, () => Array(second.length + 1).fill(0));
    if (id === 'editdistance') {
      matrix.forEach((row, i) => {
        row[0] = i;
      });
      matrix[0] = matrix[0].map((_, j) => j);
    }
    const emit = (line, message, i = 0, j = 0) =>
      show(
        line,
        message,
        {
          type: 'matrix',
          matrix,
          rowLabels: ['∅', ...first],
          columnLabels: ['∅', ...second],
          cell: [i, j],
        },
        tab(
          ['Prefixes', '∅', ...second],
          matrix.map((row, k) => [['∅', ...first][k], ...row]),
          'Dynamic-programming prefix table',
          [i, j + 1],
        ),
        { matrix },
      );
    emit(0, 'Initialize empty-prefix boundary conditions.');
    for (let i = 1; i <= first.length; i++)
      for (let j = 1; j <= second.length; j++) {
        stats.comparisons++;
        const same = first[i - 1] === second[j - 1];
        matrix[i][j] =
          id === 'lcs'
            ? same
              ? matrix[i - 1][j - 1] + 1
              : Math.max(matrix[i - 1][j], matrix[i][j - 1])
            : same
              ? matrix[i - 1][j - 1]
              : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
        stats.writes++;
        emit(
          same ? 1 : 2,
          `Compare ${first[i - 1]} and ${second[j - 1]}: dp[${i},${j}]=${matrix[i][j]}.`,
          i,
          j,
        );
      }
    let i = first.length,
      j = second.length;
    const common = [],
      alignedFirst = [],
      alignedSecond = [];
    while (i || j) {
      emit(3, `Backtrack from prefix lengths (${i},${j}).`, i, j);
      if (i && j && first[i - 1] === second[j - 1]) {
        common.unshift(first[i - 1]);
        alignedFirst.unshift(first[--i]);
        alignedSecond.unshift(second[--j]);
      } else if (id === 'lcs') {
        if (i && (!j || matrix[i - 1][j] >= matrix[i][j - 1])) i--;
        else j--;
      } else if (i && j && matrix[i][j] === matrix[i - 1][j - 1] + 1) {
        alignedFirst.unshift(first[--i]);
        alignedSecond.unshift(second[--j]);
      } else if (i && matrix[i][j] === matrix[i - 1][j] + 1) {
        alignedFirst.unshift(first[--i]);
        alignedSecond.unshift('−');
      } else {
        alignedFirst.unshift('−');
        alignedSecond.unshift(second[--j]);
      }
    }
    const value = matrix[first.length][second.length];
    result =
      id === 'lcs'
        ? {
            length: value,
            sequence: common.join(''),
            matrix,
            text: `LCS length ${value}; one solution “${common.join('')}”.`,
          }
        : {
            distance: value,
            alignment: [alignedFirst.join(''), alignedSecond.join('')],
            matrix,
            text: `Edit distance ${value}; alignment ${alignedFirst.join('')} → ${alignedSecond.join('')}.`,
          };
    emit(3, result.text, first.length, second.length);
  } else if (id === 'coinchange') {
    const coins = [...new Set(input.coins)].sort((a, b) => a - b),
      dp = Array(input.amount + 1).fill(Infinity),
      previous = Array(dp.length).fill(null);
    dp[0] = 0;
    const emit = (line, message, active = []) =>
      show(
        line,
        message,
        sequence(
          dp.map((v) => (v === Infinity ? '∞' : v)),
          active,
        ),
        tab(
          ['Amount', 'Minimum coins', 'Last coin'],
          dp.map((v, i) => [i, v, previous[i] ?? '—']),
          'Unlimited-use minimum coin table',
        ),
        { dp, previous },
      );
    emit(0, 'Amount zero needs zero coins; others are unreachable so far.');
    for (let a = 1; a <= input.amount; a++)
      for (const c of coins)
        if (c <= a) {
          stats.comparisons++;
          if (dp[a - c] + 1 < dp[a]) {
            dp[a] = dp[a - c] + 1;
            previous[a] = c;
            stats.writes++;
            emit(2, `Amount ${a}: take coin ${c} after amount ${a - c}; total ${dp[a]}.`, [
              a,
              a - c,
            ]);
          }
        }
    const chosen = [];
    if (Number.isFinite(dp[input.amount]))
      for (let a = input.amount; a > 0; a -= previous[a]) chosen.push(previous[a]);
    const reachable = Number.isFinite(dp[input.amount]);
    result = {
      minimum: reachable ? dp[input.amount] : null,
      coins: chosen,
      text: reachable
        ? `Minimum ${dp[input.amount]} coins: [${chosen.join(', ')}].`
        : `Amount ${input.amount} is unreachable with these denominations.`,
    };
    emit(3, result.text);
  } else if (id === 'lis' || id === 'kadane') {
    const a = input.values,
      length = Array(a.length).fill(1),
      previous = Array(a.length).fill(null),
      bestEnding = Array(a.length).fill(null);
    const emit = (line, message, active = [], chosen = []) =>
      show(
        line,
        message,
        sequence(a, active, chosen),
        id === 'lis'
          ? tab(
              ['Index', 'Value', 'Best ending length', 'Predecessor'],
              a.map((v, i) => [i, v, length[i], previous[i] ?? '—']),
              'Strictly increasing subsequences',
            )
          : tab(
              ['Index', 'Value', 'Best sum ending here'],
              a.map((v, i) => [i, v, bestEnding[i] ?? 'uncomputed']),
              'Nonempty maximum-sum intervals',
            ),
        { length, previous, bestEnding },
      );
    emit(0, 'Initial array and dynamic state.');
    if (id === 'lis') {
      for (let i = 0; i < a.length; i++)
        for (let j = 0; j < i; j++) {
          stats.comparisons++;
          emit(1, `Compare earlier ${a[j]} with current ${a[i]}.`, [j, i]);
          if (a[j] < a[i] && length[j] + 1 > length[i]) {
            length[i] = length[j] + 1;
            previous[i] = j;
            stats.writes++;
            emit(2, `Extend index ${i} from index ${j}: length ${length[i]}.`, [j, i]);
          }
        }
      let end = 0;
      for (let i = 1; i < a.length; i++) if (length[i] > length[end]) end = i;
      const indexes = [];
      for (let i = end; i !== null; i = previous[i]) indexes.unshift(i);
      result = {
        length: length[end],
        sequence: indexes.map((i) => a[i]),
        indexes,
        text: `LIS length ${length[end]}: [${indexes.map((i) => a[i]).join(', ')}].`,
      };
      emit(3, result.text, [], indexes);
    } else {
      let current = a[0],
        best = a[0],
        start = 0,
        left = 0,
        right = 0;
      bestEnding[0] = current;
      emit(0, `Initialize current and best sum to ${current}.`, [0]);
      for (let i = 1; i < a.length; i++) {
        stats.comparisons++;
        if (a[i] > current + a[i]) {
          current = a[i];
          start = i;
        } else current += a[i];
        bestEnding[i] = current;
        stats.writes++;
        emit(1, `Best ending at index ${i}: ${current}, starting at ${start}.`, [i]);
        if (current > best) {
          best = current;
          left = start;
          right = i;
          emit(2, `New best sum ${best} over indexes ${left}…${right}.`, [left, right]);
        }
      }
      result = {
        sum: best,
        left,
        right,
        values: a.slice(left, right + 1),
        text: `Maximum sum ${best}; indexes ${left}…${right}: [${a.slice(left, right + 1).join(', ')}].`,
      };
      emit(
        3,
        result.text,
        [],
        Array.from({ length: right - left + 1 }, (_, i) => left + i),
      );
    }
  } else if (id === 'sieve') {
    const prime = Array(input.limit + 1).fill(true);
    prime[0] = prime[1] = false;
    const emit = (line, message, active = []) =>
      show(
        line,
        message,
        {
          type: 'grid',
          items: prime.map((p, i) => ({
            label: i,
            done: p,
            active: active.includes(i),
            muted: !p,
          })),
        },
        tab(
          ['Integer', 'Classification'],
          prime.map((p, i) => [
            i,
            i < 2 ? 'neither' : p ? (line === 3 ? 'prime' : 'candidate') : 'composite',
          ]),
          'Sieve classifications',
        ),
        { prime },
      );
    emit(0, '0 and 1 are not prime; larger numbers begin as candidates.');
    for (let p = 2; p * p <= input.limit; p++)
      if (prime[p]) {
        emit(1, `Choose unmarked prime ${p}; start at ${p * p}.`, [p]);
        for (let m = p * p; m <= input.limit; m += p) {
          prime[m] = false;
          stats.writes++;
          emit(2, `Mark ${m} = ${p} × ${m / p} composite.`, [p, m]);
        }
      }
    const primes = prime.flatMap((p, i) => (p ? [i] : []));
    result = {
      primes,
      text: `${primes.length} primes through ${input.limit}: [${primes.join(', ')}].`,
    };
    emit(3, result.text);
  } else throw new Error(`Unimplemented algorithm: ${id}`);
  return { model: id, version: definition.version, input, frames, result, stats };
}

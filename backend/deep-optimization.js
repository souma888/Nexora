import { matrixView, sequenceView, stateTable } from './deep-trace.js';
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const geometry = (points, chain = [], pair = []) => ({ type: 'geometry', points, chain, pair });
export function runOptimization(id, input, { show, stats }) {
  if (id === 'convexhull') {
    const points = [...new Map(input.points.map((p) => [p.join(','), p])).values()].sort(
      (a, b) => a[0] - b[0] || a[1] - b[1],
    );
    let hull = [];
    const chain = (ordered) => {
      const h = [];
      for (const p of ordered) {
        while (h.length > 1) {
          stats.comparisons++;
          if (cross(h.at(-2), h.at(-1), p) > 0) break;
          h.pop();
          show(
            2,
            'Remove a clockwise or collinear interior corner.',
            geometry(points, h),
            stateTable(
              ['Chain position', 'x', 'y'],
              h.map((p, i) => [i, ...p]),
            ),
          );
        }
        h.push(p);
        show(
          1,
          `Append point (${p}).`,
          geometry(points, h),
          stateTable(
            ['Chain position', 'x', 'y'],
            h.map((p, i) => [i, ...p]),
          ),
        );
      }
      return h;
    };
    if (points.length <= 1) hull = points;
    else if (input.method === 0) {
      const lower = chain(points),
        upper = chain([...points].reverse());
      hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
    } else {
      const pivot = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0],
        ordered = points
          .filter((p) => p !== pivot)
          .sort((a, b) => {
            const c = cross(pivot, a, b);
            return (
              -c ||
              (a[0] - pivot[0]) ** 2 +
                (a[1] - pivot[1]) ** 2 -
                ((b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2)
            );
          });
      hull = chain([pivot, ...ordered]);
    }
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i],
        b = hull[(i + 1) % hull.length];
      area += a[0] * b[1] - a[1] * b[0];
    }
    area = Math.abs(area) / 2;
    show(
      3,
      `Hull complete: ${hull.length} vertices, area ${area}.`,
      geometry(points, hull.length > 1 ? [...hull, hull[0]] : hull),
      stateTable(
        ['Hull order', 'x', 'y'],
        hull.map((p, i) => [i, ...p]),
      ),
    );
    return { hull, area, text: `${hull.length} hull vertices; area ${area}.` };
  }
  if (id === 'closestpair') {
    const points = input.points
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.i - b.i);
    const solve = (a) => {
      if (a.length < 2) return { distance: Infinity, pair: [] };
      if (a.length <= 3) {
        let best = { distance: Infinity, pair: [] };
        for (let i = 0; i < a.length; i++)
          for (let j = i + 1; j < a.length; j++) {
            const d = Math.hypot(a[i].p[0] - a[j].p[0], a[i].p[1] - a[j].p[1]);
            stats.comparisons++;
            if (d < best.distance) best = { distance: d, pair: [a[i].i, a[j].i] };
          }
        show(
          1,
          `Base case with ${a.length} points; best distance ${best.distance}.`,
          geometry(input.points, [], best.pair),
          stateTable(
            ['Original index', 'x', 'y'],
            a.map((v) => [v.i, ...v.p]),
          ),
        );
        return best;
      }
      const mid = Math.floor(a.length / 2),
        x = a[mid].p[0],
        left = solve(a.slice(0, mid)),
        right = solve(a.slice(mid));
      let best = left.distance <= right.distance ? left : right;
      const strip = a
        .filter((v) => Math.abs(v.p[0] - x) < best.distance)
        .sort((a, b) => a.p[1] - b.p[1]);
      for (let i = 0; i < strip.length; i++)
        for (
          let j = i + 1;
          j < strip.length && strip[j].p[1] - strip[i].p[1] < best.distance;
          j++
        ) {
          stats.comparisons++;
          const d = Math.hypot(strip[i].p[0] - strip[j].p[0], strip[i].p[1] - strip[j].p[1]);
          if (d < best.distance) best = { distance: d, pair: [strip[i].i, strip[j].i] };
        }
      show(
        3,
        `Merge ${a.length} points at x=${x}; closest distance ${best.distance}.`,
        geometry(input.points, [], best.pair),
        stateTable(
          ['Strip index', 'x', 'y'],
          strip.map((v) => [v.i, ...v.p]),
        ),
      );
      return best;
    };
    const best = solve(points);
    return {
      ...best,
      points: best.pair.map((i) => input.points[i]),
      text: `Minimum distance ${best.distance}; original point indexes ${best.pair.join(', ')}.`,
    };
  }
  if (id === 'maxflow') {
    const C = input.matrix,
      n = C.length,
      g = Array.from({ length: n }, () => []),
      original = [];
    for (let u = 0; u < n; u++)
      for (let v = 0; v < n; v++)
        if (C[u][v]) {
          const edge = { to: v, rev: g[v].length, cap: C[u][v], initial: C[u][v], from: u };
          g[u].push(edge);
          g[v].push({ to: u, rev: g[u].length - 1, cap: 0, initial: 0, from: v });
          original.push(edge);
        }
    const residual = () =>
      g.map((row) =>
        Array.from({ length: n }, (_, j) =>
          row.filter((e) => e.to === j).reduce((s, e) => s + e.cap, 0),
        ),
      );
    let flow = 0;
    const emit = (message) =>
      show(
        2,
        message,
        matrixView(residual()),
        stateTable(
          ['From', 'To', 'Flow', 'Capacity'],
          original.map((e) => [e.from, e.to, e.initial - e.cap, e.initial]),
          'Original-arc flows',
        ),
      );
    emit('Initial residual graph; reverse residual edges start at zero.');
    const push = (_u, e, a) => {
      e.cap -= a;
      g[e.to][e.rev].cap += a;
      stats.writes += 2;
    };
    if (input.method === 0) {
      while (true) {
        const prev = Array(n).fill(null),
          queue = [0];
        prev[0] = [-1, -1];
        for (let h = 0; h < queue.length && !prev[n - 1]; h++) {
          const u = queue[h];
          g[u].forEach((e, j) => {
            stats.visits++;
            if (e.cap > 0 && !prev[e.to]) {
              prev[e.to] = [u, j];
              queue.push(e.to);
            }
          });
        }
        if (!prev[n - 1]) break;
        let delta = Infinity;
        for (let v = n - 1; v;) {
          const [u, j] = prev[v];
          delta = Math.min(delta, g[u][j].cap);
          v = u;
        }
        for (let v = n - 1; v;) {
          const [u, j] = prev[v];
          push(u, g[u][j], delta);
          v = u;
        }
        flow += delta;
        emit(`Augment a shortest residual path by ${delta}; total ${flow}.`);
      }
    } else {
      while (true) {
        const level = Array(n).fill(-1),
          queue = [0];
        level[0] = 0;
        for (let h = 0; h < queue.length; h++) {
          const u = queue[h];
          for (const e of g[u])
            if (e.cap > 0 && level[e.to] < 0) {
              level[e.to] = level[u] + 1;
              queue.push(e.to);
            }
        }
        if (level[n - 1] < 0) break;
        const cursor = Array(n).fill(0),
          send = (u, limit) => {
            if (u === n - 1) return limit;
            for (; cursor[u] < g[u].length; cursor[u]++) {
              const e = g[u][cursor[u]];
              stats.visits++;
              if (e.cap > 0 && level[e.to] === level[u] + 1) {
                const a = send(e.to, Math.min(limit, e.cap));
                if (a) {
                  push(u, e, a);
                  return a;
                }
              }
            }
            return 0;
          };
        while (true) {
          const delta = send(0, Infinity);
          if (!delta) break;
          flow += delta;
          emit(`Dinic pushes ${delta} through the level graph; total ${flow}.`);
        }
      }
    }
    const reachable = new Set([0]),
      queue = [0];
    for (let h = 0; h < queue.length; h++)
      for (const e of g[queue[h]])
        if (e.cap > 0 && !reachable.has(e.to)) {
          reachable.add(e.to);
          queue.push(e.to);
        }
    const cut = original.filter((e) => reachable.has(e.from) && !reachable.has(e.to)),
      cutCapacity = cut.reduce((s, e) => s + e.initial, 0);
    emit(`No augmenting path: flow ${flow} equals cut capacity ${cutCapacity}.`);
    return {
      flow,
      cutCapacity,
      sourceSide: [...reachable],
      arcs: original.map((e) => ({
        from: e.from,
        to: e.to,
        capacity: e.initial,
        flow: e.initial - e.cap,
      })),
      text: `Maximum flow ${flow}; minimum cut ${cutCapacity}.`,
    };
  }
  if (id === 'hopcroftkarp') {
    const A = input.matrix,
      L = A.length,
      R = A[0].length,
      left = Array(L).fill(-1),
      right = Array(R).fill(-1),
      dist = Array(L).fill(0);
    let matched = 0;
    const emit = (message) =>
      show(
        2,
        message,
        matrixView(A.map((row, u) => row.map((v, r) => (left[u] === r ? 'M' : v)))),
        stateTable(
          ['Left vertex', 'Matched right', 'Layer'],
          left.map((v, i) => [i, v, Number.isFinite(dist[i]) ? dist[i] : '∞']),
          'Alternating matching',
        ),
      );
    while (true) {
      const queue = [];
      for (let u = 0; u < L; u++) {
        dist[u] = left[u] < 0 ? 0 : Infinity;
        if (left[u] < 0) queue.push(u);
      }
      let shortest = Infinity;
      for (let h = 0; h < queue.length; h++) {
        const u = queue[h];
        if (dist[u] >= shortest) continue;
        for (let v = 0; v < R; v++)
          if (A[u][v]) {
            stats.visits++;
            if (right[v] < 0) shortest = dist[u] + 1;
            else if (dist[right[v]] === Infinity) {
              dist[right[v]] = dist[u] + 1;
              queue.push(right[v]);
            }
          }
      }
      if (shortest === Infinity) break;
      const augment = (u) => {
        for (let v = 0; v < R; v++)
          if (
            A[u][v] &&
            (right[v] < 0
              ? dist[u] + 1 === shortest
              : dist[right[v]] === dist[u] + 1 && augment(right[v]))
          ) {
            left[u] = v;
            right[v] = u;
            stats.writes += 2;
            return true;
          }
        dist[u] = Infinity;
        return false;
      };
      for (let u = 0; u < L; u++)
        if (left[u] < 0 && augment(u)) {
          matched++;
          emit(`Augment a shortest alternating path; matching size ${matched}.`);
        }
    }
    const seenL = new Set(),
      seenR = new Set(),
      queue = [];
    for (let u = 0; u < L; u++)
      if (left[u] < 0) {
        seenL.add(u);
        queue.push(u);
      }
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      for (let v = 0; v < R; v++)
        if (A[u][v] && left[u] !== v && !seenR.has(v)) {
          seenR.add(v);
          if (right[v] >= 0 && !seenL.has(right[v])) {
            seenL.add(right[v]);
            queue.push(right[v]);
          }
        }
    }
    const coverLeft = Array.from({ length: L }, (_, i) => i).filter((i) => !seenL.has(i)),
      coverRight = [...seenR];
    emit(`Maximum matching ${matched}; vertex-cover size ${coverLeft.length + coverRight.length}.`);
    return {
      size: matched,
      left,
      right,
      coverLeft,
      coverRight,
      text: `Matching size ${matched}; minimum vertex cover: left [${coverLeft}], right [${coverRight}].`,
    };
  }
  if (id === 'hungarian') {
    const A = input.matrix,
      n = A.length,
      u = Array(n + 1).fill(0),
      v = Array(n + 1).fill(0),
      p = Array(n + 1).fill(0),
      way = Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(n + 1).fill(Infinity),
        used = Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity,
          j1 = 0;
        for (let j = 1; j <= n; j++)
          if (!used[j]) {
            const cur = A[i0 - 1][j - 1] - u[i0] - v[j];
            stats.comparisons++;
            if (cur < minv[j]) {
              minv[j] = cur;
              way[j] = j0;
            }
            if (minv[j] < delta) {
              delta = minv[j];
              j1 = j;
            }
          }
        for (let j = 0; j <= n; j++)
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0);
      show(
        2,
        `Augment assignment for worker ${i - 1}.`,
        matrixView(A.map((row, r) => row.map((c, j) => (p[j + 1] === r + 1 ? '✓' : c)))),
        stateTable(
          ['Worker', 'Row potential', 'Job', 'Column potential'],
          Array.from({ length: n }, (_, j) => [j, u[j + 1], j, v[j + 1]]),
          'Hungarian dual potentials',
        ),
      );
    }
    const assignment = Array(n);
    for (let j = 1; j <= n; j++) assignment[p[j] - 1] = j - 1;
    const cost = assignment.reduce((s, j, i) => s + A[i][j], 0),
      dual = u.slice(1).reduce((a, b) => a + b, 0) + v.slice(1).reduce((a, b) => a + b, 0);
    return {
      assignment,
      cost,
      dual,
      rowPotentials: u.slice(1),
      columnPotentials: v.slice(1),
      text: `Optimal cost ${cost}; worker-to-job assignment [${assignment}]; dual cost ${dual}.`,
    };
  }
  if (id === 'bridges') {
    const A = input.matrix,
      n = A.length,
      discovery = Array(n).fill(-1),
      low = Array(n).fill(0),
      cut = new Set(),
      bridges = [];
    let clock = 0;
    function dfs(u, parent) {
      discovery[u] = low[u] = clock++;
      let children = 0;
      for (let v = 0; v < n; v++)
        if (A[u][v]) {
          stats.visits++;
          if (discovery[v] < 0) {
            children++;
            dfs(v, u);
            low[u] = Math.min(low[u], low[v]);
            if (low[v] > discovery[u]) bridges.push([u, v]);
            if (parent >= 0 && low[v] >= discovery[u]) cut.add(u);
          } else if (v !== parent) low[u] = Math.min(low[u], discovery[v]);
        }
      if (parent < 0 && children > 1) cut.add(u);
      show(
        2,
        `Finish DFS vertex ${u}; discovery ${discovery[u]}, low ${low[u]}.`,
        matrixView(A, [u, u]),
        stateTable(
          ['Vertex', 'Discovery', 'Low', 'Articulation'],
          discovery.map((d, i) => [i, d, low[i], cut.has(i) ? 'yes' : 'no']),
        ),
      );
    }
    for (let i = 0; i < n; i++) if (discovery[i] < 0) dfs(i, -1);
    return {
      bridges,
      articulation: [...cut].sort((a, b) => a - b),
      discovery,
      low,
      text: `Bridges: ${bridges.map((e) => e.join('–')).join(', ') || 'none'}; articulation vertices [${[...cut].sort((a, b) => a - b)}].`,
    };
  }
  if (id === 'lca') {
    const p = input.parents,
      n = p.length,
      K = Math.floor(Math.log2(n)) + 1,
      depth = Array(n).fill(0),
      up = Array.from({ length: n }, () => Array(K).fill(0));
    for (let i = 1; i < n; i++) depth[i] = depth[p[i]] + 1;
    for (let i = 0; i < n; i++) up[i][0] = p[i];
    for (let j = 1; j < K; j++) for (let i = 0; i < n; i++) up[i][j] = up[up[i][j - 1]][j - 1];
    let a = input.u,
      b = input.v;
    const emit = (message) =>
      show(
        2,
        message,
        {
          type: 'tree',
          roots: [0],
          nodes: p.map((_v, i) => ({
            id: i,
            label: i,
            detail: `depth ${depth[i]}`,
            active: i === a || i === b,
          })),
          edges: p.flatMap((v, i) => (i ? [[v, i]] : [])),
        },
        stateTable(
          ['Vertex', ...Array.from({ length: K }, (_, j) => `2^${j}`)],
          up.map((r, i) => [i, ...r]),
          'Binary ancestors',
        ),
      );
    emit('Preprocessed ancestor powers.');
    if (depth[a] < depth[b]) [a, b] = [b, a];
    let gap = depth[a] - depth[b];
    for (let j = K - 1; j >= 0; j--)
      if (gap >= 2 ** j) {
        a = up[a][j];
        gap -= 2 ** j;
        emit(`Lift the deeper vertex by ${2 ** j}.`);
      }
    if (a !== b) {
      for (let j = K - 1; j >= 0; j--)
        if (up[a][j] !== up[b][j]) {
          a = up[a][j];
          b = up[b][j];
          emit(`Lift both by ${2 ** j} without reaching a common ancestor.`);
        }
      a = p[a];
    }
    emit(`Lowest common ancestor is ${a}.`);
    return { ancestor: a, depth, up, text: `LCA(${input.u},${input.v})=${a}.` };
  }
  if (id === 'sparsetable') {
    const a = input.values,
      n = a.length,
      K = Math.floor(Math.log2(n)) + 1,
      st = Array.from({ length: K }, () => Array(n).fill(null));
    st[0] = [...a];
    for (let k = 1; k < K; k++) {
      for (let i = 0; i + (1 << k) <= n; i++) {
        st[k][i] = Math.min(st[k - 1][i], st[k - 1][i + (1 << (k - 1))]);
        stats.comparisons++;
      }
      show(
        1,
        `Build intervals of length ${1 << k}.`,
        matrixView(st),
        stateTable(
          ['Power', ...a.map((_, i) => i)],
          st.map((r, i) => [i, ...r]),
        ),
      );
    }
    const k = Math.floor(Math.log2(input.right - input.left + 1)),
      b = input.right - (1 << k) + 1,
      value = Math.min(st[k][input.left], st[k][b]);
    show(
      3,
      `Query two length-${1 << k} intervals starting ${input.left} and ${b}.`,
      matrixView(st, [k, input.left]),
      stateTable(
        ['Block start', 'Length', 'Minimum'],
        [
          [input.left, 1 << k, st[k][input.left]],
          [b, 1 << k, st[k][b]],
        ],
      ),
    );
    return {
      minimum: value,
      table: st,
      power: k,
      starts: [input.left, b],
      text: `Minimum on [${input.left},${input.right}] is ${value}.`,
    };
  }
  if (id === 'bitmasktsp') {
    const A = input.matrix,
      n = A.length,
      N = 1 << n,
      dp = Array.from({ length: N }, () => Array(n).fill(Infinity)),
      prev = Array.from({ length: N }, () => Array(n).fill(-1));
    dp[1][0] = 0;
    for (let mask = 1; mask < N; mask += 2) {
      for (let u = 0; u < n; u++)
        if (Number.isFinite(dp[mask][u]))
          for (let v = 1; v < n; v++)
            if (!(mask & (1 << v))) {
              const next = mask | (1 << v),
                cost = dp[mask][u] + A[u][v];
              stats.comparisons++;
              if (cost < dp[next][v]) {
                dp[next][v] = cost;
                prev[next][v] = u;
                stats.writes++;
              }
            }
      show(
        1,
        `Extend subset ${mask.toString(2).padStart(n, '0')}.`,
        sequenceView(dp[mask].map((v) => (Number.isFinite(v) ? v : '∞'))),
        stateTable(
          ['Last city', 'Cost', 'Previous city'],
          dp[mask].map((v, i) => [i, Number.isFinite(v) ? v : '∞', prev[mask][i]]),
          'Subset DP state',
        ),
        { mask },
      );
    }
    let cost = Infinity,
      last = -1;
    for (let u = 1; u < n; u++)
      if (dp[N - 1][u] + A[u][0] < cost) {
        cost = dp[N - 1][u] + A[u][0];
        last = u;
      }
    const reversed = [];
    let mask = N - 1,
      u = last;
    while (u !== 0) {
      reversed.push(u);
      const p = prev[mask][u];
      mask ^= 1 << u;
      u = p;
    }
    const tour = [0, ...reversed.reverse(), 0];
    show(
      3,
      `Close the optimal tour; cost ${cost}.`,
      sequenceView(tour),
      stateTable(
        ['Leg', 'From', 'To', 'Cost'],
        tour.slice(1).map((v, i) => [i, tour[i], v, A[tour[i]][v]]),
      ),
    );
    return { cost, tour, text: `Optimal closed tour [${tour}], cost ${cost}.` };
  }
  if (id === 'intervals') {
    const ordered = input.intervals
        .map(([start, end], index) => ({ start, end, index }))
        .sort((a, b) => a.end - b.end || a.start - b.start || a.index - b.index),
      selected = [];
    let finish = -Infinity;
    for (const p of ordered) {
      stats.comparisons++;
      const accepted = p.start >= finish;
      if (accepted) {
        selected.push(p.index);
        finish = p.end;
      }
      show(
        2,
        `${accepted ? 'Select' : 'Skip'} interval ${p.index} [${p.start},${p.end}).`,
        { type: 'intervals', intervals: input.intervals, selected: [...selected], active: p.index },
        stateTable(
          ['Original index', 'Start', 'End', 'Selected'],
          ordered.map((q) => [q.index, q.start, q.end, selected.includes(q.index) ? 'yes' : 'no']),
        ),
      );
    }
    return {
      selected,
      count: selected.length,
      text: `Maximum cardinality ${selected.length}; original interval indexes [${selected}].`,
    };
  }
  throw Error(`Unknown optimization lab ${id}`);
}

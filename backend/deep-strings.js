import { sequenceView, stateTable } from './deep-trace.js';
// Native Array.sort may call its comparator a different number of times in
// different JS engines. A fixed merge order makes the replay counter portable.
function mergeOrder(values, compare) {
  if (values.length <= 1) return [...values];
  const mid = Math.floor(values.length / 2),
    left = mergeOrder(values.slice(0, mid), compare),
    right = mergeOrder(values.slice(mid), compare),
    out = [];
  let i = 0,
    j = 0;
  while (i < left.length && j < right.length)
    out.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++]);
  return [...out, ...left.slice(i), ...right.slice(j)];
}
export function runString(id, input, { show, stats }) {
  if (id === 'zmatch') {
    const s = input.pattern + '#' + input.text,
      z = Array(s.length).fill(0);
    let l = 0,
      r = 0;
    for (let i = 1; i < s.length; i++) {
      if (i <= r) z[i] = Math.min(r - i + 1, z[i - l]);
      while (i + z[i] < s.length) {
        stats.comparisons++;
        if (s[z[i]] !== s[i + z[i]]) break;
        z[i]++;
      }
      if (i + z[i] - 1 > r) {
        l = i;
        r = i + z[i] - 1;
      }
      show(
        2,
        `Z[${i}]=${z[i]}, box [${l},${r}].`,
        sequenceView([...s], [i]),
        stateTable(
          ['Index', 'Character', 'Z'],
          [...s].map((c, j) => [j, c, z[j]]),
          'Z-array',
        ),
        { z: [...z], left: l, right: r },
      );
    }
    const matches = z.flatMap((v, i) =>
      i > input.pattern.length && v >= input.pattern.length ? [i - input.pattern.length - 1] : [],
    );
    return { z, matches, text: `Matches at zero-based indexes: ${matches.join(', ') || 'none'}.` };
  }
  if (id === 'manacher') {
    const s = '^#' + [...input.text].join('#') + '#$',
      radius = Array(s.length).fill(0);
    let center = 0,
      right = 0,
      best = 0,
      start = 0;
    for (let i = 1; i < s.length - 1; i++) {
      if (i < right) radius[i] = Math.min(right - i, radius[2 * center - i]);
      while (true) {
        stats.comparisons++;
        if (s[i + radius[i] + 1] !== s[i - radius[i] - 1]) break;
        radius[i]++;
      }
      if (i + radius[i] > right) {
        center = i;
        right = i + radius[i];
      }
      const at = Math.floor((i - radius[i]) / 2);
      if (radius[i] > best || (radius[i] === best && at < start)) {
        best = radius[i];
        start = at;
      }
      show(
        2,
        `Center ${i}: radius ${radius[i]}; best original interval [${start},${start + best}).`,
        sequenceView([...s], [i]),
        stateTable(
          ['Expanded index', 'Character', 'Radius'],
          [...s].map((c, j) => [j, c, radius[j]]),
        ),
        { radius: [...radius], center, right },
      );
    }
    return {
      start,
      length: best,
      palindrome: input.text.slice(start, start + best),
      radii: radius,
      text: `Longest palindrome: “${input.text.slice(start, start + best)}”, start ${start}, length ${best}.`,
    };
  }
  if (id === 'suffixarray') {
    const s = input.text,
      n = s.length;
    let sa = Array.from({ length: n }, (_, i) => i),
      rank = [...s].map((c) => c.charCodeAt(0));
    for (let k = 1; k < n; k *= 2) {
      sa = mergeOrder(sa, (a, b) => {
        stats.comparisons++;
        return rank[a] - rank[b] || (rank[a + k] ?? -1) - (rank[b + k] ?? -1);
      });
      const next = Array(n).fill(0);
      for (let i = 1; i < n; i++) {
        const a = sa[i - 1],
          b = sa[i];
        next[b] = next[a] + +(rank[a] !== rank[b] || (rank[a + k] ?? -1) !== (rank[b + k] ?? -1));
      }
      rank = next;
      show(
        1,
        `Sort rank pairs for prefix length ${2 * k}.`,
        sequenceView(sa),
        stateTable(
          ['SA index', 'Start', 'Rank', 'Suffix'],
          sa.map((v, i) => [i, v, rank[v], s.slice(v)]),
          'Prefix-doubling order',
        ),
      );
      if (rank[sa.at(-1)] === n - 1) break;
    }
    const inv = Array(n);
    sa.forEach((v, i) => (inv[v] = i));
    const lcp = Array(n).fill(0);
    let h = 0;
    for (let i = 0; i < n; i++) {
      const r = inv[i];
      if (r === 0) {
        h = 0;
        continue;
      }
      const j = sa[r - 1];
      while (i + h < n && j + h < n) {
        stats.comparisons++;
        if (s[i + h] !== s[j + h]) break;
        h++;
      }
      lcp[r] = h;
      if (h) h--;
    }
    show(
      3,
      'Kasai LCP scan complete.',
      sequenceView(sa),
      stateTable(
        ['Rank', 'Suffix start', 'LCP with previous', 'Suffix'],
        sa.map((v, i) => [i, v, lcp[i], s.slice(v)]),
      ),
    );
    return { suffixArray: sa, lcp, text: `SA=[${sa}]; LCP=[${lcp}].` };
  }
  if (id === 'ahocorasick') {
    const nodes = [{ next: {}, fail: 0, outputLink: -1, out: [] }];
    for (const word of input.patterns) {
      let state = 0;
      for (const c of word) {
        if (nodes[state].next[c] === undefined) {
          nodes[state].next[c] = nodes.length;
          nodes.push({ next: {}, fail: 0, outputLink: -1, out: [] });
        }
        state = nodes[state].next[c];
      }
      nodes[state].out.push(word);
    }
    const transitions = nodes.map(() => new Map());
    const go = (state, c) => {
      if (transitions[state].has(c)) return transitions[state].get(c);
      stats.visits++;
      const target = nodes[state].next[c] ?? (state ? go(nodes[state].fail, c) : 0);
      transitions[state].set(c, target);
      return target;
    };
    const outputs = (state) => {
      const words = [];
      for (let at = state; at >= 0; at = nodes[at].outputLink) words.push(...nodes[at].out);
      return words;
    };
    const emit = (message, active = -1) =>
      show(
        1,
        message,
        {
          type: 'tree',
          nodes: nodes.map((n, i) => ({
            id: i,
            label: i,
            detail: `fail ${n.fail}${outputs(i).length ? ' · ' + outputs(i).join('/') : ''}`,
            active: i === active,
          })),
          edges: nodes.flatMap((n, i) => Object.entries(n.next).map(([c, j]) => [i, j, c])),
          roots: [0],
        },
        stateTable(
          ['State', 'Failure', 'Outputs'],
          nodes.map((n, i) => [i, n.fail, outputs(i).join(',')]),
          'Trie failure/output table',
        ),
      );
    const queue = Object.values(nodes[0].next);
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head];
      for (const [c, v] of Object.entries(nodes[u].next)) {
        const f = go(nodes[u].fail, c);
        nodes[v].fail = f;
        nodes[v].outputLink = nodes[f].out.length ? f : nodes[f].outputLink;
        queue.push(v);
      }
      emit(`Build failure links from state ${u}.`, u);
    }
    let state = 0;
    const matches = [];
    for (let i = 0; i < input.text.length; i++) {
      const c = input.text[i];
      state = go(state, c);
      for (const word of outputs(state))
        matches.push({ pattern: word, start: i - word.length + 1, end: i + 1 });
      stats.visits++;
      emit(
        `Read text[${i}]=${c}; state ${state}; outputs ${outputs(state).join(', ') || 'none'}.`,
        state,
      );
    }
    if (!queue.length) emit('Trie has no nonroot states.');
    return {
      matches,
      nodes,
      text: `${matches.length} matches: ${matches.map((m) => m.pattern + '@' + m.start).join(', ') || 'none'}.`,
    };
  }
  throw Error(`Unknown string lab ${id}`);
}

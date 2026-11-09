const mod = (n, m) => ((n % m) + m) % m;
const tab = (headers, rows, caption) => ({ headers, rows, caption });
const seq = (values, active = [], vertical = false, details = []) => ({ type: 'sequence', vertical, items: values.map((label, i) => ({ label: label ?? '∅', detail: details[i] ?? `index ${i}`, active: active.includes(i) })) });
const heapView = (a, active = []) => ({ type: 'tree', roots: a.length ? [0] : [], nodes: a.map((label, id) => ({ id, label, detail: `index ${id}`, active: active.includes(id) })), edges: a.slice(1).map((_, i) => [Math.floor(i / 2), i + 1]) });

export function runDataStructure(id, input, { show, stats }) {
  if (['stack', 'queue', 'deque', 'circularqueue'].includes(id)) {
    const values = [], slots = Array(input.capacity ?? 0).fill(null), events = [];
    let head = 0;
    const view = () => id === 'circularqueue' ? seq(slots, [head], false, slots.map((_, i) => `slot ${i}${i === head ? ' · head' : ''}${i === (head + values.length) % input.capacity ? ' · rear' : ''}`)) : seq(values, values.length ? [id === 'stack' ? values.length - 1 : 0] : [], id === 'stack', values.map((_, i) => id === 'stack' ? i === values.length - 1 ? 'top' : 'bottom +' + i : i === 0 ? 'front' : i === values.length - 1 ? 'rear' : `index ${i}`));
    const emit = (line, message) => show(line, message, view(), tab(['Operation', 'Outcome'], events, 'Operation history'), { values, slots, head });
    emit(0, 'Empty structure. No values have been inserted.');
    for (const { op, args: [value] } of input.operations) {
      let message;
      const push = ['push', 'enqueue', 'pushfront', 'pushback'].includes(op), remove = ['pop', 'dequeue', 'popfront', 'popback'].includes(op);
      stats.comparisons++;
      emit(1, `Read ${op}${value === undefined ? '' : ` ${value}`}.`);
      if (push) {
        if (id === 'circularqueue' && values.length === input.capacity) message = `Overflow: reject ${value}; buffer is full.`;
        else {
          if (id === 'circularqueue') slots[(head + values.length) % input.capacity] = value;
          if (op === 'pushfront') values.unshift(value); else values.push(value);
          stats.writes++; message = `Inserted ${value}.`;
        }
      } else if (!values.length) message = 'Underflow: structure is empty.';
      else if (remove) {
        const back = op === 'pop' || op === 'popback';
        const removed = back ? values.pop() : values.shift();
        if (id === 'circularqueue') { slots[head] = null; head = (head + 1) % input.capacity; }
        stats.writes++; message = `Removed ${removed}.`;
      } else message = `Observed ${op === 'peek' || op === 'back' ? values.at(-1) : values[0]}.`;
      events.push([`${op}${value === undefined ? '' : ` ${value}`}`, message]); emit(2, message);
    }
    const result = { values, events, head, slots, text: `Remaining ${id === 'stack' ? 'bottom → top' : 'front → rear'}: [${values.join(', ')}].` };
    emit(3, result.text); return result;
  }
  if (id === 'linkedlist' || id === 'doublylinked') {
    const nodes = new Map(), events = []; let head = null, tail = null, nextId = 0;
    const ordered = () => { const list = []; for (let at = head; at !== null; at = nodes.get(at).next) list.push(nodes.get(at)); return list; };
    const emit = (line, message, current = null) => {
      const list = ordered();
      show(line, message, { type: 'sequence', linked: true, double: id === 'doublylinked', items: list.map(n => ({ label: n.value, detail: `node ${n.id}${n.id === head ? ' · head' : n.id === tail ? ' · tail' : ''}`, active: n.id === current })) }, tab(['Node', 'Value', ...(id === 'doublylinked' ? ['Previous'] : []), 'Next'], list.map(n => [n.id, n.value, ...(id === 'doublylinked' ? [n.prev ?? 'null'] : []), n.next ?? 'null']), 'Actual node links, in traversal order'), { nodes: list, head, tail });
    };
    const locate = index => {
      let at = head, prev = null;
      for (let i = 0; i < index && at !== null; i++) { stats.visits++; emit(1, `Follow next from node ${at}.`, at); prev = at; at = nodes.get(at).next; }
      return { at, prev };
    };
    emit(0, 'head and tail are null.');
    for (const { op, args } of input.operations) {
      let message;
      if (op === 'find') {
        let found = -1, index = 0;
        for (const n of ordered()) { stats.comparisons++; emit(2, `Compare ${n.value} with ${args[0]}.`, n.id); if (n.value === args[0]) { found = index; break; } index++; }
        message = found < 0 ? `${args[0]} not found.` : `Found ${args[0]} at index ${found}.`;
      } else if (op === 'reverse') {
        for (const n of nodes.values()) { [n.next, n.prev] = [n.prev, n.next]; stats.writes += 2; }
        [head, tail] = [tail, head]; message = 'Swapped previous/next links and head/tail.';
      } else {
        const insertion = op !== 'delete', index = op === 'prepend' ? 0 : op === 'append' ? nodes.size : args[0];
        const value = op === 'insert' ? args[1] : args[0];
        if (index < 0 || index > nodes.size || (!insertion && index === nodes.size)) message = `Index ${index} is outside the list; state unchanged.`;
        else {
          const { at, prev } = locate(index);
          if (insertion) {
            const n = { id: nextId++, value, next: at, ...(id === 'doublylinked' ? { prev } : {}) }; nodes.set(n.id, n);
            if (prev === null) head = n.id; else nodes.get(prev).next = n.id;
            if (at === null) tail = n.id; else if (id === 'doublylinked') nodes.get(at).prev = n.id;
            stats.writes++; message = `Inserted ${value} at index ${index}.`;
          } else {
            const n = nodes.get(at);
            if (prev === null) head = n.next; else nodes.get(prev).next = n.next;
            if (n.next === null) tail = prev; else if (id === 'doublylinked') nodes.get(n.next).prev = prev;
            nodes.delete(at); stats.writes++; message = `Deleted ${n.value} at index ${index}.`;
          }
        }
      }
      events.push([op, message]); emit(2, message);
    }
    const values = ordered().map(n => n.value), result = { values, nodes: ordered(), head, tail, events, text: `List head → tail: [${values.join(', ')}].` };
    emit(3, result.text); return result;
  }
  if (id === 'bst' || id === 'avl') {
    const nodes = []; let root = null;
    const height = at => at === null ? 0 : nodes[at].height;
    const refresh = at => { nodes[at].height = 1 + Math.max(height(nodes[at].left), height(nodes[at].right)); };
    const emit = (line, message, active = []) => show(line, message, { type: 'tree', roots: root === null ? [] : [root], nodes: nodes.map(n => ({ id: n.id, label: n.value, detail: id === 'avl' ? `h${height(n.id)} · b${height(n.left) - height(n.right)}` : `node ${n.id}`, active: active.includes(n.id) })), edges: nodes.flatMap(n => [n.left, n.right].filter(c => c !== null).map(c => [n.id, c])) }, tab(['Node', 'Key', 'Left', 'Right', 'Parent', 'Height'], nodes.map(n => [n.id, n.value, n.left ?? 'null', n.right ?? 'null', n.parent ?? 'null', height(n.id)]), 'Search tree pointers and subtree heights'), { nodes, root });
    const rotate = (at, left) => {
      const a = nodes[at], b = nodes[left ? a.right : a.left], parent = a.parent, middle = left ? b.left : b.right;
      emit(2, `Before ${left ? 'left' : 'right'} rotation at key ${a.value}.`, [a.id, b.id]);
      if (parent === null) root = b.id; else nodes[parent][nodes[parent].left === at ? 'left' : 'right'] = b.id;
      b.parent = parent; a.parent = b.id;
      if (left) { a.right = middle; b.left = at; } else { a.left = middle; b.right = at; }
      if (middle !== null) nodes[middle].parent = at;
      refresh(a.id); refresh(b.id);
      stats.writes += 3; emit(2, `After rotation: subtree root is ${b.value}.`, [a.id, b.id]); return b.id;
    };
    emit(0, 'The search tree is empty.');
    for (const value of input.values) {
      let at = root, parent = null, duplicate = false;
      while (at !== null) { parent = at; stats.comparisons++; emit(1, `Insert ${value}: compare with ${nodes[at].value}.`, [at]); if (value === nodes[at].value) { duplicate = true; break; } at = nodes[at][value < nodes[at].value ? 'left' : 'right']; }
      if (duplicate) { emit(2, `Key ${value} already exists; ignore the duplicate.`, [at]); continue; }
      const n = { id: nodes.length, value, left: null, right: null, parent, height: 1 }; nodes.push(n);
      if (parent === null) root = n.id; else nodes[parent][value < nodes[parent].value ? 'left' : 'right'] = n.id;
      if (id === 'bst') for (let a = parent; a !== null; a = nodes[a].parent) refresh(a);
      stats.writes++; emit(0, `Attach new leaf ${value}.`, [n.id]);
      if (id === 'avl') for (let a = parent; a !== null;) {
        refresh(a);
        const balance = height(nodes[a].left) - height(nodes[a].right); let top = a;
        emit(1, `Key ${nodes[a].value}: balance ${balance}.`, [a]);
        if (balance > 1) { const l = nodes[a].left; if (height(nodes[l].left) < height(nodes[l].right)) rotate(l, true); top = rotate(a, false); }
        if (balance < -1) { const r = nodes[a].right; if (height(nodes[r].right) < height(nodes[r].left)) rotate(r, false); top = rotate(a, true); }
        a = nodes[top].parent;
      }
    }
    let at = root; const path = [];
    while (at !== null) { path.push(nodes[at].value); stats.comparisons++; stats.visits++; emit(3, `Search ${input.target}: compare with ${nodes[at].value}.`, [at]); if (nodes[at].value === input.target) break; at = nodes[at][input.target < nodes[at].value ? 'left' : 'right']; }
    const inorder = []; const walk = n => { if (n === null) return; walk(nodes[n].left); inorder.push(nodes[n].value); walk(nodes[n].right); }; walk(root);
    const result = { nodes, root, inorder, path, found: at !== null, height: height(root), text: `${input.target} ${at === null ? 'not found' : 'found'}; in-order [${inorder.join(', ')}]; height ${height(root)}.` };
    emit(3, result.text, at === null ? [] : [at]); return result;
  }
  if (id === 'minheap') {
    const heap = [], extracted = [];
    const emit = (line, message, active = []) => show(line, message, heapView(heap, active), tab(['Index', 'Key', 'Parent index'], heap.map((v, i) => [i, v, i ? Math.floor((i - 1) / 2) : 'root']), `Heap array; extracted [${extracted.join(', ')}]`), { heap, extracted });
    const swap = (i, j) => { [heap[i], heap[j]] = [heap[j], heap[i]]; stats.writes += 2; emit(1, `Exchange indexes ${i} and ${j}.`, [i, j]); };
    emit(0, 'Empty min heap.');
    for (const value of input.values) {
      heap.push(value); stats.writes++; let i = heap.length - 1; emit(0, `Append ${value}.`, [i]);
      while (i > 0) { const p = Math.floor((i - 1) / 2); stats.comparisons++; emit(1, `Compare child ${heap[i]} with parent ${heap[p]}.`, [i, p]); if (heap[p] <= heap[i]) break; swap(i, p); i = p; }
    }
    for (let count = 0; count < input.extracts; count++) {
      if (!heap.length) { emit(2, 'Underflow: no minimum to extract.'); continue; }
      const min = heap[0], last = heap.pop(); extracted.push(min); if (heap.length) heap[0] = last; stats.writes++; emit(2, `Extract ${min}; move the last leaf to the root.`, [0]);
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let child = 2 * i + 1;
        if (child + 1 < heap.length) { stats.comparisons++; if (heap[child + 1] < heap[child]) child++; }
        stats.comparisons++; emit(2, `Compare replacement ${heap[i]} with smaller child ${heap[child]}.`, [i, child]);
        if (heap[i] <= heap[child]) break; swap(i, child); i = child;
      }
    }
    const result = { heap, extracted, text: `Extracted [${extracted.join(', ')}]; heap [${heap.join(', ')}].` }; emit(3, result.text); return result;
  }
  if (id === 'hashchain' || id === 'hashlinear') {
    const buckets = Array.from({ length: input.capacity }, () => []), slots = Array(input.capacity).fill(null), rejected = [];
    const emit = (line, message, active = -1) => show(line, message, id === 'hashchain' ? { type: 'hash', buckets, active } : seq(slots, [active]), tab(['Bucket / slot', 'Keys'], (id === 'hashchain' ? buckets : slots).map((v, i) => [i, Array.isArray(v) ? v.join(' → ') || '∅' : v ?? '∅']), 'Modulo hash table'), { buckets, slots });
    emit(0, 'All buckets/slots are empty.');
    for (const key of input.values) {
      const start = mod(key, input.capacity); emit(1, `h(${key}) = ${start}.`, start);
      if (id === 'hashchain') {
        let duplicate = false;
        for (const value of buckets[start]) { stats.comparisons++; emit(2, `Compare chain key ${value} with ${key}.`, start); if (value === key) { duplicate = true; break; } }
        if (!duplicate) { buckets[start].push(key); stats.writes++; }
        emit(2, duplicate ? 'Duplicate key; table unchanged.' : `Append ${key} to bucket ${start}.`, start);
      } else {
        let placed = false;
        for (let p = 0; p < input.capacity; p++) {
          const slot = (start + p) % input.capacity; stats.comparisons++; emit(2, `Probe slot ${slot} for ${key}.`, slot);
          if (slots[slot] === key) { placed = true; break; }
          if (slots[slot] === null) { slots[slot] = key; stats.writes++; placed = true; emit(2, `Store ${key} in slot ${slot}.`, slot); break; }
        }
        if (!placed) { rejected.push(key); emit(2, `Table full: reject ${key}.`); }
      }
    }
    const start = mod(input.target, input.capacity); let found = false, location = null;
    if (id === 'hashchain') for (const key of buckets[start]) { stats.comparisons++; emit(3, `Search bucket ${start}: compare ${key} with ${input.target}.`, start); if (key === input.target) { found = true; location = start; break; } }
    else for (let p = 0; p < input.capacity; p++) { const slot = (start + p) % input.capacity; stats.comparisons++; emit(3, `Search probes slot ${slot}.`, slot); if (slots[slot] === input.target) { found = true; location = slot; break; } if (slots[slot] === null) break; }
    const result = { buckets, slots, found, location, rejected, text: `Key ${input.target} ${found ? `found in ${id === 'hashchain' ? 'bucket' : 'slot'} ${location}` : 'not found'}.${rejected.length ? ` Rejected [${rejected.join(', ')}] because the table was full.` : ''}` };
    emit(3, result.text, location ?? -1); return result;
  }
  if (id === 'dsu') {
    const parent = Array.from({ length: input.size }, (_, i) => i), rank = Array(input.size).fill(0), answers = [];
    const emit = (line, message, active = []) => show(line, message, { type: 'tree', roots: parent.filter((p, i) => p === i), nodes: parent.map((_, i) => ({ id: i, label: i, detail: `rank ${rank[i]}`, active: active.includes(i) })), edges: parent.flatMap((p, i) => p === i ? [] : [[p, i]]) }, tab(['Element', 'Parent', 'Rank'], parent.map((p, i) => [i, p, rank[i]]), 'Union-by-rank parent forest'), { parent, rank });
    const find = value => {
      let root = value; const path = [];
      while (parent[root] !== root) { path.push(root); stats.comparisons++; emit(1, `Follow parent ${root} → ${parent[root]}.`, [root, parent[root]]); root = parent[root]; }
      for (const n of path) if (parent[n] !== root) { parent[n] = root; stats.writes++; emit(1, `Compress element ${n} directly to root ${root}.`, [n, root]); }
      return root;
    };
    emit(0, 'Every element begins as its own root.');
    for (const { op, args: [a, b] } of input.operations) {
      const x = find(a), y = b === undefined ? null : find(b); let message;
      if (op === 'union') {
        if (x === y) message = `${a} and ${b} already share root ${x}.`;
        else { let low = x, high = y; if (rank[low] > rank[high]) [low, high] = [high, low]; parent[low] = high; if (rank[low] === rank[high]) rank[high]++; stats.writes++; message = `Attach root ${low} to root ${high}.`; }
      } else { const value = op === 'find' ? x : x === y; answers.push(value); message = op === 'find' ? `find(${a}) = ${x}.` : `connected(${a}, ${b}) = ${value}.`; }
      emit(op === 'union' ? 2 : 3, message, [a, ...(b === undefined ? [] : [b])]);
    }
    const roots = parent.map((_, i) => find(i)), components = new Set(roots).size;
    const result = { parent, rank, roots, components, answers, text: `${components} components; query answers [${answers.join(', ')}].` }; emit(3, result.text); return result;
  }
  if (id === 'trie') {
    const nodes = [{ id: 0, char: 'root', prefix: '', terminal: false, children: {} }];
    const emit = (line, message, current = 0, chosen = []) => show(line, message, { type: 'tree', roots: [0], nodes: nodes.map(n => ({ id: n.id, label: n.char, detail: n.terminal ? 'word end' : n.prefix || 'empty prefix', active: current === n.id, done: chosen.includes(n.prefix) && n.terminal })), edges: nodes.flatMap(n => Object.values(n.children).map(c => [n.id, c])) }, tab(['Node', 'Prefix', 'Word end', 'Children'], nodes.map(n => [n.id, n.prefix || '∅', n.terminal ? 'yes' : 'no', Object.keys(n.children).sort().join(', ') || '∅']), 'Trie character edges and word terminals'), { nodes });
    emit(0, 'Empty trie root.');
    for (const word of input.words) {
      let at = 0;
      for (const char of word) {
        stats.comparisons++;
        if (!Object.hasOwn(nodes[at].children, char)) { const next = nodes.length; nodes.push({ id: next, char, prefix: nodes[at].prefix + char, terminal: false, children: {} }); nodes[at].children[char] = next; stats.writes++; }
        at = nodes[at].children[char]; emit(1, `Insert ${word}: follow character ${char}.`, at);
      }
      nodes[at].terminal = true; stats.writes++; emit(2, `Mark ${word} as a complete word.`, at);
    }
    let at = 0;
    for (const char of input.prefix) { stats.comparisons++; if (!Object.hasOwn(nodes[at].children, char)) { at = null; emit(2, `No edge for ${char}: prefix is absent.`); break; } at = nodes[at].children[char]; emit(2, `Follow query prefix to ${nodes[at].prefix}.`, at); }
    const matches = [];
    const visit = n => { stats.visits++; if (nodes[n].terminal) matches.push(nodes[n].prefix); emit(3, `Enumerate prefix ${nodes[n].prefix || '∅'}.`, n, matches); for (const char of Object.keys(nodes[n].children).sort()) visit(nodes[n].children[char]); };
    if (at !== null) visit(at);
    const result = { matches, nodes, text: `Prefix “${input.prefix}”: ${matches.length ? matches.join(', ') : 'no matching words'}.` }; emit(3, result.text, at, matches); return result;
  }
  if (id === 'fenwick') {
    const values = [...input.values], tree = Array(values.length + 1).fill(0), visited = [];
    const emit = (line, message, active = []) => show(line, message, { type: 'tree', roots: tree.flatMap((_, i) => i && i + (i & -i) >= tree.length ? [i] : []), nodes: tree.slice(1).map((label, j) => ({ id: j + 1, label, detail: `i${j + 1}: ${j + 2 - ((j + 1) & -(j + 1))}…${j + 1}`, active: active.includes(j + 1) })), edges: tree.flatMap((_, i) => i && i + (i & -i) < tree.length ? [[i + (i & -i), i]] : []) }, tab(['Tree index', 'Stored sum', 'One-based covered interval'], tree.slice(1).map((v, j) => [j + 1, v, `${j + 2 - ((j + 1) & -(j + 1))}…${j + 1}`]), `Base array [${values.join(', ')}]`), { values, tree });
    emit(0, 'Zero-filled binary indexed tree.');
    const add = (index, delta, line) => { for (let i = index + 1; i < tree.length; i += i & -i) { tree[i] += delta; stats.writes++; emit(line, `Add ${delta} to tree[${i}]; next i += lowbit(i).`, [i]); } };
    values.forEach((v, i) => add(i, v, 0)); values[input.index] += input.delta; add(input.index, input.delta, 1);
    let sum = 0;
    for (let i = input.query + 1; i > 0; i -= i & -i) { sum += tree[i]; visited.push(i); stats.visits++; emit(2, `Take tree[${i}]=${tree[i]}; running sum ${sum}.`, [i]); }
    const result = { values, tree, sum, visited, text: `Prefix sum through index ${input.query} = ${sum}; tree slots [${visited.join(', ')}].` }; emit(3, result.text, visited); return result;
  }
  if (id === 'segment') {
    const values = [...input.values], nodes = [];
    const build = (lo, hi) => { const n = { id: nodes.length, lo, hi, sum: 0, left: null, right: null }; nodes.push(n); if (lo === hi) n.sum = values[lo]; else { const mid = Math.floor((lo + hi) / 2); n.left = build(lo, mid); n.right = build(mid + 1, hi); n.sum = nodes[n.left].sum + nodes[n.right].sum; } return n.id; };
    const root = build(0, values.length - 1), chosen = [];
    const emit = (line, message, active = []) => show(line, message, { type: 'tree', roots: [root], nodes: nodes.map(n => ({ id: n.id, label: n.sum, detail: `[${n.lo},${n.hi}]`, active: active.includes(n.id), done: chosen.includes(n.id) })), edges: nodes.flatMap(n => n.left === null ? [] : [[n.id, n.left], [n.id, n.right]]) }, tab(['Node', 'Interval', 'Sum'], nodes.map(n => [n.id, `[${n.lo}, ${n.hi}]`, n.sum]), `Base array [${values.join(', ')}]`), { nodes, values, chosen });
    emit(0, 'Built interval sums bottom-up.');
    const update = at => { const n = nodes[at]; if (n.lo === n.hi) { n.sum = input.value; values[input.index] = input.value; } else { const child = input.index <= nodes[n.left].hi ? n.left : n.right; update(child); n.sum = nodes[n.left].sum + nodes[n.right].sum; } stats.writes++; emit(1, `Recompute interval [${n.lo},${n.hi}] = ${n.sum}.`, [at]); }; update(root);
    const query = at => {
      const n = nodes[at]; stats.visits++; stats.comparisons++;
      if (n.hi < input.left || n.lo > input.right) { emit(2, `Skip disjoint interval [${n.lo},${n.hi}].`, [at]); return 0; }
      if (input.left <= n.lo && n.hi <= input.right) { chosen.push(at); emit(2, `Take covered interval [${n.lo},${n.hi}] = ${n.sum}.`, [at]); return n.sum; }
      emit(2, `Partial overlap at [${n.lo},${n.hi}]; descend.`, [at]); return query(n.left) + query(n.right);
    };
    const sum = query(root), result = { values, nodes, sum, chosen, text: `Sum over inclusive indexes ${input.left}…${input.right} = ${sum}.` }; emit(3, result.text); return result;
  }
  throw new Error(`Unimplemented data structure: ${id}`);
}

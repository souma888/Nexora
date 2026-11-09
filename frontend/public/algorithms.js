import { algorithms, runAlgorithm } from '../../backend/algorithms.js';
import { coordinates, workedExamples } from '../../backend/algorithm-definitions.js';
import { renderAdditional } from './algorithm-views.js';

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('lab');
let trace, position = 0, playing = false, timer, debounce;
const definition = Object.hasOwn(algorithms, id) ? algorithms[id] : null;
const fields = {};
const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
const number = value => Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '∞';

function pause() { playing = false; clearTimeout(timer); $('play').textContent = 'Play trace'; }
function feedback() {
  const answer = document.querySelector('input[name="prediction-choice"]:checked');
  if (answer) $('feedback').textContent = `${answer.value === '0' ? 'Correct.' : 'Reconsider your prediction.'} ${definition.answer[0]}. See the algorithm notes for the reason.`;
}
function table(headers, rows, caption, active = []) {
  const target = $('state-table'); target.replaceChildren(node('caption', caption));
  const head = node('thead'), hr = node('tr');
  for (const label of headers) { const th = node('th', label); th.scope = 'col'; hr.append(th); }
  head.append(hr); target.append(head);
  const body = node('tbody');
  rows.forEach((row, i) => {
    const tr = node('tr');
    row.forEach((value, j) => { const td = node(j === 0 ? 'th' : 'td', String(value)); if (j === 0) td.scope = 'row'; if (active[0] === i && active[1] === j) td.className = 'active'; tr.append(td); });
    body.append(tr);
  }); target.append(body);
}
function bars(frame) {
  const a = frame.array, lo = Math.min(0, ...a), hi = Math.max(1, ...a), baseline = 185 - 140 * (0 - lo) / (hi - lo);
  const w = 500 / a.length;
  const content = a.map((value, i) => {
    const y = 185 - 140 * (value - lo) / (hi - lo), active = frame.active.includes(i);
    const final = position === trace.frames.length - 1;
    const color = final && (definition.kind === 'sort' || trace.result.index === i) ? 'var(--result)' : active && !final ? 'var(--load)' : 'var(--curve)';
    return `<rect x="${30 + i * w}" y="${Math.min(y, baseline)}" width="${Math.max(5, w - 8)}" height="${Math.max(2, Math.abs(y - baseline))}" rx="3" fill="${color}" opacity=".8"/><text x="${30 + i * w + (w - 8) / 2}" y="${value >= 0 ? y - 8 : y + 17}" text-anchor="middle" style="fill:var(--text)">${value}</text><text x="${30 + i * w + (w - 8) / 2}" y="218" text-anchor="middle">${i}</text>`;
  }).join('');
  $('visual').innerHTML = `<svg viewBox="0 0 560 245" role="img" aria-label="Array values at step ${position + 1}"><path d="M24 ${baseline}H540" stroke="var(--grid)"/>${content}</svg>`;
  table(['Index', 'Value', 'State'], a.map((v, i) => [i, v, frame.active.includes(i) ? 'active' : frame.low !== undefined && (i < frame.low || i > frame.high) ? 'excluded' : '']), 'Array at this step');
  $('state-caption').textContent = frame.key !== undefined ? `Held key: ${frame.key}.` : frame.buffer ? `Merge buffer: [${frame.buffer.join(', ')}].` : frame.low !== undefined ? `Search interval [${frame.low}, ${frame.high}].` : 'Amber marks the active indexes. The table exposes the same values as the bars.';
}
function graph(frame) {
  const path = frame.path ?? [], visited = new Set(frame.visited);
  const edges = frame.edges.map(e => {
    const [x1, y1] = coordinates[e.from], [x2, y2] = coordinates[e.to], dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
    const onPath = path.some((v, i) => v === e.from && path[i + 1] === e.to);
    const active = frame.edge?.[0] === e.from && frame.edge?.[1] === e.to;
    const color = active ? 'var(--load)' : onPath ? 'var(--result)' : 'var(--border)';
    // Opposite directed edges use a small offset to remain distinguishable.
    const offset = frame.edges.some(other => other.from === e.to && other.to === e.from) ? 7 : 0;
    const ox = -dy / length * offset, oy = dx / length * offset;
    return `<path d="M${x1 + dx / length * 21 + ox} ${y1 + dy / length * 21 + oy}L${x2 - dx / length * 25 + ox} ${y2 - dy / length * 25 + oy}" stroke="${color}" stroke-width="${active || onPath ? 3 : 2}" marker-end="url(#arrow)"/><text x="${(x1 + x2) / 2 + ox}" y="${(y1 + y2) / 2 + oy - 7}" text-anchor="middle" paint-order="stroke" stroke="var(--plot-bg)" stroke-width="5" style="fill:var(--muted)">${e.weight}</text>`;
  }).join('');
  const nodes = coordinates.map(([x, y], i) => {
    const color = frame.current === i ? 'var(--load)' : path.includes(i) || visited.has(i) ? 'var(--result)' : 'var(--curve)';
    return `<circle cx="${x}" cy="${y}" r="20" fill="var(--surface-1)" stroke="${color}" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" style="fill:var(--text)">${i}</text><text x="${x}" y="${y < 60 ? y - 32 : y + 39}" text-anchor="middle" paint-order="stroke" stroke="var(--plot-bg)" stroke-width="4">d=${number(frame.distance[i])}</text>`;
  }).join('');
  $('visual').innerHTML = `<svg viewBox="0 0 550 230" role="img" aria-label="Directed graph with six nodes. Distances are listed in the state table."><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>${edges}${nodes}</svg>`;
  const headers = ['Node', 'Distance g', 'Parent', 'State', ...(frame.heuristic ? ['Heuristic h', 'g + h'] : [])];
  table(headers, coordinates.map((_, i) => [i, number(frame.distance[i]), frame.parent[i] ?? '—', id === 'bellman' ? Number.isFinite(frame.distance[i]) ? 'reachable' : 'unreached' : visited.has(i) ? 'visited' : frame.frontier.includes(i) ? 'frontier' : 'unsettled', ...(frame.heuristic ? [number(frame.heuristic[i]), number(frame.distance[i] + frame.heuristic[i])] : [])]), 'Node state; ∞ means no path discovered yet');
  $('state-caption').textContent = `Visited order: [${frame.visited.join(', ')}]. Frontier: [${frame.frontier.join(', ')}]. Arrows are directed; start ${frame.start}, goal ${frame.goal}.`;
}
function knapsack(frame) {
  const available = $('visual').clientWidth - 20;
  const columns = available < 310 ? 1 : available < 480 ? 2 : 3;
  const tiles = frame.weights.map((weight, i) => {
    const x = 14 + i % columns * 164, y = 58 + Math.floor(i / columns) * 76;
    const color = frame.chosen?.includes(i) ? 'var(--result)' : frame.cell?.[0] === i + 1 ? 'var(--load)' : 'var(--curve)';
    return `<rect x="${x}" y="${y}" width="146" height="60" rx="6" fill="var(--surface-1)" stroke="${color}"/><text x="${x + 12}" y="${y + 23}" style="fill:${color}">Item ${i}</text><text x="${x + 12}" y="${y + 45}">w ${weight} · v ${frame.values[i]}</text>`;
  }).join('');
  $('visual').innerHTML = `<svg class="item-diagram" viewBox="0 0 ${columns * 164 + 20} ${Math.max(230, 75 + Math.ceil(frame.weights.length / columns) * 76)}" role="img" aria-label="Knapsack items; weights and values are also listed below"><text x="14" y="24" style="fill:var(--text)">Capacity ${frame.capacity}${frame.cell ? ` · item ${frame.cell[0] - 1}` : frame.chosen ? ` · chosen ${frame.chosen.length}` : ''}</text>${tiles}</svg>`;
  table(['Items / capacity', ...Array.from({ length: frame.capacity + 1 }, (_, i) => i)], frame.table.map((row, i) => [i, ...row]), 'DP table: row i uses the first i items', frame.cell ? [frame.cell[0], frame.cell[1] + 1] : []);
  $('state-caption').textContent = `Items (weight, value): ${frame.weights.map((w, i) => `${i}: (${w}, ${frame.values[i]})`).join('; ')}.${frame.chosen ? ` Chosen indexes: [${frame.chosen.join(', ')}].` : ' Uncomputed cells are initialized to zero.'}`;
}
function render() {
  if (!trace) return;
  const frame = trace.frames[position];
  $('step-count').textContent = `${position + 1} / ${trace.frames.length}`;
  $('timeline').max = trace.frames.length - 1; $('timeline').value = position;
  $('timeline').setAttribute('aria-valuetext', `Step ${position + 1} of ${trace.frames.length}: ${frame.message}`);
  $('previous').disabled = position === 0; $('next').disabled = position === trace.frames.length - 1;
  $('step-message').textContent = frame.message;
  for (const [i, line] of [...$('pseudocode').children].entries()) {
    if (i === frame.line) line.setAttribute('aria-current', 'step'); else line.removeAttribute('aria-current');
  }
  for (const key of ['comparisons', 'writes', 'visits']) $(key).textContent = frame.stats[key];
  $('result-text').textContent = position === trace.frames.length - 1 ? trace.result.text : 'Trace in progress. Advance to the final step to reveal the outcome.';
  if (frame.view) renderAdditional(frame, $('visual'), table, $('state-caption'));
  else if (frame.array) bars(frame);
  else if (frame.edges) graph(frame);
  else if (frame.table) knapsack(frame);
  else {
    $('visual').replaceChildren(node('p', `(a, b) = (${frame.a}, ${frame.b})`)); $('visual').firstChild.className = 'algorithm-number';
    table(['Dividend a', 'Divisor b', 'Quotient', 'Remainder'], frame.divisions.map(d => [d.a, d.b, d.quotient, d.remainder]), 'Euclidean division history');
    $('state-caption').textContent = 'Each row satisfies a = quotient × b + remainder, with 0 ≤ remainder < b.';
  }
}
function regenerate(overrides) {
  pause(); position = 0;
  for (const field of Object.values(fields)) { field.removeAttribute('aria-invalid'); field.setCustomValidity(''); }
  try {
    trace = runAlgorithm(id, Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value])));
    $('status').textContent = 'Trace ready. Predict, then play or advance one step.'; $('status').dataset.error = 'false';
    $('play').disabled = false; $('timeline').disabled = false; render();
    if (overrides) $('feedback').textContent = '';
  } catch (error) {
    trace = null; $('status').textContent = error.message; $('status').dataset.error = 'true';
    const field = fields[error.field]; if (field) { field.setAttribute('aria-invalid', 'true'); field.setCustomValidity(error.message); }
    for (const key of ['play', 'previous', 'next', 'timeline']) $(key).disabled = true;
    $('visual').replaceChildren(node('p', 'Correct the input to generate a trace.'));
    $('state-table').replaceChildren(); $('step-count').textContent = '—'; $('step-message').textContent = '';
    $('result-text').textContent = 'Waiting for valid input.'; $('state-caption').textContent = '';
    for (const key of ['comparisons', 'writes', 'visits']) $(key).textContent = '—';
  }
}
function load(input) { for (const [key, field] of Object.entries(fields)) field.value = input[key] ?? definition.defaults[key]; regenerate(true); }
function initialize() {
  document.title = `${definition.title} · Nexora`;
  $('title').replaceChildren(definition.title, node('span', '.'));
  for (const [element, text] of Object.entries({ description: definition.description, predict: `Predict first. ${definition.predict}`, invariant: definition.invariant, example: definition.example, 'time-complexity': definition.complexity, 'space-complexity': definition.space })) $(element).textContent = text;
  definition.lines.forEach(line => $('pseudocode').append(node('li', line)));
  for (const algo of Object.values(algorithms)) { const option = node('option', algo.title); option.value = algo.id; $('algorithm-picker').append(option); }
  $('algorithm-picker').value = id;
  $('algorithm-picker').addEventListener('change', event => { location.href = `/algorithms.html?lab=${event.target.value}`; });
  const labels = { values: definition.kind === 'dp' ? 'Item values' : 'Array values', target: 'Target value', edges: 'Directed edges (from,to,weight)', start: 'Start node', goal: 'Goal node', weights: 'Item weights', capacity: 'Capacity', a: 'Integer a', b: 'Integer b' };
  for (const [key, value] of Object.entries(definition.defaults)) {
    const schema = definition.inputs[key];
    const row = node('div'), label = node('label', schema.label ?? labels[key]); label.htmlFor = `algo-${key}`;
    const input = node(key === 'edges' || schema.type === 'commands' ? 'textarea' : 'input');
    input.id = `algo-${key}`; input.name = key; input.className = 'algorithm-input'; input.value = value;
    if (typeof value === 'number') { input.type = 'number'; input.step = 1; }
    input.setAttribute('aria-describedby', 'input-help'); fields[key] = input; row.append(label, input); $('algorithm-fields').append(row);
  }
  $('input-help').textContent = definition.help ?? { sort: '1–16 integers, −99 to 99. Separate values with commas.', search: '1–16 integers, −99 to 99. Binary search sorts a copy first.', graph: `Six nodes (0–5), up to 24 directed edges. Separate edges with semicolons. Weights ${id === 'bellman' ? '−9' : '0'} to 20. An empty edge list is allowed.`, dp: 'Up to 8 items. Weights 1–30, values 0–99, capacity 1–30. Lists must have equal lengths.', number: 'Nonnegative integers up to 1,000,000; at least one must be nonzero.' }[definition.kind];
  const presets = { 'Default input': definition.defaults, 'Worked example': workedExamples[id] ?? definition.workedExample ?? definition.defaults };
  if (definition.kind === 'sort' || definition.kind === 'search') Object.assign(presets, {
    'Already sorted': { values: '1, 2, 3, 4, 5, 6, 7, 8', target: 5 }, 'Reverse sorted': { values: '8, 7, 6, 5, 4, 3, 2, 1', target: 5 }, 'Duplicates & negatives': { values: '3, -2, 3, 0, -2, 7', target: -2 }, 'Target absent': { values: '1, 3, 5, 7', target: 6 },
  });
  else if (definition.kind === 'graph') Object.assign(presets, {
    'Unreachable goal': { edges: '0,1,2; 1,2,3', start: 0, goal: 5 }, 'Directed cycle': { edges: '0,1,1; 1,2,1; 2,0,1; 2,5,2', start: 0, goal: 5 },
    ...(id === 'bellman' ? { 'Negative edge': { edges: '0,1,4; 0,2,5; 1,2,-2', start: 0, goal: 2 }, 'Negative cycle': { edges: '0,1,1; 1,2,-3; 2,1,1; 2,5,1', start: 0, goal: 5 } } : {}),
  });
  else if (definition.kind === 'dp') Object.assign(presets, { 'Nothing fits': { weights: '5, 6', values: '9, 12', capacity: 3 }, 'Greedy trap': { weights: '2, 3, 4', values: '3, 4, 5', capacity: 6 } });
  else if (definition.kind === 'number') Object.assign(presets, { 'Coprime': { a: 55, b: 34 }, 'One zero': { a: 24, b: 0 } });
  Object.assign(presets, definition.presets ?? {});
  for (const name of Object.keys(presets)) $('preset').append(node('option', name));
  $('preset').addEventListener('change', () => load(presets[$('preset').value]));
  // Rotate choices so the correct answer is not always in the same visual position.
  const rotation = Object.keys(algorithms).indexOf(id) % 3;
  [...definition.answer.keys()].map(i => (i + rotation) % 3).forEach(i => {
    const label = node('label'), radio = node('input'); radio.type = 'radio'; radio.name = 'prediction-choice'; radio.value = i;
    label.append(radio, node('span', definition.answer[i])); $('answers').append(label);
  });
  $('algorithm-form').addEventListener('submit', event => event.preventDefault());
  for (const field of Object.values(fields)) field.addEventListener('input', () => {
    pause(); clearTimeout(debounce);
    $('status').textContent = 'Updating trace…'; $('status').removeAttribute('data-error');
    $('result-text').textContent = 'Updating trace for the new input…';
    for (const key of ['play', 'previous', 'next', 'timeline']) $(key).disabled = true;
    debounce = setTimeout(() => regenerate(true), 120);
  });
  const reset = () => { clearTimeout(debounce); $('preset').selectedIndex = 0; for (const radio of document.querySelectorAll('[name="prediction-choice"]')) radio.checked = false; load(definition.defaults); };
  $('reset').addEventListener('click', reset);
  $('load-example').addEventListener('click', () => { clearTimeout(debounce); $('preset').value = 'Worked example'; load(presets['Worked example']); });
  $('previous').addEventListener('click', () => { pause(); position--; feedback(); render(); });
  $('next').addEventListener('click', () => { pause(); position++; feedback(); render(); });
  $('timeline').addEventListener('input', () => { pause(); position = Number($('timeline').value); feedback(); render(); });
  const tick = () => { if (!playing) return; if (position < trace.frames.length - 1) { position++; render(); } if (position === trace.frames.length - 1) pause(); else timer = setTimeout(tick, Number($('speed').value)); };
  $('play').addEventListener('click', () => { if (playing) { pause(); return; } if (position === trace.frames.length - 1) position = 0; playing = true; $('play').textContent = 'Pause trace'; feedback(); tick(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  let visualWidth = 0;
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - visualWidth) < 0.5) return;
    visualWidth = entry.contentRect.width;
    if (definition.kind === 'dp' && trace) requestAnimationFrame(render);
  }).observe($('visual'));
  $('loading').hidden = true; $('algorithm-lab').hidden = false; regenerate();
}
if (definition) initialize(); else $('loading').textContent = 'Choose an algorithm from the experiment catalog.';

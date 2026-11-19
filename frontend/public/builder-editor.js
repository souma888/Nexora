import { escapeHtml } from '../../backend/html.js';
import { geometryMap } from './builder-visuals.js';
import { refineMesh } from '../../backend/fem-continuum.js';
import { solverClient } from './worker-client.ts';
import { studioCode } from '../../backend/custom-dsa.js';
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const button = (label, action) => {
  const b = el('button', label);
  b.type = 'button';
  b.className = 'quiet';
  b.addEventListener('click', action);
  return b;
};
const SVG = 'http://www.w3.org/2000/svg';
const path = (a, b, c, d, color = 'var(--curve)') =>
  `<path d="M${a} ${b}L${c} ${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
function componentDefaults(c) {
  const t = c.type;
  const fields = ['V', 'I'].includes(t)
    ? { value: t === 'V' ? 5 : 0.001, wave: 'dc', frequency: 100, delay: 0, duty: 0.5, offset: 0 }
    : t === 'R'
      ? { value: 1000 }
      : t === 'C'
        ? { value: 1e-6, initial: 0 }
        : t === 'L'
          ? { value: 0.01, initial: 0 }
          : t === 'D'
            ? { Is: 1e-12, ideality: 1 }
            : t.endsWith('MOS')
              ? { gate: 2, beta: 0.002, threshold: 1, lambda: 0.02 }
              : { gate: 2, beta: 100, Is: 1e-14 };
  return { ...fields, ...c };
}
const types = {
  spice: ['R', 'C', 'L', 'V', 'I', 'D', 'NPN', 'PNP', 'NMOS', 'PMOS'],
  control: [
    'step',
    'constant',
    'sine',
    'sum',
    'gain',
    'transfer',
    'integrator',
    'saturation',
    'deadzone',
    'relay',
    'product',
  ],
  mechanism: ['revolute', 'prismatic', 'distance', 'weld', 'driver'],
};
export function mountBuilderEditor({ definition, form, applyInputs }) {
  const kind = definition.editor;
  if (!kind) return { update() {}, sync() {} };
  const source = form.querySelector('[name="project"]'),
    result = document.getElementById('model-visual'),
    container = el('section');
  container.className = 'builder-editor';
  container.setAttribute('aria-label', 'Interactive project editor');
  result.before(container);
  const heading = el('div');
  heading.className = 'builder-toolbar';
  heading.append(el('strong', 'DESIGN / YOUR MODEL'));
  let showDesign = true;
  const editButton = button('Design', () => {
      showDesign = true;
      display();
    }),
    resultButton = button('Inspect result', () => {
      showDesign = false;
      display();
    });
  heading.append(editButton, resultButton);
  container.append(heading);
  const design = el('div'),
    toolbar = el('div'),
    canvas = document.createElementNS(SVG, 'svg'),
    notice = el('p'),
    tables = el('div');
  design.className = 'builder-design';
  toolbar.className = 'builder-toolbar';
  canvas.classList.add('builder-canvas');
  canvas.setAttribute('viewBox', '0 0 520 300');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Editable model geometry. Select an item, drag it or use arrow keys. Data tables provide keyboard editing.',
  );
  canvas.setAttribute('tabindex', '0');
  notice.className = 'field-hint';
  notice.setAttribute('role', 'status');
  tables.className = 'builder-tables';
  design.append(toolbar, canvas, notice, tables);
  container.append(design);
  const row = source.closest('.sequence-field') ?? source.parentElement,
    details = el('details'),
    summary = el('summary', 'Portable JSON · import, inspect or edit directly');
  row.before(details);
  details.append(summary, row);
  details.className = 'builder-json';
  let data = {},
    selected = -1,
    mode = 'select',
    pending = [],
    drag = null,
    map,
    lastResult,
    lastFrame = 0,
    readSource;
  const client = solverClient();
  function display() {
    design.hidden = !showDesign;
    result.hidden = showDesign;
    editButton.setAttribute('aria-pressed', String(showDesign));
    resultButton.setAttribute('aria-pressed', String(!showDesign));
  }
  function read() {
    try {
      const p = JSON.parse(source.value);
      if (!p || Array.isArray(p) || typeof p !== 'object') throw Error('Use a JSON object.');
      data = p;
      readSource = source.value;
      if (kind === 'spice') data.components = (data.components ?? []).map(componentDefaults);
      if (kind === 'mechanism')
        data.bodies = (data.bodies ?? []).map((b) => ({
          velocity: [0, 0, 0],
          force: [0, 0, 0],
          ...b,
        }));
      draw();
      tableControls();
      notice.textContent =
        'Select or drag geometry. Every accepted edit recomputes in a background worker.';
    } catch (e) {
      notice.textContent = e.message;
    }
  }
  function commit() {
    source.value = JSON.stringify(data, null, 2);
    readSource = source.value;
    source.dispatchEvent(new Event('input', { bubbles: true }));
    draw();
  }
  function safePoints() {
    if (kind === 'fem')
      return (data.nodes ?? []).filter(
        (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
      );
    if (kind === 'mechanism')
      return (data.bodies ?? []).map((b) => [b.x, b.y]).filter((p) => p.every(Number.isFinite));
    if (kind === 'control')
      return (data.blocks ?? []).map((b, i) => [
        b.x ?? 40 + (i % 4) * 170,
        -(b.y ?? 60 + Math.floor(i / 4) * 130),
      ]);
    const nodes =
      kind === 'spice'
        ? [
            ...new Set([
              0,
              ...(data.components ?? []).flatMap((c) => [
                c.a,
                c.b,
                ...(c.gate === undefined ? [] : [c.gate]),
              ]),
              ...Object.keys(data.positions ?? {}).map(Number),
            ]),
          ].sort((a, b) => a - b)
        : (data.nodes ?? []).map((_, i) => i);
    return nodes.map(
      (n, i) =>
        data.positions?.[n] ?? [
          5 + 4 * Math.cos((i * 2 * Math.PI) / Math.max(1, nodes.length)),
          5 + 3 * Math.sin((i * 2 * Math.PI) / Math.max(1, nodes.length)),
        ],
    );
  }
  function draw() {
    try {
      const points = safePoints();
      if (!drag) map = geometryMap(points);
      if (!map) return;
      let drawing =
        '<defs><pattern id="builder-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--grid)"/></pattern></defs><rect width="520" height="300" fill="url(#builder-grid)"/>';
      const point = (i, label) => {
        const p = points[i];
        if (!p?.every(Number.isFinite)) return;
        drawing +=
          `<circle data-item="${i}" cx="${map.X(p[0])}" cy="${map.Y(p[1])}" r="${selected === i ? 10 : 7}" fill="var(--surface-2)" stroke="${selected === i ? 'var(--load)' : 'var(--curve)'}" stroke-width="2"/>` +
          `<text x="${map.X(p[0]) + 11}" y="${map.Y(p[1]) - 8}" style="fill:var(--text);font-size:12px">${escapeHtml(String(label))}</text>`;
      };
      if (kind === 'fem') {
        for (const [i, t] of (data.triangles ?? []).entries()) {
          if (!Array.isArray(t) || t.some((j) => !points[j])) continue;
          drawing += `<polygon data-face="${i}" points="${t.map((j) => `${map.X(points[j][0])},${map.Y(points[j][1])}`).join(' ')}" fill="var(--selection)" stroke="var(--border)"/>`;
        }
        points.forEach((_, i) => point(i, i));
        for (const [node, x, y] of data.supports ?? [])
          if (points[node]) {
            const p = points[node];
            if (x !== null)
              drawing += path(
                map.X(p[0]) - 13,
                map.Y(p[1]) - 13,
                map.X(p[0]) - 13,
                map.Y(p[1]) + 13,
                'var(--result)',
              );
            if (y !== null)
              drawing += path(
                map.X(p[0]) - 13,
                map.Y(p[1]) + 13,
                map.X(p[0]) + 13,
                map.Y(p[1]) + 13,
                'var(--result)',
              );
          }
      } else if (kind === 'control') {
        const b = data.blocks ?? [];
        for (const [from, to] of data.wires ?? []) {
          const i = b.findIndex((x) => x.id === from),
            j = b.findIndex((x) => x.id === to);
          if (i >= 0 && j >= 0)
            drawing += path(
              map.X(points[i][0]),
              map.Y(points[i][1]),
              map.X(points[j][0]),
              map.Y(points[j][1]),
              'var(--muted)',
            );
        }
        b.forEach((block, i) => {
          const p = points[i];
          drawing += `<rect data-item="${i}" x="${map.X(p[0]) - 35}" y="${map.Y(p[1]) - 19}" width="70" height="38" rx="4" fill="var(--surface-2)" stroke="${selected === i ? 'var(--load)' : 'var(--curve)'}"/><text pointer-events="none" x="${map.X(p[0])}" y="${map.Y(p[1]) - 2}" text-anchor="middle" style="fill:var(--text);font-size:12px">${escapeHtml(String(block.id))}</text><text pointer-events="none" x="${map.X(p[0])}" y="${map.Y(p[1]) + 13}" text-anchor="middle" style="fill:var(--muted);font-size:12px">${escapeHtml(String(block.type))}</text>`;
        });
      } else if (kind === 'spice') {
        const ns = [
          ...new Set([
            0,
            ...(data.components ?? []).flatMap((c) => [
              c.a,
              c.b,
              ...(c.gate === undefined ? [] : [c.gate]),
            ]),
            ...Object.keys(data.positions ?? {}).map(Number),
          ]),
        ].sort((a, b) => a - b);
        for (const c of data.components ?? []) {
          const a = points[ns.indexOf(c.a)],
            b = points[ns.indexOf(c.b)];
          if (!a || !b) continue;
          drawing +=
            path(map.X(a[0]), map.Y(a[1]), map.X(b[0]), map.Y(b[1])) +
            `<text x="${map.X((a[0] + b[0]) / 2)}" y="${map.Y((a[1] + b[1]) / 2) - 7}" style="fill:var(--text);font-size:12px">${escapeHtml(`${c.id} ${c.type}`)}</text>`;
        }
        ns.forEach((n, i) => point(i, n === 0 ? 'Ground' : `n${n}`));
      } else if (kind === 'mechanism') {
        (data.bodies ?? []).forEach((b, i) => {
          const a = (b.angle * Math.PI) / 180,
            L = (b.length ?? 1) / 2;
          drawing += path(
            map.X(b.x - L * Math.cos(a)),
            map.Y(b.y - L * Math.sin(a)),
            map.X(b.x + L * Math.cos(a)),
            map.Y(b.y + L * Math.sin(a)),
          );
          point(i, b.id);
        });
      } else {
        for (const e of data.edges ?? []) {
          if (!Array.isArray(e) || !points[e[0]] || !points[e[1]]) continue;
          const a = points[e[0]],
            b = points[e[1]];
          drawing += path(map.X(a[0]), map.Y(a[1]), map.X(b[0]), map.Y(b[1]), 'var(--muted)');
        }
        for (let i = 0; i < points.length; i++) point(i, data.nodes?.[i] ?? i);
      }
      canvas.innerHTML = drawing;
    } catch (e) {
      notice.textContent = `Finish valid geometry data to draw the canvas: ${e.message}`;
    }
  }
  function field(label, value, set, options) {
    const nullable = label.includes('or null');
    const wrapper = el('label'),
      input = options ? el('select') : el('input');
    wrapper.textContent = label;
    input.setAttribute('aria-label', label);
    if (options)
      for (const v of options) {
        const o = el('option', v);
        o.value = v;
        input.append(o);
      }
    else input.type = typeof value === 'number' && !nullable ? 'number' : 'text';
    if (label.endsWith(' type')) {
      input.readOnly = true;
      input.title = 'Delete this item and add the required type from the toolbar.';
    }
    if (typeof value === 'number') input.step = 'any';
    input.value =
      Array.isArray(value) || (value && typeof value === 'object')
        ? JSON.stringify(value)
        : String(value);
    input.addEventListener('change', () => {
      try {
        let next = nullable
          ? JSON.parse(input.value)
          : typeof value === 'number'
            ? Number(input.value)
            : typeof value === 'boolean'
              ? input.value === 'true'
              : Array.isArray(value) || (value && typeof value === 'object')
                ? JSON.parse(input.value)
                : input.value;
        if (typeof next === 'number' && !Number.isFinite(next))
          throw Error('Enter a finite number.');
        set(next);
        commit();
      } catch (e) {
        notice.textContent = e.message;
      }
    });
    wrapper.append(input);
    return wrapper;
  }
  function collection(title, list, onDelete, labels) {
    const detail = el('details');
    detail.open = true;
    detail.append(el('summary', title));
    const body = el('div');
    body.className = 'builder-row-list';
    list.forEach((item, i) => {
      const r = el('div');
      r.className = 'builder-row';
      if (Array.isArray(item))
        item.forEach((v, j) =>
          r.append(field(`${title} ${i} ${labels?.[j] ?? j}`, v, (value) => (item[j] = value))),
        );
      else
        for (const [key, v] of Object.entries(item)) {
          r.append(
            field(
              `${title} ${i} ${key}`,
              v,
              (value) => {
                const old = item[key];
                item[key] = value;
                if (key === 'id') {
                  if (kind === 'control') {
                    data.wires = (data.wires ?? []).map((w) =>
                      w.map((a, k) => (k < 2 && a === old ? value : a)),
                    );
                    if (data.output === old) data.output = value;
                    if (data.reference === old) data.reference = value;
                  }
                  if (kind === 'mechanism') {
                    for (const j of data.joints ?? []) {
                      if (j.a === old) j.a = value;
                      if (j.b === old) j.b = value;
                    }
                    if (data.probe?.body === old) data.probe.body = value;
                  }
                }
              },
              // Replacing a type needs a different schema: delete and add a typed item instead.
              key === 'wave' ? ['dc', 'step', 'sine', 'pulse'] : undefined,
            ),
          );
        }
      r.append(
        button(`Delete ${title} ${i}`, () => {
          onDelete(i);
          commit();
          tableControls();
        }),
      );
      body.append(r);
    });
    detail.append(body);
    tables.append(detail);
  }
  function tableControls() {
    tables.replaceChildren();
    if (kind === 'fem') {
      collection(
        'Nodes',
        data.nodes ?? [],
        (i) => {
          data.nodes.splice(i, 1);
          const remap = (rows) =>
            rows.filter((r) => r[0] !== i).map((r) => [r[0] > i ? r[0] - 1 : r[0], ...r.slice(1)]);
          data.triangles = (data.triangles ?? [])
            .filter((t) => !t.includes(i))
            .map((t) => t.map((j) => (j > i ? j - 1 : j)));
          data.supports = remap(data.supports ?? []);
          data.loads = remap(data.loads ?? []);
          if (data.thermal) {
            data.thermal.fixed = remap(data.thermal.fixed ?? []);
            data.thermal.loads = remap(data.thermal.loads ?? []);
          }
        },
        ['x (m)', 'y (m)'],
      );
      collection('Triangles', data.triangles ?? [], (i) => data.triangles.splice(i, 1), [
        'node A',
        'node B',
        'node C',
      ]);
      collection('Supports', data.supports ?? [], (i) => data.supports.splice(i, 1), [
        'node',
        'ux: m or null',
        'uy: m or null',
      ]);
      collection('Loads', data.loads ?? [], (i) => data.loads.splice(i, 1), [
        'node',
        'Fx (N)',
        'Fy (N)',
      ]);
      data.thermal ??= { fixed: [], loads: [], source: 0 };
      collection('Temperatures', data.thermal.fixed ?? [], (i) => data.thermal.fixed.splice(i, 1), [
        'node',
        'T (°C)',
      ]);
      collection('Heat loads', data.thermal.loads ?? [], (i) => data.thermal.loads.splice(i, 1), [
        'node',
        'heat (W)',
      ]);
      tables.append(
        field(
          'Volumetric heat source (W/m³)',
          data.thermal.source ?? 0,
          (v) => (data.thermal.source = v),
        ),
      );
    }
    if (kind === 'spice') {
      collection('Components', data.components ?? [], (i) => data.components.splice(i, 1));
      tables.append(field('Voltage probe node', data.probe ?? 0, (v) => (data.probe = v)));
    }
    if (kind === 'control') {
      collection('Blocks', data.blocks ?? [], (i) => {
        const id = data.blocks[i].id;
        data.blocks.splice(i, 1);
        data.wires = (data.wires ?? []).filter((w) => w[0] !== id && w[1] !== id);
      });
      collection('Wires', data.wires ?? [], (i) => data.wires.splice(i, 1), [
        'from ID',
        'to ID',
        'input port',
      ]);
      tables.append(
        field('Selected output block', data.output ?? '', (v) => (data.output = v)),
        field('Reference block', data.reference ?? '', (v) => (data.reference = v)),
      );
    }
    if (kind === 'mechanism') {
      collection('Bodies', data.bodies ?? [], (i) => {
        const id = data.bodies[i].id;
        data.bodies.splice(i, 1);
        data.joints = (data.joints ?? []).filter((j) => j.a !== id && j.b !== id);
      });
      collection('Joints', data.joints ?? [], (i) => data.joints.splice(i, 1));
      tables.append(
        field(
          'Probe body',
          data.probe?.body ?? '',
          (v) => ((data.probe ??= { point: [0, 0] }).body = v),
        ),
        field(
          'Probe local [x,y]',
          data.probe?.point ?? [0, 0],
          (v) => ((data.probe ??= { body: '' }).point = v),
        ),
      );
    }
    if (kind === 'dsa') {
      const nodeRows = (data.nodes ?? []).map((x) => ({ label: x }));
      nodeRows.forEach((item, i) => {
        const row = el('div');
        row.className = 'builder-row';
        row.append(
          field(`Vertex ${i} label`, item.label, (v) => (data.nodes[i] = v)),
          button(`Delete vertex ${i}`, () => {
            data.nodes.splice(i, 1);
            data.edges = (data.edges ?? [])
              .filter((e) => e[0] !== i && e[1] !== i)
              .map(([a, b, w]) => [a > i ? a - 1 : a, b > i ? b - 1 : b, w]);
            data.start = data.start === i ? 0 : data.start > i ? data.start - 1 : data.start;
            if (data.positions)
              data.positions = Object.fromEntries(
                Object.entries(data.positions)
                  .filter(([n]) => Number(n) !== i)
                  .map(([n, v]) => [Number(n) > i ? Number(n) - 1 : Number(n), v]),
              );
            commit();
            tableControls();
          }),
        );
        tables.append(row);
      });
      collection('Edges', data.edges ?? [], (i) => data.edges.splice(i, 1), [
        'from',
        'to',
        'weight',
      ]);
      tables.append(
        field('Directed graph', data.directed ?? true, (v) => (data.directed = v), [
          'true',
          'false',
        ]),
        field('Start vertex index', data.start ?? 0, (v) => (data.start = v)),
        field('Array values (JSON)', data.array ?? [], (v) => (data.array = v)),
      );
    }
  }
  const unique = (prefix, list) => {
    let i = 1;
    while (list.some((v) => v.id === prefix + i)) i++;
    return prefix + i;
  };
  const add = (label, fn) =>
    toolbar.append(
      button(label, () => {
        try {
          fn();
          commit();
          tableControls();
        } catch (e) {
          notice.textContent = e.message;
        }
      }),
    );
  if (kind === 'fem') {
    const modeSelect = el('select');
    modeSelect.setAttribute('aria-label', 'Mesh canvas action');
    for (const [v, label] of [
      ['select', 'Select / drag'],
      ['node', 'Add node'],
      ['triangle', 'Triangle: click three nodes'],
    ]) {
      const o = el('option', label);
      o.value = v;
      modeSelect.append(o);
    }
    modeSelect.onchange = () => {
      mode = modeSelect.value;
      pending = [];
    };
    toolbar.append(modeSelect);
    add('Add node', () => {
      data.nodes.push([0.5, 0.25]);
      selected = data.nodes.length - 1;
    });
    add('Add triangle', () => {
      mode = 'triangle';
      modeSelect.value = 'triangle';
      pending = [];
      notice.textContent = 'Click three distinct mesh nodes.';
    });
    add('Restrain selected node', () => {
      if (selected < 0) throw Error('Select a node first.');
      data.supports ??= [];
      data.supports = data.supports.filter((r) => r[0] !== selected);
      data.supports.push([selected, 0, 0]);
    });
    add('Load selected node', () => {
      if (selected < 0) throw Error('Select a node first.');
      data.loads ??= [];
      data.loads.push([selected, 0, -1000]);
    });
    add('Set selected temperature', () => {
      if (selected < 0) throw Error('Select a node first.');
      data.thermal ??= { fixed: [], loads: [], source: 0 };
      data.thermal.fixed = data.thermal.fixed.filter((r) => r[0] !== selected);
      data.thermal.fixed.push([selected, 100]);
    });
    add('Add heat load', () => {
      if (selected < 0) throw Error('Select a node first.');
      data.thermal ??= { fixed: [], loads: [], source: 0 };
      data.thermal.loads.push([selected, 10]);
    });
    add('Refine triangles', () => (data = refineMesh(JSON.stringify(data))));
    for (const [id, label] of [
      ['fem2d', 'Plane stress'],
      ['femmodal', 'Modes'],
      ['femheat', 'Heat'],
    ])
      toolbar.append(
        button(label, () => {
          const query = new URLSearchParams({ lab: id, project: source.value });
          for (const key of Object.keys(definition.inputs)) {
            const control = form.querySelector(`[name="${key}"]`);
            if (key !== 'project' && control) query.set(key, control.value);
          }
          location.href = `/simulation.html?${query}`;
        }),
      );
  }
  if (kind === 'spice') {
    const type = el('select');
    type.setAttribute('aria-label', 'New component type');
    for (const t of types.spice) {
      const o = el('option', t);
      o.value = t;
      type.append(o);
    }
    toolbar.append(type);
    add('Add component', () => {
      data.components ??= [];
      const t = type.value,
        c = { id: unique(t, data.components), type: t, a: 1, b: 0 };
      if (['R', 'C', 'L', 'V', 'I'].includes(t))
        c.value = { R: 1000, C: 1e-6, L: 0.01, V: 5, I: 0.001 }[t];
      else if (['NPN', 'PNP', 'NMOS', 'PMOS'].includes(t)) {
        c.gate = 2;
        c.beta = t.endsWith('MOS') ? 0.002 : 100;
      }
      data.components.push(componentDefaults(c));
    });
  }
  if (kind === 'control') {
    const port = el('input');
    port.type = 'number';
    port.min = '0';
    port.max = '7';
    port.value = '0';
    port.setAttribute('aria-label', 'Destination input port');
    port.title = 'Zero-based input port';
    const connect = button('Connect blocks', () => {
      mode = mode === 'wire' ? 'select' : 'wire';
      pending = [];
      connect.setAttribute('aria-pressed', String(mode === 'wire'));
      notice.textContent = 'Select a source, then destination. Choose its zero-based input port.';
    });
    connect.setAttribute('aria-pressed', 'false');
    toolbar.append(connect, port);
    const type = el('select');
    type.setAttribute('aria-label', 'New block type');
    for (const t of types.control) {
      const o = el('option', t);
      o.value = t;
      type.append(o);
    }
    toolbar.append(type);
    add('Add block', () => {
      data.blocks ??= [];
      const t = type.value,
        b = {
          id: unique('b', data.blocks),
          type: t,
          x: 80 + (data.blocks.length % 4) * 140,
          y: 80 + Math.floor(data.blocks.length / 4) * 110,
        };
      if (['gain', 'constant', 'step', 'sine'].includes(t)) b.value = 1;
      if (t === 'step') b.time = 0;
      if (t === 'sine') b.frequency = 1;
      if (t === 'integrator') b.initial = [0];
      if (t === 'sum') b.signs = [1, -1];
      if (t === 'transfer') {
        b.num = [1];
        b.den = [1, 1];
      }
      if (t === 'saturation') {
        b.min = -1;
        b.max = 1;
      }
      if (t === 'deadzone') b.width = 0.1;
      if (t === 'relay') b.level = 1;
      data.blocks.push(b);
    });
    add('Add wire', () => {
      data.wires ??= [];
      data.wires.push([data.blocks?.[0]?.id ?? 'source', data.blocks?.at(-1)?.id ?? 'output', 0]);
    });
  }
  if (kind === 'mechanism') {
    add('Add rigid body', () => {
      data.bodies ??= [];
      data.bodies.push({
        id: unique('body', data.bodies),
        x: 1,
        y: 1,
        angle: 0,
        mass: 1,
        inertia: 1 / 12,
        length: 1,
      });
    });
    const type = el('select');
    type.setAttribute('aria-label', 'New joint type');
    for (const t of types.mechanism) {
      const o = el('option', t);
      o.value = t;
      type.append(o);
    }
    toolbar.append(type);
    add('Add joint', () => {
      data.joints ??= [];
      const j = {
        id: unique('joint', data.joints),
        type: type.value,
        a: 'ground',
        b: data.bodies?.at(-1)?.id ?? 'body1',
        anchorA: [0, 0],
        anchorB: [-0.5, 0],
      };
      if (j.type === 'distance') j.length = 1;
      if (['prismatic', 'weld', 'driver'].includes(j.type)) j.angle = 0;
      if (j.type === 'driver') j.speed = 30;
      if (j.type === 'prismatic') j.axis = 0;
      data.joints.push(j);
    });
  }
  if (kind === 'dsa') {
    add('Add vertex', () => {
      data.nodes ??= [];
      let i = data.nodes.length;
      while (data.nodes.includes(`V${i}`)) i++;
      data.nodes.push(`V${i}`);
    });
    add('Add edge', () => {
      data.edges ??= [];
      data.edges.push([0, Math.max(0, (data.nodes?.length ?? 1) - 1), 1]);
    });
  }
  add('Apply project', () => {});
  const download = button('Export project JSON', () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      ),
      a = el('a');
    a.href = url;
    a.download = `nexora-${definition.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  heading.append(download);
  const upload = el('input');
  upload.type = 'file';
  upload.hidden = true;
  upload.accept = '.json,application/json';
  upload.setAttribute('aria-label', 'Import project JSON');
  upload.onchange = async () => {
    const file = upload.files?.[0];
    if (!file) return;
    if (file.size > 64000) {
      notice.textContent = 'Project must be at most 64 kB.';
      return;
    }
    try {
      const p = JSON.parse(await file.text());
      source.value = JSON.stringify(p, null, 2);
      read();
      source.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      notice.textContent = e.message;
    }
  };
  heading.append(
    button('Import project JSON', () => upload.click()),
    upload,
  );
  canvas.onpointerdown = (event) => {
    canvas.focus();
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        canvas.getScreenCTM().inverse(),
      ),
      world = map.world(p.x, p.y),
      item = event.target.closest?.('[data-item]');
    if (item) {
      selected = Number(item.dataset.item);
      if (kind === 'control' && mode === 'wire') {
        pending.push(data.blocks[selected].id);
        if (pending.length === 2) {
          data.wires.push([
            pending[0],
            pending[1],
            Number(toolbar.querySelector('[aria-label="Destination input port"]').value),
          ]);
          pending = [];
          commit();
          tableControls();
        }
        notice.textContent = pending.length
          ? 'Choose the destination block.'
          : 'Wire added. Select another source, or turn Connect blocks off.';
        draw();
        return;
      }
      if (kind === 'fem' && mode === 'triangle') {
        if (!pending.includes(selected)) pending.push(selected);
        notice.textContent = `Triangle nodes: ${pending.join(', ')}`;
        if (pending.length === 3) {
          data.triangles ??= [];
          data.triangles.push([...pending]);
          pending = [];
          mode = 'select';
          commit();
          tableControls();
        }
        draw();
        return;
      }
      drag = { start: world, selected };
      canvas.setPointerCapture(event.pointerId);
      draw();
    } else if (kind === 'fem' && mode === 'node') {
      data.nodes ??= [];
      data.nodes.push(world);
      selected = data.nodes.length - 1;
      commit();
      tableControls();
    }
  };
  const moveSelected = (point) => {
    if (kind === 'fem') data.nodes[selected] = point;
    else if (kind === 'mechanism') {
      data.bodies[selected].x = point[0];
      data.bodies[selected].y = point[1];
    } else if (kind === 'control') {
      data.blocks[selected].x = point[0];
      data.blocks[selected].y = -point[1];
    } else {
      data.positions ??= {};
      const ns =
        kind === 'spice'
          ? [
              ...new Set([
                0,
                ...(data.components ?? []).flatMap((c) => [
                  c.a,
                  c.b,
                  ...(c.gate === undefined ? [] : [c.gate]),
                ]),
                ...Object.keys(data.positions ?? {}).map(Number),
              ]),
            ].sort((a, b) => a - b)
          : data.nodes.map((_, i) => i);
      data.positions[ns[selected]] = point;
    }
    draw();
  };
  canvas.onpointermove = (event) => {
    if (!drag) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      canvas.getScreenCTM().inverse(),
    );
    moveSelected(map.world(p.x, p.y));
  };
  canvas.onpointerup = () => {
    if (!drag) return;
    drag = null;
    commit();
    tableControls();
  };
  canvas.onlostpointercapture = () => {
    if (drag) {
      drag = null;
      commit();
      tableControls();
    }
  };
  canvas.onkeydown = (event) => {
    if (selected < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
      return;
    event.preventDefault();
    const p = safePoints()[selected],
      d = (kind === 'control' ? 5 : 0.01) * (event.shiftKey ? 10 : 1);
    moveSelected([
      p[0] + (event.key === 'ArrowLeft' ? -d : event.key === 'ArrowRight' ? d : 0),
      p[1] + (event.key === 'ArrowDown' ? -d : event.key === 'ArrowUp' ? d : 0),
    ]);
    commit();
    tableControls();
  };
  source.addEventListener('input', () => {
    if (source.value !== readSource) read();
  });
  let replay;
  if (kind === 'dsa') {
    replay = el('section');
    replay.className = 'builder-replay';
    const title = el('h3', 'Pseudocode · select lines to set breakpoints'),
      code = el('ol'),
      status = el('p'),
      bar = el('div'),
      benchmark = el('div');
    status.setAttribute('role', 'status');
    bar.className = 'builder-toolbar';
    let breaks = new Set(),
      playing = false,
      timer;
    const stop = () => {
        playing = false;
        clearTimeout(timer);
        play.textContent = 'Play to breakpoint';
      },
      probe = document.getElementById('wave-probe'),
      step = () => {
        if (!lastResult) return;
        showDesign = false;
        display();
        const next = Math.min(Number(probe.value) + 1, lastResult.series.length - 1);
        probe.value = String(next);
        probe.dispatchEvent(new Event('input'));
      },
      tick = () => {
        if (!playing) return;
        step();
        const f = lastResult?.visualization.frames[Number(probe.value)];
        if (!f || breaks.has(f.line) || Number(probe.value) >= lastResult.series.length - 1) {
          stop();
          status.textContent = f ? `Paused on line ${f.line + 1}: ${f.message}` : 'No trace.';
        } else timer = setTimeout(tick, 120);
      },
      play = button('Play to breakpoint', () => {
        if (playing) {
          stop();
          return;
        }
        playing = true;
        play.textContent = 'Pause trace';
        tick();
      });
    bar.append(
      play,
      button('Next instruction', () => {
        stop();
        step();
      }),
      button('Clear breakpoints', () => {
        breaks.clear();
        renderCode();
      }),
    );
    function renderCode() {
      code.replaceChildren();
      const algorithm = form.querySelector('[name="algorithm"]').value,
        lines = studioCode[algorithm] ?? [];
      lines.forEach((s, i) => {
        const li = el('li'),
          b = button(`${i + 1}. ${s}`, () => {
            if (breaks.has(i)) breaks.delete(i);
            else breaks.add(i);
            renderCode();
          });
        b.setAttribute('aria-pressed', String(breaks.has(i)));
        b.classList.toggle('has-breakpoint', breaks.has(i));
        if (lastResult?.visualization.frames[lastFrame]?.line === i)
          li.setAttribute('aria-current', 'step');
        li.append(b);
        code.append(li);
      });
    }
    const run = button('Measure empirical scaling', async () => {
      run.disabled = true;
      status.textContent = 'Measuring repeated warmed runs in a worker…';
      try {
        const algorithm = form.querySelector('[name="algorithm"]').value,
          r = await client.run('dsastudio', { algorithm }, 'benchmark', { seed: 42, repeats: 7 });
        benchmark.replaceChildren(
          el('h4', `Measured ${r.algorithm} · seeded inputs`),
          el('p', r.note),
        );
        const svg = document.createElementNS(SVG, 'svg');
        svg.setAttribute('viewBox', '0 0 520 240');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Measured median runtime versus input size');
        const max = Math.max(...r.rows.map((v) => v.milliseconds), 0.000001),
          X = (n) =>
            60 +
            ((Math.log2(n) - Math.log2(r.rows[0].n)) /
              (Math.log2(r.rows.at(-1).n) - Math.log2(r.rows[0].n))) *
              400,
          Y = (t) => 195 - (t / max) * 155;
        svg.innerHTML =
          `<text x="62" y="22" style="fill:var(--muted);font-size:12px">Median runtime (ms), 0…${max.toPrecision(3)}</text>` +
          path(60, 30, 60, 195, 'var(--border)') +
          path(60, 195, 470, 195, 'var(--border)') +
          `<path d="${r.rows.map((v, i) => `${i ? 'L' : 'M'}${X(v.n)} ${Y(v.milliseconds)}`).join(' ')}" fill="none" stroke="var(--result)" stroke-width="2"/>` +
          r.rows
            .map(
              (v) =>
                `<text x="${X(v.n)}" y="215" text-anchor="middle" style="fill:var(--muted);font-size:12px">${v.n}</text>`,
            )
            .join('');
        benchmark.append(svg);
        const table = el('table'),
          head = el('tr');
        ['n', 'Median ms', 'Min…max ms', 'Operations'].forEach((s) => head.append(el('th', s)));
        const thead = el('thead');
        thead.append(head);
        table.append(thead);
        const tbody = el('tbody');
        r.rows.forEach((v) => {
          const tr = el('tr');
          [
            v.n,
            v.milliseconds.toPrecision(4),
            `${v.minimum.toPrecision(3)}…${v.maximum.toPrecision(3)}`,
            v.operations,
          ].forEach((s) => tr.append(el('td', String(s))));
          tbody.append(tr);
        });
        table.append(tbody);
        benchmark.append(table);
        status.textContent =
          'Measurement complete. This is empirical evidence, not a proof of Big-O.';
      } catch (e) {
        status.textContent = e.message;
      } finally {
        run.disabled = false;
      }
    });
    bar.append(run);
    replay.append(title, code, bar, status, benchmark);
    container.append(replay);
    replay.renderCode = renderCode;
    replay.stop = stop;
    renderCode();
    form.querySelector('[name="algorithm"]').addEventListener('input', () => {
      stop();
      breaks.clear();
      renderCode();
    });
  }
  read();
  display();
  return {
    sync: read,
    invalidate() {
      lastResult = null;
      replay?.stop();
    },
    update(resultData, index = 0) {
      lastResult = resultData;
      lastFrame = index;
      if (replay) {
        replay.renderCode();
        const f = resultData.visualization?.frames?.[index];
        if (f) notice.textContent = f.message;
      }
      if (source.value !== readSource && !drag) read();
      display();
    },
    applyProject(next) {
      applyInputs({ project: JSON.stringify(next) });
      read();
    },
  };
}

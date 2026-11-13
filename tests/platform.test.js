import assert from 'node:assert/strict';
import test from 'node:test';
import { solveLinear } from '../backend/linear.js';
import { solveCircuit, circuitModels } from '../backend/circuit-builder.js';
import { industrialModels, criticalSchedule, projectEdges } from '../backend/industrial.js';
import { convert, compatibleUnits } from '../backend/units.ts';
import { parseRun, csvCell } from '../backend/run-record.ts';
import { catalog, disciplineCounts } from '../backend/catalog.js';
import { validate } from '../backend/contract.js';
import { GET as discover, POST } from '../api/waves.js';
import { GET as discoverCatalog } from '../api/catalog.js';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

test('scaled partial pivoting handles row swaps, disparate scales, and singular matrices', () => {
  assert.deepEqual(
    solveLinear(
      [
        [0, 2],
        [1, 1],
      ],
      [4, 3],
    ),
    [1, 2],
  );
  assert.deepEqual(
    solveLinear(
      [
        [1e-9, 0],
        [0, 1e9],
      ],
      [2e-9, 3e9],
    ),
    [2, 3],
  );
  assert.throws(
    () =>
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    /Singular/,
  );
  assert.throws(() => solveLinear([[NaN]], [1]), /finite/);
});
test('custom divider and non-ground voltage source agree with independent KCL/KVL equations', () => {
  let r = solveCircuit('V V1 1 0 10; R R1 1 2 1000; R R2 2 0 1000');
  near(r.voltage(1), 10);
  near(r.voltage(2), 5);
  near(r.branches[0].current, -0.005);
  near(r.residual, 0);
  r = solveCircuit('V V1 1 2 5; R R1 1 0 1000; R R2 2 0 1000');
  near(r.voltage(1), 2.5);
  near(r.voltage(2), -2.5);
});
test('bridge circuit satisfies independent node balances and signed power conservation', () => {
  const r = solveCircuit(circuitModels.circuitbuilder.definition.presets['Bridge network'].netlist);
  near(r.voltage(2), 48 / 7);
  near(r.voltage(3), 36 / 7);
  for (const node of r.nodes) {
    const current = r.branches.reduce(
      (sum, c) => sum + (c.a === node ? c.current : 0) - (c.b === node ? c.current : 0),
      0,
    );
    near(current, 0);
  }
  near(
    r.branches.reduce((s, c) => s + c.power, 0),
    0,
  );
});
test('current-source direction, zero-source state and resistor scaling are correct', () => {
  const positive = solveCircuit('I I1 0 1 0.002; R R1 1 0 1000');
  near(positive.voltage(1), 2);
  near(solveCircuit('I I1 1 0 0.002; R R1 1 0 1000').voltage(1), -2);
  near(solveCircuit('R R1 0 1 1000').voltage(1), 0);
  const doubled = solveCircuit('V V1 1 0 10; R R1 1 2 2000; R R2 2 0 2000');
  near(doubled.voltage(2), 5);
  near(doubled.branches[0].current, -0.0025);
});
test('circuit validation rejects floating, conflicting, oversized and injected netlists', async () => {
  for (const netlist of [
    'R R1 1 2 1000',
    'I I1 0 1 1',
    'V V1 1 0 5; V V2 1 0 10',
    'R R1 1 0 -1',
    'R <img> 1 0 1',
    'R R1 1 1 1',
    Array(21).fill('R R1 0 1 100').join(';'),
  ]) {
    const d = circuitModels.circuitbuilder.definition;
    assert.ok(validate(d, { netlist }).message, netlist);
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: d.id, input: { netlist } }),
      }),
    );
    assert.equal(response.status, 422);
    assert.equal((await response.json()).field, 'netlist');
  }
});
test('editable project scheduling uses topological order and supports disconnected branches', () => {
  const r = criticalSchedule([2, 4, 3], projectEdges('C>A; A>B', 3));
  assert.equal(r.duration, 9);
  assert.deepEqual(r.early, [3, 5, 0]);
  assert.deepEqual(r.slack, [0, 0, 0]);
  const parallel = criticalSchedule([2, 4, 3], []);
  assert.equal(parallel.duration, 4);
  assert.deepEqual(parallel.slack, [2, 0, 1]);
  for (const source of ['A>B;B>A', 'A>A', 'A>B; A>B', 'A>D', '<script>'])
    assert.ok(
      validate(industrialModels.criticalpath.definition, {
        durations: '2,4,3',
        dependencies: source,
      }).message,
    );
});
test('unit conversion is reversible, dimension checked, and handles affine temperatures', () => {
  near(convert(1, 'ft', 'm'), 0.3048);
  near(convert(1, 'lbf', 'N'), 4.4482216152605);
  near(convert(1, 'kWh', 'J'), 3.6e6);
  near(convert(0, '°C', 'K'), 273.15);
  near(convert(273.15, 'K', '°C'), 0);
  for (const from of ['m', 'MPa', 's', 'A', 'Ω', '°C'])
    for (const to of compatibleUnits(from))
      near(convert(convert(12.34, from, to), to, from), 12.34, 1e-8);
  assert.throws(() => convert(1, 'm', 's'));
  assert.throws(() => convert(Infinity, 'm', 'ft'));
});
test('run files enforce format/model/version and reject non-scalar or prototype inputs', () => {
  const base = {
    format: 'nexora-run',
    schemaVersion: 1,
    model: 'divider',
    solverVersion: '1.0',
    input: { voltage: 12 },
    label: '<img onerror=alert(1)>',
  };
  assert.equal(parseRun(base, 'divider', '1.0').label, base.label);
  for (const input of [{ voltage: NaN }, { voltage: {} }, JSON.parse('{"__proto__":1}')])
    assert.throws(() => parseRun({ ...base, input }, 'divider', '1.0'));
  assert.throws(() => parseRun(base, 'buckconverter', '1.0'));
  assert.throws(() => parseRun(base, 'divider', '2.0'));
  assert.throws(() => parseRun({ ...base, schemaVersion: 2 }, 'divider', '1.0'));
});
test('CSV text cells cannot become spreadsheet formulas; numerical signs remain numbers', () => {
  for (const text of ['=1+1', ' +cmd', '-1+2', '@SUM(A1)', '\t=1'])
    assert.ok(csvCell(text).startsWith('"\''));
  assert.equal(csvCell(-2), '"-2"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test('catalog discovery, counts, routes and the latest labs agree with executable registries', async () => {
  const registry = await discover().json(),
    discovery = await discoverCatalog().json();
  assert.equal(catalog.length, 160);
  assert.equal(disciplineCounts.electrical, 5);
  assert.equal(discovery.labs.length, catalog.length);
  for (const d of registry.models) {
    const entry = catalog.find((l) => l.id === d.id);
    assert.ok(entry);
    assert.equal(entry.endpoint, '/api/waves');
    assert.deepEqual(entry.groups, [d.discipline]);
  }
  assert.ok(registry.models.some((d) => d.id === 'circuitbuilder'));
  assert.equal(new Set(catalog.map((d) => d.id)).size, catalog.length);
});

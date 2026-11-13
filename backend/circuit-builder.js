import { content } from './content/circuit-builder.js';
import { lab, textInput, table } from './lab-kit.js';
import { solveLinear } from './linear.js';

/** @typedef {{kind:'R'|'V'|'I',name:string,a:number,b:number,value:number}} Component */
/** @param {string} source @returns {Component[]} */
export function parseCircuit(source) {
  const lines = source
    .trim()
    .split(/[;\n]+/)
    .filter((line) => line.trim());
  if (!lines.length || lines.length > 20)
    throw new Error('Use 1–20 components, separated by semicolons or newlines.');
  const names = new Set();
  return lines.map((line) => {
    const parts = line.trim().split(/\s+/),
      [kind, name, first, second, raw] = parts;
    if (
      parts.length !== 5 ||
      !['R', 'V', 'I'].includes(kind) ||
      !/^\w{1,12}$/.test(name) ||
      names.has(name)
    )
      throw new Error('Each line needs a unique name: R|V|I name nodeA nodeB value.');
    const a = Number(first),
      b = Number(second),
      value = Number(raw);
    if (
      !/^\d$/.test(first) ||
      !/^\d$/.test(second) ||
      a > 8 ||
      b > 8 ||
      a === b ||
      !Number.isFinite(value)
    )
      throw new Error('Use distinct node numbers 0–8 and finite values. Node 0 is ground.');
    if (kind === 'R' && (value < 1e-3 || value > 1e9))
      throw new Error('Resistances must be 0.001–1e9 Ω.');
    if ((kind === 'V' && Math.abs(value) > 1000) || (kind === 'I' && Math.abs(value) > 10))
      throw new Error('Sources are bounded to ±1000 V or ±10 A.');
    names.add(name);
    return { kind: /** @type {Component['kind']} */ (kind), name, a, b, value };
  });
}
/** @param {string} source */
export function solveCircuit(source) {
  const components = parseCircuit(source),
    nodes = [...new Set(components.flatMap((c) => [c.a, c.b]))].sort((a, b) => a - b);
  if (nodes[0] !== 0) throw new Error('Connect the circuit to ground node 0.');
  const unknown = nodes.filter((n) => n !== 0),
    sources = components.filter((c) => c.kind === 'V'),
    n = unknown.length + sources.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0)),
    rhs = Array(n).fill(0),
    at = (node) => unknown.indexOf(node);
  for (const c of components) {
    const a = at(c.a),
      b = at(c.b);
    if (c.kind === 'R') {
      const g = 1 / c.value;
      if (a >= 0) matrix[a][a] += g;
      if (b >= 0) matrix[b][b] += g;
      if (a >= 0 && b >= 0) {
        matrix[a][b] -= g;
        matrix[b][a] -= g;
      }
    } else if (c.kind === 'I') {
      if (a >= 0) rhs[a] -= c.value;
      if (b >= 0) rhs[b] += c.value;
    } else {
      const k = unknown.length + sources.indexOf(c);
      if (a >= 0) {
        matrix[a][k] += 1;
        matrix[k][a] += 1;
      }
      if (b >= 0) {
        matrix[b][k] -= 1;
        matrix[k][b] -= 1;
      }
      rhs[k] = c.value;
    }
  }
  const solution = solveLinear(matrix, rhs),
    voltage = (node) => (node === 0 ? 0 : solution[at(node)]);
  const branches = components.map((c) => {
    const drop = voltage(c.a) - voltage(c.b),
      current =
        c.kind === 'R'
          ? drop / c.value
          : c.kind === 'I'
            ? c.value
            : solution[unknown.length + sources.indexOf(c)];
    return { ...c, drop, current, power: drop * current };
  });
  const residual = Math.max(
    ...matrix.map((row, i) => {
      const computed = row.reduce((sum, v, j) => sum + v * solution[j], 0);
      const scale =
        Math.abs(rhs[i]) + row.reduce((sum, v, j) => sum + Math.abs(v * solution[j]), 0);
      return Math.abs(computed - rhs[i]) / Math.max(scale, 1e-30);
    }),
  );
  return { nodes, voltage, branches, residual, matrix, rhs, solution };
}
export const circuitModels = {
  circuitbuilder: lab(
    {
      id: 'circuitbuilder',
      title: 'Build a DC Circuit: Nodal Analysis',
      discipline: 'electrical',
      lab: 'EE-MNA',
      topic: 'Numerical circuit analysis',
      inputs: {
        netlist: textInput(
          'Circuit netlist (Ω, V, A)',
          'V V1 1 0 10; R R1 1 2 1000; R R2 2 0 1000',
          2000,
          'Format: R|V|I name nodeA nodeB value. Separate components with semicolons or newlines. Node 0 is ground.',
        ),
      },
      validateValues({ netlist }) {
        try {
          solveCircuit(netlist);
        } catch (error) {
          return { key: 'netlist', message: error.message };
        }
      },
      metrics: {
        peak: ['Largest absolute node voltage', 'V'],
        dissipation: ['Resistor dissipation', 'W'],
        balance: ['Signed power-balance residual', 'W'],
        residual: ['Maximum relative equation residual', '1'],
      },
      plot: {
        x: 'Node number',
        xUnit: '',
        y: 'Node potential',
        yUnit: 'V',
        traces: { y: 'Voltage relative to ground' },
        step: true,
      },
      text: content['circuitbuilder'],
    },
    ({ netlist }) => {
      const r = solveCircuit(netlist);
      return {
        summary: {
          peak: Math.max(...r.nodes.map((node) => Math.abs(r.voltage(node)))),
          dissipation: r.branches.filter((c) => c.kind === 'R').reduce((s, c) => s + c.power, 0),
          balance: r.branches.reduce((s, c) => s + c.power, 0),
          residual: r.residual,
        },
        series: r.nodes.map((x) => ({ x, y: r.voltage(x) })),
        visualization: {
          type: 'engineering-extension',
          kind: 'circuit-network',
          nodes: r.nodes,
          branches: r.branches,
        },
        table: table(
          'Branch currents and signed absorbed power',
          [
            'Name',
            'Type',
            'A',
            'B',
            'Value (Ω/V/A)',
            'VA−VB (V)',
            'I A→B (A)',
            'Absorbed power (W)',
          ],
          r.branches.map((c) => [c.name, c.kind, c.a, c.b, c.value, c.drop, c.current, c.power]),
        ),
      };
    },
  ),
};
circuitModels.circuitbuilder.definition.presets = {
  'Bridge network': {
    netlist:
      'V V1 1 0 12; R R1 1 2 1000; R R2 2 0 2000; R R3 1 3 2000; R R4 3 0 1000; R R5 2 3 1000',
  },
  'Current-source drive': { netlist: 'I I1 0 1 0.002; R R1 1 0 1000' },
};

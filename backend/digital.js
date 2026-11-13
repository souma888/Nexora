import { lab, bit, integer, choice, list, parseList, table } from './lab-kit.js';
export function gateOutput(kind, a, b) {
  return {
    AND: a & b,
    OR: a | b,
    XOR: a ^ b,
    NAND: 1 - (a & b),
    NOR: 1 - (a | b),
    XNOR: 1 - (a ^ b),
    NOT: 1 - a,
  }[kind];
}
const gateNames = Object.fromEntries(
  ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR', 'NOT'].map((s) => [s, s]),
);
const sequenceText = '1, 0, 1, 1, 0, 0, 1, 0';
export const digitalModels = {
  gates: lab(
    {
      id: 'gates',
      title: 'Logic Gate Playground',
      discipline: 'digital',
      lab: 'DL01',
      topic: 'Combinational logic',
      inputs: {
        gate: choice('Logic gate', gateNames, 'AND'),
        a: bit('Input A', 1),
        b: bit('Input B', 0),
      },
      metrics: {
        output: ['Output Y', 'bit'],
        highRows: ['Truth-table rows with output 1', ''],
        inputs: ['Active input count', ''],
      },
      plot: {
        x: 'Truth-table row',
        xUnit: '',
        y: 'Output bit',
        yUnit: '',
        traces: { y: 'Y' },
        step: true,
      },
      text: [
        'Toggle input bits, compare gate symbols, and inspect the complete truth table.',
        'What does XOR output when both inputs are 1?',
        ['0', '1', 'An undefined voltage'],
        'XOR is high only when its two inputs differ.',
        'For AND, A=1 and B=0 produces Y=0. Switching B to 1 produces Y=1. NOT uses only input A.',
        'AND=A·B; OR=A+B (Boolean); XOR=A⊕B. NAND/NOR/XNOR invert their corresponding outputs. NOT=¬A.',
        'Ideal two-state Boolean logic. No voltage thresholds, propagation delay, fan-out or unknown/high-impedance states. Input B is ignored for NOT.',
      ],
    },
    ({ gate, a, b }) => {
      const rows =
          gate === 'NOT'
            ? [0, 1].map((v) => [v, '—', 1 - v])
            : Array.from({ length: 4 }, (_, i) => [i >> 1, i & 1, gateOutput(gate, i >> 1, i & 1)]),
        output = gateOutput(gate, a, b);
      return {
        summary: {
          output,
          highRows: rows.filter((r) => r[2]).length,
          inputs: gate === 'NOT' ? 1 : 2,
        },
        series: rows.map((r, i) => ({ x: i, y: r[2] })),
        visualization: { type: 'gate', gate, a, b, output },
        table: {
          ...table('Truth table (selected inputs highlighted)', ['A', 'B', 'Y'], rows),
          selected: gate === 'NOT' ? a : 2 * a + b,
        },
      };
    },
  ),
  fulladder: lab(
    {
      id: 'fulladder',
      title: 'Full Adder',
      discipline: 'digital',
      lab: 'DL02',
      topic: 'Combinational arithmetic',
      inputs: { a: bit('Input A', 1), b: bit('Input B', 1), carry: bit('Carry in', 0) },
      metrics: {
        sum: ['Sum bit S', 'bit'],
        carry: ['Carry out', 'bit'],
        total: ['Arithmetic input total', ''],
      },
      plot: {
        x: 'Truth-table row',
        xUnit: '',
        y: 'Bit value',
        yUnit: '',
        traces: { y: 'Sum', reference: 'Carry out' },
        step: true,
      },
      text: [
        'Add three single-bit inputs and separate the sum from the carry.',
        'For A=B=Cin=1, what are Cout and S?',
        ['Cout=1, S=1', 'Cout=0, S=1', 'Cout=1, S=0'],
        'The arithmetic total is 3, whose two-bit representation is 11.',
        'A=1, B=1, Cin=0 gives total 2: Cout=1 and S=0.',
        'S=A⊕B⊕Cin; Cout=(A·B)∨(Cin·(A⊕B)). Arithmetic check: A+B+Cin=2Cout+S.',
        'Ideal one-bit combinational adder. The truth table includes all eight input combinations. Ripple-carry delay and physical gate implementation are not modeled.',
      ],
    },
    ({ a, b, carry }) => {
      const rows = Array.from({ length: 8 }, (_, i) => {
          const a = i >> 2,
            b = (i >> 1) & 1,
            c = i & 1,
            n = a + b + c;
          return [a, b, c, n & 1, n >> 1];
        }),
        n = a + b + carry;
      return {
        summary: { sum: n & 1, carry: n >> 1, total: n },
        series: rows.map((r, i) => ({ x: i, y: r[3], reference: r[4] })),
        visualization: { type: 'adder', a, b, carry, sum: n & 1, outputCarry: n >> 1 },
        table: {
          ...table('Full-adder truth table', ['A', 'B', 'Cin', 'S', 'Cout'], rows),
          selected: 4 * a + 2 * b + carry,
        },
      };
    },
  ),
  flipflop: lab(
    {
      id: 'flipflop',
      title: 'Clocked Flip-Flops',
      discipline: 'digital',
      lab: 'DL03',
      topic: 'Sequential logic',
      initialProbe: 'start',
      stepAction: 'Next clock edge',
      inputs: {
        kind: choice(
          'Flip-flop type',
          { D: 'D flip-flop', T: 'T flip-flop', JK: 'JK flip-flop' },
          'D',
        ),
        initial: bit('Initial Q', 0),
        data: list('D / T / J sequence', sequenceText, 0, 1, 16),
        secondary: {
          ...list('K sequence (JK only)', '0, 0, 1, 0, 1, 0, 0, 1', 0, 1, 16),
          visibleWhen: { key: 'kind', is: 'JK' },
        },
      },
      rules: [
        {
          type: 'same-length',
          left: 'data',
          right: 'secondary',
          field: 'secondary',
          when: { key: 'kind', is: 'JK' },
          message: 'J and K sequences must have the same number of samples.',
        },
      ],
      metrics: {
        final: ['Q after all clock edges', 'bit'],
        toggles: ['Output transitions', ''],
        clocks: ['Clock edges in sequence', ''],
      },
      plot: {
        x: 'Positive clock edge',
        xUnit: '',
        y: 'Bit value',
        yUnit: '',
        traces: { y: 'Q', reference: 'D / T / J', other: 'K (JK only; otherwise 0)' },
        step: true,
      },
      text: [
        'Step positive clock edges and compare D capture, T toggle, and JK behavior.',
        'For a JK flip-flop, what happens when J=K=1 at an active clock edge?',
        ['Q toggles', 'Q always becomes 1', 'Q is invalid'],
        'JK defines the 11 case as toggle, unlike an invalid SR latch input combination.',
        'A D flip-flop initialized at 0 captures the default sequence 1,0,1,1,0,0,1,0. Q ends at 0 after six transitions.',
        'At each positive edge: D→Qnext=D; T→Qnext=Q⊕T; JK→Qnext=J¬Q∨¬K Q.',
        'Ideal edge-sampled model. Each sequence entry is a value immediately before one positive clock edge. No asynchronous reset, setup/hold timing, metastability or propagation delay.',
      ],
    },
    ({ kind, initial, data, secondary }) => {
      const d = parseList(data),
        k = parseList(secondary),
        rows = [[0, '—', '—', initial, initial]],
        frames = [{ cycle: 0, q: initial, input: null, k: null }],
        series = [{ x: 0, y: initial, reference: 0, other: 0 }];
      let q = initial,
        toggles = 0;
      d.forEach((value, i) => {
        const before = q,
          kv = kind === 'JK' ? k[i] : 0;
        q = kind === 'D' ? value : kind === 'T' ? q ^ value : (value & (1 - q)) | ((1 - kv) & q);
        if (q !== before) toggles++;
        rows.push([i + 1, value, kind === 'JK' ? kv : '—', before, q]);
        frames.push({ cycle: i + 1, q, input: value, k: kv });
        series.push({ x: i + 1, y: q, reference: value, other: kv });
      });
      return {
        summary: { final: q, toggles, clocks: d.length },
        series,
        visualization: { type: 'flipflop', frames, kind },
        table: {
          ...table(
            'Clock-edge transition trace',
            ['Edge', 'D / T / J', 'K', 'Q before', 'Q after'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
  counter: lab(
    {
      id: 'counter',
      title: 'Binary Up/Down Counter',
      discipline: 'digital',
      lab: 'DL04',
      topic: 'Sequential circuits',
      initialProbe: 'start',
      stepAction: 'Next clock edge',
      inputs: {
        bits: integer('Counter bits', 2, 8, 4),
        direction: choice('Count direction', { up: 'Up', down: 'Down' }, 'up'),
        initial: integer('Initial count', 0, 255, 0),
        steps: integer('Clock edges', 1, 32, 20),
      },
      validateValues({ initial, bits }) {
        if (initial >= 2 ** bits)
          return {
            key: 'initial',
            message: 'Initial count must fit in the selected number of bits.',
          };
      },
      metrics: {
        final: ['Final count', ''],
        wraps: ['Wrap events', ''],
        modulus: ['Counter modulus', ''],
      },
      plot: { x: 'Positive clock edge', xUnit: '', y: 'Unsigned count', yUnit: '', step: true },
      text: [
        'Watch bit patterns change as an ideal synchronous counter wraps around its modulus.',
        'What follows 1111 in a four-bit up counter?',
        ['0000', '10000 in the same four bits', '1110'],
        'Modulo-16 arithmetic discards the carry beyond the fourth bit.',
        'A four-bit up counter starting at 0 reaches 4 after 20 edges and wraps once at edge 16.',
        'Qnext=(Q±1) mod 2^b. The count is unsigned; bit strings are padded to b positions.',
        'Ideal synchronous binary counter, no ripple delay, clock gating or invalid state encoding. Use the step control to inspect individual clock edges.',
      ],
    },
    ({ bits, direction, initial, steps }) => {
      const modulus = 2 ** bits,
        frames = [],
        rows = [],
        series = [];
      let q = initial,
        wraps = 0;
      for (let edge = 0; edge <= steps; edge++) {
        let wrapped = false;
        if (edge) {
          const next = q + (direction === 'up' ? 1 : -1);
          wrapped = next < 0 || next >= modulus;
          if (wrapped) wraps++;
          q = (next + modulus) % modulus;
        }
        const binary = q.toString(2).padStart(bits, '0');
        frames.push({ cycle: edge, count: q, binary, wrapped });
        rows.push([edge, q, binary, wrapped ? 'yes' : 'no']);
        series.push({ x: edge, y: q });
      }
      return {
        summary: { final: q, wraps, modulus },
        series,
        visualization: { type: 'counter', frames, bits },
        table: {
          ...table('Counter timing states', ['Edge', 'Unsigned count', 'Binary', 'Wrapped'], rows),
          followProbe: true,
        },
      };
    },
  ),
  fsm: lab(
    {
      id: 'fsm',
      title: 'Finite-State Sequence Detector',
      discipline: 'digital',
      lab: 'DL05',
      topic: 'Finite-state machines',
      initialProbe: 'start',
      stepAction: 'Next input bit',
      inputs: { sequence: list('Serial input bits', '1, 0, 1, 0, 1, 1, 0, 1', 0, 1, 24) },
      metrics: {
        detections: ['Overlapping 101 detections', ''],
        final: ['Final state', ''],
        count: ['Input bits consumed', ''],
      },
      plot: {
        x: 'Consumed input bits',
        xUnit: '',
        y: 'Detection output',
        yUnit: 'bit',
        step: true,
      },
      text: [
        'Step a Moore machine that detects overlapping occurrences of the bit pattern 101.',
        'How many detections occur in 10101?',
        ['Two', 'One', 'Three'],
        'The final 1 of the first occurrence can begin the second occurrence.',
        'The default stream 10101101 contains detections ending at positions 3, 5 and 8 (one-based).',
        'States: S0=no prefix, S1=1, S2=10, S3=101 detected. Transition rows for inputs 0/1: S0→S0/S1; S1→S2/S1; S2→S0/S3; S3→S2/S1.',
        'Ideal positive-edge Moore machine with overlapping detection. Output is high in S3 after consuming the active input bit. No HDL synthesis, gate delay or physical timing model.',
      ],
    },
    ({ sequence }) => {
      const bits = parseList(sequence),
        transitions = [
          [0, 1],
          [2, 1],
          [0, 3],
          [2, 1],
        ],
        frames = [{ cycle: 0, state: 0, output: 0, bit: null, previous: 0 }],
        rows = [[0, '—', 'S0', 'S0', 0]],
        series = [{ x: 0, y: 0 }];
      let state = 0,
        detections = 0;
      bits.forEach((bit, i) => {
        const before = state;
        state = transitions[state][bit];
        const output = state === 3 ? 1 : 0;
        detections += output;
        frames.push({ cycle: i + 1, state, previous: before, bit, output });
        rows.push([i + 1, bit, `S${before}`, `S${state}`, output]);
        series.push({ x: i + 1, y: output });
      });
      return {
        summary: { detections, final: state, count: bits.length },
        series,
        visualization: { type: 'fsm', frames },
        table: {
          ...table(
            'Moore-machine transition trace',
            ['Bit position', 'Input', 'From', 'To', 'Detect'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
  cache: lab(
    {
      id: 'cache',
      title: 'Cache Mapping & LRU',
      discipline: 'digital',
      lab: 'DL06',
      topic: 'Computer architecture',
      initialProbe: 'start',
      stepAction: 'Next memory access',
      inputs: {
        addresses: list('Byte address trace', '0, 16, 0, 64, 0, 16', 0, 4095, 16),
        block: choice('Cache block size', { 16: '16 bytes', 32: '32 bytes', 64: '64 bytes' }, '16'),
        sets: choice('Cache set count', { 2: '2 sets', 4: '4 sets', 8: '8 sets' }, '4'),
        ways: choice(
          'Associativity',
          { 1: 'Direct mapped (1 way)', 2: '2 ways', 4: '4 ways' },
          '1',
        ),
      },
      metrics: {
        hits: ['Trace hits', ''],
        misses: ['Trace misses', ''],
        rate: ['Final hit rate', '%'],
      },
      plot: { x: 'Memory accesses', xUnit: '', y: 'Running hit rate', yUnit: '%', step: true },
      text: [
        'Split addresses into block, set and tag, and follow deterministic least-recently-used replacement.',
        'Can greater associativity reduce conflict misses for the same set count?',
        ['Yes', 'Never', 'Only if addresses are negative'],
        'More ways let blocks with the same set index coexist, though cache capacity also grows here.',
        'For 16-byte blocks, 4 sets, 1 way and trace [0,16,0,64,0,16], there are 2 hits and 4 misses. With 2 ways there are 3 hits and 3 misses.',
        'block=floor(address/B); set=block mod S; tag=floor(block/S). A hit requires a matching valid tag; a full set evicts its least recently accessed way.',
        'Cold-start cache, byte addresses, read-only references and deterministic LRU. Changing associativity with fixed set count changes capacity. No dirty/write policies, multilevel cache, timing or prefetching.',
      ],
    },
    ({ addresses, block, sets, ways }) => {
      const b = Number(block),
        s = Number(sets),
        w = Number(ways),
        cache = Array.from({ length: s }, () =>
          Array.from({ length: w }, () => ({ tag: null, used: -1 })),
        ),
        rows = [],
        frames = [],
        series = [];
      let hits = 0;
      parseList(addresses).forEach((address, i) => {
        const memoryBlock = Math.floor(address / b),
          set = memoryBlock % s,
          tag = Math.floor(memoryBlock / s);
        let way = cache[set].findIndex((line) => line.tag === tag),
          hit = way >= 0,
          evicted = null;
        if (hit) hits++;
        else {
          way = cache[set].findIndex((line) => line.tag === null);
          if (way < 0) {
            way = cache[set].reduce(
              (best, line, j) => (line.used < cache[set][best].used ? j : best),
              0,
            );
            evicted = cache[set][way].tag;
          }
        }
        cache[set][way] = { tag, used: i };
        rows.push([i + 1, address, memoryBlock, set, tag, hit ? 'hit' : 'miss', evicted ?? '—']);
        frames.push({
          cycle: i + 1,
          address,
          memoryBlock,
          set,
          way,
          tag,
          hit,
          evicted,
          cache: structuredClone(cache),
        });
        series.push({ x: i + 1, y: (100 * hits) / (i + 1) });
      });
      return {
        summary: { hits, misses: frames.length - hits, rate: (100 * hits) / frames.length },
        series,
        visualization: { type: 'cache', frames, sets: s, ways: w, block: b },
        table: {
          ...table(
            'Address decomposition and LRU decisions',
            ['Access', 'Address', 'Block', 'Set', 'Tag', 'Result', 'Evicted tag'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
};

digitalModels.cache.definition.presets = { 'Two-way conflict comparison': { ways: '2' } };
digitalModels.flipflop.definition.presets = {
  'T toggles on every edge': { kind: 'T', data: '1,1,1,1,1,1,1,1' },
  'JK toggle mode': { kind: 'JK', data: '1,1,1,1,1,1,1,1', secondary: '1,1,1,1,1,1,1,1' },
};
digitalModels.counter.definition.presets = {
  'Down-count with immediate wrap': { direction: 'down', initial: 0 },
};

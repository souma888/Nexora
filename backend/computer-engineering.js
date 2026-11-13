import { content } from './content/computer-engineering.js';
import { lab, integer, choice, list, parseList, table } from './lab-kit.js';
const binary = (value, width) =>
  (((value % 2 ** width) + 2 ** width) % 2 ** width).toString(2).padStart(width, '0');
const signed = (value, width) => (value >= 2 ** (width - 1) ? value - 2 ** width : value);
const wordCheck =
  (fields, signedValues = false) =>
  (values) => {
    const limit = 2 ** values.width;
    const key = fields.find((key) =>
      signedValues
        ? values[key] < -limit / 2 || values[key] >= limit / 2
        : values[key] < 0 || values[key] >= limit,
    );
    if (key)
      return {
        key,
        message: `Operands must fit the selected ${signedValues ? 'signed' : 'unsigned'} word width.`,
      };
  };
const wordPlot = {
  x: 'Bit index (LSB is zero)',
  xUnit: '',
  y: 'Bit value',
  yUnit: '',
  step: true,
  traces: { y: 'Result', reference: 'Operand A', other: 'Operand B' },
};
const bitsSeries = (rows, width) =>
  Array.from({ length: width }, (_, i) => ({
    x: i,
    y: (rows[0] >> i) & 1,
    reference: (rows[1] >> i) & 1,
    other: (rows[2] >> i) & 1,
  }));
export const computerModels = {
  alu: lab(
    {
      id: 'alu',
      title: 'Fixed-Width ALU & Flags',
      discipline: 'digital',
      lab: 'CEG01',
      topic: 'Computer arithmetic',
      inputs: {
        width: integer('Word width', 4, 8, 4),
        a: integer('Operand A (unsigned)', 0, 255, 7),
        b: integer('Operand B (unsigned; ignored for shifts)', 0, 255, 3),
        operation: choice(
          'ALU operation',
          {
            ADD: 'Add',
            SUB: 'Subtract',
            AND: 'Bitwise AND',
            OR: 'Bitwise OR',
            XOR: 'Bitwise XOR',
            LSL: 'Logical left shift by one',
            LSR: 'Logical right shift by one',
          },
          'ADD',
        ),
      },
      validateValues: wordCheck(['a', 'b']),
      metrics: {
        result: ['Unsigned result', ''],
        signed: ['Signed interpretation', ''],
        carry: ['Carry / no-borrow flag', 'bit'],
        overflow: ['Signed overflow flag', 'bit'],
      },
      plot: wordPlot,
      text: content['alu'],
    },
    ({ width, a, b, operation }) => {
      const modulus = 2 ** width,
        mask = modulus - 1,
        sa = signed(a, width),
        sb = signed(b, width);
      let result,
        carry = 0,
        overflow = 0;
      if (operation === 'ADD') {
        const exact = a + b,
          resultSigned = sa + sb;
        result = exact & mask;
        carry = Number(exact >= modulus);
        overflow = Number(resultSigned < -modulus / 2 || resultSigned >= modulus / 2);
      } else if (operation === 'SUB') {
        result = (a - b + modulus) & mask;
        carry = Number(a >= b);
        const exact = sa - sb;
        overflow = Number(exact < -modulus / 2 || exact >= modulus / 2);
      } else if (operation === 'LSL') {
        carry = (a >> (width - 1)) & 1;
        result = (a << 1) & mask;
      } else if (operation === 'LSR') {
        carry = a & 1;
        result = a >>> 1;
      } else result = { AND: a & b, OR: a | b, XOR: a ^ b }[operation];
      const flags = {
        N: (result >> (width - 1)) & 1,
        Z: Number(result === 0),
        C: carry,
        V: overflow,
      };
      return {
        summary: { result, signed: signed(result, width), carry, overflow },
        series: bitsSeries([result, a, b], width),
        visualization: {
          type: 'word',
          rows: [
            ['A', binary(a, width)],
            ['B', binary(b, width)],
            ['Result', binary(result, width)],
          ],
          detail: `${operation} · N${flags.N} Z${flags.Z} C${flags.C} V${flags.V}`,
        },
        table: table(
          'Arithmetic interpretations and flags',
          ['Quantity', 'Unsigned / flag', 'Signed / explanation'],
          [
            ['A', a, sa],
            ['B', b, sb],
            ['Result', result, signed(result, width)],
            ...Object.entries(flags).map(([key, value]) => [
              key,
              value,
              {
                N: 'Most significant result bit',
                Z: 'Result is zero',
                C: 'Carry out or no borrow; shifted-out bit for shifts',
                V: 'Signed overflow',
              }[key],
            ]),
          ],
        ),
      };
    },
  ),
  twos: lab(
    {
      id: 'twos',
      title: 'Two’s Complement & Negation',
      discipline: 'digital',
      lab: 'CEG02',
      topic: 'Number representation',
      inputs: {
        width: integer('Word width', 4, 8, 8),
        value: integer('Signed input value', -128, 127, -5),
      },
      validateValues: wordCheck(['value'], true),
      metrics: {
        encoded: ['Unsigned encoding', ''],
        negated: ['Signed negation after wrap', ''],
        overflow: ['Negation overflow', 'bit'],
      },
      plot: {
        ...wordPlot,
        traces: { y: 'Original encoding', reference: 'Inverted bits', other: 'Negated encoding' },
      },
      text: content['twos'],
    },
    ({ width, value }) => {
      const modulus = 2 ** width,
        encoded = (value + modulus) % modulus,
        inverted = (modulus - 1) ^ encoded,
        negation = (inverted + 1) % modulus,
        overflow = Number(value === -modulus / 2);
      return {
        summary: { encoded, negated: signed(negation, width), overflow },
        series: bitsSeries([encoded, inverted, negation], width),
        visualization: {
          type: 'word',
          rows: [
            ['Input', binary(encoded, width)],
            ['Invert', binary(inverted, width)],
            ['Add 1', binary(negation, width)],
          ],
          detail: overflow
            ? 'Minimum-value overflow: negation wraps to the same signed value'
            : `${value} → ${signed(negation, width)}`,
        },
        warnings: overflow
          ? [
              'The mathematical positive counterpart does not fit this signed word. The result is modular wraparound, not saturation.',
            ]
          : [],
        table: table(
          'Representation stages',
          ['Stage', 'Word', 'Unsigned value', 'Signed interpretation'],
          [
            ['Input', binary(encoded, width), encoded, value],
            ['Inverted', binary(inverted, width), inverted, signed(inverted, width)],
            ['Plus one', binary(negation, width), negation, signed(negation, width)],
          ],
        ),
      };
    },
  ),
  booth: lab(
    {
      id: 'booth',
      title: 'Booth Signed Multiplication',
      discipline: 'digital',
      lab: 'CEG03',
      topic: 'Arithmetic hardware',
      initialProbe: 'start',
      stepAction: 'Next microstep',
      inputs: {
        width: integer('Operand width', 4, 8, 4),
        a: integer('Signed multiplicand M', -128, 127, -3),
        b: integer('Signed multiplier Q', -128, 127, 5),
      },
      validateValues: wordCheck(['a', 'b'], true),
      metrics: {
        product: ['Signed product', ''],
        cycles: ['Booth cycles', ''],
        bits: ['Product word width', 'bits'],
      },
      plot: {
        x: 'Microstep',
        xUnit: '',
        y: 'Register value',
        yUnit: '',
        traces: { y: 'Signed accumulator A', reference: 'Unsigned Q word' },
        step: true,
      },
      text: content['booth'],
    },
    (input) => multiply(input),
  ),
  division: lab(
    {
      id: 'division',
      title: 'Restoring Binary Division',
      discipline: 'digital',
      lab: 'CEG04',
      topic: 'Arithmetic hardware',
      initialProbe: 'start',
      stepAction: 'Next microstep',
      inputs: {
        width: integer('Operand width', 4, 8, 4),
        dividend: integer('Unsigned dividend', 0, 255, 13),
        divisor: integer('Nonzero unsigned divisor', 1, 255, 3),
      },
      validateValues: wordCheck(['dividend', 'divisor']),
      metrics: {
        quotient: ['Quotient', ''],
        remainder: ['Remainder', ''],
        cycles: ['Division cycles', ''],
      },
      plot: {
        x: 'Microstep',
        xUnit: '',
        y: 'Register value',
        yUnit: '',
        traces: { y: 'Partial / trial remainder A', reference: 'Quotient register Q' },
        step: true,
      },
      text: content['division'],
    },
    (input) => divide(input),
  ),
  hamming: lab(
    {
      id: 'hamming',
      title: 'Hamming (7,4) Error Correction',
      discipline: 'digital',
      lab: 'CEG05',
      topic: 'Error-control codes',
      inputs: {
        data: integer('Four-bit data value', 0, 15, 10),
        error: integer('Flipped code position (0 means none)', 0, 7, 5),
      },
      metrics: {
        encoded: ['Transmitted codeword as integer', ''],
        syndrome: ['Syndrome / error position', ''],
        recovered: ['Recovered data value', ''],
      },
      plot: {
        x: 'Code position (one-based)',
        xUnit: '',
        y: 'Bit value',
        yUnit: '',
        traces: { y: 'Received', reference: 'Encoded', other: 'Corrected' },
        step: true,
      },
      text: content['hamming'],
    },
    ({ data, error }) => {
      const code = Array(8).fill(0),
        positions = [3, 5, 6, 7];
      positions.forEach((p, i) => (code[p] = (data >> (3 - i)) & 1));
      for (const parity of [1, 2, 4])
        code[parity] = positions.filter((p) => p & parity).reduce((v, p) => v ^ code[p], 0);
      const received = [...code];
      if (error) received[error] ^= 1;
      let syndrome = 0;
      const checks = [];
      for (const parity of [1, 2, 4]) {
        const covered = Array.from({ length: 7 }, (_, i) => i + 1).filter((p) => p & parity),
          value = covered.reduce((v, p) => v ^ received[p], 0);
        syndrome += value * parity;
        checks.push([`P${parity}`, covered.join(', '), value]);
      }
      const corrected = [...received];
      if (syndrome) corrected[syndrome] ^= 1;
      const recovered = positions.reduce((v, p) => (v << 1) | corrected[p], 0),
        word = (a) => a.slice(1).join('');
      return {
        summary: { encoded: parseInt(word(code), 2), syndrome, recovered },
        series: code
          .slice(1)
          .map((v, i) => ({ x: i + 1, y: received[i + 1], reference: v, other: corrected[i + 1] })),
        visualization: {
          type: 'word',
          rows: [
            ['Encoded', word(code)],
            ['Received', word(received)],
            ['Corrected', word(corrected)],
          ],
          active: error ? [error - 1] : [],
          detail: `Positions 1…7 · syndrome ${syndrome} · ${syndrome ? 'flip that position' : 'no correction'}`,
        },
        table: table(
          'Even-parity syndrome checks',
          ['Check', 'Covered positions', 'Mismatch bit'],
          checks,
        ),
      };
    },
  ),
  crc: lab(
    {
      id: 'crc',
      title: 'CRC Polynomial Division',
      discipline: 'digital',
      lab: 'CEG06',
      topic: 'Error detection',
      initialProbe: 'start',
      stepAction: 'Next XOR step',
      inputs: {
        message: list('Message bits', '1,1,0,1,0,1,1,0', 0, 1, 16),
        generator: choice(
          'Generator polynomial',
          { 1011: '1011: x³+x+1', 1101: '1101: x³+x²+1', 10011: '10011: x⁴+x+1' },
          '1011',
        ),
        error: integer('Flipped transmitted position (0 means none)', 0, 20, 0),
      },
      validateValues(values) {
        if (values.error > values.message.split(',').length + values.generator.length - 1)
          return {
            key: 'error',
            message: 'The flipped position must fit the message plus CRC word.',
          };
      },
      metrics: {
        remainder: ['Encoder remainder as integer', ''],
        syndrome: ['Receiver remainder as integer', ''],
        detected: ['Nonzero receiver syndrome', 'bit'],
      },
      plot: {
        x: 'XOR inspection step',
        xUnit: '',
        y: 'Work-register low bits as integer',
        yUnit: '',
        step: true,
      },
      text: content['crc'],
    },
    (input) => crcTrace(input),
  ),
  shiftregister: lab(
    {
      id: 'shiftregister',
      title: 'Serial Shift Register',
      discipline: 'digital',
      lab: 'CEG07',
      topic: 'Sequential datapaths',
      initialProbe: 'start',
      stepAction: 'Next clock edge',
      inputs: {
        width: integer('Register width', 4, 8, 4),
        initial: integer('Initial register value', 0, 255, 0),
        sequence: list('Serial input bits', '1,0,1,1,0,0', 0, 1, 16),
        direction: choice(
          'Shift direction',
          { left: 'Left: new bit enters LSB', right: 'Right: new bit enters MSB' },
          'left',
        ),
      },
      validateValues: wordCheck(['initial']),
      metrics: {
        final: ['Final unsigned register', ''],
        outgoing: ['Ones shifted out', ''],
        clocks: ['Clock edges', ''],
      },
      plot: {
        x: 'Positive clock edge',
        xUnit: '',
        y: 'Unsigned register value',
        yUnit: '',
        step: true,
      },
      text: content['shiftregister'],
    },
    ({ width, initial, sequence, direction }) => {
      const frames = [],
        rows = [],
        series = [],
        mask = 2 ** width - 1;
      let q = initial,
        outgoing = 0;
      const emit = (cycle, input, out) => {
        frames.push({
          rows: [['Register', binary(q, width)]],
          detail: `Clock ${cycle} · in ${input ?? '—'} · shifted out ${out ?? '—'}`,
        });
        rows.push([cycle, input ?? '—', out ?? '—', q, binary(q, width)]);
        series.push({ x: cycle, y: q });
      };
      emit(0, null, null);
      parseList(sequence).forEach((bit, i) => {
        const out = direction === 'left' ? (q >> (width - 1)) & 1 : q & 1;
        outgoing += out;
        q = direction === 'left' ? ((q << 1) | bit) & mask : (q >>> 1) | (bit << (width - 1));
        emit(i + 1, bit, out);
      });
      return {
        summary: { final: q, outgoing, clocks: frames.length - 1 },
        series,
        visualization: { type: 'word', frames },
        table: {
          ...table(
            'Serial-in / serial-out states',
            ['Edge', 'Input', 'Shifted out', 'Unsigned Q', 'Bit word'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
  roundrobin: lab(
    {
      id: 'roundrobin',
      title: 'Round-Robin CPU Scheduling',
      discipline: 'digital',
      lab: 'CEG08',
      topic: 'Operating systems',
      initialProbe: 'start',
      stepAction: 'Next dispatch event',
      inputs: {
        bursts: list('CPU bursts (P0, P1, …)', '5,3,1', 1, 20, 6),
        quantum: integer('Time quantum', 1, 6, 2),
        switchCost: integer('Process-switch overhead', 0, 2, 0),
      },
      metrics: {
        waiting: ['Mean waiting time', 'time units'],
        turnaround: ['Mean turnaround time', 'time units'],
        makespan: ['Total elapsed time', 'time units'],
      },
      plot: {
        x: 'Elapsed time',
        xUnit: 'time units',
        y: 'Total remaining CPU work',
        yUnit: 'time units',
        step: true,
      },
      text: content['roundrobin'],
    },
    (input) => schedule(input),
  ),
  paging: lab(
    {
      id: 'paging',
      title: 'Page Replacement: FIFO, LRU & Clock',
      discipline: 'digital',
      lab: 'CEG09',
      topic: 'Virtual memory',
      initialProbe: 'start',
      stepAction: 'Next inspection step',
      inputs: {
        pages: list('Page reference string', '1,2,3,1,4,1,2,5', 0, 15, 20),
        frames: integer('Physical frame count', 2, 5, 3),
        policy: choice(
          'Replacement policy',
          { FIFO: 'FIFO', LRU: 'Least recently used', CLOCK: 'Clock / second chance' },
          'CLOCK',
        ),
      },
      metrics: {
        faults: ['Page faults', ''],
        hits: ['Page hits', ''],
        evictions: ['Evictions', ''],
        rate: ['Page hit rate', '%'],
      },
      plot: { x: 'Inspection step', xUnit: '', y: 'Cumulative page faults', yUnit: '', step: true },
      text: content['paging'],
    },
    (input) => pageTrace(input),
  ),
  branch: lab(
    {
      id: 'branch',
      title: 'One-Bit & Two-Bit Branch Prediction',
      discipline: 'digital',
      lab: 'CEG10',
      topic: 'Processor control',
      initialProbe: 'start',
      stepAction: 'Next branch outcome',
      inputs: {
        outcomes: list('Branch outcomes (1 taken, 0 not taken)', '1,1,1,1,0,1,1,1,1,0', 0, 1, 24),
        predictor: choice(
          'Predictor',
          { one: 'One-bit last-outcome', two: 'Two-bit saturating counter' },
          'two',
        ),
        initial: integer('Initial predictor state', 0, 3, 1),
      },
      validateValues(values) {
        if (values.predictor === 'one' && values.initial > 1)
          return { key: 'initial', message: 'A one-bit predictor state must be 0 or 1.' };
      },
      metrics: {
        accuracy: ['Prediction accuracy', '%'],
        misses: ['Mispredictions', ''],
        state: ['Final predictor state', ''],
      },
      plot: {
        x: 'Resolved branch count',
        xUnit: '',
        y: 'Bit value',
        yUnit: '',
        traces: {
          y: 'Prediction correct (after resolution)',
          reference: 'Prediction',
          other: 'Actual outcome',
        },
        step: true,
      },
      text: content['branch'],
    },
    ({ outcomes, predictor, initial }) => {
      let state = initial,
        misses = 0;
      const bits = parseList(outcomes),
        frames = [{ cycle: 0, before: state, state, outcome: null, prediction: null }],
        rows = [[0, state, '—', '—', '—', state]],
        series = [{ x: 0, y: 0, reference: 0, other: 0 }];
      bits.forEach((outcome, i) => {
        const before = state,
          prediction = predictor === 'one' ? state : Number(state >= 2),
          correct = prediction === outcome;
        if (!correct) misses++;
        state =
          predictor === 'one' ? outcome : Math.min(3, Math.max(0, state + (outcome ? 1 : -1)));
        frames.push({ cycle: i + 1, before, state, outcome, prediction, correct });
        rows.push([i + 1, before, prediction, outcome, correct ? 'correct' : 'miss', state]);
        series.push({ x: i + 1, y: Number(correct), reference: prediction, other: outcome });
      });
      return {
        summary: { accuracy: (100 * (bits.length - misses)) / bits.length, misses, state },
        series,
        visualization: { type: 'predictor', frames, predictor },
        table: {
          ...table(
            'Predict, resolve, then update',
            ['Branch', 'State before', 'Predicted', 'Actual', 'Result', 'State after'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
};

function multiply({ width, a, b }) {
  const mask = 2 ** width - 1,
    frames = [],
    rows = [],
    series = [];
  let accumulator = 0,
    q = b & mask,
    previous = 0;
  const emit = (cycle, action) => {
    frames.push({
      rows: [
        ['A', binary(accumulator, width + 1)],
        ['Q', binary(q, width)],
        ['Q−1', String(previous)],
      ],
      detail: `Cycle ${cycle} · ${action}`,
    });
    rows.push([
      rows.length,
      cycle,
      binary(accumulator, width + 1),
      accumulator,
      binary(q, width),
      previous,
      action,
    ]);
    series.push({ x: series.length, y: accumulator, reference: q });
  };
  emit(0, 'Initial registers');
  for (let cycle = 1; cycle <= width; cycle++) {
    const pair = 2 * (q & 1) + previous;
    if (pair === 1) accumulator += a;
    else if (pair === 2) accumulator -= a;
    emit(cycle, pair === 1 ? '01: add M' : pair === 2 ? '10: subtract M' : '00/11: no add');
    const nextPrevious = q & 1;
    q = ((accumulator & 1) << (width - 1)) | (q >>> 1);
    accumulator = Math.floor(accumulator / 2);
    previous = nextPrevious;
    emit(cycle, 'Arithmetic right shift');
  }
  const product = accumulator * 2 ** width + q;
  return {
    summary: { product, cycles: width, bits: 2 * width },
    series,
    visualization: { type: 'word', frames },
    table: {
      ...table(
        'Booth register microsteps',
        ['Step', 'Cycle', 'A bits', 'Signed A', 'Q bits', 'Q−1', 'Action'],
        rows,
      ),
      followProbe: true,
    },
  };
}
function divide({ width, dividend, divisor }) {
  const mask = 2 ** width - 1,
    frames = [],
    rows = [],
    series = [];
  let a = 0,
    q = dividend;
  const emit = (cycle, action) => {
    frames.push({
      rows: [
        ['A', binary(a, width + 1)],
        ['Q', binary(q, width)],
        ['M', binary(divisor, width + 1)],
      ],
      detail: `Cycle ${cycle} · ${action}`,
    });
    rows.push([rows.length, cycle, a, binary(a, width + 1), q, binary(q, width), action]);
    series.push({ x: series.length, y: a, reference: q });
  };
  emit(0, 'Initial registers');
  for (let cycle = 1; cycle <= width; cycle++) {
    a = 2 * a + ((q >> (width - 1)) & 1);
    q = (q << 1) & mask;
    emit(cycle, 'Shift A,Q left');
    a -= divisor;
    emit(cycle, 'Trial subtraction A−M');
    if (a < 0) {
      a += divisor;
      emit(cycle, 'Negative: restore A and append quotient bit 0');
    } else {
      q |= 1;
      emit(cycle, 'Nonnegative: keep A and append quotient bit 1');
    }
  }
  return {
    summary: { quotient: q, remainder: a, cycles: width },
    series,
    visualization: { type: 'word', frames },
    table: {
      ...table(
        'Restoring-division microsteps',
        ['Step', 'Cycle', 'A value', 'A bits', 'Q value', 'Q bits', 'Action'],
        rows,
      ),
      followProbe: true,
    },
  };
}
function crcTrace({ message, generator, error }) {
  const input = parseList(message),
    poly = [...generator].map(Number),
    degree = poly.length - 1,
    frames = [],
    rows = [],
    series = [];
  const emit = (stage, bits, offset, action) => {
    frames.push({
      rows: [
        [stage, bits.join(''), 0],
        ['Generator', generator, offset],
      ],
      active: Array.from({ length: poly.length }, (_, i) => offset + i),
      detail: action,
    });
    rows.push([rows.length, stage, offset, bits.join(''), action]);
    series.push({ x: series.length, y: parseInt(bits.slice(-degree).join(''), 2) });
  };
  const divideBits = (original, stage) => {
    const bits = [...original];
    emit(stage, bits, 0, 'Start modulo-2 division');
    for (let i = 0; i <= bits.length - poly.length; i++)
      if (bits[i]) {
        for (let j = 0; j < poly.length; j++) bits[i + j] ^= poly[j];
        emit(stage, bits, i, `XOR generator at offset ${i}`);
      }
    return bits.slice(-degree);
  };
  const remainder = divideBits([...input, ...Array(degree).fill(0)], 'Encoder'),
    codeword = [...input, ...remainder],
    received = [...codeword];
  if (error) received[error - 1] ^= 1;
  const syndrome = divideBits(received, 'Receiver');
  emit('Receiver', received, 0, `Received word; syndrome ${syndrome.join('')}`);
  return {
    summary: {
      remainder: parseInt(remainder.join(''), 2),
      syndrome: parseInt(syndrome.join(''), 2),
      detected: Number(syndrome.some(Boolean)),
    },
    series,
    visualization: { type: 'word', frames },
    table: {
      ...table(
        'Modulo-2 long division; polynomial aligned at each offset',
        ['Step', 'Stage', 'Offset', 'Working bits', 'Action'],
        rows,
      ),
      followProbe: true,
    },
    codeword,
    received,
    remainder,
    syndrome,
  };
}
function schedule({ bursts, quantum, switchCost }) {
  const work = parseList(bursts),
    remaining = [...work],
    completion = Array(work.length).fill(null),
    ready = work.map((_, i) => i),
    frames = [],
    rows = [],
    series = [],
    timeline = [];
  let time = 0,
    last = null;
  const emit = (current, action, start = time) => {
    frames.push({
      time,
      current,
      ready: [...ready],
      remaining: [...remaining],
      timeline: structuredClone(timeline),
      detail: action,
    });
    rows.push([
      rows.length,
      start,
      time,
      current === null ? '—' : `P${current}`,
      action,
      remaining.join(', '),
    ]);
    series.push({ x: time, y: remaining.reduce((s, v) => s + v, 0) });
  };
  emit(null, 'Initial ready queue');
  while (ready.length) {
    const current = ready.shift();
    if (last !== null && last !== current && switchCost) {
      const start = time;
      time += switchCost;
      timeline.push({ start, end: time, label: 'CS' });
      emit(current, 'Process-switch overhead', start);
    }
    const start = time,
      run = Math.min(quantum, remaining[current]);
    time += run;
    remaining[current] -= run;
    timeline.push({ start, end: time, label: `P${current}` });
    if (remaining[current]) ready.push(current);
    else completion[current] = time;
    emit(current, remaining[current] ? 'Quantum expired; requeue' : 'Process completed', start);
    last = current;
  }
  return {
    summary: {
      waiting: completion.reduce((s, c, i) => s + c - work[i], 0) / work.length,
      turnaround: completion.reduce((s, c) => s + c, 0) / work.length,
      makespan: time,
    },
    series,
    completion,
    timeline,
    visualization: { type: 'cpu', frames, total: time },
    table: {
      ...table(
        'Dispatch events; all arrivals are at time zero',
        ['Step', 'Start', 'End', 'Process', 'Event', 'Remaining bursts'],
        rows,
      ),
      followProbe: true,
    },
  };
}
function pageTrace({ pages, frames: count, policy }) {
  const references = parseList(pages),
    slots = Array(count).fill(null),
    used = Array(count).fill(-1),
    reference = Array(count).fill(0),
    frames = [],
    rows = [],
    series = [];
  let hand = 0,
    fifo = 0,
    faults = 0,
    hits = 0,
    evictions = 0;
  const emit = (position, page, action, slot = -1) => {
    frames.push({
      slots: [...slots],
      reference: [...reference],
      hand,
      slot,
      page,
      position,
      policy,
      detail: action,
    });
    rows.push([rows.length, position, page, action, slots.map((v) => v ?? '—').join(', ')]);
    series.push({ x: series.length, y: faults });
  };
  emit(0, null, 'Empty physical frames');
  references.forEach((page, i) => {
    let at = slots.indexOf(page);
    if (at >= 0) {
      hits++;
      used[at] = i;
      reference[at] = 1;
      emit(i + 1, page, 'Hit: preserve the page and update recency/reference bit', at);
      return;
    }
    faults++;
    at = slots.indexOf(null);
    if (at < 0) {
      evictions++;
      if (policy === 'FIFO') at = fifo;
      else if (policy === 'LRU') at = used.reduce((best, t, j) => (t < used[best] ? j : best), 0);
      else {
        while (reference[hand]) {
          reference[hand] = 0;
          emit(i + 1, page, `Second chance: clear reference bit at frame ${hand}`, hand);
          hand = (hand + 1) % count;
        }
        at = hand;
      }
    }
    if (policy === 'CLOCK') hand = (at + 1) % count;
    if (policy === 'FIFO') fifo = (at + 1) % count;
    slots[at] = page;
    used[at] = i;
    reference[at] = 1;
    emit(i + 1, page, 'Page fault: load into selected physical frame', at);
  });
  return {
    summary: { faults, hits, evictions, rate: (100 * hits) / references.length },
    series,
    slots,
    visualization: { type: 'pages', frames },
    table: {
      ...table(
        'Replacement decisions; Clock scans are not new references',
        ['Step', 'Reference', 'Page', 'Action', 'Frame contents'],
        rows,
      ),
      followProbe: true,
    },
  };
}
computerModels.twos.definition.presets = { 'Minimum-value overflow': { value: -128, width: 8 } };
computerModels.booth.definition.presets = { 'Minimum operands': { width: 4, a: -8, b: -8 } };
computerModels.hamming.definition.presets = { 'Clean channel': { error: 0 } };
computerModels.crc.definition.presets = { 'Single-bit corruption': { error: 3 } };
computerModels.roundrobin.definition.presets = {
  'Switching overhead': { switchCost: 1 },
  'One process': { bursts: '5' },
};
computerModels.paging.definition.presets = {
  'FIFO comparison': { policy: 'FIFO' },
  'LRU comparison': { policy: 'LRU' },
};
computerModels.branch.definition.presets = {
  'One-bit comparison': { predictor: 'one', initial: 1 },
  'Alternating outcomes': { outcomes: '1,0,1,0,1,0,1,0' },
};

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
      text: [
        'Execute a bounded ALU word and distinguish unsigned carry from signed overflow.',
        'Can signed overflow occur without an unsigned carry?',
        ['Yes', 'No', 'Only for logical operations'],
        'Two positive signed operands can overflow the signed range while their unsigned total still fits.',
        'In four bits, 7+3 produces 1010: unsigned 10, signed −6, carry 0, overflow 1.',
        'Results are modulo 2^w. ADD carry is the discarded high bit; SUB carry means no borrow. Signed overflow tests the exact signed sum/difference against [−2^(w−1),2^(w−1)−1].',
        'Ideal combinational ALU, widths 4–8. Logical operations clear C/V; shifts set C to the shifted-out bit and clear V. Zero/negative flags appear in the state table. No timing or ISA encoding is modeled.',
      ],
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
      text: [
        'Encode a signed integer, invert its bits, add one, and identify the asymmetric minimum-value case.',
        'Can the most negative signed value be negated in the same width?',
        [
          'No, its positive counterpart is out of range',
          'Yes, always',
          'Only when the word has an even number of bits',
        ],
        'The negative range includes −2^(w−1), but the positive range ends at 2^(w−1)−1.',
        'At eight bits, −5 is 11111011. Invert to 00000100 and add one to obtain +5 as 00000101.',
        'An integer x is encoded as x mod 2^w. Negation is (~encoded+1) mod 2^w. Decode a word ≥2^(w−1) by subtracting 2^w.',
        'Integer two’s-complement representation only. No floating point, saturation or physical carry propagation. The minimum signed input wraps to itself and is explicitly flagged.',
      ],
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
      text: [
        'Inspect add/subtract decisions and arithmetic right shifts for signed multiplication.',
        'What does pair Q0,Q−1=10 request?',
        ['Subtract the multiplicand', 'Add the multiplicand', 'Skip the shift'],
        'Booth recodes a transition into the start of a run of ones as a subtraction.',
        'Four-bit operands −3 and 5 produce −15 after four Booth cycles.',
        'Inspect (Q0,Q−1): 01 → A+=M; 10 → A−=M; 00/11 → no add. Then arithmetic-shift the combined A,Q,Q−1 right. Repeat w times.',
        'The accumulator uses w+1 bits so the minimum negative operand is handled correctly. Q has w bits, and the final signed product is reported in 2w bits. Microsteps are conceptual, without gate delays.',
      ],
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
      text: [
        'Shift the partial remainder, try a subtraction, and restore when the trial goes negative.',
        'When the trial remainder is negative, what quotient bit is appended?',
        ['0', '1', 'The divisor’s sign bit'],
        'A failed subtraction is restored, meaning the divisor did not fit at that position.',
        'Unsigned 13 divided by 3 yields quotient 4 and remainder 1; 13=4×3+1.',
        'Shift A,Q left; trial=A−M. If trial≥0, keep it and set Q0=1; otherwise restore A and keep Q0=0. Repeat w times.',
        'Unsigned integer division only, divisor nonzero. A wide trial accumulator avoids arithmetic truncation. Negative trial states are displayed in two’s complement; completed remainders are nonnegative.',
      ],
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
      text: [
        'Place parity bits, inject one channel error, and use the syndrome to correct its position.',
        'What does a zero syndrome prove in this single-error teaching model?',
        [
          'No injected single-bit error remains',
          'No possible multi-bit error exists',
          'Every bit must be zero',
        ],
        'A Hamming (7,4) syndrome locates one flipped bit but is not a guarantee against arbitrary multi-bit corruption.',
        'Data bits occupy positions 3,5,6,7; parity bits occupy 1,2,4. Injecting an error at position 5 gives syndrome 5 and recovers the original data.',
        'Use even parity over positions selected by each binary position bit. Syndrome = s1+2s2+4s4; flip that position if nonzero.',
        'Single-error correction without an extra overall parity bit. This is not SECDED: two-bit errors may be miscorrected. Position 1 is displayed at the left, and data is mapped most-significant bit first.',
      ],
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
      text: [
        'Append zero bits, perform modulo-2 long division, and verify a transmitted codeword.',
        'Does modulo-2 subtraction need borrowing?',
        ['No, it is XOR', 'Yes, exactly as decimal subtraction', 'Only for odd polynomials'],
        'Arithmetic is over GF(2), where addition and subtraction are both XOR.',
        'For generator 1011, append three zeros to the message. The remainder becomes the CRC suffix; dividing the intact codeword gives zero.',
        'If G has degree r, divide M(x)x^r by G(x); send M followed by the r-bit remainder. The receiver divides the whole received word without appending more zeros.',
        'Teaching CRCs with explicit polynomials, no reflection, initial seed, final XOR or byte framing. These are not named industrial CRC profiles. Only one optional channel bit is flipped; this lab detects errors but does not correct them.',
      ],
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
      text: [
        'Move a serial stream through a bounded register and observe the outgoing bit at each edge.',
        'Where does a new bit enter during a left shift?',
        ['The least significant bit', 'The most significant bit', 'Both ends'],
        'Left shift moves existing bits toward higher positions and makes the low bit available for input.',
        'A four-bit left-shifting register starting at zero and receiving 1,0,1,1,0,0 finishes as 1100 (12).',
        'Left: Qnext=((Q<<1)|input) mod 2^w, out=old MSB. Right: Qnext=(Q>>1)|(input<<(w−1)), out=old LSB.',
        'Ideal edge-triggered register with a zero-delay serial input. Output bits are the values shifted out before the update, not the new end bits.',
      ],
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
      text: [
        'Rotate runnable processes, account for switch overhead, and inspect completion and waiting times.',
        'Does reducing the quantum always improve total completion time?',
        [
          'No, switching overhead can increase',
          'Yes, without exception',
          'Only when all bursts match',
        ],
        'More frequent process switches can consume a greater fraction of the CPU time.',
        'Bursts [5,3,1], quantum 2 and zero overhead complete at times [9,8,5]; mean waiting time is 13/3.',
        'Run min(quantum,remaining) from the FIFO ready queue. An unfinished process joins the rear. With all arrivals at zero, turnaround=completion and waiting=completion−burst.',
        'All processes arrive at time zero, have one CPU burst and never block. Switch cost applies only between different process IDs; initial dispatch and immediately continuing the sole remaining process have no extra cost.',
      ],
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
      text: [
        'Compare replacement decisions and inspect Clock reference-bit clearing before eviction.',
        'In Clock, what happens to a referenced page during a scan?',
        [
          'Its reference bit is cleared and it gets a second chance',
          'It is immediately evicted',
          'Its page number is incremented',
        ],
        'The hand clears a set reference bit and continues until it finds an unreferenced candidate.',
        'Use the same reference string and frame count for each policy. Hits do not add a page fault; Clock may show several inspection steps for one reference.',
        'FIFO evicts the oldest admitted page; LRU evicts the least recently accessed page; Clock uses a circular hand and one reference bit per frame.',
        'Initially empty physical frames, read-only references, no dirty/write-back costs or actual address translation. Clock microsteps are inspections, not additional memory references.',
      ],
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
      text: [
        'Predict before updating and observe how counter hysteresis responds to an isolated loop exit.',
        'How many opposite outcomes can move a strongly taken two-bit state to predict not taken?',
        ['Two', 'One', 'Four'],
        'State 3 first becomes weakly taken (2), which still predicts taken; the next opposite outcome reaches 1.',
        'Two-bit states 0/1 predict not taken and 2/3 predict taken. For the default TTTTNTTTTN stream from state 1, there are three mispredictions.',
        'Predict from the old state. One-bit stores the actual outcome. Two-bit increments toward 3 for taken and decrements toward 0 for not taken, saturating at the endpoints.',
        'One static branch with no address-index aliasing, speculative update, history register or pipeline penalty. Clock-zero is an initial state, not a scored prediction.',
      ],
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { computerModels } from '../backend/computer-engineering.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
const defaults = (id) =>
  Object.fromEntries(
    Object.entries(computerModels[id].definition.inputs).map(([key, f]) => [key, f.initial]),
  );
const solve = (id, input = {}) => computerModels[id].solve({ ...defaults(id), ...input });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('ALU four-bit add/subtract flags match exact unsigned and signed arithmetic exhaustively', () => {
  for (let a = 0; a < 16; a++)
    for (let b = 0; b < 16; b++)
      for (const operation of ['ADD', 'SUB']) {
        const r = solve('alu', { width: 4, a, b, operation }).summary,
          exact = operation === 'ADD' ? a + b : a - b,
          sa = a > 7 ? a - 16 : a,
          sb = b > 7 ? b - 16 : b,
          ss = operation === 'ADD' ? sa + sb : sa - sb;
        assert.equal(r.result, (exact + 16) % 16);
        assert.equal(r.carry, Number(operation === 'ADD' ? exact >= 16 : a >= b));
        assert.equal(r.overflow, Number(ss < -8 || ss > 7));
        assert.equal(r.signed, r.result > 7 ? r.result - 16 : r.result);
      }
  for (const [operation, result, carry] of [
    ['AND', 1, 0],
    ['OR', 13, 0],
    ['XOR', 12, 0],
    ['LSL', 2, 1],
    ['LSR', 4, 1],
  ])
    assert.deepEqual(
      Object.values(solve('alu', { a: 9, b: 5, operation }).summary).filter((_, i) => i !== 1),
      [result, carry, 0],
    );
});
test('two’s complement decodes every four-bit value and flags minimum negation overflow', () => {
  for (let value = -8; value < 8; value++) {
    const s = solve('twos', { width: 4, value }).summary;
    assert.equal(s.encoded, (value + 16) % 16);
    assert.equal(s.negated, value === -8 ? -8 : -value || 0);
    assert.equal(s.overflow, Number(value === -8));
  }
});
test('Booth multiplication matches exact products for all four-bit operands and eight-bit extremes', () => {
  for (let a = -8; a < 8; a++)
    for (let b = -8; b < 8; b++)
      assert.equal(solve('booth', { width: 4, a, b }).summary.product, a * b || 0);
  for (const [a, b] of [
    [-128, -128],
    [-128, 127],
    [127, 127],
    [-128, -1],
    [0, -128],
  ])
    assert.equal(solve('booth', { width: 8, a, b }).summary.product, a * b || 0);
  const r = solve('booth');
  assert.equal(r.visualization.frames.length, r.series.length);
  assert.equal(r.visualization.frames[0].rows[0][1], '00000');
});
test('restoring division obeys quotient/remainder identity over every unsigned four-bit pair', () => {
  for (let dividend = 0; dividend < 16; dividend++)
    for (let divisor = 1; divisor < 16; divisor++) {
      const s = solve('division', { width: 4, dividend, divisor }).summary;
      assert.equal(s.quotient, Math.floor(dividend / divisor));
      assert.equal(s.remainder, dividend % divisor);
    }
  assert.equal(solve('division', { width: 8, dividend: 255, divisor: 1 }).summary.quotient, 255);
});
test('Hamming (7,4) corrects each possible single-bit error for all sixteen data words', () => {
  for (let data = 0; data < 16; data++)
    for (let error = 0; error <= 7; error++) {
      const s = solve('hamming', { data, error }).summary;
      assert.equal(s.recovered, data);
      assert.equal(s.syndrome, error);
    }
  assert.equal(solve('hamming', { data: 10, error: 0 }).summary.encoded, 90);
});
test('CRC agrees with independent integer-polynomial division and detects every one-bit corruption', () => {
  const polynomialRemainder = (word, generator) => {
    let v = parseInt(word, 2),
      g = parseInt(generator, 2),
      degree = generator.length - 1;
    while (v && Math.floor(Math.log2(v)) >= degree)
      v ^= g * 2 ** (Math.floor(Math.log2(v)) - degree);
    return v;
  };
  for (const generator of ['1011', '1101', '10011'])
    for (const message of ['1', '0', '1,1,0,1,0,1,1,0', '0,0,1,0']) {
      const r = solve('crc', { message, generator, error: 0 }),
        bits = message.replaceAll(',', '');
      assert.equal(
        r.summary.remainder,
        polynomialRemainder(bits + '0'.repeat(generator.length - 1), generator),
      );
      assert.equal(r.summary.syndrome, 0);
      for (let error = 1; error <= r.codeword.length; error++)
        assert.equal(solve('crc', { message, generator, error }).summary.detected, 1);
      r.visualization.frames.forEach((f) =>
        assert.ok(f.rows[1][2] + generator.length <= f.rows[0][1].length),
      );
    }
});
test('left/right serial shifts agree with a bit-string queue, including outgoing bits', () => {
  for (const direction of ['left', 'right'])
    for (const initial of [0, 5, 15]) {
      const bits = [1, 0, 1, 1, 0, 0];
      let word = initial.toString(2).padStart(4, '0').split(''),
        out = 0;
      for (const b of bits) {
        if (direction === 'left') {
          out += Number(word.shift());
          word.push(String(b));
        } else {
          out += Number(word.pop());
          word.unshift(String(b));
        }
      }
      const s = solve('shiftregister', { direction, initial }).summary;
      assert.equal(s.final, parseInt(word.join(''), 2));
      assert.equal(s.outgoing, out);
      assert.equal(s.clocks, bits.length);
    }
});
test('round robin produces known completion times and accounts for work and actual switches', () => {
  const r = solve('roundrobin');
  assert.deepEqual(r.completion, [9, 8, 5]);
  near(r.summary.waiting, 13 / 3);
  near(r.summary.turnaround, 22 / 3);
  const overhead = solve('roundrobin', { switchCost: 1 });
  assert.equal(overhead.timeline.filter((t) => t.label === 'CS').length, 5);
  assert.equal(overhead.summary.makespan, 14);
  const single = solve('roundrobin', { bursts: '5', switchCost: 2 });
  assert.equal(single.summary.makespan, 5);
  assert.equal(single.summary.waiting, 0);
  for (const s of [r, overhead])
    assert.equal(
      s.timeline.filter((t) => t.label !== 'CS').reduce((sum, t) => sum + t.end - t.start, 0),
      9,
    );
});
test('FIFO/LRU match independent ordered-list policies and Clock separates scans from references', () => {
  const pages = [1, 2, 3, 1, 4, 1, 2, 5];
  for (const policy of ['FIFO', 'LRU']) {
    const resident = [];
    let faults = 0;
    for (const p of pages) {
      const at = resident.indexOf(p);
      if (at < 0) {
        faults++;
        if (resident.length === 3) resident.shift();
        resident.push(p);
      } else if (policy === 'LRU') {
        resident.splice(at, 1);
        resident.push(p);
      }
    }
    const r = solve('paging', { policy });
    assert.equal(r.summary.faults, faults);
    assert.equal(r.summary.hits, pages.length - faults);
    assert.deepEqual([...r.slots].sort(), resident.sort());
  }
  const r = solve('paging');
  assert.equal(r.summary.faults, 7);
  assert.equal(r.summary.hits, 1);
  assert.equal(r.summary.evictions, 4);
  assert.ok(r.visualization.frames.some((f) => f.detail.startsWith('Second chance')));
  assert.ok(r.series.length > pages.length + 1);
  assert.equal(solve('paging', { pages: '2,2,2,2' }).summary.faults, 1);
});
test('branch prediction uses the old state and two opposite outcomes to reverse a strong prediction', () => {
  assert.equal(solve('branch').summary.misses, 3);
  const r = solve('branch', { outcomes: '0,0,0', initial: 3 });
  assert.deepEqual(
    r.visualization.frames.slice(1).map((f) => [f.prediction, f.state]),
    [
      [1, 2],
      [1, 1],
      [0, 0],
    ],
  );
  assert.equal(
    solve('branch', { predictor: 'one', initial: 1, outcomes: '0,1,0,1' }).summary.misses,
    4,
  );
  assert.equal(solve('branch', { initial: 3, outcomes: '1,1' }).summary.state, 3);
});
test('all ten computer models expose valid presets, finite results and browser/API contracts', async () => {
  assert.equal(Object.keys(computerModels).length, 10);
  for (const [id, { definition: d }] of Object.entries(computerModels))
    for (const preset of [{}, ...Object.values(d.presets ?? {})]) {
      const input = { ...defaults(id), ...preset };
      assert.ok(validate(d, input).values);
      const r = await POST(
        new Request('http://localhost/api/waves', {
          method: 'POST',
          body: JSON.stringify({ model: id, input }),
        }),
      );
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.version, d.version);
      Object.values(body.summary).forEach((v) => assert.ok(Number.isFinite(v)));
      body.series.forEach((p) => Object.values(p).forEach((v) => assert.ok(Number.isFinite(v))));
      assert.ok(d.equation && d.example && d.limits);
    }
});
test('API rejects invalid widths, words, code positions, state encodings and empty streams', async () => {
  for (const [model, input, field] of [
    ['alu', { width: 4, a: 16 }, 'a'],
    ['twos', { width: 4, value: -9 }, 'value'],
    ['booth', { width: 4, b: 8 }, 'b'],
    ['division', { divisor: 0 }, 'divisor'],
    ['hamming', { error: 8 }, 'error'],
    ['crc', { message: '1', error: 5 }, 'error'],
    ['shiftregister', { initial: 16 }, 'initial'],
    ['roundrobin', { bursts: '0,2' }, 'bursts'],
    ['paging', { pages: '' }, 'pages'],
    ['branch', { predictor: 'one', initial: 2 }, 'initial'],
  ]) {
    const r = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model, input: { ...defaults(model), ...input } }),
      }),
    );
    assert.equal(r.status, 422);
    assert.equal((await r.json()).field, field);
  }
});

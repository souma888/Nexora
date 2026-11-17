import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { networkModels } from '../backend/networks-os.js';
import { cryptoModels } from '../backend/cryptography.js';
import {
  machineDynamicsModels,
  freeResponse,
  absorberResponse,
} from '../backend/machine-dynamics.js';
import { machineDesignModels } from '../backend/machine-design.js';
import { machineMotionModels, camLaw, sliderState } from '../backend/machine-motion.js';
import { advancedMaterialModels } from '../backend/advanced-materials.js';
import { validate } from '../backend/contract.js';
import { POST } from '../api/waves.js';
import { releaseVisual } from '../frontend/public/release-visuals.js';
import {
  sha256,
  modularPower,
  extendedGCD,
  primitiveRoot,
  encodeConvolution,
  viterbi,
} from '../backend/crypto-engine.js';
import {
  arq,
  ipv4,
  diskPath,
  semaphoreTrace,
  memoryTrace,
  safety,
  scheduleCPU,
} from '../backend/network-engine.js';
const additions = {
  ...networkModels,
  ...cryptoModels,
  ...machineDynamicsModels,
  ...machineDesignModels,
  ...machineMotionModels,
};
const defaults = (id) =>
  Object.fromEntries(
    Object.entries(additions[id].definition.inputs).map(([k, f]) => [k, f.initial]),
  );
const solve = (id, input = {}) => additions[id].solve({ ...defaults(id), ...input });
const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}, tolerance ${tol}`);
function finiteTree(v) {
  if (typeof v === 'number') assert.ok(Number.isFinite(v));
  else if (v && typeof v === 'object') Object.values(v).forEach(finiteTree);
}
test('individual control bounds and enum choices either validate to finite results or report a domain field', () => {
  for (const [id, m] of Object.entries(additions))
    for (const [key, field] of Object.entries(m.definition.inputs)) {
      const variants =
        field.type === 'number'
          ? [field.min, field.max]
          : field.type === 'enum'
            ? field.options
            : [];
      for (const value of variants) {
        const checked = validate(m.definition, { ...defaults(id), [key]: value });
        if (checked.values) finiteTree(m.solve(checked.values));
        else {
          assert.ok(checked.message);
          assert.ok(Object.hasOwn(m.definition.inputs, checked.key));
        }
      }
    }
});
test('release covers all requested mechanical topics with two existing labs reused', () => {
  assert.equal(Object.keys(additions).length, 38);
  assert.equal(Object.keys(networkModels).length, 10);
  assert.equal(Object.keys(cryptoModels).length, 6);
  assert.equal(
    Object.keys({ ...machineDynamicsModels, ...machineDesignModels, ...machineMotionModels })
      .length + 2,
    24,
  );
  assert.equal(advancedMaterialModels.bearinglife.definition.topic, 'Machine design');
  assert.equal(advancedMaterialModels.modal2dof.definition.topic, 'Vibration & rotor dynamics');
});
for (const [id, m] of Object.entries(additions))
  test(`${id}: validated finite defaults, worker execution, complete teaching notes and HTTP parity`, async () => {
    const d = m.definition,
      input = defaults(id);
    assert.ok(validate(d, input).values, id);
    assert.equal(d.execution, 'worker');
    for (const key of ['description', 'predict', 'example', 'equation', 'limits'])
      assert.ok(d[key].length > 20, `${id}:${key}`);
    assert.equal(d.prediction[0].length, 3);
    const result = solve(id);
    finiteTree(result);
    assert.ok(result.series.length > 0);
    assert.deepEqual(Object.keys(result.summary).sort(), Object.keys(d.metrics).sort());
    assert.deepEqual(result, solve(id));
    for (const index of [0, Math.floor(result.series.length / 2), result.series.length - 1]) {
      const svg = releaseVisual(result.visualization, index);
      assert.ok(svg.drawing.length > 100);
      assert.doesNotMatch(svg.drawing, /NaN|Infinity|undefined|\[object Object\]/);
    }
    const response = await POST(
      new Request('http://localhost/api/waves', {
        method: 'POST',
        body: JSON.stringify({ model: id, input }),
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).summary, result.summary);
  });
test('TCP follows slow-start/AIMD epochs and distinguishes timeout from duplicate ACK recovery', () => {
  assert.deepEqual(
    solve('tcp', { rounds: 5, losses: 'none' }).series.map((r) => r.y),
    [1, 2, 4, 8, 9, 10],
  );
  const a = solve('tcp', { rounds: 6, losses: '3', loss: 'timeout' }),
    b = solve('tcp', { rounds: 6, losses: '3', loss: 'duplicate' });
  near(a.series[4].y, 1);
  near(b.series[4].y, 4);
  near(a.series[4].reference, 4);
});
test('ARQ delivers every packet once in order, retransmits only lost SR packets, and includes timeout/reverse ACK propagation', () => {
  for (let N = 4; N <= 20; N += 4)
    for (let W = 1; W <= Math.min(N, 8); W++) {
      const a = arq('gbn', N, W, []),
        b = arq('sr', N, W, []);
      assert.equal(a.transmissions, N);
      assert.equal(b.transmissions, N);
      assert.equal(a.delivered, N);
      const lost = [0, N - 1],
        s = arq('sr', N, W, lost),
        g = arq('gbn', N, W, lost);
      assert.equal(s.transmissions, N + 2);
      assert.ok(g.transmissions >= N + 2);
      assert.equal(s.delivered, N);
      assert.equal(g.delivered, N);
      assert.ok(s.frames.every((f) => f.next <= f.base + W));
      assert.ok(g.frames.every((f) => f.next <= f.base + W));
    }
  assert.equal(arq('gbn', 4, 4, [0]).transmissions, 8);
  assert.equal(arq('sr', 4, 4, [0]).transmissions, 5);
});
test('MAC renewal formula has the one-slot ALOHA limit and seeded simulation agrees within sampling error', () => {
  const a = solve('macaccess', { duration: 1 });
  near(a.summary.aloha, a.summary.csma);
  const b = solve('macaccess', { ticks: 4000 });
  assert.ok(Math.abs(b.summary.observed - b.summary.csma) < 0.06);
  near(b.summary.aloha, 10 * 0.1 * 0.9 ** 9);
});
test('distance-vector failure reaches bounded infinity, and poison reverse removes the two-node stale loop', () => {
  const a = solve('distancerouting');
  assert.equal(a.summary.unreachable, 3);
  assert.equal(a.summary.stale, 0);
  const off = solve('distancerouting', { rounds: 4 }),
    on = solve('distancerouting', { rounds: 4, poison: 'on' });
  assert.ok(off.series.at(-1).y < 16);
  assert.equal(on.summary.unreachable, 3);
  assert.ok(a.series.every((r) => r.y >= 0 && r.y <= 16));
});
test('CIDR handles unsigned addresses and /0 /31 /32 boundary conventions', () => {
  near(ipv4('255.255.255.255'), 4294967295);
  const r = solve('cidr');
  near(r.summary.network, ipv4('192.168.10.64'));
  near(r.summary.usable, 62);
  near(solve('cidr', { prefix: 0 }).summary.addresses, 2 ** 32);
  near(solve('cidr', { prefix: 31 }).summary.usable, 2);
  near(solve('cidr', { prefix: 32 }).summary.usable, 1);
  assert.throws(() => ipv4('1.2.3.256'));
});
const permutations = (a) =>
  a.length
    ? a.flatMap((v, i) => permutations(a.filter((_, j) => i !== j)).map((p) => [v, ...p]))
    : [[]];
test('Banker safety agrees with independent complete-order enumeration and detection distinguishes a real cycle', () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 12, maxLength: 12 }), (a) => {
      const alloc = [
          [a[0], a[1]],
          [a[2], a[3]],
          [a[4], a[5]],
        ],
        need = [
          [a[6], a[7]],
          [a[8], a[9]],
          [a[10], a[11]],
        ],
        claims = need.map((r, i) => r.map((v, j) => v + alloc[i][j])),
        available = [1, 1],
        expected = permutations([0, 1, 2]).some((order) => {
          const work = [...available];
          for (const i of order) {
            if (need[i].some((v, j) => v > work[j])) return false;
            work.forEach((_, j) => (work[j] += alloc[i][j]));
          }
          return true;
        });
      assert.equal(safety(alloc, claims, available).safe, expected);
    }),
    { numRuns: 50, seed: 90 },
  );
  const dead = safety(
    [
      [1, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [1, 0],
    ],
    [0, 0],
    true,
  );
  assert.deepEqual(dead.unfinished, [0, 1]);
  assert.equal(
    safety(
      [
        [1, 0],
        [0, 0],
      ],
      [
        [0, 1],
        [1, 0],
      ],
      [0, 0],
      true,
    ).unfinished.includes(1),
    false,
  );
});
test('disk paths retain duplicate requests, include circular wrap travel and match the classic FCFS benchmark', () => {
  const r = solve('diskscheduling');
  near(r.summary.fcfs, 640);
  near(r.summary.scan, 331);
  near(r.summary.cscan, 382);
  assert.deepEqual(diskPath([40, 40, 50], 50, 'fcfs'), [50, 40, 40, 50]);
  assert.deepEqual(diskPath([20, 70], 50, 'scan', 'down'), [50, 20, 0, 70]);
  assert.deepEqual(diskPath([20, 70], 50, 'cscan', 'down'), [50, 20, 0, 199, 70]);
});
test('semaphore interleavings preserve bounded-buffer and accounting invariants, including blocking and wake transfer', () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom('P', 'C'), { minLength: 1, maxLength: 100 }),
      (schedule) => {
        const r = semaphoreTrace(schedule.join(''), 3);
        for (const f of r.frames) {
          assert.ok(f.buffer.length >= 0 && f.buffer.length <= 3);
          assert.equal(f.produced - f.consumed, f.buffer.length);
          assert.ok(Object.values(f.sem).every((v) => v >= 0));
          assert.ok(f.sem.mutex <= 1);
        }
      },
    ),
    { numRuns: 80, seed: 92 },
  );
  const r = semaphoreTrace('PPPPPCCCCC', 1);
  assert.equal(r.produced, 1);
  assert.equal(r.consumed, 1);
  assert.deepEqual(r.buffer, []);
});
test('TLB uses LRU and invalidates an evicted page; address fields and latency accounting are explicit', () => {
  const r = memoryTrace([0, 4, 256, 512, 0], 2, 4);
  assert.equal(r.hits, 1);
  assert.equal(r.faults, 4);
  assert.equal(r.frames.at(-1).hit, false);
  for (const f of r.frames) {
    assert.equal(f.physical % 256, f.address % 256);
    assert.equal(f.l1 * 16 + f.l2, f.vpn);
    assert.ok(f.resident.length <= 2);
  }
  near(r.average, (100310 + 110 + 100310 + 100310 + 100310) / 5);
});
test('CPU schedules execute every burst exactly once and compute waiting/turnaround independently', () => {
  for (const method of ['sjf', 'priority', 'mlfq']) {
    const jobs = [
        [0, 6, 2],
        [1, 2, 1],
        [2, 4, 3],
        [4, 1, 0],
      ],
      r = scheduleCPU(jobs, method);
    for (const p of r.jobs) {
      assert.equal(r.frames.filter((f) => f.running === p.id).length, p.burst);
      assert.ok(p.finish >= p.arrival + p.burst);
      assert.equal(p.remaining, 0);
    }
    near(r.waiting, r.jobs.reduce((s, p) => s + p.finish - p.arrival - p.burst, 0) / jobs.length);
  }
  near(
    scheduleCPU(
      [
        [0, 3, 1],
        [0, 1, 2],
      ],
      'sjf',
    ).waiting,
    0.5,
  );
  const idle = scheduleCPU([[3, 2, 1]], 'mlfq');
  assert.deepEqual(
    idle.frames.slice(0, 3).map((f) => f.running),
    [null, null, null],
  );
  near(idle.utilization, 0.4);
});
test('SHA-256 matches NIST abc and Node crypto across padding boundaries; modular arithmetic agrees with BigInt', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const n of [0, 1, 3, 55, 56, 63, 64, 65, 127, 128, 1000]) {
    const s = 'a'.repeat(n);
    assert.equal(sha256(s), createHash('sha256').update(s).digest('hex'));
  }
  for (const p of [7, 11, 23, 97])
    for (let base = 0; base < p; base += 3)
      for (const exp of [0, 1, 2, 17, 80])
        assert.equal(
          modularPower(base, exp, p).value,
          Number(BigInt(base) ** BigInt(exp) % BigInt(p)),
        );
  assert.equal(primitiveRoot(5, 23), true);
  assert.equal(primitiveRoot(4, 23), false);
  assert.equal(extendedGCD(17, 3120).gcd, 1);
});
test('RSA, Diffie–Hellman, entropy/Huffman, Vigenère and avalanche reference values', () => {
  const r = solve('rsa').summary;
  assert.deepEqual(r, { modulus: 3233, phi: 3120, private: 2753, cipher: 2790, recovered: 65 });
  for (let m = 0; m < 15; m++)
    assert.equal(solve('rsa', { p: 3, q: 5, exponent: 3, message: m }).summary.recovered, m);
  const dh = solve('diffiehellman').summary;
  assert.deepEqual(dh, { alice: 8, bob: 19, secret: 2, agreement: 1 });
  const c = solve('sourcecoding', { counts: '1,1,1,1' });
  near(c.summary.entropy, 2);
  near(c.summary.length, 2);
  const codes = c.visualization.codes;
  for (let i = 0; i < codes.length; i++)
    for (let j = 0; j < codes.length; j++) if (i !== j) assert.ok(!codes[i].startsWith(codes[j]));
  assert.equal(solve('vigenere').visualization.cipher, 'LXFOPVEFRNHR');
  assert.equal(solve('vigenere', { plaintext: 'A' }).summary.plainIC, null);
  const hash = solve('hashavalanche').summary;
  assert.ok(hash.changed > 80 && hash.changed < 180);
  assert.ok(hash.probability > 0.9 && hash.probability < 1);
});
test('Viterbi noiseless round-trips all eight-bit messages and noisy metrics equal exhaustive terminated path search', () => {
  for (let n = 0; n < 256; n++) {
    const bits = n.toString(2).padStart(8, '0').split('').map(Number),
      encoded = encodeConvolution([...bits, 0, 0]),
      r = viterbi(encoded);
    assert.deepEqual(r.bits, [...bits, 0, 0]);
    assert.equal(r.metric, 0);
  }
  for (let mask = 0; mask < 32; mask++) {
    const source = [1, 0, 1, 1],
      received = encodeConvolution([...source, 0, 0]);
    for (let bit = 0; bit < 5; bit++) if (mask & (1 << bit)) received[bit] ^= 1;
    const best = Math.min(
      ...Array.from({ length: 16 }, (_, n) =>
        encodeConvolution([...n.toString(2).padStart(4, '0')].map(Number).concat([0, 0])).reduce(
          (s, b, i) => s + +(b !== received[i]),
          0,
        ),
      ),
    );
    assert.equal(viterbi(received).metric, best);
  }
});
test('free vibration exact regimes satisfy initial data and logarithmic decrement', () => {
  for (const z of [0, 0.1, 0.9, 1, 1.5, 2]) {
    const w = 10,
      x0 = 2,
      v0 = 3,
      h = 1e-6;
    near(freeResponse(0, w, z, x0, v0), x0);
    near((freeResponse(h, w, z, x0, v0) - freeResponse(-h, w, z, x0, v0)) / (2 * h), v0, 1e-7);
  }
  near(freeResponse(1, 2, 1, 1, 0), 3 * Math.exp(-2));
  const z = 0.1,
    T = (2 * Math.PI) / (10 * Math.sqrt(1 - z * z)),
    ratio = freeResponse(0, 10, z, 1, 0) / freeResponse(T, 10, z, 1, 0);
  near(Math.log(ratio), (2 * Math.PI * z) / Math.sqrt(1 - z * z));
  assert.equal(solve('dampedfree', { damping: 1 }).summary.decrement, null);
});
test('forced/base responses handle resonance and isolation, and tuned-mass static solution satisfies force balance', () => {
  near(solve('forcedvibration', { ratio: 1, damping: 0.05 }).summary.magnification, 10);
  assert.equal(solve('forcedvibration', { ratio: 1, damping: 0 }).summary.amplitude, null);
  const natural = Math.sqrt(10000 / 10) / (2 * Math.PI);
  near(solve('baseexcitation', { frequency: Math.sqrt(2) * natural }).summary.transmissibility, 1);
  const staticResponse = absorberResponse(10, 0.5, 10000, 500, 1, 1, 0, 100);
  near(staticResponse.primary, 0.01);
  near(staticResponse.absorber, 0.01);
  assert.ok(solve('tunedmass').summary.primary < solve('tunedmass').summary.bare);
});
test('unbalance and Jeffcott responses have the high-speed limit and critical-speed/static-sag identity', () => {
  const r = solve('rotatingunbalance');
  near(r.summary.force, 0.02 * 0.01 * ((500 * 2 * Math.PI) / 60) ** 2);
  const j = solve('jeffcott').summary,
    w = (j.critical * 2 * Math.PI) / 60;
  near(w * w, 9.80665 / (j.sag / 1000));
});
test('gear geometry, Willis kinematics, Lewis stress and capstan forces have independent references', () => {
  const g = solve('spurgear').summary;
  near(g.center, 90);
  near(g.basepitch, Math.PI * 3 * Math.cos(Math.PI / 9));
  const planet = solve('geartrains').summary;
  near(planet.output, 100);
  near(planet.residual, 0);
  near(solve('geartrains', { mode: 'simple' }).summary.output, -300);
  near(solve('lewisgear').summary.force, 100 / 0.03);
  const b = solve('beltdrive', { speed: 0 }).summary;
  near(b.tight / b.slack, Math.exp(0.3 * Math.PI));
  near(b.torque, (b.tight - b.slack) * 0.1);
});
test('bolt contact branches are continuous at separation; journal dimensionless groups agree in SI units', () => {
  const first = solve('boltpreload').summary,
    sep = first.separation,
    a = solve('boltpreload', { external: sep }).summary,
    b = solve('boltpreload', { external: sep + 1 }).summary;
  near(a.clamp, 0);
  near(a.boltforce, sep);
  near(b.boltforce, sep + 1);
  near(b.clamp, 0);
  const j = solve('journalbearing').summary;
  near(j.pressure, 0.4);
  near(j.sommerfeld, 0.46875);
  near(j.torque, j.friction * 1000 * 0.025);
});
test('cam derivative laws and exact slider kinematics agree with independent finite differences and closure', () => {
  for (const profile of ['harmonic', 'cycloidal', 'polynomial'])
    for (const u of [0.1, 0.3, 0.7, 0.9]) {
      const h = 1e-5,
        a = camLaw(profile, u - h),
        b = camLaw(profile, u),
        c = camLaw(profile, u + h);
      near((c.s - a.s) / (2 * h), b.d, 2e-8);
      near((c.d - a.d) / (2 * h), b.dd, 2e-7);
      near((c.dd - a.dd) / (2 * h), b.ddd, 2e-6);
    }
  assert.equal(solve('camfollower', { profile: 'harmonic' }).summary.jerk, null);
  for (const theta of [0.2, 0.8, 1.7, 3.2, 5]) {
    const h = 1e-5,
      r = 50,
      l = 150,
      w = 20,
      a = sliderState(theta - h, r, l, w),
      b = sliderState(theta, r, l, w),
      c = sliderState(theta + h, r, l, w);
    near(((c.displacement - a.displacement) / (2 * h)) * w, b.velocity, 2e-6);
    near(((c.velocity - a.velocity) / (2 * h)) * w, b.acceleration, 1e-3);
    near((b.piston - b.pin[0]) ** 2 + b.pin[1] ** 2, l * l, 1e-8);
  }
  near(solve('slidercrank', { angle: 180 }).summary.displacement, 100);
});
test('flywheel energy, clutch torque, spring scaling and combined-shaft criterion match reference identities', () => {
  const f = solve('flywheel').summary;
  near(f.energy, 50);
  near(f.required, 50 / (0.05 * ((300 * 2 * Math.PI) / 60) ** 2));
  near(solve('clutchbrake').summary.torque, 90);
  near(solve('helicalspring').summary.rate, 19.287109375);
  const spring = solve('helicalspring', { wire: 4, diameter: 64 }).summary,
    thick = solve('helicalspring', { wire: 8, diameter: 64 }).summary;
  near(thick.rate / spring.rate, 16);
  const shaft = solve('shaftcombined', { bending: 0 }).summary;
  near(shaft.equivalent, Math.sqrt(3) * shaft.shear);
  assert.equal(solve('shaftcombined', { bending: 0, torque: 0 }).summary.factor, null);
});
test('Hertz load integral and cube-root scaling, rotor correction force/couple closure, rolling and impact conservation', () => {
  const h = solve('hertzcontact'),
    a = h.summary.radius / 1000,
    p0 = h.summary.pressure * 1e6;
  near((2 * Math.PI * p0 * a * a) / 3, 100);
  near(solve('hertzcontact', { force: 800 }).summary.radius / h.summary.radius, 2);
  const b = solve('rotorbalance').summary;
  assert.ok(b.force < 1e-8 && b.couple < 1e-8);
  const one = solve('rotorbalance', { unbalances: '[[20,40,0,0]]' }).summary;
  near(one.massA, 16);
  near(one.massB, 0);
  const roll = solve('rollingincline').summary;
  near(roll.acceleration, (2 / 3) * 9.80665 * Math.sin(Math.PI / 9));
  near(roll.speed, roll.angular * 0.05);
  assert.equal(solve('rollingincline', { friction: 0 }).summary.speed, null);
  for (const e of [0, 0.3, 1]) {
    const c = solve('collision', { restitution: e }).summary;
    near(c.momentum, 0);
    near(c.velocity2 - c.velocity1, 4 * e);
    near(c.loss, ((0.5 * 2 * 3) / 5) * (1 - e * e) * 16);
  }
  near(solve('collision', { velocity1: 0, velocity2: 1 }).summary.collision, 0);
});
test('mechanical input hooks and protocol fields reject invalid domains before running', () => {
  for (const [id, changes] of [
    ['spurgear', { module: 0 }],
    ['slidercrank', { radius: 100, rod: 100 }],
    ['helicalspring', { wire: 20, diameter: 20 }],
    ['clutchbrake', { inner: 100, outer: 50 }],
    ['journalbearing', { radius: 5, clearance: 0.3 }],
    ['flywheel', { inertia: 0.1, speed: 30, torque: 500 }],
    ['arq', { window: 8, packets: 4 }],
    ['virtualmemory', { addresses: '65536' }],
    ['rsa', { p: 9 }],
    ['diffiehellman', { generator: 4 }],
    ['hashavalanche', { bit: 100 }],
    ['viterbicode', { flips: '999' }],
  ])
    assert.ok(validate(additions[id].definition, { ...defaults(id), ...changes }).message, id);
});

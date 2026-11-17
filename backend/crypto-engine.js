export const isPrime = (n) =>
  Number.isInteger(n) &&
  n >= 2 &&
  !Array.from({ length: Math.max(0, Math.floor(Math.sqrt(n)) - 1) }, (_, i) => i + 2).some(
    (d) => n % d === 0,
  );
export function modularPower(base, exponent, modulus) {
  let a = base % modulus,
    result = 1 % modulus;
  const steps = [];
  while (exponent > 0) {
    const bit = exponent % 2;
    if (bit) result = (result * a) % modulus;
    steps.push({ exponent, bit, base: a, result });
    a = (a * a) % modulus;
    exponent = Math.floor(exponent / 2);
  }
  return { value: result, steps };
}
export function extendedGCD(a, b) {
  let x = 1,
    y = 0,
    u = 0,
    v = 1;
  while (b) {
    const q = Math.floor(a / b);
    [a, b] = [b, a - q * b];
    [x, u] = [u, x - q * u];
    [y, v] = [v, y - q * v];
  }
  return { gcd: a, x, y };
}
export function primitiveRoot(g, p) {
  if (!isPrime(p) || g < 2 || g >= p) return false;
  let n = p - 1;
  const factors = [];
  for (let d = 2; d * d <= n; d++)
    if (n % d === 0) {
      factors.push(d);
      while (n % d === 0) n /= d;
    }
  if (n > 1) factors.push(n);
  return factors.every((q) => modularPower(g, (p - 1) / q, p).value !== 1);
}
export function huffman(counts) {
  let serial = 0;
  const nodes = counts.map((weight, symbol) => ({
      weight,
      symbol,
      left: null,
      right: null,
      serial: serial++,
    })),
    queue = [...nodes],
    merges = [];
  while (queue.length > 1) {
    queue.sort((a, b) => a.weight - b.weight || a.serial - b.serial);
    const left = queue.shift(),
      right = queue.shift(),
      node = { weight: left.weight + right.weight, symbol: null, left, right, serial: serial++ };
    queue.push(node);
    merges.push({ left: left.weight, right: right.weight, total: node.weight });
  }
  const codes = Array(counts.length);
  function walk(n, prefix) {
    if (n.symbol !== null) codes[n.symbol] = prefix || '0';
    else {
      walk(n.left, prefix + '0');
      walk(n.right, prefix + '1');
    }
  }
  walk(queue[0], '');
  return { codes, merges };
}
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotate = (x, n) => (x >>> n) | (x << (32 - n));
/** FIPS 180-4 SHA-256, synchronous and portable to the worker and Node API. */
export function sha256(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input,
    length = Math.ceil((bytes.length + 9) / 64) * 64,
    data = new Uint8Array(length);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer),
    bitLength = bytes.length * 8;
  view.setUint32(length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(length - 4, bitLength >>> 0);
  const H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ],
    w = new Uint32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + 4 * i);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2],
        s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3),
        s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25),
        ch = (e & f) ^ (~e & g),
        t1 = (h + S1 + ch + K[i] + w[i]) >>> 0,
        S0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22),
        maj = (a & b) ^ (a & c) ^ (b & c),
        t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
  }
  return H.map((v) => v.toString(16).padStart(8, '0')).join('');
}
const parity = (x) => {
  let p = 0;
  while (x) {
    p ^= x & 1;
    x >>>= 1;
  }
  return p;
};
export function encodeConvolution(bits) {
  let state = 0;
  const output = [];
  for (const bit of bits) {
    const shift = (state << 1) | bit;
    output.push(parity(shift & 7), parity(shift & 5));
    state = shift & 3;
  }
  return output;
}
export function viterbi(received) {
  let metrics = [0, Infinity, Infinity, Infinity],
    paths = [[], [], [], []];
  const frames = [];
  for (let t = 0; t < received.length / 2; t++) {
    const next = Array(4).fill(Infinity),
      survivors = Array.from({ length: 4 }, () => []);
    for (let s = 0; s < 4; s++)
      if (Number.isFinite(metrics[s]))
        for (let bit = 0; bit < 2; bit++) {
          const shift = (s << 1) | bit,
            to = shift & 3,
            expected = [parity(shift & 7), parity(shift & 5)],
            distance = +(expected[0] !== received[2 * t]) + +(expected[1] !== received[2 * t + 1]),
            candidate = metrics[s] + distance;
          if (candidate < next[to]) {
            next[to] = candidate;
            survivors[to] = [...paths[s], bit];
          }
        }
    metrics = next;
    paths = survivors;
    frames.push({
      t,
      received: received.slice(2 * t, 2 * t + 2),
      metrics: metrics.map((v) => (Number.isFinite(v) ? v : null)),
      paths: paths.map((p) => [...p]),
    });
  }
  return { bits: paths[0], metric: metrics[0], frames };
}

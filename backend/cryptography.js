import {
  study,
  integer,
  textInput,
  table,
  systemVisual,
  checkInput,
  indices,
} from './study-kit.js';
import {
  isPrime,
  modularPower,
  extendedGCD,
  primitiveRoot,
  huffman,
  sha256,
  encodeConvolution,
  viterbi,
} from './crypto-engine.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) => study({ discipline: 'cryptography', ...config }, solve);
const toy =
  'Tiny educational integers and deterministic examples only; this is not secure key generation, encryption or a cryptographic API. No random keys, padding, authentication or side-channel resistance are supplied.';
const countsFrom = (s) => {
  const a = String(s)
    .split(',')
    .map((x) => (x.trim() ? Number(x) : NaN));
  if (a.length < 1 || a.length > 8 || a.some((v) => !Number.isInteger(v) || v < 1 || v > 1000))
    throw Error('Use 1–8 positive integer symbol counts, each at most 1000.');
  return a;
};
export const cryptoModels = {
  sourcecoding: make(
    {
      id: 'sourcecoding',
      title: 'Shannon Entropy and Huffman Source Coding',
      topic: 'Information & source coding',
      inputs: { counts: textInput('Symbol counts', '50,25,15,10', 150) },
      validateValues: checkInput('counts', (v) => countsFrom(v.counts)),
      metrics: {
        entropy: ['Shannon entropy', 'bits/symbol'],
        length: ['Mean Huffman code length', 'bits/symbol'],
        redundancy: ['Mean length minus entropy', 'bits/symbol'],
        efficiency: ['Entropy / mean code length', '1'],
      },
      plot: {
        x: 'Symbol index',
        xUnit: '',
        y: 'Information or code length',
        yUnit: 'bits',
        traces: { y: 'Self-information', reference: 'Huffman length' },
      },
      text: {
        description:
          'Normalize a source distribution, construct an actual Huffman prefix code and compare expected length with Shannon entropy.',
        predict: 'Does entropy depend on the numerical labels assigned to symbols?',
        answers: ['No, it depends on their probabilities', 'Yes', 'Only for binary sources'],
        explain: 'Relabeling a symbol does not change −Σp log₂p.',
        example:
          'Four equally likely symbols have entropy 2 bits and an optimal fixed-length Huffman code of length 2.',
        equation: 'H=−Σpᵢlog₂pᵢ; L=Σpᵢℓᵢ. Repeatedly merge the two least likely Huffman subtrees.',
        limits:
          'Up to eight symbols with positive integer counts. Prefix codes are shown explicitly; deterministic weight ties use creation order. A single-symbol source gets the practical code “0” of length one despite zero entropy, so the usual strict H+1 bound needs its single-symbol qualification.',
      },
    },
    ({ counts }) => {
      const a = countsFrom(counts),
        total = a.reduce((s, v) => s + v, 0),
        prob = a.map((v) => v / total),
        h = huffman(a),
        entropy = -prob.reduce((s, v) => s + v * Math.log2(v), 0),
        length = prob.reduce((s, v, i) => s + v * h.codes[i].length, 0);
      return {
        summary: { entropy, length, redundancy: length - entropy, efficiency: entropy / length },
        series: prob.map((v, x) => ({ x, y: -Math.log2(v), reference: h.codes[x].length })),
        visualization: systemVisual('coding', { codes: h.codes, prob }),
        table: table(
          'Prefix-free symbol code',
          ['Symbol', 'Probability', 'Code', 'Length'],
          prob.map((v, i) => [i, v, h.codes[i], h.codes[i].length]),
        ),
      };
    },
  ),
  rsa: make(
    {
      id: 'rsa',
      title: 'RSA Key Generation and Modular Exponentiation',
      topic: 'Public-key arithmetic',
      inputs: {
        p: integer('Prime p', 3, 97, 61),
        q: integer('Prime q (different from p)', 3, 97, 53),
        exponent: integer('Public exponent e', 3, 999, 17),
        message: integer('Message integer m', 0, 9408, 65),
      },
      validateValues: checkInput('p', (v) => {
        if (!isPrime(v.p) || !isPrime(v.q) || v.p === v.q)
          throw Error('Choose distinct prime p and q.');
        const phi = (v.p - 1) * (v.q - 1);
        if (v.exponent >= phi || extendedGCD(v.exponent, phi).gcd !== 1)
          throw Error('Require 1<e<φ(n) and gcd(e,φ(n))=1.');
        if (v.message >= v.p * v.q) throw Error('Require 0≤message<n.');
      }),
      metrics: {
        modulus: ['Modulus n', '1'],
        phi: ['Euler totient φ(n)', '1'],
        private: ['Private exponent d (educational)', '1'],
        cipher: ['Ciphertext integer', '1'],
        recovered: ['Decrypted message', '1'],
      },
      plot: { x: 'Square-and-multiply step', xUnit: '', y: 'Modular accumulator', yUnit: '' },
      text: {
        description:
          'Construct a small RSA key with the extended Euclidean algorithm and inspect encryption exponent bits.',
        predict: 'Why must e be coprime to φ(n)?',
        answers: [
          'So its modular inverse d exists',
          'So n is even',
          'To make ciphertext larger than n',
        ],
        explain: 'The private exponent satisfies ed≡1 modulo φ(n).',
        example: 'p=61,q=53,e=17,m=65 gives n=3233,d=2753,c=2790 and recovered message 65.',
        equation: 'n=pq; φ=(p−1)(q−1); d=e⁻¹ mod φ; c=mᵉ mod n; m=cᵈ mod n.',
        limits:
          toy +
          ' Messages are integer residues; small inputs keep all products exactly representable in JavaScript integers.',
      },
    },
    ({ p, q, exponent, message }) => {
      const modulus = p * q,
        phi = (p - 1) * (q - 1),
        d = ((extendedGCD(exponent, phi).x % phi) + phi) % phi,
        encrypted = modularPower(message, exponent, modulus),
        decoded = modularPower(encrypted.value, d, modulus);
      return {
        summary: { modulus, phi, private: d, cipher: encrypted.value, recovered: decoded.value },
        series: encrypted.steps.map((f, x) => ({ x, y: f.result })),
        visualization: systemVisual(
          'keys',
          { left: message, middle: encrypted.value, right: decoded.value },
          encrypted.steps,
        ),
        table: table(
          'Encryption exponent trace',
          ['Remaining exponent', 'Low bit', 'Current base', 'Accumulator'],
          encrypted.steps.map((f) => [f.exponent, f.bit, f.base, f.result]),
        ),
      };
    },
  ),
  diffiehellman: make(
    {
      id: 'diffiehellman',
      title: 'Diffie–Hellman Key Exchange',
      topic: 'Public-key arithmetic',
      inputs: {
        prime: integer('Prime modulus p', 5, 97, 23),
        generator: integer('Primitive root g', 2, 96, 5),
        alice: integer('Alice private exponent a', 1, 95, 6),
        bob: integer('Bob private exponent b', 1, 95, 15),
      },
      validateValues: checkInput('generator', (v) => {
        if (!primitiveRoot(v.generator, v.prime))
          throw Error('Choose a prime p and a primitive root 2≤g<p.');
        if (v.alice >= v.prime - 1 || v.bob >= v.prime - 1)
          throw Error('Use private exponents between 1 and p−2.');
      }),
      metrics: {
        alice: ['Public value A', '1'],
        bob: ['Public value B', '1'],
        secret: ['Shared residue', '1'],
        agreement: ['Both sides agree (1=yes)', '1'],
      },
      plot: {
        x: 'Exponent bit step',
        xUnit: '',
        y: 'Shared-secret accumulator',
        yUnit: '',
        traces: { y: 'Alice computes Bᵃ', reference: 'Bob computes Aᵇ' },
      },
      text: {
        description:
          'Exchange public group elements and compare both square-and-multiply paths to the same shared residue.',
        predict: 'Does unauthenticated Diffie–Hellman prevent an active man-in-the-middle?',
        answers: ['No', 'Yes', 'Only when a and b differ'],
        explain:
          'Agreement over a mathematical group alone does not authenticate the exchanged public values.',
        example: 'p=23,g=5,a=6,b=15 gives A=8,B=19 and shared residue 2.',
        equation: 'A=gᵃ mod p, B=gᵇ mod p; Bᵃ=Aᵇ=gᵃᵇ mod p.',
        limits:
          toy +
          ' The generator is checked against the distinct prime factors of p−1. This does not implement a standardized authenticated DH protocol.',
      },
    },
    ({ prime: p, generator: g, alice: a, bob: b }) => {
      const A = modularPower(g, a, p).value,
        B = modularPower(g, b, p).value,
        x = modularPower(B, a, p),
        y = modularPower(A, b, p),
        N = Math.max(x.steps.length, y.steps.length);
      return {
        summary: { alice: A, bob: B, secret: x.value, agreement: +(x.value === y.value) },
        series: Array.from({ length: N }, (_, i) => ({
          x: i,
          y: x.steps[Math.min(i, x.steps.length - 1)].result,
          reference: y.steps[Math.min(i, y.steps.length - 1)].result,
        })),
        visualization: systemVisual('keys', { left: A, middle: 'public exchange', right: B }),
        table: table(
          'Public and shared values',
          ['Party', 'Public value', 'Locally computed shared residue'],
          [
            ['Alice', A, x.value],
            ['Bob', B, y.value],
          ],
        ),
      };
    },
  ),
  vigenere: make(
    {
      id: 'vigenere',
      title: 'Vigenère Cipher and Frequency Analysis',
      topic: 'Classical cryptanalysis',
      inputs: {
        plaintext: textInput('Plaintext letters', 'ATTACKATDAWN', 120),
        key: textInput('Repeating key', 'LEMON', 20),
      },
      validateValues: checkInput('plaintext', (v) => {
        if (!/^[A-Za-z]{1,100}$/.test(v.plaintext) || !/^[A-Za-z]{1,16}$/.test(v.key))
          throw Error('Use 1–100 ASCII letters for text and 1–16 letters for key.');
      }),
      metrics: {
        plainIC: ['Plaintext index of coincidence', '1'],
        cipherIC: ['Ciphertext index of coincidence', '1'],
        period: ['Key period', 'letters'],
        recovered: ['Round-trip matches (1=yes)', '1'],
      },
      plot: {
        x: 'Letter index A=0…Z=25',
        xUnit: '',
        y: 'Letter count',
        yUnit: '',
        traces: { y: 'Plaintext', reference: 'Ciphertext' },
      },
      text: {
        description:
          'Encrypt with a repeating alphabetic key and compare monogram frequencies and coincidence statistics before and after.',
        predict: 'Does a repeating-key cipher necessarily erase statistical patterns?',
        answers: ['No, periodic key structure can leak them', 'Yes', 'Only for keys of length one'],
        explain:
          'Separating ciphertext positions by candidate key period can expose Caesar-shifted frequency distributions.',
        example: 'ATTACKATDAWN with LEMON encrypts to LXFOPVEFRNHR.',
        equation: 'Cᵢ=(Pᵢ+Kᵢ mod key length) mod 26; IC=Σf(f−1)/(N(N−1)).',
        limits:
          'Classical educational cipher, not secure encryption. ASCII letters only, case normalized to uppercase, no spaces. Frequency and IC displays are exploratory, not an automatic or guaranteed key-recovery attack; IC is undefined for one character.',
      },
    },
    ({ plaintext, key }) => {
      const text = plaintext.toUpperCase(),
        k = key.toUpperCase(),
        values = [...text].map((c) => c.charCodeAt(0) - 65),
        shifts = [...k].map((c) => c.charCodeAt(0) - 65),
        encoded = values.map((v, i) => (v + shifts[i % shifts.length]) % 26),
        cipher = encoded.map((v) => String.fromCharCode(65 + v)).join(''),
        decoded = encoded
          .map((v, i) => String.fromCharCode(65 + ((v - shifts[i % shifts.length] + 26) % 26)))
          .join(''),
        freq = (a) => Array.from({ length: 26 }, (_, i) => a.filter((v) => v === i).length),
        a = freq(values),
        b = freq(encoded),
        ic = (f) =>
          text.length > 1
            ? f.reduce((s, v) => s + v * (v - 1), 0) / (text.length * (text.length - 1))
            : null;
      return {
        summary: {
          plainIC: ic(a),
          cipherIC: ic(b),
          period: k.length,
          recovered: +(decoded === text),
        },
        series: a.map((y, x) => ({ x, y, reference: b[x] })),
        visualization: systemVisual('cipher', { plain: text, cipher, key: k }),
        table: table(
          'Character-by-character shifts',
          ['Index', 'Plain', 'Key', 'Cipher'],
          values.map((_v, i) => [i, text[i], k[i % k.length], cipher[i]]),
        ),
      };
    },
  ),
  hashavalanche: make(
    {
      id: 'hashavalanche',
      title: 'SHA-256 Avalanche and Birthday Collisions',
      topic: 'Hash functions',
      inputs: {
        message: textInput('ASCII message', 'abc', 80),
        bit: integer('Input bit to flip (LSB within byte)', 0, 511, 0),
        width: integer('Truncated birthday hash width', 8, 20, 12),
        samples: integer('Birthday trial messages', 10, 1500, 150),
      },
      validateValues: checkInput('bit', (v) => {
        if (!/^[\x20-\x7e]{1,64}$/.test(v.message) || v.bit >= v.message.length * 8)
          throw Error(
            'Use 1–64 printable ASCII characters and a bit index within the encoded bytes.',
          );
      }),
      metrics: {
        changed: ['Changed SHA-256 output bits', 'bits'],
        fraction: ['Changed fraction of digest', '1'],
        collisions: ['Observed duplicate truncated digests', '1'],
        probability: ['Probability of at least one collision under uniform model', '1'],
      },
      plot: { x: 'Digest bit index', xUnit: '', y: 'Changed bit (1=yes)', yUnit: '', step: true },
      text: {
        description:
          'Compute real SHA-256 digests for a one-bit input change, then distinguish full-digest avalanche from collisions in a deliberately truncated hash.',
        predict: 'Does finding a 12-bit truncated collision break full SHA-256?',
        answers: [
          'No, the truncated space is deliberately tiny',
          'Yes',
          'Only if the messages differ by one bit',
        ],
        explain:
          'The birthday experiment throws away most of the 256 output bits; it makes no claim of a full SHA-256 collision.',
        example:
          'SHA-256("abc") starts ba7816bf; changing one input bit generally changes about half the digest bits, with variation.',
        equation:
          'Avalanche fraction=Hamming(H(m),H(m⊕2ᵇ))/256. Uniform collision probability=1−Πᵢ₌₀ⁿ⁻¹(1−i/2ʷ).',
        limits:
          'Portable SHA-256 implementation checked against NIST vectors. Birthday inputs are distinct deterministic counter strings and digests are truncated to 8–20 bits. The uniform probability is a model, not a guarantee for a particular deterministic set; observed duplicates count repeated outputs, not all colliding pairs.',
      },
    },
    ({ message, bit, width, samples }) => {
      const bytes = new TextEncoder().encode(message),
        modified = new Uint8Array(bytes);
      modified[Math.floor(bit / 8)] ^= 1 << (bit % 8);
      const a = sha256(bytes),
        b = sha256(modified),
        toBits = (hex) =>
          [...hex].flatMap((c) =>
            parseInt(c, 16).toString(2).padStart(4, '0').split('').map(Number),
          ),
        x = toBits(a),
        y = toBits(b),
        changed = x.reduce((s, v, i) => s + +(v !== y[i]), 0),
        seen = new Set();
      let collisions = 0,
        logNoCollision = 0;
      for (let i = 0; i < samples; i++) {
        const hash = parseInt(sha256(`birthday-${i}`).slice(0, 8), 16) >>> (32 - width);
        if (seen.has(hash)) collisions++;
        seen.add(hash);
        if (i < 2 ** width) logNoCollision += Math.log1p(-i / 2 ** width);
        else logNoCollision = -Infinity;
      }
      return {
        summary: {
          changed,
          fraction: changed / 256,
          collisions,
          probability: -Math.expm1(logNoCollision),
        },
        series: x.map((v, i) => ({ x: i, y: +(v !== y[i]) })),
        visualization: systemVisual('digest', { original: x, modified: y }),
        table: table(
          'Full digests and truncated trial',
          ['Property', 'Value'],
          [
            ['Original SHA-256', a],
            ['One-bit-modified SHA-256', b],
            ['Truncated width', width],
            ['Distinct sampled outputs', seen.size],
          ],
        ),
      };
    },
  ),
  viterbicode: make(
    {
      id: 'viterbicode',
      title: 'Viterbi Decoding of a Convolutional Code',
      topic: 'Error-correcting codes',
      inputs: {
        bits: textInput('Source bit string', '101101', 40),
        flips: textInput('Received bit positions to flip (none allowed)', '3', 180),
      },
      validateValues: checkInput('bits', (v) => {
        if (!/^[01]{1,24}$/.test(v.bits)) throw Error('Use 1–24 source bits.');
        indices(v.flips, 2 * (v.bits.length + 2));
      }),
      metrics: {
        distance: ['Selected terminated path Hamming metric', 'bits'],
        errors: ['Decoded source bit errors', 'bits'],
        received: ['Channel flips injected', 'bits'],
        rate: ['Effective payload / transmitted bits', '1'],
      },
      plot: {
        x: 'Trellis step',
        xUnit: '',
        y: 'Survivor metric',
        yUnit: 'bits',
        traces: { y: 'State 0', reference: 'State 1', other: 'State 2' },
      },
      text: {
        description:
          'Encode a terminated rate-1/2, constraint-length-three code and run hard-decision Viterbi survivor updates over four states.',
        predict: 'Does the decoder choose the path with the smallest cumulative Hamming distance?',
        answers: [
          'Yes',
          'No, it only checks the last pair',
          'It always returns the transmitted bits',
        ],
        explain:
          'Dynamic programming keeps the best path entering each state; it cannot guarantee recovery beyond the code and error pattern’s capability.',
        example:
          'The encoder uses generators (111)₂ and (101)₂, starts in state zero and appends two zero tail bits.',
        equation: 'Mₜ₊₁(s′)=minₛ,b:s→s′[Mₜ(s)+Hamming(received pair,expected pair)].',
        limits:
          'Four-state binary feed-forward convolutional code with known zero start/end and two zero tail bits. Hard decisions, equal-cost bit errors, no soft information or puncturing. Ties use fixed state/bit iteration order, so ambiguous minimum paths need not reproduce the source.',
      },
    },
    ({ bits, flips }) => {
      const payload = [...bits].map(Number),
        encoded = encodeConvolution([...payload, 0, 0]),
        received = [...encoded],
        positions = indices(flips, encoded.length);
      for (const i of positions) received[i] ^= 1;
      const r = viterbi(received),
        decoded = r.bits.slice(0, -2),
        errors = decoded.reduce((s, v, i) => s + +(v !== payload[i]), 0);
      return {
        summary: {
          distance: r.metric,
          errors,
          received: positions.length,
          rate: payload.length / encoded.length,
        },
        series: r.frames.map((f) => ({
          x: f.t,
          y: f.metrics[0],
          reference: f.metrics[1],
          other: f.metrics[2],
        })),
        visualization: systemVisual('trellis', { encoded, received, decoded }, r.frames),
        table: table(
          'Trellis survivor metrics',
          ['Step', 'Received pair', 'State 0', 'State 1', 'State 2', 'State 3'],
          r.frames.map((f) => [f.t, f.received.join(''), ...f.metrics.map((v) => v ?? '∞')]),
        ),
      };
    },
  ),
};

export const C = (re = 0, im = 0) => ({ re, im });
export const add = (a, b) => C(a.re + b.re, a.im + b.im);
export const sub = (a, b) => C(a.re - b.re, a.im - b.im);
export const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a, k) => C(a.re * k, a.im * k);
export const div = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const conj = (a) => C(a.re, -a.im);
export const abs = (a) => Math.hypot(a.re, a.im);
export const polar = (r, theta) => C(r * Math.cos(theta), r * Math.sin(theta));
export const angle = (a) => (Math.atan2(a.im, a.re) * 180) / Math.PI;
export const parallel = (a, b) => div(mul(a, b), add(a, b));
export function transformer(a, fraction = 1) {
  const V = C(a.voltage),
    Z1 = C(a.r1, a.x1),
    Z2 = C(a.r2, a.x2),
    Y = C(1 / a.core, -1 / a.magnetizing),
    Zload = polar(
      a.voltage ** 2 / (a.rating * 1000 * fraction),
      (a.kind === 'lag' ? 1 : -1) * Math.acos(a.factor),
    ),
    E = div(V, add(C(1), mul(Z1, add(Y, div(C(1), add(Z2, Zload)))))),
    I2 = div(E, add(Z2, Zload)),
    I0 = mul(E, Y),
    I1 = add(I2, I0),
    V2 = mul(I2, Zload),
    output = mul(V2, conj(I2)).re,
    core = abs(E) ** 2 / a.core,
    copper = abs(I1) ** 2 * a.r1 + abs(I2) ** 2 * a.r2,
    noload = abs(div(V, add(C(1), mul(Z1, Y)))) / a.ratio;
  return {
    secondary: abs(V2) / a.ratio,
    efficiency: output / (output + core + copper),
    regulation: ((noload - abs(V2) / a.ratio) / (abs(V2) / a.ratio)) * 100,
    current: abs(I1),
    noload,
    output,
    core,
    copper,
    E,
    I1,
    I2,
  };
}
export function induction(a, s = a.slip) {
  const V = C(a.voltage / Math.sqrt(3)),
    Z1 = C(a.r1, a.x1),
    Zm = C(0, a.xm),
    Z2 = C(a.r2 / s, a.x2),
    Vth = mul(V, div(Zm, add(Z1, Zm))),
    Zth = parallel(Z1, Zm),
    I2 = div(Vth, add(Zth, Z2)),
    I1 = div(V, add(Z1, parallel(Zm, Z2))),
    sync = (4 * Math.PI * a.frequency) / a.poles,
    gap = (3 * abs(I2) ** 2 * a.r2) / s,
    mechanical = (1 - s) * gap,
    input = 3 * mul(V, conj(I1)).re;
  return {
    torque: gap / sync,
    speed: ((1 - s) * 120 * a.frequency) / a.poles,
    gap,
    mechanical,
    input,
    rotorloss: s * gap,
    statorloss: 3 * abs(I1) ** 2 * a.r1,
    current: abs(I1),
    Vth,
    Zth,
  };
}
export function piLine(a, length = a.length) {
  const Z = C(a.resistance * length, a.reactance * length),
    Y = C(0, a.susceptance * 1e-6 * length),
    A = add(C(1), scale(mul(Y, Z), 0.5)),
    B = Z,
    D = A,
    Cm = mul(Y, add(C(1), scale(mul(Y, Z), 0.25))),
    Vr = C((a.voltage * 1000) / Math.sqrt(3)),
    Ir = C((a.real * 1e6) / (3 * Vr.re), (-a.reactive * 1e6) / (3 * Vr.re)),
    Vs = add(mul(A, Vr), mul(B, Ir)),
    Is = add(mul(Cm, Vr), mul(D, Ir)),
    Vno = div(Vr, A),
    seriesI = add(Ir, scale(mul(Y, Vr), 0.5));
  return {
    A,
    B,
    C: Cm,
    D,
    sending: (abs(Vs) * Math.sqrt(3)) / 1000,
    noload: (abs(Vno) * Math.sqrt(3)) / 1000,
    ferranti: (abs(Vno) / abs(Vr) - 1) * 100,
    loss: (3 * Z.re * abs(seriesI) ** 2) / 1e6,
    input: (3 * mul(Vs, conj(Is)).re) / 1e6,
    Vs,
    Is,
  };
}
export function faultSequences(a) {
  const E = C(1),
    Z1 = C(0, a.positive),
    Z2 = C(0, a.negative),
    Z0 = C(0, a.zero),
    Zf = C(0, a.fault),
    Zg = add(Z0, scale(Zf, 3));
  let I0 = C(),
    I1,
    I2 = C();
  if (a.type === 'three') I1 = div(E, add(Z1, Zf));
  else if (a.type === 'ground') {
    I1 = div(E, add(add(Z1, Z2), Zg));
    I0 = I1;
    I2 = I1;
  } else if (a.type === 'line') {
    I1 = div(E, add(add(Z1, Z2), Zf));
    I2 = scale(I1, -1);
  } else {
    I1 = div(E, add(Z1, parallel(Z2, Zg)));
    I2 = scale(mul(I1, div(Zg, add(Z2, Zg))), -1);
    I0 = scale(mul(I1, div(Z2, add(Z2, Zg))), -1);
  }
  const alpha = C(-0.5, Math.sqrt(3) / 2),
    alpha2 = conj(alpha),
    transform = (v0, v1, v2) => [
      add(add(v0, v1), v2),
      add(add(v0, mul(alpha2, v1)), mul(alpha, v2)),
      add(add(v0, mul(alpha, v1)), mul(alpha2, v2)),
    ],
    voltages = [scale(mul(Z0, I0), -1), sub(E, mul(Z1, I1)), scale(mul(Z2, I2), -1)];
  return {
    sequences: [I0, I1, I2],
    phases: transform(I0, I1, I2),
    voltages: transform(...voltages),
  };
}

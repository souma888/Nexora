import {
  check,
  number,
  identifier,
  jsonProject,
  zeros,
  solve,
  maxabs,
  dot,
} from './builder-core.js';
const DEG = Math.PI / 180;
export const mechanismExample = JSON.stringify({
  bodies: [
    {
      id: 'bar',
      x: 0.5 * Math.cos(-70 * DEG),
      y: 0.5 * Math.sin(-70 * DEG),
      angle: -70,
      mass: 1,
      inertia: 1 / 12,
      length: 1,
    },
  ],
  joints: [
    { id: 'pin', type: 'revolute', a: 'ground', b: 'bar', anchorA: [0, 0], anchorB: [-0.5, 0] },
  ],
  probe: { body: 'bar', point: [0.5, 0] },
});
export function parseMechanism(source) {
  const p = jsonProject(source);
  check(
    Array.isArray(p.bodies) &&
      p.bodies.length >= 1 &&
      p.bodies.length <= 10 &&
      Array.isArray(p.joints) &&
      p.joints.length <= 30,
    'Use 1…10 bodies and at most 30 constraints/joints.',
  );
  const ids = new Set(['ground']);
  for (const b of p.bodies) {
    check(identifier(b.id) && !ids.has(b.id), 'Body IDs must be unique, and ground is reserved.');
    ids.add(b.id);
    for (const key of ['x', 'y']) number(b[key], -20, 20, 'Body position');
    number(b.angle, -3600, 3600, 'Body angle in degrees');
    number(b.mass, 0.01, 1000, 'Body mass');
    number(b.inertia, 1e-5, 1e4, 'Centroidal inertia');
    number(b.length ?? 1, 0.01, 20, 'Display length');
    if (b.velocity) {
      check(
        Array.isArray(b.velocity) && b.velocity.length === 3,
        'Velocity is [vx,vy,angular degrees/s].',
      );
      b.velocity.forEach((v) => number(v, -100, 100, 'Initial velocity'));
    }
    if (b.force) {
      check(
        Array.isArray(b.force) && b.force.length === 3,
        'Body force is [Fx,Fy,torque] in N,N,N·m.',
      );
      b.force.forEach((v) => number(v, -1e5, 1e5, 'Body force'));
    }
  }
  const jointIDs = new Set();
  let constraints = 0;
  for (const j of p.joints) {
    check(identifier(j.id) && !jointIDs.has(j.id), 'Joints need unique letter-led IDs.');
    jointIDs.add(j.id);
    check(
      ids.has(j.a) && ids.has(j.b) && j.a !== j.b,
      'A joint connects two distinct existing bodies or ground.',
    );
    check(
      ['revolute', 'distance', 'prismatic', 'weld', 'driver'].includes(j.type),
      'Unsupported joint type.',
    );
    for (const key of ['anchorA', 'anchorB']) {
      check(
        Array.isArray(j[key]) && j[key].length === 2,
        'Joint anchors are local [x,y] metres; ground anchors are world coordinates.',
      );
      j[key].forEach((v) => number(v, -20, 20, 'Anchor'));
    }
    if (j.type === 'distance') number(j.length, 0.001, 40, 'Distance length');
    if (j.type === 'prismatic') {
      number(j.axis ?? 0, -360, 360, 'Slot axis in body A degrees');
      number(j.angle ?? 0, -3600, 3600, 'Relative angle');
    }
    if (j.type === 'weld') number(j.angle ?? 0, -3600, 3600, 'Weld relative angle');
    if (j.type === 'driver') {
      number(j.angle ?? 0, -3600, 3600, 'Driver initial angle');
      number(j.speed ?? 0, -720, 720, 'Driver angular speed');
    }
    constraints +=
      j.type === 'revolute' ? 2 : j.type === 'prismatic' ? 2 : j.type === 'weld' ? 3 : 1;
  }
  check(
    constraints <= 3 * p.bodies.length,
    'More constraints than generalized coordinates; remove redundant joints.',
  );
  check(
    p.probe &&
      ids.has(p.probe.body) &&
      p.probe.body !== 'ground' &&
      Array.isArray(p.probe.point) &&
      p.probe.point.length === 2,
    'Probe is {body,point:[local x,local y]}.',
  );
  p.probe.point.forEach((v) => number(v, -20, 20, 'Probe coordinate'));
  return { ...p, constraints };
}
export function mechanismConstraints(p, q, t) {
  const pose = (id) => {
      const i = p.bodies.findIndex((b) => b.id === id);
      return i < 0 ? [0, 0, 0] : q.slice(3 * i, 3 * i + 3);
    },
    world = (pose, anchor) => [
      pose[0] + Math.cos(pose[2]) * anchor[0] - Math.sin(pose[2]) * anchor[1],
      pose[1] + Math.sin(pose[2]) * anchor[0] + Math.cos(pose[2]) * anchor[1],
    ],
    values = [];
  for (const j of p.joints) {
    const a = pose(j.a),
      b = pose(j.b),
      A = world(a, j.anchorA),
      B = world(b, j.anchorB),
      dx = B[0] - A[0],
      dy = B[1] - A[1];
    if (j.type === 'revolute' || j.type === 'weld') values.push(dx, dy);
    if (j.type === 'distance')
      values.push((dx * dx + dy * dy - j.length * j.length) / (2 * j.length));
    if (j.type === 'prismatic') {
      const theta = a[2] + (j.axis ?? 0) * DEG;
      values.push(-Math.sin(theta) * dx + Math.cos(theta) * dy, b[2] - a[2] - (j.angle ?? 0) * DEG);
    }
    if (j.type === 'weld') values.push(b[2] - a[2] - (j.angle ?? 0) * DEG);
    if (j.type === 'driver') values.push(b[2] - a[2] - ((j.angle ?? 0) + (j.speed ?? 0) * t) * DEG);
  }
  return values;
}
export function constraintJacobian(p, q, t) {
  const C = mechanismConstraints(p, q, t),
    J = zeros(C.length, q.length);
  for (let i = 0; i < q.length; i++) {
    const h = 1e-6 * Math.max(1, Math.abs(q[i])),
      a = [...q],
      b = [...q];
    a[i] += h;
    b[i] -= h;
    const plus = mechanismConstraints(p, a, t),
      minus = mechanismConstraints(p, b, t);
    for (let r = 0; r < C.length; r++) J[r][i] = (plus[r] - minus[r]) / (2 * h);
  }
  return J;
}
export function projectMechanism(p, initial, t, mass) {
  let q = [...initial],
    iterations = 0;
  for (; iterations < 40; iterations++) {
    const C = mechanismConstraints(p, q, t);
    if (maxabs(C) < 1e-9) return { q, iterations, residual: maxabs(C) };
    const J = constraintJacobian(p, q, t),
      W = J.map((a) => J.map((b) => a.reduce((s, v, i) => s + (v * b[i]) / mass[i], 0))),
      lambda = solve(W, C),
      delta = q.map((_, i) => -J.reduce((s, r, k) => s + r[i] * lambda[k], 0) / mass[i]);
    let factor = 1,
      accepted = false;
    for (let k = 0; k < 15; k++) {
      const candidate = q.map((v, i) => v + factor * delta[i]);
      if (maxabs(mechanismConstraints(p, candidate, t)) < maxabs(C)) {
        q = candidate;
        accepted = true;
        break;
      }
      factor /= 2;
    }
    check(
      accepted,
      'Constraint projection stalled: the requested assembly may be infeasible or at a toggle.',
    );
  }
  throw Error('Constraint projection did not converge in 40 iterations.');
}
export function solveMechanism(
  source,
  { duration = 4, steps = 800, gravity = 9.80665, damping = 0, analysis = 'dynamics' } = {},
) {
  const p = parseMechanism(source);
  number(duration, 0.01, 20, 'Duration');
  number(steps, 20, 2000, 'Steps');
  check(Number.isInteger(steps), 'Steps must be integral.');
  number(gravity, 0, 20, 'Gravity');
  number(damping, 0, 5, 'Mass-proportional damping');
  check(['dynamics', 'kinematics'].includes(analysis), 'Choose dynamics or kinematics.');
  const n = 3 * p.bodies.length,
    mass = p.bodies.flatMap((b) => [b.mass, b.mass, b.inertia]),
    initial = p.bodies.flatMap((b) => [b.x, b.y, b.angle * DEG]),
    initialV = p.bodies.flatMap((b) =>
      b.velocity ? [b.velocity[0], b.velocity[1], b.velocity[2] * DEG] : [0, 0, 0],
    );
  let q = projectMechanism(p, initial, 0, mass).q,
    v = initialV,
    maxResidual = 0,
    peakSpeed = 0,
    energy0 = null,
    maxDrift = 0;
  const h = duration / steps,
    frames = [],
    series = [],
    stride = Math.max(1, Math.ceil(steps / 400));
  const timeDerivative = (_t) =>
    p.joints.flatMap((j) =>
      j.type === 'revolute'
        ? [0, 0]
        : j.type === 'weld'
          ? [0, 0, 0]
          : j.type === 'prismatic'
            ? [0, 0]
            : [j.type === 'driver' ? -(j.speed ?? 0) * DEG : 0],
    );
  const velocityProject = (q, v, t) => {
    if (!p.constraints) return v;
    const J = constraintJacobian(p, q, t),
      ct = timeDerivative(t),
      rhs = J.map((r, i) => dot(r, v) + ct[i]),
      W = J.map((a) => J.map((b) => a.reduce((s, x, i) => s + (x * b[i]) / mass[i], 0))),
      lambda = solve(W, rhs);
    return v.map((x, i) => x - J.reduce((s, r, j) => s + r[i] * lambda[j], 0) / mass[i]);
  };
  function acceleration(q, v, t) {
    const force = p.bodies.flatMap((b, i) => [
      (b.force?.[0] ?? 0) - damping * b.mass * v[3 * i],
      (b.force?.[1] ?? 0) - b.mass * gravity - damping * b.mass * v[3 * i + 1],
      (b.force?.[2] ?? 0) - damping * b.inertia * v[3 * i + 2],
    ]);
    if (!p.constraints) return force.map((f, i) => f / mass[i]);
    const J = constraintJacobian(p, q, t),
      e = 1e-4,
      plus = mechanismConstraints(
        p,
        q.map((x, i) => x + e * v[i]),
        t + e,
      ),
      minus = mechanismConstraints(
        p,
        q.map((x, i) => x - e * v[i]),
        t - e,
      ),
      C = mechanismConstraints(p, q, t),
      gamma = C.map((x, i) => (plus[i] - 2 * x + minus[i]) / (e * e)),
      K = zeros(n + p.constraints),
      rhs = [...force, ...gamma.map((x) => -x)];
    for (let i = 0; i < n; i++) K[i][i] = mass[i];
    J.forEach((row, j) =>
      row.forEach((x, i) => {
        K[i][n + j] = x;
        K[n + j][i] = x;
      }),
    );
    return solve(K, rhs).slice(0, n);
  }
  v = velocityProject(q, v, 0);
  if (analysis === 'kinematics')
    check(
      p.constraints === n,
      'Kinematic replay needs exactly zero unconstrained DOFs; add a driver or use dynamics.',
    );
  for (let k = 0; k <= steps; k++) {
    const t = k * h,
      C = mechanismConstraints(p, q, t),
      residual = maxabs(C);
    maxResidual = Math.max(maxResidual, residual);
    check(
      q.every(Number.isFinite) && v.every((x) => Number.isFinite(x) && Math.abs(x) < 1e5),
      'Motion left the bounded solver domain. Reduce step or forcing.',
    );
    const energy =
      0.5 *
        dot(
          mass,
          v.map((x) => x * x),
        ) +
      p.bodies.reduce((s, b, i) => s + b.mass * gravity * q[3 * i + 1], 0);
    if (energy0 === null) energy0 = energy;
    maxDrift = Math.max(maxDrift, Math.abs(energy - energy0));
    peakSpeed = Math.max(peakSpeed, ...p.bodies.map((_, i) => Math.hypot(v[3 * i], v[3 * i + 1])));
    if (k % stride === 0 || k === steps) {
      const i = p.bodies.findIndex((b) => b.id === p.probe.body),
        x = q[3 * i],
        y = q[3 * i + 1],
        angle = q[3 * i + 2],
        [px, py] = p.probe.point,
        probe = [
          x + Math.cos(angle) * px - Math.sin(angle) * py,
          y + Math.sin(angle) * px + Math.cos(angle) * py,
        ];
      frames.push({ t, q: [...q], v: [...v], residual, energy, probe });
      series.push({ x: t, y: probe[0], reference: probe[1], third: energy });
    }
    if (k === steps) break;
    if (analysis === 'kinematics') {
      q = projectMechanism(p, q, t + h, mass).q;
      const J = constraintJacobian(p, q, t + h),
        ct = timeDerivative(t + h);
      v = solve(
        J,
        ct.map((x) => -x),
      );
    } else {
      const a = acceleration(q, v, t),
        half = v.map((x, i) => x + 0.5 * h * a[i]),
        predicted = q.map((x, i) => x + h * half[i]),
        corrected = projectMechanism(p, predicted, t + h, mass).q;
      for (let i = 0; i < n; i++) half[i] += (corrected[i] - predicted[i]) / h;
      q = corrected;
      const nextA = acceleration(q, half, t + h);
      v = velocityProject(
        q,
        half.map((x, i) => x + 0.5 * h * nextA[i]),
        t + h,
      );
    }
  }
  return {
    summary: { dofs: n - p.constraints, residual: maxResidual, speed: peakSpeed, drift: maxDrift },
    series,
    visualization: { type: 'builder', kind: 'mechanism', project: p, frames },
    table: {
      caption: 'Final rigid-body state',
      headers: ['Body', 'x (m)', 'y (m)', 'angle (°)'],
      rows: p.bodies.map((b, i) => [b.id, q[3 * i], q[3 * i + 1], q[3 * i + 2] / DEG]),
    },
    warnings:
      p.joints.some((j) => j.type === 'driver') || damping > 0
        ? [
            'Drivers and damping exchange energy. Energy change is not an integration-error estimate in this case.',
          ]
        : [
            'Check energy drift against a halved timestep. Projection controls constraint drift but does not make the trajectory exact.',
          ],
  };
}

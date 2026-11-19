import {
  exploration as lab,
  p,
  integer,
  choice,
  textInput,
  seq,
  rad,
  teaching,
  output,
  domain,
  requireValue,
  random,
} from './exploration-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'robotics', topic: 'Robot planning & geometry', ...config }, solve);
export function segmentClear(a, b, obstacles, margin = 0) {
  return obstacles.every(([x, y, r]) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      den = dx * dx + dy * dy,
      t = den === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / den));
    return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y) > r + margin;
  });
}
export function plannerData(a) {
  const parse = (s) => JSON.parse(s),
    start = parse(a.start),
    goal = parse(a.goal),
    obstacles = parse(a.obstacles);
  requireValue(
    [start, goal].every(
      (v) =>
        Array.isArray(v) &&
        v.length === 2 &&
        v.every((x) => Number.isFinite(x) && x >= 0.1 && x <= 9.9),
    ),
    'Start and goal must be [x,y] within 0.1…9.9.',
  );
  requireValue(
    Array.isArray(obstacles) &&
      obstacles.length <= 12 &&
      obstacles.every(
        (v) =>
          Array.isArray(v) &&
          v.length === 3 &&
          v.every(Number.isFinite) &&
          v[0] >= 0 &&
          v[0] <= 10 &&
          v[1] >= 0 &&
          v[1] <= 10 &&
          v[2] >= 0.1 &&
          v[2] <= 2,
      ),
    'Use up to 12 circular obstacles [x,y,r], coordinates 0…10 and radius .1…2.',
  );
  requireValue(
    segmentClear(start, start, obstacles, 0.1) && segmentClear(goal, goal, obstacles, 0.1),
    'Start and goal must clear obstacles plus the 0.1 robot radius.',
  );
  return { start, goal, obstacles };
}
export function rrt(start, goal, obstacles, seed, iterations, step) {
  if (Math.hypot(start[0] - goal[0], start[1] - goal[1]) < 1e-12)
    return { nodes: [start], parents: [-1], path: [start] };
  const rng = random(seed),
    nodes = [start],
    parents = [-1];
  let end = -1;
  for (let k = 0; k < iterations; k++) {
    const target = rng() < 0.15 ? goal : [rng() * 10, rng() * 10],
      nearest = nodes.reduce(
        (best, v, i) =>
          Math.hypot(v[0] - target[0], v[1] - target[1]) <
          Math.hypot(nodes[best][0] - target[0], nodes[best][1] - target[1])
            ? i
            : best,
        0,
      ),
      from = nodes[nearest],
      distance = Math.hypot(target[0] - from[0], target[1] - from[1]);
    if (distance < 1e-10) continue;
    const scale = Math.min(step, distance) / distance,
      to = [from[0] + scale * (target[0] - from[0]), from[1] + scale * (target[1] - from[1])];
    if (!segmentClear(from, to, obstacles, 0.1)) continue;
    nodes.push(to);
    parents.push(nearest);
    if (
      Math.hypot(to[0] - goal[0], to[1] - goal[1]) <= step &&
      segmentClear(to, goal, obstacles, 0.1)
    ) {
      parents.push(nodes.length - 1);
      nodes.push(goal);
      end = nodes.length - 1;
      break;
    }
  }
  const path = [];
  while (end >= 0) {
    path.unshift(nodes[end]);
    end = parents[end];
  }
  return { nodes, parents, path };
}
const plannerFields = {
  start: textInput('Start [x,y]', '[1,1]', 60),
  goal: textInput('Goal [x,y]', '[9,9]', 60),
  obstacles: textInput('Circular obstacles [x,y,r]', '[[5,5,1.4],[3,7,0.8],[7,3,0.8]]', 500),
};
export function trajectoryProfile(distance, vmax, amax, t) {
  const ramp = Math.min(vmax / amax, Math.sqrt(distance / amax)),
    peak = amax * ramp,
    coast = Math.max(0, (distance - amax * ramp * ramp) / peak),
    total = 2 * ramp + coast;
  if (t < ramp)
    return { position: (amax * t * t) / 2, velocity: amax * t, acceleration: amax, total };
  if (t < ramp + coast)
    return { position: peak * (t - ramp / 2), velocity: peak, acceleration: 0, total };
  const remaining = Math.max(0, total - t);
  return {
    position: distance - (amax * remaining * remaining) / 2,
    velocity: amax * remaining,
    acceleration: t < total ? -amax : 0,
    total,
  };
}
export function quaternionZYX(roll, pitch, yaw) {
  const cr = Math.cos(roll / 2),
    sr = Math.sin(roll / 2),
    cp = Math.cos(pitch / 2),
    sp = Math.sin(pitch / 2),
    cy = Math.cos(yaw / 2),
    sy = Math.sin(yaw / 2);
  return [
    cr * cp * cy + sr * sp * sy,
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
  ];
}
export const roboticsStudyModels = {
  armjacobian: make(
    {
      id: 'armjacobian',
      title: 'Robot Jacobian and Singularities',
      inputs: {
        first: p('First link length', 'm', 0.2, 2, 1),
        second: p('Second link length', 'm', 0.2, 2, 0.8),
        theta: p('Shoulder angle', '°', -180, 180, 30),
        elbow: p('Elbow relative angle', '°', -180, 180, 45),
        velocity: p('Shoulder angular velocity', 'rad/s', -2, 2, 1),
      },
      metrics: {
        determinant: ['Jacobian determinant', 'm²'],
        manipulability: ['Yoshikawa manipulability |det J|', 'm²'],
        condition: ['Jacobian 2-norm condition number', '1'],
        speed: ['End speed with elbow rate zero', 'm/s'],
      },
      plot: { x: 'Elbow angle', xUnit: '°', y: 'Manipulability', yUnit: 'm²' },
      text: teaching(
        'Construct the planar two-link Jacobian and inspect its determinant, velocity mapping and singular-value conditioning.',
        'At a fully straight arm, can the tool move instantaneously in every Cartesian direction?',
        ['No', 'Yes', 'Only if both links match'],
        'At θ₂=0 or π the Jacobian loses rank and one instantaneous motion direction disappears.',
        'For unit links at θ₂=90°, det J=1 m²; at θ₂=0°, det J=0.',
        'J=[−l₁sinθ₁−l₂sin(θ₁+θ₂),−l₂sin(θ₁+θ₂); l₁cosθ₁+l₂cos(θ₁+θ₂),l₂cos(θ₁+θ₂)]; detJ=l₁l₂sinθ₂.',
        'Rigid planar revolute links and differential kinematics. Infinite condition number at singularity is reported as null; no dynamics, joint limits or collision model.',
      ),
    },
    (a) => {
      const t = rad(a.theta),
        e = rad(a.elbow),
        J = [
          [-a.first * Math.sin(t) - a.second * Math.sin(t + e), -a.second * Math.sin(t + e)],
          [a.first * Math.cos(t) + a.second * Math.cos(t + e), a.second * Math.cos(t + e)],
        ],
        det = a.first * a.second * Math.sin(e),
        trace = J.flat().reduce((s, v) => s + v * v, 0),
        delta = Math.sqrt(Math.max(0, trace * trace - 4 * det * det)),
        large = (trace + delta) / 2,
        small = (det * det) / large;
      return output(
        {
          determinant: det,
          manipulability: Math.abs(det),
          condition: small < 1e-20 ? null : Math.sqrt(large / small),
          speed: Math.hypot(J[0][0], J[1][0]) * Math.abs(a.velocity),
        },
        seq(-180, 180, 360).map((x) => ({ x, y: Math.abs(a.first * a.second * Math.sin(rad(x))) })),
        'robot-arm',
        {
          joints: [
            [0, 0],
            [a.first * Math.cos(t), a.first * Math.sin(t)],
            [
              a.first * Math.cos(t) + a.second * Math.cos(t + e),
              a.first * Math.sin(t) + a.second * Math.sin(t + e),
            ],
          ],
          jacobian: J,
        },
      );
    },
  ),
  trajectoryplanning: make(
    {
      id: 'trajectoryplanning',
      title: 'Trapezoidal and Quintic Trajectory Planning',
      inputs: {
        distance: p('Positive move distance', 'm', 0.1, 10, 2),
        velocity: p('Velocity limit', 'm/s', 0.1, 3, 1),
        acceleration: p('Acceleration limit', 'm/s²', 0.1, 5, 2),
        profile: choice('Motion profile', ['trapezoid', 'quintic'], 'trapezoid'),
      },
      metrics: {
        time: ['Computed feasible motion duration', 's'],
        velocity: ['Sampled peak velocity', 'm/s'],
        acceleration: ['Sampled peak acceleration', 'm/s²'],
      },
      plot: {
        traceUnits: { reference: 'm/s', third: 'm/s²' },
        x: 'Time',
        xUnit: 's',
        y: 'Position',
        yUnit: 'm',
        traces: { y: 'Position', reference: 'Velocity (m/s)', third: 'Acceleration (m/s²)' },
      },
      text: teaching(
        'Construct a triangular/trapezoidal move or a quintic rest-to-rest move whose duration respects supplied speed and acceleration limits.',
        'Can a short trapezoidal move reach the requested maximum speed?',
        ['Not always; it becomes triangular', 'Always', 'Only with zero acceleration'],
        'If distance is below vmax²/amax there is no cruise segment.',
        'For d=2 m, vmax=1 m/s and amax=2 m/s², the trapezoidal duration is 2.5 s.',
        'Trapezoid: ta=min(vmax/amax,√(d/amax)); quintic q=d(10s³−15s⁴+6s⁵), T≥max(1.875d/vmax,√[(10/√3)d/amax]).',
        'One positive scalar axis, zero initial/final velocity. Quintic also has zero endpoint acceleration; trapezoid has acceleration jumps. No jerk limit, actuator load or multi-axis collision scheduling.',
      ),
    },
    (a) => {
      const total =
          a.profile === 'trapezoid'
            ? trajectoryProfile(a.distance, a.velocity, a.acceleration, 0).total
            : Math.max(
                (1.875 * a.distance) / a.velocity,
                Math.sqrt(((10 / Math.sqrt(3)) * a.distance) / a.acceleration),
              ),
        s = seq(0, total, 400).map((x) => {
          const t = x / total,
            r =
              a.profile === 'trapezoid'
                ? trajectoryProfile(a.distance, a.velocity, a.acceleration, x)
                : {
                    position: a.distance * (10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5),
                    velocity: (a.distance / total) * (30 * t * t - 60 * t ** 3 + 30 * t ** 4),
                    acceleration: (a.distance / total ** 2) * (60 * t - 180 * t * t + 120 * t ** 3),
                  };
          return { x, y: r.position, reference: r.velocity, third: r.acceleration };
        });
      return output(
        {
          time: total,
          velocity: Math.max(...s.map((v) => v.reference)),
          acceleration: Math.max(...s.map((v) => Math.abs(v.third))),
        },
        s,
        'trajectory',
        { ...a },
      );
    },
  ),
  potentialnavigation: make(
    {
      id: 'potentialnavigation',
      title: 'Potential-Field Robot Navigation',
      inputs: {
        ...plannerFields,
        repulsion: p('Repulsive potential gain', '1', 0.01, 3, 0.2),
        influence: p('Obstacle influence distance', 'm', 0.3, 3, 1.5),
      },
      validateValues: domain('obstacles', plannerData),
      metrics: {
        reached: ['Reached within 0.15 m', 'boolean'],
        length: ['Collision-checked path length', 'm'],
        remaining: ['Distance to goal', 'm'],
      },
      plot: { x: 'Iteration', xUnit: '1', y: 'Distance to goal', yUnit: 'm' },
      text: teaching(
        'Integrate a local attractive/repulsive navigation field with backtracking collision checks and expose local-minimum failure.',
        'Can a potential-field planner get stuck before the goal?',
        ['Yes', 'No', 'Only without obstacles'],
        'Competing attractive and repulsive gradients can cancel at a nonglobal minimum.',
        'With no obstacles, the normalized attractive direction traces a straight collision-free path toward the goal.',
        'Uatt=½||q−g||²; Urep=½η(1/d−1/d₀)² for d<d₀; move along −∇U.',
        'Planar 0…10 world, circular obstacles inflated by a 0.1 robot radius. Collision-checked steps ≤0.06, at most 1200 iterations. Local minima and iteration limits are reported without inventing a successful path.',
      ),
    },
    (a) => {
      const { start, goal, obstacles } = plannerData(a),
        path = [start],
        s = [];
      let q = [...start],
        length = 0;
      for (let k = 0; k < 1200; k++) {
        const distance = Math.hypot(q[0] - goal[0], q[1] - goal[1]);
        s.push({ x: k, y: distance });
        if (distance < 0.15) break;
        let fx = goal[0] - q[0],
          fy = goal[1] - q[1];
        for (const [x, y, r] of obstacles) {
          const dx = q[0] - x,
            dy = q[1] - y,
            n = Math.hypot(dx, dy),
            d = Math.max(0.01, n - r - 0.1);
          if (d < a.influence) {
            const force = (a.repulsion * (1 / d - 1 / a.influence)) / (d * d);
            fx += (force * dx) / n;
            fy += (force * dy) / n;
          }
        }
        const norm = Math.hypot(fx, fy);
        if (norm < 1e-8) break;
        let step = Math.min(0.06, norm * 0.08),
          to;
        for (let j = 0; j < 12; j++) {
          to = [q[0] + (step * fx) / norm, q[1] + (step * fy) / norm];
          if (to.every((x) => x >= 0.1 && x <= 9.9) && segmentClear(q, to, obstacles, 0.1)) break;
          step /= 2;
        }
        if (step < 1e-5) break;
        length += Math.hypot(to[0] - q[0], to[1] - q[1]);
        q = to;
        path.push(q);
      }
      const remaining = Math.hypot(q[0] - goal[0], q[1] - goal[1]);
      return output(
        { reached: +(remaining < 0.15), length, remaining },
        s,
        'planner',
        { start, goal, obstacles, path },
        [],
        remaining >= 0.15
          ? [
              'The local planner did not reach the goal. This can indicate a local minimum or the iteration limit.',
            ]
          : [],
      );
    },
  ),
  rrtplanner: make(
    {
      id: 'rrtplanner',
      title: 'Rapidly Exploring Random Tree Path Planning',
      inputs: {
        ...plannerFields,
        seed: integer('Sampling seed', 1, 9999, 42),
        iterations: integer('Maximum extensions', 50, 2000, 700),
        step: p('Maximum extension length', 'm', 0.1, 1, 0.5),
      },
      validateValues: domain('obstacles', plannerData),
      metrics: {
        reached: ['Collision-free goal connection found', 'boolean'],
        nodes: ['Accepted tree nodes', '1'],
        length: ['Path length if found', 'm'],
      },
      plot: { x: 'Accepted node index', xUnit: '1', y: 'Distance to goal', yUnit: 'm' },
      text: teaching(
        'Grow an actual seeded RRT with nearest-node search, bounded extension and analytic segment-circle collision checking.',
        'Does ordinary RRT guarantee the shortest path?',
        ['No', 'Yes', 'Only with a fixed seed'],
        'RRT seeks a feasible path; asymptotic optimality requires algorithms such as RRT*.',
        'Every accepted tree edge must clear all obstacle radii plus the robot’s 0.1 m radius.',
        'qnew=qnear+min(δ,||qrand−qnear||)(qrand−qnear)/||qrand−qnear||.',
        'Planar circular obstacles, 15% goal bias, uniform world samples and a finite extension budget. Failure to connect is not proof of impossibility. No smoothing, rewiring or dynamic obstacle prediction.',
      ),
    },
    (a) => {
      const { start, goal, obstacles } = plannerData(a),
        r = rrt(start, goal, obstacles, a.seed, a.iterations, a.step),
        length = r.path.length
          ? r.path
              .slice(1)
              .reduce((s, v, i) => s + Math.hypot(v[0] - r.path[i][0], v[1] - r.path[i][1]), 0)
          : null;
      return output(
        { reached: +(r.path.length > 0), nodes: r.nodes.length, length },
        r.nodes.map((v, x) => ({ x, y: Math.hypot(v[0] - goal[0], v[1] - goal[1]) })),
        'planner',
        { start, goal, obstacles, ...r },
        [],
        r.path.length
          ? []
          : [
              'No goal connection within this seeded extension budget. Increase the budget or change the geometry.',
            ],
      );
    },
  ),
  rotations: make(
    {
      id: 'rotations',
      title: 'Euler Angles, Quaternions and Gimbal Lock',
      inputs: {
        roll: p('Roll about body x', '°', -180, 180, 20),
        pitch: p('Pitch', '°', -90, 90, 40),
        yaw: p('Yaw', '°', -180, 180, 30),
      },
      metrics: {
        norm: ['Quaternion norm', '1'],
        determinant: ['Rotation determinant', '1'],
        condition: ['Euler-rate Jacobian condition number', '1'],
      },
      plot: { x: 'Pitch', xUnit: '°', y: 'Euler-rate condition number', yUnit: '1' },
      text: teaching(
        'Build an active ZYX rotation, convert it to a unit quaternion, and show the singularity of the Euler-rate representation.',
        'Does gimbal lock mean the physical orientation ceases to exist?',
        ['No, the Euler coordinates become singular', 'Yes', 'Only for quaternions'],
        'The rotation and quaternion remain well-defined when yaw and roll axes align at ±90° pitch.',
        'Zero roll, pitch and yaw give quaternion [w,x,y,z]=[1,0,0,0] and identity matrix.',
        'R=Rz(yaw)Ry(pitch)Rx(roll); q=qz⊗qy⊗qx; κ₂=√[(1+|sin pitch|)/(1−|sin pitch|)].',
        'Right-handed active rotations of column vectors; intrinsic ZYX yaw–pitch–roll, quaternion scalar first. At exact gimbal lock condition is null (infinite). No discontinuity-free Euler-angle interpolation is implied.',
      ),
    },
    (a) => {
      const q = quaternionZYX(rad(a.roll), rad(a.pitch), rad(a.yaw)),
        [w, x, y, z] = q,
        R = [
          [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
          [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
          [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ],
        condition = (p) => {
          const s = Math.abs(Math.sin(rad(p)));
          return 1 - s < 1e-12 ? null : Math.sqrt((1 + s) / (1 - s));
        };
      return output(
        {
          norm: Math.hypot(...q),
          determinant:
            R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) -
            R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) +
            R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]),
          condition: condition(a.pitch),
        },
        seq(-90, 90, 360).map((x) => ({ x, y: condition(x) })),
        'orientation',
        { matrix: R, quaternion: q },
        q.map((v, i) => [['w', 'x', 'y', 'z'][i], v]),
      );
    },
  ),
  occupancygrid: make(
    {
      id: 'occupancygrid',
      title: 'Occupancy Grid Mapping with Lidar Rays',
      inputs: {
        x: p('Lidar x', 'm', 0.5, 9.5, 2),
        y: p('Lidar y', 'm', 0.5, 9.5, 2),
        rays: integer('Scan rays', 12, 180, 72),
        range: p('Maximum sensor range', 'm', 1, 10, 6),
      },
      validateValues: domain('x', (a) =>
        requireValue(
          segmentClear(
            [a.x, a.y],
            [a.x, a.y],
            [
              [5, 5, 1.2],
              [7, 3, 0.8],
              [3, 7, 1],
            ],
            0.05,
          ),
          'Lidar origin must be outside the illustrated obstacles.',
        ),
      ),
      metrics: {
        observed: ['Observed grid cells', '1'],
        occupied: ['Cells with occupancy probability > 0.5', '1'],
        unknown: ['Unobserved cells', '1'],
      },
      plot: { x: 'Ray angle', xUnit: '°', y: 'Measured range', yUnit: 'm' },
      text: teaching(
        'Ray-cast a simulated circular-obstacle scene and accumulate free/occupied evidence in a log-odds occupancy grid.',
        'Should cells behind a first lidar hit be marked free?',
        ['No, they remain unobserved', 'Yes', 'Only on alternate rays'],
        'A range sensor provides evidence only along the beam before its first return.',
        'An unobserved cell starts at p=.5; free evidence uses p=.3 and hit evidence p=.7 per update.',
        'lcell←lcell+log[p(z|occupied)/(1−p)]; p=1/(1+e⁻ˡ).',
        'Known exact sensor pose, noiseless 360° rays, 40×40 grid over 10 m square and three fixed circular obstacles. First-return endpoint update; no SLAM localization, probabilistic beam model or moving objects.',
      ),
    },
    (a) => {
      const obstacles = [
          [5, 5, 1.2],
          [7, 3, 0.8],
          [3, 7, 1],
        ],
        N = 40,
        log = Array(N * N).fill(0),
        seen = new Set(),
        rays = [],
        s = [];
      for (let k = 0; k < a.rays; k++) {
        const theta = (2 * Math.PI * k) / a.rays,
          dx = Math.cos(theta),
          dy = Math.sin(theta);
        let distance = a.range,
          hit = false;
        for (const [x, y, r] of obstacles) {
          const ox = a.x - x,
            oy = a.y - y,
            b = ox * dx + oy * dy,
            c = ox * ox + oy * oy - r * r,
            d = b * b - c;
          if (d >= 0) {
            const t = -b - Math.sqrt(d);
            if (t >= 0 && t < distance) {
              distance = t;
              hit = true;
            }
          }
        }
        const cells = new Set();
        for (let t = 0; t < distance; t += 0.05) {
          const x = Math.floor((a.x + t * dx) * 4),
            y = Math.floor((a.y + t * dy) * 4);
          if (x >= 0 && x < N && y >= 0 && y < N) cells.add(y * N + x);
        }
        const endpoint = [a.x + distance * dx, a.y + distance * dy],
          ex = Math.floor(endpoint[0] * 4),
          ey = Math.floor(endpoint[1] * 4),
          id = ey * N + ex;
        if (hit && ex >= 0 && ex < N && ey >= 0 && ey < N) cells.delete(id);
        for (const i of cells) {
          log[i] = Math.max(-5, log[i] + Math.log(0.3 / 0.7));
          seen.add(i);
        }
        if (hit && ex >= 0 && ex < N && ey >= 0 && ey < N) {
          log[id] = Math.min(5, log[id] + Math.log(0.7 / 0.3));
          seen.add(id);
        }
        rays.push([[a.x, a.y], endpoint]);
        s.push({ x: (k * 360) / a.rays, y: distance });
      }
      const probabilities = log.map((l) => 1 / (1 + Math.exp(-l)));
      return output(
        {
          observed: seen.size,
          occupied: probabilities.filter((v) => v > 0.5).length,
          unknown: N * N - seen.size,
        },
        s,
        'occupancy',
        { probabilities, size: N, rays, origin: [a.x, a.y] },
      );
    },
  ),
};

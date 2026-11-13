import { content } from './content/robotics.js';
import { lab, p, choice, samples, radians, degrees, clamp, table } from './lab-kit.js';
export function armPose(l1, l2, a, b) {
  const joint = [l1 * Math.cos(a), l1 * Math.sin(a)];
  return {
    points: [[0, 0], joint, [joint[0] + l2 * Math.cos(a + b), joint[1] + l2 * Math.sin(a + b)]],
    angles: [degrees(a), degrees(b)],
  };
}
export function fourbarPose(ground, crank, coupler, rocker, angle, branch) {
  const a = [crank * Math.cos(radians(angle)), crank * Math.sin(radians(angle))],
    d = [ground, 0],
    dx = d[0] - a[0],
    dy = d[1] - a[1],
    distance = Math.hypot(dx, dy);
  if (
    distance < 1e-10 ||
    distance > coupler + rocker + 1e-9 ||
    distance < Math.abs(coupler - rocker) - 1e-9
  )
    return null;
  const along = (coupler ** 2 - rocker ** 2 + distance ** 2) / (2 * distance),
    height = Math.sqrt(Math.max(0, coupler ** 2 - along ** 2)),
    sign = branch === 'open' ? 1 : -1;
  const b = [
    a[0] + (along * dx) / distance - (sign * height * dy) / distance,
    a[1] + (along * dy) / distance + (sign * height * dx) / distance,
  ];
  return {
    points: [[0, 0], a, b, d],
    couplerAngle: degrees(Math.atan2(b[1] - a[1], b[0] - a[0])),
    rockerAngle: degrees(Math.atan2(b[1], b[0] - ground)),
    error: Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - coupler),
  };
}
const lengths = {
  first: p('First link length', 'm', 0.2, 2, 1),
  second: p('Second link length', 'm', 0.2, 2, 0.8),
};
export const roboticModels = {
  arm: lab(
    {
      id: 'arm',
      title: 'Two-Link Arm Kinematics',
      discipline: 'robotics',
      lab: 'RM01',
      topic: 'Kinematics',
      initialProbe: 'end',
      inputs: {
        ...lengths,
        shoulder: p('Shoulder angle', '°', -180, 180, 30),
        elbow: p('Relative elbow angle', '°', -170, 170, 60),
      },
      metrics: {
        x: ['Target tool x', 'm'],
        y: ['Target tool y', 'm'],
        determinant: ['Jacobian determinant at target', 'm²'],
      },
      plot: {
        x: 'Motion preview fraction',
        xUnit: '',
        y: 'Tool coordinate',
        yUnit: 'm',
        traces: { y: 'Tool x', reference: 'Tool y' },
      },
      text: content['arm'],
    },
    ({ first, second, shoulder, elbow }) => {
      const a = radians(shoulder),
        b = radians(elbow),
        pose = armPose(first, second, a, b),
        frames = samples(0, 1, (t) => ({ ...armPose(first, second, a * t, b * t), fraction: t }));
      return {
        summary: {
          x: pose.points[2][0],
          y: pose.points[2][1],
          determinant: first * second * Math.sin(b),
        },
        series: frames.map((f) => ({ x: f.x, y: f.points[2][0], reference: f.points[2][1] })),
        visualization: {
          type: 'arm',
          frames,
          reach: first + second,
          inner: Math.abs(first - second),
          path: frames.map((f) => f.points[2]),
        },
        warnings:
          Math.abs(Math.sin(b)) < 0.02
            ? [
                'The target pose is close to a kinematic singularity; Cartesian motion can require very large joint-rate changes.',
              ]
            : [],
      };
    },
  ),
  inversearm: lab(
    {
      id: 'inversearm',
      title: 'Two-Link Inverse Kinematics',
      discipline: 'robotics',
      lab: 'RM02',
      topic: 'Inverse kinematics',
      interaction: 'arm-target',
      initialProbe: 'end',
      inputs: {
        ...lengths,
        x: p('Target x', 'm', -3, 3, 1),
        y: p('Target y', 'm', -3, 3, 1),
        branch: choice(
          'Elbow branch',
          { up: 'Positive elbow angle', down: 'Negative elbow angle' },
          'up',
        ),
      },
      metrics: {
        shoulder: ['Solved shoulder angle', '°'],
        elbow: ['Solved relative elbow angle', '°'],
        error: ['Target position error', 'm'],
      },
      plot: {
        x: 'Joint-space preview fraction',
        xUnit: '',
        y: 'Joint angle',
        yUnit: '°',
        traces: { y: 'Shoulder', reference: 'Elbow' },
      },
      text: content['inversearm'],
    },
    ({ first, second, x, y, branch }) => {
      const r = Math.hypot(x, y),
        c = (r * r - first * first - second * second) / (2 * first * second),
        reachable = Math.abs(c) <= 1 + 1e-10,
        b = (branch === 'up' ? 1 : -1) * Math.acos(clamp(c, -1, 1));
      const a =
        r < 1e-10 && Math.abs(first - second) < 1e-10
          ? 0
          : Math.atan2(y, x) - Math.atan2(second * Math.sin(b), first + second * Math.cos(b));
      const pose = armPose(first, second, a, b),
        error = Math.hypot(pose.points[2][0] - x, pose.points[2][1] - y),
        frames = samples(0, 1, (t) => ({ ...armPose(first, second, a * t, b * t), fraction: t }));
      return {
        summary: {
          shoulder: reachable ? degrees(a) : null,
          elbow: reachable ? degrees(b) : null,
          error,
        },
        series: frames.map((f) => ({ x: f.x, y: f.angles[0], reference: f.angles[1] })),
        visualization: {
          type: 'arm',
          frames,
          reach: first + second,
          inner: Math.abs(first - second),
          target: [x, y],
          reachable,
          path: frames.map((f) => f.points[2]),
        },
        warnings: !reachable
          ? [
              'Target is outside the reachable annulus. The dashed target and closest radial pose are shown; no exact inverse solution exists.',
            ]
          : r < 1e-10
            ? [
                'The folded origin solution is nonunique; the displayed shoulder angle is one convention.',
              ]
            : [],
        table: table(
          'Inverse-solution audit',
          ['Quantity', 'Value'],
          [
            ['Target radius (m)', r],
            ['Inner reach (m)', Math.abs(first - second)],
            ['Outer reach (m)', first + second],
            ['Reachable', reachable ? 'yes' : 'no'],
            ['Forward-substitution error (m)', error],
          ],
        ),
      };
    },
  ),
  fourbar: lab(
    {
      id: 'fourbar',
      title: 'Four-Bar Linkage Closure',
      discipline: 'robotics',
      lab: 'RM03',
      topic: 'Mechanisms',
      inputs: {
        ground: p('Ground length', 'm', 0.5, 2, 2),
        crank: p('Crank length', 'm', 0.2, 1, 0.5),
        coupler: p('Coupler length', 'm', 0.5, 3, 1.5),
        rocker: p('Rocker length', 'm', 0.5, 3, 1.2),
        angle: p('Crank angle', '°', 0, 360, 45),
        branch: choice(
          'Assembly branch',
          {
            open: 'Open / positive circle intersection',
            crossed: 'Crossed / negative circle intersection',
          },
          'open',
        ),
      },
      metrics: {
        coupler: ['Selected-pose coupler angle', '°'],
        rocker: ['Selected-pose rocker angle', '°'],
        error: ['Coupler closure residual', 'm'],
      },
      plot: { x: 'Crank angle sweep', xUnit: '°', y: 'Rocker angle', yUnit: '°' },
      text: content['fourbar'],
    },
    ({ ground, crank, coupler, rocker, angle, branch }) => {
      const pose = fourbarPose(ground, crank, coupler, rocker, angle, branch),
        series = samples(0, 360, (x) => ({
          y: fourbarPose(ground, crank, coupler, rocker, x, branch)?.rockerAngle ?? null,
        }));
      return {
        summary: {
          coupler: pose?.couplerAngle ?? null,
          rocker: pose?.rockerAngle ?? null,
          error: pose?.error ?? null,
        },
        series,
        visualization: { type: 'fourbar', pose, ground, crank, coupler, rocker, angle },
        warnings: pose
          ? []
          : [
              'The selected crank position has no real coupler/rocker intersection (or is a degenerate coincident-circle configuration). Choose another angle or link lengths.',
            ],
      };
    },
  ),
  differential: lab(
    {
      id: 'differential',
      title: 'Differential-Drive Robot',
      discipline: 'robotics',
      lab: 'RM04',
      topic: 'Mobile robotics',
      initialProbe: 'end',
      inputs: {
        radius: p('Wheel radius', 'm', 0.02, 0.2, 0.05),
        separation: p('Wheel separation', 'm', 0.1, 1, 0.3),
        left: p('Left wheel angular speed', 'rad/s', -10, 10, 4),
        right: p('Right wheel angular speed', 'rad/s', -10, 10, 8),
        duration: p('Drive duration', 's', 0.5, 10, 5),
      },
      metrics: {
        x: ['Final x', 'm'],
        y: ['Final y', 'm'],
        heading: ['Final unwrapped heading', '°'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Position',
        yUnit: 'm',
        traces: { y: 'x position', reference: 'y position' },
      },
      text: content['differential'],
    },
    ({ radius, separation, left, right, duration }) => {
      const speed = (radius * (left + right)) / 2,
        yaw = (radius * (right - left)) / separation;
      const frames = samples(0, duration, (t) => ({
          position:
            Math.abs(yaw) < 1e-10
              ? [speed * t, 0]
              : [(speed / yaw) * Math.sin(yaw * t), (speed / yaw) * (1 - Math.cos(yaw * t))],
          heading: yaw * t,
          time: t,
        })),
        final = frames.at(-1);
      return {
        summary: { x: final.position[0], y: final.position[1], heading: degrees(final.heading) },
        series: frames.map((f) => ({ x: f.x, y: f.position[0], reference: f.position[1] })),
        visualization: {
          type: 'mobile',
          frames,
          path: frames.map((f) => f.position),
          detail: `v ${speed.toFixed(3)} m/s · Ω ${yaw.toFixed(3)} rad/s`,
        },
      };
    },
  ),
  tracking: lab(
    {
      id: 'tracking',
      title: 'Planar Trajectory Tracking',
      discipline: 'robotics',
      lab: 'RM05',
      topic: 'Feedback & motion',
      initialProbe: 'end',
      inputs: {
        radius: p('Reference circle radius', 'm', 0.5, 2, 1),
        frequency: p('Reference angular speed', 'rad/s', 0.1, 1, 0.5),
        gain: p('Position feedback gain', '1/s', 0.1, 5, 1),
        duration: p('Tracking duration', 's', 1, 20, 10),
      },
      metrics: {
        error: ['Final tracking error', 'm'],
        rms: ['Continuous-time RMS position error', 'm'],
        peak: ['Peak sampled command speed', 'm/s'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Position error norm',
        yUnit: 'm',
        traces: { y: 'Tracking error', reference: 'Zero error' },
      },
      text: content['tracking'],
    },
    ({ radius: r, frequency: w, gain: k, duration }) => {
      const frames = samples(0, duration, (t) => ({
        position: [r * Math.cos(w * t) - r * Math.exp(-k * t), r * Math.sin(w * t)],
        reference: [r * Math.cos(w * t), r * Math.sin(w * t)],
        heading: Math.atan2(
          r * w * Math.cos(w * t),
          -r * w * Math.sin(w * t) + k * r * Math.exp(-k * t),
        ),
        time: t,
      }));
      const peak = Math.max(
        ...frames.map((f) =>
          Math.hypot(
            -r * w * Math.sin(w * f.time) + k * r * Math.exp(-k * f.time),
            r * w * Math.cos(w * f.time),
          ),
        ),
      );
      return {
        summary: {
          error: r * Math.exp(-k * duration),
          rms: r * Math.sqrt(-Math.expm1(-2 * k * duration) / (2 * k * duration)),
          peak,
        },
        series: frames.map((f) => ({ x: f.time, y: r * Math.exp(-k * f.time), reference: 0 })),
        visualization: {
          type: 'mobile',
          frames,
          path: frames.map((f) => f.position),
          referencePath: frames.map((f) => f.reference),
          detail: 'Blue: actual path · dashed: reference circle',
        },
      };
    },
  ),
};

roboticModels.inversearm.definition.presets = {
  'Unreachable target': { x: 3, y: 3 },
  'Other elbow branch': { branch: 'down' },
};
roboticModels.differential.definition.presets = {
  'Straight line': { left: 5, right: 5 },
  'Turn in place': { left: -5, right: 5 },
};

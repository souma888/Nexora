/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  arm: [
    'Set joint angles, inspect the tool location, and preview a linear joint-space move from zero.',
    'Where is a two-link planar arm kinematically singular?',
    ['When its links are collinear', 'At every right angle', 'Only at the origin'],
    'The planar position Jacobian has determinant L1 L2 sin(θ2).',
    'For L1=1 m, L2=0.8 m, θ1=30° and θ2=60°, the tool is at (0.8660, 1.3000) m.',
    'x=L1 cosθ1+L2 cos(θ1+θ2); y=L1 sinθ1+L2 sin(θ1+θ2). det J=L1 L2 sinθ2. Angles ' +
      'are counterclockwise; θ2 is relative to link 1.',
    'Planar rigid links with ideal revolute joints. The preview interpolates angles ' +
      'linearly; it is not time-optimal and includes no torque, joint-speed limits or ' +
      'collision checking.',
  ],
  inversearm: [
    'Drag a target or edit its coordinates, choose an elbow branch, and check workspace reachability.',
    'Which targets can a two-link arm reach?',
    [
      'Those in the annulus |L1−L2|≤r≤L1+L2',
      'Every point in the plane',
      'Only points on the outer circle',
    ],
    'The triangle inequality sets both inner and outer radial limits.',
    'For L1=1 m, L2=0.8 m and target (1,1), the positive-elbow solution is about θ1=11.55°, θ2=76.997°.',
    'c2=(x²+y²−L1²−L2²)/(2L1L2); θ2=±acos(c2); θ1=atan2(y,x)−atan2(L2 sinθ2,L1+L2 cosθ2).',
    'Ideal planar geometry, no collision or joint-limit check. Unreachable targets ' +
      'display a closest radial pose and null solved-angle results. At an equal-link ' +
      'origin the solution is nonunique; one folded pose is chosen.',
  ],
  fourbar: [
    'Close the coupler–rocker triangle and distinguish feasible from impossible crank positions.',
    'Does every set of four link lengths allow a full crank revolution?',
    ['No', 'Yes', 'Only when every length is different'],
    'Triangle closure must remain possible throughout the rotation; some mechanisms ' +
      'have restricted motion.',
    'The default ground/crank/coupler/rocker lengths are 2, 0.5, 1.5 and 1.2 m. At ' +
      '45°, both circle intersections provide possible assembly branches.',
    'The crank tip A and fixed pivot D define two circles: |B−A|=Lcoupler and ' +
      '|B−D|=Lrocker. Their intersection gives B and the output angles.',
    'Rigid planar links and ideal pins, with no dynamics, interference or branch ' +
      'switching. The schematic uses the selected crank input; the plot sweeps all ' +
      'crank angles. Missing curve segments are infeasible closures. Angles are signed ' +
      'atan2 values.',
  ],
  differential: [
    'Use wheel speeds to generate straight motion, circular arcs, or an in-place turn.',
    'What happens when the wheel speeds are equal and opposite?',
    ['The robot turns in place', 'The robot drives straight', 'The robot must stop'],
    'The mean forward speed is zero but the wheel-speed difference creates angular velocity.',
    'With wheel radius 0.05 m, separation 0.3 m, and wheel speeds 4/8 rad/s, forward ' +
      'speed is 0.3 m/s and yaw rate is 2/3 rad/s.',
    'v=r(ωR+ωL)/2; Ω=r(ωR−ωL)/b. For Ω≠0: x=(v/Ω)sinΩt, y=(v/Ω)(1−cosΩt), θ=Ωt. For Ω=0: x=vt, y=0.',
    'No-slip kinematics with constant wheel speeds, initially at (0,0,0). No actuator ' +
      'dynamics, acceleration limits, wheel slip or obstacles. Heading remains ' +
      'unwrapped.',
  ],
  tracking: [
    'Combine reference-velocity feedforward with proportional position correction on a holonomic robot.',
    'What does higher position gain do to the ideal initial error?',
    [
      'It makes the error decay faster',
      'It changes the circle radius',
      'It removes the need for feedback',
    ],
    'With exact velocity actuation, the tracking error follows edot=−k e.',
    'For radius 1 m and k=1/s, the initial 1 m error falls to e⁻¹⁰≈0.0000454 m after 10 s.',
    'u=rdot+k(r−p), pdot=u. For the stated initial condition, x=R cosωt−R exp(−kt), ' +
      'y=R sinωt, and ||e||=R exp(−kt).',
    'Ideal holonomic point robot with exact velocity actuation and feedforward. This ' +
      'is not a nonholonomic differential-drive controller. Torque, speed saturation, ' +
      'collisions and sensor noise are excluded.',
  ],
};

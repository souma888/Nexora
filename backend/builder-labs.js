import { lab, p, integer, choice, textInput } from './lab-kit.js';
import { parseSpice, solveSpice, spiceExample } from './spice-transient.js';
import { parseMesh, solveContinuum, femExample } from './fem-continuum.js';
import { compileControl, solveControlGraph, controlGraphExample } from './control-graph.js';
import { parseMechanism, solveMechanism, mechanismExample } from './multibody-builder.js';
import { parseDsa, solveDsaStudio, dsaExample } from './custom-dsa.js';
const project = (initial, hint) => textInput('Portable project JSON', initial, 64000, hint);
const validateProject = (parser) => (input) => {
  try {
    parser(input.project, input.algorithm);
  } catch (e) {
    return { key: 'project', message: e.message };
  }
};
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').LabConfig<F>} config @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) => lab({ execution: 'worker', ...config }, solve);
const rectifier = JSON.stringify({
  components: [
    { id: 'AC', type: 'V', a: 1, b: 0, value: 5, wave: 'sine', frequency: 100 },
    { id: 'D1', type: 'D', a: 1, b: 2, Is: 1e-12 },
    { id: 'R1', type: 'R', a: 2, b: 0, value: 1000 },
    { id: 'C1', type: 'C', a: 2, b: 0, value: 1e-6 },
  ],
  probe: 2,
});
const transistor = JSON.stringify({
  components: [
    { id: 'VCC', type: 'V', a: 1, b: 0, value: 5 },
    { id: 'VBE', type: 'V', a: 3, b: 0, value: 0.65 },
    { id: 'RC', type: 'R', a: 1, b: 2, value: 1000 },
    { id: 'Q1', type: 'NPN', a: 2, b: 0, gate: 3, beta: 100, Is: 1e-14 },
  ],
  probe: 2,
});
const mosSwitch = JSON.stringify({
  components: [
    { id: 'VDD', type: 'V', a: 1, b: 0, value: 5 },
    { id: 'VG', type: 'V', a: 3, b: 0, value: 3.3, wave: 'pulse', frequency: 200 },
    { id: 'RD', type: 'R', a: 1, b: 2, value: 1000 },
    { id: 'M1', type: 'NMOS', a: 2, b: 0, gate: 3, threshold: 1, beta: 0.002 },
  ],
  probe: 2,
});
const lc = JSON.stringify({
  components: [
    { id: 'C1', type: 'C', a: 1, b: 0, value: 1e-6, initial: 1 },
    { id: 'L1', type: 'L', a: 1, b: 0, value: 0.01, initial: 0 },
  ],
  probe: 1,
});
const limitedControl = JSON.parse(controlGraphExample);
limitedControl.blocks.find((b) => b.id === 'limit').max = 0.3;
limitedControl.blocks.find((b) => b.id === 'limit').min = -0.3;
const fourBar = JSON.stringify({
  bodies: [
    {
      id: 'crank',
      x: 0.1,
      y: 0.1 * Math.sqrt(3),
      angle: 60,
      mass: 1,
      inertia: 0.4 ** 2 / 12,
      length: 0.4,
    },
    { id: 'coupler', x: 0.7, y: 0.2 * Math.sqrt(3), angle: 0, mass: 1, inertia: 1 / 12, length: 1 },
    {
      id: 'rocker',
      x: 1.1,
      y: 0.1 * Math.sqrt(3),
      angle: 60,
      mass: 1,
      inertia: 0.4 ** 2 / 12,
      length: 0.4,
    },
  ],
  joints: [
    { id: 'left', type: 'revolute', a: 'ground', b: 'crank', anchorA: [0, 0], anchorB: [-0.2, 0] },
    {
      id: 'upperLeft',
      type: 'revolute',
      a: 'crank',
      b: 'coupler',
      anchorA: [0.2, 0],
      anchorB: [-0.5, 0],
    },
    {
      id: 'upperRight',
      type: 'revolute',
      a: 'coupler',
      b: 'rocker',
      anchorA: [0.5, 0],
      anchorB: [0.2, 0],
    },
    {
      id: 'right',
      type: 'revolute',
      a: 'ground',
      b: 'rocker',
      anchorA: [1, 0],
      anchorB: [-0.2, 0],
    },
    {
      id: 'motor',
      type: 'driver',
      a: 'ground',
      b: 'crank',
      anchorA: [0, 0],
      anchorB: [0, 0],
      angle: 60,
      speed: 30,
    },
  ],
  probe: { body: 'coupler', point: [0, 0] },
});
export const builderModels = {
  spicetransient: make(
    {
      id: 'spicetransient',
      title: 'SPICE-lite: Nonlinear Transient Circuit Builder',
      discipline: 'electrical',
      topic: 'Build a system',
      editor: 'spice',
      inputs: {
        project: project(
          spiceExample,
          'R/C/L/V/I/D/NPN/PNP/NMOS/PMOS; a,b are resistor or drain/collector and source/emitter terminals; gate is base/gate. SI units, node 0 ground.',
        ),
        duration: p('Transient duration', 's', 0.000001, 2, 0.01),
        steps: integer('Requested trapezoidal steps', 20, 4000, 500),
        initial: choice(
          'Initial state',
          { zero: 'Specified C voltage and L current', operating: 'DC operating point' },
          'zero',
        ),
      },
      validateValues: validateProject(parseSpice),
      metrics: {
        final: ['Final probe voltage', 'V'],
        peak: ['Peak sampled probe voltage', 'V'],
        iterations: ['Largest Newton iteration count', '1'],
        residual: ['Largest equation residual (A / V)', '1'],
        subdivisions: ['Newton-failure step subdivisions', '1'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Voltage',
        yUnit: 'V',
        traces: { y: 'Probe node', reference: 'First voltage source' },
      },
      presets: {
        'RC step': { project: spiceExample },
        'Diode with reservoir capacitor': { project: rectifier, duration: 0.03, steps: 1500 },
        'BJT bias': { project: transistor, initial: 'operating' },
        'MOS switch': { project: mosSwitch },
        'Lossless LC energy check': { project: lc, duration: 0.002, steps: 1000 },
      },
      text: [
        'Build a grounded nonlinear netlist, solve its modified nodal equations by damped Newton–Raphson and integrate stored charge and flux with trapezoidal companions.',
        'Will doubling the timestep always preserve a switching waveform?',
        ['No, compare timestep convergence', 'Yes, trapezoidal is exact', 'Only with transistors'],
        'Trapezoidal integration is second order for smooth states, but ideal switching and nonlinear convergence impose practical step limits.',
        'For R=1000 Ω and C=1 µF, an isolated 5 V step approaches 5(1−exp(−t/.001)) V. The default step starts at 1 ms.',
        'F(xₙ)=0; JΔx=−F; iCₙ=(2C/h)(vₙ−vₙ₋₁)−iCₙ₋₁; vLₙ=(2L/h)(iₙ−iₙ₋₁)−vLₙ₋₁.',
        'Bounded educational MNA, 12 nodes/40 parts, no subcircuits or vendor model files. Diodes use Shockley with C1 exponential limiting; BJT uses basic Ebers–Moll; MOS uses long-channel square law without body diode or parasitic charge. Initial conditions must be compatible with ideal sources. Failure-only timestep subdivision is not adaptive error control. Capacitor/inductor stored energy can be inspected from branch tables and exported histories.',
      ],
    },
    (a) => solveSpice(a.project, a),
  ),
  fem2d: make(
    {
      id: 'fem2d',
      title: 'Build a 2D Plane-Stress Mesh',
      discipline: 'mechanical',
      topic: 'Build a system',
      editor: 'fem',
      inputs: {
        project: project(
          femExample,
          'Nodes in m; triangles are node indices; supports [node,ux or null,uy or null]; nodal forces in N.',
        ),
        modulus: p('Young’s modulus', 'GPa', 0.001, 1000, 200),
        poisson: p('Poisson ratio', '1', -0.9, 0.49, 0.3),
        thickness: p('Thickness', 'm', 0.00001, 1, 0.01),
      },
      validateValues: validateProject(parseMesh),
      metrics: {
        displacement: ['Peak nodal displacement', 'mm'],
        stress: ['Peak element von Mises stress', 'MPa'],
        energy: ['Elastic strain energy', 'J'],
        residual: ['Largest free-DOF residual', 'N'],
      },
      plot: { x: 'Element index', xUnit: '1', y: 'Constant von Mises stress', yUnit: 'MPa' },
      text: [
        'Edit a conforming triangle mesh, prescribe supports and nodal loads, and solve assembled constant-strain plane-stress finite elements.',
        'Does a constant-strain triangle resolve a bending stress gradient inside one element?',
        ['No, refinement is needed', 'Yes, exactly', 'Only if density is large'],
        'CST stresses are constant per triangle; refining and checking the solution is essential for bending and concentration problems.',
        'The 1×0.5 m, 10 mm plate with total 1000 N axial force and E=200 GPa has uniform σx=0.2 MPa and end displacement 0.001 mm in the patch test.',
        'Ke=tA BᵀDB; Kff uf=ff−Kfc uc; σ=DBu; σVM=√(σx²−σxσy+σy²+3τxy²).',
        'Small-strain homogeneous isotropic plane stress; no geometric or material nonlinearity, contact or automatic error estimator. Up to 80 nodes/160 triangles. Stress colors are element-constant, not artificially smoothed. Refinement preserves total nodal forces; distribute boundary loading appropriately.',
      ],
    },
    (a) =>
      solveContinuum(a.project, {
        E: a.modulus * 1e9,
        nu: a.poisson,
        thickness: a.thickness,
        analysis: 'stress',
      }),
  ),
  femmodal: make(
    {
      id: 'femmodal',
      title: 'Triangle FEM: Modal Analysis',
      discipline: 'mechanical',
      topic: 'Build a system',
      editor: 'fem',
      inputs: {
        project: project(
          femExample,
          'Uses the same triangle mesh and displacement restraints; forces do not enter the free-vibration eigenproblem.',
        ),
        modulus: p('Young’s modulus', 'GPa', 0.001, 1000, 200),
        poisson: p('Poisson ratio', '1', -0.9, 0.49, 0.3),
        thickness: p('Thickness', 'm', 0.00001, 1, 0.01),
        density: p('Density', 'kg/m³', 0.1, 30000, 7800),
        mode: integer('Displayed mode', 1, 8, 1),
      },
      validateValues: validateProject(parseMesh),
      metrics: {
        frequency: ['Selected natural frequency', 'Hz'],
        rigid: ['Zero modes among the reported modes', '1'],
        residual: ['Relative eigenvector residual', '1'],
        modes: ['Reported low-frequency modes', '1'],
      },
      plot: {
        x: 'Normalized cycle time',
        xUnit: 'cycles',
        y: 'Normalized modal displacement',
        yUnit: '1',
      },
      text: [
        'Reuse the plane-stress stiffness assembly with a positive lumped mass matrix and solve a symmetric generalized eigenproblem.',
        'Do unrestrained rigid translations have a positive elastic frequency?',
        ['No, their frequency is zero', 'Yes', 'Only for a dense mesh'],
        'A rigid translation creates no strain energy and remains a zero mode until restrained.',
        'Doubling Young’s modulus with fixed mass and geometry multiplies every nonzero frequency by √2.',
        'Kφ=ω²Mφ; A=M⁻¹ᐟ²KM⁻¹ᐟ²; f=ω/(2π).',
        'Up to 48 nodes, isotropic CST elements and lumped translational mass. No out-of-plane bending, rotary inertia, damping or nonlinear prestress. Mode amplitude is arbitrary; the animation runs in normalized cycles, not real-time frequency.',
      ],
    },
    (a) =>
      solveContinuum(a.project, {
        E: a.modulus * 1e9,
        nu: a.poisson,
        thickness: a.thickness,
        density: a.density,
        mode: a.mode,
        analysis: 'modal',
      }),
  ),
  femheat: make(
    {
      id: 'femheat',
      title: 'Triangle FEM: Steady Heat Conduction',
      discipline: 'thermofluids',
      topic: 'Build a system',
      editor: 'fem',
      inputs: {
        project: project(
          femExample,
          'Thermal fixed [node,°C], loads [node,W], source W/m³. Uses the same geometric triangle gradients as plane stress.',
        ),
        conductivity: p('Thermal conductivity', 'W/(m·K)', 0.01, 1000, 45),
        thickness: p('Thickness', 'm', 0.00001, 1, 0.01),
      },
      validateValues: validateProject(parseMesh),
      metrics: {
        maximum: ['Peak nodal temperature', '°C'],
        minimum: ['Lowest nodal temperature', '°C'],
        residual: ['Free-node heat-balance residual', 'W'],
        balance: ['Total heat-source/reaction balance', 'W'],
      },
      plot: { x: 'Node index', xUnit: '1', y: 'Temperature', yUnit: '°C' },
      text: [
        'Solve steady conduction on the shared editable triangle mesh, with prescribed temperatures, point heat inputs and uniform volumetric generation.',
        'Does linear temperature along a homogeneous plate produce constant heat flux?',
        ['Yes', 'No', 'Only with zero conductivity'],
        'Constant material conductivity turns a constant gradient into a constant Fourier heat flux.',
        '20°C on x=0 and 100°C on x=1 give T=20+80x and qx=−3600 W/m² for k=45 W/(m·K).',
        'He=tA k∇Nᵀ∇N; HT=Q; q=−k∇T; total reactions plus imposed heat equals zero.',
        'Steady homogeneous isotropic conduction, no convection/radiation boundaries or transient heat storage. Filled colors show element mean temperature; isolines interpolate the linear nodal field. At least one temperature restraint is required on each connected component.',
      ],
    },
    (a) =>
      solveContinuum(a.project, {
        conductivity: a.conductivity,
        thickness: a.thickness,
        analysis: 'heat',
      }),
  ),
  controlbuilder: make(
    {
      id: 'controlbuilder',
      presets: {
        'Unity feedback': { project: controlGraphExample },
        'Actuator saturation': { project: JSON.stringify(limitedControl) },
      },
      title: 'Build a Control Block Diagram',
      discipline: 'control',
      topic: 'Build a system',
      editor: 'control',
      inputs: {
        project: project(
          controlGraphExample,
          'Editable blocks and [from,to,inputPort] wires. Transfer coefficients are descending powers of s.',
        ),
        duration: p('Simulation duration', 's', 0.01, 100, 8),
        steps: integer('RK4 steps', 20, 10000, 1600),
      },
      validateValues: validateProject(compileControl),
      metrics: {
        final: ['Final selected output', 'signal'],
        peak: ['Peak selected output', 'signal'],
        error: ['Sampled RMS difference from reference', 'signal'],
        states: ['Total dynamic state order', '1'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Normalized signals',
        yUnit: 'signal',
        traces: { y: 'Selected output', reference: 'Reference block' },
      },
      text: [
        'Connect sources, sums, gains, proper transfer functions, integrators and nonlinear blocks, then run the compiled state equations in a worker.',
        'Can a purely algebraic feedback loop be evaluated by this explicit graph schedule?',
        ['No, insert a dynamic block', 'Yes, in any order', 'Only if the sum is negative'],
        'Strictly proper dynamic outputs depend on state and break direct-feedthrough dependencies; unbroken algebraic loops are rejected.',
        'K=2 with G=1/(s+1) and unity negative feedback gives y=(2/3)(1−exp(−3t)) for a unit step when the limiter is inactive.',
        'ẋ=Ax+Bu; y=Cx+Du; block outputs follow a direct-feedthrough topological schedule; RK4 integrates all dynamic states together.',
        'Up to 30 blocks, 80 wires and total order 48. Normalized signal units, proper transfer functions only, no algebraic-loop or delay differential solver. Saturation, dead zone, relay and product are memoryless; relay behavior is timestep dependent. No user-supplied code or eval.',
      ],
    },
    (a) => solveControlGraph(a.project, a),
  ),
  mechanismbuilder: make(
    {
      id: 'mechanismbuilder',
      presets: {
        'Free pendulum': { project: mechanismExample, analysis: 'dynamics', duration: 4 },
        'Driven four-bar': { project: fourBar, analysis: 'kinematics', duration: 2, steps: 400 },
      },
      title: 'Build a Planar Multibody Mechanism',
      discipline: 'robotics',
      topic: 'Build a system',
      editor: 'mechanism',
      inputs: {
        project: project(
          mechanismExample,
          'Rigid bodies [x,y,angle°], mass and centroidal inertia; local joint anchors; ground uses world coordinates.',
        ),
        analysis: choice(
          'Motion analysis',
          { dynamics: 'Constrained dynamics', kinematics: 'Fully driven kinematics' },
          'dynamics',
        ),
        duration: p('Motion duration', 's', 0.01, 20, 4),
        steps: integer('Integration steps', 20, 2000, 800),
        gravity: p('Gravity acceleration', 'm/s²', 0, 20, 9.80665),
        damping: p('Mass-proportional damping', 's⁻¹', 0, 5, 0),
      },
      validateValues: validateProject(parseMechanism),
      metrics: {
        dofs: ['Independent generalized DOFs', '1'],
        residual: ['Maximum position-constraint residual (m / rad)', '1'],
        speed: ['Peak body-center speed', 'm/s'],
        drift: ['Maximum total-energy change', 'J'],
      },
      plot: {
        x: 'Time',
        xUnit: 's',
        y: 'Probe coordinates',
        yUnit: 'm',
        traces: { y: 'Probe x', reference: 'Probe y', third: 'Total energy (J)' },
        traceUnits: { third: 'J' },
      },
      text: [
        'Assemble rigid bodies with revolute, prismatic, distance and weld constraints, then add optional angular drivers or integrate constrained motion.',
        'Can redundant joint equations make a constraint solve singular?',
        ['Yes', 'No', 'Only if gravity is zero'],
        'Constraint equations need independent Jacobian rows. A duplicated pin can overconstrain the same assembly.',
        'A uniform 1 m bar pinned at one end has small-oscillation period 2π√(2L/(3g))≈1.638 s. The default starts 20° from hanging vertical.',
        'M q̈+Jᵀλ=F; Jq̇+Ct=0; Jq̈=−(d²C/dt²)|q̈=0. Mass-weighted Newton projection enforces C(q,t)=0.',
        'Bounded planar rigid bodies, bilateral joints and ideal angular drivers, at most 10 bodies. Projected velocity Verlet is not an exact-energy integrator; compare halved steps. No contact, impacts, friction or flexible links. Kinematic mode needs zero remaining DOFs; singular toggle positions and redundant constraints are rejected.',
      ],
    },
    (a) => solveMechanism(a.project, a),
  ),
  dsastudio: make(
    {
      id: 'dsastudio',
      presets: {
        'Weighted directed graph': { project: dsaExample, algorithm: 'dijkstra' },
        'Undirected spanning forest': {
          project: JSON.stringify({ ...JSON.parse(dsaExample), directed: false }),
          algorithm: 'kruskal',
        },
        'Sort custom values': { project: dsaExample, algorithm: 'merge' },
      },
      title: 'Custom Arrays and Graphs: Algorithm Studio',
      discipline: 'algorithms',
      topic: 'Build a system',
      editor: 'dsa',
      inputs: {
        project: project(
          dsaExample,
          'Graph nodes are editable string labels; edges [fromIndex,toIndex,weight], directed and start. Arrays hold finite numbers.',
        ),
        algorithm: choice(
          'Algorithm',
          {
            bfs: 'Breadth-first search',
            dfs: 'Depth-first search',
            dijkstra: 'Dijkstra',
            bellman: 'Bellman–Ford',
            kruskal: 'Kruskal forest',
            insertion: 'Insertion sort',
            merge: 'Merge sort',
            quick: 'Quick sort',
          },
          'dijkstra',
        ),
      },
      validateValues: validateProject(parseDsa),
      metrics: {
        comparisons: ['Comparisons / edge checks', '1'],
        writes: ['Updates / writes', '1'],
        visits: ['Vertices visited / settled', '1'],
        frames: ['Captured execution frames', '1'],
      },
      plot: {
        x: 'Execution frame',
        xUnit: '1',
        y: 'Cumulative operations',
        yUnit: '1',
        traces: { y: 'Comparisons', reference: 'Writes' },
      },
      text: [
        'Create labeled arbitrary graph topologies or custom arrays, inspect actual execution states, set pseudocode breakpoints and measure empirical scaling in a worker.',
        'Can a finite wall-time plot prove an asymptotic Big-O bound?',
        ['No, it only measures these inputs and sizes', 'Yes', 'Only if it looks smooth'],
        'Runtime includes finite-size, allocation, JIT and timer effects; operation counters and analytical reasoning complement timings.',
        'The default directed graph has shortest path distances [0,3,1,4,6,7,9,10] from A. Unreachable vertices remain null.',
        'BFS/DFS O(V+E); this array-selection Dijkstra O(V²+E); Bellman–Ford O(VE); Kruskal with rank/compression O(V+E log E); merge O(n log n); insertion O(n²); quicksort average O(n log n), worst O(n²).',
        'Up to 64 vertices/256 edges or 128 array entries. No hard-wired six-node topology. Dijkstra rejects negative weights; Bellman–Ford reports reachable negative cycles; Kruskal returns a forest for disconnected undirected graphs. Replay capped at 12000 frames; the final result and operation counters are complete. Benchmarking is separate from deterministic saved solver results.',
      ],
    },
    (a) => solveDsaStudio(a.project, a.algorithm),
  ),
};

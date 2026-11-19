# Build your own models

Seven workbenches extend the catalog with editable systems. Open a lab, edit its canvas or property tables, and switch from **Design** to **Inspect result**. Accepted changes solve in a cancellable Web Worker; `/api/waves` uses the same pure solvers. These are bounded educational engines with explicit failure messages and model limits.

| Lab                          | Route                                   | Start here                                                     |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Nonlinear transient circuits | `/simulation.html?lab=spicetransient`   | RC step, diode reservoir, BJT bias, MOS switching, lossless LC |
| Plane-stress FEM             | `/simulation.html?lab=fem2d`            | Uniform uniaxial patch; refine the mesh                        |
| FEM modes                    | `/simulation.html?lab=femmodal`         | Inspect constrained lumped-mass modes                          |
| FEM heat conduction          | `/simulation.html?lab=femheat`          | Linear temperature field; add interior nodes by refinement     |
| Control diagram              | `/simulation.html?lab=controlbuilder`   | Unity feedback and actuator saturation                         |
| Planar mechanisms            | `/simulation.html?lab=mechanismbuilder` | Free pendulum and fully driven four-bar                        |
| Custom algorithms            | `/simulation.html?lab=dsastudio`        | Weighted graph, spanning forest, editable sorting array        |

The existing save/compare tools retain each project's JSON and scalar parameters. CSV exports the plotted series, PNG exports the plot, and the PDF report includes the workbench results. Project JSON import/export also works directly in the editor. Mesh analysis buttons transfer the current project through the URL; use a JSON file or saved run when a large shared URL is inconvenient. Storage remains local to your browser.

## Circuit netlist

The project contains `components` and an integer `probe` node. Each component has a unique letter-led `id`, `type`, and terminal nodes `a`, `b`. Node `0` is ground; node numbers are 0–12, with at most 40 components.

```json
{
  "components": [
    { "id": "V1", "type": "V", "a": 1, "b": 0, "value": 5 },
    { "id": "R1", "type": "R", "a": 1, "b": 2, "value": 1000 },
    { "id": "D1", "type": "D", "a": 2, "b": 0, "Is": 1e-12 }
  ],
  "probe": 2
}
```

- `R`, `C`, `L`: `value` in Ω, F, H. Capacitor `initial` is voltage a–b; inductor `initial` is current a→b.
- `V`, `I`: `value` in V/A; `wave` is `dc`, `step`, `sine`, or `pulse`. Optional `frequency` in Hz, `delay` in s, `offset` in V/A, and pulse `duty` from 0 to 1. A DC source uses its `value`; offset applies to time-varying sources.
- `D`: anode `a`, cathode `b`, optional `Is` and `ideality`. Thermal voltage is fixed at approximately 25.852 mV.
- `NPN`, `PNP`: collector `a`, emitter `b`, base `gate`, optional `beta`, `Is`. Basic Ebers–Moll with reverse transport factor fixed at 0.5.
- `NMOS`, `PMOS`: drain `a`, source `b`, gate `gate`, optional `threshold` magnitude, `beta` in A/V² and `lambda` in V⁻¹. Long-channel cutoff/triode/saturation model with terminal reversal.

MNA unknowns include non-ground voltages and V/C/L branch currents. Damped Newton–Raphson solves the nonlinear equations, using an analytic diode derivative and central-difference transistor derivatives. The diode exponential continues linearly above v/(nVT)=40 to avoid overflow. Trapezoidal companions enforce

```text
iC[n] = 2C/h (vC[n] − vC[n−1]) − iC[n−1]
vL[n] = 2L/h (iL[n] − iL[n−1]) − vL[n−1]
```

Specified initial conditions are solved as exact capacitor-voltage/inductor-current constraints; inconsistent ideal sources fail. Operating-point initialization instead opens capacitors, shorts inductors, and ramps independent sources through ten continuation stages. No artificial grounding hides floating nets. Maximum Newton iterations are 70; line search has 20 attempts. On Newton failure, a step may bisect seven times. This is **failure recovery, not local-error-controlled adaptation**. Compare smaller requested steps near switching. Up to 4,000 requested steps are computed, then histories are decimated to roughly 600 plot frames; peaks are sampled peaks.

There are no vendor models, subcircuits, body diodes, transistor parasitic charge, temperature sweeps, or SPICE text-file compatibility. This is a separate educational implementation; the [ngspice manuals](https://ngspice.sourceforge.io/docs.html) describe a full simulator's much broader model and integration options.

## Shared triangular FEM mesh

The three FEM routes use the same project:

```json
{
  "nodes": [
    [0, 0],
    [1, 0],
    [1, 0.5],
    [0, 0.5]
  ],
  "triangles": [
    [0, 1, 2],
    [0, 2, 3]
  ],
  "supports": [
    [0, 0, 0],
    [3, 0, null]
  ],
  "loads": [
    [1, 500, 0],
    [2, 500, 0]
  ],
  "thermal": {
    "fixed": [
      [0, 20],
      [3, 20],
      [1, 100],
      [2, 100]
    ],
    "loads": [],
    "source": 0
  }
}
```

Nodes are metres. Triangle entries are zero-based indices. Supports are `[node, ux, uy]` in metres; `null` leaves a displacement free. Mechanical loads are `[node, Fx, Fy]` in newtons. Thermal `fixed` values are °C, nodal `loads` are W, and uniform volumetric `source` is W/m³. Unspecified thermal boundaries are insulated. The material controls use GPa for Young's modulus and metres for thickness; assembly converts modulus into Pa.

Each constant-strain triangle assembles `Ke = t A Bᵀ D B` under isotropic plane stress. Reactions, strain energy and element stresses follow the solved displacements; contours display element von Mises stress, with deformation amplified for visibility. The reference patch gives σx=0.2 MPa, zero σy/τxy, and 0.0005 J of strain energy.

Heat uses the same linear shape gradients: `He = k t A ∇Nᵀ∇N`. Contours show element-mean temperatures and interpolated isolines; flux is `−k∇T`. Modal analysis forms the constrained symmetric `M⁻¹/² K M⁻¹/²` problem with **lumped mass**, solved by cyclic Jacobi rotations. It reports residuals and up to eight modes, with arbitrary normalized animation amplitude. Free-body zero frequencies represent rigid modes. Modal animation is a normalized phase preview rather than playback at the physical eigenfrequency.

Canvas actions add/move nodes and create triangles from three node clicks. Arrow keys move a selected node. Tables edit topology, restraints and loads. Refinement shares edge midpoints, splits each triangle into four, and interpolates fixed endpoint values onto a midpoint when both endpoints prescribe that DOF. **Existing point loads stay at their original nodes**; they are not converted into edge tractions or redistributed. This distinction matters in refinement studies.

Limits: 80 nodes/160 triangles for static/heat, 48 nodes for modes; refinement is offered only below its size threshold. Duplicate/degenerate triangles, unused nodes, repeated restraints and non-manifold edges fail. Users must create a conforming non-overlapping mesh: this is not an automatic mesher or general polygon-intersection checker. There is no plasticity, plane strain, geometric nonlinearity, transient heat, radiation, or thermoelastic coupling. The [University of Alberta's triangular-element derivation](https://engcourses-uofa.ca/books/introduction-to-solid-mechanics/finite-element-analysis/two-dimensional-solid-elements/triangular-elements/) provides the CST formulation and its approximation limits.

## Control block diagrams

Projects contain `blocks`, `wires`, `output`, and optional `reference`. A wire is `[fromID, toID, inputPort]`; ports are zero-based. Use **Connect blocks** to click a source then destination, with the destination port selected in the toolbar, or edit wires in the table. Drag blocks or move a selected block with arrow keys.

Supported types: `constant`, `step`, `sine`, `sum`, `gain`, `transfer`, `integrator`, `saturation`, `deadzone`, `relay`, `product`. Sources and gains use `value`; sums use `signs` such as `[1,-1]`; transfer functions use `num`/`den` coefficient arrays in descending powers of s. Saturation uses `min`/`max`, dead zone uses `width`, and relay uses `level`. Transfer/integrator `initial` is a state vector, not a desired output. Coordinates `x`,`y` affect only layout.

Proper transfer functions of order 1–4 compile to controllable canonical state equations. A topological schedule resolves direct feedthrough; strictly proper dynamic outputs break instantaneous dependencies. Remaining algebraic loops, missing ports, duplicate port connections and improper functions fail explicitly. RK4 integrates every block's state together. Unity feedback with K=2 and G=1/(s+1) matches `y=(2/3)(1−exp(−3t))` for an inactive limiter; the saturation preset limits the actuator to ±0.3.

Limits: 30 blocks, 80 wires, total order 48, 10,000 steps, normalized signal units. No user code/eval, delays, algebraic-loop solve, state events or automatic stability enforcement. Relay switching and discontinuous sources need a timestep study.

## Planar mechanisms

Each body has `id`, center `x`,`y` in m, `angle` in degrees, `mass` in kg, centroidal `inertia` in kg·m², and display `length` in m. Optional `velocity` is `[vx,vy,angularDegreesPerSecond]`; optional `force` is `[Fx,Fy,torque]`. Joints identify `a`,`b` bodies and local `anchorA`,`anchorB`; reserved body `ground` uses world coordinates.

Joint types are `revolute` (two coincident-point equations), `distance` (`length`), `prismatic` (`axis` relative to body A and fixed relative `angle`), `weld` (point coincidence plus relative `angle`), and `driver` (relative `angle + speed*t`). Angles/speeds in project files use degrees; internal coordinates use radians. A `probe` is `{ "body": "bar", "point": [0.5,0] }` in local coordinates.

The dynamics solve the coupled system `M q̈ + Jᵀλ = F`, `J q̈ = −γ`. Position Newton projection is mass weighted, and velocity projection enforces the differentiated constraints. A projected velocity-Verlet step advances time; the quadratic constraint term is estimated by directional central differences. Fully driven kinematic mode requires as many independent constraints as coordinates and solves position and velocity constraints at each time.

Start with the pendulum, then select **Driven four-bar**. Its prescribed crank rotates from 60° to 120° over two seconds, avoiding toggle singularities. All joint residuals and the prescribed angle are checked in tests. The uniform-bar small-angle period is `2π√(2L/(3g))`; energy error decreases when the timestep is halved. Ideal motors and damping change total mechanical energy physically, so the energy-change KPI is not an energy-error estimate in those cases.

Limits: ten rigid bodies, independent bilateral constraints, at most 2,000 steps. Singular, redundant or inconsistent constraints fail; there is no collision, contact, friction, impact, flexibility or branch-switching solver. The [MIT multibody notes](https://underactuated.mit.edu/multibody.html) describe generalized-coordinate dynamics and constraint forces.

## Custom algorithm studio

Graphs use unique string `nodes`, `edges: [[fromIndex,toIndex,weight]]`, `directed`, and a `start` index. Arrays use `array: [9,-3,8,1,1]`. Graph limits are 64 vertices/256 edges; arrays accept 128 finite numeric values. Optional `positions` stores numeric node IDs mapped to `[x,y]` layout coordinates.

BFS, DFS, array-selection Dijkstra, Bellman–Ford, Kruskal, insertion sort, merge sort and quicksort execute against the supplied project. Dijkstra rejects negative edges, Bellman–Ford reports reachable negative cycles, and Kruskal requires an undirected graph and returns a minimum spanning forest. Unreachable distances remain `null`. The original algorithm workbenches also have clickable pseudocode breakpoints and a link to this studio.

Click a pseudocode line to toggle a breakpoint, then **Play to breakpoint** or **Next instruction**. The active line, graph/array state and operation counters come from actual execution frames. Trace capture caps at 12,000 frames, preserving the final state and complete counters; a warning explains truncation.

**Measure empirical scaling** runs separately in a worker, without trace capture. It measures seeded arrays or sparse random graphs at five sizes, warms the implementation, batches runs to improve timer resolution, and reports median/min/max time and deterministic operation counts. The horizontal axis uses log₂ spacing. Timings include parsing, validation and allocation; they do not benchmark the current graph or prove asymptotic Big-O. Use the displayed algorithm complexity and operation counts alongside the measurements.

## Verification and implementation boundaries

`tests/builders.test.js` checks all routes and presets through the contract and HTTP handler, independent RC/RL exponentials, LC energy, a bisection diode reference, complementary transistor currents, FEM patch/heat/balance/eigen scaling, analytical feedback response, mechanism closure/energy convergence, graph distances and property-based sort comparisons. `e2e/builders.spec.js` checks worker rendering against HTTP, accessible editing/inspection, keyboard positioning, canvas wiring, mesh transfer, nonlinear properties, JSON export, breakpoints and worker timing on desktop/mobile.

Solvers live in `backend/spice-transient.js`, `fem-continuum.js`, `control-graph.js`, `multibody-builder.js`, and `custom-dsa.js`. `builder-labs.js` defines their contracts; `builder-core.js` supplies bounded linear algebra. Shared frontend editors and SVG renderers are separate from the calculations. The existing manifest includes these routes in catalog discovery, OpenAPI and the source solver-package build. This change does not publish a new npm version.

# Engineering sections release

At this release, Nexora reached 159 labs in 17 sections after [the next engineering expansion](ENGINEERING_EXPANSION.md). This document covers the earlier 30-experiment release across five new sections; the existing 15 Control Systems labs cover PID, second-order response, motor control, pendulum stabilization and Bode analysis. Bode analysis includes a phase-response diagram synchronized with the magnitude inspector. One discipline registry drives every sidebar, catalog filter and lab breadcrumb.

## Inventory

| Section                                  | New experiments                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thermofluids (9)                         | Bernoulli Energy Balance; Venturi Flow Meter; Pipe Pressure Loss; Composite Wall Conduction; Lumped Transient Cooling; Heat Exchanger Effectiveness; Ideal-Gas Expansion; Carnot Heat Engine; Refrigeration COP |
| Digital Logic & Computer Engineering (6) | Logic Gate Playground; Full Adder; Clocked Flip-Flops; Binary Up/Down Counter; Finite-State Sequence Detector; Cache Mapping & LRU                                                                              |
| Robotics & Mechatronics (5)              | Two-Link Arm Kinematics; Two-Link Inverse Kinematics; Four-Bar Linkage Closure; Differential-Drive Robot; Planar Trajectory Tracking                                                                            |
| Computational Engineering (5)            | Root Finding: Bisection & Newton; Euler vs. Runge–Kutta; Interpolation & Extrapolation; Monte Carlo Area & π; Mesh Convergence Study                                                                            |
| Materials Science (5)                    | Elastic–Plastic Stress–Strain; Fatigue S–N Curve; Viscoelastic Creep & Recovery; Thermal Expansion & Restraint; Composite Stiffness Bounds                                                                      |

All use local pure solvers shared with `POST /api/waves`, discoverable input schemas/units, live inputs, predictions, examples, equations and assumptions. The workbench supports enum selectors, binary buttons, bounded integer traces, multiple curves, step plots, nullable infeasible states, model warnings and detailed tables. Digital clocks, cache accesses and robot previews share a keyboard-accessible inspector; robot targets can also be dragged. Playback is an inspection tool, not a real-time physics clock. Tall/wide tables and complex logic diagrams scroll within their panels. The mobile discipline list has bounded height so the workbench stays close to the top.

## Domain conventions and numerical limits

### Thermofluids

Bernoulli and Venturi assume incompressible water, density 1000 kg/m³. Pressures are gauge unless otherwise stated. The Bernoulli cavitation flag assumes atmospheric pressure 101.325 kPa and water vapor pressure about 2.34 kPa at 20°C. Pipe losses use Darcy (not Fanning) friction, 64/Re in laminar flow and Haaland in turbulent flow. Re 2300–4000 is a flagged illustrative blend; minor losses are excluded.

Wall conduction uses two perfect-contact layers with prescribed temperatures. Lumped cooling has τ=mcp/(hA); its Biot estimate fixes density at 2700 kg/m³ and warns at Bi≥0.1. Radiation and internal gradients are excluded from the solution. Heat exchangers use constant capacity rates and UA with ε–NTU; Cr=1 has an explicit limit. Counterflow profiles are evaluated with bounded exponentials to avoid cancellation/overflow at extreme capacity ratios. Cold-stream inlet is on the right in counterflow.

Ideal-gas processes use R=8.314462618 J/(mol·K), constant heat capacities, quasi-static expansion and work-by-gas positive. Carnot engine/refrigerator results are reversible bounds, not real plant performance. Reservoirs use kelvin; invalid temperature order or Venturi throat geometry is rejected before solving.

### Digital systems

Logic is ideal two-state Boolean; no analog thresholds or propagation delay. NOT ignores B. Flip-flop sequence entries are sampled just before positive clock edges; the JK-only K field appears only in JK mode. Counter initial values must fit the selected bit width. The Moore machine detects overlapping 101 sequences and asserts output after the matching ending edge. Binary traces are limited to 24 entries (16 for flip-flops).

Cache addresses are byte addresses 0–4095; block size is 16/32/64 bytes, set count 2/4/8, and associativity 1/2/4. The cold-start read-only model uses deterministic LRU within each set. More ways with fixed set count increase capacity as well as associativity; no timing/write policy is implied. The first cache preview frame is the first access; sequential circuit previews include the initial clock-zero state.

### Robotics

Lengths are metres; user joint angles are degrees and positive counterclockwise. Elbow angle is relative to the shoulder link. Forward motion previews interpolate from zero joint angles. Inverse kinematics returns null solved angles for unreachable targets and shows a closest radial pose with a warning. Equal-length arms at the origin have nonunique folded solutions. No collision or physical joint-limit check is included.

Four-bar circle intersections define the two assembly branches; infeasible/degenerate closures produce null samples and broken plot segments. Its schematic uses the selected crank input, while the plot sweeps all crank angles. Differential drive integrates constant wheel-speed kinematics exactly, including zero-yaw and pure-spin limits. Trajectory tracking is explicitly a holonomic point-robot model with exact velocity actuation and feedforward, not a differential-drive controller. Dynamics, saturation and obstacles are excluded.

### Computational engineering

Root finding offers two fixed functions, sign-bracketed bisection and Newton with derivative/divergence guards. Residual tolerance is the convergence criterion. Euler/RK4 use the same time grid and compare with exact scalar decay; unstable choices remain visible with warnings. Interpolation uses fixed x nodes 0,1,2,3 and editable ordinates, with explicit extrapolation warnings.

Monte Carlo uses reproducible xorshift32 samples in a unit square; all samples contribute to π, while only the first 400 are drawn. The standard error is estimated, not a guaranteed bound. Mesh convergence uses a genuine Thomas solve of the centred-difference Poisson system with exact sine forcing and zero boundaries; errors are nodal and observed order compares N with 2N.

### Materials

Plasticity is monotonic bilinear uniaxial small-strain loading with elastic unloading. Basquin uses **cycles**, not reversals, fully reversed amplitude, no mean-stress correction and no endurance knee. Extrapolated lives are flagged. The Kelvin–Voigt lab represents reversible delayed strain, not irreversible metal creep or creep rupture. Large predicted strains are flagged. Thermal restraint is ideal elastic axial restraint (tension positive), with no yielding or buckling. Voigt/Reuss are ideal stiffness bounds, not a strength model or a complete transverse composite law.

## Independent reference checks

`tests/engineering-sections.test.js` includes:

| Family         | Benchmarks and checks                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fluids         | Bernoulli total-head equality and continuity; Venturi 8.8876168847 L/s reference and √Δp scaling; laminar Darcy loss against Hagen–Poiseuille                                                                      |
| Heat transfer  | Wall q″=400 W/m² and Ti=60°C; cooling τ=450 s and 1/e excess at τ; exchanger heat balance and spatial boundary temperatures for parallel/counterflow, Cr=1 and extreme capacity ratios                             |
| Thermodynamics | Isothermal nRT ln2 work; zero adiabatic heat and first-law balance; Carnot 50% at 600/300 K; refrigerator COP 6.75 at 270/310 K                                                                                    |
| Digital        | All gate/full-adder combinations; D/T/JK transitions; counter wrap/width; overlapping 101 detections; cache conflict and LRU references                                                                            |
| Robotics       | Analytic forward poses/Jacobian; both IK branches forward-substituted; unreachable/folded cases; link-length closure; straight/spin/stationary drive; tracking exponential and RMS integral                        |
| Numerics       | Known cubic/cosine roots and Newton derivative guard; Euler/RK4 amplification and refinement; interpolation at all nodes; seeded π=3.164 for N=1000, seed 42; discrete sine eigenvalue and second-order mesh error |
| Materials      | σ=267.5 MPa and residual strain 0.86625%; Basquin reference life; Kelvin–Voigt hold/recovery; ±240 MPa restraint signs; composite endpoint and bound inequalities                                                  |

Typical analytical tolerances are 1e−8 absolute, tightened for discrete identities and relaxed to 1e−7 for extreme heat-exchanger profiles. Root reference checks use 1e−6 or 1e−7, consistent with the chosen stopping criterion. Valid presets and individual numeric bounds are exercised across all 30 models; incompatible cross-field choices return validation errors. Browser checks open every new lab from its discipline on desktop/mobile, compare with real API responses, check keyboard/bit controls, drag targets, step/play/reset previews, change presets, inspect warnings and capture schematic regressions.

## Teaching references

- [NASA Glenn: Bernoulli’s equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/) — mechanical energy along a streamline.
- [University of Illinois ME420 heat exchangers](https://etrl.mechanical.illinois.edu/pdf/ME420/Lecture%2014%20-%20Convection%20-%20Heat%20Exchangers%2C%20LMTD%20Method%2C%20NTU%20Method.pdf) — ε–NTU and flow arrangements.
- [MIT Computation Structures notes](https://6191.mit.edu/_static/fall24/resources/references/6004_student_notes_FA20.pdf) — combinational/sequential logic, state machines and architecture.
- [Northwestern Modern Robotics](https://hades.mech.northwestern.edu/index.php/Modern_Robotics) — kinematic modelling and robot motion.
- [MIT numerical analysis for engineering](https://ocw.mit.edu/courses/2-993j-introduction-to-numerical-analysis-for-engineering-13-002j-spring-2005/pages/lecture-notes/) — roots, interpolation and numerical integration.
- [COMSOL linear viscoelasticity theory](https://doc.comsol.com/6.3/doc/com.comsol.help.sme/sme_ug_theory.06.029.html) — Kelvin–Voigt compliance and retardation.
- [MIT materials lecture on Voigt/Reuss models](https://www.ocw.mit.edu/courses/3-051j-materials-for-biomedical-applications-spring-2006/7497a4b0d200eea10d0e260e8cfc92a8_lecture21.pdf) — iso-strain and iso-stress mixtures.

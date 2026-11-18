# Engineering depth: metallurgy, structures, thermal systems and electronics

This release covers requested topics **125–214** with **83 new labs and seven upgraded materials routes**. The catalog now contains **380 unique labs in 21 disciplines**. No new discipline is needed: subject filters organize the additions within Materials Science, Civil, Thermofluids, Electrical and Electronics. The existing tie-line, diffusion, Hall–Petch, fracture, Paris, Goodman and Larson–Miller routes retain their IDs.

Every listed lab uses the shared live workbench, canonical input units, bounded validation, a cancellable worker, plot inspection, diagrams, teaching predictions, equations, model limits and a worked example. Saved runs, comparisons and CSV/JSON/PNG/PDF exports use the existing shared tools. The new thumbnail set distinguishes crystal cells, layers, cracks, frames, cycles, flow, soil, machines and circuit concepts. Timing, hysteresis, commutation and tank-drain replay advance calculated states, not decorative animation.

## Topic-to-route map

All routes below are `/simulation.html?lab=ID`. The generated [full catalog](CATALOG.md) provides direct website links.

| Requested topic                         | Lab ID               | Scope                                                                                         |
| --------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| 125 Binary phase diagram and lever rule | `leverrule`          | Original supplied tie line plus temperature-dependent illustrative solidus/liquidus inversion |
| 126 Eutectic cooling and microstructure | `eutectic`           | Primary/eutectic mass fractions and latent-heat arrest                                        |
| 127 Iron–carbon phase fractions         | `ironcarbon`         | Bounded metastable Fe–Fe₃C diagram, phases versus pearlite constituent                        |
| 128 TTT/CCT and cooling paths           | `tttcct`             | Illustrative C-curve, log-time plot, Scheil incubation and explicitly assumed kinetics        |
| 129 Fick diffusion                      | `fickdiffusion`      | Existing semi-infinite constant-surface solution, upgraded diagram                            |
| 130 Arrhenius carburizing               | `carburizing`        | Temperature-dependent D and inverse-error-function case depth                                 |
| 131 Hall–Petch                          | `hallpetch`          | Existing calibrated grain-size strengthening, upgraded diagram                                |
| 132 Work/dislocation hardening          | `workhardening`      | Hollomon tangent/Considère condition and Taylor strengthening                                 |
| 133 Fracture toughness                  | `fracturetoughness`  | Existing KI, critical crack and plane-strain dimension screen                                 |
| 134 Paris-law crack growth              | `pariscrack`         | Existing integrated life, including the logarithmic m=2 limit                                 |
| 135 Goodman diagram                     | `goodman`            | Existing corrected fatigue and independent yielding factors                                   |
| 136 Larson–Miller creep life            | `larsonmiller`       | Existing constant-stress calibrated P and log-life                                            |
| 137 Charpy transition                   | `charpy`             | Empirical shelves, tanh transition and criterion crossing                                     |
| 138 Avrami kinetics                     | `avrami`             | Isothermal JMAK law parameterized by half-time                                                |
| 139 FCC/BCC/HCP packing                 | `crystalpacking`     | Hard-sphere APF and specifically named dense-plane densities                                  |
| 140 Miller indices/Schmid law           | `schmid`             | Cubic axes, slip-plane membership, resolved shear and intercepts                              |
| 141 Classical lamination theory         | `laminate`           | Transformed lamina stiffness, full ABD assembly and coupled solve                             |
| 142 Galvanic/Tafel kinetics             | `corrosion`          | Activation-only mixed potential, area balance and Faraday loss                                |
| 143 Stress relaxation                   | `relaxation`         | Maxwell and Maxwell-arm-parallel SLS topology                                                 |
| 144 Ceramic thermal shock               | `thermalshock`       | Supplied constraint factor and R/R′ screening parameters                                      |
| 145 Propped cantilever                  | `proppedbeam`        | Uniform load, compatibility, reactions, moment, deflection and energy                         |
| 146 Three-moment equation               | `threemoment`        | Two/three prismatic spans, separate span loads and lengths                                    |
| 147 Moving loads                        | `movingload`         | Two axles, exact influence-line event maxima at a chosen section                              |
| 148 Method of joints                    | `trussjoints`        | Whole-truss reactions followed by actual one/two-unknown joint resolution                     |
| 149 Truss virtual work                  | `trussvirtual`       | Real/unit-load member sums checked against direct displacement                                |
| 150 Portal-frame sway                   | `portalsway`         | Three-DOF slope–deflection system, fixed bases, lateral roof force                            |
| 151 Moment distribution                 | `momentdistribution` | Pin releases, distribution factors, carry-over and visible sweep residuals                    |
| 152 Unsymmetric bending                 | `unsymmetric`        | L-section centroid, full inertia tensor and neutral axis                                      |
| 153 Section kern                        | `sectionkern`        | Rectangular biaxial stress and no-tension diamond                                             |
| 154 I/T shear stress                    | `beamshear`          | Composite centroid, exact Q above cuts and local width changes                                |
| 155 Thin pressure vessel                | `thinvessel`         | Closed-end membrane stresses and elastic radius expansion                                     |
| 156 Lamé cylinder                       | `lame`               | Internal/external pressure, open/closed end axial condition                                   |
| 157 Strain rosette                      | `strainrosette`      | Rectangular/delta inversion, principal strains and engineering shear                          |
| 158 Failure criteria                    | `failurecriteria`    | Tresca/von Mises yielding and separate brittle Rankine strengths                              |
| 159 Castigliano                         | `castigliano`        | Tip force/moment/axial energy and conjugate displacements                                     |
| 160 Eccentric column                    | `eccentriccolumn`    | Pin-ended secant amplification below Euler load                                               |
| 161 Closed-cell torsion                 | `closedtorsion`      | Uniform thin rectangular tube, Bredt flow and twist                                           |
| 162 Hole concentration                  | `kirschhole`         | Full polar Kirsch stress components and traction-free hole edge                               |
| 163 Otto cycle                          | `otto`               | Constant-γ air standard, actual p–v process curves                                            |
| 164 Diesel/dual cycles                  | `dieseldual`         | Separate constant-volume/pressure heat additions                                              |
| 165 Regenerative Brayton                | `brayton`            | Component efficiencies and physically conditional recovery                                    |
| 166 Superheat/reheat Rankine            | `rankine`            | IAPWS-IF97 state properties and wet-state mixtures                                            |
| 167 Psychrometrics                      | `psychrometric`      | ADP/bypass enthalpy mixing, condensate and coil energy                                        |
| 168 Entropy/exergy                      | `exergy`             | Reservoir entropy generation and Gouy–Stodola balance                                         |
| 169 Fin heat transfer                   | `fin`                | Insulated/convective tip with overflow-safe exponential form                                  |
| 170 Heisler/Biot transient              | `heisler`            | Plane wall: 40-term eigenfunction solution versus one term                                    |
| 171 Radiation/view factors              | `radiation`          | Consistent two-surface enclosure, reciprocity and self-view completion                        |
| 172 Nu/Re/Pr correlations               | `convection`         | Named laminar tube, turbulent tube and flat-plate domains                                     |
| 173 Boundary-layer growth               | `boundarylayer`      | Laminar and explicitly idealized turbulent envelopes                                          |
| 174 Hardy Cross                         | `hardycross`         | Four-pipe loop, quadratic losses, continuity and residual history                             |
| 175 Pump operating point                | `pumpcurve`          | Pump/system intersection, no-intersection state and power                                     |
| 176 Cylinder regimes                    | `cylinderflow`       | Regime classification, bounded Strouhal law and illustrative drag envelope                    |
| 177 Couette/Poiseuille                  | `couette`            | Signed superposition, flux and fluid shear at both walls                                      |
| 178 Tank draining                       | `tankdraining`       | Integrated falling head and complete emptying time                                            |
| 179 Parallel/counterflow LMTD           | `lmtd`               | Terminal checks, equal-difference limit and area sizing                                       |
| 180 Electronics heat sink               | `heatsink`           | Series resistances with nonlinear parallel radiation/convection                               |
| 181 Transformer circuit                 | `transformer`        | Complex T-circuit, referred load impedance, core/copper loss                                  |
| 182 Transformer tests                   | `transformertests`   | Physically valid OC/SC RMS parameter extraction                                               |
| 183 DC motor                            | `dcmotor`            | Back EMF, torque, copper/rotational power balance                                             |
| 184 Induction motor                     | `inductionmotor`     | Exact per-phase Thevenin equivalent and air-gap power split                                   |
| 185 Synchronous generator               | `synchronous`        | Complex phasors and ideal cylindrical-rotor P–δ                                               |
| 186 BLDC/stepper commutation            | `commutation`        | Six-step, two-phase-on and half-step commanded currents                                       |
| 187 Per-unit/fault level                | `perunit`            | Power/voltage-base conversion and balanced bolted fault                                       |
| 188 π-model/Ferranti effect             | `transmissionpi`     | Complex ABCD, loaded sending requirement and open-circuit receiving voltage                   |
| 189 PF correction                       | `powerfactor`        | Three-phase kvar, star/delta per-phase capacitance and line current                           |
| 190 Two-bus P–V                         | `twobus`             | Exact lossless constant-PF quadratic, both branches and fold                                  |
| 191 Unbalanced faults                   | `symmetrical`        | SLG/LL/DLG/three-phase sequence interconnections and phase reconstruction                     |
| 192 Overcurrent coordination            | `relaycoordination`  | Three inverse families, pickup domain and grading-point multiplier                            |
| 193 Soil phase relations                | `soilphases`         | Solid/water/air conservation and unit weights                                                 |
| 194 Mohr–Coulomb                        | `mohrcoulomb`        | Effective-stress circle, envelope and tangency reserve                                        |
| 195 Bearing capacity                    | `bearingcapacity`    | Terzaghi strip/square/circle factors and stated Nγ interpolation                              |
| 196 Consolidation                       | `consolidation`      | Normally consolidated compressibility and drainage-path time law                              |
| 197 Darcy/flow nets                     | `darcyflownet`       | Exact rectangular isotropic flow net, counts and physical dimensions                          |
| 198 Retaining walls                     | `retainingwall`      | Active/passive/surcharge forces and simplified rigid-wall balances                            |
| 199 Open-channel flow/jump              | `openchannel`        | Manning normal depth, critical depth and conjugate momentum                                   |
| 200 Runoff/unit hydrograph              | `runoff`             | Rational estimate plus volume-normalized triangular-UH convolution                            |
| 201 Traffic fundamental diagram         | `greenshields`       | Equilibrium speed–density and kinematic shock speed                                           |
| 202 Webster signal delay                | `webster`            | Undersaturated delay, approach capacity and optimal-cycle approximation                       |
| 203 Horizontal curve/SSD                | `roadcurve`          | Lateral equilibrium and grade-signed reaction/braking distance                                |
| 204 RC flexure                          | `rcflexure`          | Strain-compatible singly reinforced section, steel may remain elastic                         |
| 205 PN junction                         | `pnjunction`         | Implicit series-resistor Shockley circuit and bounded depletion approximation                 |
| 206 Bands/Fermi level                   | `fermilevel`         | Stable compensated neutrality solution and mass action                                        |
| 207 BJT bias                            | `bjtbias`            | Loaded divider, cutoff/active/saturation and load line                                        |
| 208 MOS characteristics                 | `mosfet`             | Output/transfer sweeps, continuous triode/saturation square law                               |
| 209 CMOS inverter                       | `cmosinverter`       | Numerical current balance, VTC, switching point and unity-slope noise margins                 |
| 210 Differential amplifier              | `differentialamp`    | Tanh current steering, differential gain and explicitly single-ended CMRR                     |
| 211 Sallen–Key                          | `sallenkey`          | Defined capacitor topology, damping guard and frequency response                              |
| 212 555 timing                          | `timer555`           | Exact ln2/ln3 thresholds and astable/one-shot capacitor state                                 |
| 213 Zener regulation                    | `zener`              | Source/load/breakdown intersection and knee-current warning                                   |
| 214 Schmitt hysteresis                  | `schmitt`            | Stateful rising/falling thresholds, supplied rails and initial latch state                    |

## Numerical and physical boundaries

- **Phases and kinetics:** the binary envelope, approximate Fe–Fe₃C boundaries, eutectic cooling approximation and TTT/CCT kinetic shape are educational models, not thermodynamic/steel-grade databases. Microstructure cells illustrate mass fractions rather than a spatial phase-field calculation. Avrami is isothermal; the TTT/CCT post-incubation clock is an explicit assumption.
- **Structures:** linear elastic small-deformation models, finite supported geometries and no code-design approval. Method of joints resolves only simple determinate trusses that can be peeled joint by joint; other topologies retain the existing FEM builder. Virtual work uses the real and unit-load solutions. Moment-distribution iterations are exposed; plotted peak beam deflections are sampled. A negative kern/base pressure indicates a failed full-contact assumption, not an automatic cracked/contact solution.
- **Steam:** IF97 region 1/2/saturation routines come from a pinned Neutrium implementation. Nexora performs wet-mixture interpolation and bounded property inversion. Pump work uses inlet vf; turbines use specified stage efficiencies. T–s state connectors are schematic. [Attribution and licensing](../THIRD_PARTY_NOTICES.md) accompany distribution; the existing published npm 0.1.0 package remains its earlier immutable snapshot.
- **Heat/flow:** one-dimensional wall transient uses 40 eigenfunctions for Fo≥0.02; the one-term approximation is warned below Fo=0.2. Fin exponentials avoid large-cosh overflow. Correlation domains are enforced. The cylinder explorer classifies regimes and explicitly labels an illustrative Cd envelope; it does not solve Navier–Stokes. Radiation assumes a closed two-surface enclosure, with geometrically consistent self-view factors rather than an omitted room.
- **Civil:** effective soil properties and calibration are supplied. Terzaghi Nγ is interpolated at 5° from the linked Union College table; other tabulations differ. Early consolidation uses its short-time asymptote to avoid an under-resolved Fourier sum. The flow net is an exact rectangular special case. Runoff blocks use midpoint impulses and a normalized triangular UH; all breakpoint times are included so integration conserves volume. Webster delay is undefined at/above capacity. RC uses a named ideal stress block and reports nominal capacity without code reduction/detailing checks.
- **Electrical/electronics:** sinusoidal linear machine models, common declared bases and ideal commands where stated. Sequence boundary conditions are tested for four fault types. Relay grading must be examined over the full range, not only one fault point. Semiconductor laws are bounded pedagogical models, not process-calibrated SPICE models. No avalanche, transistor thermal failure or real comparator/timer propagation dynamics are implied. Schmitt and 555 outputs retain actual sampled state.

Nulls consistently mean a model quantity is undefined: no pump intersection, no positive real two-bus solution, outside the depletion approximation, nonunique principal angle, absent finite inverse time, single-phase steam quality, oversaturated Webster delay or a monostable frequency. Invalid physical orderings are field errors, not silently clipped calculations.

The expanded `leverrule` input contract is solver version 2.0. Its route and original default numerical example are preserved, but version-1 saved runs are deliberately refused by the shared version guard rather than silently compared with a different contract. The six other materials upgrades only add worker execution/diagrams and retain their numerical version.

The PN-junction solver is version 1.1: it evaluates current directly from the Shockley law after locating the junction voltage. This preserves tiny low-temperature reverse currents when the external resistor drop is smaller than a floating-point step of the terminal voltage.

## Verification evidence

[`tests/engineering-depth.test.js`](../tests/engineering-depth.test.js) covers all 90 lab results, worker metadata, teaching content, deterministic native diagrams, every single numeric bound/enum and HTTP agreement. Reference checks go beyond calling the same solver through two paths:

- Independent finite-volume wall cooling agrees with the eigenfunction series; IF97 region 1/2 points match the published formulation checks.
- Laminate matrix symmetry, symmetric B=0, reversed-layup B sign and unidirectional compliance; joint-force references, direct/virtual displacement agreement and Castigliano finite differences.
- Three-moment versus carry-over distribution, reaction conservation, pressure traction boundaries, zero hydrostatic equivalent yielding and traction-free circular-hole stresses.
- Gas-cycle textbook efficiencies, Rankine first-law closure, moist-air limiting states, radiation black limit, heat-sink branch energy and quadratic pipe/pump balances.
- Consolidation drainage-time scaling/short-time limit, channel momentum, exact storm-volume integration, soil phase mass balance and strain-compatible RC crushing/yield distinction.
- Transformer real-power closure, motor air-gap/copper balance, line ABCD determinant and losses, per-unit scaling, both P–V root equations and all sequence-fault phase boundary conditions.
- PN circuit KCL, compensated carrier mass action, BJT base-divider balance in saturation, MOS pinch-off continuity, CMOS reflection/noise margins, timer thresholds, zener KCL and Schmitt memory.

[`e2e/engineering-depth.spec.js`](../e2e/engineering-depth.spec.js) opens all 90 labs on desktop/mobile, compares displayed/API results, changes valid inputs, inspects plots by keyboard and resets. Additional workflows exercise all affected catalog sections, binary modes, Rankine reheat, absent operating points, malformed JSON/text recovery, timed state replay, save/compare/CSV and representative light/dark axe/screenshot checks. Existing browser suites continue to run against the expanded catalog. Type regression assertions keep the subject factories' numeric/text boundaries checked.

## Primary references and model sources

- [IAPWS IF97 release](https://iapws.org/relguide/IF97-Rev.html): regional/saturation water and steam formulation and verification points. [Neutrium implementation](https://github.com/neutrium/thermo.eos.iapws97) supplies the local property routines.
- [NPTEL Scheil additivity](https://archive.nptel.ac.in/content/storage2/courses/113101003/parts/partVI/module2/1.7.html) and [Cambridge MAP TTT→CCT routine](https://www.phase-trans.msm.cam.ac.uk/map/steel/subs/tttcct-b.html): scope of incubation additivity; they do not validate the illustrative TTT calibration chosen in this lab.
- [NPTEL classical laminate constitutive equation](https://archive.nptel.ac.in/content/storage2/courses/101104010/lecture17/17_2.htm): symmetric A/B/D and coupled membrane–bending form.
- [NPTEL moist-air processes](https://archive.nptel.ac.in/content/storage2/courses/112108148/pdf/Module_3.pdf): humidity/enthalpy representation and cooling/dehumidification conventions.
- [Union College Terzaghi table](https://foundation.union.edu/TERCRSI.htm): explicitly chosen Nγ tabulation and footing-shape framework.
- [Texas Instruments Sallen–Key analysis](https://www.ti.com/lit/an/sloa024b/sloa024b.pdf): low-pass topology, gain and damping definitions.
- [Texas Instruments NE555](https://www.ti.com/lit/ds/symlink/ne555.pdf): one-third/two-thirds threshold and standard timing circuits. The lab uses ideal exact logarithms rather than rounded datasheet coefficients.

The remaining force balances, constitutive laws and ideal circuit definitions are written directly in each lab. Parameter values are examples unless explicitly identified as a measured calibration or published reference point.

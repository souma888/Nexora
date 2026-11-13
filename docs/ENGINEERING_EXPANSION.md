# 30 labs across five new engineering sections

This release brought Nexora to **159 experiments across 17 disciplines**. See [the generated inventory](CATALOG.md) for current totals. This release adds six labs per section. Each section has its own live preview, three featured entry points, distinctive subject artwork, catalog filter, and persistent sidebar link. Each lab includes editable parameters, units, a keyboard-operable plot inspector, a probe-linked schematic, a prediction question, a worked example, equations, assumptions, reset, and presets. Tables accompany models where they explain intermediate calculations.

These are bounded teaching models with explicit assumptions, rather than equipment sizing or certification tools. Pure JavaScript solvers run identically in the browser and behind `POST /api/waves`; `GET /api/waves` supplies their versioned input/output definitions. No database, secrets, or new deployment configuration is required.

## Communications & RF

Open the [section](https://soumadip-nexora.vercel.app/#communications).

| ID          | Experiment                                                      | Default independent reference                                                |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `amradio`   | Conventional AM waveform, signed envelope, sideband power       | 2 V carrier, m=0.5, 50 Ω: 0.045 W average power, 1 V minimum signed envelope |
| `fmradio`   | FM phase accumulation, instantaneous frequency, Carson estimate | 30 Hz center, 4 Hz deviation, 2 Hz message: β=2, approximate B=12 Hz         |
| `bpsk`      | Bit sequence, antipodal phase, coherent carrier                 | 1 V peak, 20 bit/s, 1 Ω: Eb=25 mJ; three cycles/bit gives 60 Hz carrier      |
| `qpsk`      | Gray-coded constellation and I/Q symbol steps                   | Magnitude 1: I/Q=±1/√2; 20 symbols/s carries 40 bit/s                        |
| `radiolink` | Free-space propagation and link margin                          | 2.4 GHz at 1 km: FSPL=100.052008 dB; default received power −78.052008 dBm   |
| `shannon`   | AWGN capacity and spectral efficiency                           | 100 kHz at 10 dB: 0.345943162 Mbit/s; at 0 dB: 1 bit/s/Hz                    |

AM shows a warning above m=1; its signed envelope can invert. RF link margin is a power threshold comparison, not a fading availability estimate. Carson bandwidth is approximate. The waveforms deliberately use low carrier frequencies to expose individual cycles and retain at least 24 samples per fastest carrier cycle. QPSK energy is explicitly the normalized **complex-envelope** convention Es=A²/Rs into 1 Ω, while BPSK uses real-passband Eb=A²/(2Rb). Digital sequences are bounded to 16 symbols; endpoint samples retain the final symbol.

## Power & Energy

Open the [section](https://soumadip-nexora.vercel.app/#energy).

| ID                 | Experiment                                              | Default independent reference                                                                      |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `solarpv`          | Ideal-diode I–V curve and bracketed maximum-power point | Isc=5 A, Voc=20 V, voltage scale=1 V: approximately 17.1039 V, 4.72382 A, 80.7956 W                |
| `windpower`        | Wind kinetic flux, Cp, Betz bound, generator efficiency | R=5 m, v=10 m/s, ρ=1.225: 48.1056 kW available; Cp=.4 and η=.9 give 17.3180 kW electric            |
| `batterydischarge` | Linear-OCV cell, resistive sag, charge depletion        | 5 Ah, 2 A, full SOC: runtime 2.5 h; first two hours deliver 14.48 Wh                               |
| `buckconverter`    | Ideal CCM step-down conversion and ripple               | 24 V, D=.5, L=2 mH, 20 kHz, 10 Ω: 12 V, 1.2 A output, 0.15 A peak-to-peak ripple                   |
| `boostconverter`   | Ideal CCM boost gain and input-current stress           | 12 V with the same settings: 24 V output, 2.4 A output, 4.8 A mean inductor current, 0.15 A ripple |
| `threephase`       | Balanced sinusoidal phase power and phasors             | 400 V line RMS, 10 A, PF=.8: P=5.54256 kW, Q=4.15692 kvar, S=6.92820 kVA                           |

PV uses a fixed-temperature fitted ideal diode; it recomputes open-circuit voltage when irradiance changes and bisects d(VI)/dV=0 for 70 iterations. Wind power deliberately excludes real turbine regulation, cut-in and cut-out. The battery disconnects the load at empty SOC; its plotted open-circuit voltage remains the empty-cell value. At zero current the runtime is undefined and displayed as **—**. Converter waveforms remain explicitly conditional when their calculated inductor current touches zero; warnings mark the breakdown of diode-CCM assumptions. Three-phase waveforms use an explicit wye-equivalent phase voltage VLL/√3, and capacitive leading current gives negative Q.

## Aerospace & Flight

Open the [section](https://soumadip-nexora.vercel.app/#aerospace).

| ID               | Experiment                                        | Default independent reference                                                |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ballistic`      | Launch geometry and exact ground interception     | 50 m/s, 45°, sea-level launch, g=9.80665: range 254.9291 m, flight 7.21048 s |
| `dragpolar`      | Lift balance, parasite/induced drag, minimum drag | W=10000 N, S=16 m², ρ=1.225, v=50 m/s: CL=.408163, drag 816.582 N            |
| `bankturn`       | Coordinated level turn geometry and stall margin  | 50 m/s at 30°: radius 441.550 m, load factor 1.15470, rate 6.48803°/s        |
| `rocketequation` | Ideal mass ratio and effective exhaust velocity   | 1000→500 kg, Isp=300 s: delta-v=2039.23554 m/s                               |
| `atmosphere`     | Dry standard troposphere                          | At sea level: 288.15 K and 101325 Pa; at 11 km: 216.65 K and about 22632 Pa  |
| `isentropicflow` | Compressible-flow ratios and nozzle area          | γ=1.4, M=1: T/T0=5/6, p/p0=.528281788, A/A*=1; M=2 gives A/A*=1.6875         |

Trajectory geometry uses a uniform horizontal/vertical scale. Ballistics excludes drag and curvature. Drag and banked-turn labs warn when selected conditions exceed the supplied lift/stall constraint, while retaining explicitly conditional curves. Rocket mass must decrease; no gravity/drag losses are modeled. Atmosphere altitude is **geopotential** and limited to 0–11 km. Nozzle geometry is schematic: its inspector selects a Mach branch, not a solved geometry with shock/back-pressure boundary conditions. All aerodynamic angles and sign conventions appear in the notes.

## Chemical & Process Engineering

Open the [section](https://soumadip-nexora.vercel.app/#chemical).

| ID                  | Experiment                                           | Default independent reference                                                             |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `reactorconversion` | First-order CSTR versus PFR                          | Da=kτ=1: CSTR conversion 50%, PFR 63.2121%; Q=2 L/min, τ=5 min needs 10 L                 |
| `arrhenius`         | Temperature sensitivity and inverse-temperature plot | kref=.1/min at 300 K, Ea=50 kJ/mol, T=330 K: k≈.618612/min                                |
| `consecutive`       | Closed-batch A→B→C and intermediate optimum          | k1=.2, k2=.1/min: B peaks at .5 mol/L after 6.93147 min; equal rates use B=C0 kt exp(−kt) |
| `mixingtank`        | Constant-volume tracer step and washout              | V=100 L, Q=10 L/min: τ=10 min; unit inlet step reaches .632121 mol/L after τ              |
| `langmuir`          | Adsorption loading, monolayer sites, half-saturation | qmax=20 mg/g, K=.5 L/mg, C=2 mg/L: q=10 mg/g and 50% coverage                             |
| `osmosis`           | Osmotic pressure and signed membrane flux            | 0.5 mol/L, i=2, 298.15 K: Δπ=24.78957 bar; ΔP=40 bar and Lp=1.5 give 22.81564 L/(m²·h)    |

Kinetics are isothermal and first order; stoichiometric concentration conservation is checked across the entire A→B→C trace. Near equal rates use the analytical limit to avoid cancellation. Mixing holds volume constant with equal inlet/outlet flows. Langmuir uses an equilibrium concentration maintained by an open reservoir, **not** an unmodeled closed-batch mass balance. Arrhenius plots ln(k/kref) against **1000/T**, using Kelvin. Osmosis explicitly preserves the sign of flux below osmotic balance; ideal dilute-solution assumptions and perfect solute rejection are stated.

## Industrial & Reliability Engineering

Open the [section](https://soumadip-nexora.vercel.app/#industrial).

| ID                  | Experiment                                              | Default independent reference                                                                            |
| ------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `mm1queue`          | Stationary queue distribution and waiting time          | λ=4/h, μ=6/h: utilization 2/3, L=2, W=30 min, Wq=20 min                                                  |
| `eoq`               | Economic order quantity and inventory cycle             | D=1000/year, S=50/order, H=2/(unit·year): EOQ=223.607; selected Q=200 costs 450/year with a 73-day cycle |
| `criticalpath`      | Editable project DAG, forward/backward passes and Gantt | Durations [3,2,4,5,2,3]: completion 11 days; A→D→F critical; other tasks have 1 day slack                |
| `weibull`           | Survival, cumulative failure, hazard regimes            | η=1000 h, β=2, age=1000 h: R=36.787944%, h=.002/h, median=832.555 h                                      |
| `systemreliability` | Independent series and parallel components              | [90,90,95,80]%: series 61.56%, parallel 99.99%                                                           |
| `controlchart`      | Seeded Gaussian subgroup means and process shift        | μ=100, σ=2, n=5: control limits 97.316718 and 102.683282; shift applied after subgroup 18                |

M/M/1 rejects λ≥μ and reports the exact probability tail beyond n=50; its inspector chooses a state, not elapsed time. EOQ uses continuous quantities, instantaneous replenishment and generic currency. CPM originally used six tasks; version 1.1 now accepts 2–12 positive whole-day durations and editable dependencies, rejects cycles, and supports multiple critical branches. The original six-task reference remains its default. Weibull hazard at zero age with β<1 is unbounded: the metric is **—** with a warning. Reliability assumes independent component failures over the same mission interval. The X̄ chart uses known in-control mean and sigma, not fitted limits or product specifications; plots are standardized by σ/√n and the table retains original measurement units. Its LCG/Box–Muller seed reproduces the same observation sample at each reset.

## Verification and tolerances

`tests/engineering-expansion.test.js` adds 62 checks: an independent reference or invariant for each solver, every preset, accepted individual input boundary and combined domain corners, API discovery, version/units, and invalid cross-field domains. Checks include numerical AM/BPSK energy integration, a dense independent PV scan, converter volt-second balance, three-phase instantaneous conservation, flight geometry, reaction/mixing balances, exhaustive joint component states, enumerated CPM path lengths, and deterministic control-chart shift invariance. Floating references normally use absolute tolerance 1e−8; explicitly rounded textbook references use stated local tolerances. Numerical quadratures use their sampling-error tolerance; no statistical test relies on a lucky random outcome.

`e2e/engineering-expansion.spec.js` covers all 30 catalog→lab→API flows on desktop and mobile, plots/schematics/tables, keyboard scrubbing, reset, warnings, invalid-domain recovery, light/dark themes and printing. `e2e/site-wide-studio.spec.js` automatically covers each new section’s live preview, API agreement, sliders, reset and transfer into the full workbench. Large diagrams and tables scroll **within** their panel on narrow screens.

## Teaching references

The equations and model limits can be cross-checked against these primary teaching/manufacturer references. The implementations and worked examples are original; no external solver service is required.

- [MIT 6.450: Principles of Digital Communications](https://ocw.mit.edu/courses/6-450-principles-of-digital-communications-i-fall-2006/) — modulation, constellation geometry and Gaussian-channel limits.
- [Texas Instruments: Basic Calculation of a Buck Converter’s Power Stage](https://www.ti.com/lit/an/slva477b/slva477b.pdf) and [boost power-stage calculations](https://www.ti.com/lit/an/slva372d/slva372d.pdf) — CCM duty/current relationships.
- [NASA Glenn: Isentropic Flow Equations](https://www.grc.nasa.gov/WWW/K-12/airplane/isentrop.html) and [density effects](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/density-effects/) — compressible-flow ratios and aerodynamic density dependence.
- [University of Michigan: Elements of Chemical Reaction Engineering, Chapter 3](https://websites.umich.edu/~elements/7e/03chap/summary.html) — mole balances and ideal reactor design.
- [Texas A&M: Chapter 20 kinetics notes](https://www.chem.tamu.edu/class/majors/chem328/CHEM%20328_Chapter%2020.pdf) — consecutive reaction kinetics.
- [NIST: Weibull Distribution](https://www.itl.nist.gov/div898/handbook/apr/section1/apr162.htm) and [Shewhart X-bar/R/S Control Charts](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc321.htm) — survival/hazard interpretation and subgroup control limits.

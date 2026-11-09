# Engineering Validation Policy

## Why validation matters
A beautiful plot is not evidence of a correct engineering solution. Every simulation must be tested against a known analytical solution or trustworthy reference.

## Required per-module documentation
1. Governing equations and derivation/reference.
2. Model assumptions (e.g., small deflection, linear elasticity).
3. Geometry, coordinate system and sign conventions.
4. Units and conversion behavior.
5. Boundary conditions and allowed parameter ranges.
6. Benchmark inputs, expected outputs and tolerances.
7. Numerical stability, edge cases and known limitations.

## Automated reference cases
- Simply supported beam with central point load: reactions, peak moment, peak deflection.
- Simply supported beam under uniform distributed load.
- Cantilever beam with end point load: free-end slope and deflection.
- Axial bar under uniform tensile load: elongation = PL/(AE).
- Plane stress: principal stresses, principal angle and Mohr's circle radius.
- Loaded voltage divider: 6 V unloaded and 4 V loaded for the default resistor network.
- RC charging: zero initial voltage and about 63.2% of the supply after one time constant.
- Half-wave rectifier: the output stays at zero when the input peak is below the forward drop.
- Inverting amplifier: linear response inside its limits and clipping in either direction.
- Sampling: 8 Hz and 4 Hz cosines agree at each sample instant when sampled at 12 Hz.
- Moving average: a four-sample window ramps to a unit step in increments of 0.25.
- Euler buckling and shaft torsion: inverse-square length scaling and fourth-power diameter scaling, respectively.
- Hydrostatic loading: the resultant on a surface-level rectangular gate acts two-thirds of its height below the surface.
- Mass–spring motion and RL response: the analytical period and one-time-constant current.
- RLC resonance and RC filtering: resonant current peak and low-pass gain at cutoff.
- Bridge rectification: both half-cycles repeat at twice the input frequency above the diode threshold.
- Pulse convolution and beats: equal-width pulses produce a triangle, and the beat rate is the tone frequency difference.

The lab badge refers to these analytical checks. The browser and the API use the same solvers. Run `npm test` to reproduce the reference cases.

## Testing layers
- **Unit:** pure solver functions, units, input validation.
- **Reference:** independent hand calculations and textbook results.
- **Property:** equilibrium, symmetry, limiting behavior, dimensional consistency.
- **API:** schema and error responses.
- **UI:** axes, labels, control behavior and accessibility.
- **Regression:** snapshot numeric benchmarks with explicitly justified tolerances.

## Tolerance guidance
Set absolute/relative tolerances based on the solver and problem scale; do not apply one arbitrary tolerance to all modules. Record precision and sample resolution.

## Control-system reference cases

`tests/control.test.js` checks all 15 new definitions, their input boundaries, API responses, and these independent analytical values:

| Model | Reference / tolerance |
| --- | --- |
| First order | Unit-gain output at τ is 1 − e⁻¹; absolute tolerance 1e−7 |
| Second order | Undamped 1−cos(2t), critical 1−(1+2t)e⁻²ᵗ, overdamped value 0.36963997772 at 1 s; sampled ζ=0.3 peak within 0.0003 of the analytic maximum |
| PID | Kp=3, Ki=0, Kd=3: y=0.75[1−(1+2t)e⁻²ᵗ]; RK4 value at 1 s within 1e−10 |
| Motor | Equilibrium Kmotor Kp/(Rb + Kmotor² + Kmotor Kp); final speed within 1e−7 |
| Cruise / tank | Independent steady balances multiplied by 1−e⁻⁶ at six time constants; mass/area affect time scale |
| Thermal | Proportional-only y=0.8(1−e⁻²⋅⁵ᵗ), at 1 s within 1e−10 |
| Pendulum | Kp=9.81, Kd=0 cancels gravity exactly; stable default decays below 0.01° |
| Windup | Saturated output at 4 s equals 1−e⁻⁴ within 1e−8; conditional integration reduces recovery error at 8 s |
| Bode | Corner −3.01029995664 dB within 1e−10; corner frequency 1/τ |
| Lead / lag | Ratio 5 gives ±41.8103148958°, within 1e−9; peak frequency is the geometric mean |
| Pole locus | a=2, K=4 yields −1±j√3; K=0 includes the origin |
| Nyquist | Every point satisfies (Re−K/2)²+Im²=(K/2)² within 1e−7 |
| Digital | a=K=0.8 gives y[1]=0.8 and zero transient pole; unstable pole −3 alternates and grows |

The “peak in view” is the maximum sampled signed output, not an absolute envelope or an analytical extremum. Tests cover finite outputs at each individual input bound; they do not certify every possible combination for design use.

## Algorithm reference cases

`tests/algorithms.test.js` checks each sorting algorithm against independently sorted signed/duplicate/reverse/singleton inputs, known comparison/write counts, and unchanged initial snapshots. Search checks include absent targets, duplicates, endpoints, and sorted-copy indexes. BFS's default path has three edges; Dijkstra, Bellman–Ford and A* find a weight-13 path. A* heuristic consistency is checked edge by edge, including zero weights. All graph solvers handle unreachable destinations and source=goal; Bellman–Ford distinguishes reachable and unreachable negative cycles. Knapsack values are checked by independent exhaustive subset enumeration for capacities 1–12. Euclid's known GCDs and all recorded division identities are checked exactly. API discovery, malformed JSON, input bounds, and validation fields are covered too.

Browser tests open all 30 new labs through their catalog section on desktop and mobile, compare rendered results with actual API calls, scrub traces, exercise playback/predictions/presets/reset/validation, inspect plots with the keyboard, assert active sidebar navigation, detect JavaScript errors, and check page overflow. See [the release inventory](NEW_LABS.md) for the implementation assumptions and reference links.

## Responsible use
Display a clear educational-use disclaimer. Do not imply that simplified models satisfy engineering codes or professional safety requirements.

## Additional Data Structures & Algorithms release

The section contains 45 labs after adding 30 more. Independent structure/algorithm reference cases, domains, command syntax, numerical/index conventions, and sources are documented in [DSA_LABS.md](DSA_LABS.md). All additions use the same versioned browser/API solvers and error contract. The reference-case badge for these labs covers the automated checks described there; it does not claim exhaustive correctness over every possible operation sequence.

## New physical, digital and computational sections

The 30 newer engineering labs and enhanced Bode view bring Nexora to 109 labs across 12 sections. [ENGINEERING_SECTIONS.md](ENGINEERING_SECTIONS.md) records their equations, model domains, reference values, tolerances, warnings and teaching sources. `tests/engineering-sections.test.js` provides conservation, truth-table, geometry, numerical convergence and material-response benchmarks. Browser/API checks and schematic snapshots run on desktop and mobile. The reference badge refers to those reproducible cases, including explicit failure/domain conditions, rather than claiming exhaustive or professional design validation.

## Further DSA and Computer Engineering labs

The next 20 additions bring the catalog to 129 labs, including 55 DSA labs and 16 Digital Logic & Computer Engineering labs. [COMPUTING_LABS.md](COMPUTING_LABS.md) lists their domains, equations, exact reference cases and teaching sources. `tests/dsa-more.test.js` uses independent enumeration, direct sums, reachability and nonattacking-board checks. `tests/computer-engineering.test.js` exhausts four-bit signed arithmetic, division and single-bit Hamming error cases, and checks CRC against integer-polynomial division. Floating averages use absolute tolerance 1e−9; integer states are exact. Desktop/mobile checks cover every default browser/API result, navigation, presets, validation, scrubbing and reset, with screenshots for bit registers, page frames, Huffman trees and N-Queens boards. Algorithm playback is disabled while edited inputs regenerate, preventing an old trace from advancing during the debounce interval.

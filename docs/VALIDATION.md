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

## Responsible use
Display a clear educational-use disclaimer. Do not imply that simplified models satisfy engineering codes or professional safety requirements.

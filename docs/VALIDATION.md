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

## Suggested MVP benchmark cases
- Simply supported beam with central point load: reactions, peak moment, peak deflection.
- Simply supported beam under uniform distributed load.
- Cantilever beam with end point load: free-end slope and deflection.
- Axial bar under uniform tensile load: elongation = PL/(AE).
- Plane stress: principal stresses, principal angle and Mohr's circle radius.

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

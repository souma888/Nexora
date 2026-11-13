# Engineering decisions and review guide

## Analytical models versus numerical methods

An exact beam or steady-state reactor formula is preferable to a less accurate numerical approximation when its assumptions match the teaching problem. Those labs are analytical evaluations with parameter sweeps, not general simulation engines. Bisection/Newton, Euler/RK4, finite-difference convergence, feedback integration, seeded sampling and the circuit builder explicitly expose numerical methods. Lab count alone does not measure depth or correctness.

## DC circuit builder

The netlist accepts `R|V|I name nodeA nodeB value`, in Ω, V or A, separated by semicolons/newlines. There are at most 20 components and node labels 0–8; ground is node 0. Names are bounded word characters, not markup. Resistors stamp a symmetric conductance matrix. Independent current sources contribute to the current balance. Voltage sources introduce branch-current unknowns and voltage constraints, producing the modified nodal system `[G B; Bᵀ 0]`.

`linear.js` copies the system, selects pivots using row-scaled magnitudes, eliminates below each pivot, and back-substitutes. Its cost is O(n³), appropriate for these bounded systems. A relative pivot threshold rejects singular/ill-conditioned systems rather than fabricating voltages. Row-scaled relative equation residuals and signed absorbed power are reported; normalization avoids mixing KCL ampere and voltage-constraint residual units. Tests independently check dividers, a non-ground voltage source, a resistor bridge, KCL at every node and power conservation. This is ideal linear DC analysis, not a SPICE replacement; no nonlinear devices, parasitics or arbitrary transient networks are claimed.

## Editable project scheduling

Users supply 2–12 whole-day durations, labelled A–L, and up to 40 finish-to-start dependencies. Kahn’s topological traversal rejects cycles and allows dependencies that run against declaration order. The forward pass computes earliest times; the reversed order computes latest times against a common completion deadline. Slack is latest minus earliest start. Graph traversal and scheduling cost O(V+E); the visual time sweep is bounded by durations. Multiple critical branches and disconnected tasks are supported. Resource contention, calendars and uncertainty are excluded.

## Reproducible runs and units

Canonical inputs and solver versions are the source of truth. Imports, restore and comparison validate and recalculate them; exported/stored outputs cannot override the solver. Display-unit selectors convert values and bounds while preserving the physical input, including affine temperature conversions. Comparisons use the same model/version and canonical units. Negative numeric CSV values remain numbers; textual cells beginning with spreadsheet formula prefixes are protected. Browser storage is local, bounded and fallible; JSON is the portable backup.

## Reviewing changes

- Formatting/tooling changes are separated from behavioral changes. Use whitespace-insensitive diffs when reviewing the mechanical formatting commit.
- Check shared model contracts, model-owned domain hooks, numerical method and reference tests before presentation code.
- Discovery and documentation are generated from the executable catalog, so new labs do not require copying another list into navigation or docs.
- The backend JavaScript pass checks every engine/API, with generic typed model boundaries; strict checking covers the numerical engine and TypeScript unit/run modules and shared UI. Legacy helper typing remains an explicit roadmap item.
- Browser tests exercise both viewport sizes and compare results with real HTTP handlers. Tests are evidence within their tested domains, not certification.

## Assistance and authorship

AI coding tools assisted development and refactoring. The repository does not present generated work as unaided authorship, and existing commit history is retained. Contributors should disclose material assistance, understand the code they submit, explain the equations and tradeoffs, and provide independent reference evidence. The maintainer is responsible for deciding whether a change is ready to merge or release.

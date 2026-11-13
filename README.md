# Nexora

**An interactive engineering simulation and learning platform.**

Nexora is an open-source, browser-based engineering laboratory where students, educators, and engineers explore engineering principles through visual simulations, parameter-driven experiments, plots, and transparent calculations.

> **Status:** 159 labs are available across 17 sections. The latest release adds 30 simulations in Communications & RF, Power & Energy, Aerospace & Flight, Chemical & Process Engineering, and Industrial & Reliability Engineering, with live previews, probe-linked diagrams, worked examples and independent reference checks.

## Vision

Bring multiple engineering disciplines into one cohesive platform: explore a model, modify inputs, observe outputs, compare experiments, and understand the governing equations.

## Disciplines and scope

| Discipline                           | Example simulation modules                                                                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solid mechanics / Civil              | Stress–strain, axial deformation, torsion, beam shear and bending moment, deflection, Mohr's circle, trusses                                                                                                                                                               |
| Dynamics / Mechanical                | Rigid-body motion, kinematics, vibration, mechanisms, gears, theory of machines                                                                                                                                                                                            |
| Electrical                           | DC/AC circuits, transient RLC response, transformers, magnetic circuits                                                                                                                                                                                                    |
| Electronics                          | Diodes, transistor characteristics, op-amp circuits, filters                                                                                                                                                                                                               |
| Signals & systems                    | Convolution, Fourier/Laplace transforms, sampling, time/frequency responses                                                                                                                                                                                                |
| Control systems                      | PID tuning, motor/cruise/tank/temperature feedback, inverted pendulum, antiwindup, Bode, lead/lag, pole locus, Nyquist, discrete feedback                                                                                                                                  |
| Data Structures & Algorithms         | 55 labs: sorting/searching, stacks/queues/lists, BST/AVL/heaps, hashing, union–find, tries, range-query trees, graph algorithms, string matching, dynamic programming, number theory, two pointers, sliding windows, Quickselect, Huffman coding, Tarjan SCCs and N-Queens |
| Thermofluids                         | Bernoulli, Venturi, pipe losses, composite-wall conduction, transient cooling, heat exchangers, ideal-gas processes, Carnot efficiency, refrigeration COP                                                                                                                  |
| Digital Logic & Computer Engineering | 16 labs: logic gates, full adder, flip-flops, counters, sequence detector, cache mapping, ALU flags, two’s complement, Booth multiplication, restoring division, Hamming codes, CRC, shift registers, round robin, page replacement and branch prediction                  |
| Robotics & Mechatronics              | Two-link forward/inverse kinematics, four-bar linkage, differential drive, holonomic trajectory tracking                                                                                                                                                                   |
| Computational Engineering            | Bisection/Newton roots, Euler/RK4 integration, interpolation, seeded Monte Carlo, mesh convergence                                                                                                                                                                         |
| Materials Science                    | Bilinear plasticity, Basquin fatigue, Kelvin–Voigt creep/recovery, thermal expansion/restraint, composite stiffness bounds                                                                                                                                                 |
| Communications & RF                  | AM, FM, BPSK, Gray QPSK, free-space link budget, Shannon capacity                                                                                                                                                                                                          |
| Power & Energy                       | Solar PV maximum power, wind/Betz limit, battery discharge, buck/boost converters, balanced three-phase power                                                                                                                                                              |
| Aerospace & Flight                   | Ballistics, drag polar, banked turns, rocket equation, standard atmosphere, isentropic flow                                                                                                                                                                                |
| Chemical & Process Engineering       | CSTR/PFR conversion, Arrhenius kinetics, consecutive reactions, mixing tank, Langmuir adsorption, osmosis                                                                                                                                                                  |
| Industrial & Reliability Engineering | M/M/1 queues, EOQ, critical path, Weibull survival, series/parallel reliability, X-bar control chart                                                                                                                                                                       |

The catalog contains working labs in every section. Some broader examples above remain future scope; the release guides list exactly what is available.

## Intended experience

1. Select a discipline and experiment.
2. Adjust physical parameters, boundary conditions, units, and visualization options.
3. Run or update a deterministic simulation.
4. Inspect geometry, plots, numerical results, assumptions, and equations.
5. Save, compare, and optionally export experiments (planned).

## MVP proposal

Start with **solid mechanics**, emphasizing engineering correctness:

- Simply supported and cantilever beams under a small set of well-defined loads.
- Shear force, bending moment, slope and deflection plots.
- Axial stress/strain and Mohr's circle for plane stress.
- Validation against analytical textbook solutions, with consistent units and explicit sign conventions.

## Technology direction (proposed)

- **Frontend:** React + TypeScript + Vite; visualization with Plotly or Recharts, SVG/Canvas, and optionally Three.js.
- **Backend:** Python + FastAPI for validated simulation APIs and reusable solvers.
- **Persistence:** PostgreSQL for accounts, experiments, and saved configurations when user features are introduced.
- **Engineering:** NumPy and SciPy for numerical routines; analytical solutions where possible.
- **Quality:** pytest, frontend unit tests, GitHub Actions, and reproducible benchmark cases.
- **Deployment:** Static frontend plus an independently hosted API; optional managed database.

These are design choices to evaluate, not installed dependencies.

## Documentation

- [Project context](docs/PROJECT_CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Feature specification](docs/FEATURES.md)
- [Roadmap](docs/ROADMAP.md)
- [Engineering validation](docs/VALIDATION.md)
- [30 labs in five additional engineering sections](docs/ENGINEERING_EXPANSION.md)
- [30 additional Data Structures & Algorithms labs](docs/DSA_LABS.md)
- [20 more DSA and Computer Engineering labs](docs/COMPUTING_LABS.md)
- [New engineering sections and reference cases](docs/ENGINEERING_SECTIONS.md)
- [Development setup](docs/DEVELOPMENT.md)
- [Homepage and Control Systems design preview / revert instructions](docs/CONTROL_STUDIO_PREVIEW.md)
- [Site-wide Engineering Studio and Instrument Panel design](docs/SITE_WIDE_STUDIO.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Repository structure

```text
Nexora/
├── .github/                 # CI and community templates
├── docs/                    # Product and technical design
├── api/                     # Vercel Function entry point
├── frontend/                # Browser application
├── backend/                 # Solver and local development server
├── tests/                   # Solver and API benchmarks
├── .env.example
└── README.md
```

## Getting started

With Node.js 24, run `npm ci`, then `npm run dev` and open <http://127.0.0.1:3000>. Run `npm test` for solver benchmarks and API validation checks.

The browser runs the same solvers as the stateless Node.js API. Vite builds the frontend, with TypeScript for the shared workbench and chart interactions. See [development and Vercel deployment](docs/DEVELOPMENT.md) for setup and the API contracts.

## Project principles

**Correctness before complexity.** Show units, assumptions, domain restrictions, sign conventions, and validation evidence. Keep simulations educational rather than presenting them as certified engineering design tools.

## License

Nexora is available under the [MIT License](LICENSE).

## Disclaimer

Nexora is intended for education and exploration. Results must not be used as a substitute for professional engineering verification or safety-critical design.

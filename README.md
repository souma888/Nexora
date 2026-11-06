# Nexora

**An interactive engineering simulation and learning platform.**

Nexora is a planned, open-source, browser-based engineering laboratory where students, educators, and engineers can explore engineering principles through visual simulations, parameter-driven experiments, plots, and transparent calculations.

> **Status:** The catalog includes Beam Analysis, Axial Stress &amp; Strain, and Mohr’s Circle. Other disciplines are planned.

## Vision

Bring multiple engineering disciplines into one cohesive platform: explore a model, modify inputs, observe outputs, compare experiments, and understand the governing equations.

## Planned disciplines

| Discipline | Example simulation modules |
| --- | --- |
| Solid mechanics / Civil | Stress–strain, axial deformation, torsion, beam shear and bending moment, deflection, Mohr's circle, trusses |
| Dynamics / Mechanical | Rigid-body motion, kinematics, vibration, mechanisms, gears, theory of machines |
| Electrical | DC/AC circuits, transient RLC response, transformers, magnetic circuits |
| Electronics | Diodes, transistor characteristics, op-amp circuits, filters |
| Signals & systems | Convolution, Fourier/Laplace transforms, sampling, time/frequency responses |
| Future expansions | Control systems, fluid mechanics, heat transfer, robotics, numerical methods |

Modules will be introduced incrementally; this table is a proposed scope, not a commitment to deliver everything in v1.

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
- [Development setup](docs/DEVELOPMENT.md)
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

With Node.js 24, run `npm run dev` and open <http://127.0.0.1:3000>. Run `npm test` for solver benchmarks and API validation checks.

The app uses a dependency-free browser frontend and a stateless Node.js API. Open the catalog, then choose a lab under Civil or Mechanical Engineering. The beam lab supports center point loads, uniform loads, and cantilever tip loads with reactions, shear, bending moment, deflection, and slope. See [development and Vercel deployment](docs/DEVELOPMENT.md) for setup and the API contracts.

## Project principles

**Correctness before complexity.** Show units, assumptions, domain restrictions, sign conventions, and validation evidence. Keep simulations educational rather than presenting them as certified engineering design tools.

## License

Nexora is available under the [MIT License](LICENSE).

## Disclaimer

Nexora is intended for education and exploration. Results must not be used as a substitute for professional engineering verification or safety-critical design.

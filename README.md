# Nexora

A browser-based engineering laboratory for exploring models, inspecting numerical methods, and replaying algorithms. Adjust an input, inspect the response, and check the equations and limits behind it.

[Open Nexora](https://soumadip-nexora.vercel.app) · [Browse every lab](docs/CATALOG.md) · [Validation evidence](docs/VALIDATION.md)

<!-- catalog-summary:start -->

**471 working labs across 26 disciplines.**
<!-- catalog-summary:end -->

## What works today

- [Typed solver package on npm](https://www.npmjs.com/package/@souma88/solvers): `npm install @souma88/solvers`.
- Searchable subject catalog, persistent navigation, live section previews, and shared responsive workbenches.
- **Mathematics:** 52 labs across calculus, linear algebra, differential equations, probability/statistics and numerical methods, with a subject filter and worker-backed computation.
- **Machine Learning & Data Science:** 14 labs that train and inspect small classifiers, clustering models, optimizers and networks. [Models, verification and limits](docs/MATHEMATICS_DATA_SCIENCE.md).
- **Networks, operating systems and cryptography:** protocol/event traces, memory and CPU/resource scheduling, entropy/source coding, small public-key examples, SHA-256 avalanche and Viterbi decoding.
- **Machine design and advanced DSA:** vibration, gears, joints, contact and balancing models; balanced trees, string indexing, flow/matching/assignment and subset optimization. [Release models and reference checks](docs/MACHINE_SYSTEMS_RELEASE.md).
- **Metallurgy, structures and thermal systems:** phase equilibria and kinetics, laminate ABD coupling, continuous beams, virtual work, IF97 Rankine states, heat-transfer eigenfunctions and fluid-network balances.
- **Civil infrastructure, electrical machines and semiconductors:** geotechnical/water/traffic models, machine equivalent circuits, sequence faults and relay curves, transistor operating points and stateful timing circuits. [All 90 requested topics, assumptions and verification](docs/ENGINEERING_DEPTH_RELEASE.md).
- **Optics, DSP and applied systems:** ray optics and fields, FFT/STFT, filter design, state feedback and constrained MPC, instrumentation timing, manufacturing, orbital mechanics, separations and operations research. Biomedical, robotics, vehicle dynamics and digital-link models include explicit calibration and scope limits. [Topics 215–300, examples and verification](docs/EXPLORATION_RELEASE.md).
- Mechanics, circuits, control, signals, thermofluids, robotics, materials, computation, communications, energy, aerospace, chemical processes, reliability, and algorithm/data-structure traces.
- **Build editable systems:** nonlinear SPICE-lite transients, triangular plane-stress/modal/thermal FEM, control block diagrams, planar constrained mechanisms, and custom graph/array algorithms with breakpoints and empirical scaling. [Builder guide and limits](docs/BUILDERS.md).
- **Build a truss:** define nodes, bars, supports and loads. A cancellable worker assembles stiffness equations and recovers displacement, member force, stress, reactions and strain energy.
- **Analysis studio:** bounded sweeps, endpoint sensitivity tornadoes, seeded uncertainty propagation, CSV parameter fitting and a TensorFlow.js curve surrogate.
- **Build a DC circuit:** enter resistors and independent voltage/current sources. The solver assembles modified nodal equations, solves them with scaled partial pivoting, and reports branch currents, absorbed power, and equation residuals.
- **Edit a project graph:** define 2–12 task durations and finish-to-start dependencies; inspect topological scheduling, earliest/latest times, slack, and the Gantt chart. Cycles are rejected.
- **Save and compare runs:** a local browser library, validated portable JSON import/export, and CSV summaries/plot data or algorithm traces. Overlay numeric traces and download PNG plots or a PDF lab report. Restoring or comparing recalculates inputs rather than trusting saved results.
- Unit conversion for supported physical dimensions, including temperature offsets. Inputs convert into each model’s declared units; results, saved inputs, and comparisons retain those canonical units. Context-specific mechanics converters remain available.
- Seeded scored practice, portable classroom links, a dedicated embed route, optional Three.js geometry views and opt-in plot sonification.
- Partial Hindi/English interface localization and an opt-in offline PWA.
- Predictions, presets, worked examples, equations, model warnings, keyboard plot inspectors, dark/light themes, printing, and reduced-motion support.

## Run locally

Node.js 24 is required. No database or environment variables are needed.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:3000. `npm.cmd` also works when PowerShell blocks `npm.ps1`; no execution-policy change is necessary.

```sh
npm run format:check
npm run lint
npm run typecheck
npm run docs:check
npm test
npm run build
npx playwright install --with-deps --only-shell chromium
npm run test:e2e
```

After deploying, run `npm run verify:deployment -- https://soumadip-nexora.vercel.app` to check every live API registry and result.

For installed Microsoft Edge on Windows, set `$env:NEXORA_BROWSER_CHANNEL='msedge'` before the browser tests. CI runs the same checks. [Development setup](docs/DEVELOPMENT.md) includes API examples and Vercel settings.

## Actual architecture

The frontend is **vanilla JavaScript and TypeScript, built with Vite**, with native SVG diagrams and charts. Pure ES-module solvers run locally in the browser and behind stateless **Node.js Vercel Functions**. The local development server invokes those same HTTP handlers. There is no React, FastAPI, PostgreSQL, account service, or cloud persistence in this release.

`backend/catalog.js` derives routes and metadata from the executable model and algorithm registries. Discipline labels, grouping and icons come from `backend/disciplines.js`; catalog documentation is generated from the same source. `backend/lab-manifest.js` centralizes the executable inventory. Six endpoints expose catalog discovery and the beam, material, numerical-model, and algorithm families. Numeric models, including the new FEM and identification labs, are available through `/api/waves`; endpoints are dispatchers, not one endpoint per lab.

TypeScript checks all backend JavaScript and API modules through `checkJs`, with generic JSDoc model-input/result contracts and compile-time negative fixtures. The numerical engine uses strict JSDoc checking; units, run-record and workbench TypeScript modules also use strict checking. Legacy JavaScript helper parameters are not yet universally strict: this is broader static coverage, not a claim that the entire repository is fully typed. See [architecture and type-check scope](docs/ARCHITECTURE.md).

## Depth and limits

Analytical solutions are deliberate where exact closed forms exist. Numerical methods include bisection/Newton, Euler/RK4, finite-difference mesh convergence, feedback integration, assembled MNA with nonlinear Newton iterations and trapezoidal C/L companions, triangular continuum/truss FEM, and projected multibody constraints. Algorithm labs expose intermediate states rather than just final answers. [Engineering notes](docs/ENGINEERING_NOTES.md) explain the implementation and tradeoffs.

This remains a collection of bounded educational models. The original DC circuit builder has at most 20 ideal components and nodes 0–8; SPICE-lite separately supports 40 nonlinear/transient parts and nodes 0–12. The project scheduler ignores resource constraints. Other labs may have fixed geometry, six-node algorithm graphs, or finite trace lengths. The truss supports 12 nodes/24 bars with linear axial elements; the separate 2D mesh editor supports static plane stress, lumped-mass modes and steady heat on shared geometry, without coupled multiphysics. Saved runs are local to one browser, not synchronized accounts. Registered unit products, quotients and integer powers are dimension checked; unsupported empirical unit strings retain explicit canonical labels. Treat results as learning aids, not certified design calculations.

## Documentation and provenance

- [Advanced analysis, learning, exports, offline and developer tools](docs/ADVANCED_PLATFORM.md)
- [Current features](docs/FEATURES.md) and [roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md), [API/development guide](docs/DEVELOPMENT.md), and [generated lab inventory](docs/CATALOG.md)
- [Validation](docs/VALIDATION.md), [security/rendering audit](docs/SECURITY_AUDIT.md), and [engineering decisions](docs/ENGINEERING_NOTES.md)
- [Contributing](CONTRIBUTING.md), [security reporting](SECURITY.md), and [MIT license](LICENSE)

**AI assistance:** AI coding tools assisted implementation and refactoring, including this hardening work. Generated code still requires maintainer review and independent reference checks. Existing history is retained; formatting, contracts, features, documentation and verification are separated into reviewable commits. No authorship or professional-validation claim should be inferred from the number of labs or commits.

# Roadmap

No dates are committed. Milestones are outcome-based.

## Phase 0 — Foundation (current)

- [x] Establish product vision and documentation.
- [x] Define preliminary architecture and module priorities.
- [ ] Choose license and branding conventions.
- [ ] Scaffold React/TypeScript frontend and FastAPI backend.
- [ ] Add formatting, linting, type checks and test runners.

## Phase 1 — Verified solver core

- [ ] Define simulation schema, units and error contract.
- [ ] Implement beam shear/bending for selected load cases.
- [ ] Implement beam deflection for supported cases.
- [ ] Add axial stress/strain and plane-stress transformation.
- [ ] Verify against documented textbook/reference cases.

## Phase 2 — First complete lab experience

- [ ] Create responsive navigation and subject catalog.
- [ ] Implement reusable parameter panel and visualization shell.
- [ ] Connect frontend to solver API.
- [ ] Add worked examples, assumptions, plot exports and error states.
- [ ] Test accessibility and mobile layouts.

## Phase 3 — Product depth

- [ ] Add presets, experiment comparison and saved sessions.
- [ ] Introduce PostgreSQL and authentication if needed.
- [ ] Add truss, mechanism, and vibration modules.
- [ ] Instrument performance and reliability.

## Phase 4 — Multidisciplinary expansion

- [ ] Electrical circuits and transient analysis.
- [ ] Electronics characteristic curves and filter responses.
- [ ] Signals and systems interactive lab.
- [ ] Shared experiment versioning and learning content.

## Phase 5 — Advanced exploration

- [ ] 3D visualizations where useful.
- [ ] Guided assignments, classroom workflows, collaboration.
- [ ] More advanced numerical simulation and benchmark suites.

## Release gates

A phase is complete only when implemented features have tests, documented limitations, and a working user-facing flow.

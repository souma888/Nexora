# Proposed Architecture

> Design proposal; not implemented yet.

## High-level flow

```text
Browser (React/TypeScript)
  ├── Experiment catalog and guided learning UI
  ├── Input forms + unit conversion + client validation
  ├── 2D/3D visualization and charts
  └── API client
          │ HTTPS / JSON
          ▼
FastAPI application
  ├── Request schemas and physical-domain validation
  ├── Simulation registry / dispatch
  ├── Discipline-specific solver modules
  ├── Result serialization + metadata
  └── Optional account / experiment services
          │
          ├── NumPy / SciPy analytical & numerical routines
          └── PostgreSQL (later, for persistent user data)
```

## Suggested boundaries
- `frontend/src/features/`: discipline-specific screens and controls.
- `frontend/src/components/`: shared forms, graphs, units, diagrams.
- `frontend/src/lib/api/`: typed API client.
- `backend/app/api/`: versioned HTTP endpoints.
- `backend/app/schemas/`: typed requests and responses.
- `backend/app/solvers/`: pure deterministic solvers, grouped by discipline.
- `backend/app/core/`: units, validation, error types, registry.
- `backend/tests/`: solver and API tests.
- `tests/benchmarks/`: published reference problems.

## Suggested simulation contract
**Input:** simulation identifier, version, parameters with units, boundary conditions, sampling configuration.

**Output:** numerical summaries, plot series, visualization geometry, unit labels, equations/assumptions, warnings, solver version, validation status.

Example conceptual endpoint: `POST /api/v1/simulations/{simulation_id}/run`. This is **not** currently live.

## Engineering rules
- Use SI units internally; convert only at input/output boundaries.
- Specify coordinate systems and sign conventions per simulation.
- Validate dimensions, supported boundaries, and singular cases.
- Keep numerical solver logic separate from HTTP handlers and UI.
- Version formulas and API schemas; avoid silently changing results.
- Include precision, tolerances, and known approximations in metadata.
- Never silently extrapolate beyond validated operating ranges.

## Data model (future)
- User
- ExperimentDefinition (immutable versioned catalog item)
- ExperimentRun (input, output summary, solver version, timestamps)
- SavedPreset (owner, name, parameters)
- Collection / Classroom (optional)

## Security and operations
- Validate payloads and enforce resource limits.
- Never evaluate user-provided Python or arbitrary expressions on the server.
- Use environment variables for secrets, not committed credentials.
- Apply auth, ownership checks, rate limiting, and monitoring before public persistence.
- Treat exports and user-uploaded files as untrusted.

## Delivery strategy
1. Prototype solvers as pure Python functions with reference tests.
2. Wrap them in versioned FastAPI endpoints.
3. Build one polished frontend experiment workflow.
4. Add persistence only when experiment saving is justified.
5. Expand to additional disciplines through shared contracts.

# Development and Setup Plan

## Current state
Documentation-only repository initialization. There is **no executable frontend or backend yet**; do not expect `npm run dev` or `uvicorn` to work until scaffolding is added.

## Proposed prerequisites
- Node.js current LTS and npm
- Python 3.11+ with virtual environments
- Git
- PostgreSQL only when persistence is introduced

## Proposed local workflow (after scaffolding)
1. Clone: `git clone https://github.com/souma888/Nexora.git`
2. Install frontend dependencies in `frontend/`.
3. Create a Python virtual environment for `backend/` and install declared dependencies.
4. Copy `.env.example` to a local ignored `.env` and fill required values.
5. Start backend and frontend separately using commands documented when they exist.
6. Run tests and formatting before opening a PR.

## Planned engineering workflow
1. Write a benchmark and define input/output schemas.
2. Implement a pure solver.
3. Add API validation and error handling.
4. Build diagrams and parameter controls.
5. Add explanation, limitations and test coverage.
6. Review numerical results before release.

## Structure
`frontend/`, `backend/`, and `tests/` contain placeholder documentation until code is created. The structure is intentionally not presented as a functioning application.

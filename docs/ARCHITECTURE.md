# Shipped architecture

## Runtime flow

```text
Vite multi-page browser app (vanilla JS + strict TS workbench modules)
  ├─ backend/catalog.js → catalog, routes, subject filters
  ├─ pure model/algorithm engines → immediate local updates
  ├─ SVG/DOM diagrams, plot inspector, tables, learning notes
  └─ local run library → validated JSON/CSV, same-model comparison

Node.js 24 / Vercel Functions
  ├─ GET /api/catalog → shared catalog and discipline counts
  ├─ GET/POST /api/beam → beam discovery and analysis
  ├─ GET/POST /api/materials → axial/Mohr models
  ├─ GET/POST /api/waves → all numerical-model definitions and dispatch
  └─ GET/POST /api/algorithms → algorithm discovery and traces
```

`backend/dev-server.js` routes these same handlers and serves Vite locally. Production uses Vercel’s file-based `api/` routes. Adding a model to the numerical registry makes it available through `/api/waves`; it does not require another URL or server route. The browser evaluates the same implementation locally; browser tests separately call the HTTP implementation and compare outputs.

## Ownership boundaries

- `backend/contract.js`: shared field types, finite numeric bounds, enum/list/text validation, generic relational rules, and the HTTP error envelope.
- Each definition’s `validateValues` hook: model-specific constraints, such as root brackets, binary word width, CRC positions, circuit singularity, and graph cycles. Hooks execute after field checks in both browser and API. Functions are not serialized into discovery JSON.
- `backend/experiment.js` / `lab-kit.js` and `schema.d.ts`: generic typed definition, input, result, unit and teaching metadata contracts.
- `backend/linear.js`: strictly checked JSDoc, scaled partial-pivot Gaussian elimination. `circuit-builder.js` owns circuit parsing and modified nodal assembly.
- `backend/units.ts`: dimension-compatible scale/offset conversions. Contracts retain their declared units; the UI changes display units without changing the physical input.
- `backend/run-record.ts`: bounded, versioned run-file shape and CSV cell protection. Each model still validates imported input values before use.
- `frontend/public/run-tools.ts`: browser storage, download/import controls, and same-model/version comparison. Stored/exported numerical results are never a trusted solver input.

## Single catalog source

`backend/catalog.js` derives the lab list from `waves.js`, `algorithm-definitions.js`, and the three dedicated mechanics entries. The frontend supplies artwork only. `disciplines.js` owns label/group/icon metadata, and navigation derives from it. `scripts/catalog-docs.mjs` generates `docs/CATALOG.md` and the README count; CI rejects stale output. Release guides document historical releases rather than becoming additional runtime registries.

## Static checking: exact scope

`tsconfig.json` checks the TypeScript UI/core modules and the JSDoc-annotated `linear.js` numerical engine in strict mode. The latter remains plain ESM so Vercel’s JavaScript API bundles include it without runtime TypeScript imports. `tsconfig.solvers.json` enables `allowJs` and `checkJs` for **all backend JavaScript and API handlers**, including the development server. Generic JSDoc contracts infer numeric versus string inputs for model callbacks and require numerical summaries and plot values. `type-tests/solvers.ts` contains deliberately invalid calls under `@ts-expect-error`; loss of those checks fails the build.

The legacy JavaScript pass does not enable every strict flag or prohibit every inferred `any` helper parameter. Runtime validators and reference tests remain necessary. Further helper-by-helper strict typing is tracked in the roadmap; excluding all solvers while claiming whole-project safety is no longer the workflow.

## Persistence and interoperability

A run records format/schema version, lab ID, solver version, canonical input, label and creation time. The local library holds up to 40 runs and reports storage/quota errors. JSON export contains inputs and a computed summary; CSV contains canonical-unit summaries plus plot rows or trace states. Imports are limited to 200 kB, require the current model/version and valid scalar fields, and recalculate outputs. Comparisons only combine the same model/version, with canonical units and numeric deltas. JSON files make runs portable; no login or database is implied.

## Deployment

Vercel root directory is the repository root; framework preset **Other**; build `npm run build`; output `dist`. `vercel.json` defines these and browser security headers. There are no production secrets or additional services. See DEVELOPMENT.md for local setup and API payloads.

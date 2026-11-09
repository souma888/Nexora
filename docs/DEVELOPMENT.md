# Development

Use Node.js 24. No environment variables are required.

```sh
npm ci
npm run dev
npm test
```

Open <http://127.0.0.1:3000>. The local server uses Vite for the frontend and invokes the same API handlers used by Vercel. Lab inputs update the shared solvers in the browser.

## Release checks

```sh
npm ci
npm run typecheck
npm run build
npx playwright install --only-shell chromium
npm run test:e2e
```

GitHub Actions runs solver benchmarks and browser tests for both desktop Chromium and an emulated mobile viewport. To run the browser tests against a deployment, set `NEXORA_TEST_URL` to its base URL before running `npm run test:e2e`.

## Deploy to Vercel

1. Commit and push your changes to GitHub.
2. In Vercel, import the repository with its root directory set to the repository root and the **Other** framework preset. The root `vercel.json` runs `npm run build` and serves `dist`.
3. Deploy. Open the catalog, choose **Civil Engineering → Beam Analysis**, and run the default example. It should report 12 kN at each support, 36 kN·m peak moment, and −6.75 mm peak deflection.

Vercel serves the static frontend and runs the handlers in `api/` as Node.js Functions in the same deployment. No database setup is required.

## Shared API contract

GET either endpoint to discover its `models`. Each definition gives the model ID, solver version, allowed inputs and bounds, and units for summary and series values. POST responses contain `model`, normalized `input`, solver `version`, `units`, `summary`, and `series`. A model without sampled plot data returns an empty series. Validation errors contain `error` (human-readable message), `code` (stable error category), and `field` (input key or null).

## Beam API

Send `POST /api/beam` with a JSON body:

```json
{ "case": "point", "span": 6, "load": 24, "modulus": 200, "inertia": 8000 }
```

Supported cases are `point` (center point load), `uniform` (uniform load along the full span), and `cantilever` (tip point load). Inputs use m, kN (kN/m for uniform), GPa, and cm⁴. Responses contain validated inputs, the solver version, a summary, and sampled x, shear, moment, deflection, and slope values in m, kN, kN·m, mm, and mrad. Malformed JSON returns 400 and invalid model inputs return 422.

## Materials API

Send `POST /api/materials` with a `model` and an `input` object:

- `axial` takes `force` (kN), `length` (m), `area` (mm²), and `modulus` (GPa). The summary gives normal stress (MPa), strain (dimensionless), and displacement (mm).
- `mohr` takes `sigmaX`, `sigmaY`, and `tauXY` in MPa. The summary gives center, radius, principal stresses (MPa), and the major principal angle (degrees counterclockwise from x). Equal biaxial stress returns a null angle.

## Plotted simulations API

Send `POST /api/waves` with a `model` and an `input` object. Use `GET /api/waves` for the full list of model IDs and each model’s inputs, defaults, limits, and output units. The returned plot rows contain `x` and `y`, with a `reference` trace or sparse `sample` markers where relevant.

The five newer engineering sections add 30 models to this contract. Input schemas support `enum` selectors, numeric `widget: "bit"`, and bounded `integer-list` strings, plus cross-field `rules` and conditional `visibleWhen`. Inactive conditional inputs use their defaults. Numeric outputs can be null for an infeasible geometric state. Additional response fields are `warnings` (model-domain messages), `table` (`caption`, `headers`, `rows`, optional `selected` or `followProbe`), and `visualization` (typed schematic data and optional preview `frames`). Curves can include an `other` trace; step plots hold the previous value until each event. Missing curve samples break the path instead of connecting across an infeasible interval. Bode series additionally declare `phase` in degrees.

The browser and API validate the same relationships, including throat/pipe diameters, hot/cold temperature order, binary register width, JK sequence length and root brackets. Invalid inputs keep the last valid browser result clearly labelled and pause preview controls. These labs require no new environment variables or database. See [the engineering release guide](ENGINEERING_SECTIONS.md) for the inventory, numerical conventions and independent cases.

The 15 Control Systems models use this endpoint too. Phase/magnitude sweeps explicitly use log10 angular frequency as their horizontal coordinate. Pole-locus plots use `locus` points for the gain sweep and `sample` points for the selected roots. The plot inspector is operable with the mouse or arrow keys.

## Algorithm traces API

`GET /api/algorithms` discovers 55 algorithm/data-structure definitions, default inputs, input schemas, pseudocode, complexity, invariants, and worked-example notes. `POST /api/algorithms` accepts `{ "model": "bubble", "input": { "values": "3, 1, 2" } }`. Responses contain `model`, `version`, normalized `input`, immutable `frames`, final `result`, and operation `stats`.

Each frame includes a zero-based pseudocode `line`, explanatory `message`, cumulative `stats`, and algorithm-specific state: arrays/active indexes, graph edges/distances/parents/frontier, a knapsack table/current cell, or Euclidean division history. JSON `null` for a graph distance represents infinity (unreachable or not yet discovered). Result distance is also null when a reachable negative cycle prevents reporting finite shortest paths; inspect `negativeCycle` and `path` to distinguish those cases.

Inputs are bounded to keep teaching traces small: arrays contain 1–16 integers (−99 to 99); directed graphs have six nodes and at most 24 distinct edges; knapsack uses up to eight items and capacity 30; GCD inputs are at most 1,000,000. Dijkstra/A* reject negative weights; Bellman–Ford accepts them. Empty graph edge lists, duplicates in arrays, and one zero GCD input are supported. Invalid inputs return 422 with the same `error`, `code`, `field` shape as the engineering endpoints. Malformed JSON returns 400.

The algorithm workbench uses the same pure engine locally. Select a preset or edit inputs, answer the prediction, then play, pause, step backward/forward, or scrub the timeline with arrow keys. The state table is an accessible alternative to the SVG. Tables/graphs scroll inside their own panels on small screens.

The 30 additional labs use `engine: "extended"` definitions with labelled input schemas. Input types include `integer`, comma-separated `list`, bounded ASCII `text`, lowercase `words`, semicolon-separated `commands`, and weighted `edges`. The shared validator normalizes them before solving and checks relationships such as an update index fitting the edited array. A sample structure request is `{ "model": "stack", "input": { "operations": "push 8; push 3; pop" } }`.

Their frames add `view` (sequence/tree/hash/network/text/matrix/grid), `stateTable` (`headers`, `rows`, `caption`, optional active cell), and `state` (solver-specific data). These payloads contain data only. The frontend builds SVG from escaped labels and renders table cells through text nodes. Every frame is an independent clone. Infinite matrix/table values serialize as JSON null; graph negative-cycle flags and human-readable messages distinguish undefined shortest paths. See [the DSA lab guide](DSA_LABS.md) for the commands, limits and teaching conventions.

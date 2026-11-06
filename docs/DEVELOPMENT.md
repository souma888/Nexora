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

# Analysis, learning and developer tools

## Numerical depth

**Build a Truss: Finite Elements** (`trussfem`, Civil) accepts a user-defined JSON mesh. Nodes use metres, bars specify node indices, mm² and GPa, nodal loads use kN, and supports restrain x/y with booleans. The solver transforms each axial element into global coordinates, assembles the full stiffness matrix, removes restrained degrees of freedom and solves with scaled partial pivoting. It recovers nodal reactions, axial forces/stresses and strain energy. Singular mechanisms are rejected. The browser solve runs in a cancellable Web Worker; the API uses the same pure engine.

Limits: 12 nodes/24 bars, linear elasticity, pin joints, small displacement, zero support motion. It does not assess buckling, yielding, bending or design-code compliance. The independent single-bar test checks PL/EA, force balance and ½Fδ; property tests check load scaling and global equilibrium for a triangular mesh.

The release adds 11 materials/mechanical models: lever rule, Fick diffusion, Paris growth, fracture toughness, Goodman fatigue, Larson–Miller creep, Hall–Petch strengthening, elliptical-hole stress concentration, bearing L10 life, two-DOF modal analysis and tolerance stack-up. Three control labs cover a constant-velocity Kalman filter, ARX system identification and FOPDT PID auto-tuning. Each contains a worked example, equations and explicit model limits. They are bounded educational models, not certified analysis software.

## Shared analysis studio

Open **Analysis studio** above a numerical workbench. Select parameters and canonical-unit bounds:

- **Sweep:** one selected continuous parameter against a chosen numeric summary metric.
- **Sensitivity tornado:** compare each checked input's lower/upper endpoints while holding other inputs fixed. The displayed slope is an endpoint secant, not a local derivative or a global sensitivity index.
- **Monte Carlo:** seeded independent uniform distributions, or normal distributions whose supplied bounds are midpoint ±3σ. Out-of-range normal draws and domain-invalid model evaluations are rejected and counted. Statistics describe accepted samples; they are not unconditional confidence guarantees. At most 1000 draws keep workloads bounded.
- **CSV fitting:** upload or paste 4–512 `x,y` observations in the selected trace's canonical units. Choose 1–3 checked continuous parameters and use bounded damped Gauss–Newton/Levenberg–Marquardt fitting. Interpolation refuses extrapolation and non-monotone traces. Review RMSE, R², convergence and residuals before applying fitted inputs. Correlated parameters and local minima can prevent unique identification; a small training residual is not independent validation.
- **Browser surrogate:** a TensorFlow.js CPU worker fits a 1→16→16→1 tanh network to the current response curve. Every fourth reference point is held out and used for RMSE. This approximates one fixed-parameter curve, not a PINN or a general emulator across parameter settings. Changing inputs requires retraining. The worker and its tensors are disposed after completion/cancellation.

Analysis adapts numeric fields, integer fields, individual integer-list entries (including algorithm inputs), and circuit-netlist component values. Integer inputs use discrete sampling. Algorithm sweeps measure operation counts and trace length. Fitting requires continuous parameters. Categorical/text-only models without a meaningful numeric adapter explain the limitation instead of inventing a continuous interpretation. New model families can extend `backend/parameter-space.js`.

## Save, compare and reports

The local library holds 40 versioned runs. Imports and comparisons revalidate and recalculate canonical inputs. Same-model/version numeric traces can be overlaid on a shared chart with a selectable trace; summary comparisons remain available for labs without trace data. Algorithm traces export as CSV state records. JSON is portable, while the library itself is browser-local.

**PNG** captures visible SVG plots, including expanded comparison/analysis plots. **PDF lab report** includes inputs, computed metrics, solver version, model notes and available plot graphics. It embeds the OFL-licensed Lato font. Reports use English model names/notes; they are educational records, not signed design documents. Large netlist/report inputs can span several pages. The existing print stylesheet remains an alternative.

## Units

`backend/physical-units.js` supplies scale/affine conversion and dimensional composition for registered physical units and their products, quotients and integer powers. For example, `kN/m²` converts to Pa and `N m` to J; metres cannot be supplied for a voltage input. API number fields accept either canonical numbers or `{ "value": 12000, "unit": "mV" }`. Conversion happens before bounds and module constraints. Affine temperature units are valid as standalone quantities, not multiplied units. Unsupported empirical, count, currency or fractional-power labels remain explicit canonical metadata; quantity objects with unknown dimensions are rejected. Results and saved runs retain canonical units.

## Spatial and accessible views

Three.js is loaded on demand for beam deformation, the truss, supported planar arm/linkage poses and flow-profile previews. Keyboard camera buttons supplement orbit controls; the SVG plots and tables remain the numerical record. Beam/truss deformation is explicitly exaggerated. Flow markers are illustrative and do not claim CFD trajectories.

The learning panel can sonify a numeric trace after an explicit Play action. Pitch rises with output value; Stop closes the audio context. Keyboard plot sliders expose numeric readouts. Prediction choices shuffle while retaining the correct answer, and first answers contribute to a local practice score. Seeded five-question numeric problem sets report a score with 1% relative/10⁻⁸ absolute grading tolerance. These are local practice tools, not secure exams or student accounts.

## Sharing, embedding, language and offline use

**Classroom share link** encodes bounded, versioned inputs in the URL and recomputes them when opened. It does not depend on the sender's local saved-run IDs. URLs are public configurations, not access-controlled assignments. Links larger than 12 kB are rejected; use JSON for those cases.

Embed a registered lab with:

```html
<iframe
  title="Nexora beam experiment"
  src="https://soumadip-nexora.vercel.app/embed.html?lab=beam"
  width="100%"
  height="900"
  loading="lazy"
></iframe>
```

`embed.html` loads only repository-owned templates selected by catalog ID. It hides navigation and omits local-library/export/practice controls. Normal pages disallow framing; the dedicated embed route permits HTTPS course sites and localhost development. Add a portable `share` parameter to carry classroom inputs.

The language selector currently translates common interface controls into Hindi and English. Lab equations, examples and technical descriptions remain English. The dictionary and document language are centralized; this is partial localization, not a claim that every lab is translated.

**Enable offline** downloads the production app, fonts, worker engines and optional tool chunks to a versioned cache. Installation is opt-in because optional 3D/ML/report assets add several megabytes. After activation, reload once before disconnecting. Canonical client-side labs and saved runs work offline; HTTP API calls require connectivity. Production builds contain the service worker and install manifest; the Vite development server intentionally does not emulate the production cache. Updates wait for existing tabs to close, avoiding mid-session solver changes.

## Developer workflow

`backend/lab-manifest.js` is the canonical executable inventory; definitions and implementations stay in their subject modules. Catalog metadata and documentation derive from these models. `GET /api/openapi` and `/api-docs.html` expose generated OpenAPI 3.1 contracts and a request explorer. Numeric quantity bounds apply after conversion; custom relational constraints are documented as module validation and return HTTP 422.

```sh
npm run new-lab -- myspring mechanical --dry-run
npm run new-lab -- myspring mechanical
npm run format
npm run docs:generate
npm run check
npm run test:coverage
npm run test:e2e
npm run test:lighthouse
npm run package:build
npm pack ./packages/solvers
```

The generator creates a running Hooke-law reference model, an independent test and registration. Replace the example's model, teaching content and reference cases before release. It rejects duplicate identifiers and refuses to overwrite files. Generated models flow into discovery, navigation counts and documentation through the registry.

`packages/solvers` builds an ESM package with TypeScript declarations, pure engines, unit conversion and analysis methods. `npm pack` is usable without publishing. `@souma88/solvers@0.1.0` is [published on npm](https://www.npmjs.com/package/@souma88/solvers) under the maintainer’s personal scope. Install it with `npm install @souma88/solvers`. The public registry installation was checked against the single-bar FEM reference, unit conversion and the 175-model inventory. Future publishing requires an authenticated scope owner.

Node's native coverage runner writes `coverage/lcov.info`; fast-check exercises physical invariants. Browser tests include axe checks on new workbench controls and complete worker/export/fit/share/embed flows. Lighthouse CI records accessibility, best practices, performance and SEO; configured budgets are not evidence that a run passed. GitHub Actions runs release checks and CodeQL separately. Hosted checks and publishing status must be inspected rather than inferred from configuration.

## Implementation references

- [APMonitor PID control and IMC tuning](https://apmonitor.com/pdc/index.php/Main/ProportionalIntegralDerivative)
- [TensorFlow.js models and layers](https://www.tensorflow.org/js/guide/models_and_layers)
- [Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)
- [CodeQL Action](https://github.com/github/codeql-action)
- [Vercel configuration and route matching](https://vercel.com/docs/project-configuration/vercel-json)

The production build limits native bundler concurrency to reduce peak memory while compiling optional 3D/ML libraries. Set `RAYON_NUM_THREADS` explicitly if a build machine has a different resource budget. These tool chunks remain lazy; the offline installer downloads them only after opt-in.

## Local audit evidence

The production catalog and truss page passed the configured Lighthouse accessibility and best-practice gates. A simulated-mobile single-run check on the development machine scored performance 65/79, accessibility 100/97 and best practices 100/100 (catalog/truss). Performance is still below the warning budget of 80; these are measured limitations, not a claim of a completed performance optimization. Reports are written to `.lighthouseci/reports` and archived in CI. Unit and browser checks use bounded concurrency so memory-heavy desktop workloads do not make release verification compete for every core.

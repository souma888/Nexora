# Rendering, input and interoperability audit

Scope: current browser entry points, shared model validation, numerical/algorithm dispatch, run storage/imports, CSV exports and production headers. This is a code review plus regression testing, not a penetration-test certification.

## Input boundaries

`contract.js` checks finite numeric ranges, integer/enum/list/text shapes and bounds before calling model-owned validation hooks. Numerical HTTP requests select registered models with own-property checks. Every recent engineering model is exposed through `/api/waves`; `/api/catalog` cross-references the executable registry. Algorithm validators separately bound their arrays, commands, texts and edge lists.

The algorithm `?values=` parameter is validated with `validateAlgorithm` before it can replace defaults. Invalid or injected markup retains the default example. Numeric sharing parameters pass finite/range/integer checks. Model/discipline selectors use fixed registries rather than constructing arbitrary module paths. The `?saved=` parameter is a local-library ID lookup, not a deserialized HTML or code payload.

The circuit parser uses a bounded component grammar, word-character names, finite values, node/resource limits and a rank check. Project dependencies use A–L task labels, bounded edges and DAG validation. Neither accepts arbitrary expressions or calls `eval`.

## HTML/SVG sink inventory

| File family                                                         | Interpolated material                                                         | Boundary                                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.js`                                                        | Source artwork and numeric thumbnail geometry                                 | Registry titles/descriptions/tags now use DOM text nodes. No imported label enters thumbnail markup.                                                |
| `studio.js`, `studio-art.js`, `studio-sections.js`                  | Trusted source templates/artwork and calculated finite curves/counts          | No user-provided HTML configuration; links come from registered routes. Dynamic labels use text nodes.                                              |
| `section-preview.js`                                                | Finite model/algorithm values                                                 | Inputs validated before solving; labels assigned with text nodes or SVG numeric formatting.                                                         |
| `lab.js`, `materials.js`, `beam-charts.ts`, `simulation.js`         | Calculated numeric coordinates, formatted numeric values, source-defined keys | Numeric/domain validation precedes rendering. Dynamic textual readouts use `textContent`.                                                           |
| `model-visuals.js`, `engineering-visuals.js`, `computer-visuals.js` | Schematics with numerical geometry and textual labels                         | Shared SVG text helper uses `escapeHtml`; model title is escaped in the quoted accessible label. Parsed circuit names are also grammar-constrained. |
| `algorithms.js`                                                     | Bounded numeric arrays, graph states and knapsack data                        | Model validators run before trace generation; URL values cannot directly populate markup.                                                           |
| `algorithm-views.js`                                                | Algorithm text/state/message labels                                           | Text and accessible labels use shared HTML/attribute escaping. Geometry/styles come from bounded counts and source constants.                       |
| `shell.ts`, `vite.config.js`                                        | Static shell plus registry labels/IDs                                         | Source-only navigation; registry labels use complete escaping.                                                                                      |
| `run-tools.ts`, `run-library.ts`                                    | User names, imported metadata, saved results                                  | DOM text nodes, `Option` text, and validated same-origin routes; no HTML sink.                                                                      |

The shared escape helper covers `&`, `<`, `>`, double quotes and apostrophes. The remaining `innerHTML` sites are intentional SVG or source-template construction, not a claim that arbitrary HTML has been sanitized. Introducing remote/custom HTML or new textual template sources requires another audit. ESLint rejects `eval`, implied eval and script URLs.

## Files, storage and spreadsheet handling

The mathematics/ML addition parses matrices, point arrays and samples as bounded numeric data before they reach the SVG renderer. Array dimensions, lengths and finite magnitudes are checked; embedded markup is rejected as a nonnumeric value. `math-visuals.js` interpolates numerical coordinates and source-only colors, escapes all SVG text/title content, and appends captions with `textContent`. Classification and integration workloads have finite size/step/attempt limits. Tests include malicious matrix text and invalid dataset recovery. This does not introduce expression evaluation, user-written scripts or a remote training service.

Run imports are limited to 200 kB and format/schema/model/solver-version checked. Inputs must be bounded scalar records; prototype-related keys and nonfinite numbers are rejected, then the actual model validator checks fields/relationships. Imported computed summaries are ignored. There is no object merge into application prototypes. Saved libraries are limited to 40 records and storage failures produce a visible export alternative. Corrupt records are ignored rather than executed.

JSON export contains portable input/version metadata and a computed summary. CSV additionally carries canonical-unit series or trace states. Textual spreadsheet-formula prefixes are neutralized before quoting; negative numerical values retain their type. Downloads use generated blob URLs that are revoked after use. Comparison refuses different model/solver versions and recomputes both inputs.

## Defense in depth and tests

Production headers restrict scripts/resources to the application origin, block object embeds and framing, disable MIME sniffing and restrict referrer leakage. Inline styles remain allowed because existing SVG/source styles require them; inline scripts are not allowed. Vite development intentionally retains its own local/HMR behavior. Headers do not replace escaping and runtime validation.

`tests/platform.test.js` covers parser boundaries, singular systems, invalid graph topology, units, portable-record shape/prototype rejection and formula-safe CSV cells. `e2e/platform.spec.js` submits malicious URL/import/name inputs, verifies no script executes, checks that forged results are recalculated, and covers save/restore/compare/export flows on desktop/mobile. Dependency audit results must be read separately from application-rendering safety; development-only glob-matching patches are pinned through package overrides and exercised by linting.

Remaining scope: no user accounts or shared persistent server data exist. Authentication, authorization, quotas/rate limiting for expensive shared workloads, cloud ownership policies and arbitrary user-provided code execution would need a separate design before introducing those features.

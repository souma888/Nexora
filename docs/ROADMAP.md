# Roadmap

No dates are promised. Completed items describe running code, not a proposed framework migration.

## Delivered foundation

- [x] MIT license and charcoal/crimson/forest design system.
- [x] Vite multi-page JavaScript/TypeScript UI and Node/Vercel API.
- [x] Shared field/error contracts, pure solvers and independent benchmark tests.
- [x] Formatting, ESLint, solver/API `checkJs`, strict TypeScript core modules, browser tests and GitHub Actions workflow.
- [x] Catalog/sidebar/studio previews across the registered disciplines.
- [x] Beam, axial stress, Mohr, circuits, control, algorithm traces and multidisciplinary labs; see [the generated inventory](CATALOG.md).
- [x] Worked examples, model limits, warnings, keyboard inspection, responsive themes and printing.
- [x] Local saved runs, recalculated restore/comparison, portable JSON and CSV exports.
- [x] Shared supported-unit conversion with scale and affine temperature offsets.
- [x] Editable DC circuit networks with assembled numerical solve and residual/power checks.
- [x] Editable project DAGs with topological scheduling, cycle detection and slack.
- [x] One derived catalog, generated documentation, and rendering/input audit.

## Next improvements

- [ ] Gradually eliminate implicit legacy helper parameters and enable the remaining strict JavaScript flags, beyond the checked model boundaries.
- [x] Separate teaching prose for the 71 lab-kit models from their numerical implementations; metadata is unchanged.
- [ ] Additional numerical convergence/stiffness studies and independent benchmark datasets.
- [ ] More physical/composite unit dimensions and optional output display-unit conversion.
- [ ] User-defined trusses, nonlinear/transient circuit elements, and larger graph editing with performance budgets.
- [ ] Optional cloud synchronization/authentication if a real account-based workflow is introduced.
- [ ] Classroom assignments and collaboration with an ownership/privacy design.
- [ ] An independent accessibility audit and assisted-technology testing beyond the automated keyboard/mobile checks.

## Release gates

A feature is complete only with running UI behavior, domain validation, appropriate independent tests, honest documentation, and no regression in the shared workbenches. Keep mechanical changes and functional changes in separate, explained commits. Retain AI-assistance disclosure and existing history; do not manufacture an authorship narrative.

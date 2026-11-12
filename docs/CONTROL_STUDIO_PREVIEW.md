# Homepage and Control Systems design preview

This release tries the Engineering Studio direction on the homepage and Control Systems catalog, with an instrument-style layout inside the 15 control labs.

- The studio uses an original SVG robot illustration, a live second-order response analyzer, and three illustrated entry points before the searchable catalog.
- The analyzer imports the existing solver. Its peak and overshoot are sampled over the displayed interval; the zero-damping case is explicitly identified as continuing oscillation. Opening the full workbench preserves the chosen frequency and damping in the URL. Reset restores the original lab defaults.
- Subject illustrations distinguish structures, circuits, mechanisms, thermal systems, algorithm families, and control-system topics. These illustrations are visual identifiers, not additional solver output.
- The shared sidebar groups the existing disciplines, includes accessible decorative icons, and brings the selected discipline into its scroll area. All existing routes and catalog filters remain available.
- Control labs use a green response trace, crimson accents, and measurements below the plot. At mobile widths the setup and plot stack normally. Print styles remove navigation and decorative layers. Reduced-motion preferences disable the new transitions and response fades.
- Continuous sliders use integer positions mapped to physical values so their endpoints remain reachable without floating-point step truncation. Numeric fields and their accessible slider values retain the actual units.

## Reverting the preview

The previous background change is saved separately as `5ff1226`. All changes in this document belong to the next, separate design commit. To remove the studio preview while retaining the background and simulator additions, revert only that design commit:

```powershell
git revert <design-commit-sha>
git push origin main
```

Use the SHA from the commit titled **Preview engineering studio homepage and control workbenches**. Avoid resetting or force-pushing the branch: `git revert` records the reversal without deleting any history.

## Verification

`e2e/studio.spec.js` checks the browser-to-API comparison, preview-to-workbench parameter handoff, reset, keyboard slider endpoints, catalog/search navigation, viewport overflow, theme switching and printing on desktop and mobile. Existing control tests cover all 15 lab defaults and their actual API results. The production build, TypeScript checks, solver/API tests and browser regressions remain the release checks.

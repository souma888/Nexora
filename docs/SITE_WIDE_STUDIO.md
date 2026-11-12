# Engineering Studio and Instrument Panel across Nexora

The visual direction introduced by commit `93210aa` now covers every discipline and lab template. This follow-up is a separate commit so it can be reverted while retaining the approved homepage and Control Systems preview.

## Catalog studios

All seventeen discipline views have an editorial introduction, a subject illustration, three featured links, and the existing searchable catalog. The original homepage and Control Systems analyzer are retained. Other live features use the existing solver for a representative experiment:

| Discipline | Live feature |
| --- | --- |
| Civil | Euler column buckling |
| Mechanical | Mass–spring oscillation |
| Electrical | Loaded voltage divider |
| Electronics | Half-wave rectifier |
| Signals & systems | Sampling and aliasing |
| Control Systems | Second-order step response |
| Thermofluids | Venturi flow meter |
| Digital / Computer Engineering | Logic gate playground |
| Robotics | Two-link forward kinematics |
| Computational Engineering | Euler and Runge–Kutta integration |
| Materials Science | Elastic–plastic stress–strain |
| Data Structures & Algorithms | Step-by-step Quick Sort |
| Communications & RF | AM envelope and overmodulation |
| Power & Energy | Buck converter duty and ripple |
| Aerospace & Flight | Ballistic launch trajectory |
| Chemical & Process Engineering | CSTR/PFR conversion |
| Industrial & Reliability Engineering | Weibull survival |

Previews have keyboard-operable controls and reset. Their physical values or selected sorting input carry into the full workbench through validated URL parameters. Invalid shared parameters retain the original defaults. The full teaching content and reference cases remain in each lab; catalog illustrations identify subjects and do not claim to be additional physical calculations.

## Shared workbenches

Beam, axial stress, Mohr’s circle, the generic simulation template, and the algorithm player share compact headers, crimson panel accents, numbered instrument headings, result cards, and consistent playback/inspection controls. Results remain green; other traces, loads, and algorithm states retain distinct semantic colors. Dense plots, diagrams and tables remain scrollable inside their panels. Mobile layouts stack the setup and stage. Printing and reduced-motion preferences are supported.

## Verification and rollback

`e2e/site-wide-studio.spec.js` checks every new discipline preview against the actual API, parameter handoff, Quick Sort input handoff, keyboard operation, reset, overflow, themes and printing. Existing tests continue to cover every simulator and algorithm. Reference screenshots are updated for the intentional changes to workbench widths and surfaces.

To undo only this expansion, run `git revert --no-edit <site-wide-studio-commit>` followed by `git push origin main`. The earlier preview and background commits remain in history. The commit title is **Extend engineering studios and instrument workbenches site-wide**.

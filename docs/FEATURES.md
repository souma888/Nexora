# Current features and scope

This describes shipped functionality. The complete executable inventory is [generated from the registry](CATALOG.md).

| Area               | Shipped                                                                                                            | Limit                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Catalog            | Search, discipline filters, persistent sidebar, subject previews                                                   | Bounded registered labs                                                              |
| Workbench          | Parameter controls, presets/reset, plot inspection, diagrams, tables, worked examples, predictions and model notes | Not an arbitrary multiphysics editor                                                 |
| Circuit builder    | User-defined resistors and independent DC V/I sources, modified nodal assembly and pivoted linear solve            | 20 ideal components, nodes 0–8, ground required                                      |
| Project scheduling | Editable durations/dependencies, DAG cycle detection, earliest/latest times, slack, Gantt                          | 2–12 tasks; no resource leveling/calendars                                           |
| Numerical methods  | Roots, Euler/RK4, finite-difference convergence, seeded sampling and assembled circuit solve                       | Each method’s model assumptions remain explicit                                      |
| Algorithms         | Editable bounded inputs, pseudocode, playback, intermediate state, operation counts                                | Older graph algorithms use six nodes                                                 |
| Units              | Dimension-checked scale/offset conversion for registered physical units, contextual mechanics converters           | Registered composite dimensions supported; empirical/fractional units stay canonical |
| Saved runs         | Browser library, restore/recalculate, same-model/version comparisons                                               | Local browser only; 40 runs; no cloud sync                                           |
| Export/import      | Portable versioned JSON, numerical summaries and CSV plot/trace data, recalculated imports                         | Same-model/current-version imports; 200 kB file limit                                |
| Access and themes  | Keyboard controls, responsive layouts, dark/light, print styles, reduced motion                                    | Tests do not constitute a complete accessibility certification                       |
| Quality            | Formatting, lint, backend/API JS checking, strict TS modules, independent references, browser-to-API checks, CI    | Legacy helper typing remains incremental                                             |

See [advanced platform details and limits](ADVANCED_PLATFORM.md) for the truss FEM worker, shared analysis, fitting, surrogate, reports, practice, embed, offline and package workflows.

## Not shipped

Accounts, collaborative classrooms, cloud-synced workspaces, 3D geometry authoring, nonlinear circuit devices, transient arbitrary networks, and professional design certification. These are future scope, not installed dependencies or hidden features.

## Definition of done

A model needs equations, units/signs, assumptions, ordinary/edge/invalid reference cases, a usable browser flow and explicit domain errors. Exact analytical models are described as analytical; numerical methods expose their method and limits. New registrations must regenerate the catalog and pass every CI quality gate.

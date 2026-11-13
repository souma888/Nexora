# Feature Catalog and Prioritization

Legend: **MVP** = first release target; **Next** = post-MVP; **Explore** = longer-term possibility. Nothing listed is implemented yet.

| Area                | Module / feature                                        | Priority |
| ------------------- | ------------------------------------------------------- | -------- |
| Core                | Experiment catalog, search, responsive layout           | MVP      |
| Core                | Validated parameter controls, units, reset and presets  | MVP      |
| Core                | 2D diagrams, interactive charts, equations and warnings | MVP      |
| Mechanics of solids | Beam shear force and bending moment diagrams            | MVP      |
| Mechanics of solids | Beam slope and deflection for supported cases           | MVP      |
| Mechanics of solids | Axial loading and stress/strain                         | MVP      |
| Mechanics of solids | Plane stress and Mohr's circle                          | MVP      |
| Platform            | Save, compare, and export experiment results            | Next     |
| Civil / structures  | Trusses and structural load paths                       | Next     |
| Mechanical          | Rigid-body kinematics and mechanisms                    | Next     |
| Mechanical          | Vibrations, springs, dampers and gears                  | Next     |
| Electrical          | DC/AC circuits and RLC transients                       | Next     |
| Electronics         | Diodes, BJT/MOSFET simplified models, filters           | Next     |
| Signals             | Convolution, Fourier series/transforms, sampling        | Next     |
| Platform            | Accounts, dashboard and personal workspaces             | Next     |
| Visualization       | 3D interactive assemblies and animations                | Explore  |
| Education           | Guided labs, quizzes, classroom sharing                 | Explore  |
| Advanced            | Control systems, fluids, heat transfer, robotics        | Explore  |
| Advanced            | General finite-element workflows                        | Explore  |

## Shared experiment UX

Each module should present: **problem statement → model/diagram → inputs → run/update → plots/outputs → assumptions → worked explanation → validation/reference**.

## Definition of done for a module

- Documented equations, assumptions, sign convention and units.
- Domain-checked inputs and informative error states.
- Analytical reference tests and edge-case coverage.
- Clear graph labels and accessible controls.
- Reproducible example configuration.
- No unqualified claims of professional-grade accuracy.

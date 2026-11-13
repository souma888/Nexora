# Control systems and algorithms

The initial control-system/algorithm release added 30 labs to the existing 19. The subsequent [DSA expansion](DSA_LABS.md) adds another 30, bringing the total to 79. Both sections are available from the shared sidebar, including while inside any experiment. Catalog search matches each lab's title, description, section, and subject tag.

## Control Systems — 15 labs

| Lab                             | What to investigate                                                         |
| ------------------------------- | --------------------------------------------------------------------------- |
| First-Order Step Response       | Static gain, time constant, and the 63.2% rule                              |
| Second-Order Step Response      | Natural frequency, damping, overshoot, critical and overdamped limits       |
| PID Tuning                      | Proportional, integral, and derivative feedback around a second-order plant |
| DC Motor Speed Control          | Coupled armature current and rotor speed under proportional feedback        |
| Cruise Control                  | Vehicle mass, linear drag, tracking offset, and transient speed             |
| Tank Level Feedback             | Cross-sectional area, linear outlet flow, and equilibrium level             |
| PI Temperature Regulation       | Heat loss, integral action, and normalized temperature rise                 |
| Inverted Pendulum Stabilization | Small-angle upright dynamics and the PD stability threshold                 |
| Integrator Windup               | Actuator saturation, a falling setpoint, and conditional integration        |
| First-Order Bode Magnitude      | Logarithmic frequency, −3 dB corner, and magnitude rolloff                  |
| Lead Compensator                | Positive phase boost and geometric-mean peak frequency                      |
| Lag Compensator                 | Negative phase and high-frequency attenuation                               |
| Closed-Loop Pole Locus          | Two real poles, breakaway, conjugate roots, selected gain markers           |
| First-Order Nyquist Plot        | Complex response, frequency direction, and circular geometry                |
| Discrete-Time Feedback          | Closed-loop pole, alternating responses, convergence, and divergence        |

Each model has input bounds and units, live sliders, a prediction question, a plot inspector, three numerical results, governing equations, a reproducible example, and explicit assumptions. Results labelled “at end of view” are finite-horizon samples, not a claim of convergence. Unstable linear systems are deliberately allowed; their large outputs illustrate model failure or instability.

Analytical solutions are used where available. Coupled time-domain systems use RK4 with a fixed 2 ms step and report 20 ms samples. The windup reference changes at 5 seconds. Large pendulum angles fall outside the small-angle model; no cart model is implied. Nyquist geometry is independent of time constant, while its corner frequency changes with τ. Bode plots show magnitude and corner phase; they do not present a full stability margin analysis.

## Data Structures & Algorithms — 15 labs

| Subject             | Labs                                                     |
| ------------------- | -------------------------------------------------------- |
| Sorting             | Bubble, Insertion, Selection, Merge, Quick, Heap         |
| Searching           | Linear, Binary                                           |
| Graph traversal     | Breadth-First Search (queue), Depth-First Search (stack) |
| Shortest paths      | Dijkstra, Bellman–Ford, A*                               |
| Dynamic programming | 0/1 Knapsack                                             |
| Number theory       | Euclidean GCD                                            |

All support editable input, presets, worked examples, prediction questions, step explanations, pseudocode highlighting, counters, keyboard scrubbing, and reversible playback. Array algorithms use bars and state tables; graph algorithms use directed weighted diagrams and distance/parent tables; knapsack uses a capacity table and item backtracking; GCD records each quotient and remainder.

Binary search sorts a copy and reports indexes in that copy. BFS ignores weights; DFS is not a shortest-path algorithm. Dijkstra and A* use linear frontier selection, so their published complexity reflects this implementation. A* scales Euclidean geometry by the minimum edge-weight/length ratio to keep its heuristic consistent. Bellman–Ford reports a reachable negative cycle rather than inventing finite distances. Sorting stability, worst-case pivot choices, and trace-memory overhead are explained in each lab.

## References

- [University of Michigan CTMS: DC Motor Speed](https://ctms.engin.umich.edu/CTMS/index.php?example=MotorSpeed&section=SystemModeling) — motor equations and example parameters.
- [University of Michigan CTMS: PID design](https://ctms.engin.umich.edu/CTMS/?example=MotorSpeed&section=ControlPID) — feedback and controller design context.
- [MIT OpenCourseWare 6.006 lecture notes](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/) — sorting, graph search, shortest paths, and dynamic programming.

These references provide teaching context. The executable checks and the independent reference values used in this release are documented in `VALIDATION.md`.

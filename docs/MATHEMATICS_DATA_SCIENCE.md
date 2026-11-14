# Mathematics and model learning

Mathematics contains 52 labs in five subjects. Machine Learning & Data Science contains 14 more. The executable manifest, generated [catalog](CATALOG.md), navigation and OpenAPI discovery include all 66 through `POST /api/waves`. These are bounded educational models, not arbitrary symbolic computation or a general-purpose ML framework.

Open Mathematics from the left navigation, then use **Subject** to select Calculus & Real Analysis, Linear Algebra, Differential Equations & Dynamical Systems, Probability & Statistics, or Numerical Methods. Subject selection composes with search and discipline selection. Each workbench has a prediction question, equations, a worked example, explicit limits, numerical results and keyboard plot inspection. Seeded random models repeat exactly for the same inputs. Changing a seed draws a new realization.

## Things to try

| Lab                   | Experiment                                         | What to inspect                                                                                      |
| --------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Limits and ε–δ        | Increase δ at fixed ε                              | Certification uses an analytical supremum, not the sampled curve. Shaded bands show both tolerances. |
| Riemann sums          | Compare four rules at n=2                          | Left 0.125, right 0.625, midpoint 0.3125, trapezoid 0.375; exact area 1/3.                           |
| Gaussian elimination  | Enter `[[1,0,0,1],[0,1,0,2],[0,0,0,3]]`            | An inconsistent row, no claimed solution, and intermediate row-operation frames.                     |
| Eigen geometry        | Enter `[[0,-1],[1,0]]`                             | No real eigendirections; imaginary magnitude 1.                                                      |
| SVD                   | Enter `[[3,0],[0,2]]`, rank 1                      | Singular values 3 and 2, reconstruction error 2.                                                     |
| Lotka–Volterra        | Set initial populations to 1 with default rates    | Constant equilibrium and essentially zero conserved-quantity drift.                                  |
| Logistic harvesting   | Raise H above rK/4                                 | Positive equilibria disappear; extinction is an absorbing boundary.                                  |
| Lorenz                | Change perturbation and horizon                    | Separation between two integrations; x–z projection, not a proof of chaos.                           |
| Stiff Euler           | Default λ=50, h=0.05                               | λh=2.5: a growing explicit error and a stable but approximate implicit result.                       |
| Bayes diagnostic      | Default 1% prevalence, 95% sensitivity/specificity | Positive predictive value about 16.1%, despite high sensitivity.                                     |
| Markov chain          | Set p=q=1                                          | Unique stationarity can coexist with persistent oscillation.                                         |
| Confidence intervals  | Change seed or experiment count                    | Observed coverage fluctuates; it is not a probability assigned to the fixed mean.                    |
| Heat equation         | Raise diffusion number above 0.5                   | A tiny high-frequency perturbation grows; large values trigger a cutoff warning.                     |
| Poisson relaxation    | Increase sweeps, then refine the grid              | Algebraic residual and continuum discretization error are different.                                 |
| RK45                  | Tighten tolerance and vary initial step            | Rejected trials, accepted steps and endpoint error against an exact exponential.                     |
| Logistic / SVM        | Choose concentric rings                            | Linear models cannot represent rings; an RBF SVM can. Check its KKT residual.                        |
| Perceptron / backprop | Compare XOR                                        | A linear threshold unit fails; a nonlinear hidden layer can learn it.                                |
| k-means / EM          | Scrub the objective plot                           | Hard assignments/centers versus soft responsibilities and likelihood.                                |
| Bias–variance         | Increase polynomial degree                         | Mean prediction, squared bias, ensemble variance and irreducible noise.                              |
| Convolution           | Change padding, then stride                        | Output dimensions and signed responses; CNN-style cross-correlation.                                 |

## Implementation and limits

- `math-core.js` supplies bounded parsing, small-matrix operations, symmetric Jacobi eigendecomposition, LU, RK4, seeded moments and normal distribution approximations. `mathLab` preserves generic input/result types through each subject module. Numbers are dimensionless unless an equation explicitly declares a physical unit.
- Five `mathematics-*.js` modules hold distinct models and domain validation. Closed forms teach identities; numerical methods expose error against independent analytical references where available.
- `ml-engine.js` implements logistic optimization, coordinate-descent ridge/lasso, k-means++/Lloyd, KNN, bounded simplified SMO, covariance PCA, explicit neural gradients, constrained Gaussian-mixture EM and image stencils. No remote service trains these models.
- Polynomial ensembles use a Legendre basis and modified Gram–Schmidt QR, avoiding normal equations. Matrix labs expose binary64 rounding and pivot growth.
- RK45 uses Dormand–Prince 5(4), absolute/relative error scaling, rejection, safety factors and an attempt cap. Local tolerance is not a global accuracy guarantee. RK4 labs use stated finite step counts; no universal adaptive or stiff solver is claimed.
- Full workbenches use a cancellable Web Worker. The two lightweight section previews compute bounded wave/quadratic models directly. Obsolete worker tasks are cancelled on input changes.
- Shared save/compare, CSV/JSON/PNG/PDF exports and scalar sweeps/uncertainty remain available. Matrix/data-array entries are editable, but scalar analysis does not automatically vary individual entries. Short or discrete traces may be unsuitable for surrogate fitting.
- Heatmaps are finite display grids; sampled maxima are labeled. Classifier color is model output, not confidence. SVM scores are not probabilities. Optimization residuals and failure cutoffs are visible rather than suppressed.

## Verification

`tests/mathematics.test.js` checks each new default for validation, deterministic output, finite nested data, rendering without nonfinite coordinates and HTTP parity. Independent reference cases cover all four quadrature rules, ellipse/circle geometry, eigenvectors, singular/inconsistent matrices, exact ODE responses, Bayesian counts, probability mass, known-variance intervals, stationary distributions, grid refinement and iterative residuals.

ML checks include every backprop parameter by central finite differences, SVM box/equality feasibility, monotone Lloyd/EM objectives across seeded property samples, linear separation, XOR failure/success and convolution sums. These are implementation checks, not production-library equivalence or universal convergence proofs.

`e2e/mathematics.spec.js` covers every new workbench on desktop/mobile against HTTP results, keyboard inspection, reset, navigation and overflow. It also checks subject/search filters, matrix-validation recovery, representative visual captures and axe accessibility. Existing suites cover shared save/compare/export, analysis, theme/print/embed/offline flows. The reference badge means documented cases pass, not external certification.

The published `@souma88/solvers@0.1.0` remains the earlier 175-lab snapshot. This website expansion does not alter that immutable release. A package built from this checkout includes the current manifest; publishing requires a new version.

## Algorithm references

- [SciPy RK45](https://docs.scipy.org/doc/scipy/reference/generated/scipy.integrate.RK45.html) and [Dormand–Prince coefficients](https://github.com/scipy/scipy/blob/main/scipy/integrate/_ivp/rk.py) describe the embedded pair used as a coefficient reference. This implementation is independent and scalar.
- [scikit-learn’s SVM formulation](https://scikit-learn.org/stable/modules/svm.html#mathematical-formulation) explains the dual, kernels and margins. The small SMO implementation here is not libsvm.
- NIST’s [binomial](https://itl.nist.gov/div898/handbook/eda/section3/eda366i.htm), [normal](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3671.htm) and [confidence interval](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm) references support statistical definitions and interpretation.

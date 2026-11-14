import {
  mathLab,
  p,
  integer,
  choice,
  random,
  normal,
  mean,
  variance,
  dot,
  norm,
  samples,
  linspace,
  table,
  gridVisual,
  vectors,
  traceVisual,
  normalDensity,
} from './math-core.js';
import {
  dataset,
  boundaryGrid,
  accuracy,
  logisticTrain,
  kmeans,
  knn,
  regularizationPath,
  trainSVM,
  pca,
  neuralLossGradient,
  neuralPredict,
  mixtureEM,
  convolution,
} from './ml-engine.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial),
  seed = integer('Random seed', 1, 999999, 42),
  noise = real('Dataset noise', 0.05, 0.8, 0.25);
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) =>
  mathLab({ ml: true, topic: 'Machine Learning & Data Science', ...config }, solve);
const shape = choice(
  'Dataset',
  { linear: 'Two linear clusters', xor: 'XOR quadrants', rings: 'Concentric rings' },
  'linear',
);
const classifierVisual = (data, predict, extra = {}) =>
  gridVisual(boundaryGrid(predict), {
    extent: 3,
    points: data.map((p) => [...p.x, p.label]),
    caption: 'Feature plane: x₁ horizontal, x₂ vertical; dots show labeled observations',
    ...extra,
  });
const classPlot = { x: 'Feature x₁', y: 'Decision slice at x₂=0', xUnit: '', yUnit: '' };
export const machineLearningModels = {
  mlgradient: make(
    {
      id: 'mlgradient',
      title: 'Gradient Descent on Loss Surfaces',
      inputs: {
        rate: real('Learning rate', 0.005, 0.3, 0.08),
        momentum: real('Momentum β', 0, 0.99, 0.7),
        condition: real('Quadratic curvature ratio', 1, 30, 8),
        steps: integer('Updates', 5, 200, 60),
      },
      metrics: {
        loss: ['Final loss', '1'],
        gradient: ['Final gradient norm', '1'],
        spectral: ['High-curvature ηλ', '1'],
      },
      plot: { x: 'Update', y: 'Loss', xUnit: '', yUnit: '' },
      text: {
        description:
          'Follow a momentum optimizer across an anisotropic quadratic and see overshoot, oscillation or divergence.',
        predict: 'Can a larger learning rate make convergence worse?',
        answers: ['Yes, it can destabilize the iteration', 'No', 'Only with noisy data'],
        explain:
          'A quadratic gradient step needs 0<ηλ<2 without momentum; momentum changes the characteristic roots.',
        example: 'L=(x²+8y²)/2 has its minimum at the origin and much steeper curvature in y.',
        equation: 'vₖ₊₁=βvₖ+∇L(wₖ); wₖ₊₁=wₖ−ηvₖ₊₁.',
        limits:
          'A deterministic two-dimensional convex quadratic, not a neural-network loss landscape. Updates stop above magnitude 10⁸ and the last finite state is retained with a divergence warning.',
      },
    },
    ({ rate, momentum, condition: k, steps }) => {
      let w = [2, 2],
        v = [0, 0],
        stopped = false;
      const points = [w.slice()],
        loss = (x) => (x[0] ** 2 + k * x[1] ** 2) / 2,
        series = [{ x: 0, y: loss(w) }];
      for (let i = 1; i <= steps; i++) {
        const g = [w[0], k * w[1]],
          nextV = v.map((a, j) => momentum * a + g[j]),
          next = w.map((a, j) => a - rate * nextV[j]);
        if (next.some((a) => !Number.isFinite(a) || Math.abs(a) > 1e8)) {
          stopped = true;
          break;
        }
        v = nextV;
        w = next;
        points.push([...w]);
        series.push({ x: i, y: loss(w) });
      }
      return {
        summary: { loss: loss(w), gradient: Math.hypot(w[0], k * w[1]), spectral: rate * k },
        series,
        visualization: traceVisual(points, {
          caption: 'Optimizer path in parameter space; minimum at (0,0)',
        }),
        warnings: stopped ? ['Divergence cutoff reached; the last finite iterate is shown.'] : [],
      };
    },
  ),
  mlregularization: make(
    {
      id: 'mlregularization',
      title: 'Ridge and Lasso Regularization Paths',
      inputs: { correlation: real('Feature correlation', 0, 0.95, 0.7), noise, seed },
      metrics: {
        ridge: ['Ridge |w₂| at largest λ', '1'],
        lasso: ['Lasso |w₂| at largest λ', '1'],
        zeros: ['Lasso zero coefficients at largest λ', '1'],
      },
      plot: {
        x: 'Penalty λ',
        y: 'Coefficient value',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Ridge w₁', reference: 'Lasso w₁', other: 'Lasso w₂' },
      },
      text: {
        description:
          'Fit centered, standardized correlated features along a regularization path and inspect shrinkage versus exact sparsity.',
        predict: 'Which penalty can set coefficients exactly to zero?',
        answers: ['Lasso L1', 'Ridge L2', 'Neither'],
        explain: 'The L1 coordinate update uses soft thresholding; ridge shrinks continuously.',
        example:
          'The synthetic target is 2x₁ plus noise; x₂ is correlated but has no true direct coefficient.',
        equation: 'Minimize ||y−Xw||²/(2n)+λ||w||₁ (lasso), or +λ||w||²/2 (ridge).',
        limits:
          'Two standardized features, unpenalized centered intercept. Coordinate descent uses a 10⁻⁹ update tolerance and 2000-sweep cap; correlated features can share or exchange coefficients. This is a synthetic training path, not a test-set model-selection score.',
      },
    },
    ({ correlation, noise, seed }) => {
      const rng = random(seed),
        X = Array.from({ length: 80 }, () => {
          const a = normal(rng);
          return [a, correlation * a + Math.sqrt(1 - correlation ** 2) * normal(rng)];
        }),
        mx = [mean(X.map((r) => r[0])), mean(X.map((r) => r[1]))],
        sd = [Math.sqrt(variance(X.map((r) => r[0]))), Math.sqrt(variance(X.map((r) => r[1])))];
      for (const r of X) for (let j = 0; j < 2; j++) r[j] = (r[j] - mx[j]) / sd[j];
      const y = X.map((r) => 2 * r[0] + noise * normal(rng)),
        my = mean(y);
      for (let i = 0; i < y.length; i++) y[i] -= my;
      const lambda = linspace(0, 2.5, 80),
        ridge = regularizationPath(X, y, lambda),
        lasso = regularizationPath(X, y, lambda, true);
      return {
        summary: {
          ridge: Math.abs(ridge.at(-1).w[1]),
          lasso: Math.abs(lasso.at(-1).w[1]),
          zeros: lasso.at(-1).w.filter((v) => v === 0).length,
        },
        series: lambda.map((x, i) => ({
          x,
          y: ridge[i].w[0],
          reference: lasso[i].w[0],
          other: lasso[i].w[1],
        })),
        table: table(
          'Full coefficient paths',
          ['λ', 'Ridge w₁', 'Ridge w₂', 'Lasso w₁', 'Lasso w₂'],
          lambda.map((v, i) => [v, ...ridge[i].w, ...lasso[i].w]),
        ),
        warnings: [...ridge, ...lasso].some((v) => !v.converged)
          ? ['Some coordinate-descent fits reached the iteration cap.']
          : [],
      };
    },
  ),
  mllogistic: make(
    {
      id: 'mllogistic',
      title: 'Logistic Regression Decision Boundary',
      inputs: {
        shape,
        noise,
        rate: real('Learning rate', 0.01, 1, 0.2),
        steps: integer('Gradient steps', 20, 800, 300),
        penalty: real('L2 penalty', 0, 1, 0.01),
        seed,
      },
      metrics: {
        loss: ['Penalized training loss', '1'],
        train: ['Training accuracy', '1'],
        test: ['Independent test accuracy', '1'],
      },
      plot: { x: 'Gradient step', y: 'Penalized cross entropy', xUnit: '', yUnit: '' },
      text: {
        description:
          'Train a linear logistic classifier and inspect predicted probability over a two-feature plane.',
        predict: 'Can a linear logistic model represent concentric classes exactly?',
        answers: [
          'No, it has a linear logit boundary',
          'Yes, with enough steps',
          'Only at learning rate one',
        ],
        explain:
          'Optimization cannot overcome a model class that excludes the needed nonlinear boundary.',
        example:
          'Linearly separated Gaussian clusters usually admit a high-accuracy linear separator.',
        equation: 'p(y=1|x)=sigmoid(wᵀx+b); loss=mean softplus(z)−yz+λ||w||²/2.',
        limits:
          'Full-batch gradient descent on 60 training and 120 independent test points. Background color represents model probability, not calibrated confidence. Finite iterations may not reach the optimum.',
      },
    },
    ({ shape, noise, rate, steps, penalty, seed }) => {
      const data = dataset(shape, 60, seed, noise),
        test = dataset(shape, 120, seed + 10007, noise),
        m = logisticTrain(data, rate, steps, penalty);
      return {
        summary: {
          loss: m.history.at(-1).y,
          train: accuracy(data, (x) => +(m.predict(x) >= 0.5)),
          test: accuracy(test, (x) => +(m.predict(x) >= 0.5)),
        },
        series: m.history,
        visualization: classifierVisual(data, m.predict),
      };
    },
  ),
  mlkmeans: make(
    {
      id: 'mlkmeans',
      title: 'k-Means Clustering',
      inputs: {
        clusters: integer('Clusters k', 1, 4, 2),
        noise,
        iterations: integer('Lloyd iterations', 1, 30, 10),
        seed,
      },
      metrics: {
        sse: ['Within-cluster sum of squares', '1'],
        empty: ['Empty clusters', '1'],
        updates: ['Lloyd updates', '1'],
      },
      plot: { x: 'Lloyd iteration', y: 'Within-cluster SSE', xUnit: '', yUnit: '' },
      text: {
        description:
          'Alternate nearest-center assignment and centroid updates, with k-means++ initialization and a trace of the objective.',
        predict: 'Can k-means reliably recover concentric rings?',
        answers: [
          'No, its Voronoi cells favor compact Euclidean clusters',
          'Yes, for k=2',
          'Only with more iterations',
        ],
        explain: 'Euclidean centroid partitions are convex and do not match nested rings.',
        example: 'Two separated compact clouds typically produce two centers near the cloud means.',
        equation: 'J=Σᵢ||xᵢ−μcᵢ||²; μⱼ=mean of points assigned to cluster j.',
        limits:
          '80 synthetic points, Euclidean distance and finite Lloyd updates. Empty centers are held unchanged, preserving a nonincreasing objective. k-means++ is seeded; local minima remain possible.',
      },
    },
    ({ clusters, noise, iterations, seed }) => {
      const points = dataset('linear', 80, seed, noise).map((p) => p.x),
        m = kmeans(points, clusters, iterations, seed);
      return {
        summary: {
          sse: m.history.at(-1).y,
          empty: m.centers.filter((_c, j) => !m.labels.includes(j)).length,
          updates: iterations,
        },
        series: m.history,
        visualization: {
          type: 'math-space',
          kind: 'clusters',
          points,
          frames: m.frames,
          caption: 'Scrub the objective to inspect assignments and centroid positions',
        },
        table: table(
          'Final centers',
          ['Cluster', 'x₁', 'x₂'],
          m.centers.map((c, i) => [i + 1, ...c]),
        ),
      };
    },
  ),
  mlknn: make(
    {
      id: 'mlknn',
      title: 'k-Nearest Neighbors Decision Boundaries',
      inputs: { shape, neighbors: integer('Neighbors k', 1, 15, 5), noise, seed },
      metrics: {
        train: ['Resubstitution accuracy', '1'],
        test: ['Independent test accuracy', '1'],
        neighbors: ['Neighbor count', '1'],
      },
      plot: classPlot,
      text: {
        description:
          'Change neighborhood size and compare local class regions with independent test performance.',
        predict: 'Why can k=1 have perfect resubstitution accuracy but worse test accuracy?',
        answers: [
          'Each training point selects itself and may memorize noise',
          'It has no parameters',
          'Test labels are always wrong',
        ],
        explain: 'Training-point self-inclusion makes the resubstitution score optimistic.',
        example: 'Small k draws detailed boundaries; larger k averages over broader neighborhoods.',
        equation: 'p̂(y=1|x)=mean label among the k nearest Euclidean neighbors.',
        limits:
          '60 training points and 120 independent test points in a bounded 2D synthetic problem. Distance ties use input order; probability ties choose class 1. No feature scaling is learned because coordinates already share a scale.',
      },
    },
    ({ shape, neighbors, noise, seed }) => {
      const a = dataset(shape, 60, seed, noise),
        b = dataset(shape, 120, seed + 10007, noise),
        predict = (x) => knn(a, x, neighbors);
      return {
        summary: {
          train: accuracy(a, (x) => +(predict(x) >= 0.5)),
          test: accuracy(b, (x) => +(predict(x) >= 0.5)),
          neighbors,
        },
        series: samples(-3, 3, (x) => ({ y: predict([x, 0]) })),
        visualization: classifierVisual(a, predict),
      };
    },
  ),
  mlpca: make(
    {
      id: 'mlpca',
      title: 'Principal Component Analysis',
      inputs: {
        correlation: real('Population correlation', -0.95, 0.95, 0.8),
        scale: real('Second-feature scale', 0.2, 3, 1),
        seed,
      },
      metrics: {
        explained: ['First-component variance fraction', '1'],
        error: ['Mean rank-one reconstruction squared error', '1'],
        lambda1: ['Leading sample eigenvalue', '1'],
        lambda2: ['Second sample eigenvalue', '1'],
      },
      plot: { x: 'First principal score', y: 'Second principal score', xUnit: '', yUnit: '' },
      text: {
        description:
          'Center a correlated cloud, rotate to covariance eigenvectors and project onto a one-dimensional subspace.',
        predict: 'Does PCA use class labels to choose its axes?',
        answers: ['No', 'Yes', 'Only for two classes'],
        explain:
          'PCA maximizes variance in unlabeled observations; a high-variance direction need not separate classes.',
        example: 'A strongly positively correlated cloud has a leading axis near the diagonal.',
        equation: 'C=XcᵀXc/(n−1); Cv=λv; reconstruction μ+(v₁ᵀ(x−μ))v₁.',
        limits:
          'Sample-covariance PCA on two centered features, without variance standardization. Changing feature units can rotate the components; eigenvector signs are arbitrary.',
      },
    },
    ({ correlation: r, scale, seed }) => {
      const rng = random(seed),
        points = Array.from({ length: 80 }, () => {
          const x = normal(rng);
          return [x, scale * (r * x + Math.sqrt(1 - r * r) * normal(rng))];
        }),
        m = pca(points),
        v = m.vectors.map((row) => row[0]),
        w = m.vectors.map((row) => row[1]),
        scores = m.centered.map((x) => [dot(x, v), dot(x, w)]);
      return {
        summary: {
          explained: m.values[0] / (m.values[0] + m.values[1]),
          error: mean(scores.map((s) => s[1] ** 2)),
          lambda1: m.values[0],
          lambda2: m.values[1],
        },
        series: scores.map(([x, y]) => ({ x, y })).sort((a, b) => a.x - b.x),
        visualization: vectors(m.centered, {
          arrows: [
            [0, 0, 2 * v[0], 2 * v[1]],
            [0, 0, 2 * w[0], 2 * w[1]],
          ],
          caption: 'Centered observations with orthogonal principal axes',
        }),
        table: table(
          'Principal axes',
          ['Component', 'Eigenvalue', 'v₁', 'v₂'],
          m.values.map((x, i) => [i + 1, x, ...m.vectors.map((r) => r[i])]),
        ),
      };
    },
  ),
  mlsvm: make(
    {
      id: 'mlsvm',
      title: 'SVM Margins and Kernels',
      inputs: {
        shape,
        kernel: choice('Kernel', { linear: 'Linear', rbf: 'Gaussian RBF' }, 'rbf'),
        penalty: real('Soft-margin C', 0.1, 10, 1),
        gamma: real('RBF γ', 0.1, 4, 1),
        noise,
        seed,
      },
      metrics: {
        support: ['Support vectors', '1'],
        violation: ['Maximum KKT violation', '1'],
        train: ['Training accuracy', '1'],
        test: ['Independent test accuracy', '1'],
      },
      plot: {
        ...classPlot,
        y: 'Signed decision function',
        traces: { y: 'Decision f(x₁,0)', reference: 'Positive margin', other: 'Negative margin' },
      },
      text: {
        description:
          'Solve a small soft-margin SVM dual with SMO and compare linear and radial-kernel decision regions.',
        predict: 'Is the signed SVM decision value a probability?',
        answers: ['No', 'Yes', 'Only with an RBF kernel'],
        explain:
          'The decision function measures a margin score; probability calibration is a separate procedure.',
        example: 'An RBF kernel can separate nested rings that a linear hyperplane cannot.',
        equation: 'max Σα−½ΣαᵢαⱼyᵢyⱼKᵢⱼ, subject to 0≤α≤C and Σαᵢyᵢ=0.',
        limits:
          '40 training observations; deterministic simplified SMO with a sweep cap. KKT violation is shown explicitly, and a residual above 0.01 warns of incomplete optimization. RBF background uses a bounded score mapping for display, not probability.',
      },
    },
    ({ shape, kernel, penalty, gamma, noise, seed }) => {
      const a = dataset(shape, 40, seed, noise),
        b = dataset(shape, 100, seed + 10007, noise),
        m = trainSVM(a, penalty, gamma, kernel);
      return {
        summary: {
          support: m.a.filter((v) => v > 1e-6).length,
          violation: m.violation,
          train: accuracy(a, (x) => +(m.predict(x) >= 0)),
          test: accuracy(b, (x) => +(m.predict(x) >= 0)),
        },
        series: samples(-3, 3, (x) => ({ y: m.predict([x, 0]), reference: 1, other: -1 })),
        visualization: classifierVisual(a, (x) => 0.5 + 0.5 * Math.tanh(m.predict(x)), {
          support: a.filter((_p, i) => m.a[i] > 1e-6).map((p) => p.x),
          caption: 'SVM signed-score map; outlined observations are support vectors',
        }),
        warnings:
          m.violation > 0.01
            ? ['SMO has not met a 0.01 maximum KKT residual; treat this as an approximate fit.']
            : [],
      };
    },
  ),
  mltree: make(
    {
      id: 'mltree',
      title: 'Decision Tree Splitting: Gini and Entropy',
      inputs: {
        shape,
        criterion: choice('Impurity', { gini: 'Gini', entropy: 'Entropy' }, 'gini'),
        minleaf: integer('Minimum observations per leaf', 1, 15, 4),
        noise,
        seed,
      },
      metrics: {
        gain: ['Best impurity decrease', '1'],
        threshold: ['Selected threshold', '1'],
        axis: ['Split feature number', '1'],
        train: ['Stump training accuracy', '1'],
      },
      plot: {
        x: 'Candidate threshold',
        y: 'Weighted impurity decrease',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Feature 1', reference: 'Feature 2' },
      },
      text: {
        description:
          'Enumerate candidate splits on both features, enforce a minimum leaf size and inspect the best decision stump.',
        predict: 'Why weight child impurity by child sample count?',
        answers: [
          'To account for how much data each child contains',
          'To favor empty leaves',
          'To make all splits equal',
        ],
        explain:
          'The objective is expected impurity after routing a random training observation to a child.',
        example:
          'A pure binary leaf has Gini and entropy both zero; a balanced leaf has Gini 0.5 and entropy 1 bit.',
        equation: 'Gini=1−Σp²; entropy=−Σp log₂p; gain=I(parent)−Σ(nchild/n)I(child).',
        limits:
          'One axis-aligned split, not a full recursive tree. Threshold candidates are adjacent-value midpoints; no post-pruning or validation-based depth selection is performed.',
      },
    },
    ({ shape, criterion, minleaf, noise, seed }) => {
      const data = dataset(shape, 60, seed, noise),
        impurity = (a) => {
          const q = mean(a.map((p) => p.label));
          return criterion === 'gini'
            ? 2 * q * (1 - q)
            : q === 0 || q === 1
              ? 0
              : -q * Math.log2(q) - (1 - q) * Math.log2(1 - q);
        },
        base = impurity(data),
        candidates = [[], []];
      let best = { gain: -1, threshold: 0, axis: 0, left: 0.5, right: 0.5 };
      for (let j = 0; j < 2; j++) {
        const values = [...new Set(data.map((p) => p.x[j]))].sort((a, b) => a - b);
        for (let i = 1; i < values.length; i++) {
          const t = (values[i - 1] + values[i]) / 2,
            a = data.filter((p) => p.x[j] <= t),
            b = data.filter((p) => p.x[j] > t);
          if (a.length < minleaf || b.length < minleaf) continue;
          const gain = base - (a.length * impurity(a) + b.length * impurity(b)) / data.length;
          candidates[j].push({ x: t, y: gain });
          if (gain > best.gain)
            best = {
              gain,
              threshold: t,
              axis: j,
              left: mean(a.map((p) => p.label)),
              right: mean(b.map((p) => p.label)),
            };
        }
      }
      const predict = (x) => (x[best.axis] <= best.threshold ? best.left : best.right),
        series = candidates
          .flatMap((rows, j) =>
            rows.map((r) => ({ x: r.x, y: j === 0 ? r.y : null, reference: j === 1 ? r.y : null })),
          )
          .sort((a, b) => a.x - b.x);
      return {
        summary: {
          gain: best.gain,
          threshold: best.threshold,
          axis: best.axis + 1,
          train: accuracy(data, (x) => +(predict(x) >= 0.5)),
        },
        series,
        visualization: classifierVisual(data, predict),
      };
    },
  ),
  mlbiasvariance: make(
    {
      id: 'mlbiasvariance',
      title: 'Bias–Variance Tradeoff and Overfitting',
      inputs: {
        degree: integer('Polynomial degree', 1, 10, 5),
        size: integer('Training observations', 15, 50, 25),
        trials: integer('Independent training sets', 10, 60, 30),
        noise: real('Observation noise σ', 0.05, 0.8, 0.3),
        seed,
      },
      metrics: {
        bias: ['Integrated squared bias', '1'],
        variance: ['Integrated prediction variance', '1'],
        noise: ['Irreducible noise variance', '1'],
        test: ['Expected test MSE decomposition', '1'],
      },
      plot: {
        x: 'x',
        y: 'Response',
        xUnit: '',
        yUnit: '',
        traces: {
          y: 'Mean fitted response',
          reference: 'True sin(πx)',
          other: 'One fitted realization',
        },
      },
      text: {
        description:
          'Fit independent noisy datasets and separate squared bias, prediction variance and irreducible noise.',
        predict: 'Can training error fall while test error rises?',
        answers: [
          'Yes, increased variance can dominate',
          'No',
          'Only with mislabeled observations',
        ],
        explain:
          'A more flexible model may track noise in each training set rather than the population signal.',
        example:
          'Low-degree polynomials underfit sin(πx); high degrees can fluctuate across noisy training sets.',
        equation: 'E[(Y−f̂(x))²]=(E f̂(x)−f(x))²+Var(f̂(x))+σ².',
        limits:
          'Independent Gaussian noise on a fixed evenly spaced design; Legendre basis and QR least squares. Bias/variance estimates use a finite ensemble and a 101-point grid, so they have Monte Carlo and quadrature error.',
      },
    },
    ({ degree, size, trials, noise, seed }) => {
      const rng = random(seed),
        x = linspace(-1, 1, size - 1),
        grid = linspace(-1, 1, 100),
        predictions = [];
      for (let n = 0; n < trials; n++) {
        const y = x.map((v) => Math.sin(Math.PI * v) + noise * normal(rng)),
          coef = polynomialFit(x, y, degree);
        predictions.push(grid.map((v) => dot(coef, legendre(v, degree))));
      }
      const m = grid.map((_v, i) => mean(predictions.map((a) => a[i]))),
        v = grid.map((_v, i) => variance(predictions.map((a) => a[i]))),
        bias = mean(grid.map((x, i) => (m[i] - Math.sin(Math.PI * x)) ** 2)),
        pv = mean(v);
      return {
        summary: { bias, variance: pv, noise: noise ** 2, test: bias + pv + noise ** 2 },
        series: grid.map((x, i) => ({
          x,
          y: m[i],
          reference: Math.sin(Math.PI * x),
          other: predictions[0][i],
        })),
        table: table(
          'Pointwise decomposition',
          ['x', 'Squared bias', 'Prediction variance', 'Noise variance'],
          grid.map((x, i) => [x, (m[i] - Math.sin(Math.PI * x)) ** 2, v[i], noise ** 2]),
        ),
      };
    },
  ),
  mlperceptron: make(
    {
      id: 'mlperceptron',
      title: 'Perceptron and the XOR Limitation',
      inputs: {
        shape: choice(
          'Dataset',
          { linear: 'Linearly separable corners', xor: 'XOR corners' },
          'xor',
        ),
        epochs: integer('Epochs', 1, 100, 30),
        rate: real('Update rate', 0.01, 1, 0.2),
      },
      metrics: {
        accuracy: ['Training accuracy', '1'],
        updates: ['Mistake-triggered updates', '1'],
        errors: ['Final misclassified points', '1'],
      },
      plot: { x: 'Epoch', y: 'Misclassified points', xUnit: '', yUnit: '' },
      text: {
        description:
          'Train a single linear threshold unit on four corners and test the geometric limitation of XOR.',
        predict: 'Can a single perceptron classify XOR perfectly?',
        answers: [
          'No, XOR is not linearly separable',
          'Yes, after enough epochs',
          'Only with a higher learning rate',
        ],
        explain: 'No line separates opposite corners of a square into the two XOR classes.',
        example:
          'The XOR labels alternate around the corners; adding a nonlinear hidden layer changes the representational capacity.',
        equation: 'On a mistake: w←w+ηyx, b←b+ηy, with labels y∈{−1,+1}.',
        limits:
          'Deterministic ordered online updates on four exact points. A finite epoch budget does not prove general nonseparability, but the XOR geometry does. No feature expansion is used.',
      },
    },
    ({ shape, epochs, rate }) => {
      const data = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map((x) => ({ x, label: shape === 'xor' ? +(x[0] * x[1] > 0) : +(x[0] > 0) })),
        w = [0, 0, 0],
        pred = (x) => +(dot(w, [...x, 1]) >= 0),
        series = [];
      let updates = 0;
      for (let k = 0; k <= epochs; k++) {
        series.push({ x: k, y: data.filter((p) => pred(p.x) !== p.label).length });
        if (k < epochs)
          for (const p of data)
            if (pred(p.x) !== p.label) {
              const y = 2 * p.label - 1;
              for (let j = 0; j < 3; j++) w[j] += rate * y * [...p.x, 1][j];
              updates++;
            }
      }
      return {
        summary: { accuracy: accuracy(data, pred), updates, errors: series.at(-1).y },
        series,
        visualization: classifierVisual(data, pred),
        warnings:
          shape === 'xor'
            ? [
                'XOR has no exact separator in this linear model; continued updates cannot solve it.',
              ]
            : [],
      };
    },
  ),
  mlbackprop: make(
    {
      id: 'mlbackprop',
      title: 'Neural Network Backpropagation Playground',
      inputs: {
        hidden: integer('Hidden tanh units', 2, 6, 4),
        rate: real('Learning rate', 0.05, 2, 0.8),
        steps: integer('Full-batch updates', 100, 3000, 1200),
        seed,
      },
      metrics: {
        loss: ['Binary cross entropy', '1'],
        accuracy: ['XOR training accuracy', '1'],
        gradient: ['Backprop vs finite-difference gradient error', '1'],
        parameters: ['Trainable parameters', '1'],
      },
      plot: { x: 'Update', y: 'Binary cross entropy', xUnit: '', yUnit: '' },
      text: {
        description:
          'Train a two-layer tanh network on XOR with explicit chain-rule gradients and a numerical gradient check.',
        predict: 'Why does the hidden layer use a nonlinear activation?',
        answers: [
          'Without it, stacked layers collapse to one linear map',
          'To guarantee perfect training',
          'To remove the need for gradients',
        ],
        explain:
          'Nonlinear hidden features allow a curved or piecewise decision region that a single linear unit lacks.',
        example: 'A 2→4→1 network has 17 trainable weights and biases.',
        equation: 'h=tanh(W₁x+b₁), p=sigmoid(w₂ᵀh+b₂); ∂L/∂z=p−y.',
        limits:
          'Four exact XOR samples, full-batch gradient descent, no test-set generalization claim. A single-coordinate central finite-difference check is reported at initialization. Local minima and seed sensitivity remain possible.',
      },
    },
    ({ hidden, rate, steps, seed }) => {
      const data = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map((x) => ({ x, label: +(x[0] * x[1] > 0) })),
        rng = random(seed),
        w = Array.from({ length: 4 * hidden + 1 }, () => 0.7 * normal(rng)),
        g = neuralLossGradient(w, data),
        eps = 1e-5,
        plus = [...w],
        minus = [...w];
      plus[0] += eps;
      minus[0] -= eps;
      const check = Math.abs(
          g.gradient[0] -
            (neuralLossGradient(plus, data).loss - neuralLossGradient(minus, data).loss) /
              (2 * eps),
        ),
        series = [];
      for (let k = 0; k <= steps; k++) {
        const a = neuralLossGradient(w, data);
        if (k % 10 === 0 || k === steps) series.push({ x: k, y: a.loss });
        if (k < steps) for (let j = 0; j < w.length; j++) w[j] -= rate * a.gradient[j];
      }
      return {
        summary: {
          loss: neuralLossGradient(w, data).loss,
          accuracy: accuracy(data, (x) => +(neuralPredict(w, x) >= 0.5)),
          gradient: check,
          parameters: w.length,
        },
        series,
        visualization: classifierVisual(data, (x) => neuralPredict(w, x)),
        table: table(
          'XOR predictions',
          ['x₁', 'x₂', 'Target', 'Predicted probability'],
          data.map((p) => [...p.x, p.label, neuralPredict(w, p.x)]),
        ),
      };
    },
  ),
  mlroc: make(
    {
      id: 'mlroc',
      title: 'Confusion Matrix, ROC and Precision–Recall',
      inputs: {
        separation: real('Class score separation', 0, 4, 1.5),
        threshold: real('Decision threshold', -3, 5, 0.75),
        prevalence: real('Positive-class fraction', 0.1, 0.9, 0.3),
        seed,
      },
      metrics: {
        precision: ['Precision (undefined without predicted positives)', '1'],
        recall: ['Recall', '1'],
        fpr: ['False-positive rate', '1'],
        auc: ['Empirical ROC AUC', '1'],
      },
      plot: {
        x: 'False-positive rate / recall',
        y: 'True-positive rate / precision',
        xUnit: '',
        yUnit: '',
        traces: { y: 'ROC true-positive rate', sample: 'Precision–recall precision' },
      },
      text: {
        description:
          'Threshold seeded class scores, inspect all four confusion counts, and compare ROC with prevalence-sensitive precision–recall.',
        predict: 'Does ROC AUC measure performance at only the selected threshold?',
        answers: ['No, it summarizes all score thresholds', 'Yes', 'Only for balanced classes'],
        explain:
          'AUC integrates the ranking curve over thresholds; a chosen operating point still needs its own confusion matrix.',
        example:
          'Identically distributed class scores have expected AUC 0.5, with finite-sample fluctuations.',
        equation: 'TPR=TP/(TP+FN); FPR=FP/(FP+TN); precision=TP/(TP+FP).',
        limits:
          '200 synthetic scores with fixed class counts. AUC uses pairwise rankings with half-credit for ties. The main plot combines ROC and PR coordinates; each curve has its own horizontal meaning, stated in the legend. Undefined precision is null rather than silently zero.',
      },
    },
    ({ separation, threshold, prevalence, seed }) => {
      const rng = random(seed),
        positive = Math.round(200 * prevalence),
        scores = Array.from({ length: 200 }, (_, i) => ({
          label: +(i < positive),
          score: normal(rng) + (i < positive ? separation : 0),
        })),
        counts = (t) => {
          let tp = 0,
            fp = 0;
          for (const p of scores) if (p.score >= t) p.label ? tp++ : fp++;
          return { tp, fp, fn: positive - tp, tn: 200 - positive - fp };
        },
        c = counts(threshold),
        thresholds = [Infinity, ...[...new Set(scores.map((p) => p.score))].sort((a, b) => b - a)],
        roc = thresholds.map((t) => {
          const c = counts(t);
          return { x: c.fp / (200 - positive), y: c.tp / positive };
        }),
        pr = thresholds.map((t) => {
          const c = counts(t);
          return { x: c.tp / positive, y: null, sample: c.tp + c.fp ? c.tp / (c.tp + c.fp) : null };
        });
      let wins = 0;
      for (const a of scores.filter((p) => p.label))
        for (const b of scores.filter((p) => !p.label))
          wins += a.score > b.score ? 1 : a.score === b.score ? 0.5 : 0;
      return {
        summary: {
          precision: c.tp + c.fp ? c.tp / (c.tp + c.fp) : null,
          recall: c.tp / positive,
          fpr: c.fp / (200 - positive),
          auc: wins / (positive * (200 - positive)),
        },
        series: [...roc, ...pr],
        visualization: {
          type: 'math-space',
          kind: 'matrices',
          matrices: [
            {
              label: 'Rows: actual +/−; columns: predicted +/−',
              matrix: [
                [c.tp, c.fn],
                [c.fp, c.tn],
              ],
            },
          ],
        },
        table: table('Confusion counts', ['TP', 'FP', 'FN', 'TN'], [[c.tp, c.fp, c.fn, c.tn]]),
      };
    },
  ),
  mlgmm: make(
    {
      id: 'mlgmm',
      title: 'Gaussian Mixture Model: Expectation–Maximization',
      inputs: {
        separation: real('Component mean separation', 0.5, 5, 3),
        iterations: integer('EM iterations', 1, 100, 35),
        seed,
      },
      metrics: {
        mean1: ['First fitted mean', '1'],
        mean2: ['Second fitted mean', '1'],
        weight: ['First mixture weight', '1'],
        likelihood: ['Final log likelihood', '1'],
      },
      plot: { x: 'EM iteration', y: 'Log likelihood', xUnit: '', yUnit: '' },
      text: {
        description:
          'Alternate soft responsibilities and weighted Gaussian updates and monitor the observed-data likelihood.',
        predict: 'Does EM guarantee the globally best mixture fit?',
        answers: ['No, it can reach a local optimum', 'Yes', 'Only with equal weights'],
        explain:
          'EM improves its likelihood objective but initialization can select different local optima.',
        example:
          'Separated normal components produce responsibility values near zero or one; overlapping components remain uncertain.',
        equation: 'rᵢⱼ=πⱼN(xᵢ|μⱼ,σⱼ²)/ΣπN; μⱼ=Σrᵢⱼxᵢ/Σrᵢⱼ.',
        limits:
          'One-dimensional two-component synthetic mixture, 120 points, deterministic initialization and variance floor 0.0025. The floor constrains the likelihood to prevent singular component collapse; no global-optimum claim is made.',
      },
    },
    ({ separation, iterations, seed }) => {
      const rng = random(seed),
        values = Array.from(
          { length: 120 },
          (_, i) => (i % 3 ? separation / 2 : -separation / 2) + 0.7 * normal(rng),
        ),
        m = mixtureEM(values, iterations),
        density = (x, j) =>
          (m.weights[j] / Math.sqrt(m.variance[j])) *
          normalDensity((x - m.mu[j]) / Math.sqrt(m.variance[j]));
      return {
        summary: {
          mean1: m.mu[0],
          mean2: m.mu[1],
          weight: m.weights[0],
          likelihood: m.history.at(-1).y,
        },
        series: m.history,
        visualization: {
          type: 'math-space',
          kind: 'mixture',
          values,
          frames: m.frames,
          caption: 'Scrub EM iterations to inspect the two component densities',
        },
        table: table(
          'Fitted density samples',
          ['x', 'Component 1 density', 'Component 2 density'],
          linspace(-5, 5, 80).map((x) => [x, density(x, 0), density(x, 1)]),
        ),
      };
    },
  ),
  mlconvolution: make(
    {
      id: 'mlconvolution',
      title: 'Convolution Filters and Feature Maps',
      inputs: {
        image: choice(
          'Input pattern',
          { edge: 'Vertical edge', cross: 'Cross', checker: 'Checkerboard' },
          'edge',
        ),
        kernel: choice(
          '3×3 filter',
          { blur: 'Box blur', sobel: 'Sobel horizontal derivative', sharpen: 'Sharpen' },
          'sobel',
        ),
        padding: choice(
          'Padding',
          { valid: 'Valid (no padding)', same: 'One-cell zero padding' },
          'valid',
        ),
        stride: integer('Stride', 1, 2, 1),
      },
      metrics: {
        width: ['Output width', 'pixels'],
        height: ['Output height', 'pixels'],
        minimum: ['Minimum feature response', '1'],
        maximum: ['Maximum feature response', '1'],
      },
      plot: { x: 'Flattened output pixel', y: 'Filter response', xUnit: '', yUnit: '' },
      text: {
        description:
          'Slide a real 3×3 stencil across an 8×8 image, vary padding and stride, and inspect the resulting feature map.',
        predict: 'Does a signed edge filter have to produce values between zero and one?',
        answers: ['No, negative and larger responses are valid', 'Yes', 'Only after padding'],
        explain:
          'A filter is a weighted sum, and signed derivative weights can produce negative responses.',
        example: 'A 3×3 valid filter on an 8×8 image with stride one produces a 6×6 feature map.',
        equation: 'Y[j,i]=ΣᵤᵥK[u,v] X[js+u−p,is+v−p].',
        limits:
          'This uses cross-correlation, the convention commonly called convolution in CNNs; the kernel is not flipped. Single channel, fixed filters, optional zero padding, no learned weights or nonlinear activation.',
      },
    },
    ({ image, kernel, padding, stride }) => {
      const X = Array.from({ length: 8 }, (_, j) =>
          Array.from({ length: 8 }, (_, i) =>
            image === 'edge' ? +(i >= 4) : image === 'cross' ? +(i === 3 || j === 3) : (i + j) % 2,
          ),
        ),
        K =
          kernel === 'blur'
            ? Array.from({ length: 3 }, () => Array(3).fill(1 / 9))
            : kernel === 'sobel'
              ? [
                  [-1, 0, 1],
                  [-2, 0, 2],
                  [-1, 0, 1],
                ]
              : [
                  [0, -1, 0],
                  [-1, 5, -1],
                  [0, -1, 0],
                ],
        Y = convolution(X, K, stride, padding);
      return {
        summary: {
          width: Y[0].length,
          height: Y.length,
          minimum: Math.min(...Y.flat()),
          maximum: Math.max(...Y.flat()),
        },
        series: Y.flat().map((y, x) => ({ x, y })),
        visualization: {
          type: 'math-space',
          kind: 'image-filter',
          input: X,
          kernel: K,
          grid: Y,
          caption: 'Input image → fixed 3×3 cross-correlation → output feature map',
        },
        table: table('Filter weights', ['Column 1', 'Column 2', 'Column 3'], K),
      };
    },
  ),
};
export function legendre(x, n) {
  const a = [1];
  if (n) a.push(x);
  for (let j = 2; j <= n; j++) a.push(((2 * j - 1) * x * a[j - 1] - (j - 1) * a[j - 2]) / j);
  return a;
}
/** Modified Gram–Schmidt QR on a bounded Legendre design; avoids normal equations. */
export function polynomialFit(x, y, degree) {
  const columns = Array.from({ length: degree + 1 }, (_, j) =>
      x.map((v) => legendre(v, degree)[j]),
    ),
    Q = [],
    R = Array.from({ length: degree + 1 }, () => Array(degree + 1).fill(0));
  for (let j = 0; j <= degree; j++) {
    let v = [...columns[j]];
    for (let k = 0; k < j; k++) {
      R[k][j] = dot(Q[k], v);
      v = v.map((a, i) => a - R[k][j] * Q[k][i]);
    }
    R[j][j] = norm(v);
    if (R[j][j] < 1e-12) throw new Error('Polynomial design is numerically rank deficient.');
    Q.push(v.map((a) => a / R[j][j]));
  }
  const b = Q.map((q) => dot(q, y)),
    a = Array(degree + 1).fill(0);
  for (let j = degree; j >= 0; j--)
    a[j] = (b[j] - dot(R[j].slice(j + 1), a.slice(j + 1))) / R[j][j];
  return a;
}

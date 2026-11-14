import {
  mathLab,
  p,
  integer,
  choice,
  textInput,
  numbers,
  errorFor,
  random,
  normal,
  mean,
  variance,
  sum,
  samples,
  histogram,
  normalCDF,
  normalQuantile,
  normalDensity,
  table,
  vectors,
} from './math-core.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial),
  seed = integer('Random seed', 1, 999999, 42);
/** @template {import('./schema.js').Fields} F
 * @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(input:import('./schema.js').InputValues<F>)=>R} solve
 */
const make = (config, solve) => mathLab({ topic: 'Probability & Statistics', ...config }, solve);
const distribution = choice(
  'Source distribution',
  { uniform: 'Uniform [0,1]', exponential: 'Exponential (rate 1)', bernoulli: 'Bernoulli (p=0.3)' },
  'uniform',
);
const source = (kind, rng) =>
  kind === 'exponential' ? -Math.log(rng()) : kind === 'bernoulli' ? +(rng() < 0.3) : rng();
const moments = (kind) =>
  kind === 'exponential' ? [1, 1] : kind === 'bernoulli' ? [0.3, 0.21] : [0.5, 1 / 12];
const dataField = textInput(
  'Sample values',
  '2,3,4,5,6,7,8,9',
  1500,
  'Comma-separated finite observations, 2–100 entries.',
);
const dataCheck = errorFor('data', (v) => numbers(v.data, 2, 100));
export const quantile = (a, p) => {
  const b = [...a].sort((x, y) => x - y),
    i = (b.length - 1) * p,
    j = Math.floor(i);
  return b[j] + (b[Math.min(j + 1, b.length - 1)] - b[j]) * (i - j);
};
export function regress(points) {
  const mx = mean(points.map((p) => p[0])),
    my = mean(points.map((p) => p[1])),
    xx = sum(points.map(([x]) => (x - mx) ** 2));
  if (xx < 1e-14) throw new Error('Predictor values must have nonzero spread.');
  const slope = sum(points.map(([x, y]) => (x - mx) * (y - my))) / xx,
    intercept = my - slope * mx,
    residuals = points.map(([x, y]) => y - intercept - slope * x),
    sse = sum(residuals.map((r) => r * r)),
    total = sum(points.map(([, y]) => (y - my) ** 2));
  return { slope, intercept, residuals, sse, r2: total ? 1 - sse / total : null };
}
export const statisticsMathModels = {
  mathclt: make(
    {
      id: 'mathclt',
      title: 'Central Limit Theorem Sampler',
      inputs: {
        distribution,
        size: integer('Observations per mean', 1, 100, 20),
        trials: integer('Sample means', 100, 3000, 1000),
        seed,
      },
      metrics: {
        mean: ['Mean of standardized means', '1'],
        variance: ['Variance of standardized means', '1'],
        skew: ['Observed third standardized moment', '1'],
      },
      plot: {
        x: 'Standardized sample mean',
        y: 'Density',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Empirical histogram', reference: 'Standard normal density' },
      },
      text: {
        description:
          'Sample independent means from skewed, bounded or discrete populations and compare their standardized histogram with a normal curve.',
        predict: 'What is the theoretical variance of a standardized sample mean?',
        answers: ['One', '1/n', 'n'],
        explain:
          'Dividing by σ/√n gives unit variance, even before the shape becomes approximately normal.',
        example:
          'Uniform [0,1] has mean 0.5 and variance 1/12; the standard error of its n-sample mean is √(1/(12n)).',
        equation: 'Z=(X̄−μ)/(σ/√n) → N(0,1) in distribution.',
        limits:
          'Independent identically distributed samples from three finite-variance families. Histogram density is approximate; the CLT does not make small-n discrete data exactly normal.',
      },
    },
    ({ distribution: kind, size, trials, seed }) => {
      const rng = random(seed),
        [mu, v] = moments(kind),
        z = Array.from({ length: trials }, () => {
          let total = 0;
          for (let j = 0; j < size; j++) total += source(kind, rng);
          return (total / size - mu) / Math.sqrt(v / size);
        }),
        hist = histogram(z, 32),
        width = hist[1].x - hist[0].x;
      return {
        summary: { mean: mean(z), variance: variance(z), skew: mean(z.map((v) => v ** 3)) },
        series: hist.map((r) => ({
          x: r.x,
          y: r.y / (trials * width),
          reference: normalDensity(r.x),
        })),
      };
    },
  ),
  mathlln: make(
    {
      id: 'mathlln',
      title: 'Law of Large Numbers',
      inputs: { distribution, count: integer('Observations', 20, 3000, 500), seed },
      metrics: {
        estimate: ['Final running mean', '1'],
        truth: ['Population mean', '1'],
        error: ['Final absolute error', '1'],
      },
      plot: {
        x: 'Observations',
        y: 'Running mean',
        xUnit: '',
        yUnit: '',
        traces: {
          y: 'Running sample mean',
          reference: 'Population mean',
          other: 'Independent realization',
        },
      },
      text: {
        description:
          'Compare two seeded sequences of running means and see convergence without assuming each step improves.',
        predict: 'Must the absolute error decrease after every observation?',
        answers: ['No', 'Yes', 'Only for bounded variables'],
        explain: 'Almost-sure convergence permits fluctuations and temporary increases in error.',
        example:
          'Bernoulli(0.3) sample proportions converge toward 0.3 as observations accumulate.',
        equation: 'X̄ₙ=(1/n)ΣXᵢ → μ almost surely for these iid families.',
        limits:
          'Finite displayed paths illustrate a theorem rather than proving it. The two sequences are independently seeded pseudorandom realizations.',
      },
    },
    ({ distribution: kind, count, seed }) => {
      const a = random(seed),
        b = random(seed + 100003),
        mu = moments(kind)[0],
        series = [];
      let sa = 0,
        sb = 0;
      for (let i = 1; i <= count; i++) {
        sa += source(kind, a);
        sb += source(kind, b);
        series.push({ x: i, y: sa / i, reference: mu, other: sb / i });
      }
      return {
        summary: { estimate: sa / count, truth: mu, error: Math.abs(sa / count - mu) },
        series,
      };
    },
  ),
  mathbayes: make(
    {
      id: 'mathbayes',
      title: 'Bayes’ Theorem and Diagnostic Tests',
      inputs: {
        prevalence: real('Prevalence', 0.001, 0.99, 0.01),
        sensitivity: real('Sensitivity', 0.01, 0.999, 0.95),
        specificity: real('Specificity', 0.01, 0.999, 0.95),
        cohort: integer('Illustrative cohort size', 100, 100000, 10000),
      },
      metrics: {
        ppv: ['P(condition | positive)', '1'],
        npv: ['P(no condition | negative)', '1'],
        positive: ['P(positive test)', '1'],
        falsepositive: ['Expected false positives', 'people'],
      },
      plot: { x: 'Prevalence', y: 'Positive predictive value', xUnit: '', yUnit: '' },
      text: {
        description:
          'Separate sensitivity from posterior probability and inspect expected diagnostic counts under changing base rates.',
        predict: 'Can a sensitive test have a low positive predictive value for a rare condition?',
        answers: ['Yes', 'No', 'Only with zero specificity'],
        explain:
          'False positives from the large unaffected population can outnumber true positives.',
        example: 'Prevalence 1%, sensitivity=specificity=95% gives PPV≈16.1%.',
        equation: 'PPV=se·p/[se·p+(1−sp)(1−p)]; NPV=sp(1−p)/[sp(1−p)+(1−se)p].',
        limits:
          'A mathematical diagnostic example, not clinical advice. Counts are expected values and need not be integers; sensitivity and specificity are assumed constant across populations.',
      },
    },
    ({ prevalence: q, sensitivity: a, specificity: b, cohort: N }) => {
      const ppv = (x) => (a * x) / (a * x + (1 - b) * (1 - x));
      return {
        summary: {
          ppv: ppv(q),
          npv: (b * (1 - q)) / (b * (1 - q) + (1 - a) * q),
          positive: a * q + (1 - b) * (1 - q),
          falsepositive: N * (1 - b) * (1 - q),
        },
        series: samples(0.001, 0.99, (x) => ({ y: ppv(x) })),
        table: table(
          'Expected diagnostic counts',
          ['Actual status', 'Test positive', 'Test negative'],
          [
            ['Condition', N * q * a, N * q * (1 - a)],
            ['No condition', N * (1 - q) * (1 - b), N * (1 - q) * b],
          ],
        ),
      };
    },
  ),
  mathdistributions: make(
    {
      id: 'mathdistributions',
      title: 'Binomial, Poisson and Normal Approximations',
      inputs: {
        n: integer('Binomial trials n', 2, 100, 30),
        probability: real('Success probability p', 0.01, 0.99, 0.1),
      },
      metrics: {
        mean: ['Binomial mean np', '1'],
        variance: ['Binomial variance np(1−p)', '1'],
        poisson: ['Poisson total variation distance', '1'],
        normal: ['Normal total variation distance', '1'],
      },
      plot: {
        x: 'Count k',
        y: 'Probability mass',
        xUnit: '',
        yUnit: '',
        traces: {
          y: 'Exact binomial',
          reference: 'Poisson approximation',
          other: 'Continuity-corrected normal',
        },
      },
      text: {
        description:
          'Compare exact binomial mass with rare-event and normal approximations, including probability outside the binomial support.',
        predict: 'When is the Poisson approximation usually most suitable?',
        answers: ['Large n and small p at fixed np', 'p near one', 'Only when variance is zero'],
        explain:
          'The binomial rare-event limit keeps λ=np finite while individual successes become unlikely.',
        example: 'n=30,p=0.1 gives mean 3 and variance 2.7.',
        equation:
          'Bin(n,p): C(n,k)pᵏ(1−p)ⁿ⁻ᵏ; Pois(np): e⁻ⁿᵖ(np)ᵏ/k!; normal bins use Φ((k+0.5−μ)/σ)−Φ((k−0.5−μ)/σ).',
        limits:
          'Normal probabilities use a CDF approximation accurate to about 10⁻⁷. Total variation includes all omitted tail mass beyond [0,n]; normal mass below zero is not renormalized away.',
      },
    },
    ({ n, probability: p }) => {
      const mu = n * p,
        s = Math.sqrt(n * p * (1 - p)),
        series = [];
      let bin = (1 - p) ** n,
        pois = Math.exp(-mu),
        dp = 0,
        dn = 0,
        sp = 0,
        sn = 0;
      for (let k = 0; k <= n; k++) {
        if (k) {
          bin *= (((n - k + 1) / k) * p) / (1 - p);
          pois *= mu / k;
        }
        const approx = normalCDF((k + 0.5 - mu) / s) - normalCDF((k - 0.5 - mu) / s);
        series.push({ x: k, y: bin, reference: pois, other: approx });
        dp += Math.abs(bin - pois);
        dn += Math.abs(bin - approx);
        sp += pois;
        sn += approx;
      }
      return {
        summary: {
          mean: mu,
          variance: s * s,
          poisson: 0.5 * (dp + Math.max(0, 1 - sp)),
          normal: 0.5 * (dn + Math.max(0, 1 - sn)),
        },
        series,
      };
    },
  ),
  mathconfidence: make(
    {
      id: 'mathconfidence',
      title: 'Confidence Intervals and Coverage',
      inputs: {
        mu: real('Population mean', -3, 3, 0),
        sigma: real('Known population σ', 0.1, 3, 1),
        size: integer('Sample size n', 2, 100, 20),
        confidence: real('Confidence level', 0.5, 0.99, 0.95),
        trials: integer('Repeated experiments', 20, 500, 100),
        seed,
      },
      metrics: {
        coverage: ['Observed coverage fraction', '1'],
        nominal: ['Nominal coverage', '1'],
        width: ['Interval width', '1'],
      },
      plot: {
        x: 'Repeated experiment',
        y: 'Mean / interval endpoints',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Sample mean', reference: 'Lower endpoint', other: 'Upper endpoint' },
      },
      text: {
        description:
          'Repeat known-variance normal experiments and count how often their confidence intervals cover the fixed population mean.',
        predict: 'What does 95% confidence describe?',
        answers: [
          'Long-run coverage of the interval procedure',
          'A 95% probability the fixed mean changes',
          '95% of all observations inside the interval',
        ],
        explain:
          'The population parameter is fixed; repeated random intervals cover it at the nominal rate under the model.',
        example: 'Known σ=1,n=25 gives a 95% half-width of about 0.392.',
        equation: 'Known-variance normal mean interval: X̄±z₁₋α/₂σ/√n; width=2z₁₋α/₂σ/√n.',
        limits:
          'Independent normal observations and known σ. This is a z interval, not a Student t interval; finite observed coverage fluctuates around its target.',
      },
    },
    ({ mu, sigma, size, confidence, trials, seed }) => {
      const rng = random(seed),
        half = (normalQuantile((1 + confidence) / 2) * sigma) / Math.sqrt(size),
        series = [];
      let covered = 0;
      for (let i = 0; i < trials; i++) {
        let s = 0;
        for (let j = 0; j < size; j++) s += mu + sigma * normal(rng);
        const m = s / size;
        covered += +(Math.abs(m - mu) <= half);
        series.push({ x: i + 1, y: m, reference: m - half, other: m + half });
      }
      return {
        summary: { coverage: covered / trials, nominal: confidence, width: 2 * half },
        series,
        table: table(
          'Coverage outcomes',
          ['Experiment', 'Lower', 'Upper', 'Covers μ'],
          series.map((r) => [
            r.x,
            r.reference,
            r.other,
            r.reference <= mu && r.other >= mu ? 'Yes' : 'No',
          ]),
        ),
      };
    },
  ),
  mathpower: make(
    {
      id: 'mathpower',
      title: 'Hypothesis Test: Type I/II Error and Power',
      inputs: {
        effect: real('True mean shift Δ', -3, 3, 0.5),
        sigma: real('Known population σ', 0.1, 3, 1),
        size: integer('Sample size n', 2, 200, 25),
        alpha: real('Significance α', 0.001, 0.2, 0.05),
      },
      metrics: {
        typeone: ['Type I error α', '1'],
        typetwo: ['Type II error β at selected Δ', '1'],
        power: ['Power at selected Δ', '1'],
        critical: ['Critical |sample mean|', '1'],
      },
      plot: { x: 'True mean shift', y: 'Rejection probability', xUnit: '', yUnit: '' },
      text: {
        description:
          'Compute a two-sided z test’s power curve under a normal mean-shift alternative.',
        predict: 'At Δ=0, what is the rejection probability?',
        answers: ['α', '1−α', 'Zero'],
        explain: 'At the null, rejection occurs at the chosen Type I error rate.',
        example: 'For σ=1,n=25,α=0.05 the critical mean magnitude is about 0.392.',
        equation: 'Power(Δ)=Φ(−z−Δ√n/σ)+1−Φ(z−Δ√n/σ).',
        limits:
          'Known variance, independent normal observations, fixed two-sided test and null mean zero. Power is not the probability the null is false.',
      },
    },
    ({ effect, sigma, size, alpha }) => {
      const z = normalQuantile(1 - alpha / 2),
        power = (d) =>
          normalCDF(-z - (d * Math.sqrt(size)) / sigma) +
          1 -
          normalCDF(z - (d * Math.sqrt(size)) / sigma),
        v = power(effect);
      return {
        summary: {
          typeone: alpha,
          typetwo: 1 - v,
          power: v,
          critical: (z * sigma) / Math.sqrt(size),
        },
        series: samples(-3, 3, (x) => ({ y: power(x) })),
      };
    },
  ),
  mathregression: make(
    {
      id: 'mathregression',
      title: 'Simple Linear Regression, R² and Residuals',
      inputs: {
        data: textInput(
          'Observations [[x,y],…]',
          '[[0,1],[1,2.1],[2,2.9],[3,4.2],[4,4.8]]',
          4000,
          'JSON array containing 3–100 finite [x,y] pairs, magnitudes ≤10000.',
        ),
      },
      validateValues: errorFor('data', (v) => regressionData(v.data)),
      metrics: {
        slope: ['Slope', '1'],
        intercept: ['Intercept', '1'],
        r2: ['R²', '1'],
        rmse: ['Residual standard error', '1'],
      },
      plot: {
        x: 'Predictor x',
        y: 'Response / residual',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Fitted line', sample: 'Observed response', other: 'Residual' },
      },
      text: {
        description:
          'Edit your observations, fit ordinary least squares, and inspect residuals alongside the fitted trend.',
        predict: 'Does a high R² establish causation?',
        answers: ['No', 'Yes', 'Only with a positive slope'],
        explain:
          'R² measures explained sample variation under the fitted model, not causal identification.',
        example: 'Points (0,1),(1,3),(2,5) give slope 2, intercept 1 and R²=1.',
        equation: 'b₁=Σ(x−x̄)(y−ȳ)/Σ(x−x̄)²; b₀=ȳ−b₁x̄; R²=1−SSE/SST.',
        limits:
          'Unweighted linear regression with an intercept. Constant x is rejected; R² is undefined for constant y. Standard error assumes the linear residual model, and no causal claim is made.',
      },
    },
    ({ data }) => {
      const a = regressionData(data),
        r = regress(a),
        sorted = a
          .map((v, i) => ({
            ...r,
            x: v[0],
            y: r.intercept + r.slope * v[0],
            sample: v[1],
            other: r.residuals[i],
          }))
          .sort((a, b) => a.x - b.x);
      return {
        summary: {
          slope: r.slope,
          intercept: r.intercept,
          r2: r.r2,
          rmse: Math.sqrt(r.sse / (a.length - 2)),
        },
        series: sorted.map(({ x, y, sample, other }) => ({ x, y, sample, other })),
        visualization: vectors(a, {
          lines: [
            [
              [a[0][0], r.intercept + r.slope * a[0][0]],
              [a.at(-1)[0], r.intercept + r.slope * a.at(-1)[0]],
            ],
          ],
        }),
        table: table(
          'Residual diagnostics',
          ['x', 'Observed y', 'Fitted y', 'Residual'],
          a.map(([x, y], i) => [x, y, r.intercept + r.slope * x, r.residuals[i]]),
        ),
      };
    },
  ),
  mathmarkov: make(
    {
      id: 'mathmarkov',
      title: 'Markov Chain Stationary Distribution',
      inputs: {
        p: real('P(0 → 1)', 0, 1, 0.2),
        q: real('P(1 → 0)', 0, 1, 0.3),
        initial: real('Initial P(state 1)', 0, 1, 1),
        steps: integer('Transitions', 2, 100, 30),
      },
      metrics: {
        stationary: ['Stationary P(state 1), if unique', '1'],
        final: ['Final P(state 1)', '1'],
        rate: ['Other eigenvalue magnitude', '1'],
      },
      plot: {
        x: 'Transition',
        y: 'Probability of state 1',
        xUnit: '',
        yUnit: '',
        traces: { y: 'Evolving probability', reference: 'Unique stationary probability' },
      },
      text: {
        description:
          'Evolve a two-state transition matrix and distinguish stationarity from convergence.',
        predict:
          'Can a chain have a unique stationary distribution while iterates keep oscillating?',
        answers: ['Yes, a periodic chain can', 'No', 'Only with negative probabilities'],
        explain:
          'At p=q=1 the stationary distribution is (1/2,1/2), but a nonstationary initial state alternates forever.',
        example: 'p=0.2,q=0.3 gives stationary P(1)=0.4.',
        equation: 'π₁=p/(p+q); vₙ₊₁=p+(1−p−q)vₙ.',
        limits:
          'Exact distribution propagation, not sampled trajectories. At p=q=0 every distribution is stationary; the unique stationary value is reported as undefined.',
      },
    },
    ({ p, q, initial, steps }) => {
      const stationary = p + q ? p / (p + q) : null,
        series = [];
      let v = initial;
      for (let n = 0; n <= steps; n++) {
        series.push({ x: n, y: v, reference: stationary });
        v = p + (1 - p - q) * v;
      }
      return {
        summary: { stationary, final: series.at(-1).y, rate: Math.abs(1 - p - q) },
        series,
        visualization: {
          type: 'math-space',
          kind: 'matrices',
          matrices: [
            {
              label: 'Transition matrix (rows: current state)',
              matrix: [
                [1 - p, p],
                [q, 1 - q],
              ],
            },
          ],
        },
        warnings:
          p + q === 0
            ? ['Stationary distribution is not unique.']
            : p === 1 && q === 1
              ? [
                  'Periodic chain: stationarity does not guarantee convergence from every initial distribution.',
                ]
              : [],
      };
    },
  ),
  mathbrownian: make(
    {
      id: 'mathbrownian',
      title: 'Random Walk and Brownian Motion',
      inputs: {
        increments: choice(
          'Increment law',
          { walk: 'Symmetric ±√Δt', normal: 'Gaussian N(0,Δt)' },
          'walk',
        ),
        steps: integer('Steps on [0,1]', 20, 1000, 300),
        paths: integer('Ensemble paths', 20, 300, 100),
        seed,
      },
      metrics: {
        mean: ['Ensemble mean at t=1', '1'],
        variance: ['Ensemble variance at t=1', '1'],
        theory: ['Theoretical variance at t=1', '1'],
      },
      plot: {
        x: 'Time',
        y: 'Path / ensemble spread',
        xUnit: '',
        yUnit: '',
        traces: { y: 'One path', reference: 'Ensemble mean', other: 'Ensemble variance' },
      },
      text: {
        description:
          'Scale random-walk increments by √Δt and compare a path with ensemble mean and variance.',
        predict: 'What happens if step amplitudes scale with Δt instead of √Δt?',
        answers: [
          'The variance over fixed time tends to zero',
          'Variance remains t',
          'Variance becomes infinite',
        ],
        explain: 'With 1/Δt independent steps, total variance is step variance divided by Δt.',
        example: 'At t=1, both increment laws have theoretical mean zero and variance one.',
        equation: 'Wₙ₊₁=Wₙ+√Δt Zₙ; E[W(t)]=0, Var[W(t)]=t.',
        limits:
          'Discrete finite ensembles. Gaussian increments have exact Brownian grid distributions; the symmetric walk converges in distribution under refinement, not pathwise to an existing realization.',
      },
    },
    ({ increments, steps, paths, seed }) => {
      const rng = random(seed),
        state = Array(paths).fill(0),
        series = [{ x: 0, y: 0, reference: 0, other: 0 }],
        h = 1 / steps;
      for (let i = 1; i <= steps; i++) {
        for (let j = 0; j < paths; j++)
          state[j] += Math.sqrt(h) * (increments === 'walk' ? (rng() < 0.5 ? -1 : 1) : normal(rng));
        series.push({ x: i * h, y: state[0], reference: mean(state), other: variance(state) });
      }
      return { summary: { mean: mean(state), variance: variance(state), theory: 1 }, series };
    },
  ),
  mathbootstrap: make(
    {
      id: 'mathbootstrap',
      title: 'Bootstrap Resampling',
      inputs: {
        data: dataField,
        statistic: choice('Statistic', { mean: 'Mean', median: 'Median' }, 'mean'),
        resamples: integer('Bootstrap resamples', 100, 2000, 800),
        confidence: real('Percentile interval level', 0.5, 0.99, 0.95),
        seed,
      },
      validateValues: dataCheck,
      metrics: {
        estimate: ['Sample statistic', '1'],
        lower: ['Percentile lower bound', '1'],
        upper: ['Percentile upper bound', '1'],
        se: ['Bootstrap standard error', '1'],
      },
      plot: { x: 'Bootstrap statistic', y: 'Resample count', xUnit: '', yUnit: '' },
      text: {
        description:
          'Resample observations with replacement and build a percentile interval from the bootstrap distribution.',
        predict: 'Does each bootstrap sample contain every original observation exactly once?',
        answers: ['No, repeats and omissions are allowed', 'Yes', 'Only for the mean'],
        explain:
          'Sampling with replacement produces repeated indices and leaves some original values out.',
        example: 'For [1,2,3], a valid size-three resample is [2,2,1].',
        equation: 'X*ᵢ iid from the empirical distribution; CI=[Q*(α/2),Q*(1−α/2)].',
        limits:
          'Univariate iid empirical bootstrap, bounded to 100 observations. Percentile intervals can be biased or have poor coverage for small or nonrepresentative samples; this is not a guarantee of nominal coverage.',
      },
    },
    ({ data, statistic, resamples, confidence, seed }) => {
      const a = numbers(data, 2, 100),
        rng = random(seed),
        f = statistic === 'mean' ? mean : (x) => quantile(x, 0.5),
        b = Array.from({ length: resamples }, () =>
          f(Array.from({ length: a.length }, () => a[Math.floor(rng() * a.length)])),
        );
      return {
        summary: {
          estimate: f(a),
          lower: quantile(b, (1 - confidence) / 2),
          upper: quantile(b, (1 + confidence) / 2),
          se: Math.sqrt(variance(b, true)),
        },
        series: histogram(b, 30),
      };
    },
  ),
  mathmle: make(
    {
      id: 'mathmle',
      title: 'Maximum Likelihood Estimation',
      inputs: {
        data: dataField,
        family: choice(
          'Likelihood family',
          { exponential: 'Exponential rate', normal: 'Normal mean (variance also estimated)' },
          'exponential',
        ),
      },
      validateValues: errorFor('data', (v) => {
        const a = numbers(v.data, 2, 100);
        if (v.family === 'exponential' && a.some((x) => x <= 0))
          throw new Error('Exponential observations must be positive.');
        if (v.family === 'normal' && variance(a) < 1e-14)
          throw new Error('A finite normal variance MLE requires nonconstant observations.');
      }),
      metrics: {
        estimate: ['Rate λ or normal mean μ', '1'],
        variance: ['Fitted distribution variance', '1'],
        loglikelihood: ['Maximized log likelihood', '1'],
      },
      plot: { x: 'Candidate parameter', y: 'Log likelihood', xUnit: '', yUnit: '' },
      text: {
        description:
          'Fit a distribution to editable observations and examine the log-likelihood around its optimum.',
        predict: 'Does the normal variance MLE divide by n or n−1?',
        answers: ['n', 'n−1', 'Neither'],
        explain:
          'The likelihood optimum uses n; the n−1 denominator instead corrects sample-variance bias.',
        example: 'For positive observations with mean 5, the exponential rate MLE is 0.2.',
        equation: 'λ̂=n/Σxᵢ; μ̂=x̄; σ̂²=(1/n)Σ(xᵢ−x̄)².',
        limits:
          'An iid exponential or univariate normal model. The normal mean profile holds the variance fixed at its joint MLE; it is a likelihood slice, not a fully profiled variance at each mean.',
      },
    },
    ({ data, family }) => {
      const a = numbers(data, 2, 100),
        m = mean(a),
        v = variance(a),
        exp = family === 'exponential',
        estimate = exp ? 1 / m : m,
        log = (x) =>
          exp
            ? a.length * Math.log(x) - x * sum(a)
            : (-a.length / 2) * Math.log(2 * Math.PI * v) -
              sum(a.map((z) => (z - x) ** 2)) / (2 * v),
        span = exp ? estimate : Math.sqrt(v);
      return {
        summary: { estimate, variance: exp ? m * m : v, loglikelihood: log(estimate) },
        series: samples(
          exp ? estimate * 0.1 : estimate - 3 * span,
          exp ? estimate * 2.5 : estimate + 3 * span,
          (x) => ({ y: log(x) }),
        ),
      };
    },
  ),
  mathpoissonprocess: make(
    {
      id: 'mathpoissonprocess',
      title: 'Poisson Process and Inter-Arrival Times',
      inputs: {
        rate: real('Arrival rate λ', 0.2, 10, 3),
        horizon: real('Time horizon', 1, 30, 10),
        seed,
      },
      metrics: {
        count: ['Observed arrivals', '1'],
        expected: ['Expected arrivals λT', '1'],
        interarrival: ['Mean completed inter-arrival time', 's'],
        theory: ['Theoretical inter-arrival mean', 's'],
      },
      plot: {
        x: 'Time',
        y: 'Cumulative arrivals',
        xUnit: 's',
        yUnit: '',
        traces: { y: 'Observed count', reference: 'Expected count' },
        step: true,
      },
      text: {
        description:
          'Generate exponential waiting times, build a counting path, and inspect the completed gaps.',
        predict: 'What distribution describes the waiting time until the next arrival?',
        answers: ['Exponential with mean 1/λ', 'Normal with mean λ', 'Uniform on the horizon'],
        explain: 'A homogeneous Poisson process has independent exponential inter-arrival times.',
        example: 'At λ=3 and T=10, E[N(T)]=30 and the mean waiting time is 1/3 s.',
        equation: 'ΔT=−ln(U)/λ; N(t)=number of arrival times ≤t.',
        limits:
          'Homogeneous rate and independent waits. The final censored wait is excluded from the reported completed-gap average, which can be biased on a finite horizon; no arrivals gives an undefined empirical mean. Generation is capped at 5000 arrivals.',
      },
    },
    ({ rate, horizon, seed }) => {
      const rng = random(seed),
        gaps = [],
        times = [],
        series = [{ x: 0, y: 0, reference: 0 }];
      let t = 0;
      while (times.length < 5000) {
        const gap = -Math.log(rng()) / rate;
        t += gap;
        if (t > horizon) break;
        gaps.push(gap);
        times.push(t);
        series.push({ x: t, y: times.length, reference: rate * t });
      }
      series.push({ x: horizon, y: times.length, reference: rate * horizon });
      return {
        summary: {
          count: times.length,
          expected: rate * horizon,
          interarrival: gaps.length ? mean(gaps) : null,
          theory: 1 / rate,
        },
        series,
        table: table(
          'Completed arrivals',
          ['Arrival', 'Time', 'Gap'],
          times.map((v, i) => [i + 1, v, gaps[i]]),
        ),
        warnings:
          times.length === 5000 ? ['Event cap reached; this realization is truncated.'] : [],
      };
    },
  ),
};
function regressionData(source) {
  const a = JSON.parse(source);
  if (
    !Array.isArray(a) ||
    a.length < 3 ||
    a.length > 100 ||
    a.some(
      (r) =>
        !Array.isArray(r) ||
        r.length !== 2 ||
        r.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000),
    )
  )
    throw new Error('Use 3–100 numeric [x,y] observations, magnitude ≤10000.');
  regress(a);
  return a;
}

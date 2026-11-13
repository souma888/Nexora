/** Teaching copy, separate from numerical methods and input/layout metadata.
 * @type {Record<string, import('../schema.js').LabConfig<import('../schema.js').Fields>['text']>} */
export const content = {
  mm1queue: [
    'Connect utilization to the stationary queue-length distribution and mean waiting time.',
    'As λ approaches μ from below, what happens to mean waiting time?',
    ['It grows without bound', 'It approaches zero', 'It stays fixed'],
    'The mean delay contains the shrinking denominator μ−λ.',
    'For λ=4/h and μ=6/h, utilization is 2/3, L=2, W=30 min and Wq=20 min. P(N=0)=1/3.',
    'ρ=λ/μ<1; P(N=n)=(1−ρ)ρⁿ. L=ρ/(1−ρ), W=1/(μ−λ), Wq=ρ/(μ−λ), L=λW.',
    'Stationary single FIFO server, independent Poisson arrivals, independent ' +
      'exponential service times, infinite waiting space and no abandonment. The graph ' +
      'joins integer probabilities for readability and truncates at n=50; its omitted ' +
      'tail is reported in the table. This is an analytical distribution, not a ' +
      'finite-run queue simulation.',
  ],
  eoq: [
    'Balance order frequency against average inventory and inspect the implied replenishment cycle.',
    'At the continuous optimum, how do ordering and holding costs compare?',
    ['They are equal', 'Ordering is always twice holding', 'Holding is zero'],
    'Setting d(DS/Q+HQ/2)/dQ=0 gives DS/Q=HQ/2.',
    'D=1000/year, S=50/order and H=2/(unit·year) give EOQ=√50000≈223.607 units. At ' +
      'Q=200, relevant annual cost is 250+200=450 and the cycle is 73 days.',
    'Q*=√(2DS/H); C(Q)=DS/Q+HQ/2; cycle=365Q/D. Average stock is Q/2 with instantaneous replenishment.',
    'Deterministic constant demand, zero lead time, no stockouts or safety stock, ' +
      'constant unit purchase cost and unconstrained continuous order sizes. Purchase ' +
      'cost is excluded because it is constant across Q. The currency unit is ' +
      'deliberately generic; this is a teaching cost model, not a purchasing ' +
      'recommendation.',
  ],
  criticalpath: [
    'Calculate earliest/latest starts and distinguish a critical path from simply long tasks.',
    'Does shortening a positive-slack task necessarily shorten the project?',
    ['No', 'Yes', 'Only if its duration is an integer'],
    'A noncritical task can use its slack without changing the project’s completion time.',
    'With durations [3,2,4,5,2,3], the project finishes in 11 days. A→D→F is ' +
      'critical; B, C and E each have one day of slack.',
    'ES=max predecessor EF, EF=ES+d. In the backward pass LF=min successor LS, ' +
      'LS=LF−d. Total slack=LS−ES. All terminal tasks must finish by the project ' +
      'deadline.',
    'Editable finish-to-start DAG with 2–12 tasks labelled A through L and up to 40 ' +
      'dependencies. Enter A>C to make C depend on A, or none for independent tasks. ' +
      'Cycles, unknown tasks, duplicates and self-edges are rejected. Unlimited ' +
      'resources, deterministic whole-day durations, no calendars or resource leveling. ' +
      'Active intervals are [ES,EF). Multiple critical branches are supported.',
  ],
  weibull: [
    'Compare decreasing, constant and increasing hazard regimes without confusing ' +
      'hazard with probability.',
    'When β=1, is the hazard constant?',
    ['Yes', 'No, it rises linearly', 'No, it decays to zero'],
    'The Weibull then reduces to an exponential survival model with hazard 1/η.',
    'At η=1000 h, β=2 and t=1000 h, R=e⁻¹≈36.7879%, hazard=0.002/h and median≈832.555 h.',
    'R(t)=exp[−(t/η)^β], F=1−R, h(t)=(β/η)(t/η)^(β−1), median=η(ln2)^(1/β). Hazard ' +
      'has units 1/time and is not a failure probability.',
    'A prescribed two-parameter lifetime distribution for one nonrepairable ' +
      'population; parameters are not fitted from data. No censoring, maintenance, ' +
      'repair or common-cause effects. At t=0 with β<1, hazard is unbounded and shown ' +
      'as — with a warning, while survival remains one.',
  ],
  systemreliability: [
    'Combine independent component mission probabilities and compare all-required ' +
      'with any-one-sufficient systems.',
    'Does adding an independent parallel redundant component reduce reliability?',
    ['No', 'Yes', 'Only above 50% component reliability'],
    'The parallel system fails only if every component fails.',
    'For component reliabilities [90,90,95,80]%, series reliability is 61.56%; ' +
      'independent parallel reliability is 99.99%.',
    'Rseries=ΠRi; Rparallel=1−Π(1−Ri). Each input refers to the same mission ' +
      'interval. Failure probability is 1−R.',
    'Statistically independent, nonrepairable components. Series needs all units; ' +
      'parallel needs any one. No shared loads, switching failure or common-cause ' +
      'dependence. The n=0 curve starts at Rseries=1 and Rparallel=0 as explicit ' +
      'empty-product conventions.',
  ],
  controlchart: [
    'Generate reproducible Gaussian subgroup means and detect a controlled process-mean shift.',
    'Does a control limit describe a product specification?',
    ['No', 'Yes', 'Only for large subgroups'],
    'Control limits describe expected process variation; specifications come from external requirements.',
    'With μ=100, σ=2 and n=5, X̄ limits are 100±6/√5, or approximately 97.3167 and ' +
      '102.6833. The graph standardizes these limits to −3 and +3.',
    'For independent normal observations, SE=σ/√n; LCL=μ−3SE, UCL=μ+3SE. z=(X̄−μ)/SE. ' +
      'A shift of d individual σ changes the expected z by d√n.',
    'Known, fixed in-control μ/σ, independent normal observations, 36 subgroups, one ' +
      'deliberate shift after subgroup 18 and only the simple outside-3σ alarm rule. No ' +
      'estimated limits, autocorrelation, capability indices or Western Electric rule ' +
      'set. A point inside limits does not prove control.',
  ],
};

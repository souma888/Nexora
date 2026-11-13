import { lab, p, integer, list, parseList, choice, samples, table } from './lab-kit.js';
export function criticalSchedule(durations) {
  const predecessors = [[], [], [0], [0, 1], [2, 3], [3]],
    successors = Array.from({ length: 6 }, () => []),
    early = Array(6).fill(0),
    finish = Array(6).fill(0),
    late = Array(6),
    last = Array(6);
  predecessors.forEach((parents, i) => {
    parents.forEach((p) => successors[p].push(i));
    early[i] = Math.max(0, ...parents.map((p) => finish[p]));
    finish[i] = early[i] + durations[i];
  });
  const duration = Math.max(...finish);
  for (let i = 5; i >= 0; i--) {
    last[i] = successors[i].length ? Math.min(...successors[i].map((s) => late[s])) : duration;
    late[i] = last[i] - durations[i];
  }
  return {
    predecessors,
    successors,
    early,
    finish,
    late,
    last,
    slack: early.map((t, i) => late[i] - t),
    duration,
  };
}
export function normalStream(seed) {
  let state = seed >>> 0,
    spare;
  const uniform = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
  return () => {
    if (spare !== undefined) {
      const value = spare;
      spare = undefined;
      return value;
    }
    const radius = Math.sqrt(-2 * Math.log(uniform())),
      angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}
export const industrialModels = {
  mm1queue: lab(
    {
      id: 'mm1queue',
      title: 'M/M/1 Queue: Load & Waiting Time',
      discipline: 'industrial',
      lab: 'IE01',
      topic: 'Queueing systems',
      inputs: {
        arrival: p('Mean arrival rate λ', 'customers/h', 0.1, 20, 4),
        service: p('Mean service rate μ', 'customers/h', 0.2, 30, 6),
      },
      rules: [
        {
          type: 'less',
          left: 'arrival',
          right: 'service',
          field: 'arrival',
          message: 'A stationary M/M/1 queue requires arrival rate below service rate.',
        },
      ],
      metrics: {
        utilization: ['Server utilization', '%'],
        number: ['Mean customers in system', ''],
        time: ['Mean time in system', 'min'],
        waiting: ['Mean time waiting in queue', 'min'],
      },
      plot: {
        x: 'Customers in system n',
        xUnit: '',
        y: 'Stationary probability',
        yUnit: '%',
        step: true,
        traces: { y: 'P(N=n)', reference: 'P(N≤n)' },
      },
      text: [
        'Connect utilization to the stationary queue-length distribution and mean waiting time.',
        'As λ approaches μ from below, what happens to mean waiting time?',
        ['It grows without bound', 'It approaches zero', 'It stays fixed'],
        'The mean delay contains the shrinking denominator μ−λ.',
        'For λ=4/h and μ=6/h, utilization is 2/3, L=2, W=30 min and Wq=20 min. P(N=0)=1/3.',
        'ρ=λ/μ<1; P(N=n)=(1−ρ)ρⁿ. L=ρ/(1−ρ), W=1/(μ−λ), Wq=ρ/(μ−λ), L=λW.',
        'Stationary single FIFO server, independent Poisson arrivals, independent exponential service times, infinite waiting space and no abandonment. The graph joins integer probabilities for readability and truncates at n=50; its omitted tail is reported in the table. This is an analytical distribution, not a finite-run queue simulation.',
      ],
    },
    ({ arrival: l, service: m }) => {
      const rho = l / m,
        series = Array.from({ length: 51 }, (_, n) => ({
          x: n,
          y: 100 * (1 - rho) * rho ** n,
          reference: 100 * (1 - rho ** (n + 1)),
        }));
      return {
        summary: {
          utilization: 100 * rho,
          number: rho / (1 - rho),
          time: 60 / (m - l),
          waiting: (60 * rho) / (m - l),
        },
        series,
        visualization: {
          type: 'engineering-extension',
          kind: 'queue',
          arrival: l,
          service: m,
          rho,
        },
        warnings:
          rho > 0.95
            ? [
                'Near saturation, means are very large and substantial probability may lie beyond the plotted n=50. The analytical mean is not truncated.',
              ]
            : [],
        table: table(
          'Stationary distribution, including the omitted tail',
          ['State', 'Probability (%)', 'Cumulative probability (%)'],
          [...series.map((p) => [p.x, p.y, p.reference]), ['n ≥ 51', 100 * rho ** 51, 100]],
        ),
      };
    },
  ),
  eoq: lab(
    {
      id: 'eoq',
      title: 'Economic Order Quantity & Inventory Cycle',
      discipline: 'industrial',
      lab: 'IE02',
      topic: 'Operations engineering',
      inputs: {
        demand: p('Annual demand', 'units/year', 100, 100000, 1000),
        order: p('Fixed cost per order', 'currency/order', 1, 500, 50),
        holding: p('Annual holding cost per unit', 'currency/(unit·year)', 0.1, 50, 2),
        quantity: p('Selected order quantity', 'units', 1, 10000, 200),
      },
      metrics: {
        optimal: ['Continuous EOQ', 'units'],
        cost: ['Selected annual relevant cost', 'currency/year'],
        cycle: ['Selected replenishment cycle', 'days'],
      },
      plot: {
        x: 'Order quantity',
        xUnit: 'units',
        y: 'Annual relevant cost',
        yUnit: 'currency/year',
        traces: { y: 'Ordering + holding cost', reference: 'Holding cost', other: 'Ordering cost' },
      },
      text: [
        'Balance order frequency against average inventory and inspect the implied replenishment cycle.',
        'At the continuous optimum, how do ordering and holding costs compare?',
        ['They are equal', 'Ordering is always twice holding', 'Holding is zero'],
        'Setting d(DS/Q+HQ/2)/dQ=0 gives DS/Q=HQ/2.',
        'D=1000/year, S=50/order and H=2/(unit·year) give EOQ=√50000≈223.607 units. At Q=200, relevant annual cost is 250+200=450 and the cycle is 73 days.',
        'Q*=√(2DS/H); C(Q)=DS/Q+HQ/2; cycle=365Q/D. Average stock is Q/2 with instantaneous replenishment.',
        'Deterministic constant demand, zero lead time, no stockouts or safety stock, constant unit purchase cost and unconstrained continuous order sizes. Purchase cost is excluded because it is constant across Q. The currency unit is deliberately generic; this is a teaching cost model, not a purchasing recommendation.',
      ],
    },
    ({ demand: d, order: s, holding: h, quantity: q }) => {
      const optimal = Math.sqrt((2 * d * s) / h);
      return {
        summary: { optimal, cost: (d * s) / q + (h * q) / 2, cycle: (365 * q) / d },
        series: samples(Math.max(1, optimal / 5), Math.max(2 * optimal, 1.25 * q), (x) => ({
          y: (d * s) / x + (h * x) / 2,
          reference: (h * x) / 2,
          other: (d * s) / x,
        })),
        visualization: { type: 'engineering-extension', kind: 'inventory', demand: d, quantity: q },
        table: table(
          'Selected and continuous-optimal policies',
          ['Policy', 'Quantity', 'Ordering cost/year', 'Holding cost/year', 'Total/year'],
          [
            ['Selected', q, (d * s) / q, (h * q) / 2, (d * s) / q + (h * q) / 2],
            [
              'Continuous optimum',
              optimal,
              (d * s) / optimal,
              (h * optimal) / 2,
              (d * s) / optimal + (h * optimal) / 2,
            ],
          ],
        ),
      };
    },
  ),
  criticalpath: lab(
    {
      id: 'criticalpath',
      title: 'Critical Path & Project Slack',
      discipline: 'industrial',
      lab: 'IE03',
      topic: 'Project scheduling',
      inputs: { durations: list('Task durations A, B, C, D, E, F', '3,2,4,5,2,3', 1, 30, 6) },
      rules: [
        {
          type: 'list-length',
          field: 'durations',
          count: 6,
          message: 'Provide exactly six task durations for A through F.',
        },
      ],
      metrics: {
        duration: ['Earliest project completion', 'days'],
        critical: ['Zero-slack tasks', ''],
        work: ['Sum of task durations', 'task-days'],
      },
      plot: {
        x: 'Project time',
        xUnit: 'days',
        y: 'Task count',
        yUnit: '',
        step: true,
        traces: { y: 'Tasks active in earliest schedule', reference: 'Tasks completed' },
      },
      text: [
        'Calculate earliest/latest starts and distinguish a critical path from simply long tasks.',
        'Does shortening a positive-slack task necessarily shorten the project?',
        ['No', 'Yes', 'Only if its duration is an integer'],
        'A noncritical task can use its slack without changing the project’s completion time.',
        'With durations [3,2,4,5,2,3], the project finishes in 11 days. A→D→F is critical; B, C and E each have one day of slack.',
        'ES=max predecessor EF, EF=ES+d. In the backward pass LF=min successor LS, LS=LF−d. Total slack=LS−ES. All terminal tasks must finish by the project deadline.',
        'Fixed finish-to-start DAG: A/B start; C follows A; D follows A and B; E follows C and D; F follows D. Unlimited resources, deterministic whole-day durations, no calendars or resource leveling. Active intervals are [ES,EF). Multiple critical branches are supported.',
      ],
    },
    ({ durations }) => {
      const d = parseList(durations),
        s = criticalSchedule(d),
        series = Array.from({ length: s.duration + 1 }, (_, t) => ({
          x: t,
          y: d.filter((_, i) => s.early[i] <= t && t < s.finish[i]).length,
          reference: d.filter((_, i) => s.finish[i] <= t).length,
        }));
      return {
        summary: {
          duration: s.duration,
          critical: s.slack.filter((v) => v === 0).length,
          work: d.reduce((a, b) => a + b, 0),
        },
        series,
        schedule: s,
        visualization: { type: 'engineering-extension', kind: 'project', durations: d, ...s },
        table: table(
          'Forward and backward CPM passes',
          ['Task', 'Duration', 'Predecessors', 'ES', 'EF', 'LS', 'LF', 'Slack'],
          d.map((value, i) => [
            String.fromCharCode(65 + i),
            value,
            s.predecessors[i].map((p) => String.fromCharCode(65 + p)).join(', ') || '—',
            s.early[i],
            s.finish[i],
            s.late[i],
            s.last[i],
            s.slack[i],
          ]),
        ),
      };
    },
  ),
  weibull: lab(
    {
      id: 'weibull',
      title: 'Weibull Survival & Failure Hazard',
      discipline: 'industrial',
      lab: 'IE04',
      topic: 'Reliability engineering',
      inputs: {
        scale: p('Characteristic life η', 'h', 1, 10000, 1000),
        shape: p('Shape factor β', '', 0.5, 5, 2),
        age: p('Selected mission age', 'h', 0, 20000, 1000),
      },
      metrics: {
        reliability: ['Survival probability at selected age', '%'],
        hazard: ['Instantaneous hazard', '1/h'],
        median: ['Median lifetime', 'h'],
      },
      plot: {
        x: 'Service age',
        xUnit: 'h',
        y: 'Probability',
        yUnit: '%',
        traces: { y: 'Survival R(t)', reference: 'Cumulative failure F(t)' },
      },
      text: [
        'Compare decreasing, constant and increasing hazard regimes without confusing hazard with probability.',
        'When β=1, is the hazard constant?',
        ['Yes', 'No, it rises linearly', 'No, it decays to zero'],
        'The Weibull then reduces to an exponential survival model with hazard 1/η.',
        'At η=1000 h, β=2 and t=1000 h, R=e⁻¹≈36.7879%, hazard=0.002/h and median≈832.555 h.',
        'R(t)=exp[−(t/η)^β], F=1−R, h(t)=(β/η)(t/η)^(β−1), median=η(ln2)^(1/β). Hazard has units 1/time and is not a failure probability.',
        'A prescribed two-parameter lifetime distribution for one nonrepairable population; parameters are not fitted from data. No censoring, maintenance, repair or common-cause effects. At t=0 with β<1, hazard is unbounded and shown as — with a warning, while survival remains one.',
      ],
    },
    ({ scale: eta, shape: beta, age: t }) => {
      const survival = (x) => Math.exp(-((x / eta) ** beta)),
        singular = t === 0 && beta < 1;
      return {
        summary: {
          reliability: 100 * survival(t),
          hazard: singular ? null : (beta / eta) * (t / eta) ** (beta - 1),
          median: eta * Math.LN2 ** (1 / beta),
        },
        series: samples(0, Math.max(3 * eta, t), (x) => ({
          y: 100 * survival(x),
          reference: 100 * (1 - survival(x)),
        })),
        visualization: { type: 'engineering-extension', kind: 'survival', scale: eta, shape: beta },
        warnings: singular
          ? [
              'For β<1 the mathematical hazard is unbounded at age zero; the hazard metric is therefore shown as —.',
            ]
          : [],
      };
    },
  ),
  systemreliability: lab(
    {
      id: 'systemreliability',
      title: 'Series & Parallel System Reliability',
      discipline: 'industrial',
      lab: 'IE05',
      topic: 'Reliability engineering',
      inputs: {
        components: list('Component mission reliabilities (%)', '90,90,95,80', 0, 100, 8),
        topology: choice(
          'System topology',
          {
            series: 'All components required (series)',
            parallel: 'Any one component sufficient (parallel)',
          },
          'series',
        ),
      },
      metrics: {
        reliability: ['System mission reliability', '%'],
        failure: ['System mission failure probability', '%'],
        count: ['Component count', ''],
      },
      plot: {
        x: 'Components included',
        xUnit: '',
        y: 'Mission reliability',
        yUnit: '%',
        step: true,
        traces: { y: 'Selected topology', reference: 'Other topology' },
      },
      text: [
        'Combine independent component mission probabilities and compare all-required with any-one-sufficient systems.',
        'Does adding an independent parallel redundant component reduce reliability?',
        ['No', 'Yes', 'Only above 50% component reliability'],
        'The parallel system fails only if every component fails.',
        'For component reliabilities [90,90,95,80]%, series reliability is 61.56%; independent parallel reliability is 99.99%.',
        'Rseries=ΠRi; Rparallel=1−Π(1−Ri). Each input refers to the same mission interval. Failure probability is 1−R.',
        'Statistically independent, nonrepairable components. Series needs all units; parallel needs any one. No shared loads, switching failure or common-cause dependence. The n=0 curve starts at Rseries=1 and Rparallel=0 as explicit empty-product conventions.',
      ],
    },
    ({ components, topology }) => {
      const r = parseList(components).map((v) => v / 100),
        series = Array.from({ length: r.length + 1 }, (_, n) => {
          const subset = r.slice(0, n),
            s = subset.reduce((a, b) => a * b, 1),
            p = 1 - subset.reduce((a, b) => a * (1 - b), 1);
          return {
            x: n,
            y: 100 * (topology === 'series' ? s : p),
            reference: 100 * (topology === 'series' ? p : s),
          };
        }),
        reliability = series.at(-1).y;
      return {
        summary: { reliability, failure: 100 - reliability, count: r.length },
        series,
        visualization: { type: 'engineering-extension', kind: 'reliability', values: r, topology },
        table: table(
          'Independent mission component probabilities',
          ['Component', 'Reliability (%)', 'Failure probability (%)'],
          r.map((value, i) => [i + 1, 100 * value, 100 * (1 - value)]),
        ),
      };
    },
  ),
  controlchart: lab(
    {
      id: 'controlchart',
      title: 'X̄ Control Chart & Process Shift',
      discipline: 'industrial',
      lab: 'IE06',
      topic: 'Statistical quality control',
      inputs: {
        mean: p('In-control process mean', 'measurement units', 0, 1000, 100),
        sigma: p('Individual observation standard deviation', 'measurement units', 0.1, 10, 2),
        size: integer('Observations per subgroup', 2, 10, 5),
        shift: p('Mean shift after subgroup 18', 'individual σ', -5, 5, 1.5),
        seed: integer('Reproducible random seed', 1, 1000000, 42),
      },
      metrics: {
        alarms: ['Subgroup means outside limits', ''],
        upper: ['Upper control limit', 'measurement units'],
        lower: ['Lower control limit', 'measurement units'],
      },
      plot: {
        x: 'Subgroup number',
        xUnit: '',
        y: 'Mean deviation / standard error',
        yUnit: '',
        traces: {
          y: 'Standardized subgroup mean',
          reference: 'Upper limit +3',
          other: 'Lower limit −3',
        },
      },
      text: [
        'Generate reproducible Gaussian subgroup means and detect a controlled process-mean shift.',
        'Does a control limit describe a product specification?',
        ['No', 'Yes', 'Only for large subgroups'],
        'Control limits describe expected process variation; specifications come from external requirements.',
        'With μ=100, σ=2 and n=5, X̄ limits are 100±6/√5, or approximately 97.3167 and 102.6833. The graph standardizes these limits to −3 and +3.',
        'For independent normal observations, SE=σ/√n; LCL=μ−3SE, UCL=μ+3SE. z=(X̄−μ)/SE. A shift of d individual σ changes the expected z by d√n.',
        'Known, fixed in-control μ/σ, independent normal observations, 36 subgroups, one deliberate shift after subgroup 18 and only the simple outside-3σ alarm rule. No estimated limits, autocorrelation, capability indices or Western Electric rule set. A point inside limits does not prove control.',
      ],
    },
    ({ mean, sigma, size, shift, seed }) => {
      const normal = normalStream(seed),
        se = sigma / Math.sqrt(size),
        upper = mean + 3 * se,
        lower = mean - 3 * se,
        rows = [],
        series = Array.from({ length: 36 }, (_, i) => {
          let total = 0;
          for (let j = 0; j < size; j++) total += mean + sigma * (normal() + (i >= 18 ? shift : 0));
          const average = total / size,
            z = (average - mean) / se;
          rows.push([i + 1, average, lower, upper, Math.abs(z) > 3 ? 'outside' : 'inside']);
          return { x: i + 1, y: z, reference: 3, other: -3 };
        });
      return {
        summary: { alarms: series.filter((p) => Math.abs(p.y) > 3).length, upper, lower },
        series,
        visualization: { type: 'engineering-extension', kind: 'quality', mean, sigma, size, shift },
        table: {
          ...table(
            'Subgroup means in original measurement units',
            ['Subgroup', 'Mean', 'LCL', 'UCL', '3σ status'],
            rows,
          ),
          followProbe: true,
        },
      };
    },
  ),
};
industrialModels.mm1queue.definition.presets = { 'Near saturation': { arrival: 5.9, service: 6 } };
industrialModels.eoq.definition.presets = { 'Small frequent orders': { quantity: 50 } };
industrialModels.criticalpath.definition.presets = {
  'Two critical branches': { durations: '3,3,5,5,3,3' },
};
industrialModels.weibull.definition.presets = {
  'Constant exponential hazard': { shape: 1 },
  'Initial hazard singularity': { shape: 0.5, age: 0 },
};
industrialModels.systemreliability.definition.presets = {
  'Parallel redundancy': { topology: 'parallel' },
  'One failed component': { components: '90,0,95,80' },
};
industrialModels.controlchart.definition.presets = {
  'No deliberate shift': { shift: 0 },
  'Large detectable shift': { shift: 5 },
};

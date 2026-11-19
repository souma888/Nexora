import {
  exploration as lab,
  p,
  integer,
  choice,
  textInput,
  seq,
  teaching,
  output,
  domain,
  requireValue,
  normalCDF,
  bisect,
  numbers,
  mean,
} from './exploration-kit.js';
import { jsonNumbers } from './study-kit.js';
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config
 * @param {(a:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) =>
  lab({ discipline: 'industrial', topic: 'Operations research & production', ...config }, solve);
export function simplex(A, b, c) {
  const m = A.length,
    n = c.length,
    tab = A.map((r, i) => [...r, ...Array.from({ length: m }, (_, j) => +(i === j)), b[i]]);
  tab.push([...c.map((v) => -v), ...Array(m + 1).fill(0)]);
  const basis = Array.from({ length: m }, (_, i) => n + i),
    frames = [{ tableau: tab.map((r) => [...r]), basis: [...basis], pivot: null }];
  let status = 'optimal';
  for (let k = 0; k < 100; k++) {
    const enter = tab[m].slice(0, n + m).findIndex((v) => v < -1e-10);
    if (enter < 0) break;
    let leave = -1,
      ratio = Infinity;
    for (let i = 0; i < m; i++)
      if (tab[i][enter] > 1e-10) {
        const q = tab[i].at(-1) / tab[i][enter];
        if (
          q < ratio - 1e-10 ||
          (Math.abs(q - ratio) < 1e-10 && basis[i] < (basis[leave] ?? Infinity))
        ) {
          ratio = q;
          leave = i;
        }
      }
    if (leave < 0) {
      status = 'unbounded';
      break;
    }
    const pivot = tab[leave][enter];
    tab[leave] = tab[leave].map((v) => v / pivot);
    for (let i = 0; i <= m; i++)
      if (i !== leave) {
        const factor = tab[i][enter];
        tab[i] = tab[i].map((v, j) => v - factor * tab[leave][j]);
      }
    basis[leave] = enter;
    frames.push({ tableau: tab.map((r) => [...r]), basis: [...basis], pivot: [leave, enter] });
    if (k === 99) status = 'iteration limit';
  }
  const solution = Array(n).fill(0);
  basis.forEach((j, i) => {
    if (j < n) solution[j] = tab[i].at(-1);
  });
  return { solution, objective: status === 'optimal' ? tab[m].at(-1) : null, status, frames };
}
export function erlangC(arrival, service, servers) {
  const offered = arrival / service,
    rho = offered / servers;
  let term = 1,
    sum = 1;
  for (let k = 1; k < servers; k++) {
    term *= offered / k;
    sum += term;
  }
  const tail = (term * offered) / servers / (1 - rho),
    pwait = tail / (sum + tail),
    wait = pwait / (servers * service - arrival);
  return { rho, pwait, wait, length: arrival * wait, p0: 1 / (sum + tail) };
}
function lpInput(a) {
  const A = jsonNumbers(a.constraints, 1, 8, 2, 2, 0, 100),
    b = numbers(a.capacities, 1, 8),
    c = numbers(a.objective, 2, 2);
  requireValue(A.length === b.length, 'Supply one nonnegative capacity per constraint row.');
  requireValue(
    b.every((v) => v > 0) && c.every((v) => v >= 0),
    'Capacities must be positive and objective coefficients nonnegative.',
  );
  requireValue(
    [0, 1].every((j) => A.some((r) => r[j] > 0)),
    'Both decision variables must be bounded by a positive constraint coefficient.',
  );
  return { A, b, c };
}
const lpFields = {
  constraints: textInput('Constraint coefficient rows (Ax ≤ b)', '[[1,1],[2,1],[1,0]]', 300),
  capacities: textInput('Capacities b', '8,12,5', 100),
  objective: textInput('Maximize coefficients c', '3,2', 100),
};
export const operationsModels = {
  graphicalLP: make(
    {
      id: 'graphicalLP',
      title: 'Linear Programming: Graphical Method and Sensitivity',
      inputs: lpFields,
      validateValues: domain('constraints', lpInput),
      metrics: {
        first: ['Optimal x₁', '1'],
        second: ['Optimal x₂', '1'],
        objective: ['Maximum objective', '1'],
      },
      plot: { x: 'x₁', xUnit: '1', y: 'x₂', yUnit: '1' },
      text: teaching(
        'Intersect user-defined two-variable half-planes and evaluate every feasible corner before comparing marginal capacity changes.',
        'Must an optimum of a bounded nonempty linear program exist at a corner?',
        ['Yes', 'No', 'Only if the coefficients are integers'],
        'A linear objective reaches an optimum on a face containing at least one extreme point.',
        'Maximize 3x+2y subject to x+y≤8, 2x+y≤12, x≤5: optimum (4,4) gives 20.',
        'Max cᵀx subject to Ax≤b, x≥0; candidate vertices are pairwise boundary intersections.',
        'Two variables, 1…8 nonnegative resource constraints and positive capacities. Origin is feasible and both variables must be bounded. Sensitivity table uses a +0.001 capacity perturbation, not an unrestricted valid shadow-price interval.',
      ),
    },
    (a) => {
      const { A, b, c } = lpInput(a),
        rows = [...A, [1, 0], [0, 1]],
        rhs = [...b, 0, 0],
        vertices = [];
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++) {
          const d = rows[i][0] * rows[j][1] - rows[i][1] * rows[j][0];
          if (Math.abs(d) < 1e-12) continue;
          const x = (rhs[i] * rows[j][1] - rows[i][1] * rhs[j]) / d,
            y = (rows[i][0] * rhs[j] - rhs[i] * rows[j][0]) / d;
          if (x >= -1e-9 && y >= -1e-9 && A.every((r, k) => r[0] * x + r[1] * y <= b[k] + 1e-9))
            vertices.push([Math.max(0, x), Math.max(0, y)]);
        }
      const center = [mean(vertices.map((v) => v[0])), mean(vertices.map((v) => v[1]))];
      vertices.sort(
        (a, b) =>
          Math.atan2(a[1] - center[1], a[0] - center[0]) -
          Math.atan2(b[1] - center[1], b[0] - center[0]),
      );
      const best = vertices.reduce((a, b) =>
          c[0] * a[0] + c[1] * a[1] > c[0] * b[0] + c[1] * b[1] ? a : b,
        ),
        objective = c[0] * best[0] + c[1] * best[1];
      return output(
        { first: best[0], second: best[1], objective },
        vertices.map((v) => ({ x: v[0], y: v[1] })),
        'feasible-polygon',
        { vertices, best, constraints: A, capacities: b },
        b.map((_, i) => {
          const changed = [...b];
          changed[i] += 0.001;
          return [
            `One-sided value derivative for capacity ${i + 1}`,
            (simplex(A, changed, c).objective - objective) / 0.001,
          ];
        }),
      );
    },
  ),
  simplextableau: make(
    {
      id: 'simplextableau',
      title: 'Simplex Pivoting Tableau',
      inputs: lpFields,
      validateValues: domain('constraints', lpInput),
      metrics: {
        objective: ['Optimal objective', '1'],
        pivots: ['Basis pivots', '1'],
        first: ['x₁', '1'],
        second: ['x₂', '1'],
      },
      plot: { x: 'Pivot index', xUnit: '1', y: 'Basic objective value', yUnit: '1' },
      text: teaching(
        'Run primal simplex on an editable two-variable resource-allocation problem and replay each actual row operation.',
        'Why use a minimum positive ratio for the leaving row?',
        [
          'To preserve primal feasibility',
          'To maximize the pivot value',
          'To discard all slack variables',
        ],
        'The ratio limits how far the entering variable can grow before a basic variable reaches zero.',
        'For c=[3,2], A=[[1,1],[2,1],[1,0]], b=[8,12,5], the final objective is 20.',
        'Introduce slack variables Ax+s=b; pivot an entering negative reduced cost and a leaving minimum-ratio row.',
        'Primal feasible ≤ constraints with nonnegative coefficients and positive right sides, x≥0. Bland-style entering/tie ordering avoids cycling; capped at 100 pivots. No Phase-I, equality constraints or integer programming.',
      ),
    },
    (a) => {
      const { A, b, c } = lpInput(a),
        r = simplex(A, b, c);
      return output(
        {
          objective: r.objective,
          pivots: r.frames.length - 1,
          first: r.solution[0],
          second: r.solution[1],
        },
        r.frames.map((f, x) => ({ x, y: f.tableau.at(-1).at(-1) })),
        'simplex',
        { frames: r.frames },
        r.frames
          .at(-1)
          .tableau.map((r, i) => [
            i === A.length ? 'Objective row' : `Constraint ${i + 1}`,
            r.map((v) => Number(v.toPrecision(5))).join(', '),
          ]),
      );
    },
  ),
  newsvendor: make(
    {
      id: 'newsvendor',
      title: 'Newsvendor Model',
      inputs: {
        mean: p('Mean demand', 'units', 10, 1000, 100),
        deviation: p('Demand standard deviation', 'units', 1, 200, 20),
        price: p('Selling price', 'currency', 5, 100, 20),
        cost: p('Unit purchase cost', 'currency', 1, 80, 10),
        salvage: p('Unsold salvage value', 'currency', 0, 50, 2),
      },
      validateValues: domain('cost', (a) =>
        requireValue(
          a.salvage < a.cost && a.cost < a.price,
          'Require salvage < cost < selling price.',
        ),
      ),
      metrics: {
        fractile: ['Critical demand fractile', '1'],
        quantity: ['Optimal continuous order quantity', 'units'],
        profit: ['Expected one-period profit', 'currency'],
      },
      plot: { x: 'Order quantity', xUnit: 'units', y: 'Expected profit', yUnit: 'currency' },
      text: teaching(
        'Balance underage and overage cost under normally distributed single-period demand.',
        'Does a larger salvage value increase the optimal order?',
        ['Yes', 'No', 'Only if purchase cost rises'],
        'Better salvage reduces the cost of leftover stock and increases the target service fractile.',
        'Price 20, cost 10 and salvage 2 give critical fractile (20−10)/(20−2)=.555556.',
        'F(Q*)=(p−c)/(p−s); E[(D−Q)+]=σ[φ(z)−z(1−Φ(z))].',
        'Continuous untruncated normal demand and order quantity, lost sales, fixed prices and one period. Negative normal-demand tail is not physically truncated; interpret only when mean is several standard deviations above zero.',
      ),
    },
    (a) => {
      const fractile = (a.price - a.cost) / (a.price - a.salvage),
        z = bisect((x) => normalCDF(x) - fractile, -8, 8),
        quantity = Math.max(0, a.mean + a.deviation * z),
        profit = (Q) => {
          const z = (Q - a.mean) / a.deviation,
            short =
              a.deviation *
              (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI) - z * (1 - normalCDF(z))),
            sales = a.mean - short;
          return (a.price - a.salvage) * sales - (a.cost - a.salvage) * Q;
        };
      return output(
        { fractile, quantity, profit: profit(quantity) },
        seq(0, a.mean + 4 * a.deviation, 200).map((x) => ({ x, y: profit(x) })),
        'inventory',
        { ...a, quantity },
      );
    },
  ),
  mmcqueue: make(
    {
      id: 'mmcqueue',
      title: 'M/M/c Queue and Little’s Law',
      inputs: {
        arrival: p('Poisson arrival rate λ', 'customers/h', 0.1, 100, 12),
        service: p('Service rate per server μ', 'customers/h', 1, 60, 8),
        servers: integer('Parallel identical servers c', 1, 10, 2),
      },
      validateValues: domain('arrival', (a) =>
        requireValue(a.arrival < a.servers * a.service, 'Steady state requires λ < cμ.'),
      ),
      metrics: {
        utilization: ['Server utilization', '%'],
        wait: ['Mean queue waiting time', 'min'],
        length: ['Mean number in system', 'customers'],
        probability: ['Probability an arrival waits', '%'],
      },
      plot: { x: 'Arrival rate', xUnit: 'customers/h', y: 'Mean queue wait', yUnit: 'min' },
      text: teaching(
        'Evaluate the Erlang-C probability of waiting and verify Little’s law for multiple identical servers.',
        'Can an M/M/c queue have a finite steady-state wait at λ≥cμ?',
        ['No', 'Yes', 'Only with FIFO'],
        'Incoming work then meets or exceeds total service capacity and the infinite-buffer queue is unstable.',
        'For λ=12/h, μ=8/h and c=2: ρ=.75, Pwait=.642857 and Wq=9.642857 min.',
        'Pwait=[aᶜ/(c!(1−ρ))]/[Σ₀ᶜ⁻¹aᵏ/k!+aᶜ/(c!(1−ρ))]; Wq=Pwait/(cμ−λ); L=λ(Wq+1/μ).',
        'Stationary Poisson arrivals, independent exponential service, c identical servers, FCFS, infinite waiting room and no abandonment. An analytic steady-state model, not a discrete-event queue animation.',
      ),
    },
    (a) => {
      const r = erlangC(a.arrival, a.service, a.servers);
      return output(
        {
          utilization: r.rho * 100,
          wait: r.wait * 60,
          length: a.arrival * (r.wait + 1 / a.service),
          probability: r.pwait * 100,
        },
        seq(0.01, a.servers * a.service * 0.98, 200).map((x) => ({
          x,
          y: erlangC(x, a.service, a.servers).wait * 60,
        })),
        'queue',
        { ...a, waiting: r.length },
      );
    },
  ),
  linebalance: make(
    {
      id: 'linebalance',
      title: 'Assembly Line Balancing and Takt Time',
      inputs: {
        times: textInput('Task durations, indexed from zero', '25,18,35,12,22,15', 200),
        precedence: textInput('Precedence edges from>to', '0>2,1>2,2>3,2>4,3>5,4>5', 300),
        available: p('Available production time', 'min/shift', 60, 600, 420),
        demand: p('Demand per shift', 'units', 50, 1000, 400),
      },
      validateValues: domain('precedence', (a) => lineData(a)),
      metrics: {
        takt: ['Takt / station cycle budget', 's'],
        stations: ['Greedy stations needed', '1'],
        efficiency: ['Balance efficiency', '%'],
        lower: ['Work-content station lower bound', '1'],
      },
      plot: {
        x: 'Station index',
        xUnit: '1',
        y: 'Assigned work time',
        yUnit: 's',
        traces: { y: 'Station work', reference: 'Takt budget' },
      },
      text: teaching(
        'Assign an editable precedence DAG with a ranked-positional-weight heuristic and compare idle time with the work-content lower bound.',
        'Does a greedy feasible assignment prove the minimum number of stations?',
        ['No', 'Yes', 'Only if task times differ'],
        'Line balancing is combinatorial; this heuristic is a reproducible feasible schedule, not a global optimality certificate.',
        '420 min for 400 units gives takt 63 s. Total work 127 s requires at least ceil(127/63)=3 stations.',
        'Ttakt=available_seconds/demand; RPWᵢ=tᵢ+Σ unique successor times; efficiency=Σt/(Nstations·Ttakt).',
        'Acyclic user precedence graph, indivisible tasks, equal stations and no resource incompatibilities. Tasks exceeding takt are rejected. Unique successor counting prevents double-counting converging paths.',
      ),
    },
    (a) => {
      const { times, edges, takt } = lineData(a),
        successors = (i) => {
          const set = new Set();
          const walk = (j) =>
            edges
              .filter((e) => e[0] === j)
              .forEach((e) => {
                if (!set.has(e[1])) {
                  set.add(e[1]);
                  walk(e[1]);
                }
              });
          walk(i);
          return [...set];
        },
        weight = times.map((t, i) => t + successors(i).reduce((s, j) => s + times[j], 0)),
        done = new Set(),
        stations = [];
      while (done.size < times.length) {
        let load = 0;
        const tasks = [];
        while (true) {
          const options = times
            .map((_, i) => i)
            .filter(
              (i) =>
                !done.has(i) &&
                edges.filter((e) => e[1] === i).every((e) => done.has(e[0])) &&
                load + times[i] <= takt + 1e-9,
            )
            .sort((i, j) => weight[j] - weight[i] || i - j);
          if (!options.length) break;
          const i = options[0];
          done.add(i);
          load += times[i];
          tasks.push(i);
        }
        stations.push({ load, tasks });
      }
      const total = times.reduce((s, v) => s + v, 0);
      return output(
        {
          takt,
          stations: stations.length,
          efficiency: (100 * total) / (stations.length * takt),
          lower: Math.ceil(total / takt),
        },
        stations.map((s, i) => ({ x: i + 1, y: s.load, reference: takt })),
        'gantt',
        {
          jobs: stations.flatMap((s, i) => {
            let t = 0;
            return s.tasks.map((j) => {
              const v = { lane: i, start: t, end: t + times[j], label: `T${j}` };
              t += times[j];
              return v;
            });
          }),
        },
        stations.map((s, i) => [`Station ${i + 1}`, s.tasks.map((j) => `T${j}`).join(', ')]),
      );
    },
  ),
  exponentialsmoothing: make(
    {
      id: 'exponentialsmoothing',
      title: 'Exponential Smoothing and Forecast Error',
      inputs: {
        values: textInput(
          'Time-ordered observed demand',
          '100,105,98,110,115,112,120,130,125,138,140,145',
          500,
        ),
        alpha: p('Smoothing weight α', '1', 0.01, 1, 0.3),
      },
      validateValues: domain('values', (a) => numbers(a.values, 4, 100)),
      metrics: {
        next: ['Next-period forecast', 'units'],
        mae: ['One-step mean absolute error', 'units'],
        rmse: ['One-step root-mean-square error', 'units'],
        bias: ['Mean signed forecast error (actual−forecast)', 'units'],
      },
      plot: {
        x: 'Period index',
        xUnit: '1',
        y: 'Demand',
        yUnit: 'units',
        traces: { y: 'Actual observations', reference: 'One-step-ahead forecast' },
      },
      text: teaching(
        'Forecast an editable time series without using the observation being predicted and compare error metrics.',
        'Does increasing α make forecasts react faster to recent changes?',
        ['Yes', 'No', 'It removes all forecast error'],
        'A larger α puts more weight on the newest observation and less on the prior level.',
        'With initial level 100, α=.3 and second observation 105, the updated level is 101.5; its forecast was 100.',
        'Fₜ=levelₜ₋₁; levelₜ=αyₜ+(1−α)levelₜ₋₁; MAE=mean|y−F|.',
        'Simple level-only exponential smoothing, initialization at first observation and evaluation from period two. No trend, seasonality, optimized α or prediction intervals.',
      ),
    },
    (a) => {
      const values = numbers(a.values, 4, 100);
      let level = values[0];
      const errors = [],
        s = values.map((y, x) => {
          const forecast = level;
          if (x) errors.push(y - forecast);
          level = a.alpha * y + (1 - a.alpha) * level;
          return { x, y, reference: x ? forecast : null };
        });
      return output(
        {
          next: level,
          mae: mean(errors.map(Math.abs)),
          rmse: Math.sqrt(mean(errors.map((v) => v * v))),
          bias: mean(errors),
        },
        s,
        'forecast',
        { ...a },
      );
    },
  ),
  jobshopschedule: make(
    {
      id: 'jobshopschedule',
      title: 'Job-Shop Scheduling: SPT and EDD',
      inputs: {
        jobs: textInput(
          'Jobs: each list contains [machine, duration] operations',
          '[[[0,3],[1,4]],[[1,2],[0,5]],[[0,2],[1,3]]]',
          1200,
        ),
        due: textInput('Job due times', '10,12,8', 150),
        rule: choice('Dispatching tie priority', ['SPT', 'EDD'], 'SPT'),
      },
      validateValues: domain('jobs', (a) => jobData(a)),
      metrics: {
        makespan: ['Makespan', 'time units'],
        tardiness: ['Total job tardiness', 'time units'],
        flow: ['Mean completion time', 'time units'],
      },
      plot: {
        x: 'Job index',
        xUnit: '1',
        y: 'Completion time',
        yUnit: 'time units',
        traces: { y: 'Completion', reference: 'Due time' },
      },
      text: teaching(
        'Schedule user-defined machine routes with precedence and exclusive machine occupancy, then compare dispatching priorities.',
        'Does shortest-processing-time dispatch guarantee the optimal job-shop makespan?',
        ['No', 'Yes', 'Only with two machines'],
        'Local priorities do not solve the general job-shop combinatorial optimization problem.',
        'A machine cannot process overlapping operations; each job’s next operation starts after its prior one finishes.',
        'start=max(machine_available,job_ready); choose earliest feasible start, then SPT duration or EDD job due date.',
        'Nonpreemptive serial schedule generation, all jobs released at zero, up to 8 jobs, 8 operations each and machine IDs 0…3. SPT/EDD break ties among earliest-start eligible operations; no optimality claim.',
      ),
    },
    (a) => {
      const { jobs, due } = jobData(a),
        next = jobs.map(() => 0),
        ready = jobs.map(() => 0),
        machine = Array(4).fill(0),
        schedule = [];
      while (next.some((v, i) => v < jobs[i].length)) {
        const options = jobs
            .flatMap((job, i) =>
              next[i] < job.length
                ? [
                    {
                      i,
                      m: job[next[i]][0],
                      duration: job[next[i]][1],
                      start: Math.max(ready[i], machine[job[next[i]][0]]),
                    },
                  ]
                : [],
            )
            .sort(
              (x, y) =>
                x.start - y.start ||
                (a.rule === 'SPT' ? x.duration - y.duration : due[x.i] - due[y.i]) ||
                x.i - y.i,
            ),
          o = options[0],
          end = o.start + o.duration;
        schedule.push({ lane: o.m, start: o.start, end, label: `J${o.i}·${next[o.i]}` });
        ready[o.i] = end;
        machine[o.m] = end;
        next[o.i]++;
      }
      return output(
        {
          makespan: Math.max(...ready),
          tardiness: ready.reduce((s, v, i) => s + Math.max(0, v - due[i]), 0),
          flow: mean(ready),
        },
        ready.map((y, x) => ({ x, y, reference: due[x] })),
        'gantt',
        { jobs: schedule },
        schedule.map((o) => [o.label, `M${o.lane}: ${o.start}…${o.end}`]),
      );
    },
  ),
};
export function lineData(a) {
  const times = numbers(a.times, 2, 20),
    takt = (a.available * 60) / a.demand;
  requireValue(
    times.every((t) => t > 0 && t <= takt),
    'All task times must be positive and no greater than takt.',
  );
  const edges = a.precedence.trim()
    ? a.precedence.split(',').map((s) => {
        requireValue(/^\s*\d+>\d+\s*$/.test(s), 'Use comma-separated from>to task indices.');
        return s.split('>').map(Number);
      })
    : [];
  requireValue(
    edges.every(([i, j]) => i < times.length && j < times.length && i !== j),
    'Precedence indices must identify different tasks.',
  );
  const indegree = times.map((_, i) => edges.filter((e) => e[1] === i).length),
    queue = indegree.flatMap((v, i) => (v === 0 ? [i] : []));
  for (let p = 0; p < queue.length; p++)
    edges
      .filter((e) => e[0] === queue[p])
      .forEach(([, j]) => {
        if (--indegree[j] === 0) queue.push(j);
      });
  requireValue(queue.length === times.length, 'Precedence graph contains a cycle.');
  return { times, edges, takt };
}
export function jobData(a) {
  const jobs = JSON.parse(a.jobs);
  requireValue(Array.isArray(jobs) && jobs.length >= 1 && jobs.length <= 8, 'Use 1…8 jobs.');
  requireValue(
    jobs.every(
      (job) =>
        Array.isArray(job) &&
        job.length >= 1 &&
        job.length <= 8 &&
        job.every(
          (op) =>
            Array.isArray(op) &&
            op.length === 2 &&
            Number.isInteger(op[0]) &&
            op[0] >= 0 &&
            op[0] < 4 &&
            Number.isFinite(op[1]) &&
            op[1] > 0 &&
            op[1] <= 100,
        ),
    ),
    'Each operation is [machine 0…3, duration >0 and ≤100]; 1…8 operations per job.',
  );
  const due = numbers(a.due, jobs.length, jobs.length);
  requireValue(
    due.every((v) => v > 0),
    'Due times must be positive.',
  );
  return { jobs, due };
}

import {
  study,
  p,
  integer,
  choice,
  textInput,
  table,
  random,
  systemVisual,
  jsonNumbers,
  checkInput,
  indices,
} from './study-kit.js';
import {
  arq,
  ipv4,
  dotted,
  safety,
  diskPath,
  semaphoreTrace,
  memoryTrace,
  scheduleCPU,
} from './network-engine.js';
const real = (label, min, max, initial) => p(label, '', min, max, initial);
/** @template {import('./schema.js').Fields} F @template {import('./schema.js').Result} R
 * @param {import('./schema.js').MathLabConfig<F>} config @param {(input:import('./schema.js').InputValues<F>)=>R} solve */
const make = (config, solve) => study({ discipline: 'networks', ...config }, solve);
const traceTable = (caption, headers, rows) => ({
  ...table(caption, headers, rows),
  followProbe: true,
  selected: 0,
});
function bankerData(v) {
  const allocation = jsonNumbers(v.allocation, 2, 6, 1, 4, 0, 50),
    claims = jsonNumbers(v.claims, 2, 6, 1, 4, 0, 50),
    available = JSON.parse(v.available);
  if (
    claims.length !== allocation.length ||
    claims[0].length !== allocation[0].length ||
    !Array.isArray(available) ||
    available.length !== allocation[0].length ||
    available.some((x) => !Number.isInteger(x) || x < 0 || x > 50) ||
    [...allocation.flat(), ...claims.flat()].some((x) => !Number.isInteger(x))
  )
    throw Error(
      'Allocation/claim dimensions must agree; available needs one nonnegative integer per resource.',
    );
  if (v.mode === 'banker' && claims.some((r, i) => r.some((x, j) => x < allocation[i][j])))
    throw Error('Banker maximum claims must be at least current allocations.');
  return { allocation, claims, available };
}
const numberList = (s, min, max, count = 40) => {
  const a = String(s)
    .split(',')
    .map((x) => (x.trim() ? Number(x) : NaN));
  if (!a.length || a.length > count || a.some((v) => !Number.isInteger(v) || v < min || v > max))
    throw Error(`Use 1–${count} comma-separated integers ${min}…${max}.`);
  return a;
};
function routeData(v) {
  const A = jsonNumbers(v.matrix, 2, 6, 2, 6, 0, 16);
  if (
    A.some((r, i) => r.length !== A.length || r[i] !== 0 || r.some((x, j) => x !== A[j][i])) ||
    v.failed >= A.length ||
    v.failed === 0
  )
    throw Error(
      'Use a symmetric square cost matrix with zero diagonal; failed neighbor must exist and differ from destination 0.',
    );
  return A;
}
export const networkModels = {
  tcp: make(
    {
      id: 'tcp',
      title: 'TCP Congestion Control: Slow Start and AIMD',
      topic: 'Transport protocols',
      inputs: {
        threshold: integer('Initial slow-start threshold (segments)', 2, 32, 8),
        rounds: integer('RTT epochs', 5, 60, 25),
        losses: textInput('Loss epochs (none or comma-separated)', '10,20', 180),
        loss: choice(
          'Loss signal',
          {
            duplicate: 'Three duplicate ACKs (Reno abstraction)',
            timeout: 'Retransmission timeout',
          },
          'duplicate',
        ),
      },
      validateValues: checkInput('losses', (v) => indices(v.losses, v.rounds)),
      metrics: {
        window: ['Final congestion window', 'segments'],
        threshold: ['Final slow-start threshold', 'segments'],
        losses: ['Loss events', '1'],
      },
      plot: {
        x: 'RTT epoch',
        xUnit: 'RTT',
        y: 'Window',
        yUnit: 'segments',
        traces: { y: 'Congestion window', reference: 'Slow-start threshold' },
        step: true,
      },
      text: {
        description:
          'Trace slow start, congestion avoidance and loss responses at an RTT-epoch scale.',
        predict:
          'After a timeout, does classic slow start resume from half the old congestion window?',
        answers: [
          'No, it restarts from one segment in this model',
          'Yes',
          'It doubles immediately',
        ],
        explain:
          'The timeout case sets ssthresh to half the flight-size approximation, but cwnd restarts at one segment.',
        example: 'With threshold 8, a loss-free epoch sequence begins 1,2,4,8,9,10.',
        equation:
          'Loss-free cwnd: double below ssthresh, else add one segment per RTT. Loss: ssthresh=max(2,cwnd/2); timeout cwnd=1; duplicate-ACK recovery cwnd=ssthresh.',
        limits:
          'Pedagogical Reno-style RTT abstraction informed by RFC 5681. It omits ACK-by-ACK timing, delayed ACKs, receiver limits, fast-recovery inflation, pacing and modern CUBIC/BBR; flight size is approximated by cwnd.',
      },
    },
    ({ threshold, rounds, losses, loss }) => {
      let window = 1,
        ss = threshold;
      const dropped = new Set(indices(losses, rounds)),
        frames = [];
      for (let t = 0; t <= rounds; t++) {
        frames.push({
          t,
          window,
          threshold: ss,
          event:
            t === 0
              ? 'Initial window'
              : dropped.has(t - 1)
                ? 'Loss response'
                : window < ss
                  ? 'Slow start'
                  : 'Congestion avoidance',
        });
        if (t < rounds) {
          if (dropped.has(t)) {
            ss = Math.max(2, window / 2);
            window = loss === 'timeout' ? 1 : ss;
          } else window = window < ss ? Math.min(2 * window, ss) : window + 1;
        }
      }
      return {
        summary: { window, threshold: ss, losses: dropped.size },
        series: frames.map((f) => ({ x: f.t, y: f.window, reference: f.threshold })),
        visualization: systemVisual('tcp', {}, frames),
        table: traceTable(
          'RTT transitions',
          ['Epoch', 'cwnd', 'ssthresh', 'Event'],
          frames.map((f) => [f.t, f.window, f.threshold, f.event]),
        ),
      };
    },
  ),
  arq: make(
    {
      id: 'arq',
      title: 'Go-Back-N vs. Selective Repeat',
      topic: 'Reliable links',
      inputs: {
        packets: integer('Packets', 4, 24, 12),
        window: integer('Sender window', 1, 8, 4),
        lost: textInput('Packets dropped on first attempt', '2,6', 160),
      },
      validateValues: checkInput('lost', (v) => {
        indices(v.lost, v.packets);
        if (v.window > v.packets) throw Error('Window must not exceed packet count.');
      }),
      metrics: {
        gbn: ['Go-Back-N data transmissions', '1'],
        sr: ['Selective Repeat data transmissions', '1'],
        gbntime: ['GBN completion time', 'ticks'],
        srtime: ['SR completion time', 'ticks'],
      },
      plot: {
        x: 'Channel tick',
        xUnit: 'ticks',
        y: 'Packets delivered in order',
        yUnit: 'packets',
        traces: { y: 'Go-Back-N', reference: 'Selective Repeat' },
        step: true,
      },
      text: {
        description:
          'Run two discrete sender/receiver event models against the same one-time data losses.',
        predict: 'Which receiver buffers correctly received packets beyond a gap?',
        answers: ['Selective Repeat', 'Go-Back-N', 'Neither'],
        explain:
          'SR acknowledges and buffers out-of-order data. GBN discards it and uses cumulative acknowledgments.',
        example:
          'With no loss, each protocol sends exactly N data packets. A lost early packet can force GBN to resend later packets.',
        equation:
          'Sender invariant: base ≤ next ≤ base+W. GBN timeout retransmits its outstanding window; SR times out individual packets.',
        limits:
          'One data send per tick; data and ACK each propagate for one tick, RTO=5 ticks, ACKs never drop. Configured packet IDs drop only on their first transmission. Sequence numbers do not wrap; this does not model a full TCP stack.',
      },
    },
    ({ packets, window, lost }) => {
      const drop = indices(lost, packets),
        a = arq('gbn', packets, window, drop),
        b = arq('sr', packets, window, drop),
        length = Math.max(a.frames.length, b.frames.length),
        frames = Array.from({ length }, (_, i) => ({
          t: i,
          gbn: a.frames[Math.min(i, a.frames.length - 1)],
          sr: b.frames[Math.min(i, b.frames.length - 1)],
        }));
      return {
        summary: { gbn: a.transmissions, sr: b.transmissions, gbntime: a.time, srtime: b.time },
        series: frames.map((f) => ({ x: f.t, y: f.gbn.delivered, reference: f.sr.delivered })),
        visualization: systemVisual('arq', { packets }, frames),
        table: traceTable(
          'Protocol events',
          ['Tick', 'GBN event', 'SR event', 'GBN/SR delivered'],
          frames.map((f) => [f.t, f.gbn.event, f.sr.event, `${f.gbn.delivered}/${f.sr.delivered}`]),
        ),
      };
    },
  ),
  macaccess: make(
    {
      id: 'macaccess',
      title: 'Slotted ALOHA and Ideal CSMA Throughput',
      topic: 'Shared-channel access',
      inputs: {
        stations: integer('Stations N', 2, 30, 10),
        probability: real('Attempt probability per idle mini-slot', 0.01, 0.9, 0.1),
        duration: integer('Packet duration in mini-slots', 1, 30, 10),
        ticks: integer('Simulated mini-slots', 100, 4000, 1000),
        seed: integer('Seed', 1, 99999, 42),
      },
      metrics: {
        aloha: ['ALOHA analytical successful-slot fraction', '1'],
        csma: ['Ideal CSMA analytical useful-time fraction', '1'],
        observed: ['Simulated CSMA useful-time fraction', '1'],
        collisions: ['CSMA collisions', '1'],
      },
      plot: {
        x: 'Channel mini-slot',
        xUnit: 'ticks',
        y: 'Useful-time fraction',
        yUnit: '',
        traces: {
          y: 'Running observed CSMA',
          reference: 'Analytical ideal CSMA',
          other: 'Analytical slotted ALOHA',
        },
      },
      text: {
        description:
          'Compare slot collisions with a carrier-sense model that suppresses new transmissions while a packet occupies the channel.',
        predict: 'Does carrier sensing eliminate simultaneous attempts at an idle boundary?',
        answers: ['No, simultaneous starts can still collide', 'Yes', 'Only when N is large'],
        explain:
          'In this ideal slotted model, stations can all observe idle and start in the same mini-slot.',
        example:
          'For N stations, the chance exactly one attempts at an idle boundary is Np(1−p)^(N−1).',
        equation:
          'P0=(1−p)^N, P1=Np(1−p)^(N−1). ALOHA=P1. Ideal CSMA useful fraction=L·P1/[P0+L(1−P0)].',
        limits:
          'An explicitly idealized slotted carrier-sense renewal model, not the general unslotted CSMA formula. Success/collision occupies L mini-slots; sensing is instantaneous at boundaries. No hidden terminals, propagation window, capture, backoff or fairness guarantee. Final partial occupation is counted only within the horizon.',
      },
    },
    ({ stations: N, probability: p, duration: L, ticks, seed }) => {
      const formula = (p) => {
          const p0 = (1 - p) ** N,
            p1 = N * p * (1 - p) ** (N - 1);
          return { y: p1, reference: (L * p1) / (p0 + L * (1 - p0)) };
        },
        rng = random(seed),
        frames = [];
      let busy = 0,
        useful = 0,
        collisions = 0,
        success = false;
      for (let t = 0; t < ticks; t++) {
        let attempts = 0;
        if (!busy) {
          for (let i = 0; i < N; i++) attempts += +(rng() < p);
          if (attempts) {
            busy = L;
            success = attempts === 1;
            if (!success) collisions++;
          }
        }
        if (busy && success) useful++;
        frames.push({
          t,
          state: busy ? (success ? 'success' : 'collision') : 'idle',
          attempts,
          useful,
        });
        if (busy) busy--;
      }
      const f = formula(p),
        sampled = frames.filter((_, i) => i % Math.ceil(ticks / 240) === 0 || i === ticks - 1);
      return {
        summary: { aloha: f.y, csma: f.reference, observed: useful / ticks, collisions },
        series: sampled.map((row) => ({
          x: row.t,
          y: row.useful / (row.t + 1),
          reference: f.reference,
          other: f.y,
        })),
        visualization: systemVisual('channel', {}, sampled),
        table: table(
          'Channel sample (first 100 mini-slots)',
          ['Tick', 'State', 'Starts', 'Useful slots so far'],
          frames.slice(0, 100).map((f) => [f.t, f.state, f.attempts, f.useful]),
        ),
      };
    },
  ),
  distancerouting: make(
    {
      id: 'distancerouting',
      title: 'Distance-Vector Routing and Count-to-Infinity',
      topic: 'Network routing',
      inputs: {
        matrix: textInput(
          'Symmetric costs; 16 means no link',
          '[[0,1,16,16],[1,0,1,16],[16,1,0,1],[16,16,1,0]]',
          1800,
        ),
        failed: integer('Neighbor of destination 0 whose link fails', 1, 5, 1),
        rounds: integer('Rounds after failure', 4, 40, 20),
        poison: choice(
          'Split horizon',
          { off: 'Off: allow count-to-infinity', on: 'Poison reverse' },
          'off',
        ),
      },
      validateValues: checkInput('matrix', routeData),
      metrics: {
        unreachable: ['Vertices advertising infinity (excluding destination)', '1'],
        rounds: ['Failure propagation rounds', '1'],
        stale: ['Vertices still claiming a route after disconnection', '1'],
      },
      plot: {
        x: 'Synchronous update round',
        xUnit: '',
        y: 'Distance to destination 0',
        yUnit: 'hops',
        traces: { y: 'Vertex 1', reference: 'Vertex 2', other: 'Last vertex' },
        step: true,
      },
      text: {
        description:
          'Converge a distance-vector table, fail one destination link, then inspect stale advertisements and poison reverse.',
        predict: 'Why can a disconnected route keep increasing rather than disappear immediately?',
        answers: [
          'Neighbors can advertise mutually stale paths',
          'Routers know the full topology',
          'A zero distance is a timeout',
        ],
        explain:
          'A node may mistake a neighbor’s old path through itself for a new independent route.',
        example:
          'On a four-node line, failing 0–1 with poison reverse off produces count-to-infinity toward RIP’s illustrative bound 16.',
        equation:
          'Dᵢ(0)=minⱼ[cᵢⱼ+advertised Dⱼ(0)], clipped to 16. Poison reverse advertises 16 back to the selected next hop.',
        limits:
          'Synchronous discrete distance-vector rounds with immediate failed-link knowledge and deterministic ties. Infinity is 16; link costs use the same bounded metric. This is not full RIP packet, timer or convergence behavior; poison reverse does not eliminate every multi-node routing loop.',
      },
    },
    (v) => {
      const A = routeData(v),
        n = A.length;
      let distance = Array(n).fill(16),
        next = Array(n).fill(-1);
      distance[0] = 0;
      const update = (poison) => {
        const d = Array(n).fill(16),
          h = Array(n).fill(-1);
        d[0] = 0;
        for (let i = 1; i < n; i++)
          for (let j = 0; j < n; j++)
            if (A[i][j] < 16 && i !== j) {
              const cost = Math.min(16, A[i][j] + (poison && next[j] === i ? 16 : distance[j]));
              if (cost < d[i]) {
                d[i] = cost;
                h[i] = j;
              }
            }
        distance = d;
        next = h;
      };
      for (let i = 0; i < n * 2; i++) update(false);
      A[0][v.failed] = A[v.failed][0] = 16;
      const frames = [{ round: 0, distance: [...distance], next: [...next] }];
      for (let r = 1; r <= v.rounds; r++) {
        update(v.poison === 'on');
        frames.push({ round: r, distance: [...distance], next: [...next] });
      }
      const reached = new Set([0]),
        q = [0];
      for (let i = 0; i < q.length; i++)
        for (let j = 0; j < n; j++)
          if (A[q[i]][j] < 16 && !reached.has(j)) {
            reached.add(j);
            q.push(j);
          }
      return {
        summary: {
          unreachable: distance.slice(1).filter((x) => x === 16).length,
          rounds: v.rounds,
          stale: distance.filter((d, i) => !reached.has(i) && d < 16).length,
        },
        series: frames.map((f) => ({
          x: f.round,
          y: f.distance[1],
          reference: f.distance[2] ?? null,
          other: f.distance[n - 1],
        })),
        visualization: systemVisual('routing', { matrix: A }, frames),
        table: traceTable(
          'Distance-vector rounds',
          ['Round', ...Array.from({ length: n }, (_, i) => `D${i} / next hop`)],
          frames.map((f) => [f.round, ...f.distance.map((d, i) => `${d} / ${f.next[i]}`)]),
        ),
      };
    },
  ),
  cidr: make(
    {
      id: 'cidr',
      title: 'Subnetting and CIDR',
      topic: 'IP addressing',
      inputs: {
        address: textInput('IPv4 address', '192.168.10.77', 20),
        prefix: integer('Prefix length', 0, 32, 26),
      },
      validateValues: checkInput('address', (v) => ipv4(v.address)),
      metrics: {
        network: ['Network as unsigned integer', '1'],
        addresses: ['Addresses in block', '1'],
        usable: ['Usable addresses under stated convention', '1'],
        hostbits: ['Host bits', 'bits'],
      },
      plot: { x: 'Bit index (MSB first)', xUnit: '', y: 'Address bit', yUnit: '', step: true },
      text: {
        description:
          'Split a 32-bit IPv4 address into network and host fields, including /0, /31 and /32 boundary conventions.',
        predict: 'How many addresses are in an IPv4 /26 block?',
        answers: ['64', '26', '62'],
        explain:
          'There are 32−26=6 host bits, hence 2⁶=64 addresses. Traditional usable host count is 62.',
        example:
          '192.168.10.77/26 belongs to 192.168.10.64–192.168.10.127; traditional usable range is .65–.126.',
        equation: 'block=2^(32−prefix); network=floor(address/block)·block; last=network+block−1.',
        limits:
          'IPv4 only. Traditional network/broadcast exclusions apply through /30; /31 follows the two-address point-to-point convention, and /32 denotes one host route. The /0 arithmetic count does not exclude globally reserved address ranges.',
      },
    },
    ({ address, prefix }) => {
      const ip = ipv4(address),
        size = 2 ** (32 - prefix),
        network = Math.floor(ip / size) * size,
        last = network + size - 1,
        bits = Array.from({ length: 32 }, (_, i) => Math.floor(ip / 2 ** (31 - i)) % 2),
        usable = prefix >= 31 ? size : Math.max(0, size - 2);
      return {
        summary: { network, addresses: size, usable, hostbits: 32 - prefix },
        series: bits.map((y, x) => ({ x, y })),
        visualization: systemVisual('bits', { bits, prefix }),
        table: table(
          'CIDR block',
          ['Property', 'Value'],
          [
            ['Network', dotted(network)],
            ['Last address', dotted(last)],
            ['Mask', dotted(2 ** 32 - size)],
            ['First usable', dotted(prefix >= 31 ? network : network + 1)],
            ['Last usable', dotted(prefix >= 31 ? last : last - 1)],
          ],
        ),
      };
    },
  ),
  banker: make(
    {
      id: 'banker',
      title: 'Deadlock Detection and Banker’s Algorithm',
      topic: 'Concurrency & resources',
      inputs: {
        mode: choice(
          'Analysis',
          { banker: 'Banker safety analysis', detection: 'Deadlock detection' },
          'banker',
        ),
        allocation: textInput('Allocated resources by process', '[[1,0],[0,1],[1,1]]', 1200),
        claims: textInput('Maximum claims / outstanding requests', '[[2,1],[1,2],[2,2]]', 1200),
        available: textInput('Available resource vector', '[1,1]', 200),
      },
      validateValues: checkInput('claims', bankerData),
      metrics: {
        safe: ['Safe / no detected deadlock (1=yes)', '1'],
        completed: ['Processes proved finishable', '1'],
        blocked: ['Unfinished processes', '1'],
      },
      plot: {
        x: 'Safety/detection step',
        xUnit: '',
        y: 'Finishable processes',
        yUnit: '',
        step: true,
      },
      text: {
        description:
          'Explore a user-defined resource state with either maximum-claim safety analysis or outstanding-request deadlock detection.',
        predict: 'Is an unsafe Banker state necessarily deadlocked right now?',
        answers: [
          'No, unsafe means no guaranteed safe completion order',
          'Yes',
          'Only with one resource',
        ],
        explain:
          'Banker reasons about possible future maximum claims; detection reasons about current outstanding requests.',
        example:
          'Two processes holding [1,0] and [0,1], requesting [0,1] and [1,0] with no available resources form a detected deadlock.',
        equation:
          'Banker Need=Max−Allocation; find Needᵢ≤Work then Work+=Allocationᵢ. Detection substitutes current Request and initially finishes zero-allocation processes.',
        limits:
          '2–6 processes, 1–4 reusable resource types. This lab analyzes a snapshot; it does not grant a new request or simulate arbitrary process behavior. In detection mode unfinished processes are deadlocked under the supplied outstanding-request model.',
      },
    },
    (v) => {
      const a = bankerData(v),
        r = safety(a.allocation, a.claims, a.available, v.mode === 'detection'),
        frames = [
          {
            process: -1,
            work: a.available,
            finish: a.allocation.map((row) => v.mode === 'detection' && row.every((x) => x === 0)),
          },
          ...r.frames,
        ];
      return {
        summary: {
          safe: +r.safe,
          completed: frames.at(-1).finish.filter(Boolean).length,
          blocked: r.unfinished.length,
        },
        series: frames.map((f, x) => ({ x, y: f.finish.filter(Boolean).length })),
        visualization: systemVisual(
          'resources',
          { allocation: a.allocation, claims: a.claims },
          frames,
        ),
        table: traceTable(
          'Completion proof steps',
          ['Step', 'Process completed', 'Work vector', 'Finished flags'],
          frames.map((f, i) => [i, f.process, f.work.join(','), f.finish.map(Number).join(',')]),
        ),
        warnings: !r.safe
          ? [
              v.mode === 'banker'
                ? 'Unsafe state: no safe order for the maximum claims. This alone is not proof of current deadlock.'
                : `Detected deadlocked processes: ${r.unfinished.join(', ')}.`,
            ]
          : [],
      };
    },
  ),
  diskscheduling: make(
    {
      id: 'diskscheduling',
      title: 'Disk Scheduling: FCFS, SCAN and C-SCAN',
      topic: 'Storage scheduling',
      inputs: {
        requests: textInput('Requested cylinders', '98,183,37,122,14,124,65,67', 250),
        head: integer('Initial head cylinder', 0, 199, 53),
        direction: choice('Initial sweep', { up: 'Toward 199', down: 'Toward 0' }, 'up'),
      },
      validateValues: checkInput('requests', (v) => numberList(v.requests, 0, 199, 24)),
      metrics: {
        fcfs: ['FCFS head travel', 'cylinders'],
        scan: ['SCAN head travel', 'cylinders'],
        cscan: ['C-SCAN head travel (wrap included)', 'cylinders'],
      },
      plot: {
        x: 'Visit step',
        xUnit: '',
        y: 'Cylinder position',
        yUnit: 'cylinders',
        traces: { y: 'FCFS', reference: 'SCAN', other: 'C-SCAN' },
      },
      text: {
        description:
          'Reorder the same disk requests and count actual head motion, including sweep endpoints and circular wrap.',
        predict: 'Does the C-SCAN wrap from one end to the other cost zero physical head movement?',
        answers: ['No, this lab includes that travel', 'Yes', 'Only with duplicate requests'],
        explain: 'An instantaneous logical wrap would understate physical seek distance.',
        example: 'From head 53, the classic request list has FCFS travel 640 cylinders.',
        equation:
          'Travel=Σ|cylinderᵢ₊₁−cylinderᵢ|. SCAN reverses at an endpoint; C-SCAN wraps and keeps its sweep direction.',
        limits:
          'Cylinders 0–199, up to 24 requests, all available initially. The sweep stops once all requests are served, and visits an endpoint only when an opposite-side request remains. Travel is not a calibrated mechanical seek-time model.',
      },
    },
    ({ requests, head, direction }) => {
      const a = numberList(requests, 0, 199, 24),
        paths = ['fcfs', 'scan', 'cscan'].map((method) => diskPath(a, head, method, direction)),
        travel = (a) => a.slice(1).reduce((s, v, i) => s + Math.abs(v - a[i]), 0),
        length = Math.max(...paths.map((a) => a.length)),
        frames = Array.from({ length }, (_, i) => ({
          step: i,
          positions: paths.map((a) => a[Math.min(i, a.length - 1)]),
        }));
      return {
        summary: { fcfs: travel(paths[0]), scan: travel(paths[1]), cscan: travel(paths[2]) },
        series: frames.map((f) => ({
          x: f.step,
          y: f.positions[0],
          reference: f.positions[1],
          other: f.positions[2],
        })),
        visualization: systemVisual('disk', {}, frames),
        table: traceTable(
          'Head visits, including endpoints',
          ['Step', 'FCFS', 'SCAN', 'C-SCAN'],
          frames.map((f) => [f.step, ...f.positions]),
        ),
      };
    },
  ),
  producerconsumer: make(
    {
      id: 'producerconsumer',
      title: 'Producer–Consumer with Semaphores',
      topic: 'Concurrency & resources',
      inputs: {
        capacity: integer('Buffer capacity', 1, 8, 3),
        schedule: textInput(
          'Instruction schedule: P or C per tick',
          'PPPPPCCCCCPCPCPCPCPCPPPPPPCCCCCC',
          150,
        ),
      },
      validateValues: checkInput('schedule', (v) => {
        if (!/^[PC]{1,100}$/.test(v.schedule))
          throw Error('Use 1–100 P/C characters; each schedules one instruction.');
      }),
      metrics: {
        produced: ['Items produced', '1'],
        consumed: ['Items consumed', '1'],
        buffered: ['Items currently in buffer', '1'],
        blocked: ['Blocked actors at endpoint', '1'],
      },
      plot: {
        x: 'Scheduled instruction',
        xUnit: '',
        y: 'Buffer occupancy',
        yUnit: 'items',
        step: true,
      },
      text: {
        description:
          'Step one producer and consumer through counting-semaphore waits, mutex ownership and resource publication.',
        predict: 'Can empty+full temporarily differ from buffer capacity during an operation?',
        answers: [
          'Yes, a thread can reserve a permit before publishing its item',
          'No',
          'Only with broken mutual exclusion',
        ],
        explain:
          'The canonical operation reserves an empty/full permit before acquiring the mutex and changing the buffer.',
        example:
          'PPPPP executes one full producer operation: wait(empty), wait(mutex), write, signal(mutex), signal(full).',
        equation:
          'Producer: P(empty),P(mutex),put,V(mutex),V(full). Consumer swaps empty/full and takes an item. produced−consumed=buffer size.',
        limits:
          'One producer and one consumer, one atomic instruction per scheduled character; blocked threads do not run. Signals wake FIFO waiters and transfer a reserved permit. A finite unfair schedule may starve an actor; no real OS threads or timing are executed.',
      },
    },
    ({ schedule, capacity }) => {
      const r = semaphoreTrace(schedule, capacity);
      return {
        summary: {
          produced: r.produced,
          consumed: r.consumed,
          buffered: r.buffer.length,
          blocked: +r.frames.at(-1).blockedP + +r.frames.at(-1).blockedC,
        },
        series: r.frames.map((f, x) => ({ x, y: f.buffer.length })),
        visualization: systemVisual('semaphores', { capacity }, r.frames),
        table: traceTable(
          'Atomic semaphore steps',
          ['Tick', 'Action', 'Buffer', 'empty/full/mutex'],
          r.frames.map((f) => [
            f.t,
            f.event,
            f.buffer.join(','),
            `${f.sem.empty}/${f.sem.full}/${f.sem.mutex}`,
          ]),
        ),
      };
    },
  ),
  virtualmemory: make(
    {
      id: 'virtualmemory',
      title: 'Virtual Memory: TLB and Two-Level Page Tables',
      topic: 'Virtual memory',
      inputs: {
        addresses: textInput('Virtual byte addresses', '0,4,256,512,0,768,1024,256', 300),
        frames: integer('Physical frames', 2, 16, 4),
        tlb: integer('TLB entries', 1, 8, 2),
      },
      validateValues: checkInput('addresses', (v) => numberList(v.addresses, 0, 65535, 40)),
      metrics: {
        hits: ['TLB hits', '1'],
        faults: ['Demand page faults', '1'],
        latency: ['Average illustrative access time', 'ns'],
        bytes: ['Allocated page-table bytes', 'bytes'],
      },
      plot: {
        x: 'Memory reference',
        xUnit: '',
        y: 'Physical byte address',
        yUnit: 'bytes',
        traces: { y: 'Translated address', reference: 'Virtual address' },
      },
      text: {
        description:
          'Translate 16-bit addresses through an LRU TLB and a demand-paged two-level address space, invalidating stale translations on eviction.',
        predict: 'What must happen to a TLB entry when its page is evicted?',
        answers: [
          'Invalidate it',
          'Keep using the old physical frame',
          'Only change the page offset',
        ],
        explain:
          'The old mapping would otherwise point to a frame now owned by another virtual page.',
        example:
          'A 16-bit address uses a 4-bit directory index, 4-bit table index and 8-bit page offset; page size is 256 bytes.',
        equation:
          'VPN=floor(VA/256); L1=VPN>>4; L2=VPN mod 16; PA=frame·256+offset. TLB hit cost=10+100 ns; miss=10+3×100 ns; fault adds 100000 ns.',
        limits:
          'Illustrative fixed latencies, 4-byte PTEs, 16-entry directory and lower tables allocated on first walk. Frame replacement and TLB replacement are LRU; lower tables persist once allocated. No dirty-page writeback, ASIDs, permissions, huge pages or overlap of I/O.',
      },
    },
    ({ addresses, frames, tlb }) => {
      const r = memoryTrace(numberList(addresses, 0, 65535, 40), frames, tlb);
      return {
        summary: { hits: r.hits, faults: r.faults, latency: r.average, bytes: r.tableBytes },
        series: r.frames.map((f) => ({ x: f.index, y: f.physical, reference: f.address })),
        visualization: systemVisual('memory', {}, r.frames),
        table: traceTable(
          'Address translations',
          ['Reference', 'VA', 'L1/L2/offset', 'PA', 'TLB hit', 'Page fault', 'Latency ns'],
          r.frames.map((f) => [
            f.index,
            f.address,
            `${f.l1}/${f.l2}/${f.offset}`,
            f.physical,
            f.hit ? 'yes' : 'no',
            f.fault ? 'yes' : 'no',
            f.latency,
          ]),
        ),
      };
    },
  ),
  cpuscheduling: make(
    {
      id: 'cpuscheduling',
      title: 'CPU Scheduling: SJF, Priority and MLFQ',
      topic: 'CPU scheduling',
      inputs: {
        jobs: textInput(
          'Jobs [[arrival,burst,priority],…]',
          '[[0,6,2],[1,2,1],[2,4,3],[4,1,0]]',
          1200,
        ),
        method: choice(
          'Scheduler',
          {
            sjf: 'Nonpreemptive SJF',
            priority: 'Nonpreemptive priority (smaller is higher)',
            mlfq: 'Preemptive MLFQ: quanta 1,2,4',
          },
          'mlfq',
        ),
        boost: integer('MLFQ priority-boost interval', 4, 30, 12),
      },
      validateValues: checkInput('jobs', (v) => {
        const a = jsonNumbers(v.jobs, 1, 8, 3, 3, 0, 50);
        if (
          a.flat().some((x) => !Number.isInteger(x)) ||
          a.some((r) => r[1] < 1 || r[1] > 20 || r[0] > 30)
        )
          throw Error('Jobs need integer arrival 0–30, burst 1–20 and priority 0–50.');
      }),
      metrics: {
        waiting: ['Mean waiting time', 'ticks'],
        turnaround: ['Mean turnaround time', 'ticks'],
        utilization: ['CPU utilization', '1'],
      },
      plot: {
        x: 'Time',
        xUnit: 'ticks',
        y: 'Running process ID (idle = −1)',
        yUnit: '',
        step: true,
      },
      text: {
        description:
          'Schedule editable arriving jobs and compare nonpreemptive policies with a three-level feedback queue.',
        predict: 'Can a newly arrived top-queue job preempt a lower-level MLFQ job?',
        answers: ['Yes', 'No, MLFQ is nonpreemptive', 'Only if its burst is shorter'],
        explain:
          'This MLFQ policy always runs the highest ready queue and preserves a preempted job’s remaining quantum.',
        example:
          'With jobs [0,3,1] and [0,1,2], SJF runs the one-tick job first, giving mean waiting time 0.5.',
        equation:
          'Turnaround=finish−arrival; waiting=turnaround−CPU burst. MLFQ demotes after a whole quantum; periodic boosts reset ready/running jobs to level zero.',
        limits:
          'Single CPU, integer ticks, no I/O, context-switch overhead or multicore execution. SJF and priority are nonpreemptive; ties use arrival then input order. MLFQ has FIFO queues, quanta 1/2/4, immediate higher-queue preemption and a user-set global boost interval.',
      },
    },
    ({ jobs, method, boost }) => {
      const r = scheduleCPU(jsonNumbers(jobs, 1, 8, 3, 3, 0, 50), method, boost);
      return {
        summary: { waiting: r.waiting, turnaround: r.turnaround, utilization: r.utilization },
        series: r.frames.map((f) => ({ x: f.time, y: f.running ?? -1 })),
        visualization: systemVisual('cpu', { jobs: r.jobs }, r.frames),
        table: table(
          'Job completion results',
          ['ID', 'Arrival', 'Burst', 'Finish', 'Waiting', 'Turnaround'],
          r.jobs.map((p) => [
            p.id,
            p.arrival,
            p.burst,
            p.finish,
            p.finish - p.arrival - p.burst,
            p.finish - p.arrival,
          ]),
        ),
      };
    },
  ),
};

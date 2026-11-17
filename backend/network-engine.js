/** Discrete channel: one data send per tick, one-tick propagation each way, fixed RTO=5 ticks.
 * Only the first transmission of configured packet IDs is dropped; ACKs never drop. */
export function arq(protocol, N, W, lost) {
  const dropped = new Set(lost),
    attempts = Array(N).fill(0),
    acked = Array(N).fill(false),
    sentAt = Array(N).fill(-1),
    receiver = new Set(),
    events = [],
    frames = [];
  let expected = 0,
    next = 0,
    base = 0,
    tx = 0;
  const retry = [];
  for (let t = 0; t < 1500; t++) {
    for (const event of events.filter((e) => e.time === t)) {
      if (event.type === 'data') {
        if (protocol === 'sr') {
          receiver.add(event.packet);
          while (receiver.has(expected)) expected++;
          events.push({ time: t + 1, type: 'ack', packet: event.packet });
        } else {
          if (event.packet === expected) expected++;
          events.push({ time: t + 1, type: 'ack', packet: expected - 1 });
        }
      } else {
        if (protocol === 'sr') acked[event.packet] = true;
        else for (let p = 0; p <= event.packet; p++) acked[p] = true;
        while (base < N && acked[base]) base++;
      }
    }
    if (base === N) {
      frames.push({
        t,
        delivered: expected,
        base,
        next,
        packet: null,
        event: 'All packets acknowledged',
        buffer: [...receiver].filter((p) => p >= expected),
      });
      return { frames, transmissions: tx, time: t, delivered: expected, attempts };
    }
    if (protocol === 'gbn' && sentAt[base] >= 0 && t - sentAt[base] >= 5) {
      for (let p = base; p < next; p++) if (!acked[p] && !retry.includes(p)) retry.push(p);
      for (let p = base; p < next; p++) sentAt[p] = t;
    }
    if (protocol === 'sr')
      for (let p = base; p < next; p++)
        if (!acked[p] && sentAt[p] >= 0 && t - sentAt[p] >= 5 && !retry.includes(p)) retry.push(p);
    while (retry.length && acked[retry[0]]) retry.shift();
    let packet = null;
    if (retry.length) packet = retry.shift();
    else if (next < N && next < base + W) packet = next++;
    let message = 'Wait for ACK / receiver';
    if (packet !== null) {
      sentAt[packet] = t;
      attempts[packet]++;
      tx++;
      const drop = dropped.has(packet) && attempts[packet] === 1;
      if (!drop) events.push({ time: t + 1, type: 'data', packet });
      message = `Send ${packet}, attempt ${attempts[packet]}${drop ? ' — dropped once' : ''}`;
    }
    frames.push({
      t,
      delivered: expected,
      base,
      next,
      packet,
      event: message,
      buffer: [...receiver].filter((p) => p >= expected),
    });
  }
  throw Error('ARQ event cap exceeded.');
}
export function ipv4(source) {
  if (typeof source !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(source))
    throw Error('Use four decimal octets.');
  const octets = source.split('.').map(Number);
  if (octets.some((v) => v > 255)) throw Error('IPv4 octets must be 0–255.');
  return octets.reduce((s, v) => s * 256 + v, 0);
}
export const dotted = (value) =>
  [24, 16, 8, 0].map((s) => Math.floor(value / 2 ** s) % 256).join('.');
export function safety(allocation, claims, available, detection = false) {
  const n = allocation.length,
    m = available.length,
    work = [...available],
    finish = allocation.map((row) => detection && row.every((v) => v === 0)),
    sequence = [],
    frames = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++)
      if (
        !finish[i] &&
        claims[i].every((v, j) => (detection ? v : v - allocation[i][j]) <= work[j])
      ) {
        finish[i] = true;
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        sequence.push(i);
        frames.push({ process: i, work: [...work], finish: [...finish] });
        progress = true;
      }
  }
  return {
    safe: finish.every(Boolean),
    sequence,
    unfinished: finish.flatMap((v, i) => (v ? [] : [i])),
    work,
    frames,
  };
}
export function diskPath(requests, head, method, direction = 'up') {
  if (method === 'fcfs') return [head, ...requests];
  const sign = direction === 'up' ? 1 : -1,
    a = requests.filter((v) => sign * (v - head) >= 0).sort((a, b) => sign * (a - b)),
    b = requests.filter((v) => sign * (v - head) < 0).sort((a, b) => sign * (a - b)),
    end = direction === 'up' ? 199 : 0,
    other = 199 - end;
  if (!b.length) return [head, ...a];
  return method === 'scan' ? [head, ...a, end, ...b.reverse()] : [head, ...a, end, other, ...b];
}
export function semaphoreTrace(schedule, capacity) {
  const sem = { empty: capacity, full: 0, mutex: 1 },
    waiters = { empty: [], full: [], mutex: [] },
    P = { pc: 0, blocked: false },
    C = { pc: 0, blocked: false },
    actors = { P, C },
    buffer = [],
    frames = [];
  let produced = 0,
    consumed = 0;
  const wait = (name, actor) => {
      if (sem[name] > 0) {
        sem[name]--;
        actors[actor].pc++;
        return true;
      }
      waiters[name].push(actor);
      actors[actor].blocked = true;
      return false;
    },
    signal = (name) => {
      const a = waiters[name].shift();
      if (a) {
        actors[a].blocked = false;
        actors[a].pc++;
      } else sem[name]++;
    };
  for (let i = 0; i < schedule.length; i++) {
    const actor = schedule[i],
      a = actors[actor],
      pc = a.pc;
    let event;
    if (a.blocked) event = `${actor} is blocked; no instruction executes`;
    else if (pc === 0 || pc === 1) {
      const name = pc === 1 ? 'mutex' : actor === 'P' ? 'empty' : 'full';
      event = `${actor}: wait(${name}) ${wait(name, actor) ? 'acquired' : 'blocked'}`;
    } else if (pc === 2) {
      if (actor === 'P') {
        buffer.push(++produced);
        event = `Produce item ${produced}`;
      } else {
        event = `Consume item ${buffer.shift()}`;
        consumed++;
      }
      a.pc++;
    } else if (pc === 3) {
      signal('mutex');
      a.pc++;
      event = `${actor}: signal(mutex)`;
    } else {
      signal(actor === 'P' ? 'full' : 'empty');
      a.pc = 0;
      event = `${actor}: publish ${actor === 'P' ? 'full' : 'empty'} permit`;
    }
    if (buffer.length < 0 || buffer.length > capacity || produced - consumed !== buffer.length)
      throw Error('Semaphore buffer invariant failed.');
    frames.push({
      t: i,
      actor,
      event,
      buffer: [...buffer],
      sem: { ...sem },
      producerPC: P.pc,
      consumerPC: C.pc,
      blockedP: P.blocked,
      blockedC: C.blocked,
      produced,
      consumed,
    });
  }
  return { frames, produced, consumed, buffer };
}
export function memoryTrace(addresses, frameCount, tlbSize) {
  const resident = new Map(),
    tlb = new Map(),
    directories = new Set(),
    frames = [];
  let hits = 0,
    faults = 0,
    totalTime = 0;
  const touch = (map, k, v) => {
    map.delete(k);
    map.set(k, v);
  };
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i],
      vpn = Math.floor(address / 256),
      offset = address % 256,
      hit = tlb.has(vpn);
    let fault = false,
      physicalFrame;
    if (hit) {
      hits++;
      physicalFrame = tlb.get(vpn);
      touch(tlb, vpn, physicalFrame);
      touch(resident, vpn, physicalFrame);
    } else {
      directories.add(Math.floor(vpn / 16));
      if (!resident.has(vpn)) {
        fault = true;
        faults++;
        if (resident.size === frameCount) {
          const [victim, slot] = resident.entries().next().value;
          resident.delete(victim);
          tlb.delete(victim);
          physicalFrame = slot;
        } else physicalFrame = resident.size;
        resident.set(vpn, physicalFrame);
      } else {
        physicalFrame = resident.get(vpn);
        touch(resident, vpn, physicalFrame);
      }
      touch(tlb, vpn, physicalFrame);
      if (tlb.size > tlbSize) tlb.delete(tlb.keys().next().value);
    }
    const latency = 10 + (hit ? 100 : 300) + (fault ? 100000 : 0);
    totalTime += latency;
    frames.push({
      index: i,
      address,
      vpn,
      offset,
      l1: Math.floor(vpn / 16),
      l2: vpn % 16,
      physical: physicalFrame * 256 + offset,
      hit,
      fault,
      latency,
      tlb: [...tlb],
      resident: [...resident],
    });
  }
  return {
    frames,
    hits,
    faults,
    average: totalTime / addresses.length,
    tableBytes: 64 + directories.size * 64,
  };
}
export function scheduleCPU(jobs, method, boost = 12) {
  const state = jobs.map((p, i) => ({
      id: i,
      arrival: p[0],
      burst: p[1],
      priority: p[2],
      remaining: p[1],
      level: 0,
      quantum: 0,
      finish: null,
    })),
    queues = [[], [], []],
    frames = [];
  let time = 0,
    done = 0,
    current = null;
  const quantum = [1, 2, 4];
  while (done < state.length && time < 2000) {
    for (const p of state)
      if (p.arrival === time) {
        queues[0].push(p.id);
        p.level = 0;
      }
    if (method === 'mlfq' && time && time % boost === 0) {
      const ready = queues.flat();
      queues.forEach((q) => q.splice(0));
      if (current !== null) {
        ready.push(current);
        current = null;
      }
      for (const id of ready) {
        state[id].level = 0;
        state[id].quantum = 0;
        queues[0].push(id);
      }
    }
    if (method === 'mlfq') {
      if (current !== null && queues.some((q, l) => l < state[current].level && q.length)) {
        queues[state[current].level].unshift(current);
        current = null;
      }
      if (current === null) {
        const q = queues.find((q) => q.length);
        if (q) {
          current = q.shift();
          const p = state[current];
          if (p.quantum === 0) p.quantum = quantum[p.level];
        }
      }
    } else if (current === null) {
      const ready = state
        .filter((p) => p.arrival <= time && p.remaining > 0)
        .sort((a, b) =>
          method === 'sjf'
            ? a.burst - b.burst || a.arrival - b.arrival || a.id - b.id
            : a.priority - b.priority || a.arrival - b.arrival || a.id - b.id,
        );
      if (ready.length) current = ready[0].id;
    }
    const running = current;
    if (current !== null) {
      const p = state[current];
      p.remaining--;
      if (method === 'mlfq') p.quantum--;
      if (p.remaining === 0) {
        p.finish = time + 1;
        done++;
        current = null;
      } else if (method === 'mlfq' && p.quantum === 0) {
        p.level = Math.min(2, p.level + 1);
        queues[p.level].push(current);
        current = null;
      }
    }
    frames.push({
      time,
      running,
      remaining: state.map((p) => p.remaining),
      queues: queues.map((q) => [...q]),
    });
    time++;
  }
  if (done !== state.length) throw Error('CPU schedule exceeded its bounded horizon.');
  return {
    frames,
    jobs: state,
    waiting: state.reduce((s, p) => s + p.finish - p.arrival - p.burst, 0) / state.length,
    turnaround: state.reduce((s, p) => s + p.finish - p.arrival, 0) / state.length,
    utilization: state.reduce((s, p) => s + p.burst, 0) / time,
  };
}

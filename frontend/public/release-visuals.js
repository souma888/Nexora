import { escapeHtml } from '../../backend/html.js';
const f = (v) =>
  typeof v === 'number'
    ? Number.isFinite(v)
      ? Number(v.toPrecision(5)).toString()
      : '—'
    : String(v ?? '—');
const text = (x, y, value, color = 'var(--text)', anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:${color};font-size:13px">${escapeHtml(f(value))}</text>`;
const path = (d, color = 'var(--curve)', width = 2) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
const line = (x, y, a, b, color = 'var(--curve)') => path(`M${x} ${y}L${a} ${b}`, color);
const circle = (x, y, r, color = 'var(--curve)', fill = 'var(--surface-1)') =>
  `<circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" fill="${fill}" stroke-width="2"/>`;
const box = (x, y, w, h, label, color = 'var(--curve)') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="var(--surface-2)" stroke="${color}"/>${text(x + w / 2, y + h / 2 + 5, label, color)}`;
const spring = (a, b, y) =>
  path(
    `M${a} ${y}L${a + 10} ${y}` +
      Array.from(
        { length: 12 },
        (_, i) => `L${a + 10 + ((b - a - 20) * (i + 1)) / 12} ${y + (i % 2 ? 8 : -8)}`,
      ).join('') +
      `L${b} ${y}`,
  );
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function releaseVisual(v, index) {
  const frame = v.frames?.[Math.min(index, v.frames.length - 1)] ?? {},
    phase = frame.phase ?? 0;
  let drawing = '',
    height = 300;
  if (v.kind === 'spring' || v.kind === 'absorber') {
    const shift = clamp(
        (frame.displacement ?? v.amplitude ?? frame.primary ?? 0) * (v.modal ? 35 : 1),
        -35,
        35,
      ),
      x = 235 + shift;
    drawing =
      path('M65 65V220M55 75l10-10m-10 25 10-10m-10 25 10-10m-10 25 10-10m-10 25 10-10') +
      spring(65, x, 140) +
      box(x, 105, 80, 70, `${f(v.mass ?? v.mass1)} kg`, 'var(--result)') +
      line(65, 220, 460, 220, 'var(--border)');
    if (v.kind === 'absorber') {
      const x2 = 400 + clamp((frame.absorber ?? 0) * (v.modal ? 35 : 1), -30, 30);
      drawing += spring(x + 80, x2, 140) + box(x2, 112, 60, 56, `${f(v.mass2)} kg`);
    }
    drawing += text(
      260,
      260,
      v.modal
        ? `Mode ${frame.mode}; components ${f(frame.primary)}, ${f(frame.absorber)} (relative)`
        : `Displacement / amplitude ${f(frame.displacement ?? frame.primary ?? v.amplitude)} mm`,
    );
  } else if (v.kind === 'rotor') {
    const angle = phase,
      r = 65,
      x = 260,
      y = 140;
    drawing =
      circle(x, y, r) +
      circle(x, y, 6, 'var(--result)') +
      line(x, y, x + r * 0.75 * Math.cos(angle), y - r * 0.75 * Math.sin(angle), 'var(--load)') +
      circle(x + r * 0.75 * Math.cos(angle), y - r * 0.75 * Math.sin(angle), 9, 'var(--load)') +
      path('M140 220h240M190 220v-40m140 40v-40');
    drawing += text(
      260,
      260,
      `Speed ${f(frame.speed ?? v.speed)} rpm · response ${f(frame.displacement)} mm`,
    );
  } else if (v.kind === 'gears' || v.kind === 'planet') {
    if (v.kind === 'planet') {
      const ring = 90,
        sun = (ring * v.teeth1) / v.ring,
        planet = (ring - sun) / 2;
      drawing =
        circle(260, 145, ring, 'var(--result)') +
        circle(260, 145, sun) +
        circle(260 + sun + planet, 145, planet, 'var(--load)') +
        line(260, 145, 260 + sun + planet, 145, 'var(--muted)') +
        text(260, 35, `Ring ${v.ring} · sun ${v.teeth1} · planet ${v.teeth2}`);
    } else {
      const scale = 135 / (v.teeth1 + v.teeth2),
        r1 = v.teeth1 * scale,
        r2 = v.teeth2 * scale,
        c1 = 260 - r2,
        c2 = 260 + r1;
      drawing =
        circle(c1, 145, r1) +
        circle(c2, 145, r2, 'var(--result)') +
        circle(c1, 145, 5) +
        circle(c2, 145, 5, 'var(--result)') +
        line(c1, 145, c1 + r1 * 0.8, 145, 'var(--load)') +
        text(c1, 145 + r1 + 25, `${v.teeth1} teeth`) +
        text(c2, 145 + r2 + 25, `${v.teeth2} teeth`);
    }
    drawing += text(
      260,
      280,
      'Pitch-circle schematic; tooth profiles are not manufactured geometry.',
      'var(--muted)',
    );
  } else if (v.kind === 'belt') {
    drawing =
      circle(150, 150, 65) +
      circle(370, 150, 45, 'var(--result)') +
      path('M150 85L370 105M150 215L370 195', 'var(--load)', 3) +
      text(260, 65, `Tight side ${f(v.tight)} N`) +
      text(260, 250, `Slack side ${f(v.slack)} N`) +
      circle(150, 150, 6) +
      circle(370, 150, 6, 'var(--result)');
  } else if (v.kind === 'bolt') {
    drawing =
      box(125, 100, 270, 45, 'Upper member', 'var(--muted)') +
      box(125, 150, 270, 45, 'Lower member', 'var(--muted)') +
      box(240, 65, 40, 165, '', 'var(--curve)') +
      box(220, 50, 80, 22, '', 'var(--curve)') +
      box(220, 225, 80, 22, '', 'var(--curve)') +
      text(115, 80, `Clamp ${f(v.clamp)} kN`, 'var(--result)') +
      text(390, 80, `Bolt ${f(v.boltforce)} kN`, 'var(--load)') +
      text(260, 280, `External load ${f(v.external)} kN`);
  } else if (v.kind === 'rolling-bearing') {
    drawing =
      circle(260, 140, 98, 'var(--muted)') +
      circle(260, 140, 90) +
      circle(260, 140, 60) +
      circle(260, 140, 52, 'var(--muted)') +
      Array.from({ length: 10 }, (_, i) =>
        circle(
          260 + 75 * Math.cos((i * Math.PI) / 5),
          140 + 75 * Math.sin((i * Math.PI) / 5),
          14,
          'var(--result)',
        ),
      ).join('') +
      text(
        260,
        270,
        'Rolling-bearing schematic; rating life does not model this geometry.',
        'var(--muted)',
      );
  } else if (v.kind === 'bearing') {
    drawing =
      circle(260, 145, 90, 'var(--muted)') +
      circle(260, 145, 72) +
      circle(260, 145, 5) +
      line(260, 25, 260, 65, 'var(--load)') +
      path('M254 56l6 9 6-9', 'var(--load)') +
      text(260, 260, 'Concentric thin-film schematic; clearance is exaggerated.', 'var(--muted)');
  } else if (v.kind === 'cam') {
    const y = 145 - clamp(frame.displacement ?? 0, 0, 50);
    drawing =
      circle(220, 165, 65) +
      circle(220 + 15 * Math.cos(phase), 165 - 15 * Math.sin(phase), 5, 'var(--load)') +
      box(205, y - 95, 30, 60, '', 'var(--result)') +
      circle(220, y - 25, 12, 'var(--result)') +
      path('M178 45v55m84-55v55', 'var(--muted)') +
      text(380, 125, `θ ${f(frame.angle)}°`) +
      text(380, 155, `Lift ${f(frame.displacement)} mm`) +
      text(
        260,
        280,
        'Follower-motion schematic; the displayed circle is not a computed cam contour.',
        'var(--muted)',
      );
  } else if (v.kind === 'slider') {
    const s = 350 / (v.rod + 2 * v.radius),
      x0 = 65,
      y0 = 145,
      pin = frame.pin ?? [v.radius, 0],
      px = x0 + pin[0] * s,
      py = y0 - pin[1] * s,
      piston = x0 + (frame.piston ?? v.rod + v.radius) * s;
    drawing =
      circle(x0, y0, v.radius * s, 'var(--muted)') +
      line(x0, y0, px, py, 'var(--load)') +
      line(px, py, piston, y0, 'var(--result)') +
      circle(px, py, 5) +
      box(piston - 18, y0 - 23, 36, 46, '') +
      path(
        `M${x0 + (v.rod - v.radius) * s - 25} 113H470M${x0 + (v.rod - v.radius) * s - 25} 177H470`,
        'var(--border)',
      ) +
      text(260, 265, `θ ${f(frame.angle)}° · travel ${f(frame.displacement)} mm`);
  } else if (v.kind === 'clutch') {
    drawing =
      circle(210, 145, 85) +
      circle(210, 145, (85 * v.inner) / v.outer, 'var(--muted)') +
      line(210, 145, 295, 145, 'var(--load)') +
      text(270, 130, 'Ro') +
      text(375, 145, `${f(v.torque)} N·m`) +
      text(260, 270, `${v.surfaces} active friction interfaces`);
  } else if (v.kind === 'shaft') {
    drawing =
      box(95, 115, 330, 55, 'Solid circular shaft') +
      circle(425, 142, 27, 'var(--result)') +
      path('M75 70v40m-6-8 6 8 6-8M430 95q55 45 0 90', 'var(--load)') +
      text(160, 65, `M ${f(v.bending)} N·m`) +
      text(385, 240, `T ${f(v.torque)} N·m`) +
      text(260, 280, 'Nominal stress schematic; deflection is not calculated.', 'var(--muted)');
  } else if (v.kind === 'contact') {
    drawing =
      path('M130 150a130 130 0 0 1 260 0') +
      line(100, 160, 420, 160, 'var(--muted)') +
      line(240, 157, 280, 157, 'var(--load)') +
      line(260, 35, 260, 85, 'var(--load)') +
      text(260, 220, `Patch radius ${f(v.patch)} mm`) +
      text(
        260,
        255,
        'Contact patch exaggerated; frictionless elastic normal contact.',
        'var(--muted)',
      );
  } else if (v.kind === 'balance') {
    const peak = Math.max(1, Math.hypot(...v.A), Math.hypot(...v.B)),
      s = 75 / peak;
    drawing = line(95, 150, 425, 150, 'var(--muted)');
    for (const [x, U, name] of [
      [150, v.A, 'Plane A'],
      [370, v.B, 'Plane B'],
    ])
      drawing +=
        line(x, 60, x, 235, 'var(--border)') +
        line(x, 150, x + U[0] * s, 150 - U[1] * s, 'var(--result)') +
        circle(x + U[0] * s, 150 - U[1] * s, 5, 'var(--result)') +
        text(x, 260, name);
    drawing += text(260, 40, `Correction-plane separation ${f(v.spacing)} mm`);
  } else if (v.kind === 'incline') {
    const a = (v.angle * Math.PI) / 180,
      length = Math.min(390, 140 / Math.sin(a)),
      last = v.frames.at(-1)?.distance || 1,
      travel = v.valid ? 25 + (length * 0.65 * (frame.distance ?? 0)) / last : 25,
      x = 60 + travel * Math.cos(a) + 22 * Math.sin(a),
      y = 90 + travel * Math.sin(a) - 22 * Math.cos(a);
    drawing =
      line(60, 90, 60 + length * Math.cos(a), 90 + length * Math.sin(a), 'var(--muted)') +
      circle(x, y, 22, 'var(--result)') +
      line(x, y, x + 18 * Math.cos(phase), y - 18 * Math.sin(phase), 'var(--load)') +
      text(
        260,
        270,
        v.valid
          ? `No-slip distance ${f(frame.distance)} m`
          : 'Insufficient static friction: no valid no-slip trajectory.',
      );
  } else if (v.kind === 'collision') {
    const t = frame.time ?? 0,
      left = 200 + clamp((frame.left ?? 0) * 35, -140, 140),
      right = 244 + clamp((frame.right ?? 0) * 35, -140, 140);
    drawing =
      line(40, 185, 480, 185, 'var(--muted)') +
      circle(left, 160, 22, 'var(--curve)') +
      circle(right, 160, 22, 'var(--result)') +
      text(left, 120, `${v.mass1} kg`) +
      text(right, 215, `${v.mass2} kg`) +
      text(260, 45, `Time relative to contact ${f(t)} s`) +
      text(260, 260, `v1 ${f(frame.velocity1)} · v2 ${f(frame.velocity2)} m/s`);
  } else if (v.kind === 'tcp') {
    drawing =
      box(35, 85, 120, 65, 'SENDER') +
      box(365, 85, 120, 65, 'RECEIVER', 'var(--result)') +
      line(155, 115, 365, 115) +
      path('M355 109l10 6-10 6') +
      text(260, 65, `cwnd ${f(frame.window)} segments`) +
      text(260, 195, `ssthresh ${f(frame.threshold)} segments`) +
      text(260, 240, frame.event);
  } else if (v.kind === 'arq') {
    for (const [name, f, y] of [
      ['GBN', frame.gbn, 80],
      ['SR', frame.sr, 165],
    ]) {
      drawing += text(45, y, name);
      for (let i = 0; i < v.packets; i++) {
        const width = 420 / v.packets,
          color =
            i < f.delivered ? 'var(--result)' : i === f.packet ? 'var(--load)' : 'var(--muted)';
        drawing += box(80 + i * width, y - 20, width - 2, 32, i, color);
      }
      drawing += text(270, y + 40, `base ${f.base} · next ${f.next} · delivered ${f.delivered}`);
    }
    drawing += text(260, 270, `Tick ${frame.t}; green means delivered in order.`);
  } else if (v.kind === 'channel') {
    drawing =
      box(
        70,
        90,
        380,
        80,
        String(frame.state ?? 'idle').toUpperCase(),
        frame.state === 'collision'
          ? 'var(--brand)'
          : frame.state === 'success'
            ? 'var(--result)'
            : 'var(--muted)',
      ) +
      text(260, 210, `Mini-slot ${f(frame.t)} · simultaneous starts ${f(frame.attempts)}`) +
      text(260, 245, `Useful occupied mini-slots so far: ${f(frame.useful)}`);
  } else if (v.kind === 'routing') {
    const A = v.matrix,
      n = A.length,
      pos = (i) => [
        260 + 105 * Math.cos((2 * Math.PI * i) / n),
        140 + 65 * Math.sin((2 * Math.PI * i) / n),
      ];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (A[i][j] < 16) {
          const [x, y] = pos(i),
            [a, b] = pos(j);
          drawing +=
            line(x, y, a, b, 'var(--border)') + text((x + a) / 2, (y + b) / 2 - 5, A[i][j]);
        }
    for (let i = 0; i < n; i++) {
      const [x, y] = pos(i);
      drawing +=
        circle(x, y, 26, i ? 'var(--curve)' : 'var(--result)') +
        text(x, y + 4, `R${i}`) +
        text(x, y + 43, frame.distance?.[i] === 16 ? '∞' : frame.distance?.[i]);
    }
    drawing += text(260, 280, `Failure update round ${f(frame.round)} · destination R0`);
  } else if (v.kind === 'bits') {
    drawing =
      v.bits
        .map((bit, i) =>
          box(
            55 + (i % 8) * 52,
            45 + Math.floor(i / 8) * 47,
            44,
            34,
            bit,
            i < v.prefix ? 'var(--curve)' : 'var(--result)',
          ),
        )
        .join('') +
      text(260, 265, `${v.prefix} network bits (blue) · ${32 - v.prefix} host bits (green)`);
  } else if (v.kind === 'resources') {
    drawing = text(260, 40, `Work / available: [${(frame.work ?? []).join(', ')}]`);
    for (let i = 0; i < v.allocation.length; i++)
      drawing += box(
        35 + (i * 470) / v.allocation.length,
        85,
        450 / v.allocation.length,
        60,
        `P${i}`,
        frame.finish?.[i] ? 'var(--result)' : 'var(--load)',
      );
    drawing +=
      text(
        260,
        205,
        'Green: proved finishable. Amber: not yet proved finishable.',
        'var(--muted)',
      ) + text(260, 245, `Last completed process ${f(frame.process)}`);
  } else if (v.kind === 'disk') {
    for (let i = 0; i < 3; i++) {
      const y = 75 + i * 70;
      drawing +=
        text(50, y, ['FCFS', 'SCAN', 'C-SCAN'][i]) +
        line(105, y, 455, y, 'var(--border)') +
        circle(
          105 + (350 * (frame.positions?.[i] ?? 0)) / 199,
          y,
          9,
          ['var(--curve)', 'var(--result)', 'var(--load)'][i],
        ) +
        text(480, y + 5, frame.positions?.[i]);
    }
    drawing += text(
      260,
      280,
      'Head position, cylinders 0…199; physical wrap travel is included.',
      'var(--muted)',
    );
  } else if (v.kind === 'semaphores') {
    drawing = text(260, 40, `Instruction ${f(frame.t)} · ${frame.event ?? ''}`);
    for (let i = 0; i < v.capacity; i++)
      drawing += box(
        45 + (i * 430) / v.capacity,
        85,
        410 / v.capacity,
        50,
        frame.buffer?.[i] ?? 'empty',
        frame.buffer?.[i] ? 'var(--result)' : 'var(--muted)',
      );
    drawing +=
      text(
        260,
        180,
        `empty ${f(frame.sem?.empty)} · full ${f(frame.sem?.full)} · mutex ${f(frame.sem?.mutex)}`,
      ) +
      text(
        260,
        220,
        `Producer PC ${f(frame.producerPC)}${frame.blockedP ? ' blocked' : ''} · Consumer PC ${f(frame.consumerPC)}${frame.blockedC ? ' blocked' : ''}`,
      );
  } else if (v.kind === 'memory') {
    height = 355;
    drawing =
      text(
        260,
        32,
        `VA ${f(frame.address)} → L1 ${f(frame.l1)} / L2 ${f(frame.l2)} / offset ${f(frame.offset)}`,
      ) +
      text(
        260,
        60,
        `PA ${f(frame.physical)} · ${frame.hit ? 'TLB hit' : 'TLB miss'} · ${frame.fault ? 'page fault' : 'resident page'}`,
      );
    drawing +=
      text(130, 95, 'TLB: VPN → frame', 'var(--curve)') +
      text(380, 95, 'Resident page table', 'var(--result)');
    for (const [base, list] of [
      [130, frame.tlb ?? []],
      [380, frame.resident ?? []],
    ])
      drawing += list
        .map(([vpn, slot], i) => text(base, 118 + i * 14, `${vpn} → ${slot}`))
        .join('');
  } else if (v.kind === 'cpu') {
    drawing = text(
      260,
      45,
      `Tick ${f(frame.time)} · ${frame.running === null ? 'IDLE' : 'running P' + frame.running}`,
    );
    const n = v.jobs.length;
    for (let i = 0; i < n; i++)
      drawing += box(
        25 + (i * 470) / n,
        95,
        450 / n,
        55,
        `P${i}: ${frame.remaining?.[i]}`,
        frame.running === i ? 'var(--load)' : 'var(--muted)',
      );
    drawing += (frame.queues ?? [])
      .map((q, i) =>
        text(
          260,
          200 + i * 25,
          `Ready queue ${i}: ${q.map((id) => 'P' + id).join(', ') || 'empty'}`,
        ),
      )
      .join('');
  } else if (v.kind === 'coding') {
    drawing = v.codes
      .map(
        (code, i) =>
          text(75, 40 + i * 28, `S${i}`) +
          text(220, 40 + i * 28, code, 'var(--result)') +
          text(400, 40 + i * 28, `p=${f(v.prob[i])}`),
      )
      .join('');
    drawing += text(260, 285, 'No codeword is a prefix of another.', 'var(--muted)');
  } else if (v.kind === 'keys') {
    drawing =
      box(25, 100, 130, 70, f(v.left)) +
      box(195, 100, 130, 70, f(v.middle), 'var(--load)') +
      box(365, 100, 130, 70, f(v.right), 'var(--result)') +
      line(155, 135, 195, 135) +
      line(325, 135, 365, 135) +
      text(
        260,
        235,
        'Educational modular arithmetic; the displayed integers are not secure keys.',
        'var(--muted)',
      );
  } else if (v.kind === 'cipher') {
    drawing = text(260, 45, 'Repeating key: ' + v.key, 'var(--load)');
    for (const [y, s, name] of [
      [95, v.plain, 'Plaintext'],
      [190, v.cipher, 'Ciphertext'],
    ]) {
      drawing += text(260, y - 25, name, 'var(--muted)');
      for (let i = 0; i < Math.ceil(s.length / 40); i++)
        drawing += text(260, y + i * 20, s.slice(i * 40, (i + 1) * 40));
    }
  } else if (v.kind === 'digest') {
    drawing =
      v.original
        .map((bit, i) =>
          box(
            18 + (i % 32) * 15,
            45 + Math.floor(i / 32) * 22,
            14,
            20,
            v.modified[i],
            bit !== v.modified[i] ? 'var(--brand)' : 'var(--result)',
          ),
        )
        .join('') +
      text(260, 265, 'Modified digest bits: crimson changed, green unchanged.', 'var(--muted)');
  } else if (v.kind === 'trellis') {
    for (let s = 0; s < 4; s++) {
      for (let b = 0; b < 2; b++) {
        const to = ((s << 1) | b) & 3;
        drawing += line(100, 55 + s * 53, 410, 55 + to * 53, 'var(--border)');
      }
      drawing +=
        circle(100, 55 + s * 53, 20) +
        circle(410, 55 + s * 53, 20, 'var(--result)') +
        text(100, 60 + s * 53, s) +
        text(410, 60 + s * 53, s) +
        text(468, 60 + s * 53, frame.metrics?.[s] ?? '∞');
    }
    drawing += text(
      260,
      270,
      `Trellis step ${f(frame.t)} · received pair ${(frame.received ?? []).join('')}`,
    );
  } else drawing = text(260, 145, 'Inspect the accompanying parameter table.');
  return { drawing, height };
}

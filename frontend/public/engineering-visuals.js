import { standardAtmosphere, isentropic } from '../../backend/aerospace.js';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function engineeringVisual(v, data, index, { text, path, box, arrow }) {
  const point = data.series[Math.min(index, data.series.length - 1)],
    green = 'var(--result)',
    red = 'var(--brand)',
    muted = 'var(--muted)',
    amber = 'var(--load)';
  let drawing = '',
    height = 280;
  const circle = (x, y, r, stroke = green, fill = 'var(--surface-1)') =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const caption = (value, y = 260) => {
    if (value.length <= 57) return text(260, y, value, muted);
    const split = value.lastIndexOf(' ', Math.ceil(value.length / 2));
    return (
      text(260, y - 10, value.slice(0, split), muted) +
      text(260, y + 9, value.slice(split + 1), muted)
    );
  };
  const node = (x, y, w, h, label, color = green) =>
    box(x, y, w, h, color) + text(x + w / 2, y + h / 2 + 5, label, color);
  if (v.kind === 'circuit-network') {
    const positions = new Map(
      v.nodes.map((node, i) => [node, [70 + (i % 3) * 185, 65 + Math.floor(i / 3) * 80]]),
    );
    height = Math.max(280, Math.ceil(v.nodes.length / 3) * 80 + 80);
    drawing = v.branches
      .map((c, i) => {
        const [x, y] = positions.get(c.a),
          [a, b] = positions.get(c.b);
        return (
          path(`M${x} ${y}L${a} ${b}`, muted) +
          text((x + a) / 2, (y + b) / 2 - 8 + (i % 2) * 20, c.name, green)
        );
      })
      .join('');
    drawing += v.nodes
      .map((node) => {
        const [x, y] = positions.get(node);
        return (
          circle(x, y, 18, node === 0 ? amber : green) + text(x, y + 5, node === 0 ? 'GND' : node)
        );
      })
      .join('');
    drawing += caption('Connectivity sketch · branch directions and values in table', height - 20);
  } else if (v.kind === 'modulator') {
    drawing =
      node(35, 80, 100, 65, 'Message') +
      arrow(135, 112, 195, 112) +
      node(195, 80, 120, 65, v.mode, green) +
      arrow(315, 112, 375, 112, green) +
      node(375, 80, 110, 65, 'Carrier');
    const message = Math.cos(2 * Math.PI * v.message * point.x),
      value =
        v.mode === 'FM'
          ? `${(v.carrier + v.index * v.message * message).toFixed(2)} Hz instantaneous`
          : `${(1 + v.index * message).toFixed(3)} × signed envelope`;
    drawing +=
      text(85, 65, `${v.message} Hz`, muted) +
      text(430, 65, `${v.carrier} Hz center`, muted) +
      arrow(255, 205, 255, 148, red) +
      text(255, 228, `Probe t=${point.x.toFixed(3)} s`, amber) +
      caption(value);
  } else if (v.kind === 'symbols') {
    const active = Math.min(v.bits.length - 1, Math.floor((point.x / 1000) * v.rate)),
      size = 420 / v.bits.length;
    drawing =
      text(260, 28, 'BPSK · one bit per symbol') +
      v.bits
        .map((b, i) => node(50 + i * size, 45, size - 4, 35, b, i === active ? amber : muted))
        .join('');
    const angle = v.bits[active] ? Math.PI : 0;
    drawing +=
      circle(260, 155, 50, muted) +
      path('M195 155H325M260 95V215', muted) +
      arrow(260, 155, 260 + 45 * Math.cos(angle), 155, green) +
      text(380, 151, `Bit ${v.bits[active]}`, amber) +
      text(380, 176, `${v.bits[active] ? 180 : 0}°`, green) +
      caption(`Probe t=${point.x.toFixed(2)} ms · symbol ${active}`);
  } else if (v.kind === 'constellation') {
    const active = Math.min(v.values.length - 1, Math.floor(point.x)),
      scale = 105 / v.amplitude,
      current = v.coords[active];
    drawing =
      path('M105 140H415M260 22V255', muted) +
      text(423, 144, 'I', muted) +
      text(260, 18, 'Q', muted);
    const map = [
      [1, 1, '00'],
      [-1, 1, '01'],
      [-1, -1, '11'],
      [1, -1, '10'],
    ];
    drawing += map
      .map(
        ([i, q, label]) =>
          circle(260 + (i * 105) / Math.SQRT2, 140 - (q * 105) / Math.SQRT2, 5, muted) +
          text(
            260 + (i * 105) / Math.SQRT2,
            140 - (q * 105) / Math.SQRT2 + (q > 0 ? -12 : 25),
            label,
            muted,
          ),
      )
      .join('');
    drawing +=
      arrow(260, 140, 260 + current[0] * scale, 140 - current[1] * scale, green) +
      circle(260 + current[0] * scale, 140 - current[1] * scale, 8, green) +
      text(70, 35, `Symbol ${active}`, amber, 'start') +
      caption(
        `Dibit ${v.values[active].toString(2).padStart(2, '0')} · I=${current[0].toFixed(3)}, Q=${current[1].toFixed(3)} V`,
      );
  } else if (v.kind === 'radiolink') {
    const antenna = (x) =>
      path(`M${x} 190V85m-28 0 28 40 28-40m-40 30h24`, green) +
      path(`M${x - 36} 75q-20 35 0 70m72-70q20 35 0 70`, muted);
    drawing =
      antenna(95) +
      antenna(425) +
      arrow(150, 110, 370, 110, amber) +
      text(95, 218, `${v.power} dBm Tx`, green) +
      text(425, 218, `${point.y.toFixed(2)} dBm Rx`, green) +
      text(260, 65, `${v.frequency} MHz`, muted) +
      text(260, 145, `${point.x.toFixed(3)} km`, amber) +
      caption('Free-space propagation · probe distance is shown');
  } else if (v.kind === 'channel') {
    drawing =
      node(30, 90, 110, 65, 'Source') +
      arrow(140, 122, 190, 122, green) +
      node(190, 90, 140, 65, 'AWGN channel') +
      arrow(330, 122, 380, 122, green) +
      node(380, 90, 110, 65, 'Receiver') +
      arrow(260, 205, 260, 160, amber) +
      text(260, 227, 'Gaussian noise', amber) +
      text(260, 55, `${v.bandwidth} kHz bandwidth`, muted) +
      caption(`Probe SNR ${point.x.toFixed(1)} dB · capacity ${point.y.toFixed(4)} Mbit/s`);
  } else if (v.kind === 'solar') {
    const sx = (x) => 65 + (390 * x) / v.voc,
      sy = (i) => 215 - (160 * i) / v.isc,
      iv = v.iv[index],
      mpp = v.iv.reduce(
        (best, p) => (Math.abs(p.voltage - v.vmp) < Math.abs(best.voltage - v.vmp) ? p : best),
        v.iv[0],
      );
    drawing =
      path('M65 45V215H460', muted) +
      path(
        v.iv.map((p, i) => `${i ? 'L' : 'M'}${sx(p.voltage)} ${sy(p.current)}`).join(''),
        green,
        2,
      ) +
      circle(sx(iv.voltage), sy(iv.current), 5, amber) +
      circle(sx(mpp.voltage), sy(mpp.current), 5, red) +
      text(260, 27, 'Ideal diode I–V curve · red marks maximum power') +
      text(30, 55, 'I (A)', muted) +
      text(440, 238, 'V (V)', muted) +
      caption(
        `Probe ${iv.voltage.toFixed(2)} V · ${iv.current.toFixed(3)} A · ${point.y.toFixed(2)} W`,
      );
  } else if (v.kind === 'wind') {
    drawing = path('M215 135V235m-35 0h70', muted, 4) + circle(215, 125, 11, red);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - 1.2,
        x = 215 + 72 * Math.cos(a),
        y = 125 + 72 * Math.sin(a);
      drawing += path(
        `M215 125Q${215 + 35 * Math.cos(a + 0.25)} ${125 + 35 * Math.sin(a + 0.25)} ${x} ${y}`,
        green,
        11,
      );
    }
    drawing +=
      [80, 115, 150]
        .map((y) => arrow(30, y, 30 + clamp(point.x / 25, 0, 1) * 90 + 15, y, amber))
        .join('') +
      node(355, 100, 115, 55, 'Generator') +
      arrow(230, 125, 350, 125, green) +
      text(412, 183, `η=${v.efficiency}`, muted) +
      text(215, 38, `Rotor radius ${v.radius} m`, muted) +
      caption(`Probe wind ${point.x.toFixed(1)} m/s · electric ${point.y.toFixed(2)} kW`);
  } else if (v.kind === 'battery') {
    const soc = Math.max(0, v.initial - (v.current * point.x) / v.capacity);
    drawing =
      box(100, 75, 300, 110, muted) +
      box(400, 110, 15, 40, muted) +
      `<rect x="109" y="84" width="${282 * soc}" height="92" rx="3" fill="${soc > 0.15 ? green : amber}" opacity=".35"/>` +
      text(250, 137, `${(soc * 100).toFixed(1)}% SOC`, green) +
      text(250, 45, `${v.current} A constant discharge`, muted) +
      caption(`Probe ${point.x.toFixed(2)} h · load port ${point.y.toFixed(3)} V`);
  } else if (v.kind === 'converter') {
    const labels = v.boost
      ? ['Input', 'Inductor', 'PWM / diode', 'Output']
      : ['Input', 'PWM switch', 'Inductor', 'Output'];
    drawing =
      labels
        .map(
          (label, i) =>
            node(25 + i * 125, 80, 100, 70, label, i === 1 ? amber : green) +
            (i < 3 ? arrow(125 + i * 125, 115, 145 + i * 125, 115, green) : ''),
        )
        .join('') +
      text(75, 185, `${v.vin} V`, muted) +
      text(450, 185, `${v.vo.toFixed(2)} V`, green) +
      text(260, 38, `Ideal ${v.boost ? 'boost' : 'buck'} energy path · D=${v.duty}`, muted) +
      caption(`Probe t=${point.x.toFixed(2)} µs · inductor ${point.y.toFixed(3)} A`);
  } else if (v.kind === 'phasor') {
    drawing = circle(210, 140, 80, muted) + path('M110 140H310M210 40V240', muted);
    for (let k = 0; k < 3; k++) {
      const a = (-k * 2 * Math.PI) / 3;
      drawing +=
        arrow(210, 140, 210 + 75 * Math.cos(a), 140 - 75 * Math.sin(a), muted) +
        arrow(210, 140, 210 + 58 * Math.cos(a - v.phi), 140 - 58 * Math.sin(a - v.phi), green);
    }
    drawing +=
      text(400, 100, `${v.voltage} V line RMS`, muted) +
      text(400, 128, `${v.current} A line RMS`, green) +
      text(400, 170, `φ=${((v.phi * 180) / Math.PI).toFixed(1)}°`, amber) +
      caption(
        `Probe ${point.x.toFixed(2)} ms · total ${(point.y + point.reference + point.other).toFixed(4)} kW · normalized phasors`,
      );
  } else if (v.kind === 'trajectory') {
    const maxX = data.series.at(-1).x,
      maxY = Math.max(...data.series.map((p) => p.y)),
      scale = Math.min(420 / maxX, 170 / (maxY || 1)),
      sx = (x) => 45 + x * scale,
      sy = (y) => 220 - y * scale;
    drawing =
      path('M35 220H490', muted) +
      path(data.series.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.y)}`).join(''), green) +
      circle(sx(point.x), sy(point.y), 6, amber) +
      text(260, 28, 'Exact point-mass trajectory · uniform geometric scale') +
      caption(`Probe x=${point.x.toFixed(2)} m · altitude=${point.y.toFixed(2)} m`);
  } else if (v.kind === 'wing') {
    drawing =
      path('M140 145q100-80 240-15-120 15-240 15Z', muted, 3) +
      arrow(260, 130, 260, 45, green) +
      text(280, 48, `Lift ${v.weight.toFixed(0)} N`, green, 'start') +
      arrow(235, 145, 80, 145, amber) +
      text(80, 180, `Drag ${point.y.toFixed(1)} N`, amber) +
      arrow(365, 145, 460, 145, muted) +
      text(420, 182, 'Thrust', muted) +
      caption(`Conditional level flight · probe speed ${point.x.toFixed(1)} m/s`);
  } else if (v.kind === 'turn') {
    const angle = v.omega * point.x,
      x = 260 + 78 * Math.sin(angle),
      y = 140 - 78 * Math.cos(angle);
    drawing =
      circle(260, 140, 78, muted) +
      circle(x, y, 7, green) +
      arrow(x, y, 260, 140, amber) +
      text(260, 145, `R=${v.radius.toFixed(1)} m`) +
      text(80, 55, `${v.bank}° bank`, muted) +
      text(430, 55, `${v.speed} m/s`, muted) +
      caption(`Probe t=${point.x.toFixed(2)} s · heading ${((angle * 180) / Math.PI).toFixed(1)}°`);
  } else if (v.kind === 'rocket') {
    const mass = v.initial * (1 - point.x / 100),
      fuel = clamp((mass - v.final) / (v.initial - v.final), 0, 1);
    drawing =
      path('M225 90q35-100 70 0v120h-70ZM225 165l-25 52 25-12m70-40 25 52-25-12', muted, 2) +
      `<rect x="232" y="${202 - 95 * fuel}" width="56" height="${95 * fuel}" fill="${green}" opacity=".45"/>` +
      path('M240 215l20 35 20-35', amber, 3) +
      text(100, 100, `m=${mass.toFixed(1)} kg`, green) +
      text(405, 100, `ve=${v.exhaust.toFixed(1)}`, muted) +
      text(405, 123, 'm/s effective', muted) +
      caption(`Expelled ${point.x.toFixed(1)}% · ideal delta-v ${point.y.toFixed(1)} m/s`);
  } else if (v.kind === 'atmosphere') {
    const at = standardAtmosphere(point.x),
      y = 235 - (190 * point.x) / 11000;
    drawing =
      path('M80 40V235H460', muted) +
      text(70, 242, '0 m', muted, 'end') +
      text(70, 45, '11 km', muted, 'end') +
      arrow(80, y, 170, y, green) +
      text(260, 30, 'Dry standard troposphere') +
      Array.from({ length: 6 }, (_, i) => {
        const h = i * 2200,
          rho = standardAtmosphere(h).density;
        return `<rect x="190" y="${225 - i * 35}" width="${(225 * rho) / 1.225}" height="14" rx="3" fill="${green}" opacity=".25"/>`;
      }).join('') +
      text(335, 90, `${(at.temperature - 273.15).toFixed(2)} °C`, green) +
      text(335, 120, `${(at.pressure / 1000).toFixed(3)} kPa`, green) +
      text(335, 150, `${at.density.toFixed(4)} kg/m³`, green) +
      caption(`Probe geopotential altitude ${point.x.toFixed(0)} m`);
  } else if (v.kind === 'nozzle') {
    const m = point.x,
      r = isentropic(m, v.gamma),
      x = m <= 1 ? 70 + (190 * (m - 0.1)) / 0.9 : 260 + (190 * (m - 1)) / 2;
    drawing =
      path(
        'M45 45Q195 120 260 120Q345 120 475 45M45 235Q195 160 260 160Q345 160 475 235',
        muted,
        3,
      ) +
      arrow(55, 140, 470, 140, green) +
      circle(x, 140, 6, amber) +
      text(260, 25, 'Schematic nozzle · selected Mach branch') +
      text(260, 207, `M=${m.toFixed(2)} · A/A*=${r.area.toFixed(3)}`, green) +
      caption(
        `Static ${(v.temperature * r.temperature).toFixed(2)} K · ${(v.pressure * r.pressure).toFixed(2)} kPa`,
      );
  } else if (v.kind === 'reactor') {
    const concentration = v.feed * (1 - point.y / 100);
    drawing =
      text(260, 28, v.reactor === 'cstr' ? 'Ideal stirred tank' : 'Ideal plug-flow tube') +
      arrow(35, 125, 140, 125, green) +
      arrow(380, 125, 485, 125, green);
    if (v.reactor === 'cstr')
      drawing +=
        box(145, 70, 230, 140, muted) +
        path('M260 45V160m-40 0 40-18 40 18-40-8Z', amber) +
        text(260, 193, `${concentration.toFixed(3)} mol/L`, green);
    else
      drawing +=
        box(145, 90, 230, 70, muted) +
        Array.from({ length: 7 }, (_, i) => path(`M${160 + i * 30} 98v54`, green, 2)).join('');
    drawing +=
      text(75, 100, `${v.feed} mol/L`, muted) +
      caption(`Probe τ=${point.x.toFixed(2)} min · conversion ${point.y.toFixed(2)}%`);
  } else if (v.kind === 'arrhenius') {
    const temperature = 1000 / point.x,
      k = v.reference * Math.exp(point.y),
      level = (temperature - 250) / 200;
    drawing =
      box(70, 50, 55, 160, muted) +
      `<rect x="80" y="${200 - 140 * level}" width="35" height="${140 * level}" rx="5" fill="${red}"/>` +
      node(210, 90, 100, 65, 'Reactant') +
      arrow(310, 122, 370, 122, green) +
      node(370, 90, 100, 65, 'Products') +
      text(98, 237, `${temperature.toFixed(1)} K`, amber) +
      caption(
        `Probe k=${k < 1e5 ? k.toPrecision(4) : k.toExponential(2)} /min · Ea=${v.activation} kJ/mol`,
      );
  } else if (v.kind === 'reactionchain') {
    const values = [point.y, point.reference, point.other],
      colors = [muted, green, red];
    drawing = text(260, 25, 'Closed batch · unit molar stoichiometry');
    drawing +=
      values
        .map((c, i) => {
          const x = 45 + i * 165,
            h = 110 * clamp(c / v.initial, 0, 1);
          return (
            box(x, 65, 100, 140, colors[i]) +
            `<rect x="${x + 5}" y="${200 - h}" width="90" height="${h}" rx="4" fill="${colors[i]}" opacity=".3"/>` +
            text(x + 50, 95, 'ABC'[i], colors[i]) +
            text(x + 50, 228, `${c.toFixed(3)} mol/L`, colors[i]) +
            (i < 2 ? arrow(x + 105, 135, x + 155, 135, green) : '')
          );
        })
        .join('') +
      caption(
        `Probe t=${point.x.toFixed(2)} min · total ${values.reduce((s, c) => s + c, 0).toFixed(4)} mol/L`,
      );
  } else if (v.kind === 'mixing') {
    drawing =
      box(160, 55, 200, 155, muted) +
      `<rect x="166" y="100" width="188" height="104" rx="4" fill="${green}" opacity=".18"/>` +
      path('M260 40V160m-40 0 40-18 40 18', amber) +
      arrow(30, 95, 155, 95, green) +
      arrow(365, 175, 490, 175, green) +
      text(80, 65, `Cin=${v.feed}`, muted) +
      text(440, 150, `Cout=${point.y.toFixed(3)}`, green) +
      text(260, 190, `${v.volume} L fixed volume`, muted) +
      caption(
        `Q=${v.flow} L/min · tank C=${point.y.toFixed(4)} mol/L at ${point.x.toFixed(2)} min`,
      );
  } else if (v.kind === 'adsorption') {
    const coverage = (v.affinity * point.x) / (1 + v.affinity * point.x),
      count = Math.round(coverage * 20);
    drawing =
      text(260, 28, '20 illustrative monolayer sites') +
      path('M45 185H475', muted, 3) +
      Array.from({ length: 20 }, (_, i) => {
        const x = 65 + (i % 10) * 43,
          y = 90 + Math.floor(i / 10) * 55;
        return circle(
          x,
          y,
          13,
          i < count ? green : muted,
          i < count ? 'var(--selection)' : 'var(--surface-1)',
        );
      }).join('') +
      text(260, 220, `${(coverage * 100).toFixed(2)}% continuous coverage`, green) +
      caption(`Probe C=${point.x.toFixed(2)} mg/L · q=${point.y.toFixed(3)} mg/g`);
  } else if (v.kind === 'membrane') {
    drawing =
      box(55, 65, 180, 145, muted) +
      box(285, 65, 180, 145, muted) +
      path('M260 45V230', amber, 5) +
      text(145, 45, `Feed ${v.feed} mol/L`, muted) +
      text(375, 45, `Permeate ${v.permeate} mol/L`, muted) +
      (point.y >= 0 ? arrow(185, 135, 335, 135, green) : arrow(335, 135, 185, 135, green)) +
      text(260, 30, 'Selective membrane') +
      text(260, 240, `ΔP=${point.x.toFixed(2)} bar · Δπ=${v.osmotic.toFixed(2)} bar`, muted) +
      caption(`Signed water flux ${point.y.toFixed(3)} L/(m²·h)`);
  } else if (v.kind === 'queue') {
    const n = point.x;
    drawing =
      text(260, 28, `Stationary state N=${n} · not a time simulation`) +
      Array.from({ length: Math.min(n, 8) }, (_, i) => circle(45 + i * 35, 130, 10, muted)).join(
        '',
      ) +
      node(360, 90, 115, 80, n ? 'Busy server' : 'Idle server', n ? green : muted) +
      arrow(30, 65, 110, 65, green) +
      text(190, 68, `λ=${v.arrival}/h`, green) +
      text(415, 200, `μ=${v.service}/h`, muted) +
      caption(`P(N=${n})=${point.y.toFixed(3)}% · utilization ${(v.rho * 100).toFixed(2)}%`);
  } else if (v.kind === 'inventory') {
    const q = point.x,
      cycle = (365 * q) / v.demand;
    drawing =
      path('M55 40V220H475', muted) +
      path('M55 65L245 220V65L435 220V65', green, 2) +
      text(45, 70, q.toFixed(1), green, 'end') +
      text(245, 242, `${cycle.toFixed(2)} days`, muted) +
      text(260, 28, 'Instantaneous replenishment · constant demand') +
      caption(`Probe order Q=${q.toFixed(2)} · annual relevant cost ${point.y.toFixed(2)}`);
  } else if (v.kind === 'project') {
    const n = v.durations.length,
      columns = n <= 6 ? 3 : 4,
      rowCount = Math.ceil(n / columns),
      graphEnd = 65 + (rowCount - 1) * 90,
      ganttStart = graphEnd + 80;
    height = ganttStart + n * 21 + 95;
    const positions = Array.from({ length: n }, (_, i) => [
      65 + (i % columns) * (390 / (columns - 1)),
      65 + Math.floor(i / columns) * 90,
    ]);
    drawing = v.predecessors
      .flatMap((parents, i) =>
        parents.map((p) => {
          const [a, b] = positions[p],
            [x, y] = positions[i],
            critical = v.slack[p] === 0 && v.slack[i] === 0 && v.finish[p] === v.early[i];
          return arrow(a + 30, b, x - 30, y, critical ? red : muted);
        }),
      )
      .join('');
    drawing += positions
      .map(
        ([x, y], i) =>
          circle(x, y, 30, v.slack[i] === 0 ? red : muted) +
          text(x, y - 1, String.fromCharCode(65 + i)) +
          text(x, y + 18, `${v.durations[i]} d`, muted),
      )
      .join('');
    drawing += text(260, graphEnd + 55, 'Earliest-start Gantt · crimson means zero slack');
    drawing +=
      v.durations
        .map((duration, i) => {
          const active = point.x >= v.early[i] && point.x < v.finish[i],
            x = 100 + (350 * v.early[i]) / v.duration,
            w = (350 * duration) / v.duration,
            y = ganttStart + i * 21;
          return (
            text(75, y + 13, String.fromCharCode(65 + i), muted) +
            `<rect x="${x}" y="${y}" width="${w}" height="16" rx="3" fill="${v.slack[i] === 0 ? red : green}" opacity="${active ? 1 : 0.4}"/>`
          );
        })
        .join('') +
      path(`M${100 + (350 * point.x) / v.duration} ${ganttStart - 5}v${n * 21 + 5}`, amber) +
      path(`M100 ${ganttStart + n * 21 + 5}H450`, muted) +
      [0, 0.5, 1]
        .map((f) =>
          text(100 + 350 * f, ganttStart + n * 21 + 25, `${(v.duration * f).toFixed(1)} d`, muted),
        )
        .join('') +
      caption(
        `Probe day ${point.x} · ${point.y} tasks active · finish day ${v.duration}`,
        height - 15,
      );
  } else if (v.kind === 'survival') {
    const r = point.y / 100,
      circumference = 2 * Math.PI * 70;
    drawing =
      circle(200, 140, 70, muted) +
      `<circle cx="200" cy="140" r="70" fill="none" stroke="${green}" stroke-width="10" stroke-dasharray="${r * circumference} ${circumference}" transform="rotate(-90 200 140)"/>` +
      text(200, 140, `${point.y.toFixed(2)}%`, green) +
      text(200, 164, 'survive', muted) +
      text(405, 100, `β=${v.shape}`, muted) +
      text(405, 135, `η=${v.scale} h`, muted) +
      caption(
        `Probe age ${point.x.toFixed(1)} h · failure probability ${point.reference.toFixed(2)}%`,
      );
  } else if (v.kind === 'reliability') {
    const n = Math.round(point.x);
    drawing = text(
      260,
      25,
      `${v.topology === 'series' ? 'All required' : 'Any one sufficient'} · first ${n} of ${v.values.length} components`,
    );
    if (v.topology === 'series') {
      const size = 440 / v.values.length;
      drawing +=
        path('M30 130H490', muted) +
        v.values
          .map((r, i) =>
            node(
              35 + i * size,
              105,
              size - 8,
              50,
              `${Math.round(r * 100)}%`,
              i < n ? green : muted,
            ),
          )
          .join('');
    } else {
      height = Math.max(280, 85 + v.values.length * 29);
      drawing +=
        path(
          `M110 52V${52 + (v.values.length - 1) * 29}M410 52V${52 + (v.values.length - 1) * 29}`,
          muted,
        ) +
        v.values
          .map(
            (r, i) =>
              path(`M110 ${52 + i * 29}H410`, i < n ? green : muted) +
              node(215, 40 + i * 29, 90, 25, `${Math.round(r * 100)}%`, i < n ? green : muted),
          )
          .join('');
    }
    drawing += caption(
      `Probe system reliability ${point.y.toFixed(4)}% · independent failures`,
      height - 15,
    );
  } else if (v.kind === 'quality') {
    const x = (z) => 260 + z * 45,
      y = (z) => 205 - 135 * Math.exp((-z * z) / 2),
      z = point.y,
      mean = v.mean + (z * v.sigma) / Math.sqrt(v.size);
    drawing =
      path('M55 205H465', muted) +
      path(
        Array.from({ length: 101 }, (_, i) => {
          const z = -4 + i * 0.08;
          return `${i ? 'L' : 'M'}${x(z)} ${y(z)}`;
        }).join(''),
        green,
      ) +
      [-3, 3]
        .map(
          (value) => path(`M${x(value)} 45V210`, red, 2) + text(x(value), 232, `${value} SE`, red),
        )
        .join('') +
      arrow(x(clamp(z, -4, 4)), 40, x(clamp(z, -4, 4)), Math.max(60, y(clamp(z, -4, 4))), amber) +
      text(260, 25, 'In-control subgroup-mean distribution') +
      caption(
        `Subgroup ${point.x} · mean ${mean.toFixed(3)} · z=${z.toFixed(2)}${Math.abs(z) > 4 ? ' (marker at display edge)' : ''}`,
      );
  }
  return { drawing, height };
}

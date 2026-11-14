// Small, native illustrations stay crisp in both themes and on every screen.
const line =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export function subjectArt(kind) {
  const drawings = {
    classifier:
      '<path d="M90 70 205 10" stroke-dasharray="4 4"/>' +
      [
        [95, 25],
        [120, 20],
        [90, 43],
        [105, 34],
        [170, 57],
        [195, 47],
        [201, 63],
        [183, 66],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="5" class="${i < 4 ? 'art-load' : 'art-result'}"/>`,
        )
        .join(''),
    clusters:
      [
        [90, 30],
        [104, 21],
        [112, 40],
        [82, 45],
        [190, 37],
        [203, 49],
        [178, 56],
        [207, 30],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="4" class="${i < 4 ? 'art-load' : 'art-result'}"/>`,
        )
        .join('') +
      '<circle cx="98" cy="34" r="25" stroke-dasharray="3 4"/><circle cx="193" cy="44" r="27" stroke-dasharray="3 4"/>',
    pixels:
      Array.from(
        { length: 25 },
        (_, i) =>
          `<rect x="${60 + (i % 5) * 11}" y="${12 + Math.floor(i / 5) * 11}" width="10" height="10" fill="currentColor" opacity="${i % 5 > 2 ? 0.7 : 0.12}"/>`,
      ).join('') +
      '<path d="M130 40h42m-7-6 7 6-7 6"/>' +
      Array.from(
        { length: 9 },
        (_, i) =>
          `<rect x="${190 + (i % 3) * 16}" y="${18 + Math.floor(i / 3) * 16}" width="14" height="14" class="art-result" opacity="${i % 3 === 1 ? 1 : 0.2}"/>`,
      ).join(''),
    math: '<path d="M40 67h220M55 72V9M62 62Q116 65 142 30T240 14"/><path d="m99 61 22-9v9Zm32-18 22-15v33h-22Zm32-24 22-6v48h-22Z" class="art-result"/><path d="m174 37 48-26" class="art-load"/>',
    learning:
      '<path d="M70 21l80-7 80 14M70 21l80 20 80-13M70 62l80-21 80 21M70 62l80 6 80-40M150 14v54"/>' +
      [
        [70, 21],
        [70, 62],
        [150, 14],
        [150, 41],
        [150, 68],
        [230, 28],
        [230, 62],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="7" fill="var(--surface-1)" class="art-result"/>`,
        )
        .join(''),
    matrix:
      '<path d="M40 66h220M150 74V8M84 60l20-40 92 10-20 40Z"/><path d="M150 66l46-36m-9 1 9-1-2 9" class="art-result"/>',
    probability:
      '<path d="M25 69h250M30 68C85 68 85 14 150 14S215 68 270 68"/>' +
      [12, 22, 42, 51, 37, 28, 13]
        .map(
          (h, i) =>
            `<rect x="${70 + i * 24}" y="${69 - h}" width="15" height="${h}" class="art-result"/>`,
        )
        .join(''),
    beam: '<path d="M42 28v44m-8-42 8-5m-8 15 8-5m-8 15 8-5m-8 15 8-5"/><path d="M43 45h208v13H43"/><path d="M80 12v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6m45-18v24m-5-6 5 6 5-6" class="art-load"/>',
    circuit:
      '<circle cx="55" cy="41" r="19"/><path d="M46 41q4-14 9 0t9 0M55 22V12h58v20l-7 5 14 8-14 8 7 5v12H55V60m58-48h90v23m-15 0h30m-30 10h30m-15 0v25h-90"/>',
    motor:
      '<path d="M100 21h74v42h-74zM87 31h13m-13 22h13m87-12h40M110 63v8h56v-8"/><circle cx="153" cy="42" r="13"/><path d="M151 33l9 9-9 9m-8-9h17"/>',
    feedback:
      '<path d="M20 30h50m-7-5 7 5-7 5m30-5h33m-7-5 7 5-7 5m66-5h65m-7-5 7 5-7 5M230 30v37H85V44"/><circle cx="85" cy="30" r="14"/><path d="M79 30h12m-6-6v12m-4 5h8"/><rect x="133" y="12" width="57" height="36" rx="4"/><text x="160" y="36" text-anchor="middle">G(s)</text>',
    poles:
      '<path d="M40 42h220M150 9v66"/><circle cx="105" cy="42" r="25" stroke-dasharray="3 5"/><path d="M94 18l10 10m0-10-10 10m-10 28 10 10m0-10-10 10M150 42Q100 10 56 42" class="art-result"/>',
    tank: '<path d="M92 15v53h104V15m-104 27h104m-73-30V5H60m136 53h43"/><path d="M96 48q12-6 24 0t24 0t24 0t24 0" class="art-result"/>',
    thermal:
      '<path d="M123 15v35a17 17 0 1 0 20 0V15a10 10 0 0 0-20 0Z"/><path d="M133 30v33m23-40h15m-15 13h10m-10 13h15" class="art-load"/><circle cx="133" cy="64" r="5"/>',
    pendulum:
      '<path d="M88 64h108M115 55v9m52-9v9"/><rect x="102" y="43" width="78" height="12" rx="3"/><path d="M140 43l29-30"/><circle cx="171" cy="11" r="6"/><path d="M111 18q13-12 28-6m-6-4 6 4-6 5" class="art-result"/>',
    robot:
      '<path d="M115 70h85l-8-12h-68ZM150 58V41l-31-17 10-12 44 24v22M130 13l47-8 3 12-47 9m45-9 18 10m-4-14 10 8-5 10"/><circle cx="127" cy="19" r="10"/><circle cx="161" cy="41" r="9"/>',
    bars: [29, 46, 17, 39, 60, 23, 51, 34]
      .map(
        (h, i) =>
          `<rect x="${45 + i * 27}" y="${73 - h}" width="16" height="${h}" rx="2" class="${i === 4 ? 'art-load' : ''}"/>`,
      )
      .join(''),
    wave: '<path d="M25 42h250M35 42q18-55 36 0t36 0t36 0t36 0t36 0t36 0"/><path d="M71 15v54m36-54v54m36-54v54m36-54v54m36-54v54" class="art-result" stroke-dasharray="2 5"/>',
    flow: '<path d="M24 15h70l45 17h30l45-17h62M24 67h70l45-17h30l45 17h62M42 41h203m-9-7 9 7-9 7"/><path d="M101 16V6h110v9m-70 17V6" class="art-load"/>',
    chip: '<rect x="106" y="12" width="88" height="58" rx="6"/><rect x="126" y="28" width="48" height="26" rx="2"/><path d="M89 24h17m-17 17h17m-17 17h17m88-34h17m-17 17h17m-17 17h17m-81-46V3m22 9V3m22 9V3m-44 67v9m22-9v9m22-9v9"/><path d="m143 33-5 8 5 8m14-16 5 8-5 8" class="art-result"/>',
    lattice:
      '<path d="m93 22 55-16 57 17-3 42-52 12-57-16Zm0 0 57 23 55-22m-55 22v32m-57-16 55-23 54 27M148 6v32"/>' +
      [
        [93, 22],
        [148, 6],
        [205, 23],
        [202, 65],
        [150, 77],
        [93, 61],
        [150, 45],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="5" fill="var(--plot-bg)" class="art-result"/>`,
        )
        .join(''),
    network:
      '<path d="m50 42 70-25 62 28 65-29m-197 26 70 26 62-23 65 23m-127-51v51m62-23v25"/>' +
      [
        [50, 42],
        [120, 17],
        [120, 68],
        [182, 45],
        [247, 16],
        [247, 68],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="10" fill="var(--plot-bg)" class="${i === 3 ? 'art-load' : 'art-result'}"/>`,
        )
        .join(''),
    numerical:
      '<path d="M40 8v61h225M55 55Q110-18 165 42T255 26"/><path d="m57 55 42-29 44-3 43 24 42-3 26-18" class="art-result"/>' +
      [
        [57, 55],
        [99, 26],
        [143, 23],
        [186, 47],
        [228, 44],
        [254, 26],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" class="art-load"/>`)
        .join(''),
    radio:
      '<path d="M150 25v50m-25 0h50m-45-50 20 25 20-25M114 18q-25 20 0 40m72-40q25 20 0 40M95 8q-40 30 0 60m110-60q40 30 0 60"/><circle cx="150" cy="22" r="5" class="art-load"/>',
    power:
      '<path d="M88 20h42l-8 42H80Zm42 0h42l-8 42h-42Zm42 0h42l-8 42h-42ZM87 40h123M145 62v12m-25 0h50"/><path d="M53 13v15m-12-7h24m-21-10 18 20m-18 0 18-20" class="art-load"/>',
    flight:
      '<path d="m40 54 90-16 21-30 12 2-10 25 80 7 29-19 11 3-16 29-85 5-35 13-10-2 19-18-84 7Z"/><path d="M30 73Q120-30 240 15" stroke-dasharray="4 5" class="art-result"/>',
    process:
      '<path d="M90 15h120v53H90ZM150 4v44m-25 0 25-13 25 13M45 30h45m120 25h45m-7-5 7 5-7 5M45 20v10m60 38v8m90-8v8"/><path d="M95 55q20-7 40 0t40 0t30 0" class="art-result"/>',
    operations:
      '<rect x="25" y="27" width="60" height="30" rx="5"/><rect x="120" y="8" width="60" height="30" rx="5"/><rect x="120" y="52" width="60" height="25" rx="5"/><rect x="215" y="27" width="60" height="30" rx="5"/><path d="m85 42 35-19m-35 19 35 22m60-41 35 19m-35 22 35-22" class="art-result"/>',
  };
  return `<svg viewBox="0 0 300 82" aria-hidden="true" class="subject-art"><g ${line}>${drawings[kind] ?? drawings.feedback}</g></svg>`;
}
export function disciplineHero(kind, label) {
  if (kind === 'robot' || kind === 'motor') return robotHero;
  return `<div class="discipline-illustration"><div class="illustration-heading"><span>EXPERIMENT STUDIO</span><span>01 / ${label}</span></div><div class="illustration-object">${subjectArt(kind)}</div><div class="illustration-scale"><span>MODEL</span><span>↔</span><span>RESPONSE</span></div><p>Change a parameter. Follow the result.</p></div>`;
}
export function controlArt(id) {
  if (id === 'poles') return 'poles';
  return {
    motor: 'motor',
    cruise: 'motor',
    tank: 'tank',
    thermal: 'thermal',
    pendulum: 'pendulum',
    bode: 'poles',
    lead: 'poles',
    lag: 'poles',
    locus: 'poles',
    nyquist: 'poles',
    digital: 'feedback',
    windup: 'feedback',
    pid: 'feedback',
    firstorder: 'feedback',
    secondorder: 'feedback',
  }[id];
}
export const expansionArt = {
  amradio: 'wave',
  fmradio: 'wave',
  bpsk: 'wave',
  qpsk: 'network',
  radiolink: 'radio',
  shannon: 'radio',
  solarpv: 'power',
  windpower: 'power',
  batterydischarge: 'power',
  buckconverter: 'circuit',
  boostconverter: 'circuit',
  threephase: 'wave',
  ballistic: 'flight',
  dragpolar: 'flight',
  bankturn: 'flight',
  rocketequation: 'flight',
  atmosphere: 'flight',
  isentropicflow: 'flow',
  reactorconversion: 'process',
  arrhenius: 'thermal',
  consecutive: 'process',
  mixingtank: 'tank',
  langmuir: 'lattice',
  osmosis: 'flow',
  mm1queue: 'operations',
  eoq: 'operations',
  criticalpath: 'network',
  weibull: 'numerical',
  systemreliability: 'chip',
  controlchart: 'numerical',
};
export const robotHero = `<svg viewBox="0 0 520 400" role="img" aria-label="Articulated engineering robot with crimson joints" class="studio-robot">
  <defs><linearGradient id="metal" x2=".9" y2="1"><stop stop-color="#c8d1d0"/><stop offset=".38" stop-color="#6b7979"/><stop offset=".6" stop-color="#d4d9d5"/><stop offset="1" stop-color="#334143"/></linearGradient><linearGradient id="base-metal"><stop stop-color="#283336"/><stop offset=".45" stop-color="#8c9997"/><stop offset="1" stop-color="#182327"/></linearGradient><radialGradient id="floor"><stop stop-color="#416050" stop-opacity=".45"/><stop offset="1" stop-color="#10201a" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="275" cy="348" rx="235" ry="45" fill="url(#floor)"/><g stroke="#8b9c97" stroke-width=".7" fill="none" opacity=".2"><path d="M20 349h480M55 320h410M100 295h320m-160-20v110m-40-105-80 95m160-95 80 95"/></g>
  <g class="robot-assembly"><path d="M177 329 207 305h126l35 24v18H177Z" fill="url(#base-metal)" stroke="#91a09b"/><ellipse cx="272" cy="310" rx="65" ry="17" fill="#1c292c" stroke="#95a6a2"/><path d="M211 309v-41q60-24 122 0v41q-60 20-122 0" fill="url(#base-metal)" stroke="#778985"/>
  <path d="M245 274 211 171l46-20 47 113Z" fill="url(#metal)" stroke="#b0beb6"/><path d="m251 255-27-77 17-6 35 81" fill="#334143"/>
  <path d="m233 154 77-105 39 29-88 111Z" fill="url(#metal)" stroke="#cad0c8"/><path d="m256 155 64-85 12 10-63 87Z" fill="#263438"/>
  <path d="m330 55 98 63-16 27-103-62Z" fill="url(#metal)" stroke="#b2c0b9"/><path d="m350 82 66 41-5 9-66-42Z" fill="#324144"/>
  ${[
    [249, 269, 27],
    [235, 169, 30],
    [326, 68, 29],
    [419, 131, 18],
  ]
    .map(
      ([x, y, r]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="#162126" stroke="#b9c5bf" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="#9c1c3b" stroke="#f07688"/><circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="#202c30" stroke="#b7c5be"/>`,
    )
    .join('')}
  <path d="m429 143 21 17-1 21m-26-30 2 20 15 15m10-26 13 7-1 15" fill="none" stroke="#b1bfb9" stroke-width="8" stroke-linejoin="round"/></g>
  <g fill="#9faeaa" font-family="monospace" font-size="11"><text x="44" y="70">KINEMATICS / 03 DOF</text><text x="320" y="375">MODEL. OBSERVE. UNDERSTAND.</text></g><path d="M43 84h55m-55 0v40" fill="none" stroke="#b82b4a"/>
</svg>`;

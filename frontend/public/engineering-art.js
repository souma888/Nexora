const groups = {
  phase: ['leverrule', 'ironcarbon', 'tttcct'],
  grains: ['eutectic', 'hallpetch', 'avrami', 'workhardening', 'crystalpacking', 'schmid'],
  laminate: ['laminate'],
  diffusion: ['carburizing', 'fickdiffusion'],
  crack: ['fracturetoughness', 'pariscrack', 'kirschhole'],
  fatigue: ['goodman', 'larsonmiller', 'charpy', 'relaxation'],
  beam: ['proppedbeam', 'threemoment', 'momentdistribution', 'movingload', 'castigliano'],
  truss: ['trussjoints', 'trussvirtual'],
  frame: ['portalsway', 'eccentriccolumn'],
  section: ['unsymmetric', 'sectionkern', 'beamshear', 'closedtorsion', 'rcflexure'],
  cylinder: ['thinvessel', 'lame'],
  stress: ['strainrosette', 'failurecriteria', 'mohrcoulomb'],
  cycle: ['otto', 'dieseldual', 'brayton', 'rankine', 'psychrometric', 'exergy'],
  heat: [
    'fin',
    'heisler',
    'radiation',
    'convection',
    'boundarylayer',
    'lmtd',
    'heatsink',
    'thermalshock',
  ],
  flow: [
    'hardycross',
    'pumpcurve',
    'cylinderflow',
    'couette',
    'tankdraining',
    'darcyflownet',
    'openchannel',
  ],
  soil: ['soilphases', 'bearingcapacity', 'consolidation', 'retainingwall'],
  traffic: ['runoff', 'greenshields', 'webster', 'roadcurve'],
  transformer: ['transformer', 'transformertests', 'perunit', 'transmissionpi'],
  motor: ['dcmotor', 'inductionmotor', 'commutation'],
  phasor: ['synchronous', 'powerfactor', 'twobus', 'symmetrical', 'relaycoordination'],
  bands: ['pnjunction', 'fermilevel', 'mosfet', 'cmosinverter'],
  amplifier: ['bjtbias', 'differentialamp', 'sallenkey'],
  timing: ['timer555', 'zener', 'schmitt'],
  corrosion: ['corrosion'],
};
const byId = Object.fromEntries(
  Object.entries(groups).flatMap(([kind, ids]) => ids.map((id) => [id, kind])),
);
const wire = 'fill="none" stroke="var(--curve)" stroke-width="2" stroke-linejoin="round"';
export function engineeringThumbnail(id) {
  const kind = byId[id];
  if (!kind) return null;
  const paths = {
    phase:
      '<path d="M55 65Q130 55 245 15M55 65Q170 70 245 15"/><path d="M85 44h130m-65-25v43" stroke="var(--result)" stroke-dasharray="4 3"/>',
    grains: Array.from(
      { length: 12 },
      (_, i) =>
        `<path d="M${65 + (i % 6) * 30} ${14 + Math.floor(i / 6) * 28}l18-7 16 14-10 20-24-5Z" stroke="${i % 3 === 0 ? 'var(--result)' : 'var(--curve)'}"/>`,
    ).join(''),
    laminate: [0, 1, 2, 3]
      .map((i) => `<path d="M80 ${18 + i * 12}h140v11H80Zm10 2 40 7m10-7 40 7m10-7 20 7"/>`)
      .join(''),
    diffusion:
      '<path d="M65 12v58h185M65 15Q95 15 115 40T245 68"/><path d="M65 15Q115 15 145 42T245 68" stroke="var(--result)"/>',
    crack:
      '<path d="M80 12h140v58H80Z"/><path d="M150 12v32l5 6-5 5" stroke="var(--brand)" stroke-width="3"/><path d="M65 40H35m200 0h30" stroke="var(--load)"/>',
    fatigue:
      '<path d="M55 12v58h190M55 20Q90 25 130 48T240 62"/><path d="M55 65 230 15" stroke="var(--result)"/>',
    beam: '<path d="M55 45h190v8H55Zm0 10-12 17h24Zm190 0-12 17h24Z"/><path d="M85 12v25m40-25v25m40-25v25m40-25v25" stroke="var(--load)"/><path d="M60 55Q145 76 240 55" stroke="var(--result)"/>',
    truss:
      '<path d="M55 65 110 15 165 65 220 15 245 65ZM110 15h110M110 15l55 50 55-50"/><circle cx="110" cy="15" r="4" fill="var(--result)"/><circle cx="165" cy="65" r="4" fill="var(--result)"/>',
    frame:
      '<path d="M75 70V15h150v55M60 72h30m120 0h30"/><path d="M75 70Q75 30 90 15h150Q225 30 225 70" stroke="var(--result)"/>',
    section:
      '<path d="M110 10h80v12h-30v38h30v12h-80V60h30V22h-30Z"/><path d="M85 42h130" stroke="var(--result)" stroke-dasharray="4 3"/>',
    cylinder:
      '<ellipse cx="105" cy="41" rx="30" ry="30"/><ellipse cx="105" cy="41" rx="21" ry="22"/><path d="M105 11h100a30 30 0 0 1 0 60H105M135 41h95"/>',
    stress:
      '<path d="M100 20h80v45h-80ZM85 40H55m140 0h30M140 10V0m0 80V68"/><circle cx="225" cy="42" r="25" stroke="var(--result)"/>',
    cycle:
      '<path d="M60 10v60h190M85 55Q95 20 135 15L220 45Q175 58 85 55Z"/><path d="M105 42 115 31m-10 11 3-12" stroke="var(--result)"/>',
    heat: '<path d="M90 14h18v55H90Zm18 9h100v8H108m0 12h100v8H108m0 12h100v8H108"/><path d="M225 65V20m-6 6 6-6 6 6" stroke="var(--load)"/>',
    flow: '<path d="M60 20h65l30 15h50l30-15h15M60 65h65l30-15h50l30 15h15"/><path d="M60 42h185m-7-5 7 5-7 5" stroke="var(--result)"/>',
    soil: '<path d="M60 50h190M120 50V12h30v38h30v12H95V50m-25 7 15 15m20-9 9 9m80-18 18 18m10-18 18 18"/>',
    traffic:
      '<path d="M55 15h190M55 67h190m0-26h190"/><path d="M75 28h30v25H75Zm60 0h30v25h-30Zm60 0h30v25h-30Z" stroke="var(--result)"/>',
    transformer:
      '<path d="M95 70q-15-10 0-20t0-20 0-20M195 70q15-10 0-20t0-20 0-20M135 10v60m12-60v60M55 41h25m130 0h35"/>',
    motor:
      '<circle cx="150" cy="41" r="31"/><circle cx="150" cy="41" r="13" stroke="var(--result)"/><path d="M150 5v12m0 47v12M115 41h12m46 0h12m-92 0h-30m155 0h30"/>',
    phasor:
      '<path d="M75 66h155M115 70V8m0 58 105-45m-105 45 55-50"/><path d="M115 66 190 40m-8 1 8-1-4 7" stroke="var(--result)"/>',
    bands:
      '<path d="M60 15h180M60 68h180M60 41h180"/><path d="M60 53Q150 32 240 25" stroke="var(--result)"/>',
    amplifier:
      '<path d="M110 15v55l70-28ZM55 30h55m-55 25h55m70-13h65m-45 0V8H80v22"/><path d="M120 29h8m-4-4v8m-4 22h8" stroke="var(--result)"/>',
    timing:
      '<path d="M55 65h25V18h50v47h50V18h50v47h20"/><path d="M55 60Q85 18 130 25L130 60Q170 18 180 25" stroke="var(--result)"/>',
    corrosion:
      '<path d="M80 20v48h140V20M105 15v35m90-35v35m-90-35V7h90v8"/><path d="M135 7h35m-7-4 7 4-7 4" stroke="var(--result)"/>',
  };
  return `<svg class="thumb subject-art" viewBox="0 0 300 82" aria-hidden="true"><g ${wire}>${paths[kind]}</g></svg>`;
}

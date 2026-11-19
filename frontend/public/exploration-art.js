import { newExplorationModels } from '../../backend/exploration-release.js';
const categories = {
  optics:
    '<path d="M50 42h200m-100-30v60m-65-55 65 25 60 28"/><path d="M150 12q-15 30 0 60q15-30 0-60" stroke="var(--result)"/>',
  signals:
    '<path d="M45 65h210m-190 0V42m25 23V22m25 43V12m25 53V35m25 30V49m25 16V56m25 9V61"/><path d="M55 65q35-80 60-10t65-20 65 15" stroke="var(--result)"/>',
  control:
    '<path d="M40 40h25m55 0h30m60 0h45M235 40v30H55V40"/><rect x="65" y="25" width="55" height="30"/><rect x="150" y="25" width="60" height="30" stroke="var(--result)"/>',
  embedded:
    '<path d="M40 25h30v30h30V25h45v30h30V25h45v30h35M40 70h40V60h70v10h60V60h45"/><rect x="125" y="8" width="35" height="12" stroke="var(--result)"/>',
  manufacturing:
    '<path d="M65 55h170v15H65ZM120 10h65l-20 35h-25ZM150 47l-12 8m12-8 12 8"/><path d="M55 40h45m95 0h45" stroke="var(--load)"/>',
  aerospace:
    '<ellipse cx="150" cy="41" rx="100" ry="30"/><circle cx="125" cy="41" r="17" stroke="var(--result)"/><circle cx="245" cy="35" r="5" fill="var(--load)"/>',
  chemical:
    '<path d="M70 15h55v55H70Zm105 0h55v55h-55ZM40 40h30m55 0h50m55 0h30M98 10v45m-12 0h24m90-45v45m-12 0h24"/><path d="M148 22v35" stroke="var(--result)"/>',
  industrial:
    '<path d="M55 12v58h195M55 42h195m-130-30v58m65-58v58"/><path d="M65 18h70v17H65Zm80 30h85v17h-85Z" stroke="var(--result)"/>',
  biomedical:
    '<path d="M40 42h50l10-10 10 10h15l10-32 12 60 12-28h25q20-32 40 0h35"/><path d="M40 73h220" stroke="var(--result)"/>',
  robotics:
    '<path d="M60 65l65-45 65 35 50-40M60 65h60"/><circle cx="125" cy="20" r="8" stroke="var(--result)"/><circle cx="190" cy="55" r="8" stroke="var(--result)"/><path d="m232 12 8 3 8 10" stroke="var(--load)"/>',
  automotive:
    '<path d="M65 55V35l30-15h100l35 25h20v15H65ZM100 20l-5 25h110l-10-25"/><circle cx="105" cy="60" r="13" stroke="var(--result)"/><circle cx="210" cy="60" r="13" stroke="var(--result)"/>',
  communications:
    '<path d="M45 60q28-90 55 0t55 0 55 0 45 0"/><path d="M55 60q50-50 95 0t95 0" stroke="var(--result)"/>',
};
const distinct = {
  fresnel: '<path d="M55 65Q155 70 200 5M55 65Q150 10 195 65l45-50"/>',
  pointcharges:
    '<circle cx="105" cy="41" r="13"/><circle cx="195" cy="41" r="13" stroke="var(--load)"/><path d="M115 20q35-45 70 0m-70 40q35 45 70 0m-65-19h60"/>',
  spectrogram: Array.from(
    { length: 16 },
    (_, i) =>
      `<path d="M${65 + i * 11} ${60 - i * 2.5}v-14" stroke-width="8" opacity="${0.3 + i * 0.04}"/>`,
  ).join(''),
  rootlocus3:
    '<path d="M65 42h180m-100-30v60M95 42q35-5 80-30M95 42q35 5 80 30m-80-30H55"/><path d="m85 37 10 10m-10 0 10-10m40 0 10 10m-10 0 10-10" stroke="var(--load)"/>',
  serialtiming: categories.embedded,
  simplextableau:
    '<path d="M70 10h160v62H70Zm40 0v62m40-62v62m40-62v62M70 30h160M70 51h160"/><rect x="110" y="30" width="40" height="21" stroke="var(--load)"/>',
  rrtplanner:
    '<path d="M65 65l25-25 35 12 20-35m-55 23 15-25m20 37 45 12 25-30 50-18m-75 48 60 6"/><circle cx="165" cy="35" r="14" stroke="var(--load)"/>',
  occupancygrid:
    '<path d="M80 10h140v60H80Zm20 0v60m20-60v60m20-60v60m20-60v60m20-60v60m20-60v60M80 30h140M80 50h140"/><path d="M105 60l40-45m-40 45 85-25m-85 25 110-5" stroke="var(--result)"/>',
  ofdm: '<path d="M55 65Q90-40 125 65Q160-40 195 65M90 65Q125-40 160 65Q195-40 230 65"/>',
  antennapattern:
    '<path d="M150 42C45-30 45 115 150 42C255-30 255 115 150 42Z"/><path d="M150 10v62" stroke="var(--result)"/>',
};
export function explorationThumbnail(id) {
  const model = newExplorationModels[id];
  if (!model) return null;
  return `<g fill="none" stroke="var(--curve)" stroke-width="2" stroke-linejoin="round">${distinct[id] ?? categories[model.definition.discipline]}</g>`;
}

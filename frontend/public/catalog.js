import { models } from '../../backend/waves.js';
import { solveBeam } from '../../backend/beam.js';

const form = document.getElementById('catalog-filters');
const search = document.getElementById('lab-search');
const discipline = document.getElementById('discipline-filter');
const status = document.getElementById('catalog-status');
const grid = document.getElementById('catalog-grid');
const labGroups = {
  civil: 'Civil', mechanical: 'Mechanical', electrical: 'Electrical',
  electronics: 'Electronics', signals: 'Signals & systems',
};
const beam = solveBeam({ case: 'point', span: 6, load: 24, modulus: 200, inertia: 8000 });
const labs = [
  {
    href: '/beam.html', title: 'Beam Analysis', groups: ['civil'],
    description: 'Explore how a beam carries load, from support reactions to slope and deflection.',
    graphic: beam.series.map(({ x, deflection }) => ({ x, y: deflection })),
  },
  {
    href: '/axial.html', title: 'Axial Stress & Strain', groups: ['civil', 'mechanical'],
    description: 'Calculate how a bar elongates in tension or shortens in compression.',
    drawing: '<rect x="82" y="31" width="136" height="20" rx="3" fill="none" stroke="var(--curve)" stroke-width="2"/><path d="M72 41H38m0 0 9-6m-9 6 9 6m181-6h34m0 0-9-6m9 6-9 6" fill="none" stroke="var(--load)" stroke-width="2"/>',
  },
  {
    href: '/mohr.html', title: 'Mohr’s Circle', groups: ['mechanical'],
    description: 'Rotate a stress element and find its principal stresses and maximum in-plane shear.',
    drawing: '<circle cx="150" cy="41" r="29" fill="none" stroke="var(--curve)" stroke-width="2"/><path d="M127 59l46-36" stroke="var(--curve)" stroke-dasharray="4 3"/><circle cx="173" cy="23" r="4" fill="var(--load)"/>',
  },
  ...Object.values(models).map(({ definition, solve }) => ({
    href: `/simulation.html?lab=${definition.id}`, title: definition.title, groups: [definition.discipline],
    description: definition.description,
    topic: {
      buckling: 'Structural stability', hydrostatic: 'Fluid statics', torsion: 'Solid mechanics',
      oscillator: 'Dynamics',
    }[definition.id] ?? {
      electrical: 'Circuit analysis', electronics: 'Analog electronics', signals: 'Signal processing',
    }[definition.discipline],
    graphic: solve(Object.fromEntries(Object.entries(definition.inputs).map(([key, input]) => [key, input.initial]))).series,
  })),
];

function thumbnail({ drawing, graphic }) {
  if (!drawing) {
    const xMin = graphic[0].x, xMax = graphic.at(-1).x;
    const ys = graphic.flatMap(point => [point.y, point.reference].filter(Number.isFinite));
    const min = Math.min(0, ...ys), max = Math.max(0, ...ys);
    const trace = key => graphic.map(point =>
      `${20 + 260 * (point.x - xMin) / (xMax - xMin)},${68 - 56 * (point[key] - min) / (max - min || 1)}`).join(' ');
    const reference = Number.isFinite(graphic[0].reference)
      ? `<polyline points="${trace('reference')}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>` : '';
    drawing = `<polyline points="${trace('y')}" fill="none" stroke="var(--curve)" stroke-width="2"/>${reference}`;
  }
  return `<svg class="thumb" viewBox="0 0 300 82" aria-hidden="true">
    <path d="M20 18h260M20 41h260M20 64h260M40 10v62M95 10v62M150 10v62M205 10v62M260 10v62" fill="none" stroke="var(--grid)"/>
    ${drawing}</svg>`;
}

const cards = labs.map(lab => {
  const card = document.createElement('a');
  card.className = 'sim-link';
  card.href = lab.href;
  const group = lab.groups.map(key => labGroups[key]).join(' + ');
  const topic = lab.topic ?? 'Solid mechanics';
  card.innerHTML = `${thumbnail(lab)}
    <div class="card-tags"><span>${group}</span><span>${topic}</span><span>Beginner</span></div>
    <strong>${lab.title}</strong><p>${lab.description}</p>
    <span class="open-lab">Open lab <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>`;
  grid.append(card);
  return { card, groups: lab.groups, terms: card.textContent.toLowerCase() };
});

function filter() {
  const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const { card, groups, terms } of cards) {
    card.hidden = Boolean(discipline.value && !groups.includes(discipline.value)) || !words.every(word => terms.includes(word));
    if (!card.hidden) count++;
  }
  status.textContent = count ? `${count} ${count === 1 ? 'experiment' : 'experiments'} available`
    : 'No matching experiments. Try a different search or discipline.';
}

function hashFilter() {
  const group = location.hash.slice(1);
  if (Object.hasOwn(labGroups, group)) discipline.value = group;
  filter();
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', filter);
form.addEventListener('reset', event => {
  event.preventDefault();
  search.value = '';
  discipline.value = '';
  if (Object.hasOwn(labGroups, location.hash.slice(1))) history.replaceState(null, '', location.pathname + location.search);
  filter();
});
window.addEventListener('hashchange', hashFilter);
form.hidden = false;
hashFilter();

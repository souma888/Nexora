import { models } from '../../backend/waves.js';
import { solveBeam } from '../../backend/beam.js';
import { setActiveDiscipline } from './shell.ts';
import { algorithms } from '../../backend/algorithm-definitions.js';

const form = document.getElementById('catalog-filters');
const search = document.getElementById('lab-search');
const discipline = document.getElementById('discipline-filter');
const status = document.getElementById('catalog-status');
const grid = document.getElementById('catalog-grid');
const labGroups = {
  civil: 'Civil', mechanical: 'Mechanical', electrical: 'Electrical',
  electronics: 'Electronics', signals: 'Signals & systems',
  control: 'Control systems', algorithms: 'Data Structures & Algorithms',
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
      electrical: 'Circuit analysis', electronics: 'Analog electronics', signals: 'Signal processing', control: 'Feedback & dynamics',
    }[definition.discipline],
    graphic: solve(Object.fromEntries(Object.entries(definition.inputs).map(([key, input]) => [key, input.initial]))).series,
  })),
  ...Object.values(algorithms).map(definition => ({
    href: `/algorithms.html?lab=${definition.id}`, title: definition.title, groups: ['algorithms'],
    description: definition.description,
    topic: definition.topic ?? { sort: 'Sorting', search: 'Searching', graph: 'Graphs & paths', dp: 'Dynamic programming', number: 'Number theory' }[definition.kind],
    level: ['graph', 'dp', 'tree', 'graph-extra', 'dp-extra', 'string'].includes(definition.kind) ? 'Intermediate' : 'Beginner',
    drawing: definition.kind === 'tree'
      ? '<path d="M150 18l-60 40m60-40 60 40" fill="none" stroke="var(--curve)" stroke-width="2"/>' + [[150,18],[90,58],[210,58]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="9" fill="var(--surface-1)" stroke="var(--result)" stroke-width="2"/>`).join('')
      : definition.kind === 'structure'
        ? [65,125,185].map((x,i) => `<rect x="${x}" y="25" width="42" height="32" rx="4" fill="none" stroke="var(--curve)" stroke-width="2"/>${i < 2 ? `<path d="M${x+44} 41h14m-4-4 4 4-4 4" fill="none" stroke="var(--result)"/>` : ''}`).join('')
      : ['graph', 'graph-extra'].includes(definition.kind)
      ? '<path d="M70 41l70-22 65 22-65 22Zm70-22v44m-70-22h135" fill="none" stroke="var(--curve)" stroke-width="2"/>' + [[70,41],[140,19],[140,63],[205,41]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="5" fill="var(--result)"/>`).join('')
      : definition.kind === 'string'
        ? '<text x="150" y="32" text-anchor="middle" style="fill:var(--muted);font-size:17px">A B A B A B C</text><text x="165" y="59" text-anchor="middle" style="fill:var(--result);font-size:17px">A B A B C</text>'
      : ['dp', 'dp-extra'].includes(definition.kind)
        ? '<path d="M90 12h120v58H90Zm0 19h120M90 50h120m-90-38v58m30-58v58m30-58v58" fill="none" stroke="var(--curve)" stroke-width="2"/><rect x="151" y="32" width="28" height="17" fill="var(--result)" opacity=".6"/>'
        : definition.kind === 'number'
          ? '<text x="150" y="48" text-anchor="middle" style="fill:var(--result);font-size:22px">48 mod 18 = 12</text>'
          : [38,12,27,8,43,19,5,31].map((v,i) => `<rect x="${45+i*27}" y="${68-v}" width="18" height="${v}" rx="2" fill="${i === 2 ? 'var(--load)' : 'var(--curve)'}"/>`).join(''),
  })),
];

function thumbnail({ drawing, graphic }) {
  if (!drawing) {
    const xMin = Math.min(...graphic.map(p => p.x)), xMax = Math.max(...graphic.map(p => p.x));
    const ys = graphic.flatMap(point => [point.y, point.reference].filter(Number.isFinite));
    const min = Math.min(0, ...ys), max = Math.max(0, ...ys);
    const trace = key => graphic.map(point =>
      `${20 + 260 * (point.x - xMin) / (xMax - xMin || 1)},${68 - 56 * (point[key] - min) / (max - min || 1)}`).join(' ');
    const reference = Number.isFinite(graphic[0].reference)
      ? `<polyline points="${trace('reference')}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>` : '';
    drawing = graphic.some(p => Number.isFinite(p.locus))
      ? graphic.map(p => `<circle cx="${20 + 260 * (p.x-xMin)/(xMax-xMin || 1)}" cy="${68 - 56 * (p.y-min)/(max-min || 1)}" r="1.2" fill="var(--curve)"/>`).join('')
      : `<polyline points="${trace('y')}" fill="none" stroke="var(--curve)" stroke-width="2"/>${reference}`;
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
    <div class="card-tags"><span class="discipline-tag">${group}</span><span>${topic}</span><span>${lab.level ?? 'Beginner'}</span></div>
    <strong>${lab.title}</strong><p>${lab.description}</p>
    <span class="open-lab">Open lab <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span>`;
  grid.append(card);
  return { card, groups: lab.groups, terms: card.textContent.toLowerCase() };
});

function filter() {
  setActiveDiscipline(discipline.value);
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
  if (group === 'about' || group === 'catalog-filters') return;
  discipline.value = Object.hasOwn(labGroups, group) ? group : '';
  filter();
}
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main').focus();
});
form.addEventListener('submit', event => event.preventDefault());
search.addEventListener('input', filter);
discipline.addEventListener('change', () => {
  const hash = `#${discipline.value || 'all'}`;
  if (location.hash !== hash) history.pushState(null, '', hash);
  filter();
});
form.addEventListener('reset', event => {
  event.preventDefault();
  search.value = '';
  discipline.value = '';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  filter();
});
window.addEventListener('hashchange', hashFilter);
form.hidden = false;
document.getElementById('total-labs').textContent = labs.length;
document.getElementById('total-disciplines').textContent = Object.keys(labGroups).length;
const initialAnchor = location.hash.slice(1);
if (initialAnchor === 'about' || initialAnchor === 'catalog-filters') {
  filter();
  document.getElementById(initialAnchor).scrollIntoView();
} else {
  hashFilter();
}

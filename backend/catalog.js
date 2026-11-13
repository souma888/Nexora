import { models } from './waves.js';
import { algorithms } from './algorithm-definitions.js';
import { disciplines } from './disciplines.js';

const dedicated = [
  {
    id: 'beam',
    title: 'Beam Analysis',
    groups: ['civil'],
    description: 'Explore how a beam carries load, from support reactions to slope and deflection.',
    href: '/beam.html',
    endpoint: '/api/beam',
    topic: 'Solid mechanics',
  },
  {
    id: 'axial',
    title: 'Axial Stress & Strain',
    groups: ['civil', 'mechanical'],
    description: 'Calculate how a bar elongates in tension or shortens in compression.',
    href: '/axial.html',
    endpoint: '/api/materials',
    topic: 'Solid mechanics',
  },
  {
    id: 'mohr',
    title: 'Mohr’s Circle',
    groups: ['mechanical'],
    description:
      'Rotate a stress element and find its principal stresses and maximum in-plane shear.',
    href: '/mohr.html',
    endpoint: '/api/materials',
    topic: 'Solid mechanics',
  },
];
/** Routes and catalog entries are derived from the executable registries, not a second lab list. */
export const catalog = [
  ...dedicated.map((entry) => ({ ...entry, engine: 'dedicated', level: 'Beginner' })),
  ...Object.values(models).map(({ definition: d }) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    groups: [d.discipline],
    engine: 'numeric',
    href: `/simulation.html?lab=${d.id}`,
    endpoint: '/api/waves',
    topic:
      d.topic ??
      {
        electrical: 'Circuit analysis',
        electronics: 'Analog electronics',
        signals: 'Signal processing',
        control: 'Feedback & dynamics',
      }[d.discipline] ??
      'Engineering models',
    level: d.id === 'circuitbuilder' ? 'Intermediate' : 'Beginner',
  })),
  ...Object.values(algorithms).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    groups: ['algorithms'],
    engine: 'algorithm',
    href: `/algorithms.html?lab=${d.id}`,
    endpoint: '/api/algorithms',
    topic:
      d.topic ??
      {
        sort: 'Sorting',
        search: 'Searching',
        graph: 'Graphs & paths',
        dp: 'Dynamic programming',
        number: 'Number theory',
      }[d.kind] ??
      'Algorithms',
    level: ['graph', 'dp', 'tree', 'graph-extra', 'dp-extra', 'string'].includes(d.kind)
      ? 'Intermediate'
      : 'Beginner',
  })),
];
export const disciplineCounts = Object.fromEntries(
  Object.keys(disciplines).map((id) => [
    id,
    catalog.filter((lab) => lab.groups.includes(id)).length,
  ]),
);
if (new Set(catalog.map((lab) => lab.id)).size !== catalog.length)
  throw new Error('Duplicate lab ID in catalog.');
for (const lab of catalog)
  for (const group of lab.groups)
    if (!Object.hasOwn(disciplines, group)) throw new Error(`Unknown discipline ${group}.`);

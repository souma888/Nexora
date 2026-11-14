import { models } from './numeric-models.js';
import { algorithms } from './algorithm-definitions.js';
import { definition, solveBeam } from './beam.js';
import { models as materials } from './materials.js';
export const dedicated = [
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

/** Canonical executable inventory. Catalog, API schema, worker and generated docs derive from this. */
export const labManifest = [
  ...dedicated.map((meta) => ({
    ...meta,
    engine: 'dedicated',
    level: 'Beginner',
    model: meta.id === 'beam' ? { definition, solve: solveBeam } : materials[meta.id],
  })),
  ...Object.values(models).map((model) => ({
    id: model.definition.id,
    title: model.definition.title,
    description: model.definition.description,
    groups: [model.definition.discipline],
    topic:
      model.definition.topic ??
      {
        electrical: 'Circuit analysis',
        electronics: 'Analog electronics',
        signals: 'Signal processing',
        control: 'Feedback & dynamics',
      }[model.definition.discipline] ??
      'Engineering models',
    level: ['circuitbuilder', 'trussfem', 'systemidentification', 'kalmanfilter'].includes(
      model.definition.id,
    )
      ? 'Intermediate'
      : 'Beginner',
    engine: 'numeric',
    model,
    href: `/simulation.html?lab=${model.definition.id}`,
    endpoint: '/api/waves',
  })),
  ...Object.values(algorithms).map((definition) => ({
    id: definition.id,
    title: definition.title,
    description: definition.description,
    groups: ['algorithms'],
    topic:
      definition.topic ??
      {
        sort: 'Sorting',
        search: 'Searching',
        graph: 'Graphs & paths',
        dp: 'Dynamic programming',
        number: 'Number theory',
      }[definition.kind] ??
      'Algorithms',
    level: ['graph', 'dp', 'tree', 'graph-extra', 'dp-extra', 'string'].includes(definition.kind)
      ? 'Intermediate'
      : 'Beginner',
    engine: 'algorithm',
    model: { definition },
    href: `/algorithms.html?lab=${definition.id}`,
    endpoint: '/api/algorithms',
  })),
];
if (new Set(labManifest.map((entry) => entry.id)).size !== labManifest.length)
  throw new Error('Duplicate lab identifier.');

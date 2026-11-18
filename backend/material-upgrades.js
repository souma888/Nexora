import { advancedMaterialModels } from './advanced-materials.js';
import {
  engineering,
  p,
  choice,
  seq,
  bisect,
  clamp,
  lesson,
  domain,
  requireValue,
  result,
  diagram,
} from './engineering-kit.js';
const phaseFraction = (T, C, gap) => {
  const solidus = (c) => 900 + 600 * c - gap * Math.sin(Math.PI * c),
    liquidus = (c) => 900 + 600 * c + gap * Math.sin(Math.PI * c);
  if (T <= solidus(C)) return { solid: 1, liquid: 0, solidComposition: C, liquidComposition: null };
  if (T >= liquidus(C))
    return { solid: 0, liquid: 1, solidComposition: null, liquidComposition: C };
  const cs = bisect((c) => solidus(c) - T, 0, 1),
    cl = bisect((c) => liquidus(c) - T, 0, 1),
    solid = (C - cl) / (cs - cl);
  return {
    solid: clamp(solid),
    liquid: clamp(1 - solid),
    solidComposition: cs,
    liquidComposition: cl,
  };
};
export { phaseFraction };
const binary = engineering(
  {
    id: 'leverrule',
    version: '2.0',
    title: 'Binary Phase Diagram and Lever Rule',
    discipline: 'materials',
    topic: 'Phase equilibria & diffusion',
    inputs: {
      mode: choice(
        'Equilibrium input',
        {
          tie: 'Supplied two-phase tie line',
          diagram: 'Illustrative temperature–composition diagram',
        },
        'tie',
      ),
      alpha: {
        ...p('Supplied alpha composition', '%', 0, 99, 20),
        visibleWhen: { key: 'mode', is: 'tie' },
      },
      beta: {
        ...p('Supplied beta composition', '%', 1, 100, 80),
        visibleWhen: { key: 'mode', is: 'tie' },
      },
      composition: p('Overall composition', '%', 0, 100, 40),
      temperature: {
        ...p('Temperature', '°C', 800, 1600, 1100),
        visibleWhen: { key: 'mode', is: 'diagram' },
      },
      gap: {
        ...p('Solidus/liquidus half-gap parameter', 'K', 20, 120, 60),
        visibleWhen: { key: 'mode', is: 'diagram' },
      },
    },
    validateValues: domain('composition', (a) => {
      if (a.mode === 'tie')
        requireValue(
          a.alpha < a.beta && a.composition >= a.alpha && a.composition <= a.beta,
          'Require Cα<Cβ with overall composition inside the supplied tie line.',
        );
    }),
    metrics: {
      alpha: ['Alpha phase / diagram solid fraction', '1'],
      beta: ['Beta phase / diagram liquid fraction', '1'],
    },
    plot: {
      x: 'Overall composition',
      xUnit: '%',
      y: 'Mass fraction',
      yUnit: '1',
      traces: { y: 'Beta / liquid', reference: 'Alpha / solid' },
    },
    text: lesson(
      'Keep the original supplied-tie-line calculator or locate equilibrium endpoints on a bounded binary solidus/liquidus diagram.',
      'Does cooling at fixed overall composition necessarily keep both phase fractions fixed?',
      [
        'No, tie-line endpoints and phase fields change',
        'Yes, composition alone fixes fractions',
        'Only pure metals have phase boundaries',
      ],
      'Equilibrium phase amounts depend on temperature as well as overall composition.',
      'Supplied Cα=20%, Cβ=80% and C0=40% give wβ=1/3. In diagram mode, temperatures below the solidus give all solid.',
      'Supplied tie line: wβ=(C0−Cα)/(Cβ−Cα). Diagram: Ts=900+600c−g sinπc, Tl=900+600c+g sinπc; invert each boundary at T and apply the lever rule.',
      'Diagram mode is an explicitly illustrative isomorphous equilibrium envelope, not a CALPHAD alloy database. Pure-end melting temperatures are 900 and 1500°C. Its solid is solute-rich and liquid solute-poor. Alpha/beta labels in supplied mode refer to arbitrary supplied phases; diagram mode relabels the fractions as solid/liquid. No kinetics or phase density conversion.',
    ),
  },
  (a) => {
    if (a.mode === 'tie') {
      const beta = (a.composition - a.alpha) / (a.beta - a.alpha);
      return {
        ...result(
          { alpha: 1 - beta, beta },
          seq(a.alpha, a.beta, 240).map((x) => ({
            x,
            y: (x - a.alpha) / (a.beta - a.alpha),
            reference: (a.beta - x) / (a.beta - a.alpha),
          })),
          'binary-phase',
          { mode: 'tie', alpha: a.alpha, beta: a.beta, composition: a.composition },
          [['Mode', 'Supplied tie line']],
        ),
        visualization: {
          type: 'phase-tie',
          alpha: a.alpha,
          beta: a.beta,
          composition: a.composition,
        },
      };
    }
    const f = phaseFraction(a.temperature, a.composition / 100, a.gap),
      curves = seq(0, 100).map((x) => ({
        x,
        y: 900 + 6 * x - a.gap * Math.sin((Math.PI * x) / 100),
        reference: 900 + 6 * x + a.gap * Math.sin((Math.PI * x) / 100),
      }));
    return result(
      { alpha: f.solid, beta: f.liquid },
      seq(0, 100).map((x) => {
        const s = phaseFraction(a.temperature, x / 100, a.gap);
        return { x, y: s.liquid, reference: s.solid };
      }),
      'binary-phase',
      {
        mode: 'diagram',
        alpha: f.solidComposition === null ? null : f.solidComposition * 100,
        beta: f.liquidComposition === null ? null : f.liquidComposition * 100,
        composition: a.composition,
        temperature: a.temperature,
        curves,
      },
      [
        [
          'Solid equilibrium composition %',
          f.solidComposition === null ? 'No solid' : f.solidComposition * 100,
        ],
        [
          'Liquid equilibrium composition %',
          f.liquidComposition === null ? 'No liquid' : f.liquidComposition * 100,
        ],
      ],
    );
  },
);
advancedMaterialModels.leverrule = binary;
for (const id of [
  'fickdiffusion',
  'hallpetch',
  'fracturetoughness',
  'pariscrack',
  'goodman',
  'larsonmiller',
]) {
  const model = advancedMaterialModels[id],
    solve = model.solve;
  model.definition.execution = 'worker';
  model.definition.topic =
    id === 'fickdiffusion'
      ? 'Phase equilibria & diffusion'
      : id === 'hallpetch'
        ? 'Strengthening mechanisms'
        : 'Failure, fatigue & creep';
  model.solve = (input) => {
    const r = solve(input);
    return {
      ...r,
      visualization: diagram(
        id === 'fickdiffusion'
          ? 'diffusion'
          : id === 'hallpetch'
            ? 'grains'
            : id === 'fracturetoughness' || id === 'pariscrack'
              ? 'crack'
              : id === 'goodman'
                ? 'goodman'
                : 'creep-life',
        { ...input, ...r.summary, points: r.series },
      ),
    };
  };
}

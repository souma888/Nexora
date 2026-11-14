export { solveTruss } from '../../backend/truss.js';
export { solveCircuit } from '../../backend/circuit-builder.js';
export { solveLinear } from '../../backend/linear.js';
export { solveBeam } from '../../backend/beam.js';
export { convert, describeUnit, compatibleUnits } from '../../backend/physical-units.js';
export { fitParameters, analyzeParameters, parseData } from '../../backend/numerical-tools.js';
import { resolveLab } from '../../backend/platform.js';
import { labManifest } from '../../backend/lab-manifest.js';
export const listLabs = () =>
  labManifest.map(({ id, engine, model }) => ({
    id,
    engine,
    version: model.definition.version,
    title: model.definition.title ?? id,
  }));
export const solveLab = (id, input) => resolveLab(id).solve(input);

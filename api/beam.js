import { definition, solveBeam } from '../backend/beam.js';
import { simulationHandler } from '../backend/contract.js';

export const GET = () => Response.json({ models: [definition] });
export const POST = simulationHandler((input) => ({ input, definition, solve: solveBeam }));

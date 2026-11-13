import { models } from '../backend/materials.js';
import { simulationHandler } from '../backend/contract.js';

export const GET = () =>
  Response.json({ models: Object.values(models).map((model) => model.definition) });
export const POST = simulationHandler((body) => {
  const { model, input } = body ?? {};
  if (typeof model === 'string' && Object.hasOwn(models, model)) return { ...models[model], input };
});

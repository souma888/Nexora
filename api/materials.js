import { models } from '../backend/materials.js';

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }
  const { model, input } = payload ?? {};
  if (typeof model !== 'string' || !Object.hasOwn(models, model) || !input) {
    return Response.json({ error: 'Choose a supported experiment and supply its inputs.' }, { status: 422 });
  }
  const definition = models[model];
  const parameters = {};
  for (const [key, [min, max]] of Object.entries(definition.fields)) {
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
      return Response.json({ error: `${key} must be between ${min} and ${max}.` }, { status: 422 });
    }
    parameters[key] = input[key];
  }
  return Response.json({ input: parameters, version: '1.0', summary: definition.solve(parameters) });
}

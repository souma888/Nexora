import { algorithms, runAlgorithm } from '../backend/algorithms.js';
import { AlgorithmInputError } from '../backend/algorithm-definitions.js';

export const GET = () => Response.json({ models: Object.values(algorithms) });
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send a valid JSON body.', code: 'INVALID_JSON', field: null }, { status: 400 }); }
  try { return Response.json(runAlgorithm(body?.model, body?.input)); }
  catch (error) {
    if (!(error instanceof AlgorithmInputError)) throw error;
    return Response.json({ error: error.message, field: error.field, code: error.field === 'model' ? 'UNKNOWN_MODEL' : 'INVALID_INPUT' }, { status: 422 });
  }
}

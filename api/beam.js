import { solveBeam, validateBeam } from '../backend/beam.js';

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }
  const error = validateBeam(input);
  if (error) return Response.json({ error }, { status: 422 });
  const { case: model, span, load, modulus, inertia } = input;
  return Response.json(solveBeam({ case: model, span, load, modulus, inertia }));
}

export const number = (label, unit, min, max) => ({ label, type: 'number', unit, min, max });

export function validate(definition, input) {
  const values = {};
  for (const [key, field] of Object.entries(definition.inputs)) {
    const value = input?.[key];
    if (field.type === 'enum') {
      if (!field.options.includes(value)) return { key, message: `Choose a supported ${field.label.toLowerCase()}.` };
    } else if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return { key, message: `${field.label} must be between ${field.min} and ${field.max}.` };
    }
    values[key] = value;
  }
  return { values };
}

export function simulationHandler(select) {
  return async request => {
    let body;
    try {
      body = await request.json();
    } catch {
      return failure('Send a valid JSON body.', 'INVALID_JSON', 400);
    }
    const model = select(body);
    if (!model) return failure('Choose a supported experiment.', 'UNKNOWN_MODEL', 422, 'model');
    const { definition, solve, input } = model;
    const { values, key, message } = validate(definition, input);
    if (message) return failure(message, 'INVALID_INPUT', 422, key);
    return Response.json({
      model: definition.id, input: values, version: definition.version,
      units: definition.outputs, series: [], ...solve(values),
    });
  };
}

function failure(error, code, status, field = null) {
  return Response.json({ error, code, field }, { status });
}

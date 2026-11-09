export const number = (label, unit, min, max) => ({ label, type: 'number', unit, min, max });

export function validate(definition, input) {
  const values = {};
  for (const [key, field] of Object.entries(definition.inputs)) {
    if (field.visibleWhen && input?.[field.visibleWhen.key] !== field.visibleWhen.is) { values[key] = field.initial; continue; }
    const value = input?.[key];
    if (field.type === 'enum') {
      if (!field.options.includes(value)) return { key, message: `Choose a supported ${field.label.toLowerCase()}.` };
    } else if (field.type === 'integer-list') {
      const parts = typeof value === 'string' && value.length <= 300 ? value.split(',').map(s => s.trim()) : [];
      if (!parts.length || parts.length > field.maxItems || parts.some(s => !/^[-+]?\d+$/.test(s) || Number(s) < field.minItem || Number(s) > field.maxItem)) {
        return { key, message: `${field.label}: use 1–${field.maxItems} comma-separated integers from ${field.minItem} to ${field.maxItem}.` };
      }
    } else if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return { key, message: `${field.label} must be between ${field.min} and ${field.max}.` };
    } else if (field.integer && !Number.isInteger(value)) {
      return { key, message: `${field.label} must be a whole number.` };
    }
    values[key] = value;
  }
  for (const rule of definition.rules ?? []) {
    if (rule.when && values[rule.when.key] !== rule.when.is) continue;
    let valid = true;
    if (rule.type === 'less') valid = values[rule.left] < values[rule.right];
    if (rule.type === 'same-length') valid = values[rule.left].split(',').length === values[rule.right].split(',').length;
    if (rule.type === 'counter-range') valid = values.initial < 2 ** values.bits;
    if (rule.type === 'root-bracket') {
      const fn = x => values.function === 'cubic' ? x ** 3 - x - 2 : Math.cos(x) - x;
      valid = fn(values.lower) * fn(values.upper) <= 0;
    }
    if (!valid) return { key: rule.field, message: rule.message };
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

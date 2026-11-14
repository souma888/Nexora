/** Parameter adapters retain real model inputs; synthetic keys never reach a solver. */
export function parameterSpace(definition, input = {}) {
  const fields = {},
    values = { ...input };
  const rawSource =
    definition.inputs ??
    Object.fromEntries(
      Object.entries(definition.defaults ?? {}).map(([key, value]) => [
        key,
        typeof value === 'number'
          ? { type: 'number', integer: true, min: -1000, max: 1000, initial: value, label: key }
          : typeof value === 'string' && /^\s*-?\d+(\s*,\s*-?\d+)*\s*$/.test(value)
            ? { type: 'integer-list', minItem: -1000, maxItem: 1000, initial: value, label: key }
            : { type: 'text', initial: value, label: key },
      ]),
    );
  const source = Object.fromEntries(
    Object.entries(rawSource).map(([key, field]) => [
      key,
      field.type === 'integer'
        ? { ...field, type: 'number', integer: true }
        : (field.type === 'string' && field.format === 'comma-separated-integers') ||
            field.type === 'list'
          ? {
              ...field,
              type: 'integer-list',
              minItem: field.itemMin ?? field.min,
              maxItem: field.itemMax ?? field.max,
            }
          : field,
    ]),
  );
  for (const [key, field] of Object.entries(source)) {
    if (field.type === 'number') {
      fields[key] = field;
      values[key] = Number(input[key] ?? field.initial);
    } else if (field.type === 'integer-list') {
      const parts = String(input[key] ?? field.initial).split(',');
      for (let i = 0; i < Math.min(parts.length, 24); i++) {
        const name = `list:${key}:${i}`;
        fields[name] = {
          type: 'number',
          integer: true,
          label: `${field.label ?? key} [${i}]`,
          unit: '1',
          min: field.minItem,
          max: field.maxItem,
        };
        values[name] = Number(parts[i]);
      }
    } else if (definition.id === 'circuitbuilder' && key === 'netlist') {
      for (const [i, line] of String(input[key] ?? field.initial)
        .split(/[;\n]+/)
        .filter((s) => s.trim())
        .entries()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length !== 5 || !Number.isFinite(Number(parts[4]))) continue;
        const name = `circuit:${i}`;
        fields[name] = {
          type: 'number',
          label: `${parts[1]} (${parts[0]})`,
          unit: parts[0] === 'R' ? 'Ω' : parts[0] === 'V' ? 'V' : 'A',
          min: parts[0] === 'R' ? 0.001 : parts[0] === 'V' ? -1000 : -10,
          max: parts[0] === 'R' ? 1e9 : parts[0] === 'V' ? 1000 : 10,
        };
        values[name] = Number(parts[4]);
      }
    }
  }
  return { fields, values };
}
export function applyParameters(definition, base, candidate) {
  const result = { ...base },
    space = parameterSpace(definition, base);
  for (const [key, field] of Object.entries(space.fields)) {
    if (!Object.hasOwn(candidate, key)) continue;
    const value = field.integer ? Math.round(Number(candidate[key])) : Number(candidate[key]);
    if (key.startsWith('list:')) {
      const [, name, index] = key.split(':'),
        parts = String(result[name]).split(',');
      parts[Number(index)] = String(value);
      result[name] = parts.join(',');
    } else if (key.startsWith('circuit:')) {
      const lines = String(result.netlist)
          .split(/[;\n]+/)
          .filter((s) => s.trim()),
        index = Number(key.split(':')[1]),
        parts = lines[index].trim().split(/\s+/);
      parts[4] = String(value);
      lines[index] = parts.join(' ');
      result.netlist = lines.join('; ');
    } else result[key] = value;
  }
  return result;
}

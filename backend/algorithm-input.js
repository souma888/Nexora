export class AlgorithmInputError extends Error {
  constructor(field, message) { super(message); this.field = field; }
}
export const invalid = (field, message) => { throw new AlgorithmInputError(field, message); };
export function integer(value, field, min, max) {
  if ((typeof value === 'string' && !value.trim()) || value === null || !['string', 'number'].includes(typeof value)) invalid(field, `${field} must be an integer from ${min} to ${max}.`);
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) invalid(field, `${field} must be an integer from ${min} to ${max}.`);
  return result;
}
export function list(value, field, maxLength = 16, min = -99, max = 99) {
  if (typeof value !== 'string' || value.length > 300) invalid(field, `${field}: enter a comma-separated list of integers.`);
  const parts = value.split(',').map(s => s.trim());
  if (!parts.length || parts.length > maxLength) invalid(field, `${field}: use 1–${maxLength} integers.`);
  return parts.map(part => integer(part, field, min, max));
}

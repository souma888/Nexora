import { compatibleUnits, convert } from '../../backend/units.ts';
export function snapUnitBoundary(value: number, min: number, max: number) {
  for (const edge of [min, max])
    if (
      Math.abs(value - edge) <=
      1e-10 * Math.max(Number.MIN_VALUE, Math.abs(value), Math.abs(edge))
    )
      return edge;
  return value;
}

type Field = { type: string; unit?: string; min?: number; max?: number; integer?: boolean };
/** Generic labs opt in; the dedicated mechanics pages retain their contextual load-case converters. */
export function attachUnitControls(form: HTMLFormElement, fields: Record<string, Field>) {
  const controls: {
    field: HTMLInputElement;
    select: HTMLSelectElement;
    base: string;
    min: number;
    max: number;
    old: string;
  }[] = [];
  for (const [key, schema] of Object.entries(fields)) {
    if (schema.type !== 'number' || schema.integer || !schema.unit) continue;
    const options = compatibleUnits(schema.unit),
      field = form.elements.namedItem(key);
    if (options.length < 2 || !(field instanceof HTMLInputElement)) continue;
    const select = document.createElement('select');
    select.className = 'unit-select';
    select.setAttribute('aria-label', `Unit for ${field.labels?.[0]?.textContent?.trim() ?? key}`);
    for (const name of [schema.unit, ...options.filter((u) => u !== schema.unit)]) {
      const option = new Option(name, name, name === schema.unit, name === schema.unit);
      select.add(option);
    }
    const suffix = field.nextElementSibling;
    if (suffix?.tagName === 'SPAN') {
      select.id = suffix.id;
      suffix.replaceWith(select);
    } else field.after(select);
    const c = {
      field,
      select,
      base: schema.unit,
      min: schema.min!,
      max: schema.max!,
      old: schema.unit,
    };
    controls.push(c);
    const bounds = () => {
      field.min = String(convert(c.min, c.base, c.old));
      field.max = String(convert(c.max, c.base, c.old));
    };
    select.addEventListener('change', () => {
      // Preserve the physical quantity and blank/invalid state; round only for display.
      if (field.value !== '' && Number.isFinite(field.valueAsNumber))
        field.value = String(
          Number(convert(field.valueAsNumber, c.old, select.value).toPrecision(12)),
        );
      c.old = select.value;
      bounds();
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    select.dataset.valueType = 'unit';
  }
  return {
    canonical(values: Record<string, number | string>) {
      const out = { ...values };
      for (const c of controls) {
        out[c.field.name] = snapUnitBoundary(
          convert(Number(out[c.field.name]), c.old, c.base),
          c.min,
          c.max,
        );
      }
      return out;
    },
    reset() {
      for (const c of controls) {
        c.select.value = c.base;
        c.old = c.base;
        c.field.min = String(c.min);
        c.field.max = String(c.max);
      }
    },
    fromCanonical(key: string, value: number | string) {
      const c = controls.find((c) => c.field.name === key);
      return c && typeof value === 'number' ? convert(value, c.base, c.old) : value;
    },
  };
}

import { readFields, setMetric, setupWorkbench } from './workbench.ts';
import { models } from '../../backend/materials.js';
import { validate } from '../../backend/contract.js';

const byId = (id) => document.getElementById(id);
const model = document.body.dataset.model;
const form = byId('material-form');
const svg = byId('material-diagram');
const angle = byId('angle');
const principal = byId('principal-angle');
const circle = { x: 382, y: 123, r: 78 };
const conversions = [
  { key: 'length', select: byId('axial-length-units'), si: 'm', ratio: 1 / 0.3048, factor: 1 },
  { key: 'force', select: byId('axial-force-units'), si: 'kN', ratio: 224.80894387096, factor: 1 },
].filter((control) => control.select);
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const fmt = (value) =>
  Math.abs(value) >= 0.0001 || value === 0 ? formatter.format(value || 0) : value.toExponential(2);
let result;
const arrowhead =
  '<defs><marker id="force-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="var(--load)"/></marker></defs>';
const arrow = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--load)" stroke-width="2" marker-end="url(#force-arrow)"/>`;

function showValue(id, value, unit = '') {
  setMetric(id, value === null ? 'Any angle' : fmt(value), value === null ? '' : unit);
}

function drawAxial({ input: { force }, summary }) {
  const forceUnits = conversions.find((control) => control.key === 'force');
  const direction = Math.sign(force);
  const mode = direction > 0 ? 'Tension' : direction < 0 ? 'Compression' : 'Unloaded';
  const end = 350 + direction * 21;
  const loads =
    direction > 0
      ? arrow(130, 68, 76, 68) + arrow(350, 68, 404, 68)
      : direction < 0
        ? arrow(76, 68, 130, 68) + arrow(404, 68, 350, 68)
        : '';
  byId('mode').textContent = mode;
  svg.setAttribute(
    'aria-label',
    `${mode}. Bar length change: ${fmt(summary.displacement)} millimetres.`,
  );
  svg.innerHTML = `${arrowhead}
    <text class="load-label" x="240" y="34" text-anchor="middle">F = ${fmt(force * forceUnits.factor)} ${forceUnits.select.value}</text>
    <rect x="130" y="53" width="220" height="30" rx="3" fill="var(--surface-2)" stroke="var(--muted)"/>
    ${loads}
    <path d="M130 89V166 M350 89V166" stroke="var(--muted)" stroke-dasharray="4 5"/>
    <rect x="130" y="132" width="${end - 130}" height="20" rx="3" fill="var(--surface-2)" stroke="var(--result)"/>
    <text class="reaction-label" x="240" y="185" text-anchor="middle">ΔL = ${fmt(summary.displacement)} mm</text>`;
}

function drawMohr() {
  if (!result) return;
  const { center, radius, principalMax, principalMin } = result.summary;
  const { sigmaX, sigmaY, tauXY } = result.input;
  const degrees = Number(angle.value);
  const radians = (degrees * Math.PI) / 180;
  const d = (sigmaX - sigmaY) / 2;
  const relative = d * Math.cos(2 * radians) + tauXY * Math.sin(2 * radians);
  const shear = tauXY * Math.cos(2 * radians) - d * Math.sin(2 * radians);
  const sigma = center + relative;
  const { x: cx, y: cy, r } = circle;
  const scale = radius ? r / radius : 0;
  const pointX = cx + relative * scale;
  const pointY = cy - shear * scale;
  const zeroX = cx - center * scale;
  const showZero = radius > 0 && zeroX > 245 && zeroX < 526;
  const normalArrow = (value, x1, y1, x2, y2) => {
    if (Math.abs(value) <= Math.max(Math.abs(sigma), Math.abs(center - relative), radius) * 1e-12)
      return '';
    return value > 0 ? arrow(x1, y1, x2, y2) : arrow(x2, y2, x1, y1);
  };
  byId('angle-value').textContent = `${fmt(degrees)}°`;
  byId('rotated-stress').textContent =
    `σx′ ${fmt(sigma)} MPa · τx′y′ ${fmt(Math.abs(shear) < radius * 1e-12 ? 0 : shear)} MPa`;
  svg.setAttribute(
    'aria-label',
    `Stress element rotated ${fmt(degrees)} degrees and its point on Mohr’s circle. ${byId('rotated-stress').textContent}`,
  );
  svg.innerHTML = `${arrowhead}
    <text x="105" y="27" text-anchor="middle">STRESS ELEMENT</text>
    ${degrees ? `<path d="M153 123 A48 48 0 0 ${degrees < 0 ? 1 : 0} ${105 + 48 * Math.cos(radians)} ${123 - 48 * Math.sin(radians)}" stroke="var(--curve)" stroke-width="3" fill="none"/>` : ''}
    <g transform="translate(105 123) rotate(${-degrees})">
      <rect x="-30" y="-30" width="60" height="60" rx="2" fill="var(--surface-2)" stroke="var(--result)"/>
      ${normalArrow(sigma, 34, 0, 60, 0)}${normalArrow(sigma, -34, 0, -60, 0)}
      ${normalArrow(center - relative, 0, -34, 0, -60)}${normalArrow(center - relative, 0, 34, 0, 60)}
      ${normalArrow(shear, 37, 16, 37, -16)}${normalArrow(shear, -37, -16, -37, 16)}
      ${normalArrow(shear, -16, -37, 16, -37)}${normalArrow(shear, 16, 37, -16, 37)}
      <text x="14" y="15">x′</text><text x="-23" y="-13">y′</text>
    </g>
    <text x="105" y="231" text-anchor="middle">θ = ${fmt(degrees)}°</text>
    <path d="M235 ${cy}H529" stroke="var(--muted)"/>
    ${
      showZero
        ? `<path d="M${zeroX} 35V207" stroke="var(--muted)"/><text x="${zeroX + 7}" y="31">τ (MPa)</text>`
        : '<text x="242" y="31">↑ τ (MPa)</text>'
    }
    <text x="529" y="146" text-anchor="end">σ (MPa)</text>
    ${
      radius
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--surface-2)" stroke="var(--curve)" stroke-width="2"/>
      <circle cx="${cx - r}" cy="${cy}" r="3" fill="var(--result)"/>
      <circle cx="${cx + r}" cy="${cy}" r="3" fill="var(--result)"/>
      <path d="M${2 * cx - pointX} ${2 * cy - pointY}L${pointX} ${pointY}" stroke="var(--load)" stroke-dasharray="3 4"/>
      <text x="${cx - r}" y="231" text-anchor="middle">σ₂ ${fmt(principalMin)}</text>
      <text x="${cx + r}" y="231" text-anchor="middle">σ₁ ${fmt(principalMax)}</text>`
        : `<text x="${cx}" y="231" text-anchor="middle">σ₁ = σ₂ = ${fmt(center)}</text>`
    }
    ${radius ? `<circle cx="${pointX}" cy="${pointY}" r="18" fill="transparent" class="mohr-handle" data-mohr-handle/>` : ''}
    <circle cx="${pointX}" cy="${pointY}" r="7" fill="var(--curve)" pointer-events="none"/>`;
}

function render(data) {
  result = data;
  if (model === 'axial') {
    showValue('stress', data.summary.stress, 'MPa');
    showValue('strain', data.summary.strain * 1e6, 'µε');
    showValue('displacement', data.summary.displacement, 'mm');
    drawAxial(data);
    return;
  }
  for (const field of ['principalMax', 'principalMin', 'radius'])
    showValue(field, data.summary[field], 'MPa');
  const theta = data.summary.principalAngle;
  showValue('principalAngle', theta, '°');
  byId('other-angle').textContent =
    theta === null ? '' : `Minor: ${fmt(theta > 0 ? theta - 90 : theta + 90)}°`;
  angle.disabled = false;
  principal.disabled = theta === null;
  drawMohr();
}

function syncUnits(preserve) {
  for (const control of conversions) {
    const field = byId(control.key);
    const original = field.valueAsNumber / control.factor;
    control.factor = control.select.value === control.si ? 1 : control.ratio;
    const { min, max } = models[model].definition.inputs[control.key];
    field.min = min * control.factor;
    field.max = max * control.factor;
    if (preserve && field.value !== '') field.value = original * control.factor;
    field.nextElementSibling.textContent = control.select.value;
  }
}

const { analyze, edited } = setupWorkbench({
  form,
  model: models[model],
  validate,
  render,
  payload() {
    const input = readFields(form);
    for (const { key, factor } of conversions) {
      const value = input[key] / factor;
      const { min, max } = models[model].definition.inputs[key];
      input[key] =
        Math.abs(value - min) < 1e-12 ? min : Math.abs(value - max) < 1e-12 ? max : value;
    }
    return input;
  },
  onReset() {
    if (angle) angle.value = 0;
    syncUnits(false);
  },
});
for (const { select } of conversions) {
  select.addEventListener('change', () => {
    syncUnits(true);
    analyze();
  });
}

if (model === 'axial') {
  const material = byId('material');
  const modulus = byId('modulus');
  material.addEventListener('change', () => {
    if (material.value === 'custom') modulus.focus();
    else modulus.value = material.value;
    edited();
  });
  modulus.addEventListener('input', () => {
    const preset = [...material.options].find(
      (option) => Number(option.value) === modulus.valueAsNumber,
    );
    material.value = preset?.value ?? 'custom';
  });
} else {
  angle.addEventListener('input', drawMohr);
  principal.addEventListener('click', () => {
    angle.value = result.summary.principalAngle;
    drawMohr();
  });
  let dragging = false;
  svg.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('[data-mohr-handle]')) return;
    dragging = true;
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('lostpointercapture', () => {
    dragging = false;
  });
  svg.addEventListener('pointermove', (event) => {
    if (!dragging || !result?.summary.radius) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (Math.hypot(point.x - circle.x, point.y - circle.y) < 1) return;
    const target = (Math.atan2(circle.y - point.y, point.x - circle.x) * 180) / Math.PI;
    let degrees = result.summary.principalAngle - target / 2;
    if (degrees > 90) degrees -= 180;
    if (degrees < -90) degrees += 180;
    angle.value = degrees;
    drawMohr();
  });
}
byId('load-example').addEventListener('click', () => byId('reset').click());
analyze();

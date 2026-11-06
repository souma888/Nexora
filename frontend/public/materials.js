const byId = id => document.getElementById(id);
const model = document.body.dataset.model;
const form = byId('material-form');
const status = byId('status');
const run = form.querySelector('.run');
const svg = byId('material-diagram');
const angle = byId('angle');
const principal = byId('principal-angle');
const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
const fmt = value => Math.abs(value) >= 0.0001 || value === 0 ? formatter.format(value || 0) : value.toExponential(2);
let result;
let pending;
const arrowhead = '<defs><marker id="force-arrow" viewBox="0 0 8 8" markerWidth="5" markerHeight="5" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="var(--red)"/></marker></defs>';
const arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--red)" stroke-width="2" marker-end="url(#force-arrow)"/>`;

function showValue(id, value, unit = '') {
  const cell = byId(id);
  cell.textContent = value === null ? 'Any angle' : fmt(value);
  if (value !== null && unit) {
    const label = document.createElement('small');
    label.textContent = unit;
    cell.append(' ', label);
  }
}

function drawAxial({ input: { force }, summary }) {
  const direction = Math.sign(force);
  const mode = direction > 0 ? 'Tension' : direction < 0 ? 'Compression' : 'Unloaded';
  const end = 350 + direction * 21;
  const loads = direction > 0 ? arrow(130, 68, 76, 68) + arrow(350, 68, 404, 68)
    : direction < 0 ? arrow(76, 68, 130, 68) + arrow(404, 68, 350, 68) : '';
  byId('mode').textContent = mode;
  svg.setAttribute('aria-label', `${mode}. Bar length change: ${fmt(summary.displacement)} millimetres.`);
  svg.innerHTML = `${arrowhead}
    <text class="load-label" x="240" y="34" text-anchor="middle">F = ${fmt(force)} kN</text>
    <rect x="130" y="53" width="220" height="30" rx="3" fill="#31463a" stroke="#adc3b2"/>
    ${loads}
    <path d="M130 89V166 M350 89V166" stroke="#718877" stroke-dasharray="4 5"/>
    <rect x="130" y="132" width="${end - 130}" height="20" rx="3" fill="#456653" stroke="var(--green)"/>
    <text class="reaction-label" x="240" y="185" text-anchor="middle">ΔL = ${fmt(summary.displacement)} mm</text>`;
}

function drawMohr() {
  if (!result) return;
  const { center, radius, principalMax, principalMin } = result.summary;
  const { sigmaX, sigmaY, tauXY } = result.input;
  const degrees = Number(angle.value);
  const radians = degrees * Math.PI / 180;
  const d = (sigmaX - sigmaY) / 2;
  const relative = d * Math.cos(2 * radians) + tauXY * Math.sin(2 * radians);
  const shear = tauXY * Math.cos(2 * radians) - d * Math.sin(2 * radians);
  const sigma = center + relative;
  const cx = 382, cy = 123, r = 78;
  const scale = radius ? r / radius : 0;
  const pointX = cx + relative * scale;
  const pointY = cy - shear * scale;
  const zeroX = cx - center * scale;
  const showZero = radius > 0 && zeroX > 245 && zeroX < 526;
  const normalArrow = (value, x1, y1, x2, y2) => {
    if (Math.abs(value) <= Math.max(Math.abs(sigma), Math.abs(center - relative), radius) * 1e-12) return '';
    return value > 0 ? arrow(x1, y1, x2, y2) : arrow(x2, y2, x1, y1);
  };
  byId('angle-value').textContent = `${fmt(degrees)}°`;
  byId('rotated-stress').textContent = `σx′ ${fmt(sigma)} MPa · τx′y′ ${fmt(Math.abs(shear) < radius * 1e-12 ? 0 : shear)} MPa`;
  svg.setAttribute('aria-label', `Stress element rotated ${fmt(degrees)} degrees and its point on Mohr’s circle. ${byId('rotated-stress').textContent}`);
  svg.innerHTML = `${arrowhead}
    <text x="105" y="27" text-anchor="middle">STRESS ELEMENT</text>
    <g transform="translate(105 123) rotate(${-degrees})">
      <rect x="-30" y="-30" width="60" height="60" rx="2" fill="#304438" stroke="var(--green)"/>
      ${normalArrow(sigma, 34, 0, 60, 0)}${normalArrow(sigma, -34, 0, -60, 0)}
      ${normalArrow(center - relative, 0, -34, 0, -60)}${normalArrow(center - relative, 0, 34, 0, 60)}
      ${normalArrow(shear, 37, 16, 37, -16)}${normalArrow(shear, -37, -16, -37, 16)}
      ${normalArrow(shear, -16, -37, 16, -37)}${normalArrow(shear, 16, 37, -16, 37)}
      <text x="14" y="15">x′</text><text x="-23" y="-13">y′</text>
    </g>
    <text x="105" y="231" text-anchor="middle">θ = ${fmt(degrees)}°</text>
    <path d="M235 ${cy}H529" stroke="#718877"/>
    ${showZero ? `<path d="M${zeroX} 35V207" stroke="#718877"/><text x="${zeroX + 7}" y="31">τ (MPa)</text>`
      : '<text x="242" y="31">↑ τ (MPa)</text>'}
    <text x="529" y="146" text-anchor="end">σ (MPa)</text>
    ${radius ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#486d543a" stroke="var(--green)" stroke-width="2"/>
      <circle cx="${cx - r}" cy="${cy}" r="3" fill="var(--green)"/>
      <circle cx="${cx + r}" cy="${cy}" r="3" fill="var(--green)"/>
      <path d="M${2 * cx - pointX} ${2 * cy - pointY}L${pointX} ${pointY}" stroke="var(--red)" stroke-dasharray="3 4"/>
      <text x="${cx - r}" y="231" text-anchor="middle">σ₂ ${fmt(principalMin)}</text>
      <text x="${cx + r}" y="231" text-anchor="middle">σ₁ ${fmt(principalMax)}</text>`
      : `<text x="${cx}" y="231" text-anchor="middle">σ₁ = σ₂ = ${fmt(center)}</text>`}
    <circle cx="${pointX}" cy="${pointY}" r="5" fill="var(--red)"/>`;
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
  for (const field of ['principalMax', 'principalMin', 'radius']) showValue(field, data.summary[field], 'MPa');
  const theta = data.summary.principalAngle;
  showValue('principalAngle', theta, '°');
  byId('other-angle').textContent = theta === null ? '' : `Minor: ${fmt(theta > 0 ? theta - 90 : theta + 90)}°`;
  angle.disabled = false;
  principal.disabled = theta === null;
  drawMohr();
}

async function analyze() {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  run.disabled = true;
  status.dataset.error = 'false';
  status.textContent = 'Calculating…';
  const input = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]));
  try {
    const response = await fetch('/api/materials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (controller.signal.aborted) return;
    render(data);
    status.textContent = 'Analysis complete';
  } catch (error) {
    if (controller.signal.aborted) return;
    status.dataset.error = 'true';
    status.textContent = error instanceof TypeError || error instanceof SyntaxError
      ? 'The solver is unavailable. Please try again.' : error.message;
  } finally {
    if (pending === controller) {
      pending = undefined;
      run.disabled = false;
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  analyze();
});
function markEdited() {
  pending?.abort();
  pending = undefined;
  run.disabled = false;
  status.dataset.error = 'false';
  status.textContent = result ? 'Inputs changed · showing the last run' : 'Run analysis to see results';
}
form.addEventListener('input', markEdited);
byId('reset').addEventListener('click', () => {
  form.reset();
  if (angle) angle.value = 0;
  analyze();
});

if (model === 'axial') {
  const material = byId('material');
  const modulus = byId('modulus');
  material.addEventListener('change', () => {
    if (material.value === 'custom') modulus.focus();
    else modulus.value = material.value;
    markEdited();
  });
  modulus.addEventListener('input', () => {
    const preset = [...material.options].find(option => Number(option.value) === modulus.valueAsNumber);
    material.value = preset?.value ?? 'custom';
  });
} else {
  angle.addEventListener('input', drawMohr);
  principal.addEventListener('click', () => {
    angle.value = result.summary.principalAngle;
    drawMohr();
  });
}
analyze();

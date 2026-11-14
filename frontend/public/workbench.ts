import { learningTools } from './learning-tools.ts';
import { advancedTools } from './advanced-tools.ts';
import { solverClient } from './worker-client.ts';
import { attachUnitControls } from './unit-controls.ts';
import { installRunTools, type Report } from './run-tools.ts';
type Inputs = Record<string, number | string>;
type Model<Result> = {
  definition: {
    id: string;
    version: string;
    execution?: 'worker';
    outputs: { summary: Record<string, string>; series: Record<string, string> };
    inputs?: Record<
      string,
      { type: string; unit?: string; min?: number; max?: number; integer?: boolean }
    >;
    metrics?: Record<string, string>;
    prediction?: Prediction;
  };
  solve: (input: Inputs) => Result;
};
type Check = (
  definition: Model<unknown>['definition'],
  input: Inputs,
) => { values?: Inputs; message?: string };

export function setMetric(id: string, value: string, unit = '') {
  const cell = document.getElementById(id);
  if (!cell) return;
  cell.textContent = value;
  if (unit) {
    const label = document.createElement('small');
    label.textContent = unit;
    cell.append(' ', label);
  }
}

export const readFields = (form: HTMLFormElement): Inputs =>
  Object.fromEntries(
    [...new FormData(form)]
      .filter(([key]) => key !== 'prediction-choice')
      .map(([key, value]) => [
        key,
        key === 'case' ||
        (form.elements.namedItem(key) as HTMLElement | null)?.dataset.valueType === 'string'
          ? String(value)
          : Number(value),
      ]),
  );

type Prediction = [choices: string[], correct: number, explanation: string];
const predictions: Record<string, Prediction> = {
  beam: [
    ['2×', '4×', '8×'],
    2,
    'For a center point load, peak deflection scales with the cube of span. A uniform load per metre instead gives a fourth-power relationship.',
  ],
  axial: [
    ['Only stress', 'Strain and length change', 'All three outputs'],
    1,
    'Stress is force divided by area. A lower modulus increases strain and length change at the same stress.',
  ],
  mohr: [
    ['Magnitudes change', 'Angle reverses, stresses stay fixed', 'Both stay fixed'],
    1,
    'Shear enters the radius squared, so its sign affects orientation while the principal stresses stay the same.',
  ],
  divider: [
    ['Falls', 'Rises', 'Stays fixed'],
    0,
    'A smaller load resistance reduces the equivalent resistance of the lower leg and pulls the output voltage down.',
  ],
  rc: [
    ['Final voltage only', 'Charging time only', 'Both'],
    1,
    'Capacitance changes the time constant RC. The final capacitor voltage still equals the step voltage.',
  ],
  rectifier: [
    ['A smaller sine wave', 'The positive half-cycle', 'Zero output'],
    2,
    'When the input never reaches the forward drop, the model diode never conducts.',
  ],
  opamp: [
    ['Yes, always', 'Only before clipping', 'Never'],
    1,
    'Feedback sets the linear gain. The output stops increasing once it reaches a voltage limit.',
  ],
  sampling: [
    ['It appears as 4 Hz', 'It remains 8 Hz', 'It appears as 12 Hz'],
    0,
    'An 8 Hz cosine and a 4 Hz cosine have the same sample values at 12 samples per second.',
  ],
  average: [
    ['Fewer samples', 'More samples', 'The same number'],
    1,
    'A wider window keeps older zero-valued samples in the average longer, so the output takes longer to settle.',
  ],
};

function predictionControl(form: HTMLFormElement, model: Model<unknown>['definition']) {
  const prompt = form.querySelector('.prediction');
  const [choices, correct, explanation] = model.prediction ?? predictions[model.id];
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'prediction-answers';
  const legend = document.createElement('legend');
  legend.textContent = 'Choose a prediction';
  fieldset.append(legend);
  const answer = document.createElement('p');
  answer.className = 'prediction-feedback';
  answer.setAttribute('role', 'status');
  let selected: number | undefined;
  let graded = false;
  for (const [index, choice] of [...choices.entries()]
    .map((entry) => ({ entry, sort: crypto.getRandomValues(new Uint32Array(1))[0] }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.entry)) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'prediction-choice';
    radio.addEventListener('input', () => {
      selected = index;
      answer.textContent = 'Change a parameter to check your prediction.';
    });
    label.append(radio, choice);
    fieldset.append(label);
  }
  prompt?.after(fieldset, answer);
  return {
    reveal() {
      if (selected === undefined) return;
      answer.textContent = `${selected === correct ? 'Correct.' : 'Try comparing the outputs.'} ${explanation}`;
      if (!graded) {
        graded = true;
        try {
          const key = 'nexora-prediction-score',
            prior = JSON.parse(localStorage.getItem(key) ?? '{"correct":0,"total":0}');
          const total = Number(prior.total) || 0,
            score = Number(prior.correct) || 0;
          localStorage.setItem(
            key,
            JSON.stringify({ total: total + 1, correct: score + (selected === correct ? 1 : 0) }),
          );
          answer.textContent += ` Practice score: ${score + (selected === correct ? 1 : 0)}/${total + 1}.`;
        } catch {
          /* Scoring remains local to this question. */
        }
      }
    },
    reset() {
      selected = undefined;
      answer.textContent = '';
    },
  };
}

export function setupWorkbench<Result extends Report>({
  form,
  model,
  validate,
  payload,
  render,
  onReset,
  onInvalid,
}: {
  form: HTMLFormElement;
  model: Model<Result>;
  validate: Check;
  payload: () => Inputs;
  render: (data: Result & { input: Inputs; units: unknown }) => void;
  onReset?: () => void;
  onInvalid?: () => void;
}) {
  const status = document.getElementById('status')!;
  const unitControls = attachUnitControls(
    form,
    form.id === 'simulation-form' ? (model.definition.inputs ?? {}) : {},
  );
  const normalize = (input: Inputs) => {
    const result = validate(model.definition, input);
    if (!result.values) throw new Error(result.message ?? 'Invalid inputs.');
    return result.values;
  };
  const learning = learningTools(form, model.definition, applyInputs);
  const analysisTools = advancedTools(form, model.definition, applyInputs);
  const worker = solverClient();
  let generation = 0;
  const tools = installRunTools({
    form,
    model: model.definition.id,
    version: model.definition.version,
    metrics: model.definition.metrics,
    units: model.definition.outputs.summary,
    seriesUnits: model.definition.outputs.series,
    validate: normalize,
    solve: model.solve,
    load: applyInputs,
  });
  const sliders = new Map<HTMLInputElement, HTMLInputElement>();
  const prediction = predictionControl(form, model.definition);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastInput = '';
  const logScale = (input: HTMLInputElement) =>
    input.step === 'any' && Number(input.min) > 0 && Number(input.max) / Number(input.min) >= 1000;
  for (const input of form.querySelectorAll<HTMLInputElement>('.field input[type="number"]')) {
    if (input.dataset.widget === 'bit') continue;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'parameter-slider';
    const label = input.labels?.[0]?.textContent?.trim() ?? input.name;
    slider.setAttribute('aria-label', `Adjust ${label}`);
    input.closest('.field')?.after(slider);
    sliders.set(input, slider);
    slider.addEventListener('input', () => {
      const min = Number(input.min),
        max = Number(input.max);
      input.value = logScale(input)
        ? String(
            Math.min(
              max,
              Math.max(
                min,
                Number((min * (max / min) ** (slider.valueAsNumber / 300)).toPrecision(5)),
              ),
            ),
          )
        : input.step === 'any'
          ? String(Number((min + ((max - min) * slider.valueAsNumber) / 300).toPrecision(12)))
          : slider.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function syncSliders() {
    for (const [input, slider] of sliders) {
      const min = Number(input.min),
        max = Number(input.max);
      const log = logScale(input);
      const normalized = log || input.step === 'any';
      slider.min = normalized ? '0' : input.min;
      slider.max = normalized ? '300' : input.max;
      slider.step = normalized ? '1' : input.step;
      slider.value = log
        ? String(
            Math.round(
              (300 * Math.log(Math.max(min, Number(input.value)) / min)) / Math.log(max / min),
            ),
          )
        : normalized
          ? String(Math.round((300 * (Number(input.value) - min)) / (max - min)))
          : input.value;
      const suffix = input.nextElementSibling;
      const unit = suffix instanceof HTMLSelectElement ? suffix.value : suffix?.textContent?.trim();
      slider.setAttribute('aria-valuetext', `${input.value || 'Unset'}${unit ? ` ${unit}` : ''}`);
    }
  }
  async function analyze() {
    const revision = ++generation;
    clearTimeout(timer);
    syncSliders();
    const { values, message } = validate(model.definition, unitControls.canonical(payload()));
    if (!values || [...sliders.keys()].some((input) => !input.validity.valid)) {
      status.dataset.error = 'true';
      status.textContent = `${message ?? 'Enter values within the allowed ranges.'} The last valid result is still shown.`;
      tools.invalidate();
      analysisTools.invalidate();
      learning.invalidate();
      onInvalid?.();
      return;
    }
    status.dataset.error = 'false';
    status.textContent =
      model.definition.id === 'trussfem' || model.definition.execution === 'worker'
        ? 'Computing in a background worker…'
        : 'Live results';
    let data: Result;
    try {
      data =
        model.definition.id === 'trussfem' || model.definition.execution === 'worker'
          ? await worker.run<Result>(model.definition.id, values)
          : model.solve(values);
    } catch (e) {
      if (revision !== generation) return;
      status.dataset.error = 'true';
      status.textContent = e instanceof Error ? e.message : 'Solver failed.';
      tools.invalidate();
      analysisTools.invalidate();
      learning.invalidate();
      onInvalid?.();
      return;
    }
    if (revision !== generation) return;
    status.textContent = 'Live results';
    render({ ...data, input: values, units: model.definition.outputs });
    tools.setCurrent(values, data);
    analysisTools.setCurrent(values, data);
    learning.setCurrent(values, data);
    const current = JSON.stringify(values);
    if (lastInput && current !== lastInput) prediction.reveal();
    lastInput = current;
  }
  function edited() {
    status.textContent = 'Updating results…';
    generation++;
    worker.cancel();
    analysisTools.invalidate();
    learning.invalidate();
    clearTimeout(timer);
    tools.invalidate();
    timer = setTimeout(analyze, 80);
  }
  function reset() {
    unitControls.reset();
    form.reset();
    prediction.reset();
    onReset?.();
    analyze();
  }
  form.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name !== 'prediction-choice' && target.type !== 'range') edited();
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('reset')?.addEventListener('click', reset);
  function applyInputs(input: Inputs) {
    unitControls.reset();
    form.reset();
    onReset?.();
    for (const [key, value] of Object.entries(input)) {
      const field = form.elements.namedItem(key);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      )
        field.value = String(value);
    }
    analyze();
  }
  return { analyze, edited, syncSliders, reset, applyInputs };
}

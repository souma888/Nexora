import type { Report } from './run-tools.ts';
import { solverClient } from './worker-client.ts';
type Input = Record<string, number | string>;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  n.textContent = text ?? '';
  return n;
};
export function learningTools(
  form: HTMLFormElement,
  model: {
    id: string;
    version: string;
    inputs?: Record<
      string,
      { type: string; integer?: boolean; min?: number; max?: number; label?: string; unit?: string }
    >;
    outputs: { summary: Record<string, string> };
  },
  load: (input: Input) => void,
) {
  if (document.body.classList.contains('embed-mode'))
    return { setCurrent(_input: Input, _data: Report) {}, invalidate() {} };
  const host = el('details'),
    body = el('div'),
    status = el('p'),
    summary = el('summary', 'Practice, accessible plots & 3D');
  host.className = 'run-tools learning-tools';
  status.setAttribute('role', 'status');
  host.append(summary, body);
  const workspace = form.closest('#experiment') ?? form.closest('.workbench');
  workspace?.before(host);
  let current: { input: Input; data: Report } | null = null,
    stop: () => void = () => {},
    dispose3d: () => void = () => {},
    rendererRevision = 0;
  const button = (text: string, action: () => void) => {
    const b = el('button', text);
    b.type = 'button';
    b.className = 'quiet';
    b.onclick = action;
    return b;
  };
  const volume = el('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '.15';
  volume.step = '.01';
  volume.value = '.05';
  volume.setAttribute('aria-label', 'Plot audio volume');
  async function sonify() {
    stop();
    if (!current) return;
    const series = current.data.series ?? [],
      key = Object.keys(series[0] ?? {}).find((k) => k !== 'x' && typeof series[0][k] === 'number');
    if (!key) {
      status.textContent = 'This lab has no numeric trace to sonify.';
      return;
    }
    const values = series.map((p) => Number(p[key])).filter(Number.isFinite);
    if (!values.length) return;
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = 'sine';
    gain.gain.value = Number(volume.value);
    oscillator.connect(gain).connect(audio.destination);
    const low = Math.min(...values),
      high = Math.max(...values);
    values.forEach((v, i) =>
      oscillator.frequency.setValueAtTime(
        220 * 2 ** ((2 * (v - low)) / (high - low || 1)),
        audio.currentTime + (4 * i) / values.length,
      ),
    );
    oscillator.start();
    oscillator.stop(audio.currentTime + 4);
    const close = () => {
      if (audio.state !== 'closed') void audio.close().catch(() => {});
    };
    stop = close;
    oscillator.onended = close;
    status.textContent = `Playing ${key}: low values use low tones, high values use high tones. Four seconds, linear pitch in octaves; use Stop audio to end playback.`;
  }
  const preview = el('div');
  preview.className = 'three-preview';
  async function view() {
    if (!current) return;
    const revision = ++rendererRevision;
    dispose3d();
    try {
      status.textContent = 'Loading 3D view…';
      const { threeView } = await import('./three-view.js');
      if (revision !== rendererRevision) return;
      dispose3d = threeView(preview, model.id, current.data);
      status.textContent = '3D view ready.';
    } catch (e) {
      status.textContent =
        e instanceof Error ? e.message : 'WebGL is unavailable; use the SVG diagram and plots.';
    }
  }
  const available3d = [
    'beam',
    'trussfem',
    'arm',
    'inversearm',
    'fourbar',
    'bernoulli',
    'venturi',
  ].includes(model.id);
  const seed = el('input'),
    answer = el('input'),
    question = el('div'),
    gradeStatus = el('p');
  seed.type = 'number';
  seed.value = '42';
  seed.min = '1';
  seed.max = '999999';
  seed.setAttribute('aria-label', 'Problem set seed');
  answer.type = 'number';
  answer.step = 'any';
  answer.setAttribute('aria-label', 'Numeric problem answer');
  gradeStatus.setAttribute('role', 'status');
  let score = 0,
    attempt = 0,
    expected: number | undefined,
    caseInput: Input | undefined,
    graded = false;
  const client = solverClient();
  async function problem() {
    if (!current) return;
    if (attempt >= 5) {
      attempt = score = 0;
    }
    graded = false;
    expected = undefined;
    answer.value = '';
    const fields = Object.entries(model.inputs ?? {}).filter(
      ([, f]) => f.type === 'number' && !f.integer,
    );
    if (!fields.length) {
      gradeStatus.textContent = 'No continuous parameter is available for randomized problems.';
      return;
    }
    const value = (Math.imul(Number(seed.value) + attempt + 1, 1664525) + 1013904223) >>> 0,
      [key, field] = fields[value % fields.length];
    const base = Number(current.input[key]),
      factor = 0.8 + (value % 4001) / 10000;
    caseInput = {
      ...current.input,
      [key]: Math.max(
        field.min ?? -Infinity,
        Math.min(field.max ?? Infinity, base * factor || factor),
      ),
    };
    const metric = Object.entries(current.data.summary ?? {}).find(
      ([, v]) => typeof v === 'number' && Number.isFinite(v),
    );
    if (!metric) return;
    question.textContent = `Problem ${attempt + 1}/5. Set ${field.label ?? key} to ${Number(caseInput[key]).toPrecision(6)} ${field.unit ?? ''}, keeping other inputs fixed. Predict ${metric[0]} (${model.outputs.summary[metric[0]] ?? ''}). Show your work before checking.`;
    try {
      const result = await client.run<Report>(model.id, caseInput);
      expected = Number(result.summary?.[metric[0]]);
      if (!Number.isFinite(expected)) throw new Error('Output undefined.');
      gradeStatus.textContent = 'Answer within 1% relative tolerance or 10⁻⁸ absolute tolerance.';
    } catch {
      gradeStatus.textContent =
        'That randomized configuration is invalid. Change the seed and generate another problem.';
    }
  }
  const grade = button('Check answer', () => {
    if (graded || expected === undefined || !answer.value) return;
    graded = true;
    attempt++;
    const correct =
      Math.abs(Number(answer.value) - expected) <= Math.max(1e-8, 0.01 * Math.abs(expected));
    if (correct) score++;
    gradeStatus.textContent = `${correct ? 'Correct.' : 'Review the governing equation.'} Expected ${expected.toPrecision(7)}. Score ${score}/${attempt}${attempt === 5 ? ' · set complete' : ''}.`;
    try {
      localStorage.setItem(
        `nexora-practice-${model.id}`,
        JSON.stringify({ seed: seed.value, score, attempt, solver: model.version }),
      );
    } catch {
      /* Session scoring remains available. */
    }
  });
  body.append(
    el(
      'p',
      'Plots remain readable as text and keyboard-controlled sliders. Audio is opt-in: pitch follows the selected numeric trace.',
    ),
    volume,
    button('Play plot audio', () => void sonify()),
    button('Stop audio', () => {
      stop();
      status.textContent = 'Audio stopped.';
    }),
  );
  if (available3d)
    body.append(
      button('Open 3D model', () => void view()),
      preview,
    );
  body.append(
    el('h3', 'Randomized problem set'),
    el(
      'p',
      'Five local practice questions. Each first answer is scored; use a seed to share the same problem sequence. This is practice, not a secure classroom exam.',
    ),
    seed,
    button('Next practice problem', () => void problem()),
    question,
    answer,
    grade,
    button('Load graded problem', () => {
      if (graded && caseInput) load(caseInput);
    }),
    gradeStatus,
    status,
  );
  return {
    setCurrent(input: Input, data: Report) {
      current = { input, data };
    },
    invalidate() {
      current = null;
      rendererRevision++;
      dispose3d();
      stop();
      client.cancel();
      expected = undefined;
    },
  };
}

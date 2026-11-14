import { labManifest } from '../../backend/lab-manifest.js';
const picker = document.querySelector<HTMLSelectElement>('#api-model')!,
  request = document.querySelector<HTMLTextAreaElement>('#api-request')!,
  status = document.querySelector<HTMLElement>('#api-status')!,
  output = document.querySelector<HTMLElement>('#api-response')!;
for (const entry of labManifest)
  picker.add(new Option(entry.model.definition.title ?? entry.id, entry.id));
function example() {
  const entry = labManifest.find((entry) => entry.id === picker.value)!;
  const definition = entry.model.definition;
  const input =
    'inputs' in definition
      ? Object.fromEntries(
          Object.entries(
            definition.inputs as Record<
              string,
              { initial?: number | string; type: string; options?: string[]; min?: number }
            >,
          ).map(([key, field]) => [
            key,
            field.initial ?? (field.type === 'enum' ? field.options?.[0] : field.min),
          ]),
        )
      : definition.defaults;
  if (entry.id === 'beam')
    Object.assign(input, { case: 'point', span: 4, load: 10, modulus: 200, inertia: 8000 });
  if (entry.id === 'axial')
    Object.assign(input, { force: 100, length: 2, area: 1000, modulus: 200 });
  if (entry.id === 'mohr') Object.assign(input, { sigmaX: 80, sigmaY: 20, tauXY: 30, angle: 0 });
  request.value = JSON.stringify(entry.id === 'beam' ? input : { model: entry.id, input }, null, 2);
  output.textContent = '';
  status.textContent = entry.endpoint;
}
picker.onchange = example;
example();
document.querySelector<HTMLButtonElement>('#api-send')!.onclick = async () => {
  try {
    const body = JSON.stringify(JSON.parse(request.value)),
      entry = labManifest.find((entry) => entry.id === picker.value)!;
    const response = await fetch(entry.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    status.textContent = `HTTP ${response.status}`;
    output.textContent = JSON.stringify(await response.json(), null, 2);
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : 'Request failed.';
  }
};

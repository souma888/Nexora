export function setMetric(id, value, unit = '') {
  const cell = document.getElementById(id);
  cell.textContent = value;
  if (unit) {
    const label = document.createElement('small');
    label.textContent = unit;
    cell.append(' ', label);
  }
}

export function setupWorkbench({ form, endpoint, payload, render, onEdit, onReset }) {
  const status = document.getElementById('status');
  const button = form.querySelector('.run');
  const stale = document.getElementById('results-state');
  let current;
  let lastPayload;

  function updateStale() {
    const dirty = lastPayload !== undefined && lastPayload !== JSON.stringify(payload());
    stale.hidden = !dirty;
    onEdit?.(dirty);
    return dirty;
  }

  function edited() {
    current?.abort();
    current = undefined;
    button.disabled = false;
    status.dataset.error = 'false';
    status.textContent = updateStale() ? 'Inputs changed · ready to run'
      : lastPayload ? 'Showing the last analysis' : 'Run analysis to see results';
  }

  async function analyze() {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    const body = JSON.stringify(payload());
    status.dataset.error = 'false';
    status.textContent = 'Calculating…';
    button.disabled = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      render(data);
      lastPayload = body;
      updateStale();
      status.textContent = 'Analysis complete';
    } catch (error) {
      if (controller.signal.aborted) return;
      status.dataset.error = 'true';
      status.textContent = error instanceof TypeError || error instanceof SyntaxError
        ? 'The solver is unavailable. Please try again.' : error.message;
    } finally {
      if (current === controller) {
        current = undefined;
        button.disabled = false;
      }
    }
  }

  form.addEventListener('input', edited);
  form.addEventListener('submit', event => {
    event.preventDefault();
    analyze();
  });
  document.getElementById('reset').addEventListener('click', () => {
    form.reset();
    onReset?.();
    updateStale();
    analyze();
  });
  return { analyze, edited };
}

import { savedRuns } from './run-tools.ts';
export function mountRunLibrary(labs: { id: string; title: string; href: string }[]) {
  const host = document.createElement('section');
  host.id = 'saved-runs';
  host.className = 'saved-library';
  host.setAttribute('aria-label', 'Saved experiments');
  const title = document.createElement('h2');
  title.textContent = 'Your saved experiments';
  const note = document.createElement('p');
  note.textContent =
    'Saved in this browser. Open a run to recalculate it; use JSON export and import to move it between devices.';
  const list = document.createElement('ul');
  host.append(title, note, list);
  document.getElementById('about')?.before(host);
  const render = () => {
    list.replaceChildren();
    for (const run of savedRuns()) {
      const lab = labs.find((l) => l.id === run.model);
      if (!lab) continue;
      const item = document.createElement('li'),
        link = document.createElement('a');
      link.href =
        lab.href + (lab.href.includes('?') ? '&' : '?') + 'saved=' + encodeURIComponent(run.id);
      link.textContent = `${run.label} · ${lab.title}`;
      item.append(link);
      list.append(item);
    }
    if (!list.children.length) {
      const item = document.createElement('li');
      item.textContent = 'No saved runs yet. Open a lab and choose Save, compare & export.';
      list.append(item);
    }
  };
  window.addEventListener('storage', render);
  window.addEventListener('nexora-runs', render);
  render();
}

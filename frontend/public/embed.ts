import { catalog } from '../../backend/catalog.js';
async function open() {
  const id = new URLSearchParams(location.search).get('lab'),
    entry = catalog.find((lab) => lab.id === id);
  if (!entry) throw new Error('Choose a known lab with ?lab=LAB_ID.');
  const path = new URL(entry.href, location.origin).pathname;
  const response = await fetch(path);
  if (!response.ok) throw new Error('Lab template could not be loaded.');
  const template = new DOMParser().parseFromString(await response.text(), 'text/html'),
    main = template.querySelector('main');
  if (!main) throw new Error('Lab template is incomplete.');
  // Only repository-owned templates are loaded. No user HTML enters this document.
  main.querySelectorAll('script,iframe,object,embed').forEach((node) => node.remove());
  document.title = `${entry.title} · Nexora`;
  document.body.className = `${template.body.className} embed-mode`;
  for (const [key, value] of Object.entries(template.body.dataset))
    document.body.dataset[key] = value;
  document.body.replaceChildren(document.importNode(main, true));
  await import('./shell.ts');
  if (id === 'beam') await import('./lab.js');
  else if (id === 'axial' || id === 'mohr') await import('./materials.js');
  else if (entry.engine === 'algorithm') await import('./algorithms.js');
  else await import('./simulation.js');
}
open().catch((error) => {
  document.body.textContent =
    error instanceof Error ? error.message : 'Embedded lab failed to load.';
});

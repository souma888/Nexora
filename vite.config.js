import { escapeHtml as escape } from './backend/html.js';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { disciplines } from './backend/disciplines.js';
import { navigationGroups, disciplineIcon } from './backend/discipline-navigation.js';

const root = resolve('frontend/public');
const pages = ['index', 'beam', 'axial', 'mohr', 'simulation', 'algorithms'];
const links = navigationGroups
  .map(
    ([name, ids]) =>
      `<p class="nav-group">${name}</p>` +
      ids
        .map(
          (id) =>
            `<a href="/#${id}" data-discipline="${id}">${disciplineIcon(id)}<span>${escape(disciplines[id])}</span></a>`,
        )
        .join(''),
  )
  .join('');
const options = Object.entries(disciplines)
  .map(([id, label]) => `<option value="${id}">${escape(label)}</option>`)
  .join('');
const header = `
  <a class="skip" href="#main">Skip to content</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="Nexora catalog"><img src="/mark.svg" alt="" width="30" height="30"><strong>NEXORA</strong></a>
    <span class="top-label">Engineering lab</span>
    <div class="top-actions">
      <a class="source" href="/">All labs</a>
      <a class="source" href="/#about">About</a>
      <button class="quiet" id="theme-toggle" type="button" aria-label="Switch color theme">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg>
        <span>Theme</span>
      </button>
    </div>
  </header>
  <div class="site-layout">
    <aside class="discipline-rail">
      <nav class="discipline-nav" aria-label="Engineering disciplines">
        <h2>Disciplines</h2>
        <div class="discipline-links">
          <a href="/#all" data-discipline="">${disciplineIcon('all')}<span>All disciplines</span></a>
          ${links}
        </div>
      </nav>
    </aside>`;

export default defineConfig({
  root,
  publicDir: false,
  appType: 'mpa',
  plugins: [
    {
      name: 'nexora-shell',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html
            .replace('<!-- site-header -->', header)
            .replace('<!-- discipline-options -->', options)
            .replace('<!-- site-layout-end -->', '</div>'),
      },
    },
  ],
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((page) => [page, resolve(root, `${page}.html`)])),
    },
  },
});

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve('frontend/public');
const pages = ['index', 'beam', 'axial', 'mohr', 'simulation'];
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
          <a href="/#all" data-discipline="">All disciplines</a>
          <a href="/#civil" data-discipline="civil">Civil engineering</a>
          <a href="/#mechanical" data-discipline="mechanical">Mechanical engineering</a>
          <a href="/#electrical" data-discipline="electrical">Electrical engineering</a>
          <a href="/#electronics" data-discipline="electronics">Electronics</a>
          <a href="/#signals" data-discipline="signals">Signals &amp; systems</a>
        </div>
      </nav>
    </aside>`;

export default defineConfig({
  root,
  publicDir: false,
  appType: 'mpa',
  plugins: [{
    name: 'nexora-shell',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replace('<!-- site-header -->', header).replace('<!-- site-layout-end -->', '</div>'),
    },
  }],
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true,
    rollupOptions: { input: Object.fromEntries(pages.map(page => [page, resolve(root, `${page}.html`)])) },
  },
});

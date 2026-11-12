const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
const systemTheme = matchMedia('(prefers-color-scheme: light)');
let theme: string | null = null;
try { theme = localStorage.getItem('nexora-theme'); } catch { /* Use system preference. */ }

function applyTheme() {
  const light = theme ? theme === 'light' : systemTheme.matches;
  root.dataset.theme = light ? 'light' : 'dark';
  toggle?.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
}
toggle?.addEventListener('click', () => {
  theme = root.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('nexora-theme', theme); } catch { /* Keep choice for this page. */ }
  applyTheme();
});
systemTheme.addEventListener('change', applyTheme);
applyTheme();

export function setActiveDiscipline(discipline: string) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.discipline-links a')) {
    if (link.dataset.discipline === discipline) {
      link.setAttribute('aria-current', 'location');
      const list = link.closest<HTMLElement>('.discipline-links');
      if (list) {
        const scrollHost = matchMedia('(max-width: 740px)').matches ? list : link.closest<HTMLElement>('.discipline-nav');
        if (!scrollHost) continue;
        const top = link.getBoundingClientRect().top - scrollHost.getBoundingClientRect().top + scrollHost.scrollTop;
        if (top < scrollHost.scrollTop || top + link.offsetHeight > scrollHost.scrollTop + scrollHost.clientHeight) {
          scrollHost.scrollTop = Math.max(0, top - scrollHost.clientHeight / 2 + link.offsetHeight / 2);
        }
      }
    }
    else link.removeAttribute('aria-current');
  }
}

if (document.body.classList.contains('lab-page')) {
  const discipline = document.body.dataset.discipline;
  if (discipline) setActiveDiscipline(discipline);
  const nav = document.createElement('nav');
  nav.className = 'lab-nav';
  nav.setAttribute('aria-label', 'Lab sections');
  nav.innerHTML = '<a href="#setup">Setup</a><a href="#results">Results</a><a href="#model">Notes</a>';
  document.querySelector('.intro')?.after(nav);
  const badge = document.createElement('a');
  badge.className = 'validated';
  badge.href = 'https://github.com/souma888/Nexora/blob/main/docs/VALIDATION.md';
  badge.textContent = 'Reference case checked';
  nav.append(badge);
  document.querySelector('.setup')?.setAttribute('id', 'setup');
  document.querySelector('.results')?.setAttribute('id', 'results');
  const notes = document.querySelector<HTMLDetailsElement>('.notes#model') ?? document.querySelector<HTMLDetailsElement>('.notes');
  if (notes) notes.id = 'model';
  const update = () => {
    const section = location.hash || '#setup';
    for (const link of nav.querySelectorAll('a')) {
      if (link.hash === section) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (section === '#model' && notes) notes.open = true;
  };
  window.addEventListener('hashchange', update);
  nav.querySelector('[href="#model"]')?.addEventListener('click', () => { if (notes) notes.open = true; });
  const print = document.createElement('button');
  print.className = 'quiet print-report';
  print.type = 'button';
  print.textContent = 'Print lab';
  print.addEventListener('click', () => window.print());
  nav.append(print);
  let closedNotes: HTMLDetailsElement[] = [];
  window.addEventListener('beforeprint', () => {
    closedNotes = [...document.querySelectorAll<HTMLDetailsElement>('.notes:not([open])')];
    for (const detail of closedNotes) detail.open = true;
  });
  window.addEventListener('afterprint', () => {
    for (const detail of closedNotes) detail.open = false;
    closedNotes = [];
  });
  update();
}

const form = document.getElementById('catalog-filters');
const search = document.getElementById('lab-search');
const discipline = document.getElementById('discipline-filter');
const status = document.getElementById('catalog-status');
const sections = Array.from(document.querySelectorAll('.discipline'), section => ({
  section,
  title: section.querySelector('h2').textContent.toLowerCase(),
  links: [...section.querySelectorAll('.sim-link')],
}));

function filter() {
  const words = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const labs = new Set();
  let hasSection = false;
  for (const { section, title, links } of sections) {
    const selected = !discipline.value || discipline.value === section.id;
    for (const link of links) {
      const text = `${title} ${link.textContent}`.toLowerCase();
      link.hidden = !selected || !words.every(word => text.includes(word));
      if (!link.hidden) labs.add(link.pathname + link.search);
    }
    section.hidden = !selected || (links.length ? links.every(link => link.hidden) : words.length > 0);
    hasSection ||= !section.hidden;
  }
  status.textContent = labs.size ? `${labs.size} ${labs.size === 1 ? 'experiment' : 'experiments'} available`
    : hasSection ? 'No experiments available in this discipline yet.' : 'No matching experiments. Try a different search or discipline.';
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', filter);
form.addEventListener('reset', event => {
  event.preventDefault();
  search.value = '';
  discipline.value = '';
  filter();
});
for (const link of document.querySelectorAll('.rail .nav-link')) {
  link.addEventListener('click', () => {
    search.value = '';
    discipline.value = link.hash.slice(1);
    filter();
  });
}
form.hidden = false;
filter();

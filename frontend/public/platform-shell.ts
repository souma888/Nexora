const dictionary: Record<string, Record<string, string>> = {
  hi: {
    'All labs': 'सभी प्रयोग',
    About: 'परिचय',
    Theme: 'थीम',
    Disciplines: 'विषय',
    'All disciplines': 'सभी विषय',
    Setup: 'सेटअप',
    Results: 'परिणाम',
    Notes: 'टिप्पणियाँ',
    'Print lab': 'प्रयोग प्रिंट करें',
    'Save, compare & export': 'सहेजें, तुलना करें और निर्यात करें',
    'Run name': 'प्रयोग का नाम',
    'Save run': 'प्रयोग सहेजें',
    'Export JSON': 'JSON निर्यात',
    'Export CSV': 'CSV निर्यात',
    'Export PNG': 'PNG निर्यात',
    'PDF lab report': 'PDF प्रयोग रिपोर्ट',
    'Classroom share link': 'कक्षा का लिंक',
    'Restore saved': 'सहेजा हुआ खोलें',
    'Compare with current': 'वर्तमान से तुलना करें',
    'Delete saved': 'सहेजा प्रयोग हटाएँ',
    Reset: 'रीसेट',
    'Choose a prediction': 'पूर्वानुमान चुनें',
    'Enable offline': 'ऑफलाइन चालू करें',
  },
};
let locale = 'en';
try {
  locale = localStorage.getItem('nexora-locale') ?? 'en';
} catch {
  /* English default. */
}
const originals = new WeakMap<Text, string>();
function translate(restore = false) {
  document.documentElement.lang = locale;
  if (locale === 'en' && !restore) return;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (
      node.parentElement?.closest(
        'script,style,textarea,option,output,.model-table,.analysis-output',
      )
    )
      continue;
    const text = node as Text,
      key = originals.get(text) ?? text.data.trim();
    if (!originals.has(text)) originals.set(text, key);
    const value = locale === 'en' ? key : dictionary[locale]?.[key];
    if (value && text.data.trim() !== value) text.data = text.data.replace(text.data.trim(), value);
  }
}
if (!document.body.classList.contains('embed-mode')) {
  const host = matchMedia('(max-width:740px)').matches
      ? (document.querySelector('footer') ?? document.querySelector('main'))
      : document.querySelector('.discipline-nav'),
    label = document.createElement('label'),
    select = document.createElement('select'),
    note = document.createElement('p');
  label.className = 'locale-picker';
  label.textContent = 'Interface language';
  select.setAttribute('aria-label', 'Interface language');
  select.append(new Option('English', 'en'), new Option('हिन्दी', 'hi'));
  select.value = locale === 'hi' ? 'hi' : 'en';
  label.append(select);
  note.className = 'locale-note';
  note.textContent = 'Lab equations and teaching notes are in English.';
  host?.append(label, note);
  select.onchange = () => {
    locale = select.value;
    try {
      localStorage.setItem('nexora-locale', locale);
    } catch {
      /* Use for current page. */
    }
    translate(locale === 'en');
  };
  let scheduled = false;
  new MutationObserver(() => {
    if (locale === 'en') return;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      translate();
    });
  }).observe(document.body, { childList: true, subtree: true });
  translate();
  const docs = document.createElement('a');
  docs.href = '/api-docs.html';
  docs.className = 'locale-note';
  docs.textContent = 'Developer API';
  host?.append(docs);
  const offline = document.createElement('button'),
    status = document.createElement('p');
  offline.className = 'quiet offline-button';
  offline.type = 'button';
  offline.textContent = 'Enable offline';
  status.className = 'locale-note';
  status.setAttribute('aria-live', 'polite');
  host?.append(offline, status);
  offline.onclick = async () => {
    if (!('serviceWorker' in navigator)) {
      status.textContent = 'Offline support is unavailable in this browser.';
      return;
    }
    offline.disabled = true;
    status.textContent =
      'Downloading the lab app and optional tools for offline use. This can take a few minutes.';
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const worker = registration.installing ?? registration.waiting ?? registration.active;
      if (worker?.state === 'activated')
        status.textContent = 'Offline app is ready. Saved runs stay in this browser.';
      else
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'activated')
            status.textContent = 'Offline app is ready. Reload once before going offline.';
          if (worker.state === 'redundant') {
            status.textContent = 'Offline download failed. Reconnect and retry.';
            offline.disabled = false;
          }
        });
    } catch {
      status.textContent = 'Offline setup requires the production build over HTTPS (or localhost).';
      offline.disabled = false;
    }
  };
}

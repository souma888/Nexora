import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openapi } from '../backend/openapi.js';
const files = [];
async function walk(path = 'dist') {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const name = join(path, item.name);
    if (item.isDirectory()) await walk(name);
    else files.push('/' + name.slice(5).replaceAll('\\', '/'));
  }
}
const notices = [];
for (const [name, path] of [
  ['Three.js', 'node_modules/three/LICENSE'],
  ['jsPDF', 'node_modules/jspdf/LICENSE'],
  ['TensorFlow.js', 'frontend/public/licenses/TensorFlow-LICENSE.txt'],
  ['Lato', 'frontend/public/fonts/report/OFL.txt'],
  ['Inter', 'node_modules/@fontsource-variable/inter/LICENSE'],
  ['JetBrains Mono', 'node_modules/@fontsource-variable/jetbrains-mono/LICENSE'],
])
  notices.push(name + '\n\n' + (await readFile(path, 'utf8')));
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n---\n\n'));
await walk();
await copyFile('frontend/public/mark.svg', 'dist/mark.svg');
await writeFile('dist/openapi.json', JSON.stringify(openapi, null, 2));
await writeFile(
  'dist/manifest.webmanifest',
  JSON.stringify({
    name: 'Nexora Engineering Lab',
    short_name: 'Nexora',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#13171a',
    theme_color: '#d6294f',
    icons: [{ src: '/mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }),
);
files.push('/', '/mark.svg', '/openapi.json', '/manifest.webmanifest');
const { createHash } = await import('node:crypto'),
  hash = createHash('sha256');
for (const file of files.filter((p) => p !== '/')) hash.update(await readFile('dist' + file));
const cache = 'nexora-' + hash.digest('hex').slice(0, 12);
await writeFile(
  'dist/sw.js',
  `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify([...new Set(files)])};
self.addEventListener('install',event=>event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(FILES);}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('nexora-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname.startsWith('/api/'))return;event.respondWith((async()=>{try{return await fetch(event.request);}catch{const cache=await caches.open(CACHE);const response=await cache.match(event.request,{ignoreSearch:url.pathname.endsWith('.html')||url.pathname==='/'});return response||new Response('This resource was not saved for offline use.',{status:503,headers:{'Content-Type':'text/plain'}});}})());});`,
);
console.log(`Offline manifest: ${files.length} files; cache ${cache}.`);

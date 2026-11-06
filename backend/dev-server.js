import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { POST as beam } from '../api/beam.js';
import { POST as materials } from '../api/materials.js';

const assets = {
  '/': ['index.html', 'text/html'],
  '/beam.html': ['beam.html', 'text/html'],
  '/axial.html': ['axial.html', 'text/html'],
  '/mohr.html': ['mohr.html', 'text/html'],
  '/styles.css': ['styles.css', 'text/css'],
  '/lab.js': ['lab.js', 'text/javascript'],
  '/materials.js': ['materials.js', 'text/javascript'],
  '/mark.svg': ['mark.svg', 'image/svg+xml'],
};
const routes = { '/api/beam': beam, '/api/materials': materials };

const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (Object.hasOwn(routes, url.pathname)) {
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' }).end();
        return;
      }
      const request = new Request(url, {
        method: 'POST', headers: req.headers, body: Readable.toWeb(req), duplex: 'half',
      });
      const response = await routes[url.pathname](request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
    if (!asset) {
      res.writeHead(404).end('Page not found');
      return;
    }
    const [file, type] = asset;
    const body = await readFile(new URL(`../frontend/public/${file}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(body);
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Internal server error');
  }
}).listen(port, '127.0.0.1', () => console.log(`Nexora · http://127.0.0.1:${port}`));

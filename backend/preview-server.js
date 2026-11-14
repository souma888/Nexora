import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import * as catalog from '../api/catalog.js';
import * as beam from '../api/beam.js';
import * as materials from '../api/materials.js';
import * as waves from '../api/waves.js';
import * as algorithms from '../api/algorithms.js';
import * as openapi from '../api/openapi.js';
const routes = {
  '/api/catalog': catalog,
  '/api/beam': beam,
  '/api/materials': materials,
  '/api/waves': waves,
  '/api/algorithms': algorithms,
  '/api/openapi': openapi,
};
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')),
  root = resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'),
      policy = config.headers[url.pathname === '/embed.html' ? 1 : 0].headers;
    for (const h of policy) res.setHeader(h.key, h.value);
    if (Object.hasOwn(routes, url.pathname)) {
      const handler = routes[url.pathname][req.method];
      if (!handler) {
        res.writeHead(405).end();
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value !== undefined)
          (Array.isArray(value) ? value : [value]).forEach((v) => headers.append(key, v));
      const body =
        req.method === 'POST'
          ? {
              body: /** @type {ReadableStream} */ (/** @type {unknown} */ (Readable.toWeb(req))),
              duplex: 'half',
            }
          : {};
      const result = await handler(new Request(url, { method: req.method, headers, ...body }));
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(await result.text());
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const path = resolve(
      root,
      '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const value = await readFile(path);
      res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
      if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
      res.writeHead(200).end(req.method === 'HEAD' ? undefined : value);
    } catch {
      res.writeHead(404).end('Not found');
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Internal error');
  }
}).listen(Number(process.env.PORT ?? 3100), '127.0.0.1', () =>
  console.log(`Production preview: http://127.0.0.1:${process.env.PORT ?? 3100}`),
);

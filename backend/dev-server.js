import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer as createViteServer } from 'vite';
import * as catalog from '../api/catalog.js';
import * as beam from '../api/beam.js';
import * as materials from '../api/materials.js';
import * as waves from '../api/waves.js';
import * as algorithms from '../api/algorithms.js';

const routes = {
  '/api/catalog': catalog,
  '/api/beam': beam,
  '/api/materials': materials,
  '/api/waves': waves,
  '/api/algorithms': algorithms,
};

const port = Number(process.env.PORT || 3000);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (Object.hasOwn(routes, url.pathname)) {
      const handlers = routes[url.pathname];
      if (!Object.hasOwn(handlers, req.method)) {
        res.writeHead(405, { Allow: 'GET, POST' }).end();
        return;
      }
      const body =
        req.method === 'POST'
          ? {
              body: /** @type {ReadableStream} */ (/** @type {unknown} */ (Readable.toWeb(req))),
              duplex: 'half',
            }
          : {};
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const request = new Request(url, { method: req.method, headers, ...body });
      const response = await handlers[req.method](request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    vite.middlewares(req, res, () => res.writeHead(404).end('Page not found'));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Internal server error');
  }
});
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } } });
server.listen(port, '127.0.0.1', () => console.log(`Nexora · http://127.0.0.1:${port}`));

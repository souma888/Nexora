import assert from 'node:assert/strict';
import { openapi } from '../backend/openapi.js';
import { catalog } from '../backend/catalog.js';
import { models } from '../backend/waves.js';
import { models as materials } from '../backend/materials.js';
import { definition as beam, solveBeam } from '../backend/beam.js';
import { algorithms, runAlgorithm } from '../backend/algorithms.js';

async function verify() {
  const origin = new URL(process.argv[2] ?? '');
  if (
    origin.protocol !== 'https:' &&
    !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))
  )
    throw new Error('Pass an HTTPS deployment URL, or a local development URL.');
  async function send(path, options = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetch(new URL(path, origin), {
          ...options,
          signal: AbortSignal.timeout(30000),
        });
      } catch (error) {
        if (attempt === 2)
          throw new Error(`${path}: network failure: ${error.cause?.code ?? error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  async function request(path, payload) {
    const response = await send(path, {
      ...(payload === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
    });
    const text = await response.text();
    if (response.status !== 200)
      throw new Error(`${path}: HTTP ${response.status}: ${text.slice(0, 160)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON content: ${text.slice(0, 160)}`);
    }
  }
  const home = await send('/');
  assert.equal(home.status, 200);
  if (origin.protocol === 'https:') {
    assert.match(home.headers.get('content-security-policy') ?? '', /script-src 'self'/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  }
  const schema = await request('/api/openapi');
  assert.equal(schema.openapi, '3.1.0');
  assert.deepEqual(
    Object.keys(schema.components.schemas).sort(),
    Object.keys(openapi.components.schemas).sort(),
  );
  for (const path of [
    '/embed.html?lab=hallpetch',
    '/manifest.webmanifest',
    '/sw.js',
    '/api-docs.html',
  ]) {
    const response = await send(path);
    assert.equal(response.status, 200, path);
    if (path.startsWith('/embed') && origin.protocol === 'https:')
      assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors https:/);
  }
  const discovery = await request('/api/catalog');
  assert.equal(discovery.labs.length, catalog.length);
  for (const [path, expected] of [
    ['/api/beam', [beam]],
    ['/api/materials', Object.values(materials).map((m) => m.definition)],
    ['/api/waves', Object.values(models).map((m) => m.definition)],
    ['/api/algorithms', Object.values(algorithms)],
  ]) {
    const data = await request(path);
    assert.deepEqual(
      data.models.map((d) => [d.id, d.version]).sort(),
      expected.map((d) => [d.id, d.version]).sort(),
      path,
    );
  }
  const cases = Object.entries(models).map(([id, m]) => ({
    path: '/api/waves',
    payload: {
      model: id,
      input: Object.fromEntries(
        Object.entries(m.definition.inputs).map(([key, f]) => [key, f.initial]),
      ),
    },
    version: m.definition.version,
    solve: (input) => m.solve(input),
  }));
  cases.push({
    path: '/api/beam',
    payload: { case: 'point', span: 6, load: 24, modulus: 200, inertia: 8000 },
    version: beam.version,
    solve: solveBeam,
  });
  for (const [id, input] of [
    ['axial', { force: 100, length: 2, area: 500, modulus: 200 }],
    ['mohr', { sigmaX: 80, sigmaY: 20, tauXY: 30 }],
  ])
    cases.push({
      path: '/api/materials',
      payload: { model: id, input },
      version: materials[id].definition.version,
      solve: (value) => materials[id].solve(value),
    });
  for (const [id, d] of Object.entries(algorithms))
    cases.push({
      path: '/api/algorithms',
      payload: { model: id, input: d.defaults },
      version: d.version,
      solve: (input) => runAlgorithm(id, input),
    });
  for (let i = 0; i < cases.length; i += 3)
    await Promise.all(
      cases.slice(i, i + 3).map(async (c) => {
        const result = await request(c.path, c.payload),
          expected = c.solve(c.payload.input ?? c.payload);
        assert.equal(result.version, c.version, c.payload.model ?? 'beam');
        if (expected.summary)
          for (const [key, value] of Object.entries(expected.summary)) {
            if (value === null) assert.equal(result.summary[key], null);
            else
              assert.ok(
                Math.abs(result.summary[key] - value) <= 1e-8 * Math.max(1, Math.abs(value)),
                `${c.payload.model ?? 'beam'}:${key}`,
              );
          }
        else assert.deepEqual(result.result, JSON.parse(JSON.stringify(expected.result)));
      }),
    );
  for (const [model, overrides] of [
    ['roots', { function: 'cubic', method: 'bisection', lower: -1, upper: 0 }],
    ['counter', { bits: 2, initial: 5 }],
    ['branch', { predictor: 'one', initial: 3 }],
    ['crc', { error: 20 }],
    ['alu', { width: 4, a: 16 }],
  ]) {
    const input = {
      ...Object.fromEntries(
        Object.entries(models[model].definition.inputs).map(([k, f]) => [k, f.initial]),
      ),
      ...overrides,
    };
    const response = await send('/api/waves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 422, model);
  }
  console.log(
    `Verified ${cases.length} deployed lab results, all discovery endpoints, domain hooks${origin.protocol === 'https:' ? ' and security headers' : ''}.`,
  );
}
verify().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

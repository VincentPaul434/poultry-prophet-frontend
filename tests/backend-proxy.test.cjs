/* eslint-disable @typescript-eslint/no-require-imports -- Load the route without starting Next.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const route = require('../app/api/backend/[...path]/route.ts');
const context = { params: Promise.resolve({ path: ['records'] }) };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function request(options = {}) {
  const req = new Request('http://frontend.test/api/backend/records?query=private', options);
  req.nextUrl = new URL(req.url);
  return req;
}

test('forwards the request with a fresh correlation ID and preserves the streamed response', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'http://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url: String(url), ...options };
    return new Response('upstream body', { status: 201, headers: { 'x-request-id': 'untrusted-upstream', 'content-type': 'text/plain' } });
  });

  const response = await route.POST(request({ method: 'POST', headers: { authorization: 'Bearer secret', cookie: 'session=secret', 'x-request-id': 'secret-client-id' }, body: 'private payload' }), context);
  const id = response.headers.get('x-request-id');
  assert.match(id, uuid);
  assert.equal(sent.headers.get('x-request-id'), id);
  assert.equal(sent.headers.get('authorization'), 'Bearer secret');
  assert.equal(sent.headers.get('cookie'), null);
  assert.equal(sent.url, 'http://backend.invalid/api/records?query=private');
  assert.equal(Buffer.from(sent.body).toString(), 'private payload');
  assert.equal(response.status, 201);
  assert.equal(await response.text(), 'upstream body');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('aborts an upstream request after the deadline and returns a safe 504', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'http://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let expire;
  let duration;
  let signal;
  let cleared = false;
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => { expire = callback; duration = ms; return 123; });
  t.mock.method(globalThis, 'clearTimeout', (timer) => { if (timer === 123) cleared = true; });
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('secret upstream details'))));
  });
  const pending = route.GET(request(), context);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(duration, 30_000);
  expire();
  const response = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(response.status, 504);
  assert.match(response.headers.get('x-request-id'), uuid);
  assert.doesNotMatch(await response.text(), /secret|private/i);
  assert.equal(cleared, true);
});

test('returns a safe 502 for other upstream failures without logging credentials or payloads', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'http://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  const logs = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) t.mock.method(console, method, (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Bearer secret private payload'); });
  const response = await route.POST(request({ method: 'POST', headers: { authorization: 'Bearer secret' }, body: 'private payload' }), context);
  assert.equal(response.status, 502);
  assert.match(response.headers.get('x-request-id'), uuid);
  assert.doesNotMatch(await response.text(), /secret|private/i);
  assert.doesNotMatch(JSON.stringify(logs), /secret|private/i);
});

test('clears the deadline after upstream headers arrive, while the response remains readable', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'http://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let cleared = false;
  let signal;
  t.mock.method(globalThis, 'setTimeout', () => 123);
  t.mock.method(globalThis, 'clearTimeout', (timer) => { if (timer === 123) cleared = true; });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signal = options.signal;
    return new Response('streamed');
  });
  const response = await route.GET(request(), context);
  assert.equal(cleared, true);
  assert.equal(signal.aborted, false);
  assert.equal(await response.text(), 'streamed');
});

test('configuration errors return a fresh ID without calling the backend', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'file:///private';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('unexpected fetch'); });
  const first = await route.GET(request(), context);
  const second = await route.GET(request(), context);
  assert.equal(first.status, 500);
  assert.match(first.headers.get('x-request-id'), uuid);
  assert.match(second.headers.get('x-request-id'), uuid);
  assert.notEqual(first.headers.get('x-request-id'), second.headers.get('x-request-id'));
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await first.text(), /private/);
});

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

function refreshRequest() {
  const req = new Request('https://frontend.test/api/backend/auth/refresh', {
    method: 'POST',
    headers: { origin: 'https://frontend.test', host: 'frontend.test', cookie: 'pp_refresh=test-secret', 'content-type': 'application/json' },
    body: '{}',
  });
  req.nextUrl = new URL(req.url);
  return req;
}

test('an unavailable backend does not receive sign-in credentials', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), ...options });
    return new Response(null, { status: 503 });
  });
  const req = new Request('https://frontend.test/api/backend/auth/login', {
    method: 'POST',
    headers: { origin: 'https://frontend.test', host: 'frontend.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'private@example.test', password: 'private-password' }),
  });
  req.nextUrl = new URL(req.url);
  const response = await route.POST(req, { params: Promise.resolve({ path: ['auth', 'login'] }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-pp-refresh-not-started'), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://backend.invalid/api/health/ready');
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].redirect, 'manual');
  assert.doesNotMatch(JSON.stringify(calls[0].headers), /private/);
});

test('an unavailable backend is checked before sending a one-time refresh credential', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), method: options.method ?? 'GET', body: options.body });
    return new Response(null, { status: 503 });
  });
  const response = await route.POST(refreshRequest(), { params: Promise.resolve({ path: ['auth', 'refresh'] }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-pp-refresh-not-started'), '1');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(calls, [{ url: 'https://backend.invalid/api/health/ready', method: 'GET', body: undefined }]);
  assert.doesNotMatch(await response.text(), /test-secret/);
});

test('a redirected readiness probe is not followed and does not send the refresh credential', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'manual');
    assert.equal(options.body, undefined);
    return new Response(null, { status: 302, headers: { location: 'https://other.invalid/' } });
  });
  const response = await route.POST(refreshRequest(), { params: Promise.resolve({ path: ['auth', 'refresh'] }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-pp-refresh-not-started'), '1');
  assert.equal(calls, 1);
});

test('a ready backend receives the refresh once and cannot forge the not-started marker', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: options.body });
    if (calls.length === 1) return Response.json({ status: 'UP' });
    return new Response(null, { status: 503, headers: { 'x-pp-refresh-not-started': '1' } });
  });
  const response = await route.POST(refreshRequest(), { params: Promise.resolve({ path: ['auth', 'refresh'] }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('x-pp-refresh-not-started'), null);
  assert.deepEqual(calls.map(call => call.url), ['https://backend.invalid/api/health/ready', 'https://backend.invalid/api/auth/refresh']);
  assert.equal(JSON.parse(calls[1].body).refreshToken, 'test-secret');
});

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
  const entry = logs.find(([event]) => event === 'backend_proxy_failure');
  assert.equal(entry[1].requestId, response.headers.get('x-request-id'));
  assert.equal(entry[1].method, 'POST');
  assert.equal(entry[1].status, 502);
  assert.equal(entry[1].category, 'api');
  assert.equal(entry[1].reason, 'unavailable');
  assert.ok(entry[1].durationMs >= 0);
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

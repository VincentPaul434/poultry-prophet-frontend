/* eslint-disable @typescript-eslint/no-require-imports -- Load the route without a Next server. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const route = require('../app/api/backend/[...path]/route.ts');

const endpoints = [
  ['POST', ['auth', 'login']], ['POST', ['auth', 'register']],
  ['POST', ['auth', 'refresh']], ['POST', ['auth', 'logout']],
  ['POST', ['invites', 'invite-id', 'accept']], ['PUT', ['account', 'profile']],
];

function request(method, path, origin, site) {
  const headers = { 'content-type': 'application/json' };
  headers.cookie = 'pp_refresh=old-token';
  if (origin !== undefined) headers.origin = origin;
  if (site !== undefined) headers['sec-fetch-site'] = site;
  const req = new Request(`https://frontend.test/api/backend/${path.join('/')}`, { method, headers, body: '{}' });
  req.nextUrl = new URL(req.url);
  return req;
}

test('credential-changing endpoints reject missing, cross-origin and cross-site requests before contacting the backend', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({}); });
  for (const [method, path] of endpoints) {
    for (const [origin, site] of [[undefined, undefined], ['https://evil.test', 'cross-site'], ['https://frontend.test', 'cross-site'], ['null', undefined]]) {
      const response = await route[method](request(method, path, origin, site), { params: Promise.resolve({ path }) });
      assert.equal(response.status, 403, `${method} ${path.join('/')} with ${origin} / ${site}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
  assert.equal(calls, 0);
});

test('same-origin credential-changing requests keep the existing proxy response and correlation ID', async (t) => {
  const original = process.env.BACKEND_API_URL;
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.after(() => { if (original === undefined) delete process.env.BACKEND_API_URL; else process.env.BACKEND_API_URL = original; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    assert.ok(options.headers.get('x-request-id'));
    return Response.json({ ok: true, token: 'access', refreshToken: 'refresh', refreshTokenExpiresAt: '2099-01-01T00:00:00Z' });
  });
  for (const [method, path] of endpoints) {
    const response = await route[method](request(method, path, 'https://frontend.test', 'same-origin'), { params: Promise.resolve({ path }) });
    assert.equal(response.status, path[1] === 'logout' ? 204 : 200);
    if (path[1] !== 'logout') {
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.equal(body.refreshToken, undefined);
    }
    assert.ok(response.headers.get('x-request-id'));
  }
  assert.equal(calls, endpoints.length);
});

/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const route = require('../app/api/backend/[...path]/route.ts');
const auth = { token: 'access', refreshToken: 'secret-refresh', refreshTokenExpiresAt: '2099-01-01T00:00:00Z', userId: 1, farmId: 2, email: 'a', fullName: 'A', role: 'MANAGER' };
function request(path, cookie = '') {
  const req = new Request(`https://frontend.test/api/backend/${path.join('/')}`, { method: 'POST', headers: { origin: 'https://frontend.test', 'content-type': 'application/json', cookie }, body: '{}' });
  req.nextUrl = new URL(req.url);
  return req;
}
test('login hides refresh credential in an HttpOnly cookie', async (t) => {
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.mock.method(globalThis, 'fetch', async () => Response.json(auth));
  const path = ['auth', 'login'];
  const response = await route.POST(request(path), { params: Promise.resolve({ path }) });
  const body = await response.json();
  assert.equal(body.token, 'access');
  assert.equal(body.refreshToken, undefined);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /Secure/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/i);
});
test('refresh uses only the cookie and rotates it; logout clears it', async (t) => {
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { bodies.push(JSON.parse(Buffer.from(options.body).toString())); return bodies.length === 1 ? Response.json(auth) : new Response(null, { status: 204 }); });
  for (const operation of ['refresh', 'logout']) {
    const path = ['auth', operation];
    const response = await route.POST(request(path, 'pp_refresh=old-secret'), { params: Promise.resolve({ path }) });
    assert.equal(response.status, operation === 'refresh' ? 200 : 204);
    assert.match(response.headers.get('set-cookie'), operation === 'refresh' ? /secret-refresh/ : /Max-Age=0/i);
  }
  assert.deepEqual(bodies, [{ refreshToken: 'old-secret' }, { refreshToken: 'old-secret' }]);
});
test('invite and profile responses also keep refresh credentials server-side', async (t) => {
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  t.mock.method(globalThis, 'fetch', async () => Response.json(auth));
  for (const [method, path] of [['POST', ['invites', 'invite-id', 'accept']], ['PUT', ['account', 'profile']]]) {
    const req = request(path);
    const input = method === 'PUT' ? new Request(req.url, { method, headers: req.headers, body: '{}' }) : req;
    input.nextUrl = new URL(input.url);
    const response = await route[method](input, { params: Promise.resolve({ path }) });
    assert.equal((await response.json()).refreshToken, undefined);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  }
});
test('refresh requires exactly one cookie and clears rejected credentials', async (t) => {
  process.env.BACKEND_API_URL = 'https://backend.invalid/api';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ message: 'Invalid refresh token' }, { status: 400 }); });
  const path = ['auth', 'refresh'];
  for (const cookie of ['', 'pp_refresh=one; pp_refresh=two']) {
    const response = await route.POST(request(path, cookie), { params: Promise.resolve({ path }) });
    assert.equal(response.status, 401);
  }
  const response = await route.POST(request(path, 'pp_refresh=bad'), { params: Promise.resolve({ path }) });
  assert.equal(response.status, 400);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
  assert.equal(calls, 1);
});
test('same-origin logout expires the cookie even when backend configuration is missing', async (t) => {
  const previous = process.env.BACKEND_API_URL;
  const oldPublic = process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.BACKEND_API_URL;
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  t.after(() => {
    if (previous !== undefined) process.env.BACKEND_API_URL = previous;
    if (oldPublic !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = oldPublic;
  });
  const path = ['auth', 'logout'];
  const response = await route.POST(request(path, 'pp_refresh=old'), { params: Promise.resolve({ path }) });
  assert.equal(response.status, 500);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
});
